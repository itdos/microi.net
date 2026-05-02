export default {
    methods: {
        DiyTableSetCurrentRow(row) {
            var self = this;
            self.$refs["diy-table-" + self.TableId].setCurrentRow(row);
        },
        DiyTableCurrentChange(currentRow) {
            var self = this;
            // 🔥 性能优化：避免对整行做 spread (200条数据时 currentRow 可能含数十字段)
            // 仅保存引用即可；行已 markRaw 不会触发深度代理
            self.TableSelectedRowLast = self.TableSelectedRow || {};
            self.TableSelectedRow = currentRow || {};
        },
        TableRowSelectionChange(val) {
            var self = this;
            var OldTableMultipleSelection = self.TableMultipleSelection.flat();
            self.TableMultipleSelection = val;
            if (self.PropsTableType && self.PropsTableType === "OpenTable") {
                self.$emit("getOpenAnyTableParam", {
                    OldTableMultipleSelection: OldTableMultipleSelection,
                    TableMultipleSelection: self.TableMultipleSelection,
                    ShowDiyFieldList: self.ShowDiyFieldList,
                    PageIndex: self.DiyTableRowPageIndex,
                    Type: "Y"
                });
            }
        },
        // 卡片模式批量选择
        toggleCardSelection(model) {
            const self = this;
            const index = self.cardSelection.findIndex(item => item.Id === model.Id);
            if (index > -1) {
                self.cardSelection.splice(index, 1);
            } else {
                self.cardSelection.push(model);
            }
            // 同步到 TableMultipleSelection
            self.TableMultipleSelection = [...self.cardSelection];
        },
        isCardSelected(model) {
            const self = this;
            return self.cardSelection.some(item => item.Id === model.Id);
        },
        toggleCardSelectAll(checked) {
            const self = this;
            if (checked) {
                self.cardSelection = [...self.DiyTableRowList];
            } else {
                self.cardSelection = [];
            }
            // 同步到 TableMultipleSelection
            self.TableMultipleSelection = [...self.cardSelection];
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
