import _u from "underscore";
import DynamicComponentCache from "@/utils/dynamicComponentCache.js";

export default {
    methods: {
        GetFieldIsReadOnly(field) {
            var self = this;
            if (self.TableChildField.Readonly) {
                return true;
            }
            if (self.NotSaveField && self.TableChildField.Name) {
                for (let index = 0; index < self.NotSaveField.length; index++) {
                    const element = self.NotSaveField[index];
                    if (element.toLowerCase() == self.TableChildField.Name.toLowerCase()) {
                        return true;
                    }
                }
            } else if (self.NotSaveField) {
                // self.DiyCommon.IsNull(field.Readonly) ? false : field.Readonly
                for (let index = 0; index < self.NotSaveField.length; index++) {
                    const element = self.NotSaveField[index];
                    if (element.toLowerCase() == field.Name.toLowerCase()) {
                        return true;
                    }
                }
            }
            return null;
            // TableChildField.Readonly  == true ? true : null
        },
        ColIsDisplay(fieldName) {
            var self = this;
            if (self.NotShowFields.indexOf(fieldName) > -1
                || self.NotShowFields.findIndex(item => item.Name == fieldName || item.Id == fieldName) > -1) {
                return false;
            }
            // if (self.TableDiyFieldIds && self.TableDiyFieldIds.find((item) => item == fieldName)) {
            //     return false;
            // }
            if (self.SysMenuModel.SelectFields && self.SysMenuModel.SelectFields.find((item) => item.Name == fieldName)) {
                return false;
            }
            // if ((!self.TableDiyFieldIds || self.TableDiyFieldIds.length == 0) && self.DiyFieldList.find((item) => item.Name == fieldName)) {
            //     return true;
            // }
            // if (!self.TableDiyFieldIds || self.TableDiyFieldIds.length == 0) {
            //     return true;
            // }
            return true;
        },
        ColIsFixed(fieldId) {
            var self = this;
            if (self.FixedFields.indexOf(fieldId) > -1) {
                return true;
            }
            return false;
        },
        GetSearchItemCheckLabel(fieldData, field) {
            var self = this;
            if (typeof fieldData == "string") {
                return fieldData;
            } else if (typeof fieldData == "object") {
                if (!self.DiyCommon.IsNull(field.Config.SelectLabel)) {
                    return fieldData[field.Config.SelectLabel];
                } else {
                }
            }
        },
        GetSearchItemCheckKey(fieldData, field) {
            var self = this;
            if (typeof fieldData == "string") {
                return fieldData;
            } else if (typeof fieldData == "object") {
                if (!self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                    return fieldData[field.Config.SelectSaveField];
                } else if (!self.DiyCommon.IsNull(field.Config.SelectLabel)) {
                    return fieldData[field.Config.SelectLabel];
                }
            }
        },
        // OpenFormIsModal(){
        //     var self = this;
        //     if (self.DiyCommon.IsNull(self.TableChildTableId)) {
        //         return true;
        //     }
        //     return false;
        // },
        StatisticsFieldsMethod(param) {
            var self = this;
            const { columns, data } = param;
            const sums = [];
            if (self.StatisticsFields != null) {
                columns.forEach((column, index) => {
                    if (!self.DiyCommon.IsNull(self.StatisticsFields[column.property])) {
                        sums[index] = self.StatisticsFields[column.property];
                    }
                });
            }
            return sums;
        },
        /**
         * 补充加载SearchFieldIds中引用但DiyFieldList中缺失的表字段
         * 当SearchFieldIds引用了JoinTable或其他表的字段，而GetDiyFieldByDiyTables未返回时，
         * 此方法会额外请求缺失表的字段并追加到DiyFieldList中
         */
        async EnsureSearchFieldsLoaded() {
            var self = this;
            if (!self.SearchFieldIds || self.SearchFieldIds.length === 0) return;
            if (!self.DiyFieldList) return;

            // 收集DiyFieldList中已有的字段Id集合
            var loadedFieldIds = new Set(self.DiyFieldList.map(function (f) { return f.Id; }));

            // 收集SearchFieldIds中引用但DiyFieldList中缺失的TableId
            var missingTableIds = [];
            var missingTableIdSet = new Set();
            self.SearchFieldIds.forEach(function (item) {
                if (!item || typeof item === 'string') return;
                var fieldId = item.Id;
                var tableId = item.TableId;
                if (fieldId && !loadedFieldIds.has(fieldId) && tableId && !missingTableIdSet.has(tableId)) {
                    missingTableIdSet.add(tableId);
                    missingTableIds.push(tableId);
                }
            });

            if (missingTableIds.length === 0) return;

            // 请求缺失表的字段
            try {
                var result = await self.DiyCommon.PostAsync(self.DiyApi.GetDiyFieldByDiyTables, {
                    TableIds: missingTableIds
                });
                if (result && self.DiyCommon.Result(result, false) && Array.isArray(result.Data)) {
                    result.Data.forEach(function (field) {
                        // 避免重复添加
                        if (!loadedFieldIds.has(field.Id)) {
                            self.DiyCommon.DiyFieldConfigStrToJson(field);
                            self.DiyCommon.Base64DecodeDiyField(field);
                            self.DiyCommon.EnsureFieldProperties(field);
                            self.DiyFieldList.push(field);
                            loadedFieldIds.add(field.Id);
                        }
                    });
                    // 触发数据源加载
                    self.DiyCommon.SetFieldsData(result.Data);
                }
            } catch (e) {
                console.warn('[DiyTable] 补充加载搜索字段失败:', e);
            }
        },
        GetDiyField() {
            var self = this;
            var tableIds = [self.TableId];
            if (!self.DiyCommon.IsNull(self.SysMenuModel.JoinTables)) {
                self.SysMenuModel.JoinTables.forEach((element) => {
                    tableIds.push(element.Id);
                });
            }
            self.DiyCommon.Post(
                self.DiyApi.GetDiyFieldByDiyTables,
                {
                    TableIds: tableIds
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.GetDiyFieldAfter(result);
                    }
                }
            );
        },
        GetDiyFieldAfter(result) {
            var self = this;
            if(result.Code != 1){
                self.DiyCommon.Tips("获取表字段列表失败：" + result.Msg, false);
                return;
            }
            //这里需要DiyFieldStrToJson转换，否则取不到配置数据

            result.Data.forEach((field) => {
                self.DiyCommon.DiyFieldConfigStrToJson(field);
                self.DiyCommon.Base64DecodeDiyField(field);
                // 使用公共方法初始化字段属性
                self.DiyCommon.EnsureFieldProperties(field);
            });
            self.DiyCommon.SetFieldsData(result.Data);

            result.Data.forEach((field) => {
                // self.DiyFieldStrToJson(field, formData, isPostSql);

                //放到外面执行了
                // self.DiyCommon.DiyFieldConfigStrToJson(field);
                //放到外面执行了
                // self.DiyCommon.Base64DecodeDiyField(field);

                //处理别名
                if (self.SysMenuModel.SelectFields && Array.isArray(self.SysMenuModel.SelectFields)) {
                    var search2 = self.SysMenuModel.SelectFields.filter(item => item.Id === field.Id);
                    if (search2.length > 0 && !self.DiyCommon.IsNull(search2[0].AsName)) {
                        field["AsName"] = search2[0].AsName;
                    }
                }
                // 注意：这里面是有异步赋值的
                // 放到外面执行了
                // self.DiyCommon.SetFieldData(field);

                // if (Array.isArray(field.Data)) {
                //     field.Data.forEach(fieldData => {
                //         if (typeof(fieldData) == 'object') {
                //             fieldData._Checked = false;
                //         }
                //     });
                // }
                // field._SearchChecked = [];
                if (!self.DiyCommon.IsNull(field.Config.DevComponentName) && !self.DiyCommon.IsNull(field.Config.DevComponentPath)) {
                    //渲染定制组件
                    try {
                        //2022-06-22新增
                        field.Config.DevComponentPath = field.Config.DevComponentPath.replace("/views", "");

                        // 使用组件缓存池，避免重复创建导致内存泄漏
                        var componentName = field.Config.DevComponentName;
                        var componentPath = field.Config.DevComponentPath;
                        var component = DynamicComponentCache.getOrCreate(componentName, componentPath);

                        // Vue 3: 使用全局 app 实例注册组件
                        const app = window.__VUE_APP__;
                        if (app && !app._context.components[componentName]) {
                            app.component(componentName, component);
                        }
                        if (self.DiyCommon.IsNull(self.DevComponents[componentName])) {
                            self.DevComponents[componentName] = {
                                Name: "",
                                Path: ""
                            };
                        }
                        self.DevComponents[componentName].Name = componentName;
                        self.DevComponents[componentName].Path = componentPath;
                        // console.log('渲染定制组件成功');
                    } catch (error) {
                        console.log("渲染定制组件出现错误：" + error.message);
                    }
                }
            });

            self.DiyFieldList = result.Data;
            // self.$emit("CallbackGetDiyField", self.DiyFieldList)
        },
        GetDiyTableModel() {
            var self = this;
            var param = {
                Id: self.TableId
            };
            self.DiyCommon.Post(self.DiyApi.GetDiyTableModel, param, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.GetDiyTableModelAfter(result);

                    // self.$nextTick(function () {
                    //     if (self.DiyTableModel.Tabs.length > 0 &&
                    //         (self.DiyCommon.IsNull(self.FieldActiveTab) || self.FieldActiveTab == '0' || self.FieldActiveTab == 'none' || self.FieldActiveTab == 'info')) {
                    //         self.FieldActiveTab = self.DiyTableModel.Tabs[0].Name;
                    //     }
                    // });

                    // self.$emit("CallbackSetDiyTableModel", self.DiyTableModel)
                }
            });
        },
        GetDiyTableModelAfter(result) {
            var self = this;
            self.DiyCommon.DiyTableStrToJson(result.Data);
            self.DiyCommon.Base64DecodeDiyTable(result.Data);
            self.CurrentDiyTableModel = result.Data;
        },
        GetColClassName(field) {
            var self = this;
            var sortState = self.getColSortState ? self.getColSortState(field) : '';
            if (sortState) {
                return "column-" + field.Name + " " + (sortState.toLocaleLowerCase() == "asc" ? "ascending" : "descending");
            }
            return "column-" + field.Name;
        },
        _GetTableFieldKey(field) {
            return this.DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName;
        },
        _GetTableFieldRawValue(scope, field) {
            var row = scope && scope.row ? scope.row : {};
            return row[this._GetTableFieldKey(field)];
        },
        _EnsureTableFieldConfig(field) {
            var self = this;
            if (self.DiyCommon.IsNull(field.Config)) {
                field.Config = {};
            }
            if (typeof field.Config === "string") {
                try {
                    field.Config = JSON.parse(field.Config);
                } catch (error) {
                    field.Config = {};
                }
            }
            return field.Config || {};
        },
        _IsBlankDisplayValue(value) {
            return value === undefined || value === null || value === "";
        },
        _ParseMaybeJsonForDisplay(value) {
            if (typeof value !== "string") return value;
            var trimmed = value.trim();
            if (!trimmed) return value;
            var firstChar = trimmed.charAt(0);
            var lastChar = trimmed.charAt(trimmed.length - 1);
            if ((firstChar === "[" && lastChar === "]") || (firstChar === "{" && lastChar === "}") || (firstChar === '"' && lastChar === '"')) {
                try {
                    return JSON.parse(trimmed);
                } catch (error) {}
            }
            return value;
        },
        _DisplayValueToString(value) {
            var self = this;
            if (self._IsBlankDisplayValue(value)) return "";
            if (Array.isArray(value)) {
                return value.map(function (item) {
                    return self._DisplayValueToString(item);
                }).filter(function (item) {
                    return !self._IsBlankDisplayValue(item);
                }).join(",");
            }
            if (typeof value === "object") {
                var fallback = self._GetObjectDisplayValue(value, {}, ["Label", "label", "Name", "name", "Text", "text", "Value", "value", "Key", "key", "Id", "id"]);
                if (!self._IsBlankDisplayValue(fallback)) return String(fallback);
                try {
                    return JSON.stringify(value);
                } catch (error) {
                    return "";
                }
            }
            return String(value);
        },
        _GetUniqueDisplayKeys(keys) {
            var result = [];
            keys.forEach(function (key) {
                if (key && result.indexOf(key) === -1) {
                    result.push(key);
                }
            });
            return result;
        },
        _GetObjectDisplayValue(item, field, keys) {
            var self = this;
            if (!item || typeof item !== "object" || Array.isArray(item)) return null;
            var cfg = field && field.Config ? field.Config : {};
            var keyList = self._GetUniqueDisplayKeys(keys || [cfg.SelectLabel, cfg.SelectSaveField, "Value", "value", "Label", "label", "Name", "name", "Text", "text", "Key", "key", "Id", "id"]);
            for (var keyIndex = 0; keyIndex < keyList.length; keyIndex++) {
                var key = keyList[keyIndex];
                if (!self._IsBlankDisplayValue(item[key])) {
                    return item[key];
                }
            }
            return null;
        },
        _GetOptionValueCandidates(item, field) {
            var self = this;
            if (self._IsBlankDisplayValue(item)) return [];
            if (typeof item !== "object" || Array.isArray(item)) return [item];
            var cfg = field && field.Config ? field.Config : {};
            var keys = self._GetUniqueDisplayKeys([cfg.SelectSaveField, "Key", "key", "Value", "value", "Id", "id", cfg.SelectLabel, "Name", "name", "Label", "label", "Text", "text"]);
            var result = [];
            keys.forEach(function (key) {
                if (!self._IsBlankDisplayValue(item[key]) && result.indexOf(item[key]) === -1) {
                    result.push(item[key]);
                }
            });
            return result;
        },
        _GetOptionLabelForDisplay(item, field) {
            var self = this;
            if (self._IsBlankDisplayValue(item)) return "";
            if (typeof item !== "object" || Array.isArray(item)) return item;
            var cfg = field && field.Config ? field.Config : {};
            var label = self._GetObjectDisplayValue(item, field, [cfg.SelectLabel, "Value", "value", "Label", "label", "Name", "name", "Text", "text", cfg.SelectSaveField, "Key", "key", "Id", "id"]);
            return self._IsBlankDisplayValue(label) ? "" : label;
        },
        _DisplayValueEquals(leftValue, rightValue) {
            if (this._IsBlankDisplayValue(leftValue) || this._IsBlankDisplayValue(rightValue)) return false;
            return leftValue == rightValue || String(leftValue) === String(rightValue);
        },
        _FindOptionForDisplay(value, field) {
            var self = this;
            var options = Array.isArray(field.Data) ? field.Data : [];
            if (options.length === 0) return null;
            var valueCandidates = self._GetOptionValueCandidates(value, field);
            for (var optionIndex = 0; optionIndex < options.length; optionIndex++) {
                var option = options[optionIndex];
                var optionCandidates = self._GetOptionValueCandidates(option, field);
                for (var valueIndex = 0; valueIndex < valueCandidates.length; valueIndex++) {
                    for (var candidateIndex = 0; candidateIndex < optionCandidates.length; candidateIndex++) {
                        if (self._DisplayValueEquals(valueCandidates[valueIndex], optionCandidates[candidateIndex])) {
                            return option;
                        }
                    }
                }
            }
            return null;
        },
        _NormalizeMultiDisplayValue(value, field) {
            var self = this;
            var parsedValue = self._ParseMaybeJsonForDisplay(value);
            if (Array.isArray(parsedValue)) return parsedValue;
            if ((field.Component === "MultipleSelect" || field.Component === "Checkbox" || field.Component === "Transfer") && typeof parsedValue === "string" && parsedValue.indexOf(",") > -1) {
                return parsedValue.split(",").map(function (item) {
                    return item.trim();
                }).filter(function (item) {
                    return !self._IsBlankDisplayValue(item);
                });
            }
            return self._IsBlankDisplayValue(parsedValue) ? [] : [parsedValue];
        },
        _IsOptionDisplayField(field) {
            return ["Select", "MultipleSelect", "Radio", "Checkbox", "Autocomplete"].indexOf(field.Component) > -1;
        },
        _IsTreeOptionDisplayField(field) {
            return ["Cascader", "SelectTree", "Department"].indexOf(field.Component) > -1;
        },
        _FormatOptionDisplayValue(value, field, isArrayItem) {
            var self = this;
            var cfg = field.Config || {};
            var parsedValue = self._ParseMaybeJsonForDisplay(value);
            if (self._IsBlankDisplayValue(parsedValue)) return "";
            if (!isArrayItem && (Array.isArray(parsedValue) || field.Component === "MultipleSelect" || field.Component === "Checkbox")) {
                return self._NormalizeMultiDisplayValue(parsedValue, field).map(function (item) {
                    return self._FormatOptionDisplayValue(item, field, true);
                }).filter(function (item) {
                    return !self._IsBlankDisplayValue(item);
                }).join(",");
            }
            if (typeof parsedValue === "object") {
                var objectLabel = self._GetObjectDisplayValue(parsedValue, field, [cfg.SelectLabel, "Value", "value", "Label", "label", "Name", "name", "Text", "text"]);
                if (!self._IsBlankDisplayValue(objectLabel)) return self._DisplayValueToString(objectLabel);
                var matchedByObject = self._FindOptionForDisplay(parsedValue, field);
                if (matchedByObject) return self._DisplayValueToString(self._GetOptionLabelForDisplay(matchedByObject, field));
                return self._DisplayValueToString(self._GetObjectDisplayValue(parsedValue, field, [cfg.SelectSaveField, "Key", "key", "Value", "value", "Id", "id", "Name", "name"]) || parsedValue);
            }
            var matchedOption = self._FindOptionForDisplay(parsedValue, field);
            if (matchedOption) return self._DisplayValueToString(self._GetOptionLabelForDisplay(matchedOption, field));
            return self._DisplayValueToString(parsedValue);
        },
        _GetTreeChildrenForDisplay(node, field) {
            var cfg = field.Config || {};
            var treeCfg = field.Component === "Cascader" ? (cfg.Cascader || {}) : (field.Component === "Department" ? (cfg.Department || {}) : (cfg.SelectTree || {}));
            var keys = this._GetUniqueDisplayKeys([treeCfg.Children, "_Child", "children", "Children"]);
            for (var keyIndex = 0; keyIndex < keys.length; keyIndex++) {
                if (Array.isArray(node[keys[keyIndex]])) return node[keys[keyIndex]];
            }
            return [];
        },
        _FindTreeOptionForDisplay(value, field) {
            var self = this;
            var treeData = Array.isArray(field.Data) ? field.Data : [];
            var valueCandidates = self._GetOptionValueCandidates(value, field);
            var visit = function (nodes) {
                for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
                    var node = nodes[nodeIndex];
                    var nodeCandidates = self._GetOptionValueCandidates(node, field);
                    for (var valueIndex = 0; valueIndex < valueCandidates.length; valueIndex++) {
                        for (var candidateIndex = 0; candidateIndex < nodeCandidates.length; candidateIndex++) {
                            if (self._DisplayValueEquals(valueCandidates[valueIndex], nodeCandidates[candidateIndex])) {
                                return node;
                            }
                        }
                    }
                    var matchedChild = visit(self._GetTreeChildrenForDisplay(node, field));
                    if (matchedChild) return matchedChild;
                }
                return null;
            };
            return visit(treeData);
        },
        _FormatSingleTreeDisplayValue(value, field) {
            var self = this;
            if (self._IsBlankDisplayValue(value)) return "";
            if (typeof value === "object" && !Array.isArray(value)) {
                var directLabel = self._GetOptionLabelForDisplay(value, field);
                if (!self._IsBlankDisplayValue(directLabel)) return self._DisplayValueToString(directLabel);
            }
            var matchedNode = self._FindTreeOptionForDisplay(value, field);
            if (matchedNode) return self._DisplayValueToString(self._GetOptionLabelForDisplay(matchedNode, field));
            return self._DisplayValueToString(value);
        },
        _FormatTreePathDisplayValue(pathValue, field) {
            var self = this;
            if (Array.isArray(pathValue)) {
                if (field.Component === "Department") {
                    return self._FormatSingleTreeDisplayValue(pathValue[pathValue.length - 1], field);
                }
                return pathValue.map(function (item) {
                    return self._FormatSingleTreeDisplayValue(item, field);
                }).filter(function (item) {
                    return !self._IsBlankDisplayValue(item);
                }).join("/");
            }
            return self._FormatSingleTreeDisplayValue(pathValue, field);
        },
        _FormatTreeOptionDisplayValue(value, field) {
            var self = this;
            var cfg = field.Config || {};
            var treeCfg = field.Component === "Cascader" ? (cfg.Cascader || {}) : (field.Component === "Department" ? (cfg.Department || {}) : (cfg.SelectTree || {}));
            var parsedValue = self._ParseMaybeJsonForDisplay(value);
            if (self._IsBlankDisplayValue(parsedValue)) return "";
            if (Array.isArray(parsedValue)) {
                if (parsedValue.length === 0) return "";
                var hasNestedPath = parsedValue.some(function (item) { return Array.isArray(item); });
                if (hasNestedPath) {
                    return parsedValue.map(function (pathValue) {
                        return self._FormatTreePathDisplayValue(pathValue, field);
                    }).filter(function (item) {
                        return !self._IsBlankDisplayValue(item);
                    }).join(",");
                }
                if ((field.Component === "Cascader" || field.Component === "Department") && treeCfg.EmitPath !== false) {
                    return self._FormatTreePathDisplayValue(parsedValue, field);
                }
                return parsedValue.map(function (item) {
                    return self._FormatSingleTreeDisplayValue(item, field);
                }).filter(function (item) {
                    return !self._IsBlankDisplayValue(item);
                }).join(",");
            }
            return self._FormatSingleTreeDisplayValue(parsedValue, field);
        },
        _FormatTransferDisplayValue(value, field) {
            var self = this;
            var cfg = field.Config || {};
            var transferConfig = cfg.Transfer || {};
            var options = Array.isArray(transferConfig.Options) ? transferConfig.Options : [];
            var values = self._NormalizeMultiDisplayValue(value, { Component: "Transfer" });
            return values.map(function (item) {
                var matchedOption = options.find(function (option, optionIndex) {
                    var optionKey = typeof option === "string" ? option : (option.Key || option.key || option.Value || option.value || String(optionIndex));
                    return self._DisplayValueEquals(item, optionKey);
                });
                if (!matchedOption) return self._DisplayValueToString(item);
                if (typeof matchedOption === "string") return matchedOption;
                return self._DisplayValueToString(matchedOption.Label || matchedOption.label || matchedOption.Value || matchedOption.value || matchedOption.Name || matchedOption.name || item);
            }).filter(function (item) {
                return !self._IsBlankDisplayValue(item);
            }).join(",");
        },
        GetColValue(scope, field) {
            var self = this;
            var fuheWZ = "";
            var result = "";
            var rawValue = self._GetTableFieldRawValue(scope, field);
            var displayValue = self.DiyCommon.IsNull(rawValue) ? "" : rawValue;
            //如果是地址控件
            if (field.Component == "Address" && displayValue) {
                try {
                    var addressValue = [];
                    if (typeof displayValue == "string") {
                        addressValue = JSON.parse(displayValue);
                    }
                    if (addressValue.length > 0) {
                        return addressValue.join("/");
                        // if(self.CodeToText){
                        //     return self.CodeToText[addressValue[0]] + '/'
                        //             + self.CodeToText[addressValue[1]] + '/'
                        //             + self.CodeToText[addressValue[2]];
                        // }else{
                        //     return displayValue;
                        // }
                    }
                    return "";
                } catch (error) {}
            }

            var cfg = self._EnsureTableFieldConfig(field);
            if (!self.DiyCommon.IsNull(cfg.TextApend)) {
                fuheWZ = " " + cfg.TextApend;
            }

            var formattedValue = null;
            if (field.Component === "Transfer") {
                formattedValue = self._FormatTransferDisplayValue(displayValue, field);
            } else if (self._IsTreeOptionDisplayField(field)) {
                formattedValue = self._FormatTreeOptionDisplayValue(displayValue, field);
            } else if (self._IsOptionDisplayField(field) || !self.DiyCommon.IsNull(cfg.SelectLabel) || !self.DiyCommon.IsNull(cfg.SelectSaveField)) {
                formattedValue = self._FormatOptionDisplayValue(displayValue, field);
            }
            if (formattedValue !== null) {
                result = self._DisplayValueToString(formattedValue);
                if (result == "[]") return "";
                return self._IsBlankDisplayValue(result) ? "" : result + fuheWZ;
            }

            //如果是富文本，需要去掉html标签
            if (field.Component == "RichText") {
                displayValue = self.DiyCommon.RemoveHtml(displayValue);
            }else if (field.Component == "ImgUpload" || field.Component == 'FileUpload') {//如果是图片或文件控件
                if(typeof displayValue === "string" && displayValue.startsWith("{")){
                    try {
                        var tempObj = JSON.parse(displayValue);
                        displayValue = tempObj.Name;
                    } catch (error) {}
                }
            }

            result = self._DisplayValueToString(displayValue); //self.DiyCommon.IsNull(scope.row[field.Name]) ? '' : scope.row[field.Name];
            // return result + fuheWZ;
            result = result + fuheWZ;
            if (result == "[]") {
                return "";
            }
            return result;
        },
        GetSysMenuModel() {
            var self = this;
            self.DiyCommon.Post(
                self.DiyApi.GetSysMenuModel,
                {
                    Id: self.SysMenuId
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.GetSysMenuModelAfter(result);
                    }
                }
            );
        },
        async GetSysMenuModelAfter(result) {
            var self = this;
            self.DiyCommon.ForConvertSysMenu(result.Data);
            //2021-09-02 提前渲染 页面更多按钮(PageBtns)、页面多Tab（PageTabs）、批量选择更多按钮BatchSelectMoreBtns、更多导出按钮(ExportMoreBtns)
            self.HandlerBtns(result.Data.PageBtns);
            //注意：表单按钮，一定要先打开表单后再进行判断IsVisible
            // self.HandlerBtns(result.Data.FormBtns);
            result.Data.PageTabs = result.Data.PageTabs.sort((a, b) => a.Sort - b.Sort);
            self.HandlerBtns(result.Data.PageTabs);
            self.HandlerBtns(result.Data.BatchSelectMoreBtns);
            self.TableEnableBatch = self.HasBatchSelectMoreBtns(result.Data) || self.EnableMultipleSelect === true;
            self.HandlerBtns(result.Data.ExportMoreBtns);
            // result.Data.PageBtns.forEach(element => {
            // });

            //-------GetPageTabs()提前预生成
            if (!self.DiyCommon.IsNull(result.Data) && !self.DiyCommon.IsNull(result.Data.PageTabs) && result.Data.PageTabs.length > 0) {
                //url带上tab参数，  2022-06-01
                var queryTab = self.$route.query.Tab;
                if (self.IsTableChild()) {
                    queryTab = "";
                }
                if (!self.DiyCommon.IsNull(queryTab)) {
                    await result.Data.PageTabs.forEach(async (element) => {
                        if (element.Name == queryTab) {
                            self.TableRowListActiveTab = element.Id;
                            self.CurrentTableRowListActiveTab = element;
                            //执行V8
                            //注意：这里要设置搜索条件.V8.SetV8SearchModel([{FieldName : value}, {FieldName2 : value}]);
                            if (!self.DiyCommon.IsNull(element.V8Code)) {
                                await self.RunPageTabV8Code(element.V8Code);
                            }
                        }
                    });
                }
                //TableRowListActiveTab 虽然给的默认是空'',但实际上是'0'，为啥 ？
                if (self.DiyCommon.IsNull(self.TableRowListActiveTab) || self.TableRowListActiveTab == "none" || self.TableRowListActiveTab == "0") {
                  // zhy只针对移动端tabs进行重新筛选出IsVisibale为true的tab,防止设置高亮值TableRowListActiveTab错误
                    if (self.diyStore.IsPhoneView) {
                        var activetabs = result.Data.PageTabs.filter(item => {
                            return item.IsVisible == true
                        })
                        self.TableRowListActiveTab = activetabs[0].Id;
                    } else {
                      self.TableRowListActiveTab = result.Data.PageTabs[0].Id;
                    }
                    var tabModel = result.Data.PageTabs[0];
                    self.CurrentTableRowListActiveTab = tabModel;
                    //执行V8
                    //注意：这里要设置搜索条件.V8.SetV8SearchModel([{FieldName : value}, {FieldName2 : value}]);
                    if (!self.DiyCommon.IsNull(tabModel.V8Code)) {
                        await self.RunPageTabV8Code(tabModel.V8Code);
                    }
                    //2020-10-22新增，设置选中第一个Tab，查询一次数据
                    //2022-05-14 这里不再查询数据，全部After处理好了再查询数据
                    // self.GetDiyTableRow({_PageIndex : 1});
                }
                // return self.SysMenuModel.PageTabs;
            } else {
                self.TableRowListActiveTab = "none";
                result.Data.PageTabs = [
                    {
                        Id: "none",
                        Name: ""
                    }
                ];
            }
            //-----
            self.SysMenuModel = result.Data;
            if(self.diyStore.IsPhoneView || self.SysMenuModel.ComponentName == '搜索+卡片'){
                self.TableDisplayMode = 'Card'
            }else{
                self.TableDisplayMode = 'Table'
            }
            try {
                var cacheDiyTableRowPageSize = self.$localStorageManager ? self.$localStorageManager.getTableConfig(self.TableId) : localStorage.getItem("Microi.DiyTableRowPageSize_" + self.TableId);
                self.DiyTableRowPageSize = self.NormalizeTablePageSize(cacheDiyTableRowPageSize, {
                    menuDefault: self.SysMenuModel.DefaultPageSize
                });
                // 🔥 手机端 + 卡片模式强制每页 15 条（PC端不限制）
                if (self.diyStore && self.diyStore.IsPhoneView
                    && self.TableDisplayMode === 'Card' && self.DiyTableRowPageSize > 15) {
                    self.DiyTableRowPageSize = 15;
                }
            } catch (error) {

            }

            //--------处理模块配置
            // Bug优化：直接使用 SysMenuModel 的属性，避免不必要的数据复制和内存占用
            // 注意：保留这些赋值是为了向后兼容，但建议后续直接使用 self.SysMenuModel.xxx
            self.TableDiyFieldIds = self.SysMenuModel.TableDiyFieldIds || [];
            self.SearchFieldIds = self.SysMenuModel.SearchFieldIds || [];
            self.SortFieldIds = self.SysMenuModel.SortFieldIds || [];
            self.NotShowFields = self.SysMenuModel.NotShowFields || [];
            self.MobileListFields = self.SysMenuModel.MobileListFields || [];
            self.FixedFields = self.SysMenuModel.FixedFields || [];
            //------------------------
            //2022-05-14 这里不再查询数据，全部After处理好了再查询数据
            if (self.DiyCommon.IsNull(self.SysMenuModel.PageTabs) || self.SysMenuModel.PageTabs.length == 0) {
                // self.GetDiyTableRow({_PageIndex : 1});
            }
        },
        // IsSortField(fieldId) {
        //     var self = this;
        //     if (self.SortFieldIds && Array.isArray(self.SortFieldIds)) {
        //         return self.SortFieldIds.includes(fieldId)
        //                 || self.SortFieldIds.find(item => item.Id === fieldId)
        //                 || self.SortFieldIds.find(item => item.Name === fieldId)
        //                 ;
        //     }
        //     return false;
        // },

        // 其实这里应该改成Axios去同时请求多个接口，然后再渲染，这样性能更高！
        GetShowDiyFieldList: function () {
            var self = this;
            // TableDiyFieldIds 是指模块引擎的查询列【被SysMenuModel.SelectFields替代】
            if (self.SysMenuModel.SelectFields != null) {
                if (self.SysMenuModel.SelectFields.length > 0 && self.DiyFieldList.length > 0) {
                    var tempArr = [];
                    var index = 0;
                    self.SysMenuModel.SelectFields.forEach((element) => {
                        //这里的element就是FieldId
                        // var search1 = _u.where(self.DiyFieldList, {
                        //   Id: element
                        // });
                        var search1 = self.DiyFieldList.find((item) => item.Id === element || item.Id === element.Id || (!self.DiyCommon.IsNull(element.Name) && item.Name === element.Name)); // || item.Name === element
                        if (!search1) {
                            search1 = self.DiyCommon.SysDefaultField.find((item) => item.Id === element || item.Id === element.Id || (!self.DiyCommon.IsNull(element.Name) && item.Name === element.Name));
                        }
                        //注意：!(self.FixedNotShowField.indexOf(element.Component) > -1)  这条判断没用，因为element就是Id，取不到element.Component
                        //2021-10-26 新增排序 ShowHideFieldsList
                        if (
                            search1 &&
                            !(self.FixedNotShowField.indexOf(element.Component) > -1) &&
                            (!(self.NotShowFields.indexOf(element) > -1
                                || self.NotShowFields.indexOf(element.Name) > -1
                                || self.NotShowFields.indexOf(element.Id) > -1
                                || self.NotShowFields.findIndex(item => item.Name == element.Name) > -1
                            )
                                || self.ShowHideFieldsList.indexOf(search1.Name) > -1) &&
                            !self.DiyCommon.IsNull(search1.Id)
                        ) {
                            search1["AsName"] = element.AsName || "";
                            //这里要根据 SelectFields 赋值别名
                            // if (self.SysMenuModel.SelectFields && Array.isArray(self.SysMenuModel.SelectFields)) {
                            //     var search2 = _u.where(self.SysMenuModel.SelectFields, {
                            //         Id: element
                            //     });
                            //     if (search2.length > 0 && !self.DiyCommon.IsNull(search2[0].AsName)) {
                            //         search1["AsName"] = search2[0].AsName;
                            //     }
                            // }
                            //------end
                            tempArr.push(search1);
                            index++;
                        }
                    });
                    // tempArr.push(_u.where(self.DiyFieldList, {Name : 'CreateTime'})[0]);
                    //调整ShowHideFieldsList排序
                    // self.SortShowHideFieldsList(tempArr);

                    // 已取消表格列分批渲染：一次性渲染全部列，避免分批 setTimeout/requestIdleCallback 造成的卡顿
                    self._allFieldList = tempArr;
                    // 过滤运行时隐藏的列
                    if (self._runtimeHiddenFields && self._runtimeHiddenFields.length > 0) {
                        tempArr = tempArr.filter(f => self._runtimeHiddenFields.indexOf(f.Id) === -1);
                    }
                    self.ShowDiyFieldList = tempArr;
                    return tempArr;
                } else if (self.DiyFieldList.length > 0) {
                    //如果没有指定查询列
                    // 注意：如果先返了这个， 后面return tempArr的时候，排序就没用了。
                    var tempArr = [];
                    var index = 0;
                    self.DiyFieldList.forEach((element) => {
                        //2021-10-26 新增排序 ShowHideFieldsList
                        if (
                            !(self.FixedNotShowField.indexOf(element.Component) > -1) &&
                            (!(self.NotShowFields.indexOf(element) > -1
                                || self.NotShowFields.indexOf(element.Name) > -1
                                || self.NotShowFields.indexOf(element.Id) > -1
                                || self.NotShowFields.findIndex(item => item.Name == element.Name) > -1
                                )
                                || self.ShowHideFieldsList.indexOf(element.Name) > -1) &&
                            !self.DiyCommon.IsNull(element.Id)
                        ) {
                            element["AsName"] = "";
                            //这里要根据 SelectFields 赋值别名
                            if (self.SysMenuModel.SelectFields && Array.isArray(self.SysMenuModel.SelectFields)) {
                                var search2 = _u.where(self.SysMenuModel.SelectFields, {
                                    Id: element
                                });
                                if (search2.length > 0 && !self.DiyCommon.IsNull(search2[0].AsName)) {
                                    element["AsName"] = search2[0].AsName;
                                }
                            }
                            //------end
                            //如果没有指定查询列，则不要显示审计字段，因为最后3列会显示审计字段 --2025-10-31 by anderson
                            if (self.DiyCommon.DefaultFieldNames.indexOf(element.Name) < 0) {
                                tempArr.push(element);
                            }
                            index++;
                        }
                    });
                    //调整ShowHideFieldsList排序
                    // self.SortShowHideFieldsList(tempArr);

                    // 已取消表格列分批渲染（第二个分支 - 无指定查询列）：一次性渲染全部列
                    self._allFieldList = tempArr;
                    // 过滤运行时隐藏的列
                    if (self._runtimeHiddenFields && self._runtimeHiddenFields.length > 0) {
                        tempArr = tempArr.filter(f => self._runtimeHiddenFields.indexOf(f.Id) === -1);
                    }
                    self.ShowDiyFieldList = tempArr;
                    return tempArr;
                } else {
                    self.ShowDiyFieldList = [];
                }
            } else {
                self.ShowDiyFieldList = [];
            }
            return [];
        },
    }
};
