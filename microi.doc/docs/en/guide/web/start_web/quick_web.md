<!-- 快速上手 -->


Quick to get startedThis article will help you start and build this project from scratch.

Vue2 versionEnvironmental PreparationLocal environment requires [Node.js 14.x](https://nodejs.org/en/), [Git](https://git-scm.com/)
::: Warm Tips for warning🎯- node.js 版本推荐安装 **14** ，如果同时维护两个版本，请使用 nvm 切换 node 版本。

- npm 镜像源请使用 taobao (https://registry.npmmirror.com/) 或者 npmMirror (https://skimdb.npmjs.com/registry/) ,可以使用 nrm 工具快速切换npm源。
:::

::: code-group

```bash [node版本切换]

nvm use 14

```


```bash [npm源切换]
nrm use taobao
```


:::

- **nvm教程**💯: https://lisaisai.blog.csdn.net/article/details/145481541?spm=1001.2014.3001.5502。
- **nrm教程**💯: https://lisaisai.blog.csdn.net/article/details/145481783?spm=1001.2014.3001.5502


Code Pull**Pull code from Gitee * *:

```bash
# 克隆代码
git clone https://gitee.com/ITdos/microi.net.git
```


**Pull code from GitCode * *:

```bash
# 克隆代码
git clone https://gitcode.com/microi-net/microi.net.git
```

Installation and use stepsOpen Terminal:```bash
# 进入前端文件夹
cd X:\microi.net\microi.vue2.full
```


Install dependencies:```bash
nvm use 14
npm install nrm -g
# 📌如果taobao不行用 nrm use npmMirror
nrm use taobao 
npm install
```


To run the project:```bash
npm run dev
```


Packaged items:```bash
npm run build
```


 
npm script details```js
{
	"scripts": {
    //本地运行(dev环境)
    "dev": "vue-cli-service serve", 
    //构建打包(dev环境)
    "build": "vue-cli-service build",
    //构建打包(生产环境)
    "build:prod": "vue-cli-service build",
     //构建打包(测试环境)
    "build:stage": "vue-cli-service build --mode staging",
    //本地运行(预览环境)
    "preview": "node build/index.js --preview",
    //svg图片处理
    "svgo": "svgo -f src/icons/svg --config=src/icons/svgo.yml",
    //打包lib
    "lib": "vue-cli-service build --target lib --name microi.net.vue --dest lib index.js"
}
```


Precautions‼️**If other errors occur in the above steps, you can try the following steps * *:1. 删除 `node_modules`
2. 删除 `package-lock.json`
3. 执行# `npm cache clean --force`
4. 重新执行# `npm install` 安装环境步骤

**Other possible issues * *:- 报错：`/node_modules/_monaco-editor@0.33.0@monaco-editor/esm/vs/basic-languages/_.contribution.js
        Failed to compile with 1 error in ./node_modules/monaco-editor/esm/vs/basic-languages/_.contribution.js`
    
- 解决：
    将以下5个变量（在30多行代码左右）从 `LazyLanguageLoader` 内部移动到之上，使用 `var`声明即可。
  ```js
  var _languageId;
  var _loadingTriggered;
  var _lazyLoadPromise;
  var _lazyLoadPromiseResolve;
  var _lazyLoadPromiseReject;
  var LazyLanguageLoader = class { ......
  ```
Switch back-end interface address1. `request.js` 文件修改 `baseURL` 参数
2. `itdos.osclient.js` 文件修改

```js
 try {
        //如果是苹果电脑
        if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
          return 'https://api.itdos.com'//用于发布到开源gitee
        } else {//如果是非苹果电脑
          return 'https://localhost:7268'//用于发布到开源gitee （在这里修改）
        }
      } catch (error) {
        return 'https://api.itdos.com'
      }
```



Vue3 version (to be developed)Environmental PreparationLocal environment requires [Node.js 18.x ](https://nodejs.org/en/), [Git](https://git-scm.com/)
::: Warm Tips for warning🎯
Node.js version recommend **18**. If you maintain two versions at the same time, use nvm to switch the node version.

use taobao (https://registry.npmmirror.com/) or npmMirror (https://skimdb.npmjs.com/registry/) for npm image sources. you can use the nrm tool to quickly switch npm sources.
:::

::: code-group

```bash [node版本切换]

nvm use 18

```


```bash [npm源切换]
nrm use taobao
```


:::

- **nvm教程**💯: https://lisaisai.blog.csdn.net/article/details/145481541?spm=1001.2014.3001.5502。
- **nrm教程**💯: https://lisaisai.blog.csdn.net/article/details/145481783?spm=1001.2014.3001.5502


Tool ConfigurationThis project recommend use VSCode for development, the project has built-in VSCode configuration, including recommend plug-ins and settings.

🌈recommend install the following plug-ins:

- [Vue Language Features (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) ==> Vue3 官方插件
- [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) ==> Vue3 官方插件（TypeScript）
- [Vue 3 Snippets](https://marketplace.visualstudio.com/items?itemName=hollowtree.vue-snippets) ==> Vue3 代码提示
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) ==> 代码检查
- [Stylelint](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) ==> CSS 代码检查 && 格式化
- [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) ==> 代码格式化
- [EditorConfig for VS Code](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig) ==> 统一不同编辑器的编码风格
- [Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) ==> 校验单词拼写错误
- [Sass](https://marketplace.visualstudio.com/items?itemName=Syler.sass-indented) ==> Sass 样式编写
- [DotENV](https://marketplace.visualstudio.com/items?itemName=mikestead.dotenv) ==> 高亮 .env 文件

.vscode > extensions.json```json
{
	"recommendations": ["vue.volar", "vue.vscode-typescript-vue-plugin", "hollowtree.vue-snippets", "dbaeumer.vscode-eslint", "stylelint.vscode-stylelint", "esbenp.prettier-vscode", "editorconfig.editorconfig", "streetsidesoftware.code-spell-checker", "syler.sass-indented", "mikestead.dotenv"]
}
```


:::warning

- 开发 Vue3 项目请开启 Volar 插件、禁用 Vetur 插件。
- 请配置项目默认格式化程序为 Prettier。

:::