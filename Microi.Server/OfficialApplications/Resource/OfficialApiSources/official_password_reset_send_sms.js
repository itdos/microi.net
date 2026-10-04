/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：official_password_reset_send_sms
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: official_password_reset_send_sms
 * Version: v1.0.5
 * Function:
 * - 官网找回密码短信发送；复用单次图形验证码校验和限流入口，统一返回防止枚举账号。
 */

var actualTenant = String(V8.OsClient || '').trim();
var requestedTenant = String(V8.Param.OsClient || '').trim();
if (!actualTenant || (requestedTenant && requestedTenant.toLowerCase() !== actualTenant.toLowerCase())) {
  return { Code: 0, Msg: '禁止跨租户发送验证码。', Data: null };
}
return V8.ApiEngine.Run('send-sms-reg', {
  Phone: V8.Param.Phone,
  _CaptchaId: V8.Param._CaptchaId,
  _CaptchaValue: V8.Param._CaptchaValue,
  OsClient: actualTenant,
  Purpose: 'PasswordReset'
});
