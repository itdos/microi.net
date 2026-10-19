import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';

// 本文件仅验证无凭据的 DNS 上游改动；未修改的鉴权逻辑用测试夹具表示。
// 原 DNS 凭据与目标配置保留在私有镜像，不能进入公开版本控制。
const patch = readFileSync(new URL('../api-engines/dns-sync-ip-upstream.patch', import.meta.url), 'utf8');
const ip = readFileSync(new URL('../api-engines/get-client-ip.js', import.meta.url), 'utf8');
const addedHunks = patch.split(/^@@[^\n]*\n/m).slice(1).map(block => block.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)).join('\n'));
const additions = addedHunks.slice(0,2).join('\n');
const diagnosticSource = additions.slice(additions.indexOf('// 明确只读诊断'), additions.indexOf('// 仅核验既有'));
const netHelperSource = additions.slice(additions.indexOf('// 仅核验既有'));
const netBranchSource = addedHunks[2];
const authorizationFixture = `if(V8.Param.JobParam){var jobParam=JSON.parse(V8.Param.JobParam);if(jobParam&&jobParam.Key)V8.Param.Key=jobParam.Key;}
if(V8.Param.Key!=='authorized-test') return {Code:0,Msg:'unauthorized'};`;
const dns = authorizationFixture + '\n' + additions + '\n// newIP = private DNS body boundary\nthrow new Error("DNS write boundary reached");';
const prefix = dns.slice(0, dns.indexOf('// newIP =')) + '\nreturn {Code:1,Data:newIP};';
const invoke = new Function('V8', 'console', prefix);
const getIP = new Function('V8', ip);
const good = { StatusCode: 200, Content: JSON.stringify({ Code: 1, Data: '183.135.225.164' }) };
const run = response => invoke({ Param: { JobParam: '{"Key":"authorized-test"}' }, Http: { GetResponse: () => response } }, { log() {} });

