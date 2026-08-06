# 基础应用升级资源

`Microi.Upgrade` 随程序集内置一套经过校验的基础应用数据包，保证老数据库和不通外网的客户服务器至少可以自动安装表单引擎、模块引擎和应用商城。

升级程序不需要任何环境变量：并行尝试从吾码官方数据库获取并完整校验全部资源；只有整组资源都有效时才使用在线最新版，否则整组回退到程序集内置版本，绝不混用两套资源。客户服务器无法访问外网时会自动使用当前后端程序集随版本发布的基线包。

新增升级步骤的 `Version` 必须按“正式进入发布包的先后顺序”全局单调递增，不能沿用最初开发分支的旧版本号。`sys_config.ServerVersion` 是迁移游标，而不是源码创建日期；若新步骤的版本号低于客户数据库已经记录的游标，该步骤会被永久跳过。同一补丁版本可使用第四段修订号（例如 `6.5.7.1`、`6.5.7.2`）表达严格执行顺序。每个步骤还必须保持幂等，以容忍执行成功后、推进版本号前的节点重启。

吾码官方应用源数据库不能执行第 13 步基础包回写，否则过期基线可能覆盖官方主库刚维护但尚未重新导出的商城数据。判断规则不是单独依赖租户名，而是必须同时满足“`Microi.net` 的 `LicenseService.HasPrivateKey()` 为真 + `OsClient=iTdos`”。官方签发私钥不会随客户 NuGet/发布包分发，因此客户即使也使用 `iTdos` 租户名仍会正常执行基础应用升级。该保护只跳过应用商城基线导入，其它结构升级照常执行。

应用安装器从 v1.2.9 起由后台任务按租户串行执行，并启用接口引擎分布式锁；导入器内部还会重试 MySQL 死锁。v1.2.10 起，仅当客户接口引擎菜单已有至少 2 个 `PageTabs` 时保留客户多 Tab 分类；空值、空数组或只有 1 个 Tab 时仍使用官方包配置。v1.4.0 起，微服务安装会按 `LegacyMenuUrls/LegacyComponentPaths` 迁移目标端菜单并写入稳定 `MsKey` URL，但在原开发服务器重复安装时保留仍可运行的原生组件菜单；声明携带源码时，包体校验和源码写入回读都必须成功。v1.5.0 起，Web、UniApp、微服务和平台应用统一以 `sys_microistore` 为主表，`mci_ai_app_file / mci_ai_app_version` 仅保存源码清单和构建版本；成功安装后会向官方商城累计去重安装次数。v1.6.4 起，微服务公有编译文件首次安装后会写入带 `OsClient` 前缀的真实稳定对象 Key，并同步运行清单的 `FilePathName/HdfsPath/PublishHdfsPath`，避免旧临时路径失效后回退到无 CORS 的静态域。v1.6.6 起，离线包显式选择 `StorageMode=db` 时会把公有编译文件写入同源运行清单，同时仍保留 HDFS 源码与编译资产，适配客户 FileServer/CDN 尚未统一的环境。发布器 v1.4.3 与商城基线 v6.5.6 起，`SourceZip` 只包含剥离 `source/` 包装目录后的真实源码并按原始字节保留图片、字体等二进制文件，`BuildZip` 则包含剥离 `build/ / dist/` 包装目录后的完整真实运行资产；发布器 v1.4.4 对尚未迁移出真实 dist 元数据的历史应用仅保留 `BuildLog` 单入口兼容回退，避免生成空包。老库缺少全局 `DateNow` 时，平台接口使用局部 `System.DateTime.Now` 回退，不会覆盖客户自定义的全局 V8。

## 更新内置基线

维护人员无需逐个手工复制数据包。同步器在 `.resource-sync-base/` 保存上一次“本地与官网完全一致”的共同基线，并以该基线执行三方合并：

- 只有官网修改：自动合并到本地。
- 只有本地修改：使用 `--publish` 写回官网。
- 两端修改不同 JSON 节点或不同 JS 可执行代码：合并后同时保留。V8 文件头的说明和 `Version` 作为发布元数据单独处理，不会再因两端正常独立升版而制造代码冲突；合成出第三份新正文时自动在两端最高版本上再升一版。
- 同一 JSON 节点或同一段 JS 可执行逻辑被改成不同内容：报告真实冲突并终止，不覆盖任意一端。JS 正文会依次尝试 Git 默认、histogram、patience、minimal 锚点算法，只有全部无法安全合并才要求人工处理。
- 发布官网时携带读取时的 SHA-256；若发布期间官网又被更新，服务端拒绝覆盖。发布完成后必须逐项回读一致，才推进共同基线。
- 任一 JSON 应用包内容需要写回官网时，`PackageInfo.Version` 必须高于官网当前 `AppVersion`；服务端写入后会在同一事务内回读校验包内容哈希和商城版本，避免包内版本落后于商城元数据。

只检查、拉取和三方合并时，在仓库根目录执行：

```powershell
node Microi.Server/Microi.Upgrade/Resource/refresh-resources.mjs
```

需要把本地合并结果发布到 iTdos 官网时，CI/无人值守环境优先通过环境变量注入令牌，不得写入仓库：

```powershell
$env:MICROI_UPGRADE_RESOURCE_TOKEN = '<iTdos 超级管理员 Token>'
node Microi.Server/Microi.Upgrade/Resource/refresh-resources.mjs --publish
Remove-Item Env:MICROI_UPGRADE_RESOURCE_TOKEN
```

