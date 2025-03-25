<!-- 文档 -->


ドキュメント説明- 中文文档源码在 [microi-doc](https://gitee.com/ITdos/microi.net/tree/master/microi.doc)，采用 [VitePress](https://vitepress.vuejs.org/) 开发。
- 如发现文档有误，欢迎提交 [Pull requests](https://gitee.com/ITdos/microi.net/pulls) 帮助我们改进。

ローカル実行ドキュメント- 如果需要本地运行文档，只需要将文档拉取到本地进行运行即可。

::: Warning
Node.jsバージョンは ** 18 ** 以上のインストールを推奨し、バージョンが低すぎる依存パッケージのインストールに失敗する可能性があります。

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


