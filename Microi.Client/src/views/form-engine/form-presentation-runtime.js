const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

const LAYOUT_COMPONENTS = new Set([
    "CollapseGroup",
    "Tabs",
    "Divider",
    "Empty",
    "Alert",
    "StaticText",
    "Html",
    "HTML",
    "Button"
]);

function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null);
}

function mergeRecords(base, override) {
    const result = isRecord(base) ? { ...base } : {};
    if (!isRecord(override)) return result;
    Object.keys(override).forEach((key) => {
        if (FORBIDDEN_PATH_SEGMENTS.has(key)) return;
        const value = override[key];
        if (isRecord(value) && isRecord(result[key])) {
            result[key] = mergeRecords(result[key], value);
        } else if (value !== undefined) {
            result[key] = value;
        }
    });
    return result;
}

function getDeclaredSectionKey(section) {
    if (!section || typeof section !== "object") return "";
    return String(section.Key || section.Id || section.Name || "").trim();
}

function mergeSectionLists(base, override) {
    const result = [];
    const byKey = new Map();
    const append = (section, shouldOverride) => {
        if (!isRecord(section)) return;
        const declaredKey = getDeclaredSectionKey(section);
        const normalizedKey = declaredKey.toLowerCase();
        if (normalizedKey && byKey.has(normalizedKey)) {
            const index = byKey.get(normalizedKey);
            result[index] = shouldOverride ? mergeRecords(result[index], section) : result[index];
            return;
        }
        const index = result.length;
        result.push({ ...section });
        if (normalizedKey) byKey.set(normalizedKey, index);
    };
    (Array.isArray(base) ? base : []).forEach((section) => append(section, false));
    (Array.isArray(override) ? override : []).forEach((section) => append(section, true));
    return result;
}

function normalizeNavigation(config) {
    const source = isRecord(config) ? config : {};
    return mergeRecords({
        Title: source.NavigationTitle,
        CountText: source.NavigationCountText,
        Mode: source.SectionNavigation,
        Position: source.SectionNavigationPosition,
        FooterTitle: source.NavigationFooterTitle,
        FooterHtml: source.NavigationFooterHtml
    }, source.Navigation);
}

function parseStringList(value) {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    const text = String(value).trim();
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item || "").trim()).filter(Boolean);
        }
    } catch (_error) {
        // 兼容设计器中更易填写的 Name,Code 形式。
    }
    return text.split(/[,，\r\n]+/).map((item) => item.trim()).filter(Boolean);
}

function parseDescriptorList(value) {
    if (value === undefined || value === null) return undefined;
    if (Array.isArray(value)) return value;
    const text = String(value).trim();
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
    } catch (_error) {
        // Tag fields also accept the designer-friendly Name,Status syntax.
    }
    return text.split(/[,，\r\n]+/).map((item) => item.trim()).filter(Boolean);
}

