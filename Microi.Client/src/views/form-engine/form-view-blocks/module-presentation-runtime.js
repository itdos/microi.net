const FORBIDDEN_PATH_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function asBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    return ![false, 0, "0", "false", "no", "off"].includes(
        typeof value === "string" ? value.trim().toLowerCase() : value
    );
}

export function parseJsonObject(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return {};
    try {
        const result = JSON.parse(value);
        return result && typeof result === "object" && !Array.isArray(result) ? result : {};
    } catch (error) {
        return {};
    }
}

function cleanText(value) {
    return String(value === undefined || value === null ? "" : value).trim();
}

const AUTO_METRIC_BLOCKED_WORDS = [
    "phone", "mobile", "tel", "status", "state", "sort", "rate", "level", "percent",
    "电话", "手机", "状态", "排序", "等级", "比例", "百分比"
];
const AUTO_METRIC_BUSINESS_WORDS = [
    "amount", "money", "price", "total", "count", "qty", "quantity", "score", "point",
    "balance", "area", "weight", "hours", "days", "capacity", "金额", "价格", "总额",
    "数量", "积分", "余额", "面积", "重量", "工时", "天数", "容量", "人数"
];
const AUTO_STATUS_WORDS = [
    "status", "state", "type", "category", "stage", "level", "状态", "类型", "分类", "阶段", "等级"
];

function fieldName(field) {
    return cleanText(field?.AsName || field?.Name || field?.Id);
}

function fieldText(field) {
    return `${fieldName(field)} ${cleanText(field?.Label)} ${cleanText(field?.Component)} ${cleanText(field?.Type)}`.toLowerCase();
}

function containsAny(text, words) {
    return words.some((word) => text.includes(word));
}

function isNumericPresentationField(field) {
    const text = fieldText(field);
    const component = cleanText(field?.Component).toLowerCase();
    const type = cleanText(field?.Type).toLowerCase();
    if (!fieldName(field) || containsAny(text, AUTO_METRIC_BLOCKED_WORDS)) return false;
    return component === "numbertext"
        || /^(?:tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real)\b/.test(type);
}

function numericMetricScore(field) {
    const text = fieldText(field);
    let score = containsAny(text, AUTO_METRIC_BUSINESS_WORDS) ? 100 : 10;
    if (containsAny(text, ["amount", "money", "price", "total", "balance", "金额", "价格", "总额", "余额"])) score += 30;
    return score;
}

function numberValue(value) {
    if (value === null || value === undefined || value === "") return undefined;
    const numeric = Number(typeof value === "string" ? value.replace(/,/g, "").trim() : value);
    return Number.isFinite(numeric) ? numeric : undefined;
}

function statisticValue(statistics, field) {
    const source = statistics && typeof statistics === "object" ? statistics : {};
    for (const key of [field?.AsName, field?.Name, field?.Id].map(cleanText).filter(Boolean)) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const value = numberValue(source[key]);
            if (value !== undefined) return value;
        }
    }
    return undefined;
}

function pageSum(rows, field) {
    const key = fieldName(field);
    if (!key || !Array.isArray(rows) || !rows.length) return undefined;
    let found = false;
    const total = rows.reduce((sum, row) => {
        const value = numberValue(row?.[key] ?? row?.[field?.Name]);
        if (value === undefined) return sum;
        found = true;
        return sum + value;
    }, 0);
    return found ? total : undefined;
}

