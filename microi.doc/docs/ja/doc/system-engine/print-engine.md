# 印刷エンジン
## 预览图
![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/6da046aeb97348f38412c01f51ee4e00.png#pic_center)


![在这里插入图片描述](https://static.itdos.com/upload/img/csdn/4e9f38b6897c4f258f3ca28a2b6534be.png#pic_center)


## 打印引擎
> * 以前、私のコードプラットフォームは、wordのエクスポート印刷テンプレートをローカルで作成することをサポートしていましたが、オンラインで作成することはできず、印刷する前にwordファイルをローカルにエクスポートしてから印刷する必要がありました私のコード印刷エンジンが生まれたからです
> * すべてのコントロールはデータソース构成をサポートしており、 [**インタ-フェ-ス-エンジン**](https://microi.blog.csdn.net/article/details/143968454) でデータソースを提供できます

## 試用住所
> Microi吾コード印刷エンジン:[https://microi.net/print-engine](https://microi.net/print-engine)

> テーブル构造とどちらの方法でも统合されていて、永続化するなら、それは次のようなフォーマットのデータテーブルを用意しなければなりません
```json
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
## Npmコンポーネント統合方式
>超简单,一个Vue页面搞定,实在掏不出页面连路由都没有用App页面也行 通过组件方式集成到项目内,不会污染项目,而且升级扩展都是独立的,主打一个互不干扰,距离产生美.

> Npm i microi-printengine @ elle

> Vue3 Viteプロジェクトでなければならず、任意のページで統合できます。次のコードは統合demoです
```javascript
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

## Iframeモード統合方式
> このモデルは白といえば百合で、低コードデザイナーをオンラインツールとし、それは無状態で、フロントエンドとバックエンドに依存せず、高結束低結合で、任意のプラットフォームを統合できる。時間のカスタム拡張コンポーネントが何百もある場合、完全に一人で一方の覇者になることができ、独立した製品.プラットフォーム統合はIframeを使用し、ページデザイナーを自分のページに埋め込むpostMessage方式で親ページと通信すると、親ページはデザイナーが生成したページJSONを取得したり、tokenをデザイナーに渡すことができます

> データ通信はpostMessage方式を使用します
> 親ページ (ドッキングプラットフォーム) はpostMessageを介して子ページにデータを送信し、ここでは主にtokenを渡し、子ページ (ページデザインエンジンコンポーネント) はwindow.addEventListenerを使用してデータを傍受して受信する

```javascript
//设计引擎调用
<template>
<iframe ref="myIframe" id="iframe" src="https://www.nbweixin.cn/autoprint/"  frameborder="0" style="width: 100%; height: 100%"></iframe>
</template>
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
## Vue3モジュール統合demo
```javascript
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

