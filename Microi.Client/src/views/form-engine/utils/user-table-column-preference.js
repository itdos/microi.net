export const USER_TABLE_COLUMN_PREFERENCE_ENGINE = "user-module-table-preference";
export const USER_TABLE_COLUMN_PREFERENCE_VERSION = 1;

const MAX_HIDDEN_COLUMN_KEYS = 512;
const MAX_COLUMN_KEY_LENGTH = 160;

export function normalizeHiddenColumnKeys(value) {
    let list = value;
    if (typeof list === "string") {
        try {
            const parsed = JSON.parse(list);
            list = Array.isArray(parsed) ? parsed : parsed?.HiddenColumnKeys;
        } catch (_) {
            list = [];
        }
    }
    if (!Array.isArray(list)) return [];

    const result = [];
    const seen = new Set();
    for (const item of list) {
        const key = String(item || "").trim();
        if (!key || key.length > MAX_COLUMN_KEY_LENGTH || !/^(?:field|audit):[A-Za-z0-9_.:-]+$/.test(key) || seen.has(key)) continue;
        seen.add(key);
        result.push(key);
        if (result.length >= MAX_HIDDEN_COLUMN_KEYS) break;
    }
    return result;
}

export function tableFieldPreferenceKey(field) {
    if (!field) return "";
    const id = String(field.Id || field.Name || "").trim();
    return id ? `field:${id}` : "";
}

export function tableAuditPreferenceKey(fieldName) {
    const name = String(fieldName || "").trim();
    return name ? `audit:${name}` : "";
}

export function setColumnKeyVisible(hiddenColumnKeys, key, visible) {
    const normalized = normalizeHiddenColumnKeys(hiddenColumnKeys);
    const target = String(key || "").trim();
    if (!target) return normalized;
    const next = normalized.filter(item => item !== target);
    if (!visible) next.push(target);
    return normalizeHiddenColumnKeys(next);
}

export function invertVisibleColumnKeys(hiddenColumnKeys, availableColumnKeys) {
    const hidden = new Set(normalizeHiddenColumnKeys(hiddenColumnKeys));
    const available = normalizeHiddenColumnKeys(availableColumnKeys);
    return available.filter(key => !hidden.has(key));
}

export function buildColumnPreferenceCacheKey({ osClient, userId, sysMenuId }) {
    return ["Microi", "UserTableColumns", USER_TABLE_COLUMN_PREFERENCE_VERSION, osClient, userId, sysMenuId]
        .map(value => encodeURIComponent(String(value || "")))
        .join(":");
}
