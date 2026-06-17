
import { ElMessageBox } from "element-plus";

export default {
    methods: {
        // ========== 保存表单（以diy-table.vue为准） ==========
        async SaveDiyTableCommon(param, savedType) {
            var self = this;
            if (self.BtnLoading == true) {
                return;
            }
            var isClose = false;
            if (typeof param == "boolean") {
                isClose = param;
            } else if (!self.DiyCommon.IsNull(param)) {
                if (!self.DiyCommon.IsNull(param.CloseForm)) {
                    isClose = param.CloseForm;
                }
                if (!self.DiyCommon.IsNull(param.SavedType)) {
                    savedType = param.SavedType;
                }
            }

            self.BtnLoading = true;

            var formParam = {
                FormMode: self.FormMode,
                TableRowId: self.TableRowId,
                SavedType: savedType,
                SaveLoading: self.BtnLoading,
                Callback: param && param.Callback ? param.Callback : undefined
            };

            self.$refs.fieldForm.FormSubmit(formParam, async function (isSccuess, formData, outFormV8Result) {
                if (isSccuess === true) {
                    var formModeAfter = formParam.FormMode;
                    if (formParam.SavedType == "Update" || formParam.SavedType == "Edit") {
                        formModeAfter = "Edit";
                    } else if (formParam.SavedType == "Insert" || formParam.SavedType == "Add") {
                        formModeAfter = "Add";
                    } else if (formParam.SavedType == "View") {
                        formModeAfter = "View";
                    }

                    self.FormMode = formModeAfter;
                    self.TableRowId = formParam.TableRowId;
                    self.BtnLoading = formParam.SaveLoading;
                    await self.DeleteCurrentDraftAfterSave();

                    if (isClose === true && (!outFormV8Result || outFormV8Result.Result !== false)) {
                        self.ShowFieldForm = false;
                        self.ShowFieldFormDrawer = false;
                    } else {
                        //刷新子表
                        self.$refs.fieldForm.RefreshAllChildTable();
                        // 表单未关闭：刷新右侧的"数据日志/数据评论"，让用户立即看到最新变更
                        self.$nextTick(function () {
                            try { self.LoadDataLog && self.LoadDataLog(); } catch (e) {}
                            try { self.LoadDataComment && self.LoadDataComment(); } catch (e) {}
                            try { self.LoadDataVersion && self.LoadDataVersion(); } catch (e) {}
                        });
                    }

                    self.$emit("CallbackGetDiyTableRow", formParam);

                    self.$nextTick(function () {
                        if (formParam.Callback) {
                            formParam.Callback();
                        }
                    });
                } else {
                    self.BtnLoading = false;
                }
            });
        },
        // ========== 删除行 ==========
        DelDiyTableRow(rowModel, dialogId) {
            var self = this;
            var title = "";

            var fieldModel = self.ShowDiyFieldList && self.ShowDiyFieldList[0];
            if (fieldModel && !self.DiyCommon.IsNull(fieldModel.Config) && !self.DiyCommon.IsNull(fieldModel.Config.SelectLabel)) {
                try {
                    title = JSON.parse(rowModel[fieldModel.Name])[fieldModel.Config.SelectLabel];
                } catch (error) {
                    title = rowModel[fieldModel.Name];
                }
            } else {
                if (fieldModel) {
                    title = rowModel[fieldModel.Name];
                }
            }
            self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + "【" + title + "】？", async function () {
                if (rowModel._IsInTableAdd === true) {
                    var tIndex = 0;
                    self.DiyTableRowList.forEach((element) => {
                        if (element.Id == rowModel.Id) {
                            self.DiyTableRowList.splice(tIndex, 1);
                        }
                        tIndex++;
                    });
                    return;
                }

                var v8Result = await self.FormSubmitAction("Delete", rowModel.Id, rowModel);
                if (v8Result === false || (v8Result && (v8Result.Code === 0 || (v8Result.Code && v8Result.Code != 1)))) {
                    if (v8Result && v8Result.Msg) {
                        self.DiyCommon.Tips(v8Result.Msg, false);
                    }
                    return;
                }
                var param = {
                    TableId: self.TableId,
                    _TableRowId: rowModel.Id
                };

                var url = self.DiyApi.DelDiyTableRow;
                if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.ApiReplace) && !self.DiyCommon.IsNull(self.CurrentDiyTableModel.ApiReplace.Delete)) {
                    url = self.DiyCommon.RepalceUrlKey(self.CurrentDiyTableModel.ApiReplace.Delete);
                }
                self.DiyCommon.Post(url, param, async function (result) {
                    if (self.DiyCommon.Result(result)) {
                        await self.FormOutAction("Delete", "Delete", rowModel.Id, null, rowModel);
                        self.DiyCommon.Tips(self.$t("Msg.Success"));

                        if (dialogId) {
                            self.$nextTick(function () {
                                if (!self.DiyCommon.IsNull(dialogId)) {
                                    self[dialogId] = false;
                                }
                            });
                        }

                        self.GetDiyTableRow();
                        self.$emit("CallbackGetDiyTableRow", {});
                    }
                });
            });
        },
        // ========== 回调函数 ==========
        CallbackFormSubmit(param) {
            var self = this;
            self.SaveDiyTableCommon(param);
        },
        CallbackGetDiyField(diyFieldList) {
            var self = this;
            self.DiyFieldList = diyFieldList || [];
        },
        CallbackSetDiyTableModel(model) {
            var self = this;
            self.CurrentDiyTableModel = model;
        },
        CallbackRefreshTable(param) {
            var self = this;
            // self.GetDiyTableRow(param);
        },
        CallbackParentFormSubmit(param) {
            var self = this;
            self.$emit("CallbackParentFormSubmit", param);
        },
        CallbackReloadForm(row, type) {
            var self = this;
            self.OpenDetail(row, type);
        },
        CallbackHideFormBtn(btn) {
            var self = this;
            self["Show" + btn + "Btn"] = false;
        },
        CallbackFormValueChange(field, value) {
            var self = this;
            if (self.FormMode !== "View") {
                self.CloseFormNeedConfirm = true;
            }
        },
        CallbackFormClose() {
            var self = this;
            if (self.ShowFieldForm == true) {
                self.CloseFieldForm("ShowFieldForm", "Close", self.TableRowId, true);
            } else if (self.ShowFieldFormDrawer == true) {
                self.CloseFieldForm("ShowFieldFormDrawer", "Close", self.TableRowId, true);
            }
        },
        ShowTableChildHideField(fieldName, fields) {
            var self = this;
            self.$emit("CallbackShowTableChildHideField", fieldName, fields);
        },
        SearchAppendFunc(val) {
            var self = this;
            // 此组件中不支持搜索追加
        },
        SetV8SearchModel(val) {
            var self = this;
            // 此组件中不支持搜索设置
        },
        GetDiyTableRow(param) {
            var self = this;
            self.$emit("CallbackGetDiyTableRow", param || {});
        },
        // ========== 提交评论（diy-table.vue有此功能）==========
        SubmitComment() {
            var self = this;
            if (self.DiyCommon.IsNull(self.CommentContent)) {
                self.DiyCommon.Tips(self.$t("Msg.EnterCommentContent"), false);
                return;
            }
            var submitData = {
                TableRowId: self.TableRowId,
                Content: self.CommentContent,
                TableId: self.TableId
            };
            if (self.ReplyComment && self.ReplyComment.Id) {
                submitData.ParentCommentId = self.ReplyComment.Id;
                submitData.ReplyToUserId = self.ReplyComment.CreateUser || self.ReplyComment.UserId || "";
                submitData.ReplyToUserName = self.GetCommentAuthor(self.ReplyComment);
                submitData.ReplyToContent = self.GetCommentPlainText(self.ReplyComment.Content);
            }
            self.BtnLoading = true;
            self.DiyCommon.FormEngine.AddFormData(
                "diy_comment",
                submitData,
                function (result) {
                    if (result.Code == 1) {
                        self.CommentContent = "";
                        self.ReplyComment = null;
                        self.GetCommentList();
                    }
                    self.BtnLoading = false;
                }
            );
        },
        GetCommentAuthor(comment) {
            if (!comment) return "用户";
            return comment.Title || comment.UserName || comment.CreateUserName || comment.CreateUser || comment.UserId || "用户";
        },
        GetCommentPlainText(content) {
            if (content === null || content === undefined) return "";
            var text = typeof content === "string" ? content : String(content);
            return text
                .replace(/<script[\s\S]*?<\/script>/gi, " ")
                .replace(/<style[\s\S]*?<\/style>/gi, " ")
                .replace(/<[^>]*>/g, " ")
                .replace(/&nbsp;/g, " ")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, "\"")
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, " ")
                .trim();
        },
        StartReplyComment(comment) {
            var self = this;
            self.ReplyComment = comment || null;
            self.FormRightType = "DataComment";
        },
        CancelReplyComment() {
            this.ReplyComment = null;
        },
        GetDraftFieldFormRef() {
            var self = this;
            var fieldForm = self.$refs && (self.$refs.fieldForm || self.$refs.fieldFormPage);
            if (Array.isArray(fieldForm)) {
                fieldForm = fieldForm[0];
            }
            return fieldForm;
        },
        GetCurrentDraftSnapshot() {
            var self = this;
            var fieldForm = self.GetDraftFieldFormRef();
            var data = null;
            if (fieldForm && typeof fieldForm.GetDraftData === "function") {
                data = fieldForm.GetDraftData();
            } else if (self.CurrentRowModel) {
                data = JSON.parse(JSON.stringify(self.CurrentRowModel));
            }
            if (!data) {
                self.DiyCommon.Tips("当前表单尚未加载完成，请稍后再试。", false);
                return null;
            }
            if (self.TableRowId && !data.Id) {
                data.Id = self.TableRowId;
            }
            return data;
        },
        GetDraftDefaultName() {
            var self = this;
            var tableText = (self.CurrentDiyTableModel && (self.CurrentDiyTableModel.Description || self.CurrentDiyTableModel.Name))
                || self.TableName
                || "表单";
            var now = new Date();
            var pad = function (num) {
                return num < 10 ? "0" + num : "" + num;
            };
            return tableText + "草稿 " + now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes());
        },
        async SaveToDraftBox() {
            var self = this;
            if (self.FormMode == "View") {
                self.DiyCommon.Tips("查看模式不能保存草稿。", false);
                return;
            }
            var snapshot = self.GetCurrentDraftSnapshot();
            if (!snapshot) return;
            var promptResult = null;
            try {
                promptResult = await ElMessageBox.prompt("请输入草稿名称", "保存至草稿箱", {
                    confirmButtonText: "保存",
                    cancelButtonText: "取消",
                    inputValue: self.GetDraftDefaultName(),
                    inputPlaceholder: "请输入草稿名称",
                    closeOnClickModal: false,
                    type: "info"
                });
            } catch (error) {
                // 用户取消保存时不需要提示。
                return;
            }
            var draftName = promptResult && promptResult.value ? promptResult.value : self.GetDraftDefaultName();
            await self.AddDraftData(draftName, snapshot);
        },
        async AddDraftData(draftName, snapshot) {
            var self = this;
            if (!snapshot) {
                snapshot = self.GetCurrentDraftSnapshot();
            }
            if (!snapshot) return;
            var tableId = self.TableId || (self.CurrentDiyTableModel && self.CurrentDiyTableModel.Id) || "";
            var tableName = self.TableName || (self.CurrentDiyTableModel && self.CurrentDiyTableModel.Name) || "";
            var result = await self.DiyCommon.FormEngine.AddFormData("mci_drafts", {
                DraftName: draftName || self.GetDraftDefaultName(),
                SourceTableId: tableId,
                SourceTableName: tableName,
                TableRowId: self.TableRowId || snapshot.Id || "",
                SysMenuId: self.SysMenuId || "",
                FormMode: self.FormMode || "",
                Status: "Draft",
                Data: JSON.stringify(snapshot),
                Remark: ""
            });
            if (self.DiyCommon.Result(result)) {
                if (result.Data && result.Data.Id) {
                    self.CurrentDraftId = result.Data.Id;
                }
                self.DiyCommon.Tips("草稿已保存。");
                self.LoadDraftList(false);
            }
        },
        LoadDraftList(openDialog) {
            var self = this;
            var tableId = self.TableId || (self.CurrentDiyTableModel && self.CurrentDiyTableModel.Id) || "";
            if (self.DiyCommon.IsNull(tableId)) {
                self.DraftList = [];
                return;
            }
            var token = ++self._DraftLoadToken;
            self.DraftListLoading = true;
            if (openDialog === true) {
                self.ShowDraftDialog = true;
            }
            var where = [
                ["SourceTableId", "=", tableId],
                ["Status", "=", "Draft"]
            ];
            if (self.GetCurrentUser && self.GetCurrentUser.Id) {
                where.push(["CreateUser", "=", self.GetCurrentUser.Id]);
            }
            self.DiyCommon.FormEngine.GetTableData(
                {
                    FormEngineKey: "mci_drafts",
                    _Where: where,
                    _OrderBy: "CreateTime",
                    _OrderByType: "DESC"
                },
                function (result) {
                    if (token !== self._DraftLoadToken) return;
                    try {
                        self.DraftList = result && result.Code == 1 && Array.isArray(result.Data) ? result.Data : [];
                    } finally {
                        self.DraftListLoading = false;
                    }
                }
            );
        },
        OpenDraftDialog() {
            var self = this;
            self.LoadDraftList(true);
        },
        ParseDraftData(draft) {
            var self = this;
            if (!draft || self.DiyCommon.IsNull(draft.Data)) {
                return null;
            }
            try {
                return typeof draft.Data === "string" ? JSON.parse(draft.Data) : JSON.parse(JSON.stringify(draft.Data));
            } catch (error) {
                self.DiyCommon.Tips("草稿数据解析失败：" + error.message, false);
                return null;
            }
        },
        LoadDraftToForm(draft) {
            var self = this;
            var data = self.ParseDraftData(draft);
            if (!data) return;
            self.CurrentDraftId = draft.Id || "";
            self.TableRowId = draft.TableRowId || data.Id || self.TableRowId;
            data.Id = self.TableRowId || data.Id;
            var draftMode = draft.FormMode || self.FormMode || "Edit";
            self.FormMode = draftMode == "View" ? "Edit" : draftMode;
            self.ShowDraftDialog = false;
            self.$nextTick(function () {
                var fieldForm = self.GetDraftFieldFormRef();
                if (!fieldForm || typeof fieldForm.ApplyVersionData !== "function") {
                    self.DiyCommon.Tips("当前表单尚未加载完成，请稍后再试。", false);
                    return;
                }
                fieldForm.ApplyVersionData(data);
                self.CloseFormNeedConfirm = true;
                self.DiyCommon.Tips("已加载草稿：" + (draft.DraftName || ""));
            });
        },
        DeleteDraft(draft) {
            var self = this;
            if (!draft || !draft.Id) return;
            self.DiyCommon.OsConfirm("确定删除草稿【" + (draft.DraftName || "") + "】？", async function () {
                var result = await self.DiyCommon.FormEngine.DelFormData("mci_drafts", { Id: draft.Id });
                if (self.DiyCommon.Result(result)) {
                    if (self.CurrentDraftId == draft.Id) {
                        self.CurrentDraftId = "";
                    }
                    self.DiyCommon.Tips("草稿已删除。");
                    self.LoadDraftList(false);
                }
            });
        },
        async DeleteCurrentDraftAfterSave() {
            var self = this;
            if (self.DiyCommon.IsNull(self.CurrentDraftId)) {
                return;
            }
            var draftId = self.CurrentDraftId;
            self.CurrentDraftId = "";
            try {
                await self.DiyCommon.FormEngine.DelFormData("mci_drafts", { Id: draftId });
                self.LoadDraftList(false);
            } catch (error) {
                self.CurrentDraftId = draftId;
            }
        },
        GetCommentList() {
            var self = this;
            if (self.DiyCommon.IsNull(self.TableRowId)) {
                self.DataCommentList = [];
                self.DataCommentListLoading = false;
                return;
            }
            var token = ++self._DataCommentLoadToken;
            self.DataCommentListLoading = true;
            self.DiyCommon.FormEngine.GetTableData(
                {
                    FormEngineKey: "diy_comment",
                    _Where: [["TableRowId", "=", self.TableRowId]],
                    _OrderBy: "CreateTime",
                    _OrderByType: "DESC"
                },
                function (result) {
                    if (token !== self._DataCommentLoadToken) return;
                    try {
                        if (result && result.Code == 1 && Array.isArray(result.Data)) {
                            result.Data.forEach((item) => {
                                if (item.Avatar) {
                                    item.Avatar = self.DiyCommon.GetServerPath(item.Avatar);
                                } else {
                                    item.Avatar = self.DiyCommon.GetServerPath("./static/img/icon/personal.png");
                                }
                                if (item.ParentCommentId && !item.ReplyToContent) {
                                    var parentComment = result.Data.find(function (parent) {
                                        return parent && parent.Id == item.ParentCommentId;
                                    });
                                    if (parentComment) {
                                        item.ReplyToContent = self.GetCommentPlainText(parentComment.Content);
                                        item.ReplyToUserName = item.ReplyToUserName || self.GetCommentAuthor(parentComment);
                                    }
                                }
                                if (item.ReplyToContent) {
                                    item.ReplyToContent = self.GetCommentPlainText(item.ReplyToContent);
                                }
                            });
                            self.DataCommentList = result.Data;
                        } else {
                            self.DataCommentList = [];
                        }
                    } finally {
                        self.DataCommentListLoading = false;
                    }
                }
            );
        },
        ParseDataVersionData(versionItem) {
            var self = this;
            if (!versionItem || self.DiyCommon.IsNull(versionItem.Data)) {
                return null;
            }
            try {
                if (typeof versionItem.Data === "string") {
                    return JSON.parse(versionItem.Data);
                }
                return JSON.parse(JSON.stringify(versionItem.Data));
            } catch (error) {
                self.DiyCommon.Tips("数据版本内容解析失败：" + error.message, false);
                return null;
            }
        },
        GetDataVersionPreviewFormRef() {
            var self = this;
            var fieldForm = self.$refs && self.$refs.fieldFormDataVersionPreview;
            if (Array.isArray(fieldForm)) {
                fieldForm = fieldForm[0];
            }
            return fieldForm;
        },
        ApplyDataVersionPreviewData() {
            var self = this;
            var fieldForm = self.GetDataVersionPreviewFormRef();
            if (!fieldForm || typeof fieldForm.ApplyVersionData !== "function" || !self.PreviewDataVersionData) {
                return;
            }
            fieldForm.ApplyVersionData(self.PreviewDataVersionData);
        },
        CallbackGetDiyFieldPreview() {
            var self = this;
            self.$nextTick(function () {
                self.ApplyDataVersionPreviewData();
            });
        },
        PreviewDataVersion(versionItem) {
            var self = this;
            var data = self.ParseDataVersionData(versionItem);
            if (!data) return;
            data.Id = self.TableRowId || data.Id;
            self.PreviewDataVersionItem = versionItem;
            self.PreviewDataVersionData = data;
            self.PreviewDataVersionKey++;
            self.ShowDataVersionPreviewDialog = true;
            self.$nextTick(function () {
                self.ApplyDataVersionPreviewData();
            });
        },
        LoadDataVersionToForm(versionItem) {
            var self = this;
            var data = self.ParseDataVersionData(versionItem);
            if (!data) return false;
            data.Id = self.TableRowId || data.Id;
            var fieldForm = self._getFieldFormRef ? self._getFieldFormRef() : self.$refs.fieldForm;
            if (Array.isArray(fieldForm)) {
                fieldForm = fieldForm[0];
            }
            if (!fieldForm || typeof fieldForm.ApplyVersionData !== "function") {
                self.DiyCommon.Tips("当前表单尚未加载完成，请稍后再试。", false);
                return false;
            }
            fieldForm.ApplyVersionData(data);
            self.FormMode = "Edit";
            self.CloseFormNeedConfirm = true;
            self.DiyCommon.Tips("已加载数据版本 " + (versionItem.Version || ""));
            return true;
        },
        SaveDataVersionAsCurrent(versionItem) {
            var self = this;
            if (!self.LoadDataVersionToForm(versionItem)) {
                return;
            }
            self.$nextTick(function () {
                self.SaveDiyTableCommon({
                    SavedType: "Edit",
                    Callback: function () {
                        self.LoadDataVersion && self.LoadDataVersion();
                    }
                });
            });
        },
        SaveDiyTableCommonPage(isBack) {
            var self = this;
            try {
                self.SaveDiyTableCommonLoding = true;

                var param = {};
                var url = self.DiyApi.AddDiyTableRow;
                if (!self.DiyCommon.IsNull(self.TableRowId)) {
                    url = self.DiyApi.UptDiyTableRow;
                    param._TableRowId = self.TableRowId;
                }
                param.FormMode = self.FormMode;
                param.SavedType = "Edit";
                self.$refs.fieldFormPage.FormSubmit(param, async function (success, formData, outFormV8Result) {
                    if (success == true) {
                        await self.DeleteCurrentDraftAfterSave();
                        if (isBack === true && (!outFormV8Result || outFormV8Result.Result !== false)) {
                            self.Go_1();
                        } else {
                            self.FormMode = "Edit";
                        }
                    }
                    self.SaveDiyTableCommonLoding = false;
                });
            } catch (error) {
                self.SaveDiyTableCommonLoding = false;
                throw error;
            }
        },
        CallbackFormSubmitPage(param) {
            var self = this;
            self.SaveDiyTableCommonPage(param);
        },
        CallbackGetDiyFieldPage(diyFieldList) {
            var self = this;
            self.DiyFieldList = diyFieldList;
        },
        CallbackReloadFormPage(row, type) {
            var self = this;
            // 防止死循环：如果正在重载中，直接返回
            if (self._isReloadingForm) {
                console.warn('[diy-form-full] CallbackReloadFormPage: 正在重载中，跳过本次调用以防止死循环');
                return;
            }

            self._isReloadingForm = true;
            if (self.$refs.fieldFormPage) {
                self.$refs.fieldFormPage.Init();
            }

            // 延迟重置标志，确保 Init 完成
            self.$nextTick(() => {
                setTimeout(() => {
                    self._isReloadingForm = false;
                }, 500);
            });
        },
    }
};
