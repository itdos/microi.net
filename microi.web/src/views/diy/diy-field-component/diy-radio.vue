<template>
    <!--下拉框-->
    <!--
    FormDiyTableModel[field.Name]

    reserve-keyword:多选且可搜索时，是否在选中一个选项后保留当前的搜索关键词，默认false
    automatic-dropdown:对于不可搜索的 Select，是否在输入框获得焦点后自动弹出选项菜单.【这个有bug，第一次点击会闪一下收进去】
    :reserve-keyword="field.Component == 'MultipleSelect' &&
                    (field.Config.EnableSearch == true || field.Config.DataSourceSqlRemote == true)"
-->
    <el-radio-group
        v-model="ModelValue"
        :disabled="GetFieldReadOnly(field)"
        @change="
            (item) => {
                return CommonV8CodeChange(item, field);
            }
        "
        @focus="SelectField(field)"
    >
        <el-radio
            v-for="(cbItem, index2) in field.Data"
            :key="'radio_' + field.Name + '_' + index2"
            :value="DiyCommon.IsNull(field.Config.SelectSaveField) ? cbItem : cbItem[field.Config.SelectSaveField]"
        >
            {{ DiyCommon.IsNull(field.Config.SelectLabel) ? cbItem : cbItem[field.Config.SelectLabel] }}
        </el-radio>
    </el-radio-group>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="单选框配置"
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
                :showSaveFormat="true"
                :showEnableSearch="false"
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
    name: "diy-radio",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbackFormValueChange', 'update:modelValue'],
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
                SelectSaveFormat: 'Text',
                SelectSaveField: '',
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
        DiyTableModel: {
            type: Object,
            default() {
                return {};
            }
        },
        ApiReplace: {
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
        DiyFieldList: {
            type: Array,
            default: () => []
        },
        DiyConfig: {
            type: Object,
            default() {
                return {};
            }
        }
    },

    watch: {
        //radio组件目前有点问题，FormSet赋值并不会触发此事件
        modelValue: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelValue = newVal;
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

    mounted() {
        var self = this;
        self.ModelValue = self.FormDiyTableModel[self.field.Name];
        self.LastModelValue = self.FormDiyTableModel[self.field.Name];
        self.$nextTick(function () {
            self.Initing = false;
        });
    },

    methods: {
        Init() {
            var self = this;
            self.ModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
            self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
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
        CommonV8CodeChange(item, field) {
            var self = this;
            self.ModelChangeMethods(item);
            if (!self.DiyCommon.IsNull(field.Config) && !self.DiyCommon.IsNull(field.Config.V8Code)) {
                // self.RunV8Code(field, item)
                self.$emit("CallbackRunV8Code", { field: field, thisValue: item });
            }
            //如果是表内编辑，要自动保存
            if (self.TableInEdit && self.FormDiyTableModel._IsInTableAdd !== true) {
                var param = {
                    TableId: self.TableId,
                    // _TableRowId : self.FormDiyTableModel.Id,
                    Id: self.FormDiyTableModel.Id,
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

                var apiUrl = self.DiyApi.UptDiyTableRow;
                if (self.DiyTableModel && self.DiyTableModel.ApiReplace && self.DiyTableModel.ApiReplace.Update) {
                    apiUrl = self.DiyCommon.RepalceUrlKey(self.DiyTableModel.ApiReplace.Update);
                }
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
                // self.DiyCommon.UptDiyTableRow(param, function(result){
                self.DiyCommon.Post(apiUrl, param, function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips(self.$t("Msg.Success"));
                    }
                });
            }
            self.$emit("CallbackFormValueChange", self.field, item);
        },
        GetFieldReadOnly(field) {
            var self = this;
            if (self.FieldReadonly == true) {
                return true;
            }
            //如果按钮设置了预览可点击
            //并且按钮Readonly属性不为true，
            //并且ReadonlyFields不包含此字段
            //则返回false(不禁用)
            // if((field.Component == 'MultipleSelect'  || field.Component == 'Select' )
            //     // && field.Config.Button.PreviewCanClick === true
            //     && !field.Readonly
            //     && !(self.ReadonlyFields.indexOf(field.Name) > -1)){
            //     return false;
            // }

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
        SelectChange(item, field) {
            var self = this;
            self.ModelChangeMethods(item);

            //如果是表内编辑，失去焦点要自动保存
            //2021-11-28注意：下拉框 ，保存的时候不是保存整个值 ，整个值可能是个json，是只保存设置的存储字段
            if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
                var param = {
                    TableId: self.TableId,
                    Id: self.FormDiyTableModel.Id,
                    _FormData: {}
                };
                param._FormData[self.field.Name] = self.ModelValue;
                //2021-12-06新增这一句，之前少了，在diy-form.vue中一直有这个调用，会处理Select控制最终存字段的配置
                self.DiyCommon.ForRowModelHandler(param._FormData, self.DiyFieldList);
                param._FormData = self.DiyCommon.ConvertRowModel(param._FormData);

                var apiUrl = self.DiyApi.UptDiyTableRow;
                if (self.DiyTableModel && self.DiyTableModel.ApiReplace && self.DiyTableModel.ApiReplace.Update) {
                    apiUrl = self.DiyCommon.RepalceUrlKey(self.DiyTableModel.ApiReplace.Update);
                }

                // self.DiyCommon.UptDiyTableRow(param, function(result){
                self.DiyCommon.Post(apiUrl, param, function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.LastModelValue = self.ModelValue;
                        self.DiyCommon.Tips(self.$t("Msg.Success"));
                    }
                });
            }

            if ((field.Component == "Select" || field.Component == "MultipleSelect") && !self.DiyCommon.IsNull(field.Config.V8Code)) {
                // self.RunV8Code(field, item)
                self.$emit("CallbackRunV8Code", { field: field, thisValue: item });
            }
            self.$emit("CallbackFormValueChange", self.field, item);
        },
        GetSelectValueKey(field) {
            var self = this;
            // console.log('GetSelectValueKey:'+field.Name);
            //如果设置了存储形式为json，则SelectSaveField设置无效
            //但是，存储形式为Json，也需要设置value-key
            // if (field.Config.SelectSaveFormat == 'Json' || self.DiyCommon.IsNull(field.Config.SelectSaveFormat)) {
            //     return '';
            // }
            if (self.DiyCommon.IsNull(field.Config.SelectLabel) && self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                return "";
            }
            //如果是存储字段
            else {
                return self.DiyCommon.IsNull(field.Config.SelectSaveField) ? field.Config.SelectLabel : field.Config.SelectSaveField;
            }
        },
        SelectRemoteMethod(query, field) {
            var self = this;
            if (field.Config.DataSourceSqlRemote == true) {
                //query !== ''
                field.Config.DataSourceSqlRemoteLoading = true;
                var apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
                if (!self.DiyCommon.IsNull(self.ApiReplace && self.ApiReplace.GetDiyFieldSqlData)) {
                    apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
                }
                self.DiyCommon.Post(
                    apiGetDiyFieldSqlData,
                    {
                        _FieldId: field.Id,
                        // OsClient: self.OsClient,
                        _FormData: JSON.stringify({}),
                        _Keyword: query
                    },
                    function (result) {
                        //2020-12-30，这里不能直接赋值，因为要考虑到选择的数据是第N页的，这时候可能又只取了第一页
                        //这里要把设置的默认值加进入，不然开启了limit远程搜索后，不显示值或者错误
                        //注意这里的逻辑和DiyCommon的SetFieldData逻辑类似 ，如果这里修改，那边需要同步
                        if (self.DiyCommon.Result(result)) {
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
</style>
