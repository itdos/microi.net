<template>
  <el-col
    :class="isShowBorder"
    :span="dynamicSpan"
    :offset="
      formData.JsonObj.formConfig?.mobile == true
        ? 0
        : widgetObj.widgetOption.offset
    "
    :push="
      formData.JsonObj.formConfig?.mobile == true
        ? 0
        : widgetObj.widgetOption.push
    "
    :pull="
      formData.JsonObj.formConfig?.mobile == true
        ? 0
        : widgetObj.widgetOption.pull
    "
    :style="[
      widgetObj.widgetOption.dynamicStyle,
      {
        marginTop: dynamicMarginTop + 'px',
      },
    ]"
    style="position: relative"
  >
    <div
      class="common-widget-body"
      :style="[{ width: '100%' }, { height: autoHeight }]"
      @dragstart="handleDragStart"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @click="handleSetCurWidget"
    >
      <div
        :draggable="formData.JsonObj.formConfig.drag"
        v-if="isShowBorderSub"
        class="drag-handler drag-right drag-top"
      >
        <el-text>
          <el-icon>
            <Grid />
          </el-icon>
          {{ widgetObj.widgetOption.number }}
        </el-text>
      </div>

      <div v-if="isShowBorderSub" class="drag-handler drag-right drag-bottom">
        <el-text @click="handleCopyClick">
          <el-icon>
            <CopyDocument />
          </el-icon>
          克隆
        </el-text>
      </div>
      <div
        v-if="isShowBorderSub"
        style="margin-right: 60px"
        class="drag-handler drag-right drag-bottom"
      >
        <el-text @click="handleDelClick">
          <el-icon>
            <Delete />
          </el-icon>
          删除
        </el-text>
      </div>

      <!-- #####在这里面添加新组件代码 ,代码开始###### -->
      <Suspense>
        <component
          :is="selectedWidgetComponent(widgetObj.type)"
          :widgetObj="widgetObj"
        ></component>
        <template #fallback>
          <div
            class="pe-widget-skeleton"
            :class="'pe-widget-skeleton--' + widgetSkeletonType"
            :style="{ minHeight: skeletonMinHeight }"
          >
            <template v-if="widgetSkeletonType === 'statistic'">
              <div
                v-for="item in 4"
                :key="'stat-' + item"
                class="pe-skeleton-metric"
              >
                <span class="pe-skeleton-line pe-skeleton-line--short"></span>
                <span class="pe-skeleton-line pe-skeleton-line--value"></span>
              </div>
            </template>
            <template v-else-if="widgetSkeletonType === 'table'">
              <div class="pe-skeleton-table-head"></div>
              <div
                v-for="row in 5"
                :key="'table-' + row"
                class="pe-skeleton-table-row"
              >
                <span></span>
                <span></span>
                <span></span>
              </div>
            </template>
            <template v-else-if="widgetSkeletonType === 'chart'">
              <div class="pe-skeleton-chart-title"></div>
              <div class="pe-skeleton-chart-body">
                <span v-for="bar in 7" :key="'chart-' + bar"></span>
              </div>
            </template>
            <template v-else-if="widgetSkeletonType === 'media'">
              <div class="pe-skeleton-media-icon"></div>
              <div class="pe-skeleton-line"></div>
            </template>
            <template v-else>
              <div
                v-for="line in 4"
                :key="'line-' + line"
                class="pe-skeleton-line"
                :class="{ 'pe-skeleton-line--short': line === 4 }"
              ></div>
            </template>
          </div>
        </template>
      </Suspense>
      <div
        v-if="isDesignSelectMaskVisible"
        class="widget-design-select-mask"
        @click="handleSetCurWidget"
        @mousedown.stop
        @mouseup.stop
      ></div>
      <!-- #####在这里面添加新组件代码 ,代码结束###### -->

      <div
        v-if="isShowBorderSub"
        class="resize-handle resize-handle-bottom"
        @mousedown="startResizeHeight"
      ></div>

      <div
        v-if="isShowBorderSub"
        @mousedown="startResizeMargin"
        class="resize-handle resize-handle-top"
      ></div>
    </div>
  </el-col>
</template>

<script setup name="common-widget">
import { computed, defineProps, toRaw } from 'vue'
import { EventBus } from '../../../utils/eventBus.js'
import { deepClone, buildDefaultWidgetJson, generateId } from '../../../utils/util'
import { ElMessageBox, ElNotification, ElMessage } from 'element-plus'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'
// import loadComponentsFromFolder from '../../../utils/dynamicComponents'
const pageEngineStore = usePageEngineStore()
const { formData, curWidget, curWrapper, components } =
  storeToRefs(pageEngineStore)
import useResizable from '../../../hooks/useResizable'

const componentRaw = toRaw(components.value)

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const widgetHeightValue = computed(() => props.widgetObj.widgetOption?.height)

