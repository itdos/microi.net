/*
 * 批量授权计划：只生成逐用户前后角色证据，不做写入。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能生成授权计划。');
function text(value) { return value === null || value === undefined ? '' : String(value); }
function list(value) {
  if (!value) return [];
  if (value.length !== undefined && typeof value !== 'string') { var result = []; for (var i = 0; i < value.length; i++) result.push(text(value[i])); return result; }
  var source = text(value).replace(/^\s+|\s+$/g, '');
  if (!source) return [];
  try { var parsed = JSON.parse(source); if (parsed && parsed.length !== undefined) { var arr = []; for (var j = 0; j < parsed.length; j++) arr.push(text(parsed[j])); return arr; } } catch (error) {}
  return source.split(',');
}
function uniqueSorted(values) {
  var seen = {}, result = [];
  for (var i = 0; i < values.length; i++) { var value = text(values[i]).replace(/^\s+|\s+$/g, ''); if (value && !seen[value]) { seen[value] = true; result.push(value); } }
  result.sort(); return result;
}
function serializeLike(original, values) { var normalized = uniqueSorted(values); return text(original).replace(/^\s+/, '').charAt(0) === '[' ? JSON.stringify(normalized) : normalized.join(','); }
var action = text(V8.Param && V8.Param.ActionType);
if (['GrantRole', 'RevokeRole', 'ReplaceRoles'].indexOf(action) < 0) return fail('ActionType只允许GrantRole、RevokeRole或ReplaceRoles。');
var roleIds = uniqueSorted(list(V8.Param && V8.Param.RoleIds));
if (!roleIds.length && action !== 'ReplaceRoles') return fail('RoleIds不能为空。');
if (roleIds.length > 50) return fail('单次授权最多包含50个角色。');
var userIds = uniqueSorted(list(V8.Param && V8.Param.UserIds));
var groupId = text(V8.Param && V8.Param.GroupId);
if (groupId) {
  var groupResult = V8.FormEngine.GetFormData('mci_identity_group', { Id: groupId });
  if (!groupResult || groupResult.Code !== 1 || !groupResult.Data || !groupResult.Data.ActiveSnapshotId) return fail('用户组不存在或没有生效成员快照。');
  var members = V8.FormEngine.GetTableData('mci_identity_group_member', {
    _Where: [['GroupId', '=', groupId], ['AND', 'SnapshotId', '=', groupResult.Data.ActiveSnapshotId], ['AND', 'Status', '=', 'Active']],
    _SelectFields: ['UserId'], _PageIndex: 1, _PageSize: 1000
  });
  if (!members || members.Code !== 1) return members || fail('读取用户组成员失败。');
  var memberRows = members.Data || [];
  for (var m = 0; m < memberRows.length; m++) userIds.push(text(memberRows[m].UserId));
  userIds = uniqueSorted(userIds);
}
if (!userIds.length) return fail('UserIds或GroupId至少填写一项。');
if (userIds.length > 500) return fail('单次授权计划最多处理500名用户，请使用多个变更集。');
var usersResult = V8.FormEngine.GetTableData('Sys_User', {
  _Where: [['Id', 'In', userIds]],
  _SelectFields: ['Id', 'Account', 'Name', 'RoleIds', 'State'],
  _PageIndex: 1, _PageSize: 500
});
if (!usersResult || usersResult.Code !== 1) return usersResult || fail('读取授权目标用户失败。');
var users = usersResult.Data || [], items = [];
for (var u = 0; u < users.length; u++) {
  var user = users[u] || {}, before = text(user.RoleIds), current = uniqueSorted(list(before)), after;
  if (action === 'ReplaceRoles') after = roleIds.slice(0);
  else if (action === 'GrantRole') after = uniqueSorted(current.concat(roleIds));
  else { var removing = {}; for (var r = 0; r < roleIds.length; r++) removing[roleIds[r]] = true; after = current.filter(function (id) { return !removing[id]; }); }
  var afterText = serializeLike(before, after);
  items.push({
    UserId: text(user.Id), Account: text(user.Account), Name: text(user.Name),
    BeforeRoleIds: before, AfterRoleIds: afterText,
    ExpectedBeforeHash: String(V8.EncryptHelper.Sha256Hex(before)).toLowerCase(),
    ExpectedAfterHash: String(V8.EncryptHelper.Sha256Hex(afterText)).toLowerCase(),
    Changed: before !== afterText
  });
}
items.sort(function (a, b) { return a.UserId < b.UserId ? -1 : (a.UserId > b.UserId ? 1 : 0); });
var plan = { ActionType: action, RoleIds: roleIds, GroupId: groupId, Items: items };
return { Code: 1, Data: { Plan: plan, PlanHash: String(V8.EncryptHelper.Sha256Hex(JSON.stringify(plan))).toLowerCase(), Summary: { Requested: userIds.length, Found: users.length, Changed: items.filter(function (x) { return x.Changed; }).length, Missing: userIds.length - users.length } } };
