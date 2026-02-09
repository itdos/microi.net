<template>
  <el-col
    :span="dynamicSpan"
    :offset="
      formData.JsonObj.formConfig?.mobile == true
        ? 0
        : wrapperObj.wrapperOption.offset
    "
    :push="
      formData.JsonObj.formConfig?.mobile == true
        ? 0
        : wrapperObj.wrapperOption.push
    "
    :pull="
      formData.JsonObj.formConfig?.mobile == true
        ? 0
        : wrapperObj.wrapperOption.pull
    "
    :style="[
      { padding: wrapperObj.wrapperOption.margin },
      { marginTop: dynamicMarginTop + 'px' },
    ]"
    @dragstart="handleDragStart"
    @click="handleCardClick"
  >
    <el-card
      style="position: relative"
      :style="[{ backgroundColor: wrapperObj.wrapperOption.pannelColor }]"
      :shadow="formData.JsonObj.formConfig.shadow == true ? 'always' : 'never'"
      :body-style="wrapperObj.wrapperOption.dynamicStyle"
      class="box-card"
      :class="isShowBorder"
      @drop="handleDrop"
      @dragover="handleDragOver"
    >
      <div
        :draggable="formData.JsonObj.formConfig.drag"
        v-if="isShowBorderSub"
        class="drag-handler drag-left drag-top"
      >
        <el-text>
          <el-icon>
            <FullScreen />
          </el-icon>
          {{ wrapperObj.wrapperOption.number }} , 子元素
          {{ wrapperObj.widgetList.length }}
        </el-text>
      </div>

      <div v-if="isShowBorderSub" class="drag-handler drag-left drag-bottom">
        <el-text @click="handleDelClick">
          <el-icon>
            <Delete />
          </el-icon>
          删除
        </el-text>
      </div>

      <div
        v-if="isShowBorderSub"
        class="drag-handler drag-left ml-60 drag-bottom"
      >
        <el-text @click="handleCopyClick">
          <el-icon>
            <CopyDocument />
          </el-icon>
          克隆
        </el-text>
      </div>

      <template #header v-if="wrapperObj.wrapperOption.titleOption.hidden">
        <div
          :style="wrapperObj.wrapperOption.titleOption.dynamicStyle"
          class="clearfix"
        >
          <span>{{ wrapperObj.wrapperOption.titleOption.title }}</span>

          <el-link
            v-show="wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.hidden"
            @click="handleMoreClick"
            :style="
              wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.dynamicStyle
            "
            class="linkmore"
            :underline="false"
            :target="wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.linktype"
            >{{ wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.text }}
            <el-icon
              v-show="wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.iconShow"
              :size="20"
            >
              <component :is="dynamicIcon" />
            </el-icon>
          </el-link>
          <el-link
            class="linkmore"
            :underline="false"
            @click="callGrandchildMethod"
            v-show="
              wrapperObj.wrapperOption.titleOption.moreOption &&wrapperObj.wrapperOption.titleOption.moreOption.refresh != '0'
            "
            style="margin-right: 5px"
            :style="
              wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.dynamicStyle
            "
          >
            <span
              v-show="
                wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.refresh ==
                  '1' ||
                wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.refresh == '3'
              "
              >刷新</span
            >
            <el-icon
              v-show="
                wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.refresh ==
                  '2' ||
                wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.refresh == '3'
              "
              size="20"
            >
              <Refresh />
            </el-icon>
          </el-link>

          <el-link
            class="linkmore"
            :underline="false"
            v-show="
              wrapperObj.wrapperOption.titleOption.moreOption && (wrapperObj.wrapperOption.titleOption.moreOption.datetime == '1' ||
              wrapperObj.wrapperOption.titleOption.moreOption.datetime == '2')
            "
            style="margin-right: 5px"
            :style="
              wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.dynamicStyle
            "
          >
            <span style="margin-right: 5px">{{ formattedDate }}</span>
            <span
              v-show="
                wrapperObj.wrapperOption.titleOption.moreOption && wrapperObj.wrapperOption.titleOption.moreOption.datetime == '2'
              "
              >{{ formattedTime }}</span
            >
          </el-link>
        </div>
      </template>

      <div @drop="handleDrop" @dragover="handleDragOver" class="card-body">
        <div
          v-if="formData.JsonObj.formConfig?.mobile"
          :style="{ height: 'auto' }"
          class="scroll-area"
          :settings="settings"
        >
          <el-row :gutter="wrapperObj.wrapperOption.gutter">
            <!-- 渲染页面组件 -->
            <template
              v-for="widget in wrapperObj.widgetList"
              :key="widget.widgetOption.number"
            >
              <commonWidget :widgetObj="widget"></commonWidget>
            </template>
          </el-row>
        </div>
        <vue-custom-scrollbar
          v-else
          :style="{ height: props.wrapperObj.wrapperOption.height + 'px' }"
          class="scroll-area"
          :settings="settings"
        >
          <el-row :gutter="wrapperObj.wrapperOption.gutter">
            <!-- 渲染页面组件 -->
            <template
              v-for="widget in wrapperObj.widgetList"
              :key="widget.widgetOption.number"
            >
              <commonWidget :widgetObj="widget"></commonWidget>
            </template>
          </el-row>
        </vue-custom-scrollbar>
      </div>
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
    </el-card>
  </el-col>
