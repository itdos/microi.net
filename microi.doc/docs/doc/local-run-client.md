# 🌐 源码本地运行 - 前端

> **在本地环境中运行 Microi吾码前端项目**

---

## 🎥 视频教程

- 待重新录制上传
- 历史视频教程：[https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

---

## 📦 下载源码与开发工具

- 使用 Git 从开源地址拉取最新代码：[Gitee 仓库](https://gitee.com/ITdos/microi.net)
- 下载并安装 [VS Code](https://code.visualstudio.com/)
- 下载并安装 nvm：[Windows 版](https://nvm.uihtm.com/) | [MacBook 版](https://blog.csdn.net/qq973702/article/details/143637128)
```shell
# 记住安装路径，一路往下安装即可
# 打开 nvm安装路径（我的是【D:\Users\Administrator\AppData\Local\nvm】），找到 settings.txt 文件，新增2行配置
node_mirror: https://npmmirror.com/mirrors/node/
npm_mirror: https://npmmirror.com/mirrors/npm/
# 打开cmd窗口,执行
nvm list available
nvm install 18
nvm install 14
# 常用命令
nvm ls
nvm use 18
node -v
```

---

## ▶️ 运行前端源码

1. 在 VS Code 打开 `/microi.web/` 文件夹
2. 查看 `/microi.web/README.md`，执行以下命令：

```bash
nvm use 20
nrm use taobao
npm install
npm run dev
```

---

## 🐳 本地编译发布到 Docker 镜像

1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. 执行 `npm run build` 命令打包
3. 进入 `bin/Release/` 目录，执行 `publish-demo.sh` 脚本（记得先修改里面的配置）