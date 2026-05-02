import _ from "underscore";

export default {
    methods: {
        GetColValue(row, field) {
            var self = this;
            var fuheWZ = "";
            var result = "";
            if (!self.DiyCommon.IsNull(field.Config)) {
                if (typeof field.Config === "string") {
                    field.Config = JSON.parse(field.Config);
                }
                if (!self.DiyCommon.IsNull(field.Config.TextApend)) {
                    fuheWZ = " " + field.Config.TextApend;
                }

                if (!self.DiyCommon.IsNull(field.Config.SelectLabel)) {
                    try {
                        //2021-01-02发现问题，这里如果存的是一串数字 ，JSON.parse()不会报错
                        var tObj = JSON.parse(row[field.Name]);
                        if (Array.isArray(tObj)) {
                            //if (field.Component == 'MultipleSelect')
                            tObj.forEach((element, index) => {
                                result += self.DiyCommon.IsNull(element[field.Config.SelectLabel]) ? "" : element[field.Config.SelectLabel];
                                if (index !== tObj.length - 1) {
                                    result += ",";
                                }
                            });
                            return result + fuheWZ;
                        }
                        //2021-01-02发现问题，这里如果存的是一串数字 ，JSON.parse()不会报错
                        else if (typeof tObj == "number") {
                            result = self.DiyCommon.IsNull(row[field.Name]) ? "" : row[field.Name];
                            return result + fuheWZ;
                        } else {
                            result = self.DiyCommon.IsNull(tObj[field.Config.SelectLabel]) ? "" : tObj[field.Config.SelectLabel];
                            return result + fuheWZ;
                        }
                    } catch (error) {
                        // removed debug logs
                    }
                }
            }

            var displayValue = self.DiyCommon.IsNull(row[field.Name]) ? "" : row[field.Name];
            //如果是富文本，需要去掉html标签
            if (field.Component == "RichText") {
                displayValue = self.DiyCommon.RemoveHtml(displayValue);
            }
            result = displayValue; //self.DiyCommon.IsNull(scope.row[field.Name]) ? '' : scope.row[field.Name];
            return result + fuheWZ;
        },
        async GetDiyFieldListObjectFunc(field) {
            var self = this;
            var result = {};
            if (field && !self.DiyCommon.IsNull(field.Config.TableChild.LastSysMenuId)) {
                //这里需要获取该字段上级关联模块的所有字段列表
                // {
                //     Url : DiyApi.GetDiyFieldByDiyTables,
                //     Param: {
                //         TableIds: [self.TableId],
                //         SysMenuId : self.SysMenuId
                //     }
                // }
                var fieldListResult = await self.DiyCommon.PostAsync(self.DiyApi.GetDiyFieldByDiyTables, {
                    TableIds: [field.Config.TableChild.LastTableId],
                    SysMenuId: field.Config.TableChild.LastSysMenuId
                });
                if (fieldListResult.Code == 1) {
                    fieldListResult.Data.forEach((element) => {
                        result[element.Name] = element;
                    });
                }
            }
            return result;
        },
        GetFieldConfigButtonType(field) {
            var self = this;
            if (field.Config && field.Config.Button && field.Config.Button.Type) {
                return field.Config.Button.Type;
            }
            return "";
        },
        GetShowTabs() {
            var self = this;
            if (self.FixedTabs.length > 0) {
                return self.FixedTabs;
            }
            return self.DiyTableModel.Tabs;
        },
        HideFormTab(tabName) {
            var self = this;
            self.DiyTableModel.Tabs.forEach((tab) => {
                if (tab.Name == tabName || tab.Id == tabName) {
                    tab.Display = false;
                }
            });
            self.FormTabs.forEach((tab) => {
                if (tab.Name == tabName || tab.Id == tabName) {
                    tab.Display = false;
                }
            });
        },
        ShowFormTab(tabName) {
            var self = this;
            self.DiyTableModel.Tabs.forEach((tab) => {
                if (tab.Name == tabName || tab.Id == tabName) {
                    tab.Display = true;
                }
            });
        },
        ClickFormTab(tabName) {
            var self = this;
            self.DiyTableModel.Tabs.forEach((tab) => {
                if (tab.Name == tabName || tab.Id == tabName) {
                    self.FieldActiveTab = tab.Id || tab.Name;
                }
            });
        },
        tabClickField(tab) {
            var self = this;
            // 修复：Element Plus el-tabs 的 tab 对象结构为 { props: { name, label }, index, ... }
            var tabKey = tab.props?.name || tab.name || tab.Id;
            this.FieldActiveTab = tabKey; //切换索引
            this.currentTabIndex = tab.index; //当前索引lisaisai

            // 标记该 tab 已渲染（懒加载）
            if (!self.renderedTabs.has(tabKey)) {
                self.renderedTabs.add(tabKey);
                // 🔥 新增：初始化该 tab 的渲染字段计数
                self.renderedFieldCounts[tabKey] = self.BATCH_SIZE_FIRST;
            }
        },
        GetDiyTableModel() {
            // var self = this
            // self.DiyCommon.Post(DiyApi.GetDiyTableModel, {
            //     Id: self.TableId,
            //     OsClient: self.OsClient
            // }, function (result) {
            //     if (self.DiyCommon.Result(result)) {
            //         self.DiyTableStrToJson(result.Data)
            //         self.DiyTableModel = result.Data
            //         self.$nextTick(function () {
            //             if (self.DiyTableModel.Tabs.length > 0 &&
            //                 (self.DiyCommon.IsNull(self.FieldActiveTab) || self.FieldActiveTab == '0' || self.FieldActiveTab == 'none' || self.FieldActiveTab == 'info')) {
            //                 self.FieldActiveTab = self.DiyTableModel.Tabs[0].Name
            //             }
            //         })
            //         self.$emit('CallbackSetDiyTableModel', self.DiyTableModel)
            //     }
            // })
        },
        SingleFieldRunSql() {
            var self = this;
        },
        /**
         * 字段数据转换 - 使用配置驱动的处理器系统
         * isPostSql：是否发起sql post请求
         */
        DiyFieldStrToJson(field, formData, isPostSql) {
            var self = this;

            // 1. 归一化 Multiple 配置：支持字符串或布尔，统一为布尔值
            try {
                if (field && field.Config) {
                    if (field.Config.ImgUpload && field.Config.ImgUpload.Multiple !== undefined) {
                        var m = field.Config.ImgUpload.Multiple;
                        field.Config.ImgUpload.Multiple = m === true || m === "true" || m === 1 || m === "1";
                    }
                    if (field.Config.FileUpload && field.Config.FileUpload.Multiple !== undefined) {
                        var fm = field.Config.FileUpload.Multiple;
                        field.Config.FileUpload.Multiple = fm === true || fm === "true" || fm === 1 || fm === "1";
                    }
                }
            } catch (e) {}

            // 2. 设置表单验证规则
            if (self.FormMode != "View" && field.NotEmpty 
                && self.FieldIsVisible(field) 
                && field.Component !== "AutoNumber" 
                && !self.GetFieldReadOnly(field)) {
                if (!self.FormRules[field.Name]) {
                    self.FormRules[field.Name] = [
                        {
                            required: true,
                            message: self.GetPleaseInputText(field) + "[" + field.Label + "]",
                            trigger: "change"
                        }
                    ];
                }
            } else if (self.FormMode == "View") {
                self.FormRules = {};
            }

            // 3. 使用配置驱动的处理器系统处理字段值
            var ctx = {
                formMode: self.FormMode,
                // 加载私有文件的回调（用于 ImgUpload）
                loadPrivateFiles: function(field, arr, configKey) {
                    self._loadPrivateFilesForField(field, arr, configKey);
                },
                // 获取 JSON 值的方法（兼容旧代码）
                getJsonValue: function(field, formData, isArray) {
                    return self.GetFormDataJsonValue(field, formData, isArray);
                }
            };

            // 检查是否有注册的处理器
            var handler = self.DiyCommon.FieldValueHandlers[field.Component];

            if (handler) {
                try {
                    // 使用处理器处理值
                    var value = self.DiyCommon.ProcessFieldValue(field, formData, ctx);

                    // 对于不需要值的组件（如 Divider、Button），跳过赋值
                    if (handler.valueType !== "none") {
                        self.FormDiyTableModel[field.Name] = value;
                    }

                    // 特殊处理：ImgUpload 多图需要加载私有文件
                    if (field.Component === "ImgUpload" && self.getMultipleFlag(field, "ImgUpload")) {
                        self._loadPrivateFilesForField(field, value, "ImgUpload");
                    }

                    return;
                } catch (error) {
                    console.warn("FieldValueHandler error for:", field.Name, error);
                    // 如果处理器出错，使用默认值
                    self.FormDiyTableModel[field.Name] = self.DiyCommon.GetFieldDefaultValue(field);
                    return;
                }
            }

            // 4. 如果没有注册处理器，使用默认处理（文本类）
            self.FormDiyTableModel[field.Name] = self.DiyCommon.IsNull(formData) || self.DiyCommon.IsNull(formData[field.Name])
                ? "" : formData[field.Name];
        },
        /**
         * 加载多图/多文件的私有文件 URL
         */
        _loadPrivateFilesForField(field, arr, configKey) {
            var self = this;
            if (!Array.isArray(arr)) return;

            var limitCfg = (field.Config && field.Config[configKey] && field.Config[configKey].Limit) || false;

            arr.forEach(function(fileObj) {
                try {
                    if (!fileObj) return;
                    var fileId = fileObj.Id || fileObj.id || fileObj.uid;
                    if (!fileId) return;
                    var filePath = fileObj.Path || fileObj.path || fileObj.Url || fileObj.url || fileObj.PathName;
                    var realKey = field.Name + "_" + fileId + "_RealPath";

                    // 如果已经有值则跳过
                    if (!self.DiyCommon.IsNull(self.FormDiyTableModel[realKey])) return;

                    if (!filePath) {
                        self.FormDiyTableModel[realKey] = "./static/img/img-load-fail.jpg";
                    } else if (limitCfg !== true) {
                        self.FormDiyTableModel[realKey] = self.DiyCommon.GetServerPath(filePath);
                    } else {
                        self.FormDiyTableModel[realKey] = "./static/img/loading.gif";
                        // 异步获取私有文件临时 URL
                        self.DiyCommon.Post(
                            "/api/HDFS/GetPrivateFileUrl",
                            {
                                FilePathName: filePath,
                                HDFS: self.SysConfig.HDFS || "Aliyun",
                                FormEngineKey: self.DiyTableModel.Name || self.TableId,
                                FormDataId: self.TableRowId,
                                FieldId: field.Id
                            },
                            function(privateResult) {
                                try {
                                    var finalPath = self.DiyCommon.Result(privateResult) ? privateResult.Data : "./static/img/img-load-fail.jpg";
                                    self.FormDiyTableModel[realKey] = finalPath;
                                } catch (e) {}
                            },
                            function(err) {
                                try {
                                    self.FormDiyTableModel[realKey] = "./static/img/img-load-fail.jpg";
                                } catch (e) {}
                            }
                        );
                    }
                } catch (e) {}
            });
        },
        GetFormDataJsonValue(field, formData, isArray) {
            var self = this;
            if (self.DiyCommon.IsNull(formData) || self.DiyCommon.IsNull(formData[field.Name])) {
                if (isArray) {
                    return [];
                }
                return {};
            } else {
                //2022-08-18修改判断
                // if (typeof (formData[field.Name]) === 'string') {
                if (typeof formData[field.Name] != "object") {
                    //2020-11-05 现在不再判断 SelectSaveField 了，因为存储的数据一般都是正确的
                    //2020-11-09 存在的数据不一定是正确的，因为Seelct有可能只存字段
                    try {
                        //2021-01-02发现问题，这里如果存的是一串数字 ，JSON.parse()不会报错
                        //2022-08-18发现问题，这里如果存的是一串数字型的字符串 ，JSON.parse()也不会报错
                        var result = JSON.parse(formData[field.Name]);
                        if (isArray) {
                            if (Array.isArray(result)) {
                                if (field.Component == "Checkbox") {
                                    //因为Checkbox里面只可能存string值，所以这里把垃圾数据删除掉
                                    var tempResult = [];
                                    result.forEach((element) => {
                                        if (typeof element == "string") {
                                            tempResult.push(element);
                                        }
                                    });
                                    return tempResult;
                                } else {
                                    return result;
                                }
                            }
                            return [];
                        } else {
                            //不是数组
                            //2021-01-02发现问题，这里如果存的是一串数字 ，JSON.parse()不会报错
                            if (typeof result == "object" && !Array.isArray(result)) {
                                return result;
                            } else if (typeof result == "number") {
                                if (
                                    field.Component == "Select" ||
                                    (field.Component == "SelectTree" && //2022-07-01
                                        (!self.DiyCommon.IsNull(field.Config.SelectSaveField) || !self.DiyCommon.IsNull(field.Config.SelectLabel)))
                                ) {
                                    var resultObj = {};
                                    //2022-05-20：显示字段同、存储字段都需要这个值
                                    if (!self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                                        resultObj[field.Config.SelectSaveField] = formData[field.Name];
                                    }
                                    if (!self.DiyCommon.IsNull(field.Config.SelectLabel)) {
                                        resultObj[field.Config.SelectLabel] = formData[field.Name];
                                    }
                                    // resultObj[!self.DiyCommon.IsNull(field.Config.SelectSaveField) ? field.Config.SelectSaveField : field.Config.SelectLabel] = formData[field.Name];
                                    return resultObj;
                                } else {
                                    if (isArray) {
                                        return [];
                                    } else {
                                        return {};
                                    }
                                }
                            }
                            return {};
                        }
                    } catch (error) {
                        //如果JSON.parse报错，那么说明这个字段存的并不是json
                        //2020-11-09 存在的数据不一定是正确的，因为Select有可能只存字段
                        if (
                            field.Component == "Select" ||
                            (field.Component == "SelectTree" && //2022-07-01
                                !isArray &&
                                (!self.DiyCommon.IsNull(field.Config.SelectSaveField) || !self.DiyCommon.IsNull(field.Config.SelectLabel)))
                        ) {
                            var resultObj = {};
                            //2022-05-20：显示字段同、存储字段都需要这个值
                            if (!self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                                resultObj[field.Config.SelectSaveField] = formData[field.Name];
                            }
                            if (!self.DiyCommon.IsNull(field.Config.SelectLabel)) {
                                resultObj[field.Config.SelectLabel] = formData[field.Name];
                            }
                            // resultObj[!self.DiyCommon.IsNull(field.Config.SelectSaveField) ? field.Config.SelectSaveField : field.Config.SelectLabel] = formData[field.Name];
                            return resultObj;
                        } else {
                            if (isArray) {
                                return [];
                            } else {
                                return {};
                            }
                        }
                    }
                    //这里转换有可能会出错，比如修改了控件类型，所以要加try
                    // try {
                    //     //注意：2020-10-30 如果指定了SelectSaveField，这里需要返回{}
                    //     //注意：上面逻辑可能是错的，这里要返回{}还是[]，以isArray为准
                    //     if (!self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                    //         if(isArray){
                    //             var resultObj = {};
                    //             resultObj[field.Config.SelectSaveField] = formData[field.Name];
                    //             //类似这样的注释 ，后期需要处理，修改了字段控件类型，需要保留以前存的值
                    //             // return [resultObj];
                    //             return [];
                    //         }else{
                    //             if(typeof(resultObj) != 'object'){
                    //                 return {};
                    //             }
                    //             return resultObj;
                    //         }
                    //     }else{
                    //         var result = JSON.parse(formData[field.Name])
                    //         if(isArray){
                    //             if(Array.isArray(result)){
                    //                 return result;
                    //             }
                    //             // return [result];
                    //             return [];
                    //         }else{
                    //             if(typeof(result) != 'object'){
                    //                 return {};
                    //             }
                    //             return result;
                    //         }
                    //     }
                    // } catch (error) {
                    //     var result = formData[field.Name]
                    //     if(isArray){
                    //         if(Array.isArray(result)){
                    //             return result;
                    //         }
                    //         // return [result];
                    //         return [];
                    //     }else{
                    //         if(typeof(result) != 'object'){
                    //             return {};
                    //         }
                    //         return result;
                    //     }
                    // }
                } else {
                    var result = formData[field.Name];
                    if (isArray) {
                        if (Array.isArray(result)) {
                            return result;
                        }
                        // return [result];
                        return [];
                    } else {
                        if (typeof result != "object" || Array.isArray(result)) {
                            return {};
                        }
                        return result;
                    }
                }
            }
        },
                // 外部可能需要更新内部的字段对象
                                ImgUploadRemove(file, fileList, field) {
            var self = this;
            //如果是单文件，需要修改值
            if (field.Config.ImgUpload.Multiple !== true) {
                // self.FormDiyTableModel[field.Name] = '';
                self.FormDiyTableModel[field.Name] = "";
            }
            if (Array.isArray(self.FormDiyTableModel[field.Name])) {
                self.FormDiyTableModel[field.Name].forEach((element, index) => {
                    if (element.Id == file.response.Data.Id) {
                        self.FormDiyTableModel[field.Name].splice(index, 1);
                    }
                });
            }
        },
        GetFieldReadOnly(field) {
            var self = this;
            //如果按钮设置了预览可点击
            //并且按钮Readonly属性不为true，
            //并且ReadonlyFields不包含此字段
            //则返回false(不禁用)
            if (field.Component == "Button" && field.Config.Button && field.Config.Button.PreviewCanClick === true && !field.Readonly && !(self.ReadonlyFields.indexOf(field.Name) > -1)) {
                return false;
            }

            if (self.FormMode == "View") {
                return true;
            }
            if (self.ReadonlyFields.indexOf(field.Name) > -1) {
                return true;
            }
            if (self.NotSaveField) {
                for (let index = 0; index < self.NotSaveField.length; index++) {
                    const element = self.NotSaveField[index];
                    if (element.toLowerCase() == field.Name.toLowerCase()) {
                        return true;
                    }
                }
            }
            // return field.Readonly ? true : false;
            return field.Readonly ? true : false;
        },
    }
};
