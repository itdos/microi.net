## 使项目跑起来
>* 使用 nodejs v14.21.3、 npm v6.14.18。node14下载地址：https://nodejs.org/download/release/latest-v14.x/
>* nvm use 14。如何安装nvm：https://blog.csdn.net/qq973702/article/details/143821242
>* npm install nrm -g
>* nrm use taobao (📌备注：如果taobao不行用 nrm use npmMirror)
>* npm install
>* npm run dev

## 若以上步骤出现其它错误，可以尝试下以下步骤：
>* 删除node_modules
>* 删除package-lock.json
>* 执行# npm cache clean --force
>* 重新执行#npm install安装环境步骤


## 📌切换后端接口地址方式1
>* 在根目录创建localConfig.json文件
>* 内容如下：
```js
{
    apiBaseUrl : '你的后端接口地址，如：https://locahost:7266'
}
```

## 📌切换后端接口地址方式2
>* 在根目录创建.env文件
>* 内容如下：
```js
VITE_APP_API_BASE_URL=你的后端接口地址
```

>* 访问地址：http://localhost:2009/?OsClient=test

