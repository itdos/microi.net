<template>
  <CommonSearch
    :widgetObj="widgetObj"
    :searchIndex="1"
    :pickerIndex="13"
    :key="widgetObj.widgetOption.number"
    @set-data="setData"
    @reset-data="resetData"
  ></CommonSearch>
  <div
    ref="chartRef"
    :style="[{ width: '100%' }, { height: autoHeight }]"
  ></div>
</template>

<script setup name="funnel-widget">
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
      color: dark.value ? '#999' : '#333',
      fontStyle: 'normal',
      fontWeight: 'bolder',
      fontFamily: 'sans-serif',
      fontSize: 18,
    },
  },
  tooltip: {
    trigger: 'item', // 'item' | 'axis' | 'none'
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
    orient: props.widgetObj.widgetParams[6]?.value,
    left: props.widgetObj.widgetParams[7]?.value,
    data: [],
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
  series: [],
}

onMounted(() => {
  // initChart()
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

//组装数据 (这里写主要业务逻辑)
const setData = () => {
  //通用配置
  chartSet.value.legend.orient = props.widgetObj.widgetParams[6]?.value
  chartSet.value.legend.left = props.widgetObj.widgetParams[7]?.value
  chartSet.value.title.textStyle.color = dark.value ? '#999' : '#333'
  chartSet.value.legend.textStyle.color = dark.value ? '#999' : '#333'
  chartSet.value.title.text = props.widgetObj.widgetParams[3]?.value
  chartSet.value.title.subtext = props.widgetObj.widgetParams[4]?.value
  chartSet.value.legend.show = props.widgetObj.widgetParams[5]?.value
  chartSet.value.tooltip.show = props.widgetObj.widgetParams[8]?.value
  chartSet.value.tooltip.trigger = props.widgetObj.widgetParams[9]?.value
  chartSet.value.toolbox.show = props.widgetObj.widgetParams[10]?.value

  chartSet.value.series = [
    {
      type: 'funnel',
      left: '10%',
      top: 40,
      bottom: 10,
      width: '80%',
      min: 0,
      max: 100,
      minSize: '0%',
      maxSize: '100%',
      sort: props.widgetObj.widgetParams[14]?.value,
      gap: 2,
      label: {
        show: props.widgetObj.widgetParams[11]?.value,
        position: props.widgetObj.widgetParams[12]?.value,
      },
      labelLine: {
        length: 10,
        lineStyle: {
          width: 1,
          type: 'solid',
        },
      },
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 1,
      },
      emphasis: {
        label: {
          fontSize: 20,
        },
      },
      data: contentData.value,
    },
  ]
  chartSet.value.legend.data = []

  // 遍历 widgetData.series 并根据条件添加属性
  contentData.value?.forEach((item, i) => {
    chartSet.value.legend.data.push(item.name)
  })

  resetChartSource()
}

const handleResize = () => {
  nextTick(() => {
    if (chartInstance && chartRef.value) {
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

const contentData = computed(() => {
  if (!props.widgetObj.widgetParams[0].typeOptions.dataJson?.data) {
    return props.widgetObj.widgetParams[0].typeOptions.dataJson
  }
  return props.widgetObj.widgetParams[0].typeOptions.dataJson.data
})
</script>

<style lang="scss" scoped>
.date-range {
  margin-bottom: 10px;
  text-align: right;
}
</style>
