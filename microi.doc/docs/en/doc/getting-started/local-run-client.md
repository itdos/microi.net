# 🌐Source code local operation-front end

> **Running the MicroiI front-end project in a local environment**

---

## 🎥Video tutorial

- To be re-recorded and uploaded
- Historical video tutorial: [https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

---

## 📦Download source code and development tools

- Use Git to pull the latest code from an open source address:[Gitee repository](https://gitee.com/ITdos/microi.net)
- Download and install [VS Code](https://code.visualstudio.com/)
- Download and install nvm:[Windows version](https://nvm.uihtm.com/) | [MacBook version](https://blog.csdn.net/qq973702/article/details/143637128)
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

## ▶Running front-end source code

1. Open in VS Code`/Microi.Client/`Folder
2. View`/Microi.Client/README.md`, execute the following command:

```bash
nvm use 20
nrm use taobao
npm install
npm run dev
```

---

## 🐳Local compilation and publishing to a Docker image

1. Install Docker Desktop (https://www.docker.com/products/docker-desktop/)
2. Execution`npm run build`Command Packaging
3. Enter`bin/Release/`directory, executing`publish-demo.sh`Script (remember to modify the configuration inside first)