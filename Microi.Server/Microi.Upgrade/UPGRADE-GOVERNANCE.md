# Microi.Upgrade 必要启动边界与审计

最后审计：2026-10-22

## 必要升级范围

本项目只负责用户能正常启动、使用原有账号登录、打开应用商城，并执行商城安装和更新所必需的物理兼容与恢复协议。SSO、AI、消息通知、备份、翻译、OCR、工作流及其它可选平台应用均由用户在商城手动安装或更新。

自动升级不能把“平台官方应用”当成“每个租户必须安装的启动依赖”。也不能因为租户已经安装某项可选应用，就在框架启动时偷偷更新该应用。

MQTT 开关空值语义属于一次性核心协议兼容例外：旧版空值表示关闭，直接改为空值开启会误开放旧租户。升级链只把旧 `sys_osclients.MqttEnable` 空值/空白固定为 `0` 并强回读，再推进版本门；不安装 MQTT 应用、不搬迁凭据、不覆盖已明确设置的 `0/1`。

## 本次审计结果

| 范围 | 当前归属与行为 |
| --- | --- |
| 历史 `01`–`12`、`14`–`20`、`22`–`36` 迁移 | 从生产项目移出，历史算法仅存于 `Microi.Tests/Fixtures/RetiredUpgrade`，不进入发布程序集或启动清单 |
| `13-UpgradeAppStore` | 只恢复最小启动接口及商城入口；不再下载、安装或更新完整官方应用集合 |
| `21-UpgradeBackgroundTask` | 保留商城安装/更新所需持久后台任务、共享租约与重试协议的物理兼容 |
| `ApplicationAssetIdentityCompatibility` | 只兼容已知 SQL Server 运行资产唯一索引，不创建完整应用发布器或附带可选业务结构 |
| `Upgrade` | 两个必要兼容基线：`7.6.15.0` 为最小启动/商城恢复，`7.6.16.0` 为一次性 MQTT 空开关协议迁移；均使用前向版本门、共享租约、幂等、强回读与失败不推进 |
| `TenantUpgradeCoordinator` | 当前版本只检查必要物理协议、启动依赖及真实商城入口；可选应用不参与启动就绪判定 |
| 官方应用资源 | 完整包及其源码、生成器、测试、同步基线移至 `Microi.Server/OfficialApplications/Resource` |

生产程序集只嵌入两个资源：`import-package.js` 与 `app.microi.bootstrap.json`。图标用于生成包，不作为第三个程序集资源。`OfficialApiSources/sso_http_oidc_token.js` 等完整官方接口源码不再位于本项目。

## 最小启动包

`app.microi.bootstrap` 是从完整官方资源投影生成的恢复包，不能独立手工维护。

- 26 个启动、密码登录、会话、菜单和商城协议接口；租户 Hook 继续遵守 `CreateIfMissing`。
- 21 张核心表的元数据及运行时实体读取必需的物理列；不携带租户配置值或业务种子数据。
- 商城菜单及其必要父菜单；运行路由仅 `/marketplace`。
- 商城入口的真实编译字节；不携带可选应用菜单、计划任务或整套官方应用安装清单。

生成和一致性检查：

```sh
node Microi.Server/OfficialApplications/Resource/build-bootstrap-package.mjs
node Microi.Server/OfficialApplications/Resource/build-bootstrap-package.mjs --check
```

完整官方应用仍由该资源目录的同步器维护和发布；`.resource-sync-base` 只能由同步器推进。移动源码目录不改变既有包的拥有者、版本或官方远端状态。

## 核心接口职责核对（2026-10-22）

`platform-sys-config` 的官方唯一拥有者是 `app.microi.saas-engine`，不是 `app.microi.sys-config`。启动包投影它的完整源码及策略，不安装完整 SaaS 包。新增 License 两个只读接口仍属于可选 SaaS 管理能力，不能加入 `bootstrapEngines`。

| 启动接口（覆盖全部 26 个 Key） | V8 与可信内核边界 |
| --- | --- |
| `platform-sys-config` | v1.1.0 的配置读取、错误分类、响应拼装在 V8；C# 仅提供秘密投影、公钥和发行类型。旧门面仅用于旧二进制兼容，不能用新原子执行失败触发回退 |
| `platform-os-client-by-domain` | 跨租户主库域名精确匹配、冲突与默认租户选择仍在可信边界；不向 V8 暴露 SaaS 行或连接串 |
| `platform-lang-bundle`、`platform-login-wallpapers` | 当前租户词条缓存读取、固定公开壁纸投影；壁纸查询受 200 条上限约束，不开放整表匿名读取 |
| `platform-current-user`、`platform-sys-user-public-info` | V8 使用当前用户或有界 FormEngine 查询组装公开数据；不能回传密码材料 |
| `platform-private-file-url` | V8 参数/Hook 编排；对象引用、菜单/表/行/字段权限和短链签发在可信原子 |
| `microi-init` | V8 聚合配置、用户、菜单；后端只负责原始 Token 重验与授权菜单树，不接受伪造用户对象 |
| `platform-service-health` | V8 固定健康响应，后端只读程序集版本；不依赖业务查询 |
| `platform-sys-user-session` | V8 历史路由到动作映射；密码校验、验证码消费、DiyToken 签发/续签/吊销在会话内核 |
| `platform_auth_login_event` | V8 审计及登录 Hook 调用，不暴露凭据 |
| `platform-sys-menu` | V8 动作与 Hook 编排；现有目录原子保留权威角色过滤、树与权限缓存一致性。属于历史较宽适配层，不能将新增普通业务继续塞入它 |
| `platform-background-task` | V8 动作白名单及公开任务摘要；任务所有者、共享租约、幂等和执行器保持内核能力 |
| `platform-marketplace-source` | V8 默认值、Hook、审计；认证源连接与凭据保存/使用留在可信运行时 |
| `platform-tenant-system-settings` | V8 非秘密设置 CRUD；敏感 Key、加密、一次性验证和身份复核留在可信运行时 |
| `get-microi-store`、`get-microi-store-model`、`get-microi-store-versions` | V8 分页、选择、查询和响应拼装；文件访问使用已有受限原子 |
| `get-microi-store-legacy-route` | V8 兼容分发至商城接口，不复制业务实现 |
| `import-microi-store-package`、`bulk-import-microi-store-packages`、`microi-store-package-storage` | V8 包校验、资源策略、安装编排、进度与存储指针；物理/存储原子和共享任务协议不搬到 Controller |
| `platform-runtime-custom-hook`、`platform_auth_login_hook`、`platform-marketplace-source-hook`、`platform-system-settings-custom-hook` | 4 个租户扩展点，`CreateIfMissing`，不覆盖现有租户代码 |

