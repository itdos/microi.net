# 注意

## 基础应用升级资源读取顺序

`13-UpgradeAppStore.cs` 会优先从官方远端接口获取以下资源；如果远端不可用（例如离线服务器、无外网、接口失败），才使用本目录内置资源兜底。内置资源只作为离线兜底，不应被当成长期最新事实源。

导入顺序必须保持：

1. `import-package.js`：先更新应用商城导入接口引擎 `import-microi-store-package`。
2. `app.microi.form-engine.json`：再安装/更新表单引擎基础包。
3. `app.microi.module-engine.json`：再安装/更新模块引擎基础包。
4. `app.microi.store.json`：最后安装/更新应用商城包。

应用商城包通常会依赖前面的基础元数据和导入接口能力，不要随意调换顺序。

## 当修改了【import-package.js】后
>* 一定要去【os.itdos.com】同步接口引擎【import-microi-store-package】，然后应用商城重新打包【应用商城】，复制数据包，覆盖到【app.microi.store.json】
>* 然后修改【13-UpgradeAppStore.cs】中的【Version】为最新版本号

>* 【app.microi.store.json】对应应用商城中的【应用商城】这个应用的数据包内容
>* 【app.microi.module-engine.json】对应应用商城中的【模块引擎】这个应用的数据包内容
>* 【app.microi.form-engine.json】对应应用商城中的【表单引擎】这个应用的数据包内容
>* 【import-package.js】对应接口引擎中的【import-microi-store-package】这个接口引擎代码
