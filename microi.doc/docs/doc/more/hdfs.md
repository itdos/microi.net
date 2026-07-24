# 📂 分布式存储

> 平台分布式存储支持 **阿里云 OSS/CDN**、**MinIO**、**亚马逊 S3**，基于 SaaS 引擎配置，不同租户可使用不同存储方案。

---

## 📖 介绍

| 特性 | 说明 |
|---|---|
| 支持存储 | 阿里云 OSS/CDN、MinIO、亚马逊 S3 |
| 配置驱动 | 基于 SaaS 引擎，不同租户可独立配置 |
| 可扩展 | 由表单引擎驱动，可自由扩展腾讯云、华为云等 |
| 源码位置 | [Microi.HDFS](https://gitee.com/ITdos/microi.net/tree/master/Microi.HDFS) |

---

## 🔐 上传与私有文件安全

::: warning 登录不等于文件授权
Token 只用于确认用户和租户。普通帐号不能因为持有 Token 就任意上传、列目录、读取私有桶裸路径或调用文件管理接口。
:::

### 租户动态限制、灾难保护上限与每日配额

所有 HTTP、FormEngine、V8 和移动端上传入口共用服务端限制。上传限制分为三层：租户业务配置、平台独立灾难保护上限、HTTP 请求解析上限。前端 `FileUpload` / `ImgUpload` 字段配置只能进一步收紧最终结果。

业务值按 `sys_osclients` 当前租户 → 环境变量 → `appsettings` → 代码默认值取第一项，因此租户可以按业务需要提高或降低 `appsettings` 的默认业务值：

| 环境变量 | `appsettings` 业务默认值 | 代码默认值 | 租户覆盖字段 |
|---|---|---:|---|
| `MICROI_FILE_UPLOAD_ENABLED` | `FileUploadSecurity:UploadEnabled` | `true` | `FileUploadEnabled` |
| `MICROI_FILE_UPLOAD_MAX_FILE_MB` | `FileUploadSecurity:MaxFileMB` | 100 MB | `FileUploadMaxFileMB` |
| `MICROI_FILE_UPLOAD_MAX_TOTAL_MB` | `FileUploadSecurity:MaxTotalMB` | 200 MB | `FileUploadMaxRequestMB` |
| `MICROI_FILE_UPLOAD_MAX_COUNT` | `FileUploadSecurity:MaxFileCount` | 10 | `FileUploadMaxCount` |
| `MICROI_FILE_UPLOAD_DAILY_USER_QUOTA_MB` | `FileUploadSecurity:DailyUserQuotaMB` | 2048 MB | `FileUploadDailyUserQuotaMB` |
| `MICROI_FILE_UPLOAD_DAILY_TENANT_QUOTA_MB` | `FileUploadSecurity:DailyTenantQuotaMB` | 20480 MB | `FileUploadDailyTenantQuotaMB` |

业务值最终再与独立的 `AbsoluteMaxFileMB`（默认 1024 MB）、`AbsoluteMaxTotalMB`（默认 2048 MB）、`AbsoluteMaxFileCount`（默认 100）、`AbsoluteDailyUserQuotaMB` / `AbsoluteDailyTenantQuotaMB`（默认各 10 TB）取较小值。`ForceDisabled=true` 是全局紧急熔断。它们可由对应 `MICROI_FILE_UPLOAD_ABSOLUTE_*` 环境变量或 `appsettings` 运维配置调整，但不接受租户覆盖。

Kestrel 的 `MaxRequestBodyMB`、Multipart 的 `MaxMultipartBodyMB` 和表单值的 `MaxFormValueMB` 在进程启动时确定，是所有租户共享的解析硬顶，也不接受 SaaS 运行期放大。若某租户业务上限需要超过默认 256 MB，运维人员必须同步提高反向代理和这些解析上限；租户业务配置仍然负责其自身的最终额度。

Upgrade16 会在 `sys_osclients` 为每个租户补齐下列可空字段：

| SaaS 引擎字段 | 作用 | 空值行为 |
|---|---|---|
| `FileUploadEnabled` | 是否允许当前租户交互式上传 | 继续向环境变量、`appsettings`、代码默认值回退 |
| `FileUploadMaxFileMB` | 单文件大小 | 继续向环境变量、`appsettings`、代码默认值回退 |
| `FileUploadMaxRequestMB` | 单次全部文件大小 | 继续向环境变量、`appsettings`、代码默认值回退 |
| `FileUploadMaxCount` | 单次文件数量 | 继续向环境变量、`appsettings`、代码默认值回退 |
| `FileUploadDailyUserQuotaMB` | 单帐号每日额度 | 使用平台默认额度 |
| `FileUploadDailyTenantQuotaMB` | 单租户每日额度 | 使用平台默认额度 |

租户配置可以高于 `appsettings` 的业务默认值，但不能突破独立 `Absolute*`、HTTP/Multipart/Form 解析上限以及反向代理限制。`FileUploadEnabled=0` 表示停止该租户的交互式上传，而不是关闭安全检查；平台内部受控任务仍受平台灾难保护上限。修改 SaaS 引擎配置后应通过平台现有的租户重载流程刷新共享 Redis 配置，使所有 API 节点生效。

帐号与租户额度使用共享 Redis 原子预留，适用于多 API 节点；Redis 不可用时上传失败关闭，不会降级成无限上传。额度按 UTC 日期统计，为避免并发重试绕过限制，上传后续失败也不退回已预留额度。反向代理、Ingress/IIS 还应设置不高于平台配置的请求体限制。

每日配额用于阻断短时间滥用，不等于租户全生命周期容量上限。生产对象存储还必须按租户或桶配置独立的总容量/账单告警与生命周期规则，并定期以对象存储实际用量对账；否则用户即使每天都低于应用配额，长期累计仍可能消耗大量空间。应用层 Redis 计数不能代替存储提供方的硬容量边界。

普通交互式上传默认强制写入私有桶，即使篡改客户端 `Limit=false` 也不会变成公有文件；普通用户仅能使用 `file`、`img`、`avatar`、`editor` 四个安全一级目录，不能提交多级目录、绝对路径或 `..`。确需公开的产品图、Banner 等文件，应由经过授权的发布流程或超级管理员显式写入公有桶，不能把“是否公开”交给普通客户端决定。

接口引擎、后端表单 V8 和平台内部任务调用 `V8.Method.Upload` 属于可信服务端上传，可以由业务代码选择安全路径和公私有桶；但仍受全局文件数量、单文件和单次总量硬限制。浏览器、移动端和普通 HTTP 客户端不能通过伪造 `_TrustedServerInvocation`、`Limit` 或 `Path` 获得这种信任。

### 私有文件必须绑定业务记录

普通用户调用 `/api/HDFS/GetPrivateFileUrl` 时，除文件相对路径外必须提交：

| 参数 | 说明 |
|---|---|
| `FormEngineKey` | 文件所属表名或表 Id |
| `FormDataId` | 文件所属业务记录 Id |
| `FieldId` | 保存该文件引用的 `FileUpload` / `ImgUpload` 字段 Id |
| `SysMenuId` | 当前用户实际进入的菜单 Id |

服务端依次校验：Token 与 `OsClient` 一致、用户拥有该菜单、菜单绑定目标表、菜单数据范围允许读取该记录、字段属于该表且是文件字段、字段值确实引用所请求路径。任一步失败都不会退回裸路径签名 URL；普通用户也不能直接获取私有文件的 `Byte` / `Stream`。私有文件链接仍为短期后端票据，不能持久化临时 URL。

接口引擎和后端表单 V8 可以在可信服务端上下文中调用 `V8.Method.GetPrivateFileUrl({ FilePathName })`。这不表示浏览器也能只传路径签名；普通客户端始终必须携带上表中的完整业务上下文。

文件列表、移动、重命名、删除、覆盖上传等管理接口仅允许 `Level >= 9999` 的平台超级管理员。业务用户删除附件应通过受保护的表单/业务接口完成，由服务端核对记录权限和字段引用后处理对象存储，不能直接开放文件管理 API。

富文本编辑器的远程图片抓取 `catchimage` 默认关闭，避免把平台变成任意 URL 下载器或内网探测代理。业务若需要采集远程资源，应使用单独的受控接口，并实现域名白名单、DNS/IP 校验、禁止跳转、超时、响应体上限和文件头校验。

#### 升级兼容说明

- 历史公有文件不会因升级自动迁移；先复制到租户私有桶、回读核验，再停止旧公有访问。数据库继续保存租户内相对路径，不保存对象存储密钥或真实签名 URL。
- 旧页面只传 `FilePathName` 获取私有地址，升级后普通帐号会失败。应补齐 `FormEngineKey`、`FormDataId`、`FieldId`、`SysMenuId`，不要把接口改回匿名或给普通角色开放文件管理权限。
- 旧自定义上传若依赖普通用户设置 `Limit=false` 或任意多级 `Path`，应调整为私有上传；公开资产改走审核后的发布流程。
- 上线前应按实际业务文件大小配置限额，并验证普通角色越权、公私有桶、配额耗尽、Redis 故障和多节点并发；不能仅以“上传成功”作为安全验收。
- Upgrade16 的六个字段全部可空，空值继续使用平台默认/硬上限，因此老租户升级不会被强制停用上传。升级完成后应回读字段元数据和租户配置，并刷新 SaaS 运行缓存。

完整平台保护表、登录会话、CORS、SSRF 和升级基线见 [平台安全与兼容基线](./security)。

---

## ⚙️ 步骤一：指定存储方式

在 **【系统设置】→【开发配置】** 中指定存储方式。系统设置由表单引擎驱动，可在表单设计中自由扩展更多自定义存储方式。

![存储方式配置](https://static.itdos.com/upload/img/csdn/5f7e4c8a6b824c51b1c50de50827abdd.png#pic_center)

---

## ☁️ 阿里云 OSS + CDN

在 **【SaaS 引擎】→【Aliyun】** 处配置相关参数：

![阿里云OSS配置](https://static.itdos.com/upload/img/csdn/dd353af2971c4057b3d47c1f3ad9d81c.png#pic_center)

---

## 📦 MinIO

在 **【SaaS 引擎】→【MinIO】** 处配置相关参数：

> 💡 安装 MinIO 方法见：[Docker 部署文档](https://microi.blog.csdn.net/article/details/143576299)

![MinIO配置](https://static.itdos.com/upload/img/csdn/0bde20907de743f5b051036546837afa.png#pic_center)

---

## 🌍 亚马逊 S3

> 📌 首先请熟悉亚马逊 S3：[亚马逊 S3 入门](https://blog.csdn.net/qq973702/article/details/143648974)

平台使用 MinIO SDK 驱动亚马逊 S3，后续将补充详细配置说明。
