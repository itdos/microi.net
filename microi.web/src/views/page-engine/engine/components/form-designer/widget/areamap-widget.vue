<template>
  <div style="display: flex; justify-content: space-between">
    <div>
      <el-button @click="updateMap(widgetObj.widgetParams[13]?.value)"
        >初始化地图</el-button
      >
    </div>
  </div>
  <!-- 地图容器 -->
  <div class="overview_main_mapBox" id="mapChart" ref="mapChart"></div>
</template>

<script setup name="areamap-widget">
import { ref, watch, onMounted, onUnmounted, defineProps, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useWidget } from '../../../hooks/useWidget'
import { EventBus } from '../../../utils/eventBus.js'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'
import { post } from '../../../utils/axiosInstance'
import { debounce as lodashDebounce } from 'lodash' //引入 debounce 函数
const pageEngineStore = usePageEngineStore()
const { curWrapper, dark } = storeToRefs(pageEngineStore)

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

//日期区间
const dateRange = ref()
//是否加载中
const loading = ref(false)

const { loadRemoteData } = useWidget(
  props.widgetObj,
  props.widgetObj.widgetParams[0].typeOptions.dataJson,
  dateRange,
  loading
)
await loadRemoteData()

// ================== 动态配置项开始 ==================
//json地址，https://www.nbweixin.cn/autopage

//默认初始化地图,330000:浙江省

// 当前地图代码
const currentMapCode = ref('330000')
currentMapCode.value = props.widgetObj.widgetParams[1]?.value

//是否下钻子区域

// tooltip 文本

// 最大最小值

// // 颜色组
// const colors = ref('#F5F67A, #E6B6E6, #BDD7BE, #F3CCBB, #F0938C')

// //是否开启模拟数据
// const isMock = ref(true)

// 数据格式（只供参考）
const mockData = () => {
  //根据 code 生成模拟数据

  const data = [
    {
      name: '杭州市',
      value: 74,
    },
    {
      name: '宁波市',
      value: 3,
    },
    {
      name: '温州市',
      value: 82,
    },
    {
      name: '嘉兴市',
      value: 23,
    },
    {
      name: '湖州市',
      value: 92,
    },
    {
      name: '绍兴市',
      value: 59,
    },
    {
      name: '金华市',
      value: 4,
    },
    {
      name: '衢州市',
      value: 28,
    },
    {
      name: '舟山市',
      value: 6,
    },
    {
      name: '台州市',
      value: 13,
    },
    {
      name: '丽水市',
      value: 78,
    },
  ]
  return data
}

// ================== 动态配置项结束 ==================

// 地图容器
const mapChart = ref(null)

// 地图实例
let chart = null

// 区域数据
let districts = []

// 区域地图数据
const districtDataList = ref(null)

// ================== ECharts 配置 ==================

const mapOption = ref({
  tooltip: {
    trigger: 'item',
    formatter: (params) => {
      if (params.seriesType === 'lines') {
        return `${params.data.fromName} -> ${params.data.toName}`
      }
      return `${params.name}<br>${props.widgetObj.widgetParams[3]?.value}：${
        Array.isArray(params.value) ? params.value[2] : params.value
      }`
    },
  },
  visualMap: {
    show: true,
    min: props.widgetObj.widgetParams[4]?.value,
    max: props.widgetObj.widgetParams[5]?.value,
    inRange: {
      color: props.widgetObj.widgetParams[6]?.value?.split(','), //  生成渐变色数组
    },
    calculable: true,
    right: 10,
    bottom: 30,
  },
  geo: {
    label: {
      normal: {
        show: true,
        formatter: (params) => {
          const data = mapOption.value.series[0].data.find(
            (item) => item.name === params.name
          )
          return `${params.name}：${data ? data.value : 0}`
        },
        position: 'right',
        textStyle: {
          color: props.widgetObj.widgetParams[7]?.value, // 文字颜色
          fontSize: props.widgetObj.widgetParams[8]?.value,
        },
      },
    },
    roam: true, //控制地图的缩放和平移功能的属性
  },
  series: [
    {
      type: 'map',
      geoIndex: 0,
    },
  ],
})

// 点击的是城市还是区域
// 点击的是城市还是区域
async function loadDistrictMap(code) {
  try {
    // 从json中拿到地图数据
    let newJsonUrl = `${props.widgetObj.widgetParams[10]?.value}/${props.widgetObj.widgetParams[1]?.value}/${code}.json`

    console.log('newJsonUrl', newJsonUrl)

    const response = await fetch(newJsonUrl)
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    const data = await response.json()
    // console.log('data.default', data)
    districtDataList.value = data
    return districtDataList.value
  } catch (error) {
    console.error(`加载${code}地图数据失败:`, error)
    return null
  }
}

// 更新地图数据
async function updateMap(code) {
  const mapData = await loadDistrictMap(code)
  if (!mapData) return
  districts = []
  mapData.features.forEach((item) => {
    districts.push({
      name: item.properties.name,
      adcode: item.properties.adcode,
    })
  })
  currentMapCode.value = code
  echarts.registerMap(code, mapData)

  mapOption.value.geo.map = code
  mapOption.value.series[0].map = code

  const { features } = districtDataList.value

  //模拟数据
  const townData = generateDistrictData(features)
  mapOption.value.series[0].data = townData.areaData

  // console.log('模拟数据', townData.areaData)

  if (chart) {
    chart.setOption(mapOption.value, true)
  }
}

