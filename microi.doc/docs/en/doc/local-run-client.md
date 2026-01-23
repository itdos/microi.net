# Source code local operation-front end

## Video Tutorial
> * To be re-recorded and uploaded
> * history video tutorial:[https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

## Download source code and development tools
* Use git tool to pull the latest code from open source address:[https://gitee.com/ITdos/microi.net](https://gitee.com/ITdos/microi.net)
* Download and install vs code:[https://code.visualstudio.com/](https://code.visualstudio.com/)
* Download and install nvm:[https://nvm.uihtm.com/](https://nvm.uihtm.com/),MacBook install nvm:[https://blog.csdn.net/qq973702/article/details/143637128](https://blog.csdn.net/qq973702/article/details/143637128)
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

## Run PC vue2 traditional interface source code
* On the welcome page, open the Microi code open source version [/microi.web/] folder.
* Check the [/microi.web/README.md] file and run after executing several npm general commands.
```cmd
nvm use 14【注意一定需要14】
nrm use taobao
npm install
npm run dev
```

## Run PC-side vue3 to imitate webos operating system interface (compiled version)
* Go to [/microi.webos/] folder
* Execute command# http-server to run

## Run PC-side vue3 imitation webos operating system interface source code (personal version)
* Open the Microi Code Personal Edition [/microi.vue3. OS/] folder on the welcome page
* Check the [/microi.vue3. OS/description. txt] file and run after executing several npm general commands
```cmd
#nvm use 18【建议使用18，与我们开发团队node版本一致】
#nrm use taobao
#npm install
#npm run dev
```

## Run the mobile terminal vue3 uniapp source code (based on the figure bird UI)
* Enter the [/microi.vue3.tuniao/] folder
* After executing the# npm install, use the applet debugging tool to open it.

