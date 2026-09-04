# Microi吾码官网与官方文档

Microi吾码是**开源 AI 开发框架**，融合 30+ 成熟引擎、AI 低代码、微服务与 V8 引擎；在平台能力高度复用的典型业务场景中，让 AI 开发更省 Token 10 倍+、速度提升 10 倍+，开箱即用、更快交付。

## 运行说明

## 请使用 node 18/20 版本运行
```bash
nvm use 18
```

## 本地运行

```bash
# 安装依赖
npm install

# 本地浏览
npm run dev
```

## 发布部署

```bash
npm run build
```

构建完成后，在 `docs/.vitepress/dist` 目录下，会生成静态文件，可以直接部署到服务器上。

## 执行翻译
```
node translate.mjs
```
