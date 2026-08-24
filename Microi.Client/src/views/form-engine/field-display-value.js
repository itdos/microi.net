const OPTION_COMPONENTS = new Set([
    "Select", "MultipleSelect", "Radio", "Checkbox", "Autocomplete", "Transfer"
]);
const TREE_COMPONENTS = new Set(["Cascader", "SelectTree", "Department"]);
const RECORD_TITLE_COMPONENTS = new Set([
    "Text", "AutoNumber", "Select", "MultipleSelect", "Radio", "Checkbox",
    "Switch", "Autocomplete", "Transfer", "Cascader", "SelectTree",
    "Department", "Address", "TagInput", "TreeCheckbox"
]);
const RECORD_TITLE_EXCLUDED_COMPONENTS = new Set([
    "Button", "CodeEditor", "CollapseGroup", "Divider", "FileUpload", "Html",
    "HTML", "ImgUpload", "JoinForm", "Map", "MapArea", "Qrcode", "RichText",
    "StaticText", "TableChild", "Tabs"
]);
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isBlank(value) {
    return value === undefined || value === null || value === "" ||
        (Array.isArray(value) && value.length === 0);
}

function parseObject(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
        return {};
    }
}

function parseValue(value) {
    if (typeof value !== "string") return value;
    const text = value.trim();
    if (!text || !["[", "{"].includes(text[0])) return value;
    try { return JSON.parse(text); } catch (_error) { return value; }
}

function uniqueKeys(values) {
    return [...new Set(values.map((item) => String(item || "").trim()).filter((item) => item && !FORBIDDEN_KEYS.has(item)))];
}

function objectValue(item, keys) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    for (const key of uniqueKeys(keys)) {
        if (!isBlank(item[key])) return item[key];
    }
    return undefined;
}

function valueCandidates(item, config) {
    if (isBlank(item)) return [];
    if (!item || typeof item !== "object" || Array.isArray(item)) return [item];
    return uniqueKeys([
        config.SelectSaveField, "Key", "key", "Id", "id", "Value", "value",
        config.SelectLabel, "Name", "name", "Label", "label", "Text", "text"
    ]).map((key) => item[key]).filter((value) => !isBlank(value));
}

function valuesEqual(left, right) {
    if (isBlank(left) || isBlank(right)) return false;
    return left == right || String(left) === String(right);
}

function optionLabel(item, config) {
    if (isBlank(item)) return "";
    if (!item || typeof item !== "object" || Array.isArray(item)) return String(item);
    const value = objectValue(item, [
        config.SelectLabel, "Label", "label", "Name", "name", "Text", "text",
        "Value", "value", config.SelectSaveField, "Key", "key", "Id", "id"
    ]);
    return isBlank(value) ? "" : String(value);
}

function treeChildren(node, field, config) {
    const treeConfig = field.Component === "Cascader"
        ? parseObject(config.Cascader)
        : (field.Component === "Department" ? parseObject(config.Department) : parseObject(config.SelectTree));
    const key = uniqueKeys([treeConfig.Children, "_Child", "children", "Children"])
        .find((candidate) => Array.isArray(node && node[candidate]));
    return key ? node[key] : [];
}

function findOption(value, field, config) {
    const expected = valueCandidates(value, config);
    if (!expected.length) return null;
    const visit = (items) => {
        for (const item of Array.isArray(items) ? items : []) {
            const candidates = valueCandidates(item, config);
            if (expected.some((left) => candidates.some((right) => valuesEqual(left, right)))) return item;
            const child = visit(treeChildren(item, field, config));
            if (child) return child;
        }
        return null;
    };
    return visit(field.Data);
}

function stringifyFallback(value) {
    if (isBlank(value)) return "";
    if (Array.isArray(value)) return value.map(stringifyFallback).filter(Boolean).join(" / ");
    if (value && typeof value === "object") {
        const label = objectValue(value, ["Label", "label", "Name", "name", "Text", "text", "Value", "value", "Key", "key", "Id", "id"]);
        if (!isBlank(label)) return String(label);
        try { return JSON.stringify(value); } catch (_error) { return ""; }
    }
    return String(value);
}

function formatSingle(value, field, config) {
    if (isBlank(value)) return "";
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const direct = optionLabel(value, config);
        if (direct) return direct;
    }
    const matched = findOption(value, field, config);
    if (matched) return optionLabel(matched, config);
    return stringifyFallback(value);
}

