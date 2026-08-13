export const MICRO_APP_RUNTIME_CACHE_MODE = "runtime-keep-alive";
export const MICRO_APP_RUNTIME_CACHE_LIMIT = 5;

const runtimeEntries = new Map();
const pendingDestroy = new Map();

function normalizePart(value, fallback = "app") {
    let result = String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!result) result = fallback;
    if (!/^[a-z]/.test(result)) result = `app-${result}`;
    return result;
}

function hashRuntimeIdentity(value) {
    let hash = 2166136261;
    const input = String(value || "");
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).padStart(7, "0");
}

function getRuntime() {
    return globalThis.window?.microApp || null;
}

function notifyCacheChange(reason, name = "") {
    const eventTarget = globalThis.window;
    const CustomEventCtor = globalThis.CustomEvent;
    if (!eventTarget?.dispatchEvent || typeof CustomEventCtor !== "function") return;
    eventTarget.dispatchEvent(new CustomEventCtor("microi:micro-app-cache-change", {
        detail: {
            reason,
            name,
            entries: getMicroAppRuntimeCacheSnapshot()
        }
    }));
}

function toPublicEntry(entry) {
    return {
        name: entry.name,
        appKey: entry.appKey,
        routeFullPath: entry.routeFullPath,
        version: entry.version,
        state: entry.state,
        lastUsedAt: entry.lastUsedAt
    };
}

async function destroyRuntimeEntry(name, reason) {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) return false;
    if (pendingDestroy.has(normalizedName)) return pendingDestroy.get(normalizedName);

    runtimeEntries.delete(normalizedName);
    notifyCacheChange(reason, normalizedName);

    const operation = (async () => {
        // Yield once so pendingDestroy is populated before every completion path,
        // including runtimes that are unavailable during logout or unit tests.
        await Promise.resolve();
        try {
            const runtime = getRuntime();
            if (typeof runtime?.unmountApp !== "function") return false;
            return await runtime.unmountApp(normalizedName, { destroy: true, clearData: true });
        } catch (error) {
            console.warn(`[MicroAppCache] destroy ${normalizedName} failed:`, error);
            return false;
        } finally {
            pendingDestroy.delete(normalizedName);
        }
    })();

    pendingDestroy.set(normalizedName, operation);
    return operation;
}

async function enforceRuntimeCacheLimit(protectedName = "") {
    while (runtimeEntries.size > MICRO_APP_RUNTIME_CACHE_LIMIT) {
        const candidate = [...runtimeEntries.values()]
            .filter((entry) => entry.name !== protectedName && entry.state === "hidden")
            .sort((left, right) => left.lastUsedAt - right.lastUsedAt)[0];
        if (!candidate) break;
        await destroyRuntimeEntry(candidate.name, "lru-evict");
    }
}

export function createMicroAppRuntimeName({
    osClient,
    appKey,
    routeFullPath,
    version,
    entryUrl
} = {}) {
    // Menu metadata can be hydrated after the first friendly-route render.
    // Never include menuId in runtime identity, otherwise the first revisit
    // receives a different name and silently loses the native keep-alive app.
    const prefix = normalizePart(`${osClient || "tenant"}-${appKey || "micro-app"}`)
        .slice(0, 48)
        .replace(/-+$/g, "");
    const fingerprint = hashRuntimeIdentity(`${routeFullPath || "/"}|${version || ""}|${entryUrl || ""}`);
    return `${prefix}-${fingerprint}`.slice(0, 64);
}

export function getMicroAppRuntimeCacheSnapshot() {
    return [...runtimeEntries.values()]
        .sort((left, right) => left.lastUsedAt - right.lastUsedAt)
        .map(toPublicEntry);
}

export function registerMicroAppRuntimeCache({
    name,
    appKey = "",
    routeFullPath = "",
    version = ""
} = {}) {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) return Promise.resolve(null);

    const staleNames = [...runtimeEntries.values()]
        .filter((entry) => entry.routeFullPath === routeFullPath && entry.name !== normalizedName)
        .map((entry) => entry.name);
    const previous = runtimeEntries.get(normalizedName);
    runtimeEntries.set(normalizedName, {
        name: normalizedName,
        appKey: String(appKey || ""),
        routeFullPath: String(routeFullPath || ""),
        version: String(version || ""),
        state: "starting",
        lastUsedAt: Date.now(),
        createdAt: previous?.createdAt || Date.now()
    });
    notifyCacheChange("register", normalizedName);

    return Promise.all(staleNames.map((staleName) => destroyRuntimeEntry(staleName, "route-version-change")))
        .then(() => enforceRuntimeCacheLimit(normalizedName))
        .then(() => toPublicEntry(runtimeEntries.get(normalizedName) || {
            name: normalizedName,
            appKey,
            routeFullPath,
            version,
            state: "starting",
            lastUsedAt: Date.now()
        }));
}

export function markMicroAppRuntimeActive(name) {
    const entry = runtimeEntries.get(String(name || ""));
    if (!entry) return null;
    entry.state = "active";
    entry.lastUsedAt = Date.now();
    notifyCacheChange("active", entry.name);
    return toPublicEntry(entry);
}

export function markMicroAppRuntimeHidden(name) {
    const entry = runtimeEntries.get(String(name || ""));
    if (!entry) return Promise.resolve(null);
    entry.state = "hidden";
    entry.lastUsedAt = Date.now();
    notifyCacheChange("hidden", entry.name);
    return enforceRuntimeCacheLimit().then(() => toPublicEntry(entry));
}

export function forgetMicroAppRuntimeCache(name, reason = "unmounted") {
    const normalizedName = String(name || "").trim();
    if (!normalizedName || !runtimeEntries.delete(normalizedName)) return false;
    notifyCacheChange(reason, normalizedName);
    return true;
}

export function destroyMicroAppRuntimeCache(name, reason = "manual-destroy") {
    return destroyRuntimeEntry(name, reason);
}

export async function releaseMicroAppRuntimeCacheForView(view, reason = "tab-close") {
    const routeFullPath = String(view?.fullPath || view?.path || "");
    if (!routeFullPath) return [];
    const names = [...runtimeEntries.values()]
        .filter((entry) => entry.routeFullPath === routeFullPath)
        .map((entry) => entry.name);
    await Promise.all(names.map((name) => destroyRuntimeEntry(name, reason)));
    return names;
}

export async function clearMicroAppRuntimeCache(reason = "clear-all") {
    const names = [...new Set([...runtimeEntries.keys(), ...pendingDestroy.keys()])];
    await Promise.all(names.map((name) => destroyRuntimeEntry(name, reason)));
    runtimeEntries.clear();
    notifyCacheChange(reason);
    return names;
}

export function resetMicroAppRuntimeCacheRegistry() {
    runtimeEntries.clear();
    pendingDestroy.clear();
}
