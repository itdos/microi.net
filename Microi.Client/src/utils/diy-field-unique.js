export const DIY_FIELD_UNIQUE_MODE = Object.freeze({
    ALONE: "Alone",
    ALL: "All"
});

export function normalizeDiyFieldUniqueMode(value) {
    return String(value || "").trim().toLowerCase() === "all"
        ? DIY_FIELD_UNIQUE_MODE.ALL
        : DIY_FIELD_UNIQUE_MODE.ALONE;
}

export function isDiyFieldUniqueEnabled(field) {
    if (!field) return false;
    var value = field.Unique;
    if (value === true || value === 1) return true;
    var normalized = String(value == null ? "" : value).trim().toLowerCase();
    return normalized === "1" || normalized === "true";
}

/**
 * 兼容历史字段：设计器加载到 Config 为空、JSON 字符串或缺少 Unique 节点时，
 * 都补齐为可编辑的标准结构，避免唯一方式在保存时退化。
 */
export function ensureDiyFieldUniqueConfig(field) {
    if (!field || typeof field !== "object") return null;

    var config = field.Config;
    if (typeof config === "string") {
        try {
            config = config.trim() ? JSON.parse(config) : {};
        } catch (_error) {
            config = {};
        }
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        config = {};
    }

    var uniqueConfig = config.Unique;
    if (!uniqueConfig || typeof uniqueConfig !== "object" || Array.isArray(uniqueConfig)) {
        uniqueConfig = {};
    }
    uniqueConfig.Type = normalizeDiyFieldUniqueMode(uniqueConfig.Type);
    config.Unique = uniqueConfig;
    field.Config = config;
    return uniqueConfig;
}
