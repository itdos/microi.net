export const SYSTEM_ENGINE_RELOCATED_LINKS = [
    "/doc/more/hdfs",
    "/doc/more/dos-orm",
    "/doc/more/office",
    "/doc/more/sso",
    "/doc/more/identity-verification"
];

// 保留历史 URL 以兼容旧书签，但不再把已并入接口引擎的能力显示成独立引擎。
export const SYSTEM_ENGINE_HIDDEN_LINKS = [
    "/doc/system-engine/datasource-engine"
];

function containsLink(group, prefix) {
    return Array.isArray(group?.items)
        && group.items.some((item) => String(item?.link || "").startsWith(prefix));
}

/**
 * 文档文件与 URL 保持原位，仅调整中文 /doc 侧栏归属，避免历史链接失效。
 */
export function relocateSystemEngineDocs(sidebars, pathname) {
    if (pathname !== "/doc" || !Array.isArray(sidebars)) return sidebars;

    const target = sidebars.find((group) => containsLink(group, "/doc/system-engine/"));
    if (!target) throw new Error("未找到系统引擎侧栏分组");

    const allItems = sidebars.flatMap((group) => Array.isArray(group?.items) ? group.items : []);
    const itemByLink = new Map(allItems.map((item) => [item?.link, item]));
    const missing = SYSTEM_ENGINE_RELOCATED_LINKS.filter((link) => !itemByLink.has(link));
    if (missing.length) {
        throw new Error(`系统引擎待移动文档不存在：${missing.join(", ")}`);
    }

    const movedLinks = new Set(SYSTEM_ENGINE_RELOCATED_LINKS);
    const hiddenLinks = new Set(SYSTEM_ENGINE_HIDDEN_LINKS);
    for (const group of sidebars) {
        if (!Array.isArray(group?.items)) continue;
        group.items = group.items.filter((item) => !movedLinks.has(item?.link) && !hiddenLinks.has(item?.link));
    }
    target.items.push(...SYSTEM_ENGINE_RELOCATED_LINKS.map((link) => itemByLink.get(link)));
    return sidebars;
}
