const VIEW_SCENES = ["Detail", "Edit", "List", "Card"];
const VIEW_DEVICES = ["PC", "Mobile", "All"];
const ACTION_TYPES = [
    "ApiEngine", "OpenDetail", "OpenList", "OpenForm", "Navigate",
    "Dial", "Scan", "Map", "Refresh", "Back", "Copy"
];
const CONDITION_OPERATORS = [
    "=", "==", "!=", "<>", ">", ">=", "<", "<=", "In", "NotIn",
    "Contains", "NotContains", "IsEmpty", "IsNotEmpty"
];

function parseObject(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        return {};
    }
}

function canonical(value, values, fallback = "") {
    const source = String(value || "").trim().toLowerCase();
    return values.find((item) => item.toLowerCase() === source) || fallback;
}

function stringList(value) {
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) return [...new Set(value.flatMap(stringList).filter(Boolean))];
    if (typeof value === "object") return stringList(value.Id || value.Value || value.Name);
    const text = String(value).trim();
    if (!text) return [];
    if (text.startsWith("[") || text.startsWith('"')) {
        try {
            return stringList(JSON.parse(text));
        } catch (error) {}
    }
    return [...new Set(text.split(/[,;|]/).map((item) => item.trim()).filter(Boolean))];
}

function normalizeField(field) {
    const source = typeof field === "string" ? { Name: field } : (field || {});
    const name = String(source.Name || source.name || source.Field || source.field || "").trim();
    if (!name) return null;
    const result = { Name: name };
    const label = String(source.Label || source.label || "").trim();
    const format = String(source.Format || source.format || "").trim();
    const asName = String(source.AsName || source.asName || "").trim();
    const width = Number(source.Width || source.width || source.Span || source.span);
    if (label) result.Label = label;
    if (format) result.Format = format;
    if (asName) result.AsName = asName;
    if (Number.isFinite(width) && width > 0) result.Width = Math.min(24, width);
    ["Icon", "Tone", "Color", "Position", "DisplayStyle", "Prefix", "Suffix", "FontWeight"].forEach((key) => {
        const value = source[key] ?? source[key.charAt(0).toLowerCase() + key.slice(1)];
        if (String(value || "").trim()) result[key] = String(value).trim();
    });
    if (source.ShowLabel !== undefined || source.showLabel !== undefined) {
        result.ShowLabel = ![false, 0, "0", "false"].includes(source.ShowLabel ?? source.showLabel);
    }
    return result;
}

function normalizeMetric(metric) {
    const source = metric || {};
    const field = String(source.Field || source.field || "").trim();
    const apiEngineKey = String(source.ApiEngineKey || source.apiEngineKey || "").trim();
    const declaredSource = canonical(source.Source || source.source, ["Field", "ApiEngine", "DataCount", "PageCount"], "");
    const metricSource = apiEngineKey
        ? "ApiEngine"
        : (field ? "Field" : (declaredSource === "DataCount" || declaredSource === "PageCount" ? declaredSource : ""));
    if (!metricSource) return null;
    const sourceLabel = metricSource === "DataCount" ? "总记录数" : (metricSource === "PageCount" ? "本页加载" : "指标");
    return {
        Key: String(source.Key || source.key || field || apiEngineKey || metricSource),
        Label: String(source.Label || source.label || field || sourceLabel),
        Field: field,
        ApiEngineKey: apiEngineKey,
        Source: metricSource,
        ValuePath: String(source.ValuePath || source.valuePath || ""),
        TrendPath: String(source.TrendPath || source.trendPath || ""),
        TrendLabel: String(source.TrendLabel || source.trendLabel || ""),
        Prefix: String(source.Prefix || source.prefix || ""),
        Suffix: String(source.Suffix || source.suffix || source.Unit || source.unit || ""),
        Format: String(source.Format || source.format || ""),
        Icon: String(source.Icon || source.icon || ""),
        Color: String(source.Color || source.color || ""),
        Tone: String(source.Tone || source.tone || ""),
        DefaultValue: source.DefaultValue !== undefined ? source.DefaultValue : source.defaultValue,
        RefreshSeconds: Math.min(3600, Math.max(0, Number(source.RefreshSeconds || source.refreshSeconds || 0))),
        ParamMap: normalizeParamValue(source.ParamMap || source.paramMap || source.Params || source.params) || {}
    };
}

