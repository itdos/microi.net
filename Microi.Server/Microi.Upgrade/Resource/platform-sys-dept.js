/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-sys-dept
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

// Microi官方接口引擎：platform-sys-dept
// Version: v1.0.0
// 组织机构业务编排由应用商城交付；C# 原子层固定当前租户与管理员写权限。
var action = String((V8.Param && V8.Param.Action) || '').trim();
var allowed = {
  AddSysDept: 1,
  DelSysDept: 1,
  UptSysDept: 1,
  GetSysDept: 1,
  GetSysDeptModel: 1,
  GetSysDeptStep: 1
};
if (!allowed[action]) return { Code: 0, Msg: '不支持的组织机构动作。' };
return V8.Method.ManageSystemDirectory({
  Domain: 'SysDept',
  Action: action,
  Param: V8.Param
});