const isAutoHeightValue = (value) => {
  if (value === undefined || value === null || value === '') return false
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'auto' || normalized === '100%' || normalized === 'full') {
      return true
    }
  }
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue <= 0
}

const toPositiveHeight = (value, fallback) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue + 'px'
    : fallback
}

const autoHeight = computed(() => {
  if (formData.value.JsonObj.formConfig?.mobile) {
    return 'auto'
  }
  if (
    !isDesignMode.value &&
    (autoContentWidgetTypes.has(props.widgetObj.type) || isAutoHeightValue(widgetHeightValue.value))
  ) {
    return 'auto'
  }
  return toPositiveHeight(widgetHeightValue.value, 'auto')
})

const autoContentWidgetTypes = new Set(['statistic', 'progress', 'html'])

const chartWidgetTypes = new Set(['bar', 'line', 'linebar', 'pie', 'funnel', 'map', 'areamap'])
const tableWidgetTypes = new Set(['tabel', 'gantt', 'diytable'])
const mediaWidgetTypes = new Set(['image', 'video', 'browser', 'office', 'webgl', 'carousel'])

const widgetSkeletonType = computed(() => {
  const type = props.widgetObj.type
  if (type === 'statistic' || type === 'progress') return 'statistic'
  if (tableWidgetTypes.has(type)) return 'table'
  if (chartWidgetTypes.has(type)) return 'chart'
  if (mediaWidgetTypes.has(type)) return 'media'
  return 'list'
})

const skeletonMinHeight = computed(() => {
  if (formData.value.JsonObj.formConfig?.mobile) {
    return widgetSkeletonType.value === 'statistic' ? '96px' : '140px'
  }
  return toPositiveHeight(widgetHeightValue.value, '160px')
})

const isDesignMode = computed(() => {
  const config = formData.value.JsonObj.formConfig || {}
  return config.drag || config.hover || config.mask
})

//适配移动端
const dynamicSpan = computed(() => {
  if (formData.value.JsonObj.formConfig?.mobile) {
    return 24
  }
  return props.widgetObj.widgetOption.span
})

const dynamicMarginTop = computed(() => {
  if (formData.value.JsonObj.formConfig?.mobile) {
    return 0
  }
  return props.widgetObj.widgetOption.marginTop
})

const selectedWidgetComponent = (type) => {
  return componentRaw[type + '-widget']
}

const isolatedPreviewWidgetTypes = new Set(['office', 'browser'])

const isDesignSelectMaskVisible = computed(() => {
  return (
    formData.value.JsonObj.formConfig?.mask !== false &&
    isolatedPreviewWidgetTypes.has(props.widgetObj.type) &&
    curWidget.value !== props.widgetObj
  )
})

//显示虚线
const isShowBorder = computed(() => {
  return formData.value.JsonObj.formConfig.hover &&
    curWidget.value === props.widgetObj
    ? 'hover-effect hover-effect-green'
    : 'effect'
})
//显示操作区域
const isShowBorderSub = computed(() => {
  return (
    formData.value.JsonObj.formConfig.hover &&
    curWidget.value === props.widgetObj
  )
})

//当前组件的容器索引信息
const thisWrapperIdx = computed(() => {
  return formData.value.JsonObj.wrapperList.findIndex(
    (item) =>
      item.wrapperOption.number === props.widgetObj.widgetOption.wrapperNumber
  )
})
//当前组件的索引信息
const thisWidgetIdx = computed(() => {
  if (thisWrapperIdx.value < 0) return -1
  return formData.value.JsonObj.wrapperList[
    thisWrapperIdx.value
  ].widgetList.findIndex(
    (item) => item.widgetOption.number === props.widgetObj.widgetOption.number
  )
})

// 检测组件是否在Tab容器的tabWidgetMap中
const tabLocation = computed(() => {
  if (thisWrapperIdx.value < 0) return null
  const wrapper = formData.value.JsonObj.wrapperList[thisWrapperIdx.value]
  if (!wrapper || !wrapper.tabWidgetMap) return null
  for (const tabKey of Object.keys(wrapper.tabWidgetMap)) {
    const widgets = wrapper.tabWidgetMap[tabKey]
    const idx = widgets.findIndex(
      (item) => item.widgetOption.number === props.widgetObj.widgetOption.number
    )
    if (idx > -1) {
      return { tabKey, widgetIdx: idx }
    }
  }
  return null
})

//点击该组件,设置当前组件为选中状态
const handleSetCurWidget = (e) => {
  e.preventDefault()
  e.stopPropagation()
  //触发切换容器选项卡
  EventBus.emit('activeName', 'first')

  if (thisWrapperIdx.value > -1) {
    //修改状态机
    pageEngineStore.setCurWrapperIdx(thisWrapperIdx.value)
  }
  if (thisWidgetIdx.value > -1) {
    //修改状态机
    pageEngineStore.setCurWidgetIdx(thisWidgetIdx.value)
  } else if (tabLocation.value) {
    // 组件在Tab容器内，直接设置
    pageEngineStore.setCurWidgetDirect(props.widgetObj)
  }
}

