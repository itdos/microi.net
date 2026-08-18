const IDENTITY_FIELDS = new Set([
    "Id",
    "TableId",
    "OsClient",
    "CreateTime",
    "UpdateTime",
    "CreateUser",
    "CreateUserId",
    "UpdateUser",
    "UpdateUserId",
    "UserId",
    "UserName",
    "Sort"
]);

const clone = (value) => JSON.parse(JSON.stringify(value || {}));

export function buildDuplicateFieldPayload(field, allFields, insertIndex) {
    const source = clone(field);
    for (const key of Object.keys(source)) {
        if (IDENTITY_FIELDS.has(key) || key.startsWith("_")) delete source[key];
    }

    const originalName = String(field?.Name || "Field").trim() || "Field";
    const existingNames = new Set((allFields || []).map(item => String(item?.Name || "").toLowerCase()));
    let ordinal = 1;
    let nextName = `${originalName}_Copy`;
    while (existingNames.has(nextName.toLowerCase())) {
        ordinal += 1;
        nextName = `${originalName}_Copy${ordinal}`;
    }

    const originalLabel = String(field?.Label || originalName).trim() || originalName;
    source.Name = nextName;
    source.Label = ordinal === 1 ? `${originalLabel}(副本)` : `${originalLabel}(副本${ordinal})`;
    source.NameConfirm = 0;
    source._insertIndex = Number.isInteger(insertIndex) ? insertIndex : (allFields || []).length;
    return source;
}
