/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【官方应用托管接口，请勿承载个性化代码】所属官方应用：SaaS引擎
 * ApiEngineKey: platform-saas-public-trial-worker; Managed; Version: v1.0.0
 * 仅持久任务的租约执行上下文可消费开通能力票据；StopHttp=1。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-saas-public-trial-worker
 * Version: v1.0.2
 * Function:
 * - 仅有效持久任务租约与栅栏令牌可消费加密开通授权，执行标准空库开通；禁止直接HTTP调用。
 */

return V8.Method.ProvisionPublicSaasTrial({ GrantCipher:V8.Param.GrantCipher });
