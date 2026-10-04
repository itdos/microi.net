/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SSO 身份联邦
 * ApiEngineKey：sso_http_saml_begin
 * 从可信吾码官方应用源安装、更新或重新安装“SSO 身份联邦”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: sso_http_saml_begin
 * Version: v1.0.3
 * Function: SAML 外部登录发起；通过通用 HTTP 响应契约返回协议要求的状态码、响应头与正文。
 */

return V8.Method.RunSsoProtocol({
  Operation: 'SamlBegin',
  Param: V8.Param
});
