# 热点目录：限定母版维护与应用升级材料

2026-10-25。本目录保留**准备材料及限定母版写入后的独立回读**。主任务已执行三表和单接口的母版维护，本子任务只读核验；本目录本身不复制或分流，平台与商城渠道由指定发布任务统一管理。主任务另有四个公有GLB的NAS暂存副本证据，不是本目录触发的复制或跨租户登记。`manifest.json` 是标准 MCP Manifest；上级的 `file-resource-manifest.mjs` 是生成器内部描述，不能直接当作 MCP Manifest 传入。

## 写入后独立回读

2026-10-25 21:29–21:32 北京时间，独立读取当前 iTdos 后确认：

| 表 | 真实 TableId | 业务字段 | 系统字段 | 业务行 |
| --- | --- | --- | --- | --- |
| mci_file_resource | 01M5SKVQRBMA7GTSAA2T0RP3ZT | 17 | 6 | 0 |
| mci_file_traffic_window | 01M5SKVSF4AVWQZXP5C8PF7T76 | 17 | 6 | 0 |
| mci_file_replica | 01M5SKVV0WRAWPWGGCKDP6G3JA | 15 | 6 | 0 |

49 个业务字段的名称、类型和归属逐项匹配，含系统字段共 67 条元数据；`Readonly=1` 通过管理员字段投影回读确认，仍只是 UI 约束。三表 `ReadPrimary=1`、Banner 和空指标配置已回读；5 个非主键索引的列顺序和唯一性全部匹配，下表定义不变。

引擎真实 Id 为 `01M5SKXCV3NX5Y3J0MRAZDHGMT`，版本 v1.0.0，完整 13,324 字符的 SHA-256 为 `bc19fc968c14011cec4b9b9dd2b144b386865dbf6f5d37dea6bdbf8af76ae3c8`。创建工具规范化了 Function 头注释及空行；从 `var tenant =` 开始的可执行正文与原候选一致。完整读取留存 `online-manager-20261025.js`，不是只取了分片。线上 `AllowAnonymous=0/IsEnable=1/StopHttp=0/EnableLog=0/V8Limit=0`。MCP创建按租户运行默认保存Timeout600；本次只把manager本地候选与投影器的30对齐为600，其他接口/版本/正文不变，没有远端调参。随后于21:58完成标准导出引擎的限定只读完整导出：3表/67字段/8DDL/1接口/0数据集。新接口完整源码及运行元数据现已按该导出对齐；其他引擎未动。

`Capabilities/Policy/List` 三个只读动作均 Code=1，Policy 为 `1073741824 bytes/24h`，List 为空并返回 `TrafficState=Unknown,WindowBytes=null,UseBackup=false`。没有注册 demo 文件、填写流量或 Ready。

本地 sys-log 候选的 3 个表 Id、49 个业务字段 Id/TableId、8 条 DDL 的 TableId 以及 1 个引擎 Id 已按 `official-master-catalog-identities-20261025.json` 映射；原有其它资源、代码与版本保持。21:58只读导出补齐18个基础字段metadata，连同完整manager元数据纳入候选；49个既有业务字段及其余共享资源保持原样。导出完整选集保存在official-master-catalog-metadata-20261025.json，投影器通过sync-file-resource-master-metadata.mjs复现这项限定合并。权威写入回执由主任务保存于 `nas-migration/catalog-install-20261025.json`，独立只读回执在同目录 `catalog-independent-readback-20261025.json`。

## 写入前预检（历史记录）

- 连接：`microi_itdos_api_itdos_com`，API `https://api.itdos.com`，`OsClient=iTdos`；管理员能力由当前租户数据库复核为 true。
- `microi_get_db_schema` 的完整筛选结果未登记三张目标表；三个 `microi_get_table_indexes` 均返回“物理表不存在或没有可用字段”。这不是已建表证据。
- `mci-file-resource-manager` 的 Key/ApiAddress 活动与软删除记录查询均为 0。执行前仍须刷新，因为其他任务可能并行写入。
- 配置已存在：`FileServer=https://file.microi.net`、`FileServerBak=https://hub.microi.net:1120`、阈值 `1 GiB`、窗口 `24h`。这些值是本轮只读观察，本子任务没有改动；配置非空不代表运行时已分流。
- 真实 `microi_plan_system` 和 `microi_generate_system(dryRun=true)` 均为 `ok=true`，错误与警告均为空；范围 3 表、49 业务字段、5 索引、1 引擎、3 个表 Banner。没有角色、菜单、任务、业务种子或 Sys_Config 写入。
- 原始脱敏结果在 `readonly-preflight-20261025.json`；仅检查结构，不是安装、实际 MySQL DDL 或线上权限回放成功。引用有短 TTL，不能跨会话复用过期 manifestRef。

