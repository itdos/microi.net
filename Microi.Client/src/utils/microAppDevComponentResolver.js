function toArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.Data)) return value.Data;
    if (Array.isArray(value?.Data?.Data)) return value.Data.Data;
    return [];
}

function safeJson(value) {
    if (!value || typeof value === "object") return value || {};
    try {
        return JSON.parse(value);
    } catch (error) {
        return {};
    }
}

function collectLegacyComponentPaths(row) {
    const meta = safeJson(row?.RouteMetaJson);
    const values = [
        row?.LegacyComponentPaths,
        row?.LegacyComponentPath,
        meta?.LegacyComponentPaths,
        meta?.LegacyComponentPath,
        meta?.meta?.LegacyComponentPaths,
        meta?.meta?.LegacyComponentPath
    ];
    return values.flatMap((value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
            const parsed = safeJson(value);
            if (Array.isArray(parsed)) return parsed;
            return value.split(/[,;\r\n]+/);
        }
        return [];
    }).map((value) => String(value || "").trim()).filter(Boolean);
}

export function normalizeLegacyComponentPath(value) {
    let path = String(value || "").trim().replace(/\\/g, "/");
    path = path.split(/[?#]/)[0];
    path = path
        .replace(/^~\//, "/")
        .replace(/^@\/src\/views/i, "")
        .replace(/^@\/views/i, "")
        .replace(/^\/?src\/views/i, "")
        .replace(/^\/?views/i, "");
    if (!path.startsWith("/")) path = "/" + path;
    path = path.replace(/\/+/g, "/").replace(/\.vue$/i, "").replace(/\/index$/i, "");
    return path.replace(/\/+$/, "").toLowerCase() || "/";
}

export function findLegacyMicroAppPage(resultOrRows, componentPath) {
    const target = normalizeLegacyComponentPath(componentPath);
    const rows = toArray(resultOrRows);
    for (const row of rows) {
        if (!row || Number(row.IsEnable) === 0) continue;
        const aliases = collectLegacyComponentPaths(row);
        if (!aliases.some((value) => normalizeLegacyComponentPath(value) === target)) continue;
        const routeMeta = safeJson(row.RouteMetaJson);
        return {
            ...row,
            MicroServiceKey: row.MicroServiceKey || routeMeta.MicroServiceKey || routeMeta.MsKey || routeMeta.AppKey || "",
            RoutePath: row.RoutePath || routeMeta.RoutePath || routeMeta.path || "/",
            BuildVersion: row.BuildVersion || routeMeta.BuildVersion || routeMeta.Version || "",
            EntryPath: row.EntryPath || routeMeta.EntryPath || "index.html",
            LegacyComponentPaths: aliases
        };
    }
    return null;
}

// Whitelist display coordinates: form data, authentication tokens and private
// runtime context must never reach the copyable AI modification instructions.
export function buildMicroAppComponentSourceInfo(page = {}, service = {}, context = {}) {
    const meta = safeJson(page.RouteMetaJson);
    const appKey = String(page.MicroServiceKey || service.MsKey || "");
    const sourceFile = String(page.SourceFile || meta.SourceFile || meta.sourceFile || meta.meta?.sourceFile || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const safeSourceFile = sourceFile.split("/").includes("..") ? "" : sourceFile;
    return {
        appKey,
        appName: String(service.MsName || appKey),
        pageKey: String(page.PageKey || meta.PageKey || ""),
        title: String(page.PageTitle || meta.PageTitle || ""),
        routePath: String(page.RoutePath || meta.RoutePath || meta.path || "/"),
        // Form embeds use the stable committed entry. A page metadata row may
        // still carry an older build number after a runtime-only publication.
        version: String(service.BuildVersion || ""),
        sourceFile: safeSourceFile,
        sourcePath: ["AI应用", appKey, safeSourceFile].filter(Boolean).join("/"),
        componentPath: String(context.componentPath || ""),
        entryUrl: String(context.entryUrl || ""),
        assetSource: String(service.StorageMode || ""),
        osClient: String(context.osClient || ""),
        apiBase: String(context.apiBase || "")
    };
}

export function serializeMicroAppComponentData(value, maxDepth = 8) {
    const seen = new WeakSet();
    const visit = (current, depth) => {
        if (current == null || typeof current === "string" || typeof current === "number" || typeof current === "boolean") {
            return current;
        }
        if (typeof current === "bigint") return String(current);
        if (typeof current === "function" || typeof current === "symbol") return undefined;
        if (current instanceof Date) return current.toISOString();
        if (depth >= maxDepth || typeof current !== "object") return undefined;
        if (typeof Element !== "undefined" && current instanceof Element) return undefined;
        if (seen.has(current)) return undefined;
        seen.add(current);
        if (Array.isArray(current)) {
            return current.map((item) => visit(item, depth + 1)).filter((item) => item !== undefined);
        }
        const output = {};
        Object.keys(current).forEach((key) => {
            if (key.startsWith("_") && (key === "__v_raw" || key === "__v_skip" || key === "__ob__")) return;
            if (/^on[A-Z]|^onUpdate:/.test(key) || key === "ParentV8" || key === "pageLifetimes") return;
            const next = visit(current[key], depth + 1);
            if (next !== undefined) output[key] = next;
        });
        return output;
    };
    return visit(value, 0) || {};
}
