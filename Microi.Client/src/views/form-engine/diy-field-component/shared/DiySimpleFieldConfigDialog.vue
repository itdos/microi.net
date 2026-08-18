<template>
    <el-dialog
        v-model="visible"
        class="mci-unified-dialog mci-field-config-dialog"
        modal-class="mci-unified-overlay mci-field-config-overlay"
        width="660px"
        draggable
        align-center
        append-to-body
        destroy-on-close
        :show-close="false"
        :close-on-click-modal="false"
    >
        <template #header>
            <div class="mci-field-config-heading">
                <span>FIELD SETTINGS</span>
                <h2>{{ displayLabel }} <em>{{ field?.Name || "未命名字段" }}</em></h2>
                <p>{{ tableLabel }}<template v-if="physicalTableName"> · 表名：{{ physicalTableName }}</template> · {{ componentLabel }}<template v-if="fieldDescription"> · {{ fieldDescription }}</template></p>
            </div>
            <el-button text class="mci-field-config-heading__close" @click="visible = false">×</el-button>
        </template>

        <el-form label-position="top" class="mci-component-config-form">
            <section class="mci-component-config-section">
                <header><strong>{{ componentLabel }}</strong><small>这里只维护该控件自身的显示与交互参数</small></header>

                <template v-if="component === 'ColorPicker'">
                    <div class="mci-component-config-grid">
                        <el-form-item label="启用透明度"><el-switch v-model="form.ShowAlpha" /></el-form-item>
                        <el-form-item label="颜色格式">
                            <el-select v-model="form.Format"><el-option label="HEX" value="hex" /><el-option label="RGB" value="rgb" /><el-option label="HSL" value="hsl" /><el-option label="HSV" value="hsv" /></el-select>
                        </el-form-item>
                        <el-form-item label="控件尺寸">
                            <el-select v-model="form.Size"><el-option label="小" value="small" /><el-option label="默认" value="default" /><el-option label="大" value="large" /></el-select>
                        </el-form-item>
                    </div>
                    <el-form-item label="预设颜色"><el-input v-model="form.PredefineText" type="textarea" :rows="3" placeholder="#409EFF, #67C23A（逗号或换行分隔）" /></el-form-item>
                </template>

                <template v-else-if="component === 'Address'">
                    <div class="mci-component-config-grid">
                        <el-form-item label="显示完整路径"><el-switch v-model="form.ShowAllLevels" /></el-form-item>
                        <el-form-item label="父子节点可独立选择"><el-switch v-model="form.CheckStrictly" /></el-form-item>
                        <el-form-item label="路径分隔符"><el-input v-model="form.Separator" placeholder=" / " /></el-form-item>
                    </div>
                </template>

                <template v-else-if="component === 'FontAwesome'">
                    <div class="mci-component-config-grid">
                        <el-form-item label="允许清空"><el-switch v-model="form.AllowClear" /></el-form-item>
                        <el-form-item label="预览尺寸"><el-input-number v-model="form.PreviewSize" :min="24" :max="64" /></el-form-item>
                    </div>
                    <el-form-item label="空值默认图标"><el-input v-model="form.DefaultIcon" placeholder="Operation" /></el-form-item>
                </template>

                <template v-else-if="component === 'Progress'">
                    <div class="mci-component-config-grid">
                        <el-form-item label="进度条类型"><el-select v-model="form.Type"><el-option label="线形" value="line" /><el-option label="圆形" value="circle" /><el-option label="仪表盘" value="dashboard" /></el-select></el-form-item>
                        <el-form-item label="线条宽度"><el-input-number v-model="form.StrokeWidth" :min="2" :max="32" /></el-form-item>
                        <el-form-item label="显示百分比"><el-switch v-model="form.ShowText" /></el-form-item>
                        <el-form-item label="文字置于内部"><el-switch v-model="form.TextInside" :disabled="form.Type !== 'line'" /></el-form-item>
                        <el-form-item label="主题状态"><el-select v-model="form.Status" clearable><el-option label="成功" value="success" /><el-option label="警告" value="warning" /><el-option label="异常" value="exception" /></el-select></el-form-item>
                        <el-form-item label="自定义颜色"><el-color-picker v-model="form.Color" /></el-form-item>
                    </div>
                </template>

                <template v-else-if="component === 'Qrcode'">
                    <div class="mci-component-config-grid">
                        <el-form-item label="预览宽度"><el-input-number v-model="form.DisplayWidth" :min="120" :max="800" /></el-form-item>
                        <el-form-item label="显示下载按钮"><el-switch v-model="form.ShowDownload" /></el-form-item>
                    </div>
                    <el-form-item v-if="form.ShowDownload" label="下载按钮文案"><el-input v-model="form.DownloadText" placeholder="下载二维码" /></el-form-item>
                </template>

                <template v-else-if="component === 'Rate'">
                    <div class="mci-component-config-grid">
                        <el-form-item label="最大分值"><el-input-number v-model="form.Max" :min="1" :max="20" /></el-form-item>
                        <el-form-item label="允许半星"><el-switch v-model="form.AllowHalf" /></el-form-item>
                        <el-form-item label="允许清空"><el-switch v-model="form.Clearable" /></el-form-item>
                        <el-form-item label="显示分数"><el-switch v-model="form.ShowScore" /></el-form-item>
                    </div>
                    <el-form-item v-if="form.ShowScore" label="分数模板"><el-input v-model="form.ScoreTemplate" placeholder="{value} 分" /></el-form-item>
                </template>
            </section>
        </el-form>

        <template #footer>
            <el-button @click="visible = false">取消</el-button>
            <el-button type="primary" @click="save">保存控件配置</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from "vue";

