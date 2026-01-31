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

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="按钮配置"
        width="500px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-form-item label="按钮样式">
                <el-radio-group v-model="configForm.Button.Type">
                    <el-radio value="">默认按钮</el-radio>
                    <el-radio value="primary">主要按钮</el-radio>
                    <el-radio value="success">成功按钮</el-radio>
                    <el-radio value="info">信息按钮</el-radio>
                    <el-radio value="warning">警告按钮</el-radio>
                    <el-radio value="danger">危险按钮</el-radio>
                </el-radio-group>
            </el-form-item>
            
            <el-form-item label="预览可点击">
                <el-radio-group v-model="configForm.Button.PreviewCanClick">
                    <el-radio :value="true">是</el-radio>
                    <el-radio :value="false">否</el-radio>
                </el-radio-group>
                <div class="form-item-tip">开启后在预览/查看模式下按钮仍可点击</div>
            </el-form-item>
            
            <el-form-item label="图标">
                <div style="display: flex; align-items: center;">
                    <span class="hand" style="display: inline-block; padding: 5px 10px; cursor: pointer; border: 1px solid #dcdfe6; border-radius: 4px; margin-right: 10px;" @click="$refs.refButtonIcon && $refs.refButtonIcon.show()">
                        <fa-icon :icon="DiyCommon.IsNull(configForm.Button.Icon) ? 'far fa-smile-wink' : configForm.Button.Icon" />
                    </span>
                    <el-input v-model="configForm.Button.Icon" placeholder="图标类名" style="flex: 1;" />
                </div>
                <Fontawesome ref="refButtonIcon" v-model:model="configForm.Button.Icon" />
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
import Fontawesome from "./dos.fontawesome/Fontawesome.vue";

export default {
    name: "diy-button",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'update:modelValue'],
    components: {
        Fontawesome
    },
    data() {
        return {
            ModelValue: "",
            LastModelValue: "",
            // 配置弹窗相关
            configDialogVisible: false,
            configForm: {
                Button: {
                    Type: '',
                    PreviewCanClick: false,
                    Icon: ''
                }
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
        },
        // ==================== 配置弹窗相关方法 ====================
        openConfig() {
            var self = this;
            // 初始化配置表单
            if (!self.field.Config) {
                self.field.Config = {};
            }
            if (!self.field.Config.Button) {
                self.field.Config.Button = {};
            }
            self.configForm = {
                Button: {
                    Type: self.field.Config.Button.Type || '',
                    PreviewCanClick: self.field.Config.Button.PreviewCanClick || false,
                    Icon: self.field.Config.Button.Icon || ''
                }
            };
            self.configDialogVisible = true;
        },
        saveConfig() {
            var self = this;
            // 保存配置到 field.Config
            if (!self.field.Config.Button) {
                self.field.Config.Button = {};
            }
            self.field.Config.Button.Type = self.configForm.Button.Type;
            self.field.Config.Button.PreviewCanClick = self.configForm.Button.PreviewCanClick;
            self.field.Config.Button.Icon = self.configForm.Button.Icon;
            
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
