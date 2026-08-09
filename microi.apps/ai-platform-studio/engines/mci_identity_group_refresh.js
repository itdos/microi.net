/*
 * 用户组刷新：复用预览后的精确成员集合，写入不可变快照后原子切换生效指针。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能刷新用户组。');
function text(value) { return value === null || value === undefined ? '' : String(value); }
var groupId = text(V8.Param && V8.Param.GroupId), expectedRuleHash = text(V8.Param && V8.Param.ExpectedRuleHash).toLowerCase();
if (!groupId || !expectedRuleHash) return fail('GroupId和ExpectedRuleHash不能为空。');
var groupResult = V8.FormEngine.GetFormData('mci_identity_group', { Id: groupId }, V8.DbTrans);
if (!groupResult || groupResult.Code !== 1 || !groupResult.Data) return { Code: 2, Msg: '用户组不存在。' };
var group = groupResult.Data;
if (Number(group.Enabled || 0) !== 1) return fail('用户组未启用。');
var preview = V8.ApiEngine.Run('mci-identity-group-preview', { GroupId: groupId }, V8.DbTrans);
if (!preview || preview.Code !== 1 || !preview.Data) return preview || fail('用户组预览失败。');
if (text(preview.Data.RuleHash).toLowerCase() !== expectedRuleHash) return fail('规则哈希已变化，请重新预览。', { Conflict: true, CurrentRuleHash: preview.Data.RuleHash });
var memberIds = preview.Data.MemberIds || [];
if (Number(preview.Data.MemberCount || 0) > 5000 || memberIds.length > 5000) return fail('单个用户组最多物化5000名成员，请拆分规则。');
var users = [];
if (memberIds.length) {
  var usersResult = V8.FormEngine.GetTableData('Sys_User', { _Where: [['Id', 'In', memberIds]], _SelectFields: ['Id', 'Account', 'Name', 'State'], _OrderBy: 'Account', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 5000 }, V8.DbTrans);
  if (!usersResult || usersResult.Code !== 1) return usersResult || fail('读取用户组成员失败。');
  users = usersResult.Data || [];
  if (users.length !== memberIds.length) return fail('成员集合在预览后发生变化，请重新预览。', { Expected: memberIds.length, Found: users.length });
}
var snapshotId = V8.Method.NewUlid(), now = DateNow('yyyy-MM-dd HH:mm:ss'), rows = [];
for (var i = 0; i < users.length; i++) {
  var user = users[i] || {};
  rows.push({
    FormEngineKey: 'mci_identity_group_member', GroupId: groupId, SnapshotId: snapshotId,
    UserId: text(user.Id), Account: text(user.Account),
    MembershipSource: group.GroupType === 'Directory' ? 'Directory' : (group.GroupType === 'Static' ? 'Static' : 'Rule'),
    MembershipHash: text(V8.EncryptHelper.Sha256Hex(groupId + ':' + snapshotId + ':' + text(user.Id))).toLowerCase(),
    Status: 'Active', EffectiveFrom: now
  });
}
if (rows.length) {
  var addRows = V8.FormEngine.AddTableData(rows);
  if (!addRows || addRows.Code !== 1) return addRows || fail('保存用户组成员快照失败。');
}
if (group.ActiveSnapshotId) {
  var expireOld = V8.FormEngine.UptFormDataByWhere('mci_identity_group_member', { _Where: [['GroupId', '=', groupId], ['AND', 'SnapshotId', '=', group.ActiveSnapshotId], ['AND', 'Status', '=', 'Active']], Status: 'Superseded', EffectiveTo: now }, V8.DbTrans);
  if (!expireOld || expireOld.Code !== 1) return expireOld || fail('关闭旧成员快照失败。');
}
var switchWhere = [['Id', '=', groupId], ['AND', 'RuleJson', '=', group.RuleJson || '']];
if (group.ActiveSnapshotId) switchWhere.push(['AND', 'ActiveSnapshotId', '=', group.ActiveSnapshotId]);
var switchResult = V8.FormEngine.UptFormDataByWhere('mci_identity_group', { _Where: switchWhere, ActiveSnapshotId: snapshotId, MemberCount: rows.length, RuleHash: expectedRuleHash, LastEvaluatedTime: now }, V8.DbTrans);
if (!switchResult || switchResult.Code !== 1) return switchResult || fail('用户组规则或生效快照发生并发修改。');
var verify = V8.FormEngine.GetFormData('mci_identity_group', { Id: groupId }, V8.DbTrans);
if (!verify || verify.Code !== 1 || text(verify.Data.ActiveSnapshotId) !== snapshotId) return fail('用户组快照切换回读失败，事务已回滚。');
return { Code: 1, Data: { GroupId: groupId, SnapshotId: snapshotId, RuleHash: expectedRuleHash, MemberCount: rows.length }, Msg: '用户组成员快照已刷新。' };
