<!-- 文档 -->


DocumentationDescription- 中文文档源码在 [microi-doc](https://gitee.com/ITdos/microi.net/tree/master/microi.doc)，采用 [VitePress](https://vitepress.vuejs.org/) 开发。
- 如发现文档有误，欢迎提交 [Pull requests](https://gitee.com/ITdos/microi.net/pulls) 帮助我们改进。

Run the document locally- 如果需要本地运行文档，只需要将文档拉取到本地进行运行即可。

:::warning
If the Node.js version is recommend to install **18** or later, the dependency package may fail to be installed if the version is too low.

By default, pnpm is used as the tool to install dependency packages. If you use yarn or npm without lock, the latest version of dependency may be installed.
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


