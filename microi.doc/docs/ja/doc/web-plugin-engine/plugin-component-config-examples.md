# プラグインコンポーネント構成例

## 正しい設定フォーマット

### 1.プラグインコンポーネントの構成をテストする

#### TestHomeコンポーネント
```javascript
{
  "Name": "testHome",
  "Label": "测试首页",
  "Component": "DevComponent",
  "Config": {
    "DevComponentName": "test-plugin-TestHome",
    "DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
  }
}
```

#### テストカウンターコンポーネント
```javascript
{
  "Name": "testCounter",
  "Label": "测试计数器",
  "Component": "DevComponent",
  "Config": {
    "DevComponentName": "test-plugin-TestCounter",
    "DevComponentPath": "/plugins/test-plugin/components/TestCounter.vue"
  }
}
```

#### TestFormコンポーネント
```javascript
{
  "Name": "testForm",
  "Label": "测试表单",
  "Component": "DevComponent",
  "Config": {
    "DevComponentName": "test-plugin-TestForm",
    "DevComponentPath": "/plugins/test-plugin/components/TestForm.vue"
  }
}
```

### 2.プラグインコンポーネントの構成を実演する

#### デモコンポーネント
```javascript
{
  "Name": "demoComponent",
  "Label": "演示组件",
  "Component": "DevComponent",
  "Config": {
    "DevComponentName": "demo-plugin-DemoComponent",
    "DevComponentPath": "/plugins/demo-plugin/index.vue"
  }
}
```

## 重要な構成の説明

### 1. DevComponentName命名規則

- **フォーマット**：'プラグイン名-コンポーネント名'
- **例**：'Test-plugin-testhome '、 'demo
- **注意**：中国語は使用できません。英語とハイフンが必要です

### 2. DevComponentPathパスルール

#### Vue単一ファイルコンポーネント (.vue) の場合
```javascript
"DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
```

#### インライン定義コンポーネント (.js) の場合
```javascript
"DevComponentPath": "/plugins/demo-plugin/index.js"
```

### 3.コンポーネントタイプの説明

#### Vue単一ファイルコンポーネント
- ファイル拡張子:`.vue`
- 場所:`src/views/plugins/插件名/components/组件名.vue`
- 例:`test-plugin`のすべてのコンポーネント

#### インライン定義コンポーネント
- ファイル拡張子:`.js`
- 場所:`src/views/plugins/插件名/index.js`
- 例:`demo-plugin`のコンポーネント

## 一般的なエラーと解決策

### 1.コンポーネント名エラー
```javascript
// ❌ 错误：使用中文
"DevComponentName": "测试插件"

// ✅ 正确：使用英文和连字符
"DevComponentName": "test-plugin-TestHome"
```

### 2.パスエラー
```javascript
// ❌ 错误：路径不正确
"DevComponentPath": "/views/plugin/test-plugin/home"

// ✅ 正确：使用正确的插件路径
"DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
```

### 3.コンポーネントが存在しません
```javascript
// ❌ 错误：组件文件不存在
"DevComponentPath": "/plugins/test-plugin/components/NonExistent.vue"

// ✅ 正确：确保组件文件存在
"DevComponentPath": "/plugins/test-plugin/components/TestHome.vue"
```

## テスト手順

### 1.フィールドの設定
フォームフィールド設定にプラグインコンポーネントのフィールドを追加します

### 2.プラグインを有効にする
プラグイン管理ページでプラグインが有効になっていることを確認します

### 3.ページを更新する
ページを再ロードして設定を適用します

### 4.検査コンポーネント
コンポーネントが正しくレンダリングされているかどうかを確認します

## デバッグテクニック

### 1.ブラウザコンソールを確認する
- コンポーネントのインポートエラーがあるかどうかを確認します
- コンポーネント登録ステータスの確認

### 2.構成の検証
- 確認`DevComponentName`フォーマットが正しい
- 確認`DevComponentPath`パスが存在します

### 3.プラグインのステータスを確認する
- プラグインが有効になっていることを確認する
- プラグインファイルの構造が正しいことを確認します

## まとめ

正しいプラグインコンポーネントの構成には、次のことが必要です

1.✅**正しいコンポネント名**: 英語とハイフンを使用します
2.✅**# 正しい # コンポ # インナーパス**: 実在するファイルへの
3.✅**# 正しい # コンポ # インナー # トイプ**:.vueと.jsファイルを区別します
4.✅**# プラグインが効果的になってません**: プラグインシステムが正常に動作していることを確認します

これらのルールで構成すると、プラグインコンポーネントが選択した領域で正常にレンダリングされます