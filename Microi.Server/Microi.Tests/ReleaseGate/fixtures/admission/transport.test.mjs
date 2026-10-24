import {configureContext} from './contracts.mjs';
configureContext({schema:1,task:'offline-admission-fixture',owner32:'a'.repeat(32),tenant:'adm_'+'a'.repeat(32),mainTenant:'OfflineMain',parentDatabase:'offline_main',redis:{host:'127.0.0.1',port:63962,database:1},base:'http://127.0.0.1:64171/'});
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {HttpSession,failureSummary,TENANT_CREATION_TIMEOUT_MS} from './transport.mjs';
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

async function loopback(handler,run) {
  const server=createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  configureContext({schema:1,task:'offline-admission-fixture',owner32:'a'.repeat(32),tenant:'adm_'+'a'.repeat(32),mainTenant:'OfflineMain',parentDatabase:'offline_main',redis:{host:'127.0.0.1',port:63962,database:1},base:`http://127.0.0.1:${server.address().port}/`});
  try{return await run();}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
const createTenant=(options)=>new HttpSession(MAIN).post('apiengine/platform-create-tenant',{TenantKey:TENANT},options);
const safeError=code=>error=>error.code===code&&!/secret|password|Bearer/.test(error.message);

test('tenant creation waits for delayed headers without fetch and preserves JSON/header semantics',async()=>{
  const original=globalThis.fetch;let calls=0;
  try {
    globalThis.fetch=async()=>{throw new Error('native fetch must not handle synchronous provisioning');};
    await loopback((request,response)=>{
      calls++;let body='';request.on('data',chunk=>{body+=chunk;});request.on('end',()=>{
        assert.equal(request.method,'POST');assert.equal(request.url,'/apiengine/platform-create-tenant');
        assert.equal(request.headers.osclient,MAIN);assert.equal(JSON.parse(body).OsClient,MAIN);
        assert.equal(request.headers.authorization,'Bearer request-token');
        setTimeout(()=>{response.setHeader('authorization','Bearer refreshed-token');response.end('{"Code":1,"Data":{"created":true}}');},40);
      });
    },async()=>{
      const session=new HttpSession(MAIN,'Bearer request-token');
      const value=await session.post('apiengine/platform-create-tenant',{TenantKey:TENANT},{timeout:2000});
      assert.equal(value.Data.created,true);assert.equal(session.token,'Bearer refreshed-token');
    });
    assert.equal(calls,1);assert.equal(TENANT_CREATION_TIMEOUT_MS,1800000);
  }finally{globalThis.fetch=original;}
});

test('tenant deadline aborts waiting for headers once and closes the socket',async()=>{
  let calls=0,closed;
  const socketClosed=new Promise(resolve=>{closed=resolve;});
  await loopback((request)=>{calls++;request.socket.on('close',closed);},async()=>{
    await assert.rejects(createTenant({timeout:80}),safeError('ADMISSION_TENANT_TIMEOUT'));
    await socketClosed;assert.equal(calls,1);
  });
});

test('tenant deadline bounds the entire response even while body bytes keep arriving',async()=>{
  let calls=0;
  await loopback((request,response)=>{
    calls++;response.writeHead(200,{'content-type':'application/json'});response.write('{"Code":1,"Data":"');
    const interval=setInterval(()=>response.write('x'),10);response.on('close',()=>clearInterval(interval));
  },async()=>{await assert.rejects(createTenant({timeout:100}),safeError('ADMISSION_TENANT_TIMEOUT'));assert.equal(calls,1);});
});

test('tenant HTTP failures and redirects are rejected without replay or following Location',async()=>{
  for(const status of [302,500]){
    let calls=0;
    await loopback((request,response)=>{calls++;response.writeHead(status,{location:'/secret'});response.end('password=secret');},async()=>{
      await assert.rejects(createTenant({timeout:1000}),safeError('ADMISSION_TENANT_HTTP'));assert.equal(calls,1);
    });
  }
});

test('tenant invalid JSON, broken connections and oversized responses fail with fixed safe errors',async()=>{
  const cases=[
    [(request,response)=>response.end('password=secret'),'ADMISSION_TENANT_JSON'],
    [(request,response)=>response.destroy(),'ADMISSION_TENANT_NETWORK'],
    [(request,response)=>{response.writeHead(200,{'content-length':100});response.write('{"Code":');setImmediate(()=>response.destroy());},'ADMISSION_TENANT_NETWORK'],
    [(request,response)=>{response.writeHead(200,{'content-length':2000000});response.end();},'ADMISSION_TENANT_RESPONSE_LIMIT'],
    [(request,response)=>{response.writeHead(200);response.write(Buffer.alloc(1024*1024,120));response.end('secret');},'ADMISSION_TENANT_RESPONSE_LIMIT']
  ];
  for(const [handler,code] of cases){let calls=0;await loopback((...args)=>{calls++;handler(...args);},async()=>{
    await assert.rejects(createTenant({timeout:2000}),safeError(code));assert.equal(calls,1);
  });}
});

test('tenant deadline cannot be disabled or extended beyond the bounded provisioning allowance',async()=>{
  for(const timeout of [0,-1,Infinity,NaN,1.5,TENANT_CREATION_TIMEOUT_MS+1])
    await assert.rejects(createTenant({timeout}),/Invalid tenant creation deadline/);
});

test('ordinary requests still use fetch with redirect rejection and their original timeout',async()=>{
  const originalFetch=globalThis.fetch,originalTimeout=AbortSignal.timeout,timeouts=[];let calls=0;
  try {
    AbortSignal.timeout=timeout=>{timeouts.push(timeout);return originalTimeout(timeout);};
    globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);return new Response('{"Code":1}');};
    await new HttpSession(MAIN).post('apiengine/platform-current-user',{});
    await new HttpSession(MAIN).post('apiengine/platform-background-task',{}, {timeout:1234});
    assert.deepEqual(timeouts,[90000,1234]);assert.equal(calls,2);
  }finally{globalThis.fetch=originalFetch;AbortSignal.timeout=originalTimeout;}
});
