const cleanId = value => String(value ?? '').trim();

export function getTabSysMenuId(tag = {}) {
    const meta = tag.meta || {};
    const query = tag.query || {};
    const params = tag.params || {};
    return cleanId(
        meta.Id || meta.id || meta.SysMenuId || meta.sysMenuId
        || query.SysMenuId || query.sysMenuId || query.Id
        || params.SysMenuId || params.sysMenuId || params.Id
    );
}

export function getTabDesignCacheKey(tag = {}) {
    const sysMenuId = getTabSysMenuId(tag);
    return sysMenuId ? `menu:${sysMenuId}` : `route:${cleanId(tag.fullPath || tag.path)}`;
}

export function getTabDiyTableId(tag = {}, cache = {}) {
    const meta = tag.meta || {};
    const query = tag.query || {};
    const params = tag.params || {};
    const direct = cleanId(
        meta.DiyTableId || meta.diyTableId || meta.TableId || meta.tableId
        || query.DiyTableId || query.diyTableId || query.TableId || query.tableId
        || params.DiyTableId || params.diyTableId || params.TableId || params.tableId
    );
    if (direct) return direct;

    const cached = cache[getTabDesignCacheKey(tag)] || {};
    return cleanId(cached.diyTableId || cached.DiyTableId);
}

export async function hydrateTabFormDesignContext(tag = {}, cache = {}, fetchMenu) {
    const direct = getTabDiyTableId(tag, cache);
    if (direct) return direct;

    const sysMenuId = getTabSysMenuId(tag);
    const cacheKey = getTabDesignCacheKey(tag);
    if (!sysMenuId || typeof fetchMenu !== 'function') return '';
    if (cache[cacheKey]?.resolved === true) return getTabDiyTableId(tag, cache);

    const result = await fetchMenu(sysMenuId);
    const rawData = result?.Data ?? result?.data ?? result;
    const data = Array.isArray(rawData) ? rawData[0] : rawData;
    const diyTableId = cleanId(data?.DiyTableId || data?.diyTableId);
    cache[cacheKey] = {
        resolved: true,
        diyTableId,
        diyTableName: cleanId(data?.DiyTableName || data?.diyTableName)
    };
    return diyTableId;
}
