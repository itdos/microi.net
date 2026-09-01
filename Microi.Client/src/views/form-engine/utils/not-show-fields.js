function parseNotShowFields(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || value.trim() === "") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

/**
 * Keep the historical string/object formats while dropping values that cannot
 * identify a field. A damaged menu preference must never abort table rendering.
 */
export function normalizeNotShowFields(value) {
    return parseNotShowFields(value).reduce((result, item) => {
        if (typeof item === "string") {
            const fieldName = item.trim();
            if (fieldName) result.push(fieldName);
            return result;
        }
        if (!item || Array.isArray(item) || typeof item !== "object") return result;

        const name = typeof item.Name === "string" ? item.Name.trim() : "";
        const id = typeof item.Id === "string" ? item.Id.trim() : "";
        if (!name && !id) return result;

        const normalizedItem = { ...item };
        if (name) normalizedItem.Name = name;
        else delete normalizedItem.Name;
        if (id) normalizedItem.Id = id;
        else delete normalizedItem.Id;
        result.push(normalizedItem);
        return result;
    }, []);
}
