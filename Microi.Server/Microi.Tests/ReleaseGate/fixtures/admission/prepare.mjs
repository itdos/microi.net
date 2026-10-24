import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {CONTEXT,TASK,OWNER,TENANT,MAIN,MARKER,DID,ACCOUNTS,id,sha,success,tenantReturn,ownedUser,currentUser,
  mcpJson,accessGrant,verifyConfirmation,accessRecord,fixture} from './contracts.mjs';
import {HttpSession,connectMcp,verifySources,TENANT_CREATION_TIMEOUT_MS} from './transport.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const REQUIRED_APPLICATION='Microi.Server/OfficialApplications/Resource/app.microi.message-notification.json';
export function requiredApplication(bytes,expectedHash) {
  assert.equal(sha(bytes),expectedHash,'Required application differs from the preflight source closure');
  const value=JSON.parse(bytes.toString('utf8'));
  assert.ok(value.PackageInfo&&value.ResourcePolicies?.ApiEngines);
  for(const key of ['platform-chat-runtime','platform-chat-maintenance'])
    assert.equal(value.SysApiEngines.filter(x=>x.ApiEngineKey===key).length,1,'Required Managed engine missing/duplicate');
  return value;
}
export function resourceInstallRequest(application,owner) {
  assert.match(owner,/^[a-f0-9]{32}$/);
  // 含定时任务的完整包必须交给持久队列；稳定请求键和单次尝试禁止未知结果时重放安装。
  return {Action:'RunApiEngine',TargetApiEngineKey:'import-microi-store-package',Title:'独占验收租户通知应用安装',
    Param:{Package:application},Options:{IdempotencyKey:'admission-resources-'+owner,
      ConcurrencyKey:'import-microi-store-package',MaxAttempts:1,RetryOnFailure:false}};
}
let contextFile,contextSha256;
export function bindPreparation(file,digest) {contextFile=file;contextSha256=digest;}
function acl(args) {
  const result=spawnSync(CONTEXT.python,['-B',path.join(HERE,'acl_guard.py'),'--context',contextFile,'--context-sha256',contextSha256,...args],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:65536});
  assert.equal(result.status,0,'Actual private ACL/context check failed');
}
const read=name=>{acl(['file',name]);return JSON.parse(fs.readFileSync(path.join(CONTEXT.privateDirectory,name),'utf8'));};
const exists=name=>fs.existsSync(path.join(CONTEXT.privateDirectory,name));
function save(name,value){acl(['directory']);fs.writeFileSync(path.join(CONTEXT.privateDirectory,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});acl(['file',name]);}
export function stageGate(intentExists,resultExists) {
  assert.ok(!intentExists || resultExists,'Unknown prior mutation: inspect the exact identity before any retry');
  return resultExists?'ReadbackOnly':'New';
}
function intent(name,data) {stageGate(exists(name+'.intent.json'),exists(name+'.result.json'));
  assert.ok(!exists(name+'.result.json'),'Stage already has a result; use readback/identities, no repeated mutation');
  save(name+'.intent.json',{task:TASK,owner32:OWNER,at:new Date().toISOString(),...data});}
