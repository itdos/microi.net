# 一、前言
 🎉🎉插件陆续更新中,后续文档会更新至CSDN  
[https://lisaisai.blog.csdn.net/](https://lisaisai.blog.csdn.net/)

## 甘特图小时级别支持
本项目已支持甘特图的小时级别显示，包括：
- 时间刻度支持小时级别显示
- 左侧表格显示小时级别的时间信息
- 右侧任务条支持小时级别的拖拽和调整
- 编辑框支持小时级别的时间编辑
- 工具提示显示小时级别的时间信息
- 持续时间以小时为单位显示

# 二、npm集成
## 2.1 持久化
不管哪种方式集成,如果要持久化,那必须准备一张数据表,格式如下

```js

{
  Id: '', //页面ID
  Title: '',//页面标题
  Number: '',//页面编号
  Desc: '',//页面描述
  JsonObj: {}|'' //对象或者字符串
}

```

## 2.2 npm包集成方案

只需一个Vue3页面搞定,实在掏不出页面连路由都没有用App页面也行，
通过组件方式集成到项目内,不会污染项目,而且升级扩展都是独立的,主打一个互不干扰,距离产生美。


npm包依赖项 参考  https://www.npmjs.com/package/microi-pageengine ,目前version 1.2.8 ,陆续会升级

```bash
npm i microi-pageengine@latest
```

## 2.3 安装 element-plus 图标库
Vue3组件集成最低要求 element-plus ，请自行安装最新版本。
```sh

npm install @element-plus/icons-vue
```

## 2.4 注册所有图标

```js
// main.ts
// 如果您正在使用CDN引入，请删除下面一行。
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

const app = createApp(App)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
```

## 2.5 引用封装的extendedWidget.js



```js
/**
 * @description: 自定义扩展组件
 * @author: mrcroi_lisaisai
 * @createTime: 2024/11/26 9:09
 **/

import { defineAsyncComponent } from 'vue'

export const newWidgets = [
  {
    type: 'test',
    label: '测试',
    category: 0, //0 内置组件,1 自定义组件
    show: 1, //是否展示 0隐藏,1展示
    icon: '', // elementplus
    img: 'https://www.nbweixin.cn/autopage/logoarr1/%E9%97%AE%E5%8D%B7%E8%B0%83%E6%9F%A5.png', //图片图标
    widgetOption: {
      height: 280, //高度
    },
    widgetParams: [
      {
        sort: 0,
        label: '数据来源', //属性名称
        type: 'textarea', //表单组件类型(input,textarea,number,color,select,switch,slider)
        value: '', //表单组件内容
        typeOptions: {
          rows: 3, //表单组件设置,多行文本框默认3行
          dataJson: {
            icon: 'https://www.nbweixin.cn/autopage/photo.png',
            title: '早安，Ah jung，开始您一天的工作吧！',
            subTitle: '今日阴转大雨，15℃ - 25℃，出门记得带伞哦。',
          },
        },
      },
      {
        sort: 1,
        label: '测试属性',
        type: 'input',
        value: '',
        typeOptions: {},
      },
    ],
  },
]

export const newComponents = [
  {
    'test-widget': defineAsyncComponent(() =>
      import('@/components/test-widget.vue')
    ),
  },
]
```


### 2.6 配置主题
在 `main.ts` 引用暗黑模式样式

```js
import 'element-plus/theme-chalk/dark/css-vars.css'
```

### 2.7 Vue3 npm集成demo

```html

<template>
  <!-- 页面设计器 -->
  <formDesigner :remoteObj="remoteObj"  :components="newComponents" :widgets="newWidgets"/>
  <!-- 页面渲染器 -->
  <!-- <formRenderer :remoteObj="remoteObj" /> -->
</template>
<script setup>
  
//引入组件
import { formDesigner, EventBus, usePageEngineStore } from 'microi-pageengine' 
//引入样式
import 'microi-pageengine/style.css' 

//把这两个方法封装在utils文件夹里方便管理，
import { newComponents, newWidgets } from '@/utils/extendedWidget'

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

  //地图marker点击事件
  EventBus.on('mapMarkerClick', (item) => {
    console.log('监听mapMarkerClick',item)
  })

   //点击区域地图事件
  EventBus.on('areaMapClick', (item) => {
    console.log('监听areaMapWidget',item)
  })

  //点击高级日历组件事件
  EventBus.on('fullCalendarClick', (item) => {
    console.log('监听fullCalendarClick',item)
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
  EventBus.off('mapMarkerClick')
  EventBus.off('areaMapClick')
  EventBus.off('fullCalendarClick')
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

`extendedWidget.js` 格式如下：

```js
/**
 * @description: 自定义扩展组件
 * @author: mrcroi_lisaisai
 * @createTime: 2024/11/26 9:09
 **/

import { defineAsyncComponent } from 'vue'

export const newWidgets = [
  {
    type: 'test',
    label: '测试',
    category: 0, //0 内置组件,1 自定义组件
    show: 1, //是否展示 0隐藏,1展示
    icon: '', // elementplus
    img: 'https://www.nbweixin.cn/autopage/logoarr1/%E9%97%AE%E5%8D%B7%E8%B0%83%E6%9F%A5.png', //图片图标
    widgetOption: {
      height: 280, //高度
    },
    widgetParams: [
      {
        sort: 0,
        label: '数据来源', //属性名称
        type: 'textarea', //表单组件类型(input,textarea,number,color,select,switch,slider)
        value: '', //表单组件内容
        typeOptions: {
          rows: 3, //表单组件设置,多行文本框默认3行
          dataJson: {
            icon: 'https://www.nbweixin.cn/autopage/photo.png',
            title: '早安，Ah jung，开始您一天的工作吧！',
            subTitle: '今日阴转大雨，15℃ - 25℃，出门记得带伞哦。',
          },
        },
      },
      {
        sort: 1,
        label: '测试属性',
        type: 'input',
        value: '',
        typeOptions: {},
      },
    ],
  },
]

export const newComponents = [
  {
    'test-widget': defineAsyncComponent(() =>
      import('@/components/test-widget.vue')
    ),
  },
]
```


## 三、Iframe外挂形式集成方案

这种模式说白了就是百搭,把低代码设计器当成一个在线工具,它是无状态的,不依赖任何前端和后端,高内聚低耦合,可集成任意平台.假以时日自定义扩展组件有上百个时,完全可以独当一面成为一方霸主,独立产品。

平台集成使用Iframe,把页面设计器嵌入到自己页面中,通过postMessage方式与父页面进行通信,父页面可以获取到设计器生成的页面JSON,也可以把token传给设计器

### 3.1 数据通信使用 postMessage 方式

> 父页面(对接平台)通过 postMessage 向子页面发送数据,这里主要传token ,子页面(页面设计引擎组件) 使用 window.addEventListener 监听并接收数据

### 3.2 Vue3组合式 集成demo

```js
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
      //地图maker点击事件
      case 'mapWidget':
        console.log('已接到到来自iframe消息,mapWidget', event.data.value)
        break
      //点击区域地图事件
      case 'areaMapWidget':
        console.log('已接到到来自iframe消息,areaMapWidget', event.data.value)
        break
      //点击高级日历组件事件
      case 'fullCalendarWidget':
        console.log(
          '已接到到来自iframe消息,fullCalendarWidget',
          event.data.value
        )
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


 




## 四、在线office文档编辑器

### 4.1 Vue3 npm包集成 

使用方法，注册引用 `webOffice` 组件，必填参数  `url` ,其它参数非必填。

```js
<template>
  <webOffice :url="url"></webOffice>
</template>
<script setup name="weboffice">
 
import { webOffice } from 'microi-pageengine' 

let url =
  'https://www.nbweixin.cn/autopage/%E9%99%84%E5%BD%95A-4%20%E7%AB%8B%E9%A1%B9%E8%AF%84%E5%AE%A1%E6%8A%A5%E5%91%8A.doc'
let title = '附录A-4 立项评审报告.doc' //选填
let key = '附录A-4 立项评审报告.doc' //选填
let server = 'http://192.168.93.128:9000' //选填
</script>

<style lang="scss" scoped></style>

```


### 4.2 Iframe 调用office
使用方法，在自己的页面引入 `iframe` ，通过 `postMessage`  消息传递，必填参数  `url` ,其它参数非必填。

**参数解读：**

```javascript
const demoObj = {
  url: ' ', //文件地址，支持word、excel、ppt （必填）
  title: '', //文件标题，可留空
  key: '',//唯一值，可留空
  server: '', //服务地址，可留空
}
```

**demo示例：**

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

const src = ref('https://www.nbweixin.cn/autopage/weboffice')

const myIframe = ref(null)

//模拟数据库数据
const demoObj = {
  url: 'https://www.nbweixin.cn/autopage/%E9%99%84%E5%BD%95A-4%20%E7%AB%8B%E9%A1%B9%E8%AF%84%E5%AE%A1%E6%8A%A5%E5%91%8A.doc',
  title: '',
  key: '',
  server: '',
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
    officeData: JSON.stringify(demoObj),
  }
  // 使用 postMessage 发送数据给 iframe
  myIframe.value.contentWindow.postMessage(dataToSend, '*')
}

