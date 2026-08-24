export const OFFICIAL_MENU_BADGE_ENGINE_KEY = "mci-module-presentation-stats";

const normalizeEngineKey = (value) => String(value || "").trim().toLowerCase();
const normalizeMenuId = (payload) => String(payload?.SysMenuId || payload?._SysMenuId || "").trim();

/**
 * Coalesces the official menu-presentation badge requests created while the
 * sidebar mounts. Custom badge engines keep their historical one-request
 * contract, while older official engines transparently fall back to the same
 * contract during a rolling platform/application upgrade.
 */
export function createMenuBadgeRequester(schedule = (callback) => setTimeout(callback, 40)) {
    const groups = new Map();
    let flushScheduled = false;

    const runLegacyRequests = async (entries) => {
        await Promise.all(entries.map(async (entry) => {
            try {
                entry.resolve(await entry.run(entry.apiEngineKey, entry.payload));
            } catch (error) {
                entry.reject(error);
            }
        }));
    };

    const flushGroup = async (entries) => {
        const first = entries[0];
        const menuRequests = [];
        const menuIds = new Set();
        let forceRefresh = false;

        for (const entry of entries) {
            const menuId = normalizeMenuId(entry.payload);
            forceRefresh = forceRefresh || entry.payload?.ForceRefresh === true;
            if (!menuId || menuIds.has(menuId)) continue;
            menuIds.add(menuId);
            menuRequests.push({
                ...entry.payload,
                _SysMenuId: menuId,
                SysMenuId: menuId
            });
        }

        try {
            const result = await first.run(first.apiEngineKey, {
                OsClient: first.payload?.OsClient,
                ForceRefresh: forceRefresh,
                MenuRequests: menuRequests
            });
            const menus = result?.Data?.Menus;
            // Compatibility fence: a tenant may receive the new platform shell
            // before updating the official application/engine package.
            if (!menus || typeof menus !== "object") {
                await runLegacyRequests(entries);
                return;
            }
            for (const entry of entries) {
                const menuId = normalizeMenuId(entry.payload);
                entry.resolve({
                    ...result,
                    Data: menus[menuId] || { Value: 0, Count: 0, Total: 0, Buttons: {}, Metrics: {} }
                });
            }
        } catch (error) {
            for (const entry of entries) entry.reject(error);
        }
    };

    const flush = () => {
        flushScheduled = false;
        const pendingGroups = Array.from(groups.values());
        groups.clear();
        for (const entries of pendingGroups) void flushGroup(entries);
    };

    return function requestMenuBadge(run, apiEngineKey, payload = {}) {
        if (normalizeEngineKey(apiEngineKey) !== OFFICIAL_MENU_BADGE_ENGINE_KEY) {
            return run(apiEngineKey, payload);
        }
        return new Promise((resolve, reject) => {
            const groupKey = `${normalizeEngineKey(apiEngineKey)}:${String(payload.OsClient || "").toLowerCase()}`;
            const entries = groups.get(groupKey) || [];
            entries.push({ run, apiEngineKey, payload, resolve, reject });
            groups.set(groupKey, entries);
            if (!flushScheduled) {
                flushScheduled = true;
                schedule(flush);
            }
        });
    };
}

export const requestMenuBadge = createMenuBadgeRequester();