export function identityPassword(kind) {
  assert.ok(['owner','ordinary'].includes(kind));
  // 生产默认密码接受 6–20 字符。固定四类字符 + 96 位随机量构成精确20字符，
  // 不为临时身份扩大真实密码上限；密码仍只进入私有文件和正式登录/账号请求。
  return (kind==='owner'?'Aa9!':'Bb8!')+randomBytes(12).toString('base64url');
}
function credentials() {
  if(!exists('credentials.json'))save('credentials.json',{task:TASK,owner32:OWNER,
    ownerPassword:identityPassword('owner'),ordinaryPassword:identityPassword('ordinary')});
  const value=read('credentials.json');assert.equal(value.task,TASK);assert.equal(value.owner32,OWNER);return value;
}
async function mainAdmin() {
  const session=new HttpSession(MAIN),user=await session.login(CONTEXT.mainCredentials.account,CONTEXT.mainCredentials.password);
  assert.ok(Number(user.Level)>=9999&&!user._AccessKeySession,'Real borrowed main admin required');
  return session;
}
async function checkUser(session,kind) {
  return ownedUser(success(await session.user({Action:'GetSysUserModel',Account:ACCOUNTS[kind]})),kind);
}
async function addUser(session,kind,password) {
  const existing=await session.user({Action:'GetSysUserModel',Account:ACCOUNTS[kind]});
  assert.equal(existing.Code,2,'Account is not provably absent; never adopt or overwrite');
  intent(kind,{tenant:session.tenant,account:ACCOUNTS[kind],marker:MARKER});
  // Pwd 只能经正式用户 API 的 HTTPS/loopback JSON body，不经 generic MCP params 审计。
  const result=await session.user({Action:'AddSysUser',Account:ACCOUNTS[kind],Pwd:password,
    Name:'Admission '+OWNER,Remark:MARKER,State:1,Level:0,RoleIds:[]});
  success(result);
  const row=await checkUser(session,kind);
  save(kind+'.result.json',{task:TASK,owner32:OWNER,tenant:session.tenant,user:row});return row;
}
async function ownerStage() {
  stageGate(exists('owner.intent.json'),exists('owner.result.json'));
  const session=await mainAdmin(),secrets=credentials();
  if(exists('owner.result.json')){const saved=read('owner.result.json');assert.equal((await checkUser(session,'owner')).Id,saved.user.Id);return;}
  await addUser(session,'owner',secrets.ownerPassword);
}
async function tenantStage() {
  stageGate(exists('tenant.intent.json'),exists('tenant.result.json'));
  assert.ok(!exists('tenant.result.json'),'Tenant creation already returned; run register_fixture.py inspect');
  const owner=read('owner.result.json').user;ownedUser(owner,'owner');
  const absent=read('target-absent.json');
  assert.equal(absent.task,TASK);assert.equal(absent.owner32,OWNER);assert.equal(absent.tenant,TENANT);
  assert.equal(absent.ownerUserId,owner.Id);assert.equal(absent.targetAbsent,true);
  assert.ok(Date.now()-Date.parse(absent.at)>=0&&Date.now()-Date.parse(absent.at)<600000,'Preflight is older than ten minutes');
  const session=new HttpSession(MAIN),user=await session.login(owner.Account,credentials().ownerPassword);
  currentUser(user,owner);
  intent('tenant',{tenant:TENANT,ownerUserId:owner.Id,transport:'official-managed-http',key:'platform-create-tenant'});
  // 正式 MCP ExecuteApiEngine 要额外开发权。这里按 root/parent 授权复用相同 Managed
  // HTTP 业务入口，让普通 owner 保持普通权限；不创建临时引擎、不伪造 CurrentUser。
  const result=await session.post('apiengine/platform-create-tenant',{
    TenantKey:TENANT,SystemName:'Admission '+OWNER},{timeout:TENANT_CREATION_TIMEOUT_MS});
  // Code!=1 仍保存真实回执；timeout/断线只留下 intent，必须独立盘点后恢复。
  save('tenant.result.json',{task:TASK,owner32:OWNER,ownerUserId:owner.Id,response:result});
  tenantReturn(result);
}
async function childAdmin() {
  const binding=fixture(read('admission-fixture.json'));
  const created=read('tenant.result.json');tenantReturn(created.response);assert.equal(created.ownerUserId,binding.ownerUserId);
  const session=new HttpSession(TENANT),user=await session.login('admin',credentials().ownerPassword);
  currentUser(user,{Id:id(user.Id),Account:'admin'},{admin:true});
  return {binding,session,user};
}
async function resourcesStage() {
  // 新空库只保证启动闭包；聊天应用通过正式安装器安装，不能用测试SQL补资源。
  // 登记校验先独立核实新建库和owner；完整inspect/claim仍在安装后执行且要求聊天接口存在。
  const binding=fixture(read('registered-tenant.json'));
  assert.equal(binding.ownerUserId,read('owner.result.json').user.Id);
  const session=new HttpSession(TENANT),user=await session.login('admin',credentials().ownerPassword);
  currentUser(user,{Id:id(user.Id),Account:'admin'},{admin:true});
  const bytes=fs.readFileSync(path.join(CONTEXT.candidateRoot,REQUIRED_APPLICATION));
  const application=requiredApplication(bytes,CONTEXT.sourceHashes[REQUIRED_APPLICATION]);
  const request=resourceInstallRequest(application,OWNER),route='apiengine/platform-background-task';
  intent('resources',{tenant:TENANT,ownerUserId:binding.ownerUserId,packagePath:REQUIRED_APPLICATION,packageSha256:sha(bytes),idempotencyKey:request.Options.IdempotencyKey});
  const submitted=await session.post(route,request);save('resources-submit.result.json',{task:TASK,owner32:OWNER,tenant:TENANT,response:submitted});
  const taskId=id(success(submitted).Id),deadline=Date.now()+600000;let status;
  do {status=success(await session.post(route,{Action:'Status',Id:taskId}));if(['Succeeded','Failed','Canceled'].includes(status.Status))break;await delay(2000);}while(Date.now()<deadline);
  const detail=await session.post(route,{Action:'Detail',Id:taskId});
  save('resources.result.json',{task:TASK,owner32:OWNER,tenant:TENANT,packageSha256:sha(bytes),taskId,status:status.Status,response:detail});
  assert.equal(status.Status,'Succeeded','Application task did not succeed; inspect the same persisted task, never resubmit');
  success(success(detail).Result);
}
async function identitiesStage() {
  const {binding,session,user:admin}=await childAdmin();
  stageGate(exists('ordinary.intent.json'),exists('ordinary.result.json'));
  const secrets=credentials();
  const ordinary=exists('ordinary.result.json')?await checkUser(session,'ordinary'):
    await addUser(session,'ordinary',secrets.ordinaryPassword);
  if(exists('ordinary.result.json'))assert.equal(ordinary.Id,read('ordinary.result.json').user.Id);
  const ordinarySession=new HttpSession(TENANT);
  const ordinaryCurrent=await ordinarySession.login(ordinary.Account,secrets.ordinaryPassword);currentUser(ordinaryCurrent,ordinary);
  const mcp=await connectMcp(session);
  let key;
  try {
    stageGate(exists('access-key.intent.json'),exists('access-key.result.json'));
    const existing=mcpJson(await mcp.call('microi_list_my_access_keys',{confirmExecution:'LIST'}));assert.ok(Array.isArray(existing));
    if(exists('access-key.result.json')) {
      key=read('access-key.result.json');accessRecord(key.Record,admin.Id);
      const rows=existing.filter(row=>row.Id===key.Record.Id);assert.equal(rows.length,1);accessRecord(rows[0],admin.Id);
    } else {
      assert.equal(existing.filter(row=>row.Name==='Admission '+OWNER||row.Remark===MARKER).length,0,'Prior owned key needs reconciliation');
      const grant=accessGrant(new Date(Date.now()+2*60*60*1000).toISOString());
      const confirmation=verifyConfirmation(await mcp.call('microi_create_my_access_key',grant),grant);
      intent('access-key',{tenant:TENANT,adminUserId:admin.Id,grant,confirmation});
      key=mcpJson(await mcp.call('microi_create_my_access_key',{...grant,confirmExecution:confirmation}));
      assert.ok(typeof key.AccessKey==='string'&&key.AccessKey.length>20);accessRecord(key.Record,admin.Id);
      save('access-key.result.json',{AccessKey:key.AccessKey,Record:key.Record});
      const fresh=mcpJson(await mcp.call('microi_list_my_access_keys',{confirmExecution:'LIST'}));
      const rows=fresh.filter(row=>row.Id===key.Record.Id);assert.equal(rows.length,1);accessRecord(rows[0],admin.Id);
    }
  } finally {await mcp.close();}
  const accessSession=new HttpSession(TENANT);
  const exchanged=success(await accessSession.post('api/SysUserAccessKey/Exchange',{AccessKey:key.AccessKey,Did:DID}));
  currentUser(exchanged,admin,{access:true});assert.ok(accessSession.token.length>=20,'Exchange must return Authorization header');
  const accessCurrent=success(await accessSession.post('apiengine/platform-current-user',{}));currentUser(accessCurrent,admin,{access:true});
  const runId=new Date().toISOString().replace(/[-:.]/g,'');
  save('identities-'+runId+'.json',{task:TASK,owner32:OWNER,tenant:TENANT,at:new Date().toISOString(),
    ownerUserId:binding.ownerUserId,adminUserId:admin.Id,ordinaryUserId:ordinary.Id,accessUserId:accessCurrent.Id,accessKeyId:key.Record.Id,
    env:{MICROI_ADMISSION_TEST_OWNER:OWNER,MICROI_ADMISSION_TEST_OSCLIENT:TENANT,MICROI_ADMISSION_TEST_DID:DID,
      MICROI_ADMISSION_TEST_TOKEN:session.token,MICROI_ADMISSION_TEST_ORDINARY_TOKEN:ordinarySession.token,
      MICROI_ADMISSION_TEST_ORDINARY_USER_ID:ordinaryCurrent.Id,MICROI_ADMISSION_TEST_ACCESS_KEY_TOKEN:accessSession.token,
      MICROI_ADMISSION_TEST_ACCESS_KEY_USER_ID:accessCurrent.Id},
    preparationSourceManifestSha256:sha(JSON.stringify(CONTEXT.sourceHashes))});
  save('admission-fixture-ready-'+runId+'.json',{...binding,adminUserId:admin.Id,
    ordinaryUserId:ordinaryCurrent.Id,accessUserId:accessCurrent.Id,accessKeyId:key.Record.Id,
    identityReadbackAt:new Date().toISOString()});
  return {runId,identityFile:'identities-'+runId+'.json',adminUserId:admin.Id,ordinaryUserId:ordinary.Id,accessUserId:accessCurrent.Id};
}
async function revokeStage() {
  const {session,user}=await childAdmin();const saved=read('access-key.result.json');accessRecord(saved.Record,user.Id);
  const mcp=await connectMcp(session);
  try {
    const before=mcpJson(await mcp.call('microi_list_my_access_keys',{confirmExecution:'LIST'}));
    const prior=before.filter(row=>row.Id===saved.Record.Id);assert.equal(prior.length,1);
    assert.equal(prior[0].TargetUserId,user.Id);assert.equal(prior[0].Remark,MARKER);
    // 撤销未知时先按精确 Id 回读；未撤销则保留未知意图，不盲目重复提交。
    if(exists('revoke.intent.json')){assert.notEqual(Number(prior[0].State),1,'Prior revocation is unconfirmed');return;}
    assert.equal(Number(prior[0].State),1);
    intent('revoke',{tenant:TENANT,id:saved.Record.Id});
    const result=mcpJson(await mcp.call('microi_revoke_my_access_key',{id:saved.Record.Id,confirmExecution:saved.Record.Id}));
    assert.equal(result.Id,saved.Record.Id);assert.equal(result.Revoked,true);
    const listed=mcpJson(await mcp.call('microi_list_my_access_keys',{confirmExecution:'LIST'}));
    const rows=listed.filter(row=>row.Id===saved.Record.Id);assert.equal(rows.length,1);assert.notEqual(Number(rows[0].State),1);
    // 撤销可幂等，失败/未知先回读。不会顺手删除其它访问密钥或主租户用户。
    save('revoke.result.json',{task:TASK,id:saved.Record.Id,verified:true});
  } finally {await mcp.close();}
}
async function removeOrdinaryStage() {
  const {session}=await childAdmin();
  const row=await checkUser(session,'ordinary');assert.equal(row.Id,read('ordinary.result.json').user.Id);
  intent('ordinary-delete',{tenant:TENANT,userId:row.Id,account:row.Account,marker:MARKER});
  const result=await session.user({Action:'DelSysUser',Id:row.Id});success(result);
  const readback=await session.user({Action:'GetSysUserModel',Account:row.Account});
  assert.equal(readback.Code,2,'Owned user removal not confirmed');
  save('ordinary-delete.result.json',{task:TASK,tenant:TENANT,userId:row.Id,removed:true});
}

export async function main(args) {
  const [action,confirmation]=args;
  if(action==='plan'||!action)return {task:TASK,owner32:OWNER,tenant:TENANT,executed:false,
    stages:['owner','register_fixture.py preflight','tenant','register_fixture.py registration','resources','register_fixture.py inspect/claim','identities','revoke','remove-ordinary'],transport:'official-managed-http + dedicated AccessKey MCP'};
  assert.equal(confirmation,OWNER,'Explicit task execution binding required');
  assert.ok(['owner','tenant','resources','identities','revoke','remove-ordinary'].includes(action));
  verifySources();
  acl(['directory']);
  const result=await ({owner:ownerStage,tenant:tenantStage,resources:resourcesStage,identities:identitiesStage,revoke:revokeStage,'remove-ordinary':removeOrdinaryStage}[action])();
  return {task:TASK,stage:action,completed:true,...result};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{console.log(JSON.stringify(await main(process.argv.slice(2))));}
  catch(error){console.error(JSON.stringify({task:TASK,completed:false,errorType:error.name,
    message:'Preparation stopped. Do not repeat uncertain writes; inspect exact private stage receipts.'}));process.exitCode=1;}
}
