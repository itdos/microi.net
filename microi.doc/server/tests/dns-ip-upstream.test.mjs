import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

// 本文件仅验证无凭据的 DNS 上游改动；未修改的鉴权逻辑用测试夹具表示。
// 原 DNS 凭据与目标配置保留在私有镜像，不能进入公开版本控制。
const patch = readFileSync(new URL('../api-engines/dns-sync-ip-upstream.patch', import.meta.url), 'utf8');
const ip = readFileSync(new URL('../api-engines/get-client-ip.js', import.meta.url), 'utf8');
const additions = patch.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)).join('\n');
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
test('patch contains only header and upstream prefix, with no credential or DNS body', () => {
  assert.ok(patch.startsWith('--- a/dns_sync_ip.js\n+++ b/dns_sync_ip.js\n'));
  assert.ok(additions.includes('CheckIpOnly'));
  assert.equal(/V8\.(?:Alidns|Tencent|Cache|Db)\b/.test(additions), false);
  assert.equal(/(?:KeySecret|AccessKeyId|AlidnsKeyId|SecretId|SecretKey)\s*[:=]/i.test(patch), false);
  assert.equal(additions.includes('DnsCallerIpProbe'), false);
});

