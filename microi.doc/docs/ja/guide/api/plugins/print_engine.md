# 印刷エンジン

## プロフィール
印刷エンジンは主に低コードプラットフォームの動的な印刷タスクを解決して、私は殺手の奥の手「iframe' 'html」コンポーネントを祭るだけで、基本的にお客様の失礼な印刷要求を満たすことができると言える。

デモアドレス: https:// www.nbweixin

効果図:

![打印引擎](/api_plugins/print01.png)

![打印引擎](/api_plugins/print02.png)

## プラグイン機能

* * 印刷コンポーネントは次のとおりです

- **通常のテキスト**：テキストのさまざまなフォント、色、背景などのスタイルを設定でき、欠かせないキャラクター。
- **キー値ペアテキスト**：印刷テンプレートの一般的なフォーマットは、上記のように設定されています。
- **動的テーブル**：非常に強力な動的表は、さまざまなシーンのニーズを実現することができ、試してみるとわかります。
- **静的テーブル**：基本的なビジネスニーズを満たすことができます。
- **Qrコード**：基本的なニーズを満たすことができ、より良い体験感が必要なら、草料二次元コードを使って写真を作ることができる。
- **画像**：門戸担当、人は衣装、馬は鞍、美しいテンプレートが欠かせない。
- **バーコード**：基本的なニーズを満たすことができ、より良い体験感が必要なら、草料二次元コードを使って写真を作ることができる。
- **データグラフ**：'Echart' グラフを設定できます。
- **ライン**：実線、破線などがあり、基本的なニーズを満たし、スタイルが調整できる。
- **基本グラフィック**：円形、長方形などがあります。
- **装丁線**：実は線の一種です。
- **業務コンポーネント**：実際のビジネスシーンに基づいて一般的なビジネステンプレートコンポーネントをプリセットすると、時間を節約できます。
- **Html**：一般的には使われていない、主に難題を解決するための、できないテンプレートに遭遇したことを忘れないでください。

## インテグレーション方式

### Npmパッケージ統合
- **メリット**：拡張コンポーネントをカスタマイズして、自分のページを自由にデザインすることができ、追加のビジネスロジックを書く必要はありません。
- **デメリット**：要件は、 'Vue2' やその他のフロントエンド・フレームワークをサポートしていない 'vue3 vite elementplus代々のフレームワークに基づいている必要があります。

1.テーブル構造
どのような方法で統合しても、永続化するには、次の形式のデータテーブルを用意する必要があります
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
2.アイコンライブラリのインストール
```bash
npm install @element-plus/icons-vue
```

3.グローバル登録アイコン
```js
// main.js
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
const app = createApp(App)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
```

4. npmパッケージの依存関係
ここでは、すべてのサードパーティの依存パッケージですが、サードパーティのコンポーネントをすべてインストールする必要はありません。'npm' パッケージには、次のように依存する必要があります。
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
5.完全demo
ここまで基本的な前提条件が設定されています。次は「vue」ページを新規作成するだけで、次のコードを参考にして走ることができます。簡単ではありませんか。

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

### Iframeプラグイン形式統合
どのフロントエンドのフレームワークも統合できます。このモデルは白と言っても百合で、それは無状態で、フロントエンドとバックエンドに依存せず、高結束低結合で、任意のプラットフォームを統合できます。

- **メリット**：どんなプラットフォームにもドッキングでき、状態がなく、感染がなく、ゼロ結合で、便利で迅速である。
- **デメリット**：組み込みコンポーネントのみ使用でき、コンポーネントをカスタマイズすることはできません。

1.コア原理
プラットフォーム統合では「framework」を使用し、ページ・デザイナーを自分のページに埋め込み、「postmessage」方式で親ページと通信し、親ページはデザイナーが生成したページ「json」を取得できる 'Token 'をデザイナーに渡すこともできます。

2.完全demo

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
