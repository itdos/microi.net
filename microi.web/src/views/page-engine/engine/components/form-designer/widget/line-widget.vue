<template>
  <CommonSearch
    :widgetObj="widgetObj"
    :searchIndex="1"
    :pickerIndex="16"
    :key="widgetObj.widgetOption.number"
    @set-data="setData"
    @reset-data="resetData"
  ></CommonSearch>
  <div
    ref="chartRef"
    :style="[{ width: '100%' }, { height: autoHeight }]"
  ></div>
</template>

<script setup name="line-widget">
import { ref, watch, onMounted, nextTick, onBeforeUnmount, computed } from 'vue'
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

const chartRef = ref(null)
let chartInstance = null

const autoHeight = computed(() => {
  let searchHeight = props.widgetObj.widgetParams[1]?.value ? 40 : 0
  return props.widgetObj.widgetOption.height - searchHeight + 'px'
})

const chartSet = ref({})
chartSet.value = {
  title: {
    show: true,
    text: '',
    subtext: '',
    textStyle: {
      color: dark.value ? '#fff' : '#333',
      fontStyle: 'normal',
      fontWeight: 'bolder',
      fontFamily: 'sans-serif',
      fontSize: 18,
    },
  },
  tooltip: {
    trigger: 'axis', // 'item' | 'axis' | 'none'
    show: true,
    axisPointer: {
      type: 'cross',
      label: {
        backgroundColor: '#6a7985',
      },
    },
  },
  legend: {
    show: true,
    type: 'scroll', // 'plain' | 'scroll'
    textStyle: {
      color: dark.value ? '#999' : '#333',
    },
    data: [],
    orient: props.widgetObj.widgetParams[8]?.value,
    left: props.widgetObj.widgetParams[9]?.value,
  },
  grid: {
    show: false,
    left: '10%',
    right: '4%',
    bottom: '30px',
    containLabel: false,
  },

  toolbox: {
    show: true,
    feature: {
      dataView: { readOnly: false },
      restore: {},
      saveAsImage: {},
    },
  },
  xAxis: {
    type: 'category',
    boundaryGap: true,
    axisTick: {
      alignWithLabel: true,
    },
    axisLabel: {
      color: dark.value ? '#999' : '#333', // Y轴刻度字体颜色
    },
    data: [],
  },
  yAxis: {
    type: 'value',
    splitLine: {
      show: props.widgetObj.widgetParams[15]?.value,
    },
    axisLabel: {
      formatter: '{value}',
      color: dark.value ? '#999' : '#333', // Y轴刻度字体颜色
    },
  },
  // dataset: {
  //   source: [],
  // },
  series: [],
}

onMounted(() => {
  // initChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

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
  chartSet.value.xAxis.axisLabel.color = dark.value ? '#999' : '#333'
  chartSet.value.yAxis.axisLabel.color = dark.value ? '#999' : '#333'
  chartSet.value.legend.orient = props.widgetObj.widgetParams[8]?.value
  chartSet.value.legend.left = props.widgetObj.widgetParams[9]?.value
  chartSet.value.title.text = props.widgetObj.widgetParams[5]?.value
  chartSet.value.title.subtext = props.widgetObj.widgetParams[6]?.value
  chartSet.value.legend.show = props.widgetObj.widgetParams[7]?.value
  chartSet.value.tooltip.show = props.widgetObj.widgetParams[10]?.value
  chartSet.value.tooltip.trigger = props.widgetObj.widgetParams[11]?.value
  chartSet.value.toolbox.show = props.widgetObj.widgetParams[12]?.value
  chartSet.value.xAxis.data =
    props.widgetObj.widgetParams[0].typeOptions.dataJson.xAxis
  chartSet.value.xAxis.boundaryGap = props.widgetObj.widgetParams[2]?.value
  chartSet.value.yAxis.splitLine.show = props.widgetObj.widgetParams[15]?.value
  chartSet.value.series = []
  chartSet.value.legend.data = []

  // 遍历 widgetData.series 并根据条件添加属性
  props.widgetObj.widgetParams[0].typeOptions.dataJson?.series?.forEach(
    (series, i) => {
      const seriesItem = {
        type: 'line',
        name: series.name,
        data: series.data,
        smooth: props.widgetObj.widgetParams[3]?.value,
        label: {
          show: props.widgetObj.widgetParams[13]?.value,
          position: props.widgetObj.widgetParams[14]?.value,
        },
      }
      if (props.widgetObj.widgetParams[4]?.value) {
        seriesItem.areaStyle = {}
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

watch(
  [() => props.widgetObj, () => curWrapper.value, () => dark.value],
  () => {
    resetData()
    handleResize()
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
