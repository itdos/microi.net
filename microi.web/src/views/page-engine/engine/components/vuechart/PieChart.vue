<template>
  <PieChart :chart-data="chartData" :options="chartOptions" />
</template>

<script setup name="PieChart">
import { ref } from 'vue'
import { PieChart } from 'vue-chart-3'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale,
  PieController,
} from 'chart.js'

const props = defineProps({
  chartData: {
    type: Object,
    required: true,
  },
})
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  ArcElement,
  CategoryScale,
  PieController
)

const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false, // 允许独立设置宽高
  plugins: {
    tooltip: {
      enabled: false, // 禁用工具提示
    },
    legend: {
      display: false,
    },
  },
})
</script>
