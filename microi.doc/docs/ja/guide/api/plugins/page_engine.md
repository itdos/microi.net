# 界面引擎

## 介绍
界面设计引擎主要解决了低代码平台页面快速设计页面的痛点。通过拖拉拽的方式快速设计页面，并生成对应的代码。平台与界面引擎完全分离，可以独立部署，真正实现零耦合、无污染。

演示地址：https://www.nbweixin.cn/autopage/

在线演示效果图：

![界面引擎](/api_plugins/page01.png)

## 插件简介🎖️

设计引擎分为设计器和渲染器两个核心组件:

🔸设计器  负责快速构建精美的页面,比如首页,动态看板,大屏等,采用极简的设计理念,傻瓜式操作,对开发人员的技术要求大大降低

🔸渲染器  负责渲染,以数据驱动页面展示.以往可能这部分工作都是前端或UI来完成的,现在普通的后端开发人员或者运维和销售角色都可以胜任.大大降低了团队研发的成本

## 快速上手 
界面引擎内置了一些常用的组件 `widget` ,所有样式都可以通过参数设置来控制.结构主要包括容器 `container` 和组件。一个容器可以容纳多个组件,容器和容器可以进 拖拽排序 ,组件和组件可以进行拖拽排序.容器和组件都可以进行 宽高拖拽 ,随意搭配,带用了一些技术解决了栅格系统塌陷的问题,可以完美实现 瀑布流式排版。
 
### 功能菜单介绍 

功能菜单栏位于头部，主要包含收缩侧边栏、查看页面JSON、清空容器、演示模板。

![界面引擎](/api_plugins/page02.gif)

### 组件面板介绍
组件面板主要包括内置组件、自定义组件、容器组件等。

![界面引擎](/api_plugins/page03.gif)

### 属性面板介绍
属性面板 位于页面右侧，分为页面参数设置、容器参数设置、组件参数设置三部分。

- **页面**:参数主要配置页面的基本信息和全局开关。
- **容器**:参数设置主要配置容器的样式和标题等信息。
- **组件**:参数设置分为通用配置和特色配置，通用配置主要是控制组件的宽高边距等。

![界面引擎](/api_plugins/page04.gif)

### 拖拽排序介绍 
容器和容器可以互相拖拽交换位置，组件和组件可以互相拖拽交换位置。

![界面引擎](/api_plugins/page05.gif)

### 排版原理介绍
采用的 `ElementPlus`，整体排版方式用了 `el-row` 栅格自适应排版，这里主要为了支持移动端可自适应，同时做了一些骚操作可以实现瀑布流式排版，em~~实在是绝! ,我都佩服自己，哈哈。

![界面引擎](/api_plugins/page06.gif)

### 持久化介绍
当大聪明的你设计完一个精美的页面后，如何把该模板保存供下次使用呢？

- **方式1**：保存当前页面 `JSON` 到本地，存到 `JSON` 文件或者文本文件都可以，下次渲染时直接取出来转成 `JSON` 传承给渲染器即可。
- **方式2**：持久化保存到数据库，下次渲染器直接通过 `webapi` 接口读取。

![界面引擎](/api_plugins/page07.gif)

### 动态数据源
所有的自定义组件和内置组件都支持动态数据源，通过 `webapi` 接口替换成自己的数据源，注意观察格式，一般分为对象格式和数组格式，如果是数组格式，说明组件内容是 可遍历的 。组件默认数据可能并不是满足所有用户的需求，自己可以尝试做几个 `webapi` 接口来试试看。

- **格式1**：对象（ `object` ）下面这种数据格式就是一种典型的对象格式。

![界面引擎](/api_plugins/page08.png)

![界面引擎](/api_plugins/page09.png)

- **格式2**：数组（ `array` ） 下面这种数据格式就是一种典型的数组格式。

![界面引擎](/api_plugins/page10.png)

![界面引擎](/api_plugins/page11.png)


## 集成方式

设计除了平台 内置 的常用组件,用户可以自行开发自己的组件,开发组件非常简单,组件内所有业务逻辑和容器都是零耦合的,设计的时候把通用业务和功能全部抽离封装了,主打一个互不干扰,距离产生美.插件目前采用的UI框架是 `element plus` , 有丰富的第三方组件库和完善的文档体系支撑二次开发.

### npm包集成

- 优点：可以自定义扩展组件，随心所欲设计自己的页面，不用写任何额外业务逻辑。
- 缺点：要求必须基于 `vue3+vite+elementplus+echarts` 框架，不支持 `Vue2` 和其它前端框架。

1. 表结构:

不管哪种方式集成,如果要持久化,那必须准备一张数据表,格式如下

```js
{
  Id: '', //页面ID
  Title: '',//页面标题
  Number: '',//页面编号
  Desc: '',//页面描述
  JsonObj: {}|'' //对象或者字符串,这里主要存储页面JSON
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

4. 设置暗黑主题

```js
// main.js 引用暗黑模式样式
import 'element-plus/theme-chalk/dark/css-vars.css'
```
5. npm包依赖

```bash
npm i microi-pageengine@latest
```

> 这里是所有的第三方依赖包，但不必全部安装第三方组件，npm包内置了一些，只需依赖如下即可。

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
      ],
```

6. 完整demo

