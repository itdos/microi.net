export function normalizeRecordId(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "bigint") return String(value);
    return "";
}

export function hasScalarRecordId(value) {
    return normalizeRecordId(value) !== "";
}

export function ownsRecordWorkbenchRoute(route, ownerPath, ownerMenuId, deactivated = false) {
    if (deactivated || (ownerPath && route?.path !== ownerPath)) return false;
    const routeMenuId = String(route?.meta?.Id || route?.meta?.SysMenuId || "");
    return !routeMenuId || !ownerMenuId || routeMenuId === String(ownerMenuId);
}

// A deep link can reference a record outside the loaded page. Check through the
// normal FormEngine permission boundary; only Code=2 means the record is missing.
export async function verifyWorkbenchRecord(id, rows, readRecord) {
    const recordId = normalizeRecordId(id);
    if (!recordId) return { status: "empty" };
    if ((rows || []).some((row) => normalizeRecordId(row?.Id) === recordId)) return { status: "found" };
    try {
        const result = await readRecord(recordId);
        if (result?.Code === 2) return { status: "missing" };
        if (result?.Code === 1 && normalizeRecordId(result.Data?.Id) === recordId) return { status: "found" };
        return { status: "error", message: result?.Msg || "" };
    } catch (error) {
        return { status: "error", message: error?.message || "" };
    }
}

export function shouldReuseRecordWorkbenchRoute(route) {
    if (route?.meta?.microAppHost === true) return false;
    const query = route?.query || {};
    if (hasScalarRecordId(query.RecordId)) return true;
    const viewMode = String(query.ViewMode || query.viewMode || "").trim().toLowerCase();
    return viewMode === "table" || viewMode === "workbench";
}
