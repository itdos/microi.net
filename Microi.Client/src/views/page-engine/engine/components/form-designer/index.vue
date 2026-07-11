<template>
  <div class="microi-page-engine pageengine">
    <el-container>
      <el-header height="50px">
        <layout-header></layout-header>
      </el-header>
      <el-container>
        <el-aside
          width="250px"
          v-show="formData?.JsonObj?.formConfig?.left"
        >
          <layout-left></layout-left>
        </el-aside>
        <el-main>
          <layout-main></layout-main>
        </el-main>
        <el-aside width="280px">
          <layout-right></layout-right>
        </el-aside>
      </el-container>
    </el-container>
  </div>
</template>

<script setup name="form-designer">
import { onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import loadComponentsFromFolder from '../../utils/dynamicComponents'
import LayoutHeader from './layout/layout-header.vue'
import LayoutLeft from './layout/layout-left.vue'
import LayoutRight from './layout/layout-right.vue'
import LayoutMain from './layout/layout-main.vue'
import {
  buildDefaultFormJson,
  isEmpty,
  buildDefaultJsonObj,
} from '../../utils/util'
import { widgetList, widgetOption } from '../../utils/builtWidget'
import { usePageEngineStore } from '../../stores/pageEngine'
import 'element-plus/theme-chalk/dark/css-vars.css'

const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)

//注册组件
let components = {}
components = loadComponentsFromFolder('widget')

//传参
const props = defineProps({
  remoteObj: Object,
  isPrivew: Boolean,
  components: Array,
  widgets: Array,
})

//加载自定义组件
const loadOtherWidgets = () => {
  //判断是否传了自定义组件
  if (props.components instanceof Array && props.components.length > 0) {
    // 使用 reduce 方法将对象数组合并成一个对象
    const newComponents = props.components.reduce(
      (acc, obj) => ({ ...acc, ...obj }),
      {}
    )
    // 将新的 components 合并到现有的 components 对象中
    components = { ...components, ...newComponents }
    pageEngineStore.components = components
  } else {
    pageEngineStore.components = components
  }

  //初次组装组件的通用属性
  if (props.widgets instanceof Array && props.widgets.length > 0) {
    //遍历组装组件列表
    for (let i = 0, len = props.widgets.length; i < len; i++) {
      const item = props.widgets[i]
      const tempHeight = item.widgetOption.height
      item.widgetOption = {
        ...widgetOption,
        ...item.widgetOption,
      }
      item.widgetOption.height = tempHeight || 210
    }
    //与内置组件合并
    let newWidgets = [...widgetList, ...props.widgets]
    //更新状态机
    pageEngineStore.widgetList = newWidgets
  } else {
    pageEngineStore.widgetList = widgetList
  }
}

loadOtherWidgets()

let messageHandler = null
onMounted(() => {
  // 接收父窗体跨域token
  messageHandler = function (event) {
    // 安全修复：增加 origin 校验，仅信任与当前页面同源的来源
    // 否则任意外部站点把本应用嵌为 iframe 即可发 postMessage 写入 Token，劫持会话。
    try {
      if (event.origin && event.origin !== window.location.origin && event.origin !== 'null') {
        return
      }
    } catch (e) { return }
    let receivedData = event.data
    let token = receivedData?.iframeToken
    if (token) {
      pageEngineStore.setToken(token)
    }

    // 父窗体有传数据过来
    let iframeFormData = receivedData?.iframeFormData
    if (iframeFormData) {
      let obj
      try {
        obj = JSON.parse(iframeFormData)
      } catch (e) {
        console.warn('[form-designer] iframeFormData JSON 解析失败:', e && e.message)
        return
      }
      if (!obj.JsonObj || isEmpty(obj.JsonObj)) {
        obj.JsonObj = buildDefaultJsonObj()
      }
      pageEngineStore.updateFormData(obj)
    }
  }
  //接收父窗体传值，包括token和数据
  window.addEventListener('message', messageHandler)
})

onBeforeUnmount(() => {
  // 取消监听事件
  window.removeEventListener('message', messageHandler)
})

const loadFormData = () => {
  //本地数据模拟
  let defaultFormJson = buildDefaultFormJson()
  if (props.remoteObj && Object.keys(props.remoteObj).length > 0) {
    defaultFormJson = props.remoteObj

    if (!defaultFormJson.JsonObj || isEmpty(defaultFormJson.JsonObj)) {
      defaultFormJson.JsonObj = buildDefaultJsonObj()
    }
  }
  //设置初始状态
  defaultFormJson.JsonObj.formConfig.mask = true
  defaultFormJson.JsonObj.formConfig.drag = true
  defaultFormJson.JsonObj.formConfig.hover = true
  defaultFormJson.JsonObj.formConfig.link = false
  //保存到状态机
  pageEngineStore.updateFormData(defaultFormJson)
}

loadFormData()
</script>

<style lang="scss">
.microi-page-engine.pageengine{
  padding-top: var(--status-bar-height, 0px);
}
.microi-page-engine {
  .jsoneditor-poweredBy {
    display: none;
  }
  .card-body {
    padding: 0;
  }
  &.microi.Classic .fixed-header-microi,
  &.microi.Classic .hasTagsView .app-main-microi {
    padding-left: 0px;
    padding-right: 0px;
  }
  &.microi.Classic .app-main-microi {
    padding-top: 5px !important;
  }

  // 因为 microi-page-engine 和 pageengine 是同一个元素
  // 使用 & 来表示同一元素的复合选择器
  .el-aside {
    padding: 0;
  }
  .el-header {
    padding: 0;
    background-color: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color-lighter);
    transition: background-color 0.3s, border-color 0.3s;
  }
  .el-main {
    margin: 0;
    padding: 0;
  }
}

/* ===== 暗色/浅色主题适配 ===== */
.microi-page-engine {
  /* 左侧面板 */
  .layout-left .el-card,
  .layout-right .el-card {
    background-color: var(--el-bg-color);
    border-color: var(--el-border-color-lighter);
    transition: background-color 0.3s, border-color 0.3s;
  }
  /* 容器卡片 */
  .box-card {
    background-color: var(--el-bg-color);
    transition: background-color 0.3s;
  }
  /* 暗色模式下额外覆盖 */
  .el-aside {
    background-color: var(--el-bg-color);
    transition: background-color 0.3s;
  }
}
</style>
