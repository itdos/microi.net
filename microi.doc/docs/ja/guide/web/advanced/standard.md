<!-- 项目规范 -->


プロジェクト規範 (整備待ち)このプロジェクトでは、Visual Studio Codeを使用した開発を推奨します

プロジェクトファイル、コンポーネント命名仕様- Link（v3）：https://cn.vuejs.org/style-guide
- Link（v2）：https://v2.cn.vuejs.org/v2/style-guide

::: Warning
💢Microi吾コードはVue公式推奨のスタイルガイドを採用していますので、ぜひご覧ください
:::

コードフォーマットツール1.prettier関連の依存関係をダウンロードする:```bash
pnpm install prettier -D
```


2.Vscodeプラグインをインストールする![Prettier](/advanced/prettier.png)

3.Prettier(.prettierrc.cjs) の構成:```javascript
// @see: https://www.prettier.cn

module.exports = {
	// 指定最大换行长度
	printWidth: 150,
	// 缩进制表符宽度 | 空格数
	tabWidth: 2,
	// 使用制表符而不是空格缩进行 (true：制表符，false：空格)
	useTabs: false,
	// 结尾不用分号 (true：有，false：没有)
	semi: true,
	// 使用单引号 (true：单引号，false：双引号)
	singleQuote: false,
	// 在对象字面量中决定是否将属性名用引号括起来 可选值 "<as-needed|consistent|preserve>"
	quoteProps: "as-needed",
	// 在JSX中使用单引号而不是双引号 (true：单引号，false：双引号)
	jsxSingleQuote: false,
	// 多行时尽可能打印尾随逗号 可选值"<none|es5|all>"
	trailingComma: "none",
	// 在对象，数组括号与文字之间加空格 "{ foo: bar }" (true：有，false：没有)
	bracketSpacing: true,
	// 将 > 多行元素放在最后一行的末尾，而不是单独放在下一行 (true：放末尾，false：单独一行)
	bracketSameLine: false,
	// (x) => {} 箭头函数参数只有一个时是否要有小括号 (avoid：省略括号，always：不省略括号)
	arrowParens: "avoid",
	// 指定要使用的解析器，不需要写文件开头的 @prettier
	requirePragma: false,
	// 可以在文件顶部插入一个特殊标记，指定该文件已使用 Prettier 格式化
	insertPragma: false,
	// 用于控制文本是否应该被换行以及如何进行换行
	proseWrap: "preserve",
	// 在html中空格是否是敏感的 "css" - 遵守 CSS 显示属性的默认值， "strict" - 空格被认为是敏感的 ，"ignore" - 空格被认为是不敏感的
	htmlWhitespaceSensitivity: "css",
	// 控制在 Vue 单文件组件中 <script> 和 <style> 标签内的代码缩进方式
	vueIndentScriptAndStyle: false,
	// 换行符使用 lf 结尾是 可选值 "<auto|lf|crlf|cr>"
	endOfLine: "auto",
	// 这两个选项可用于格式化以给定字符偏移量（分别包括和不包括）开始和结束的代码 (rangeStart：开始，rangeEnd：结束)
	rangeStart: 0,
	rangeEnd: Infinity,
};
```


コード仕様ツール (ESLint)1.ESLint関連の依存関係をダウンロードする:```bash
pnpm install eslint eslint-config-prettier eslint-plugin-prettier eslint-plugin-vue @typescript-eslint/eslint-plugin @typescript-eslint/parser -D
```


| Eslint | ESLintコアライブラリ |
| Eslint-config-prettier | Prettierと競合するESLintの構成をすべてオフにします |
| Eslint-plugin-prettier | PrettierのlesをプラグインとしてESLintに追加します。 |
| Eslint-plugin-vue | VueにESlintを使用するプラグイン |
| @ Typescript-eslint/eslint-plugin | ESLintプラグインには、TypeScriptコードを検出するためのさまざまな定義された仕様が含まれています |
| @ Typescript-eslint/パーザー | ESLintのパーサーは、TypeScriptを解析して、TypeScriptコードをチェックし、仕様します |
2.Vscodeプラグイン (ESLint) のインストール:![ESLint](/advanced/eslint.txt)

