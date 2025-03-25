インターフェースエンジン紹介インタフェース設計エンジンは主に低コードプラットフォームページの高速設計ページのペインポイントを解決した。ドラッグでページをすばやくデザインし、対応するコードを生成します。プラットフォームとインタフェースエンジンは完全に分離され、独立して導入でき、真のゼロ結合、無汚染を実現できる。

デモアドレス: https:// www.nbweixin

オンラインデモ効果図:

![インタフェースエンジン]

プラグインの概要🎖️デザインエンジンは、デザイナーとレンダラーの2つのコアコンポーネントに分けられます

🔸デザイナーは、ホームページ、動的看板、大画面など、美しいページを迅速に構築する責任があり、非常にシンプルなデザイン理念、馬鹿な操作を採用し、開発者への技術要求が大幅に低下した

🔸レンダラーはレンダリングを担当し、データ駆動ページで展示する. 以前はこの部分の仕事はフロントエンドやUIで完成していた可能性があり、現在は普通のバックエンド開発者や運送と販売の役割ができる. チーム開発のコストを大幅に削減

クイックハンドインタフェースエンジンにはよく使われるコンポーネント「ウィジェット」が内蔵されており、すべてのスタイルはパラメータ設定で制御できる. 構造は主に容器「container」とコンポーネントである。一つの容器は複数のコンポーネントを収容でき、容器と容器はドラッグソートが可能で、コンポーネントとコンポーネントはドラッグソートが可能である. 容器とコンポーネントは幅の高いドラッグが可能で、自由に組み合わせることができ、いくつかの技術を使ってグリッドシステムの崩壊の問題を解決し、滝のストリーミングを完璧に実現できる。
 
機能メニューの紹介機能メニューバーは先頭にあり、主にサイドバーの縮小、ページJSONの表示、コンテナのクリア、プレゼンテーションテンプレートが含まれています。

![インタフェースエンジン](/api_plugins/page02.gif)

コンポーネントパネルの紹介コンポーネントパネルには、主に組み込みコンポーネント、カスタムコンポーネント、コンテナコンポーネントなどが含まれます。

![インタフェースエンジン](/api_plugins/page03.gif)

プロパティパネルの紹介プロパティパネルはページの右側にあり、ページパラメータ設定、コンテナパラメータ設定、コンポーネントパラメータ設定の3つの部分に分けられます。

- **页面**:参数主要配置页面的基本信息和全局开关。
- **容器**:参数设置主要配置容器的样式和标题等信息。
- **组件**:参数设置分为通用配置和特色配置，通用配置主要是控制组件的宽高边距等。

![インタフェースエンジン]

ドラッグソートの紹介コンテナとコンテナは互いにドラッグして位置を交換でき、コンポーネントとコンポーネントは互いにドラッグして位置を交換できます。

![インタフェースエンジン]

組版原理の紹介採用した「elementplus」は、全体的なレイアウト方式で「el-row」グリッド適応レイアウトを使用しており、ここでは主にモバイル端末の適応をサポートするために、いくつかの騒動操作を行って滝流レイアウトを実現することができるem ~~ 本当に素晴らしい!, 私は自分に感心して、ハハ。

![インタフェースエンジン]

永続化の紹介スマートなあなたが美しいページをデザインした後、どのようにしてそのテンプレートを次回の使用のために保存しますか?

- **方式1**：保存当前页面 `JSON` 到本地，存到 `JSON` 文件或者文本文件都可以，下次渲染时直接取出来转成 `JSON` 传承给渲染器即可。
- **方式2**：持久化保存到数据库，下次渲染器直接通过 `webapi` 接口读取。

![インタフェースエンジン]

動的データソースすべてのカスタムコンポーネントと組み込みコンポーネントは動的データソースをサポートし、「webapi」インタフェースを介して独自のデータソースに置き換え、観察形式に注意して、一般的にオブジェクト形式と配列形式に分けられ、配列形式であれば説明コンポーネントの内容はトラバース可能です。コンポーネントのデフォルトデータは、すべてのユーザーのニーズを満たしているわけではないかもしれませんが、自分でいくつかの「webapi」インタフェースを試してみてください。

- **格式1**：对象（ `object` ）下面这种数据格式就是一种典型的对象格式。

![インタフェースエンジン]

![インタフェースエンジン]

- **格式2**：数组（ `array` ） 下面这种数据格式就是一种典型的数组格式。

![インタフェースエンジン]

![インタフェースエンジン]


インテグレーション方式設計はプラットフォームに組み込まれた一般的なコンポーネントを除いて、ユーザーは自分のコンポーネントを開発することができ、開発コンポーネントは非常に簡単で、コンポーネント内のすべてのビジネスロジックとコンテナはゼロ結合である設計時に共通業務と機能をすべて分離してカプセル化し、主なものは互いに干渉せず、距離が美しい. プラグインが現在採用しているUIフレームワークは「element plus」で、豊富な第三者コンポーネントライブラリと完全な文書体系が二次開発を支持している.

Npmパッケージ統合- 优点：可以自定义扩展组件，随心所欲设计自己的页面，不用写任何额外业务逻辑。
- 缺点：要求必须基于 `vue3+vite+elementplus+echarts` 框架，不支持 `Vue2` 和其它前端框架。

1. 表结构:

どのような方法で統合しても、永続化するには、次の形式のデータテーブルを用意する必要があります

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


ここでは、すべてのサードパーティの依存パッケージですが、サードパーティのコンポーネントをすべてインストールする必要はありません。npmパッケージには、次のように依存するだけです。

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


Iframeプラグイン形式統合どのフロントエンドのフレームワークも統合できます。このモデルは白と言っても百合で、それは無状態で、フロントエンドとバックエンドに依存せず、高結束低結合で、任意のプラットフォームを統合できます。

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


ページ効果図![インタフェースエンジン]

![インタフェースエンジン](/api_plugins/page13.png)