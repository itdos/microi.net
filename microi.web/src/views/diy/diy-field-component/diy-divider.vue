<template>
    <el-divider 
        :content-position="contentPosition"
        class="diy-divider"
    >
        <template v-if="hasTag">
            <el-tag :type="field.Config.Divider.Tag">
                <fa-icon v-if="hasIcon" :icon="field.Config.Divider.Icon" />
                <span v-html="field.Label"></span>
            </el-tag>
        </template>
        <template v-else>
            <fa-icon v-if="hasIcon" :icon="field.Config.Divider.Icon" />
            <span v-html="field.Label"></span>
        </template>
    </el-divider>
</template>

<script setup>
import { computed, getCurrentInstance } from 'vue';

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
</script>

<style lang="scss" scoped>
.diy-divider {
    :deep(.el-divider__text) {
        font-weight: 500;
    }
}
</style>
