import {configureContext} from './contracts.mjs';
configureContext({schema:1,task:'offline-admission-fixture',owner32:'a'.repeat(32),tenant:'adm_'+'a'.repeat(32),mainTenant:'OfflineMain',parentDatabase:'offline_main',redis:{host:'127.0.0.1',port:63962,database:1},base:'http://127.0.0.1:64171/'});
import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpSession,failureSummary} from './transport.mjs';
import {MAIN,TENANT} from './contracts.mjs';

test('failure receipts preserve fixed rejection keys without recording credentials or arbitrary server messages',()=>{
  const request={Action:'AddSysUser',Pwd:'private-password'},result={Code:0,Msg:'PwdLength',Token:'private-token'};
  const known=failureSummary('apiengine/platform-sys-user-admin',MAIN,request,result);assert.equal(known.messageKey,'PwdLength');assert.equal(known.code,0);
  const unknown=failureSummary('apiengine/platform-sys-user-admin',MAIN,request,{Code:0,Msg:'Pwd=private-db-password'});assert.equal(unknown.messageKey,null);
  assert.doesNotMatch(JSON.stringify([known,unknown]),/private-password|private-token|private-db-password/);
});

// 这里只验证运输控制流，不把 mock 响应当实际 DiyToken、租户创建或 Full 通过证据。
test('fresh login clears stale authorization; actual header and current-user response are used',async()=>{
  const original=globalThis.fetch,calls=[];
  try {
    globalThis.fetch=async(url,options)=>{
      assert.equal(options.redirect,'error');
      calls.push({url:url.toString(),headers:options.headers,body:JSON.parse(options.body)});
      return calls.length===1?new Response(JSON.stringify({Code:1,Data:{Id:'actual-login'}}),{headers:{authorization:'Bearer '+'n'.repeat(30)}}):
        new Response(JSON.stringify({Code:1,Data:{Id:'actual-user',Account:'owner'}}));
    };
    const session=new HttpSession(MAIN,'Bearer stale');const value=await session.login('owner','offline-secret');
    assert.equal(calls[0].headers.authorization,undefined);assert.equal(calls[0].body.Pwd,'offline-secret');
    assert.equal(calls[0].body._AutomationTestLogin,true);assert.equal(value.Id,'actual-user');
    assert.equal(calls[1].headers.authorization,'Bearer '+'n'.repeat(30));
    assert.equal(calls[1].body.OsClient,MAIN);
  } finally {globalThis.fetch=original;}
});
test('login without a new token cannot reuse old token',async()=>{
  const original=globalThis.fetch;let calls=0;
  try{globalThis.fetch=async()=>{calls++;return new Response('{"Code":1,"Data":{}}');};
    await assert.rejects(new HttpSession(TENANT,'Bearer old-valid-token').login('admin','offline'));assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});
test('unknown network outcome is not retried',async()=>{
  const original=globalThis.fetch;let calls=0;
  try{globalThis.fetch=async()=>{calls++;throw new Error('network lost');};
    await assert.rejects(new HttpSession(TENANT).user({Action:'AddSysUser'}));assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});
test('foreign host/tenant and arbitrary routes are unavailable',async()=>{
  assert.throws(()=>new HttpSession('production'));
  await assert.rejects(new HttpSession(TENANT).post('https://evil.invalid/',{}));
});