function normalizeColumn(column, index) {
    const source = typeof column === "string" ? { Field: column } : (column || {});
    const field = String(source.Field || source.field || source.Name || source.name || "").trim();
    if (!field) return null;
    const lines = source.Lines || source.lines || source.SubFields || source.subFields || [];
    const trailing = source.TrailingFields || source.trailingFields || source.Trailing || source.trailing || [];
    const required = source.RequiredFields || source.requiredFields || [];
    return {
        Key: String(source.Key || source.key || `column:${index}`),
        Field: field,
        Lines: (Array.isArray(lines) ? lines : stringList(lines)).map(normalizeField).filter(Boolean).slice(0, 6),
        TrailingFields: (Array.isArray(trailing) ? trailing : stringList(trailing)).map(normalizeField).filter(Boolean).slice(0, 4),
        RequiredFields: stringList(required).slice(0, 20),
        Align: canonical(source.Align || source.align, ["Left", "Center", "Right"], "Left"),
        MinWidth: Math.min(1200, Math.max(0, Number(source.MinWidth || source.minWidth || 0)))
    };
}

function normalizeCard(value) {
    const source = parseObject(value);
    const normalizeFields = (...names) => {
        const raw = names.map((name) => source[name]).find((item) => item !== undefined && item !== null) || [];
        return (Array.isArray(raw) ? raw : stringList(raw)).map(normalizeField).filter(Boolean).slice(0, 12);
    };
    const statusFields = normalizeFields("StatusFields", "statusFields");
    const statusField = String(source.StatusField || source.statusField || "").trim();
    if (statusField && !statusFields.some((item) => item.Name === statusField)) {
        statusFields.unshift({ Name: statusField, DisplayStyle: "Tag" });
    }
    return {
        Preset: String(source.Preset || source.preset || "Business"),
        AvatarField: String(source.AvatarField || source.avatarField || ""),
        AvatarTextField: String(source.AvatarTextField || source.avatarTextField || ""),
        TitleField: String(source.TitleField || source.titleField || ""),
        AccentField: String(source.AccentField || source.accentField || ""),
        SubtitleFields: normalizeFields("SubtitleFields", "subtitleFields"),
        StatusFields: statusFields,
        TopFields: normalizeFields("TopFields", "topFields"),
        RightFields: normalizeFields("RightFields", "rightFields"),
        Fields: normalizeFields("Fields", "fields"),
        MetaFields: normalizeFields("MetaFields", "metaFields"),
        BottomFields: normalizeFields("BottomFields", "bottomFields"),
        HideIndex: [true, 1, "1", "true"].includes(source.HideIndex ?? source.hideIndex),
        ShowCreateTime: ![false, 0, "0", "false"].includes(source.ShowCreateTime ?? source.showCreateTime),
        ShowUpdateTime: [true, 1, "1", "true"].includes(source.ShowUpdateTime ?? source.showUpdateTime)
    };
}

function normalizeCondition(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const rules = (Array.isArray(value.Rules || value.rules) ? (value.Rules || value.rules) : [])
        .map((rule) => {
            const field = String(rule?.Field || rule?.field || "").trim();
            const operator = canonical(rule?.Operator || rule?.operator, CONDITION_OPERATORS, "=");
            if (!field) return null;
            return {
                Field: field,
                Operator: operator,
                Value: rule.Value !== undefined ? rule.Value : rule.value
            };
        })
        .filter(Boolean);
    return rules.length
        ? { Mode: canonical(value.Mode || value.mode, ["All", "Any"], "All"), Rules: rules }
        : null;
}

