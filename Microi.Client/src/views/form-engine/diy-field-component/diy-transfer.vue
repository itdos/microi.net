<template>
    <el-transfer
        v-model="ModelValue"
        :data="transferData"
        :filterable="transferConfig.Filterable"
        :titles="[transferConfig.LeftTitle, transferConfig.RightTitle]"
        :disabled="GetFieldReadOnly(field)"
        @change="TransferChange"
    />

    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="穿梭框配置"
        width="620px"
        draggable
        align-center
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-position="top" size="small">
            <el-form-item label="左侧标题">
                <el-input v-model="configForm.LeftTitle" />
            </el-form-item>
            <el-form-item label="右侧标题">
                <el-input v-model="configForm.RightTitle" />
            </el-form-item>
            <el-form-item label="可搜索">
                <el-switch v-model="configForm.Filterable" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
            <el-form-item label="选项配置（一行一个，支持 key|label）">
                <el-input v-model="configForm.OptionsText" type="textarea" :rows="8" />
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
    name: "diy-transfer",
    inheritAttrs: false,
    emits: ["ModelChange", "CallbackFormValueChange", "update:modelValue"],
    props: {
        modelValue: {},
        ModelProps: {},
        field: { type: Object, default: () => ({}) },
        FormDiyTableModel: { type: Object, default: () => ({}) },
        FormMode: { type: String, default: "" },
        ReadonlyFields: { type: Array, default: () => [] },
        FieldReadonly: { type: Boolean, default: null }
    },
    data() {
        return {
            ModelValue: [],
            configDialogVisible: false,
            configForm: {
                LeftTitle: "可选项",
                RightTitle: "已选项",
                Filterable: true,
                OptionsText: ""
            }
        };
    },
    computed: {
        transferConfig() {
            var config = this.field && this.field.Config && this.field.Config.Transfer ? this.field.Config.Transfer : {};
            return {
                LeftTitle: config.LeftTitle || "可选项",
                RightTitle: config.RightTitle || "已选项",
                Filterable: config.Filterable !== false,
                Options: Array.isArray(config.Options) ? config.Options : []
            };
        },
        transferData() {
            return this.transferConfig.Options.map((item, index) => {
                if (typeof item === "string") {
                    return { key: item, label: item };
                }
                return {
                    key: item.Key || item.key || item.Value || item.value || String(index),
                    label: item.Label || item.label || item.Value || item.value || item.Name || item.name || String(index)
                };
            });
        }
    },
    watch: {
        modelValue(newVal, oldVal) {
            if (newVal !== oldVal) this.ModelValue = this.NormalizeValue(newVal);
        },
        ModelProps(newVal, oldVal) {
            if (newVal !== oldVal) this.ModelValue = this.NormalizeValue(newVal);
        }
    },
    mounted() {
        this.ModelValue = this.NormalizeValue(this.GetFieldValue());
    },
    methods: {
        GetFieldValue() {
            var fieldName = this.DiyCommon.IsNull(this.field.AsName) ? this.field.Name : this.field.AsName;
            return this.FormDiyTableModel[fieldName];
        },
        NormalizeValue(value) {
            if (Array.isArray(value)) return value;
            if (typeof value === "string" && value) {
                try {
                    var parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {
                    return value.split(",").map((item) => item.trim()).filter((item) => item);
                }
            }
            return [];
        },
        TransferChange(value) {
            var fieldName = this.DiyCommon.IsNull(this.field.AsName) ? this.field.Name : this.field.AsName;
            this.FormDiyTableModel[fieldName] = value;
            this.$emit("ModelChange", value);
            this.$emit("update:modelValue", value);
            this.$emit("CallbackFormValueChange", this.field, value);
        },
        GetFieldReadOnly(field) {
            if (this.FieldReadonly === true || this.FormMode === "View") return true;
            if (this.ReadonlyFields.indexOf(field.Name) > -1) return true;
            return field.Readonly ? true : false;
        },
        openConfig() {
            this.configForm = {
                LeftTitle: this.transferConfig.LeftTitle,
                RightTitle: this.transferConfig.RightTitle,
                Filterable: this.transferConfig.Filterable,
                OptionsText: this.transferConfig.Options.map((item) => {
                    if (typeof item === "string") return item;
                    return (item.Key || item.key || "") + "|" + (item.Label || item.label || item.Value || item.value || "");
                }).join("\n")
            };
            this.configDialogVisible = true;
        },
        saveConfig() {
            if (!this.field.Config) this.field.Config = {};
            var options = this.configForm.OptionsText.split("\n").map((line) => {
                var value = line.trim();
                if (!value) return null;
                var parts = value.split("|");
                if (parts.length > 1) {
                    return { Key: parts[0].trim(), Label: parts.slice(1).join("|").trim() };
                }
                return value;
            }).filter((item) => item);
            this.field.Config.Transfer = {
                LeftTitle: this.configForm.LeftTitle,
                RightTitle: this.configForm.RightTitle,
                Filterable: this.configForm.Filterable,
                Options: options
            };
            this.configDialogVisible = false;
            this.DiyCommon.Tips("配置已保存", true);
        }
    }
};
</script>

<style lang="scss" scoped>
:deep(.el-transfer) {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}
</style>