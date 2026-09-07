/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-tenant-runtime-registration
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-tenant-runtime-registration | Version: v1.0.0 */
var p = V8.Param || {};
if (!V8.CurrentUser || Number(V8.CurrentUser.Level || 0) < 9999) {
  return { Code: 1002, Msg: '仅主租户超级管理员可以检查或恢复租户运行登记。' };
}
var tenantKey = String(p.TenantKey || '').trim();
var network = String(p.TargetNetwork || '').trim();
if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(tenantKey) || !/^[A-Za-z][A-Za-z0-9_.-]{0,49}$/.test(network)) {
  return { Code: 0, Msg: '请提供有效的 TenantKey 和 TargetNetwork。' };
}
var apply = p.Apply === true;
var confirmation = 'REGISTER:' + tenantKey + ':' + network;
if (apply && String(p.Confirm || '') !== confirmation) {
  return { Code: 0, Msg: '请先检查运行登记，再传入精确确认串：' + confirmation };
}
// C# 原子重新验证真实主租户管理员、来源归属、目标分区和幂等条件；
// 数据库与密码始终留在后端，接口不接受或返回任何连接材料。
var result;
try {
  result = V8.Method.EnsureOwnedTenantRuntimeRegistration({ TenantKey: tenantKey, TargetNetwork: network, Apply: apply });
} catch (error) {
  return { Code: 0, Msg: '当前后端尚不支持租户运行登记恢复，请先更新平台后端再重试。' };
}
if (apply && result && result.Code === 1) {
  try {
    V8.Method.AddSysLog({ Type: 'SaaS', Title: '补齐自助租户运行登记',
      Content: JSON.stringify({ TenantKey: tenantKey, TargetNetwork: network, Changed: !!(result.Data && result.Data.Changed) }) });
  } catch (auditError) { /* 登记已提交；审计失败不能把结果改成失败并诱导重复执行。 */ }
}
return result;
