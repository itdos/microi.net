import {configureContext} from './contracts.mjs';
configureContext({schema:1,task:'offline-admission-fixture',owner32:'a'.repeat(32),tenant:'adm_'+'a'.repeat(32),mainTenant:'OfflineMain',parentDatabase:'offline_main',redis:{host:'127.0.0.1',port:63962,database:1},base:'http://127.0.0.1:64171/'});
import test from 'node:test';
import assert from 'node:assert/strict';
import {TASK,OWNER,TENANT,MARKER,ACCOUNTS,PROTOCOL_PATHS,sha,id,tenantReturn,ownedUser,currentUser,
  mcpJson,mcpStatus,accessGrant,verifyConfirmation,accessRecord,fixture} from './contracts.mjs';
import {stageGate,main} from './prepare.mjs';
const uid='01K7NF6Q6F1YJVZ6FMSR2QK3TN';
const user=()=>({Id:uid,Account:ACCOUNTS.ordinary,Name:'Admission '+OWNER,Remark:MARKER,State:1,Level:0,IsDeleted:0});
const response=()=>({Code:1,Data:{OsClient:TENANT,DbName:'microi_'+TENANT,FreeTenantCreated:true,Upgrade:{Upgraded:true}}});
const wrapped=(value,isError=false)=>({content:[{type:'text',text:JSON.stringify(value)}],isError});
const grant=()=>accessGrant('2026-10-23T12:00:00.000Z');
const record=()=>({Id:uid,Name:'Admission '+OWNER,Remark:MARKER,TargetUserId:uid,State:1,
  Scopes:'["api-engine:run"]',AllowedApiEngineKeys:JSON.stringify(grant().allowedApiEngineKeys)});
const config=()=>({task:TASK,owner32:OWNER,owner:OWNER,tenant:TENANT,tenantId:uid,ownerUserId:uid,
  returnedDbName:'microi_'+TENANT,database:'microi_'+TENANT,registeredDatabase:'microi_'+TENANT,
  parentDatabase:'offline_main',nativeScopeSha256:'a'.repeat(64),registeredDbConnSha256:'b'.repeat(64),
  mainTenantId:uid,mainInfrastructureSha256:'d'.repeat(64),tenantInfrastructureSha256:'e'.repeat(64),effectiveInfrastructureSha256:'f'.repeat(64),bootstrapSha256:'1'.repeat(64),registrationVerifierSha256:'2'.repeat(64),
  protocolSourceHashes:Object.fromEntries(PROTOCOL_PATHS.map(p=>[p,'c'.repeat(64)])),redis:{host:'127.0.0.1',port:63962,database:1}});

test('plan performs no login, filesystem creation or provisioning',async()=>{const result=await main(['plan']);assert.equal(result.executed,false);});
test('formal ULID and historical GUID allowed; hex-only assumption rejected',()=>{assert.equal(id(uid),uid);id('f'.repeat(32));id('12345678-1234-1234-1234-123456789abc');assert.throws(()=>id('admin'));assert.throws(()=>id('81K7NF6Q6F1YJVZ6FMSR2QK3TN'));});
test('official tenant return preserves the exact requested spelling',()=>assert.equal(tenantReturn(response()).OsClient,TENANT));
test('never lowercases a different official tenant response into the target',()=>{const r=response();r.Data.OsClient=TENANT.toUpperCase();assert.throws(()=>tenantReturn(r));});
test('failed upgrade/return is not a ready fixture',()=>{for(const r of [{Code:0}, {Code:1,Data:{}}, {...response(),Data:{...response().Data,Upgrade:null}}])assert.throws(()=>tenantReturn(r));});
test('new main owner remains ordinary and fully marked',()=>{ownedUser({...user(),Account:ACCOUNTS.owner},'owner');for(const change of [{Level:9999},{Remark:'foreign'},{Account:'admin'},{State:0}])assert.throws(()=>ownedUser({...user(),...change},'ordinary'));});
test('identity comes from actual response and cannot be borrowed/mistyped',()=>{currentUser(user(),user());assert.throws(()=>currentUser({...user(),Id:'f'.repeat(32)},user()));assert.throws(()=>currentUser({...user(),_AccessKeySession:true},user()));});
test('admin AccessKey remains an AccessKey and is not accepted as ordinary administrator',()=>{const a={...user(),Account:'admin',Level:9999};currentUser({...a,_AccessKeySession:true},a,{access:true});assert.throws(()=>currentUser({...a,_AccessKeySession:true},a,{admin:true}));});
test('MCP current tenant tuple is actual response, not configured assumption',()=>{const s={content:[{type:'text',text:'✅ Server is online.\n\n'+JSON.stringify({OsClient:TENANT,OsClientType:'Product',OsClientNetwork:'Internal'})}]};mcpStatus(s,TENANT);assert.throws(()=>mcpStatus(s,'foreign'));assert.throws(()=>mcpStatus({...s,isError:true},TENANT));});
test('two-step AccessKey confirmation binds exact canonical grant',()=>{const g=grant();assert.equal(verifyConfirmation(wrapped({Blocked:true,NormalizedGrant:g,RequiredConfirmationSha256:sha(JSON.stringify(g))},true),g),sha(JSON.stringify(g)));});
test('tampered MCP grant, hash, transport error cannot become confirmation',()=>{const g=grant();for(const r of [wrapped({Blocked:true,NormalizedGrant:{...g,allowedRoutes:['*']},RequiredConfirmationSha256:sha(JSON.stringify(g))},true),wrapped({Blocked:true,NormalizedGrant:g,RequiredConfirmationSha256:'f'.repeat(64)},true),wrapped({Blocked:true,NormalizedGrant:g,RequiredConfirmationSha256:sha(JSON.stringify(g))})])assert.throws(()=>verifyConfirmation(r,g));});
test('MCP parser rejects narrative and compound content',()=>{assert.throws(()=>mcpJson({content:[{type:'text',text:'Error: denied'}]}));assert.throws(()=>mcpJson({content:[{type:'text',text:'{}'},{type:'text',text:'{}'}]}));});
test('public AccessKey row supports official no-OsClient historical table layout',()=>accessRecord(record(),uid));
test('AccessKey owner/scope/secret leakage are rejected',()=>{for(const change of [{TargetUserId:'f'.repeat(32)},{OsClient:'foreign'},{Scopes:'["form:write"]'},{SecretHash:'secret'}])assert.throws(()=>accessRecord({...record(),...change},uid));});
test('exact DB and lower physical variant need independent matching registration',()=>{fixture(config());const c=config();c.database=c.database.toLowerCase();c.registeredDatabase=c.database;fixture(c);});
test('foreign/mismatched DB, owner and missing source hashes rejected',()=>{for(const change of [{database:'mysql'}, {database:config().database.toUpperCase()}, {owner:'f'.repeat(32)}, {protocolSourceHashes:{}}, {registeredDbConnSha256:''}])assert.throws(()=>fixture({...config(),...change}));});
test('mutation intent without result is unknown, never an automatic retry',()=>{assert.equal(stageGate(false,false),'New');assert.equal(stageGate(true,true),'ReadbackOnly');assert.throws(()=>stageGate(true,false));});
test('execution without exact owner binding fails before I/O',async()=>{await assert.rejects(main(['owner','other']));await assert.rejects(main(['arbitrary',OWNER]));});
