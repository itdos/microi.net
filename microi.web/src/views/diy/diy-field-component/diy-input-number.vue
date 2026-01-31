<template>
    <!--输入框-->
    <!--
    FormDiyTableModel[field.Name]
    @blur="(currentValue, oldValue) => {return InputOnBlur(currentValue, oldValue, field)}"
     @blur="
      (currentValue, oldValue) => {
        return NumberTextChange(currentValue, oldValue, field);
      }
    "
-->
    <el-input-number
        v-model="ModelValue"
        :disabled="GetFieldReadOnly(field)"
        :step="DiyCommon.IsNull(field.Config.NumberTextStep) ? 1 : field.Config.NumberTextStep"
        :precision="DiyCommon.IsNull(field.Config.NumberTextPrecision) ? 0 : field.Config.NumberTextPrecision"
        :controls-position="DiyCommon.IsNull(field.Config.NumberTextBtnPosition) ? 'right' : field.Config.NumberTextBtnPosition"
        :controls="DiyCommon.IsNull(field.Config.NumberTextBtn) ? true : field.Config.NumberTextBtn"
        label=""
        :placeholder="GetFieldPlaceholder(field)"
        @change="
            (currentValue, oldValue) => {
                return InputOnBlur(currentValue, oldValue, field);
            }
        "
        @focus="SelectField(field)"
        @keyup="FieldOnKeyup($event, field)"
    >
        <!-- <template #prepend>Http://</template> -->
    </el-input-number>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="数字输入配置"
        width="500px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-form-item label="显示按钮">
                <el-switch v-model="configForm.NumberTextBtn" active-color="#ff6c04" inactive-color="#ccc" />
                <div class="form-item-tip">是否显示增减按钮</div>
            </el-form-item>
            
            <el-form-item label="按钮位置">
                <el-radio-group v-model="configForm.NumberTextBtnPosition">
                    <el-radio value="">两侧</el-radio>
                    <el-radio value="right">右侧</el-radio>
                </el-radio-group>
                <div class="form-item-tip">增减按钮的显示位置</div>
            </el-form-item>
            
            <el-form-item label="步数">
                <el-input-number v-model="configForm.NumberTextStep" :min="0.01" :step="1" :precision="2" />
                <div class="form-item-tip">每次点击增减按钮时变化的数值</div>
            </el-form-item>
            
            <el-form-item label="小数点位数">
                <el-input-number v-model="configForm.NumberTextPrecision" :min="0" :max="10" :step="1" />
                <div class="form-item-tip">数值精度，即小数点后保留的位数（0-10）</div>
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
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbakOnKeyup', 'CallbackFormValueChange', 'update:modelValue'],
    data() {
        return {
            ModelValue: "",
            LastModelValue: "",
            // 配置弹窗相关
            configDialogVisible: false,
            configForm: {
                NumberTextBtn: true,
                NumberTextBtnPosition: 'right',
                NumberTextStep: 1,
                NumberTextPrecision: 0
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
        FieldOnKeyup(event, field) {
            var self = this;
            self.$emit("CallbakOnKeyup", event, field);
        },
        NumberTextChange(currentValue, oldValue, field) {
            return new Promise((resolve, reject) => {
                var self = this;
                self.ModelChangeMethods(currentValue);
                if (field.Component == "NumberText" && !self.DiyCommon.IsNull(field.Config.V8Code)) {
                    self.$emit("CallbackRunV8Code", {
                        field: field,
                        thisValue: {
                            New: currentValue,
                            Old: oldValue
                        },
                        callback: (res) => {
                            console.log("NumberTextChange 回调", res);
                            resolve(res);
                        }
                    });
                } else {
                    resolve(true);
                }
            });
        },
        InputInputEvent(item, field) {
            var self = this;
            self.ModelChangeMethods(item);
            self.CommonV8CodeChange(item, field);
        },
        async InputOnBlur(currentValue, oldValue, field) {
            var self = this;
            var msg = self.$t("Msg.Success");
            console.log(msg);
            console.log("InputOnBlur", currentValue, oldValue, field);
            let res = await self.NumberTextChange(currentValue, oldValue, field);
            if (res === false) return;

            //如果是表内编辑，失去焦点要自动保存
            if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
                var param = {
                    TableId: self.TableId,
                    // _TableRowId : self.FormDiyTableModel.Id,
                    Id: self.FormDiyTableModel.Id,
                    _FormData: {}
                };
                if (self.DiyCommon.IsNull(self.ModelValue)) {
                    param._FormData[self.field.Name] = "";
                } else {
                    param._FormData[self.field.Name] = self.ModelValue;
                }
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
                    apiUrl = self.DiyTableModel.ApiReplace.Update;
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
                console.log(apiUrl, param);
                self.DiyCommon.Post(apiUrl, param, function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.LastModelValue = self.ModelValue;
                        self.DiyCommon.Tips(msg);
                    }
                });
            }
            self.$emit("CallbackFormValueChange", self.field, currentValue);
        },
        CommonV8CodeChange(item, field) {
            var self = this;
            if (!self.DiyCommon.IsNull(field.Config) && !self.DiyCommon.IsNull(field.Config.V8Code)) {
                // self.RunV8Code(field, item)
                self.$emit("CallbackRunV8Code", {
                    field: field,
                    thisValue: item,
                    callback: () => {
                        console.log("CommonV8CodeChange 回调");
                    }
                });
            }
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
            // if(field.Component == 'Button'
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
        // ==================== 配置弹窗相关方法 ====================
        openConfig() {
            var self = this;
            // 初始化配置表单
            if (!self.field.Config) {
                self.field.Config = {};
            }
            self.configForm = {
                NumberTextBtn: self.DiyCommon.IsNull(self.field.Config.NumberTextBtn) ? true : self.field.Config.NumberTextBtn,
                NumberTextBtnPosition: self.field.Config.NumberTextBtnPosition || 'right',
                NumberTextStep: self.DiyCommon.IsNull(self.field.Config.NumberTextStep) ? 1 : self.field.Config.NumberTextStep,
                NumberTextPrecision: self.DiyCommon.IsNull(self.field.Config.NumberTextPrecision) ? 0 : self.field.Config.NumberTextPrecision
            };
            self.configDialogVisible = true;
        },
        saveConfig() {
            var self = this;
            // 保存配置到 field.Config
            if (!self.field.Config) {
                self.field.Config = {};
            }
            self.field.Config.NumberTextBtn = self.configForm.NumberTextBtn;
            self.field.Config.NumberTextBtnPosition = self.configForm.NumberTextBtnPosition;
            self.field.Config.NumberTextStep = self.configForm.NumberTextStep;
            self.field.Config.NumberTextPrecision = self.configForm.NumberTextPrecision;
            
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
