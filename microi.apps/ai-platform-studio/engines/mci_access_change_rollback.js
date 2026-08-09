/*
 * 批量授权回滚：只有当前角色仍等于本变更的结果时才恢复，避免覆盖后续业务修改。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能回滚授权变更。');
var changeSetId = String((V8.Param && V8.Param.ChangeSetId) || '');
var expectedPlanHash = String((V8.Param && V8.Param.ExpectedPlanHash) || '').toLowerCase();
if (!changeSetId || !expectedPlanHash) return fail('ChangeSetId和ExpectedPlanHash不能为空。');
var setResult = V8.FormEngine.GetFormData('mci_access_change_set', { Id: changeSetId });
if (!setResult || setResult.Code !== 1 || !setResult.Data) return { Code: 2, Msg: '授权变更集不存在。' };
var set = setResult.Data;
if (String(set.PlanHash || '').toLowerCase() !== expectedPlanHash) return fail('计划哈希不匹配，拒绝回滚。');
if (set.Status === 'RolledBack') return { Code: 1, Data: set, Msg: '授权变更已回滚，已幂等返回。' };
if (['Applied', 'PartiallyApplied', 'RollbackConflicts'].indexOf(String(set.Status || '')) < 0) return fail('当前状态不允许回滚：' + set.Status);
var itemsResult = V8.FormEngine.GetTableData('mci_access_change_item', { _Where: [['ChangeSetId', '=', changeSetId], ['AND', 'Status', '=', 'Applied']], _OrderBy: 'SequenceNo', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 1000 });
if (!itemsResult || itemsResult.Code !== 1) return itemsResult || fail('读取授权变更明细失败。');
var items = itemsResult.Data || [], rolledBack = 0, conflicts = 0, now = DateNow('yyyy-MM-dd HH:mm:ss');
for (var i = 0; i < items.length; i++) {
  var item = items[i] || {};
  var current = V8.FormEngine.GetFormData('Sys_User', { Id: item.UserId, _SelectFields: ['Id', 'RoleIds'] }, V8.DbTrans);
  var currentRoles = current && current.Code === 1 && current.Data ? String(current.Data.RoleIds || '') : '';
  if (!current || current.Code !== 1 || !current.Data || String(V8.EncryptHelper.Sha256Hex(currentRoles)).toLowerCase() !== String(item.ExpectedAfterHash || '').toLowerCase()) {
    conflicts++;
    V8.FormEngine.UptFormData('mci_access_change_item', { Id: item.Id, Status: 'Conflict', ErrorMessage: '当前角色已发生后续修改，未覆盖。' }, V8.DbTrans);
    continue;
  }
  var restore = V8.FormEngine.UptFormDataByWhere('Sys_User', { _Where: [['Id', '=', item.UserId], ['AND', 'RoleIds', '=', currentRoles]], RoleIds: item.BeforeRoleIds || '' }, V8.DbTrans);
  var verify = V8.FormEngine.GetFormData('Sys_User', { Id: item.UserId, _SelectFields: ['Id', 'RoleIds'] }, V8.DbTrans);
  if (!restore || restore.Code !== 1 || !verify || verify.Code !== 1 || String(V8.EncryptHelper.Sha256Hex(String(verify.Data.RoleIds || ''))).toLowerCase() !== String(item.ExpectedBeforeHash || '').toLowerCase()) {
    conflicts++;
    V8.FormEngine.UptFormData('mci_access_change_item', { Id: item.Id, Status: 'Conflict', ErrorMessage: '回滚条件更新未取得所有权。' }, V8.DbTrans);
  } else {
    rolledBack++;
    V8.FormEngine.UptFormData('mci_access_change_item', { Id: item.Id, Status: 'RolledBack', RolledBackTime: now, ErrorMessage: '' }, V8.DbTrans);
  }
}
var status = conflicts ? 'RollbackConflicts' : 'RolledBack';
var finish = V8.FormEngine.UptFormData('mci_access_change_set', { Id: changeSetId, Status: status, ConflictCount: conflicts, RolledBackTime: now, ResultJson: JSON.stringify({ RolledBack: rolledBack, Conflicts: conflicts }) }, V8.DbTrans);
if (!finish || finish.Code !== 1) return finish || fail('更新授权回滚状态失败。');
return { Code: 1, Data: { ChangeSetId: changeSetId, Status: status, RolledBack: rolledBack, Conflicts: conflicts }, Msg: conflicts ? '授权回滚完成，部分用户存在后续修改。' : '授权变更已完整回滚。' };
