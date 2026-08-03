function parseRelationList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}
function normalizeBoolean(value) {
    return value === true
        || value === 1
        || value === "1"
        || String(value || "").toLowerCase() === "true"
        || String(value || "").toLowerCase() === "match";
}

function normalizeRelation(item, importMatch) {
    if (Array.isArray(item)) {
        return {
            ParentField: String(item[0] || "").trim(),
            ChildField: String(item[1] || "").trim(),
            ImportMatch: importMatch === true || normalizeBoolean(item[2]),
            ParentFieldLabel: "",
            ChildFieldLabel: ""
        };
    }
    if (!item || typeof item !== "object") return null;
    return {
        ParentField: String(
            item.ParentField
            || item.ParentFieldName
            || item.FatherFieldName
            || item.Parent
            || item.Father
            || ""
        ).trim(),
        ChildField: String(item.ChildField || item.ChildFieldName || item.Child || "").trim(),
        ImportMatch: importMatch === true
            || normalizeBoolean(item.ImportMatch)
            || normalizeBoolean(item.IsImportMatch)
            || normalizeBoolean(item.Match),
        ParentFieldLabel: String(item.ParentFieldLabel || item.FatherFieldLabel || "").trim(),
        ChildFieldLabel: String(item.ChildFieldLabel || "").trim()
    };
}

function resolveConfigParts(configOrTableChild) {
    const value = configOrTableChild && typeof configOrTableChild === "object"
        ? configOrTableChild
        : {};
    const isFullConfig = Object.prototype.hasOwnProperty.call(value, "TableChild")
        || Object.prototype.hasOwnProperty.call(value, "TableChildCallbackField")
        || Object.prototype.hasOwnProperty.call(value, "TableChildTableId")
        || Object.prototype.hasOwnProperty.call(value, "TableChildFkFieldName");
    return {
        root: isFullConfig ? value : null,
        tableChild: isFullConfig
            ? (value.TableChild && typeof value.TableChild === "object" ? value.TableChild : {})
            : value
    };
}

function appendRelations(target, index, value, importMatch) {
    parseRelationList(value).forEach((item) => {
        const relation = normalizeRelation(item, importMatch);
        if (!relation || !relation.ParentField || !relation.ChildField) return;
        const key = (relation.ParentField + "\u001f" + relation.ChildField).toLowerCase();
        const existing = index.get(key);
        if (existing) {
            existing.ImportMatch = existing.ImportMatch || relation.ImportMatch;
            existing.ParentFieldLabel = existing.ParentFieldLabel || relation.ParentFieldLabel;
            existing.ChildFieldLabel = existing.ChildFieldLabel || relation.ChildFieldLabel;
            return;
        }
        index.set(key, relation);
        target.push(relation);
    });
}

/**
 * Reads the compact relation format and every historical TableChild relation
 * format. The returned objects are runtime-only and are not persisted.
 */
export function getTableChildFieldRelations(configOrTableChild) {
    const { root, tableChild } = resolveConfigParts(configOrTableChild);
    const result = [];
    const index = new Map();

    appendRelations(result, index, tableChild.FieldRelations, false);
    if (root) appendRelations(result, index, root.TableChildCallbackField, false);
    appendRelations(result, index, tableChild.ImportBackfillFields, false);
    appendRelations(result, index, tableChild.ImportRelations, true);

    const legacyParent = String(tableChild.ImportParentMatchFieldName || "").trim();
    const legacyChild = String(tableChild.ImportChildMatchFieldName || "").trim();
    if (legacyParent && legacyChild) {
        appendRelations(result, index, [[legacyParent, legacyChild, true]], true);
    }
    return result;
}

export function toCompactTableChildRelations(relations) {
    return (Array.isArray(relations) ? relations : [])
        .filter((item) => item && item.ParentField && item.ChildField)
        .map((item) => item.ImportMatch === true
            ? [item.ParentField, item.ChildField, true]
            : [item.ParentField, item.ChildField]);
}

/**
 * Idempotently merges the three historical settings into FieldRelations and
 * removes the historical keys. Persisting the containing diy_field later will
 * therefore perform the one-time data migration without an extra write API.
 */
export function normalizeTableChildFieldRelations(config, options = {}) {
    if (!config || typeof config !== "object") return [];
    const clearLegacy = options.clearLegacy !== false;
    const parts = resolveConfigParts(config);
    if (parts.root && (!parts.root.TableChild || typeof parts.root.TableChild !== "object")) {
        parts.root.TableChild = parts.tableChild;
    }
    const relations = getTableChildFieldRelations(config);
    parts.tableChild.FieldRelations = toCompactTableChildRelations(relations);

    if (clearLegacy) {
        if (parts.root) delete parts.root.TableChildCallbackField;
        delete parts.tableChild.ImportRelations;
        delete parts.tableChild.ImportBackfillFields;
        delete parts.tableChild.ImportParentMatchFieldName;
        delete parts.tableChild.ImportChildMatchFieldName;
    }
    return relations;
}
