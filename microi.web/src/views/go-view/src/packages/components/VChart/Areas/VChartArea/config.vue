<template>
  <!-- vCharts 全局设置 -->
  <VChartGlobalSetting :optionData="optionData"></VChartGlobalSetting>
  <Axis :axis="optionData.xAxis"></Axis>
  <Axis :axis="optionData.yAxis"></Axis>
</template>

<script setup lang="ts">
import { PropType } from 'vue'
import { VChartGlobalSetting, Axis } from '@goview/components/Pages/VChartItemSetting'
import { vChartGlobalThemeJsonType } from '@goview/settings/vchartThemes/index'

defineProps({
  optionData: {
    type: Object as PropType<vChartGlobalThemeJsonType>,
    required: true
  }
})
</script>
