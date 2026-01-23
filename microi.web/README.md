## 使项目跑起来

>* 使用 node.js 18、20
>* nvm use 14。如何安装 nvm：https://blog.csdn.net/qq973702/article/details/143821242
>* npm install nrm -g
>* nrm use taobao (📌 备注：如果 taobao 不行用 nrm use npmMirror)
>* npm install
>* npm run dev

## 若以上步骤出现 timeout 等未知错误，可以尝试下以下步骤：

>* 删除 node_modules
>* 删除 package-lock.json
>* 执行# npm cache clean --force
>* 重新执行#npm install 安装环境步骤

## 📌 切换后端接口地址

>* 在 src 目录创建 config.json 文件（修改后刷新浏览器即可生效，无需重启服务），内容如下：
```json
{
  "ApiBaseDev": "https://api.itdos.com"
}
```

## 访问系统
```
http://localhost:1988/?OsClient=iTdos
```

## 定制组件目录
>* [/src/views/custom/]为所有客户的定制组件，理论上不用上传到仓库，用户可主动删除里面的所有文件。

## 格式化所有代码
```shell
npx prettier --write src/
```