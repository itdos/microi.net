# 源码本地运行-前端

## 视频教程
>* 待重新录制上传
>* 历史视频教程：[https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

## 下载源码与开发工具
* 使用git工具从开源地址拉取最新代码：[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* 下载并安装vs code：[https://code.visualstudio.com/](https://code.visualstudio.com/)
* 下载并安装nvm：[https://nvm.uihtm.com/](https://nvm.uihtm.com/)，MacBook安装nvm：[https://blog.csdn.net/qq973702/article/details/143637128](https://blog.csdn.net/qq973702/article/details/143637128)
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

## 运行PC端vue2传统界面源码
* 在欢迎页打开Microi吾码开源版【/microi.web/】文件夹
* 查看【/microi.web/README.md】文件，执行几条npm常规命令后即可跑起来
```cmd
nvm use 14【注意一定需要14】
nrm use taobao
npm install
npm run dev
```

## 运行PC端vue3仿webos操作系统界面（编译版）
* 进入【/microi.webos/】文件夹
* 执行命令#http-server即可跑起来

## 运行PC端vue3仿webos操作系统界面源码（个人版）
* 在欢迎页打开Microi吾码个人版【/microi.vue3.os/】文件夹
* 查看【/microi.vue3.os/说明.txt】文件，执行几条npm常规命令后即可跑起来
```cmd
#nvm use 18【建议使用18，与我们开发团队node版本一致】
#nrm use taobao
#npm install
#npm run dev
```

## 运行移动端vue3 uniapp源码（基于图鸟UI）
* 进入【/microi.vue3.tuniao/】文件夹
* 执行#npm install后，使用小程序调试工具即可打开

