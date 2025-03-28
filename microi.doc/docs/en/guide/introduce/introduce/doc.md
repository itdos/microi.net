<! -- Documentation -->

# Documentation

## Description
- Chinese document source code in [microi-doc](https://gitee.com/ITdos/microi.net/tree/master/microi.doc), using [VitePress](https://vitepress.vuejs.org/) development.
- If you find errors in the documentation, please submit [Pull requests](https://gitee.com/ITdos/microi.net/pulls) to help us improve.

### Run the document locally

- If you need to run the document locally, you only need to pull the document to the local run.

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

