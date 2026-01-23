# プラグイン開発ガイド

## 概要

このガイドでは、プラグインの構造、開発プロセス、ベストプラクティス、サンプルコードなど、プラグインシステム用の新しいプラグインを開発する方法について詳しく説明します。

## プラグイン構造

### 標準プラグイン構造
```
my-plugin/
├── index.js          # 插件入口文件（必需）
├── index.vue         # 主组件（可选，用于路由页面）
├── components/       # 插件组件目录（可选）
│   ├── MyComponent.vue
│   └── AnotherComponent.vue
├── assets/           # 插件资源目录（可选）
│   ├── images/
│   └── styles/
├── package.json      # 插件包信息（可选）
└── README.md         # 插件说明文档（可选）
```

### プラグイン構造の簡素化
```
simple-plugin/
├── index.js          # 插件配置
└── index.vue         # 主组件（既是页面也是组件）
```

## 開発手順

### 1.プラグインディレクトリを作成する

に`src/views/plugins/`ディレクトリにプラグインフォルダを作成します

```bash
mkdir src/views/plugins/my-plugin
cd src/views/plugins/my-plugin
```

### 2.プラグインプロファイルの作成

作成`src/views/plugins/my-plugin/index.js`:

```javascript
// 我的插件配置文件
export const routes = [
  {
    path: '/my-page',
    name: 'MyPluginPage',
    component: () => import('./index.vue')
  }
]

// 插件组件（用于在选中区域中渲染）
export const components = {
  MyComponent: () => import('./index.vue')
}

// 插件初始化函数
export async function init() {
  console.log('我的插件初始化完成')
}

// 插件卸载函数
export async function destroy() {
  console.log('我的插件卸载完成')
}
```

### 3.メインコンポーネントの作成

作成`src/views/plugins/my-plugin/index.vue`:

```vue
<template>
  <div class="my-plugin">
    <el-card>
      <div slot="header">
        <span>我的插件</span>
      </div>
      
      <div class="plugin-content">
        <h3>我的插件</h3>
        <p>这是一个示例插件，展示了基本的插件结构。</p>
        
        <el-form-item label="输入框：">
          <el-input
            v-model="inputValue"
            placeholder="请输入内容"
            clearable
            style="width: 300px;"
          />
        </el-form-item>
        
        <div class="info-panel">
          <p><strong>当前值：</strong>{{ inputValue || '暂无输入' }}</p>
          <p><strong>字符长度：</strong>{{ inputValue ? inputValue.length : 0 }}</p>
        </div>
        
        <el-button type="primary" @click="handleClick">测试按钮</el-button>
      </div>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'MyPlugin',
  props: {
    // 支持外部传入值
    value: {
      type: String,
      default: ''
    },
    // 字段配置
    field: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      inputValue: this.value || ''
    }
  },
  watch: {
    // 双向绑定支持
    value(newVal) {
      this.inputValue = newVal || ''
    },
    inputValue(newVal) {
      this.$emit('input', newVal)
      this.$emit('change', newVal)
    }
  },
  methods: {
    handleClick() {
      this.$message.success('插件功能正常！当前值：' + (this.inputValue || '空'))
    }
  }
}
</script>

<style scoped>
.my-plugin {
  padding: 20px;
}

.plugin-content {
  text-align: center;
}

.plugin-content h3 {
  color: #303133;
  margin-bottom: 15px;
}

.plugin-content p {
  color: #606266;
  margin-bottom: 20px;
  line-height: 1.5;
}

.info-panel {
  margin: 15px 0;
  padding: 10px;
  background-color: #f0f9ff;
  border-left: 4px solid #409eff;
  border-radius: 4px;
  text-align: left;
}

.info-panel p {
  margin: 5px 0;
  color: #606266;
}

.info-panel strong {
  color: #303133;
}

.el-form-item {
  margin-bottom: 20px;
}

.el-button {
  margin-top: 10px;
}
</style>
```

### 4.登録プラグイン設定

に`src/views/plugins/plugin-registry.js`にプラグイン設定を追加します。

```javascript
// 我的插件配置
const myPluginConfig = {
  name: "my-plugin",
  displayName: "我的插件",
  description: "这是一个示例插件，展示了基本的插件结构。",
  version: "1.0.0",
  author: "开发者",
  entry: "index.js",
  routes: true,
  components: true,
  store: false,
  permissions: ["my:read"],
  features: ["示例功能"],
  dependencies: {
    "vue": "^2.6.0"
  }
}

// 在 registerAllPlugins 函数中添加
pluginsToRegister.push({ name: 'my-plugin', config: myPluginConfig })
```

### 5.インポートマッピングの追加

に`src/views/plugins/plugin-importer.js`にインポートマッピングを追加します

```javascript
const pluginComponentImports = {
  'test-plugin': {
    'TestHome': () => import('@/views/plugins/test-plugin/components/TestHome.vue'),
    'TestCounter': () => import('@/views/plugins/test-plugin/components/TestCounter.vue'),
    'TestForm': () => import('@/views/plugins/test-plugin/components/TestForm.vue')
  },
  'demo-plugin': {
    'DemoComponent': () => import('@/views/plugins/demo-plugin/index.vue')
  },
  'my-plugin': {
    'MyComponent': () => import('@/views/plugins/my-plugin/index.vue')
  }
}
```

