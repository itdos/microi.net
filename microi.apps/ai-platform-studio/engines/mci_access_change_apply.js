/*
 * 批量授权执行：计划哈希防篡改，逐用户前置哈希防并发覆盖，结果可条件回滚。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能应用授权变更。');
var expectedPlanHash = String((V8.Param && V8.Param.ExpectedPlanHash) || '').toLowerCase();
var idempotencyKey = String((V8.Param && V8.Param.IdempotencyKey) || '').replace(/^\s+|\s+$/g, '');
if (!expectedPlanHash || !idempotencyKey) return fail('ExpectedPlanHash和IdempotencyKey不能为空。');
var existing = V8.FormEngine.GetFormData('mci_access_change_set', { _Where: [['IdempotencyKey', '=', idempotencyKey]] });
if (existing && existing.Code === 1 && existing.Data) return { Code: 1, Data: existing.Data, Msg: '授权请求已执行，已幂等回放。' };
var planned = V8.ApiEngine.Run('mci-access-change-plan', {
  ActionType: V8.Param.ActionType,
  RoleIds: V8.Param.RoleIds || [],
  UserIds: V8.Param.UserIds || [],
  GroupId: V8.Param.GroupId || ''
});
if (!planned || planned.Code !== 1 || !planned.Data) return planned || fail('授权计划生成失败。');
if (String(planned.Data.PlanHash || '').toLowerCase() !== expectedPlanHash) return fail('授权计划已变化，请重新预览。', { Conflict: true, CurrentPlanHash: planned.Data.PlanHash });
var changeSetId = V8.Method.NewUlid(), changeKey = String((V8.Param && V8.Param.ChangeKey) || ('access-' + changeSetId));
var plan = planned.Data.Plan || {}, items = plan.Items || [], now = DateNow('yyyy-MM-dd HH:mm:ss');
var addSet = V8.FormEngine.AddFormData('mci_access_change_set', {
  Id: changeSetId,
  ChangeKey: changeKey,
  IdempotencyKey: idempotencyKey,
  ActionType: plan.ActionType,
  TargetType: plan.GroupId ? 'Group' : 'Users',
  TargetId: plan.GroupId || '',
  PlanHash: expectedPlanHash,
  Status: 'Applying',
  RequestedBy: String((V8.CurrentUser && (V8.CurrentUser.Name || V8.CurrentUser.Account)) || ''),
  ApprovalRef: String((V8.Param && V8.Param.ApprovalRef) || ''),
  TotalCount: items.length,
  SuccessCount: 0,
  ConflictCount: 0,
  PlanJson: JSON.stringify(plan),
  ResultJson: '{}'
}, V8.DbTrans);
if (!addSet || addSet.Code !== 1) {
  existing = V8.FormEngine.GetFormData('mci_access_change_set', { _Where: [['IdempotencyKey', '=', idempotencyKey]] }, V8.DbTrans);
  if (existing && existing.Code === 1 && existing.Data) return { Code: 1, Data: existing.Data, Msg: '授权请求已并发执行，已幂等回放。' };
  return addSet || fail('创建授权变更集失败。');
}
var success = 0, conflicts = 0, failures = 0;
for (var i = 0; i < items.length; i++) {
  var item = items[i] || {}, status = 'Pending', error = '';
  if (!item.Changed) { status = 'Applied'; success++; }
  else {
    var current = V8.FormEngine.GetFormData('Sys_User', { Id: item.UserId, _SelectFields: ['Id', 'RoleIds'] }, V8.DbTrans);
    var currentRoles = current && current.Code === 1 && current.Data ? String(current.Data.RoleIds || '') : '';
    var currentHash = String(V8.EncryptHelper.Sha256Hex(currentRoles)).toLowerCase();
    if (!current || current.Code !== 1 || !current.Data || currentHash !== item.ExpectedBeforeHash) { status = 'Conflict'; conflicts++; error = '角色已被其他操作修改。'; }
    else {
      var update = V8.FormEngine.UptFormDataByWhere('Sys_User', { _Where: [['Id', '=', item.UserId], ['AND', 'RoleIds', '=', currentRoles]], RoleIds: item.AfterRoleIds }, V8.DbTrans);
      var verify = V8.FormEngine.GetFormData('Sys_User', { Id: item.UserId, _SelectFields: ['Id', 'RoleIds'] }, V8.DbTrans);
      if (!update || update.Code !== 1 || !verify || verify.Code !== 1 || String(V8.EncryptHelper.Sha256Hex(String(verify.Data.RoleIds || ''))).toLowerCase() !== item.ExpectedAfterHash) { status = 'Conflict'; conflicts++; error = '条件更新未取得所有权。'; }
      else { status = 'Applied'; success++; }
    }
  }
  var addItem = V8.FormEngine.AddFormData('mci_access_change_item', {
    ChangeSetId: changeSetId, SequenceNo: i + 1, UserId: item.UserId, Account: item.Account,
    BeforeRoleIds: item.BeforeRoleIds, AfterRoleIds: item.AfterRoleIds,
    ExpectedBeforeHash: item.ExpectedBeforeHash, ExpectedAfterHash: item.ExpectedAfterHash,
    Status: status, ErrorMessage: error, AppliedTime: status === 'Applied' ? now : ''
  }, V8.DbTrans);
  if (!addItem || addItem.Code !== 1) { failures++; return addItem || fail('写入授权逐用户证据失败。'); }
}
var finalStatus = failures ? 'Failed' : (conflicts ? 'PartiallyApplied' : 'Applied');
var result = { Success: success, Conflicts: conflicts, Failed: failures, Total: items.length };
var finish = V8.FormEngine.UptFormData('mci_access_change_set', { Id: changeSetId, Status: finalStatus, SuccessCount: success, ConflictCount: conflicts, ResultJson: JSON.stringify(result), AppliedTime: now }, V8.DbTrans);
if (!finish || finish.Code !== 1) return finish || fail('更新授权变更集结果失败。');
return { Code: 1, Data: { ChangeSetId: changeSetId, ChangeKey: changeKey, PlanHash: expectedPlanHash, Status: finalStatus, Result: result }, Msg: conflicts ? '授权变更完成，部分用户发生并发冲突。' : '授权变更已应用。' };