3.ESLint(.eslintrc.cjs) の構成:```javascript
// @see: http://eslint.cn

module.exports = {
	root: true,
	env: {
		browser: true,
		node: true,
		es6: true,
	},
	// 指定如何解析语法
	parser: "vue-eslint-parser",
	// 优先级低于 parse 的语法解析配置
	parserOptions: {
		parser: "@typescript-eslint/parser",
		ecmaVersion: 2020,
		sourceType: "module",
		jsxPragma: "React",
		ecmaFeatures: {
			jsx: true,
		},
	},
	// 继承某些已有的规则
	extends: ["plugin:vue/vue3-recommended", "plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"],
	/**
	 * "off" 或 0    ==>  关闭规则
	 * "warn" 或 1   ==>  打开的规则作为警告（不影响代码执行）
	 * "error" 或 2  ==>  规则作为一个错误（代码不能执行，界面报错）
	 */
	rules: {
		// eslint (http://eslint.cn/docs/rules)
		"no-var": "error", // 要求使用 let 或 const 而不是 var
		"no-multiple-empty-lines": ["error", { max: 1 }], // 不允许多个空行
		"prefer-const": "off", // 使用 let 关键字声明但在初始分配后从未重新分配的变量，要求使用 const
		"no-use-before-define": "off", // 禁止在 函数/类/变量 定义之前使用它们

		// typeScript (https://typescript-eslint.io/rules)
		"@typescript-eslint/no-unused-vars": "error", // 禁止定义未使用的变量
		"@typescript-eslint/prefer-ts-expect-error": "error", // 禁止使用 @ts-ignore
		"@typescript-eslint/ban-ts-comment": "error", // 禁止 @ts-<directive> 使用注释或要求在指令后进行描述
		"@typescript-eslint/no-inferrable-types": "off", // 可以轻松推断的显式类型可能会增加不必要的冗长
		"@typescript-eslint/no-namespace": "off", // 禁止使用自定义 TypeScript 模块和命名空间
		"@typescript-eslint/no-explicit-any": "off", // 禁止使用 any 类型
		"@typescript-eslint/ban-types": "off", // 禁止使用特定类型
		"@typescript-eslint/no-var-requires": "off", // 允许使用 require() 函数导入模块
		"@typescript-eslint/no-empty-function": "off", // 禁止空函数
		"@typescript-eslint/no-non-null-assertion": "off", // 不允许使用后缀运算符的非空断言(!)

		// vue (https://eslint.vuejs.org/rules)
		"vue/script-setup-uses-vars": "error", // 防止<script setup>使用的变量<template>被标记为未使用，此规则仅在启用该no-unused-vars规则时有效
		"vue/v-slot-style": "error", // 强制执行 v-slot 指令样式
		"vue/no-mutating-props": "error", // 不允许改变组件 prop
		"vue/custom-event-name-casing": "error", // 为自定义事件名称强制使用特定大小写
		"vue/html-closing-bracket-newline": "error", // 在标签的右括号之前要求或禁止换行
		"vue/attribute-hyphenation": "error", // 对模板中的自定义组件强制执行属性命名样式：my-prop="prop"
		"vue/attributes-order": "off", // vue api使用顺序，强制执行属性顺序
		"vue/no-v-html": "off", // 禁止使用 v-html
		"vue/require-default-prop": "off", // 此规则要求为每个 prop 为必填时，必须提供默认值
		"vue/multi-word-component-names": "off", // 要求组件名称始终为 “-” 链接的单词
	},
};
```


