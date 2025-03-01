<!-- 快速上手 -->

# 快速上手

本文会帮助你从头启动、搭建此项目

## Vue2版本

### 环境准备

本地环境需要安装 [Node.js 14.x](https://nodejs.org/en/)、[Git](https://git-scm.com/)
::: warning 温馨提示🎯
- node.js 版本推荐安装 **14** ，如果同时维护两个版本，请使用 nvm 切换 node 版本。

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


### 代码拉取

**从 Gitee 拉取代码**：

```bash
# 克隆代码
git clone https://gitee.com/ITdos/microi.net.git
```

**从 GitCode 拉取代码**：

```bash
# 克隆代码
git clone https://gitcode.com/microi-net/microi.net.git
```
### 安装使用步骤

### 打开终端：
```bash
# 进入前端文件夹
cd X:\microi.net\microi.vue2.full
```

### 安装依赖：

```bash
nvm use 14
npm install nrm -g
# 📌如果taobao不行用 nrm use npmMirror
nrm use taobao 
npm install
```

### 运行项目：

```bash
npm run dev
```

### 打包项目：

```bash
npm run build
```

 
### npm script 详解

```js
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

### 注意事项‼️

**若以上步骤出现其它错误，可以尝试下以下步骤**：
1. 删除 `node_modules`
2. 删除 `package-lock.json`
3. 执行# `npm cache clean --force`
4. 重新执行# `npm install` 安装环境步骤

**其它可能会出现的问题**：
- 报错：`/node_modules/_monaco-editor@0.33.0@monaco-editor/esm/vs/basic-languages/_.contribution.js
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
### 切换后端接口地址

1. `request.js` 文件修改 `baseURL` 参数
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


## Vue3版本（待开发）

### 环境准备

本地环境需要安装 [Node.js 18.x+](https://nodejs.org/en/)、[Git](https://git-scm.com/)
::: warning 温馨提示🎯
Node.js 版本推荐安装 **18+** ，如果同时维护两个版本，请使用 nvm 切换 node 版本。

npm 镜像源请使用 taobao (https://registry.npmmirror.com/) 或者 npmMirror (https://skimdb.npmjs.com/registry/) ,可以使用 nrm 工具快速切换npm源。
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


### 工具配置

本项目推荐使用 VSCode 进行开发，项目里面已内置 VSCode 配置，包含推荐的插件和设置。

> 🌈 推荐安装以下插件：

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

### .vscode > extensions.json

```json
{
	"recommendations": ["vue.volar", "vue.vscode-typescript-vue-plugin", "hollowtree.vue-snippets", "dbaeumer.vscode-eslint", "stylelint.vscode-stylelint", "esbenp.prettier-vscode", "editorconfig.editorconfig", "streetsidesoftware.code-spell-checker", "syler.sass-indented", "mikestead.dotenv"]
}
```

:::warning

- 开发 Vue3 项目请开启 Volar 插件、禁用 Vetur 插件。
- 请配置项目默认格式化程序为 Prettier。

:::
