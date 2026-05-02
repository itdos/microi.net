import _ from "underscore";

export default {
    methods: {
        OpenTableSetWhere(fieldModel, where) {
            fieldModel.Config.OpenTable.PropsWhere = where;
        },
        AppendSearchChildTable(fieldModel, appendSearch) {
            var self = this;
            fieldModel.Config.OpenTable.SearchAppend = appendSearch;
        },
        FormDiyTableModelListen(field) {
            var self = this;
            //2021-10-25新增，有可能用户自定义父级model，如点击A子表一行数据，更新B子表数据
            if (!self.DiyCommon.IsNull(field._ParentFormModel)) {
                return Object.assign(
                    {},
                    {
                        ...field._ParentFormModel
                    }
                );
            }

            //注意：这句Object.assign 非常非常非常非常 重要，不能直接 return this.Form.DiyTableModel
            //直接会怎么样？2021-2-07，自己都忘了:(
            return Object.assign(
                {},
                {
                    ...this.FormDiyTableModel
                }
            );
            // return this.FormDiyTableModel;
        },
        GetChildTableData(fieldName) {
            var self = this;
            var refComponent = self.getRefComponent(fieldName);
            if (refComponent && refComponent.DiyTableRowList) {
                return refComponent.DiyTableRowList;
            }
            return [];
        },
        ShowTableChildHideField(fieldName, fields) {
            var self = this;
            var refComponent = self.getRefComponent(fieldName);
            if (refComponent && typeof refComponent.ShowHideFields === 'function') {
                refComponent.ShowHideFields(fields);
            }
        },
        //param: { _PageIndex : 1 }
        //_PageIndex从1开始计数，传入-1表示跳到最后一页。
        TableRefresh(field, param) {
            var self = this;
            try {
                var refComponent = self.getRefComponent(field.Name);
                if (refComponent && typeof refComponent.RefreshDiyTableRowList === 'function') {
                    refComponent.RefreshDiyTableRowList(param);
                }
            } catch (error) {
                // removed debug log
            }
        },
        //刷新所有子表
        RefreshAllChildTable(field, param) {
            var self = this;
            var allChildTable = _.where(self.DiyFieldList, {
                Component: "TableChild"
            });
            allChildTable.forEach((field) => {
                try {
                    var refComponent = self.getRefComponent(field.Name);
                    if (refComponent && typeof refComponent.RefreshDiyTableRowList === 'function') {
                        refComponent.RefreshDiyTableRowList(param);
                    }
                } catch (error) {
                    // removed debug log
                }
            });
        },
        CallbackRefreshTable(param) {
            var self = this;
            try {
                self.$emit("CallbackRefreshTable", param);
            } catch (error) {
                // removed debug log
            }
        },
        TableSetData(field) {
            var self = this;
            try {
                var refComponent = self.getRefComponent(field.Name);
                if (refComponent && typeof refComponent.TableSetData === 'function') {
                    refComponent.TableSetData();
                }
            } catch (error) {
                // removed debug log
            }
        },
        //值：{FieldName:value}
        SearchAppend(field, val) {
            var self = this;
            for (const key in val) {
                field.Config.TableChild.SearchAppend[key] = val[key];
            }
        },
        //值：{FieldName:value}
        SearchSet(field, val) {
            var self = this;

            field.Config.TableChild.SearchAppend = val;
        },
                GetDiyTableRowModel() {
            // // _TableRowId : self.TableRowId  , LIMIT 1
            // var self = this
            // self.DiyCommon.Post(DiyApi.GetDiyTableRowModel, {
            //     TableId: self.TableId,
            //     _TableRowId: self.TableRowId,
            //     OsClient: self.OsClient
            // }, function (result) {
            //     if (self.DiyCommon.Result(result)) {
            //         // self.CurrentDiyTableRowModel = result.Data;//2020-07-09：这个存在的意义是什么？暂时注释
            //         // self.FormDiyTableModel = result.Data;//注意：这里暂时不要赋值，因为后面DiyFieldStrToJson会去赋值，处理数据转换
            //         // 2020-07-02：不用每次都从数据库取
            //         if (self.DiyFieldList.length == 0) {
            //             self.GetDiyField(result.Data)
            //         } else {
            //             self.DiyFieldList.forEach(element => {
            //                 self.DiyFieldStrToJson(element, result.Data, null)
            //             })
            //         }
            //     }
            // })
        },
        SetDiyTableModel(data) {
            var self = this;
            self.DiyCommon.DiyTableStrToJson(data);
            self.DiyCommon.Base64DecodeDiyTable(data);
            self.DiyTableModel = data;
            console.log('准备传入表数据 - SetDiyTableModel:', self.DiyTableModel );
            self.$emit("CallbackSetDiyTableModel", self.DiyTableModel);
        },
        //2022-04-09 虽然这是提交子表，但是提交关联表单的逻辑也写到这里面
        async SubmitChildTable(formParam) {
            var self = this;
            try {
                var needSaveRowLis = [];
                //判断是否有子表待提交。 2021-01-06注意：要主表通过验证了，再提交子表的，否则子表会重复，也就是应该先提交主表，再提交子表
                // needSaveRowLis = self.$refs.fieldForm.GetNeedSaveRowList();
                needSaveRowLis = self.GetNeedSaveRowList();
                if (needSaveRowLis && needSaveRowLis.length > 0) {
                    //needSaveRowLis.Rows && needSaveRowLis.Rows.length > 0
                    var batchAddParams = [];
                    var batchEditParams = [];
                    var needSubmit = false;
                    needSaveRowLis.forEach((element) => {
                        if (!element.Rows || element.Rows.length == 0) {
                            return;
                        }
                        element.Rows.forEach((row) => {
                            //这里要调用这2个函数处理下，比如下拉框是只存储字段
                            var rowModel = { ...row };
                            if (self.$refs["ref_" + element.FieldName] && self.$refs["ref_" + element.FieldName].length > 0) {
                                //注意：这里是传子表的DiyFieldList，而不是主表的
                                var diyFieldList = self.$refs["ref_" + element.FieldName][0].DiyFieldList;
                                self.DiyCommon.ForRowModelHandler(rowModel, diyFieldList);
                                rowModel = self.DiyCommon.ConvertRowModel(rowModel);
                                if (rowModel._DataStatus && rowModel._DataStatus == "Edit") {
                                    batchEditParams.push({
                                        FormEngineKey: element.TableId,
                                        Id: rowModel.Id,
                                        _RowModel: rowModel
                                    });
                                } else {
                                    batchAddParams.push({
                                        FormEngineKey: element.TableId, //rowModel.TableId ||
                                        _TableName: element.TableName,
                                        _FormData: rowModel
                                    });
                                }
                            }
                        });
                    });
                    if (batchAddParams.length > 0) {
                        var result = await self.DiyCommon.PostAsync(self.DiyApi.AddFormDataBatch, batchAddParams, null, null, "json");
                        if (batchEditParams.length === 0) {
                            if (!self.DiyCommon.Result(result)) {
                                // self.BtnLoading = false;
                                formParam.SaveLoading = false;
                                return;
                            } else {
                                //2022-04-11 表内编辑提交后，需要将_IsInTableAdd置空
                                self.ClearNeedSaveRowList();
                            }
                        }
                    }
                    if (batchEditParams.length > 0) {
                        var result = await self.DiyCommon.PostAsync(self.DiyApi.UptFormDataBatch, batchEditParams, null, null, "json");
                        if (!self.DiyCommon.Result(result)) {
                            formParam.SaveLoading = false;
                            return;
                        } else {
                            self.ClearNeedSaveRowList();
                        }
                    }
                }
                //关联表单提交
                self.GetNeedSaveJoinFormList();
                return;
            } catch (error) {
                // self.BtnLoading = false;
                formParam.SaveLoading = false;
                throw error;
                return;
            }
        },
        async CheckChildTable(formParam) {
            var self = this;
            try {
                var checkResult = true;
                var needSaveRowLis = [];
                //判断是否有子表待提交。 2021-01-06注意：要主表通过验证了，再提交子表的，否则子表会重复，也就是应该先提交主表，再提交子表
                // needSaveRowLis = self.$refs.fieldForm.GetNeedSaveRowList();
                needSaveRowLis = self.GetNeedSaveRowList();
                if (needSaveRowLis && needSaveRowLis.length > 0) {
                    //needSaveRowLis.Rows && needSaveRowLis.Rows.length > 0
                    var batchAddParams = [];
                    var needSubmit = false;
                    needSaveRowLis.forEach((element) => {
                        if (!element.Rows || element.Rows.length == 0) {
                            return;
                        }
                        element.Rows.forEach((row) => {
                            //这里要调用这2个函数处理下，比如下拉框是只存储字段
                            var rowModel = { ...row };
                            if (self.$refs["ref_" + element.FieldName] && self.$refs["ref_" + element.FieldName].length > 0) {
                                //注意：这里是传子表的DiyFieldList，而不是主表的
                                var diyFieldList = self.$refs["ref_" + element.FieldName][0].DiyFieldList;

                                //只取当前这个子表的所有字段。--2025-02-18 --by Anderson
                                var childTableId = self.$refs["ref_" + element.FieldName][0].TableId;
                                if (childTableId) {
                                    diyFieldList = diyFieldList.filter((item) => item.TableId == childTableId);
                                }

                                //---check
                                var checkForm = true;
                                var checkFailField = {};
                                diyFieldList.forEach((field) => {
                                    //再手动判断一下必填等验证
                                    if (
                                        !self.DiyCommon.IsNull(field.NotEmpty) &&
                                        field.NotEmpty &&
                                        self.FieldIsVisible(field) &&
                                        (self.DiyCommon.IsNull(rowModel[field.Name]) ||
                                            (typeof rowModel[field.Name] == "object" && (JSON.stringify(rowModel[field.Name]) == "{}" || JSON.stringify(rowModel[field.Name]) == "[]"))) &&
                                        // && (
                                        //         self.ShowFields.length == 0
                                        //         || (self.ShowFields.length > 0 && self.ShowFields.indexOf(field.Name) > -1)  // _.where(self.ShowFields, { Id: field.Id}).length > 0
                                        //     )
                                        // && self.HideFields.indexOf(field.Name) == -1
                                        field.Component !== "DevComponent" &&
                                        field.Component !== "TableChild" &&
                                        field.Component !== "Button" &&
                                        field.Component !== "Button" &&
                                        field.Component !== "AutoNumber" &&
                                        !self.GetFieldReadOnly(field)
                                        // && !self.DiyCommon.IsNull(field.FieldType)
                                    ) {
                                        checkFailField = field;
                                        checkForm = false;
                                    }
                                });
                                if (!checkForm) {
                                    self.DiyCommon.Tips("请检查必填项：[" + checkFailField.Label + "]！", false);
                                    checkResult = false;
                                    // callback();
                                }
                                //---check  end

                                self.DiyCommon.ForRowModelHandler(rowModel, diyFieldList);
                                rowModel = self.DiyCommon.ConvertRowModel(rowModel);
                                batchAddParams.push({
                                    TableId: element.TableId,
                                    TableName: element.TableName,
                                    _FormData: rowModel
                                });
                            }
                        });
                    });
                    // if(batchAddParams.length > 0){
                    //     var result = await self.DiyCommon.PostAsync(DiyApi.AddDiyTableRowBatch, { _List : batchAddParams });
                    //     if (!self.DiyCommon.Result(result)) {
                    //         // self.BtnLoading = false;
                    //         formParam.SaveLoading = false;
                    //         return;
                    //     }
                    // }
                }
                if (!checkResult) {
                    return false;
                }
                return true;
            } catch (error) {
                // self.BtnLoading = false;
                formParam.SaveLoading = false;
                throw error;
                return false;
            }
        },
        CallbackParentFormSubmit(param) {
            var self = this;
            if (self.FormMode == "Add" || self.FormMode == "Insert") {
                //CloseForm:true, SavedType:'Insert/Update/View'
                self.V8FormSubmit({
                    CloseForm: false,
                    SavedType: "Update"
                });
            }
        },
    }
};
