/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_rotate_client_secret
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_rotate_client_secret
 * Version: v1.0.3
 * Function:
 * - 平台管理员轮换吾码作为 OIDC Provider 时的客户端密钥；明文只返回一次。
 */

var result = V8.Method.RotateSsoClientSecret({
  ConnectionKey: V8.Param ? V8.Param.ConnectionKey : ''
});
if (!result || result.Code !== 1) return result || { Code: 0, Msg: 'OIDC 客户端密钥轮换失败。' };

try {
  V8.ApiEngine.Run('sso_protocol_event', {
    _TrustedSsoProtocol: true,
    Action: 'RotateSsoClientSecret',
    UserId: V8.CurrentUser && V8.CurrentUser.Id ? V8.CurrentUser.Id : '',
    ConnectionKey: V8.Param.ConnectionKey || '',
    Protocol: 'OIDC',
    Success: true,
    Reason: '',
    OccurredAt: DateNow('yyyy-MM-dd HH:mm:ss')
  });
} catch (ex) {
  console.log('sso_rotate_client_secret audit failed: ' + ex.message);
}
return result;
