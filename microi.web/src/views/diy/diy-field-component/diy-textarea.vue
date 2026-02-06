<template>
    <!--输入框-->
    <!--
    FormDiyTableModel[field.Name]
-->
    <!-- <el-input
    v-if="field.Component == 'Text' || field.Component == 'Guid'"
    v-model="ModelValue"
    :clearable="TableInEdit ? false : true"
    :disabled="GetFieldReadOnly(field)"
    :placeholder="GetFieldPlaceholder(field)"
    :show-password="DiyCommon.IsNull(field.Config.TextShowPassword) ? false : field.Config.TextShowPassword"
    @focus="SelectField(field)"
    @change="(item) => {return CommonV8CodeChange(item, field)}"
    @blur="(item) => {return InputOnBlur(item, field)}"
    @input="(item) => {return InputInputEvent(item, field)}"
    @keyup="FieldOnKeyup($event, field)"
    >
    <template #suffix><i v-if="!DiyCommon.IsNull(field.Config.TextIcon) && field.Config.TextIconPosition == 'right'" :class="field.Config.TextIcon" /></template>
    <template #prefix><i v-if="!DiyCommon.IsNull(field.Config.TextIcon) && field.Config.TextIconPosition == 'left'" :class="field.Config.TextIcon" /></template>

    <template v-if="!DiyCommon.IsNull(field.Config.TextApend) && field.Config.TextApendPosition == 'left'" #prepend>{{ field.Config.TextApend }}</template>
    <template v-if="!DiyCommon.IsNull(field.Config.TextApend) && field.Config.TextApendPosition == 'right'" #append>{{ field.Config.TextApend }}</template>
</el-input> -->
    <!--这里注释这个判断是因为表内编辑的时候并不用多行，用单行-->
    <!-- v-if="field.Component == 'Textarea'" -->
    <!-- :type="TableInEdit == true ? 'text' : 'textarea'" -->
    <!-- type="textarea" -->
    <el-input
        v-model="ModelValue"
        :disabled="GetFieldReadOnly(field)"
        :type="TableInEdit == true ? 'text' : 'textarea'"
        :rows="(field && field.Config && field.Config.Textarea && field.Config.Textarea.DefaultRows) || DefaultRows"
        :placeholder="GetFieldPlaceholder(field)"
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
        @focus="SelectField(field)"
        @keyup="FieldOnKeyup($event, field)"
    />

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="多行文本配置"
        width="500px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-form-item label="默认行数">
                <el-input-number v-model="configForm.DefaultRows" :min="1" :max="50" :step="1" />
                <div class="form-item-tip">设置多行文本框的默认显示行数（1-50）</div>
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
    name: "diy-input",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbakOnKeyup', 'CallbackFormValueChange', 'update:modelValue'],
    data() {
        return {
            ModelValue: "",
            LastModelValue: "",
            // 配置弹窗相关
            configDialogVisible: false,
            configForm: {
                DefaultRows: 5
            }
        };
    },
    model: {
        prop: "ModelProps",
        event: "ModelChange"
    },
    props: {
        modelValue: {},
        DefaultRows: {
            type: Number,
            default: 5 //View
        },
        ModelProps: {},
        DiyTableModel: {
            type: Object,
            default() {
                return {};
            }
        },
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
        async InputOnBlur(item, field) {
            var self = this;
            let res = await self.CommonV8CodeChange(self.ModelValue, field); //item
            if (res === false) return;

            //如果是表内编辑，失去焦点要自动保存
            //2021-11-02  但如果是行内新增的行，不需要自动保存，最后提交的时候再新增
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
        /**
         *
         * @param {*} item
         * @param {*} field
         * @param {*} v8codeKey
         */
        CommonV8CodeChange(value, field, v8codeKey) {
            var self = this;
            return new Promise((resolve, reject) => {
                // 判断需要执行的V8
                if (field.V8Code || (field.Config && field.Config.V8Code) 
                    || (v8codeKey && !self.DiyCommon.IsNull(field.Config[v8codeKey]))) {
                    // self.RunV8Code(field, item)
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
                self.$emit("CallbackFormValueChange", self.field, value); //value
            });
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
            // return field.Readonly ? true : false;
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
            if (!self.field.Config.Textarea) {
                self.field.Config.Textarea = {};
            }
            self.configForm = {
                DefaultRows: self.field.Config.Textarea.DefaultRows || 5
            };
            self.configDialogVisible = true;
        },
        saveConfig() {
            var self = this;
            // 保存配置到 field.Config
            if (!self.field.Config) {
                self.field.Config = {};
            }
            if (!self.field.Config.Textarea) {
                self.field.Config.Textarea = {};
            }
            self.field.Config.Textarea.DefaultRows = self.configForm.DefaultRows;
            
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
</style>
