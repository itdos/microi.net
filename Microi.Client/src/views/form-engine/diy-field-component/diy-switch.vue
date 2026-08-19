<template>
    <div
        v-if="field.Component == 'Switch' && UseCardDisplay"
        class="diy-switch-card"
        :class="['diy-switch-card--' + SwitchTone, { 'is-checked': ModelValue === 1, 'is-disabled': GetFieldReadOnly(field) }]"
    >
        <div class="diy-switch-card__content">
            <span v-if="SwitchCardIcon" class="diy-switch-card__icon" aria-hidden="true">
                <i :class="SwitchCardIcon"></i>
            </span>
            <span class="diy-switch-card__copy">
                <strong>{{ SwitchCardTitle }}</strong>
                <small v-if="SwitchCardDescription">{{ SwitchCardDescription }}</small>
            </span>
        </div>
        <div class="diy-switch-card__control">
            <span class="diy-switch-card__state">{{ SwitchStateText }}</span>
            <el-switch
                v-model="ModelValue"
                :active-value="1"
                :inactive-value="0"
                :disabled="GetFieldReadOnly(field)"
                :style="SwitchControlStyle"
                @change="HandleChange"
                @focus="SelectField(field)"
            />
        </div>
    </div>
    <el-switch
        v-else-if="field.Component == 'Switch'"
        v-model="ModelValue"
        :active-value="1"
        :inactive-value="0"
        :disabled="GetFieldReadOnly(field)"
        :style="SwitchControlStyle"
        @change="HandleChange"
        @focus="SelectField(field)"
    />

    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        class="mci-unified-dialog mci-field-config-dialog"
        :modal-class="SwitchOverlayClass"
        title="开关控件配置"
        width="620px"
        draggable
        align-center
        append-to-body
        destroy-on-close
        :close-on-click-modal="false"
    >
        <el-form label-position="top" size="small" class="diy-switch-config-form">
            <el-form-item label="显示方式">
                <el-radio-group v-model="configForm.DisplayMode">
                    <el-radio value="Standard">标准开关</el-radio>
                    <el-radio value="Card">说明卡片</el-radio>
                </el-radio-group>
            </el-form-item>
            <el-form-item label="视觉风格">
                <el-select v-model="configForm.VisualStyle" style="width: 220px">
                    <el-option label="主题色" value="primary" />
                    <el-option label="成功" value="success" />
                    <el-option label="警告" value="warning" />
                    <el-option label="危险" value="danger" />
                    <el-option label="信息" value="info" />
                </el-select>
            </el-form-item>
            <div class="diy-switch-config-grid">
                <el-form-item label="开启文案">
                    <el-input v-model="configForm.ActiveText" placeholder="已开启" />
                </el-form-item>
                <el-form-item label="关闭文案">
                    <el-input v-model="configForm.InactiveText" placeholder="已关闭" />
                </el-form-item>
            </div>
            <template v-if="configForm.DisplayMode === 'Card'">
                <el-form-item label="卡片标题">
                    <el-input v-model="configForm.Title" placeholder="为空时使用字段 Label" />
                </el-form-item>
                <el-form-item label="说明文字">
                    <el-input v-model="configForm.Description" type="textarea" :rows="3" placeholder="显示在标题下方，可为空" />
                </el-form-item>
                <el-form-item label="图标">
                    <div class="diy-switch-icon-picker">
                        <el-button class="diy-switch-icon-picker__preview" @click="openIconPicker">
                            <fa-icon :icon="configForm.Icon || 'fas fa-toggle-on'" />
                        </el-button>
                        <div class="diy-switch-icon-picker__copy">
                            <strong>{{ configForm.Icon || "未选择图标" }}</strong>
                            <small>点击左侧图标从平台图标库选择</small>
                        </div>
                        <el-button link type="primary" @click="openIconPicker">选择</el-button>
                        <el-button link type="danger" @click="configForm.Icon = ''">清空</el-button>
                    </div>
                    <Fontawesome v-if="iconPickerMounted" ref="iconPickerRef" v-model:model="configForm.Icon" />
                </el-form-item>
            </template>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script>
import { defineAsyncComponent } from "vue";
import { normalizeFormSwitchValue } from "@/utils/form-switch-value.js";

const Fontawesome = defineAsyncComponent(() => import("./dos.fontawesome/Fontawesome.vue"));