## プラグインインタフェース仕様

### 必須インタフェース

#### Routes-ルーティング設定
```javascript
export const routes = [
  {
    path: '/my-page',           // 相对路径
    name: 'MyPluginPage',       // 唯一的路由名
    component: MyComponent,      // 组件引用或导入函数
    meta: {
      title: '我的页面',        // 页面标题
      requiresAuth: true        // 是否需要认证
    }
  }
]
```

#### Components-コンポーネント構成
```javascript
export const components = {
  MyComponent: MyComponent,     // 组件引用
  AnotherComponent: () => import('./AnotherComponent.vue')  // 动态导入
}
```

### オプションインターフェース

#### Init () -プラグイン初期化
```javascript
export async function init() {
  try {
    // 初始化逻辑
    console.log('插件初始化成功')
  } catch (error) {
    console.error('插件初始化失败:', error)
    throw error
  }
}
```

#### Destroy () -プラグインのアンインストール
```javascript
export async function destroy() {
  try {
    // 清理逻辑
    console.log('插件卸载完成')
  } catch (error) {
    console.error('插件卸载失败:', error)
  }
}
```

## ベストプラクティス

### 1. 命名規範

- **プラグイン名**：小文字とハイフンを使用します。
- **コンポーネント名**：PascalCaseを使って
- **ルート名**：「My-page」のようにkebab-caseを使用します
- **ファイル名**：PascalCaseを使用します。

### 2.コンポーネント設計

```javascript
// 支持双向绑定
props: {
  value: {
    type: String,
    default: ''
  }
},
watch: {
  value(newVal) {
    // 处理外部值变化
  },
  inputValue(newVal) {
    // 向外部发送值变化
    this.$emit('input', newVal)
  }
}
```

### 3.エラー処理

```javascript
export async function init() {
  try {
    // 初始化逻辑
    await this.loadDependencies()
    await this.initializeComponents()
    console.log('插件初始化成功')
  } catch (error) {
    console.error('插件初始化失败:', error)
    // 优雅降级
    this.showErrorMessage('插件初始化失败，部分功能可能不可用')
  }
}
```

### 4.パフォーマンスの最適化

```javascript
// 使用懒加载
component: () => import('./MyComponent.vue')

// 避免不必要的重渲染
computed: {
  processedData() {
    return this.expensiveOperation(this.data)
  }
}

// 及时清理资源
beforeDestroy() {
  this.clearTimers()
  this.removeEventListeners()
}
```

## テストとデバッグ

### 1.プラグインを有効にする

1.プラグイン管理ページへのアクセス
2.プラグインを見つけます
3.「有効にする」ボタンをクリックします
4.ページを更新する

### 2.プラグインへのアクセス

- **ルーティングページ**：'/Plugin/my-plugin/my-page'
- **コンポーネントのレンダリング**：選択した領域にプラグインコンポーネントのフィールドを設定します

### 3.デバッグテクニック

```javascript
// 在组件中添加调试信息
mounted() {
  console.log('组件已挂载:', this.$options.name)
  console.log('组件属性:', this.$props)
  console.log('组件数据:', this.$data)
}

// 使用 Vue DevTools 检查组件状态
// 查看浏览器控制台的日志信息
// 检查网络请求和错误
```

## 公開と配布

### 1.バージョン管理

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "我的插件描述",
  "author": "开发者姓名",
  "license": "MIT",
  "repository": "https://github.com/username/my-plugin"
}
```

### 2.ドキュメントの説明

- 作成`README.md`プラグイン機能の説明
- 使用例と構成手順を提供します
- 依存関係と互換性を説明します

### 3.テスト検証

- 機能テスト: すべての機能が正常に動作していることを確認します
- 互換性テスト: システムとの互換性を確保します
- パフォーマンステスト: パフォーマンスの影響を確認します

## よくある質問

### Q: プラグインが有効になっているとページにアクセスできませんか?

A: ルーティング構成が正しいかどうかをチェックし、コンポーネントのインポートパスが正しいことを確認します。

### Q: コンポーネントが正常に表示されない?

A: コンポーネント構成フォーマットを検証し、コンポーネントファイルが存在するかどうかを確認します。

### Q: プラグインの初期化に失敗しましたか?

A: チェック`init`関数内のエラー処理は、すべての依存関係が正しくロードされるようにします。

### Q: 新しいコンポーネントタイプを追加するにはどうすればよいですか?

A: はい`plugin-component-adapter.js`に新しいコンポーネントタイプのサポートを追加します。

## まとめ

このガイドに従うことで、次のことができます

1.✅完全な機能を備えたプラグインをすばやく作成
2.✅ベストプラクティスと設計原則に従う
3.✅プラグインの品質と保守性を確保します
4.✅既存のシステムに容易に統合

あなたの最初のプラグインの開発を始めましょう!