スタイル仕様ツール (style lint)1.StyleLint関連の依存関係をダウンロードする:```bash
pnpm install stylelint stylelint-config-html stylelint-config-recommended-scss stylelint-config-recommended-vue stylelint-config-standard stylelint-config-standard-scss stylelint-config-recess-order postcss postcss-html -D
```


| Style lint | Stylelintコアライブラリ |
| Stylelint-config-html | Stylelintの共有可能なHTML (およびHTMLのような) 構成は、postcss-htmlをバンドルして構成します。 |
| Stylelint-config-recommended-scss | Stylelint-config-recommended共有構成を拡張し、SCSSのルールを構成します |
| Stylelint-config-recommended-vue | Stylelint-config-recommended共有構成を拡張し、Vueのルールを構成します |
| Stylelint-config-standard | 追加のルールを開いて、仕様といくつかのCSSスタイルガイドで発見された共通の規則を実行します。例えば、CSSの原則、googleのCSSスタイルガイド、Airbnbのスタイルガイドと @ mdoのコードガイド。 |
| Stylelint-config-standard-scss | Stylelint-config-standard共有構成を拡張し、SCSSのルールを構成します |
| Stylelint-config-reobjects-order | 属性の並べ替え (プラグパック) |
| Postcss | Postcss-htmlの依存パッケージ |
| Postcss-html | HTML (およびそのようなHTML) を解析するためのPostCSS构文 |
Vscodeプラグインをインストールします。![Style lint](/advanced/style lint.txt)

3.ディレクトリの.vscodeフォルダに新規設定.jsonを作成します```json
{
	"editor.formatOnSave": true,
	"editor.codeActionsOnSave": {
		"source.fixAll.stylelint": true
	},
	"stylelint.enable": true,
	"stylelint.validate": ["css", "less", "postcss", "scss", "vue", "sass", "html"],
	"files.eol": "\n"
}
```


😎Vscodeで上記のjsonコードをグローバルに構成することもできます😎

4.Style lint (.Style lintrc.cjs) の設定:```javascript
// @see: https://stylelint.io

module.exports = {
	root: true,
	// 继承某些已有的规则
	extends: [
		"stylelint-config-standard", // 配置 stylelint 拓展插件
		"stylelint-config-html/vue", // 配置 vue 中 template 样式格式化
		"stylelint-config-standard-scss", // 配置 stylelint scss 插件
		"stylelint-config-recommended-vue/scss", // 配置 vue 中 scss 样式格式化
		"stylelint-config-recess-order", // 配置 stylelint css 属性书写顺序插件,
	],
	overrides: [
		// 扫描 .vue/html 文件中的 <style> 标签内的样式
		{
			files: ["**/*.{vue,html}"],
			customSyntax: "postcss-html",
		},
	],
	rules: {
		"function-url-quotes": "always", // URL 的引号 "always(必须加上引号)"|"never(没有引号)"
		"color-hex-length": "long", // 指定 16 进制颜色的简写或扩写 "short(16进制简写)"|"long(16进制扩写)"
		"rule-empty-line-before": "never", // 要求或禁止在规则之前的空行 "always(规则之前必须始终有一个空行)"|"never(规则前绝不能有空行)"|"always-multi-line(多行规则之前必须始终有一个空行)"|"never-multi-line(多行规则之前绝不能有空行)"
		"font-family-no-missing-generic-family-keyword": null, // 禁止在字体族名称列表中缺少通用字体族关键字
		"scss/at-import-partial-extension": null, // 解决不能使用 @import 引入 scss 文件
		"property-no-unknown": null, // 禁止未知的属性
		"no-empty-source": null, // 禁止空源码
		"selector-class-pattern": null, // 强制选择器类名的格式
		"value-no-vendor-prefix": null, // 关闭 vendor-prefix (为了解决多行省略 -webkit-box)
		"no-descending-specificity": null, // 不允许较低特异性的选择器出现在覆盖较高特异性的选择器
		"value-keyword-case": null, // 解决在 scss 中使用 v-bind 大写单词报错
		"selector-pseudo-class-no-unknown": [
			true,
			{
				ignorePseudoClasses: ["global", "v-deep", "deep"],
			},
		],
	},
	ignoreFiles: ["**/*.js", "**/*.jsx", "**/*.tsx", "**/*.ts"],
};
```


