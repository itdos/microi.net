/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_complete_login
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_complete_login
 * Version: v1.0.3
 * Function:
 * - 编排一次性 SSO 登录票据消费与 DiyToken 签发；原子消费和签发由可信 V8.Method 能力完成。
 */

var result = V8.Method.CompleteSsoLogin({
  Ticket: V8.Param ? V8.Param.Ticket : '',
  Did: V8.Param ? V8.Param.Did : '',
  ClientType: V8.Param ? (V8.Param._ClientType || V8.Param.ClientType) : 'PC'
});
if (!result || result.Code !== 1 || !result.Data) return result || { Code: 0, Msg: 'SSO 登录未返回结果。' };

try {
  var append = result.DataAppend || {};
  V8.ApiEngine.Run('sso_protocol_event', {
    _TrustedSsoProtocol: true,
    Action: 'SsoLogin',
    UserId: result.Data.Id || '',
    ConnectionKey: append.ConnectionKey || '',
    Protocol: append.Protocol || '',
    Success: true,
    Reason: '',
    OccurredAt: DateNow('yyyy-MM-dd HH:mm:ss')
  });
} catch (ex) {
  console.log('sso_complete_login audit failed: ' + ex.message);
}
return result;