function normalizeTablePresentation(table) {
    const source = isRecord(table) ? table : {};
    const configured = mergeRecords(
        parsePresentationObject(source.FormPresentationConfig),
        parsePresentationObject(source.FormPresentation)
    );
    const flattened = {
        Presentation: source.FormPresentationMode,
        Density: source.FormPresentationDensity,
        NavigationTitle: source.FormNavigationTitle,
        NavigationCountText: source.FormNavigationCountText,
        SectionNavigation: source.FormSectionNavigation,
        SectionEyebrow: source.FormSectionEyebrow,
        RequiredCountText: source.FormRequiredCountText,
        NavigationFooterTitle: source.FormNavigationFooterTitle,
        NavigationFooterHtml: source.FormNavigationFooterHtml,
        WorkbenchEyebrow: source.FormWorkbenchEyebrow,
        WorkbenchDescription: source.FormWorkbenchDescription
    };
    const recordSelector = {};
    if (source.FormRecordSelectorPlaceholder !== undefined && source.FormRecordSelectorPlaceholder !== null) {
        recordSelector.Placeholder = source.FormRecordSelectorPlaceholder;
    }
    const labelFields = parseStringList(source.FormRecordSelectorLabelFields);
    if (labelFields !== undefined) recordSelector.LabelFields = labelFields;
    if (Object.keys(recordSelector).length) flattened.RecordSelector = recordSelector;

    const banner = {};
    const setBannerValue = (key, value) => {
        // New columns are nullable. Null means an upgraded legacy table has not
        // made an explicit choice and should still receive smart defaults.
        if (value !== undefined && value !== null) banner[key] = value;
    };
    setBannerValue("Enabled", source.FormBannerEnabled);
    setBannerValue("TitleField", source.FormBannerTitleField);
    setBannerValue("SubtitleField", source.FormBannerSubtitleField);
    setBannerValue("ImageField", source.FormBannerImageField);
    setBannerValue("Icon", source.FormBannerIcon);
    setBannerValue("BackgroundField", source.FormBannerBackgroundField);
    const tagFields = parseDescriptorList(source.FormBannerTagFields);
    const metrics = parseDescriptorList(source.FormBannerMetrics);
    if (tagFields !== undefined) banner.Tags = tagFields;
    if (metrics !== undefined) banner.Metrics = metrics;
    if (Object.keys(banner).length) flattened.Banner = banner;

    // FormPresentation 是 v7.5.0 的兼容迁移源；语义清晰的 diy_table
    // 物理字段是新事实源，只有对应物理字段为空时才回退旧 JSON。
    return mergeRecords(configured, flattened);
}

function findSectionMeta(sections, tab, key) {
    const normalizedKey = String(key || "").toLowerCase();
    const normalizedName = String(tab && tab.Name || "").toLowerCase();
    return (Array.isArray(sections) ? sections : []).find((item) => {
        const declaredKey = getDeclaredSectionKey(item).toLowerCase();
        return declaredKey && (declaredKey === normalizedKey || declaredKey === normalizedName);
    }) || {};
}

function findStoredTab(table, tab, key) {
    const tabs = table && Array.isArray(table.Tabs) ? table.Tabs : [];
    const normalizedKey = String(key || "").toLowerCase();
    const normalizedName = String(tab && tab.Name || "").toLowerCase();
    return tabs.find((item) => {
        if (!item || typeof item !== "object") return false;
        const candidates = [item.Id, item.Name]
            .map((value) => String(value || "").toLowerCase())
            .filter(Boolean);
        return candidates.includes(normalizedKey) || candidates.includes(normalizedName);
    }) || {};
}

function normalizeBoolean(value) {
    if (value === true || value === 1) return true;
    const text = String(value === undefined || value === null ? "" : value).trim().toLowerCase();
    return text === "1" || text === "true" || text === "yes" || text === "on";
}

function normalizeRefreshSeconds(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.min(3600, Math.max(15, numeric));
}

function normalizeSectionBadge(meta, key) {
    const nested = mergeRecords(meta && meta.Statistics, meta && (meta.Badge || meta.Stat));
    const apiEngineKey = String(firstDefined(
        meta && meta.BadgeApiEngineKey,
        meta && meta.StatApiEngineKey,
        nested.ApiEngineKey,
        ""
    ) || "").trim();
    return {
        Key: String(key || ""),
        Enabled: Boolean(apiEngineKey),
        ApiEngineKey: apiEngineKey,
        ValuePath: String(firstDefined(
            meta && meta.BadgeValuePath,
            meta && meta.StatValuePath,
            nested.ValuePath,
            ""
        ) || "").trim(),
        ParamMap: mergeRecords(
            parsePresentationObject(nested.ParamMap),
            parsePresentationObject(meta && (meta.BadgeParamMap || meta.StatParamMap))
        ),
        DefaultValue: firstDefined(
            meta && meta.BadgeDefaultValue,
            meta && meta.StatDefaultValue,
            nested.DefaultValue
        ),
        RefreshSeconds: normalizeRefreshSeconds(firstDefined(
            meta && meta.BadgeRefreshSeconds,
            meta && meta.StatRefreshSeconds,
            nested.RefreshSeconds,
            0
        ))
    };
}

