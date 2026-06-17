
import { formTrace } from "@/utils/form-engine-trace.js";

export default {
    methods: {
        // ========== 打开详情（核心方法，以diy-table.vue为准） ==========
        OpenDetail(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam) {
            var self = this;
            formTrace("diy-form-full:open-detail", {
                tableId: self.TableId,
                tableName: self.TableName,
                formMode: formMode,
                rowId: tableRowModel && tableRowModel.Id
            });

            self.BtnLoading = true;
            self.FormMode = formMode;
            self.ShowUpdateBtn = true;
            self.ShowDeleteBtn = true;
            self.ShowSaveBtn = true;
            self.CurrentDraftId = "";

            self.TableRowId = self.DiyCommon.IsNull(tableRowModel) ? "" : tableRowModel.Id;
            if (self.FormMode == "Add" || self.FormMode == "Insert") {
                // 2026-04-17 Fix：如果父组件（diy-table）已经调用 NewGuid 并传入了 Id，则复用，避免重复请求
                if (!self.DiyCommon.IsNull(self.TableRowId)) {
                    self.$nextTick(function () {
                        self.OpenDetailHandler(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam);
                    });
                } else {
                    self.DiyCommon.Post("/api/FormEngine/NewGuid", {}, function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.TableRowId = result.Data;
                            self.$nextTick(function () {
                                self.OpenDetailHandler(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam);
                            });
                        } else {
                            self.BtnLoading = false;
                        }
                    });
                }
            } else {
                self.$nextTick(function () {
                    self.OpenDetailHandler(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam);
                });

                // 加载数据日志 + 评论（角色权限校验在 LoadDataLog 内部完成）
                self.LoadDataLog();
                self.LoadDataComment();
                self.LoadDataVersion();
            }
        },
        // ========== 加载数据日志（可重复调用：保存后、切换 Tab 时） ==========
        LoadDataLog(force) {
            var self = this;
            // 角色权限检查
            self.isCheckDataLog = false;
            if (self.CurrentDiyTableModel && self.CurrentDiyTableModel.DataLogRole && self.CurrentDiyTableModel.DataLogRole.length > 0) {
                var DataLogRole = self.CurrentDiyTableModel.DataLogRole;
                DataLogRole.forEach((item) => {
                    if (self.GetCurrentUser.RoleIds && self.GetCurrentUser.RoleIds.indexOf(item) != -1) {
                        self.isCheckDataLog = true;
                    }
                });
            } else {
                self.isCheckDataLog = true;
            }

            if (!self.CurrentDiyTableModel || !self.CurrentDiyTableModel.EnableDataLog || !self.isCheckDataLog) {
                self.DataLogListLoading = false;
                return;
            }
            if (self.DiyCommon.IsNull(self.TableRowId)) {
                self.DataLogList = [];
                self.DataLogListLoading = false;
                return;
            }

            // token 机制：防止旧请求覆盖新结果
            var token = ++self._DataLogLoadToken;
            self.DataLogListLoading = true;
            self.DiyCommon.FormEngine.GetTableData(
                {
                    FormEngineKey: "microi_datalog",
                    _Where: [["DataId", "=", self.TableRowId]],
                    _OrderBy: "CreateTime",
                    _OrderByType: "DESC"
                },
                function (result) {
                    // 旧请求被新请求覆盖，丢弃
                    if (token !== self._DataLogLoadToken) return;
                    try {
                        if (result && result.Code == 1 && Array.isArray(result.Data)) {
                            result.Data.forEach((item) => {
                                if (item.Content) {
                                    try { item.Content = JSON.parse(item.Content); } catch (e) { item.Content = []; }
                                } else {
                                    item.Content = [];
                                }
                                if (item.Avatar) {
                                    item.Avatar = self.DiyCommon.GetServerPath(item.Avatar);
                                } else {
                                    item.Avatar = self.DiyCommon.GetServerPath("./static/img/icon/personal.png");
                                }
                            });
                            self.DataLogList = result.Data;
                        } else {
                            self.DataLogList = [];
                        }
                    } finally {
                        self.DataLogListLoading = false;
                    }
                }
            );
        },
        // ========== 加载数据评论（可重复调用） ==========
        LoadDataComment() {
            var self = this;
            if (!self.CurrentDiyTableModel || !self.CurrentDiyTableModel.EnableDataComment) {
                self.DataCommentListLoading = false;
                return;
            }
            self.GetCommentList();
        },
        LoadDataVersion() {
            var self = this;
            if (!self.CurrentDiyTableModel || !self.CurrentDiyTableModel.EnableDataVersion) {
                self.DataVersionList = [];
                self.DataVersionListLoading = false;
                return;
            }
            if (self.DiyCommon.IsNull(self.TableRowId)) {
                self.DataVersionList = [];
                self.DataVersionListLoading = false;
                return;
            }

            var token = ++self._DataVersionLoadToken;
            self.DataVersionListLoading = true;
            var where = [["TableRowId", "=", self.TableRowId]];
            if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.Id)) {
                where.push(["TableId", "=", self.CurrentDiyTableModel.Id]);
            }

            self.DiyCommon.FormEngine.GetTableData(
                {
                    FormEngineKey: "mic_data_version",
                    _Where: where,
                    _OrderBy: "CreateTime",
                    _OrderByType: "DESC"
                },
                function (result) {
                    if (token !== self._DataVersionLoadToken) return;
                    try {
                        if (result && result.Code == 1 && Array.isArray(result.Data)) {
                            self.DataVersionList = result.Data;
                        } else {
                            self.DataVersionList = [];
                        }
                    } finally {
                        self.DataVersionListLoading = false;
                    }
                }
            );
        },
        _beginFieldFormOpen() {
            var self = this;
            self._clearFieldFormInitTimer();
            self._fieldFormOpenToken = (self._fieldFormOpenToken || 0) + 1;
            formTrace("diy-form-full:begin-open", {
                tableId: self.TableId,
                tableName: self.TableName,
                token: self._fieldFormOpenToken
            });
            return self._fieldFormOpenToken;
        },
        _cancelFieldFormOpen() {
            var self = this;
            self._clearFieldFormInitTimer();
            self._fieldFormOpenToken = (self._fieldFormOpenToken || 0) + 1;
            self._pendingDrawerContext = null;
            self.BtnLoading = false;
        },
        _clearFieldFormInitTimer() {
            var self = this;
            if (self._fieldFormInitTimer) {
                try { clearTimeout(self._fieldFormInitTimer); } catch (e) {}
                self._fieldFormInitTimer = null;
            }
        },
        _getFieldFormRef() {
            var self = this;
            var fieldForm = self.$refs && self.$refs.fieldForm;
            if (Array.isArray(fieldForm)) {
                fieldForm = fieldForm[0];
            }
            return fieldForm;
        },
        _initFieldFormWhenReady(options) {
            var self = this;
            options = options || {};
            var token = options.token || self._fieldFormOpenToken;
            var formMode = options.formMode;
            var isOpenWorkFlowForm = options.isOpenWorkFlowForm;
            var wfParam = options.wfParam;
            var dialogId = options.dialogId;
            var source = options.source || 'Form';

            self._clearFieldFormInitTimer();
            self.CloseFormNeedConfirm = false;
            formTrace("diy-form-full:init-when-ready-start", {
                tableId: self.TableId,
                tableName: self.TableName,
                token: token,
                formMode: formMode,
                source: source
            });

            var retryCount = 0;
            var maxRetries = 60;
            var retryInterval = 50;

            var tryInitFieldForm = function() {
                if (self._isDestroyed || token !== self._fieldFormOpenToken) {
                    self._fieldFormInitTimer = null;
                    return;
                }
                if ((dialogId === 'ShowFieldForm' && !self.ShowFieldForm) || (dialogId === 'ShowFieldFormDrawer' && !self.ShowFieldFormDrawer)) {
                    self._fieldFormInitTimer = null;
                    self.BtnLoading = false;
                    return;
                }

                var fieldForm = self._getFieldFormRef();
                if (fieldForm && typeof fieldForm.Init === 'function') {
                    self._clearFieldFormInitTimer();
                    formTrace("diy-form-full:field-form-init", {
                        tableId: self.TableId,
                        tableName: self.TableName,
                        token: token,
                        retryCount: retryCount,
                        source: source
                    });
                    fieldForm.Init(true, function (callbackValue) {
                        if (self._isDestroyed || token !== self._fieldFormOpenToken) {
                            return;
                        }
                        if (callbackValue && callbackValue.CurrentRowModel) {
                            self.CurrentRowModel = callbackValue.CurrentRowModel;
                            var V8 = callbackValue.V8;
                            self.HandlerBtns(self.SysMenuModel.FormBtns, self.CurrentRowModel, V8);
                        }
                        self.BtnLoading = false;
                    });
                    if (isOpenWorkFlowForm == true) {
                        if (self.DiyCommon.IsNull(wfParam)) { wfParam = { WorkType: "ViewWork" }; }
                        wfParam.FormMode = formMode;
                        self.InitWorkFlow(wfParam);
                    }
                    return;
                }

                retryCount++;
                if (retryCount < maxRetries) {
                    self._fieldFormInitTimer = setTimeout(tryInitFieldForm, retryInterval);
                } else {
                    self._fieldFormInitTimer = null;
                    self.BtnLoading = false;
                    console.error('[DiyFormFull] ' + source + ' fieldForm ref 在 ' + (maxRetries * retryInterval) + 'ms 后仍不存在');
                }
            };

            self.$nextTick(tryInitFieldForm);
        },
        // ========== 抽屉打开动画完成后初始化表单 ==========
        onDrawerOpened() {
            var self = this;
            var formMode = self._pendingDrawerContext?.formMode;
            var isOpenWorkFlowForm = self._pendingDrawerContext?.isOpenWorkFlowForm;
            var wfParam = self._pendingDrawerContext?.wfParam;
            var token = self._pendingDrawerContext?.token || self._fieldFormOpenToken;

            self._initFieldFormWhenReady({
                token: token,
                formMode: formMode,
                isOpenWorkFlowForm: isOpenWorkFlowForm,
                wfParam: wfParam,
                dialogId: 'ShowFieldFormDrawer',
                source: 'Drawer'
            });

            self._pendingDrawerContext = null;
        },
        // ========== 抽屉关闭动画完成后的清理 ==========
        onDrawerClosed() {
            var self = this;
            self._cancelFieldFormOpen();
            self.showMobileFabMenu = false;
            self.CurrentRowModel = {};
            self.CloseFormNeedConfirm = false;
            self._pendingDrawerContext = null;
            self.OpenDiyFormWorkFlow = false;
            self.OpenDiyFormWorkFlowType = {};
            self.StartWorkSubmited = false;
            // 清理移动端返回键拦截
            self._cleanupDrawerPopstate();
        },
        // ========== 弹窗关闭动画完成后的清理 ==========
        onDialogClosed() {
            var self = this;
            self._cancelFieldFormOpen();
            self.showMobileFabMenu = false;
            self.CurrentRowModel = {};
            self.CloseFormNeedConfirm = false;
            self.OpenDiyFormWorkFlow = false;
            self.OpenDiyFormWorkFlowType = {};
            self.StartWorkSubmited = false;
            // 清理移动端返回键拦截
            self._cleanupDialogPopstate();
        },
        // ========== 清理移动端Drawer返回键拦截 ==========
        // Fix 2026-04-28：仅在全局堆栈为空时才卸载全局 popstate 处理器与重置保护计数，
        // 否则会误伤其它仍处于打开状态的 drawer/diy-form-full 实例（嵌套或并存场景）。
        _cleanupDrawerPopstate() {
            var self = this;
            try {
                // 先把本实例残留在全局堆栈中的项移除（防御性清理；正常 close 流程已处理）
                try {
                    if (window.__microi_drawer_stack && window.__microi_drawer_stack.length) {
                        for (var i = window.__microi_drawer_stack.length - 1; i >= 0; i--) {
                            var it = window.__microi_drawer_stack[i];
                            if (it && it.owner === self) {
                                window.__microi_drawer_stack.splice(i, 1);
                            }
                        }
                    }
                } catch (e) {}
                // 仅当全局堆栈已清空时，才卸载全局处理器与重置全局保护标志
                try {
                    if (!window.__microi_drawer_stack || window.__microi_drawer_stack.length === 0) {
                        if (window.__microi_drawer_popstate_handler) {
                            try { window.removeEventListener('popstate', window.__microi_drawer_popstate_handler); } catch (e) {}
                            window.__microi_drawer_popstate_handler = null;
                        }
                        try { window.__microi_drawer_stack = []; } catch (e) {}
                        // 仅在 dialog 堆栈也为空时才重置共享的保护/忽略标志，避免影响仍打开的 dialog
                        if (!window.__microi_dialog_stack || window.__microi_dialog_stack.length === 0) {
                            try { window.__microi_protected_count = 0; } catch (e) {}
                            try { window.__microi_ignore_pop = false; } catch (e) {}
                        }
                    }
                } catch (e) {}
                // 清理本组件内的记录（仅本实例，安全）
                if (self._drawerStack) { self._drawerStack = []; }
                if (self._drawerHandlers) { self._drawerHandlers = {}; }
                if (self._currentDrawerInstanceIds) { self._currentDrawerInstanceIds = []; }
            } catch (e) {}
        },
        // ========== 清理移动端Dialog返回键拦截 ==========
        // Fix 2026-04-28：同上，避免误清空仍存活的兄弟/嵌套 dialog 实例的全局堆栈。
        _cleanupDialogPopstate() {
            var self = this;
            try {
                try {
                    if (window.__microi_dialog_stack && window.__microi_dialog_stack.length) {
                        for (var j = window.__microi_dialog_stack.length - 1; j >= 0; j--) {
                            var dit = window.__microi_dialog_stack[j];
                            if (dit && dit.owner === self) {
                                window.__microi_dialog_stack.splice(j, 1);
                            }
                        }
                    }
                } catch (e) {}
                try {
                    if (!window.__microi_dialog_stack || window.__microi_dialog_stack.length === 0) {
                        if (window.__microi_dialog_popstate_handler) {
                            try { window.removeEventListener('popstate', window.__microi_dialog_popstate_handler); } catch (e) {}
                            window.__microi_dialog_popstate_handler = null;
                        }
                        try { window.__microi_dialog_stack = []; } catch (e) {}
                        if (!window.__microi_drawer_stack || window.__microi_drawer_stack.length === 0) {
                            try { window.__microi_protected_count = 0; } catch (e) {}
                            try { window.__microi_ignore_pop = false; } catch (e) {}
                        }
                    }
                } catch (e) {}
                if (self._dialogStack) { self._dialogStack = []; }
                if (self._dialogHandlers) { self._dialogHandlers = {}; }
                if (self._currentDialogInstanceIds) { self._currentDialogInstanceIds = []; }
            } catch (e) {}
        },
        // ========== 获取表单宽度 ==========
        GetOpenFormWidth() {
            var self = this;
            if (self.diyStore.IsPhoneView) {//self.DiyCommon.GetPageBodyClientWH().Width < 768
                return "100%";
            }
            if (self.Width) {
                return self.Width;
            }

            var result = self.DiyCommon.IsNull(self.CurrentDiyTableModel.FormOpenWidth) ? "50%" : self.CurrentDiyTableModel.FormOpenWidth;
            return result;
        },
        // ========== zhy生成实例ID ==========
        _generateInstanceId(prefix) {
            var self = this;
            var t = Date.now().toString(36);
            var r = Math.random().toString(36).slice(2, 8);
            return (prefix ? prefix + '_' : '') + t + '_' + r;
        },
        GetOpenTitleIcon() {
            var self = this;
            return self.DiyCommon.IsNull(self.CurrentRowModel) || self.DiyCommon.IsNull(self.CurrentRowModel.Id) ? "fas fa-plus" : "far fa-edit";
        },
        GetOpenTitle() {
            var self = this;
            var title1 = "";
            if (self.DiyCommon.IsNull(self.CurrentRowModel) || self.DiyCommon.IsNull(self.CurrentRowModel.Id)) {
                title1 = self.$t("Msg.Add");
            } else {
                var fieldModel = self.ShowDiyFieldList && self.ShowDiyFieldList[0];
                var firstValue = "";
                if (fieldModel && !self.DiyCommon.IsNull(fieldModel.Config) && !self.DiyCommon.IsNull(fieldModel.Config.SelectLabel)) {
                    try {
                        firstValue = JSON.parse(self.CurrentRowModel[fieldModel.Name])[fieldModel.Config.SelectLabel];
                    } catch (error) {
                        firstValue = self.CurrentRowModel[fieldModel.Name];
                    }
                } else {
                    if (fieldModel) {
                        firstValue = self.CurrentRowModel[fieldModel.Name];
                    }
                }
                title1 = self.$t("Msg." + self.FormMode) + (firstValue ? " [" + firstValue.toString().substring(0, 10) + "]" : "");
            }
            var title2 = "";
            var title3 = self.DiyCommon.IsNull(self.CurrentDiyTableModel) || self.DiyCommon.IsNull(self.CurrentDiyTableModel.Description) ? "" : self.CurrentDiyTableModel.Description;

            return title1 + (!self.DiyCommon.IsNull(title3) && title3 != title2 ? " - " + title3 : "");
        },
        // ========== 判断右侧面板是否显示 ==========
        ShowFormRight() {
            var self = this;
            if (self.OpenDiyFormWorkFlow) {
                return true;
            }
            if (self.CurrentDiyTableModel.EnableDataLog && self.isCheckDataLog) {
                return true;
            }
            if (self.CurrentDiyTableModel.EnableDataComment) {
                return true;
            }
            if (self.CurrentDiyTableModel.EnableDataVersion) {
                return true;
            }
            return false;
        },
        // ========== 关闭表单 ,zhy加了isPopstate，根据 isPopstate 决定是否回退历史，移动端不回退==========
        async CloseFieldForm(dialogId, actionType, tableRowId, isForceClose, isPopstate) {
            var self = this;
            if (self.FormMode == "View" || self.CloseFormNeedConfirm == false || isForceClose) {
                await self.CloseFieldFormHandler(dialogId, actionType, tableRowId, isPopstate);
            } else {
                self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmClose") + "？", async function () {
                    await self.CloseFieldFormHandler(dialogId, actionType, tableRowId, isPopstate);
                });
            }
        },
        async CloseFieldFormHandler(dialogId, actionType, tableRowId, isPopstate) {
            var self = this;
            self._cancelFieldFormOpen();
            // 移动端关闭Drawer时：如果是通过代码关闭（非popstate触发），需要回退pushState推入的历史记录
                        // if (dialogId === 'ShowFieldFormDrawer' && self._drawerPopstateHandler) {
                        //     // 先移除监听，避免history.back()触发的popstate再次执行关闭
                        //     window.removeEventListener('popstate', self._drawerPopstateHandler);
                        //     self._drawerPopstateHandler = null;
                        //     window.history.back();
                        // }
                        // // 移动端关闭Dialog时：同上
                        // if (dialogId === 'ShowFieldForm' && self._dialogPopstateHandler) {
                        //     window.removeEventListener('popstate', self._dialogPopstateHandler);
                        //     self._dialogPopstateHandler = null;
                        //     window.history.back();
                        // }

            // zhy如果是通过代码关闭（非 popstate 触发），需要移除对应实例的监听并回退历史
            try {
                // Drawer 模式：从全局堆栈中移除对应的项；若移除后堆栈为空，则卸载全局处理器并消费历史（programmatic close 最后一个）
                if (dialogId === 'ShowFieldFormDrawer' && self.diyStore.IsPhoneView) {
                    var myId = null;
                    try {
                        if (self._currentDrawerInstanceIds && self._currentDrawerInstanceIds.length) {
                            myId = self._currentDrawerInstanceIds.pop();
                        }
                    } catch (e) {}
                    //移除顶部抽屉
                    try {
                        if (window.__microi_drawer_stack && window.__microi_drawer_stack.length) {
                            for (var i = window.__microi_drawer_stack.length - 1; i >= 0; i--) {
                                var it = window.__microi_drawer_stack[i];
                                if (!it) { continue; }
                                if (it.owner === self || (myId && it.id === myId)) {
                                    window.__microi_drawer_stack.splice(i, 1);
                                    break;
                                }
                            }
                        }
                        if (!window.__microi_drawer_stack || window.__microi_drawer_stack.length === 0) {
                            try { if (window.__microi_drawer_popstate_handler) { window.removeEventListener('popstate', window.__microi_drawer_popstate_handler); window.__microi_drawer_popstate_handler = null; } } catch (e) {}
                            try { window.__microi_drawer_stack = []; } catch (e) {}
                            // 仅在非 popstate（即程序化）场景下，回退历史以消费先前 pushState
                            try {
                                if (!isPopstate && window.history && window.history.length) {
                                    // 程序化回退：消费一个保护计数并设忽略标志，防止由 history.back 触发的 popstate 再次关闭
                                    try { window.__microi_protected_count = Math.max(0, (window.__microi_protected_count || 0) - 1); } catch (e) {}
                                    try { window.__microi_ignore_pop = true; } catch (e) {}
                                    try { window.history.back(); } catch (e) {}
                                }
                            } catch (e) {}
                        }
                    } catch (e) {}
                }

                // Dialog 模式：同理处理全局 dialog 堆栈
                if (dialogId === 'ShowFieldForm' && self.diyStore.IsPhoneView) {
                    var myDialogId = null;
                    try {
                        if (self._currentDialogInstanceIds && self._currentDialogInstanceIds.length) {
                            myDialogId = self._currentDialogInstanceIds.pop();
                        }
                    } catch (e) {}
                    try {
                        if (window.__microi_dialog_stack && window.__microi_dialog_stack.length) {
                            for (var j = window.__microi_dialog_stack.length - 1; j >= 0; j--) {
                                var dit = window.__microi_dialog_stack[j];
                                if (!dit) { continue; }
                                if (dit.owner === self || (myDialogId && dit.id === myDialogId)) {
                                    window.__microi_dialog_stack.splice(j, 1);
                                    break;
                                }
                            }
                        }
                        if (!window.__microi_dialog_stack || window.__microi_dialog_stack.length === 0) {
                            try { if (window.__microi_dialog_popstate_handler) { window.removeEventListener('popstate', window.__microi_dialog_popstate_handler); window.__microi_dialog_popstate_handler = null; } } catch (e) {}
                            try { window.__microi_dialog_stack = []; } catch (e) {}
                            try {
                                if (!isPopstate && window.history && window.history.length) {
                                    try { window.__microi_protected_count = Math.max(0, (window.__microi_protected_count || 0) - 1); } catch (e) {}
                                    try { window.__microi_ignore_pop = true; } catch (e) {}
                                    try { window.history.back(); } catch (e) {}
                                }
                            } catch (e) {}
                        }
                    } catch (e) {}
                }
            } catch (e) {}
            if (self.$refs.fieldForm) {
                await self.$refs.fieldForm.FormOutAction(actionType, "Close", tableRowId, null);
            }

            if (self.$refs.fieldForm) {
                self.$refs.fieldForm.SetDiyTableRowModelFinish(false);
            }
            self.$nextTick(function () {
                if (self.$refs.fieldForm) {
                    self.$refs.fieldForm.Clear();
                }
                if (!self.DiyCommon.IsNull(dialogId)) {
                    self[dialogId] = false;
                }
                self.$nextTick(function () {
                    self.CurrentRowModel = {};
                    self.CloseFormNeedConfirm = false;
                });
            });
        },
        // ========== 页面模式专用方法 ==========

        /**
         * Page模式下重新初始化表单（销毁旧的 DiyForm 并重建）
         * 通过清空 TableRowId 使 v-if 条件为 false，销毁整个 DiyForm 组件树（包括子表），
         * 然后在下一个 tick 重新设置参数，触发 DiyForm 重新创建和初始化。
         */
        reinitPageForm() {
            var self = this;
            // 清空 TableRowId，通过 v-if="TableId && TableRowId" 销毁 DiyForm 组件树
            self.TableRowId = '';
            self.CurrentDraftId = "";
            self.CallbackSetFormDataFinish = false;
            self.CallbackSetDiyTableModelFinish = false;

            self.$nextTick(async function () {
                // 重新从路由参数读取
                self.TableId = self.$route.params.TableId;
                self.FormMode = self.$route.query.FormMode;
                self.SysMenuId = self.$route.query.SysMenuId || self.$route.query.Id || (self.$route.meta ? (self.$route.meta.Id || self.$route.meta.SysMenuId) : "");
                await self.EnsureSysMenuModel();

                var newTableRowId = self.$route.params.TableRowId;
                if (newTableRowId) {
                    self.TableRowId = newTableRowId;
                } else if (self.FormMode === 'Add' || self.FormMode === 'Insert') {
                    self.DiyCommon.PostAsync("/api/FormEngine/NewGuid").then(guidResult => {
                        if (guidResult.Code == 1) {
                            self.TableRowId = guidResult.Data;
                        }
                    });
                }
            });
        },
        Go_1() {
            var self = this;
            // 标记需要重新初始化，以便 keep-alive 重新激活时能正确重置表单状态
            self._needsReinit = true;
            if (!self.diyStore.IsPhoneView) {
                self.tagsViewStore.delView(self.$route);
            }
            self.$router.go(-1);
        },
        GotoEdit() {
            var self = this;
            self.FormMode = 'Edit';
            self.$nextTick(function () {
                // FormMode变化后DiyForm会自动响应
            });
        },
        // ========== 页面模式专用：获取标题（带标签页标题更新） ==========
        GetOpenTitlePage() {
            var self = this;
            var result = "";
            if (self.FormMode) {
                var formMode = self.$t("Msg." + self.FormMode);
                var firstValue = "";
                if (self.FormMode == "Edit" || self.FormMode == "View") {
                    var fieldModel = self.DiyFieldList[0];
                    if (fieldModel && self.CurrentRowModel[fieldModel.Name]) {
                        firstValue = "[" + self.CurrentRowModel[fieldModel.Name] + "]";
                    }
                }
                var tableName = self.DiyCommon.IsNull(self.CurrentDiyTableModel) || self.DiyCommon.IsNull(self.CurrentDiyTableModel.Description) ? "" : " - " + self.CurrentDiyTableModel.Description;
                result = formMode + firstValue + tableName;
                if ((self.CallbackSetFormDataFinish && self.CallbackSetDiyTableModelFinish) || (self.FormMode == "Add" && self.CallbackSetDiyTableModelFinish)) {
                    var item = self.tagsViewStore.visitedViews.filter((item) => item.fullPath == self.$route.fullPath);
                    if (item.length > 0) {
                        item[0].title = result;
                    }
                }
            }
            return result;
        }
    }
};
