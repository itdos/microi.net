<template>
    <el-slider
        v-model="ModelValue"
        :disabled="GetFieldReadOnly(field)"
        :min="sliderConfig.Min"
        :max="sliderConfig.Max"
        :step="sliderConfig.Step"
        :range="sliderConfig.Range"
        :show-input="sliderConfig.ShowInput && !sliderConfig.Range"
        :show-stops="sliderConfig.ShowStops"
        @change="SliderChange"
    />

    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="滑块配置"
        width="520px"
        draggable
        align-center
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-position="top" size="small">
            <el-form-item label="最小值">
                <el-input-number v-model="configForm.Min" :step="1" />
            </el-form-item>
            <el-form-item label="最大值">
                <el-input-number v-model="configForm.Max" :step="1" />
            </el-form-item>
            <el-form-item label="步长">
                <el-input-number v-model="configForm.Step" :min="0.01" :step="1" :precision="2" />
            </el-form-item>
            <el-form-item label="范围选择">
                <el-switch v-model="configForm.Range" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
            <el-form-item label="显示输入框">
                <el-switch v-model="configForm.ShowInput" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
            <el-form-item label="显示间断点">
                <el-switch v-model="configForm.ShowStops" active-color="#ff6c04" inactive-color="#ccc" />
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
    name: "diy-slider",
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
            ModelValue: 0,
            configDialogVisible: false,
            configForm: {
                Min: 0,
                Max: 100,
                Step: 1,
                Range: false,
                ShowInput: false,
                ShowStops: false
            }
        };
    },
    computed: {
        sliderConfig() {
            var config = this.field && this.field.Config && this.field.Config.Slider ? this.field.Config.Slider : {};
            return {
                Min: Number(config.Min ?? 0),
                Max: Number(config.Max ?? 100),
                Step: Number(config.Step ?? 1),
                Range: config.Range === true,
                ShowInput: config.ShowInput === true,
                ShowStops: config.ShowStops === true
            };
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
            if (this.sliderConfig.Range) {
                if (Array.isArray(value)) return value;
                if (typeof value === "string" && value) {
                    try {
                        var parsed = JSON.parse(value);
                        if (Array.isArray(parsed)) return parsed;
                    } catch (e) {}
                }
                return [this.sliderConfig.Min, this.sliderConfig.Max];
            }
            if (this.DiyCommon.IsNull(value)) return this.sliderConfig.Min;
            return Number(value);
        },
        SliderChange(value) {
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
            this.configForm = { ...this.sliderConfig };
            this.configDialogVisible = true;
        },
        saveConfig() {
            if (!this.field.Config) this.field.Config = {};
            this.field.Config.Slider = { ...this.configForm };
            this.configDialogVisible = false;
            this.DiyCommon.Tips("配置已保存", true);
        }
    }
};
</script>