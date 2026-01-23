# プラグイン独立依存管理ドキュメント

## 概要

プラグイン独立依存管理システムは、従来のプラグインシステムにおける依存パッケージ汚染の主なプロジェクトを解決した`package.json`の問題です。動的ロード、依存注入、スマートキャッシュメカニズムを通じて、プラグインの完全な独立依存管理を実現した。

## コア特性

### ✅** 独立依存管理 **
- プラグインは独自の依存パッケージを定義でき、メインプロジェクトで構成する必要はありません
- 複数の依存タイプをサポートします: 外部依存、内部依存、ピア依存、オプション依存
- 自動依存解析とバージョン管理

### ✅** 動的ロードメカニズム **
- 実行時にプラグインの依存関係を動的にロードする
- CDN外部依存自動ロード
- ローカルファイル内部依存オンデマンドインポート
- スマートキャッシュは重複ロードを避ける

### ✅** 依存性注入システム **
- プラグイン初期化時に自動的に依存を注入する
- 依存性可用性チェックのサポート
- 依存注入器インタフェースを提供します

### ✅** ダウングレードとフォールトトレラント **
- オプションの依存関係は、ダウングレードのシナリオをサポートしています
- 依存ロード失敗はプラグインの実行に影響しない
- 詳細なエラーログとステータスレポート

## 依存タイプの説明

### 1.ピア依存

メインプロジェクトの既存の依存パッケージを使用して、重複ロードを回避します。

```javascript
export const dependencies = {
  'vue': '^2.6.0',           // 简单字符串配置
  'element-ui': '^2.15.0'    // 使用主项目的 Element UI
}
```

**特:**
- バッグの体積を増やさない
- バージョン互換性はメインプロジェクトが管理します
- ロード速度が最も速い

### 2. 外部依存

CDNからサードパーティのライブラリを動的にロードします。

```javascript
export const dependencies = {
  'lodash': {
    type: 'external',
    version: '^4.17.21',
    source: 'https://unpkg.com/lodash@4.17.21/lodash.min.js'
  },
  'moment': {
    type: 'external',
    version: '^2.29.4',
    source: 'https://unpkg.com/moment@2.29.4/moment.min.js',
    fallback: true  // 支持降级方案
  }
}
```

**特:**
- 必要に応じてロードし、初期パッケージの体積を減らします
- バージョン管理をサポート
- ネットワークは依存しています。ロード処理に失敗しました。

### 3. 内部依存

プラグイン内部のツールモジュールをロードします。

```javascript
export const dependencies = {
  'chart-utils': {
    type: 'internal',
    version: '^1.0.0',
    path: './utils/chart-utils.js'
  },
  'api-client': {
    type: 'internal',
    version: '^1.0.0',
    path: './services/api-client.js'
  }
}
```

**特:**
- プラグインのプライベートツールモジュール
- モジュール開発をサポート
- ロード速度が速い

### 4.オプションの依存関係

使用できない場合は、プラグインの実行にも影響しません。

```javascript
export const dependencies = {
  'echarts': {
    type: 'optional',
    version: '^5.0.0',
    fallback: true
  },
  'three': {
    type: 'optional',
    version: '^0.150.0',
    fallback: true
  }
}
```

**特:**
- 機能強化は必須ではありません
- 簡単な実装へのダウングレードをサポート
- プラグインの互換性を高める

## 使い方

### 1.プラグインの依存関係を定義する

プラグインの`index.js`に依存構成を定義します

```javascript
// 插件依赖配置
export const dependencies = {
  // 对等依赖
  'vue': '^2.6.0',
  'element-ui': '^2.15.0',
  
  // 外部依赖
  'lodash': {
    type: 'external',
    version: '^4.17.21',
    source: 'https://unpkg.com/lodash@4.17.21/lodash.min.js'
  },
  
  // 内部依赖
  'utils': {
    type: 'internal',
    version: '^1.0.0',
    path: './utils/index.js'
  },
  
  // 可选依赖
  'chart': {
    type: 'optional',
    version: '^5.0.0',
    fallback: true
  }
}
```

### 2.依存注入器を使用する

プラグイン初期化関数で依存注入器を受け取る:

```javascript
// 插件初始化函数
export async function init(dependencyInjector) {
  console.log('插件初始化开始...')
  
  // 获取依赖
  const lodash = dependencyInjector.get('lodash')
  const utils = dependencyInjector.get('utils')
  const chart = dependencyInjector.get('chart')
  
  // 检查依赖是否可用
  if (dependencyInjector.has('lodash')) {
    console.log('Lodash 可用:', lodash)
    // 使用 lodash
    window._ = lodash
  }
  
  if (dependencyInjector.has('utils')) {
    console.log('Utils 可用:', utils)
    // 使用内部工具
    window.utils = utils
  }
  
  if (dependencyInjector.has('chart')) {
    console.log('Chart 可用:', chart)
    // 使用图表库
    window.chart = chart
  } else {
    console.log('Chart 不可用，使用降级方案')
    // 使用简单的 Canvas 替代
  }
  
  // 批量注入依赖
  dependencyInjector.inject(window, ['lodash', 'utils'])
  
  console.log('插件初始化完成')
}
```

### 3.プラグインのアンインストール

プラグインのアンロード関数で依存関係をクリーンアップします

''Javascript
// プラグインのアンロード関数
どうしたらいいの?
Console.log('プラグインのアンインストール開始...')
  
// グローバル変数のクリーンアップ
Delete window._
Delete window.utils
Delete window.chart
  