function countSectionFields(fields) {
    return (Array.isArray(fields) ? fields : []).reduce((result, field) => {
        if (!field || field._isShow === false || LAYOUT_COMPONENTS.has(String(field.Component || ""))) {
            return result;
        }
        result.FieldCount += 1;
        if (normalizeBoolean(field.NotEmpty)) result.RequiredCount += 1;
        return result;
    }, { FieldCount: 0, RequiredCount: 0 });
}

function normalizeCountSuffix(value) {
    if (value === undefined || value === null) return "项";
    return String(value);
}

function normalizeSectionTitle(value, table) {
    const text = String(value === undefined || value === null ? "" : value).trim();
    const placeholder = text.toLowerCase().replace(/，/g, ",").replace(/\s+/g, " ");
    if (["", "none", "info", "no, none", "no,none", "无", "无分组"].includes(placeholder)) {
        return String((table && table.Description) || "表单信息");
    }
    return text;
}

function getOwnValue(source, key) {
    if (source === null || source === undefined || FORBIDDEN_PATH_SEGMENTS.has(String(key))) return undefined;
    return Object.prototype.hasOwnProperty.call(Object(source), key) ? source[key] : undefined;
}

function formatSectionCount(value, suffix, context) {
    const normalizedSuffix = normalizeCountSuffix(suffix);
    if (/\{(?:value|count|fieldCount|requiredCount)\}/i.test(normalizedSuffix)) {
        return formatPresentationText(normalizedSuffix, { ...context, value, count: value });
    }
    return normalizedSuffix ? `${value} ${normalizedSuffix}`.trim() : String(value);
}

export function parsePresentationObject(value) {
    if (isRecord(value)) return value;
    if (typeof value !== "string" || !value.trim()) return {};
    try {
        const parsed = JSON.parse(value);
        return isRecord(parsed) ? parsed : {};
    } catch (error) {
        return {};
    }
}

/**
 * Resolve the form-level presentation contract.
 * diy_table presentation physical fields are authoritative. The historical
 * FormPresentation JSON and module ViewSchema remain compatibility fallbacks.
 */
export function resolveFormPresentationConfig(table, legacyConfig, presentationMode) {
    const legacy = parsePresentationObject(legacyConfig);
    const tableConfig = normalizeTablePresentation(table);
    const merged = mergeRecords(legacy, tableConfig);
    merged.Sections = mergeSectionLists(legacy.Sections, tableConfig.Sections);
    merged.Navigation = mergeRecords(normalizeNavigation(legacy), normalizeNavigation(tableConfig));

    const explicitMode = String(presentationMode || "").trim();
    const isClassicEscape = ["classic", "legacy"].includes(explicitMode.toLowerCase());
    merged.Presentation = isClassicEscape
        ? explicitMode
        : String(firstDefined(tableConfig.Presentation, explicitMode, legacy.Presentation, "ControlCenter") || "ControlCenter");
    // SettingsCenter was the old module-workbench spelling. Canonicalize it so
    // every caller receives the same form-engine presentation and CSS contract.
    if (merged.Presentation.trim().toLowerCase() === "settingscenter") {
        merged.Presentation = "ControlCenter";
    }
    merged.Density = String(firstDefined(tableConfig.Density, legacy.Density, "Compact") || "Compact");
    merged.Navigation.Title = String(firstDefined(
        merged.Navigation.Title,
        tableConfig.NavigationTitle,
        legacy.NavigationTitle,
        "表单分组"
    ) || "表单分组");
    merged.Navigation.CountText = String(firstDefined(
        merged.Navigation.CountText,
        tableConfig.NavigationCountText,
        legacy.NavigationCountText,
        "{count} 项"
    ) || "{count} 项");
    merged.SectionEyebrow = String(firstDefined(tableConfig.SectionEyebrow, legacy.SectionEyebrow, "FORM SECTION") || "");
    merged.RequiredCountText = String(firstDefined(
        tableConfig.RequiredCountText,
        legacy.RequiredCountText,
        "{count} 必填项"
    ) || "{count} 必填项");
    return merged;
}

