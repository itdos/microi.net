<template>
    <!--下拉框-->
    <!-- :filter-method="
            (query) => {
                return FilterMethod(query, field);
            }
        " -->
    <!--
    FormDiyTableModel[field.Name]

    reserve-keyword:多选且可搜索时，是否在选中一个选项后保留当前的搜索关键词，默认false
    automatic-dropdown:对于不可搜索的 Select，是否在输入框获得焦点后自动弹出选项菜单.【这个有bug，第一次点击会闪一下收进去】
    :reserve-keyword="field.Component == 'MultipleSelect' &&
                    (field.Config.EnableSearch == true || field.Config.DataSourceSqlRemote == true)"
-->
    <!--注意：field.Data数据是在变的，
    这里面之前设置的key【'slt_opt_key' + field.Name + '_' + index2】一定会重复，
    因为field.Name是固定不变的，
    已解决-->
    <el-select
        v-model="ModelValue"
        :disabled="GetFieldReadOnly(field)"
        :multiple="field.Component == 'MultipleSelect'"
        :filterable="field.Config.EnableSearch == true || field.Config.DataSourceSqlRemote == true"
        :loading="field.Config.DataSourceSqlRemoteLoading"
        :clearable="TableInEdit ? false : true"
        :remote="field.Config.DataSourceSqlRemote == true"
        :remote-method="
            (query) => {
                return SelectRemoteMethod(query, field);
            }
        "
        :placeholder="GetFieldPlaceholder(field)"
        :value-key="GetSelectValueKey(field)"
        @change="
            (item) => {
                return SelectChange(item, field);
            }
        "
        @focus="SelectField(field)"
        @visible-change="
            (visible) => {
                return VisibleChange(visible, field);
            }
        "
    >
        <!--注意：field.Data数据是在变的，
            这里面之前设置的key【'slt_opt_key' + field.Name + '_' + index2】一定会重复，
            因为field.Name是固定不变的，
            已解决-->
        <el-option
            v-for="(fieldData, index2) in field.Data"
            :key="
                'slt_opt_key' +
                field.Name +
                '_' +
                (field.Config.DataSource === 'KeyValue' 
                    ? fieldData.key 
                    : (DiyCommon.IsNull(field.Config.SelectSaveField)
                        ? DiyCommon.IsNull(field.Config.SelectLabel)
                            ? fieldData
                            : fieldData[field.Config.SelectLabel]
                        : fieldData[field.Config.SelectSaveField])) +
                index2
            "
            :label="field.Config.DataSource === 'KeyValue' ? fieldData.value : (DiyCommon.IsNull(field.Config.SelectLabel) ? fieldData : fieldData[field.Config.SelectLabel])"
            :value="fieldData"
        />
    </el-select>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="下拉框配置"
        width="700px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <DiyDataSourceConfig
                v-model:config="configForm"
                v-model:dataList="configDataList"
                v-model:keyValueList="configKeyValueList"
                :showSaveFormat="field.Component == 'Select' || field.Component == 'Radio'"
                :showEnableSearch="field.Component == 'Select' || field.Component == 'MultipleSelect'"
                :showKeyValue="true"
            />
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script>
import _ from "underscore";
import DiyDataSourceConfig from "./shared/DiyDataSourceConfig.vue";

