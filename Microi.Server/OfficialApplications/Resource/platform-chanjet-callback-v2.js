/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：platform-chanjet-callback-v2
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* V8 ApiEngine | ApiEngineKey: platform-chanjet-callback-v2 | Version: v1.0.1 */
/* Security metadata: StopHttp=0, AllowAnonymous=1, EnableLog=0, ResponseType=HTTP */

function response(code, statusCode, body, retryAfter) {
  var headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };
  if (retryAfter) headers['Retry-After'] = retryAfter;
  return {
    Code: code,
    Msg: code === 1 ? '畅捷通回调已处理。' : '畅捷通回调未处理。',
    DataAppend: {
      HttpResponse: {
        StatusCode: statusCode,
        ContentType: 'application/json; charset=utf-8',
        Body: body,
        Headers: headers
      }
    }
  };
}

function reject(statusCode) {
  return response(0, statusCode, '{"result":"fail"}', '');
}

var param = V8.Param || {};
if (String(param._HttpMethod || '').toUpperCase() !== 'POST') {
  return reject(405);
}

var encryptedMessage = param.encryptMsg;
if (typeof encryptedMessage !== 'string'
    || !encryptedMessage
    || encryptedMessage.length > 393216) {
  return reject(400);
}

if (!V8.Method || typeof V8.Method.DecodeChanjetCallbackV2 !== 'function') {
  return response(0, 503, '{"result":"retry"}', '30');
}

var decoded = V8.Method.DecodeChanjetCallbackV2({
  EncryptedMessage: encryptedMessage
});
if (!decoded || Number(decoded.Code) !== 1 || !decoded.Data) {
  var failureKind = decoded && decoded.DataAppend
    ? String(decoded.DataAppend.FailureKind || '')
    : '';
  return failureKind === 'Disabled'
    ? reject(404)
    : reject(400);
}

var message = decoded.Data;
var hookResult = V8.ApiEngine.Run('platform-chanjet-callback-v2-hook', {
  Stage: 'Receive',
  SourceApiEngineKey: 'platform-chanjet-callback-v2',
  MessageId: message.MessageId,
  AppKey: message.AppKey,
  MessageType: message.MessageType,
  MessageTime: message.MessageTime,
  BizContent: message.BizContent
}, V8.DbTrans);
if (!hookResult || Number(hookResult.Code) !== 1) {
  // Code=0 使当前接口引擎事务回滚，并用 503 要求上游稍后重试。
  return response(0, 503, '{"result":"retry"}', '30');
}

return response(1, 200, '{"result":"success"}', '');
