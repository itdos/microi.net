/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：platform-sys-menu
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-sys-menu
 * Version: v1.0.4
 * Function:
 * - 菜单与角色菜单授权编排由应用商城交付；旧 SysMenu 路径固定解析动作并兼容大小写和租户后缀，保留角色权限树、个性化 Hook 与可信后端授权。
 */

// Microi官方接口引擎：platform-sys-menu
// Version: v1.0.3
// 菜单与角色菜单授权编排由应用商城交付；角色权限树使用固定窄投影、权威缓存和线性组树。
if (!V8.CurrentUser || !V8.CurrentUser.Id) {
  return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
}
var action = String((V8.Param && V8.Param.Action) || '').trim();
var allowed = {
  AddSysMenu: 1,
  DelSysMenu: 1,
  UptSysMenu: 1,
  GetSysMenu: 1,
  GetSysMenuModel: 1,
  GetSysMenuStep: 1,
  GetRolePermissionTree: 1,
  GetSysRoleLimitByMenuId: 1,
  UpdateSysRoleLimitByMenuId: 1
};
// 旧客户端只发送路径，不发送 Action；路径必须固定动作，不能被请求正文改为写操作。
var route = String((V8.Param && (V8.Param._RequestPath || V8.Param.ApiAddress)) || '')
  .replace(/\?.*$/, '').replace(/--OsClient--.*?--$/i, '');
if (/^\/api\/sysmenu\//i.test(route)) action = route.split('/').pop();
var canonicalAction = '';
for (var name in allowed) {
  if (name.toLowerCase() === action.toLowerCase()) { canonicalAction = name; break; }
}
action = canonicalAction;
if (!allowed[action]) return { Code: 0, Msg: '不支持的菜单动作。' };
var customization = V8.ApiEngine.Run('platform-marketplace-source-hook', {
  Stage: 'BeforeSysMenuAction',
  SourceApiEngineKey: 'platform-sys-menu',
  Action: action
});
if (!customization || customization.Code !== 1) {
  return customization || { Code: 0, Msg: '应用商城个性化 Hook 未返回结果。' };
}
return V8.Method.ManageSystemDirectory({
  Domain: 'SysMenu',
  Action: action,
  Param: V8.Param
});
