import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../engines/mci-cdn-aliyun.js',import.meta.url),'utf8');
function run(p={},model={},response={StatusCode:200,Content:'<BucketLoggingStatus/>'}){
  const requests=[];
  const V8={Param:{Action:'StorageHealth',...p},SysConfig:{ServerPrivateSettings:{}},OsClientModel:{AlidnsKeyId:'diagnostic-id',AlidnsKeySecret:'diagnostic-secret',AliOssPublicBucketName:'test-bucket',AliOssPublicEndpoint:'oss-cn-beijing.aliyuncs.com',AliOssPublicAccessKeyId:'test-id',AliOssPublicAccessKeySecret:'private-secret',...model},Method:{HmacSha1Sign:()=> 'signature'},Http:{GetResponse:q=>{requests.push(q);return typeof response==='function'?response(q):response;}}};
  return {result:vm.runInNewContext('(function(){'+code+'})()', {V8,Date,JSON,Math,Error}),requests};
}
test('OSS diagnosis uses only tenant fixed endpoint and never exposes secrets',()=>{
  const x=run({Endpoint:'https://evil.example',Bucket:'evil',AccessKeySecret:'override'});
  assert.equal(x.result.Code,1);assert.equal(x.requests.length,2);
  for(const r of x.requests){assert.equal(new URL(r.Url).hostname,'test-bucket.oss-cn-beijing.aliyuncs.com');assert(r.RequireSsrfProtection);assert.match(r.Headers.Authorization,/^OSS test-id:/);}
  assert(!JSON.stringify(x.result).includes('private-secret'));assert(!JSON.stringify(x.result).includes('signature'));assert.equal(x.result.Data.Buckets[0].Logging.Enabled,false);
});
test('OSS logging errors remain unknown rather than being treated as disabled',()=>{
  const x=run({}, {}, {StatusCode:403,Content:'<Error><Code>AccessDenied</Code><RequestId>req</RequestId></Error>'});
  assert.equal(x.result.Data.Buckets[0].Logging.Success,false);assert.equal(x.result.Data.Buckets[0].Logging.Enabled,undefined);assert.equal(x.result.Data.Buckets[0].Logging.CloudCode,'AccessDenied');
});
test('invalid tenant bucket or endpoint never triggers HTTP',()=>{
  for(const model of [{AliOssPublicBucketName:'bad/name'},{AliOssPublicEndpoint:'oss-cn-beijing.aliyuncs.com.evil.example'},{AliOssPublicEndpoint:'127.0.0.1'}])assert.equal(run({},model).requests.length,0);
});
test('internal probe is opt-in, fixed to same region and retains network protection',()=>{
  const x=run({ProbeInternal:true});assert.equal(x.requests.length,3);assert.equal(new URL(x.requests[2].Url).hostname,'test-bucket.oss-cn-beijing-internal.aliyuncs.com');assert.equal(x.requests[2].RequireSsrfProtection,true);assert.equal(x.requests[2].Timeout,3);
});
function logResponse(q){return {StatusCode:200,Content:q.Url.endsWith('?logging')?'<BucketLoggingStatus><LoggingEnabled><TargetBucket>test-bucket</TargetBucket><TargetPrefix>logs/</TargetPrefix></LoggingEnabled></BucketLoggingStatus>':q.Url.includes('prefix=')?'<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>logs/test-bucket2026-10-23-01-00-00-id</Key><Size>100</Size></Contents></ListBucketResult>':'<BucketStat/>'};}
test('OSS logs only expose metadata and exact listed objects get temporary credentials',()=>{
  const p={Action:'StorageLogs',Day:'2026-10-23'};let x=run(p,{},logResponse);
  assert.equal(x.result.Code,1);assert.equal(x.result.Data.Files.length,1);assert(!JSON.stringify(x.result).includes('diagnostic-id'));
  x=run({...p,Action:'StorageLogDownload',LogName:'logs/test-bucket2026-10-23-01-00-00-id'}, {},logResponse);assert.equal(x.result.Code,1);assert(x.result.Data.EphemeralCredential);
  assert.equal(run({...p,Action:'StorageLogDownload',LogName:'private/secret.json'},{},logResponse).result.Code,0);
  assert.equal(run({...p,Marker:'private/secret.json'},{},logResponse).result.Code,0);
});
