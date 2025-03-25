Source code local operation-front endDownload source code and development tools* 使用git工具从开源地址拉取最新代码：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* 下载并安装vs code：[https://code.visualstudio.com/](https://code.visualstudio.com/)

Run PC vue2 traditional interface source code* 在欢迎页打开Microi吾码开源版【/microi.vue2.pc/】文件夹
* 查看【/microi.vue2.pc/说明.txt】文件，执行几条npm常规命令后即可跑起来
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


Run PC-side vue3 to imitate webos operating system interface (compiled version)* 进入【/microi.vue3.os.build/】文件夹
* 执行命令#http-server即可跑起来

Run PC-side vue3 imitation webos operating system interface source code (personal version)* 在欢迎页打开Microi吾码个人版【/microi.vue3.os/】文件夹
* 查看【/microi.vue3.os/说明.txt】文件，执行几条npm常规命令后即可跑起来
```cmd
#nvm use 18【建议使用18，与我们开发团队node版本一致】
#nrm use taobao
#npm install
#npm run dev
```


Run the mobile terminal vue3 uniapp source code (based on the figure bird UI)* 进入【/microi.vue3.tuniao/】文件夹
* 执行#npm install后，使用小程序调试工具即可打开

