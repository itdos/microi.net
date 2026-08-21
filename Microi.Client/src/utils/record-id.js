export function normalizeRecordId(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "bigint") return String(value);
    return "";
}

export function hasScalarRecordId(value) {
    return normalizeRecordId(value) !== "";
}

export function shouldReuseRecordWorkbenchRoute(route) {
    if (route?.meta?.microAppHost === true) return false;
    const query = route?.query || {};
    if (hasScalarRecordId(query.RecordId)) return true;
    const viewMode = String(query.ViewMode || query.viewMode || "").trim().toLowerCase();
    return viewMode === "table" || viewMode === "workbench";
}
