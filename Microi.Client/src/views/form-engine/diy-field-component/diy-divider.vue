<template>
    <div class="tech-divider" :class="'tech-divider--' + tagType" :data-position="contentPosition">
        <!-- 主内容区域 -->
        <div class="tech-divider__container">
            <!-- 如果有 tag 样式 -->
            <div v-if="hasTag" class="tech-divider__tag">
                <fa-icon v-if="hasIcon" :icon="field.Config.Divider.Icon" class="tech-divider__icon" />
                <span class="tech-divider__text" v-safe-html="field.Label"></span>
            </div>
            <!-- 普通文字 -->
            <div v-else class="tech-divider__label">
                <fa-icon v-if="hasIcon" :icon="field.Config.Divider.Icon" class="tech-divider__icon" />
                <span class="tech-divider__text" v-safe-html="field.Label"></span>
            </div>
        </div>
    </div>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="分割线配置"
        width="500px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-form-item label="文字位置">
                <el-radio-group v-model="configForm.DividerPosition">
                    <el-radio value="left">左边</el-radio>
                    <el-radio value="center">中间</el-radio>
                    <el-radio value="right">右边</el-radio>
                </el-radio-group>
            </el-form-item>
            
            <el-form-item label="图标">
                <div style="display: flex; align-items: center;">
                    <span class="hand" style="display: inline-block; padding: 5px 10px; cursor: pointer; border: 1px solid #dcdfe6; border-radius: 4px; margin-right: 10px;" @click="showIconPicker">
                        <fa-icon :icon="DiyCommon.IsNull(configForm.Divider.Icon) ? 'far fa-smile-wink' : configForm.Divider.Icon" />
                    </span>
                    <el-input v-model="configForm.Divider.Icon" placeholder="图标类名" style="flex: 1;" />
                </div>
            </el-form-item>
            
            <el-form-item label="标签样式">
                <el-radio-group v-model="configForm.Divider.Tag">
                    <el-radio value="">无</el-radio>
                    <el-radio value="primary">默认样式</el-radio>
                    <el-radio value="success">成功样式</el-radio>
                    <el-radio value="info">信息样式</el-radio>
                    <el-radio value="warning">警告样式</el-radio>
                    <el-radio value="danger">危险样式</el-radio>
                </el-radio-group>
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue';

// 禁用属性继承
defineOptions({
    inheritAttrs: false
});

// Props定义
const props = defineProps({
    field: {
        type: Object,
        required: true
    }
});

// 获取全局属性
const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;

// 计算属性
const contentPosition = computed(() => {
    return DiyCommon.IsNull(props.field.Config.DividerPosition) ? 'left' : props.field.Config.DividerPosition;
});

const hasTag = computed(() => {
    return props.field.Config.Divider && props.field.Config.Divider.Tag;
});

const hasIcon = computed(() => {
    return props.field.Config.Divider && props.field.Config.Divider.Icon;
});

const tagType = computed(() => {
    if (!hasTag.value) return 'default';
    return props.field.Config.Divider.Tag || 'primary';
});

// ==================== 配置弹窗相关 ====================
const configDialogVisible = ref(false);
const configForm = ref({
    DividerPosition: 'left',
    Divider: {
        Icon: '',
        Tag: ''
    }
});

const openConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.Divider) {
        props.field.Config.Divider = {};
    }
    configForm.value = {
        DividerPosition: props.field.Config.DividerPosition || 'left',
        Divider: {
            Icon: props.field.Config.Divider.Icon || '',
            Tag: props.field.Config.Divider.Tag || ''
        }
    };
    configDialogVisible.value = true;
};

const saveConfig = () => {
    props.field.Config.DividerPosition = configForm.value.DividerPosition;
    if (!props.field.Config.Divider) {
        props.field.Config.Divider = {};
    }
    props.field.Config.Divider.Icon = configForm.value.Divider.Icon;
    props.field.Config.Divider.Tag = configForm.value.Divider.Tag;
    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
};

const showIconPicker = () => {
    // 图标选择器暂时用手动输入
};

// 暴露方法供父组件调用
defineExpose({
    openConfig
});
</script>

<style lang="scss" scoped>
.tech-divider {
    --divider-color: var(--mci-color-primary, var(--el-color-primary, #3478f6));
    --divider-line: color-mix(in srgb, var(--divider-color) 18%, var(--el-border-color-lighter, #e7edf5));
    --divider-soft: color-mix(in srgb, var(--divider-color) 8%, transparent);
    position: relative;
    display: flex;
    width: 100%;
    min-height: 30px;
    align-items: center;
    margin: 0;
    padding: 0;

    &::before,
    &::after {
        content: '';
        min-width: 12px;
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--divider-line));
    }
    &::after { background: linear-gradient(90deg, var(--divider-line), transparent); }

    &[data-position="left"] {
        &::before { display: none; }
        .tech-divider__container { padding-left: 0; padding-right: 10px; }
    }
    &[data-position="right"] {
        &::after { display: none; }
        .tech-divider__container { padding-left: 10px; padding-right: 0; }
    }

    &__container {
        position: relative;
        display: flex;
        flex-shrink: 0;
        align-items: center;
        padding: 0 10px;
    }

    &__tag,
    &__label {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px 3px 13px;
        border: 0;
        border-radius: 7px;
        color: var(--divider-color);
        background: var(--divider-soft);
        box-shadow: none;
        font-size: 13px;
        font-weight: 680;
        line-height: 20px;
        letter-spacing: .15px;
    }

    &__tag::before,
    &__label::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        width: 3px;
        height: 18px;
        border-radius: 0 4px 4px 0;
        background: var(--divider-color);
        transform: translateY(-50%);
    }

    &__icon { font-size: 13px; opacity: .88; }
    &__text { position: relative; z-index: 1; white-space: nowrap; }

    &--success { --divider-color: var(--el-color-success, #34c759); }
    &--info { --divider-color: var(--el-color-info, #7c8da6); }
    &--warning { --divider-color: var(--el-color-warning, #f59e0b); }
    &--danger { --divider-color: var(--el-color-danger, #ef4444); }
}
</style>
