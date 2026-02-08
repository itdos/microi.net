<template>
  <div id="container" style="width: 100%; height: 100%"></div>
</template>

<script setup name="map-widget">
import AMapLoader from '@amap/amap-jsapi-loader'
import { reactive, ref, watch, onMounted, onUnmounted, defineProps } from 'vue'
import { useWidget } from '../../../hooks/useWidget'
import { EventBus } from '../../../utils/eventBus.js'

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

// 防抖工具函数
const debounce = (func, delay) => {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

// 获取URL参数中的center值
const getCenterFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const centerParam = urlParams.get('center')
  if (centerParam) {
    // 验证center参数格式是否正确（应该是"经度,纬度"格式）
    const coords = centerParam.split(',')
    if (
      coords.length === 2 &&
      !isNaN(parseFloat(coords[0])) &&
      !isNaN(parseFloat(coords[1]))
    ) {
      return centerParam
    }
  }
  return null
}

// //设置临时数据
// const dynamicData = ref()
// dynamicData.value = props.widgetObj.widgetParams[0].typeOptions.dataJson
const { loadRemoteData } = useWidget(
  props.widgetObj,
  props.widgetObj.widgetParams[0].typeOptions.dataJson,
  dateRange,
  loading
)
await loadRemoteData()

let map

const initMap = () => {
  AMapLoader.load({
    key: '44a64ccfb659299ca8be07d7d0839830', // 替换为你的API Key
    version: '2.0', // 指定要加载的JSAPI版本
    plugins: [], // 需要使用的插件列表
  })
    .then((AMap) => {
      // 优先使用URL参数中的center值
      let centerFromUrl = getCenterFromUrl()
      let centlat

      if (centerFromUrl) {
        // 使用URL参数中的center值
        centlat = centerFromUrl.split(',')
        console.log('使用URL参数中的center值:', centerFromUrl)
      } else {
        // 使用配置参数中的center值
        centlat = props.widgetObj.widgetParams[1].value.split(',')
        if (props.widgetObj.widgetParams[0].typeOptions.dataJson) {
          centlat =
            props.widgetObj.widgetParams[0].typeOptions.dataJson[0]?.position.split(
              ','
            )
        }
        console.log('使用配置参数中的center值:', centlat)
      }

      map = new AMap.Map('container', {
        zoom: props.widgetObj.widgetParams[2].value, // 初始化地图级别
        center: centlat, // 初始化地图中心点位置
      })

      if (props.widgetObj.widgetParams[3].value) {
        //异步加载控件
        AMap.plugin('AMap.ToolBar', function () {
          var toolbar = new AMap.ToolBar() //缩放工具条实例化
          map.addControl(toolbar) //添加控件
        })
      }

      if (props.widgetObj.widgetParams[4].value) {
        AMap.plugin('AMap.Scale', function () {
          var scale = new AMap.Scale() //比例尺控件实例化
          map.addControl(scale) //添加控件
        })
      }
      if (props.widgetObj.widgetParams[5].value) {
        AMap.plugin('AMap.HawkEye', function () {
          var hawkeye = new AMap.HawkEye() //是否显示鹰眼
          map.addControl(hawkeye) //添加控件
        })
      }
      if (props.widgetObj.widgetParams[6].value) {
        AMap.plugin('AMap.MapType', function () {
          var maptype = new AMap.MapType() //是否显示地图切换
          map.addControl(maptype) //添加控件
        })
      }
      if (props.widgetObj.widgetParams[7].value) {
        AMap.plugin('AMap.Geolocation', function () {
          var geolocation = new AMap.Geolocation({
            enableHighAccuracy: true, // 是否使用高精度定位，默认：true
            timeout: 10000, // 设置定位超时时间，默认：无穷大
            offset: [20, 100], // 定位按钮的停靠位置的偏移量
            zoomToAccuracy: true, //  定位成功后调整地图视野范围使定位位置及精度范围视野内可见，默认：false
            position: 'RB', //  定位按钮的排放位置,  RB表示右下
          }) //是否显示定位
          map.addControl(geolocation) //添加控件
        })
      }

      if (props.widgetObj.widgetParams[0].typeOptions.dataJson) {
        props.widgetObj.widgetParams[0].typeOptions.dataJson.forEach((item) => {
          console.log('item', item)
          let marker = new AMap.Marker({
            offset: new AMap.Pixel(-10, -10),
            position: item.position.split(','),
            icon: item.icon, //添加 icon 图标 URL
            title: item.title,
            content: item.content,
          })

          //创建点标记的点击事件
          marker.on('click', function (e) {
            console.log('点击了地图maker：', JSON.stringify(item))
            //触发事件总线
            EventBus.emit('mapMarkerClick', JSON.stringify(item))

            // 通过 postMessage 方式向父窗口通信
            window.parent?.postMessage(
              { key: 'mapWidget', value: JSON.stringify(item) },
              '*'
            )
          })
          map.add(marker)

          if (props.widgetObj.widgetParams[8].value) {
            var text = new AMap.Text({
              text: item.title, //标记显示的文本内容
              anchor: 'center', //设置文本标记锚点位置
              draggable: false, //是否可拖拽
              cursor: 'pointer', //指定鼠标悬停时的鼠标样式。
              angle: 0, //点标记的旋转角度
              style: {
                //设置文本样式，Object 同 css 样式表
                padding: '4px 8px',
                'margin-bottom': '3.2rem',
                'margin-left': '3.5rem',
                'border-radius': '.25rem',
                'background-color': 'white',
                'border-width': 0,
                'box-shadow': '0 2px 6px 0 rgba(114, 124, 245, .5)',
                'text-align': 'center',
                'font-size': '12px',
                color: '#409eff',
                cursor: 'pointer',
              },
              position: item.position.split(','), //点标记在地图上显示的位置
            })

            text.on('click', function (e) {
              console.log('点击了地图maker：', JSON.stringify(item))
              //触发事件总线
              EventBus.emit('mapMarkerClick', JSON.stringify(item))

              // 通过 postMessage 方式向父窗口通信
              window.parent?.postMessage(
                { key: 'mapWidget', value: JSON.stringify(item) },
                '*'
              )
            })

            text.setMap(map) //将文本标记设置到地图上
          }
        })
      }
    })
    .catch((e) => {
      console.error(e)
    })
}

