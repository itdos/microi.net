<! -- クイックハンド -->

# クイックハンド

この記事は、最初からこのプロジェクトを開始し、構築するのに役立ちます

## Vue2バージョン

### 環境準備

ローカル環境には [Node.js 14.x](https://nodejs.org/en/)、[Git](https://git-scm.com/) をインストールする必要があります
::: Warning暖かいヒント🎯
-Node.jsバージョンは ** 14 ** を推奨しています。両方のバージョンをメンテナンスする場合は、nvmを使用してnodeバージョンを切り替えます。

-Npmミラーソースはtaobao (https://registry.npmmirror.com/) またはnpmMirror (https://skimdb.npmjs.com/registry/) を使用してください。nrmツールを使用してnpmソースをすばやく切り替えることができます。
:::

::: Code-group

```bash [node版本切换]

nvm use 14

```

```bash [npm源切换]
nrm use taobao
```

:::

-** Nvmチュートリアル **💯: https://lisaisai.blog.csdn.net/article/details/145481541?spm=1001.2014.3001.5502 。
-** Nrmチュートリアル **💯: https://lisaisai.blog.csdn.net/article/details/145481783?spm=1001.2014.3001.5502


### コードプル

** Giteeからコードをプル **:

```bash
# 克隆代码
git clone https://gitee.com/ITdos/microi.net.git
```

Gitコードからコードを引き出す *:

```bash
# 克隆代码
git clone https://gitcode.com/microi-net/microi.net.git
```
### 使用手順のインストール

### ターミナルを開く:
```bash
# 进入前端文件夹
cd X:\microi.net\microi.vue2.full
```

### インストールの依存関係:

```bash
nvm use 14
npm install nrm -g
# 📌如果taobao不行用 nrm use npmMirror
nrm use taobao 
npm install
```

### プロジェクトの実行:

```bash
npm run dev
```

### 梱包項目:

```bash
npm run build
```

 
### Npm script詳細

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

### 注意事項‼️

** 上記の手順で他のエラーが発生した場合は、次の手順を試してください **:
1.「node _ modules」を削除する
2.「パッケージングロック.Json」を削除する
3.実行 # 'npmcache clean -- force'
4.# 'npminstall' インストール環境手順を再実行する

** その他の可能性のある問題 **:
-エラー: '/node _ form/_ monaco-editor@0.33.0 @ monaco-editor/esm/vs/basic-languages/_.contribution.js
Failed to compile with 1 error in ./node _ form/monaco-editor/esm/vs/basic-languages/_.contribution.js'
    
-解決:
次の5つの変数 (30行以上のコード程度) を 'LazyLanguageLoader' 内部から上に移動し、 'var' 宣言を使用すればよい。
''Js
Var _ languageid;
Var _ load triggred;
Var _ lazyloadpromise;
Var _ lazyloadpromiseresolve;
Var _ lazyloadpromisereject;
Var lazy languageloader = class { ......
'''
### バックエンド・インタフェース・アドレスの切り替え

1. 'request.js' ファイルは 'baseur l' パラメータを変更します。
2. 'itdos.osclient.js' ファイルの修正

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


## Vue3バージョン (開発待ち)

### 環境準備

ローカル环境に [Node.js 18.x ](https://nodejs.org/en/)、[Git](https://git-scm.com/) をインストールする必要があります
::: Warning暖かいヒント🎯
Node.jsバージョンは ** 18 ** をインストールすることを推奨しています。両方のバージョンをメンテナンスする場合は、nvmを使用してnodeバージョンを切り替えてください。

Npmミラーソースはtaobao (https://registry.npmmirror.com/) またはnpmMirror (https://skimdb.npmjs.com/registry/) を使用してください。nrmツールを使用してnpmソースをすばやく切り替えることができます。
:::

::: Code-group

```bash [node版本切换]

nvm use 18

```

```bash [npm源切换]
nrm use taobao
```

:::

-** Nvmチュートリアル **💯: https://lisaisai.blog.csdn.net/article/details/145481541?spm=1001.2014.3001.5502 。
-** Nrmチュートリアル **💯: https://lisaisai.blog.csdn.net/article/details/145481783?spm=1001.2014.3001.5502


### ツール設定

このプロジェクトはVSCodeを使用して開発することを推奨しています。プロジェクトにはVSCode構成が内蔵されており、推奨されるプラグインと設定が含まれています。

>🌈次のプラグインのインストールを推奨します

-[Vue Language Features (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) ==> Vue3公式プラグイン
-[TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) ==> Vue3公式プラグイン (TypeScript)
-[Vue 3 Snippets](https://marketplace.visualstudio.com/items?itemName=hollowtree.vue-snippets) ==> Vue3コードヒント
-[ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) ==> コードチェック
-[Style lint](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) ==> CSSコードチェック & & & フォーマット
-[Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) ==> コードのフォーマット
-[EditorConfig for VS Code](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig) ==> 異なるエディタのコーディングスタイルを統一する
-[Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) ==> 単語のスペルミスをチェックする
-[Sass](https://marketplace.visualstudio.com/items?itemName=Syler.sass-indented) ==> Sassスタイル記述
-[DotENV](https://marketplace.visualstudio.com/items?itemName=mikestead.dotenv) ==> ハイライト.Dvファイル

### .Vscode> extensions.json

```json
{
	"recommendations": ["vue.volar", "vue.vscode-typescript-vue-plugin", "hollowtree.vue-snippets", "dbaeumer.vscode-eslint", "stylelint.vscode-stylelint", "esbenp.prettier-vscode", "editorconfig.editorconfig", "streetsidesoftware.code-spell-checker", "syler.sass-indented", "mikestead.dotenv"]
}
```

::: Warning

-Vue3プロジェクトを開発するには、Volarプラグインを開き、Veturプラグインを無効にしてください。
-プロジェクトのデフォルトのフォーマッタをPrettierに設定してください。

:::
