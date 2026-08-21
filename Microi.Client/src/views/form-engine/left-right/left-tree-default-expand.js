export function normalizeDefaultExpandLevel(value) {
    if (value === null || value === undefined || value === "") return 0;

    var level = Number(value);
    if (!Number.isFinite(level) || level <= 0) return 0;

    return Math.floor(level);
}

export function collectDefaultExpandedKeys(treeData, configuredLevel) {
    var maxLevel = normalizeDefaultExpandLevel(configuredLevel);
    if (maxLevel === 0 || !Array.isArray(treeData)) return [];

    var expandedKeys = [];
    var seenKeys = new Set();

    function visit(nodes, level) {
        if (!Array.isArray(nodes) || level > maxLevel) return;

        nodes.forEach(function (item) {
            if (!item) return;

            var children = Array.isArray(item._Child) ? item._Child : [];
            var hasChild = Boolean(item._HasChild) || children.length > 0;
            var hasKey = item.Id !== null && item.Id !== undefined && String(item.Id) !== "";

            if (hasChild && hasKey && !seenKeys.has(item.Id)) {
                seenKeys.add(item.Id);
                expandedKeys.push(item.Id);
            }

            if (children.length > 0 && level < maxLevel) {
                visit(children, level + 1);
            }
        });
    }

    visit(treeData, 1);
    return expandedKeys;
}
