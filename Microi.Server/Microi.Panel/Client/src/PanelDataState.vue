<script setup>
import { MciDataState } from '@microi/mci-ui';
defineProps({ title: { type: String, required: true }, description: { type: String, default: '' } });
</script>
<template>
  <!-- 面板状态块始终显示；MCI 组件必须显式传 empty，title/description 不是其属性。 -->
  <MciDataState empty :empty-text="title">
    <template v-if="description" #description>{{ description }}</template>
    <template v-if="$slots.default" #action><slot /></template>
  </MciDataState>
</template>
