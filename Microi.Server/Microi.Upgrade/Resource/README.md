# 注意

## 当修改了【import-package.js】后
>* 一定要去【os.itdos.com】同步接口引擎【import-microi-store-package】，然后应用商城重新打包【应用商城】，复制数据包，覆盖到【app.microi.store.json】
>* 然后修改【13-UpgradeAppStore.cs】中的【Version】为最新版本号

>* 【app.microi.store.json】对应应用商城中的【应用商城】这个应用的数据包内容
>* 【app.microi.module-engine.json】对应应用商城中的【模块引擎】这个应用的数据包内容
>* 【app.microi.form-engine.json】对应应用商城中的【表单引擎】这个应用的数据包内容
>* 【import-package.js】对应接口引擎中的【import-microi-store-package】这个接口引擎代码
