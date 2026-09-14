<template>
    <div class="file-role-tags">
        <el-tag v-if="!canReadFile(file)" size="small" type="info"><i class="fa fa-lock" /> 无访问权限</el-tag>
        <el-tag v-for="name in names" :key="name" size="small" type="info">{{ name }}</el-tag>
        <span v-if="!names.length" class="file-role-hint">跟随表单权限</span>
        <el-button v-if="editable" link type="primary" size="small" @click="$emit('configure', file)">设置可见角色</el-button>
    </div>
</template>
<script setup>
import { computed } from 'vue';
import { canReadFile, fileRoleNames } from '@/utils/file-role-permission';
const props = defineProps({ file: { type: Object, required: true }, roles: { type: Array, default: () => [] }, editable: Boolean });
defineEmits(['configure']);
const names = computed(() => fileRoleNames(props.file, props.roles));
</script>
<style scoped>
.file-role-tags { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; min-width: 0; }
.file-role-hint { color: var(--el-text-color-secondary); font-size: 12px; }
</style>
