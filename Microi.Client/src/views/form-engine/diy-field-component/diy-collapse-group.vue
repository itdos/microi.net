<template>
    <div
        class="diy-collapse-group"
        :class="['diy-collapse-group--' + theme, isCollapsed ? 'is-collapsed' : 'is-expanded']"
        @click="toggleCollapse"
    >
        <div class="diy-collapse-group__header">
            <el-icon class="diy-collapse-group__arrow">
                <ArrowRight v-if="isCollapsed" />
                <ArrowDown v-else />
            </el-icon>
            <fa-icon v-if="currentIcon" :icon="currentIcon" class="diy-collapse-group__icon" />
            <div class="diy-collapse-group__main">
                <div class="diy-collapse-group__title" v-safe-html="title"></div>
                <div v-if="description" class="diy-collapse-group__desc" v-safe-html="description"></div>
            </div>
            <el-tag v-if="showFieldCount" size="small" effect="plain" class="diy-collapse-group__count">
                {{ childCount }} 项
            </el-tag>
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
    --group-bg: var(--collapse-group-bg, color-mix(in srgb, var(--group-color) 8%, var(--el-bg-color) 92%));
    --group-border: var(--collapse-group-border, var(--el-border-color-light));
    width: 100%;
    border: 1px solid var(--group-border);
    border-radius: 8px;
    background: var(--group-bg);
    cursor: pointer;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.035);
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &:hover {
        border-color: var(--group-color);
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.055);
    }

    &:active {
        transform: translateY(1px);
    }

    &.is-expanded {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        box-shadow: none;
    }

    &__header {
        min-height: 26px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px 9px 13px;
    }

    &__arrow,
    &__icon {
        flex: 0 0 auto;
        color: var(--group-color);
    }

    &__arrow {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--group-color) 12%, var(--el-bg-color) 88%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    &__icon {
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    &__main {
        min-width: 0;
        flex: 1;
    }

    &__title {
        font-weight: 600;
        font-size: 14px;
        line-height: 20px;
        color: var(--el-text-color-primary);
        word-break: break-word;
    }

    &__desc {
        margin-top: 2px;
        font-size: 12px;
        line-height: 18px;
        color: var(--el-text-color-secondary);
        word-break: break-word;
    }

    &__count {
        flex: 0 0 auto;
        border-color: color-mix(in srgb, var(--group-color) 32%, var(--el-border-color-light) 68%);
        color: var(--group-color);
        background: color-mix(in srgb, var(--group-color) 4%, var(--el-bg-color) 96%);
    }

    &--primary { --group-color: var(--el-color-primary); }
    &--success { --group-color: var(--el-color-success); }
    &--warning { --group-color: var(--el-color-warning); }
    &--danger { --group-color: var(--el-color-danger); }
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
