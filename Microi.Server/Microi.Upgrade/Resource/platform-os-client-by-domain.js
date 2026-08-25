/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-os-client-by-domain
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-os-client-by-domain | Version: v1.0.0 */

// 匿名启动接口禁止调用租户可编辑 Hook，避免匿名请求触发写表、通知或外呼副作用。
return V8.Method.ResolveOsClientByDomain(V8.Param ? V8.Param.Domain : '');
