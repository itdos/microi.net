const readableMarkerPattern = /^[ \t]*--[ \t]*MICROI_DATA_PERMISSION_CONFIG:[ \t]*(\{[^\r\n]*\})[ \t]*$/m;
const legacyMarkerPattern = /(?:\/\*\s*MICROI_DATA_PERMISSION_V1:([A-Za-z0-9_-]+)\s*\*\/|^[ \t]*--[ \t]*MICROI_DATA_PERMISSION_V1:([A-Za-z0-9_-]+)[ \t]*$)/m;

const defaults = Object.freeze({
    superAdminAll: true,
    superAdminLevel: 9999,
    tenantIsolation: false,
    tenantField: "TenantId",
    scopeMode: "self",
    ownerField: "UserId",
    departmentField: "DeptId",
    userLevelField: "Level",
    userDeptIdsField: "DeptIds",
    ruleMatch: "any"
});

const scalarKeys = Object.keys(defaults);
const arrayKeys = ["fullAccessRoleIds", "fullAccessPostIds", "fullAccessDeptIds"];

/**
 * SqlWhere only needs enough plaintext state to restore the visual controls.
 * Join state is already stored in SqlJoin/JoinTables, so it is deliberately
 * excluded here. Default and empty values are omitted to keep the marker short.
 */
export function compactDataPermissionConfig(snapshot) {
    const result = {};
    scalarKeys.forEach((key) => {
        if (snapshot?.[key] !== undefined && snapshot[key] !== defaults[key]) {
            result[key] = snapshot[key];
        }
    });
    arrayKeys.forEach((key) => {
        if (Array.isArray(snapshot?.[key]) && snapshot[key].length > 0) {
            result[key] = Array.from(new Set(snapshot[key].filter(Boolean).map(String)));
        }
    });
    if (Array.isArray(snapshot?.rules) && snapshot.rules.length > 0) {
        result.rules = snapshot.rules.map((rule) => ({
            field: rule.field,
            operator: rule.operator,
            valueSource: rule.valueSource,
            value: rule.value
        }));
    }
    return result;
}

export function createDataPermissionMarker(snapshot) {
    return `-- MICROI_DATA_PERMISSION_CONFIG:${JSON.stringify(compactDataPermissionConfig(snapshot))}`;
}

export function composeDataPermissionSql(snapshot, sqlBody) {
    const body = stripDataPermissionMarker(sqlBody);
    return `${createDataPermissionMarker(snapshot)}\n${body}`.trim();
}

export function extractDataPermissionConfig(sqlWhere) {
    const source = String(sqlWhere || "");
    const readableMatch = source.match(readableMarkerPattern);
    if (readableMatch) {
        try {
            return { config: JSON.parse(readableMatch[1]), format: "readable" };
        } catch (error) {
            return null;
        }
    }

    const legacyMatch = source.match(legacyMarkerPattern);
    if (!legacyMatch) return null;
    try {
        return {
            config: JSON.parse(decodeLegacyMarker(legacyMatch[1] || legacyMatch[2])),
            format: "legacy-base64"
        };
    } catch (error) {
        return null;
    }
}

export function stripDataPermissionMarker(value) {
    return String(value || "")
        .replace(readableMarkerPattern, "")
        .replace(legacyMarkerPattern, "")
        .trim();
}

function decodeLegacyMarker(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
