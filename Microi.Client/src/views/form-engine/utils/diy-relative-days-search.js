const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const DEFAULT_MIN_DAYS = 0;
const DEFAULT_MAX_DAYS = 3650;
const SUPPORTED_MODE = "FutureWithin";

function isEnabled(value) {
    return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function parseLimit(value, fallback) {
    if (value === "" || value === null || value === undefined) {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
}

function isSafeFieldName(value) {
    return String(value || "")
        .split(".")
        .every((part) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(part));
}

function getDateParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
    const parts = formatter.formatToParts(date);
    const values = {};
    parts.forEach((part) => {
        if (part.type !== "literal") {
            values[part.type] = part.value;
        }
    });
    return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(dateText, days) {
    const [year, month, day] = dateText.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getRelativeDaysSearchConfig(field) {
    const config = field && field.Config ? field.Config.RelativeDaysSearch : null;
    if (!config || typeof config !== "object" || !isEnabled(config.Enabled)) {
        return null;
    }
    return {
        targetField: String(config.TargetField || "").trim(),
        mode: String(config.Mode || SUPPORTED_MODE).trim(),
        min: parseLimit(config.Min, DEFAULT_MIN_DAYS),
        max: parseLimit(config.Max, DEFAULT_MAX_DAYS),
        timeZone: String(config.TimeZone || DEFAULT_TIME_ZONE).trim(),
        unit: String(config.Unit || "天").trim()
    };
}

export function isRelativeDaysSearch(field) {
    return getRelativeDaysSearchConfig(field) !== null;
}

export function getRelativeDaysSearchLimit(field, name) {
    const config = getRelativeDaysSearchConfig(field);
    if (!config) {
        return name === "max" ? DEFAULT_MAX_DAYS : DEFAULT_MIN_DAYS;
    }
    return name === "max" ? config.max : config.min;
}

export function getRelativeDaysSearchUnit(field) {
    const config = getRelativeDaysSearchConfig(field);
    return config ? config.unit : "天";
}

export function createRelativeDaysFilter(field, rawValue, fieldPrefix = "") {
    const config = getRelativeDaysSearchConfig(field);
    if (!config) {
        return { filter: null, error: "当前字段未启用相对天数搜索。" };
    }

    const days = Number(rawValue);
    if (!Number.isFinite(days) || !Number.isInteger(days)) {
        return { filter: null, error: `${field.Label || field.Name || "相对天数"}必须填写整数。` };
    }
    if (days < config.min || days > config.max) {
        return { filter: null, error: `${field.Label || field.Name || "相对天数"}必须在 ${config.min} 至 ${config.max} 之间。` };
    }
    if (config.mode !== SUPPORTED_MODE) {
        return { filter: null, error: `暂不支持相对天数搜索模式：${config.mode}` };
    }
    if (!config.targetField || !isSafeFieldName(config.targetField)) {
        return { filter: null, error: `${field.Label || field.Name || "相对天数"}未配置有效的目标日期字段。` };
    }

    const targetField = config.targetField.includes(".") ? config.targetField : `${fieldPrefix || ""}${config.targetField}`;
    if (!isSafeFieldName(targetField)) {
        return { filter: null, error: `${field.Label || field.Name || "相对天数"}的目标日期字段格式无效。` };
    }

    try {
        getDateParts(new Date(), config.timeZone);
    } catch (error) {
        return { filter: null, error: `${field.Label || field.Name || "相对天数"}配置了无效时区：${config.timeZone}` };
    }

    return {
        filter: {
            targetField,
            days,
            mode: config.mode,
            timeZone: config.timeZone
        },
        error: ""
    };
}

export function resolveRelativeDaysFilter(filter, now = new Date()) {
    if (!filter || filter.mode !== SUPPORTED_MODE || !isSafeFieldName(filter.targetField)) {
        return [];
    }
    try {
        const today = getDateParts(now, filter.timeZone || DEFAULT_TIME_ZONE);
        const exclusiveEnd = addCalendarDays(today, Number(filter.days) + 1);
        return [
            [filter.targetField, ">=", today],
            [filter.targetField, "<", exclusiveEnd]
        ];
    } catch (error) {
        return [];
    }
}

export function resolveRelativeDaysFilters(filters, now = new Date()) {
    return (Array.isArray(filters) ? filters : []).flatMap((filter) => resolveRelativeDaysFilter(filter, now));
}