</template>

<script setup name="pannel-wrapper">
import { computed, onMounted, ref, onBeforeUnmount } from 'vue'
import commonWidget from '../widget/common-widget.vue'
import { storeToRefs } from 'pinia'
import { EventBus } from '../../../utils/eventBus.js'
import { ElMessageBox, ElNotification, ElMessage } from 'element-plus'
import { usePageEngineStore } from '../../../stores/pageEngine'
import useResizable from '../../../hooks/useResizable'
import vueCustomScrollbar from 'vue-custom-scrollbar/src/vue-scrollbar.vue'
import 'vue-custom-scrollbar/dist/vueScrollbar.css'

import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import {
  buildDefaultWrapperJson,
  deepClone,
  buildDefaultWidgetJson,
} from '../../../utils/util'

const pageEngineStore = usePageEngineStore()
const { formData, curWrapperIdx, curWrapper } = storeToRefs(pageEngineStore)
const props = defineProps({
  wrapperObj: {
    type: Object,
    required: true,
  },
})

const currentDate = ref(new Date())
let timer = null
// 更新时间
const updateTime = () => {
  currentDate.value = new Date()
}

const autoHeight = computed(() => {
  if (formData.value.JsonObj.formConfig?.mobile) {
    return 'auto'
  }
  return props.wrapperObj.wrapperOption.height + 'px'
})

// 组件挂载时启动定时器
onMounted(() => {
  if (props.wrapperObj.wrapperOption.titleOption.moreOption && props.wrapperObj.wrapperOption.titleOption.moreOption.autotime) {
    timer = setInterval(
      updateTime,
      1000 * props.wrapperObj.wrapperOption.titleOption.moreOption && props.wrapperObj.wrapperOption.titleOption.moreOption.autotimeval
    )
  }
})

// 组件卸载前清除定时器
onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})

// 格式化日期
const formattedDate = computed(() => {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }
  return currentDate.value.toLocaleDateString(undefined, options)
})

// 格式化时间
const formattedTime = computed(() => {
  return currentDate.value.toLocaleTimeString()
})

const iconMap = Object.entries(ElementPlusIconsVue).reduce(
  (map, [name, component]) => {
    // 将驼峰式名称转换为短横线格式
    const iconName = name.replace(/([a-z])([A-Z])/g, '$1-$2')
    map[iconName] = component
    return map
  },
  {}
)

