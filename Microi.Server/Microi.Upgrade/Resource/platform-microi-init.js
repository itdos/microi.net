/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：microi-init
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: microi-init | Version: v2.0.2 */

// 旧版 UniApp 一次性初始化兼容门面。匿名阶段只允许公开租户发现与公开系统设置；
// 用户和菜单仅在原始 DiyToken 经后端重新验证且与当前租户一致后返回。
var param = V8.Param || {};

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function equalsIgnoreCase(left, right) {
  return text(left).toLowerCase() === text(right).toLowerCase();
}

function resultData(result) {
  return result && result.Data ? result.Data : {};
}

function safeCurrentUserProjection(value) {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (typeof value.length === 'number') {
    var list = [];
    for (var i = 0; i < value.length; i++) list.push(safeCurrentUserProjection(value[i]));
    return list;
  }
  var secretFields = {
    pwd: true,
    pwdencode: true,
    aiapikey: true,
    newpwd: true,
    _encodepwd: true,
    _encodenewpwd: true,
    _identityverificationticket: true,
    _identityverificationactionhash: true,
    contentsecuritylogincode: true,
    token: true,
    _token: true,
    tokenname: true
  };
  var result = {};
  for (var key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    if (secretFields[text(key).toLowerCase()]) continue;
    result[key] = safeCurrentUserProjection(value[key]);
  }
  return result;
}

var requestOsClient = text(param.OsClient || V8.OsClient);
var osClient = requestOsClient;
if (text(param.Domain)) {
  var domainResult = V8.ApiEngine.Run('platform-os-client-by-domain', {
    Domain: text(param.Domain)
  });
  if (!domainResult || domainResult.Code !== 1) {
    return domainResult || { Code: 0, Msg: '域名租户解析失败。' };
  }
  osClient = text(resultData(domainResult).OsClient);
}
if (!osClient) return { Code: 0, Msg: '未解析到有效租户。' };

// V8 执行上下文已经绑定请求租户。禁止仅凭 Domain/参数把匿名读取切换到其它租户；
// 旧客户端拿到目标 OsClient 后应以该 OsClient 重新发起初始化请求。
if (text(V8.OsClient) && !equalsIgnoreCase(V8.OsClient, osClient)) {
  return {
    Code: 1002,
    Msg: '域名对应租户与当前请求租户不一致，请使用返回的 OsClient 重新初始化。',
    Data: { OsClient: osClient },
    DataAppend: { OsClient: osClient }
  };
}

var sysConfigResult = V8.ApiEngine.Run('platform-sys-config', {
  _Lang: text(param._Lang)
});
if (!sysConfigResult || sysConfigResult.Code !== 1) {
  return sysConfigResult || { Code: 0, Msg: '系统公开设置读取失败。' };
}

var currentUser = {};
var token = {};
var moduleList = [];
var rawToken = text(param.Token);
if (rawToken) {
  var tokenResult = V8.Method.GetCurrentToken(rawToken, osClient);
  if (!tokenResult || !tokenResult.CurrentUser || !tokenResult.CurrentUser.Id) {
    return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
  }
  if (!equalsIgnoreCase(tokenResult.OsClient, osClient)) {
    return { Code: 1002, Msg: '登录身份与当前租户不一致。' };
  }

  var refreshResult = V8.Method.RefreshLoginUser(
    text(tokenResult.CurrentUser.Id),
    osClient,
    rawToken
  );
  if (!refreshResult || refreshResult.Code !== 1) {
    return refreshResult || { Code: 0, Msg: '登录身份刷新失败。' };
  }
  currentUser = safeCurrentUserProjection(refreshResult.Data || tokenResult.CurrentUser);
  token = text(tokenResult.Token || rawToken);

  var menuResult = V8.Method.GetLegacyInitMenuTree(rawToken, osClient);
  if (!menuResult || menuResult.Code !== 1) {
    return menuResult || { Code: 0, Msg: '菜单读取失败。' };
  }
  moduleList.push({ ScreenId: 1, ScreenName: '', List: menuResult.Data || [] });
}

return {
  Code: 1,
  Data: {
    OsClient: osClient,
    SysConfig: resultData(sysConfigResult),
    DateTimeNow: V8.Action.GetDateTimeNow(),
    CurrentUser: currentUser,
    Token: token,
    ModuleList: moduleList
  }
};
