const MENU_FIELD_REFERENCE_KEYS = [
    "TableDiyFieldIds",
    "SelectFields",
    "SearchFieldIds",
    "SortFieldIds",
    "StatisticsFields",
    "FixedFields",
    "MobileListFields",
    "CardTitleTagFields",
    "CardBottomTagFields",
    "InTableEditFields",
    "TableHeaders"
];

function parseReferenceValue(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") return [value];
    if (typeof value !== "string") return [];

    const text = value.trim();
    if (!text) return [];
    if (text.startsWith("[") || text.startsWith("{")) {
        try {
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
            return [];
        }
    }
    return text.split(",").map((item) => item.trim()).filter(Boolean);
}

export function collectMenuFieldReferenceIds(sysMenuModel = {}) {
    const result = new Set();
    MENU_FIELD_REFERENCE_KEYS.forEach((key) => {
        parseReferenceValue(sysMenuModel[key]).forEach((item) => {
            const id = typeof item === "string" ? item : item?.Id;
            if (id) result.add(String(id));
        });
    });
    return result;
}

export function hasFieldReference(value, fieldId) {
    if (!fieldId) return false;
    return parseReferenceValue(value).some((item) => {
        const id = typeof item === "string" ? item : item?.Id;
        return id !== undefined && id !== null && String(id) === String(fieldId);
    });
}

/**
 * 表格页会加载主表与 JoinTable 的完整字段元数据。主表字段仍需全部初始化，
 * 以保证后续打开表单时下拉数据可用；跨表字段只初始化菜单实际引用的字段，
 * 避免无关历史字段的数据源（例如缺失的旧表）拖垮整批 GetFieldsData。
 */
export function selectTableDataSourceFields(fields, primaryTableId, sysMenuModel = {}) {
    const referencedIds = collectMenuFieldReferenceIds(sysMenuModel);
    const primaryId = primaryTableId === undefined || primaryTableId === null
        ? ""
        : String(primaryTableId);
    return (Array.isArray(fields) ? fields : []).filter((field) => {
        if (!field) return false;
        if (primaryId && String(field.TableId || "") === primaryId) return true;
        return field.Id && referencedIds.has(String(field.Id));
    });
}
