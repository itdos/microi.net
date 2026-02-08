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
      </Suspense>
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
import { deepClone, buildDefaultWidgetJson } from '../../../utils/util'
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

const autoHeight = computed(() => {
  if (formData.value.JsonObj.formConfig?.mobile) {
    return 'auto'
  }
  return props.widgetObj.widgetOption.height + 'px'
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
  return formData.value.JsonObj.wrapperList[
    thisWrapperIdx.value
  ].widgetList.findIndex(
    (item) => item.widgetOption.number === props.widgetObj.widgetOption.number
  )
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
      pageEngineStore.delWidget(thisWrapperIdx.value, thisWidgetIdx.value)
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
      pageEngineStore.copyWidget(curWrapper.value, curWidget.value)
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
.resize-handle {
  position: absolute;
  border-radius: 4px;
  background-color: #67c23a;
  background-color: #67c23a;
  border-radius: 4px;
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