## 资源归属与字段身份

| 已有平台应用 | 本增量所有权 | 本次观察到的线上版本 |
| --- | --- | --- |
| `app.microi.sys-log`（系统日志/监控） | 目录、流量证据、副本三表及唯一 Managed 管理接口 | v8.4.19 |
| `app.microi.sys-config`（系统设置） | Sys_Config 的备用地址及两项策略字段 | v8.4.11 |
| `app.microi.saas-engine`（SaaS引擎） | 同一 Sys_Config 共享表快照的对应字段/物理列 | v8.4.38 |

上表是21:29独立线上回读时的历史版本。后续发布盘点本地SaaS候选已为v8.6.9，sys-log/sys-config当时仍为v8.4.19/v8.4.11；版本由指定发布任务统一管理，本子任务没有升版或恢复共享版本。当前本地候选包含增量，但不能把文件版本当成已发布新功能。

实时 `Sys_Config.Id=c8570fa6-c10f-4014-8cb4-4b046e7ba69c`；启用配置行 `a5fabe90-995f-45a0-adb4-606cdb98cdcd`。字段身份为：

| 字段 | 当前官方母版 FieldId |
| --- | --- |
| FileServerBak | 01M5RZ4HEKFZ98JMG5C0J5KN4R |
| FileServerBakThresholdGiB | 01M5SHXRP4RB71A1P2FEFKQZV2 |
| FileServerBakWindowHours | 01M5SHXSREBCX50Q02NZES06P2 |

两个策略字段的离线确定性 Id 已按本轮实时 schema **仅在这两个配置包内映射为上述线上 Id**，映射记录见 `official-master-field-identities-20261025.json`。生成器会保留已存在字段的真实 Id。三张新表及新接口已完成限定母版导出与真实Id同步；正式版本/渠道发布由指定任务完成，不得通过重复建字段或再次安装母版对齐。该 Manifest 特意不声明 Sys_Config，因此不会覆盖现有字段、值或其它系统设置。

通用包阈值保持空、窗口默认 24。当前 iTdos 用户选择的 1/24 仅属该租户配置，禁止导出为所有租户的数据种子。

## 根代理可执行的限定步骤

以下为限定执行/重验手册；主任务已经完成本轮母版写入，独立回读见上节，不应因保留手册而重复创建。本子任务只执行只读步骤、dryRun 和本地映射。不要调用官方母版上的 `import-microi-store-package`，包括 `ValidateOnly`；应用商城规范明确禁止官方发布源安装自己。

1. **重读身份与排重。** 通过同源 `microi_codex` 的 `profiles`、`microi_get_status`、`microi_get_administrative_capabilities`，确认 API/OsClient 精确匹配。重读三表 schema、三个物理索引、manager Key/路由的活动及软删除占用。若已有未知同名资源，先读完整定义并比较，不能自动覆盖未知来源。重读现有三项配置 FieldId 和唯一启用配置行，保持所有值。
2. **重新结构计划。** 将 `manifest.json` 解析为对象 `M`，调用：

   ```javascript
   // M = JSON.parse(manifest.json 的完整 UTF-8 正文)，不能传文件路径或字符串占位符。
   { action: 'microi_plan_system', profile: 'microi_itdos_api_itdos_com', params: { manifest: M, detail: 'summary' } }
   ```

   再用该响应的新 `manifestRef/manifestHash` 调用 `microi_generate_system`，参数固定 `dryRun:true, detail:"summary"`。检查计划只能出现三张 `mci_file_*` 表、其 49 字段/5索引/3 Banner 与单个 `mci-file-resource-manager`，不得包含配置行、角色、模块、业务对象、后台任务或其它引擎。`manifestFileSha256` 是文件原始字节摘要，MCP `manifestHash` 是内部规范化对象摘要，两者口径不同。