export function formatPresentationText(template, values) {
    const source = template === undefined || template === null ? "" : String(template);
    const context = isRecord(values) ? values : {};
    return source.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key) => {
        if (!Object.prototype.hasOwnProperty.call(context, key)) return match;
        const value = context[key];
        return value === undefined || value === null ? "" : String(value);
    });
}

export function buildFormPresentationSections(options) {
    const settings = isRecord(options) ? options : {};
    const tabs = Array.isArray(settings.tabs) ? settings.tabs : [];
    const groupedFields = isRecord(settings.groupedFields) ? settings.groupedFields : {};
    const table = isRecord(settings.table) ? settings.table : {};
    const config = isRecord(settings.config) ? settings.config : {};
    const statValues = isRecord(settings.statValues) ? settings.statValues : {};
    const sections = Array.isArray(config.Sections) ? config.Sections : [];

    return tabs.filter((tab) => tab && tab.Display !== false).map((tab, index) => {
        const key = String(tab.Id || tab.Name || `section-${index}`);
        const configured = findSectionMeta(sections, tab, key);
        // The tab object is persisted in diy_table.Tabs and therefore wins over
        // the old module-level section descriptor.
        const storedTab = findStoredTab(table, tab, key);
        const meta = mergeRecords(mergeRecords(configured, storedTab), tab);
        const counts = countSectionFields(groupedFields[key]);
        const badge = normalizeSectionBadge(meta, key);
        const hasRuntimeValue = Object.prototype.hasOwnProperty.call(statValues, key)
            && statValues[key] !== undefined
            && statValues[key] !== null
            && statValues[key] !== "";
        const hasDefaultValue = badge.DefaultValue !== undefined && badge.DefaultValue !== null && badge.DefaultValue !== "";
        const displayValue = hasRuntimeValue
            ? statValues[key]
            : (hasDefaultValue ? badge.DefaultValue : counts.FieldCount);
        const countSuffix = firstDefined(meta.CountSuffix, meta.CountText, config.CountSuffix, "项");
        const countContext = {
            value: displayValue,
            count: displayValue,
            fieldCount: counts.FieldCount,
            requiredCount: counts.RequiredCount
        };
        const countLabel = formatSectionCount(displayValue, countSuffix, countContext);
        const requiredTemplate = firstDefined(meta.RequiredCountText, config.RequiredCountText, "{count} 必填项");
        const requiredLabel = formatPresentationText(requiredTemplate, {
            value: counts.RequiredCount,
            count: counts.RequiredCount,
            fieldCount: counts.FieldCount,
            requiredCount: counts.RequiredCount
        });
        const fallbackTitle = normalizeSectionTitle(tab.Name, table);
        const title = normalizeSectionTitle(firstDefined(meta.Title, meta.Label, fallbackTitle), table);
        const descriptionHtml = String(firstDefined(meta.DescriptionHtml, meta.Description, "") || "");
        const formSubtitleHtml = tabs.length <= 1
            ? String(firstDefined(config.SectionSubtitleHtml, config.WorkbenchDescription, "") || "")
            : "";
        const subtitleTemplate = firstDefined(meta.SubtitleHtml, meta.NavigationSubtitleHtml);
        const navigationSubtitleHtml = subtitleTemplate !== undefined && subtitleTemplate !== null && subtitleTemplate !== ""
            ? formatPresentationText(subtitleTemplate, countContext)
            : (descriptionHtml ? `${descriptionHtml} · ${countLabel}` : countLabel);

        return {
            Key: key,
            Index: index,
            Title: title,
            Icon: String(firstDefined(meta.Icon, "") || ""),
            NavigationSubtitleHtml: String(navigationSubtitleHtml || ""),
            SectionEyebrow: String(firstDefined(meta.SectionEyebrow, config.SectionEyebrow, "FORM SECTION") || ""),
            SectionTitle: String(firstDefined(meta.SectionTitle, meta.ContentTitle, title) || title),
            SectionSubtitleHtml: String(firstDefined(
                meta.SectionSubtitleHtml || undefined,
                meta.ContentDescriptionHtml || undefined,
                descriptionHtml || undefined,
                formSubtitleHtml || undefined,
                ""
            ) || ""),
            FooterTitle: String(firstDefined(meta.FooterTitle, meta.Footer && meta.Footer.Title, "") || ""),
            FooterDescriptionHtml: String(firstDefined(
                meta.FooterDescriptionHtml,
                meta.FooterHtml,
                meta.Footer && (meta.Footer.DescriptionHtml || meta.Footer.Html),
                ""
            ) || ""),
            FieldCount: counts.FieldCount,
            RequiredCount: counts.RequiredCount,
            DisplayValue: displayValue,
            CountLabel: countLabel,
            RequiredLabel: requiredLabel,
            Badge: badge
        };
    });
}

