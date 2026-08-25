/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：应用商城
 * ApiEngineKey：platform-sys-menu
 * 从可信吾码官方应用源安装、更新或重新安装“应用商城”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

// Microi官方接口引擎：platform-sys-menu
// Version: v1.0.0
// 菜单与角色菜单授权编排由应用商城交付，底层原子能力保留权威缓存与租户边界。
var action = String((V8.Param && V8.Param.Action) || '').trim();
var allowed = {
  AddSysMenu: 1,
  DelSysMenu: 1,
  UptSysMenu: 1,
  GetSysMenu: 1,
  GetSysMenuModel: 1,
  GetSysMenuStep: 1,
  GetSysRoleLimitByMenuId: 1,
  UpdateSysRoleLimitByMenuId: 1
};
if (!allowed[action]) return { Code: 0, Msg: '不支持的菜单动作。' };
return V8.Method.ManageSystemDirectory({
  Domain: 'SysMenu',
  Action: action,
  Param: V8.Param
});
