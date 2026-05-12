
export default {
    methods: {
        // ========== 获取当前激活的右侧面板（PC=formRightPanel；移动端抽屉=formRightPanelMobile） ==========
        GetActiveRightPanel() {
            // 移动端时，若抽屉已渲染，优先使用移动端面板；否则回退至 PC 面板（PC 面板可能仍存在）
            if (this.diyStore.IsPhoneView) {
                if (this.$refs.formRightPanelMobile) return this.$refs.formRightPanelMobile;
            }
            return this.$refs.formRightPanel || this.$refs.formRightPanelMobile;
        },
        GetActiveWfWorkHandler() {
            var p = this.GetActiveRightPanel();
            return p && p.$refs ? p.$refs.refWfWorkHandler : null;
        },
        NormalizeRef(ref) {
            return Array.isArray(ref) ? ref[0] : ref;
        },
        GetActiveFieldForm() {
            var pageForm = this.NormalizeRef(this.$refs.fieldFormPage);
            var fieldForm = this.NormalizeRef(this.$refs.fieldForm);
            if (this.IsPageMode && pageForm) return pageForm;
            return fieldForm || pageForm;
        },
        CallbackGetFormData(payload) {
            var form = this.GetActiveFieldForm();
            this.WfFormData = form && typeof form.GetFormData === "function" ? form.GetFormData() : {};
            if (payload && typeof payload.callback === "function") {
                payload.callback(this.WfFormData);
            }
        },
        CallbackFieldSet(fieldName, attrName, value) {
            var form = this.GetActiveFieldForm();
            if (form && typeof form.FieldSet === "function") {
                form.FieldSet(fieldName, attrName, value);
            }
        },
        // 工作流：从表单顶部/底部触发右侧 WfWorkHandler 的 SubmitWF（醒目按钮入口，带防重入）
        TriggerWfSubmit() {
            var self = this;
            if (self.WfSubmitting || self.BtnLoading) return;
            var handler = self.GetActiveWfWorkHandler();
            if (handler) {
                if (handler.BtnLoading) return;
                if (typeof handler.SubmitWF === 'function') {
                    self.WfSubmitting = true;
                    var submitResult = null;
                    try { submitResult = handler.SubmitWF(); } finally {
                        // 异步处理中，handler.BtnLoading 会接手状态；这里略延后释放本地锁
                        if (submitResult && typeof submitResult.finally === "function") {
                            submitResult.finally(function () { self.WfSubmitting = false; });
                        } else {
                            setTimeout(function () { self.WfSubmitting = false; }, 800);
                        }
                    }
                    return;
                }
            }
            // 移动端可能未挂载右侧抽屉：先打开抽屉，再次重试
            if (self.diyStore.IsPhoneView) {
                self.showMobileRightDrawer = true;
                self.WfSubmitting = true;
                self.$nextTick(function () {
                    setTimeout(function () {
                        var h = self.GetActiveWfWorkHandler();
                        if (h && !h.BtnLoading && typeof h.SubmitWF === 'function') {
                            var submitResult = h.SubmitWF();
                            if (submitResult && typeof submitResult.finally === "function") {
                                submitResult.finally(function () { self.WfSubmitting = false; });
                                return;
                            }
                        }
                        self.WfSubmitting = false;
                    }, 150);
                });
            }
        },
        GetActiveWfHistory() {
            var p = this.GetActiveRightPanel();
            return p && p.$refs ? p.$refs.refWFHistory : null;
        },
        // ========== 工作流回调（发起流程按钮点击时触发） ==========
        // 单事务合并：表单保存 + StartWork 在后端单一 DbTrans 内完成（/api/WorkFlow/StartWorkWithForm）
        async CallbackStartWork(param, callback) {
            var self = this;

            try {
                var form = self.GetActiveFieldForm();
                var wfHandler = self.GetActiveWfWorkHandler();
                if (!form || !wfHandler) {
                    if (callback) { callback(); }
                    return;
                }
                var formData = form.GetFormData();
                var oldFormData = typeof form.GetOldFormData === "function" ? form.GetOldFormData() : null;

                // 第1步：执行节点开始V8（可终止提交、修改表单值、获取审批信息）
                var v8Result = await wfHandler.RunNodeStartV8({ Form: formData, OldForm: oldFormData });
                if (v8Result.Result === false) {
                    if (callback) { callback(); }
                    return;
                }
                if (v8Result.Form) {
                    form.SetFormData(v8Result.Form);
                } else {
                    v8Result.Form = formData;
                }

                var oldFormHasId = oldFormData && !self.DiyCommon.IsNull(oldFormData.Id);
                var initialWorkflowMode = self.OpenDiyFormWorkFlowType.FormMode || self.FormMode;
                var formMode = self.StartWorkSubmited == false
                    && (initialWorkflowMode == "Add" || initialWorkflowMode == "Insert" || !oldFormHasId)
                    ? "Add"
                    : "Edit";

                // 第2步：通过 _AlternateSubmit 钩子，把"表单保存 + StartWork"合并为单事务后端调用
                var formParam = {
                    FormMode: formMode,
                    SavedType: "Edit",
                    _AlternateSubmit: wfHandler.BuildStartWorkAlternateSubmit({
                        FormData: v8Result.Form,
                        OldForm: oldFormData,
                        FormMode: formMode,
                        DiyFieldList: param ? param.DiyFieldList : null
                    })
                };

                form.FormSubmit(formParam, async function (success, formData2) {
                    if (success == true) {
                        self.StartWorkSubmited = true;
                        self.FormMode = "Edit";
                        self.OpenDiyFormWorkFlowType.FormMode = "Edit";
                        // 工作流已在事务中完成，无需再单独调用 StartWork
                        self.ShowFieldForm = false;
                        self.ShowFieldFormDrawer = false;
                        self.GetDiyTableRow();
                    }
                    if (callback) { callback(); }
                });
            } catch (error) {
                if (callback) { callback(); }
                throw error;
            }
        },
        // ========== 工作流面板初始化（从diy-table-rowlist.vue移植） ==========
        async CallbackSendWork(param, callback) {
            var self = this;

            try {
                var form = self.GetActiveFieldForm();
                var wfHandler = self.GetActiveWfWorkHandler();
                if (!form || !wfHandler) {
                    if (callback) { callback(); }
                    return;
                }
                var formData = form.GetFormData();
                var oldFormData = typeof form.GetOldFormData === "function" ? form.GetOldFormData() : null;

                var v8Result = await wfHandler.RunNodeStartV8({ Form: formData, OldForm: oldFormData });
                if (v8Result.Result === false) {
                    if (callback) { callback(); }
                    return;
                }
                if (v8Result.Form) {
                    form.SetFormData(v8Result.Form);
                } else {
                    v8Result.Form = formData;
                }

                var formParam = {
                    FormMode: "Edit",
                    SavedType: "Edit",
                    _AlternateSubmit: wfHandler.BuildSendWorkAlternateSubmit({
                        FormData: v8Result.Form,
                        OldForm: oldFormData,
                        FormMode: "Edit",
                        DiyFieldList: param ? param.DiyFieldList : null
                    })
                };

                form.FormSubmit(formParam, async function (success, formData2) {
                    if (success == true) {
                        self.FormMode = "Edit";
                        self.ShowFieldForm = false;
                        self.ShowFieldFormDrawer = false;
                        self.GetDiyTableRow();
                    }
                    if (callback) { callback(); }
                });
            } catch (error) {
                if (callback) { callback(); }
                throw error;
            }
        },
        InitWorkFlow(wfParam) {
            var self = this;
            self.OpenDiyFormWorkFlowType = wfParam;
            self.FormWF = self.GetFormWF();
            // ========== DoWork：从【去处理】按钮进入，初始化处理工作面板 ==========
            if (wfParam.WorkType == "DoWork") {
                self.OpenDiyFormWorkFlow = true;
                self.FormRightType = "WorkFlow";
                self.FormWF = self.GetFormWF();
                if (self.diyStore.IsPhoneView) {
                    self.showMobileRightDrawer = true;
                }
                var doWorkParam = {
                    CurrentFlowDesign: { Id: wfParam.FlowDesignId },
                    CurrentFlowId: wfParam.CurrentFlowId,
                    CurrentNodeId: wfParam.CurrentNodeId,
                    CurrentWorkModel: wfParam.WorkModel || {},
                    OpenFormMode: wfParam.FormMode || "Edit",
                    CurrentTableId: self.TableId,
                    CurrentTableRowId: self.TableRowId,
                    OpenWorkType: wfParam.OpenWorkType
                };
                var retryCountDo = 0;
                var maxRetriesDo = 40;
                var tryInitSendWork = function () {
                    var handler = self.GetActiveWfWorkHandler();
                    if (handler && typeof handler.InitSendWork === 'function') {
                        handler.InitSendWork(doWorkParam, function () { });
                    } else if (retryCountDo < maxRetriesDo) {
                        retryCountDo++;
                        setTimeout(tryInitSendWork, 50);
                    } else {
                        console.error('[DiyFormFull] refWfWorkHandler 始终未挂载（DoWork），已重试' + maxRetriesDo + '次');
                    }
                };
                self.$nextTick(tryInitSendWork);
                return;
            }
            if (wfParam.WorkType == "ViewWork") {
                // 获取此数据对应的最后一个流程
                if (self.FormMode != "Add" && self.FormMode != "Insert" && !self.DiyCommon.IsNull(self.TableRowId)) {
                    self.DiyCommon.GetDiyTableRowModel(
                        {
                            FormEngineKey: "WF_Work",
                            _SearchEqual: {
                                TableRowId: self.TableRowId
                            }
                        },
                        function (result) {
                            if (result.Code == 1 && !self.DiyCommon.IsNull(result.Data)) {
                                self.OpenDiyFormWorkFlow = true;
                                self.FormRightType = "WorkFlow";
                                self.FormWF = self.GetFormWF();
                                var historyParam = {
                                    CurrentFlowId: result.Data.FlowId,
                                    CurrentFlowDesignId: result.Data.FlowDesignId,
                                    CurrentNodeId: result.Data.NodeId
                                };
                                var retryCount = 0;
                                var maxRetries = 40;
                                var tryInitHistory = function () {
                                    var hist = self.GetActiveWfHistory();
                                    if (hist) {
                                        hist.Init(historyParam);
                                    } else if (retryCount < maxRetries) {
                                        retryCount++;
                                        setTimeout(tryInitHistory, 50);
                                    }
                                };
                                self.$nextTick(tryInitHistory);
                            }
                        }
                    );
                }
            } else {
                if (self.DiyCommon.IsNull(wfParam.FlowDesignId)) {
                    self.DiyCommon.Tips("未传入FlowDesignId", false);
                    return;
                }
                self.OpenDiyFormWorkFlow = true;
                self.FormRightType = "WorkFlow";
                self.FormWF = self.GetFormWF();
                // 移动端 StartWork 必须打开右抽屉，否则 WFWorkHandler 无法挂载
                if (self.diyStore.IsPhoneView) {
                    self.showMobileRightDrawer = true;
                }
                var param = {
                    CurrentFlowDesignId: wfParam.FlowDesignId,
                    OpenFormMode: wfParam.FormMode,
                    CurrentTableId: self.TableId
                };
                // 使用重试机制等待WFWorkHandler组件挂载完成
                // 因为OpenDiyFormWorkFlow刚设为true，多层v-if嵌套的组件可能需要多个tick才能完成挂载
                var retryCount = 0;
                var maxRetries = 40;
                var tryInitStartWork = function () {
                    var handler = self.GetActiveWfWorkHandler();
                    if (handler) {
                        handler.InitStartWork(param, function (callbackObj) {
                        });
                    } else if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(tryInitStartWork, 50);
                    } else {
                        console.error('[DiyFormFull] refWfWorkHandler_2 始终未挂载，已重试' + maxRetries + '次');
                    }
                };
                self.$nextTick(tryInitStartWork);
            }
        },
        // ========== 获取表单工作流状态 ==========
        GetFormWF() {
            var self = this;
            return {
                IsWF: self.OpenDiyFormWorkFlow == true,
                WorkType: self.OpenDiyFormWorkFlowType.WorkType,
                FlowDesignId: self.OpenDiyFormWorkFlowType.FlowDesignId
            };
        },
    }
};
