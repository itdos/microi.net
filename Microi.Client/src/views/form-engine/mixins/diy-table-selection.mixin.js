export default {
    methods: {
        DiyTableSetCurrentRow(row) {
            var self = this;
            self.$refs["diy-table-" + self.TableId].setCurrentRow(row);
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
            return this.TableEnableBatch && this.isCardSelected(model);
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
        HasBatchSelectMoreBtns() {
            var buttons = this.SysMenuModel && this.SysMenuModel.BatchSelectMoreBtns;
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
        CanBatchDragSelection() {
            return this.TableDisplayMode === 'Table' && this.TableEnableBatch === true && this.HasBatchSelectMoreBtns();
        },
        IsRowSelected(row) {
            if (!row || !row.Id) return false;
            return (this.TableMultipleSelection || []).some(function(item) { return item && item.Id === row.Id; });
        },
        GetBatchDragRowByCell(cell) {
            if (!cell) return null;
            var rowEl = cell.closest ? cell.closest('tr') : null;
            if (!rowEl || !rowEl.parentNode) return null;
            var rows = Array.prototype.slice.call(rowEl.parentNode.children).filter(function(item) {
                return item && item.nodeType === 1;
            });
            var index = rows.indexOf(rowEl);
            if (index < 0) return null;
            return (this.RenderedTableRowList || [])[index] || null;
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
        BatchDragSelectionMouseDown(event) {
            var self = this;
            if (!self.CanBatchDragSelection() || !event || event.button !== 0 || !event.target || !event.target.closest) return;
            var cell = event.target.closest('td.el-table-column--selection');
            if (!cell) return;
            var row = self.GetBatchDragRowByCell(cell);
            if (!row) return;
            self._batchDragSelecting = true;
            self._batchDragSelectionMode = !self.IsRowSelected(row);
            self._batchDragSelectionVisited = {};
            self.SetBatchDragRowSelection(row, self._batchDragSelectionMode);
            if (event.preventDefault) event.preventDefault();
            document.addEventListener('mouseup', self.BatchDragSelectionStop, true);
            document.addEventListener('mouseleave', self.BatchDragSelectionStop, true);
        },
        BatchDragSelectionCellEnter(row, column) {
            if (!this._batchDragSelecting || !column || column.type !== 'selection') return;
            this.SetBatchDragRowSelection(row, this._batchDragSelectionMode);
        },
        BatchDragSelectionStop() {
            this._batchDragSelecting = false;
            this._batchDragSelectionVisited = null;
            document.removeEventListener('mouseup', this.BatchDragSelectionStop, true);
            document.removeEventListener('mouseleave', this.BatchDragSelectionStop, true);
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
