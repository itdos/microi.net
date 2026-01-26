<template>
    <!--按钮-->
    <!-- :size="field.Config.Button.Size == 'mini' ? 'small' : field.Config.Button.Size" -->
    <el-button
        v-if="field.Component == 'Button'"
        :type="GetFieldConfigButtonType(field)"
        :disabled="GetFieldReadOnly(field)"
        :loading="field.Config.Button.Loading"
        :icon="$getIcon(field.Config.Button.Icon)"
        @click="ComponentButtonClick(field)"
    >
        {{ field.Label }}
    </el-button>
</template>

<script>
import _ from "underscore";
export default {
    name: "diy-button",
    data() {
        return {
            ModelValue: "",
            LastModelValue: ""
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
        },
        /**
         * 获取按钮类型
         */
        GetFieldConfigButtonType(field) {
            var self = this;
            if (field.Config && field.Config.Button && field.Config.Button.Type) {
                return field.Config.Button.Type;
            }
            return "";
        },
        /**
         * 按钮点击事件
         */
        ComponentButtonClick(field) {
            var self = this;
            // 触发V8代码执行
            self.$emit("CallbackRunV8Code", {
                field: field,
                thisValue: self.ModelValue,
                callback: (res) => {}
            });
        },
        GetFieldReadOnly(field) {
            var self = this;
            // 如果按钮设置了预览可点击，且不为只读，则返回false(不禁用)
            if (field.Component == 'Button'
                && field.Config.Button && field.Config.Button.PreviewCanClick === true
                && !field.Readonly
                && !(self.ReadonlyFields.indexOf(field.Name) > -1)) {
                return false;
            }
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
        }
    }
};
</script>

<style lang="scss" scoped></style>
