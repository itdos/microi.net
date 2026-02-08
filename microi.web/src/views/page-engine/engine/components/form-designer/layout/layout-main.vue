<template>
  <div class="layout-main">
    <vue-custom-scrollbar class="scroll-area" :settings="settings">
      <div
        @drop="handleDrop"
        @dragover="handleDragOver"
        style="position: relative; min-height: 500vh"
      >
        <!-- 网格线 -->
        <container-grid></container-grid>
        <!-- 主面板 -->
        <el-row
          style="width: 100%"
          :style="formData.JsonObj.formConfig.dynamicStyle"
          :gutter="formData.JsonObj.formConfig.gutter"
        >
          <!-- 渲染页面组件 -->
          <template
            v-for="(wrapper, index) in formData.JsonObj.wrapperList"
            :key="wrapper.type + index"
          >
            <pannel-wrapper :wrapperObj="wrapper"> </pannel-wrapper>
          </template>
        </el-row>
      </div>
    </vue-custom-scrollbar>
  </div>
</template>

<script setup name="layout-main">
import { nextTick, toRaw } from 'vue'
import { storeToRefs } from 'pinia'
import containerGrid from './container-grid.vue'
import pannelWrapper from '../wrapper/pannel-wrapper.vue'
import vueCustomScrollbar from 'vue-custom-scrollbar/src/vue-scrollbar.vue'
import 'vue-custom-scrollbar/dist/vueScrollbar.css'
import { buildDefaultWrapperJson, buildDefaultWidgetJson } from '../../../utils/util'
import { usePageEngineStore } from '../../../stores/pageEngine'

const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)
const componentRaw = toRaw(pageEngineStore.widgetList)

const settings = {
  suppressScrollY: false,
  suppressScrollX: true,
  wheelPropagation: true,
}

const handleDrop = (e) => {
  e.preventDefault()
  e.stopPropagation()
  const wrapperIdx = e.dataTransfer.getData('wrapperIdx')
  //如果接收的是容器
  if (wrapperIdx) {
    //添加新容器
    const newWrapper = buildDefaultWrapperJson(wrapperIdx)
    //更新状态机
    pageEngineStore.addWrapper(newWrapper)
  } else {
    const widgetIdx = e.dataTransfer.getData('widgetIdx')
    //如果接收的是容器
    if (widgetIdx) {
      //如果面板接收的是组件,则默认先添加一个容器
      const newWrapper = buildDefaultWrapperJson(0)
      //更新状态机
      pageEngineStore.addWrapper(newWrapper)

      nextTick(() => {
        //添加组件到该容器
        const newWidget = buildDefaultWidgetJson(
          newWrapper.wrapperOption.number,
          componentRaw[widgetIdx]
        )
        //更新状态机
        pageEngineStore.addWidget(
          formData.value.JsonObj.wrapperList.length - 1,
          newWidget
        )
      })
    }
  }
}
//拖拽完成后
const handleDragOver = (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}
</script>

<style lang="scss">
.microi-page-engine {
  .el-dialog__body {
    margin: 0;
    padding: 10px 20px;
  }
  .el-drawer__header {
    padding: 10px !important;
    margin-bottom: 0px;
  }
  .el-card.is-always-shadow,
  .el-card.is-hover-shadow:focus,
  .el-card.is-hover-shadow:hover {
    box-shadow: 0 0px 4px 0px rgba(0, 0, 0, 0.1);
    // border: 1px solid rgba(0, 0, 0, 0.1);
  }
}
</style>

<style lang="scss" scoped>
.layout-main {
  margin: 12px 8px;
  height: calc(80vh + 28px);

  .scroll-area {
    position: relative;
    margin: auto;
    width: 100%;
    height: 100%;
  }
}
</style>
