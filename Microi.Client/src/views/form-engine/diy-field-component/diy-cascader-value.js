export function normalizeCascaderModelValue(value, options = {}) {
    const multiple = options.multiple === true;
    const emitPath = options.emitPath !== false;

    if (value === null || value === undefined || value === "") {
        return multiple ? [] : "";
    }

    if (typeof value !== "string") {
        return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return multiple ? [] : "";
    }

    // Cascader paths are persisted as JSON. Form data can arrive after the
    // component has mounted, so normalization must also happen in prop watchers.
    if ((emitPath || multiple) && trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : value;
        } catch (error) {
            return value;
        }
    }

    return value;
}