export default {
    name: "diy-switch",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbackFormValueChange', 'CallbackInTableEditSave', 'update:modelValue'],
    data() {
        return {
            ModelValue: 0,
            isInitializing: true, // 添加标志位，防止初始化时触发 change 事件
            configDialogVisible: false,
            iconPickerMounted: false,
            configForm: {
                DisplayMode: "Standard",
                VisualStyle: "primary",
                ActiveText: "已开启",
                InactiveText: "已关闭",
                Title: "",
                Description: "",
                Icon: ""
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
        SysMenuModel: {
            type: Object,
            default() {
                return {};
            }
        },
        SysConfig: {
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
                self.ModelValue = normalizeFormSwitchValue(newVal);
                // 标记初始化已完成
                if (self.isInitializing) {
                    self.$nextTick(() => {
                        self.isInitializing = false;
                    });
                }
            }
        },
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelValue = normalizeFormSwitchValue(self.ModelProps);
                // 标记初始化已完成
                if (self.isInitializing) {
                    self.$nextTick(() => {
                        self.isInitializing = false;
                    });
                }
            }
        }
    },

    components: {
        Fontawesome
    },

    computed: {
        SwitchConfig() {
            var config = this.field && this.field.Config && this.field.Config.Switch;
            return config && typeof config === "object" ? config : {};
        },
        UseCardDisplay() {
            return String(this.SwitchConfig.DisplayMode || "Standard").toLowerCase() === "card";
        },
        SwitchCardTitle() {
            return this.SwitchConfig.Title || this.field.Label || this.field.Name || "开关";
        },
        SwitchCardDescription() {
            return this.SwitchConfig.Description || this.field.Description || this.field.Placeholder || "";
        },
        SwitchCardIcon() {
            return this.SwitchConfig.Icon || "";
        },
        SwitchTone() {
            return this.SwitchConfig.VisualStyle || "primary";
        },
        SwitchToneColor() {
            var colors = {
                primary: "var(--el-color-primary, #409eff)",
                success: "var(--el-color-success, #67c23a)",
                warning: "var(--el-color-warning, #e6a23c)",
                danger: "var(--el-color-danger, #f56c6c)",
                info: "var(--el-color-info, #909399)"
            };
            return colors[this.SwitchTone] || colors.primary;
        },
        SwitchControlStyle() {
            return { "--el-switch-on-color": this.SwitchToneColor };
        },
        SwitchOverlayClass() {
            var value = this.SysConfig ? this.SysConfig.DisableFormMaskBlur : false;
            var blurDisabled = value === true || value === 1 || value === "1" || String(value || "").toLowerCase() === "true";
            return [
                "mci-unified-overlay",
                "mci-field-config-overlay",
                blurDisabled ? "mci-unified-overlay--plain" : ""
            ].filter(Boolean).join(" ");
        },
        SwitchStateText() {
            if (this.ModelValue === 1) {
                return this.SwitchConfig.ActiveText || "已开启";
            }
            return this.SwitchConfig.InactiveText || "已关闭";
        }
    },

    //注意：表单打开一次后，再次打开，这个不会第二次执行，导致值不会变
    mounted() {
        var self = this;
        self.Init();
    },

    methods: {
        openConfig() {
            var config = this.SwitchConfig;
            this.configForm = {
                DisplayMode: config.DisplayMode || "Standard",
                VisualStyle: config.VisualStyle || "primary",
                ActiveText: config.ActiveText || "已开启",
                InactiveText: config.InactiveText || "已关闭",
                Title: config.Title || "",
                Description: config.Description || "",
                Icon: config.Icon || ""
            };
            this.iconPickerMounted = false;
            this.configDialogVisible = true;
        },
        openIconPicker() {
            var self = this;
            self.iconPickerMounted = true;
            self.$nextTick(function () {
                if (self.$refs.iconPickerRef && typeof self.$refs.iconPickerRef.show === "function") {
                    self.$refs.iconPickerRef.show();
                }
            });
        },
        saveConfig() {
            if (!this.field.Config || typeof this.field.Config !== "object") {
                this.field.Config = {};
            }
            this.field.Config.Switch = {
                ...(this.field.Config.Switch || {}),
                ...this.configForm
            };
            this.configDialogVisible = false;
            this.DiyCommon.Tips("配置已保存", true);
        },
        HandleChange(item) {
            return this.CommonV8CodeChange(item, this.field);
        },
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
                return normalizeFormSwitchValue(form[field.AsName]);
            }
            return normalizeFormSwitchValue(form[field.Name]);
        },
        //必须
        ModelChangeMethods(item) {
            var self = this;
            self.ModelValue = normalizeFormSwitchValue(item);
            self.$emit("ModelChange", self.ModelValue);
            self.$emit("update:modelValue", self.ModelValue);
        },
        CommonV8CodeChange(item, field) {
            var self = this;
            
            // 如果正在初始化，不执行任何操作，避免初始化时触发保存和V8代码
            if (self.isInitializing) {
                return;
            }
            
            self.ModelChangeMethods(item);
            if ((field.V8Code || (field.Config && field.Config.V8Code))) {
                // self.RunV8Code(field, item)
                self.$emit("CallbackRunV8Code", { field: field, thisValue: item });
            }

            //如果是表内编辑，要自动保存
            if (self.TableInEdit && self.FormDiyTableModel._IsInTableAdd !== true) {
                // 让父组件（diy-table）中央接管：可实现 SysMenuModel.SaveType 的 Auto(全行保存) / Submit(批量提交)
                var __interceptPayload = { row: self.FormDiyTableModel, field: self.field, oldValue: self.LastModelValue, newValue: self.ModelValue, handled: false };
                self.$emit("CallbackInTableEditSave", __interceptPayload);
                if (__interceptPayload.handled === true) {
                    return;
                }
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
                        Label: field.Label || field.Name,
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
                if (self.SysMenuModel && self.SysMenuModel.AddBtnType == "InTable" && self.SysMenuModel.SaveType == "提交一起保存") {
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

<style lang="scss" scoped>
.diy-switch-card {
    --switch-tone: var(--el-color-primary, #409eff);
    width: 100%;
    min-height: 64px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    border: 1px solid var(--el-border-color-lighter, #e4e7ed);
    border-radius: 12px;
    background: var(--el-bg-color, #fff);
    color: var(--el-text-color-primary, #303133);
    transition: border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease;

    &:hover {
        border-color: color-mix(in srgb, var(--switch-tone) 34%, var(--el-border-color-lighter, #e4e7ed));
    }

    &.is-checked {
        border-color: color-mix(in srgb, var(--switch-tone) 42%, var(--el-border-color-lighter, #e4e7ed));
        background: color-mix(in srgb, var(--switch-tone) 5%, var(--el-bg-color, #fff));
        box-shadow: 0 8px 22px color-mix(in srgb, var(--switch-tone) 10%, transparent);
    }

    &.is-disabled {
        opacity: 0.72;
    }
}

.diy-switch-card--success { --switch-tone: var(--el-color-success, #67c23a); }
.diy-switch-card--warning { --switch-tone: var(--el-color-warning, #e6a23c); }
.diy-switch-card--danger { --switch-tone: var(--el-color-danger, #f56c6c); }
.diy-switch-card--info { --switch-tone: var(--el-color-info, #909399); }

.diy-switch-card__content,
.diy-switch-card__control {
    display: flex;
    align-items: center;
}

.diy-switch-card__content {
    min-width: 0;
    gap: 10px;
}

.diy-switch-card__icon {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    color: var(--switch-tone);
    background: color-mix(in srgb, var(--switch-tone) 10%, transparent);
}

.diy-switch-config-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.diy-switch-icon-picker {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
}

.diy-switch-icon-picker__preview {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border-radius: 12px;
}

.diy-switch-icon-picker__copy {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;

    strong,
    small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    small { color: var(--el-text-color-secondary, #909399); }
}

.diy-switch-card__copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;

    strong,
    small {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    strong {
        color: var(--el-text-color-primary, #303133);
        font-size: 14px;
        font-weight: 650;
        line-height: 1.35;
    }

    small {
        color: var(--el-text-color-secondary, #909399);
        font-size: 12px;
        line-height: 1.35;
        white-space: normal;
    }
}

.diy-switch-card__control {
    flex: 0 0 auto;
    gap: 8px;
}

.diy-switch-card__state {
    color: var(--el-text-color-secondary, #909399);
    font-size: 12px;
    white-space: nowrap;
}

@media (max-width: 560px) {
    .diy-switch-card {
        min-height: 58px;
        padding: 8px 10px;
    }

    .diy-switch-card__state {
        display: none;
    }

    .diy-switch-config-grid {
        grid-template-columns: 1fr;
        gap: 0;
    }
}
</style>
