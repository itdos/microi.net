
export default {
    methods: {
        CloseThisDialog() {
            var self = this;
            self.$refs.refDiyCustomDialog.CloseDialog();
        },
        OpenMenuForm() {
            var self = this;
            if (self.SysMenuModel.Id) {
                self.BtnLoading = true;

                // 守卫语句：延迟渲染DiyFormDialog（异步组件需要重试等待加载完成）
                const tryOpenForm = () => {
                    if (!self._shouldRenderDiyFormDialog) {
                        self._shouldRenderDiyFormDialog = true;
                    }
                    if (self.$refs.refDiyTable_DiyFormDialog) {
                        openForm();
                    } else {
                        var retryCount = 0;
                        var maxRetries = 20;
                        var tryInit = function() {
                            if (self.$refs.refDiyTable_DiyFormDialog) {
                                openForm();
                            } else if (retryCount < maxRetries) {
                                retryCount++;
                                setTimeout(tryInit, 50);
                            } else {
                                console.error('refDiyTable_DiyFormDialog ref未找到，已重试' + maxRetries + '次');
                                self.BtnLoading = false;
                            }
                        };
                        self.$nextTick(tryInit);
                    }
                };

                const openForm = () => {
                    try {
                        self.$refs.refDiyTable_DiyFormDialog.Init({
                            TableName: 'sys_menu',
                            TableRowId: self.SysMenuModel.Id,  // 使用TableRowId而不是Id
                            DialogType: "Dialog",
                            FormMode: 'Edit',
                            SubmitEvent: function(formData, callback) {
                                // 表单提交后的回调
                                if (callback) callback();
                                // 重新加载菜单数据
                                self.GetAllData({ IsInit: false });
                            }
                        });
                        // 延迟关闭loading，确保对话框已打开
                        setTimeout(() => {
                            self.BtnLoading = false;
                        }, 300);
                    } catch (error) {
                        console.error('打开模块设计表单失败:', error);
                        self.BtnLoading = false;
                    }
                };

                tryOpenForm();
            }
        },
        OpenAnyForm(param) {
            var self = this;
            // 延迟渲染：首次调用时才渲染组件
            if (!self._shouldRenderDiyFormDialog) {
                self._shouldRenderDiyFormDialog = true;
            }
            // 异步组件挂载需要时间，使用重试机制等待 ref 就绪
            if (self.$refs.refDiyTable_DiyFormDialog) {
                self.$refs.refDiyTable_DiyFormDialog.Init(param);
            } else {
                var retryCount = 0;
                var maxRetries = 40;
                var tryInit = function() {
                    if (self.$refs.refDiyTable_DiyFormDialog) {
                        self.$refs.refDiyTable_DiyFormDialog.Init(param);
                    } else if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(tryInit, 50);
                    } else {
                        console.error('[OpenAnyForm] refDiyTable_DiyFormDialog 始终未挂载，已重试' + maxRetries + '次');
                    }
                };
                self.$nextTick(tryInit);
            }
        },
        /**
         * 必传：SysMenuId或ModuleEngineKey、SubmitEvent、可选：MultipleSelect、PropsWhere、
         */
        async OpenAnyTable(param) {
            var self = this;
            if (!param.SysMenuId && !param.ModuleEngineKey) {
                self.DiyCommon.Tips("SysMenuId或ModuleEngineKey必传！", false);
                return;
            }

            // 2025-10-29 liucheng 修复：如果OpenAnyTableParam中没有TableId或TableName，则根据SysMenuId获取
            if ((!param.TableId || !param.TableName) && param.SysMenuId) {
                try {
                    var sysMenuResult = await self.DiyCommon.FormEngine.GetFormData({
                        FormEngineKey: "sys_menu",
                        Id: param.SysMenuId
                    });
                    if (sysMenuResult.Code == 1) {
                        if (!param.TableId) {
                            param.TableId = sysMenuResult.Data.DiyTableId;
                        }
                        if (!param.TableName) {
                            param.TableName = sysMenuResult.Data.Name;
                        }
                    }
                } catch (error) {
                    console.warn("获取TableId或TableName失败:", error);
                }
            }

            self.OpenAnyTableParam = param;
            self.ShowAnyTable = true;
        },
        RunOpenAnyTableSubmitEvent() {
            var self = this;
            var tableRef = self.$refs["refOpenAnyTable_" + (self.OpenAnyTableParam.SysMenuId || self.OpenAnyTableParam.ModuleEngineKey)];
            //传入已选择的数据
            var selectData =
                self.OpenAnyTableParam.ShowLeftSelectionList || false
                    ? self.OpenAnyTableParam.TableIndexDataList
                    : (self.OpenAnyTableParam.MultipleSelect === false ? tableRef.TableSelectedRow : tableRef.TableMultipleSelection);
            self.OpenAnyTableParam.SubmitEvent(selectData, function () {
                self.ShowAnyTable = false;
            });
        },
        getOpenAnyTableParam(param) {
            var self = this;
            // 获取取消勾选数据
            const unselectedRows = param.OldTableMultipleSelection.filter((prevRow) => !param.TableMultipleSelection.some((currRow) => currRow.Id === prevRow.Id));
            // 3. 构建新的 TableIndexDataList
            let newTableIndexDataList = [];

            // 如果之前已有数据，先展开
            if (self.OpenAnyTableParam.TableIndexDataList && Array.isArray(self.OpenAnyTableParam.TableIndexDataList)) {
                newTableIndexDataList = [...self.OpenAnyTableParam.TableIndexDataList];
            }

            // 4. 【删除操作】移除取消勾选的行（unselectedRows）
            newTableIndexDataList = newTableIndexDataList.filter((existingRow) => !unselectedRows.some((unselected) => unselected.Id === existingRow.Id));

            // 5. 【新增操作】添加当前选中的行（如果还未存在）
            param.TableMultipleSelection.forEach((currRow) => {
                if (!newTableIndexDataList.some((row) => row.Id === currRow.Id)) {
                    newTableIndexDataList.push(currRow);
                }
            });
            if (param.Type === "N") {
                self.$refs["refOpenAnyTable_" + (self.OpenAnyTableParam.SysMenuId || self.OpenAnyTableParam.ModuleEngineKey)].toggleSelection(unselectedRows, "N");
            }
            // console.log('🔴 取消勾选的行:', unselectedRows);
            self.OpenAnyTableParam = {
                ...self.OpenAnyTableParam,
                ShowDiyFieldList: param.ShowDiyFieldList,
                PageIndex: param.PageIndex,
                TableIndexDataList: newTableIndexDataList
            };
        },
        CallbackFormClose() {
            var self = this;
            // 已迁移至 diy-form-full.vue，通过 refDiyTable_DiyFormDialog 关闭
            // V8.FormClose 可能调用此方法
        },
        /**
         * 必传：ComponentName
         */
        OpenDialog(param) {
            var self = this;
            if (!param.ComponentName) {
                self.DiyCommon.Tips("ComponentName必传！", false);
                return;
            }
            self.DiyCustomDialogConfig = param;
            // self.DiyCustomDialogConfig.Visible = true;
            // 延迟渲染：首次调用时才渲染组件，避免循环依赖
            if (!self._shouldRenderDiyCustomDialog) {
                self._shouldRenderDiyCustomDialog = true;
                // 异步组件(如PrintEngineView)首次加载时，单次 $nextTick 不够等待其挂载完成
                // 使用轮询检测 ref 就绪后再调用 Show()，最多等待 3 秒
                const maxWait = 3000;
                const interval = 50;
                let waited = 0;
                const tryShow = () => {
                    if (self.$refs.refDiyCustomDialog) {
                        self.$refs.refDiyCustomDialog.Show();
                    } else if (waited < maxWait) {
                        waited += interval;
                        setTimeout(tryShow, interval);
                    }
                };
                self.$nextTick(tryShow);
            } else {
                self.$refs.refDiyCustomDialog.Show();
            }
        },
        OpenPrivatePhone(model) {
            var self = this;
            if (self.DiyCommon.IsNull(model)) {
                //新增
            } else {
                //修改
            }
        },
        TableRowDblClick(row, column, event) {
            var self = this;
            //liucheng2025-4-4 无详情则双击不能都点开详情
            var detail = self.IsPermission("NoDetail");
            if (!detail) {
                return;
            }
            // if (!self.SysMenuModel.InTableEdit) {
                self.OpenDetail(row, "View");
            // }
        },
        // 一键处理工作：参考 my-work.vue 的【去处理】实现，查询当前用户在该行上的待办 WF_Work，
        // 然后打开表单 + 工作流右抽屉，进入"发送下一节点 / 同意 / 不同意 / 退回"等处理流程。
        async OpenWorkFlowProcess(row) {
            var self = this;
            if (self.DiyCommon.IsNull(row) || self.DiyCommon.IsNull(row.Id)) {
                return;
            }
            self.BtnLoading = true;
            try {
                // 1) 查询当前用户在此业务数据上的待办（WF_Work，WorkState='Todo'）
                var workRes = await self.DiyCommon.PostAsync("/api/FormEngine/GetFormData", {
                    FormEngineKey: "WF_Work",
                    _Where: [
                        ["TableRowId", "=", row.Id],
                        ["ReceiverId", "=", self.GetCurrentUser.Id],
                        ["WorkState", "=", "Todo"]
                    ]
                });
                if (!workRes || workRes.Code !== 1 || self.DiyCommon.IsNull(workRes.Data)) {
                    self.DiyCommon.Tips("未找到您可处理的待办，可能已被处理或非接收人。", false);
                    self.BtnLoading = false;
                    return;
                }
                var workModel = workRes.Data;
                // 2) 调用 OpenDetail，使用 wfParam.WorkType='DoWork' 进入处理流程
                self.OpenDetail(row, "Edit", true, true, {
                    WorkType: "DoWork",
                    FlowDesignId: workModel.FlowDesignId || self.SysMenuModel.FlowDesignId,
                    WorkModel: workModel,
                    CurrentFlowId: workModel.FlowId,
                    CurrentNodeId: workModel.NodeId
                });
            } catch (error) {
                self.DiyCommon.Tips("打开处理工作页面失败：" + (error && error.message ? error.message : error), false);
                self.BtnLoading = false;
            }
        },
    }
};