onMounted(() => {})

onBeforeUnmount(() => {})
</script>

<style lang="scss" scoped></style>

```



### 4.3 onlyoffice 集成页面（已经弃用，代码片段保留）
```html

// 组件代码
<template>
  <div style="height: 100vh">
    <DocumentEditor
      v-if="loadOk"
      class="docEditor"
      id="docEditor"
      ref="docEditor"
      :documentServerUrl="documentServerUrl"
      :config="config"
    />
  </div>
</template>
<script setup name="weboffice">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { DocumentEditor } from '@onlyoffice/document-editor-vue'

const props = defineProps({
  url: {
    type: String,
    default: '',
    isRequire: false,
  },
  title: {
    type: String,
    default: '',
    isRequire: false,
  },
  key: {
    type: String,
    default: '',
    isRequire: false,
  },
  server: {
    type: String,
    default: '',
    isRequire: false,
  },
})

const getFileTypeByExtension = (extension) => {
  const extensionMap = {
    docx: 'word',
    doc: 'word',
    xls: 'cell',
    xlsx: 'cell',
    pptx: 'slides',
    ppt: 'slides',
  }

  return extensionMap[extension.toLowerCase()] || 'unknown'
}

const loadOk = ref(false)

const documentServerUrl = ref('')
documentServerUrl.value = 'https://118.31.116.82:9000'

