/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-create-tenant
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-create-tenant | Version: v1.0.0 */

if (!V8.CurrentUser || !V8.CurrentUser.Id) {
  return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
}

var param = V8.Param || {};
var tenantKey = String(param.TenantKey || '').trim();
var systemName = String(param.SystemName || '').trim();
if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(tenantKey)) {
  return { Code: 0, Msg: '租户Key必须以英文字母开头，且只能包含英文字母、数字、-、_。' };
}
if (tenantKey.length > 80) return { Code: 0, Msg: '租户Key长度不能超过80个字符。' };
if (systemName.length > 100 || /[\u0000-\u001F\u007F]/.test(systemName)) {
  return { Code: 0, Msg: '系统名称长度不能超过100个字符。' };
}

var authorization = V8.Method.AuthorizeCurrentUserTenantProvisioning();
if (!authorization || authorization.Code !== 1) {
  return authorization || { Code: 0, Msg: '租户开通身份校验失败。' };
}

var beforeHook = V8.ApiEngine.Run('platform-runtime-custom-hook', {
  Stage: 'BeforeCreateTenant',
  SourceApiEngineKey: 'platform-create-tenant',
  TenantKey: tenantKey,
  SystemName: systemName
});
if (!beforeHook || beforeHook.Code !== 1) {
  return beforeHook || { Code: 0, Msg: '平台运行时个性化 Hook 未返回结果。' };
}

// 当前用户、手机号、姓名和密码均由可信原子从 DiyToken/sys_user 派生；
// V8.Param 中的 UserId/Pwd/Phone/AiApiKey 等字段会被忽略。
var result = V8.Method.ProvisionCurrentUserTenant({
  TenantKey: tenantKey,
  SystemName: systemName
});
if (!result || result.Code !== 1) return result || { Code: 0, Msg: '租户创建失败。' };

var afterHook;
try {
  afterHook = V8.ApiEngine.Run('platform-runtime-custom-hook', {
    Stage: 'AfterCreateTenant',
    SourceApiEngineKey: 'platform-create-tenant',
    TenantKey: tenantKey,
    SystemName: systemName
  });
} catch (afterHookError) {
  afterHook = { Code: 0, Msg: '平台运行时个性化 Hook 执行异常。' };
}
if (!afterHook || afterHook.Code !== 1) {
  var hookMessage = afterHook && afterHook.Msg
    ? String(afterHook.Msg)
    : '平台运行时个性化 Hook 未返回结果。';
  if (hookMessage.length > 500) hookMessage = hookMessage.substring(0, 500);
  try {
    V8.Method.AddSysLog({
      OsClient: String(V8.OsClient || ''),
      UserId: String(V8.CurrentUser && V8.CurrentUser.Id || ''),
      Category: 'Security',
      Action: 'AfterCreateTenantHookWarning',
      Source: 'platform-create-tenant',
      Success: false,
      Type: '安全审计',
      Title: '租户已创建但后置个性化 Hook 执行失败',
      Content: JSON.stringify({ TenantKey: tenantKey, HookMessage: hookMessage }),
      Level: 2
    });
  } catch (auditError) {
    // 租户已经创建；审计存储故障不能把不可逆主结果改成失败并诱导重试。
  }
  return {
    Code: 1,
    Data: result.Data,
    DataCount: result.DataCount,
    DataAppend: { HookWarning: hookMessage, OriginalDataAppend: result.DataAppend || null },
    Msg: String(result.Msg || '租户创建成功。') + '（个性化后置 Hook 未完成，请联系管理员查看审计日志。）'
  };
}
return result;
