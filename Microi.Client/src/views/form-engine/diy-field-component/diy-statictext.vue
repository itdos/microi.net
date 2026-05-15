<template>
    <div class="diy-static-text" :class="['diy-static-text--' + theme, 'text-' + align]">
        <div v-if="title" class="diy-static-text__title" v-safe-html="title"></div>
        <div v-if="content" class="diy-static-text__content" v-safe-html="content"></div>
    </div>

    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="静态文本配置"
        width="600px"
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
            <el-form-item label="正文内容">
                <el-input v-model="configForm.Content" type="textarea" :rows="6" placeholder="支持已启用的安全 HTML" />
            </el-form-item>
            <el-form-item label="对齐方式">
                <el-radio-group v-model="configForm.Align">
                    <el-radio value="left">左对齐</el-radio>
                    <el-radio value="center">居中</el-radio>
                    <el-radio value="right">右对齐</el-radio>
                </el-radio-group>
            </el-form-item>
            <el-form-item label="视觉风格">
                <el-select v-model="configForm.Theme" style="width: 220px">
                    <el-option label="普通" value="default" />
                    <el-option label="浅底" value="soft" />
                    <el-option label="引用" value="quote" />
                </el-select>
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
    name: "diy-statictext",
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
    Align: "left",
    Theme: "default"
});

const staticTextConfig = computed(() => {
    return props.field && props.field.Config && props.field.Config.StaticText ? props.field.Config.StaticText : {};
});

const title = computed(() => staticTextConfig.value.Title || props.field.Label || "");
const content = computed(() => staticTextConfig.value.Content || props.field.Description || "");
const align = computed(() => staticTextConfig.value.Align || "left");
const theme = computed(() => staticTextConfig.value.Theme || "default");

const openConfig = () => {
    const cfg = staticTextConfig.value;
    configForm.value = {
        Title: cfg.Title || "",
        Content: cfg.Content || "",
        Align: cfg.Align || "left",
        Theme: cfg.Theme || "default"
    };
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!props.field.Config) props.field.Config = {};
    props.field.Config.StaticText = {
        ...staticTextConfig.value,
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
.diy-static-text {
    width: 100%;
    padding: 2px 0;

    &__title {
        font-size: 15px;
        font-weight: 600;
        line-height: 24px;
        color: var(--el-text-color-primary);
        word-break: break-word;
    }

    &__content {
        margin-top: 3px;
        font-size: 13px;
        line-height: 22px;
        color: var(--el-text-color-regular);
        word-break: break-word;
    }

    &--soft {
        padding: 10px 12px;
        border: 1px solid var(--el-border-color-light);
        border-radius: 6px;
        background: var(--el-fill-color-lighter);
    }

    &--quote {
        padding: 6px 12px;
        border-left: 3px solid var(--el-color-primary);
        background: var(--el-fill-color-lighter);
    }
}

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-left { text-align: left; }
</style>