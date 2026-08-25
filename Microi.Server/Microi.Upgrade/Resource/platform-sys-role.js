/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-sys-role
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

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
