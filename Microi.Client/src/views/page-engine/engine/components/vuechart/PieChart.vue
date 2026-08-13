<template>
  <VChart class="microi-pie-chart" :option="chartOptions" autoresize />
</template>

<script setup name="PieChart">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { PieChart as EChartsPie } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([EChartsPie, TooltipComponent, CanvasRenderer])

const props = defineProps({
  chartData: {
    type: Object,
    required: true,
  },
})
const chartOptions = computed(() => {
  const labels = Array.isArray(props.chartData?.labels) ? props.chartData.labels : []
  const dataset = props.chartData?.datasets?.[0] || {}
  const values = Array.isArray(dataset.data) ? dataset.data : []
  const colors = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor : []
  const borders = Array.isArray(dataset.borderColor) ? dataset.borderColor : []
  return {
    animation: false,
    tooltip: { show: false },
    series: [{
      type: 'pie',
      radius: '92%',
      center: ['50%', '50%'],
      silent: true,
      label: { show: false },
      emphasis: { disabled: true },
      data: values.map((value, index) => ({
        name: labels[index] ?? '',
        value,
        itemStyle: {
          color: colors[index],
          borderColor: borders[index],
          borderWidth: Number(dataset.borderWidth) || 0,
        },
      })),
    }],
  }
})
</script>

<style scoped>
.microi-pie-chart {
  width: 100%;
  aspect-ratio: 1;
}
</style>
