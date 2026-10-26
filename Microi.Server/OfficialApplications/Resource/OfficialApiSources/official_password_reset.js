/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：official_password_reset
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: official_password_reset
 * Version: v1.0.1
 * Function:
 * - 官网短信验证码重置登录密码的参数兼容与请求语言转发；验证码消费、密码哈希双字段写入和会话撤销由固定可信原子完成。
 */

// 只做传输兼容，不读取密码材料、不自行加密、不信任客户端指定的其它租户。
var resetParam = V8.Param || {};
var resetLang = String(resetParam._Lang || (V8.Header && (V8.Header.lang || V8.Header.Lang)) || 'cn').trim();
var requestedTenant = String(resetParam.OsClient || '').trim();
if (requestedTenant && requestedTenant.toLowerCase() !== String(V8.OsClient).toLowerCase()) {
  return { Code: 0, Msg: V8.TranslateEngine.GetLang('NoAuth', resetLang), Data: null };
}

return V8.Method.ResetPlatformSmsPassword({
  Phone: resetParam.Phone,
  SmsCode: resetParam.SmsCode || resetParam._SmsCaptchaValue,
  NewPassword: resetParam.NewPassword === undefined ? resetParam.Pwd : resetParam.NewPassword,
  ConfirmPassword: resetParam.ConfirmPassword === undefined ? resetParam.ConfirmPwd : resetParam.ConfirmPassword,
  _Lang: resetLang
});