function formatTreeValue(value, field, config) {
    const parsed = parseValue(value);
    if (!Array.isArray(parsed)) return formatSingle(parsed, field, config);
    if (!parsed.length) return "";
    const treeConfig = field.Component === "Cascader"
        ? parseObject(config.Cascader)
        : (field.Component === "Department" ? parseObject(config.Department) : parseObject(config.SelectTree));
    const formatPath = (path) => {
        if (!Array.isArray(path)) return formatSingle(path, field, config);
        if (field.Component === "Department") return formatSingle(path[path.length - 1], field, config);
        return path.map((item) => formatSingle(item, field, config)).filter(Boolean).join(" / ");
    };
    if (parsed.some(Array.isArray)) return parsed.map(formatPath).filter(Boolean).join("、");
    // 旧部门字段可能在 EmitPath 从 true 调整为 false 后仍保留完整路径数组。
    // 单选部门始终以末级节点作为业务值，避免误显示成多个部门。
    if (field.Component === "Department" && treeConfig.Multiple !== true) {
        return formatSingle(parsed[parsed.length - 1], field, config);
    }
    if ((field.Component === "Cascader" || field.Component === "Department") && treeConfig.EmitPath !== false) {
        return formatPath(parsed);
    }
    return parsed.map((item) => formatSingle(item, field, config)).filter(Boolean).join("、");
}

function formatOptionValue(value, field, config) {
    let parsed = parseValue(value);
    if (!Array.isArray(parsed)
        && ["MultipleSelect", "Checkbox", "Transfer"].includes(field.Component)
        && typeof parsed === "string" && parsed.includes(",")) {
        parsed = parsed.split(",").map((item) => item.trim()).filter(Boolean);
    }
    if (Array.isArray(parsed)) return parsed.map((item) => formatSingle(item, field, config)).filter(Boolean).join("、");
    return formatSingle(parsed, field, config);
}

function auxiliaryLabel(form, field) {
    const name = String(field.AsName || field.Name || "");
    const fieldName = String(field.Name || "");
    return objectValue(form, [
        `${name}Label`, `${name}Name`, `${name}Text`,
        `${fieldName}Label`, `${fieldName}Name`, `${fieldName}Text`
    ]);
}

function normalizeRecordTitleText(value) {
    if (isBlank(value)) return "";
    if (Array.isArray(value)) {
        return value.map(normalizeRecordTitleText).filter(Boolean).join("、");
    }
    if (value && typeof value === "object") {
        const label = objectValue(value, [
            "Label", "label", "Name", "name", "Text", "text", "Title", "title"
        ]);
        return isBlank(label) ? "" : normalizeRecordTitleText(label);
    }
    let text = String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!text || text === "—" || text === "-") return "";
    if (["[", "{"].includes(text[0])) {
        try {
            return normalizeRecordTitleText(JSON.parse(text));
        } catch (_error) {
            // A broken JSON payload is not a user-facing record title.
            return "";
        }
    }
    return text === "[object Object]" ? "" : text;
}

function mergeFieldDescriptor(descriptor, fields) {
    const definitions = Array.isArray(fields) ? fields : [];
    const isObjectDescriptor = descriptor && typeof descriptor === "object";
    const source = isObjectDescriptor ? descriptor : { Id: descriptor };
    const keys = uniqueKeys([source.Id, source.Name, source.AsName, descriptor]);
    const canonical = definitions.find((field) => field && keys.some((key) =>
        [field.Id, field.Name, field.AsName].some((value) => String(value || "") === key)
    ));
    if (!canonical) {
        return isObjectDescriptor ? source : { Id: descriptor, Name: descriptor };
    }
    return {
        ...canonical,
        ...source,
        Config: source.Config === undefined ? canonical.Config : source.Config,
        Data: source.Data === undefined ? canonical.Data : source.Data,
        Component: source.Component || canonical.Component,
        Name: source.Name || canonical.Name,
        AsName: source.AsName || canonical.AsName
    };
}

function canUseRecordTitleField(field) {
    if (!field || typeof field !== "object") return false;
    const component = String(field.Component || "").trim();
    if (RECORD_TITLE_EXCLUDED_COMPONENTS.has(component)) return false;
    if (!component) return true;
    return RECORD_TITLE_COMPONENTS.has(component);
}