3. **仅维护空目录母版。** 主任务在现有授权范围内决定写入时，以完全相同的新引用调用 `microi_generate_system`，参数 `dryRun:false, confirmExecution:"iTdos", detail:"summary"`。这只是限定元数据母版维护，不等于安装平台全套。超时或结果未知先回读，不重放。不要种入历史文件、伪造流量或 Ready。
4. **锁定引擎 HTTP 元数据。** 生成器对启用/HTTP字段的实际支持应以回读为准，不能只看 Manifest。标准工具 `microi_set_engine_anonymous` 参数 `apiEngineKeys:["mci-file-resource-manager"],allowAnonymous:0` 可明确设为需登录，并维护 `IsEnable=1,StopHttp=0` 及路由缓存；随后 `microi_admin_table_data(operation:"query")` 只选 `Id,ApiEngineKey,ApiAddress,Version,IsEnable,StopHttp,AllowAnonymous,V8Limit,V8Unlimited,EnableLog,ApiRole` 回读。若需调整源码，用标准保存工具并完整分片回读，不能用临时 SQL/HTTP 绕过。
5. **独立回读。** 调用 `microi_validate_system`（同一完整 M 或新有效引用），要求 `Passed=true`；逐表 `microi_get_table_indexes` 核验下表的有序 Columns/IsUnique；`microi_get_field_list` 核验真实字段、ReadPrimary、空的测量默认值以及首发元数据。保存所有真实新 Id，核对三表业务行均为 0，既有 Sys_Config 前后值一致。通过 `microi_get_engine_code` 读取全部分片，核对可执行正文和安全元数据。以合法管理员调用 `Capabilities/Policy/List`，确认 `UseBackup=false`、未接入采集/副本/路由，List 为空；不为验收硬注册 demo 文件。
6. **权限回放。** 使用已授权的普通账号和匿名请求验证 manager 被拒绝；本轮无新增普通角色/菜单授权。此验证只证明接口身份门，不证明通用 CRUD 是不可绕过的。完整启用前还须完成下节可信写保护。
7. **由既有官方应用交付。** 母版完成后，按既有 sys-log/sys-config/SaaS 资源选择导出，保持唯一 Managed 所有权、真实表/字段/接口 Id、完整 DDL/PhysicalColumns/5索引与已有资源；配置值不能做种子。按当时官网版本单调升版、执行既有正式发布与 SHA 回读流程。本准备不提前升版或覆盖其它任务候选。不应把 sys-log 三表放入所有平台启动闭包。
8. **客户安装另验。** 非官方发布源租户才用正常应用商城，固定不可变 StoreVersionId 安装精确 owner 包并重复安装验证幂等，逐项回读本地权限、列、索引和源码。不得默认替客户部署、跨租户批量安装或启动新构建。

期望物理索引（除 Id 主键）：

| 表 | 索引 | 有序列 | 唯一 |
| --- | --- | --- | --- |
| mci_file_resource | ux_file_resource_key | Tenant, ResourceKey | 是 |
| mci_file_traffic_window | ux_file_traffic_request | Tenant, RequestKey | 是 |
| mci_file_traffic_window | ix_file_traffic_window | Tenant, ResourceId, WindowEndUtc | 否 |
| mci_file_replica | ux_file_replica_request | Tenant, RequestKey | 是 |
| mci_file_replica | ix_file_replica_resource | Tenant, ResourceId, SourceRevision | 否 |

## 权限审计和启用门槛

manager 每次使用 `V8.Method.GetSystemObservability` 的可信后端门核验当前租户的有效用户及管理员角色，然后将 `Tenant/SourceTenant` 固定为 `V8.OsClient`。字段、对象路径和 CAS 都经服务端校验，不能由调用者覆写租户、流量或副本成功字段。

但三表没有可信后端专用写保护。`Readonly=1` 只约束 UI；普通无表权限的账号被拒绝，超管或以后被授予表 CRUD 的账号仍可能通过通用 FormEngine 写入。`SubmitBeforeServerV8` 不能单独补齐，因为 `_RunV8Event=0/false` 可绑定并跳过事件。模块字段编辑权限也不能封锁删除或超管。证据位置：

