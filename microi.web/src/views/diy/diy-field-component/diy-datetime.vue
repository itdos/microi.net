<template>
    <!--输入框-->
    <!--
    FormDiyTableModel[field.Name]
    @blur="(currentValue, oldValue) => {return InputOnBlur(currentValue, oldValue, field)}"
-->
    <!-- @change="(item) => {return CommonV8CodeChange(item, field)}" -->
    <!-- @change="(currentValue, oldValue) => {return InputOnBlur(currentValue, oldValue, field)}" -->

    <!--  -->
    <div>
        <el-time-picker
            v-if="field.Config && (field.Config.DateTimeType == 'HH:mm' || field.Config.DateTimeType == 'HH:mm:ss')"
            v-model="ModelValue"
            :clearable="TableInEdit ? false : true"
            :disabled="GetFieldReadOnly(field)"
            :value-format="GetDateTimeFormat(field)"
            :format="GetDateTimeFormat(field)"
            splaceholder="GetFieldPlaceholder(field)"
            @change="
                (item) => {
                    return CommonV8CodeChange(item, field);
                }
            "
            @focus="SelectField(field)"
        >
        </el-time-picker>

        <el-date-picker
            v-else
            v-model="ModelValue"
            :clearable="TableInEdit ? false : true"
            :disabled="GetFieldReadOnly(field)"
            :type="GetDateTimeType(field)"
            :value-format="GetDateTimeFormat(field)"
            :format="GetDateTimeFormat(field)"
            :placeholder="GetFieldPlaceholder(field)"
            @change="
                (item) => {
                    return CommonV8CodeChange(item, field);
                }
            "
            @focus="SelectField(field)"
        />
    </div>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="日期时间配置"
        width="500px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-form-item label="显示格式">
                <el-radio-group v-model="configForm.DateTimeType">
                    <el-radio value="date">年月日</el-radio>
                    <el-radio value="datetime">年月日 时分秒</el-radio>
                    <el-radio value="datetime_HHmm">年月日 时分</el-radio>
                    <el-radio value="HH:mm">时分</el-radio>
                    <el-radio value="HH:mm:ss">时分秒</el-radio>
                    <el-radio value="month">年月</el-radio>
                    <el-radio value="week">年周</el-radio>
                    <el-radio value="year">年</el-radio>
                    <el-radio value="dates">多选天</el-radio>
                    <el-radio value="months">多选月</el-radio>
                    <el-radio value="years">多选年</el-radio>
                </el-radio-group>
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script>
import _ from "underscore";
export default {
    name: "diy-input-number",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbackFormValueChange', 'update:modelValue'],
    data() {
        return {
            ModelValue: "",
            LastModelValue: "",
            // 配置弹窗相关
            configDialogVisible: false,
            configForm: {
                DateTimeType: 'date'
            }
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

    components: {},

    computed: {},

    //注意：表单打开一次后，再次打开，这个不会第二次执行，导致值不会变
    mounted() {
        var self = this;
        self.Init();
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
        NumberTextChange(currentValue, oldValue, field) {
            var self = this;
            self.ModelChangeMethods(currentValue);
            if (field.Component == "NumberText" && (field.V8Code || field.Config.V8Code)) {
                // self.RunV8Code(field, {
                //     New: currentValue,
                //     Old: oldValue
                // })
                self.$emit("CallbackRunV8Code", {
                    field: field,
                    thisValue: {
                        New: currentValue,
                        Old: oldValue
                    }
                });
            }
        },
        InputInputEvent(item, field) {
            var self = this;
            self.ModelChangeMethods(item);
            self.CommonV8CodeChange(item, field);
        },
        InputOnBlur(currentValue, oldValue, field) {
            var self = this;
            self.NumberTextChange(currentValue, oldValue, field);
            //如果是表内编辑，失去焦点要自动保存
            if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
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
                    // 给当前所在的表单对象添加_DataStatus字段记录操作状态
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
                        self.LastModelValue = self.ModelValue;
                        self.DiyCommon.Tips(self.$t("Msg.Success"));
                    }
                });
            }
        },
        CommonV8CodeChange(item, field) {
            var self = this;
            self.ModelChangeMethods(item);
            if (field.V8Code || field.Config.V8Code) {
                // self.RunV8Code(field, item)
                self.$emit("CallbackRunV8Code", { field: field, thisValue: item });
            }
            //如果是表内编辑，失去焦点要自动保存
            if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
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
                    // 给当前所在的表单对象添加_DataStatus字段记录操作状态
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
                        self.LastModelValue = self.ModelValue;
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
            // if(field.Component == 'DateTime'
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
        GetDateTimeType(field) {
            var self = this;
            if (field.Config.DateTimeType == "HH:mm" || field.Config.DateTimeType == "HH:mm:ss") {
                return "";
            }
            // DiyCommon.IsNull(field.Config.DateTimeType) ? 'date' : field.Config.DateTimeType
            if (!field.Config.DateTimeType) {
                return "date";
            }
            if (field.Config.DateTimeType == "datetime_HHmm" || field.Config.DateTimeType == "datetime_HH") {
                return "datetime";
            }
            return field.Config.DateTimeType;
        },
        GetDateTimeFormat(field) {
            var self = this;
            if (field.Config.DateTimeType == "datetime") {
                return "YYYY-MM-DD HH:mm:ss";
            } else if (field.Config.DateTimeType == "date" || field.Config.DateTimeType == "dates") {
                return "YYYY-MM-DD";
            } else if (field.Config.DateTimeType == "week") {
                return "YYYY 第 ww 周";
            } else if (field.Config.DateTimeType == "month" || field.Config.DateTimeType == "months") {
                return "YYYY-MM";
            } else if ((field.Config.DateTimeType == "year") | (field.Config.DateTimeType == "years")) {
                return "YYYY";
            } else if (field.Config.DateTimeType == "datetime_HHmm") {
                return "YYYY-MM-DD HH:mm";
            } else if (field.Config.DateTimeType == "datetime_HH") {
                return "YYYY-MM-DD HH";
            } else if (field.Config.DateTimeType == "HH:mm") {
                return "HH:mm";
            } else if (field.Config.DateTimeType == "HH:mm:ss") {
                return "HH:mm:ss";
            }
            return "YYYY-MM-DD";
        },
        // ==================== 配置弹窗相关方法 ====================
        openConfig() {
            var self = this;
            if (!self.field.Config) {
                self.field.Config = {};
            }
            self.configForm = {
                DateTimeType: self.field.Config.DateTimeType || 'date'
            };
            self.configDialogVisible = true;
        },
        saveConfig() {
            var self = this;
            self.field.Config.DateTimeType = self.configForm.DateTimeType;
            self.configDialogVisible = false;
            self.DiyCommon.Tips('配置已保存', true);
        }
    }
};
</script>

<style lang="scss" scoped></style>
