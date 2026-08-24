<template>
    <div
        class="diy-collapse-group"
        :class="['diy-collapse-group--' + theme, isCollapsed ? 'is-collapsed' : 'is-expanded']"
        role="button"
        tabindex="0"
        :aria-expanded="String(!isCollapsed)"
        @click="toggleCollapse"
        @keydown.enter.prevent="toggleCollapse"
        @keydown.space.prevent="toggleCollapse"
    >
        <div class="diy-collapse-group__header">
            <span class="diy-collapse-group__accent" aria-hidden="true"></span>
            <span class="diy-collapse-group__icon-shell">
                <fa-icon v-if="currentIcon" :icon="currentIcon" class="diy-collapse-group__icon" />
            </span>
            <div class="diy-collapse-group__main">
                <div class="diy-collapse-group__title-row">
                    <div class="diy-collapse-group__title" v-safe-html="title"></div>
                    <span v-if="showFieldCount" class="diy-collapse-group__count">{{ childCount }} 项</span>
                </div>
                <div v-if="description" class="diy-collapse-group__desc" v-safe-html="description"></div>
            </div>
            <el-icon class="diy-collapse-group__arrow">
                <ArrowRight v-if="isCollapsed" />
                <ArrowDown v-else />
            </el-icon>
        </div>
    </div>

    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="折叠分组配置"
        width="560px"
        draggable
        align-center
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="110px" label-position="top" size="small">
            <el-form-item label="默认状态">
                <el-radio-group v-model="configForm.DefaultCollapsed">
                    <el-radio :value="false">默认展开</el-radio>
                    <el-radio :value="true">默认收起</el-radio>
                </el-radio-group>
            </el-form-item>

            <el-form-item label="作用范围">
                <el-radio-group v-model="configForm.ScopeMode">
                    <el-radio value="UntilNextGroup">直到下一个折叠分组</el-radio>
                    <el-radio value="FieldCount">下方固定字段数</el-radio>
                </el-radio-group>
            </el-form-item>

            <el-form-item v-if="configForm.ScopeMode === 'FieldCount'" label="下方字段数量">
                <el-input-number v-model="configForm.FieldCount" :min="1" :max="100" :step="1" />
            </el-form-item>

            <el-form-item label="说明文字">
                <el-input v-model="configForm.Description" type="textarea" :rows="3" placeholder="显示在分组标题下方，可为空" />
            </el-form-item>

            <el-form-item label="图标">
                <div class="collapse-icon-picker">
                    <el-button class="collapse-icon-picker__preview" @click="openIconPicker">
                        <fa-icon :icon="configForm.Icon || 'fas fa-layer-group'" />
                    </el-button>
                    <div class="collapse-icon-picker__text">
                        <div class="collapse-icon-picker__label">{{ configForm.Icon || "未选择图标" }}</div>
                        <div class="collapse-icon-picker__tip">点击左侧图标从图标库选择</div>
                    </div>
                    <el-button link type="primary" @click="openIconPicker">选择</el-button>
                    <el-button link type="danger" @click="configForm.Icon = ''">清空</el-button>
                </div>
                <Fontawesome v-if="iconPickerMounted" ref="iconPickerRef" v-model:model="configForm.Icon" />
            </el-form-item>

            <el-form-item label="视觉风格">
                <el-select v-model="configForm.Theme" style="width: 220px">
                    <el-option label="默认" value="default" />
                    <el-option label="重点" value="primary" />
                    <el-option label="成功" value="success" />
                    <el-option label="警告" value="warning" />
                    <el-option label="危险" value="danger" />
                </el-select>
            </el-form-item>

            <el-form-item label="显示字段数量">
                <el-switch v-model="configForm.ShowFieldCount" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { computed, defineAsyncComponent, getCurrentInstance, nextTick, ref } from "vue";
import { ArrowDown, ArrowRight } from "@element-plus/icons-vue";

const Fontawesome = defineAsyncComponent(() => import("./dos.fontawesome/Fontawesome.vue"));

defineOptions({
    name: "diy-collapse-group",
    inheritAttrs: false
});

const props = defineProps({
    field: {
        type: Object,
        required: true
    },
    FormMode: {
        type: String,
        default: ""
    },
    LoadMode: {
        type: String,
        default: ""
    }
});

const emit = defineEmits(["CallbackGroupCollapseChange"]);

const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;

const configDialogVisible = ref(false);
const iconPickerRef = ref(null);
const iconPickerMounted = ref(false);
const configForm = ref({
    DefaultCollapsed: false,
    ScopeMode: "UntilNextGroup",
    FieldCount: 10,
    Description: "",
    Icon: "fas fa-layer-group",
    Theme: "default",
    ShowFieldCount: true
});

const groupConfig = computed(() => {
    return props.field && props.field.Config && props.field.Config.CollapseGroup ? props.field.Config.CollapseGroup : {};
});

const title = computed(() => props.field.Label || groupConfig.value.Title || "折叠分组");
const description = computed(() => groupConfig.value.Description || "");
const currentIcon = computed(() => groupConfig.value.Icon || "fas fa-layer-group");
const theme = computed(() => groupConfig.value.Theme || "default");
const childCount = computed(() => props.field._collapseChildCount || 0);
const showFieldCount = computed(() => groupConfig.value.ShowFieldCount !== false);
const isCollapsed = computed(() => props.field._collapseCollapsed === true);

