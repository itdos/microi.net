/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-saas-public-trial-worker
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-saas-public-trial-worker
 * Version: v1.0.3
 * Function:
 * - 仅有效持久任务租约与栅栏令牌可消费加密开通授权，执行标准空库开通；禁止直接HTTP调用。
 */

return V8.Method.ProvisionPublicSaasTrial({ GrantCipher:V8.Param.GrantCipher });
