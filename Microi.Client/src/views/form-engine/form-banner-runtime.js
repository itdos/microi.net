const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const LAYOUT_COMPONENTS = new Set([
    "CollapseGroup", "Tabs", "Divider", "Empty", "Alert", "StaticText", "Html", "HTML", "Button"
]);
const IMAGE_COMPONENTS = new Set(["ImgUpload", "ImageUpload"]);
const TAG_COMPONENTS = new Set([
    "Select", "MultipleSelect", "Radio", "Checkbox", "Switch", "Cascader", "SelectTree", "Department"
]);
const NUMBER_COMPONENTS = new Set(["NumberText", "Slider", "Rate", "Progress"]);

function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function own(source, key) {
    return isRecord(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function stringValue(value) {
    return value === undefined || value === null ? "" : String(value).trim();
}

function parseJson(value) {
    if (Array.isArray(value) || isRecord(value)) return value;
    if (typeof value !== "string" || !value.trim()) return value;
    try { return JSON.parse(value); } catch (_error) { return value; }
}

function parseDescriptorList(value) {
    if (value === undefined || value === null) return undefined;
    const parsed = parseJson(value);
    if (Array.isArray(parsed)) return parsed;
    const text = stringValue(parsed);
    if (!text) return [];
    return text.split(/[,，\r\n]+/u).map((item) => item.trim()).filter(Boolean);
}

function normalizeEnabled(value, fallback = true) {
    if (value === undefined || value === null || value === "") return fallback;
    if (value === false || value === 0) return false;
    return !["0", "false", "off", "no"].includes(String(value).trim().toLowerCase());
}

function fieldName(field) {
    return stringValue(field && (field.AsName || field.Name));
}

function fieldComponent(field) {
    return stringValue(field && field.Component);
}

function fieldConfig(field) {
    const parsed = parseJson(field && field.Config);
    return isRecord(parsed) ? parsed : {};
}

function fieldText(field) {
    return `${fieldName(field)} ${stringValue(field && field.Label)} ${stringValue(field && field.Description)}`.toLowerCase();
}

function isVisibleBusinessField(field) {
    if (!field || !fieldName(field) || LAYOUT_COMPONENTS.has(fieldComponent(field))) return false;
    if (field.Visible === 0 || field.Visible === false || field._isShow === false || field.IsDeleted === 1) return false;
    return !["id", "isdeleted", "osclient", "createtime", "updatetime", "userid", "username"]
        .includes(fieldName(field).toLowerCase());
}

function keywordScore(text, keywords, weight) {
    return keywords.reduce((score, keyword, index) => (
        text.includes(keyword) ? Math.max(score, weight - index) : score
    ), 0);
}

function bestField(fields, score) {
    return fields
        .map((field, index) => ({ field, index, score: score(field, index) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.field;
}

function isNumericField(field) {
    if (TAG_COMPONENTS.has(fieldComponent(field))) return false;
    if (NUMBER_COMPONENTS.has(fieldComponent(field))) return true;
    return /^(tinyint|smallint|mediumint|int|bigint|decimal|numeric|float|double|real)(\b|\()/iu
        .test(stringValue(field && field.Type));
}

function titleScore(field, index) {
    const text = fieldText(field);
    const name = fieldName(field).toLowerCase();
    let score = keywordScore(text, [
        "title", "name", "subject", "code", "no", "number", "标题", "名称", "主题", "编号", "单号", "编码"
    ], 120);
    if (fieldComponent(field) === "AutoNumber") score += 48;
    else if (fieldComponent(field) === "Text") score += 20;
    if (/^(name|title|subject|code|no)$/iu.test(name)) score += 80;
    if (TAG_COMPONENTS.has(fieldComponent(field)) || isNumericField(field) || IMAGE_COMPONENTS.has(fieldComponent(field))) score -= 90;
    return score || Math.max(1, 20 - index);
}

function subtitleScore(field, index, titleField) {
    if (field === titleField || IMAGE_COMPONENTS.has(fieldComponent(field)) || isNumericField(field)) return 0;
    const text = fieldText(field);
    let score = keywordScore(text, [
        "subtitle", "customer", "client", "project", "company", "category", "type", "date", "contact",
        "副标题", "客户", "项目", "公司", "单位", "分类", "类型", "日期", "联系人", "说明"
    ], 100);
    if (["Text", "Select", "Radio", "DateTime", "Department", "SelectTree"].includes(fieldComponent(field))) score += 22;
    if (["Textarea", "RichText", "CodeEditor"].includes(fieldComponent(field))) score -= 35;
    return score || Math.max(1, 12 - index);
}

function tagScore(field, index) {
    if (!TAG_COMPONENTS.has(fieldComponent(field))) return 0;
    const text = fieldText(field);
    return keywordScore(text, [
        "status", "state", "stage", "type", "category", "level", "priority", "状态", "阶段", "类型", "分类", "级别", "优先级"
    ], 100) || Math.max(1, 30 - index);
}

function metricScore(field) {
    if (!isNumericField(field)) return 0;
    const text = fieldText(field);
    if (/(^|\s|_)(id|ids)(\s|_|$)|sort|order|latitude|longitude|phone|mobile|enabled?|disabled?|visible|deleted|status|state|type|category|version|timeout|retry|limit|pagesize|page size|offset|loaded|load count|record count|data count|排序|经度|纬度|电话|手机|启用|禁用|显示|删除|状态|类型|分类|版本|超时|重试|限制|分页|本页|加载|记录数/iu.test(text)) return 0;
    return keywordScore(text, [
        "amount", "money", "price", "total", "count", "quantity", "number", "score", "rate", "progress",
        "budget", "cost", "fee", "tax", "discount", "income", "expense", "balance", "point", "weight",
        "volume", "area", "duration", "hour", "day",
        "金额", "总额", "价格", "数量", "个数", "积分", "比例", "进度", "余额", "预算", "成本", "费用",
        "税额", "折扣", "收入", "支出", "重量", "体积", "面积", "时长", "工时", "天数", "评分", "完成度"
    ], 120);
}

export function isMeaningfulFormBannerMetricField(field) {
    return metricScore(field) > 0;
}

export function getFormBannerChildRelationFields(fields) {
    return (Array.isArray(fields) ? fields : []).filter((field) => {
        if (!isVisibleBusinessField(field) || fieldComponent(field) !== "TableChild") return false;
        const config = fieldConfig(field);
        const tableChild = isRecord(config.TableChild) ? config.TableChild : {};
        return Boolean(stringValue(config.TableChildTableId || tableChild.TableChildTableId)
            && stringValue(config.TableChildSysMenuId || tableChild.TableChildSysMenuId)
            && stringValue(config.TableChildFkFieldName || tableChild.TableChildFkFieldName));
    });
}

/**
 * Convert one authorized TableChild query into compact record-related metrics.
 * The server response may contain full-row DataCount plus SUM values from the
 * child module. Only semantically meaningful numeric fields are surfaced.
 */
export function buildFormBannerRelatedMetrics(relationField, childFields, response, maxItems = 3) {
    if (!response || Number(response.Code) !== 1) return [];
    const relationName = fieldName(relationField) || "TableChild";
    const relationLabel = stringValue(relationField && relationField.Label) || "关联明细";
    const statistics = isRecord(response.DataAppend) && isRecord(response.DataAppend.StatisticsFields)
        ? response.DataAppend.StatisticsFields
        : {};
    const statisticsByName = new Map(Object.entries(statistics).map(([key, value]) => [key.toLowerCase(), value]));
    const countValue = Number(response.DataCount);
    const hasRows = Number.isFinite(countValue) && countValue > 0;
    const sumMetrics = hasRows
        ? (Array.isArray(childFields) ? childFields : [])
            .map((field, index) => ({ field, index, score: metricScore(field) }))
            .filter((item) => item.score > 0 && statisticsByName.has(fieldName(item.field).toLowerCase()))
            .sort((left, right) => right.score - left.score || left.index - right.index)
            .map(({ field }) => {
                const name = fieldName(field);
                const value = statisticsByName.get(name.toLowerCase());
                if (value === undefined || value === null || value === "") return null;
                return {
                    Key: `child:${relationName}:${name}`,
                    Label: `${stringValue(field.Label) || name}合计`,
                    Value: value,
                    Icon: "fas fa-calculator",
                    Source: "TableChild",
                    SourceLabel: relationLabel
                };
            })
            .filter(Boolean)
        : [];
    const countMetric = Number.isFinite(countValue)
        ? [{
            Key: `child:${relationName}:count`,
            Label: `${relationLabel}数量`,
            Value: countValue,
            Suffix: "条",
            Icon: "fas fa-list-ol",
            Source: "TableChild",
            SourceLabel: relationLabel
        }]
        : [];
    const limit = Math.max(0, Math.min(6, Number(maxItems) || 0));
    return sumMetrics.concat(countMetric).slice(0, limit);
}

function normalizeTagDescriptors(value) {
    return (parseDescriptorList(value) || []).map((item, index) => {
        if (typeof item === "string") return { Key: item, Field: item };
        if (!isRecord(item)) return null;
        const field = stringValue(item.Field || item.Name);
        const key = stringValue(item.Key || field || `tag-${index}`);
        return key ? { ...item, Key: key, Field: field } : null;
    }).filter(Boolean);
}

function normalizeMetricDescriptors(value) {
    return (parseDescriptorList(value) || []).map((item, index) => {
        if (typeof item === "string") return { Key: item, Field: item };
        if (!isRecord(item)) return null;
        const field = stringValue(item.Field || item.Name);
        const key = stringValue(item.Key || field || `metric-${index}`);
        return key ? {
            ...item,
            Key: key,
            Field: field,
            ApiEngineKey: stringValue(item.ApiEngineKey || item.ApiKey),
            ValuePath: stringValue(item.ValuePath || item.Path),
            RefreshSeconds: normalizeRefreshSeconds(item.RefreshSeconds)
        } : null;
    }).filter(Boolean);
}

function hasRecordScopeReference(value, depth = 0) {
    if (depth > 5 || value === undefined || value === null) return false;
    if (typeof value === "string") {
        return /(?:^|[^a-z])(form|record|currentrecord|row)\s*(?:\.|\[)|recordid|formid/iu.test(value);
    }
    if (Array.isArray(value)) return value.some((item) => hasRecordScopeReference(item, depth + 1));
    if (!isRecord(value)) return false;
    return Object.entries(value).some(([key, item]) => (
        /recordid|formid/iu.test(key) || hasRecordScopeReference(item, depth + 1)
    ));
}

function isRecordScopedLegacyMetric(metric) {
    if (typeof metric === "string") return Boolean(stringValue(metric));
    if (!isRecord(metric)) return false;
    if (normalizeEnabled(metric.RecordScoped, false)) return true;
    if (["record", "currentrecord", "row"].includes(stringValue(metric.Scope).toLowerCase())) return true;

    const field = stringValue(metric.Field || metric.Name);
    const source = stringValue(metric.Source).toLowerCase();
    if (field && (!source || source === "field" || source === "record")) return true;

    return Boolean(stringValue(metric.ApiEngineKey || metric.ApiKey))
        && hasRecordScopeReference(metric.ParamMap || metric.Params || metric.ApiParams);
}

/**
 * Old module views used one Hero contract for both list pages and record forms.
 * Keep its visual identity during the compatibility migration, but never carry
 * list-wide counts into a record Banner. Removing a non-record Metrics property
 * deliberately re-enables the form engine's semantic field/TableChild defaults.
 */
export function migrateLegacyModuleHeroBanner(hero) {
    const parsed = parseJson(hero);
    if (!isRecord(parsed)) return {};
    const result = { ...parsed };
    if (!own(parsed, "Metrics")) return result;

    const metrics = parseDescriptorList(parsed.Metrics) || [];
    const recordMetrics = metrics.filter(isRecordScopedLegacyMetric);
    if (recordMetrics.length > 0) result.Metrics = recordMetrics;
    else delete result.Metrics;
    return result;
}

export function inferFormBannerConfig(fields, table = {}) {
    const candidates = (Array.isArray(fields) ? fields : []).filter(isVisibleBusinessField);
    const title = bestField(candidates, titleScore);
    const subtitle = bestField(candidates, (field, index) => subtitleScore(field, index, title));
    const image = candidates.find((field) => IMAGE_COMPONENTS.has(fieldComponent(field)));
    const tags = candidates
        .map((field, index) => ({ field, score: tagScore(field, index) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map(({ field }) => ({
            Key: fieldName(field),
            Field: fieldName(field),
            Label: field.Label || fieldName(field),
            Auto: true
        }));
    const metrics = candidates
        .map((field) => ({ field, score: metricScore(field) }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map(({ field }) => ({ Key: fieldName(field), Field: fieldName(field), Label: field.Label || fieldName(field) }));

    return {
        Enabled: true,
        TitleField: fieldName(title),
        SubtitleField: fieldName(subtitle),
        ImageField: fieldName(image),
        Icon: stringValue(table.FormBannerIcon || "far fa-file-alt"),
        BackgroundField: "",
        Tags: tags,
        Metrics: metrics,
        _Inferred: true
    };
}

/** 显式空字符串表示不绑定字段；省略/null 兼容旧库推断，空值不能被旧字段别名覆盖。 */
function configuredBannerField(source, keys, fallback = "") {
    for (const key of keys) {
        if (own(source, key) && typeof source[key] === "string") return stringValue(source[key]);
    }
    return fallback;
}

/** 保留设计者选择的空字段、空标签和空指标；未选择的配置仍使用类型感知的存量默认。 */
export function normalizeFormBannerConfig(config, fields, table = {}) {
    const source = isRecord(config) ? config : {};
    const inferred = inferFormBannerConfig(fields, table);
    const tagsConfigured = own(source, "Tags") || own(source, "TagFields");
    const metricsConfigured = own(source, "Metrics");
    const enabledValue = own(source, "Enabled") ? source.Enabled : source.Visible;
    const result = {
        ...inferred,
        ...source,
        Enabled: normalizeEnabled(enabledValue, true),
        TitleField: configuredBannerField(source, ["TitleField", "FallbackTitleField"], inferred.TitleField),
        SubtitleField: configuredBannerField(source, ["SubtitleField", "MetaField"], inferred.SubtitleField),
        ImageField: configuredBannerField(source, ["ImageField"], inferred.ImageField),
        BackgroundField: configuredBannerField(source, ["BackgroundField"]),
        Icon: stringValue(source.Icon || inferred.Icon),
        Tags: tagsConfigured
            ? normalizeTagDescriptors(own(source, "Tags") ? source.Tags : source.TagFields)
            : (source.StatusField
                ? normalizeTagDescriptors([{ Field: source.StatusField, Label: source.StatusLabel || "状态" }])
                : inferred.Tags),
        Metrics: metricsConfigured ? normalizeMetricDescriptors(source.Metrics) : inferred.Metrics
    };
    result._Inferred = !Object.keys(source).some((key) => !key.startsWith("_"));
    result._MetricsInferred = !metricsConfigured
        || (result.Metrics.length > 0 && result.Metrics.every((metric) => metric.Auto === true));
    return result;
}

export function normalizeRefreshSeconds(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.min(3600, Math.max(15, numeric));
}

export function collectFormBannerMetricApiGroups(metrics) {
    const groups = new Map();
    (Array.isArray(metrics) ? metrics : []).forEach((metric, index) => {
        const apiEngineKey = stringValue(metric && metric.ApiEngineKey);
        if (!apiEngineKey) return;
        const key = stringValue(metric.Key || metric.Field || `metric-${index}`);
        if (!key || FORBIDDEN_KEYS.has(key)) return;
        if (!groups.has(apiEngineKey)) groups.set(apiEngineKey, []);
        groups.get(apiEngineKey).push({ metric, index, key });
    });
    return groups;
}

export function getBannerValueByPath(source, path, fallback) {
    if (!path) return source === undefined ? fallback : source;
    const segments = String(path).replace(/\[(\d+)\]/g, ".$1").split(".").map((item) => item.trim()).filter(Boolean);
    let current = source;
    for (const segment of segments) {
        if (FORBIDDEN_KEYS.has(segment) || current === undefined || current === null) return fallback;
        if (!Object.prototype.hasOwnProperty.call(Object(current), segment)) return fallback;
        current = current[segment];
    }
    return current === undefined ? fallback : current;
}

export function resolveFormBannerMetricValue(response, descriptor) {
    const metric = descriptor && (descriptor.metric || descriptor.Metric || descriptor);
    const key = stringValue(descriptor && descriptor.key || metric && (metric.Key || metric.Field));
    if (!metric) return undefined;
    if (metric.ValuePath) return getBannerValueByPath(response, metric.ValuePath, metric.DefaultValue);
    const data = isRecord(response) && own(response, "Data") ? response.Data : response;
    if (isRecord(data)) {
        const candidates = [
            getBannerValueByPath(data, `Metrics.${key}`),
            getBannerValueByPath(data, `metrics.${key}`),
            own(data, key) ? data[key] : undefined
        ];
        const value = candidates.find((item) => item !== undefined);
        if (value !== undefined) return value;
    } else if (data !== undefined && data !== null) {
        return data;
    }
    return metric.DefaultValue;
}

export function getFormBannerMetricRefreshSeconds(metrics) {
    return (Array.isArray(metrics) ? metrics : [])
        .map((metric) => normalizeRefreshSeconds(metric && metric.RefreshSeconds))
        .filter(Boolean)
        .sort((left, right) => left - right)[0] || 0;
}

export function firstBannerFilePath(value) {
    const parsed = parseJson(value);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
        if (typeof item === "string" && item.trim()) return item.trim();
        if (!isRecord(item)) continue;
        const path = stringValue(item.Path || item.Url || item.FilePath || item.FilePathName || item.path || item.url);
        if (path) return path;
    }
    return "";
}

export function isPrivateBannerUploadField(field) {
    const config = parseJson(field && field.Config);
    if (!isRecord(config)) return false;
    const componentConfig = config.ImgUpload || config.ImageUpload || config.FileUpload;
    return isRecord(componentConfig) && normalizeEnabled(componentConfig.Limit, false);
}

export default {
    inferFormBannerConfig,
    normalizeFormBannerConfig,
    collectFormBannerMetricApiGroups,
    resolveFormBannerMetricValue,
    getFormBannerMetricRefreshSeconds,
    getBannerValueByPath,
    firstBannerFilePath,
    isPrivateBannerUploadField,
    isMeaningfulFormBannerMetricField,
    getFormBannerChildRelationFields,
    buildFormBannerRelatedMetrics
};
