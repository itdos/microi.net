import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { MicroiClient } from './microi-client.js';
import { createMcpServer } from './server.js';
import http from 'node:http';
import { MicroiClient as HttpMicroiClient } from './microi-client.js';

test('SaaS MinIO tool requires a revision, preserves private credentials and suppresses secret echoes', async () => {
  const calls: any[] = [];
  const backend: any = { manageSaasMinio: async (input: any) => {
    calls.push(input);
    return { Code: 1, Data: { Protocol: 'SaasMinioConfiguration/1', Tenant: 'itdos', Revision: 'a'.repeat(64),
      HasAccessKey: true, HasSecretKey: true, Persisted: input.action === 'Save', ProbeSucceeded: true,
      RuntimeReloaded: true, SecretKey: 'fixture-secret', AccessKey: 'fixture-access' } };
  }};
  const server = createMcpServer(backend as MicroiClient, { label: 'test', osClient: 'itdos', apiBaseUrl: 'https://test.invalid', codexMode: true });
  const client = new Client({ name: 'saas-minio-test', version: '1' });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(st), client.connect(ct)]);
  const call = (params: object) => client.callTool({ name: 'microi_codex', arguments: { action: 'microi_manage_saas_minio', params } });
  try {
    const inspect = await call({ action: 'Inspect' });
    assert.notEqual(inspect.isError, true);
    assert.doesNotMatch(JSON.stringify(inspect), /fixture-secret|fixture-access|"SecretKey"|"AccessKey"/);
    const denied = await call({ action: 'Save', configuration: { secretKey: 'fixture-secret' } });
    assert.equal(denied.isError, true); assert.equal(calls.length, 1);
    const saved = await call({ action: 'Save', expectedRevision: 'a'.repeat(64),
      confirmExecution: 'SAVE_MINIO:iTdos:' + 'a'.repeat(64), configuration: { accessKey: 'fixture-access', secretKey: 'fixture-secret' } });
    assert.notEqual(saved.isError, true); assert.equal(calls.length, 2);
    assert.equal(calls[1].configuration.secretKey, 'fixture-secret');
    assert.doesNotMatch(JSON.stringify(saved), /fixture-secret|fixture-access/);
    backend.manageSaasMinio = async () => { throw Error('fixture-secret'); };
    const failed = await call({ action: 'Probe' });
    assert.equal(failed.isError, true); assert.doesNotMatch(JSON.stringify(failed), /fixture-secret/);
    const injection = await call({ action: 'Save', configuration: { HDFS: 'MinIO' } });
    assert.equal(injection.isError, true);
  } finally { await client.close(); await server.close(); }
});

test('credential control plane carries tenant headers and never follows a redirect or replays an uncertain save', async () => {
  let requests=0; let observed:any;
  const server=http.createServer(async(req,res)=>{
    requests++; const chunks:Buffer[]=[]; for await(const chunk of req) chunks.push(Buffer.from(chunk));
    observed={url:req.url,headers:req.headers,body:JSON.parse(Buffer.concat(chunks).toString())};
    res.writeHead(307,{Location:'/must-not-receive-credentials'}); res.end();
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address(); assert.ok(address && typeof address==='object');
  const client=new HttpMicroiClient({apiBaseUrl:'http://127.0.0.1:'+address.port,username:'',password:'',
    osClient:'fixture',osClientType:'Product',osClientNetwork:'Internal',token:'fixture-session'});
  try {
    await assert.rejects(client.manageSaasMinio({action:'Save',expectedRevision:'a'.repeat(64),
      confirmExecution:'SAVE_MINIO:fixture:'+'a'.repeat(64),configuration:{secretKey:'fixture-secret'}}));
    assert.equal(requests,1); assert.equal(observed.url,'/api/V8Engine/ManageSaasMinio');
    assert.equal(observed.headers.osclient,'fixture'); assert.equal(observed.headers.osclienttype,'Product');
    assert.equal(observed.headers.osclientnetwork,'Internal'); assert.equal(observed.body.Configuration.secretKey,'fixture-secret');
    assert.equal(observed.body.OsClient,undefined);
  } finally { client.destroy(); server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
