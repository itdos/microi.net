/*
 * 发布与回滚执行器：共享数据库运行台账、CAS 租约、栅栏令牌、单步提交和同请求断点续跑。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能执行发布或回滚。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function parse(value, fallback) { if (!value) return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (error) { return fallback; } }
function rows(value) { var out = []; if (!value || value.length === undefined) return out; for (var i = 0; i < value.length; i++) out.push(value[i]); return out; }
function hash(value) { return text(V8.EncryptHelper.Sha256Hex(String(value || ''))).toLowerCase(); }
function newId() { return text(V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid()); }
function nowPlusSeconds(seconds) { return System.DateTime.Now.AddSeconds(seconds).ToString('yyyy-MM-dd HH:mm:ss'); }
function getResource(type, id) {
  var map = { FeatureFlag: ['mci_feature_flag', 'ContentHash'], ConfigurationProfile: ['mci_configuration_profile', 'ContentHash'], ServicePolicy: ['mci_service_route_policy', 'ContentHash'], AssetVersion: ['mci_asset_version', 'ContentHash'], Portal: ['mci_portal_project', 'PublishedHash'] }, target = map[type];
  if (!target) return null; var result = V8.FormEngine.GetFormData(target[0], { Id: id }, V8.DbTrans); if (!result || result.Code !== 1 || !result.Data) return { Exists: false, Hash: '', Table: target[0] }; return { Exists: true, Hash: text(result.Data[target[1]]).toLowerCase(), Table: target[0] };
}
function executeStep(step, stepIdempotencyKey, direction) {
  var action = text(step.Action), resourceType = text(step.ResourceType), resourceId = text(step.ResourceId), expectedHash = text(step.ExpectedHash).toLowerCase(), params = step.Params || {};
  if (action === 'Verify') {
    if (resourceType === 'ChangeSet') { var changed = V8.ApiEngine.Run('mci-change-set-validate', { ChangeSetId: resourceId, DryRun: true }, V8.DbTrans); if (!changed || changed.Code !== 1 || !changed.Data || changed.Data.Passed !== true) return { Code: 0, Msg: text(changed && changed.Msg) || '变更集门禁未通过。' }; var changeHash = text(changed.Data.PlanHash).toLowerCase(); return changeHash === expectedHash ? { Code: 1, Data: { ResourceType: resourceType, ResourceId: resourceId, ContentHash: changeHash } } : { Code: 0, Msg: '变更集计划哈希不一致。', Data: { ActualHash: changeHash } }; }
    var resource = getResource(resourceType, resourceId); if (!resource || !resource.Exists) return { Code: 0, Msg: '待验证资源不存在：' + resourceType + '/' + resourceId }; if (resource.Hash !== expectedHash) return { Code: 0, Msg: '资源哈希不一致：' + resourceType + '/' + resourceId, Data: { ActualHash: resource.Hash } }; return { Code: 1, Data: { ResourceType: resourceType, ResourceId: resourceId, ContentHash: resource.Hash } };
  }
  /* 变更步骤使用独立事务：失败时由子接口回滚；成功后若台账提交中断，则以步骤幂等键安全重试。 */
  if (action === 'PortalPublish') return V8.ApiEngine.Run('mci-portal-publish', { ProjectId: resourceId, ExpectedSnapshotHash: expectedHash, ChangeSummary: text(params.ChangeSummary), IdempotencyKey: stepIdempotencyKey });
  if (action === 'PortalRollback') return V8.ApiEngine.Run('mci-resource-rollback', { ResourceType: 'Portal', ResourceId: resourceId, TargetVersionId: text(params.TargetVersionId), ExpectedCurrentHash: expectedHash, ChangeSummary: text(params.ChangeSummary), IdempotencyKey: stepIdempotencyKey });
  if (action === 'Extension') { var extension = V8.ApiEngine.Run('mci-release-execute-extension', { HookKey: 'ReleaseExecute', OperationKey: text(step.OperationKey), Direction: direction, Step: step, StepIdempotencyKey: stepIdempotencyKey }); if (extension && extension.Code === 1 && (!extension.Data || extension.Data.Accepted !== false)) return extension; return extension || { Code: 0, Msg: '租户发布执行扩展失败。' }; }
  return { Code: 0, Msg: '不支持的发布步骤：' + action };
}
var param = V8.Param || {}, planId = text(param.ReleasePlanId), direction = text(param.Direction || 'Release'), idempotencyKey = text(param.IdempotencyKey), expectedPlanHash = text(param.ExpectedPlanHash).toLowerCase(), resume = param.Resume === true || Number(param.Resume || 0) === 1;
if (!planId || ['Release', 'Rollback'].indexOf(direction) < 0 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,158}$/.test(idempotencyKey) || !expectedPlanHash) return fail('ReleasePlanId、Direction、ExpectedPlanHash或IdempotencyKey无效。');
var planResult = V8.FormEngine.GetFormData('mci_release_plan', { Id: planId }, V8.DbTrans); if (!planResult || planResult.Code !== 1 || !planResult.Data) return { Code: 2, Msg: '发布计划不存在。' };
var plan = planResult.Data, planHash = text(plan.PlanHash).toLowerCase(), planStatus = text(plan.Status), planRowVersion = Number(plan.RowVersion || 0); if (planHash !== expectedPlanHash) return fail('发布计划哈希已变化，请重新执行门禁。', { Conflict: true, CurrentPlanHash: planHash });
var steps = rows(parse(direction === 'Release' ? plan.ResourcesJson : plan.RollbackJson, [])); if (steps.length < 1) return fail(direction === 'Release' ? '发布步骤为空。' : '回滚步骤为空。');
var runKey = hash(planId + ':' + direction + ':' + idempotencyKey), runResult = V8.FormEngine.GetFormData('mci_release_run', { _Where: [['RunKey', '=', runKey]] }, V8.DbTrans), run = runResult && runResult.Code === 1 ? runResult.Data : null, now = DateNow('yyyy-MM-dd HH:mm:ss');
if (!run) {
  if (direction === 'Release' && planStatus !== 'Ready') return fail('只有门禁通过并处于Ready状态的计划可以开始发布。');
  if (direction === 'Rollback' && ['Released', 'Failed'].indexOf(planStatus) < 0) return fail('只有已发布或发布失败的计划可以开始回滚。');
  var runId = newId(), add = V8.FormEngine.AddFormData('mci_release_run', { Id: runId, RunKey: runKey, ReleasePlanId: planId, IdempotencyKey: idempotencyKey, PlanHash: planHash, Direction: direction, Status: 'Running', Checkpoint: 0, TotalSteps: steps.length, ResultsJson: '[]', LeaseOwner: '', LeaseToken: '', LeaseExpiresAt: '', FencingToken: 0, RowVersion: 0, StartedTime: now, FinishedTime: '', ErrorMessage: '' }, V8.DbTrans);
  if (!add || add.Code !== 1) { runResult = V8.FormEngine.GetFormData('mci_release_run', { _Where: [['RunKey', '=', runKey]] }, V8.DbTrans); run = runResult && runResult.Code === 1 ? runResult.Data : null; if (!run) return add || fail('创建发布运行台账失败。'); }
  else run = { Id: runId, RunKey: runKey, ReleasePlanId: planId, IdempotencyKey: idempotencyKey, PlanHash: planHash, Direction: direction, Status: 'Running', Checkpoint: 0, TotalSteps: steps.length, ResultsJson: '[]', LeaseOwner: '', LeaseToken: '', LeaseExpiresAt: '', FencingToken: 0, RowVersion: 0 };
}
if (text(run.PlanHash).toLowerCase() !== planHash || text(run.Direction) !== direction || text(run.IdempotencyKey) !== idempotencyKey || Number(run.TotalSteps || 0) !== steps.length) return fail('运行台账与当前固定计划不一致。');
if (text(run.Status) === 'Completed') return { Code: 1, Data: { RunId: run.Id, RunKey: runKey, Status: 'Completed', Direction: direction, Checkpoint: Number(run.Checkpoint || 0), TotalSteps: steps.length, Reused: true, HasMore: false }, Msg: direction === 'Release' ? '相同发布请求已完成，已幂等复用。' : '相同回滚请求已完成，已幂等复用。' };
if (text(run.Status) === 'Failed' && !resume) return { Code: 1, Data: { RunId: run.Id, RunKey: runKey, Status: 'Failed', Direction: direction, Checkpoint: Number(run.Checkpoint || 0), TotalSteps: steps.length, ErrorMessage: text(run.ErrorMessage), Reused: true, HasMore: true, ResumeRequired: true }, Msg: '上次执行失败，请使用同一幂等键确认断点续跑。' };
var expectedPlanStatuses = direction === 'Release' ? ['Ready', 'Releasing', 'Failed'] : ['Released', 'RollingBack', 'Failed']; if (expectedPlanStatuses.indexOf(planStatus) < 0) return fail('发布计划状态与运行方向不一致：' + planStatus);
var presentedLeaseToken = text(param.LeaseToken), leaseToken = text(run.LeaseToken), leaseExpiresAt = text(run.LeaseExpiresAt); if (leaseToken && leaseExpiresAt > now && leaseToken !== presentedLeaseToken) return fail('发布运行正由其它节点持有，请稍后重试。', { Retryable: true, LeaseExpiresAt: leaseExpiresAt });
var runRowVersion = Number(run.RowVersion || 0), fencingToken = Number(run.FencingToken || 0) + 1, newLeaseToken = newId(), leaseOwner = text((V8.CurrentUser && V8.CurrentUser.Id) || '') + ':' + newLeaseToken, leaseExpires = nowPlusSeconds(60);
var claim = V8.FormEngine.UptFormDataByWhere('mci_release_run', { _Where: [['Id', '=', run.Id], ['AND', 'RowVersion', '=', runRowVersion], ['AND', 'Status', 'In', ['Running', 'Failed']]], Status: 'Running', LeaseOwner: leaseOwner, LeaseToken: newLeaseToken, LeaseExpiresAt: leaseExpires, FencingToken: fencingToken, RowVersion: runRowVersion + 1, ErrorMessage: '' }, V8.DbTrans); if (!claim || claim.Code !== 1) return claim || fail('发布运行租约竞争失败。', { Retryable: true });
var claimed = V8.FormEngine.GetFormData('mci_release_run', { Id: run.Id }, V8.DbTrans); if (!claimed || claimed.Code !== 1 || text(claimed.Data.LeaseToken) !== newLeaseToken || Number(claimed.Data.FencingToken || 0) !== fencingToken) return fail('发布运行租约回读失败。', { Retryable: true });
var runningStatus = direction === 'Release' ? 'Releasing' : 'RollingBack'; if (planStatus !== runningStatus) {
  var begin = V8.FormEngine.UptFormDataByWhere('mci_release_plan', { _Where: [['Id', '=', planId], ['AND', 'PlanHash', '=', planHash], ['AND', 'RowVersion', '=', planRowVersion], ['AND', 'Status', 'In', expectedPlanStatuses]], Status: runningStatus, LastRunId: run.Id, RowVersion: planRowVersion + 1 }, V8.DbTrans); if (!begin || begin.Code !== 1) return begin || fail('发布计划运行状态并发更新失败。'); planRowVersion++;
}
var checkpoint = Number(run.Checkpoint || 0); if (checkpoint < 0 || checkpoint >= steps.length) return fail('发布运行断点越界。');
var step = steps[checkpoint], stepIdempotencyKey = hash(runKey + ':' + checkpoint + ':' + planHash), stepResult;
try { stepResult = executeStep(step, stepIdempotencyKey, direction); } catch (error) { stepResult = { Code: 0, Msg: text(error && error.message ? error.message : error) || '发布步骤出现未处理异常。' }; }
var results = rows(parse(run.ResultsJson, [])), completedAt = DateNow('yyyy-MM-dd HH:mm:ss'), resultDataJson = '';
try { resultDataJson = JSON.stringify(stepResult && stepResult.Data ? stepResult.Data : {}); } catch (ignore) { resultDataJson = '{}'; }
var resultEntry = { Index: checkpoint, StepKey: text(step.StepKey), Action: text(step.Action), Status: stepResult && stepResult.Code === 1 ? 'Succeeded' : 'Failed', Message: text(stepResult && stepResult.Msg).slice(0, 500), ResultHash: hash(resultDataJson), StepIdempotencyKey: stepIdempotencyKey, CompletedAt: completedAt, FencingToken: fencingToken }; results.push(resultEntry); if (results.length > 200) results = results.slice(results.length - 200);
var claimedRowVersion = runRowVersion + 1;
if (!stepResult || stepResult.Code !== 1) {
  var errorMessage = text(stepResult && stepResult.Msg || '发布步骤执行失败。').slice(0, 1900), failRun = V8.FormEngine.UptFormDataByWhere('mci_release_run', { _Where: [['Id', '=', run.Id], ['AND', 'LeaseToken', '=', newLeaseToken], ['AND', 'FencingToken', '=', fencingToken], ['AND', 'RowVersion', '=', claimedRowVersion]], Status: 'Failed', ResultsJson: JSON.stringify(results), LeaseOwner: '', LeaseToken: '', LeaseExpiresAt: '', RowVersion: claimedRowVersion + 1, ErrorMessage: errorMessage }, V8.DbTrans); if (!failRun || failRun.Code !== 1) return failRun || fail('保存发布失败断点发生并发冲突。');
  var failPlan = V8.FormEngine.UptFormDataByWhere('mci_release_plan', { _Where: [['Id', '=', planId], ['AND', 'PlanHash', '=', planHash], ['AND', 'RowVersion', '=', planRowVersion], ['AND', 'Status', '=', runningStatus]], Status: 'Failed', LastRunId: run.Id, RowVersion: planRowVersion + 1 }, V8.DbTrans); if (!failPlan || failPlan.Code !== 1) return failPlan || fail('保存发布计划失败状态发生并发冲突。');
  return { Code: 1, Data: { RunId: run.Id, RunKey: runKey, Status: 'Failed', Direction: direction, Checkpoint: checkpoint, TotalSteps: steps.length, FailedStep: resultEntry, ErrorMessage: errorMessage, HasMore: true, ResumeRequired: true }, Msg: '发布步骤失败，断点与错误事实已保存。' };
}
var nextCheckpoint = checkpoint + 1, completed = nextCheckpoint >= steps.length, finishRun = V8.FormEngine.UptFormDataByWhere('mci_release_run', { _Where: [['Id', '=', run.Id], ['AND', 'LeaseToken', '=', newLeaseToken], ['AND', 'FencingToken', '=', fencingToken], ['AND', 'RowVersion', '=', claimedRowVersion]], Status: completed ? 'Completed' : 'Running', Checkpoint: nextCheckpoint, ResultsJson: JSON.stringify(results), LeaseOwner: '', LeaseToken: '', LeaseExpiresAt: '', RowVersion: claimedRowVersion + 1, FinishedTime: completed ? completedAt : '', ErrorMessage: '' }, V8.DbTrans); if (!finishRun || finishRun.Code !== 1) return finishRun || fail('保存发布断点发生并发冲突。');
if (completed) {
  var finalStatus = direction === 'Release' ? 'Released' : 'RolledBack', finishPlan = V8.FormEngine.UptFormDataByWhere('mci_release_plan', { _Where: [['Id', '=', planId], ['AND', 'PlanHash', '=', planHash], ['AND', 'RowVersion', '=', planRowVersion], ['AND', 'Status', '=', runningStatus]], Status: finalStatus, LastRunId: run.Id, ReleasedTime: direction === 'Release' ? completedAt : plan.ReleasedTime, RowVersion: planRowVersion + 1 }, V8.DbTrans); if (!finishPlan || finishPlan.Code !== 1) return finishPlan || fail('保存发布计划完成状态发生并发冲突。');
}
var verify = V8.FormEngine.GetFormData('mci_release_run', { Id: run.Id }, V8.DbTrans); if (!verify || verify.Code !== 1 || Number(verify.Data.Checkpoint || 0) !== nextCheckpoint || text(verify.Data.Status) !== (completed ? 'Completed' : 'Running')) return fail('发布运行断点回读失败，事务已回滚。');
return { Code: 1, Data: { RunId: run.Id, RunKey: runKey, Status: completed ? 'Completed' : 'Running', Direction: direction, Checkpoint: nextCheckpoint, TotalSteps: steps.length, CompletedStep: resultEntry, HasMore: !completed, ResumeRequired: false }, Msg: completed ? (direction === 'Release' ? '发布计划全部步骤已完成。' : '回滚计划全部步骤已完成。') : ('已完成步骤' + nextCheckpoint + '/' + steps.length + '，可继续下一步。') };
