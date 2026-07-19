# 基础应用升级资源

`Microi.Upgrade` 随程序集内置一套经过校验的基础应用数据包，保证老数据库和不通外网的客户服务器至少可以自动安装表单引擎、模块引擎和应用商城。

升级程序不需要任何环境变量：并行尝试从吾码官方数据库获取并完整校验全部资源；只有整组资源都有效时才使用在线最新版，否则整组回退到程序集内置版本，绝不混用两套资源。客户服务器无法访问外网时会自动使用当前后端程序集随版本发布的基线包。

吾码官方应用源数据库不能执行第 13 步基础包回写，否则过期基线可能覆盖官方主库刚维护但尚未重新导出的商城数据。判断规则不是单独依赖租户名，而是必须同时满足“`Microi.net` 的 `LicenseService.HasPrivateKey()` 为真 + `OsClient=iTdos`”。官方签发私钥不会随客户 NuGet/发布包分发，因此客户即使也使用 `iTdos` 租户名仍会正常执行基础应用升级。该保护只跳过应用商城基线导入，其它结构升级照常执行。

应用安装器从 v1.2.9 起由后台任务按租户串行执行，并启用接口引擎分布式锁；导入器内部还会重试 MySQL 死锁。v1.2.10 起，仅当客户接口引擎菜单已有至少 2 个 `PageTabs` 时保留客户多 Tab 分类；空值、空数组或只有 1 个 Tab 时仍使用官方包配置。v1.4.0 起，微服务安装会按 `LegacyMenuUrls/LegacyComponentPaths` 迁移目标端菜单并写入稳定 `MsKey` URL，但在原开发服务器重复安装时保留仍可运行的原生组件菜单；声明携带源码时，包体校验和源码写入回读都必须成功。v1.5.0 起，Web、UniApp、微服务和平台应用统一以 `sys_microistore` 为主表，`mci_ai_app_file / mci_ai_app_version` 仅保存源码清单和构建版本；成功安装后会向官方商城累计去重安装次数。发布器 v1.4.3 与商城基线 v6.5.6 起，`SourceZip` 只包含剥离 `source/` 包装目录后的真实源码并按原始字节保留图片、字体等二进制文件，`BuildZip` 则包含剥离 `build/ / dist/` 包装目录后的完整真实运行资产；发布器 v1.4.4 对尚未迁移出真实 dist 元数据的历史应用仅保留 `BuildLog` 单入口兼容回退，避免生成空包。老库缺少全局 `DateNow` 时，平台接口使用局部 `System.DateTime.Now` 回退，不会覆盖客户自定义的全局 V8。

## 更新内置基线

维护人员无需逐个手工复制数据包。在仓库根目录执行：

```powershell
node Microi.Server/Microi.Upgrade/Resource/refresh-resources.mjs
```

脚本会从官方白名单接口下载、校验并一次性刷新以下五个资源：

1. `import-package.js`
2. `ai-app-publish-store.js`
3. `app.microi.form-engine.json`
4. `app.microi.module-engine.json`
5. `app.microi.store.json`

官方接口：

```text
https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos&Name={resourceName}
```

刷新后必须构建 `Microi.Upgrade`，确认上述五个在线资源及随服务器发布的 `ai-app-build.js` 均已作为 `EmbeddedResource` 写入程序集；发布包运行时不依赖这些源码文件存在。

刷新脚本会拒绝低于 v1.6.3、缺少统一应用商城、断点复用、Jint 安全清理、原生菜单保护、源码校验或安装统计能力的导入器；也会拒绝低于 v1.4.4 的发布器，以及低于 v6.5.8 或缺少严格 `SourceZip / BuildZip` 资产边界的商城基线，避免维护命令把已修复的本地资源降级。
