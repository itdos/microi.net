<!-- 文档 -->

# 文档

## 说明
- 中文文档源码在 [microi-doc](https://gitee.com/GFCM_lisaisai/micori-doc)，采用 [VitePress](https://vitepress.vuejs.org/) 开发。
- 如发现文档有误，欢迎提交 [Pull requests](https://gitee.com/GFCM_lisaisai/micori-doc/pulls) 帮助我们改进。

### 本地运行文档

- 如果需要本地运行文档，只需要将文档拉取到本地进行运行即可。

:::warning
Node.js 版本推荐安装 **18+** 以上，版本过低依赖包可能安装失败。

默认使用 pnpm 作为安装依赖包工具，使用 yarn、npm 没有 lock 可能会安装到最新版依赖。
:::

```bash
# 拉取代码
git clone https://gitee.com/GFCM_lisaisai/micori-doc.git

# 安装依赖
pnpm install

# 运行文档
pnpm docs:dev

# 打包文档
pnpm docs:build
```

