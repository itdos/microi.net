# 热点公开资源目录：第一阶段候选与母版回读

2026-10-25。范围已从全量 OSS→NAS 迁移改为按可信窗口流量准备少量热点资源。此目录复用 `app.microi.sys-log` 的 CDN/监控应用身份，不另建应用。**限定母版三表与单接口已由主任务写入并独立回读；目录自身仍不采集、复制或分流。** 本文件不把母版维护称为商城发布或客户安装，统一平台8.6.9及商城渠道由指定发布任务管理。

当前证据：本子任务独立回读 49 个业务字段（含系统字段共67条元数据）、5 个物理索引及 `Capabilities/Policy/List` 三个只读动作通过；三表均无业务行。真实 Id 已映射到本地候选，详见 `file-resource-install/README.md` 与交付记录 `nas-migration/catalog-independent-readback-20261025.json`。主任务另已验证四个公有GLB的NAS暂存副本，属于独立精选复制，不由本目录执行，不代表跨租户登记或业务分流。历史榜单仍不证明当前完整窗口命中阈值。

## 包归属和配置

| 归属 | 本地增量 |
| --- | --- |
| `app.microi.sys-log.json` | 三张目录/证据/副本表（49 个业务字段加18个基础字段元数据、67 个物理列、3 条建表与 5 条索引 DDL）及唯一 Managed 接口 `mci-file-resource-manager` |
| `app.microi.sys-config.json` | 已有 `Sys_Config.FileServerBak` 旁增加两个策略字段 |
| `app.microi.saas-engine.json` | 同步相同两个系统设置字段，保留字段稳定 Id；不重复拥有管理接口 |

系统设置字段固定为 **`FileServerBakThresholdGiB`** 和 **`FileServerBakWindowHours`**。原方案较长的名称触发实时平台字段名长度限制，未保留第二套同义字段。默认阈值为空（关闭），窗口 24 小时；1 GiB=1,073,741,824 bytes，后台换算为整数 bytes。当前用户对 iTdos 的选择是 1 GiB/24 小时，由主任务独立配置并回读，不写入通用包的数据种子。

保留已有 FileServerBak Id/定义、DataSets、ScheduleJobs、SysMenus、ApplicationBundles 和其他资源。2026-10-25本次发布盘点时本地版本为 sys-log v8.4.19、sys-config v8.4.11、SaaS v8.6.9；SaaS已由共享发布流程推进，后续各包版本由指定发布任务管理，本子任务不升版或恢复旧版本。文件中的版本号不证明该增量已在商城发行。两个系统设置包原有建表语句的 `DisableTaskScheduling` 缺逗号和 `CompatiblePlatformOldVersion` 双逗号已限定修复。

## 数据与授权边界

- `mci_file_resource` 保存当前租户的公开资源引用。`Tenant`、`SourceTenant` 都由服务端 `V8.OsClient` 固定，调用者不能传入或修改；平台管理员权限不扩大为跨租户对象授权。
- 允许当前租户小写前缀 `{tenant}/...`，或现有 V3 前缀 `microi/application-assets/v3/tenants/{tenant}/...`。iTdos 目录不能登记 `microi_demo/...`、`demo/...` 或其他租户路径；共享全局平台主壳文件需另有可信构建清单接入，本阶段拒绝任意全局路径。
- `ApplicationPublicBuild` 只接受当前租户 `mci_ai_app_file` 的活动公开范围 `PublicBuildStream` / `PublicBuildOnly`，从明确选中的元数据读取 HdfsPath、Hash、Size 和 AppId；客户端不能覆写这些权威字段。该状态称 `MetadataBound`，不等于已核验当前线上运行版本或对象正文。
- `PlatformStatic` 只登记当前租户公开命名空间内的文件声明，状态为 `Declared`；声明的 SHA/Size 不当作真实回读。没有全桶或前缀批量发现。
- 任意 URL、签名查询串、编码/普通路径穿越、反斜线、控制字符、私有/source 命名空间和不支持的文件类型拒绝进入目录。私有源码、私有签名、NAS 访问凭据完全不进入此接口。
- 第一阶段没有普通 CRUD 菜单或角色授权种子。字段只读是界面提示，不作为后端安全凭据；本阶段提供的维护入口要求管理员。当前超管，以及以后取得显式表 CRUD 权限的账号，仍可通过通用 FormEngine 绕过管理接口校验；表事件也可被 `_RunV8Event=0` 跳过。未来可信采集/复制/Ready/路由开放前，必须补上可信后端写入边界，不能信任直接编辑数据库得到的 Ready。
- `mci_file_traffic_window` 和 `mci_file_replica` 是未来可信采集器/副本 worker 的空结构，不提供 HTTP 人工写入可信成功状态的动作。未知 byte/request/verified-size 默认 NULL。

## 接口使用

源文件：`engines/mci-file-resource-manager.js`。ApiEngineKey 为 `mci-file-resource-manager`，应用包中 `AllowAnonymous=0`，每次动作先用既有 `GetSystemObservability` 后端权限入口验证当前租户平台管理员，再访问目录。MCP创建时取租户运行默认Timeout，已独立回读为600秒；先对齐Timeout600，随后按限定母版完整导出对齐该接口的名称、分类、运行限额和规范化头注释；从var tenant开始的可执行正文、版本及其他接口保持。来源为 `V8McpLogic.cs` 的 `CreateV8EngineParam.FromSysConfig` 和 `CreateV8EngineParam.DefaultTimeout=600`，不是生产调参。