Console.log('プラグインのアンインストール完了')
}
```

## API 参考

### PluginDependencyManager

#### `loadPluginDependencies(pluginName, dependencies)`
加载插件的所有依赖。

**参数：**
- `pluginName` (string): 插件名称
- `dependencies` (Object): 依赖配置

**返回：** Promise<Object> 加载结果

#### `getPluginDependencies(pluginName)`
获取插件的依赖信息。

**参数：**
- `pluginName` (string): 插件名称

**返回：** Object|null 依赖信息

#### `isDependencyLoaded(pluginName, depName)`
检查依赖是否已加载。

**参数：**
- `pluginName` (string): 插件名称
- `depName` (string): 依赖名称

**返回：** boolean 是否已加载

### PluginDependencyLoader

#### `loadPluginDependencies(pluginName, pluginConfig)`
加载插件依赖并处理结果。

**参数：**
- `pluginName` (string): 插件名称
- `pluginConfig` (Object): 插件配置

**返回：** Promise<Object> 处理结果

#### `createDependencyInjector(pluginName)`
创建依赖注入器。

**参数：**
- `pluginName` (string): 插件名称

**返回：** Object 依赖注入器

### DependencyInjector

#### `get(depName)`
获取指定依赖。

**参数：**
- `depName` (string): 依赖名称

**返回：** any 依赖模块

#### `has(depName)`
检查依赖是否可用。

**参数：**
- `depName` (string): 依赖名称

**返回：** boolean 是否可用

#### `inject(target, depNames)`
批量注入依赖到目标对象。

**参数：**
- `target` (Object): 目标对象
- `depNames` (Array): 依赖名称数组

**返回：** Object 目标对象

## 最佳实践

### 1. 依赖类型选择

```javascript
//✅推奨: ピア依存を優先的に使用する
エクスポートコンストラテジー = {
'Vue': '^ 2.6.0', // 対等依存
'Element-ui': '^ 2.15.0 '// ピア依存
}

//✅推奨: 大規模なライブラリは外部依存を使用します
エクスポートコンストラテジー = {
'Lodash': {
Type: 'external',
Version: '^ 4.17.21',
Source: 'https:// unpkg.com/lodash@4.17.21/lodash.min.js'
}
}

//✅推奨: ツール関数は内部依存を使用します
エクスポートコンストラテジー = {
'Utils ': {
Type: 'internal',
Version: '^ 1.0.0',
Path: './utils/index.js'
}
}

//✅推奨: 機能強化はオプションの依存関係を使用します
エクスポートコンストラテジー = {
'Chart': {
Type: 'optional',
Version: '^ 5.0.0',
フォールバック: true
}
}
```

### 2. 错误处理

```javascript
どうしたらいいですか?
Try {
// 重要な依存関係をチェックする
If (! DependencyInjector.has('vue') {
Throw new Error('vue依存は使用できません')
}
    
// 処理オプション依存
If (dependencyInjector.has('chart')) {
// グラフライブラリを使用する
This.アウトドアチャート ()
} Else {
// ダウングレードを使用する
This.initSimpleChart()
}
    
} Catch (error) {
Console.error('プラグインの初期化に失敗しました:', error)
// 優雅ダウングレード
This.スチームフォールバックモード ()
}
}
```

### 3. 性能优化

```javascript
//✅推奨: プリロードの一般的な依存関係
Awachedidentifiencyloader.Preloadcommondependenties ([
「Lodash」
「Moment」
'Axios'
])

//✅推奨: キャッシュの使用
コンストラクターキー =`${pluginName}:${JSON.stringify(dependencies)}`
If (dependencyCache.has(cacheKey)) {
Returdependencycache.get(cacheKey)
}

//✅推奨: 重複ロードを避ける
If
Returthis.でっかく.get(cacheKey)
}
```

## 故障排除

### 常见问题

#### 1. 外部依赖加载失败

**问题：** CDN 依赖无法加载

**解决方案：**
```javascript
// 複数のCDNソースを使用する
'Lodash': {
Type: 'external',
Version: '^ 4.17.21',
Source: 'https:// unpkg.com/lodash@4.17.21/lodash.min.js',
フォールバック: 'https:// cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'
}
```

#### 2. 内部依赖路径错误

**问题：** 内部依赖文件找不到

**解决方案：**
```javascript
// 相対パスを使用
'Utils ': {
Type: 'internal',
Version: '^ 1.0.0',
Path: './utils/index.js' // プラグインルートディレクトリに対する
}
```

#### 3. 对等依赖版本冲突

**问题：** 插件需要的版本与主项目不兼容

**解决方案：**
```javascript
// 互換性のあるバージョン範囲を使用します
「Vue': '^ 2.6.0' 、 // 2.6.xバージョンと互換性がある
```

### 调试技巧

```javascript
// 1.依存ロードステータスのチェック
Console.log('依存状态:',雑多encymanager.getDependencyStats())

// 2.特定のプラグインの依存関係を確認する
コンソール.log

// 3.依存注入器をチェックする
コンストラクタインジェクター = ただしだすin-cyloader.createDependencyInjector('my-plugin')
コンソール.log('使用可能な依存:', Object.keys(injector.getAll()))
```

## 总结

插件独立依赖管理系统提供了：

1. **完全独立**：插件依赖不再污染主项目
2. **灵活配置**：支持多种依赖类型和加载方式
3. **智能管理**：自动处理依赖解析、加载和缓存
4. **容错机制**：支持降级方案和错误恢复
5. **性能优化**：按需加载和智能缓存

通过这个系统，你可以：
- ✅ 开发完全独立的插件
- ✅ 避免依赖包污染主项目
- ✅ 支持插件间的依赖隔离
- ✅ 实现插件的热插拔和动态加载
- ✅ 提供更好的用户体验和开发体验

开始使用插件独立依赖管理，让你的插件系统更加模块化和可扩展！