const toggleCollapse = (event) => {
    if (props.LoadMode !== "Design" && event && event.stopPropagation) {
        event.stopPropagation();
    }
    const nextCollapsed = !isCollapsed.value;
    emit("CallbackGroupCollapseChange", props.field, nextCollapsed);
};

const openIconPicker = () => {
    iconPickerMounted.value = true;
    nextTick(() => {
        if (iconPickerRef.value && iconPickerRef.value.show) {
            iconPickerRef.value.show();
        }
    });
};

const openConfig = () => {
    const cfg = groupConfig.value;
    configForm.value = {
        DefaultCollapsed: cfg.DefaultCollapsed === true || cfg.DefaultCollapsed === 1 || cfg.DefaultCollapsed === "true",
        ScopeMode: cfg.ScopeMode || "UntilNextGroup",
        FieldCount: Number(cfg.FieldCount || 10),
        Description: cfg.Description || "",
        Icon: cfg.Icon || "fas fa-layer-group",
        Theme: cfg.Theme || "default",
        ShowFieldCount: cfg.ShowFieldCount !== false
    };
    iconPickerMounted.value = false;
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.CollapseGroup) {
        props.field.Config.CollapseGroup = {};
    }
    props.field.Config.CollapseGroup = {
        ...groupConfig.value,
        ...configForm.value
    };
    emit("CallbackGroupCollapseChange", props.field, isCollapsed.value, { force: true });
    configDialogVisible.value = false;
    DiyCommon.Tips("配置已保存", true);
};

defineExpose({
    openConfig
});
</script>

<style lang="scss" scoped>
.diy-collapse-group {
    --group-color: var(--collapse-group-color, var(--el-color-primary));
    --group-bg: var(--collapse-group-bg, var(--mci-bg-card, var(--el-bg-color)));
    box-sizing: border-box;
    width: 100%;
    border: 0;
    border-radius: 12px;
    background: var(--group-bg);
    cursor: pointer;
    overflow: hidden;
    box-shadow: 0 5px 16px rgba(15, 35, 60, 0.05);
    outline: none;
    transition: background 0.18s ease, box-shadow 0.18s ease;

    &:hover {
        box-shadow: 0 7px 20px rgba(15, 35, 60, 0.07);
    }

    &:focus-visible {
        box-shadow:
            0 0 0 2px color-mix(in srgb, var(--group-color) 22%, transparent),
            0 7px 20px rgba(15, 35, 60, 0.07);
    }

    &.is-expanded {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        box-shadow: none;
    }

    &__header {
        position: relative;
        min-height: 56px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-sizing: border-box;
        padding: 9px 14px 9px 17px;
        background: var(--group-bg);
        transition: background-color .18s ease;
    }

    &:hover &__header,
    &:focus-visible &__header {
        background: color-mix(in srgb, var(--group-color) 2.5%, var(--group-bg) 97.5%);
    }

    &__accent {
        position: absolute;
        top: 50%;
        left: 5px;
        width: 3px;
        height: 23px;
        border-radius: 999px;
        background: var(--group-color);
        transform: translateY(-50%);
    }

    &__arrow,
    &__icon,
    &__icon-shell {
        flex: 0 0 auto;
        color: var(--group-color);
    }

    &__arrow {
        width: 22px;
        height: 22px;
        margin-left: 2px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--el-text-color-secondary);
        font-size: 14px;
        transition: color .18s ease, transform .18s ease;
    }

    &__icon-shell {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        background: color-mix(in srgb, var(--group-color) 7%, var(--el-bg-color) 93%);
    }

    &__icon {
        width: 16px;
        height: 16px;
    }

    &__main {
        min-width: 0;
        flex: 1;
    }

    &__title-row {
        min-width: 0;
        display: flex;
        align-items: baseline;
        gap: 8px;
    }

    &__title {
        font-weight: 720;
        font-size: 14px;
        line-height: 20px;
        color: var(--el-text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__desc {
        margin-top: 1px;
        font-size: 11px;
        line-height: 16px;
        color: var(--el-text-color-regular);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__count {
        flex: 0 0 auto;
        color: var(--el-text-color-regular);
        font-size: 11px;
        font-weight: 500;
        line-height: 16px;
    }

    &--primary { --group-color: var(--el-color-primary); }
    // 兼容历史配置值；保持与其既有主色视觉一致。
    &--info { --group-color: var(--el-color-primary); }
    &--default {
        --group-color: var(--mci-color-primary, var(--el-color-primary));
    }
    &--success { --group-color: var(--el-color-success); }
    &--warning { --group-color: var(--el-color-warning); }
    &--danger { --group-color: var(--el-color-danger); }
}

@media (max-width: 720px) {
    .diy-collapse-group {
        border-radius: 11px;

        &__header { min-height: 52px; gap: 8px; padding: 8px 10px 8px 15px; }
        &__icon-shell { width: 31px; height: 31px; border-radius: 9px; }
        &__arrow { width: 20px; height: 20px; }
    }
}

.collapse-icon-picker {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;

    &__preview {
        width: 38px;
        height: 32px;
        padding: 0;
    }

    &__text {
        min-width: 0;
        flex: 1;
    }

    &__label {
        font-size: 13px;
        line-height: 18px;
        color: var(--el-text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__tip {
        font-size: 12px;
        line-height: 18px;
        color: var(--el-text-color-secondary);
    }
}
</style>
