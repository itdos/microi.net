
export default {
    methods: {
        WarmupDiyFormDialog() {
            if (!this._diyFormDialogWarmupPromise) {
                // diy-form 在弹窗组件内部仍是异步组件；两者一起预热，才能真正消除首次打开时的二次下载和解析。
                this._diyFormDialogWarmupPromise = Promise.all([
                    import("@/views/form-engine/diy-form-full.vue"),
                    import("@/views/form-engine/diy-form.vue")
                ]).catch((error) => {
                    this._diyFormDialogWarmupPromise = null;
                    console.warn("[DiyTable] 表单弹窗预加载失败，将在打开时重试", error);
                });
            }
            return this._diyFormDialogWarmupPromise;
        },
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
                            Height: "80vh",
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
        GetOpenAnyTableEqualWhere(propsWhere) {
            if (!Array.isArray(propsWhere)) {
                return null;
            }
            for (var i = 0; i < propsWhere.length; i++) {
                var item = propsWhere[i];
                if (!Array.isArray(item)) {
                    continue;
                }
                var offset = 0;
                var first = String(item[0] || "").toUpperCase();
                if (first === "AND" || first === "OR") {
                    offset = 1;
                }
                var fieldName = item[offset];
                var operate = item[offset + 1];
                var fieldValue = item[offset + 2];
                if (!fieldName || fieldValue === undefined || fieldValue === null || fieldValue === "") {
                    continue;
                }
                var op = String(operate || "").toLowerCase();
                if (op === "=" || op === "==" || op === "equal") {
                    return {
                        FieldName: fieldName,
                        Value: fieldValue
                    };
                }
            }
            return null;
        },
        BuildOpenAnyTableImportContext(param) {
            var self = this;
            var result = { ...(param || {}) };
            var relationWhere = self.GetOpenAnyTableEqualWhere(result.PropsWhere);
            var fixedValues = {};
            if (result.TableChildImportContext && result.TableChildImportContext.FixedValues) {
                fixedValues = { ...result.TableChildImportContext.FixedValues };
            }

            if (relationWhere) {
                if (!result.TableChildFkFieldName) {
                    result.TableChildFkFieldName = relationWhere.FieldName;
                }
                if (!result.TableChildTableRowId) {
                    result.TableChildTableRowId = relationWhere.Value;
                }
            }

            if (result.TableChildFkFieldName && result.TableChildTableRowId !== undefined && result.TableChildTableRowId !== null && result.TableChildTableRowId !== "") {
                fixedValues[result.TableChildFkFieldName] = result.TableChildTableRowId;
            }

            if (!result.FatherFormModel && result.ParentFormModel) {
                result.FatherFormModel = result.ParentFormModel;
            }
            if (!result.FatherFormModel && result.ParentForm) {
                result.FatherFormModel = result.ParentForm;
            }
            if (!result.PrimaryTableFieldName && result.FatherFormModel) {
                result.PrimaryTableFieldName = "Id";
            }

            if (Object.keys(fixedValues).length > 0) {
                result.TableChildImportContext = {
                    ...(result.TableChildImportContext || {}),
                    Source: "OpenAnyTable",
                    TableChildFkFieldName: result.TableChildFkFieldName,
                    PrimaryTableFieldName: result.PrimaryTableFieldName || "",
                    ParentTableRowId: result.TableChildTableRowId || "",
                    FixedValues: fixedValues
                };
            }
            return result;
        },
        async OpenAnyTable(param) {
            var self = this;
            param = param || {};
            if (!param.SysMenuId && !param.ModuleEngineKey) {
                self.DiyCommon.Tips("SysMenuId或ModuleEngineKey必传！", false);
                return;
            }

            // 2025-10-29 liucheng 修复：如果OpenAnyTableParam中没有TableId或TableName，则根据SysMenuId获取
            if ((!param.TableId || !param.TableName) && param.SysMenuId) {
                try {
                    // 使用菜单元数据专用端点。该端点会验证当前用户确实拥有目标菜单权限，
                    // 不通过通用 FormEngine 暴露受保护的 sys_menu 表。
                    var sysMenuResult = await self.DiyCommon.PostAsync("/api/FormEngine/GetSysMenuModel", {
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

            self.OpenAnyTableParam = self.BuildOpenAnyTableImportContext(param);
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
            var selectedIds = {};
            var newTableIndexDataList = [];
            (param.TableMultipleSelection || []).forEach(function(row) {
                if (!row || !row.Id || selectedIds[row.Id]) return;
                selectedIds[row.Id] = true;
                newTableIndexDataList.push(row);
            });
            self.OpenAnyTableParam = {
                ...self.OpenAnyTableParam,
                ShowDiyFieldList: param.ShowDiyFieldList,
                PageIndex: param.PageIndex,
                ContinuousSelection: param.ContinuousSelection === true,
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
            // SetV8DefaultValue 会更新表格选择态、工作流和 V8 缓存等响应式数据。
            // 必须在点击事件中预先生成弹窗上下文，不能在模板渲染期间调用，
            // 否则会形成“渲染 -> 写响应式状态 -> 再渲染”的递归更新。
            self.DiyCustomDialogDataAppend = self.GetDiyCustomDialogDataAppend();
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
        OpenAppDialog(param) {
            var self = this;
            param = param || {};
            if (!param.AppKey) {
                self.DiyCommon.Tips("AppKey必传！", false);
                return;
            }
            self.OpenDialog({
                ComponentName: "MicroAppDialog",
                Title: param.Title || "应用",
                TitleIcon: param.TitleIcon || "fas fa-window-maximize",
                Width: param.Width || "min(920px, calc(100vw - 32px))",
                BodyHeight: "min(680px, calc(100vh - 190px))",
                OpenType: param.OpenType || "Dialog",
                DataAppend: {
                    AppKey: param.AppKey,
                    Version: param.Version || "",
                    RoutePath: param.RoutePath || param.MicroRoute || "/",
                    Data: param.Data || {},
                    OnSuccess: param.OnSuccess,
                    OnCancel: param.OnCancel,
                    OnError: param.OnError
                }
            });
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
            if (row && row.__TreeLazyLoadMore) {
                return;
            }
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
                    self.DiyCommon.Tips(self.$t("Msg.NoPendingWork"), false);
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
                self.DiyCommon.Tips(self.$t("Msg.OpenDoWorkFailed") + ": " + (error && error.message ? error.message : error), false);
                self.BtnLoading = false;
            }
        },
    }
};
