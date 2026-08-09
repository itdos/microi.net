/*
 * 身份同步执行：重算计划哈希、稳定幂等键、新账号默认停用。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能执行身份同步。');
var connectorId = String((V8.Param && V8.Param.ConnectorId) || '');
var expectedPlanHash = String((V8.Param && V8.Param.ExpectedPlanHash) || '').toLowerCase();
var idempotencyKey = String((V8.Param && V8.Param.IdempotencyKey) || '');
if (!connectorId || !expectedPlanHash || !idempotencyKey) return fail('ConnectorId、ExpectedPlanHash和IdempotencyKey不能为空。');
var existing = V8.FormEngine.GetFormData('mci_identity_sync_run', {
  _Where: [['ConnectorId', '=', connectorId], ['AND', 'IdempotencyKey', '=', idempotencyKey]]
});
if (existing && existing.Code === 1 && existing.Data) return { Code: 1, Data: existing.Data, Msg: '同步请求已执行，已幂等回放结果。' };
var planned = V8.ApiEngine.Run('mci-identity-sync-plan', { ConnectorId: connectorId, SourceRecords: V8.Param.SourceRecords || [] });
if (!planned || planned.Code !== 1 || !planned.Data) return fail(planned && planned.Msg ? planned.Msg : '同步计划生成失败。');
if (String(planned.Data.PlanHash).toLowerCase() !== expectedPlanHash) return fail('来源数据或账号状态已变化，请重新生成计划。', { ActualPlanHash: planned.Data.PlanHash });
var runId = V8.Method.NewUlid ? V8.Method.NewUlid() : V8.Method.NewGuid();
var addRun = V8.FormEngine.AddFormData('mci_identity_sync_run', {
  Id: runId,
  ConnectorId: connectorId,
  IdempotencyKey: idempotencyKey,
  PlanHash: expectedPlanHash,
  Status: 'Running',
  StartedTime: DateNow('yyyy-MM-dd HH:mm:ss'),
  AddCount: planned.Data.Summary.Add,
  UpdateCount: planned.Data.Summary.Update,
  ConflictCount: planned.Data.Summary.Conflict,
  ResultJson: '{}'
});
if (!addRun || addRun.Code !== 1) return addRun || fail('创建同步运行记录失败。');
var plan = planned.Data.Plan;
var added = 0, updated = 0, conflictCount = 0;
for (var i = 0; i < plan.Adds.length; i++) {
  var source = plan.Adds[i];
  var addUser = V8.FormEngine.AddFormData('Sys_User', {
    Account: source.Account,
    Name: source.Name || source.Account,
    Email: source.Email,
    Phone: source.Phone,
    DeptId: source.DeptId,
    DeptName: source.DeptName,
    RoleIds: source.RoleIds,
    State: 0,
    UserType: 'DirectoryPending',
    Remark: '由Microi身份同步创建，默认停用，未生成密码。'
  });
  if (!addUser || addUser.Code !== 1) return addUser || fail('新增账号失败：' + source.Account);
  added++;
}
for (var u = 0; u < plan.Updates.length; u++) {
  var updateUser = V8.FormEngine.UptFormData('Sys_User', plan.Updates[u].Patch);
  if (!updateUser || updateUser.Code !== 1) return updateUser || fail('更新账号失败：' + plan.Updates[u].Account);
  updated++;
}
for (var c = 0; c < plan.Conflicts.length; c++) {
  var conflict = plan.Conflicts[c];
  var addConflict = V8.FormEngine.AddFormData('mci_identity_sync_conflict', {
    RunId: runId,
    ConnectorId: connectorId,
    Account: conflict.Source && conflict.Source.Account ? conflict.Source.Account : '',
    ConflictType: conflict.Type,
    SourceJson: JSON.stringify(conflict.Source || {}),
    Message: conflict.Message,
    Status: 'Open'
  });
  if (!addConflict || addConflict.Code !== 1) return addConflict || fail('保存同步冲突失败。');
  conflictCount++;
}
var result = { Added: added, Updated: updated, Conflicts: conflictCount, Unchanged: plan.Unchanged.length };
var finish = V8.FormEngine.UptFormData('mci_identity_sync_run', {
  Id: runId,
  Status: conflictCount > 0 ? 'CompletedWithConflicts' : 'Completed',
  FinishedTime: DateNow('yyyy-MM-dd HH:mm:ss'),
  ResultJson: JSON.stringify(result)
});
if (!finish || finish.Code !== 1) return finish || fail('完成同步运行记录失败。');
return { Code: 1, Data: { RunId: runId, Result: result, PlanHash: expectedPlanHash }, Msg: '身份同步完成。' };