export default {
    name: "diy-select",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbackFormValueChange', 'update:modelValue'],
    components: {
        DiyDataSourceConfig
    },
    data() {
        return {
            ModelValue: "",
            LastModelValue: "",
            FieldAllData: [],
            NeedResetDataSourse: true,
            // 配置弹窗相关
            configDialogVisible: false,
            configForm: {
                SelectLabel: '',
                SelectSaveFormat: 'Text',
                SelectSaveField: '',
                EnableSearch: false,
                DataSource: 'Data',
                Sql: '',
                DataSourceId: '',
                DataSourceApiEngineKey: '',
                DataSourceSqlRemote: false
            },
            configDataList: [],
            configKeyValueList: []
        };
    },
    model: {
        prop: "ModelProps",
        event: "ModelChange"
    },
    props: {
        modelValue: {},
        ModelProps: {},
        field: { type: Object, default: () => {} },
        DiyTableModel: { type: Object, default: () => {} },
        ApiReplace: { type: Object, default: () => {} },
        FormDiyTableModel: { type: Object, default: () => {} },
        //表单模式Add、Edit、View
        FormMode: { type: String, default: "" },
        // ['FieldName1','FieldName2']
        ReadonlyFields: { type: Array, default: () => [] },
        FieldReadonly: { type: Boolean, default: null },
        TableInEdit: { type: Boolean, default: false },
        TableId: { type: String, default: "" },
        DiyFieldList: { type: Array, default: () => [] },
        DiyConfig: {
            type: Object,
            default() {
                return {};
            }
        }
    },

    watch: {
        modelValue: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                // 普通数据源 Data，值就是字符串
                if (self.field && self.field.Config && self.field.Config.DataSource === "Data") {
                    if (typeof newVal === "object" && newVal !== null) {
                        return;
                    }
                    self.ModelValue = newVal;
                    return;
                }
                // KeyValue 数据源：存储的是 key，但 ModelValue 需要是对象才能正确显示 value
                if (self.field && self.field.Config && self.field.Config.DataSource === "KeyValue") {
                    if (typeof newVal === "object" && newVal !== null) {
                        self.ModelValue = newVal;
                        return;
                    }
                    if (self.field.Data && self.field.Data.length > 0) {
                        var found = self.field.Data.find(item => item.key == newVal);
                        if (found) {
                            self.ModelValue = found;
                            return;
                        }
                    }
                    self.ModelValue = newVal;
                    return;
                }
                self.ModelValue = newVal;
            }
        },
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                // 普通数据源 Data，值就是字符串
                if (self.field && self.field.Config && self.field.Config.DataSource === "Data") {
                    if (typeof newVal === "object" && newVal !== null) {
                        return;
                    }
                    self.ModelValue = newVal;
                    return;
                }
                // KeyValue 数据源：存储的是 key，但 ModelValue 需要是对象才能正确显示 value
                if (self.field && self.field.Config && self.field.Config.DataSource === "KeyValue") {
                    if (typeof newVal === "object" && newVal !== null) {
                        // 已经是对象，直接使用
                        self.ModelValue = newVal;
                        return;
                    }
                    // newVal 是 key 字符串，需要从 Data 中找到对应对象
                    if (self.field.Data && self.field.Data.length > 0) {
                        var found = self.field.Data.find(item => item.key == newVal);
                        if (found) {
                            self.ModelValue = found;
                            return;
                        }
                    }
                    // 找不到对应对象，暂存 key，等 Data 加载后再匹配
                    self.ModelValue = newVal;
                    return;
                }
                self.ModelValue = self.ModelProps;
            }
        },
        "field.Data": function (newVal, oldVal) {
            var self = this;
            // if (newVal.length > 0 && self.FieldAllData.length == 0) {//2023-10-27注释
            //2023-10-27新增：有可能下拉框组件的数据源是动态赋值的，FieldAllData也要跟着变
            if (self.NeedResetDataSourse) {
                self.FieldAllData = [...newVal];

                // 只有在需要重置数据源时才同步 ModelValue
                // 如果是普通数据源Data或KeyValue，处理方式不同
                if (self.field.Config.DataSource === "Data") {
                    var delData = self.field.Data.find((item) => {
                        return item == self.ModelValue;
                    });
                    if (delData) self.ModelValue = delData;
                } else if (self.field.Config.DataSource === "KeyValue") {
                    var delData = self.field.Data.find((item) => {
                        return item.key == self.ModelValue;
                    });
                    if (delData) self.ModelValue = delData;
                } else {
                    // 其他数据源，item是对象
                    var saveField = self.field.Config.SelectSaveField;
                    var delData = self.field.Data.find((item) => {
                        return item[saveField] == self.ModelValue;
                    });
                    if (delData) self.ModelValue = delData;
                }
            }
            self.NeedResetDataSourse = true;
        }
    },

    computed: {},

    mounted() {
        var self = this;
        var modelValue = self.FormDiyTableModel[self.field.Name];
        // 普通数据源 Data 时，值就是字符串，不需要转换
        if (self.field && self.field.Config && self.field.Config.DataSource === "Data") {
            // 普通数据源，值直接是字符串，不做任何转换
            self.ModelValue = modelValue || "";
        } else if (self.field && self.field.Config && self.field.Config.DataSource === "KeyValue") {
            // KeyValue 数据源，存储的是 key，需要找到对应的对象
            self.ModelValue = modelValue || "";
            // 如果已有数据，找到对应的对象设置为当前值
            if (self.field.Data && self.field.Data.length > 0) {
                var found = self.field.Data.find(item => item.key == modelValue);
                if (found) {
                    self.ModelValue = found;
                }
            }
        } else if (typeof modelValue == "string") {
            if (modelValue.startsWith("{") || modelValue.startsWith("[")) {
                try {
                    modelValue = JSON.parse(modelValue);
                } catch (error) {}
            } else if (self.field && self.field.Config && self.field.Config.SelectSaveFormat == "Text" && self.field.Config.SelectLabel) {
                var newModelValue = {};
                newModelValue[self.field.Config.SelectSaveField || self.field.Config.SelectLabel] = modelValue;
                newModelValue[self.field.Config.SelectLabel] = modelValue;
                modelValue = newModelValue;
            }
            self.ModelValue = modelValue;
        } else {
            self.ModelValue = modelValue;
        }
        self.LastModelValue = self.ModelValue;
        self.$nextTick(function () {
            //如果是普通数据源或KeyValue
            if (self.field && (self.field.Config.DataSource == "Data" || self.field.Config.DataSource == "KeyValue")) {
                self.FieldAllData = [...self.field.Data];
            }
            self.Initing = false;
        });
    },

    methods: {
        Init() {
            var self = this;
            self.ModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
            self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
        },
        VisibleChange(visible, field) {
            var self = this;
            if (!visible) {
                if (field.Config.DataSourceSqlRemote) {
                    self.SelectRemoteMethod("", field);
                } else {
                    self.FilterMethod("", field);
                }
            }
        },
        GetFieldValue(field, form) {
            var self = this;
            if (!self.DiyCommon.IsNull(field.AsName)) {
                return form[field.AsName];
            }
            return form[field.Name];
        },
        ModelChangeMethods(item) {
            var self = this;
            self.ModelValue = item;
            // 修复：直接更新 FormDiyTableModel，确保数据同步
            var fieldName = self.DiyCommon.IsNull(self.field.AsName) ? self.field.Name : self.field.AsName;
            self.FormDiyTableModel[fieldName] = item;
            self.$emit("ModelChange", self.ModelValue);
            self.$emit("update:modelValue", self.ModelValue);
        },
        CommonV8CodeChange(item, field) {
            var self = this;
            if (!self.DiyCommon.IsNull(field.Config) && !self.DiyCommon.IsNull(field.Config.V8Code)) {
                self.RunV8Code({ field: field, thisValue: item });
            }
        },
        GetFieldReadOnly(field) {
            var self = this;
            if (self.FieldReadonly == true) {
                return true;
            }
            if (self.FormMode == "View") {
                return true;
            }
            if (self.ReadonlyFields.indexOf(field.Name) > -1) {
                return true;
            }
            return field.Readonly ? true : false;
        },
        GetFieldPlaceholder(field) {
            var self = this;
            var result = "";
            if (!self.DiyCommon.IsNull(field.Placeholder)) {
                result = field.Placeholder;
            }
            if (!self.DiyCommon.IsNull(field.Code)) {
                if (!self.DiyCommon.IsNull(field.Placeholder)) {
                    result += "(" + field.Code + ")";
                } else {
                    result = field.Code;
                }
            }
            return result;
        },
        SelectField(field) {
            var self = this;
            self.$emit("CallbackSelectField", field);
        },
        beforeSelectChange(value, field) {
            let self = this;
            return new Promise((resolve, reject) => {
                // 判断需要执行的V8
                if ((field.Component == "Select" || field.Component == "MultipleSelect") && !self.DiyCommon.IsNull(field.Config.V8Code)) {
                    self.$emit("CallbackRunV8Code", {
                        field: field,
                        thisValue: value,
                        callback: (res) => {
                            resolve(res);
                        }
                    });
                } else {
                    resolve(true);
                }
            });
        },
        async SelectChange(item, field) {
            var self = this;
            // KeyValue 数据源特殊处理：ModelValue 和 FormDiyTableModel 都保持完整对象
            var saveItem = item;
            if (field.Config.DataSource === "KeyValue" && item && typeof item === "object") {
                // ModelValue 和 FormDiyTableModel 都保持完整对象 {key, value}
                self.ModelValue = item;
                var fieldName = self.DiyCommon.IsNull(self.field.AsName) ? self.field.Name : self.field.AsName;
                self.FormDiyTableModel[fieldName] = item;  // 保存完整对象而不是只有key
                // emit 也发送完整对象
                self.$emit("ModelChange", item);
                self.$emit("update:modelValue", item);
            } else {
                self.ModelChangeMethods(saveItem);
            }
            let res = await self.beforeSelectChange(self.ModelValue, field);
            if (res === false) return;
            //如果是表内编辑，失去焦点要自动保存
            if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
                var param = {
                    TableId: self.TableId,
                    Id: self.FormDiyTableModel.Id,
                    _FormData: {}
                };
                param._FormData[self.field.Name] = self.ModelValue;
                let dataLog = [
                    {
                        Name: field.Name,
                        Label: field.Label || field.Name,
                        Component: field.Component,
                        OVal: self.LastModelValue || "",
                        NVal: self.ModelValue || ""
                    }
                ];
                param._DataLog = JSON.stringify(dataLog);
                self.DiyCommon.ForRowModelHandler(param._FormData, self.DiyFieldList);
                param._FormData = self.DiyCommon.ConvertRowModel(param._FormData);

                var apiUrl = self.DiyApi.UptDiyTableRow;
                if (self.DiyTableModel && self.DiyTableModel.ApiReplace && self.DiyTableModel.ApiReplace.Update) {
                    apiUrl = self.DiyCommon.RepalceUrlKey(self.DiyTableModel.ApiReplace.Update);
                }
                if (self.DiyConfig && self.DiyConfig.AddBtnType == "InTable" && self.DiyConfig.SaveType == "提交一起保存") {
                    if (!self.FormDiyTableModel._DataStatus) {
                        if (self.FormDiyTableModel._IsInTableAdd === true) {
                            self.FormDiyTableModel["_DataStatus"] = "Add";
                        } else {
                            self.FormDiyTableModel["_DataStatus"] = "Edit";
                        }
                    }
                    return;
                }
                self.DiyCommon.Post(apiUrl, param, function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.LastModelValue = self.ModelValue;
                        self.DiyCommon.Tips(self.$t("Msg.Success"));
                    }
                });
            }

            self.$emit("CallbackFormValueChange", self.field, saveItem);
        },
        GetSelectValueKey(field) {
            var self = this;
            //如果是普通数据源Data，直接返回undefined，因为值本身就是字符串，不需要value-key
            if (field.Config.DataSource === "Data") {
                return undefined;
            }
            // KeyValue 数据源，使用 key 作为 value-key
            if (field.Config.DataSource === "KeyValue") {
                return "key";
            }
            if (self.DiyCommon.IsNull(field.Config.SelectLabel) && self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                return "";
            } else {
                return self.DiyCommon.IsNull(field.Config.SelectSaveField) ? field.Config.SelectLabel : field.Config.SelectSaveField;
            }
        },
        FilterMethod(query, field) {
            var self = this;
            if (query) {
                self.NeedResetDataSourse = false;
                field.Data = _.filter([...self.FieldAllData], function (item) {
                    if (field.Config.DataSource == "Data") {
                        return item.indexOf(query) > -1;
                    }
                    if (field.Config.DataSource == "KeyValue") {
                        return (item.value && item.value.indexOf(query) > -1) || (item.key && item.key.indexOf(query) > -1);
                    }
                    return item[field.Config.SelectLabel].indexOf(query) > -1;
                });
            } else {
                self.NeedResetDataSourse = false;
                if (self.field && (self.field.Config.DataSource == "Data" || self.field.Config.DataSource == "KeyValue")) {
                    field.Data = [...self.FieldAllData];
                }
            }
        },
        SelectRemoteMethod(query, field) {
            var self = this;
            if (field.Config.DataSourceSqlRemote == true) {
                field.Config.DataSourceSqlRemoteLoading = true;
                var apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
                var postData = {
                    _FieldId: field.Id,
                    _FormData: this.FormDiyTableModel,
                    _Keyword: query
                };
                if (field.Config.DataSource == "Sql") {
                    apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
                } else if (field.Config.DataSource == "DataSource") {
                    apiGetDiyFieldSqlData = self.DiyApi.GetDataSourceEngine;
                    postData = {
                        ...postData,
                        DataSourceKey: field.Config.DataSourceId
                    };
                } else if (field.Config.DataSource == "ApiEngine") {
                    apiGetDiyFieldSqlData = self.DiyApi.ApiEngineRun;
                    postData = {
                        ...postData,
                        ApiEngineKey: field.Config.DataSourceApiEngineKey
                    };
                }

                if (!self.DiyCommon.IsNull(self.ApiReplace && self.ApiReplace.GetDiyFieldSqlData)) {
                    apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
                }
                self.DiyCommon.Post(
                    apiGetDiyFieldSqlData,
                    postData,
                    function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.NeedResetDataSourse = false;
                            field.Data = result.Data;
                        }
                        field.Config.DataSourceSqlRemoteLoading = false;
                    },
                    function (error) {
                        field.Config.DataSourceSqlRemoteLoading = false;
                    }
                );
            }
        },
        // ==================== 配置弹窗相关方法 ====================
        openConfig() {
            var self = this;
            // 初始化配置表单
            if (!self.field.Config) {
                self.field.Config = {};
            }
            self.configForm = {
                SelectLabel: self.field.Config.SelectLabel || '',
                SelectSaveFormat: self.field.Config.SelectSaveFormat || 'Text',
                SelectSaveField: self.field.Config.SelectSaveField || '',
                EnableSearch: self.field.Config.EnableSearch || false,
                DataSource: self.field.Config.DataSource || 'Data',
                Sql: self.field.Config.Sql || '',
                DataSourceId: self.field.Config.DataSourceId || '',
                DataSourceApiEngineKey: self.field.Config.DataSourceApiEngineKey || '',
                DataSourceSqlRemote: self.field.Config.DataSourceSqlRemote || false
            };
            // 初始化普通数据列表
            if (self.field.Data && Array.isArray(self.field.Data)) {
                if (self.configForm.DataSource === 'KeyValue') {
                    self.configKeyValueList = self.field.Data.map(item => {
                        if (typeof item === 'object' && item !== null) {
                            return { key: item.key || '', value: item.value || '' };
                        }
                        return { key: String(item), value: String(item) };
                    });
                    self.configDataList = [];
                } else if (self.configForm.DataSource === 'Data') {
                    self.configDataList = [...self.field.Data];
                    self.configKeyValueList = [];
                } else {
                    self.configDataList = [];
                    self.configKeyValueList = [];
                }
            } else {
                self.configDataList = [];
                self.configKeyValueList = [];
            }
            self.configDialogVisible = true;
        },
        saveConfig() {
            var self = this;
            // 保存配置到 field.Config
            self.field.Config.SelectLabel = self.configForm.SelectLabel;
            self.field.Config.SelectSaveFormat = self.configForm.SelectSaveFormat;
            self.field.Config.SelectSaveField = self.configForm.SelectSaveField;
            self.field.Config.EnableSearch = self.configForm.EnableSearch;
            self.field.Config.DataSource = self.configForm.DataSource;
            self.field.Config.Sql = self.configForm.Sql;
            self.field.Config.DataSourceId = self.configForm.DataSourceId;
            self.field.Config.DataSourceApiEngineKey = self.configForm.DataSourceApiEngineKey;
            self.field.Config.DataSourceSqlRemote = self.configForm.DataSourceSqlRemote;
            
            // 保存数据列表
            if (self.configForm.DataSource === 'Data') {
                self.field.Data = [...self.configDataList];
            } else if (self.configForm.DataSource === 'KeyValue') {
                // KeyValue 格式：设置显示字段为 value，存储字段为 key
                self.field.Config.SelectLabel = 'value';
                self.field.Config.SelectSaveField = 'key';
                self.field.Data = self.configKeyValueList.map(item => ({
                    key: item.key,
                    value: item.value
                }));
            }
            
            self.configDialogVisible = false;
            self.DiyCommon.Tips('配置已保存', true);
        }
    }
};
</script>

<style lang="scss" scoped>
.form-item-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}

.data-list {
    width: 100%;
}

.keyvalue-list {
    width: 100%;
    
    .keyvalue-item {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
    }
}
</style>
