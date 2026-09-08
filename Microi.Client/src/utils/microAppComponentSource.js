import { DiyCommon } from "@/utils/diy.common";
import { buildMicroAppEntryUrl } from "./microAppEntryUrl.js";
import { buildMicroAppComponentSourceInfo } from "./microAppDevComponentResolver.js";

// One bounded cache per active authenticated endpoint. Never reuse another
// tenant/user's page aliases or retain an unsuccessful metadata response.
let cacheScope = "";
const cache = new Map();
function cached(key, read) {
    const scope = JSON.stringify([DiyCommon.GetApiBase(), DiyCommon.GetOsClient(), DiyCommon.getToken()]);
    if (scope !== cacheScope) { cache.clear(); cacheScope = scope; }
    const existing = cache.get(key);
    if (existing && existing.until > Date.now()) return existing.promise;
    const entry = { until: Date.now() + 30000 };
    entry.promise = read().then(result => {
        if (Number(result?.Code) !== 1 && cache.get(key) === entry) cache.delete(key);
        return result;
    }).catch(error => {
        if (cache.get(key) === entry) cache.delete(key);
        throw error;
    });
    if (cache.size >= 64) cache.delete(cache.keys().next().value);
    cache.set(key, entry);
    return entry.promise;
}

export function loadMicroAppComponentPages() {
    return cached("pages", () => DiyCommon.FormEngine.GetTableData("sys_microiservice_page", {
        _Where: [["IsEnable", "=", 1]],
        _SelectFields: ["Id", "MicroServiceId", "MicroServiceKey", "PageKey", "PageTitle", "RoutePath", "EntryPath", "IsEnable", "BuildVersion", "RouteMetaJson"],
        _PageIndex: 1,
        _PageSize: 5000
    }));
}

export async function loadMicroAppComponentSourceInfo(page, componentPath) {
    const context = {
        componentPath,
        apiBase: DiyCommon.GetApiBase(),
        osClient: DiyCommon.GetOsClient()
    };
    let service = {};
    // Descriptive metadata is best effort. A denied/legacy metadata endpoint
    // must not prevent a component that already has a valid entry from loading.
    try {
        const result = await cached(`service:${page.MicroServiceKey}`, () => DiyCommon.FormEngine.GetTableData("sys_microiservice", {
            _Where: [["MsKey", "=", page.MicroServiceKey]],
            _SelectFields: ["Id", "MsKey", "MsName", "BuildVersion", "IsEnable", "StorageMode"],
            _PageIndex: 1, _PageSize: 1
        }));
        if (Number(result?.Code) === 1) service = result.Data?.[0] || {};
    } catch (_) { /* Keep known alias and runtime coordinates. */ }
    context.entryUrl = buildMicroAppEntryUrl({
        ...context, appKey: page.MicroServiceKey, version: page.BuildVersion || service.BuildVersion
    });
    return buildMicroAppComponentSourceInfo(page, service, context);
}
