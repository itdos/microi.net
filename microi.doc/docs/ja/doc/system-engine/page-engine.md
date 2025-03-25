インターフェースエンジンプレビュー図![ここに画像の説明を挿入します](https://static.itdos.com/upload/img/csdn/8d07494649c34c7981495bdb28551451.png#pic_center)
![ここに画像の説明を挿入します](https://static.itdos.com/upload/img/csdn/3aae333deaec41a588ed985df5644375.png#pic_center)

インターフェースエンジン* 実際のプロジェクト開発では、多くの場合【 ** フォームエンジンフォーム ** 】は顧客リーダーのニーズを満たすことができないため、Microi吾コードインターフェースエンジンが誕生した
* すべてのコントロールはデータソース構成をサポートしており、 [** インタフェースエンジン **](https://microi.blog.csdn.net/article/details/143968454) を使用してデータソースを提供できます

試用住所Microi吾コードインターフェースエンジン:[https://microi.net/page-engine](https://microi.net/page-engine)Npmコンポーネント統合方式Npm i microi-pageengine @ latest
Vue3 Viteプロジェクトである必要があり、任意のページで統合できます。次のコードは統合demoです```javascript
<template>
  <!-- 页面设计器 -->
  <formDesigner :remoteObj="remoteObj" />
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
const remoteObj = ref({})

//模拟加载远程数据
const loadFormData = () => {}

onMounted(() => {
  
  //如果需要token,设置token,该token一经接收即刻存入pinia状态机,每次调用接口通过拦截器自动处理token头,无需每次手动写,持久化用的localStorage ,可以F12查看
  pageEngineStore.setToken('')
  
  //下面这一大串监听,其实也可以写到一个事件里,通过key value 键值对来区分,暂时先这么着吧
  
  //监听保存页面JSON事件
  EventBus.on('saveFormJson', (saveFormJson) => {
    console.log('saveFormJson', saveFormJson)
  })

  //监听日历选择日期事件
  EventBus.on('calendarSelDate', (data) => {
    console.log('calendarSelDate', data)
  })

  //卡片更多跳转
  EventBus.on('cartMoreLink', (linkurl, linktype) => {
    console.log('cartMoreLink', linkurl, linktype)
    if (linktype == 'router') {
      router.push(linkurl)
    }
  })

  //链接组件跳转
  EventBus.on('linkWidget', (linkurl, linktype) => {
    console.log('linkWidget', linkurl, linktype)
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


Iframeモード統合方式このモデルは白といえば百合で、低コードデザイナーをオンラインツールとし、それは無状態で、フロントエンドとバックエンドに依存せず、高結束低結合で、任意のプラットフォームを統合できる。時間のカスタム拡張コンポーネントが何百もある場合、完全に一人で一方の覇者になることができ、独立した製品.プラットフォーム統合はIframeを使用し、ページデザイナーを自分のページに埋め込むpostMessage方式で親ページと通信すると、親ページはデザイナーが生成したページJSONを取得したり、tokenをデザイナーに渡すことができます

データ通信はpostMessage方式を使用します
親ページ (ドッキングプラットフォーム) はpostMessageを介して子ページにデータを送信し、ここでは主にtokenを渡し、子ページ (ページデザインエンジンコンポーネント) はwindow.addEventListenerを使用してデータを傍受して受信します

```javascript
//设计引擎调用
<template>
<iframe ref="myIframe" id="iframe" src="https://www.nbweixin.cn/autopage/"  frameborder="0" style="width: 100%; height: 100%"></iframe>
</template>
methods: {
 sendMessageToIframe() {
      const iframe = this.$refs.myIframe;
      // 要发送的数据
      const dataToSend = {
        pageEngineToken: "token 值"
      };
      // 使用 postMessage 发送数据给 iframe
      iframe.contentWindow.postMessage(dataToSend, "*");
  }
 }
```

インターフェースエンジンは吾コードチームのメンバーlisaisaiが開発しました。詳細については、博文:[https://lisaisai.blog.csdn.net/article/details/143928130](https://lisaisai.blog.csdn.net/article/details/143928130) を参照してください

