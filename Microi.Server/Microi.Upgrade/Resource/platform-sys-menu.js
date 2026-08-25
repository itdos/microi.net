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
