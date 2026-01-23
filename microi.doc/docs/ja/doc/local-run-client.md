# ソースコードローカル実行-フロントエンド

## ビデオチュートリアル
> * 再録画してアップロードします。
> * 履歴ビデオチュートリアル:[https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

## ソースコードと開発ツールのダウンロード
* Gitツールを使ってオープンソースのアドレスから最新コードをプルします:[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* Vs codeをダウンロードしてインストールします:[https://code.visualstudio.com/](https://code.visualstudio.com/)
* Nvmをダウンロードしてインストールする:[https://nvm.uihtm.com/](https://nvm.uihtm.com/) 、MacBookインストールnvm:[https://blog.csdn.net/qq973702/article/details/143637128](https://blog.csdn.net/qq973702/article/details/143637128)
```shell
# 记住安装路径，一路往下安装即可
# 打开 nvm安装路径（我的是【D:\Users\Administrator\AppData\Local\nvm】），找到 settings.txt 文件，新增2行配置
node_mirror: https://npmmirror.com/mirrors/node/
npm_mirror: https://npmmirror.com/mirrors/npm/
# 打开cmd窗口,执行
nvm list available
nvm install 18
nvm install 14
# 常用命令
nvm ls
nvm use 18
node -v
```

## PC側vue2を実行する従来のインタフェースソースコード
* 歓迎ページでMicroi吾コードオープンソース版【/microi.web/】フォルダを開く
* 【/Microi.web/README.md】ファイルを見て、いくつかのnpm通常コマンドを実行すると走ることができます
```cmd
nvm use 14【注意一定需要14】
nrm use taobao
npm install
npm run dev
```

## PC側vue3を実行してwebos osインタフェース (コンパイル版) を模倣する
* 【/Microi.webos/】フォルダに入ります
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

