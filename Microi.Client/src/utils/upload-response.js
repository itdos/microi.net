// zhy：这些字段只服务于本次上传后的即时访问，禁止持久化进业务字段。
const TRANSIENT_UPLOAD_FIELDS = [
    'Url',
    'url',
    'FileUrl',
    'PreviewUrl',
    'FullPath',
    'Limit'
];

// zhy：兼容接口和历史配置中的布尔值及字符串布尔值。
function parseBoolean(value) {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    return undefined;
}

// zhy：服务端可能因安全策略强制私有，必须优先采用响应中的实际 Limit。
export function resolveUploadLimit(responseData, configuredLimit) {
    const responseLimit = parseBoolean(responseData && responseData.Limit);
    if (responseLimit !== undefined) return responseLimit;
    return parseBoolean(configuredLimit) === true;
}

// zhy：仅提取服务端为本次上传签发的短期预览地址。
export function getUploadPreviewUrl(responseData) {
    if (!responseData || typeof responseData !== 'object') return '';
    const value = responseData.Url
        || responseData.url
        || responseData.FileUrl
        || responseData.PreviewUrl;
    return typeof value === 'string' ? value.trim() : '';
}

// zhy：复制并清理上传元数据，确保调用方不会修改响应对象或保存临时能力字段。
export function sanitizeUploadMeta(responseData) {
    const metadata = responseData && typeof responseData === 'object'
        ? { ...responseData }
        : {};
    TRANSIENT_UPLOAD_FIELDS.forEach(fieldName => delete metadata[fieldName]);
    return metadata;
}
