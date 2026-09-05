# 独立商城应用

此目录保留通过官方 `microi_itdos` 从母版导出并发布回读的独立应用包，不加入后端九个内置启动基础包。

`app.microi.job.json` 对应商城“任务调度”（StoreId `01KGH7BAR7X7S2MVM3QRSKEV0C`），拥有任务及日志菜单、表单和字段。修复这些资源时，必须同时更新这个独立应用；只同步 SaaS 初始化副本不能交付给存量用户。

`platform-schedule-job` 是当前平台基础包提供的共享管理接口，仍由 `app.microi.saas-engine` 单一托管。独立包不重复声明同一个 Managed ApiEngineKey。任务表单直接调用租户绑定的 `V8.Method.SaveScheduleJob`，以免业务 ApiEngineKey 被接口路由参数覆盖；使用 `RuntimeOnly` 能力，需要同时升级支持该能力的后端，旧节点会立即得到明确提示。

发布使用官方 `export-microi-store-package` 接口，从精确菜单/表母版导出，凭当前应用版本和包 SHA 做 CAS 持久发布，收口不可变版本快照，再按 HDFS 下载 SHA 回读。不得将包内测试任务或业务日志作为种子数据发布。
