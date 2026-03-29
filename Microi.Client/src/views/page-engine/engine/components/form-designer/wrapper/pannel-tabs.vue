<template>
  <el-col
    :span="dynamicSpan"
    :offset="formData.JsonObj.formConfig?.mobile ? 0 : wrapperObj.wrapperOption.offset"
    :push="formData.JsonObj.formConfig?.mobile ? 0 : wrapperObj.wrapperOption.push"
    :pull="formData.JsonObj.formConfig?.mobile ? 0 : wrapperObj.wrapperOption.pull"
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
      :shadow="formData.JsonObj.formConfig.shadow ? 'always' : 'never'"
      :body-style="wrapperObj.wrapperOption.dynamicStyle"
      class="box-card"
      :class="isShowBorder"
    >
      <!-- Container drag handler -->
      <div
        :draggable="formData.JsonObj.formConfig.drag"
        v-if="isShowBorderSub"
        class="drag-handler drag-left drag-top"
      >
        <el-text>
          <el-icon><FullScreen /></el-icon>
          {{ wrapperObj.wrapperOption.number }} , 选项卡容器
        </el-text>
      </div>

      <div v-if="isShowBorderSub" class="drag-handler drag-left drag-bottom">
        <el-text @click="handleDelClick">
          <el-icon><Delete /></el-icon>
          删除
        </el-text>
      </div>

      <div v-if="isShowBorderSub" class="drag-handler drag-left ml-60 drag-bottom">
        <el-text @click="handleCopyClick">
          <el-icon><CopyDocument /></el-icon>
          克隆
        </el-text>
      </div>

      <!-- Tab Component -->
      <el-tabs
        v-model="activeTab"
        :type="wrapperObj.wrapperOption.tabType || ''"
        :tab-position="wrapperObj.wrapperOption.tabPosition || 'top'"
        @tab-click="onTabClick"
      >
        <el-tab-pane
          v-for="tab in tabsList"
          :key="tab.key"
          :label="tab.label"
          :name="tab.key"
          :lazy="true"
        >
          <div
            class="tab-drop-zone"
            :style="{ minHeight: wrapperObj.wrapperOption.height - 60 + 'px' }"
            @drop="(e) => handleTabDrop(e, tab.key)"
            @dragover="handleDragOver"
          >
            <el-row :gutter="wrapperObj.wrapperOption.gutter">
              <template
                v-for="widget in getTabWidgets(tab.key)"
                :key="widget.widgetOption.number"
              >
                <commonWidget :widgetObj="widget"></commonWidget>
              </template>
            </el-row>
            <div v-if="getTabWidgets(tab.key).length === 0" class="tab-empty-hint">
              <el-icon :size="24"><Plus /></el-icon>
              <span>将组件拖入此标签页</span>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- Resize handles -->
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

<script setup name="pannel-tabs">
import { computed, ref, onBeforeUnmount } from 'vue'
import commonWidget from '../widget/common-widget.vue'
import { storeToRefs } from 'pinia'
import { EventBus } from '../../../utils/eventBus.js'
import { ElMessageBox, ElNotification, ElMessage } from 'element-plus'
import { usePageEngineStore } from '../../../stores/pageEngine'
import useResizable from '../../../hooks/useResizable'
import { buildDefaultWidgetJson, deepClone } from '../../../utils/util'

const pageEngineStore = usePageEngineStore()
const { formData, curWrapperIdx, curWrapper } = storeToRefs(pageEngineStore)

const props = defineProps({
  wrapperObj: {
    type: Object,
    required: true,
  },
})

// Active tab tracking
const activeTab = ref(props.wrapperObj.wrapperOption.activeTab || props.wrapperObj.wrapperOption.tabs?.[0]?.key || 'tab_1')

const tabsList = computed(() => {
  return props.wrapperObj.wrapperOption.tabs || []
})

const dynamicSpan = computed(() => {
  return formData.value.JsonObj.formConfig?.mobile ? 24 : props.wrapperObj.wrapperOption.span
})

