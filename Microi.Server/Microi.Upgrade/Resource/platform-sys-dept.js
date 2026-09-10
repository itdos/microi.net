/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-sys-dept
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-sys-dept
 * Version: v1.0.2
 * Function:
 * - 当前租户组织机构目录。现代接口通过 Action 调用既有查询或管理员写入原子；旧 /api/SysDept/GetSysDeptStep 支持无需 Action 的 GET/POST，只返回保留组织范围和 _Child 的部门树。身份来自 DiyToken，历史路径不能被请求参数改为写操作。
 */

// Microi官方接口引擎：platform-sys-dept
// Version: v1.0.1
// 组织机构业务编排由应用商城交付；C# 原子层固定当前租户与管理员写权限。
if (!V8.CurrentUser || !V8.CurrentUser.Id) return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
var param = V8.Param || {};
var path = String(param._RequestPath || param.ApiAddress || '').split('?')[0]
  .replace(/--OsClient--[^/]*--$/i, '').toLowerCase();
// 旧客户端只传 Sys_Dept，无 Action。可信请求路径固定为读树，不能用请求中的 Action 改成写操作。
var requested = path === '/api/sysdept/getsysdeptstep'
  ? 'getsysdeptstep' : String(param.Action || '').trim().toLowerCase();
var allowed = ['AddSysDept', 'DelSysDept', 'UptSysDept', 'GetSysDept', 'GetSysDeptModel', 'GetSysDeptStep'];
var action = '';
for (var i = 0; i < allowed.length; i++) {
  if (allowed[i].toLowerCase() === requested) { action = allowed[i]; break; }
}
if (!action) return { Code: 0, Msg: '不支持的组织机构动作。' };
return V8.Method.ManageSystemDirectory({
  Domain: 'SysDept',
  Action: action,
  Param: V8.Param
});