//删除选中组件
const handleDelClick = () => {
  ElMessageBox.confirm('是否删除此组件?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      if (thisWidgetIdx.value > -1) {
        pageEngineStore.delWidget(thisWrapperIdx.value, thisWidgetIdx.value)
      } else if (tabLocation.value) {
        const wrapper = formData.value.JsonObj.wrapperList[thisWrapperIdx.value]
        wrapper.tabWidgetMap[tabLocation.value.tabKey].splice(tabLocation.value.widgetIdx, 1)
        pageEngineStore.setCurWidgetDirect(null)
        pageEngineStore.curWidgetIdx = -1
      }
      ElNotification({
        type: 'success',
        title: '提示',
        message: '删除成功!',
        duration: 2000,
      })
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '已取消删除',
        duration: 500,
      })
    })
}
//克隆选中组件
const handleCopyClick = () => {
  ElMessageBox.confirm('是否克隆此组件?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      if (tabLocation.value) {
        const wrapper = formData.value.JsonObj.wrapperList[thisWrapperIdx.value]
        const cloneWidget = deepClone(props.widgetObj)
        cloneWidget.widgetOption.number = generateId()
        wrapper.tabWidgetMap[tabLocation.value.tabKey].push(cloneWidget)
      } else {
        pageEngineStore.copyWidget(curWrapper.value, curWidget.value)
      }
      ElNotification({
        type: 'success',
        title: '提示',
        message: '克隆成功!',
        duration: 2000,
      })
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '已取消克隆',
        duration: 500,
      })
    })
}

//拖拽开始事件
const handleDragStart = (e) => {
  // 设置拖拽数据,容器id和组件id组合发送给目标,因为是直接拖拽组件,所以作用是用于组件排序,而不是新增,和从左边拖拽有区别
  e.dataTransfer.setData(
    'sort_widget_idx',
    thisWrapperIdx.value + ',' + thisWidgetIdx.value
  )
}
//拖拽放置事件
const handleDrop = (e) => {
  e.preventDefault()
  e.stopPropagation()
  const sort_widget_idx = e.dataTransfer.getData('sort_widget_idx')
  if (sort_widget_idx) {
    const [fromWrapperIdx, fromWidgetIdx] = sort_widget_idx.split(',')
    if (fromWrapperIdx == thisWrapperIdx.value) {
      swapWidgets(fromWrapperIdx, fromWidgetIdx)
    } else {
      ElMessage({
        message: '不能将组件拖拽到其他容器内',
        duration: 1000,
        type: 'warning',
      })
    }
  }
  //如果是左边组件往当前组件拖拽,这默认执行该组件容器添加组件事件
  const widgetIdx = e.dataTransfer.getData('widgetIdx')
  if (widgetIdx) {
    //添加组件到该容器
    const newWidget = buildDefaultWidgetJson(
      props.widgetObj.widgetOption.wrapperNumber,
      pageEngineStore.widgetList[widgetIdx]
    )
    //更新状态机
    pageEngineStore.addWidget(thisWrapperIdx.value, newWidget)
  }
  //如果是容器往组件托,说明想与该组件的父容器换家
  const fromWrapperNumer = e.dataTransfer.getData('sort_wrapper_number')
  if (fromWrapperNumer) {
    swapWrappers(fromWrapperNumer, props.widgetObj.widgetOption.wrapperNumber)
  }
}

//交换容器顺序
const swapWrappers = (draggedWrapperNumer, targetWrapperNumer) => {
  const draggedIndex = getWrapperIdxByNumber(draggedWrapperNumer)
  const targetIndex = getWrapperIdxByNumber(targetWrapperNumer)
  //创建一个临时容器进行交换
  let temp = deepClone(formData.value)
  ;[
    temp.JsonObj.wrapperList[draggedIndex],
    temp.JsonObj.wrapperList[targetIndex],
  ] = [
    temp.JsonObj.wrapperList[targetIndex],
    temp.JsonObj.wrapperList[draggedIndex],
  ]

  //更新状态机
  pageEngineStore.updateFormData(temp)
  //修改当前容器索引状态机
  pageEngineStore.setCurWrapperIdx(targetIndex)
}

//根据容器编号获得索引
const getWrapperIdxByNumber = (number) => {
  const resultIndex = formData.value.JsonObj.wrapperList.findIndex(
    (item) => item.wrapperOption.number == number
  )
  return resultIndex
}

