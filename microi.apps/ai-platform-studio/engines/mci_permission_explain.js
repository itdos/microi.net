/*
 * 权限解释器：表/动作/菜单/样例行使用真实 FormEngine 授权边界；无表时只返回角色摘要。
 */
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return { Code: 0, Msg: '权限不足：只有超级管理员才能解释权限决策。' };
function list(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { var parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed : []; }
  catch (error) { return String(value).split(',').filter(function (item) { return item; }); }
}
var current = V8.CurrentUser || {};
var userId = String((V8.Param && V8.Param.UserId) || current.Id || '');
var menuId = String((V8.Param && V8.Param.MenuId) || '');
var tableKey = String((V8.Param && (V8.Param.TableKey || V8.Param.FormEngineKey || V8.Param.TableName)) || '');
if (!userId) return { Code: 0, Msg: 'UserId不能为空。' };
if (userId !== String(current.Id || '') && Number(current.Level || 0) < 999) return { Code: 0, Msg: '只有平台管理员可以解释其它用户权限。' };
if (tableKey) {
  return V8.Method.ExplainAuthorizationDecision({
    UserId: userId,
    TableKey: tableKey,
    Operation: String((V8.Param && V8.Param.Operation) || 'List'),
    MenuId: menuId,
    ModuleEngineKey: String((V8.Param && V8.Param.ModuleEngineKey) || ''),
    RowId: String((V8.Param && V8.Param.RowId) || '')
  });
}
var userResult = V8.FormEngine.GetFormData('Sys_User', { Id: userId, _SelectFields: ['Id', 'Account', 'Name', 'RoleIds', 'Level', 'DeptId', 'DeptIds', 'State'] });
if (!userResult || userResult.Code !== 1 || !userResult.Data) return { Code: 2, Msg: '用户不存在。' };
var user = userResult.Data;
var roleIds = list(user.RoleIds);
var rolesResult = roleIds.length ? V8.FormEngine.GetTableData('sys_role', {
  Ids: roleIds, _SelectFields: ['Id', 'Name', 'Level', 'BaseLimit'], _PageSize: 500
}) : { Code: 1, Data: [] };
var grantsResult = roleIds.length ? V8.FormEngine.GetTableData('sys_rolelimit', {
  _Where: [['RoleId', 'In', roleIds]], _PageSize: 5000
}) : { Code: 1, Data: [] };
var grants = grantsResult && grantsResult.Code === 1 ? (grantsResult.Data || []) : [];
var matched = [];
if (menuId) {
  for (var i = 0; i < grants.length; i++) {
    if (String(grants[i].FkId || '') === menuId) matched.push(grants[i]);
  }
}
var isSuper = Number(user.Level || 0) >= 999;
var allowed = !menuId || isSuper || matched.length > 0;
var reasons = [];
if (!menuId) reasons.push('未指定菜单，返回用户角色与全部授权摘要。');
else if (isSuper) reasons.push('用户级别为999，命中平台管理员授权。');
else if (matched.length) reasons.push('至少一个用户角色在sys_rolelimit中命中该菜单。');
else reasons.push('用户角色未在sys_rolelimit中命中该菜单。');
if (Number(user.State || 0) !== 1) { allowed = false; reasons.push('账号当前未启用，最终拒绝访问。'); }
return {
  Code: 1,
  Data: {
    User: { Id: user.Id, Account: user.Account, Name: user.Name, Level: user.Level, State: user.State, DeptId: user.DeptId },
    Roles: rolesResult && rolesResult.Code === 1 ? (rolesResult.Data || []) : [],
    MenuId: menuId,
    MatchedGrants: matched,
    Decision: allowed ? 'Allow' : 'Deny',
    Reasons: reasons,
    Hint: '填写TableKey和Operation可调用真实FormEngine边界解释表、菜单、动作与样例行。'
  }
};
