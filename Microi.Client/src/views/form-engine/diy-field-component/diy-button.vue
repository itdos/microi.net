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

            <el-form-item label="点击后刷新表格">
                <el-radio-group v-model="configForm.Button.RefreshTableAfterClick">
                    <el-radio :value="true">是</el-radio>
                    <el-radio :value="false">否</el-radio>
                </el-radio-group>
                <div class="form-item-tip">开启后，按钮V8执行成功后刷新当前表格；也可在V8中手动调用 V8.RefreshTable({ _PageIndex: 1 })</div>
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
                    RefreshTableAfterClick: false,
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
        NormalizeBoolean(value, defaultValue) {
            if (value === undefined || value === null || value === "") {
                return defaultValue;
            }
            return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
        },
        ShouldRefreshTableAfterClick(field) {
            var self = this;
            return !!(field
                && field.Config
                && field.Config.Button
                && self.NormalizeBoolean(field.Config.Button.RefreshTableAfterClick, false));
        },
        GetRefreshEventDetail() {
            var self = this;
            // 尝试从可用来源获取标识，以供 diy-table 精确匹配
            var sysMenuId = null;
            var tableId = null;

            // 优先从当前组件自身的已知字段取
            if (self.SysMenuModel && self.SysMenuModel.SysMenuId) sysMenuId = self.SysMenuModel.SysMenuId;
            if (!sysMenuId && self.FormDiyTableModel && self.FormDiyTableModel.SysMenuId) sysMenuId = self.FormDiyTableModel.SysMenuId;
            if (!sysMenuId && self.DiyTableModel && self.DiyTableModel.SysMenuId) sysMenuId = self.DiyTableModel.SysMenuId;
            if (!tableId && self.TableId) tableId = self.TableId;
            if (!tableId && self.FormDiyTableModel && self.FormDiyTableModel.TableId) tableId = self.FormDiyTableModel.TableId;
            if (!tableId && self.DiyTableModel && self.DiyTableModel.Id) tableId = self.DiyTableModel.Id;

            try {
                var vm = self.$parent;
                var safety = 0;
                while (vm && safety++ < 20 && (!sysMenuId || !tableId)) {
                    if (!sysMenuId) {
                        if (vm.SysMenuId) sysMenuId = vm.SysMenuId;
                        else if (vm.PropsSysMenuId) sysMenuId = vm.PropsSysMenuId;
                        else if (vm.SysMenuModel && vm.SysMenuModel.Id) sysMenuId = vm.SysMenuModel.Id;
                    }
                    if (!tableId) {
                        if (vm.TableId) tableId = vm.TableId;
                        else if (vm.PropsTableId) tableId = vm.PropsTableId;
                        else if (vm.DiyTableModel && vm.DiyTableModel.Id) tableId = vm.DiyTableModel.Id;
                    }
                    if (sysMenuId && tableId) break;
                    vm = vm.$parent;
                }
            } catch (e) {
                // ignore
            }

            // 最后回退到路由上的 meta
            if (!sysMenuId && self.$route && self.$route.meta) sysMenuId = self.$route.meta.Id || self.$route.meta.SysMenuId || null;
            if (!tableId && self.$route && self.$route.meta) tableId = self.$route.meta.DiyTableId || self.$route.meta.TableId || null;

            return {
                sysMenuId: sysMenuId,
                tableId: tableId,
                formModelId: (self.FormDiyTableModel && self.FormDiyTableModel.Id) || null,
                timestamp: new Date().getTime()
            };
        },
        DispatchTableRefresh(param) {
            var detail = this.GetRefreshEventDetail();
            detail.param = param || { _PageIndex: 1 };
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('table-refresh', { detail }));
            }, 100);
        },
        /**
         * 按钮点击事件
         */
        ComponentButtonClick(field) {
            var self = this;
            console.log(field,8888888888)
            // 触发V8代码执行
            self.$emit("CallbackRunV8Code", {
                field: field,
                thisValue: self.ModelValue,
                callback: (res) => {
                    try {
                        // 如果回调显式返回 false，或 V8 执行异常返回 null，则不刷新
                        if (res === false || res === null) return;
                        if (!self.ShouldRefreshTableAfterClick(field)) return;
                        self.DispatchTableRefresh({ _PageIndex: 1 });
                    } catch (e) {
                        // 忽略派发失败，不影响主流程
                    }
                }
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
                    PreviewCanClick: self.NormalizeBoolean(self.field.Config.Button.PreviewCanClick, false),
                    RefreshTableAfterClick: self.NormalizeBoolean(self.field.Config.Button.RefreshTableAfterClick, false),
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
            self.field.Config.Button.PreviewCanClick = self.configForm.Button.PreviewCanClick === true;
            self.field.Config.Button.RefreshTableAfterClick = self.configForm.Button.RefreshTableAfterClick === true;
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
