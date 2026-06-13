export default {
    methods: {
        DiyTableSetCurrentRow(row) {
            var self = this;
            var tableRef = self.$refs["diy-table-" + self.TableId];
            if (tableRef && tableRef.setCurrentRow) {
                tableRef.setCurrentRow(row);
            }
            // 🔥 highlight-current-row 已移除，这里用 DOM 方式补上当前行高亮
            self.HighlightCurrentRowByRow(row);
        },
        // 根据行数据，按其在当前渲染列表中的索引定位 <tr> 并高亮（用于程序化选中）
        HighlightCurrentRowByRow(row) {
            var self = this;
            try {
                if (!row || self.DiyCommon.IsNull(row.Id)) return;
                var list = self.RenderedTableRowList || [];
                var idx = list.findIndex(function (item) { return item && item.Id === row.Id; });
                if (idx < 0) return;
                var root = document.getElementById('diy-table-' + self.TableId);
                if (!root) return;
                var rows = root.querySelectorAll('.el-table__body-wrapper tbody tr.el-table__row');
                var tr = rows && rows[idx];
                if (!tr || !tr.classList) return;
                if (self._currentHighlightRowEl && self._currentHighlightRowEl !== tr && self._currentHighlightRowEl.classList) {
                    self._currentHighlightRowEl.classList.remove('diy-current-row');
                }
                tr.classList.add('diy-current-row');
                self._currentHighlightRowEl = tr;
            } catch (e) {}
        },
        // 🔥 性能优化：纯 DOM 高亮当前行，不触发 Vue/Element Plus 表体重新渲染。
        // 替代 highlight-current-row（store 驱动会重渲染整张表，大数据量点击卡顿）。
        ApplyCurrentRowHighlight(event) {
            var self = this;
            try {
                var tr = event && event.currentTarget ? event.currentTarget : null;
                if (!tr && event && event.target && event.target.closest) {
                    tr = event.target.closest('tr');
                }
                if (!tr || !tr.classList) return;
                if (self._currentHighlightRowEl && self._currentHighlightRowEl !== tr && self._currentHighlightRowEl.classList) {
                    self._currentHighlightRowEl.classList.remove('diy-current-row');
                }
                tr.classList.add('diy-current-row');
                self._currentHighlightRowEl = tr;
            } catch (e) {}
        },
        DiyTableCurrentChange(currentRow) {
            var self = this;
            var oldSelection = self.TableMultipleSelection ? self.TableMultipleSelection.flat() : [];
            // 🔥 性能优化：避免对整行做 spread (200条数据时 currentRow 可能含数十字段)
            // 仅保存引用即可；行已 markRaw 不会触发深度代理
            self.TableSelectedRowLast = self.TableSelectedRow || {};
            self.TableSelectedRow = currentRow || {};
            if (self.IsOpenTableSingleSelect()) {
                self.TableMultipleSelection = currentRow && currentRow.Id ? [currentRow] : [];
                self.EmitOpenTableSelectionChange(oldSelection, 'Y');
            }
        },
        IsOpenTableSingleSelect() {
            return this.PropsTableType === 'OpenTable' && this.EnableMultipleSelect !== true;
        },
        IsCardSelectActive(model) {
            if (this.IsOpenTableSingleSelect()) {
                return !!(model && this.TableSelectedRow && this.TableSelectedRow.Id === model.Id);
            }
            return this.CanUseTableSelection() && this.isCardSelected(model);
        },
        selectOpenTableSingleRow(row) {
            var self = this;
            if (!row) return;
            var tableRef = self.$refs["diy-table-" + self.TableId];
            if (tableRef && tableRef.setCurrentRow) {
                tableRef.setCurrentRow(row);
            }
            self.DiyTableCurrentChange(row);
        },
        EmitOpenTableSelectionChange(oldSelection, type) {
            var self = this;
            if (self.PropsTableType && self.PropsTableType === "OpenTable") {
                self.$emit("getOpenAnyTableParam", {
                    OldTableMultipleSelection: oldSelection || [],
                    TableMultipleSelection: self.TableMultipleSelection,
                    TableSelectedRow: self.TableSelectedRow,
                    ShowDiyFieldList: self.ShowDiyFieldList,
                    PageIndex: self.DiyTableRowPageIndex,
                    Type: type || "Y"
                });
            }
        },
        TableRowSelectionChange(val) {
            var self = this;
            var OldTableMultipleSelection = self.TableMultipleSelection.flat();
            self.TableMultipleSelection = val;
            self.EmitOpenTableSelectionChange(OldTableMultipleSelection, "Y");
        },
        HasBatchSelectMoreBtns(sysMenuModel) {
            var menu = sysMenuModel || this.SysMenuModel;
            var buttons = menu && menu.BatchSelectMoreBtns;
            if (!buttons) return false;
            if (Array.isArray(buttons)) return buttons.length > 0;
            if (typeof buttons === 'string') {
                try {
                    var parsed = JSON.parse(buttons);
                    return Array.isArray(parsed) && parsed.length > 0;
                } catch (e) {
                    return buttons.length > 2;
                }
            }
            return false;
        },
        CanUseTableSelection() {
            return this.TableEnableBatch === true && (this.HasBatchSelectMoreBtns() || this.EnableMultipleSelect === true);
        },
        CanBatchDragSelection() {
            return this.TableDisplayMode === 'Table' && this.CanUseTableSelection();
        },
        IsRowSelected(row) {
            if (!row || !row.Id) return false;
            return (this.TableMultipleSelection || []).some(function(item) { return item && item.Id === row.Id; });
        },
        GetBatchDragRowByElement(element) {
            if (!element || !element.closest) return null;
            var tableEl = document.getElementById('diy-table-' + this.TableId);
            if (tableEl && !tableEl.contains(element)) return null;
            var bodyWrapper = element.closest('.el-table__body-wrapper');
            if (!bodyWrapper || (tableEl && !tableEl.contains(bodyWrapper))) return null;
            var rowEl = element.closest('tr');
            if (!rowEl || !rowEl.parentNode) return null;
            var rows = Array.prototype.slice.call(rowEl.parentNode.children).filter(function(item) {
                return item && item.nodeType === 1;
            });
            var index = rows.indexOf(rowEl);
            if (index < 0) return null;
            return (this.RenderedTableRowList || [])[index] || null;
        },
        GetBatchDragRowByCell(cell) {
            return this.GetBatchDragRowByElement(cell);
        },
        // 🔥 判断 mousedown 起点是否允许触发"拖动批量选择"。
        // 只有以下三种区域才允许，避免在数据单元格上拖动时无法选中/复制单元格文字：
        //  - 'selection'：复选框那一列（td.el-table-column--selection / .diy-batch-drag-zone）
        //  - 'index'：序号那一列（type=index，附加 class-name=diy-batch-drag-zone）
        //  - 'blank'：表格空白处（表体内但不落在任何数据单元格上）
        // 返回 null 表示落在数据单元格 → 不启用拖动，放行原生文本选择。
        IsBatchDragScrollbarTarget(target, bodyWrapper, event) {
            if (!target || !target.closest) return false;
            if (target.closest('.el-scrollbar__bar, .el-scrollbar__thumb')) return true;
            if (!bodyWrapper || !event || !bodyWrapper.getBoundingClientRect) return false;
            var rect = bodyWrapper.getBoundingClientRect();
            var x = event.clientX || 0;
            var y = event.clientY || 0;
            var scrollbarSize = 18;
            var hasHorizontal = bodyWrapper.scrollWidth > bodyWrapper.clientWidth + 1;
            var hasVertical = bodyWrapper.scrollHeight > bodyWrapper.clientHeight + 1;
            if (hasHorizontal && y >= rect.bottom - scrollbarSize && y <= rect.bottom && x >= rect.left && x <= rect.right) return true;
            if (hasVertical && x >= rect.right - scrollbarSize && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
            return false;
        },
        GetBatchDragStartZone(target, event) {
            if (!target || !target.closest) return null;
            var tableEl = document.getElementById('diy-table-' + this.TableId);
            if (tableEl && !tableEl.contains(target)) return null;
            // 必须在表体区域内（排除表头、分页、工具栏）
            var bodyWrapper = target.closest('.el-table__body-wrapper');
            if (!bodyWrapper || (tableEl && !tableEl.contains(bodyWrapper))) return null;
            if (this.IsBatchDragScrollbarTarget(target, bodyWrapper, event)) return null;
            // 复选框列 / 序号列（标记了 diy-batch-drag-zone，或原生 selection 列类名）
            if (target.closest('td.diy-batch-drag-zone') || target.closest('td.el-table-column--selection')) {
                return 'zone';
            }
            // 落在数据单元格上 → 不启用拖动（让用户能选中、复制单元格文字）
            if (target.closest('td.el-table__cell')) return null;
            // 表体内但不在任何单元格上（行下方空白区） → 启用框选
            return 'blank';
        },
        GetBatchDragRowByPoint(clientX, clientY) {
            if (typeof document === 'undefined' || !document.elementFromPoint) return null;
            return this.GetBatchDragRowByElement(document.elementFromPoint(clientX, clientY));
        },
        GetBatchDragRowsByRect(rect) {
            var tableEl = document.getElementById('diy-table-' + this.TableId);
            if (!tableEl || !rect) return [];
            var rows = tableEl.querySelectorAll('.el-table__body-wrapper tbody tr');
            var dataList = this.RenderedTableRowList || [];
            var selectedRows = [];
            Array.prototype.forEach.call(rows, function(rowEl, index) {
                var rowRect = rowEl.getBoundingClientRect();
                var hitY = rowRect.bottom >= rect.top && rowRect.top <= rect.bottom;
                var hitX = rowRect.right >= rect.left && rowRect.left <= rect.right;
                if (hitX && hitY && dataList[index]) selectedRows.push(dataList[index]);
            });
            return selectedRows;
        },
        BatchDragSelectionRectStyle() {
            var rect = this._batchDragRect || {};
            return {
                left: (rect.left || 0) + 'px',
                top: (rect.top || 0) + 'px',
                width: Math.max(0, rect.width || 0) + 'px',
                height: Math.max(0, rect.height || 0) + 'px'
            };
        },
        UpdateBatchDragSelectionRect(event) {
            var start = this._batchDragStartPoint || { x: 0, y: 0 };
            var current = { x: event.clientX || 0, y: event.clientY || 0 };
            var left = Math.min(start.x, current.x);
            var top = Math.min(start.y, current.y);
            var right = Math.max(start.x, current.x);
            var bottom = Math.max(start.y, current.y);
            this._batchDragRect = {
                left: left,
                top: top,
                width: right - left,
                height: bottom - top
            };
            return { left: left, top: top, right: right, bottom: bottom };
        },
        BeginBatchDragDocumentMode() {
            if (typeof document === 'undefined') return;
            if (this._batchDragBodyUserSelect === null || this._batchDragBodyUserSelect === undefined) {
                this._batchDragBodyUserSelect = document.body.style.userSelect;
            }
            document.body.style.userSelect = 'none';
            if (window.getSelection) {
                var selection = window.getSelection();
                if (selection && selection.removeAllRanges) selection.removeAllRanges();
            }
        },
        EndBatchDragDocumentMode() {
            if (typeof document === 'undefined') return;
            if (this._batchDragBodyUserSelect !== null && this._batchDragBodyUserSelect !== undefined) {
                document.body.style.userSelect = this._batchDragBodyUserSelect;
            }
            this._batchDragBodyUserSelect = null;
        },
        IsBatchDragNativeCheckboxTarget(target) {
            if (!target || !target.closest) return false;
            return !!target.closest('td.el-table-column--selection');
        },
        FocusBatchDragStartTarget() {
            var target = this._batchDragStartTarget;
            if (!target || !target.focus || !target.matches) return;
            if (target.matches('input, textarea, [contenteditable="true"]')) {
                try { target.focus(); } catch (e) {}
            }
        },
        SetBatchDragRowSelection(row, selected) {
            if (!row || !row.Id) return;
            if (!this._batchDragSelectionVisited) this._batchDragSelectionVisited = {};
            if (this._batchDragSelectionVisited[row.Id]) return;
            this._batchDragSelectionVisited[row.Id] = true;
            var tableRef = this.$refs["diy-table-" + this.TableId];
            if (tableRef && tableRef.toggleRowSelection) {
                tableRef.toggleRowSelection(row, selected);
            }
        },
        // 🔥 矩形框选实时对账：框内的行设为目标选中态；
        // 之前被本次框选改动过、但现在已离开矩形框的行，恢复到拖动开始前的原始选中态。
        // 这样缩小虚线框时，刚刚被框中的行会自动取消选中。
        ApplyBatchDragRectSelection(rows) {
            var self = this;
            var tableRef = self.$refs["diy-table-" + self.TableId];
            if (!tableRef || !tableRef.toggleRowSelection) return;
            if (!self._batchDragApplied) self._batchDragApplied = {};
            var currentIds = {};
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                if (!row || !row.Id) continue;
                currentIds[row.Id] = true;
                if (!self._batchDragApplied[row.Id]) {
                    // 记录该行拖动前的原始选中态，便于离开矩形时还原
                    self._batchDragApplied[row.Id] = { row: row, original: self.IsRowSelected(row) };
                    tableRef.toggleRowSelection(row, self._batchDragSelectionMode);
                }
            }
            // 还原：之前被本次拖动改动、现已不在矩形内的行
            Object.keys(self._batchDragApplied).forEach(function (id) {
                if (!currentIds[id]) {
                    var entry = self._batchDragApplied[id];
                    if (entry && entry.row) {
                        tableRef.toggleRowSelection(entry.row, entry.original);
                    }
                    delete self._batchDragApplied[id];
                }
            });
        },
        BatchDragSelectionMouseDown(event) {
            var self = this;
            if (!self.CanBatchDragSelection() || !event || event.button !== 0 || !event.target || !event.target.closest) return;
            // 🔥 只允许在复选框列、序号列或表格空白处发起拖动批量选择；数据单元格放行文本选择。
            var zone = self.GetBatchDragStartZone(event.target, event);
            if (!zone) return;
            var row = zone === 'blank' ? null : self.GetBatchDragRowByElement(event.target);
            self._batchDragPending = true;
            self._batchDragSelecting = false;
            // 空白处起拖默认进入"选中"模式；落在某行的复选框/序号列时按该行当前状态取反。
            self._batchDragSelectionMode = row ? !self.IsRowSelected(row) : true;
            self._batchDragStartPoint = { x: event.clientX || 0, y: event.clientY || 0 };
            self._batchDragStartRow = row;
            self._batchDragStartTarget = event.target;
            self._batchDragSelectionVisited = null;
            self._batchDragApplied = null;
            self._batchDragRect = null;
            self.BeginBatchDragDocumentMode();
            if (!self.IsBatchDragNativeCheckboxTarget(event.target) && event.preventDefault) {
                event.preventDefault();
            }
            document.addEventListener('mousemove', self.BatchDragSelectionMouseMove, true);
            document.addEventListener('mouseup', self.BatchDragSelectionStop, true);
            // 🔥 修复"虚线框出现后又马上消失"：mouseleave 不冒泡，旧代码用 capture=true 监听 document
            // 会在捕获阶段收到每个子元素的 mouseleave，导致鼠标一移动就立刻停止拖动。
            // 改为在 <html> 上以冒泡阶段监听，仅当指针真正离开窗口时才触发停止。
            document.documentElement.addEventListener('mouseleave', self.BatchDragSelectionStop, false);
        },
        BatchDragSelectionMouseMove(event) {
            if (!this._batchDragPending && !this._batchDragSelecting) return;
            if (this._batchDragPending) {
                var point = this._batchDragStartPoint || { x: 0, y: 0 };
                var moveX = Math.abs((event.clientX || 0) - point.x);
                var moveY = Math.abs((event.clientY || 0) - point.y);
                if (moveX < 4 && moveY < 4) return;
                this._batchDragPending = false;
                this._batchDragSelecting = true;
                this._batchDragSelectionVisited = {};
                this._batchDragApplied = {};
                this._batchDragSuppressClick = true;
                document.addEventListener('click', this.BatchDragSelectionClick, true);
            }
            var rect = this.UpdateBatchDragSelectionRect(event);
            var rows = this.GetBatchDragRowsByRect(rect);
            if (rows.length === 0) {
                // 矩形未覆盖任何整行时，兜底用指针所在行（避免行间隙抖动）
                var pointRow = this.GetBatchDragRowByPoint(event.clientX || 0, event.clientY || 0);
                if (pointRow) rows = [pointRow];
            }
            // 起拖行（复选框/序号列）始终纳入框选范围，保证起点行不被误还原
            if (this._batchDragStartRow && this._batchDragStartRow.Id) {
                var hasStart = false;
                for (var j = 0; j < rows.length; j++) {
                    if (rows[j] && rows[j].Id === this._batchDragStartRow.Id) { hasStart = true; break; }
                }
                if (!hasStart) rows.push(this._batchDragStartRow);
            }
            this.ApplyBatchDragRectSelection(rows);
            if (window.getSelection) {
                var selection = window.getSelection();
                if (selection && selection.removeAllRanges) selection.removeAllRanges();
            }
            if (event.preventDefault) event.preventDefault();
        },
        BatchDragSelectionClick(event) {
            document.removeEventListener('click', this.BatchDragSelectionClick, true);
            if (!this._batchDragSuppressClick) return;
            this._batchDragSuppressClick = false;
            if (event.preventDefault) event.preventDefault();
            if (event.stopPropagation) event.stopPropagation();
        },
        BatchDragSelectionCellEnter(row, column) {
            if (!this._batchDragSelecting || !column || column.type !== 'selection') return;
            this.SetBatchDragRowSelection(row, this._batchDragSelectionMode);
        },
        BatchDragSelectionStop() {
            this._batchDragPending = false;
            this._batchDragSelecting = false;
            this._batchDragSelectionVisited = null;
            this._batchDragApplied = null;
            this._batchDragStartPoint = null;
            this._batchDragStartRow = null;
            if (!this._batchDragSuppressClick) this.FocusBatchDragStartTarget();
            this._batchDragStartTarget = null;
            this._batchDragRect = null;
            this.EndBatchDragDocumentMode();
            document.removeEventListener('mousemove', this.BatchDragSelectionMouseMove, true);
            document.removeEventListener('mouseup', this.BatchDragSelectionStop, true);
            document.documentElement.removeEventListener('mouseleave', this.BatchDragSelectionStop, false);
        },
        // 卡片模式批量选择
        toggleCardSelection(model) {
            const self = this;
            const oldSelection = self.TableMultipleSelection.flat();
            const index = self.cardSelection.findIndex(item => item.Id === model.Id);
            if (index > -1) {
                self.cardSelection.splice(index, 1);
            } else {
                self.cardSelection.push(model);
            }
            // 同步到 TableMultipleSelection
            self.TableMultipleSelection = [...self.cardSelection];
            self.EmitOpenTableSelectionChange(oldSelection, "Y");
        },
        isCardSelected(model) {
            const self = this;
            return self.cardSelection.some(item => item.Id === model.Id);
        },
        toggleCardSelectAll(checked) {
            const self = this;
            const oldSelection = self.TableMultipleSelection.flat();
            if (checked) {
                self.cardSelection = [...self.DiyTableRowList];
            } else {
                self.cardSelection = [];
            }
            // 同步到 TableMultipleSelection
            self.TableMultipleSelection = [...self.cardSelection];
            self.EmitOpenTableSelectionChange(oldSelection, "Y");
        },
        toggleSelection(rows, type) {
            var self = this;
            this.$nextTick(() => {
                if (!self.$refs["diy-table-" + self.TableId] || !self.$refs["diy-table-" + self.TableId].toggleRowSelection) {
                    // console.warn("表格 ref 未找到或 toggleRowSelection 方法不存在");
                } else {
                    // rows.forEach(row => {
                    //   self.$refs['diy-table-' + self.TableId].toggleRowSelection(self.tableData,true);
                    // });
                    // 选中行

                    // 遍历当前表格中显示的每一行数据
                    self.DiyTableRowList.forEach((tableRow) => {
                        // 判断：当前行的 id 是否在历史记录 selectedRows 的 id 中
                        const isSelectedInHistory = rows.some((historyRow) => {
                            // 假定用 id 字段来比对是否是同一条数据
                            return historyRow.Id === tableRow.Id;
                        });
                        if (isSelectedInHistory) {
                            // 如果历史记录中存在，则默认勾选这一行
                            if (type == "Y") {
                                self.$refs["diy-table-" + self.TableId].toggleRowSelection(tableRow, true); // ✅ 传入当前行的对象引用
                                self.TableMultipleSelection.push(tableRow);
                            } else {
                                self.$refs["diy-table-" + self.TableId].toggleRowSelection(tableRow, false);
                                self.TableMultipleSelection = self.TableMultipleSelection.filter((uns) => uns.Id !== tableRow.Id);
                            }
                        }
                    });
                }
            });
        },
        DiyTableRowCurrentChange(val) {
            var self = this;
            self.DiyTableRowPageIndex = val;
            // 翻页时清空卡片选择
            self.cardSelection = [];
            self.TableSelectedRow = {};
            if (self.IsOpenTableSingleSelect()) {
                self.TableMultipleSelection = [];
            }
            self.GetDiyTableRow();
            self.$nextTick(function () {
                $(`#diy-table-${self.TableId} .el-table__body-wrapper`).scrollTop(0);
            });
        },
        DiyTableRowSizeChange(val) {
            var self = this;
            self.DiyTableRowPageSize = val;
            // 使用 LocalStorage 管理器，带自动清理
            if (self.$localStorageManager) {
                self.$localStorageManager.setTableConfig(self.TableId, val);
            } else {
                localStorage.setItem("Microi.DiyTableRowPageSize_" + self.TableId, val);
            }
            self.DiyTableRowPageIndex = 1;
            // 切换页大小时清空卡片选择
            self.cardSelection = [];
            self.TableSelectedRow = {};
            if (self.IsOpenTableSingleSelect()) {
                self.TableMultipleSelection = [];
            }
            self.GetDiyTableRow({ _PageIndex: 1 });
            self.$nextTick(function () {
                $(`#diy-table-${self.TableId} .el-table__body-wrapper`).scrollTop(0);
            });
        },
        //传入{Data:[], DataCount:0, }
        TableSetData(dataObj) {
            var slef = this;
            self.DiyTableRowList = dataObj.Data;
            self.DiyTableRowCount = dataObj.DataCount;
            // //需要将这些数据全部插入数据库
            // dataObj.Data.forEach(element => {
            //     self.DosCommon.Post
            // });
        },
    }
};
