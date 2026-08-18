export function normalizeRecordId(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "bigint") return String(value);
    return "";
}

export function hasScalarRecordId(value) {
    return normalizeRecordId(value) !== "";
}
