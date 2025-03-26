<! -- Quick to get started -->

# Quick to get started

This article will help you start and build this project from scratch.

## Vue2 version

### Environmental Preparation

Local environment requires [Node.js 14.x](https://nodejs.org/en/), [Git](https://git-scm.com/)
::: Warm Tips for warning🎯
-Node. js version recommend **14**. If you maintain two versions at the same time, use nvm to switch the node version.

-npm image source please use taobao (https://registry.npmmirror.com/) or npmMirror (https://skimdb.npmjs.com/registry/), you can use the nrm tool to quickly switch npm source.
:::

::: code-group

```bash [node版本切换]

nvm use 14

```

```bash [npm源切换]
nrm use taobao
```

:::

-**nvm tutorial**💯: https://lisaisai.blog.csdn.net/article/details/145481541?spm=1001.2014.3001.5502 。
-**nrm tutorial**💯: https://lisaisai.blog.csdn.net/article/details/145481783?spm=1001.2014.3001.5502


### Code Pull

**Pull code from Gitee**:

```bash
# 克隆代码
git clone https://gitee.com/ITdos/microi.net.git
```

**Pull code from GitCode**:

```bash
# 克隆代码
git clone https://gitcode.com/microi-net/microi.net.git
```
### Installation and use steps

### Open Terminal:
```bash
# 进入前端文件夹
cd X:\microi.net\microi.vue2.full
```

### Install dependencies:

```bash
nvm use 14
npm install nrm -g
# 📌如果taobao不行用 nrm use npmMirror
nrm use taobao 
npm install
```

### To run the project:

```bash
npm run dev
```

### Packaged items:

```bash
npm run build
```

 
### npm script details

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

### Precautions‼️

**If other errors occur in the above steps, you can try the following steps**:
1. Delete 'node_modules'
2. Delete 'package-lock.json'
3. Execute# 'npm cache clean -- force'
4. Re-execute the# 'npm install' installation environment steps

**Other possible issues**:
-Error: '/node_modules/_monaco-editor@0.33.0 @ monaco-editor/esm/vs/basic-languages/_.contribution.js
Failed to compile with 1 error in ./node_modules/monaco-editor/esm/vs/basic-languages/_.contribution.js'
    
-Resolved:
Move the following 5 variables (in about 30 + lines of code) from inside 'LazyLanguageLoader' to above, using the 'var' declaration.
'''js
var _languageId;
var _loadingTriggered;
var _lazyLoadPromise;
var _lazyLoadPromiseResolve;
var _lazyLoadPromiseReject;
var LazyLanguageLoader = class { ......
'''
### Switch back-end interface address

1. 'request.js' file modifies the 'baseURL' parameter
2. 'itdos.osclient.js' file modification

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


## Vue3 version (to be developed)

### Environmental Preparation

Local environment requires [Node.js 18.x ](https://nodejs.org/en/), [Git](https://git-scm.com/)
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

-**nvm tutorial**💯: https://lisaisai.blog.csdn.net/article/details/145481541?spm=1001.2014.3001.5502 。
-**nrm tutorial**💯: https://lisaisai.blog.csdn.net/article/details/145481783?spm=1001.2014.3001.5502


### Tool Configuration

This project recommend use VSCode for development, the project has built-in VSCode configuration, including recommend plug-ins and settings.

>>🌈recommend install the following plug-ins:

-[Vue Language Features (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) ==> Vue3 official plugin
-[TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) ==> Vue3 Official Plugin (TypeScript)
-[Vue 3 Snippets](https://marketplace.visualstudio.com/items?itemName=hollowtree.vue-snippets) ==> Vue3 code hint
-[ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) ==> Code Check
-[Stylelint](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) ==> CSS Code Checking & & Formatting
-[Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) ==> Code Formatting
-[EditorConfig for VS Code](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig) ==> Unify the coding style of different editors
-[Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) ==> Check for word misspellings
-[Sass](https://marketplace.visualstudio.com/items?itemName=Syler.sass-indented) ==> Sass style writing
-[DotENV](https://marketplace.visualstudio.com/items?itemName=mikestead.dotenv) ==> Highlight. env file

### .vscode > extensions.json

```json
{
	"recommendations": ["vue.volar", "vue.vscode-typescript-vue-plugin", "hollowtree.vue-snippets", "dbaeumer.vscode-eslint", "stylelint.vscode-stylelint", "esbenp.prettier-vscode", "editorconfig.editorconfig", "streetsidesoftware.code-spell-checker", "syler.sass-indented", "mikestead.dotenv"]
}
```

:::warning

-To develop a Vue3 project, open the Volar plug-in and disable the Vetur plug-in.
-Please configure the project default formatter to Prettier.

:::