function normalizeParamValue(value, depth = 0) {
    if (depth > 4 || value === undefined || typeof value === "function") return undefined;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
    if (Array.isArray(value)) {
        return value.map((item) => normalizeParamValue(item, depth + 1))
            .filter((item) => item !== undefined);
    }
    if (typeof value === "object") {
        const result = {};
        Object.keys(value).slice(0, 50).forEach((key) => {
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
            const normalized = normalizeParamValue(value[key], depth + 1);
            if (normalized !== undefined) result[key] = normalized;
        });
        return result;
    }
    return undefined;
}

function normalizeAction(action, index) {
    const source = action || {};
    const actionType = canonical(
        source.ActionType || source.actionType || source.Type || source.type,
        ACTION_TYPES
    );
    if (!actionType) return null;
    const apiEngineKey = String(source.ApiEngineKey || source.apiEngineKey || "").trim();
    if (actionType === "ApiEngine" && !apiEngineKey) return null;
    const result = {
        Key: String(source.Key || source.key || source.Id || source.id || `action:${index}`),
        Label: String(source.Label || source.label || source.Name || source.name || "操作"),
        ActionType: actionType
    };
    const stringFields = {
        Icon: ["Icon", "icon"],
        Tone: ["Tone", "tone", "BtnStyle", "btnStyle"],
        Confirm: ["Confirm", "confirm", "ConfirmText", "confirmText"],
        ApiEngineKey: ["ApiEngineKey", "apiEngineKey"],
        Target: ["Target", "target", "Path", "path"],
        TableName: ["TableName", "tableName", "Table", "table"],
        ModuleEngineKey: ["ModuleEngineKey", "moduleEngineKey"],
        SuccessMessage: ["SuccessMessage", "successMessage"]
    };
    Object.entries(stringFields).forEach(([target, names]) => {
        const value = names.map((name) => source[name]).find((item) => item !== undefined && item !== null);
        if (String(value || "").trim()) result[target] = String(value).trim();
    });
    const paramMap = normalizeParamValue(source.ParamMap || source.paramMap || source.Params || source.params);
    if (paramMap && Object.keys(paramMap).length) result.ParamMap = paramMap;
    const visibleWhen = normalizeCondition(source.VisibleWhen || source.visibleWhen);
    if (visibleWhen) result.VisibleWhen = visibleWhen;
    const successActions = source.SuccessActions || source.successActions || [];
    if (Array.isArray(successActions)) {
        result.SuccessActions = successActions.map(normalizeAction).filter(Boolean).slice(0, 10);
    }
    return result;
}

function normalizeBlock(block, index) {
    const source = block || {};
    const fields = Array.isArray(source.Fields || source.fields) ? (source.Fields || source.fields) : [];
    const metrics = Array.isArray(source.Metrics || source.metrics) ? (source.Metrics || source.metrics) : [];
    const actions = Array.isArray(source.Actions || source.actions) ? (source.Actions || source.actions) : [];
    return {
        Key: String(source.Key || source.key || source.Id || source.id || `block:${index}`),
        Type: String(source.Type || source.type || "ResponsiveSection"),
        Title: String(source.Title || source.title || source.Name || source.name || "详细信息"),
        Icon: String(source.Icon || source.icon || ""),
        Columns: Math.min(4, Math.max(1, Number(source.Columns || source.columns || 2))),
        DefaultExpanded: source.DefaultExpanded === undefined
            ? index === 0
            : ![false, 0, "0", "false"].includes(source.DefaultExpanded),
        Fields: fields.map(normalizeField).filter(Boolean),
        Metrics: metrics.map(normalizeMetric).filter(Boolean),
        Actions: actions.map(normalizeAction).filter(Boolean)
    };
}

