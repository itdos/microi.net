
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

                    if (isClose === true && outFormV8Result.Result !== false) {
                        self.ShowFieldForm = false;
                        self.ShowFieldFormDrawer = false;
                    } else {
                        //刷新子表
                        self.$refs.fieldForm.RefreshAllChildTable();
                        // 表单未关闭：刷新右侧的"数据日志/数据评论"，让用户立即看到最新变更
                        self.$nextTick(function () {
                            try { self.LoadDataLog && self.LoadDataLog(); } catch (e) {}
                            try { self.LoadDataComment && self.LoadDataComment(); } catch (e) {}
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
            // self.DiyFieldList = diyFieldList
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
            self.BtnLoading = true;
            self.DiyCommon.FormEngine.AddTableData(
                {
                    FormEngineKey: "mic_data_comment",
                    DataId: self.TableRowId,
                    Content: self.CommentContent,
                    TableId: self.TableId
                },
                function (result) {
                    if (result.Code == 1) {
                        self.CommentContent = "";
                        self.GetCommentList();
                    }
                    self.BtnLoading = false;
                }
            );
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
                    FormEngineKey: "mic_data_comment",
                    _Where: [["DataId", "=", self.TableRowId]],
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
                        if (isBack === true && outFormV8Result.Result !== false) {
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