EditorConfig設定1、紹介:- **EditorConfig** 帮助开发人员在 **不同的编辑器** 和 **IDE** 之间定义和维护一致的编码样式。

2.VsCodeプラグインをインストールします![EditorConfig](/advanced/editorconfig.txt)

3.Editoconfig (.Editoconfig) の構成:```javascript
# @see: http://editorconfig.org

root = true

[*] # 表示所有文件适用
charset = utf-8 # 设置文件字符集为 utf-8
end_of_line = lf # 控制换行类型(lf | cr | crlf)
insert_final_newline = true # 始终在文件末尾插入一个新行
indent_style = space # 缩进风格（tab | space）
indent_size = 2 # 缩进大小
max_line_length = 130 # 最大行长度

[*.md] # 表示仅对 md 文件适用以下规则
max_line_length = off # 关闭最大行长度限制
trim_trailing_whitespace = false # 关闭末尾空格修剪

```


Gitプロセス仕様設定| ハスキー | ** Git ** フックを操作するツール (** git xx ** の前にいくつかのコマンドを実行) |
| Lint-staged | 送信する前に ** eslint ** 検証を行い、 ** prettier ** を使用してローカルの一時保管エリアのコードをフォーマットします |
| @ Commitlint/cli | ** Git commit ** 情報が基準を満たしているかどうかを検証し、チームの整合性を保証します |
| @ Commitlint/config-conventional | ** Anglar ** の提出規範 |
| Czg | 対話型コマンドラインツールは、標準化されたgit commit messageを生成します |
| Cz-git | よりエンジニアリング性が高く、軽量で、高度にカスタマイズされ、標準出力フォーマットの ** commitize ** アダプタ |
1、ハスキー (gitフックを操作するツール):** インストール: **

```bash
pnpm install husky -D
```


** 使用する (.huskyフォルダを追加するため):**

```bash
# 编辑 package.json > prepare 脚本并运行一次

pnpm set-script prepare "husky install"
pnpm prepare
```


2、lint-staged (ローカル一時保管コード検査ツール)** インストール: **

```bash
pnpm install lint-staged --D
```


* ESlint Hookを追加します。

** 役割: フック関数によって、提出したコードが規範に合っているかどうかを判断し、prettierを使用してコードをフォーマットする **

```bash
npx husky add .husky/pre-commit "npm run lint:lint-staged"
```


** Lint-staged.config.cjs ** ファイルを追加しました:

```bash
module.exports = {
  "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  "{!(package)*.json,*.code-snippets,.!(browserslist)*rc}": ["prettier --write--parser json"],
  "package.json": ["prettier --write"],
  "*.vue": ["eslint --fix", "prettier --write", "stylelint --fix"],
  "*.{scss,less,styl,html}": ["stylelint --fix", "prettier --write"],
  "*.md": ["prettier --write"]
};
```


3、commitlint(commit情報検証ツール、適合しなければエラー)** インストール: **

```bash
pnpm install @commitlint/cli @commitlint/config-conventional -D
```


** 設定コマンド (.huskyフォルダにcommit-msgファイルを追加):**

```bash
npx husky add .husky/commit-msg 'npx --no-install commitlint --edit "$1"'
```


4、commitizen (Node.jsに基づくgit commitコマンドラインツール、標準化されたmessageの生成)```bash
// 安装 czg，如此一来可以快速使用 czg 命令进行启动。
pnpm install czg -D
```


5、cz-git** 提出文字の仕様を指定して、よりエンジニアリング性が高く、高度にカスタマイズされ、標準出力形式のcommitizenアダプタ **