test('public IP source and changed DNS prefix parse', () => { new Function('V8', dns); new Function('V8', ip); });
test('old empty response reproduces JSON parse failure', () => {
  const old = new Function('V8', "var clientIPResult=V8.Http.Post({Url:'https://api.nbweixin.cn/apiengine/get-client-ip'}); return JSON.parse(clientIPResult);");
  assert.throws(() => old({ Http: { Post: () => '' } }), SyntaxError);
});
test('fixed upstream, explicit tenant and bounded request', () => {
  let options;
  const result = invoke({ Param: { Key: 'authorized-test' }, Http: { GetResponse: p => { options = p; return good; } } }, { log() {} });
  assert.equal(result.Data, '183.135.225.164');
  assert.equal(options.Url, 'https://api.jifulii.com/apiengine/get-client-ip');
  assert.equal(options.Headers.osclient, 'xjy');
  assert.equal(options.Headers.apiengine, '1');
  assert.equal(options.Timeout, 15);
});
for (const [name, response, error] of [
  ['empty body', {StatusCode:200,Content:''}, 'UPSTREAM_BODY'],
  ['oversized body', {StatusCode:200,Content:'x'.repeat(4097)}, 'UPSTREAM_BODY'],
  ['invalid json', {StatusCode:200,Content:'<html>'}, 'UPSTREAM_JSON'],
  ['http failure', {StatusCode:415,Content:''}, 'UPSTREAM_HTTP_415'],
  ['missing status', {Content:good.Content}, 'UPSTREAM_HTTP_0'],
  ['missing response', null, 'UPSTREAM_HTTP_0'],
  ['null json', {StatusCode:200,Content:'null'}, 'UPSTREAM_RESULT'],
  ['business failure', {StatusCode:200,Content:'{"Code":0,"Data":"183.135.225.164"}'}, 'UPSTREAM_RESULT'],
  ['unexpected data shape', {StatusCode:200,Content:'{"Code":1,"Data":{}}'}, 'UPSTREAM_RESULT']
]) test(name + ' fails before any DNS operation', () => { const result=run(response); assert.equal(result.Code,0); assert.ok(result.Msg.includes(error)); });
test('transport error becomes a safe failure', () => {
  const result=invoke({Param:{Key:'authorized-test'},Http:{GetResponse(){throw new Error('secret upstream detail');}}},{log(){}});
  assert.equal(result.Code,0);assert.equal(result.Msg,'获取公网IP失败[UPSTREAM_TRANSPORT]');
});
test('unauthorized caller never requests upstream', () => {
  let calls=0;const result=invoke({Param:{Key:'wrong'},Http:{GetResponse(){calls++;}}},{log(){}});
  assert.equal(result.Code,0);assert.equal(calls,0);
});
for (const value of ['10.0.0.1','127.0.0.1','172.16.0.1','192.168.1.1','169.254.1.1','100.64.0.1','0.1.1.1','224.0.0.1','198.18.0.1','192.0.2.1','198.51.100.1','203.0.113.1','999.1.1.1','001.1.1.1','2001:db8::1','183.135.225.164, 1.1.1.1']) {
  test('invalid DNS A value ' + value, () => {const result=run({StatusCode:200,Content:JSON.stringify({Code:1,Data:value})});assert.equal(result.Code,0);assert.ok(result.Msg.includes('INVALID_PUBLIC_IPV4'));});
}
test('get-client-ip only exposes trusted HTTP connection despite forged input', () => {
  const result=getIP({HttpContext:{Connection:{RemoteIpAddress:{ToString:()=> '183.135.225.164'}}},Param:{IP:'1.1.1.1',HttpContext:{Connection:{RemoteIpAddress:'1.1.1.1'}}},Header:{'X-Forwarded-For':'1.1.1.1'}});
  assert.equal(result.Code,1);assert.equal(result.Data,'183.135.225.164');
});
test('get-client-ip normalizes IPv4-mapped address', () => {
  const result=getIP({HttpContext:{Connection:{RemoteIpAddress:{IsIPv4MappedToIPv6:true,MapToIPv4:()=>({ToString:()=> '183.135.225.164'})}}}});
  assert.equal(result.Data,'183.135.225.164');
});
test('get-client-ip without HTTP context fails closed', () => {assert.equal(getIP({Param:{IP:'1.1.1.1'}}).Code,0);});
for (const peer of ['172.16.0.115', '172.30.9.234']) test('trusted exact proxy selects rightmost despite spoofed prefix ' + peer, () => {
  const result=getIP({HttpContext:{Connection:{RemoteIpAddress:{ToString:()=>peer}}},Header:{'X-Forwarded-For':'1.1.1.1, 8.8.8.8, 183.135.225.164'},Param:{IP:'9.9.9.9'}});
  assert.equal(result.Code,1);assert.equal(result.Data,'183.135.225.164');
});
test('unknown private proxy cannot promote its XFF', () => {
  const result=getIP({HttpContext:{Connection:{RemoteIpAddress:{ToString:()=> '172.16.0.116'}}},Header:{'X-Forwarded-For':'183.135.225.164'}});
  assert.equal(result.Code,0);
});
test('invalid rightmost XFF never falls back to attacker prefix', () => {
  const result=getIP({HttpContext:{Connection:{RemoteIpAddress:{ToString:()=> '172.16.0.115'}}},Header:{'X-Forwarded-For':'1.1.1.1, not-an-ip'}});
  assert.equal(result.Code,0);
});
test('oversized trusted proxy chain fails closed', () => {
  const result=getIP({HttpContext:{Connection:{RemoteIpAddress:{ToString:()=> '172.16.0.115'}}},Header:{'X-Forwarded-For':'1.1.1.1,'.repeat(400)}});
  assert.equal(result.Code,0);
});
test('read-only production IP check exits before DNS, cache and SQL', () => {
  const full=new Function('V8','console',dns);
  const result=full({Param:{Key:'authorized-test',CheckIpOnly:true},Http:{GetResponse:()=>good},Alidns:{get UptDomainRecord(){throw new Error('DNS touched');}},Cache:{get Set(){throw new Error('Cache touched');}},Db:{get FromSql(){throw new Error('SQL touched');}}},{log(){}});
  assert.equal(result.Code,1);assert.equal(result.Data,'183.135.225.164');
});
test('patch identifies original baseline and contains no credential literals or record creation/deletion', () => {
  assert.ok(patch.includes('基线：dns_sync_ip v1.0.0'));
  assert.ok(patch.includes('8b25ff92c33fa3b24394c4ff8b37dade1db291496d3a5ad5e9eec5cb7de12abf'));
  assert.equal(addedHunks.length,3);
  assert.equal(/(?:LTAI|AKID)[A-Za-z0-9]{12,}/.test(patch),false);
  assert.equal(/CreateDomainRecord|DeleteDomainRecord|CreateRecord|DeleteRecord/.test(patch),false);
  assert.equal(additions.includes('DnsCallerIpProbe'),false);
});