export function collectFormSectionBadgeApiGroups(sections) {
    const groups = new Map();
    (Array.isArray(sections) ? sections : []).forEach((section) => {
        const badge = section && section.Badge;
        if (!badge || !badge.Enabled || !badge.ApiEngineKey) return;
        if (!groups.has(badge.ApiEngineKey)) groups.set(badge.ApiEngineKey, []);
        groups.get(badge.ApiEngineKey).push({ section, badge });
    });
    return groups;
}

export function getPresentationValueByPath(source, path, fallback) {
    if (!path) return source === undefined ? fallback : source;
    const segments = String(path)
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .map((segment) => segment.trim())
        .filter(Boolean);
    let current = source;
    for (const segment of segments) {
        if (FORBIDDEN_PATH_SEGMENTS.has(segment) || current === null || current === undefined) return fallback;
        if (!Object.prototype.hasOwnProperty.call(Object(current), segment)) return fallback;
        current = current[segment];
    }
    return current === undefined ? fallback : current;
}

export function resolveFormSectionBadgeValue(response, descriptor) {
    const badge = descriptor && (descriptor.badge || descriptor.Badge || descriptor);
    const section = descriptor && (descriptor.section || descriptor.Section);
    const key = String((badge && badge.Key) || (section && section.Key) || "");
    if (!badge) return undefined;
    if (badge.ValuePath) {
        const path = String(badge.ValuePath).replace(/\{SectionKey\}/gi, key);
        return getPresentationValueByPath(response, path);
    }
    const data = response && Object.prototype.hasOwnProperty.call(Object(response), "Data") ? response.Data : response;
    if (data && typeof data === "object") {
        const candidates = [
            getOwnValue(data.Sections, key),
            getOwnValue(data.sections, key),
            getOwnValue(data.Counts, key),
            getOwnValue(data.counts, key),
            getOwnValue(data.Metrics, key),
            getOwnValue(data.metrics, key),
            getOwnValue(data, key)
        ];
        const value = candidates.find((candidate) => candidate !== undefined);
        if (value !== undefined) return value;
    } else if (data !== undefined && data !== null) {
        return data;
    }
    return badge.DefaultValue;
}

export function getFormSectionBadgeRefreshSeconds(sections) {
    return (Array.isArray(sections) ? sections : [])
        .map((section) => Number(section && section.Badge && section.Badge.RefreshSeconds || 0))
        .filter((seconds) => seconds > 0)
        .sort((left, right) => left - right)[0] || 0;
}

export default {
    parsePresentationObject,
    resolveFormPresentationConfig,
    formatPresentationText,
    buildFormPresentationSections,
    collectFormSectionBadgeApiGroups,
    getPresentationValueByPath,
    resolveFormSectionBadgeValue,
    getFormSectionBadgeRefreshSeconds
};
