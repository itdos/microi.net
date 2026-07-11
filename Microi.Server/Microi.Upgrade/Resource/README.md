# 基础应用升级资源

`13-UpgradeAppStore.cs` 不再携带或读取本地应用数据包。每次执行升级时，会先从吾码官方匿名接口一次性下载并校验以下 5 个最新资源：

1. `import-package.js`：接口引擎 `import-microi-store-package` 的当前代码。
2. `ai-app-publish-store.js`：接口引擎 `ai_app_publish_store` 的当前代码。
3. `app.microi.form-engine.json`：应用商城中 `AppId=app.microi.form-engine` 的当前数据包。
4. `app.microi.module-engine.json`：应用商城中 `AppId=app.microi.module-engine` 的当前数据包。
5. `app.microi.store.json`：应用商城中 `AppId=app.microi.store` 的当前数据包。

官方接口固定为 `https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos`，并且只允许匿名读取上述白名单资源。它不接受任意接口 Key、表名或查询条件。

只有 5 个资源全部下载并校验成功后，升级程序才会修改目标租户数据库。任意资源获取失败都会终止本次升级，不再使用本地旧文件兜底，也不会更新服务器版本号。

日常维护只需更新 iTdos 官方数据库中的两个接口引擎代码或三个应用商城数据包；不需要再复制文件到 `Microi.Upgrade/Resource`。
