import assert from 'node:assert/strict';
import test from 'node:test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createMcpServer} from './server.js';
import {MicroiClient} from './microi-client.js';
import type {CallToolResult} from '@modelcontextprotocol/sdk/types.js';

const text=(r:CallToolResult)=>r.content.filter(x=>x.type==='text').map(x=>x.type==='text'?x.text:'').join('\n');
test('email tools keep credentials out of previews and audit, and bind one stable send intention',async()=>{
 const executions:{key:string;params:Record<string,unknown>}[]=[],audits:string[]=[];
 const fake={executeEngine:async(key:string,params:Record<string,unknown>)=>{executions.push({key,params});return {Code:1,Data:{Result:{Code:1,Data:{Id:params.Id||'account-1',State:params.Action==='Send'?'Sent':undefined}}}};},
 writeAuditLog:async(action:string,target:string,content:string)=>{audits.push([action,target,content].join('|'));return {Code:1};}} as unknown as MicroiClient;
 const server=createMcpServer(fake,{osClient:'tenant-test',label:'Email test',apiBaseUrl:'https://tenant.example'});
 const [a,b]=InMemoryTransport.createLinkedPair();const client=new Client({name:'email-tests',version:'1.0.0'});
 await Promise.all([server.connect(a),client.connect(b)]);
 try{
  const tools=await client.listTools();assert.ok(['microi_email_query','microi_email_manage','microi_email_send'].every(n=>tools.tools.some(t=>t.name===n)));
  const account={SystemEmail:'owned@example.com',SystemEmailPwd:'private-authorization-code',Provider:'Custom'};
  const preview=await client.callTool({name:'microi_email_manage',arguments:{action:'SaveAccount',account}});
  assert.equal(executions.length,0);assert.ok(!text(preview as CallToolResult).includes(account.SystemEmailPwd));
  await client.callTool({name:'microi_email_manage',arguments:{action:'SaveAccount',account,confirmExecution:'SaveAccount:new'}});
  assert.equal(executions.length,1);assert.equal(executions[0]?.key,'mci-email');assert.equal((executions[0]?.params.Account as typeof account).SystemEmailPwd,account.SystemEmailPwd);
  assert.ok(audits.every(a=>!a.includes(account.SystemEmailPwd)&&!a.includes(account.SystemEmail)));
  await client.callTool({name:'microi_email_send',arguments:{draftId:'draft-1',confirmExecution:'draft-other'}});
  assert.equal(executions.length,1);
  const sent=await client.callTool({name:'microi_email_send',arguments:{draftId:'draft-1',confirmExecution:'draft-1'}});
  assert.deepEqual(executions[1],{key:'mci-email',params:{Id:'draft-1',Action:'Send'}});
  assert.equal(JSON.parse(text(sent as CallToolResult)).Data.State,'Sent');
  await client.callTool({name:'microi_email_send',arguments:{draftId:'draft-1',confirmExecution:'draft-1'}});
  assert.equal(executions[2]?.params.Id,'draft-1');
  const missing=await client.callTool({name:'microi_email_manage',arguments:{action:'Sync',accountId:'account-1',confirmExecution:'Sync:account-1'}});
  assert.equal(missing.isError,true);assert.equal(executions.length,3);
  await client.callTool({name:'microi_email_query',arguments:{action:'Messages',accountId:'account-1',keyword:'invoice',pageSize:20}});
  assert.equal(executions[3]?.params.Action,'Messages');assert.equal(executions[3]?.params.AccountId,'account-1');
 }finally{await client.close();await server.close();}
});
test('email transport failure never echoes upstream secret-bearing exception text',async()=>{
 const fake={executeEngine:async()=>{throw new Error('secret-password-exception');}} as unknown as MicroiClient;
 const server=createMcpServer(fake,{osClient:'tenant-test',label:'Email test',apiBaseUrl:'https://tenant.example'});
 const [a,b]=InMemoryTransport.createLinkedPair();const client=new Client({name:'email-errors',version:'1.0.0'});
 await Promise.all([server.connect(a),client.connect(b)]);
 try{const response=await client.callTool({name:'microi_email_query',arguments:{action:'Overview'}});assert.equal(response.isError,true);assert.ok(!text(response as CallToolResult).includes('secret-password-exception'));}
 finally{await client.close();await server.close();}
});

test('DataFilterV8 alias reads and writes the actual ServerDataV8 runtime event',async()=>{
 const fetchBefore=globalThis.fetch, calls:Record<string,unknown>[]=[];
 globalThis.fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body||'{}'));calls.push(body);return new Response(JSON.stringify({Code:1,Data:{V8Code:'return {Code:1};',Version:'v1.0.0'}}),{headers:{'Content-Type':'application/json'}});};
 try{
  const client=new MicroiClient({apiBaseUrl:'https://microi.test',username:'',password:'',osClient:'demo',token:'test-token',requestTimeoutMs:1000,writeRequestTimeoutMs:1000});
  await client.getEventCode('mci_email_message','DataFilterV8');
  await client.saveEventCode('mci_email_message','DataFilterV8',"throw new Error('access denied');");
  assert.equal(calls.length,3);assert.ok(calls.every(c=>c.EventType==='ServerDataV8'));assert.match(String(calls[2]?.V8Code),/access denied/);
 }finally{globalThis.fetch=fetchBefore;}
});