// 防抖重新初始化地图函数
const debouncedReinitMap = debounce(() => {
  if (map) {
    map.destroy()
  }
  initMap()
}, 1000) // 1000ms 防抖延迟，与 widget-attr.vue 保持一致

// 动态更新地图中心点的方法
const updateMapCenter = (center) => {
  if (map && center) {
    // 验证center参数格式
    let centerCoords
    if (typeof center === 'string') {
      const coords = center.split(',')
      if (
        coords.length === 2 &&
        !isNaN(parseFloat(coords[0])) &&
        !isNaN(parseFloat(coords[1]))
      ) {
        centerCoords = coords
      } else {
        console.error('center参数格式错误，应为"经度,纬度"格式')
        return
      }
    } else if (Array.isArray(center) && center.length === 2) {
      centerCoords = center
    } else {
      console.error('center参数格式错误')
      return
    }

    // 更新地图中心点
    map.setCenter(centerCoords)
    console.log('地图中心点已更新为:', centerCoords)
  }
}

// 暴露方法给父组件使用
defineExpose({
  updateMapCenter,
})

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  if (map) {
    map.destroy()
  }
})

watch(
  [() => props.widgetObj.widgetParams],
  () => {
    // 使用防抖函数替代直接重新初始化
    debouncedReinitMap()
  },
  {
    deep: true,
  }
)
</script>

<style lang="scss">
.microi-page-engine {
  .amap-ctrl-list-layer ul p {
    color: #000;
  }

  .custom-content-marker {
    width: 20px;
    height: 34px;
  }
  .custom-content-marker img {
    width: 100%;
    height: 100%;
  }
}
</style>

<style lang="scss" scoped>
#container {
  width: 100%;
  height: 500px; /* 根据需要调整高度 */
}
</style>