// 生成区域数据
function generateDistrictData(features) {
  let areaData = []
  let scatterData = []

  if (props.widgetObj.widgetParams[9]?.value) {
    //通过远程接口获取数据，如果接口为空，则生成模拟数据
    features.forEach((feature, index) => {
      const properties = feature.properties
      // 每个区的随机数据
      const value = Math.round(Math.random() * 100)

      areaData.push({
        name: properties.name,
        value: value,
      })

      // // 计算区域中心点
      // const coords = feature.geometry.coordinates[0]
      // let centerX = 0,
      //   centerY = 0
      // coords.forEach((coord) => {
      //   centerX += coord[0]
      //   centerY += coord[1]
      // })
      // centerX /= coords.length
      // centerY /= coords.length
      // scatterData.push({
      //   name: properties.name,
      //   value: [centerX, centerY, value],
      // })
    })
  } else {
    //通过接口获取
    areaData = props.widgetObj.widgetParams[0].typeOptions.dataJson
  }

  return { areaData, scatterData }
}

// 防抖函数
const postDate = lodashDebounce(async (district) => {
  console.log('防抖触发', district)

  if (props.widgetObj.widgetParams[11]?.value) {
    try {
      const response = await post(
        props.widgetObj.widgetParams[11]?.value,
        district
      )
      if (response && response.length > 0) {
        console.log('任务更新到接口', response)
      }
    } catch (error) {
      console.error('任务更新失败:', error)
    }
  }

  //触发事件总线
  EventBus.emit(' ', district)

  // 通过 postMessage 方式向父窗口通信
  window.parent?.postMessage(
    { key: 'areaMapWidget', value: JSON.stringify(district) },
    '*'
  )
}, 500) // 1000 毫秒的防抖时间

// 地图点击事件
async function handleMapClick(params) {
  const district = districts.find((d) => d.name === params.name)
  if (district) {
    district.path = props.widgetObj.widgetParams[12]?.value
    if (params.data?.path) {
      district.path = params.data.path
    }

    //钻地
    if (props.widgetObj.widgetParams[2]?.value) {
      updateMap(district.adcode)
    }
    await postDate(district)
  }
}
// 初始化地图
function initMap() {
  if (!mapChart.value) return

  chart = echarts.init(mapChart.value)

  updateMap(props.widgetObj.widgetParams[13]?.value)

  chart.on('click', handleMapClick)
  window.addEventListener('resize', resizeMap)
}
// 销毁地图
onUnmounted(() => {
  if (chart) {
    chart.dispose()
    chart = null
  }
  window.removeEventListener('resize', resizeMap)
})

// 初始化地图
onMounted(() => {
  initMap()
})

// 重置地图大小
function resizeMap() {
  if (chart) {
    chart?.resize()
  }
}

// 防抖工具函数
const customDebounce = (func, delay) => {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

// 防抖更新地图选项函数
const debouncedUpdateMapOption = customDebounce((newVal) => {
  mapOption.value.visualMap.min = newVal.widgetParams[4]?.value
  mapOption.value.visualMap.max = newVal.widgetParams[5]?.value
  mapOption.value.visualMap.inRange.color =
    newVal.widgetParams[6]?.value?.split(',')
  mapOption.value.geo.label.normal.textStyle = {
    color: newVal.widgetParams[7]?.value,
    fontSize: newVal.widgetParams[8]?.value,
  }

  // 应用新的样式到地图
  if (chart) {
    chart.setOption(mapOption.value, true)
  }
  // 调用 resizeMap 来更新地图大小
  resizeMap()
}, 1000) // 1000ms 防抖延迟

// 防抖更新地图数据函数
const debouncedUpdateMap = customDebounce((adcode) => {
  updateMap(adcode)
}, 1000) // 1000ms 防抖延迟

// 防抖调整地图大小函数
const debouncedResizeMap = customDebounce(() => {
  resizeMap()
}, 1000) // 1000ms 防抖延迟

watch(
  () => props.widgetObj,
  (newVal, oldVal) => {
    // 使用防抖函数替代直接更新
    debouncedUpdateMapOption(newVal)
  },
  { deep: true }
)

watch(
  () => props.widgetObj.widgetParams[0].typeOptions.dataJson,
  (newVal, oldVal) => {
    if (newVal != oldVal) {
      // 使用防抖函数替代直接更新
      debouncedUpdateMap(props.widgetObj.widgetParams[1]?.value)
    }
  },
  { deep: true }
)

watch(
  () => curWrapper.value,
  (newVal, oldVal) => {
    // 使用防抖函数替代直接调整大小
    debouncedResizeMap()
  },
  { deep: true }
)
</script>

<style lang="scss" scoped>
.overview_main_mapBox {
  width: 100%;
  height: 100%;
}
</style>
