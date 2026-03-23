<template>
    <div class="tech-divider" :class="'tech-divider--' + tagType" :data-position="contentPosition">
        <!-- 主内容区域 -->
        <div class="tech-divider__container">
            <!-- 如果有 tag 样式 -->
            <div v-if="hasTag" class="tech-divider__tag">
                <fa-icon v-if="hasIcon" :icon="field.Config.Divider.Icon" class="tech-divider__icon" />
                <span class="tech-divider__text" v-html="field.Label"></span>
            </div>
            <!-- 普通文字 -->
            <div v-else class="tech-divider__label">
                <fa-icon v-if="hasIcon" :icon="field.Config.Divider.Icon" class="tech-divider__icon" />
                <span class="tech-divider__text" v-html="field.Label"></span>
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
$primary-color: #4785ff;
$success-color: #34c759;
$info-color: #8b5cf6;
$warning-color: #f59e0b;
$danger-color: #ef4444;

.tech-divider {
    position: relative;
    margin: 0;
    padding: 0;
    width: 100%;
    display: flex;
    align-items: center;

    // 左右横线
    &::before,
    &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: linear-gradient(90deg, var(--line-fade-start, transparent), var(--line-color, #e5e7eb) 12%, var(--line-color, #e5e7eb) 88%, var(--line-fade-end, transparent));
    }

    // 根据位置控制横线显隐
    &[data-position="left"] {
        &::before { flex: 0; max-width: 0; }
        &::after  { flex: 1; }
        .tech-divider__container { padding-left: 0; padding-right: 12px; }
    }
    &[data-position="center"] {
        &::before,
        &::after { flex: 1; }
    }
    &[data-position="right"] {
        &::before { flex: 1; }
        &::after  { flex: 0; max-width: 0; }
        .tech-divider__container { padding-left: 12px; padding-right: 0; }
    }

    // 主容器
    &__container {
        position: relative;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        padding: 0 14px;
    }

    // 标签样式（有背景色的小胶囊）
    &__tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 14px;
        background: var(--tag-bg, #{$primary-color});
        border-radius: 12px;
        color: #fff;
        font-weight: 600;
        font-size: 13px;
        line-height: 20px;
        letter-spacing: 0.3px;
        box-shadow: 0 1px 3px var(--tag-shadow, rgba(71, 133, 255, 0.25));
        transition: box-shadow 0.2s ease;
    }

    // 普通标签（轻量边框 + 色条）
    &__label {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 12px 3px 14px;
        background: var(--label-bg, rgba(71, 133, 255, 0.06));
        border-radius: 6px;
        border-left: 3px solid var(--divider-color, #{$primary-color});
        font-weight: 600;
        font-size: 13px;
        line-height: 20px;
        letter-spacing: 0.2px;
        color: var(--divider-color, #{$primary-color});
        transition: background 0.2s ease;
    }

    // 图标
    &__icon {
        font-size: 13px;
        opacity: 0.85;
    }

    // 文字
    &__text {
        position: relative;
        z-index: 2;
        white-space: nowrap;
    }

    // ========== 颜色主题 ==========
    &--primary {
        --divider-color: #{$primary-color};
        --line-color: #{rgba($primary-color, 0.18)};
        --tag-bg: #{$primary-color};
        --tag-shadow: #{rgba($primary-color, 0.25)};
        --label-bg: #{rgba($primary-color, 0.06)};
    }
    &--success {
        --divider-color: #{$success-color};
        --line-color: #{rgba($success-color, 0.22)};
        --tag-bg: #{$success-color};
        --tag-shadow: #{rgba($success-color, 0.25)};
        --label-bg: #{rgba($success-color, 0.06)};
    }
    &--info {
        --divider-color: #{$info-color};
        --line-color: #{rgba($info-color, 0.18)};
        --tag-bg: #{$info-color};
        --tag-shadow: #{rgba($info-color, 0.25)};
        --label-bg: #{rgba($info-color, 0.06)};
    }
    &--warning {
        --divider-color: #{$warning-color};
        --line-color: #{rgba($warning-color, 0.25)};
        --tag-bg: #{$warning-color};
        --tag-shadow: #{rgba($warning-color, 0.25)};
        --label-bg: #{rgba($warning-color, 0.06)};
    }
    &--danger {
        --divider-color: #{$danger-color};
        --line-color: #{rgba($danger-color, 0.2)};
        --tag-bg: #{$danger-color};
        --tag-shadow: #{rgba($danger-color, 0.25)};
        --label-bg: #{rgba($danger-color, 0.06)};
    }
    &--default {
        --divider-color: #{$primary-color};
        --line-color: #e5e7eb;
        --label-bg: #{rgba($primary-color, 0.06)};
    }
}
</style>
