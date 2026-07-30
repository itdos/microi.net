// zhy：统一判断下拉框已选值是否为空。
function isEmptyValue(value) {
    return value === null || value === undefined || value === "";
}

// zhy：兼容历史 JSON 字符串与原始值两种存储格式。
function parseStoredValue(value) {
    if (typeof value !== "string") return value;
    const text = value.trim();
    if (!text) return "";
    if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
        try {
            return JSON.parse(text);
        } catch (e) {
            return value;
        }
    }
    return value;
}

// zhy：按候选字段顺序读取第一个有效展示值。
function firstDisplayValue(item, keys) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return "";
    for (const key of keys) {
        if (key && !isEmptyValue(item[key])) return item[key];
    }
    return "";
}

// zhy：将对象、文本等历史已选值归一为下拉选项对象。
function normalizeSelectedOption(value, saveField, labelField) {
    if (isEmptyValue(value)) return null;

    if (typeof value === "object" && !Array.isArray(value)) {
        const option = { ...value };
        const identity = firstDisplayValue(option, [
            saveField,
            "Id",
            "id",
            "Key",
            "key",
            labelField,
            "Name",
            "name",
            "Value",
            "value"
        ]);
        const label = firstDisplayValue(option, [
            labelField,
            "Name",
            "name",
            "Value",
            "value",
            "Label",
            "label",
            saveField,
            "Id",
            "id"
        ]);
        if (saveField && isEmptyValue(option[saveField]) && !isEmptyValue(identity)) {
            option[saveField] = identity;
        }
        if (labelField && isEmptyValue(option[labelField]) && !isEmptyValue(label || identity)) {
            option[labelField] = label || identity;
        }
        return option;
    }

    const option = {};
    if (saveField) option[saveField] = value;
    if (labelField) option[labelField] = value;
    return option;
}

// zhy：生成选项稳定标识，用于去重远程结果与当前已选项。
function optionIdentity(option, saveField, labelField) {
    if (!option || typeof option !== "object") return "";
    const value = firstDisplayValue(option, [
        saveField,
        "Id",
        "id",
        "Key",
        "key",
        labelField,
        "Name",
        "name",
        "Value",
        "value"
    ]);
    return isEmptyValue(value) ? "" : String(value);
}

/**
 * zhy：远程搜索替换选项列表时仅保留表单当前已选值，
 * zhy：避免查看、编辑历史记录时已保存的关联值显示为空，同时不扩大远程接口返回的可选范围。
 */
export function mergeCurrentSelectOptions(remoteOptions, selectedValue, config, multiple) {
    const result = Array.isArray(remoteOptions) ? [...remoteOptions] : [];
    const parsed = parseStoredValue(selectedValue);
    const selected = multiple
        ? (Array.isArray(parsed) ? parsed : (isEmptyValue(parsed) ? [] : [parsed]))
        : (Array.isArray(parsed) ? parsed.slice(0, 1) : [parsed]);
    const cfg = config || {};
    const saveField = cfg.SelectSaveField || cfg.SelectLabel || "Id";
    const labelField = cfg.SelectLabel || cfg.SelectSaveField || "Name";
    const identities = new Set(
        result
            .map((item) => optionIdentity(item, saveField, labelField))
            .filter(Boolean)
    );

    // zhy：仅追加远程结果中不存在的当前已选项，避免带入上次搜索的无关选项。
    selected.forEach((value) => {
        const option = normalizeSelectedOption(value, saveField, labelField);
        if (!option) return;
        const identity = optionIdentity(option, saveField, labelField);
        if (!identity || identities.has(identity)) return;
        result.push(option);
        identities.add(identity);
    });

    return result;
}
