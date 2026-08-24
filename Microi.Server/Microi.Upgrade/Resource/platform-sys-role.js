// Microi官方接口引擎：platform-sys-role
// Version: v1.0.0
// 角色目录业务编排由应用商城交付；非管理员列表仍服从 sys_user 表权限与可分配角色范围。
var action = String((V8.Param && V8.Param.Action) || '').trim();
var allowed = {
  AddSysRole: 1,
  DelSysRole: 1,
  UptSysRole: 1,
  GetSysRole: 1,
  GetSysRoleModel: 1,
  GetSysRoleStep: 1,
  GetDirectTableGrantPolicies: 1
};
if (!allowed[action]) return { Code: 0, Msg: '不支持的角色动作。' };
return V8.Method.ManageSystemDirectory({
  Domain: 'SysRole',
  Action: action,
  Param: V8.Param
});
