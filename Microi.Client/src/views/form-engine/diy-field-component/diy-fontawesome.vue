<template>
    <section v-if="field.Component == 'FontAwesome' || field.Component == 'Fontawesome'">
        <div class="diy-fontawesome-preview" :style="FontAwesomePreviewStyle" @click="IconClick()">
            <fa-icon :icon="DiyCommon.IsNull(ModelValue) ? (FontAwesomeConfig.DefaultIcon || 'Operation') : ModelValue" />
        </div>
        <el-button v-if="FontAwesomeConfig.AllowClear !== false && ModelValue && !GetFieldReadOnly(field)" link type="danger" @click.stop="handleIconChange('')">清空</el-button>
        <Fontawesome :ref="'control_' + field.Name" :model="ModelValue" @update:model="handleIconChange"> </Fontawesome>
    </section>
    <DiySimpleFieldConfigDialog ref="simpleConfig" component="FontAwesome" component-label="图标库" :field="field" :DiyTableModel="DiyTableModel" />
</template>

<script>
import DiySimpleFieldConfigDialog from "./shared/DiySimpleFieldConfigDialog.vue";
export default {
    name: "diy-fontawesome",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbackFormValueChange', 'CallbackInTableEditSave', 'update:modelValue'],
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
            default: () => ({})
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
        SysMenuModel: {
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
                self.CommonV8CodeChange(self.ModelValue, self.field);
            }
        },
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelValue = self.ModelProps;
                self.CommonV8CodeChange(self.ModelValue, self.field);
            }
        },
        ModelValue: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelChangeMethods();
                self.CommonV8CodeChange(self.ModelValue, self.field);
            }
        }
    },

    components: { DiySimpleFieldConfigDialog },

    computed: {
        FontAwesomeConfig() {
            return this.field?.Config?.FontAwesome || {};
        },
        FontAwesomePreviewStyle() {
            const size = Number(this.FontAwesomeConfig.PreviewSize || 32);
            return { width: `${size}px`, height: `${size}px` };
        }
    },

    //注意：表单打开一次后，再次打开，这个不会第二次执行，导致值不会变
    mounted() {
        var self = this;
        self.Init();
    },

    methods: {
        openConfig() {
            this.$refs.simpleConfig.open();
        },
        //必须
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
        //必须
        ModelChangeMethods() {
            var self = this;
            self.$emit("ModelChange", self.ModelValue);
            self.$emit("update:modelValue", self.ModelValue);
        },
        IconClick() {
            var self = this;
            self.SelectField(self.field);
            if (self.GetFieldReadOnly(self.field) || self.FormMode == "View") {
                return;
            }
            self.$refs["control_" + self.field.Name].show();
        },
        handleIconChange(newIcon) {
            var self = this;
            self.ModelValue = newIcon;
            // 立即触发更新事件，确保父组件能接收到新值
            self.$emit("ModelChange", newIcon);
            self.$emit("update:modelValue", newIcon);
            if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
                var __interceptPayload = { row: self.FormDiyTableModel, field: self.field, oldValue: self.LastModelValue, newValue: self.ModelValue, handled: false };
                self.$emit("CallbackInTableEditSave", __interceptPayload);
                if (__interceptPayload.handled === true) { self.LastModelValue = self.ModelValue; return; }
            }
        },
        CommonV8CodeChange(item, field) {
            var self = this;
            if (field.V8Code || field.Config.V8Code) {
                // self.RunV8Code(field, item)
                self.$emit("CallbackRunV8Code", { field: field, thisValue: item });
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
        SelectField(field) {
            var self = this;
            self.$emit("CallbackSelectField", field);
        }
    }
};
</script>

<style lang="scss" scoped>
section { display: flex; align-items: center; gap: 6px; }
.diy-fontawesome-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 9px;
    background: var(--el-fill-color-light);
    color: var(--el-color-primary);
    cursor: pointer;
}
</style>
