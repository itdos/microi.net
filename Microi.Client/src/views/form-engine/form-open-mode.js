// 在分配新记录 Id 之前规范打开模式，避免把预分配 Id 的新增表单误判为编辑。
export function normalizeFormOpenMode(mode, rowId) {
    if (['Add', 'Insert', 'Edit', 'View'].includes(mode)) return mode;
    return rowId ? 'Edit' : 'Add';
}