下面是接口引擎业务参数，不含 Token。这里只给调用契约，没有执行任何在线写入。

```json
{"Action":"Capabilities"}
{"Action":"Policy"}
{"Action":"List","PageIndex":1,"PageSize":20}
{"Action":"Register","Resource":{"Kind":"ApplicationPublicBuild","Name":"已发布树模型","SourceFileId":"当前租户公开文件记录的Id"}}
{"Action":"Register","Resource":{"Kind":"PlatformStatic","Name":"租户静态脚本","ObjectKey":"itdos/static/assets/app.js","ContentHash":"64位SHA256十六进制摘要","Size":1234,"ContentType":"application/javascript"}}
{"Action":"Update","Id":"登记结果中的Id","ExpectedRowVersion":1,"Name":"新的显示名称","Enabled":false}
{"Action":"Evaluate","Id":"登记结果中的Id"}
```

`Register` 同租户同源版本精确重放不新增记录；源摘要改变返回 `RESOURCE_VERSION_CONFLICT`，目前不提供隐式刷新或跨版本复用副本。`Update` 只修改名称和纳入开关，在当前接口事务中以参数化 CAS 校验 RowVersion，更新后主库回读；不允许修改源、流量或副本成功状态。

所有返回的 `UseBackup` 都是 false。`Evaluate` 返回 `TrafficState=Unknown`、`WindowBytes=null`、`ThresholdMet=null`、`ReplicaState=Unverified`，并明确缺少 TrustedTrafficCollector、VerifiedReplicaWorker 和 RuntimeResolver。即便有人直接填入 Verified/Ready，也不能绕过这一边界。接口不请求文件正文、第三方网络或复制器，不计入文件下载流量。

## 尚未接入

1. **可信逐对象流量源和完整窗口。** 历史榜单不是实时数据，域名总流量不能分摊成对象计量；Unknown/Failed/Stale 不置零，不自动触发准备或切流。
2. **受控复制、内容与访问验证、回读回执。** 没有复制任务/定时任务种子，没有自动 Ready，没有直接公开私有桶；需要未来 worker 从可信源回读大小/SHA、目标访问策略、MIME/Range/TLS，并绑定 SourceRevision 与目标配置摘要。
3. **运行时消费者。** FileServerBak 配置不使旧 FileServer、SDK、后台 HDFS 下载、主壳 JS 或应用 `/micro-app/...` 自动切换。v8.6.8 的后台校验检查点保持原逻辑；不能用 NAS 好副本证明 OSS 权威对象正确。
4. **依赖组与跨租户治理。** 当前仅单资源元数据。一个入口改地址不能隐式带走整包依赖；未来需明确的 Group/ManifestHash 和依赖闭包。跨租户共享配置与平台构建清单需要单独可信授权模型，当前关闭。
5. **尚待完成的线上交付。** 官方 `microi_itdos_api_itdos_com` 的限定Manifest已完成plan、dryRun、生成及validate，随后独立回读三表、49字段、5索引和完整接口。当前iTdos策略1 GiB/24h及备用地址已读回，接口能力仍关闭。三表/67字段/8DDL及接口现已完成限定只读完整导出，18个基础字段与完整接口已合入候选；仍待商城渠道发布、非官方源租户安装/幂等回读、普通账号与匿名权限回放，以及真正的可信计量/副本/消费者接通；不得重复执行已经完成的母版创建。详见 `file-resource-install/README.md`。

## 本地生成与验证

幂等更新本地候选（有文件并发更改检查，不更新同步基线或远端）：

```powershell
node Microi.Server/OfficialApplications/Resource/configure-file-resource-candidate.mjs --write
```

局部验证：

```powershell
node --test Microi.Server/OfficialApplications/PlatformService/test/file-resource-install-materials.test.mjs Microi.Server/OfficialApplications/PlatformService/test/file-resource-manager.test.mjs Microi.Server/OfficialApplications/Resource/file-resource-candidate.contract.test.mjs
node --test Microi.Server/OfficialApplications/Resource/sys-user-sys-config-package-contract.test.mjs Microi.Server/OfficialApplications/Resource/system-settings-boundary-resource.test.mjs
python Microi.Server/OfficialApplications/Resource/verify-file-resource-ddl.py
```

母版身份映射后的接口/包/安装契约25项通过，系统设置相邻测试此前9项通过。本轮增加“Timeout匹配独立母版且其他接口保持”的契约后共26项，实际结果另保存在本次Timeout对齐回执。SQL验证用标准库SQLite内存数据库解析和执行三张新表、五个索引及两个Sys_Config建表语句；仅移除MySQL COMMENT与末尾ENGINE/CHARSET，逐列核对，并验证两个历史错误逗号样本确实被解析器拒绝。它证明结构和分隔符，不代替MySQL存储/排序规则或真实应用安装验收。

另一次相邻回归包含 CDN 安全 31 项、CDN包契约3项及上述旧18+9项，共61项：60通过、1失败。失败是未触碰的商城包 `app.microi.store.json` 仍嵌入导入器 v3.1.0，而共享 `import-package.js` 已为 v3.1.1；这是独立共享候选漂移，未修改，不把其失败计成全部通过。

最新冻结验证：27项定向测试全部通过，DDL10条通过；母版只读导出与候选差异回执位于nas-migration/catalog-master-metadata-alignment-20261025.json。两个配置包保持原SHA，sys-log仅追加18基础字段并对齐唯一manager。该子任务PlatformService路径已交由统一发布任务冻结取指纹。