function normalizeLayout(value) {
    const source = parseObject(value);
    const heroSource = source.Hero || source.hero || {};
    const listSource = source.List || source.list || {};
    const cardSource = source.Card || source.card || {};
    const blocks = source.Blocks || source.blocks || source.Sections || source.sections || [];
    const metrics = heroSource.Metrics || heroSource.metrics || [];
    const actions = source.Actions || source.actions || source.ActionSchema || source.actionSchema || [];
    const columns = listSource.Columns || listSource.columns || [];
    return {
        Preset: String(source.Preset || source.preset || ""),
        Hero: {
            Title: String(heroSource.Title || heroSource.title || ""),
            Eyebrow: String(heroSource.Eyebrow || heroSource.eyebrow || ""),
            Description: String(heroSource.Description || heroSource.description || ""),
            Icon: String(heroSource.Icon || heroSource.icon || ""),
            Background: String(heroSource.Background || heroSource.background || ""),
            ImageField: String(heroSource.ImageField || heroSource.imageField || ""),
            TitleField: String(heroSource.TitleField || heroSource.titleField || ""),
            FallbackTitleField: String(heroSource.FallbackTitleField || heroSource.fallbackTitleField || ""),
            StatusField: String(heroSource.StatusField || heroSource.statusField || ""),
            MetaField: String(heroSource.MetaField || heroSource.metaField || ""),
            Metrics: (Array.isArray(metrics) ? metrics : []).map(normalizeMetric).filter(Boolean).slice(0, 6)
        },
        List: {
            Density: canonical(listSource.Density || listSource.density, ["Compact", "Comfortable"], "Comfortable"),
            Columns: (Array.isArray(columns) ? columns : []).map(normalizeColumn).filter(Boolean).slice(0, 80)
        },
        Card: normalizeCard(cardSource),
        Blocks: (Array.isArray(blocks) ? blocks : []).map(normalizeBlock).slice(0, 50),
        Actions: (Array.isArray(actions) ? actions : []).map(normalizeAction).filter(Boolean).slice(0, 30)
    };
}

export function getModuleViewFieldNames(view) {
    if (!view || !view.Layout) return [];
    const names = [];
    const push = (value) => {
        const name = typeof value === "string" ? value : value?.Name;
        if (name && !names.includes(name)) names.push(name);
    };
    const hero = view.Layout.Hero || {};
    [hero.ImageField, hero.TitleField, hero.FallbackTitleField, hero.StatusField, hero.MetaField].forEach(push);
    (hero.Metrics || []).forEach((metric) => push(metric.Field));
    ((view.Layout.List || {}).Columns || []).forEach((column) => {
        push(column.Field);
        (column.Lines || []).forEach(push);
        (column.TrailingFields || []).forEach(push);
        (column.RequiredFields || []).forEach(push);
    });
    const card = view.Layout.Card || {};
    [card.AvatarField, card.AvatarTextField, card.TitleField, card.AccentField].forEach(push);
    ["SubtitleFields", "StatusFields", "TopFields", "RightFields", "Fields", "MetaFields", "BottomFields"]
        .forEach((key) => (card[key] || []).forEach(push));
    return names;
}

function fieldReferenceKeys(reference) {
    if (!reference) return [];
    if (typeof reference === "string") {
        const value = reference.trim();
        return value ? [value] : [];
    }
    if (typeof reference !== "object") return [];
    return [...new Set([
        reference.Name,
        reference.name,
        reference.Field,
        reference.field,
        reference.AsName,
        reference.asName,
        reference.Id,
        reference.id
    ].map((value) => String(value || "").trim()).filter(Boolean))];
}

/**
 * Remove fields already rendered as composite-column lines/trailing values from
 * the ordinary table columns. A field declared as any composite column's
 * primary Field always wins, even when another column also references it as an
 * auxiliary value.
 */
export function filterStandaloneListFields(fields, view) {
    const source = Array.isArray(fields) ? fields : [];
    const columns = view?.Layout?.List?.Columns;
    if (!Array.isArray(columns) || !columns.length) return source;

    const primaryKeys = new Set();
    const auxiliaryKeys = new Set();
    columns.forEach((column) => {
        fieldReferenceKeys(column?.Field).forEach((key) => primaryKeys.add(key));
        [...(column?.Lines || []), ...(column?.TrailingFields || [])]
            .forEach((reference) => fieldReferenceKeys(reference).forEach((key) => auxiliaryKeys.add(key)));
    });
    if (!auxiliaryKeys.size) return source;

    return source.filter((field) => {
        const keys = fieldReferenceKeys(field);
        if (keys.some((key) => primaryKeys.has(key))) return true;
        return !keys.some((key) => auxiliaryKeys.has(key));
    });
}

