import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkRuntime} from '../../tools/release-smoke.mjs';

test('a listening host is insufficient when bootstrap fails with HTTP 200',async()=>{
  const request=async url=>({status:200,json:async()=>url.pathname.endsWith('liveness')
    ?{Code:1,Data:{Status:'Healthy'}}:{Code:0,Msg:'language maintenance timeout'}});
  await assert.rejects(checkRuntime('http://localhost:18080','fixture',request),/platform-sys-config.*Code 0/);
});
test('invalid JSON, missing configuration and HTTP failures stop publication',async()=>{
  for(const response of [
    {status:502,json:async()=>({Code:1,Data:{Status:'Healthy'}})},
    {status:200,json:async()=>({Code:1,Data:null})},
    {status:200,json:async()=>{throw new SyntaxError('bad json')}}
  ]) await assert.rejects(checkRuntime('http://localhost:18080','fixture',async()=>response));
});
test('both host and actual tenant bootstrap must succeed',async()=>{
  const seen=[];
  const result=await checkRuntime('http://localhost:18080','fixture',async url=>{
    seen.push(url.searchParams.get('OsClient'));
    return {status:200,json:async()=>({Code:1,Data:url.pathname.endsWith('liveness')?{Status:'Healthy'}:{SysTitle:'Fixture'}})};
  });
  assert.deepEqual(seen,['fixture','fixture']);
  assert.equal(result.length,2);
});
