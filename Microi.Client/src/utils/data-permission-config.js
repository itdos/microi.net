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
    // 空权限必须保持真正的空 SqlWhere。只保存配置标记会让后端仍收到一段
    // SQL 文本，也会在重新打开设计器时把“无条件”误还原成默认图形规则。
    if (!body) return "";
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

/**
 * 识别旧版设计器自动补出的“默认拒绝”SQL。必须同时包含固定说明文字，
 * 且去掉说明和成对外括号后只有 1 = 0，避免误判用户手写条件。
 */
export function isGeneratedDefaultDenySql(value) {
    const body = stripDataPermissionMarker(value);
    if (!/^[ \t]*--[ \t]*【(?:吾码)?权限说明】默认拒绝：尚未配置任何放行规则/m.test(body)) return false;

    const executable = body
        .split(/\r?\n/)
        .filter((line) => !/^[ \t]*--[ \t]*【(?:吾码)?权限说明】/.test(line))
        .join("")
        .replace(/\s+/g, "");
    const match = executable.match(/^(\(*)1=0(\)*)$/);
    return !!match && match[1].length === match[2].length;
}

/**
 * 只迁移带设计器标记的自动默认拒绝；历史高级手写配置始终保留。
 */
export function shouldClearGeneratedDefaultDenySql(value, markerState = extractDataPermissionConfig(value)) {
    if (!markerState) return false;
    const config = markerState.config || {};
    if (config.whereMode === "manual" && String(config.manualSql || "").trim()) return false;
    return isGeneratedDefaultDenySql(value);
}

/**
 * 返回生成器应输出的最小 SQL 结构，杜绝空条件被包成 ()。
 */
export function resolveDataPermissionSqlShape(snapshot, branchCount) {
    const hasTenant = !!snapshot?.tenantIsolation;
    const hasBranches = snapshot?.scopeMode !== "all" && Number(branchCount || 0) > 0;
    if (!hasTenant && !hasBranches) return "empty";
    if (hasTenant && !hasBranches) return "tenant-only";
    return hasTenant ? "tenant-and-branches" : "branches";
}

function decodeLegacyMarker(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
