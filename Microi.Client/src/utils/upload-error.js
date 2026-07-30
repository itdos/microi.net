const REQUEST_TOO_LARGE_MARKERS = [
    'content too large',
    'request entity too large',
    'payload too large',
    'request body too large',
    'multipart body length limit'
];

function parsePayload(payload) {
    if (!payload) return null;
    if (typeof payload === 'object') return payload;
    if (typeof payload !== 'string') return null;
    try {
        return JSON.parse(payload);
    } catch (_) {
        return null;
    }
}

function getResponsePayload(error) {
    const response = error && error.response;
    return parsePayload(response && response.data)
        || parsePayload(response)
        || parsePayload(error && error.data);
}

function containsRequestTooLargeMarker(value) {
    const text = String(value || '').toLowerCase();
    return REQUEST_TOO_LARGE_MARKERS.some(marker => text.includes(marker));
}

export function isUploadRequestTooLarge(error) {
    const status = Number(
        (error && error.status)
        || (error && error.statusCode)
        || (error && error.response && error.response.status)
        || 0
    );
    if (status === 413) return true;

    const payload = getResponsePayload(error);
    return containsRequestTooLargeMarker(error && error.message)
        || containsRequestTooLargeMarker(payload && (payload.Msg || payload.Message));
}

export function getUploadErrorMessage(error, file) {
    const payload = getResponsePayload(error);
    const serverMessage = payload && (payload.Msg || payload.Message);
    if (serverMessage) return String(serverMessage);

    const status = Number(
        (error && error.status)
        || (error && error.statusCode)
        || (error && error.response && error.response.status)
        || 0
    );
    const fileSizeMb = file && Number(file.size) > 0
        ? (Number(file.size) / 1024 / 1024).toFixed(1)
        : '';
    const fileSizeText = fileSizeMb ? ` 当前文件约 ${fileSizeMb}MB。` : '';

    if (isUploadRequestTooLarge(error)) {
        return `上传失败（HTTP 413）：请求在进入吾码 HDFS 业务校验前已被反向代理或 API 接收层拒绝。${fileSizeText}`
            + 'SaaS 引擎中的单文件上限和单次总量只负责租户业务额度，不能放大 nginx/Kestrel/Multipart 上限。'
            + '请运维提高 nginx client_max_body_size；吾码 API 使用统一的 2048MB 接收硬顶。';
    }

    if (status > 0) {
        return `文件上传失败（HTTP ${status}）。请检查网关/API 日志与上传安全配置后重试。`;
    }

    return '文件上传失败：浏览器未能读取网关或 API 的有效响应。请检查网络、跨域配置以及反向代理日志后重试。';
}
