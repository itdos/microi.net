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
