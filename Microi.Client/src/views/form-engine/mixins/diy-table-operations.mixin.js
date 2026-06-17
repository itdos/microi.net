
export default {
    methods: {
        GetMoreBtnStyle(btn) {
            var self = this;
            if (btn.BtnStyle) {
                return btn.BtnStyle;
            }
            return "primary";
        },
        GetDiyCustomDialogDataAppend() {
            var self = this;
            var result = {
                V8: {}
            };
            if (self.DiyCustomDialogConfig.DataAppend) {
                for (const key in self.DiyCustomDialogConfig.DataAppend) {
                    result[key] = self.DiyCustomDialogConfig.DataAppend[key];
                }
            }
            result.V8 = self.SetV8DefaultValue(result.V8);
            result.V8["CloseThisDialog"] = self.CloseThisDialog;
            return result;
        },
        RefreshChildTable(field, parentFormModel, v8) {
            var self = this;
            self.$emit("CallbakRefreshChildTable", field, parentFormModel, v8);
        },
        //将哪些隐藏的字段显示出来，传入['FieldName', 'FieldName']
        //2021-10-26 新增排序
        ShowHideFields(fields) {
            var self = this;
            // self.ShowDiyFieldList
            self.ShowHideFieldsList = fields;
            self.GetSysMenuModel();
            self.GetDiyField();
        },
        //showRow:是否行外显示按钮，而不是更多里面
        //2021-09-02修改：提前计算出按钮分组，别临时计算
        // GetMoreBtnsGroup(showRow, row){
        //     var self = this;
        //     var arr = _u.where(self.SysMenuModel.MoreBtns, { ShowRow : showRow});
        //     //加了这一句报死循环错误 ，后面改成了获取到RowList数据后提前计算出来
        //     self.HandlerBtns(arr, row);
        //     return arr;
        // },
        //是否是多Tabs
        IsPageTabs() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysMenuModel) && !self.DiyCommon.IsNull(self.SysMenuModel.PageTabs)) {
                if (self.SysMenuModel.PageTabs.length > 1 || (self.SysMenuModel.PageTabs.length == 1 && self.SysMenuModel.PageTabs[0].Id != "none" && self.SysMenuModel.PageTabs[0].Name != "")) {
                    return true;
                }
            }
            return false;
        },
        SwitchTableBatch() {
            var self = this;
            if (!self.HasBatchSelectMoreBtns() && self.EnableMultipleSelect !== true) {
                self.TableEnableBatch = false;
                return;
            }
            self.TableEnableBatch = !self.TableEnableBatch;
        },
        InitSearch() {
            var self = this;
            let search_where = window.location.pathname + window.location.search + window.location.hash + "search_where";

            sessionStorage.removeItem(search_where); //移除搜索session 李赛赛 2025-06-25
            self.Keyword = "";
            self.SearchModel = {};
            self.SearchCheckbox = {};
            self.SearchDateTime = {};
            self.SearchNumber = {};
            self.SearchWhere = [];
            self.hbParam1 = [];
            self.hbParam2 = [];
            self.hbParam3 = [];
            self.hbParam4 = [];
            if (self.$refs.refDiySearch1) {
                self.$refs.refDiySearch1.InitSearch();
            }
            if (self.$refs.refDiySearch2) {
                self.$refs.refDiySearch2.InitSearch();
            }
            if (self.$refs.refDiySearch3) {
                self.$refs.refDiySearch3.InitSearch();
            }
            if (self.$refs.refDiySearch4) {
                self.$refs.refDiySearch4.InitSearch();
            }
            // zhy点击重置按钮时可以一起清空移动端更多搜索弹窗内的数据（refDiySearchMobile）
            if (self.$refs.refDiySearchMobile) {
                try { self.$refs.refDiySearchMobile.InitSearch(); } catch (e) {}
            }
        },
                GetFormWF() {
            // 表单工作流状态已迁移到 diy-form-full.vue，此处返回默认值
            return {
                IsWF: false,
                WorkType: "",
                FlowDesignId: ""
            };
        },
        ShowTableChildHideField(fieldName, fields) {
            var self = this;
            // if (self.$refs['refTableChild_' + fieldName]) {
            //     self.$refs['refTableChild_' + fieldName][0].ShowHideFields(fields);
            // }
            self.$emit("CallbackShowTableChildHideField", fieldName, fields);
        },
        FormSet(fieldName, value, row) {
            var self = this;
            if (!fieldName) return;
            var targetField = null;
            if (Array.isArray(self.DiyFieldList)) {
                targetField = self.DiyFieldList.find(function (field) {
                    return field && (field.Name == fieldName || field.AsName == fieldName);
                });
            }
            var rowFieldName = targetField && !self.DiyCommon.IsNull(targetField.AsName) ? targetField.AsName : fieldName;
            var targetRow = row || self.CurrentSelectedRowModel;
            if (!targetRow) return;

            targetRow[fieldName] = value;
            targetRow[rowFieldName] = value;

            var renderRow = targetRow;
            var rowIndex = self.FindDiyTableRowIndexByRow(targetRow);
            if (rowIndex > -1) {
                renderRow = Object.assign({}, self.DiyTableRowList[rowIndex] || targetRow);
                renderRow[fieldName] = value;
                renderRow[rowFieldName] = value;
            }

            self.RefreshRowTemplateEngineResult(renderRow);

            if (rowIndex > -1) {
                self.DiyTableRowList.splice(rowIndex, 1, renderRow);
            } else if (typeof self.$forceUpdate === "function") {
                self.$forceUpdate();
            }
            return value;
        },
        FindDiyTableRowIndexByRow(row) {
            var self = this;
            if (!row || !Array.isArray(self.DiyTableRowList)) return -1;
            if (self.DiyTableRowList.indexOf(row) > -1) {
                return self.DiyTableRowList.indexOf(row);
            }
            if (self.DiyCommon.IsNull(row.Id)) return -1;
            return self.DiyTableRowList.findIndex(function (item) {
                return item && item.Id == row.Id;
            });
        },
        RefreshRowTemplateEngineResult(row) {
            var self = this;
            if (!row || !Array.isArray(self.DiyFieldList)) return;
            self.DiyFieldList.forEach(function (field) {
                if (!field || self.DiyCommon.IsNull(field.V8TmpEngineTable)) return;
                try {
                    row[field.Name + "_TmpEngineResult"] = self.RunFieldTemplateEngine(field, row);
                } catch (e) {}
            });
        },
        FieldSet(fieldName, attrName, value) {
            var self = this;
            // 先查找出Field对象
            self.DiyFieldList.forEach((element) => {
                if (element.Name == fieldName) {
                    element[attrName] = value;
                }
            });
        },
        ParentFormSet(fieldName, value) {
            var self = this;
            self.$emit("ParentFormSet", fieldName, value);
        },
        SetV8SearchModel(val) {
            var self = this;
            self.V8SearchModel = val;
        },
        //值：{FieldName:value}
        //2024-12-14新增可以传入 _Where：[{...}]
        SearchAppendFunc(val) {
            var self = this;
            if (Array.isArray(val)) {
                if (val.length > 0) {
                    val.forEach((item) => {
                        const index = self.Where.findIndex((d) => d.Name == item.Name);
                        if (index === -1) {
                            self.Where.push(item);
                        } else {
                            self.Where[index] = { ...self.Where[index], ...item };
                        }
                    });
                }
            } else {
                for (const key in val) {
                    self.V8SearchModel[key] = val[key];
                }
            }
        },
        //值：{FieldName:value}
        //2024-12-14新增可以传入 _Where：[{...}]
        SearchSetFunc(val) {
            var self = this;
            if (Array.isArray(val)) {
                self.Where = val;
            } else {
                // 2025-12-04 Anderson：转换为_Where格式
                // self.V8SearchModel = val;
                self.Where = [];
                for (const key in val) {
                    var tempWhere = [];
                    tempWhere.push(key);
                    tempWhere.push("Like");
                    tempWhere.push(val[key]);
                    self.Where.push(tempWhere);
                }
            }
        },
        /**
         * 注意传入的tableRowId并不一定是TableRowId，也可能是PrimaryTableFieldName的值
         */
        SetFieldFormDefaultValues(tableRowId) {
            var self = this;
            var tempDefaultValues = {};

            tempDefaultValues[self.TableChildFkFieldName] = tableRowId;

            //判断有没有主表要回写子表列的
            try {
                //2021-12-14注释，通过FatherFormModel处理，不再通过FatherFormModel_Data
                //后来发现还是需要用这种方法
                var fatherFormModel = self.FatherFormModel;
                if (!self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    fatherFormModel = self.FatherFormModel_Data;
                }
                //---end

                //这句一直不需要
                //var fatherFormModel = self.$refs.fieldForm.FormDiyTableModel;
                if (!self.DiyCommon.IsNull(self.TableChildCallbackField) && !self.DiyCommon.IsNull(fatherFormModel)) {
                    // if (!self.DiyCommon.IsNull(self.TableChildCallbackField) && !self.DiyCommon.IsNull(self.FatherFormModel.Id)) {
                    try {
                        var callBackJson = JSON.parse(self.TableChildCallbackField);
                        callBackJson.forEach((callbackField) => {
                            tempDefaultValues[callbackField.Child] = fatherFormModel[callbackField.Father];
                            // tempDefaultValues[callbackField.Child] = self.FatherFormModel[callbackField.Father];
                        });
                    } catch (error) {
                        self.DiyCommon.Tips("子表回写列配置错误，请检查：" + self.TableChildCallbackField, false);
                        console.log(error);
                    }
                }
            } catch (error) {
                console.log("判断有没有主表要回写子表列的 error：");
                console.log(error);
            }
            //2022-02-17 有可能二次开发传过来的 FormDefaultValues
            for (let key in self.FormDefaultValues) {
                tempDefaultValues[key] = self.FormDefaultValues[key];
            }
            self.FieldFormDefaultValues = tempDefaultValues;
        },
        // RunFieldTemplateEnginePromise(V8, code){
        //     var self = this;
        //     return new Promise(resolve => {
        //         eval("(async () => {" + code + " \n})()")
        //         if (self.DiyCommon.IsNull(V8.Result)) {
        //             // return self.GetColValue({row : V8.Row}, V8.Field);
        //             resolve(self.GetColValue({row : V8.Row}, V8.Field));
        //         }
        //         // return V8.Result;
        //         resolve(V8.Result);
        //     });
        // },
        IsTableChild() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.TableChildTableId)) {
                return true;
            }
            return false;
        },
        // 导出数据
        ExportDiyTableRow(btn) {
            var self = this;
            self.BtnExportLoading = true;
            var url = self.DiyCommon.GetApiBase() + "/api/FormEngine/ExportDiyTableRow";
            var paramType = "json";
            if (!self.DiyCommon.IsNull(self.SysMenuModel.ExportApi)) {
                url = self.DiyCommon.RepalceUrlKey(self.SysMenuModel.ExportApi);
                paramType = "json";
            }

            if (!self.DiyCommon.IsNull(btn) && !self.DiyCommon.IsNull(btn.Url)) {
                url = btn.Url;
            }
            var param = {
                TableId: self.TableId,
                //2020-12-07-注意：目前只有导出接口不支持token验证，所以导出接口需要加入[AllowAnonymous]特性，并且手动指定OsClient或_CurrentSysUser
                OsClient: self.diyStore.OsClient, //self.OsClient,
                _Keyword: self.Keyword,
                //要导出所有数据，所以不分页
                // _PageIndex: self.DiyTableRowPageIndex,
                // _PageSize: self.DiyTableRowPageSize,
                // _SysMenuId: self.SysMenuId,
                ModuleEngineKey: self.SysMenuModel.ModuleEngineKey
            };
            self.applyTableOrderParams(param);
            if (!param.ModuleEngineKey) {
                param.ModuleEngineKey = self.SysMenuId;
            }
            if (!param.ModuleEngineKey) {
                param.FormEngineKey = self.CurrentDiyTableModel.Name;
            }
            if (!param.ModuleEngineKey && !param.FormEngineKey) {
                param.FormEngineKey = self.TableId;
            }
            //注意：这个是由主表传过来的主表行Id，需要在这里子表加入条件：where 外键Id=TableChildFkFieldName
            if (!self.DiyCommon.IsNull(self.TableChildFkFieldName)) {
                // param[self.TableChildFkFieldName] = self.TableChildFkValue;
                if (!self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    // if (!self.DiyCommon.IsNull(self.FatherFormModel.Id)) {
                    // self.SearchModel[self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
                    // // self.SearchModel[self.TableChildFkFieldName] = self.FatherFormModel.Id;
                    //2022-02-14 关联表修改为等值条件
                    //2022-07-23新增也可能不跟主表的Id进行关联
                    if (self.PrimaryTableFieldName) {
                        self.SearchEqual[self.TableChildFkFieldName] = self.FatherFormModel_Data[self.PrimaryTableFieldName];
                    } else {
                        self.SearchEqual[self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
                    }
                } else {
                    // self.SearchModel[self.TableChildFkFieldName] = self.TableChildTableRowId;
                    //2022-02-14 关联表修改为等值条件
                    self.SearchEqual[self.TableChildFkFieldName] = self.TableChildTableRowId;
                }
            }
            param._Search = self.SearchModel;
            param._SearchEqual = self.SearchEqual;
            param._SearchCheckbox = self.SearchCheckbox;
            param._SearchDateTime = self.SearchDateTime;
            if (self.SearchNumber) {
                for (let key in self.SearchNumber) {
                    if (self.SearchNumber[key].Min || self.SearchNumber[key].Max) {
                        param._SearchNumber = self.SearchNumber;
                        break;
                    }
                }
            }
            // param._TableRowSelected = self.TableRowSelected;

            //临时给刘姣姣用的
            param.UserId = self.GetCurrentUser.Id;

            if (self.SearchWhere.length > 0) {
                param._Where = self.SearchWhere.slice();
            }
            if (self.PropsWhere && self.PropsWhere.length > 0) {
                param._Where = self.mergeWhereList(param._Where, self.PropsWhere);
            }
            if (self.Where.length > 0) {
                if (!param._Where) {
                    param._Where = [];
                }
                self.Where.forEach(function(item) {
                    param._Where.push(item);
                });
            }

            self.DiyCommon.FormExportFileV2(
                url,
                param,
                function () {
                    self.BtnExportLoading = false;
                },
                self.SysMenuModel.Name,
                paramType
            );
        },
        // ========== 工作流相关：通过 SysMenuModel.OpenType=='WorkFlow' && FlowDesignId 实现一键发起申请 / 一键处理工作 ==========
        IsWorkFlowMenu() {
            var self = this;
            return !!(self.SysMenuModel
                && self.SysMenuModel.OpenType === "WorkFlow"
                && !self.DiyCommon.IsNull(self.SysMenuModel.FlowDesignId));
        },
        // 一键发起流程：等价于 V8.OpenFormWF(V8.Form, 'Add', { WorkType:'StartWork', FlowDesignId:'xxx' })
        StartWorkFlow() {
            var self = this;
            if (!self.IsWorkFlowMenu()) {
                self.DiyCommon.Tips("当前菜单未配置流程引擎或缺少 FlowDesignId！", false);
                return;
            }
            self.OpenDetail(null, "Add", true, true, {
                WorkType: "StartWork",
                FlowDesignId: self.SysMenuModel.FlowDesignId
            });
        },
        GetNeedSaveRowList() {
            var self = this;
            var result = [];
            self.DiyTableRowList.forEach((element) => {
                if (element._IsInTableAdd == true) {
                    result.push(element);
                }
            });
            return result;
        },
        ClearNeedSaveRowList() {
            var self = this;
            var result = [];
            self.DiyTableRowList.forEach((element) => {
                if (element._IsInTableAdd == true) {
                    element._IsInTableAdd = false;
                }
            });
            return result;
        },
        DelDiyTableRow(rowModel, dialogId) {
            var self = this;
            var title = "";

            var fieldModel = self.ShowDiyFieldList[0];
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
            self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + (title ? `【${title}】？` : "？"), async function () {
                //如果是表内新增的，直接删除
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

                //执行表单提交前V8
                var v8Result = await self.FormSubmitAction("Delete", rowModel.Id, rowModel);
                if (v8Result === false || (v8Result && (v8Result.Code === 0 || (v8Result.Code && v8Result.Code != 1)))) {
                    if (v8Result && v8Result.Msg) {
                        self.DiyCommon.Tips(v8Result.Msg, false);
                    }
                    return;
                }
                var param = {
                    TableId: self.TableId,
                    Id: rowModel.Id
                };

                var url = self.DiyApi.DelDiyTableRow;
                if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.ApiReplace.Delete)) {
                    url = self.DiyCommon.RepalceUrlKey(self.CurrentDiyTableModel.ApiReplace.Delete);
                }
                self.DiyCommon.Post(url, param, async function (result) {
                    if (self.DiyCommon.Result(result)) {
                        //执行表单提交后V8
                        await self.FormOutAction("Delete", "Delete", rowModel.Id, null, rowModel);

                        //请求接口--------start
                        // try {
                        //   if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.DelCallbakApi)) {
                        //     param.Id = param._TableRowId;
                        //     self.DiyCommon.Post(self.CurrentDiyTableModel.DelCallbakApi, param, function (apiResult) {});
                        //   }
                        // } catch (error) {
                        //   console.log("请求接口 error：", error);
                        // }

                        //--------------end
                        self.DiyCommon.Tips(self.$t("Msg.Success"));

                        if (dialogId) {
                            self.$nextTick(function () {
                                if (!self.DiyCommon.IsNull(dialogId)) {
                                    self[dialogId] = false;
                                }
                            });
                        }

                        //2023-08-08
                        if ((self.DiyTableRowList.length = 1 && self.DiyTableRowPageIndex > 1)) {
                            self.DiyTableRowPageIndex--;
                        }

                        self.GetDiyTableRow();
                    }
                });
            });
        },
        ToggleTrashMode() {
            var self = this;
            self.IsTrashMode = !self.IsTrashMode;
            self.TableMultipleSelection = [];
            self.cardSelection = [];
            self._moreMenuVisible = false;
            self.GetDiyTableRow({ _PageIndex: 1 });
        },
        RestoreTrashRow(rowModel) {
            var self = this;
            if (!rowModel || self.DiyCommon.IsNull(rowModel.Id)) {
                return;
            }
            self.DiyCommon.OsConfirm("确认恢复该回收站数据？", function () {
                self.BtnLoading = true;
                self.DiyCommon.Post(
                    self.DiyApi.UptDiyTableRow,
                    {
                        FormEngineKey: self.CurrentDiyTableModel.Name,
                        Id: rowModel.Id,
                        _TableRowId: rowModel.Id,
                        IsDeleted: 0,
                        _IsTrashRestore: true,
                        _FormData: {
                            IsDeleted: 0
                        }
                    },
                    function (result) {
                        self.BtnLoading = false;
                        if (self.DiyCommon.Result(result)) {
                            self.DiyCommon.Tips(self.$t("Msg.Success"));
                            self.GetDiyTableRow({ _PageIndex: 1 });
                            self.$emit("CallbackGetDiyTableRow", {});
                        }
                    },
                    function () {
                        self.BtnLoading = false;
                    }
                );
            });
        },
        DownloadTemplate() {
            var self = this;
            //2021修改为取私有oss
            //window.open(self.DiyCommon.GetServerPath(self.SysMenuModel.ImportTemplate));
            // self.DiyCommon.Post('/api/Aliyun/GetOssDownloadUrl',{
            self.DiyCommon.Post(
                "/api/HDFS/GetPrivateFileUrl",
                {
                    FilePathName: self.SysMenuModel.ImportTemplate, //self.FormDiyTableModel[field.Name]
                    HDFS: self.SysConfig.HDFS || "Aliyun"
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        result = result.Data;
                    } else {
                        result = "";
                    }
                    // self.$set(self.FormDiyTableModel, field.Name + '_' + fileId + '_RealPath', result);
                    // resolve(result);
                    window.open(result, "_blank", "noopener,noreferrer");
                }
            );
        },
        CallbackParentFormSubmit(param) {
            var self = this;
            self.$emit("CallbackParentFormSubmit", param);
        },
        CallbackReloadForm(row, type) {
            var self = this;
            //tableRowModel, formMode, isDefaultOpen
            self.OpenDetail(row, type);
        },
        CallbackHideFormBtn(btn) {
            var self = this;
            self["Show" + btn + "Btn"] = false;
        }
    }
};
