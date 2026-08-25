/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-wechat-user-binding
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-wechat-user-binding | Version: v1.0.0 */
/* Security metadata: StopHttp=1, AllowAnonymous=0, Lock=1（阻止并发 OpenId 双绑） */

var param = V8.Param || {};

function text(value, maxLength) {
  var result = String(value === null || typeof value === 'undefined' ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  return result.length <= maxLength ? result : result.substring(0, maxLength);
}

function fail(message) {
  return { Code: 0, Msg: message };
}

if (String(param.Action || '').trim() !== 'Bind') return fail('不支持的微信用户绑定动作。');
var protocolContext = V8.Method.RequireManagedProtocolContext();
if (!protocolContext || protocolContext.Code !== 1) {
  return protocolContext || fail('微信 OAuth 协议上下文无效。');
}

var userId = text(param.TrustedUserId, 100);
var wxMpId = text(param.WxMpId, 100);
var openId = text(param.WxOpenId, 200);
if (!userId || !wxMpId || !openId) return fail('微信用户绑定参数无效。');

var userResult = V8.FormEngine.GetFormData('sys_user', {
  Id: userId,
  _Where: [['State', '=', 1], ['IsDeleted', '=', 0]],
  _SelectFields: ['Id', 'WxMpId']
});
if (!userResult) return fail('用户读取失败。');
if (userResult.Code !== 1) {
  if (userResult.Code !== 2) return userResult;
  return fail('用户不存在或已被停用。');
}
if (!userResult.Data) return fail('用户读取失败。');
if (text(userResult.Data.WxMpId, 100).toLowerCase() !== wxMpId.toLowerCase()) {
  return fail('用户所属公众号已变更，请重新发起绑定。');
}

var duplicateResult = V8.FormEngine.GetFormData('sys_user', {
  _Where: [
    ['WxMpId', '=', wxMpId],
    ['WxOpenId', '=', openId],
    ['State', '=', 1],
    ['IsDeleted', '=', 0]
  ],
  _SelectFields: ['Id']
});
if (!duplicateResult) return fail('微信身份绑定关系读取失败。');
if (duplicateResult.Code !== 1 && duplicateResult.Code !== 2) return duplicateResult;
if (duplicateResult.Code === 1 && !duplicateResult.Data) return fail('微信身份绑定关系读取失败。');
if (duplicateResult && duplicateResult.Code === 1 && duplicateResult.Data
    && text(duplicateResult.Data.Id, 100).toLowerCase() !== userId.toLowerCase()) {
  return fail('该微信身份已绑定其它吾码账号。');
}

var beforeHook = V8.ApiEngine.Run('platform-runtime-custom-hook', {
  Stage: 'BeforeWeChatUserBinding',
  SourceApiEngineKey: 'platform-wechat-user-binding',
  Action: 'Bind',
  UserId: userId,
  WxMpId: wxMpId
}, V8.DbTrans);
if (!beforeHook || beforeHook.Code !== 1) {
  return beforeHook || fail('平台运行时个性化 Hook 未返回结果。');
}

var saveResult = V8.FormEngine.UptFormData('sys_user', {
  Id: userId,
  WxOpenId: openId,
  WxAvatar: text(param.WxAvatar, 1000),
  WxNickName: text(param.WxNickName, 200)
});
if (!saveResult || saveResult.Code !== 1) return saveResult || fail('微信用户绑定保存失败。');
var afterHook = V8.ApiEngine.Run('platform-runtime-custom-hook', {
  Stage: 'AfterWeChatUserBinding',
  SourceApiEngineKey: 'platform-wechat-user-binding',
  Action: 'Bind',
  UserId: userId,
  WxMpId: wxMpId
}, V8.DbTrans);
if (!afterHook || afterHook.Code !== 1) {
  return afterHook || fail('平台运行时个性化 Hook 未返回结果。');
}
return { Code: 1, Data: { UserId: userId, WxMpId: wxMpId }, Msg: '绑定成功。' };
