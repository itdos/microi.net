<template>
    <el-switch
        v-if="field.Component == 'Switch'"
        v-model="ModelValue"
        :active-value="1"
        :inactive-value="0"
        :disabled="GetFieldReadOnly(field)"
        active-color="#13ce66"
        inactive-color="#ccc"
        @change="
            (item) => {
                return CommonV8CodeChange(item, field);
            }
        "
        @focus="SelectField(field)"
    />
</template>

<script>
export default {
    name: "diy-input",
    data() {
        return {
            ModelValue: 0,
            isInitializing: true // 添加标志位，防止初始化时触发 change 事件
        };
    },
    model: {
        prop: "ModelProps",
        event: "ModelChange"
    },
    props: {
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
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelValue = self.ModelProps ? 1 : 0;
                // 标记初始化已完成
                if (self.isInitializing) {
                    self.$nextTick(() => {
                        self.isInitializing = false;
                    });
                }
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
            // 在下一个tick后标记初始化完成，避免初始赋值触发 change
            self.$nextTick(() => {
                self.isInitializing = false;
            });
        },
        GetFieldValue(field, form) {
            var self = this;
            if (field.AsName) {
                return form[field.AsName] ? 1 : 0;
            }
            return form[field.Name] ? 1 : 0;
        },
        //必须
        ModelChangeMethods(item) {
            var self = this;
            self.ModelValue = item ? 1 : 0;
            self.$emit("ModelChange", self.ModelValue);
        },
        CommonV8CodeChange(item, field) {
            var self = this;
            
            // 如果正在初始化，不执行任何操作，避免初始化时触发保存和V8代码
            if (self.isInitializing) {
                return;
            }
            
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
                param._FormData[self.field.Name] = self.ModelValue ? 1 : 0;
                let dataLog = [
                    {
                        Name: field.Name,
                        Label: field.Label || key,
                        Component: field.Component,
                        OVal: self.LastModelValue ? 1 : 0, //老值
                        NVal: self.ModelValue ? 1 : 0 //新值
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
            // if(field.Component == 'Switch'
            //     && field.Config.Button.PreviewCanClick === true
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
        SelectField(field) {
            var self = this;
            self.$emit("CallbackSelectField", field);
        }
    }
};
</script>

<style lang="scss" scoped></style>
