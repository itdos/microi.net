/*
 * 日志生命周期执行：由持久后台任务分片调用可信原子方法；归档成功并回读后才删除。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能执行日志生命周期任务。');
var policyId = String((V8.Param && V8.Param.PolicyId) || ''), expectedPlanHash = String((V8.Param && V8.Param.ExpectedPlanHash) || '').toLowerCase();
var runKey = String((V8.Param && V8.Param.RunKey) || '').replace(/^\s+|\s+$/g, '');
if (!policyId || !expectedPlanHash || !runKey) return fail('PolicyId、ExpectedPlanHash和RunKey不能为空。');
var planned = V8.ApiEngine.Run('mci-log-lifecycle-plan', { PolicyId: policyId });
if (!planned || planned.Code !== 1 || !planned.Data) return planned || fail('日志生命周期计划生成失败。');
if (String(planned.Data.PlanHash || '').toLowerCase() !== expectedPlanHash) return fail('日志生命周期计划已变化，请重新预览。', { Conflict: true, CurrentPlanHash: planned.Data.PlanHash });
if (!planned.Data.CanExecute) return fail(planned.Data.BlockReason || '当前策略不允许执行。');
var taskId = String((V8.Param && V8.Param._BackgroundTaskId) || ''), fence = Number((V8.Param && V8.Param._BackgroundTaskFencingToken) || 0);
if (!taskId || fence <= 0) return fail('日志生命周期只能通过持久后台任务执行。');
var runResult = V8.FormEngine.GetFormData('mci_log_lifecycle_run', { _Where: [['RunKey', '=', runKey]] });
var run = runResult && runResult.Code === 1 ? runResult.Data : null, now = DateNow('yyyy-MM-dd HH:mm:ss');
if (!run) {
  var runId = V8.Method.NewUlid();
  var add = V8.FormEngine.AddFormData('mci_log_lifecycle_run', {
    Id: runId, RunKey: runKey, PolicyId: policyId, PlanHash: expectedPlanHash, Status: 'Running',
    CutoffTime: planned.Data.Plan.CutoffTime, ScannedCount: 0, ArchivedCount: 0, DeletedCount: 0,
    BackgroundTaskId: taskId, FencingToken: fence, CheckpointJson: '{}', StartedTime: now
  });
  if (!add || add.Code !== 1) {
    runResult = V8.FormEngine.GetFormData('mci_log_lifecycle_run', { _Where: [['RunKey', '=', runKey]] });
    run = runResult && runResult.Code === 1 ? runResult.Data : null;
    if (!run) return add || fail('创建日志生命周期运行记录失败。');
  } else run = { Id: runId, RunKey: runKey, Status: 'Running', ScannedCount: 0, ArchivedCount: 0, DeletedCount: 0 };
}
if (run.Status === 'Completed' || run.Status === 'CompletedWithErrors') return { Code: 1, Data: run, Msg: '日志生命周期任务已结束，已幂等返回。' };
if (String(run.BackgroundTaskId || '') !== taskId || Number(run.FencingToken || 0) > fence) return fail('后台任务租约已失效，拒绝旧栅栏继续执行。');
var checkpoint = (V8.Param && V8.Param._BackgroundTaskCheckpoint) || {};
var physical = V8.Method.RunSystemLogLifecycle({
  CutoffTime: planned.Data.Plan.CutoffTime,
  Match: planned.Data.Plan.Match || {},
  ArchiveMode: planned.Data.Plan.ArchiveMode,
  PolicyKey: planned.Data.Plan.PolicyKey,
  RunKey: runKey,
  Checkpoint: checkpoint,
  BatchSize: 200,
  BackgroundTaskId: taskId,
  FencingToken: fence
});
if (!physical || physical.Code !== 1 || !physical.Data) {
  V8.FormEngine.UptFormData('mci_log_lifecycle_run', { Id: run.Id, Status: 'Failed', LastError: String((physical && physical.Msg) || '物理日志生命周期执行失败').slice(0, 1900), FencingToken: fence, FinishedTime: now });
  return physical || fail('物理日志生命周期执行失败。');
}
var cumulative = physical.Data.Cumulative === true;
var scanned = cumulative ? Number(physical.Data.Scanned || 0) : Number(run.ScannedCount || 0) + Number(physical.Data.Scanned || 0);
var archived = cumulative ? Number(physical.Data.Archived || 0) : Number(run.ArchivedCount || 0) + Number(physical.Data.Archived || 0);
var deleted = cumulative ? Number(physical.Data.Deleted || 0) : Number(run.DeletedCount || 0) + Number(physical.Data.Deleted || 0);
var extensionWarning = '';
if (physical.Data.ExtensionRequired === true) {
  var extension = V8.ApiEngine.Run('mci-log-archive-extension', {
    HookKey: 'LogArchive', PolicyKey: planned.Data.Plan.PolicyKey, RunKey: runKey,
    ArchivePath: physical.Data.ArchivePath || '', ArchiveProofHash: physical.Data.ArchiveProofHash || '',
    Scanned: Number(physical.Data.Scanned || 0), Archived: Number(physical.Data.Archived || 0), Deleted: Number(physical.Data.Deleted || 0)
  });
  if (!extension || extension.Code !== 1) extensionWarning = String((extension && extension.Msg) || '租户日志归档扩展执行失败').slice(0, 1900);
}
var nextCheckpoint = physical.Data.Checkpoint || {}, hasMore = physical.Data.HasMore === true;
var update = V8.FormEngine.UptFormDataByWhere('mci_log_lifecycle_run', {
  _Where: [['Id', '=', run.Id], ['AND', 'BackgroundTaskId', '=', taskId], ['AND', 'FencingToken', '<=', fence]],
  Status: hasMore ? 'Running' : (extensionWarning ? 'CompletedWithErrors' : 'Completed'), ScannedCount: scanned, ArchivedCount: archived, DeletedCount: deleted,
  ArchiveProofHash: physical.Data.ArchiveProofHash || run.ArchiveProofHash || '', ArchivePath: physical.Data.ArchivePath || run.ArchivePath || '',
  CheckpointJson: JSON.stringify(nextCheckpoint), FencingToken: fence, FinishedTime: hasMore ? '' : now, LastError: extensionWarning
});
if (!update || update.Code !== 1) return update || fail('日志运行记录条件更新失败。');
if (hasMore) return { Code: 1, Data: { BackgroundTask: { HasMore: true, Checkpoint: nextCheckpoint, Current: deleted, Total: Number(planned.Data.EstimatedCount || 0), NextDelaySeconds: 0, Msg: '已安全处理' + deleted + '条日志' } } };
V8.FormEngine.UptFormData('mci_log_policy', { Id: policyId, LastRunTime: now });
return { Code: 1, Data: { RunId: run.Id, RunKey: runKey, Scanned: scanned, Archived: archived, Deleted: deleted, Status: extensionWarning ? 'CompletedWithErrors' : 'Completed', ExtensionWarning: extensionWarning }, Msg: extensionWarning ? '日志生命周期已完成，租户扩展返回警告。' : '日志生命周期任务已完成。' };
