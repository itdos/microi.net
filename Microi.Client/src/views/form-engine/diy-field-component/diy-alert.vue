<template>
    <div class="diy-alert" :class="['diy-alert--' + alertType, 'diy-alert--' + effect]">
        <div class="diy-alert__icon" v-if="showIcon">
            <fa-icon :class="iconClass" />
        </div>
        <div class="diy-alert__body">
            <div class="diy-alert__title" v-if="title" v-safe-html="title"></div>
            <div class="diy-alert__content" v-if="content" v-safe-html="content"></div>
        </div>
    </div>

    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="提示说明配置"
        width="560px"
        draggable
        align-center
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-form-item label="标题">
                <el-input v-model="configForm.Title" placeholder="默认使用字段标题" />
            </el-form-item>
            <el-form-item label="说明内容">
                <el-input v-model="configForm.Content" type="textarea" :rows="5" placeholder="支持已启用的安全 HTML" />
            </el-form-item>
            <el-form-item label="类型">
                <el-radio-group v-model="configForm.Type">
                    <el-radio value="info">信息</el-radio>
                    <el-radio value="success">成功</el-radio>
                    <el-radio value="warning">警告</el-radio>
                    <el-radio value="danger">危险</el-radio>
                </el-radio-group>
            </el-form-item>
            <el-form-item label="样式">
                <el-radio-group v-model="configForm.Effect">
                    <el-radio value="light">浅色</el-radio>
                    <el-radio value="plain">朴素</el-radio>
                </el-radio-group>
            </el-form-item>
            <el-form-item label="显示图标">
                <el-switch v-model="configForm.ShowIcon" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from "vue";

defineOptions({
    name: "diy-alert",
    inheritAttrs: false
});

const props = defineProps({
    field: {
        type: Object,
        required: true
    }
});

const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;

const configDialogVisible = ref(false);
const configForm = ref({
    Title: "",
    Content: "",
    Type: "info",
    Effect: "light",
    ShowIcon: true
});

const alertConfig = computed(() => {
    return props.field && props.field.Config && props.field.Config.Alert ? props.field.Config.Alert : {};
});

const title = computed(() => alertConfig.value.Title || props.field.Label || "提示说明");
const content = computed(() => alertConfig.value.Content || props.field.Description || "");
const alertType = computed(() => alertConfig.value.Type || "info");
const effect = computed(() => alertConfig.value.Effect || "light");
const showIcon = computed(() => alertConfig.value.ShowIcon !== false);
const iconClass = computed(() => {
    var iconMap = {
        success: "fas fa-check-circle",
        warning: "fas fa-exclamation-triangle",
        danger: "fas fa-times-circle",
        info: "fas fa-info-circle"
    };
    return iconMap[alertType.value] || iconMap.info;
});

const openConfig = () => {
    const cfg = alertConfig.value;
    configForm.value = {
        Title: cfg.Title || "",
        Content: cfg.Content || "",
        Type: cfg.Type || "info",
        Effect: cfg.Effect || "light",
        ShowIcon: cfg.ShowIcon !== false
    };
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!props.field.Config) props.field.Config = {};
    props.field.Config.Alert = {
        ...alertConfig.value,
        ...configForm.value
    };
    configDialogVisible.value = false;
    DiyCommon.Tips("配置已保存", true);
};

defineExpose({
    openConfig
});
</script>

<style lang="scss" scoped>
.diy-alert {
    --alert-color: var(--el-color-info);
    --alert-bg: var(--el-color-info-light-9);
    --alert-border: var(--el-color-info-light-7);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--alert-border);
    border-radius: 6px;
    background: var(--alert-bg);

    &__icon {
        flex: 0 0 auto;
        color: var(--alert-color);
        line-height: 20px;
    }

    &__body {
        min-width: 0;
        flex: 1;
    }

    &__title {
        font-weight: 600;
        font-size: 14px;
        line-height: 20px;
        color: var(--el-text-color-primary);
    }

    &__content {
        margin-top: 2px;
        font-size: 13px;
        line-height: 20px;
        color: var(--el-text-color-regular);
        word-break: break-word;
    }

    &--success {
        --alert-color: var(--el-color-success);
        --alert-bg: var(--el-color-success-light-9);
        --alert-border: var(--el-color-success-light-7);
    }

    &--warning {
        --alert-color: var(--el-color-warning);
        --alert-bg: var(--el-color-warning-light-9);
        --alert-border: var(--el-color-warning-light-7);
    }

    &--danger {
        --alert-color: var(--el-color-danger);
        --alert-bg: var(--el-color-danger-light-9);
        --alert-border: var(--el-color-danger-light-7);
    }

    &--plain {
        background: transparent;
    }
}
</style>