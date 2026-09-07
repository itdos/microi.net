export function treeFlag(value) {
    return value === true || value === 1 || value === "1" || value === "true";
}

export function needsDefaultTreeLoading(result) {
    const append = result?.DataAppend || {};
    return treeFlag(append.AutoTreeLazy) || treeFlag(append.TreeLazy)
        || (result?.Data || []).some(row => treeFlag(row._HasChild) && !row._Child?.length);
}

export function buildChildPage(result, parentId, pageIndex, pageSize, labelField) {
    const rows = Array.isArray(result?.Data) ? result.Data.slice() : [];
    if (rows.length && pageIndex * pageSize < Number(result.DataCount)) {
        rows.push({
            Id: `__left_tree_more_${parentId}_${pageIndex}`,
            [labelField]: "加载更多…",
            _HasChild: false,
            _IsLeaf: true,
            __LeftTreeLoadMore: { parentId, pageIndex: pageIndex + 1 }
        });
    }
    return rows;
}
