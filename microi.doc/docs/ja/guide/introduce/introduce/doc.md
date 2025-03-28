<! -- ドキュメント -->

# ドキュメント

## 説明
- 中国語文書のソースコードは [microi-doc](https://gitee.com/ITdos/microi.net/tree/master/microi.doc) で、 [VitePress](https://vitepress.vuejs.org/) で開発された。
- 文書に誤りが見つかった場合は、改善に役立つ「 https://gitee.com/ITdos/microi.net/pulls 」を提出してください。

### ローカル実行ドキュメント

- ドキュメントをローカルで実行する必要がある場合は、ドキュメントをローカルにプルして実行するだけです。

::: Warning
Node.jsバージョンは **18** 以上のインストールを推奨し、バージョンが低すぎる依存パッケージのインストールに失敗する可能性があります。

Pnpmはデフォルトで依存パッケージのインストールツールとして使用され、yarn、npmを使用してlockがないと最新バージョンの依存にインストールされる可能性があります。
:::

```bash
# 拉取代码
git clone https://gitee.com/ITdos/microi.net.git

# 安装依赖
pnpm install

# 运行文档
pnpm docs:dev

# 打包文档
pnpm docs:build
```