function isUnresolvedRecordObjectValue(form, field, displayValue) {
    const fieldName = String(field.AsName || field.Name || "");
    const rawValue = form[fieldName] !== undefined ? form[fieldName] : form[field.Name];
    const parsed = parseValue(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    const config = parseObject(field.Config);
    const label = objectValue(parsed, [
        config.SelectLabel, "Label", "label", "Name", "name", "Text", "text", "Title", "title"
    ]);
    if (!isBlank(label)) return false;
    const identifier = objectValue(parsed, [
        config.SelectSaveField, "Id", "id", "Key", "key", "Value", "value"
    ]);
    return !isBlank(identifier) && String(identifier).trim() === String(displayValue || "").trim();
}

export function getFormFieldDisplayValue(form, field, options = {}) {
    const source = form && typeof form === "object" ? form : {};
    const definition = field && typeof field === "object" ? field : {};
    const config = parseObject(definition.Config);
    const fieldName = String(definition.AsName || definition.Name || "");
    const rawValue = source[fieldName] !== undefined ? source[fieldName] : source[definition.Name];
    const translated = source._BusinessTranslations && source._BusinessTranslations[fieldName];
    const emptyText = options.emptyText === undefined ? "—" : String(options.emptyText);
    if (!isBlank(translated)) return String(translated);
    if (isBlank(rawValue)) return emptyText;

    const auxiliary = auxiliaryLabel(source, definition);
    if (!isBlank(auxiliary) && (!rawValue || typeof rawValue !== "object")) return String(auxiliary);

    let result = "";
    if (definition.Component === "Address") {
        const value = parseValue(rawValue);
        result = Array.isArray(value) ? value.map(stringifyFallback).filter(Boolean).join(" / ") : stringifyFallback(value);
    } else if (definition.Component === "Switch") {
        const switchConfig = parseObject(config.Switch);
        const enabled = [true, 1, "1", "true"].includes(rawValue);
        result = enabled ? (switchConfig.ActiveText || "是") : (switchConfig.InactiveText || "否");
    } else if (TREE_COMPONENTS.has(definition.Component)) {
        result = formatTreeValue(rawValue, definition, config);
    } else if (OPTION_COMPONENTS.has(definition.Component) || config.SelectLabel || config.SelectSaveField) {
        result = formatOptionValue(rawValue, definition, config);
    } else if (definition.Component === "RichText") {
        result = String(rawValue).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    } else {
        result = stringifyFallback(parseValue(rawValue));
    }

    if (!result) return emptyText;
    const suffix = String(config.TextApend || "").trim();
    return suffix ? `${result} ${suffix}` : result;
}

/**
 * Resolve the record heading from the module query-column order. Layout, image,
 * code and other non-readable columns are skipped. Option/tree JSON values are
 * resolved through the field data source and only their user-facing label is
 * returned; unresolved object payloads never leak into the title bar.
 */
export function getFormRecordDisplayTitle(form, configuredFields, allFields) {
    const source = form && typeof form === "object" ? form : {};
    const definitions = Array.isArray(allFields) ? allFields : [];
    const configured = Array.isArray(configuredFields) && configuredFields.length
        ? configuredFields
        : definitions;
    for (const descriptor of configured) {
        const field = mergeFieldDescriptor(descriptor, definitions);
        if (!canUseRecordTitleField(field)) continue;
        const displayValue = getFormFieldDisplayValue(source, field, { emptyText: "" });
        if (isUnresolvedRecordObjectValue(source, field, displayValue)) continue;
        const value = normalizeRecordTitleText(displayValue);
        if (value) return value;
    }
    return "";
}

export function hasFormBannerConfig(config) {
    // Banner is a form-engine default. Old databases have no Banner object at
    // all, so absence must mean enabled; only an explicit false/0 disables it.
    if (!config || typeof config !== "object") return true;
    const value = Object.prototype.hasOwnProperty.call(config, "Enabled")
        ? config.Enabled
        : config.Visible;
    if (value === undefined || value === null || value === "") return true;
    if (value === false || value === 0) return false;
    return !["0", "false", "off", "no"].includes(String(value).trim().toLowerCase());
}

export default { getFormFieldDisplayValue, getFormRecordDisplayTitle, hasFormBannerConfig };
