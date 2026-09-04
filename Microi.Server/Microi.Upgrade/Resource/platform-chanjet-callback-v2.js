/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-chanjet-callback-v2
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 个性化凭据落库与通知逻辑只能写入 platform-chanjet-callback-v2-hook。
 */

/* V8 ApiEngine | ApiEngineKey: platform-chanjet-callback-v2 | Version: v1.0.0 */
/* Security metadata: StopHttp=1, AllowAnonymous=0, EnableLog=0 */

function text(value, maxLength) {
  var result = String(value === null || value === undefined ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  return result.length <= maxLength ? result : '';
}

function fail(message) {
  return { Code: 0, Msg: message };
}

var trust = V8.Method.RequireManagedProtocolContext();
if (!trust || Number(trust.Code) !== 1) {
  return trust || fail('畅捷通回调可信协议上下文无效。');
}

var param = V8.Param || {};
if (text(param.Action, 64) !== 'ReceiveChanjetCallbackV2') {
  return fail('不支持的畅捷通回调动作。');
}

var messageId = text(param.MessageId, 128);
var appKey = text(param.AppKey, 128);
var messageType = text(param.MessageType, 64);
var messageTime = text(param.MessageTime, 64);
if (!messageId || !appKey || !/^[A-Z0-9_]{2,64}$/.test(messageType)) {
  return fail('畅捷通回调参数无效。');
}

var bizContent = param.BizContent === null || param.BizContent === undefined
  ? null
  : param.BizContent;
var serializedContent;
try {
  serializedContent = JSON.stringify(bizContent);
} catch (error) {
  return fail('畅捷通回调业务内容格式无效。');
}
if (serializedContent.length > 131072) {
  return fail('畅捷通回调业务内容超出允许长度。');
}

var hookResult = V8.ApiEngine.Run('platform-chanjet-callback-v2-hook', {
  Stage: 'Receive',
  SourceApiEngineKey: 'platform-chanjet-callback-v2',
  MessageId: messageId,
  AppKey: appKey,
  MessageType: messageType,
  MessageTime: messageTime,
  BizContent: bizContent
}, V8.DbTrans);
if (!hookResult || Number(hookResult.Code) !== 1) {
  return hookResult || fail('畅捷通回调扩展未返回结果。');
}

return {
  Code: 1,
  Data: {
    MessageId: messageId,
    MessageType: messageType,
    Accepted: true
  },
  Msg: '畅捷通回调已处理。'
};
