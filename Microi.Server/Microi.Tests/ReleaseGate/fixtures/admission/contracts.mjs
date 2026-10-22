import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// 每次 Full 使用 verify-ready 的真实 task/build/attempt 派生唯一租户，不绑定某次任务。
export let CONTEXT, TASK, OWNER, TENANT, MAIN, MARKER, DID, ACCOUNTS;
export function configureContext(value) {
  assert.equal(value?.schema,1);assert.match(value.task,/^[A-Za-z0-9][A-Za-z0-9_-]{7,66}$/);
  assert.match(value.owner32,/^[a-f0-9]{32}$/);assert.equal(value.tenant,'StdAdmission_'+value.owner32);
  assert.match(value.mainTenant,/^[A-Za-z0-9_-]{1,50}$/);assert.notEqual(value.mainTenant.toLowerCase(),value.tenant.toLowerCase());
  assert.match(value.parentDatabase,/^[A-Za-z0-9_]{1,64}$/);
  assert.equal(value.redis.host,'127.0.0.1');assert.ok(Number.isInteger(value.redis.port)&&value.redis.port>=1024&&value.redis.port<=65535);
  assert.ok(Number.isInteger(value.redis.database)&&value.redis.database>=0&&value.redis.database<=15);
  const base=new URL(value.base);assert.equal(base.protocol,'http:');assert.equal(base.hostname,'127.0.0.1');
  assert.ok(Number(base.port)>=1024&&Number(base.port)<=65535);assert.equal(base.pathname,'/');assert.equal(base.username+base.password+base.search+base.hash,'');
  CONTEXT=structuredClone(value);TASK=value.task;OWNER=value.owner32;TENANT=value.tenant;MAIN=value.mainTenant;
  MARKER=TASK+':'+OWNER;DID='MCP:admission-'+OWNER;
  ACCOUNTS={owner:'admissiono'+OWNER.slice(0,15),ordinary:'admissionu'+OWNER.slice(0,15)};
  return CONTEXT;
}
export const PROTOCOL_PATHS = [
  'Microi.Server/Microi.Cache/MicroiTwoLevelCache.cs',
  'Microi.Server/Microi.Cache/MicroiTwoLevelCacheConfig.cs',
  'Microi.Server/Microi.Core/ApiEngine/ApiEngineRouteAliases.cs',
  'Microi.Server/Microi.net/Common/OsClient.cs',
  'Microi.Server/Microi.Core/SaaSEngine/TenantConfigurationSecurity.cs'
];
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function id(value) {
  assert.equal(typeof value,'string','Missing real identity');
  assert.match(value,/^(?:[0-7][0-9A-HJKMNP-TV-Z]{25}|[a-fA-F0-9]{32}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})$/);
  return value;
}
export function success(result) {
  assert.equal(result?.Code,1,'Official API did not succeed; inspect private outcome, do not repeat writes');
  return result.Data;
}
export function tenantReturn(result) {
  const data = success(result);
  // 正式实现只 Trim；不把 lowercase 期望伪装成服务端真实返回。
  assert.equal(data?.OsClient,TENANT);
  assert.equal(data.DbName,'microi_' + data.OsClient.replaceAll('-','_'));
  assert.equal(data.FreeTenantCreated,true);
  assert.ok(data.Upgrade && typeof data.Upgrade === 'object','Missing formal upgrade result');
  return data;
}
export function ownedUser(row, kind) {
  id(row?.Id); assert.equal(row.Account,ACCOUNTS[kind]);
  assert.equal(row.Name,'Admission ' + OWNER);
  assert.equal(row.Remark,MARKER);
  assert.equal(Number(row.State),1);
  assert.ok(row.IsDeleted === null || row.IsDeleted === undefined || Number(row.IsDeleted) === 0);
  assert.equal(Number(row.Level || 0),0,'Fixture ordinary owner/user must remain unprivileged');
  return row;
}
export function currentUser(row, expected, {admin=false,access=false}={}) {
  assert.equal(id(row?.Id),id(expected.Id));
  assert.equal(row.Account,expected.Account);
  assert.equal(row._AccessKeySession === true,access);
  if (admin) assert.ok(Number(row.Level) >= 9999,'Real child administrator required');
  else if (!access) assert.ok(Number(row.Level || 0) < 9999,'Ordinary identity unexpectedly privileged');
  return row;
}
export function mcpJson(result,{confirmation=false}={}) {
  assert.equal(Array.isArray(result?.content),true);
  assert.equal(result.content.length,1,'Unexpected MCP response envelope');
  assert.equal(result.content[0].type,'text');
  const value=JSON.parse(result.content[0].text);
  assert.equal(Boolean(result.isError),confirmation,'Unexpected MCP error; no success substitution');
  return value;
}
export function mcpStatus(result, tenant) {
  assert.ok(!result?.isError,'MCP identity lacks actual permission');
  assert.equal(result.content.length,1);
  const text=result.content[0].text;
  const offset=text.indexOf('\n\n');
  assert.ok(offset>0,'Unexpected status format');
  const data=JSON.parse(text.slice(offset+2));
  assert.equal(data.OsClient,tenant); assert.equal(data.OsClientType,'Product'); assert.equal(data.OsClientNetwork,'Internal');
  return data;
}
export function accessGrant(expiresAt) {
  return {name:'Admission ' + OWNER,allowedRoutes:['/'],allowedTableNames:['sys_user'],scopes:['api-engine:run'],
    redirectPath:'/',allowedApiEngineKeys:['platform-chat-maintenance','platform-chat-runtime','platform-current-user'],
    allowedDataSourceKeys:[],expiresAt,remark:MARKER};
}
export function verifyConfirmation(result,grant) {
  const answer=mcpJson(result,{confirmation:true});
  assert.equal(answer.Blocked,true);
  assert.deepEqual(answer.NormalizedGrant,grant);
  assert.equal(answer.RequiredConfirmationSha256,sha(JSON.stringify(grant)));
  return answer.RequiredConfirmationSha256;
}
export function accessRecord(row,adminId) {
  id(row?.Id); assert.equal(row.Name,'Admission ' + OWNER); assert.equal(row.Remark,MARKER);
  assert.equal(row.TargetUserId,adminId); if(row.OsClient!==undefined)assert.equal(row.OsClient,TENANT); assert.equal(Number(row.State),1);
  for (const key of ['SecretHash','AccessKey']) assert.ok(!(key in row),'Public access key metadata leaked secret');
  const list = value => Array.isArray(value) ? value : JSON.parse(value);
  assert.deepEqual(list(row.Scopes),['api-engine:run']);
  assert.deepEqual([...list(row.AllowedApiEngineKeys)].sort(),[...accessGrant('').allowedApiEngineKeys].sort());
  return row;
}
export function fixture(value) {
  assert.equal(value.task,TASK); assert.equal(value.owner32,OWNER); assert.equal(value.owner,OWNER);
  assert.equal(value.tenant,TENANT); id(value.tenantId); id(value.ownerUserId);
  assert.equal(value.returnedDbName,'microi_'+TENANT);
  assert.ok([value.returnedDbName,value.returnedDbName.toLowerCase()].includes(value.database));
  assert.equal(value.registeredDatabase,value.database,'Registered and physical database casing differs; explicit parent review required');
  assert.equal(value.parentDatabase,CONTEXT.parentDatabase);
  assert.match(value.nativeScopeSha256,/^[a-f0-9]{64}$/); assert.match(value.registeredDbConnSha256,/^[a-f0-9]{64}$/);
  id(value.mainTenantId);
  for(const key of ['mainInfrastructureSha256','tenantInfrastructureSha256','effectiveInfrastructureSha256','bootstrapSha256','registrationVerifierSha256'])assert.match(value[key],/^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(value.protocolSourceHashes).sort(),[...PROTOCOL_PATHS].sort());
  for (const hash of Object.values(value.protocolSourceHashes)) assert.match(hash,/^[a-f0-9]{64}$/);
  assert.deepEqual(value.redis,{host:CONTEXT.redis.host,port:CONTEXT.redis.port,database:CONTEXT.redis.database});
  return value;
}