const config = ref({
  document: {
    fileType: 'docx', // 文档类型，可以是'docx'、'xlsx'、'pptx'等
    title: '附录A-4 立项评审报告.doc',
    key: new Date().getTime().toString(), // 文档的唯一标识
    url: 'https://www.nbweixin.cn/autopage/附录A-4 立项评审报告.doc', // 文档的URL，可以是文件服务器的地址
  },
  documentType: 'word', // 文档类型，可以是'word'、'cell'、'slides'等
  editorConfig: {
    lang: 'zh-CN', // 语言设置，这里设置为中文
    mode: 'view',
  },
})

//动态配置参数
const autoParams = (paramUrl) => {
  //获取文件名
  let fileName = paramUrl.split('/').pop()
  //根据文件获取后缀名
  let fileType = paramUrl.split('.').pop()

  config.value.document.title = fileName
  config.value.document.fileType = fileType

  config.value.documentType = getFileTypeByExtension(fileType)

  console.log('fileName', fileName)
  console.log('fileType', fileType)
  console.log('documentType', config.value.documentType)
}

//如果参数传参了的话，就覆盖默认参数
if (props.url) {
  config.value.document.url = props.url
  autoParams(props.url)
  loadOk.value = true
}
if (props.title) {
  config.value.document.title = props.title
}
if (props.key) {
  config.value.document.key = props.key
}

if (props.server) {
  documentServerUrl.value = props.server
}

let messageHandler = null
onMounted(() => {
  // 接收父窗体跨域token
  messageHandler = function (event) {
    let receivedData = event.data

    // 父窗体有传数据过来
    let officeData = receivedData?.officeData
    if (officeData) {
      let obj = JSON.parse(officeData)
      config.value.document.url = obj.url
      autoParams(obj.url)

      if (obj.title) {
        config.value.document.title = obj.title
      }
      if (obj.key) {
        config.value.document.key = obj.key
      }
      if (obj.server) {
        documentServerUrl.value = obj.server
      }

      loadOk.value = true
    }
  }

  //接收父窗体传值，包括token和数据
  window.addEventListener('message', messageHandler)
})

// 在组件卸载时销毁OnlyOffice编辑器实例
onBeforeUnmount(() => {
  if (window.DocEditor && window.DocEditor.instances['docEditor']) {
    window.DocEditor.instances['docEditor'].destroyEditor()
  }

  // 取消监听事件
  window.removeEventListener('message', messageHandler)
})
</script>

<style lang="scss" scoped>
.docEditor {
  height: 100%;
}
</style>

//调用示例 `/views/weboffice.vue`
<template>
  <webOffice :url="filepath"></webOffice>
</template>
<script setup name="weboffice">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import webOffice from '@/components/web-office/index.vue'

const filepath = ref('')
filepath.value = 'https://minio.nbweixin.cn/public/test/file/20250214/111.xls'

const queryParams = new URLSearchParams(window.location.search)
const paramValue = queryParams.get('path') // 获取参数值
if (paramValue) {
  filepath.value = paramValue
}
</script>
<style lang="scss" scoped></style>


```
