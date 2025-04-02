# 说明

## 请使用 node 18
```bash
nvm use 18
```

### 本地运行

```bash
# 安装依赖
npm install

# 本地浏览
npm run docs:dev
```

### 发布部署

```bash
npm run docs:build
```

构建完成后，在 `docs/.vitepress/dist` 目录下，会生成静态文件，可以直接部署到服务器上。