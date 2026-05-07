<template>
    <div class="diy-html" :style="htmlStyle" v-safe-html="htmlContent"></div>

    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="HTML内容配置"
        width="680px"
        draggable
        align-center
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="110px" label-position="top" size="small">
            <el-form-item label="内容来源">
                <el-radio-group v-model="configForm.UseFieldValue">
                    <el-radio :value="false">使用配置内容</el-radio>
                    <el-radio :value="true">使用字段值</el-radio>
                </el-radio-group>
            </el-form-item>
            <el-form-item v-if="!configForm.UseFieldValue" label="HTML内容">
                <el-input v-model="configForm.Content" type="textarea" :rows="8" placeholder="支持已启用的安全 HTML" />
            </el-form-item>
            <el-form-item label="最小高度">
                <el-input v-model="configForm.MinHeight" placeholder="如：80px，可为空" />
            </el-form-item>
            <el-form-item label="内边距">
                <el-input v-model="configForm.Padding" placeholder="如：8px 12px，可为空" />
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script>
export default {
    name: "diy-html",
    inheritAttrs: false,
    emits: ["ModelChange", "CallbackSelectField", "update:modelValue"],
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
        FormMode: {
            type: String,
            default: ""
        }
    },
    data() {
        return {
            configDialogVisible: false,
            configForm: {
                Content: "",
                UseFieldValue: false,
                MinHeight: "",
                Padding: ""
            }
        };
    },
    computed: {
        htmlConfig() {
            if (!this.field.Config) {
                this.field.Config = {};
            }
            if (!this.field.Config.Html) {
                this.field.Config.Html = {};
            }
            return this.field.Config.Html;
        },
        htmlContent() {
            if (this.htmlConfig.UseFieldValue === true) {
                var fieldName = this.DiyCommon.IsNull(this.field.AsName) ? this.field.Name : this.field.AsName;
                return this.FormDiyTableModel[fieldName] || "";
            }
            return this.htmlConfig.Content || this.field.Description || "";
        },
        htmlStyle() {
            return {
                minHeight: this.htmlConfig.MinHeight || "",
                padding: this.htmlConfig.Padding || ""
            };
        }
    },
    methods: {
        openConfig() {
            this.configForm = {
                Content: this.htmlConfig.Content || "",
                UseFieldValue: this.htmlConfig.UseFieldValue === true,
                MinHeight: this.htmlConfig.MinHeight || "",
                Padding: this.htmlConfig.Padding || ""
            };
            this.configDialogVisible = true;
        },
        saveConfig() {
            this.field.Config.Html = {
                ...this.htmlConfig,
                ...this.configForm
            };
            this.configDialogVisible = false;
            this.DiyCommon.Tips("配置已保存", true);
        },
        SelectField(field) {
            this.$emit("CallbackSelectField", field);
        }
    }
};
</script>

<style lang="scss" scoped>
.diy-html {
    width: 100%;
    font-size: 14px;
    line-height: 22px;
    color: var(--el-text-color-regular);
    word-break: break-word;
}
</style>