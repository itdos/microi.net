import assert from 'node:assert/strict';

// 平台专项使用真实 HTTP、真实 DiyToken 和本任务拥有的推广租户；不构造统计响应。
// 调用方负责提供独立账号会话、已成功开通的申请回执以及明确的 fixture 所有权。
export async function verifySaasPromotionHttp({call,tenant,accounts,trial,submission,payload,link}) {
 const checks=[];
 const run=(actor,Action,data={})=>call('platform-saas-promotion',{Action,...data},actor,tenant);
 const publicRun=(Action,data={})=>call('platform-saas-public-trial',{Action,...data},null,tenant);
 const ok=r=>{assert.equal(r.Code,1,r.Msg);return r.Data;};
 const denied=r=>assert.notEqual(r.Code,1,'拒绝路径不得返回成功');
 const scopes={};
 for(const actor of ['salesA','salesB','manager','admin'])scopes[actor]=ok(await run(actor,'Bootstrap')).Actor;
 assert.equal(scopes.salesA.CanViewAll,false);assert.equal(scopes.salesB.CanViewAll,false);
 assert.equal(scopes.manager.CanViewAll,true);assert.equal(scopes.manager.CanConfigure,false);
 assert.equal(scopes.admin.CanConfigure,true);checks.push('真实业务员、管理角色与管理员授权');
 for(const actor of ['salesA','manager','admin']) {
  const data=ok(await run(actor,'Tenants',{Keyword:trial.OsClient}));
  assert.equal(data.Items.length,1);assert.equal(data.Items[0].Id,trial.Id);
  assert.equal(data.Items[0].ReferralUserId,accounts.salesA.Id);
 }
 const own=ok(await run('salesB','Tenants',{Keyword:trial.OsClient,CanViewAll:true,UserId:accounts.salesA.Id}));
 assert.equal(own.Items.length,0);
 denied(await run('salesB','TenantDetail',{Id:trial.Id}));
 denied(await run('salesB','Usage',{TenantIds:[trial.Id]}));
 denied(await run('salesB','UpdateFollowup',{Id:trial.Id,Stage:'Converted'}));
 denied(await run('salesA','Assign',{Id:trial.Id,ReferralUserId:accounts.salesB.Id}));
 denied(await run('manager','SaveSettings',{Enabled:false}));
 denied(await run('salesA','SaveSettings',{Enabled:false}));
 checks.push('跨业务员读取、伪造身份、跟进写入、分配与配置边界');

 const usage=ok(await run('salesA','Usage',{TenantIds:[trial.Id]})).Items;
 assert.equal(usage.length,1);assert.equal(usage[0].Id,trial.Id);
 assert.ok(['Ready','Partial'].includes(usage[0].Status));
 for(const key of ['Forms','ApiEngines','Menus','Users'])assert.ok(Number.isInteger(usage[0][key])&&usage[0][key]>0,key+'必须来自真实非空子库');
 assert.ok(usage[0].CollectedAt);assert.ok(usage[0].ActiveUsers7Days>=1,'真实登录必须反映到登录统计');
 const privateKeys=/DbConn|DbReadConn|Password|Pwd|AuthSecret|GrantCipher|CheckpointJson/i;
 const scan=v=>{if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){assert.ok(!privateKeys.test(k),'统计泄露字段 '+k);scan(x);}};
 scan(usage);checks.push('真实子库表单、接口、菜单、用户与登录统计及秘密投影');

 const before=ok(await run('salesA','TenantDetail',{Id:trial.Id}));
 try {
  ok(await run('salesA','UpdateFollowup',{Id:trial.Id,Stage:'Converted',Notes:'专项验收跟进',NextFollowup:'2030-01-01 00:00:00'}));
  assert.equal(ok(await run('salesA','TenantDetail',{Id:trial.Id})).TrialState,'Converted');
  const exported=ok(await run('salesA','Export',{Keyword:trial.OsClient}));assert.equal(exported.Items.length,1);
  ok(await run('admin','Assign',{Id:trial.Id,ReferralUserId:accounts.salesB.Id}));
  denied(await run('salesA','Usage',{TenantIds:[trial.Id]}));
  assert.equal(ok(await run('salesB','TenantDetail',{Id:trial.Id})).ReferralUserId,accounts.salesB.Id);
 } finally {
  ok(await run('admin','Assign',{Id:trial.Id,ReferralUserId:accounts.salesA.Id}));
  ok(await run('admin','UpdateFollowup',{Id:trial.Id,Stage:before.PromotionStage==='Converted'?'Converted':'Trial',
   Notes:before.PromotionNotes||'',NextFollowup:before.PromotionNextFollowup||''}));
 }
 checks.push('实际跟进、转化、导出、重新分配及缓存权限撤销');

 const repeated=ok(await publicRun('Create',payload));assert.equal(repeated.TaskId,submission.TaskId);
 const compact=ok(await publicRun('Create',{...payload,RequestId:payload.RequestId.replaceAll('-','').toUpperCase()}));
 assert.equal(compact.TaskId,submission.TaskId);
 const conflict=await publicRun('Create',{...payload,AdminPassword:payload.AdminPassword+'x'});
 assert.equal(conflict.Data?.ReasonCode,'IDEMPOTENCY_CONFLICT');
 const progress=ok(await publicRun('Progress',{RequestId:submission.RequestId,ProgressToken:submission.ProgressToken}));
 assert.equal(progress.Status,'Succeeded');assert.equal(progress.Result.OsClient,trial.OsClient);
 assert.deepEqual(Object.keys(progress.Result).sort(),['AdminAccount','DomainBindingStatus','LaunchUrl','OsClient','SystemName']);
 denied(await publicRun('Progress',{RequestId:submission.RequestId,ProgressToken:submission.ProgressToken+'x'}));
 for(const field of ['DbConn','RoleIds','OwnerUserId','TemplateUrl','Level'])denied(await publicRun('Create',{...payload,[field]:'forged'}));
 denied(await publicRun('Bootstrap',{...link,ReferralUserId:accounts.salesB.Id}));
 denied(await call('platform-saas-public-trial-worker',{GrantCipher:'forged'},null,tenant));
 denied(await run('salesB','ResumeTask',{Id:submission.TaskId}));
 denied(await run('admin','ResumeTask',{Id:submission.TaskId}));
 checks.push('申请重放、UUID别名、密码冲突、进度票据、公开字段与任务终态保护');

 denied(await call('platform-saas-promotion',{Action:'Dashboard'},'child',trial.OsClient));
 denied(await call('platform-saas-public-trial',{Action:'Bootstrap',...link},null,trial.OsClient));
 denied(await call('platform-saas-promotion',{Action:'Usage',TenantIds:[trial.Id]},'admin',trial.OsClient));
 checks.push('子租户与主租户Token错配不能取得推广跨库权限');
 return {passed:checks.length,failed:0,skipped:0,checks,usage:usage[0]};
}
