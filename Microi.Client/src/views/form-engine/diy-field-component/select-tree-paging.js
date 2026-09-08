export function isPagedSelectTree(field) {
    const config = field?.Config;
    return field?.Component === 'SelectTree' && config?.DataSource === 'Sql'
        && config.SelectTree?.Lazy === true && Number(config.SelectTree.PageSize) > 0
        && typeof config.SelectTree.LazyLoad !== 'function';
}

export function selectTreeKeys(value, keyField) {
    let parsed = value;
    if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
        try { parsed = JSON.parse(value); } catch { /* 普通存储值保持原样。 */ }
    }
    const values = Array.isArray(parsed) ? parsed : [parsed];
    return [...new Set(values.map(item => item && typeof item === 'object' ? item[keyField] : item)
        .filter(item => item !== '' && item !== null && item !== undefined))];
}

// 统一合并当前页与下一批，保持键稳定；不把已选项插到根节点中伪造层级。
export function mergeTreePage(current, incoming, keyField) {
    const rows = new Map(current.map(row => [String(row[keyField]), row]));
    for (const row of incoming) rows.set(String(row[keyField]), row);
    return [...rows.values()];
}
