<template>
    <!--输入框-->
    <!--
    FormDiyTableModel[field.Name]
-->
    <el-autocomplete
        v-if="field.Component == 'Autocomplete'"
        v-model="ModelValue"
        :clearable="TableInEdit ? false : true"
        :disabled="GetFieldReadOnly(field)"
        :placeholder="GetFieldPlaceholder(field)"
        :value-key="field.Config.DataSource === 'KeyValue' ? 'Value' : (field.Config.SelectLabel || 'value')"
        @focus="SelectField(field)"
        @change="
            (item) => {
                return CommonV8CodeChange(item, field);
            }
        "
        @blur="
            (item) => {
                return InputOnBlur(item, field);
            }
        "
        @input="
            (item) => {
                return InputInputEvent(item, field);
            }
        "
        @keyup="FieldOnKeyup($event, field)"
        :fetch-suggestions="
            (queryString, cb) => {
                return querySearchAsync(queryString, cb, field);
            }
        "
        @select="
            (item) => {
                return handleSelect(item, field);
            }
        "
    >
        <template #suffix><i v-if="!DiyCommon.IsNull(field.Config.TextIcon) && field.Config.TextIconPosition == 'right'" :class="field.Config.TextIcon" /></template>
        <template #prefix><i v-if="!DiyCommon.IsNull(field.Config.TextIcon) && field.Config.TextIconPosition == 'left'" :class="field.Config.TextIcon" /></template>

        <template v-if="!DiyCommon.IsNull(field.Config.TextApend) && field.Config.TextApendPosition == 'left'" #prepend>{{ field.Config.TextApend }}</template>
        <template v-if="!DiyCommon.IsNull(field.Config.TextApend) && field.Config.TextApendPosition == 'right'" #append>{{ field.Config.TextApend }}</template>
    </el-autocomplete>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="自动完成配置"
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
                :showSaveFormat="false"
                :showEnableSearch="false"
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
    name: "diy-autocomplete",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbakOnKeyup', 'CallbackFormValueChange', 'update:modelValue'],
    components: {
        DiyDataSourceConfig
    },
    data() {
        return {
            ModelValue: "",
            LastModelValue: "",
            // 配置弹窗相关
            configDialogVisible: false,
            configForm: {
                SelectLabel: '',
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
        field: {
            type: Object,
            default() {
                return {};
            }
        },
        FormDiyTableModel: {
            type: Object,
            default() {
                return {};
            }
        },
        //表单模式Add、Edit、View
        FormMode: {
            type: String,
            default: "" //View
        },
        // ['FieldName1','FieldName2']
        ReadonlyFields: {
            type: Array,
            default: () => []
        },
        FieldReadonly: {
            type: Boolean,
            default: null
        },
        TableInEdit: {
            type: Boolean,
            default: false
        },
        TableId: {
            type: String,
            default: "" //View
        },
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
                // KeyValue 模式：将 Key 转换为 Value 显示
                if (self.field.Config.DataSource === 'KeyValue' && newVal && self.field.Data) {
                    var matchedItem = self.field.Data.find(item => item.Key === newVal);
                    if (matchedItem) {
                        self.ModelValue = matchedItem.Value || '';
                    } else {
                        self.ModelValue = newVal;
                    }
                } else {
                    self.ModelValue = newVal;
                }
            }
        },
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelValue = self.ModelProps;
            }
        }
    },

    computed: {},

    //注意：表单打开一次后，再次打开，这个不会第二次执行，导致值不会变
    mounted() {
        var self = this;
        self.Init();
    },

    methods: {
        Init() {
            var self = this;
            var fieldValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
            
            // KeyValue 模式：将保存的 Key 值转换为 Value 用于显示
            if (self.field.Config.DataSource === 'KeyValue' && fieldValue && self.field.Data) {
                var matchedItem = self.field.Data.find(item => item.Key === fieldValue);
                if (matchedItem) {
                    self.ModelValue = matchedItem.Value || '';
                } else {
                    self.ModelValue = fieldValue; // 回退：找不到就显示原值
                }
                self.LastModelValue = fieldValue; // 保存原始 Key 值用于比较
            } else {
                self.ModelValue = fieldValue;
                self.LastModelValue = fieldValue;
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
            self.$emit("ModelChange", self.ModelValue);
            self.$emit("update:modelValue", self.ModelValue);
        },
        querySearchAsync(queryString, cb, field) {
            var self = this;
            // KeyValue 和普通数据模式：使用本地数据过滤，不请求远程
            if (field.Config.DataSource === 'KeyValue' || field.Config.DataSource === 'Data') {
                var restaurants = field.Data || [];
                var labelField = field.Config.SelectLabel || 'value';
                var results = queryString ? restaurants.filter((state) => {
                    var labelValue = '';
                    if (field.Config.DataSource === 'KeyValue') {
                        labelValue = state.Value || '';
                    } else {
                        labelValue = state[labelField] || '';
                    }
                    return String(labelValue).toLowerCase().indexOf(queryString.toLowerCase()) === 0;
                }) : restaurants;
                cb(results);
                return;
            }
            //判断是否从远程数据搜索
            if (field.Config.DataSourceSqlRemote === true) {
                field.Config.DataSourceSqlRemoteLoading = true;
                // if(!self.DiyCommon.IsNull(self.ApiReplace && self.ApiReplace.GetDiyFieldSqlData)){
                //     apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
                // }
                if (field.Config.DataSource == "Sql") {
                    var apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
                    self.DiyCommon.Post(
                        apiGetDiyFieldSqlData,
                        {
                            _FieldId: field.Id,
                            _FormData: {},
                            _Keyword: queryString
                        },
                        function (result) {
                            if (self.DiyCommon.Result(result)) {
                                field.Data = result.Data;
                                cb(result.Data);
                            }
                            field.Config.DataSourceSqlRemoteLoading = false;
                        },
                        function (error) {
                            field.Config.DataSourceSqlRemoteLoading = false;
                        }
                    );
                }

                if (field.Config.DataSource == "DataSource") {
                    const apiDataSourceUrl = self.DiyApi.GetDataSourceEngine;
                    self.DiyCommon.Post(
                        apiDataSourceUrl,
                        {
                            _FieldId: field.Id,
                            _FormData: {},
                            _Keyword: queryString,
                            DataSourceKey: field.Config.DataSourceId
                        },
                        function (result) {
                            if (self.DiyCommon.Result(result)) {
                                field.Data = result.Data;
                                cb(result.Data);
                            }
                            field.Config.DataSourceSqlRemoteLoading = false;
                        },
                        function (error) {
                            field.Config.DataSourceSqlRemoteLoading = false;
                        }
                    );
                }
            } else {
                var restaurants = field.Data;
                var results = queryString ? restaurants.filter(this.createStateFilter(queryString, field)) : restaurants;
                cb(results);
            }
        },
        createStateFilter(queryString, field) {
            return (state) => {
                return state[field.Config.SelectLabel].toLowerCase().indexOf(queryString.toLowerCase()) === 0;
            };
        },
        handleSelect(item, field) {
            var self = this;
            
            // KeyValue 模式：保存 Key 值到数据库，但显示 Value
            if (field.Config.DataSource === 'KeyValue' && item && item.Key !== undefined) {
                // 保存 Key 到表单模型
                self.FormDiyTableModel[field.Name] = item.Key;
                self.LastModelValue = item.Key;
                // 显示 Value
                self.ModelValue = item.Value || '';
                // 触发更新事件（使用 Key 值）
                self.$emit("ModelChange", item.Key);
                self.$emit("update:modelValue", item.Key);
            }
            
            //执行V8
            if (field.Component == "Autocomplete" 
                && (field.V8Code || field.Config.V8Code)) {
                self.$emit("CallbackRunV8Code", { field: field, thisValue: item });
                //如果是表内编辑，失去因为已经失去焦点了，点击后才会执行下面这段
                if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
                    var param = {
                        TableId: self.TableId,
                        _TableRowId: self.FormDiyTableModel.Id,
                        _FormData: {}
                    };
                    param._FormData[self.field.Name] = self.ModelValue;
                    let dataLog = [
                        {
                            Name: field.Name,
                            Label: field.Label || key,
                            Component: field.Component,
                            OVal: self.LastModelValue || "", //老值
                            NVal: self.ModelValue || "" //新值
                        }
                    ];
                    param._DataLog = JSON.stringify(dataLog);
                    //liucheng2025-10-8 可配置，表内编辑保存一起提交，值变更不会实时更新子表数据。
                    if (self.DiyConfig && self.DiyConfig.AddBtnType == "InTable" && self.DiyConfig.SaveType == "提交一起保存") {
                        if (!self.FormDiyTableModel._DataStatus) {
                            // 如果是新增的行，设置为Add状态，否则设置为Edit状态
                            if (self.FormDiyTableModel._IsInTableAdd === true) {
                                self.FormDiyTableModel["_DataStatus"] = "Add";
                            } else {
                                self.FormDiyTableModel["_DataStatus"] = "Edit";
                            }
                        }
                        return;
                    }
                    self.DiyCommon.UptDiyTableRow(param, function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.LastModelValue = self.ModelValue;
                            self.DiyCommon.Tips(self.$t("Msg.Success"));
                        }
                    });
                }
            }
        },
        InputInputEvent(item, field) {
            var self = this;
            self.ModelChangeMethods(item);
            self.CommonV8CodeChange(item, field);
        },
        FieldOnKeyup(event, field) {
            var self = this;
            var keyCode = event.keyCode;
            // 判断需要执行的V8
            if (!self.DiyCommon.IsNull(field.KeyupV8Code)) {
                self.$emit("CallbakOnKeyup", event, field);
            }
        },
        InputOnBlur(item, field) {
            var self = this;
            self.CommonV8CodeChange(item, field);
            //如果是表内编辑，失去焦点要自动保存。
            //2021-12-07后来发现：这里不能自动保存，因为选择的时候就已经失去焦点了，但值还没有赋值。
            // if(self.TableInEdit
            //     && self.LastModelValue != self.ModelValue
            //     && (self.FormDiyTableModel._IsInTableAdd !== true)
            //     ){
            //     var param = {
            //         TableId : self.TableId,
            //         _TableRowId : self.FormDiyTableModel.Id,
            //         _FormData : {},
            //     };
            //     param._FormData[self.field.Name] = self.ModelValue;
            //     self.DiyCommon.UptDiyTableRow(param, function(result){
            //         if(self.DiyCommon.Result(result)){
            //             self.LastModelValue = self.ModelValue;
            //             self.DiyCommon.Tips(self.$t('Msg.Success'));
            //         }
            //     });
            // }
        },
        CommonV8CodeChange(item, field) {
            var self = this;
            if (field.V8Code || field.Config.V8Code) {
                // self.RunV8Code(field, item)
                self.$emit("CallbackRunV8Code", { field: field, thisValue: self.ModelValue }); //item
            }
            self.$emit("CallbackFormValueChange", self.field, self.ModelValue); //item
        },
        GetFieldReadOnly(field) {
            var self = this;
            //如果按钮设置了预览可点击
            //并且按钮Readonly属性不为true，
            //并且ReadonlyFields不包含此字段
            //则返回false(不禁用)
            // if(field.Component == 'Button'
            //     && field.Config.Button.PreviewCanClick === true
            //     && !field.Readonly
            //     && !(self.ReadonlyFields.indexOf(field.Name) > -1)){
            //     return false;
            // }
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
        // ==================== 配置弹窗相关方法 ====================
        openConfig() {
            var self = this;
            // 初始化配置表单
            if (!self.field.Config) {
                self.field.Config = {};
            }
            self.configForm = {
                SelectLabel: self.field.Config.SelectLabel || '',
                DataSource: self.field.Config.DataSource || 'Data',
                Sql: self.field.Config.Sql || '',
                DataSourceId: self.field.Config.DataSourceId || '',
                DataSourceApiEngineKey: self.field.Config.DataSourceApiEngineKey || '',
                DataSourceSqlRemote: self.field.Config.DataSourceSqlRemote || false
            };
            // 初始化普通数据列表
            if (self.field.Data && Array.isArray(self.field.Data)) {
                if (self.configForm.DataSource === 'Data') {
                    // 对于自动完成，普通数据是对象格式，提取显示字段的值用于编辑
                    var labelField = self.configForm.SelectLabel || 'value';
                    self.configDataList = self.field.Data.map(item => {
                        if (typeof item === 'object' && item !== null) {
                            return item[labelField] || '';
                        }
                        return String(item);
                    });
                } else if (self.configForm.DataSource === 'KeyValue') {
                    // KeyValue 模式：从对象数组中提取 Key-Value 对
                    self.configKeyValueList = self.field.Data.map(item => {
                        if (typeof item === 'object' && item !== null) {
                            return {
                                Key: item.Key || '',
                                Value: item.Value || ''
                            };
                        }
                        return { Key: '', Value: '' };
                    });
                } else {
                    self.configDataList = [];
                }
            } else {
                self.configDataList = [];
            }
            self.configDialogVisible = true;
        },
        saveConfig() {
            var self = this;
            // 保存配置到 field.Config
            self.field.Config.SelectLabel = self.configForm.SelectLabel;
            self.field.Config.DataSource = self.configForm.DataSource;
            self.field.Config.Sql = self.configForm.Sql;
            self.field.Config.DataSourceId = self.configForm.DataSourceId;
            self.field.Config.DataSourceApiEngineKey = self.configForm.DataSourceApiEngineKey;
            self.field.Config.DataSourceSqlRemote = self.configForm.DataSourceSqlRemote;
            
            // 保存数据列表
            if (self.configForm.DataSource === 'Data') {
                // 自动完成组件需要对象格式的数据
                var labelField = self.configForm.SelectLabel || 'value';
                self.field.Data = self.configDataList.map(item => {
                    var obj = {};
                    obj[labelField] = item;
                    return obj;
                });
            } else if (self.configForm.DataSource === 'KeyValue') {
                // KeyValue 模式：保存为对象数组，包含 Key 和 Value
                self.field.Data = self.configKeyValueList.filter(item => item.Key || item.Value);
            } else {
                // 其他数据源（SQL、DataSource、ApiEngine）不修改 field.Data
                // field.Data 会在运行时动态加载
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
