// Microi官方接口引擎：platform-sys-base-data
// Version: v1.0.0
// 基础数据业务编排由应用商城交付；C# 只保留固定租户、权限与缓存语义的原子能力。
var action = String((V8.Param && V8.Param.Action) || '').trim();
var allowed = {
  AddSysBaseData: 1,
  DelSysBaseData: 1,
  UptSysBaseData: 1,
  GetSysBaseData: 1,
  GetSysBaseData_Biz: 1,
  GetSysBaseDataStep: 1,
  GetSysBaseDataPa: 1
};
if (!allowed[action]) return { Code: 0, Msg: '不支持的基础数据动作。' };
return V8.Method.ManageSystemDirectory({
  Domain: 'SysBaseData',
  Action: action,
  Param: V8.Param
});
