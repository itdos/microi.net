<template>
  <div class="microi-page-engine pageengine">
    <template v-if="showWatermark">
      <el-watermark
        :content="formData.JsonObj.formConfig.watermarkStyle.content"
        :font="formData.JsonObj.formConfig.watermarkStyle.font"
        :rotate="formData.JsonObj.formConfig.watermarkStyle.rotate"
      >
        <!-- 主面板 -->
        <el-row
          style="min-height: 100%; width: 100%"
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
      </el-watermark>
    </template>
    <template v-else>
      <!-- 主面板 -->
      <el-row
        style="min-height: 100%; width: 100%"
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
    </template>
  </div>
</template>

<script setup name="from-renderer">
import pannelWrapper from '../form-designer/wrapper/pannel-wrapper.vue'
import { computed, onMounted, onBeforeUnmount } from 'vue'
import loadComponentsFromFolder from '../../utils/dynamicComponents'
import { storeToRefs } from 'pinia'
import {
  buildDefaultFormJson,
  isEmpty,
  buildDefaultJsonObj,
} from '../../utils/util'

import { widgetList, widgetOption } from '../../utils/builtWidget'

import { usePageEngineStore } from '../../stores/pageEngine'
import { useDark } from '@vueuse/core'

const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)

//是否暗黑模式
const isDark = useDark()

//注册组件
let components = {}
components = loadComponentsFromFolder('widget')

const props = defineProps({
  remoteObj: Object,
  isPrivew: Boolean,
  components: Array,
  widgets: Array,
})

//如果有自定义组件
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

//判断是否是移动端
const isMobile = () => {
  return window.innerWidth < 768
}

//获取页面数据
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
  defaultFormJson.JsonObj.formConfig.mask = false
  defaultFormJson.JsonObj.formConfig.drag = false
  defaultFormJson.JsonObj.formConfig.hover = false
  defaultFormJson.JsonObj.formConfig.link = true

  if (isMobile()) {
    console.log('当前是移动端')
    defaultFormJson.JsonObj.formConfig.mobile = true
  } else {
    console.log('当前是PC端')
    defaultFormJson.JsonObj.formConfig.mobile = false
  }
  //保存到状态机
  pageEngineStore.updateFormData(defaultFormJson)
}
//iframe监听事件
let messageHandler = null

//定时刷新
let refreshInterval = null

// 提取定时刷新逻辑到独立函数
const setupRefreshInterval = () => {
  let i = formData.value.JsonObj?.formConfig?.autoRefresh * 1000
  if (formData.value.JsonObj?.formConfig?.autoRefresh) {
    refreshInterval = setInterval(() => {
      console.log('定时刷新任务触发')
      pageEngineStore.setLastRefreshTime()
    }, i)
  }
}

onMounted(() => {
  //加载暗黑模式
  isDark.value = formData.value.JsonObj?.formConfig?.dark

  // 使用提取的函数设置定时刷新
  setupRefreshInterval()

  // 接收父窗体跨域token 和 初始数据
  messageHandler = function (event) {
    // if (event.origin !== '你的网址') {
    //   return
    // }
    let receivedData = event.data
    let token = receivedData?.iframeToken
    if (token) {
      console.log('页面引擎已接收到token,一切正常')
      pageEngineStore.setToken(token)
    }

    // //判断是否切换语言
    // if (typeof window.translate !== 'undefined') {
    //   let lang = receivedData?.iframeLang
    //   if (lang && lang !== 'none' && lang !== 'zh-CN' && lang !== 'en') {
    //     console.log('页面引擎已接收到lang,一切正常')

    //     translate.service.use('client.edge')
    //     translate.selectLanguageTag.show = false
    //     translate.listener.start()
    //     setTimeout(function () {
    //       let tempLang = translate.language.getCurrent()
    //       if (tempLang != lang) {
    //         translate.changeLanguage(lang)
    //       } else {
    //         translate.execute() // 执行翻译
    //       }
    //     }, 2000)
    //   }
    // }

    // 父窗体有传数据过来
    let iframeFormData = receivedData?.iframeFormData
    if (iframeFormData) {
      let defaultFormJson = JSON.parse(iframeFormData)
      if (!defaultFormJson.JsonObj || isEmpty(defaultFormJson.JsonObj)) {
        defaultFormJson.JsonObj = buildDefaultJsonObj()
      }

      //设置初始状态
      defaultFormJson.JsonObj.formConfig.mask = false
      defaultFormJson.JsonObj.formConfig.drag = false
      defaultFormJson.JsonObj.formConfig.hover = false
      defaultFormJson.JsonObj.formConfig.link = true

      if (isMobile()) {
        console.log('当前是移动端')
        defaultFormJson.JsonObj.formConfig.mobile = true
      } else {
        console.log('当前是PC端')
        defaultFormJson.JsonObj.formConfig.mobile = false
      }
      pageEngineStore.updateFormData(defaultFormJson)

      //加载暗黑模式
      isDark.value = defaultFormJson.JsonObj?.formConfig?.dark

      let i = defaultFormJson.JsonObj?.formConfig?.autoRefresh * 1000
      if (
        defaultFormJson.JsonObj?.formConfig?.autoRefresh &&
        !refreshInterval
      ) {
        refreshInterval = setInterval(() => {
          pageEngineStore.setLastRefreshTime()
        }, i)
      }
    }
  }

  //接收父窗体跨域token
  window.addEventListener('message', messageHandler)
})

onBeforeUnmount(() => {
  // 取消监听事件
  window.removeEventListener('message', messageHandler)

  // 清除定时器
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
})

const showWatermark = computed(
  () => formData.value.JsonObj.formConfig.watermark
)

if (!props.isPrivew) {
  //如果有页面有传参数
  loadFormData()
} else {
  formData.value.JsonObj.formConfig.mask = false
  formData.value.JsonObj.formConfig.drag = false
  formData.value.JsonObj.formConfig.hover = false
  formData.value.JsonObj.formConfig.link = true

  if (isMobile()) {
    console.log('当前是移动端')
    formData.value.JsonObj.formConfig.mobile = true
  } else {
    console.log('当前是PC端')
    formData.value.JsonObj.formConfig.mobile = false
  }
}
</script>

<style lang="scss">
.microi-page-engine {
  .el-header {
    padding: 0;
  }
  .el-main {
    margin: 0;
    padding: 0;
  }
}
</style>
