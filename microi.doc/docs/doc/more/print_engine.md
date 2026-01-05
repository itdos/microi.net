# 打印引擎

## 简介
打印引擎主要解决了低代码平台的动态打印任务，我可以说只要祭出杀手锏 `iframe` `html` 组件，基本可以满足客户绝大部分无礼的打印要求。

演示地址：https://www.nbweixin.cn/autoprint/

效果图：

![打印引擎](/api_plugins/print01.png)

![打印引擎](/api_plugins/print02.png)

## 插件功能

**打印组件包括**:

- **普通文本**：可以设置文本的各种字体、颜色、背景等样式，不可或缺的角色。
- **键值对文本**：打印模板常用格式，配置如上。
- **动态表格**：超强动态表格，可以实现各种场景需求，试过就知道。
- **静态表格**：可以满足基本业务需求。
- **二维码**：可以满足基本需求，如果需要更好的体验感，可以使用草料二维码制成图片。
- **图片**：门面担当，人靠衣装，马靠鞍，精美的模板必不可少。
- **条形码**：可以满足基本需求，如果需要更好的体验感，可以使用草料二维码制成图片。
- **数据图表**：可以配置 `echart` 图表。
- **线条**：有实线、虚线等，满足基本需求，样式可调。
- **基本图形**：有圆形、矩形等。
- **装订线**：其实就是线条的一种。
- **业务组件**：根据实际业务场景预设常用的业务模板组件，可以节省不少时间。
- **html**：一般不用，主要解决难题用的，遇到搞不定的模板别忘了还有它。

## 集成方式

### npm包集成
- **优点**：可以自定义扩展组件，随心所欲设计自己的页面，不用写任何额外业务逻辑。
- **缺点**：要求必须基于 `vue3+vite+elementplus+echarts` 框架，不支持 `Vue2` 和其它前端框架。

1. 表结构
不管哪种方式集成,如果要持久化,那必须准备一张数据表,格式如下
```js
## 表结构,不管哪种方式集成,如果要持久化,那必须准备一张数据表,格式如下
{
    Id: '', //打印模板ID
    Title: '', //模板标题
    Number: '', //模板编号
    Desc: '', //模板描述
    DataApi: '', //数据接口
    PageObj: {} //页面json对象,存储自行转字符串
    PrintObj: {}, //动态打印对象,存储自行转字符串
  }
```
2. 图标库安装
```bash
npm install @element-plus/icons-vue
```

3. 全局注册图标
```js
// main.js
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
const app = createApp(App)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
```

4. npm包依赖
这里是所有的第三方依赖包，但不必全部安装第三方组件，`npm` 包内置了一些，只需依赖如下即可。
```js
   // 我打包时排除了这些，所以你们集成时必须要有这些依赖包
      external: [
        'vue',
        'axios',
        'echarts',
        'element-plus',
        '@element-plus/icons-vue',
        'pinia',
        'sass',
        'sass-loader',
        'vue-router',
        'jquery',
      ],
```
5. 完整demo
到这里基本前置条件就配置完成了，下面只需新建一个 `vue` 页面，参考下面代码就能跑起来了，是不是很简单。

```html
<template>
  <!-- 打印设计器 -->
  <printDesigner :remoteObj="remoteObj" />
</template>
 
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
 
import { printDesigner, EventBus, usePrintEngineStore } from 'microi-printengine'
import 'microi-printengine/style.css'
 
// import printDesigner from '@/components/print-designer.vue'
// import { EventBus } from '@/utils/eventBus'
// import { usePrintEngineStore } from '@/stores/printEngine'
 
import { createPinia } from 'pinia'
 
//状态机传参,npm包没包把pinia打包进去,正所谓巧妇难为无米之炊,给她传一个完事
const pinia = createPinia()
const printEngineStore = usePrintEngineStore(pinia)
 
//传入数据,这个数据不知道什么格式,可以在设计器拖拽几个组件查看下页面JSON ,和渲染JSON一毛一样的
const remoteObj = ref({})
 
//模拟测试数据
remoteObj.value = {
  Id: '001',
  Title: '测试打印模板',
  Number: '001',
  Desc: '这是一个初始的默认测试模板,你应该按照这个格式建表',
  DataApi: '',
  PageObj: {},
  PrintObj: {},
}
 
onMounted(() => {
  //如果需要token,设置token,该token一经接收即刻存入pinia状态机,每次调用接口通过拦截器自动处理token头,无需每次手动写,持久化用的localStorage ,可以F12查看
  printEngineStore.setToken('print_token')
 
  //监听保存页面JSON事件
  EventBus.on('savePrintJson', (savePrintJson) => {
    console.log('监听到了savePrintJson', savePrintJson)
  })
})
 
//销毁
onBeforeUnmount(() => {
  EventBus.off('savePrintJson')
})
</script>
 
<style scoped>
.dark {
  background: #252525;
  color: white;
}
 
.light {
  background-color: white;
  color: black;
}
</style>
```

### iframe外挂形式集成
任何前端框架都可以集成，这种模式说白了就是百搭，它是无状态的,不依赖任何前端和后端,高内聚低耦合,可集成任意平台。

- **优点**：可以对接任何平台，无状态，无侵染，零耦合，方便快捷。
- **缺点**：只能使用内置组件，不能自定义组件。

1. 核心原理
平台集成使用 `frame` ，把页面设计器嵌入到自己页面中,通过 `postMessage` 方式与父页面进行通信,父页面可以获取到设计器生成的页面 `JSON` ,也可以把 `token` 传给设计器。

2. 完整demo

```html
### Vue3组合式 集成demo
 
<template>
  <div v-loading="loading" class="iframe-container">
    <iframe
      ref="myIframe"
      id="iframe"
      :src="src"
      frameborder="0"
      width="100%"
      height="730px"
      @load="onIframeLoad"
    ></iframe>
  </div>
</template>
 
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
const loading = ref(true)
const src = ref('https://www.nbweixin.cn/autoprint')
 
const myIframe = ref(null)
 
//打印引擎模拟数据库数据
const demoObj = {
  Id: '001',
  Title: '测试打印模板',
  Number: '001',
  Desc: '这是一个初始的默认测试模板,你应该按照这个格式建表',
  DataApi: '',
  PageObj: {},
  PrintObj: {},
}
 
// 监听 iframe 是否加载完成
const onIframeLoad = () => {
  console.log('Iframe 已加载完成')
  loading.value = false
  sendMessageToIframe()
}
 
const sendMessageToIframe = () => {
  // 要发送的数据
  const dataToSend = {
    iframeToken: 'token_iframetest',
    iframeFormData: JSON.stringify(demoObj),
  }
  // 使用 postMessage 发送数据给 iframe
  myIframe.value.contentWindow.postMessage(dataToSend, '*')
}
 
//监听iframe 内部透传事件
let printengineEvent = null
printengineEvent = function (event) {
  if (event.data) {
    switch (event.data.key) {
      //保存页面json
      case 'savePrintJson':
        let obj = JSON.parse(event.data.value)
        console.log('收到的值', obj)
        break
      default:
        break
    }
  }
}
window.addEventListener('message', printengineEvent)
onMounted(() => {})
 
onBeforeUnmount(() => {
  window.removeEventListener('message', printengineEvent)
})
</script>
 
<style lang="scss" scoped></style>
```
