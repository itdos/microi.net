/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-sys-config
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-sys-config | Version: v1.1.0 */

// 匿名启动接口禁止调用租户可编辑 Hook，避免匿名请求触发写表、通知或外呼副作用。
// PUBLIC_SYS_CONFIG_ORCHESTRATION_V2
// 读取、失败分类、响应字段组装均在此维护；C# 只守住秘密投影、公钥和授权版本原子。
var lang = String((V8.Param || {})._Lang || '').slice(0, 32);
function unavailable(source) {
  var detail = String(source && source.Msg || '').slice(0, 16384);
  var rules = [
    ['DatabaseHostInvalid', /DatabaseHostInvalid|host name or IP address is invalid|name or service not known|no such host|getaddrinfo/i,
      '数据库服务器地址无效或无法解析。', '请检查 SaaS 数据库及只读连接的主机名，确认当前后端容器可以解析。'],
    ['DatabaseCredentialsRejected', /DatabaseCredentialsRejected|access denied for user|authentication failed/i,
      '数据库账号验证失败。', '请在主租户 SaaS 配置中核对账号、密码与目标库授权。'],
    ['DatabaseNotFound', /DatabaseNotFound|unknown database|database does not exist/i,
      '目标数据库不存在。', '请核对数据库名称及初始化状态。'],
    ['DatabaseCapacityExceeded', /DatabaseCapacityExceeded|too many connections|max_user_connections|blocked because of many connection errors/i,
      '数据库连接容量不足或主机被阻断。', '请先恢复数据库容量或主机访问状态，避免反复刷新。'],
    ['DatabaseEndpointUnreachable', /DatabaseEndpointUnreachable|unable to connect|connection refused|connection timed out|timeout expired/i,
      '后端无法连接数据库。', '请检查地址、端口、容器网络、防火墙及数据库服务状态。']
  ];
  var rule = null;
  for (var i = 0; i < rules.length; i++) if (rules[i][1].test(detail)) { rule = rules[i]; break; }
  var retry = /Retry\s+after\s+(\d{1,6})\s+seconds/i.exec(detail);
  var seconds = retry ? Math.min(86400, Number(retry[1])) : 0;
  // 原始异常可能包含连接串/密码；只返回固定分类和建议，不复制 DataAppend。
  return { Code: 0, Data: null,
    Msg: rule ? rule[2] + ' ' + rule[3] : '系统设置读取失败，请检查租户初始化状态后刷新重试。',
    DataAppend: { ErrorType: rule ? 'TenantDatabaseConnection' : 'PlatformBootstrap',
      ErrorCode: rule ? rule[0] : 'SystemConfigurationUnavailable', RetryAfterSeconds: seconds,
      RecoverySuggestion: rule ? rule[3] : '请检查租户初始化状态与后端日志；勿公开含密码的连接串。' } };
}
try {
  var projection;
  if (typeof V8.Method.ProjectPublicSysConfig === 'function') {
    var source = await V8.FormEngine.GetSysConfig(V8.OsClient, lang);
    if (!source || source.Code !== 1 || !source.Data) return unavailable(source);
    projection = V8.Method.ProjectPublicSysConfig(source.Data);
    if (!projection || projection.Code !== 1 || !projection.Data) return unavailable(projection);
    projection.Data.PlatformEdition = V8.Method.GetPlatformEdition();
    var publicKey = V8.Method.GetLoginEncryptionPublicKey();
    if (publicKey) projection.Data.LoginRsaPublicKey = publicKey;
  } else {
    // 仅供先更新应用包、后更新二进制的滚动窗口；不得回传原始 V8.SysConfig。
    // 新宿主始终走上方原子链；运行失败不能降级调用旧门面。
    projection = V8.Method.GetPublicSysConfig(lang);
  }
  if (!projection || projection.Code !== 1 || !projection.Data) return unavailable(projection);
  return { Code: 1, Data: projection.Data, Msg: '', DataAppend: null };
} catch (error) {
  return unavailable({ Msg: String(error && error.message || '') });
}
