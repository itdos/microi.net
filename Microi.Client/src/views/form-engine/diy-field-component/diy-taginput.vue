<template>
    <el-select
        v-model="ModelValue"
        multiple
        filterable
        allow-create
        default-first-option
        :reserve-keyword="false"
        :disabled="GetFieldReadOnly(field)"
        :placeholder="GetPlaceholder()"
        @change="TagChange"
    >
        <el-option v-for="tag in optionList" :key="tag" :label="tag" :value="tag" />
    </el-select>

    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="标签输入配置"
        width="560px"
        draggable
        align-center
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-position="top" size="small">
            <el-form-item label="占位提示">
                <el-input v-model="configForm.Placeholder" placeholder="请输入或选择标签" />
            </el-form-item>
            <el-form-item label="预设标签（一行一个）">
                <el-input v-model="configForm.OptionsText" type="textarea" :rows="6" />
            </el-form-item>
            <el-form-item label="最多标签数">
                <el-input-number v-model="configForm.MaxCount" :min="0" :step="1" />
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
    name: "diy-taginput",
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
                Placeholder: "请输入或选择标签",
                OptionsText: "",
                MaxCount: 0
            }
        };
    },
    computed: {
        tagConfig() {
            return this.field && this.field.Config && this.field.Config.TagInput ? this.field.Config.TagInput : {};
        },
        optionList() {
            var list = Array.isArray(this.tagConfig.Options) ? this.tagConfig.Options : [];
            var merged = list.concat(Array.isArray(this.ModelValue) ? this.ModelValue : []);
            return Array.from(new Set(merged.filter((item) => !this.DiyCommon.IsNull(item))));
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
        GetPlaceholder() {
            return this.field.Placeholder || this.tagConfig.Placeholder || "请输入或选择标签";
        },
        TagChange(value) {
            var maxCount = Number(this.tagConfig.MaxCount || 0);
            if (maxCount > 0 && value.length > maxCount) {
                value = value.slice(0, maxCount);
                this.ModelValue = value;
                this.DiyCommon.Tips("最多只能选择 " + maxCount + " 个标签", false);
            }
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
                Placeholder: this.tagConfig.Placeholder || "请输入或选择标签",
                OptionsText: Array.isArray(this.tagConfig.Options) ? this.tagConfig.Options.join("\n") : "",
                MaxCount: Number(this.tagConfig.MaxCount || 0)
            };
            this.configDialogVisible = true;
        },
        saveConfig() {
            if (!this.field.Config) this.field.Config = {};
            this.field.Config.TagInput = {
                Placeholder: this.configForm.Placeholder,
                Options: this.configForm.OptionsText.split("\n").map((item) => item.trim()).filter((item) => item),
                MaxCount: Number(this.configForm.MaxCount || 0)
            };
            this.configDialogVisible = false;
            this.DiyCommon.Tips("配置已保存", true);
        }
    }
};
</script>