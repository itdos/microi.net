<template>
    <el-input
        v-if="field.Component == 'Text' || field.Component == 'Guid'"
        v-model="ModelValue"
        :clearable="TableInEdit ? false : true"
        :disabled="GetFieldReadOnly(field)"
        :placeholder="GetFieldPlaceholder(field)"
        :show-password="DiyCommon.IsNull(field.Config.TextShowPassword) ? false : field.Config.TextShowPassword"
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
    >
        <template #suffix v-if="!DiyCommon.IsNull(field.Config.TextIcon) && field.Config.ShowIcon && field.Config.TextIconPosition == 'right'">
            <fa-icon :class="field.Config.TextIcon" /></template>
        <template #prefix v-if="!DiyCommon.IsNull(field.Config.TextIcon) && field.Config.ShowIcon && field.Config.TextIconPosition == 'left'">
            <fa-icon :class="field.Config.TextIcon" /></template>

        <template v-if="!field.Config.ShowButton && !DiyCommon.IsNull(field.Config.TextApend) && field.Config.TextApendPosition == 'left'" #prepend>{{ field.Config.TextApend }}</template>
        <template v-if="!field.Config.ShowButton && !DiyCommon.IsNull(field.Config.TextApend) && field.Config.TextApendPosition == 'right'" #append>{{ field.Config.TextApend }}</template>

        <el-button
            #prepend
            :disabled="field.Config.ReadOnlyButton"
            @click="OpenTableEventByInput(field)"
            :icon="field.Config.TextIcon"
            v-if="field.Config.ShowButton && field.Config.TextApendPosition == 'left'"
            >{{ field.Config.TextApend }}</el-button
        >
        <el-button
            #append
            :disabled="field.Config.ReadOnlyButton"
            @click="OpenTableEventByInput(field)"
            :icon="field.Config.TextIcon"
            v-if="field.Config.ShowButton && field.Config.TextApendPosition == 'right'"
            >{{ field.Config.TextApend }}</el-button
        >
    </el-input>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="单行文本配置"
        width="600px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-divider content-position="left">显示设置</el-divider>
            
            <el-form-item label="密码输入">
                <el-switch v-model="configForm.TextShowPassword" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>

            <el-form-item label="Icon图标">
                <el-input v-model="configForm.TextIcon" placeholder="如：fas fa-search" />
            </el-form-item>

            <el-form-item label="显示图标">
                <el-switch v-model="configForm.ShowIcon" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>

            <el-form-item label="图标位置">
                <el-radio-group v-model="configForm.TextIconPosition">
                    <el-radio value="left">左边</el-radio>
                    <el-radio value="right">右边</el-radio>
                </el-radio-group>
            </el-form-item>

            <el-divider content-position="left">复合设置</el-divider>

            <el-form-item label="复合文字">
                <el-input v-model="configForm.TextApend" placeholder="如：元、%、件" />
            </el-form-item>

            <el-form-item label="文字位置">
                <el-radio-group v-model="configForm.TextApendPosition">
                    <el-radio value="left">左边</el-radio>
                    <el-radio value="right">右边</el-radio>
                </el-radio-group>
            </el-form-item>

            <el-divider content-position="left">插槽按钮</el-divider>

            <el-form-item label="插槽按钮">
                <el-switch v-model="configForm.ShowButton" active-color="#ff6c04" inactive-color="#ccc" />
                <div class="form-item-tip">开启后复合文字区域变为可点击按钮</div>
            </el-form-item>

            <el-form-item label="插槽只读">
                <el-switch v-model="configForm.ReadOnlyButton" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>

            <el-form-item label="弹出表格Id">
                <el-input v-model="configForm.OpenTableId" placeholder="关联弹出表格的Id" />
            </el-form-item>

            <el-divider content-position="left">V8引擎代码</el-divider>

            <el-form-item label="失去焦点V8引擎代码">
                <el-button 
                    type="primary" 
                    :icon="Edit" 
                    @click="openCodeEditor('V8CodeBlur', '失去焦点V8引擎代码')"
                >
                    编辑代码{{ getCodeLength(configForm.V8CodeBlur) }}
                </el-button>
                <div class="form-item-tip">失去焦点时执行的V8引擎JavaScript代码</div>
            </el-form-item>

            <el-form-item label="键盘事件V8引擎代码">
                <el-button 
                    type="primary" 
                    :icon="Edit" 
                    @click="openCodeEditor('KeyupV8Code', '键盘事件V8引擎代码')"
                >
                    编辑代码{{ getCodeLength(configForm.KeyupV8Code) }}
                </el-button>
                <div class="form-item-tip">键盘事件时执行的V8引擎JavaScript代码，可通过V8.KeyCode获取键盘code值</div>
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>

    <!-- 代码编辑器弹窗 -->
    <el-dialog
        v-if="codeEditorVisible"
        v-model="codeEditorVisible"
        :title="codeEditorTitle"
        width="80%"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <diy-code-editor
            v-model="codeEditorValue"
            :field="{
                Name: codeEditorType,
                Component: 'CodeEditor',
                Config: {
                    CodeEditor: {
                        Language: 'javascript',
                        Theme: 'vs-dark'
                    }
                }
            }"
            :FormDiyTableModel="{ [codeEditorType]: codeEditorValue }"
            :FormMode="'Edit'"
            :ReadonlyFields="[]"
            :FieldReadonly="false"
        />
        <template #footer>
            <el-button @click="codeEditorVisible = false">取消</el-button>
            <el-button type="primary" @click="saveCodeEditor">确定</el-button>
        </template>
    </el-dialog>
