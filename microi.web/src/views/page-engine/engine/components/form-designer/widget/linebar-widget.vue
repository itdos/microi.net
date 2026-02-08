<template>
  <CommonSearch
    :widgetObj="widgetObj"
    :searchIndex="1"
    :pickerIndex="18"
    :key="widgetObj.widgetOption.number"
    @set-data="setData"
    @reset-data="resetData"
  ></CommonSearch>
  <div
    ref="chartRef"
    :style="[{ width: '100%' }, { height: autoHeight }]"
  ></div>
</template>

<script setup name="linebar-widget">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'
import CommonSearch from '../../CommonSearch/CommonSearch.vue'

const pageEngineStore = usePageEngineStore()
const { curWrapper, dark } = storeToRefs(pageEngineStore)

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const chartRef = ref()
let chartInstance = null
const chartSet = ref({
  title: {
    text: '',
    subtext: '',
    textStyle: {
      color: '#333',
    },
  },
  tooltip: {
    trigger: 'axis',
    show: true,
  },
  legend: {
    orient: 'vertical',
    left: 'left',
    show: true,
    textStyle: {
      color: '#333',
    },
  },
  xAxis: [
    {
      type: 'category',
      data: [],
      axisLabel: {
        color: '#333',
      },
      boundaryGap: true,
    },
  ],
  yAxis: [
    {
      type: 'value',
      axisLabel: {
        color: '#333',
        formatter: '{value}',
      },
      splitLine: {
        show: true,
      },
    },
    {
      type: 'value',
      axisLabel: {
        color: '#333',
        formatter: '{value}',
      },
      splitLine: {
        show: true,
      },
    },
  ],
  series: [],
  toolbox: {
    show: false,
  },
})

// 防抖工具函数
const debounce = (func, delay) => {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

const autoHeight = computed(() => {
  let searchHeight = props.widgetObj.widgetParams[1]?.value ? 40 : 0
  return props.widgetObj.widgetOption.height - searchHeight + 'px'
})

//重置
const resetData = () => {
  nextTick(() => {
    if (chartInstance) {
      chartInstance.dispose() // 销毁echarts实例
    }
    if (chartRef.value) {
      chartInstance = echarts.init(chartRef.value)
      setData()
    }
  })
}
//重置
const resetChartSource = () => {
  chartInstance.setOption(chartSet.value)
}

//组装数据
const setData = () => {
  //通用配置
  chartSet.value.title.textStyle.color = dark.value ? '#999' : '#333'
  chartSet.value.legend.textStyle.color = dark.value ? '#999' : '#333'
  chartSet.value.legend.orient = props.widgetObj.widgetParams[8]?.value
  chartSet.value.legend.left = props.widgetObj.widgetParams[9]?.value
  chartSet.value.title.text = props.widgetObj.widgetParams[5]?.value
  chartSet.value.title.subtext = props.widgetObj.widgetParams[6]?.value
  chartSet.value.legend.show = props.widgetObj.widgetParams[7]?.value
  chartSet.value.tooltip.show = props.widgetObj.widgetParams[10]?.value
  chartSet.value.tooltip.trigger = props.widgetObj.widgetParams[11]?.value
  chartSet.value.toolbox.show = props.widgetObj.widgetParams[13]?.value
  chartSet.value.xAxis[0].data =
    props.widgetObj.widgetParams[0]?.typeOptions.dataJson.xAxis
  chartSet.value.xAxis[0].boundaryGap = props.widgetObj.widgetParams[2]?.value
  chartSet.value.xAxis[0].axisLabel.color = dark.value ? '#999' : '#333'
  chartSet.value.yAxis[0].axisLabel.color = dark.value ? '#999' : '#333'
  chartSet.value.yAxis[1].axisLabel.color = dark.value ? '#999' : '#333'
  chartSet.value.yAxis[0].axisLabel.formatter =
    '{value} ' + props.widgetObj.widgetParams[3]?.value
  chartSet.value.yAxis[1].axisLabel.formatter =
    '{value} ' + props.widgetObj.widgetParams[4]?.value

  chartSet.value.yAxis[0].splitLine.show =
    props.widgetObj?.widgetParams[16]?.value
  chartSet.value.yAxis[1].splitLine.show =
    props.widgetObj?.widgetParams[17]?.value
  chartSet.value.series = []
  chartSet.value.legend.data = []

  // 遍历 widgetData.series 并根据条件添加属性
  props.widgetObj.widgetParams[0]?.typeOptions.dataJson?.series?.forEach(
    (series, i) => {
      const seriesItem = {
        type: series.type,
        name: series.name,
        data: series.data,
        tooltip: {
          valueFormatter: function (value) {
            return value + ' ' + series.unit
          },
        },
        label: {
          show: props.widgetObj.widgetParams[14]?.value,
          position: props.widgetObj.widgetParams[15]?.value,
        },
      }
      if (series.type == 'line') {
        seriesItem.yAxisIndex = 1
      }
      chartSet.value.series.push(seriesItem)
      chartSet.value.legend.data.push(series.name)
    }
  )

  resetChartSource()
}

const handleResize = () => {
  nextTick(() => {
    if (chartRef.value) {
      chartInstance.resize()
    }
  })
}

// 防抖重新初始化图表函数
const debouncedResetData = debounce(() => {
  resetData()
  handleResize()
}, 1000) // 1000ms 防抖延迟

watch(
  [() => props.widgetObj, () => curWrapper.value, () => dark.value],
  () => {
    // 使用防抖函数替代直接重新初始化
    debouncedResetData()
  },
  {
    deep: true,
  }
)
</script>

<style lang="scss" scoped>
.date-range {
  margin-bottom: 10px;
  text-align: right;
}
</style>