该核对不是“全部 Controller 业务已经迁完”的证明。会话、系统目录等历史适配器仍存在，后续拆分应逐项保持协议与权限回归；本次不以删除兼容代码破坏旧客户端。新增业务不得再添加完整响应型 V8 门面。路由的执行错误、停用、StopHttp、权限失败不能被当作“引擎不存在”。

## 启动与恢复顺序

1. 读取当前租户版本，检查登录和商城所需物理兼容。
2. 缺少必要能力时取得该租户的共享租约，租约内重新读取版本和实际资源状态。
3. 修复必要物理协议、启动接口和缺失或损坏的商城入口。
4. 回读接口 Key、启用/HTTP 标志、必要路由，以及商城菜单、服务和入口资产的实际字节、长度与 SHA-256。
5. 只有全部成功才前向推进版本。失败记录准确阶段并保留版本，后续重试从真实状态继续。

已有更高版本且必要协议完整的接口、商城服务保持原样，不以旧内置包降级。`CreateIfMissing` Hook 已存在时，包括禁用或软删除的既有记录，均保持原样。当前版本且恢复证明完整时不重放历史迁移、可选资源或安装操作。

恢复证明不能只看“菜单存在”或资产摘要字符串：编译入口必须存在有效 `index.html`，每个资产路径唯一且安全，实际 Base64 字节与声明大小和 SHA-256 一致。恢复与物理索引兼容分别报告结果，不能把商城恢复误报成索引修复。

## 升级点准入与验收

新增生产升级点必须证明该协议在商城运行前不可缺少，且商城尚不能自行恢复；普通元数据与业务资源进入所属官方应用包。禁止恢复不断增长的历史启动链。

每次变更至少检查：生产程序集类型与嵌入资源边界、生成包的菜单/接口/物理闭包、不同历史版本直升、已完整当前版本零写入、更高应用版本不降级、租约丢失与失败不推进、损坏资产恢复，以及隔离 MySQL/SQL Server 与双节点回归。完整官方包的业务回归继续执行，但其验证代码和源码不进入生产自动升级程序集。

平台源码测试、NuGet、Docker、官方应用发布、客户租户安装和服务器部署是分别验收的边界。本项目不会因为框架正式发布而自动部署客户服务器或更新可选应用。

## 2026-10-22 交付回执

- 源码候选：公开根仓 `0c7fd7886`；内部授权实现仓 `4984b6d`。对应原 `master` 分支已推送并独立回读。
- 官方 MCP 坐标：`https://api.microi.net` / `iTdos`。14 项资源对账仅 SaaS 包需要发布；未执行客户安装、子租户批量更新或容器重启。
- `app.microi.saas-engine`：`v8.4.37`，4,300,430 字节，SHA-256 `bd2dd69bccfb7c5c6922b23ebc5d16acf6ce5602ff86f5620e0db5630fce3c91`。发布后的 176 项在线引擎投影已回读，12 项租户 Hook 按 `CreateIfMissing` 保留。
- 在线 `platform-sys-config v1.1.0` 实际调用 `Code=1`；未返回 `ServerPrivateSettings`。旧后端仍使用脚本内受控兼容分支，不能据此宣称新后端原子已部署。
- 两个 License 引擎 `v1.0.0` 的地址、启用和登录限制已回读。当前线上 `v8.6.2` 二进制缺少新原子，调用返回 `LicenseReadAtomsUnavailable`；需要后续后端制品发布和部署才能完成功能验收。
- 两组相关 .NET 回归分别 57/57、81/81 通过（有重叠，不累加）；新 JS 行为用例 6/6、配套源码/包闭包用例 13/13、14 项资源契约和启动包一致性通过。实际 Jint 测试验证公开投影和 CLR 原子互操作。
- 中文文档与 Skill 已同步；整站 `docs:build` 被既有 `microi-deployment/references/deployment-matrix.md` 的工作区/打包插件哈希差异拦截，未发布官网。未发布 NuGet/Docker，未回测客户浏览器，不能把源码测试或包发布视为这些层次已通过。