</template>

<script>
import _ from "underscore";
import { Edit } from '@element-plus/icons-vue';
export default {
    name: "diy-input",
    inheritAttrs: false,
    emits: ['ModelChange', 'OpenTableEventByInput', 'CallbakOnKeyup', 'CallbackRunV8Code', 'CallbackFormValueChange', 'CallbackSelectField', 'update:modelValue'],
    data() {
        return {
            ModelValue: "",
            LastModelValue: "",
            // 配置弹窗相关
            configDialogVisible: false,
            configForm: {
                TextShowPassword: false,
                TextIcon: '',
                ShowIcon: false,
                TextIconPosition: 'left',
                TextApend: '',
                TextApendPosition: 'right',
                ShowButton: false,
                ReadOnlyButton: false,
                OpenTableId: '',
                V8CodeBlur: '',
                KeyupV8Code: ''
            },
            // 代码编辑器弹窗相关
            codeEditorVisible: false,
            codeEditorType: '', // 'V8CodeBlur' 或 'KeyupV8Code'
            codeEditorValue: '',
            codeEditorTitle: ''
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
        DiyTableModel: {
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

    components: {
        Edit
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
            self.ModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
            self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
        },
        OpenTableEventByInput(field) {
            var self = this;
            self.$emit("OpenTableEventByInput", field.Config.OpenTableId);
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
            //self.CommonV8CodeChange(item, field);
        },
        FieldOnKeyup(event, field) {
            var self = this;
            var keyCode = event.keyCode;
            // 判断需要执行的V8
            if (!self.DiyCommon.IsNull(field.KeyupV8Code)) {
                self.$emit("CallbakOnKeyup", event, field);
            }
        },
        /**
         * 注意item是一个事件，并不是值
         * @param {*} item
         * @param {*} field
         */
        async InputOnBlur(item, field) {
            var self = this;
            let res = await self.CommonV8CodeChange(self.ModelValue, field, "V8CodeBlur"); //item
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
         * 注意onblur传过来的item不是值，是一个事件
         */
        CommonV8CodeChange(value, field, v8codeKey) {
            var self = this;
            return new Promise((resolve, reject) => {
                // 判断需要执行的V8
                if (!self.DiyCommon.IsNull(field.Config) && (!self.DiyCommon.IsNull(field.Config.V8Code) || (v8codeKey && !self.DiyCommon.IsNull(field.Config[v8codeKey])))) {
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
                self.$emit("CallbackFormValueChange", self.field, value); //item
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
            if (!self.field.Config) {
                self.field.Config = {};
            }
            self.configForm = {
                TextShowPassword: self.field.Config.TextShowPassword || false,
                TextIcon: self.field.Config.TextIcon || '',
                ShowIcon: self.field.Config.ShowIcon || false,
                TextIconPosition: self.field.Config.TextIconPosition || 'left',
                TextApend: self.field.Config.TextApend || '',
                TextApendPosition: self.field.Config.TextApendPosition || 'right',
                ShowButton: self.field.Config.ShowButton || false,
                ReadOnlyButton: self.field.Config.ReadOnlyButton || false,
                OpenTableId: self.field.Config.OpenTableId || '',
                V8CodeBlur: self.field.Config.V8CodeBlur || '',
                KeyupV8Code: self.field.KeyupV8Code || ''
            };
            self.configDialogVisible = true;
        },
        saveConfig() {
            var self = this;
            self.field.Config.TextShowPassword = self.configForm.TextShowPassword;
            self.field.Config.TextIcon = self.configForm.TextIcon;
            self.field.Config.ShowIcon = self.configForm.ShowIcon;
            self.field.Config.TextIconPosition = self.configForm.TextIconPosition;
            self.field.Config.TextApend = self.configForm.TextApend;
            self.field.Config.TextApendPosition = self.configForm.TextApendPosition;
            self.field.Config.ShowButton = self.configForm.ShowButton;
            self.field.Config.ReadOnlyButton = self.configForm.ReadOnlyButton;
            self.field.Config.OpenTableId = self.configForm.OpenTableId;
            self.field.Config.V8CodeBlur = self.configForm.V8CodeBlur;
            self.field.KeyupV8Code = self.configForm.KeyupV8Code;
            self.configDialogVisible = false;
            self.DiyCommon.Tips('配置已保存', true);
        },
        // ==================== 代码编辑器相关方法 ====================
        getCodeLength(value) {
            if (!value) return '';
            const len = String(value).length;
            return len > 0 ? `(${len})` : '';
        },
        openCodeEditor(type, title) {
            var self = this;
            self.codeEditorType = type;
            self.codeEditorTitle = title;
            if (type === 'V8CodeBlur') {
                self.codeEditorValue = self.configForm.V8CodeBlur || '';
            } else if (type === 'KeyupV8Code') {
                self.codeEditorValue = self.configForm.KeyupV8Code || '';
            }
            self.codeEditorVisible = true;
        },
        saveCodeEditor() {
            var self = this;
            if (self.codeEditorType === 'V8CodeBlur') {
                self.configForm.V8CodeBlur = self.codeEditorValue;
            } else if (self.codeEditorType === 'KeyupV8Code') {
                self.configForm.KeyupV8Code = self.codeEditorValue;
            }
            self.codeEditorVisible = false;
            self.DiyCommon.Tips('代码已保存', true);
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