const dynamicMarginTop = computed(() => {
  return formData.value.JsonObj.formConfig?.mobile ? 0 : props.wrapperObj.wrapperOption.marginTop
})

const isShowBorder = computed(() => {
  return formData.value.JsonObj.formConfig.hover &&
    curWrapper.value?.wrapperOption?.number === props.wrapperObj.wrapperOption.number
    ? 'hover-effect hover-effect-blue'
    : 'effect'
})

const isShowBorderSub = computed(() => {
  return (
    formData.value.JsonObj.formConfig.hover &&
    curWrapper.value?.wrapperOption?.number === props.wrapperObj.wrapperOption.number
  )
})

// Get widgets for a specific tab
const getTabWidgets = (tabKey) => {
  if (!props.wrapperObj.tabWidgetMap) return []
  return props.wrapperObj.tabWidgetMap[tabKey] || []
}

const onTabClick = () => {
  props.wrapperObj.wrapperOption.activeTab = activeTab.value
}

// Handle drop of widget into a tab
const handleTabDrop = (e, tabKey) => {
  e.preventDefault()
  e.stopPropagation()
  const widgetIdx = e.dataTransfer.getData('widgetIdx')
  if (widgetIdx) {
    const newWidget = buildDefaultWidgetJson(
      props.wrapperObj.wrapperOption.number,
      pageEngineStore.widgetList[widgetIdx]
    )
    // Ensure tabWidgetMap exists
    if (!props.wrapperObj.tabWidgetMap) {
      props.wrapperObj.tabWidgetMap = {}
    }
    if (!props.wrapperObj.tabWidgetMap[tabKey]) {
      props.wrapperObj.tabWidgetMap[tabKey] = []
    }
    props.wrapperObj.tabWidgetMap[tabKey].push(newWidget)
  }
}

const handleDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}

const handleDragStart = (e) => {
  e.dataTransfer.setData('sort_wrapper_number', props.wrapperObj.wrapperOption.number)
}

const handleCardClick = (e) => {
  EventBus.emit('activeName', 'second')
  const idx = formData.value.JsonObj.wrapperList.findIndex(
    (item) => item.wrapperOption.number === props.wrapperObj.wrapperOption.number
  )
  if (idx > -1) {
    pageEngineStore.setCurWrapperIdx(idx)
    pageEngineStore.setCurWidgetIdx(-1)
  }
}

const handleDelClick = () => {
  ElMessageBox.confirm('是否删除此容器?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      pageEngineStore.delWrapper(curWrapperIdx.value)
      ElNotification({ type: 'success', title: '提示', message: '删除成功!', duration: 2000 })
    })
    .catch(() => {
      ElMessage({ type: 'info', message: '已取消删除', duration: 500 })
    })
}

const handleCopyClick = () => {
  ElMessageBox.confirm('是否克隆此容器?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      pageEngineStore.copyWrapper(curWrapper.value)
      ElNotification({ type: 'success', title: '提示', message: '克隆成功', duration: 2000 })
    })
    .catch(() => {
      ElMessage({ type: 'info', message: '已取消克隆', duration: 500 })
    })
}

const startResizeHeight = useResizable(curWrapper, 'height').startResize
const startResizeMargin = useResizable(curWrapper, 'marginTop').startResize
</script>

<style lang="scss" scoped>
.tab-drop-zone {
  min-height: 100px;
  position: relative;
}
.tab-empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 100px;
  color: var(--el-text-color-placeholder);
  gap: 8px;
  border: 2px dashed var(--el-border-color-lighter);
  border-radius: 6px;
  transition: border-color 0.3s;
  &:hover {
    border-color: var(--el-color-primary);
  }
}
.resize-handle {
  position: absolute;
  border-radius: 4px;
  background-color: var(--el-color-primary);
  z-index: 999;
}
.resize-handle-top {
  top: 4px;
  left: calc(50% - 15px);
  width: 30px;
  height: 8px;
  cursor: ns-resize !important;
}
.resize-handle-bottom {
  bottom: 4px;
  left: calc(50% - 15px);
  width: 30px;
  height: 8px;
  cursor: ns-resize !important;
}
</style>
