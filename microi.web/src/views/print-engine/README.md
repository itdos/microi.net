# 插件陆续更新中,后续文档会更新至CSDN  https://lisaisai.blog.csdn.net/?type=blog


## 关闭默认的socket.io 监听，不然会一直提示

```js
// main.js
import { hiPrintPlugin } from 'vue-plugin-hiprint'
//取消自动连接
hiPrintPlugin.disAutoConnect()
```

## 常用函数
```js

function(value,row,colIndex,options,rowIndex){
console.log('colIndex',colIndex)
 return '<td></td>';
}
//单元格样式函数 设置列宽
function(value,row,index,options){ 
  return {width:'300px' };
  
  }

//单元格格式化函数
function(value,row,index,options){ return ''; }


//单元格渲染函数
function(value,row,colIndex,options,rowIndex){ return '<td></td>'; }
//可以获取索引
function(value,row,colIndex,options,rowIndex){
console.log('rowIndex',rowIndex)
 return rowIndex;
}

//表格头样式函数
function(options){ return {color:'red' }; }

//底部聚合格式化函数
function(column,fieldPageData,tableData,options){ return '<td></td>'; }

```


## 表结构,不管哪种方式集成,如果要持久化,那必须准备一张数据表,格式如下

```js

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

## 一 页面设计引擎 组件方式集成方案

> 超简单,一个Vue页面搞定,实在掏不出页面连路由都没有用App页面也行
> 通过组件方式集成到项目内,不会污染项目,而且升级扩展都是独立的,主打一个互不干扰,距离产生美.

### npm 包引入  

> npm包依赖项 参考  https://www.npmjs.com/package/microi-printengine ,目前version 1.0.0 ,陆续会升级

```shell
npm i microi-printengine@latest
```

> 必须是Vue3 + Vite 项目, 任意页面即可集成 ,以下代码是集成demo

```vue
<template>
  <!-- 打印设计器 -->
  <printDesigner :remoteObj="remoteObj" />
</template>
<script setup>
  
//引入组件
import { printDesigner, EventBus, usePrintEngineStore } from 'microi-printengine' 
//引入样式
import 'microi-printengine/style.css' 

//本地组件
import { createPinia } from 'pinia'
import { onMounted, onBeforeUnmount, ref } from 'vue'


//状态机传参,npm包没包把pinia打包进去,正所谓巧妇难为无米之炊,给她传一个完事
const pinia = createPinia()
const printEngineStore = usePrintEngineStore(pinia)

//传入数据,这个数据不知道什么格式,可以在设计器拖拽几个组件查看下页面JSON ,和渲染JSON一毛一样的
const remoteObj = ref({})

//模拟加载远程数据
const loadFormData = () => {}

onMounted(() => {
  
  //如果需要token,设置token,该token一经接收即刻存入pinia状态机,每次调用接口通过拦截器自动处理token头,无需每次手动写,持久化用的localStorage ,可以F12查看
  printEngineStore.setToken('')
  
  //下面这一大串监听,其实也可以写到一个事件里,通过key value 键值对来区分,暂时先这么着吧
  
  //监听保存页面JSON事件
  EventBus.on('savePrintJson', (savePrintJson) => {
    console.log('savePrintJson', savePrintJson)
  })

})

//销毁
onBeforeUnmount(() => {
  EventBus.off('savePrintJson')
})
</script>

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

## 二 页面设计引擎 外挂形式集成方案

> 这种模式说白了就是百搭,把低代码设计器当成一个在线工具,它是无状态的,不依赖任何前端和后端,高内聚低耦合,可集成任意平台.假以时日自定义扩展组件有上百个时,完全可以独当一面成为一方霸主,独立产品.
> 平台集成使用Iframe,把页面设计器嵌入到自己页面中,通过postMessage方式与父页面进行通信,父页面可以获取到设计器生成的页面JSON,也可以把token传给设计器

### 数据通信使用 postMessage 方式

> 父页面(对接平台)通过 postMessage 向子页面发送数据,这里主要传token ,子页面(页面设计引擎组件) 使用 window.addEventListener 监听并接收数据

```vue

//设计引擎调用
<template>
<iframe ref="myIframe" id="iframe" src="https://www.nbweixin.cn/autoprint/"  frameborder="0" style="width: 100%; height: 100%"></iframe>
</template>
```

#### Vue2选项式 参考下面vue3的

```js

 methods: {
 sendMessageToIframe() {
      const iframe = this.$refs.myIframe;
      // 要发送的数据
      const dataToSend = {
        printEngineToken: "token 值"
      };
      // 使用 postMessage 发送数据给 iframe
      iframe.contentWindow.postMessage(dataToSend, "*");
  }
 }
 
```

#### Vue3组合式 集成demo

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
const src = ref('https://www.nbweixin.cn/autoprint/')

const myIframe = ref(null)

//模拟数据库数据
const demoObj = {
  Id: '001',
  Title: '测试打印模板',
  Number: '001',
  Desc: '这是一个初始的默认测试模板,你应该按照这个格式建表',
  DataApi: '',
  PageObj: {
    panels: [
      {
        index: 0,
        name: 1,
        paperType: 'A4',
        height: 297,
        width: 210,
        paperHeader: 0,
        paperFooter: 841.8897637795277,
        printElements: [
          {
            options: {
              left: 351,
              top: 100.5,
              height: 9.75,
              width: 120,
              field: 'keytext_01',
              testData: '当你看到我的时候,就表示你成功了',
              title: '传参测试',
              qid: 'keytext',
            },
            printElementType: {
              title: '键值文本',
              type: 'text',
            },
          },
        ],
        paperNumberContinue: true,
        watermarkOptions: {},
        panelLayoutOptions: {},
      },
    ],
  },
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
        console.log('已接到到来自iframe消息,savePrintJson', event.data.value)
        let obj = JSON.parse(event.data.value)
        console.log(obj)
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
