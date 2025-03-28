# ソースコードローカル実行-フロントエンド
## ソースコードと開発ツールのダウンロード
* 使用git工具从开源地址拉取最新代码：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* Vs codeをダウンロードしてインストールします:[https://code.visualstudio.com/](https://code.visualstudio.com/)

## PC側vue2を実行する従来のインタフェースソースコード
* 歓迎ページでMicroi吾コードオープンソース版【/microi.vue2.pc/】フォルダを開きます
* 【/Microi.vue2.pc/説明.txt】ファイルを見て、いくつかのnpm通常コマンドを実行すると、走ることができます
```cmd
#nvm use 14【注意一定需要14】
#nrm use taobao
#npm install
#npm run dev

可能会出现的问题：
1、报错：/node_modules/_monaco-editor@0.33.0@monaco-editor/esm/vs/basic-languages/_.contribution.js
    解决：
    将以下5个变量（在30多行代码左右）从LazyLanguageLoader内部移动到之上，使用var声明即可。
    var _languageId;
    var _loadingTriggered;
    var _lazyLoadPromise;
    var _lazyLoadPromiseResolve;
    var _lazyLoadPromiseReject;
    var LazyLanguageLoader = class { ......
```

## PC側vue3を実行してwebos osインタフェース (コンパイル版) を模倣する
* 【/Microi.vue3.os.build/】フォルダに入ります
* コマンド # http-serverを実行すると実行できます

## PC側vue3を実行してwebos osインタフェースのソースコード (個人版) を模倣する
* 歓迎ページでMicroi吾コード個人版【/microi.vue3.os/】フォルダを開きます。
* 【/Microi.Vue3. os/説明.txt】ファイルを見て、いくつかのnpm通常コマンドを実行すると走ることができます
```cmd
#nvm use 18【建议使用18，与我们开发团队node版本一致】
#nrm use taobao
#npm install
#npm run dev
```

## モバイル端末vue3 uniappソースコードを実行する (図鳥UIに基づく)
* 【/Microi.vue3.tuniao/】フォルダに入ります
* # Npm installを実行すると、アプレットのデバッグツールを使用して開くことができます

