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
    const metrics = Array.isArray(sourceHero.Metrics) ? sourceHero.Metrics : [];
    const configuredContent = Boolean(view && (
        cleanText(sourceHero.Title)
        || cleanText(sourceHero.Eyebrow)
        || cleanText(sourceHero.Description)
        || metrics.length
    ));
    const title = cleanText(sourceHero.Title)
        || cleanText(menu.Name)
        || cleanText(table.Description)
        || cleanText(table.Name);
    const isPhoneView = Boolean(options.isPhoneView);
    const defaultEligible = !isPhoneView
        && !options.embedded
        && !options.isTableChild
        && !options.isJoinTable
        && Boolean(title);

    return {
        ...sourceHero,
        Title: title,
        Metrics: metrics,
        Visible: isPhoneView ? Boolean(view && metrics.length) : (configuredContent || defaultEligible),
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
