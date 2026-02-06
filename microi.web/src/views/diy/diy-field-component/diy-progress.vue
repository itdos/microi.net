<template>
    <!-- DiyCommon.IsNull(field.Config.NumberTextPrecision) ? 2 : field.Config.NumberTextPrecision -->
    <el-input-number
        v-if="FormMode == 'Edit'"
        v-model="ModelValue"
        :disabled="GetFieldReadOnly(field)"
        :step="DiyCommon.IsNull(field.Config.NumberTextStep) ? 1 : field.Config.NumberTextStep"
        :precision="2"
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
    <!-- :status="GetStatus" -->
    <!-- :text-inside="(field.Config && field.Config.Progress && field.Config.Progress.TextInside) ? true : false"
        :stroke-width="(field.Config && field.Config.Progress && field.Config.Progress.StrokeWidth) || 6"
        :type="(field.Config && field.Config.Progress && field.Config.Progress.Type) || 'line'" -->

    <el-progress v-else :percentage="ModelValue" :color="customColorMethod" :text-inside="true" :stroke-width="18"> </el-progress>
</template>

<script>
import _ from "underscore";
export default {
    name: "diy-input-number",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbakOnKeyup', 'CallbackFormValueChange', 'update:modelValue'],
    data() {
        return {
            ModelValue: 0,
            LastModelValue: 0
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
                self.ModelValue = newVal || 0;
            }
        },
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelValue = self.ModelProps || 0;
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
            self.ModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel) || 0;
            self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel) || 0;
        },
        customColorMethod(percentage) {
            if (percentage == 0) {
                return "#d5d5d5"; //灰色
            } else if (percentage < 100) {
                return "#409eff"; //蓝色
            } else {
                return "#02b980"; //绿色
            }
        },
        GetStatus() {
            var self = this;
            if (!self.ModelValue) {
            }
            // (field.Config && field.Config.Progress && field.Config.Progress.Status) || ''
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
            self.ModelValue = item || 0;
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
                if (field.Component == "NumberText" && (field.V8Code || field.Config.V8Code)) {
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
                        OVal: self.LastModelValue || 0, //老值
                        NVal: self.ModelValue || 0 //新值
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
                        self.LastModelValue = self.ModelValue || 0;
                        self.DiyCommon.Tips(msg);
                    }
                });
            }
            self.$emit("CallbackFormValueChange", self.field, currentValue);
        },
        CommonV8CodeChange(item, field) {
            var self = this;
            if (field.V8Code || (field.Config && field.Config.V8Code)) {
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
        }
    }
};
</script>

<style lang="scss" scoped></style>
