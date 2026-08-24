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

function readDiyFieldConfig(field) {
    if (!field || typeof field !== "object") return {};
    var config = field.Config;
    if (typeof config === "string") {
        try {
            config = config.trim() ? JSON.parse(config) : {};
        } catch (_error) {
            config = {};
        }
    }
    return config && typeof config === "object" && !Array.isArray(config) ? config : {};
}

/**
 * 只读获取唯一方式。导入预览等运行时页面不能为了展示而修改字段 Config。
 */
export function getDiyFieldUniqueMode(field) {
    var config = readDiyFieldConfig(field);
    return normalizeDiyFieldUniqueMode(config.Unique && config.Unique.Type);
}

/**
 * 把字段设计器配置转换成面向用户的唯一规则：每个 Alone 字段是一条独立规则，
 * 所有 All 字段共同组成一条组合规则。服务端导入仍会从权威字段元数据重新计算。
 */
export function buildDiyFieldUniqueRules(fields = []) {
    var uniqueFields = [];
    var seenNames = new Set();
    (Array.isArray(fields) ? fields : []).forEach((field) => {
        if (!isDiyFieldUniqueEnabled(field)) return;
        var name = String(field && field.Name || "").trim();
        if (!name || seenNames.has(name.toLowerCase())) return;
        seenNames.add(name.toLowerCase());
        uniqueFields.push({
            Name: name,
            Label: String(field.Label || name).trim() || name,
            Mode: getDiyFieldUniqueMode(field)
        });
    });

    var rules = uniqueFields
        .filter((field) => field.Mode === DIY_FIELD_UNIQUE_MODE.ALONE)
        .map((field) => ({
            Key: `Alone:${field.Name}`,
            Type: DIY_FIELD_UNIQUE_MODE.ALONE,
            Fields: [{ Name: field.Name, Label: field.Label }]
        }));
    var allFields = uniqueFields
        .filter((field) => field.Mode === DIY_FIELD_UNIQUE_MODE.ALL)
        .map((field) => ({ Name: field.Name, Label: field.Label }));
    if (allFields.length) {
        rules.push({
            Key: `All:${allFields.map((field) => field.Name).join("+")}`,
            Type: DIY_FIELD_UNIQUE_MODE.ALL,
            Fields: allFields
        });
    }
    return rules;
}

/**
 * 兼容历史字段：设计器加载到 Config 为空、JSON 字符串或缺少 Unique 节点时，
 * 都补齐为可编辑的标准结构，避免唯一方式在保存时退化。
 */
export function ensureDiyFieldUniqueConfig(field) {
    if (!field || typeof field !== "object") return null;

    var config = readDiyFieldConfig(field);

    var uniqueConfig = config.Unique;
    if (!uniqueConfig || typeof uniqueConfig !== "object" || Array.isArray(uniqueConfig)) {
        uniqueConfig = {};
    }
    uniqueConfig.Type = normalizeDiyFieldUniqueMode(uniqueConfig.Type);
    config.Unique = uniqueConfig;
    field.Config = config;
    return uniqueConfig;
}