```html
<template>
  <!-- 页面设计器 -->
  <formDesigner :remoteObj="remoteObj"/>
  <!-- 页面渲染器 -->
  <!-- <formRenderer :remoteObj="remoteObj" /> -->
</template>
<script setup>
  
//引入组件
import { formDesigner, EventBus, usePageEngineStore } from 'microi-pageengine' 
//引入样式
import 'microi-pageengine/style.css' 
 
 
//本地组件
import { useRouter } from 'vue-router'
import { createPinia } from 'pinia'
import { onMounted, onBeforeUnmount, ref } from 'vue'
 
//用自己的路由处理组件内部跳转,通过EventBus监听处理内部事件,主打一个自由自在,随心所欲.
const router = useRouter()
 
//状态机传参,npm包没包把pinia打包进去,正所谓巧妇难为无米之炊,给她传一个完事
const pinia = createPinia()
const pageEngineStore = usePageEngineStore(pinia)
 
//传入数据,这个数据不知道什么格式,可以在设计器拖拽几个组件查看下页面JSON ,和渲染JSON一毛一样的
const remoteObj = ref({
  Id: '', //自定义页面ID
  Title: '',//自定义页面标题
  Number: '',//自定义页面编号
  Desc: '',//自定义页面描述
  JsonObj: {}|'' //对象或者字符串
})
 
 
//模拟加载远程数据
const loadFormData = () => {}
 
onMounted(() => {
  
  //如果需要token,设置token,该token一经接收即刻存入pinia状态机,每次调用接口通过拦截器自动处理token头,无需每次手动写,持久化用的localStorage ,可以F12查看
  pageEngineStore.setToken('')
  
  //下面这一大串监听,其实也可以写到一个事件里,通过key value 键值对来区分,暂时先这么着吧
  
  //监听保存页面JSON事件
  EventBus.on('saveFormJson', (saveFormJson) => {
    console.log('监听saveFormJson', saveFormJson)
  })
 
  //监听日历选择日期事件
  EventBus.on('calendarSelDate', (data) => {
    console.log('监听calendarSelDate', data)
  })
 
  //卡片更多跳转
  EventBus.on('cartMoreLink', (linkurl, linktype) => {
    console.log('监听cartMoreLink', linkurl, linktype)
    if (linktype == 'router') {
      router.push(linkurl)
    }
  })
 
  //链接组件跳转
  EventBus.on('linkWidget', (linkurl, linktype) => {
    console.log('监听linkWidget', linkurl, linktype)
    if (linktype == 'router') {
      router.push(linkurl)
    }
  })
 
  //鱼骨图跳转
  EventBus.on('fishWidget', (linkurl) => {
    console.log('监听fishWidget', linkurl)
    router.push(linkurl)
  })
 
  //步骤跳转
  EventBus.on('stepsWidget', (id, linkurl) => {
    console.log('监听stepsWidget', id, linkurl)
    router.push(linkurl)
  })
 
})
 
//销毁
onBeforeUnmount(() => {
  EventBus.off('saveFormJson')
  EventBus.off('calendarSelDate')
  EventBus.off('cartMoreLink')
  EventBus.off('linkWidget')
  EventBus.off('fishWidget')
  EventBus.off('stepsWidget')
})
</scrip>
 
<style>
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

### iframe 外挂形式集成 

任何前端框架都可以集成，这种模式说白了就是百搭，它是无状态的,不依赖任何前端和后端,高内聚低耦合,可集成任意平台。

- 优点：可以对接任何平台，无状态，无侵染，零耦合，方便快捷。
- 缺点：只能使用内置组件，不能自定义组件。

1. 核心原理
平台集成使用 `frame` ，把页面设计器嵌入到自己页面中,通过 `postMessage` 方式与父页面进行通信,父页面可以获取到设计器生成的页面 `JSON` ,也可以把 `token` 传给设计器。

2. 完整demo
```html
### Vue3组合式 集成demo
 
```vue
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
const src = ref('https://www.nbweixin.cn/autopage/')
 
const myIframe = ref(null)
 
//模拟数据库数据
const demoObj = {
  Id: 31908,
  Title: '测试标题',
  Number: 'page_31908',
  Desc: '这是一个空的页面模板',
  JsonObj: {} //对象或者字符串
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
    iframeToken: 'token_test', //自定义token
    iframeFormData: JSON.stringify(demoObj), //页面JSON，新增的话JsonObj留空就行
  }
  // 使用 postMessage 发送数据给 iframe
  myIframe.value.contentWindow.postMessage(dataToSend, '*')
}
 
//监听iframe 内部透传事件
let pageengineEvent = null
pageengineEvent = function (event) {
  if (event.data) {
    switch (event.data.key) {
      //保存页面json
      case 'saveFormJson':
        console.log('已接到到来自iframe消息,saveFormJson', event.data.value)
        let obj = JSON.parse(event.data.value)
        console.log(obj)
        break
      //监听日历选择日期事件
      case 'calendarSelDate':
        console.log('已接到到来自iframe消息,calendarSelDate', event.data.value)
        break
      //监听日历选择日期事件
      case 'calendarSelDate':
        console.log('已接到到来自iframe消息,calendarSelDate', event.data.value)
        break
      //卡片更多跳转
      case 'cartMoreLink':
        console.log(
          '已接到到来自iframe消息,cartMoreLink 监听',
          event.data.value
        )
        break
      //链接组件跳转
      case 'linkWidget':
        console.log('已接到到来自iframe消息,linkWidget', event.data.value)
        break
      //鱼骨图跳转
      case 'fishWidget':
        console.log('已接到到来自iframe消息,fishWidget', event.data.value)
        break
      //步骤跳转
      case 'stepsWidget':
        console.log('已接到到来自iframe消息,stepsWidget', event.data.value)
        break
      default:
        break
    }
  }
}
window.addEventListener('message', pageengineEvent)
onMounted(() => {})
 
onBeforeUnmount(() => {
  window.removeEventListener('message', pageengineEvent)
})
</script>
 
<style lang="scss" scoped></style>
```

## 页面效果图

![界面引擎](/api_plugins/page12.png)

![界面引擎](/api_plugins/page13.png)