// 固定 net 目标的云回读、严格成功与缓存回归。
{
const helper=netHelperSource;
const getFunctions=new Function('V8','isPublicIPv4',helper+'\nreturn {readNetItDosRecord,syncVerifiedNetItDosRecord};');
const expected='115.215.240.3',old='183.133.36.156',id='18719715575030784';
const record=value=>({RecordId:id,DomainName:'itdos.net',RR:'net',Type:'A',Status:'ENABLE',Value:value});
const ok=value=>({StatusCode:200,Content:JSON.stringify(record(value))});
function fixture({responses=[ok(old),ok(expected)],update={Code:1},cacheFailure=false,cacheFalse=false,credentials=true}={}){
 let reads=0;const requests=[],updates=[],cache=[];
 const V8={OsClient:'iTdos',OsClientModel:credentials?{AlidnsKeyId:'fixture-id',AlidnsKeySecret:'fixture-secret'}:{},Method:{NewGuid:()=> 'nonce-fixture',HmacSha1Sign:(s,k)=>createHmac('sha1',k).update(s).digest('base64')},Http:{GetResponse:p=>{requests.push(p);let r=responses[reads++];if(r instanceof Error)throw r;return r;}},Alidns:{UptDomainRecord:p=>{updates.push(p);if(update instanceof Error)throw update;return update;}},Cache:{Get:()=>expected,Set:(...args)=>{if(cacheFailure)throw Error('cache unavailable');cache.push(args);return !cacheFalse;}}};
 return {...getFunctions(V8,s=>s===expected),requests,updates,cache};
}
test('old permanent cache reproduces drift despite matching cached IP',()=>{let cloud=old,cache=expected,updates=0;if(cache!==expected){cloud=expected;updates++;}assert.equal(cloud,old);assert.equal(updates,0);});
test('same cached IP cannot suppress correction of drifted cloud record',()=>{let f=fixture();let r=f.syncVerifiedNetItDosRecord(expected);assert.equal(r.Code,1);assert.equal(r.Changed,true);assert.equal(r.CloudVerified,true);assert.equal(f.requests.length,2);assert.equal(f.updates.length,1);assert.equal(f.updates[0].RecordId,id);assert.equal(f.updates[0].Value,expected);assert.deepEqual(f.cache,[['Microi:iTdos:ServerIP:net.itdos.net',expected,60]]);});
test('cloud already correct needs no update but still gets cloud read',()=>{let f=fixture({responses:[ok(expected)]});let r=f.syncVerifiedNetItDosRecord(expected);assert.equal(r.Code,1);assert.equal(r.Changed,false);assert.equal(f.requests.length,1);assert.equal(f.updates.length,0);assert.equal(f.cache.length,1);});
test('RPC is fixed read action and correctly signed',()=>{let f=fixture({responses:[ok(expected)]});f.readNetItDosRecord();let u=new URL(f.requests[0].Url);assert.equal(u.origin,'https://alidns.aliyuncs.com');assert.equal(u.searchParams.get('Action'),'DescribeDomainRecordInfo');assert.equal(u.searchParams.get('RecordId'),id);assert.equal(f.requests[0].Timeout,10);const sig=u.searchParams.get('Signature');u.searchParams.delete('Signature');const encode=s=>encodeURIComponent(s).replace(/[!'()*]/g,x=>'%'+x.charCodeAt(0).toString(16).toUpperCase());const query=[...u.searchParams.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>encode(k)+'='+encode(v)).join('&');assert.equal(sig,createHmac('sha1','fixture-secret&').update('GET&%2F&'+encode(query)).digest('base64'));});
for(const [name,response]of [['http',{StatusCode:403,Content:''}],['statusAbsent',{Content:'{}'}],['nullResponse',null],['empty',{StatusCode:200,Content:''}],['oversized',{StatusCode:200,Content:'x'.repeat(16385)}],['malformed',{StatusCode:200,Content:'<html>'}],['cloudError',{StatusCode:200,Content:'{"Code":"InvalidAccessKeyId.NotFound"}'}],['transport',new Error('secret-network-detail')]])test('pre-read '+name+' never writes DNS or cache',()=>{let f=fixture({responses:[response]});let r=f.syncVerifiedNetItDosRecord(expected);assert.equal(r.Code,0);assert.equal(f.updates.length,0);assert.equal(f.cache.length,0);assert.equal(JSON.stringify(r).includes('secret-network-detail'),false);});
for(const [field,value]of [['RecordId','999'],['DomainName','attacker.net'],['RR','git'],['Type','CNAME'],['Status','DISABLE']])test('record identity/state '+field+' fails closed',()=>{let x=record(old);x[field]=value;let f=fixture({responses:[{StatusCode:200,Content:JSON.stringify(x)}]});assert.equal(f.syncVerifiedNetItDosRecord(expected).Code,0);assert.equal(f.updates.length,0);assert.equal(f.cache.length,0);});
for(const code of [0,-1,2,'1','0',true,null,undefined])test('strict update Code '+String(code)+' is rejected without success cache',()=>{let f=fixture({update:{Code:code,Msg:'The DNS record already exists'}});assert.equal(f.syncVerifiedNetItDosRecord(expected).Code,0);assert.equal(f.updates.length,1);assert.equal(f.requests.length,1);assert.equal(f.cache.length,0);});
test('update exception is unknown and never retried in same call',()=>{let f=fixture({update:new Error('secret update failure')});let r=f.syncVerifiedNetItDosRecord(expected);assert.equal(r.Msg,'NET_RECORD_UPDATE_RESULT_UNKNOWN');assert.equal(f.updates.length,1);assert.equal(f.requests.length,1);assert.equal(f.cache.length,0);});
test('failed post-read never writes success cache',()=>{let f=fixture({responses:[ok(old),{StatusCode:500,Content:''}]});let r=f.syncVerifiedNetItDosRecord(expected);assert.equal(r.Msg,'NET_RECORD_POST_READ_FAILED');assert.equal(f.updates.length,1);assert.equal(f.cache.length,0);});
test('post-read mismatch never writes success cache',()=>{let f=fixture({responses:[ok(old),ok(old)]});let r=f.syncVerifiedNetItDosRecord(expected);assert.equal(r.Msg,'NET_RECORD_VERIFY_MISMATCH');assert.equal(f.cache.length,0);});
test('cache outage cannot invalidate confirmed cloud state or trigger another update',()=>{let f=fixture({responses:[ok(expected)],cacheFailure:true});let r=f.syncVerifiedNetItDosRecord(expected);assert.equal(r.Code,1);assert.equal(r.CloudVerified,true);assert.equal(r.CacheRemembered,false);assert.equal(f.updates.length,0);});
test('false cache response is reported honestly without invalidating verified cloud state',()=>{let f=fixture({responses:[ok(expected)],cacheFalse:true});let r=f.syncVerifiedNetItDosRecord(expected);assert.equal(r.Code,1);assert.equal(r.CloudVerified,true);assert.equal(r.CacheRemembered,false);assert.equal(f.updates.length,0);assert.equal(f.cache.length,1);});
test('missing credentials fails closed without network',()=>{let f=fixture({credentials:false});assert.equal(f.syncVerifiedNetItDosRecord(expected).Code,0);assert.equal(f.requests.length,0);assert.equal(f.cache.length,0);});
test('invalid expected IP is rejected before cloud calls',()=>{let f=fixture();assert.equal(f.syncVerifiedNetItDosRecord('172.16.0.1').Code,0);assert.equal(f.requests.length,0);});
}
// 显式管理员生产出口诊断的只读与有界回归。
{
const source=diagnosticSource;
const invoke=new Function('V8','newIP','isPublicIPv4',source+'\nreturn {Code:1,ReachedDns:true};');
const publicIP=s=>['183.133.36.156','115.215.240.3'].includes(s);
const upstream='115.215.240.3';
const good={StatusCode:200,Content:upstream};
function run(param={},responses=[good,good],admin=true){
 const calls=[];
 const V8={Param:param,CurrentUser:admin?{Level:9999}:null,Method:{GetSystemObservability:()=>({Code:1,Data:{RequestRuntime:{Node:{NodeId:'node-fixture:1',MachineName:'node-fixture'}}}})},Http:{GetResponse:p=>{calls.push(p);let r=responses[calls.length-1];if(r instanceof Error)throw r;return r;}},Cache:{get Set(){throw Error('cache touched');}},Alidns:{get UptDomainRecord(){throw Error('DNS touched');}}};
 return {result:invoke(V8,upstream,publicIP),calls};
}
test('normal job never requests independent services',()=>{let x=run({VerifyEgress:true});assert.equal(x.calls.length,0);assert.equal(x.result.ReachedDns,true);});
test('existing CheckIpOnly contract unchanged',()=>{let x=run({CheckIpOnly:true});assert.equal(x.calls.length,0);assert.equal(x.result.Data,upstream);assert.equal(x.result.DataAppend,undefined);});
test('anonymous diagnostic rejected before network',()=>{let x=run({CheckIpOnly:true,VerifyEgress:true},undefined,false);assert.equal(x.result.Code,1002);assert.equal(x.calls.length,0);});
for(const value of [true,'1'])test('explicit diagnostic '+value+' uses fixed bounded endpoints and no writes',()=>{let x=run({CheckIpOnly:true,VerifyEgress:value,Url:'https://attacker.invalid'});assert.equal(x.result.Code,1);assert.equal(x.result.DataAppend.Match,true);assert.equal(x.result.DataAppend.RuntimeHost,'node-fixture');assert.equal(x.result.DataAppend.NodeId,'node-fixture:1');assert.equal(x.calls.length,2);assert.deepEqual(x.calls.map(c=>c.Url),['https://4.ipw.cn','https://ipv4.icanhazip.com']);assert.ok(x.calls.every(c=>c.Timeout===10));});
test('one matching source is sufficient when another is unavailable',()=>{let x=run({CheckIpOnly:true,VerifyEgress:true},[{StatusCode:0,ErrorMessage:'connect failed secret'},good]);assert.equal(x.result.Code,1);assert.equal(x.result.DataAppend.Independent[0].ErrorType,'NETWORK');assert.equal(JSON.stringify(x.result).includes('secret'),false);});
test('any valid disagreement overrides another matching source',()=>{let x=run({CheckIpOnly:true,VerifyEgress:true},[good,{StatusCode:200,Content:'183.133.36.156'}]);assert.equal(x.result.Code,0);assert.equal(x.result.DataAppend.Match,false);});
for(const [name,response]of [['http',{StatusCode:500,Content:''}],['missingStatus',{Content:'value'}],['nullResponse',null],['empty',{StatusCode:200,Content:''}],['oversized',{StatusCode:200,Content:'x'.repeat(129)}],['badBody',{StatusCode:200,Content:'<html>'}],['private',{StatusCode:200,Content:'172.16.0.1'}],['transport',new Error('do-not-leak-secret')]])test(name+' both providers safely fail without side effects',()=>{let x=run({CheckIpOnly:true,VerifyEgress:true},[response,response]);assert.equal(x.result.Code,0);assert.equal(JSON.stringify(x.result).includes('do-not-leak-secret'),false);});
test('arbitrary truthy diagnostic parameter is rejected',()=>{let x=run({CheckIpOnly:true,VerifyEgress:'yes'});assert.equal(x.calls.length,0);assert.equal(x.result.Code,1);});
}
test('net branch reports cloud verification and marks a failed record explicitly', () => {
  const call=new Function('item','result','newIP','syncVerifiedNetItDosRecord',netBranchSource+"\nreturn 'legacy';");
  let good={Data:{}};call({Key:'net.itdos.net'},good,'115.215.240.3',()=>({Code:1,CloudVerified:true,Changed:true,CloudValue:'115.215.240.3'}));
  assert.equal(good.Data['net.itdos.net'],1);assert.equal(good.NetItDosNet.CloudVerified,true);
  let bad={Data:{}};call({Key:'net.itdos.net'},bad,'115.215.240.3',()=>({Code:0,CloudVerified:false,Msg:'NET_RECORD_UPDATE_FAILED'}));
  assert.equal(bad.Code,0);assert.equal(bad.Data['net.itdos.net'],'NET_RECORD_UPDATE_FAILED');
});
test('other targets continue through unchanged legacy branch', () => {
  const call=new Function('item','result','newIP','syncVerifiedNetItDosRecord',netBranchSource+"\nreturn 'legacy';");
  let result={Data:{}};assert.equal(call({Key:'git.itdos.net'},result,'115.215.240.3',()=>{throw Error('wrong target');}),'legacy');assert.deepEqual(result,{Data:{}});
});