const props = defineProps({
    component: { type: String, required: true },
    componentLabel: { type: String, required: true },
    field: { type: Object, required: true },
    DiyTableModel: { type: Object, default: () => ({}) }
});

const visible = ref(false);
const form = reactive({});
const defaults = {
    ColorPicker: { ShowAlpha: false, Format: "hex", Size: "default", Predefine: [], PredefineText: "" },
    Address: { ShowAllLevels: true, CheckStrictly: false, Separator: " / " },
    FontAwesome: { AllowClear: true, PreviewSize: 32, DefaultIcon: "Operation" },
    Progress: { Type: "line", StrokeWidth: 18, ShowText: true, TextInside: true, Status: "", Color: "" },
    Qrcode: { DisplayWidth: 400, ShowDownload: true, DownloadText: "下载二维码" },
    Rate: { Max: 5, AllowHalf: false, Clearable: true, ShowScore: false, ScoreTemplate: "{value} 分" }
};

const displayLabel = computed(() => props.field?.Label || props.field?.Name || "字段设置");
const fieldDescription = computed(() => props.field?.Description || props.field?.Placeholder || "");
const tableLabel = computed(() => props.DiyTableModel?.Description || props.DiyTableModel?.Name || props.field?.TableName || "当前表单");
const physicalTableName = computed(() => props.DiyTableModel?.Name || props.field?.TableName || "");

function open() {
    const current = props.field?.Config?.[props.component];
    const value = { ...(defaults[props.component] || {}), ...(current && typeof current === "object" ? current : {}) };
    if (props.component === "ColorPicker") {
        value.PredefineText = Array.isArray(value.Predefine) ? value.Predefine.join(", ") : String(value.PredefineText || "");
    }
    Object.keys(form).forEach((key) => delete form[key]);
    Object.assign(form, value);
    visible.value = true;
}

function save() {
    const value = { ...form };
    if (props.component === "ColorPicker") {
        value.Predefine = String(value.PredefineText || "").split(/[,，\n]/).map(item => item.trim()).filter(Boolean);
        delete value.PredefineText;
    }
    if (!props.field.Config || typeof props.field.Config !== "object") props.field.Config = {};
    props.field.Config[props.component] = value;
    visible.value = false;
}

defineExpose({ open });
</script>

<style scoped lang="scss">
.mci-field-config-heading {
    min-width: 0;
    span { color: var(--el-color-primary); font-size: 11px; font-weight: 750; letter-spacing: .14em; }
    h2 { margin: 3px 0 0; color: var(--el-text-color-primary); font-size: 21px; line-height: 1.25; }
    h2 em { margin-left: 8px; color: var(--el-color-primary); font-size: .76em; font-style: normal; font-weight: 650; }
    p { margin: 4px 0 0; overflow: hidden; color: var(--el-text-color-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
}
.mci-field-config-heading__close { display: inline-flex; align-items: center; justify-content: center; margin-left: auto; font-size: 22px; }
.mci-component-config-section { padding: 0; border: 0; border-radius: 0; background: transparent; }
.mci-component-config-section > header {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 18px;
    padding-bottom: 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--el-color-primary) 11%, var(--el-border-color-lighter));
}
.mci-component-config-section > header strong { color: var(--el-text-color-primary); font-size: 15px; }
.mci-component-config-section > header small { color: var(--el-text-color-secondary); }
.mci-component-config-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.mci-component-config-form :deep(.el-select), .mci-component-config-form :deep(.el-input-number) { width: 100%; }
@media (max-width: 620px) { .mci-component-config-grid { grid-template-columns: 1fr; } }
</style>