```bash
pnpm install cz-git -D
```


** パッケージ.jsonの設定: **

```bash
"config": {
  "commitizen": {
    "path": "node_modules/cz-git"
  }
}
```


** 新たにay lint.config.jsファイルを作成します。

```javascript
// @see: https://cz-git.qbenben.com/zh/guide
const fs = require("fs");
const path = require("path");

const scopes = fs
	.readdirSync(path.resolve(__dirname, "src"), { withFileTypes: true })
	.filter((dirent) => dirent.isDirectory())
	.map((dirent) => dirent.name.replace(/s$/, ""));

/** @type {import('cz-git').UserConfig} */
module.exports = {
	ignores: [(commit) => commit.includes("init")],
	extends: ["@commitlint/config-conventional"],
	rules: {
		// @see: https://commitlint.js.org/#/reference-rules
		"body-leading-blank": [2, "always"],
		"footer-leading-blank": [1, "always"],
		"header-max-length": [2, "always", 108],
		"subject-empty": [2, "never"],
		"type-empty": [2, "never"],
		"subject-case": [0],
		"type-enum": [2, "always", ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert", "wip", "workflow", "types", "release"]],
	},
	prompt: {
		messages: {
			type: "Select the type of change that you're committing:",
			scope: "Denote the SCOPE of this change (optional):",
			customScope: "Denote the SCOPE of this change:",
			subject: "Write a SHORT, IMPERATIVE tense description of the change:\n",
			body: 'Provide a LONGER description of the change (optional). Use "|" to break new line:\n',
			breaking: 'List any BREAKING CHANGES (optional). Use "|" to break new line:\n',
			footerPrefixsSelect: "Select the ISSUES type of changeList by this change (optional):",
			customFooterPrefixs: "Input ISSUES prefix:",
			footer: "List any ISSUES by this change. E.g.: #31, #34:\n",
			confirmCommit: "Are you sure you want to proceed with the commit above?",
			// 中文版
			// type: "选择你要提交的类型 :",
			// scope: "选择一个提交范围（可选）:",
			// customScope: "请输入自定义的提交范围 :",
			// subject: "填写简短精炼的变更描述 :\n",
			// body: '填写更加详细的变更描述（可选）。使用 "|" 换行 :\n',
			// breaking: '列举非兼容性重大的变更（可选）。使用 "|" 换行 :\n',
			// footerPrefixsSelect: "选择关联issue前缀（可选）:",
			// customFooterPrefixs: "输入自定义issue前缀 :",
			// footer: "列举关联issue (可选) 例如: #31, #I3244 :\n",
			// confirmCommit: "是否提交或修改commit ?"
		},
		types: [
			{
				value: "feat",
				name: "feat:     🚀  A new feature",
				emoji: "🚀",
			},
			{
				value: "fix",
				name: "fix:      🧩  A bug fix",
				emoji: "🧩",
			},
			{
				value: "docs",
				name: "docs:     📚  Documentation only changes",
				emoji: "📚",
			},
			{
				value: "style",
				name: "style:    🎨  Changes that do not affect the meaning of the code",
				emoji: "🎨",
			},
			{
				value: "refactor",
				name: "refactor: ♻️   A code change that neither fixes a bug nor adds a feature",
				emoji: "♻️",
			},
			{
				value: "perf",
				name: "perf:     ⚡️  A code change that improves performance",
				emoji: "⚡️",
			},
			{
				value: "test",
				name: "test:     ✅  Adding missing tests or correcting existing tests",
				emoji: "✅",
			},
			{
				value: "build",
				name: "build:    📦️   Changes that affect the build system or external dependencies",
				emoji: "📦️",
			},
			{
				value: "ci",
				name: "ci:       🎡  Changes to our CI configuration files and scripts",
				emoji: "🎡",
			},
			{
				value: "chore",
				name: "chore:    🔨  Other changes that don't modify src or test files",
				emoji: "🔨",
			},
			{
				value: "revert",
				name: "revert:   ⏪️  Reverts a previous commit",
				emoji: "⏪️",
			},
			{
				value: "wip",
				name: "wip:      🕔  work in process",
				emoji: "🕔",
			},
			{
				value: "workflow",
				name: "workflow: 📋  workflow improvements",
				emoji: "📋",
			},
			{
				value: "type",
				name: "type:     🔰  type definition file changes",
				emoji: "🔰",
			},
			// 中文版
			// { value: "feat", name: "特性:   🚀  新增功能", emoji: "🚀" },
			// { value: "fix", name: "修复:   🧩  修复缺陷", emoji: "🧩" },
			// { value: "docs", name: "文档:   📚  文档变更", emoji: "📚" },
			// { value: "style", name: "格式:   🎨  代码格式（不影响功能，例如空格、分号等格式修正）", emoji: "🎨" },
			// { value: "refactor", name: "重构:   ♻️  代码重构（不包括 bug 修复、功能新增）", emoji: "♻️" },
			// { value: "perf", name: "性能:    ⚡️  性能优化", emoji: "⚡️" },
			// { value: "test", name: "测试:   ✅  添加疏漏测试或已有测试改动", emoji: "✅" },
			// { value: "build", name: "构建:   📦️  构建流程、外部依赖变更（如升级 npm 包、修改 webpack 配置等）", emoji: "📦️" },
			// { value: "ci", name: "集成:   🎡  修改 CI 配置、脚本", emoji: "🎡" },
			// { value: "chore", name: "回退:   ⏪️  回滚 commit", emoji: "⏪️" },
			// { value: "revert", name: "其他:   🔨  对构建过程或辅助工具和库的更改（不影响源文件、测试用例）", emoji: "🔨" },
			// { value: "wip", name: "开发:   🕔  正在开发中", emoji: "🕔" },
			// { value: "workflow", name: "工作流:   📋  工作流程改进", emoji: "📋" },
			// { value: "types", name: "类型:   🔰  类型定义文件修改", emoji: "🔰" }
		],
		useEmoji: true,
		scopes: [...scopes],
		customScopesAlign: "bottom",
		emptyScopesAlias: "empty",
		customScopesAlias: "custom",
		allowBreakingChanges: ["feat", "fix"],
	},
};
```