本地执行一键发布时，同步器默认安全复用工作区中已配置并登录的 `microi_itdos` MCP，通过同一个官方接口引擎完成六项资源读取、三方合并、`PublishBatch` 和发布后回读；不会出现“HTTP 读一份、MCP 写另一份”的事实源分叉。它会严格校验 MCP 必须绑定 `https://api.itdos.com + iTdos`，并继续保留固定资源白名单、官网 SHA 乐观锁及发布后回读校验；同步器不会读取、打印或写入 MCP Token。Token 文件按 `ApiBase|OsClient|OsClientType|OsClientNetwork` 四段精确身份读取，即使后两段为空也保留分隔符，避免误用可能已过期的旧版兼容键；签名失效时由 VS Code SecretStorage 恢复代理重新登录并原子写回。恢复代理通过 `onStartupFinished` 确定性启动，避免大型工作区的递归 `workspaceContains` 扫描超时后无人处理恢复请求。可以用 `MICROI_UPGRADE_RESOURCE_MCP_CONFIG` 显式指定 MCP 配置文件，默认从当前工作区向上查找 `.mcp.json`、`.vscode/mcp.json` 或 `.cursor/mcp.json`；若配置仍指向已安装的旧插件目录，发布器会自动选择同目录下版本更高的已安装插件。CI 没有 MCP 配置但注入了 `MICROI_UPGRADE_RESOURCE_TOKEN` 时，`auto` 模式才回退到官网 HTTP；也可用 `MICROI_UPGRADE_RESOURCE_TRANSPORT=mcp|http|auto` 显式固定传输方式。如果本机既没有可用的官方 MCP 登录态，也没有环境变量令牌，发布仍会中止并给出明确提示。

`Microi一键编译发布.sh` 的后端编译/发布模式会在 `dotnet build` 前自动执行同一条 `--publish` 命令。因此，本地资源或官网资源任一侧更新后，下一次后端发布都会先完成合并、官网写回（如有）、回读和基线更新；冲突、令牌缺失、并发哈希变化或回读不一致都会阻止后端发布。

脚本只允许处理以下六个固定资源：

1. `import-package.js`
2. `ai-app-publish-store.js`
3. `official-resource-api.js`（`get-microi-upgrade-resource` 自身）
4. `app.microi.form-engine.json`
5. `app.microi.module-engine.json`
6. `app.microi.store.json`

官方接口：

```text
https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos&Name={resourceName}
```

首次部署同步机制时，必须先人工确认六项本地资源与官网完全一致，再执行一次：

```powershell
node Microi.Server/Microi.Upgrade/Resource/refresh-resources.mjs --initialize-base
```

该命令不会覆盖任何资源；任一项不一致都会拒绝建立基线。`--synchronize-local` 仅用于让 `app.microi.store.json` 内嵌的导入器、发布器、构建器与三个独立 JS 文件保持一致，不会访问或修改官网。正式同步会把这些独立源码和商城包内嵌代码视为同一组逻辑副本：说明文字、换行、独立升版或不同可执行代码段的修改可自动合并，只有同一段可执行逻辑被改成不同实现时才阻止发布。`ai-app-build.js` 仍是随服务器发布的本地事实源，不扩入官网六项资源白名单。

刷新后必须构建 `Microi.Upgrade`，确认五个运行期升级资源及随服务器发布的 `ai-app-build.js` 均已作为 `EmbeddedResource` 写入程序集；`official-resource-api.js` 是仅供维护发布链路同步官网接口的源码，不写入运行程序集。发布包运行时不依赖这些源码文件存在。

刷新脚本会拒绝低于 v1.9.1、缺少租户接口引擎所有权不可逆保护、接口引擎资源基线或“无商城标识时跳过安装计数”、MySQL 宽表行宽溢出时的非索引 `varchar` 行外文本回退、可信批量小包单事务、安装统计 JSON 字符串响应解析、接口引擎写后回读、统一应用商城、断点复用、微服务公有 HDFS 稳定路径、DB 运行产物兜底、Jint 安全清理、原生菜单保护、源码校验或安装统计能力的导入器；也会拒绝低于 v1.6.0 的发布器，以及低于 v7.0.13、缺少官方平台应用过滤、自适应安全分片、子安装失败详情透传、批量安装后台检查点、可信后台自举保护或严格 `SourceZip / BuildZip` 资产边界的商城基线。接口引擎资源升级以目标端安装记录中的摘要为共同基线：`Managed` 仅在本地未偏离基线时更新，`CreateIfMissing` 首次创建后归租户维护且后续不得改回 `Managed` 接管；检测到客户修改即整包回滚并报告冲突，不静默覆盖。行宽回退只在 MySQL 明确返回 65,535 字节上限且字段不参与索引时触发，类型覆盖写入共享后台任务 checkpoint；普通异常和索引字段继续失败关闭。批量引擎在兼容尚未部署后端可信调用修复的节点时使用 `StopHttp=0`，但必须同时校验由 HTTP 控制器剥离的 `_TrustedServerInvocation`、任务 Id、任务信封和正数 fencing token；普通 HTTP 仍然失败关闭。“全部安装/更新”固定只规划 `ApplicationType=Platform` 的官方平台应用；小型官方包以一个应用一个事务完成，超过字段、表、资产或随包数据安全阈值的包继续使用内部 checkpoint 分片。