const dynamicIcon = computed(() => {
  return iconMap[props.wrapperObj.wrapperOption.titleOption.moreOption && props.wrapperObj.wrapperOption.titleOption.moreOption.icon] // 默认图标
})

//适配移动端
const dynamicSpan = computed(() => {
  if (formData.value.JsonObj.formConfig?.mobile) {
    return 24
  }
  return props.wrapperObj.wrapperOption.span
})

const dynamicMarginTop = computed(() => {
  if (formData.value.JsonObj.formConfig?.mobile) {
    return 0
  }
  return props.wrapperObj.wrapperOption.marginTop
})

const callGrandchildMethod = () => {
  let idx = formData.value.JsonObj.wrapperList.findIndex(
    (item) =>
      item.wrapperOption.number === props.wrapperObj.wrapperOption.number
  )
  formData.value.JsonObj.wrapperList[idx].widgetList.forEach((widget) => {
    if (widget.widgetParams[0].value) {
      let tempUrl = widget.widgetParams[0].value
      widget.widgetParams[0].value = ''
      setTimeout(() => {
        widget.widgetParams[0].value = tempUrl
      }, 100)
    }
  })

  // // 确保 updateFormData 不会导致无限循环
  // const newFormData = deepClone(formData.value)
  // pageEngineStore.updateFormData(newFormData)
}

const settings = {
  suppressScrollY: false,
  suppressScrollX: true,
  wheelPropagation: true,
}

const isShowBorder = computed(() => {
  return formData.value.JsonObj.formConfig.hover &&
    curWrapper.value?.wrapperOption?.number ==
      props.wrapperObj.wrapperOption.number
    ? 'hover-effect hover-effect-blue'
    : 'effect'
})

const isShowBorderSub = computed(() => {
  return (
    formData.value.JsonObj.formConfig.hover &&
    curWrapper.value?.wrapperOption?.number ==
      props.wrapperObj.wrapperOption.number
  )
})