function roleIds(user) {
    const source = user || {};
    return stringList([source.RoleIds, source.RoleId, source.SysRoleIds, source.RoleName])
        .map((item) => item.toLowerCase());
}

function matchesRole(view, user) {
    const required = stringList(view.RoleIds || view.roleIds || view.Roles || view.roles)
        .map((item) => item.toLowerCase());
    if (!required.length) return true;
    const current = new Set(roleIds(user));
    return required.some((item) => current.has(item));
}

export function selectModuleView(menu, options = {}) {
    if (!menu || Number(menu.EnableViewSchema || 0) !== 1) return null;
    const schema = parseObject(menu.ViewSchema);
    const views = Array.isArray(schema.Views || schema.views) ? (schema.Views || schema.views) : [];
    const scene = canonical(options.scene, VIEW_SCENES, "Detail");
    const device = canonical(options.device, VIEW_DEVICES, "PC");
    return views
        .map((source, index) => {
            const viewScene = canonical(source.Scene || source.scene, VIEW_SCENES);
            const viewDevice = canonical(source.Device || source.device, VIEW_DEVICES, "All");
            const enabled = ![false, 0, "0", "false"].includes(source.Enabled);
            if (!enabled || viewScene !== scene) return null;
            if (viewDevice !== "All" && viewDevice !== device) return null;
            if (!matchesRole(source, options.user)) return null;
            return {
                Key: String(source.Key || source.key || source.Id || source.id || `view:${index}`),
                Scene: viewScene,
                Device: viewDevice,
                Priority: Number(source.Priority || source.priority || 0),
                Layout: normalizeLayout(source.Layout || source.layout || source.LayoutJson || source.layoutJson),
                _score: (viewDevice === device ? 1000 : 100) +
                    (stringList(source.RoleIds || source.roleIds).length ? 100 : 0) +
                    Number(source.Priority || source.priority || 0),
                _index: index
            };
        })
        .filter(Boolean)
        .sort((left, right) => right._score - left._score || left._index - right._index)[0] || null;
}

export function hasModuleDetailView(menu, user) {
    return Boolean(selectModuleView(menu, { scene: "Detail", device: "PC", user }));
}

function isEmpty(value) {
    return value === undefined || value === null || value === "" ||
        (Array.isArray(value) && value.length === 0);
}

function evaluateRule(rule, form) {
    const left = form ? form[rule.Field] : undefined;
    const right = rule.Value;
    switch (rule.Operator) {
        case "=":
        case "==": return String(left ?? "") === String(right ?? "");
        case "!=":
        case "<>": return String(left ?? "") !== String(right ?? "");
        case ">": return Number(left) > Number(right);
        case ">=": return Number(left) >= Number(right);
        case "<": return Number(left) < Number(right);
        case "<=": return Number(left) <= Number(right);
        case "In": return stringList(right).map(String).includes(String(left ?? ""));
        case "NotIn": return !stringList(right).map(String).includes(String(left ?? ""));
        case "Contains": return String(left ?? "").includes(String(right ?? ""));
        case "NotContains": return !String(left ?? "").includes(String(right ?? ""));
        case "IsEmpty": return isEmpty(left);
        case "IsNotEmpty": return !isEmpty(left);
        default: return false;
    }
}

export function isActionVisible(action, form) {
    const condition = action?.VisibleWhen;
    if (!condition || !Array.isArray(condition.Rules) || !condition.Rules.length) return true;
    const values = condition.Rules.map((rule) => evaluateRule(rule, form || {}));
    return condition.Mode === "Any" ? values.some(Boolean) : values.every(Boolean);
}

export default {
    selectModuleView,
    hasModuleDetailView,
    getModuleViewFieldNames,
    filterStandaloneListFields,
    isActionVisible
};
