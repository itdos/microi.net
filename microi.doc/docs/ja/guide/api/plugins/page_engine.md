# インターフェースエンジン

## 紹介
インタフェース設計エンジンは主に低コードプラットフォームページの高速設計ページのペインポイントを解決した。ドラッグでページをすばやくデザインし、対応するコードを生成します。プラットフォームとインタフェースエンジンは完全に分離され、独立して導入でき、真のゼロ結合、無汚染を実現できる。

デモアドレス: https:// www.nbweixin

オンラインデモ効果図:

![インタフェースエンジン]

## プラグインの概要🎖️

デザインエンジンは、デザイナーとレンダラーの2つのコアコンポーネントに分けられます

🔸デザイナーは、ホームページ、動的看板、大画面など、美しいページを迅速に構築する責任があり、非常にシンプルなデザイン理念、馬鹿な操作を採用し、開発者への技術要求が大幅に低下した

🔸レンダラーはレンダリングを担当し、データ駆動ページで展示する. 以前はこの部分の仕事はフロントエンドやUIで完成していた可能性があり、現在は普通のバックエンド開発者や運送と販売の役割ができる. チーム開発のコストを大幅に削減

## クイックハンド
インタフェースエンジンにはよく使われるコンポーネント「ウィジェット」が内蔵されており、すべてのスタイルはパラメータ設定で制御できる. 構造は主に容器「container」とコンポーネントである。一つの容器は複数のコンポーネントを収容でき、容器と容器はドラッグソートが可能で、コンポーネントとコンポーネントはドラッグソートが可能である. 容器とコンポーネントは幅の高いドラッグが可能で、自由に組み合わせることができ、いくつかの技術を使ってグリッドシステムの崩壊の問題を解決し、滝のストリーミングを完璧に実現できる。
 
### 機能メニューの紹介

機能メニューバーは先頭にあり、主にサイドバーの縮小、ページJSONの表示、コンテナのクリア、プレゼンテーションテンプレートが含まれています。

![インタフェースエンジン](/api_plugins/page02.gif)

### コンポーネントパネルの紹介
コンポーネントパネルには、主に組み込みコンポーネント、カスタムコンポーネント、コンテナコンポーネントなどが含まれます。

![インタフェースエンジン](/api_plugins/page03.gif)

### プロパティパネルの紹介
プロパティパネルはページの右側にあり、ページパラメータ設定、コンテナパラメータ設定、コンポーネントパラメータ設定の3つの部分に分けられます。

-** ページ **: パラメータは主にページの基本情報とグローバルスイッチを設定します。
-** コンテナ **: パラメータ設定は主にコンテナのスタイルやタイトルなどの情報を設定します。
-** コンポーネント **: パラメータ設定は共通の構成と特徴的な構成に分けられ、共通の構成は主にコンポーネントの幅と余白などを制御する。

![インタフェースエンジン]

### ドラッグソートの紹介
コンテナとコンテナは互いにドラッグして位置を交換でき、コンポーネントとコンポーネントは互いにドラッグして位置を交換できます。

![インタフェースエンジン]

### 組版原理の紹介
採用した「elementplus」は、全体的なレイアウト方式で「el-row」グリッド適応レイアウトを使用しており、ここでは主にモバイル端末の適応をサポートするために、いくつかの騒動操作を行って滝流レイアウトを実現することができるem ~~ 本当に素晴らしい!, 私は自分に感心して、ハハ。

![インタフェースエンジン]

### 永続化の紹介
スマートなあなたが美しいページをデザインした後、どのようにしてそのテンプレートを次回の使用のために保存しますか?

-** 方式1 **: 現在のページの「json」をローカルに保存し、「json」ファイルやテキストファイルに保存してもいいです。次回のレンダリング時に直接取り出して「json」に変換してレンダラーに伝えてもいいです。
-** 方式2 **: 永続化はデータベースに保存され、次回のレンダラーは直接「webapi」インタフェースを介して読み取ります。

![インタフェースエンジン]

### 動的データソース
すべてのカスタムコンポーネントと組み込みコンポーネントは動的データソースをサポートし、「webapi」インタフェースを介して独自のデータソースに置き換え、観察形式に注意して、一般的にオブジェクト形式と配列形式に分けられ、配列形式であれば説明コンポーネントの内容はトラバース可能です。コンポーネントのデフォルトデータは、すべてのユーザーのニーズを満たしているわけではないかもしれませんが、自分でいくつかの「webapi」インタフェースを試してみてください。

-** フォーマット1 **: オブジェクト ('object ') 以下のデータフォーマットは典型的なオブジェクトフォーマットです。

![インタフェースエンジン]

![インタフェースエンジン]

-** フォーマット2 **: 配列 ('array') の下のこのデータフォーマットは典型的な配列フォーマットです。

![インタフェースエンジン]

![インタフェースエンジン]


## インテグレーション方式

