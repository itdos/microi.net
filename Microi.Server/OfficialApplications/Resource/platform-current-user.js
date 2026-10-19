/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-current-user
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-current-user | Version: v1.0.1 */

if (!V8.CurrentUser || !V8.CurrentUser.Id) return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
var beforeHook = V8.ApiEngine.Run('platform-runtime-custom-hook', {
  Stage: 'BeforeGetCurrentUser',
  SourceApiEngineKey: 'platform-current-user',
  UserId: String(V8.CurrentUser.Id)
});
if (!beforeHook || beforeHook.Code !== 1) return beforeHook || { Code: 0, Msg: '平台运行时个性化 Hook 未返回结果。' };
var afterHook = V8.ApiEngine.Run('platform-runtime-custom-hook', {
  Stage: 'AfterGetCurrentUser',
  SourceApiEngineKey: 'platform-current-user',
  UserId: String(V8.CurrentUser.Id)
});
if (!afterHook || afterHook.Code !== 1) return afterHook || { Code: 0, Msg: '平台运行时个性化 Hook 未返回结果。' };
// 个人中心只需要本人资料和偏好，不传输完整角色权限、菜单、V8 或登录投影。
if (String(V8.Param.View || '') === 'PersonalSettings') {
  var fields = ['Id', 'Account', 'Name', 'Email', 'Phone', 'Sex', 'Lang', 'DeptName',
    'RoleName', 'Avatar', 'PublicAvatar', 'DefaultIndexUrl', 'ThemeColor', 'CornerStyle',
    'NavigationLayout', 'ThemeMode', 'MenuChildExpandMode', 'DesktopType', 'DesktopBg',
    'RandomDesktopBg', 'OpenTreeMenu', 'DesktopDockMenu'];
  var profile = {};
  for (var i = 0; i < fields.length; i++) profile[fields[i]] = V8.CurrentUser[fields[i]];
  var roles = V8.CurrentUser._Roles || [];
  profile._Roles = [];
  for (var r = 0; r < roles.length; r++) {
    if (roles[r] && roles[r].Name) profile._Roles.push({ Name: String(roles[r].Name) });
  }
  return { Code: 1, Data: profile };
}
return { Code: 1, Data: V8.CurrentUser };
