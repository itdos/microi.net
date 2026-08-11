/*
 * V8 ApiEngine
 * ApiEngineKey: mci-wechat-content-callback-core
 * Version: v1.0.0
 * Ownership: Application / Managed
 *
 * C# 网关只完成微信签名、AES 解密和 AppId 校验；本接口负责业务状态、日志与租户 Hook。
 */

function text(value) {
    return value === null || value === undefined ? '' : String(value);
}
function parseObject(value) {
    if (!value) return null;
    if (typeof value == 'object') return value;
    try { return JSON.parse(String(value)); } catch (error) { return null; }
}
function isHex(value, length) {
    return text(value).length == length && new RegExp('^[a-fA-F0-9]{' + length + '}$').test(text(value));
}
function safeTraceId(value) {
    var traceId = text(value);
    return traceId.length > 0 && traceId.length <= 128 && /^[A-Za-z0-9_-]+$/.test(traceId);
}

var tenant = text(V8.Param.OsClient);
var eventId = text(V8.Param.EventId).toLowerCase();
var traceId = text(V8.Param.TraceId);
var status = text(V8.Param.Status);
var suggest = text(V8.Param.Suggest);
var receivedAtUtc = text(V8.Param.ReceivedAtUtc);
var lifetimeSeconds = parseInt(V8.Param.ReviewLifetimeSeconds || 172800, 10);
lifetimeSeconds = Math.max(3600, Math.min(172800, isNaN(lifetimeSeconds) ? 172800 : lifetimeSeconds));

if (!tenant || tenant.toLowerCase() != text(V8.OsClient).toLowerCase()) {
    return { Code: 0, Msg: '回调租户与接口引擎运行租户不一致。' };
}
if (!isHex(eventId, 64) || !safeTraceId(traceId)) {
    return { Code: 0, Msg: '回调事件标识不合法。' };
}
if (status != 'Passed' && status != 'Rejected') {
    return { Code: 0, Msg: '回调审核状态不受支持。' };
}
if ((status == 'Passed' && suggest != 'pass') || (status == 'Rejected' && suggest != 'blocked')) {
    return { Code: 0, Msg: '回调审核建议与状态不一致。' };
}

var prefix = 'Microi:' + tenant + ':WechatContentSecurity:';
var eventKey = prefix + 'CallbackEvent:' + eventId;
if (V8.Cache.Get(eventKey)) {
    return { Code: 1, Data: { EventId: eventId, Duplicate: true }, Msg: '重复回调已幂等忽略。' };
}

var traceKey = prefix + 'Trace:' + traceId;
var reviewId = text(V8.Cache.Get(traceKey));
var isEarlyResult = !isHex(reviewId, 32);
if (isEarlyResult) {
    V8.Cache.Set(prefix + 'TraceResult:' + traceId, status, lifetimeSeconds);
    reviewId = '';
} else {
    var reviewKey = prefix + 'Review:' + reviewId;
    var review = parseObject(V8.Cache.Get(reviewKey));
    if (review) {
        var currentStatus = text(review.Status);
        if (currentStatus != 'Passed' && currentStatus != 'Rejected') {
            review.Status = status;
            review.Suggest = suggest;
            review.UpdatedAt = receivedAtUtc || DateNow('yyyy-MM-ddTHH:mm:ss.fffZ');
            V8.Cache.Set(reviewKey, JSON.stringify(review), lifetimeSeconds);
        }
    }
}

var hookPayload = {
    OsClient: tenant,
    EventId: eventId,
    TraceId: traceId,
    ReviewId: reviewId,
    Status: status,
    Suggest: suggest,
    ReceivedAtUtc: receivedAtUtc,
    IsEarlyResult: isEarlyResult
};
var hookError = '';
try {
    var hookModel = V8.FormEngine.GetFormData('sys_apiengine', {
        _Where: [['ApiEngineKey', '=', 'mci-wechat-content-callback-extension']],
        _SelectFields: ['Id', 'ApiEngineKey', 'IsEnable', 'IsDeleted'],
        _PageSize: 1
    });
    if (hookModel && hookModel.Code == 1 && hookModel.Data
        && Number(hookModel.Data.IsEnable || 0) == 1 && Number(hookModel.Data.IsDeleted || 0) != 1) {
        var hookResult = V8.ApiEngine.Run('mci-wechat-content-callback-extension', hookPayload);
        if (hookResult && hookResult.Code !== undefined && Number(hookResult.Code) != 1) {
            hookError = text(hookResult.Msg || '租户扩展返回失败');
        }
    }
} catch (hookException) {
    hookError = text(hookException && hookException.message || hookException);
}

V8.Method.AddSysLog({
    Type: 'ContentSecurity',
    Title: hookError ? 'WeChatMediaReviewHookFailed' : 'WeChatMediaReviewCompleted',
    Content: JSON.stringify({
        EventId: eventId,
        TraceId: traceId,
        ReviewId: reviewId,
        Status: status,
        IsEarlyResult: isEarlyResult,
        HookError: hookError ? hookError.substring(0, 500) : ''
    }),
    Level: hookError ? 2 : (status == 'Passed' ? 1 : 2)
});

// 只有核心状态与日志完成后才写幂等标记。Hook 失败已单独记录，不阻塞微信 ACK。
V8.Cache.Set(eventKey, '1', lifetimeSeconds);
return {
    Code: 1,
    Data: {
        EventId: eventId,
        ReviewId: reviewId,
        Status: status,
        IsEarlyResult: isEarlyResult,
        HookSucceeded: !hookError
    }
};