設計はプラットフォームに組み込まれた一般的なコンポーネントを除いて、ユーザーは自分のコンポーネントを開発することができ、開発コンポーネントは非常に簡単で、コンポーネント内のすべてのビジネスロジックとコンテナはゼロ結合である設計時に共通業務と機能をすべて分離してカプセル化し、主なものは互いに干渉せず、距離が美しい. プラグインが現在採用しているUIフレームワークは「element plus」で、豊富な第三者コンポーネントライブラリと完全な文書体系が二次開発を支持している.

### Npmパッケージ統合

-メリット: 拡張コンポーネントをカスタマイズして、自分のページを好きなようにデザインして、追加のビジネスロジックを書く必要がない。
-デメリット: 要件は 'Vue2' やその他のフロントエンドフレームワークをサポートしていない 'vue3 vite elementplus代々と 'フレームワークに基づいている必要があります。

1. 表構造:

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

4.ダークテーマを設定する

```js
// main.js 引用暗黑模式样式
import 'element-plus/theme-chalk/dark/css-vars.css'
```
5. npmパッケージの依存関係

```bash
npm i microi-pageengine@latest
```

> ここではすべてのサードパーティの依存パッケージですが、サードパーティのコンポーネントをすべてインストールする必要はありませんが、npmパッケージはいくつか内蔵されているので、次のように依存するだけで済みます。

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

6.完全デモ

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

### Iframeプラグイン形式統合

どのフロントエンドのフレームワークも統合できます。このモデルは白と言っても百合で、それは無状態で、フロントエンドとバックエンドに依存せず、高結束低結合で、任意のプラットフォームを統合できます。

-利点: どんなプラットフォームにもドッキングでき、状態がなく、感染がなく、ゼロ結合で、便利で迅速である。
-欠点: 組み込みコンポーネントのみを使用でき、コンポーネントをカスタマイズすることはできません。

1.コア原理
プラットフォーム統合では「framework」を使用し、ページ・デザイナーを自分のページに埋め込み、「postmessage」方式で親ページと通信し、親ページはデザイナーが生成したページ「json」を取得できる 'Token 'をデザイナーに渡すこともできます。

2.完全demo
```html
### Vue3组合式 集成demo
 
```vue
<Template>
<Div v-loader = "loader" class = "iframe-container">
<Iframe
Ref = "myIframe"
Id = "iframe"
: Src = "src"
Frameborder = "0"
Width = "100%"
Height = "730px"
@ Load = "onIframeLoad"
></Iframe>
</Div>
</Template>
 
<Scriptセットアップ>
インポート {ref,オン・マウンテンズ,オン・ビー・フォー・アンマウント} from 'vue'
くだらないコンストラクション = ref(true)
Const src = ref('https:// www.nbweixin .cn/autopage/')
 
Const myIframe = ref(null)
 
// シミュレーションデータベースデータ
くだりだす = {
Id: 31908,
Title: 「テストタイトル」
Number: 'page _ 31908 ',
Desc: 'これは空のページテンプレートです' 、
Json: {} // オブジェクトまたは文字列
}
 
// Iframeのロードが完了したかどうかを傍受する
Const onIframeLoad = () => {
コンソール.log (「iframeのロードが完了しました」)
Loader.value = false
Sendmessage toiframe ()
}
 
Const sendmessage toiframe = () => {
// 送信するデータ
コンストラテングプロジェクト = {
IframeToken: 'token _ test ', // カスタムtoken
IframeFormData: JSON.stringify
}
// PostMessageを使用してiframeにデータを送信する
MyIframe.value.contentWindow.postMessage
}
 
// Iframe内部の透過イベントを傍受する
Let pageengineイベント = null
Pageブラーヴェント = function (イベント) {
If (event.data) {
Switch (event.data.key) {
// ページjsonを保存する
Case 'saveformソール':
コンソール.log('はiframeからのメッセージを受信しました。
Let obj = JSON.parse(event.data.value)
コンソール.log
ブレイク
// カレンダー選択日イベントを傍受する
Case 'どういう意味ですか?
コンソール.log('はiframeからのメッセージを受信しました
ブレイク
// カレンダー選択日イベントを傍受する
Case 'どういう意味ですか?
コンソール.log('はiframeからのメッセージを受信しました
ブレイク
// カードはもっとジャンプします。
Case 'ソーシー・モレリン ':
コンソール.log (
「Iframeからのメッセージを受信しました
Event.data.value
)
ブレイク
// リンクコンポーネントのジャンプ
Case 'linkウィジェット:
コンソール.log('はiframeからのメッセージを受信しました。
ブレイク
// 魚骨図ジャンプ
Case 'fishウィジェット:
コンソール.log('はiframeからのメッセージを受信しました。
ブレイク
// ステップジャンプ
Case 'stepsウィジェット':
コンソール.log('はiframeからのメッセージを受信しました。
ブレイク
デフォルト:
ブレイク
}
}
}
Window.Addeventこだわる ('message',pageブラーヴェント)
OnMounted (() => {})
 
OnBeforeUnmount (() => {
Window.removeEventListener('message',pageブラーヴェント)
})
</Script>
 
<Style lang = "scss" scoped></style>
```

## 页面效果图

![界面引擎](/api_plugins/page12.png)

![界面引擎](/api_plugins/page13.png)