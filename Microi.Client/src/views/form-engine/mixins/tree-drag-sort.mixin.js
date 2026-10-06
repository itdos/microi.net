/** 树节点顺序与跨级变更由固定接口引擎计算；客户端只描述放置意图。 */
export default {
    data() { return { treeDragId: '', treeDragSnapshot: '', treeDragPending: null, treeDragBusy: false, treeDropTarget: null }; },
    methods: {
        CanTreeDragSort() {
            const enabled = this.SysMenuModel?.TreeDragSortEnabled;
            return (enabled === true || enabled === 1 || enabled === '1') && !!this.SysMenuModel?.TreeDragSortField
                && !!this.CurrentDiyTableModel?.IsTree && !this.IsOpenTableSingleSelect?.() && !!this.LimitEdit?.();
        },
        async TreeSortRequest(input) {
            return this.DiyCommon.PostAsync('/apiengine/mci-tree-drag-sort', { MenuId: this.SysMenuModel.Id, ...input });
        },
        TreeDragStart(event, row) {
            if (!this.CanTreeDragSort() || this.treeDragBusy) { event.preventDefault(); return; }
            this.treeDragId = row.Id;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-microi-tree-node', row.Id);
            this.treeDragPending = this.TreeSortRequest({ Action: 'Snapshot' }).then(result => {
                if (result.Code !== 1) throw new Error(result.Msg || '读取排序版本失败');
                this.treeDragSnapshot = result.Data.Snapshot;
                return this.treeDragSnapshot;
            });
            // 错误在 drop 时展示；结束拖动也不会产生未处理的 Promise。
            this.treeDragPending.catch(() => {});
        },
        TreeDragOver(event) {
            if (!this.treeDragId || !this.CanTreeDragSort()) return;
            const row = event.target.closest?.('.el-table__row');
            const handle = row?.querySelector('[data-tree-node]');
            if (!handle || handle.dataset.treeNode === this.treeDragId) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move';
            const box = row.getBoundingClientRect(); const ratio = (event.clientY - box.top) / box.height;
            const position = ratio < .25 ? 'Before' : ratio > .75 ? 'After' : 'Inside';
            this.ClearTreeDropMark();
            row.dataset.treeDrop = position.toLowerCase();
            this.treeDropTarget = { Id: handle.dataset.treeNode, Position: position, Element: row };
        },
        ClearTreeDropMark() {
            if (this.treeDropTarget?.Element) delete this.treeDropTarget.Element.dataset.treeDrop;
            this.treeDropTarget = null;
        },
        async TreeDrop(event) {
            if (!this.treeDropTarget || !this.treeDragId) return;
            event.preventDefault(); event.stopPropagation();
            const target = this.treeDropTarget;
            await this.CommitTreePlacement(this.treeDragId, target.Id, target.Position, this.treeDragPending);
        },
        TreeDragEnd() { this.treeDragId = ''; this.treeDragPending = null; this.ClearTreeDropMark(); },
        async CommitTreePlacement(movedId, targetId, position, pendingSnapshot) {
            if (this.treeDragBusy) return;
            this.treeDragBusy = true;
            try {
                const snapshot = pendingSnapshot ? await pendingSnapshot : await this.TreeSortRequest({ Action: 'Snapshot' }).then(result => {
                    if (result.Code !== 1) throw new Error(result.Msg || '读取排序版本失败');
                    return result.Data.Snapshot;
                });
                const result = await this.TreeSortRequest({ Action: 'Move', MovedId: movedId, TargetId: targetId || '', Position: position, ExpectedSnapshot: snapshot });
                if (result.Code !== 1) throw new Error(result.Msg || '排序失败');
                this.$message.success('顺序已保存');
                await this.GetDiyTableRow({ _PageIndex: this.DiyTableRowPageIndex || 1 });
            } catch (error) {
                this.$message.error(error.message || '排序失败，请刷新后重试');
                await this.GetDiyTableRow({ _PageIndex: this.DiyTableRowPageIndex || 1 });
            } finally { this.treeDragBusy = false; this.TreeDragEnd(); }
        },
        TreeKeyboardMove(event, row, direction) {
            if (!event.altKey || this.treeDragBusy) return;
            event.preventDefault(); event.stopPropagation();
            const parent = this.CurrentDiyTableModel.TreeParentField || 'ParentId';
            const flattened = []; const walk = list => (list || []).forEach(item => { flattened.push(item); walk(item._Child); });
            walk(this.DiyTableRowList);
            const siblings = flattened.filter(item => String(item[parent] || '') === String(row[parent] || ''));
            const index = siblings.findIndex(item => item.Id === row.Id); const target = siblings[index + direction];
            if (target) this.CommitTreePlacement(row.Id, target.Id, direction < 0 ? 'Before' : 'After');
        }
    }
};