function topCurrentPageCategory(fields, rows) {
    if (!Array.isArray(rows) || !rows.length) return null;
    const categoryField = (fields || []).find((field) => containsAny(fieldText(field), AUTO_STATUS_WORDS));
    const key = fieldName(categoryField);
    if (!categoryField || !key) return null;
    const counts = new Map();
    rows.forEach((row) => {
        const value = cleanText(row?.[key] ?? row?.[categoryField.Name]);
        // Numeric enum keys and serialized relation values are not meaningful labels without field rendering.
        if (!value || value.length > 16 || /^[-+]?\d+(?:\.\d+)?$/.test(value) || /^[\[{]/.test(value)) return;
        counts.set(value, (counts.get(value) || 0) + 1);
    });
    const first = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
    return first ? { field: categoryField, label: first[0], value: first[1] } : null;
}

/**
 * Build truthful metrics for legacy modules that have no Hero.Metrics.
 * Server-side aggregates win; current-page sums/categories are explicitly labelled as such.
 * No random or fabricated business values are ever produced.
 */
export function buildAutomaticPresentationMetrics(options = {}) {
    const fields = Array.isArray(options.fields) ? options.fields.filter(Boolean) : [];
    const rows = Array.isArray(options.rows) ? options.rows : [];
    const statistics = options.statistics || {};
    const result = [];
    const numericFields = fields
        .filter(isNumericPresentationField)
        .sort((left, right) => numericMetricScore(right) - numericMetricScore(left));

    numericFields.slice(0, 2).forEach((field, index) => {
        const name = fieldName(field);
        const aggregate = statisticValue(statistics, field);
        const currentPage = aggregate === undefined ? pageSum(rows, field) : undefined;
        if (aggregate === undefined && currentPage === undefined) return;
        result.push({
            Key: aggregate === undefined ? `AutoPageSum:${name}` : `AutoAggregate:${name}`,
            Label: `${aggregate === undefined ? "本页" : ""}${cleanText(field.Label) || name}${aggregate === undefined ? "" : "合计"}`,
            Field: aggregate === undefined ? "" : name,
            RuntimeField: name,
            Source: aggregate === undefined ? "Runtime" : "Field",
            DefaultValue: aggregate === undefined ? currentPage : aggregate,
            Icon: index === 0 ? "fas fa-chart-column" : "fas fa-calculator",
            Tone: index === 0 ? "primary" : "success",
            AutoGenerated: true
        });
    });

    result.push({
        Key: "AutoDataCount",
        Label: "筛选结果",
        Source: "DataCount",
        Icon: "fas fa-layer-group",
        Tone: "info",
        AutoGenerated: true
    });

    if (result.length < 3) {
        const category = topCurrentPageCategory(fields, rows);
        if (category) {
            result.push({
                Key: `AutoCategory:${fieldName(category.field)}:${category.label}`,
                Label: `本页${category.label}`,
                Source: "Runtime",
                DefaultValue: category.value,
                Suffix: "条",
                Icon: "fas fa-tags",
                Tone: "warning",
                AutoGenerated: true
            });
        }
    }

    if (result.length < 3) {
        result.push({
            Key: "AutoPageCount",
            Label: "本页展示",
            Source: "PageCount",
            Icon: "fas fa-list-check",
            Tone: "warning",
            AutoGenerated: true
        });
    }
    return result.slice(0, 4);
}

function defaultHeroDescription(menu, table, title) {
    const candidates = [menu?.Description, menu?.Remark, table?.Description, table?.Remark]
        .map(cleanText)
        .filter((value) => value && value !== title);
    return candidates[0] || (title ? `${title}的业务数据、进度与关键指标` : "");
}

/**
 * Resolve the compact list header without changing the global ViewSchema selector.
 * Detail/Edit keep their existing opt-in semantics, while every top-level desktop
 * list receives a small default title bar.
 */
export function resolveListPresentationHeader(options = {}) {
    const menu = options.menu || {};
    const table = options.table || {};
    const view = options.view || null;
    const sourceHero = view?.Layout?.Hero || {};
    const configuredMetrics = Array.isArray(sourceHero.Metrics) ? sourceHero.Metrics : [];
    const configuredContent = Boolean(view && (
        cleanText(sourceHero.Title)
        || cleanText(sourceHero.Eyebrow)
        || cleanText(sourceHero.Description)
        || configuredMetrics.length
    ));
    const title = cleanText(sourceHero.Title)
        || cleanText(menu.Name)
        || cleanText(table.Description)
        || cleanText(table.Name);
    const isPhoneView = Boolean(options.isPhoneView);
    const presentationEligible = !options.embedded
        && !options.isTableChild
        && !options.isJoinTable
        && Boolean(title);
    const defaultEligible = !isPhoneView && presentationEligible;
    const metrics = configuredMetrics.length
        ? configuredMetrics
        : (presentationEligible ? buildAutomaticPresentationMetrics(options) : []);
    const description = cleanText(sourceHero.Description)
        || (presentationEligible ? defaultHeroDescription(menu, table, title) : "");

    return {
        ...sourceHero,
        Title: title,
        Description: description,
        Metrics: metrics,
        Visible: isPhoneView ? Boolean(presentationEligible && metrics.length) : (configuredContent || defaultEligible),
        IsDefault: !configuredContent && defaultEligible
    };
}

export function getValueByPath(source, path, fallback) {
    const rawPath = String(path || "").trim();
    if (!rawPath) return source === undefined ? fallback : source;
    const keys = rawPath
        .replace(/^\$\.?/, "")
        .replace(/\[(["']?)([^\]"']+)\1\]/g, ".$2")
        .split(".")
        .map((key) => key.trim())
        .filter(Boolean);
    let current = source;
    for (const key of keys) {
        if (FORBIDDEN_PATH_KEYS.has(key) || current === null || current === undefined) return fallback;
        if (typeof current !== "object" && !Array.isArray(current)) return fallback;
        if (!Object.prototype.hasOwnProperty.call(current, key)) return fallback;
        current = current[key];
    }
    return current === undefined ? fallback : current;
}

function normalizeParamMap(value) {
    const source = parseJsonObject(value);
    const result = {};
    Object.keys(source).slice(0, 30).forEach((key) => {
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) result[key] = source[key];
    });
    return result;
}

export function normalizeMenuBadgeConfig(value) {
    const source = parseJsonObject(value);
    const apiEngineKey = String(source.ApiEngineKey || source.apiEngineKey || "").trim();
    return {
        Enabled: asBoolean(source.Enabled ?? source.enabled, false) && Boolean(apiEngineKey),
        ApiEngineKey: apiEngineKey,
        ValuePath: String(source.ValuePath || source.valuePath || "Data.Value"),
        Tone: String(source.Tone || source.tone || "danger").toLowerCase(),
        Color: String(source.Color || source.color || ""),
        Max: Math.min(999999, Math.max(0, Number(source.Max || source.max || 99))),
        ZeroVisible: asBoolean(source.ZeroVisible ?? source.zeroVisible, false),
        RefreshSeconds: Math.min(3600, Math.max(15, Number(source.RefreshSeconds || source.refreshSeconds || 60))),
        ParamMap: normalizeParamMap(source.ParamMap || source.paramMap || source.Params || source.params)
    };
}

export function normalizeButtonBadge(button) {
    const source = button || {};
    const nested = parseJsonObject(source.Badge || source.badge);
    const read = (name, fallback) => source[`Badge${name}`] ?? source[`badge${name}`] ?? nested[name] ?? nested[name.charAt(0).toLowerCase() + name.slice(1)] ?? fallback;
    const apiEngineKey = String(read("ApiEngineKey", "") || "").trim();
    const field = String(read("Field", read("SourceField", "")) || "").trim();
    const enabledValue = read("Enabled", undefined);
    return {
        Enabled: enabledValue === undefined ? Boolean(apiEngineKey || field) : asBoolean(enabledValue, false),
        ApiEngineKey: apiEngineKey,
        Field: field,
        ValuePath: String(read("ValuePath", "") || ""),
        Tone: String(read("Tone", "") || source.BtnStyle || source.btnStyle || "primary").toLowerCase(),
        Color: String(read("Color", "") || ""),
        Max: Math.min(999999, Math.max(0, Number(read("Max", 99) || 99))),
        ZeroVisible: asBoolean(read("ZeroVisible", read("ShowZero", false)), false),
        RefreshSeconds: Math.min(3600, Math.max(0, Number(read("RefreshSeconds", 0) || 0)))
    };
}

export function getButtonKey(button, index = 0) {
    return String(button?.Id || button?.Key || button?.Name || `button:${index}`);
}

export function formatBadgeValue(value, config = {}) {
    if (value === undefined || value === null || value === "") return null;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        if (numeric === 0 && !config.ZeroVisible) return null;
        const max = Number(config.Max || 0);
        return max > 0 && numeric > max ? `${max}+` : String(numeric);
    }
    const text = String(value).trim();
    return text || null;
}

export function resolveMetricValue(response, metric) {
    if (!metric) return undefined;
    if (metric.ValuePath) return getValueByPath(response, metric.ValuePath);
    const data = response && Object.prototype.hasOwnProperty.call(response, "Data") ? response.Data : response;
    if (data && typeof data === "object") {
        for (const key of [metric.Key, metric.Field]) {
            if (key && Object.prototype.hasOwnProperty.call(data, key)) return data[key];
            if (key && data.Metrics && Object.prototype.hasOwnProperty.call(data.Metrics, key)) return data.Metrics[key];
        }
    }
    return data !== undefined && (typeof data !== "object" || data === null) ? data : metric.DefaultValue;
}

export function resolveButtonBadgeValue(response, badge, buttonKey, rowId) {
    if (!badge || !badge.Enabled) return undefined;
    if (badge.ValuePath) {
        const path = badge.ValuePath
            .replace(/\{RowId\}|\$row\.Id|\$rowId/gi, String(rowId || ""))
            .replace(/\{ButtonKey\}|\$button\.Key|\$buttonKey/gi, String(buttonKey || ""));
        return getValueByPath(response, path);
    }
    const data = response && Object.prototype.hasOwnProperty.call(response, "Data") ? response.Data : response;
    if (!data || typeof data !== "object") return data;
    if (rowId) {
        const rowCandidates = [
            data.Rows?.[rowId]?.[buttonKey],
            data.rows?.[rowId]?.[buttonKey],
            data[rowId]?.[buttonKey],
            data[buttonKey]?.[rowId]
        ];
        const rowValue = rowCandidates.find((value) => value !== undefined);
        if (rowValue !== undefined) return rowValue;
    }
    return data.Buttons?.[buttonKey] ?? data.buttons?.[buttonKey] ?? data[buttonKey];
}

export function collectBadgeApiGroups(buttonCollections) {
    const groups = new Map();
    (buttonCollections || []).forEach((buttons) => {
        (Array.isArray(buttons) ? buttons : []).forEach((button, index) => {
            const badge = normalizeButtonBadge(button);
            if (!badge.Enabled || !badge.ApiEngineKey) return;
            const key = badge.ApiEngineKey;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ button, badge, buttonKey: getButtonKey(button, index) });
        });
    });
    return groups;
}

export default {
    parseJsonObject,
    buildAutomaticPresentationMetrics,
    resolveListPresentationHeader,
    getValueByPath,
    normalizeMenuBadgeConfig,
    normalizeButtonBadge,
    getButtonKey,
    formatBadgeValue,
    resolveMetricValue,
    resolveButtonBadgeValue,
    collectBadgeApiGroups
};