Package.jsonコマンドの設定```json
{
	"scripts": {
		// 本地运行(dev环境)
		"dev": "vite",
		// 本地运行(dev环境)
		"serve": "vite",
		// 构建打包(dev环境)
		"build:dev": "vue-tsc && vite build --mode development",
		// 构建打包(test环境)
		"build:test": "vue-tsc && vite build --mode test",
		// 构建打包(pro环境)
		"build:pro": "vue-tsc && vite build --mode production",
		// 检查项目 ts 类型
		"type:check": "vue-tsc --noEmit --skipLibCheck",
		// 本地环境预览构建后的 dist
		"preview": "npm run build:dev && vite preview",
		// 执行 eslint 校验
		"lint:eslint": "eslint --fix --ext .js,.ts,.vue ./src",
		// 执行 prettier 格式化
		"lint:prettier": "prettier --write \"src/**/*.{js,ts,json,tsx,css,less,scss,vue,html,md}\"",
		// 执行 stylelint 格式化
		"lint:stylelint": "stylelint --cache --fix \"**/*.{vue,less,postcss,css,scss}\" --cache --cache-location node_modules/.cache/stylelint/",
		// 执行 lint-staged.config.js 文件下的命令
		"lint:lint-staged": "lint-staged",
		// 初始化 husky 配置
		"prepare": "husky install",
		// 自动更新版本
		"release": "standard-version",
		// 提交代码(可自定义配置执行命令)
		"commit": "git add -A && czg && git push"
	}
}
```

