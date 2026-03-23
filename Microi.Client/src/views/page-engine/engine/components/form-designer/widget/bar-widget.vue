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

<script setup name="bar-widget">
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

//图表容器
const chartRef = ref(null)
let chartInstance = null

//动态高度
const autoHeight = computed(() => {
  let searchHeight = props.widgetObj.widgetParams[1]?.value ? 40 : 0
  return props.widgetObj.widgetOption.height - searchHeight + 'px'
})

//图表配置
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
    axisPointer: {
      type: 'cross',
    },
  },
  legend: {
    orient: 'vertical',
    left: 'left',
    show: true,
    textStyle: {
      color: '#333',
    },
  },
  xAxis: {
    type: 'category',
    data: [],
    axisLabel: {
      color: '#333',
    },
    boundaryGap: true,
  },
  yAxis: {
    type: 'value',
    axisLabel: {
      color: '#333',
    },
    splitLine: {
      show: true,
    },
  },
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

// //初始化
// const initChart = async () => {
//   await loadRemoteData()
//   resetData()
// }

const resetData = () => {
  console.log('重置数据')
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
  chartSet.value.xAxis.type = props.widgetObj.widgetParams[17]?.value
    ? 'value'
    : 'category'
  chartSet.value.yAxis.type = props.widgetObj.widgetParams[17]?.value
    ? 'category'
    : 'value'
  chartSet.value.title.textStyle.color = dark.value ? '#999' : '#333'
  chartSet.value.legend.textStyle.color = dark.value ? '#999' : '#333'
  chartSet.value.xAxis.axisLabel.color = dark.value ? '#999' : '#333'
  chartSet.value.yAxis.axisLabel.color = dark.value ? '#999' : '#333'
  chartSet.value.tooltip.axisPointer.type =
    props.widgetObj.widgetParams[3]?.value
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
  props.widgetObj.widgetParams[0].typeOptions.dataJson.series?.forEach(
    (series, i) => {
      const seriesItem = {
        type: 'bar',
        name: series.name,
        data: series.data,
        // data: series.data.map((val, idx) => [idx, val]), // [x, y] 格式
        // encode: {
        //   x: 1, // 使用数据中的第二个值作为 X 值
        //   y: 0, // 使用数据中的第一个值作为 Y 值
        // },
        tooltip: {
          valueFormatter: function (value) {
            return value + ' ' + props.widgetObj.widgetParams[4]?.value
          },
        },
        label: {
          show: props.widgetObj.widgetParams[13]?.value,
          position: props.widgetObj.widgetParams[14]?.value,
        },
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
