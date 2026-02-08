<template>
  <div class="microi-page-engine pageengine">
    <el-container>
      <el-header ref="ref1" height="60px">
        <layout-header></layout-header>
      </el-header>
      <el-container>
        <el-aside
          ref="ref2"
          width="200px"
          v-show="formData?.JsonObj?.formConfig?.left"
        >
          <layout-left></layout-left>
        </el-aside>
        <el-main>
          <layout-main></layout-main>
        </el-main>
        <el-aside ref="ref3" width="280px">
          <layout-right></layout-right>
        </el-aside>
      </el-container>
    </el-container>
  </div>
  <el-tour
    v-model="tourOpen"
    @close="closeTour"
    :mask="{
      style: {
        boxShadow: 'inset 0 0 15px #333',
      },
      color: 'rgba(121.3, 187.1, 255, .4)',
    }"
  >
    <el-tour-step :target="ref1?.$el" title="功能导航区">
      <div>
        功能导航区主要包括收缩侧边栏,查看页面JSON和清空容器等.可以预览设计效果和保存持久化,可以切换主题风格
      </div>
    </el-tour-step>
    <el-tour-step
      :target="ref2?.$el"
      title="组件容器区"
      description="可以拖拽容器到操作面板中,也可以拖拽组件到容器中,容器和容器可以互换位置,组件和组件之间可以互换位置"
      placement="left"
      :mask="{
        style: {
          boxShadow: 'inset 0 0 15px #fff',
        },
        color: 'rgba(121.3, 187.1, 255, .4)',
      }"
    />
    <el-tour-step
      :target="ref3?.$el"
      title="属性面板区"
      description="属性面板区包括页面属性,容器属性和组件属性,可以通过调节属性来实现效果呈现"
      placement="right"
      :mask="{
        style: {
          boxShadow: 'inset 0 0 15px #fff',
        },
        color: 'rgba(121.3, 187.1, 255, .4)',
      }"
    />
  </el-tour>
</template>

<script setup name="form-designer">
import { onMounted, onBeforeUnmount, ref } from 'vue'
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

//引导三剑客标识
const ref1 = ref(null)
const ref2 = ref(null)
const ref3 = ref(null)
const tourOpen = ref(false)
if (pageEngineStore.tour == 'true' || pageEngineStore.tour == true) {
  tourOpen.value = true
}

//关闭引导
const closeTour = () => {
  tourOpen.value = false
  pageEngineStore.setTour(false) //说明已经不是第一次,下次打开不提示
}

let messageHandler = null
onMounted(() => {
  // 接收父窗体跨域token
  messageHandler = function (event) {
    // if (event.origin !== '你的网址') {
    //   return
    // }
    let receivedData = event.data
    let token = receivedData?.iframeToken
    if (token) {
      pageEngineStore.setToken(token)
    }

    // 父窗体有传数据过来
    let iframeFormData = receivedData?.iframeFormData
    if (iframeFormData) {
      let obj = JSON.parse(iframeFormData)
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
    // background: #fff;
  }
  .el-header {
    padding: 0;
    background-color: #fff;
  }
  .el-main {
    margin: 0;
    padding: 0;
  }
}
</style>