- `Microi.Core/Security/PlatformAdministratorSecurity.cs:82`、`Microi.Core/V8Engine/Runtime/V8Method.SystemObservability.cs:544`：当前租户管理员真值。
- `Microi.net/FormEngine/FormEngineAuthorization.cs:535`、`:637`：超管及显式表授权路径。
- `Microi.Core/Param/Base/BaseParam.cs:58`、`Microi.net.Api/Controllers/FormEngineController.cs:240`、`Microi.net/FormEngine/FormEngine.cs:137`：事件跳过参数。

因此当前最多完成“空目录结构与管理员元数据接口已准备”。`Evaluate` 不读取这些表中人工填入的 Verified/Ready 来切流，始终返回 `Unknown/Unverified/UseBackup=false`。开放可信流量、Ready、复制或运行时路由前，需可信后端写入通道与反绕过校验；仅加入管理员保护表集合也不代表管理员只能经过专用动作，两个安全保证必须区分。

## microi_demo、平台文件和私有资源

- 历史热点路径 `microi_demo/micro-app/...` 的源租户是 `microi_demo`。`microi_microi_demo` 是其连接名称，不是应写进 ObjectKey 的租户前缀。
- 当前 iTdos 的 `1 GiB/24h` 不适用于 demo，不授予读取/修改 demo 私有源码、配置或对象的权限；iTdos 注册 demo 路径必须失败。当前管理器也拒绝 caller-supplied SourceTenant。
- 若后续需要处理 demo，应先明确 demo 自身授权、源应用/正式版本及其策略，使用 demo 连接维护自己的目录，记录 Tenant=SourceTenant=microi_demo；不能通过在 iTdos 硬塞路径达成“统一管理”。现阶段尚未对 demo 写入或安装。
- 若要 iTdos 管理多个租户的公开资产，需要另行实现跨租户只读发现/授权审批、来源绑定、任务执行租户和审计模型；当前没有此能力，不能依据同一管理员身份推定跨租户授权。
- 全局平台主壳 JS 不在当前租户路径范围，且加载早于 SysConfig，须从可信构建清单和加载器专门接入。应用入口与多个依赖的整体切换还需 Group/ManifestHash，不得因为某个单文件达到阈值就搬走全部依赖。
- 私有对象和 `PrivateSource` 永不进入公开分流目录。OSS 签名 URL 不能换域名当 MinIO 签名；本阶段不复制私有桶、不保存凭据或签名 URL。

## 本地再生成与验证

```powershell
node Microi.Server/OfficialApplications/PlatformService/build-file-resource-install-materials.mjs
node --test Microi.Server/OfficialApplications/PlatformService/test/file-resource-install-materials.test.mjs Microi.Server/OfficialApplications/PlatformService/test/file-resource-manager.test.mjs Microi.Server/OfficialApplications/Resource/file-resource-candidate.contract.test.mjs
```

准备阶段24项定向测试通过，结果见 `local-tests-20261025.json`；早期预检内23项属于新增配置身份断言之前的记录。母版身份映射后25项全过见 `nas-migration/catalog-local-identity-mapping-20261025.json`。本轮Timeout对齐增加独立母版比较及其他接口不变断言，最新 **26项全部通过，0失败/跳过**，且离线DDL10条语句通过，见 `nas-migration/catalog-timeout-alignment-20261025.json`。生成器只写本目录两个JSON，不改发布版本、同步基线、其它应用候选或线上配置。计划结果、dryRun与源代码内容变化后必须重算并重新计划。生产验收与复制/费用结果仍由主任务分别记录。

## 8.6.9合并冻结补记（2026-10-25）

本轮通过标准export-microi-store-package仅选三表与mci-file-resource-manager，未传PersistStoreId，DataSelections为空；无远端写入。导出353个物理列中只保留目标三表67列，未将基础设施列或任何业务种子带入候选。应用包仅追加18基础字段和对齐单个manager，其他49业务字段/DDL/资源不变，两个配置包字节不变。manager完整源码SHA为bc19fc968c14011cec4b9b9dd2b144b386865dbf6f5d37dea6bdbf8af76ae3c8；规范化头注释变化但从var tenant开始的正文一致。Timeout600、LimitRecursion2000、LimitMemory2048、MaxStatements50000000及名称/分类均与母版一致。最新定向27/27通过，DDL10条通过，0失败/跳过；默认采集、复制及路由仍关闭。本任务PlatformService路径至此冻结，后续由发布任务生成fingerprint/embed，不再由本子任务修改。