//交换组件顺序
const swapWidgets = (fromWrapperIdx, fromWidgetIdx) => {
  let tempIndex = thisWidgetIdx.value
  let temp = deepClone(formData.value)
  //创建一个临时容器进行交换
  ;[
    temp.JsonObj.wrapperList[fromWrapperIdx].widgetList[fromWidgetIdx],
    temp.JsonObj.wrapperList[thisWrapperIdx.value].widgetList[
      thisWidgetIdx.value
    ],
  ] = [
    temp.JsonObj.wrapperList[thisWrapperIdx.value].widgetList[
      thisWidgetIdx.value
    ],
    temp.JsonObj.wrapperList[fromWrapperIdx].widgetList[fromWidgetIdx],
  ]
  //更新状态机
  pageEngineStore.updateFormData(temp)
  //修改当前组件索引状态机
  pageEngineStore.setCurWidgetIdx(tempIndex)
}
//拖拽完成后
const handleDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}

//拖动下边框调整高度****************************************************

const startResizeHeight = useResizable(curWidget, 'height').startResize
const startResizeMargin = useResizable(curWidget, 'marginTop').startResize
</script>

<style lang="scss" scoped>
.common-widget-body {
  position: relative;
}

.pe-widget-skeleton {
  width: 100%;
  height: 100%;
  min-height: 120px;
  box-sizing: border-box;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 14px;
  background: var(--el-bg-color, #fff);
  overflow: hidden;
}

.pe-widget-skeleton,
.pe-widget-skeleton * {
  position: relative;
}

.pe-widget-skeleton::before {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.68), transparent);
  animation: pe-skeleton-shimmer 1.2s infinite;
}

.pe-skeleton-line,
.pe-skeleton-chart-title,
.pe-skeleton-table-head,
.pe-skeleton-media-icon,
.pe-skeleton-table-row span,
.pe-skeleton-chart-body span {
  display: block;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--el-fill-color-light), var(--el-fill-color), var(--el-fill-color-light));
  background-size: 220% 100%;
  animation: pe-skeleton-pulse 1.3s ease-in-out infinite;
}

.pe-skeleton-line {
  height: 12px;
  margin-bottom: 12px;
}

.pe-skeleton-line--short {
  width: 58%;
}

.pe-skeleton-line--value {
  width: 46%;
  height: 22px;
  margin-top: 10px;
  margin-bottom: 0;
}

.pe-widget-skeleton--statistic {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.pe-skeleton-metric {
  min-height: 74px;
  border-radius: 6px;
  padding: 12px;
  background: var(--el-fill-color-extra-light);
}

.pe-skeleton-chart-title {
  width: 34%;
  height: 14px;
  margin-bottom: 22px;
}

.pe-skeleton-chart-body {
  height: calc(100% - 40px);
  min-height: 120px;
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.pe-skeleton-chart-body span {
  flex: 1;
  min-width: 10px;
}

.pe-skeleton-chart-body span:nth-child(1) { height: 36%; }
.pe-skeleton-chart-body span:nth-child(2) { height: 58%; }
.pe-skeleton-chart-body span:nth-child(3) { height: 44%; }
.pe-skeleton-chart-body span:nth-child(4) { height: 76%; }
.pe-skeleton-chart-body span:nth-child(5) { height: 62%; }
.pe-skeleton-chart-body span:nth-child(6) { height: 48%; }
.pe-skeleton-chart-body span:nth-child(7) { height: 68%; }

.pe-skeleton-table-head {
  height: 32px;
  margin-bottom: 10px;
}

.pe-skeleton-table-row {
  display: grid;
  grid-template-columns: 1.2fr 1fr 0.8fr;
  gap: 10px;
  margin-bottom: 10px;
}

.pe-skeleton-table-row span {
  height: 24px;
}

.pe-widget-skeleton--media {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.pe-skeleton-media-icon {
  width: 54px;
  height: 54px;
  border-radius: 50%;
}

@keyframes pe-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@keyframes pe-skeleton-pulse {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}

.widget-design-select-mask {
  position: absolute;
  inset: 0;
  z-index: 8;
  cursor: pointer;
  background: transparent;
}

.widget-design-select-mask:hover {
  box-shadow: inset 0 0 0 1px var(--el-color-success-light-3);
}

.resize-handle {
  position: absolute;
  border-radius: 4px;
  background-color: var(--el-color-success);
}

.resize-handle-top {
  top: -5px;
  left: calc(50% - 15px);
  width: 30px;
  height: 8px;
  cursor: ns-resize !important;
}

.resize-handle-bottom {
  bottom: -5px;
  left: calc(50% - 15px);
  width: 30px;
  height: 8px;
  cursor: ns-resize !important;
  z-index: 999;
}

.resize-handle-right {
  right: 4px;
  top: calc(50% - 15px);
  width: 6px;
  height: 30px;
  cursor: ew-resize;
}
</style>
