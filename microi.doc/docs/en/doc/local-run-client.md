# Source code local operation-front end
## Download source code and development tools
* Use git tool to pull the latest code from open source address:[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* Download and install vs code:[https://code.visualstudio.com/](https://code.visualstudio.com/)

## Run PC vue2 traditional interface source code
* On the welcome page, open the Microi code open source version [/microi.vue2.pc/] folder.
* Check the [/microi.vue2.pc/description. txt] file and run after executing several npm general commands
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

## Run PC-side vue3 to imitate webos operating system interface (compiled version)
* Go to [/microi.vue3. OS. build/] folder
* Execute command# http-server to run

## Run PC-side vue3 imitation webos operating system interface source code (personal version)
* Open the Microi Code Personal Edition [/microi.vue3. OS/] folder on the welcome page
* Check the [/microi.vue3. OS/description. txt] file and run after executing several npm regular commands
```cmd
#nvm use 18【建议使用18，与我们开发团队node版本一致】
#nrm use taobao
#npm install
#npm run dev
```

## Run the mobile terminal vue3 uniapp source code (based on the figure bird UI)
* Enter the [/microi.vue3.tuniao/] folder
* After executing the# npm install, use the applet debugging tool to open it.

