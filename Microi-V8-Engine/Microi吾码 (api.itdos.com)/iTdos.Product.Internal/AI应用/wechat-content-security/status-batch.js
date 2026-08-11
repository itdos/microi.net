/*
 * V8 ApiEngine
 * ApiEngineKey: mci-wechat-content-status-batch
 * Version: v1.0.0
 * Ownership: Application / Managed
 *
 * 批量读取当前登录用户自己的微信图片审核状态，减少 UniApp 多图场景的轮询请求。
 */

function text(value) {
    return value === null || value === undefined ? '' : String(value);
}
function parseObject(value) {
    if (!value) return null;
    if (typeof value == 'object') return value;
    try { return JSON.parse(String(value)); } catch (error) { return null; }
}
function isReviewId(value) {
    return /^[a-fA-F0-9]{32}$/.test(text(value));
}

// zhy: 状态查询必须依赖接口引擎建立的 DiyToken 当前用户，不能相信客户端传入 UserId。
var currentUserId = text(V8.CurrentUser && V8.CurrentUser.Id);
if (!currentUserId) {
    return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };
}

var source = V8.Param && V8.Param.ReviewIds;
if (!source || typeof source.length != 'number' || source.length < 1 || source.length > 20) {
    return { Code: 0, Msg: '审核记录数量不合法。' };
}

var reviewIds = [];
var seen = {};
for (var i = 0; i < source.length; i++) {
    var reviewId = text(source[i]);
    if (!isReviewId(reviewId)) {
        return { Code: 0, Msg: '审核记录标识不合法。' };
    }
    if (!seen[reviewId]) {
        seen[reviewId] = true;
        reviewIds.push(reviewId);
    }
}

var tenant = text(V8.OsClient);
var prefix = 'Microi:' + tenant + ':WechatContentSecurity:Review:';
var items = [];
var pendingCount = 0;

// zhy: 审核记录保存在按 OsClient 隔离的共享 Redis；逐条校验 UserId，支持回调与查询落在不同 API 节点。
for (var index = 0; index < reviewIds.length; index++) {
    var id = reviewIds[index];
    var review = parseObject(V8.Cache.Get(prefix + id));
    var status = 'Error';
    if (review && text(review.UserId) == currentUserId && text(review.ReviewId) == id) {
        var storedStatus = text(review.Status);
        if (storedStatus == 'Pending' || storedStatus == 'Passed'
            || storedStatus == 'Rejected' || storedStatus == 'Error') {
            status = storedStatus;
        }
    }
    if (status == 'Pending') pendingCount++;
    items.push({ ReviewId: id, Status: status });
}

// zhy: 只返回审核 Id 与归一化状态，不向客户端暴露 OpenId、文件路径、命中标签或微信回调正文。
return {
    Code: 1,
    Data: {
        Items: items,
        PendingCount: pendingCount,
        NextPollAfterMs: pendingCount > 0 ? 1200 : 0
    }
};