const handleMoreClick = () => {
  if (formData.value.JsonObj.formConfig.link) {
    let linkUrl = props.wrapperObj.wrapperOption.titleOption.moreOption && props.wrapperObj.wrapperOption.titleOption.moreOption.linkurl

    let linkType =
      props.wrapperObj.wrapperOption.titleOption.moreOption && props.wrapperObj.wrapperOption.titleOption.moreOption.linktype

    //组件通信
    EventBus.emit('cartMoreLink', linkUrl)

    const dataToSend = {
      key: 'cartMoreLink',
      value: linkUrl,
    }
    //iframe 通信
    window.parent.postMessage(dataToSend, '*')
    console.log('卡片连接跳转消息已发出:', dataToSend) // 添加日志输出
  } else {
    console.log('链接跳转已禁用')
  }
}
//右键删除
const handleDelClick = () => {
  ElMessageBox.confirm('是否删除此容器?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      pageEngineStore.delWrapper(curWrapperIdx.value)

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

//拷贝容器
const handleCopyClick = () => {
  ElMessageBox.confirm('是否克隆此容器?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      pageEngineStore.copyWrapper(curWrapper.value)
      ElNotification({
        type: 'success',
        title: '提示',
        message: '克隆成功',
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

//点击面板时触发
const handleCardClick = (e) => {
  //触发切换容器选项卡
  EventBus.emit('activeName', 'second')
  //点击到内部区域
  if (e.target.className === 'card-body') {
  }
  //获取当前
  //容器索引
  let idx = formData.value.JsonObj.wrapperList.findIndex(
    (item) =>
      item.wrapperOption.number === props.wrapperObj.wrapperOption.number
  )

  if (idx > -1) {
    //修改状态机
    pageEngineStore.setCurWrapperIdx(idx)
    pageEngineStore.setCurWidgetIdx(-1)
  }
}

//拖拽放置事件
const handleDrop = (e) => {
  e.preventDefault()
  e.stopPropagation()
  const widgetIdx = e.dataTransfer.getData('widgetIdx')
  const wrapperIdx = e.dataTransfer.getData('wrapperIdx')
  //如果接收的是组件
  if (widgetIdx) {
    //添加组件到该容器
    const newWidget = buildDefaultWidgetJson(
      props.wrapperObj.wrapperOption.number,
      pageEngineStore.widgetList[widgetIdx]
    )
    //托管wrapper的索引
    let wrapperIdx = formData.value.JsonObj.wrapperList.findIndex(
      (item) =>
        item.wrapperOption.number === props.wrapperObj.wrapperOption.number
    )
    //更新状态机
    pageEngineStore.addWidget(wrapperIdx, newWidget)
  } else if (wrapperIdx) {
    //如果是左边菜单容器
    const newWrapper = buildDefaultWrapperJson(wrapperIdx)
    //更新状态机
    pageEngineStore.addWrapper(newWrapper)
  } else {
    //如果是兄弟容器,那么将进行位置互换
    const fromWrapperNumer = e.dataTransfer.getData('sort_wrapper_number')
    if (
      fromWrapperNumer &&
      props.wrapperObj.wrapperOption.number != fromWrapperNumer
    ) {
      swapWrappers(fromWrapperNumer, props.wrapperObj.wrapperOption.number)
    }
  }
}
//拖拽完成后
const handleDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}
//拖拽容器进行排序
const handleDragStart = (e) => {
  e.dataTransfer.setData(
    'sort_wrapper_number',
    props.wrapperObj.wrapperOption.number
  )
}
//根据容器编号获得索引
const getWrapperIdxByNumber = (number) => {
  const resultIndex = formData.value.JsonObj.wrapperList.findIndex(
    (item) => item.wrapperOption.number == number
  )
  return resultIndex
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

//拖动下边框调整高度****************************************************

const startResizeHeight = useResizable(curWrapper, 'height').startResize
const startResizeMargin = useResizable(curWrapper, 'marginTop').startResize
</script>

<style lang="scss">
.microi-page-engine {
  .ml-60 {
    margin-left: 60px;
  }
  .linkmore {
    float: right;
  }

  .effect {
    border: 2px solid transparent;
  }

  .hover-effect-blue {
    border: 2px dashed #66b1ff;
  }
  .hover-effect-green {
    border: 2px dashed #67c23a;
  }

  .hover-effect {
    transition: box-shadow 0.3s;
    cursor: pointer;

    border-radius: 2px;
    .drag-top {
      top: 4px;
      cursor: move;
    }

    .drag-bottom {
      bottom: 4px;
    }
    .drag-center {
      left: 120px;
      background: #66b1ff;
    }

    .drag-left {
      left: 4px;
      background: #66b1ff;
      // opacity: 0.9;
    }
    .drag-right {
      right: 4px;
      background: #67c23a;
      // opacity: 0.9;
    }

    .drag-handler {
      // top: 0;
      color: #fff;
      position: absolute;
      padding: 2px;
      box-sizing: border-box;
      display: flex;
      flex-flow: wrap;
      justify-content: start;
      align-items: center;
      gap: 0px 3px;
      z-index: 9;
      border-radius: 2px;
    }

    .drag-handler > span {
      font-size: 13px;
      font-style: normal;
      i {
        font-size: 13px;
      }
      padding: 2px 4px;
      color: #fff;
    }
  }
}
</style>

<style lang="scss" scoped>
.resize-handle {
  position: absolute;
  border-radius: 4px;
  background-color: #66b1ff;
  background-color: #66b1ff;
  border-radius: 4px;
  z-index: 999;
}

.resize-handle-top {
  top: 4px;
  left: calc(50% - 15px);
  width: 30px;
  height: 8px;
  cursor: ns-resize !important;
  z-index: 999;
}

.resize-handle-bottom {
  bottom: 4px;
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
  z-index: 999;
}
.scroll-area {
  position: relative;
  margin: auto;
  width: 100%;
}
</style>
