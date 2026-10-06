/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-service-health
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-service-health | Version: v1.0.1 */

// 固定匿名健康契约只证明当前 API、接口引擎与 V8 原子能力可正常执行；
// 不查询业务表、不调用租户 Hook，也不把任一业务接口的成败当作全局健康信号。
// 应用包可能先于后端二进制完成滚动发布。此时版本原子暂不可用不能反过来
// 破坏健康契约；待新二进制上线后，同一接口会自动补齐真实版本。
var backendVersion = '';
try {
  backendVersion = V8.Method.GetBackendVersion();
} catch (versionError) {
  backendVersion = '';
}

return {
  Code: 1,
  Data: {
    Status: 'Healthy',
    BackendVersion: backendVersion,
    HealthContract: 'platform-service-health/v1',
    CheckedAt: DateNow('yyyy-MM-dd HH:mm:ss')
  }
};
