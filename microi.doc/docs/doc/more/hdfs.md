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

### 微信小程序图片与资料内容安全

微信小程序中的头像及其它用户图片统一通过 `V8.uploadFile` 上传；多图组件使用 `V8.uploadFiles`，最多并发上传 3 张，并通过受管接口引擎 `mci-wechat-content-status-batch` 合并查询本人最多 20 条审核状态。小程序运行时 SDK 为每次上传获取独立的一次性 `wx.login` code，后端把图片保存在私有隔离区，并调用微信 `mediaCheckAsync`；只有异步回调明确返回 `pass` 后，SDK 才把对应文件值写入表单。单张失败不影响其它已通过图片，轮询采用有限次数、总超时和退避间隔，不允许无限请求。`review`、`risky`、回调超时、配置缺失或 Redis 故障均失败关闭。用户侧只提示“你发布的内容含违规信息，请修改后重试”，不得显示命中标签、策略或概率。

个人资料保存还会在服务端再次核对审核记录、图片路径和提交人，并用 `msgSecCheck` 检查姓名、实名和个人简介。因此不能通过跳过前端轮询或直接请求 `UptSysUser` 绕过检测。

SaaS 引擎“微信小程序”Tab 提供以下租户配置；它们属于敏感配置，不得写入 `appsettings.json`、环境变量、UniApp 源码、接口引擎或日志。相关字段应随官方应用商城资源交付，不再为此新增 `Microi.Upgrade` 定制迁移：

| SaaS 引擎字段 | 说明 |
|---|---|
| `WeChatMiniProgramAppId` | 当前小程序 AppId |
| `WeChatMiniProgramAppSecret` | 当前小程序 AppSecret，仅后端读取 |
| `WeChatMiniProgramMessageToken` | 微信消息推送签名 Token |
| `WeChatMiniProgramAESKey` | 可选；兼容／安全模式回调解密密钥（EncodingAESKey，43 位） |

在微信公众平台配置小程序消息推送 URL：

```text
https://<API公网域名>/api/WeChatContentSecurity/Callback--OsClient--<OsClient>--
```

如果第三方设置页确认支持查询参数，也可以使用 `/api/WeChatContentSecurity/Callback?OsClient=<OsClient>`；禁止使用 `?o=`。Token 必须与 `WeChatMiniProgramMessageToken` 完全一致；可先使用明文模式，启用兼容或安全模式时同时填写 EncodingAESKey。API 域名必须是微信可访问的 HTTPS 地址，负载均衡后的所有节点连接同一 Redis。接入依据见微信官方 [`mediaCheckAsync`](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/sec-check/security.mediaCheckAsync.html) 与 [`msgSecCheck`](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/sec-check/security.msgSecCheck.html) 文档。

### 租户动态限制、灾难保护上限与每日配额

所有 HTTP、FormEngine、V8 和移动端上传入口共用服务端限制。上传限制分为三层：租户业务配置、平台独立灾难保护上限、HTTP 请求解析上限。前端 `FileUpload` / `ImgUpload` 字段配置只能进一步收紧最终结果。

业务值只按 `sys_osclients` 当前租户 → 代码默认值解析，管理员无需维护额外环境变量或修改 `appsettings.json`：

| SaaS 引擎字段 | 代码默认值 |
|---|---:|
| `FileUploadEnabled` | `true` |
| `FileUploadMaxFileMB` | 100 MB |
| `FileUploadMaxRequestMB` | 200 MB |
| `FileUploadMaxCount` | 10 |
| `FileUploadDailyUserQuotaMB` | 2048 MB |
| `FileUploadDailyTenantQuotaMB` | 20480 MB |

业务值最终再与平台代码中的固定灾难保护上限取较小值：单文件 1024 MB、单次总量 2048 MB、单次 100 个文件、帐号和租户日额度各 10 TB。这些硬上限不是安装配置项，普通租户不能放大。

Kestrel HTTP 正文和 Multipart 接收硬顶统一为 2048 MB，普通表单单值硬顶为 128 MB；它们是所有租户共享的安全边界，不要求安装者再配置环境变量。租户业务配置仍负责其自身的最终额度，反向代理还必须允许请求进入 API。

#### nginx 413 与大文件上传

`413 Content Too Large` 如果响应正文是 nginx 的 HTML，表示请求尚未进入吾码 API，SaaS 引擎缓存、HDFS Controller 和全局异常处理都没有机会执行。实际可上传大小是“nginx → Kestrel HTTP → Multipart → 租户单文件/单次额度 → Absolute 灾难保护”各层上限的最小值。禁止只提高 `sys_osclients.FileUploadMaxFileMB`，也禁止用 `client_max_body_size 0` 关闭网关保护。

例如需要支持 1000 MB 文件，应在 **API 域名的 nginx `server` 块**中至少配置：

```nginx
# 支持1000MB文件，并为multipart封装留出余量
client_max_body_size 1024m;

# 慢速大文件上传的请求体读取空闲超时
client_body_timeout 600s;

# 避免 nginx 先把整个大文件重复缓冲到本机磁盘；HDFS/API 仍执行自身校验。
proxy_request_buffering off;

# 分块请求关闭缓冲时使用HTTP/1.1，并给上游读写保留足够时间
proxy_http_version 1.1;
proxy_connect_timeout 60s;
proxy_send_timeout 600s;
proxy_read_timeout 600s;

# nginx 自己拒绝的请求无法进入 ASP.NET Core，需在代理层保持吾码 DosResult 合约。
error_page 413 = @microi_upload_too_large;
location @microi_upload_too_large {
    default_type application/json;
    charset utf-8;
    add_header Cache-Control "no-store" always;
    # 跨域部署时，此处必须显式复用正常API代理的CORS白名单/include；不能依赖后端补响应头。
    return 200 '{"Code":0,"Data":null,"Msg":"上传请求在进入吾码 HDFS 前已超过反向代理请求体上限。SaaS 引擎上传额度不能放大 nginx/Kestrel/Multipart 上限；请运维同步提高各层上限后重试。","DataAppend":{"ErrorType":"UploadRequestTooLarge","Layer":"ReverseProxy"}}';
}
```

这些 `proxy_*` 指令可放在 API 域名的 `server` 层供代理 `location` 继承，也可合并进现有的 `location ^~ /`；不要新建第二个重复 location。`proxy_request_buffering off` 只关闭 nginx 预缓冲，不能用响应方向的 `proxy_buffering off` 代替，也不会绕过 API/HDFS 校验。

修改 nginx 后先执行 `nginx -t`，成功后再 reload。吾码 API 已内置 2048 MB HTTP/Multipart 接收硬顶；无需增加上传相关环境变量。最终仍不能突破平台固定的单文件 1024 MB、单次总量 2048 MB 灾难保护上限。若前面还有 CDN、WAF、负载均衡或 Ingress，还要同步检查这些上游的请求体和空闲超时限制。

请求进入吾码 API 后，如果 Kestrel 或 Multipart 再触发超限，全局异常处理会返回 HTTP 200、`Code=0`、`DataAppend.ErrorType=UploadRequestTooLarge`，并在响应头给出 `X-Microi-Upload-Max-Request-MB` 与 `X-Microi-Upload-Max-Multipart-MB`，方便定位实际生效的 API 启动配置。

Upgrade16 会在 `sys_osclients` 为每个租户补齐下列可空字段：

| SaaS 引擎字段 | 作用 | 空值行为 |
|---|---|---|
| `FileUploadEnabled` | 是否允许当前租户交互式上传 | 使用代码默认值 |
| `FileUploadMaxFileMB` | 单文件大小 | 使用代码默认值 |
| `FileUploadMaxRequestMB` | 单次全部文件大小 | 使用代码默认值 |
| `FileUploadMaxCount` | 单次文件数量 | 使用代码默认值 |
| `FileUploadDailyUserQuotaMB` | 单帐号每日额度 | 使用平台默认额度 |
| `FileUploadDailyTenantQuotaMB` | 单租户每日额度 | 使用平台默认额度 |

租户配置可以高于代码业务默认值，但不能突破平台固定灾难保护、HTTP/Multipart/Form 解析上限以及反向代理限制。`FileUploadEnabled=0` 表示停止该租户的交互式上传，而不是关闭安全检查；平台内部受控任务仍受平台灾难保护上限。修改 SaaS 引擎配置后应通过平台现有的租户重载流程刷新共享 Redis 配置，使所有 API 节点生效。

#### “当前租户已停用文件上传”如何处理

`FileUploadEnabled` 缺列、为空或无法解析时，平台默认按 `true` 处理；新租户的字段默认值也是 `1`。因此看到“当前租户已停用文件上传”时，不是 MinIO/HDFS 地址或桶权限故障，而是当前 API 运行环境实际命中的 `sys_osclients` 记录把 `FileUploadEnabled` 明确设成了 `0/false`。

1. 在 SaaS 引擎查询目标 `OsClient`，同时核对当前后端进程的 `OsClientType`、`OsClientNetwork`。同一租户存在内网、外网或开发/生产多条记录时，只修改当前服务器实际命中的启用记录，不能凭租户名称批量覆盖其它环境。
2. 将该记录的 `FileUploadEnabled` 改为 `1` 并保存。返回结果中的 `DataAppend.ConfigField=FileUploadEnabled`、`DataAppend.OsClient` 可用于确认目标。
3. 等待 SaaS 配置重载和共享 Redis 发布订阅完成；多 API 节点应全部收到同一版本，不能只清某个节点的进程内缓存。
4. 分别用一个很小的公有图片和一个私有文件做真实上传、读取测试。若错误变成 endpoint、bucket、签名或 `Invalid URI`，再按 MinIO/HDFS 配置排查；不要继续修改 `FileUploadEnabled`，也不要删除每日配额 Redis Key。

平台超级管理员也可按下文 MCP 流程精确更新，但写入前后都要回读同一组 `OsClient + OsClientType + OsClientNetwork` 数据。禁止为了消除提示而把所有租户、所有网络环境无差别改为允许。

帐号与租户额度使用共享 Redis 原子预留，适用于多 API 节点；Redis 不可用时上传失败关闭，不会降级成无限上传。额度按 UTC 日期统计，为避免并发重试绕过限制，上传后续失败也不退回已预留额度。反向代理、Ingress/IIS 还应设置不高于平台配置的请求体限制。

每日配额用于阻断短时间滥用，不等于租户全生命周期容量上限。生产对象存储还必须按租户或桶配置独立的总容量/账单告警与生命周期规则，并定期以对象存储实际用量对账；否则用户即使每天都低于应用配额，长期累计仍可能消耗大量空间。应用层 Redis 计数不能代替存储提供方的硬容量边界。

#### 通过 MCP 调整租户上传配额

平台超级管理员可以通过标准 MCP 工具修改 `sys_osclients` 中的六项租户业务配置，无需编写临时 SQL 或清空 Redis。容量字段单位均为 MB，例如 20 GB 应写为 `20480`。

1. 先调用 `microi_get_table_data` 查询 `sys_osclients`，按目标 `OsClient` 和 `IsEnable=1` 筛选，并回读 `Id`、`OsClientType`、`OsClientNetwork` 以及六个 `FileUpload*` 字段。
2. 同一租户可能同时存在 `Internal`、`Internet` 等多条启用记录。对每条记录调用 `microi_update_form_data`，传入 `tableName: "sys_osclients"`、包含 `Id` 的字段补丁以及 `confirmExecution: "sys_osclients"`，避免负载均衡节点读取到不同配置。
3. 再次调用 `microi_get_table_data` 逐条回读。FormEngine 保存 `sys_osclients` 后会触发 SaaS 运行配置重载；等待重载完成后，用一次真实小文件上传验证错误提示中的有效额度或上传结果。

示例字段补丁：

```json
{
  "Id": "<sys_osclients.Id>",
  "FileUploadDailyUserQuotaMB": 20480,
  "FileUploadDailyTenantQuotaMB": 20480
}
```

提高配额不会清零当日已经预留的字节数，而是立即按“新上限减去今日已用量”计算剩余额度。每日计数按 UTC 日期切换（北京时间每日 08:00 进入新的 UTC 统计日）；失败上传为防重试绕过也不会退回预留额度。除非用户明确授权事故处置，AI 不得删除共享 Redis 配额 Key。平台固定灾难保护、Kestrel/Multipart/Form 和反向代理限制不能通过租户侧 `sys_osclients` 或普通 MCP 表单更新突破。

#### AI 应用编译产物流式发布

Web、UniApp 和 MicroService 的真实编译目录应使用 MCP 工具 `microi_publish_application_directory_stream` 发布。该链路不会把文件转为 Base64，也不会让文件体进入接口引擎/Jint：

1. MCP 在本机按文件流计算 SHA-256，先拒绝符号链接、`.git`、`node_modules`、密钥/环境文件、超过 20000 个文件或超过 20 GB 的异常目录。
2. 每个文件以 `multipart/form-data` 原始字节流调用 `/api/V8Engine/UploadApplicationAssetStream`，API 校验登录租户、超级管理员身份、大小、每日额度和 SHA-256 后直接写入 HDFS 不可变版本目录。
3. 所有文件写完后，MCP 只提交路径、大小和摘要清单到 `/api/V8Engine/FinalizeApplicationStreamPublish`。API 回读版本对象与完整性标记，再使用阿里云 OSS、MinIO 或 S3 的服务端 `CopyObject` 切换稳定地址。
4. 非入口资源先切换，`index.html` 最后切换；同一应用使用跨节点分布式锁串行发布，避免两个版本并发产生混合资源。

```text
历史版本：{tenant}/ai-app-publish/{appKey}/versions/v1.2.3/index.html
稳定地址：{tenant}/ai-app-publish/{appKey}/index.html
latest别名：{tenant}/ai-app-publish/{appKey}/latest/index.html
```

微服务历史目录保持 `{tenant}/micro-app/{appKey}/v1.2.3/`，稳定入口同样不带版本号。数据库只保存路径、大小、SHA-256、版本和路由等元数据。失败后可以用相同版本和摘要安全重试；完整清单确认前不会切换稳定入口。

几十 MB 不是 Jint 的固定内存上限，HDFS 本身也没有这种限制。旧发布流程的问题是先把二进制扩成约 `4/3` 大小的 Base64，再经 JSON、Jint 字符串和多层复制产生累计分配；具体何时失败取决于文件数量、并发和进程内存。普通小型 V8 上传可继续使用 `V8.Method.Upload`，真实编译目录和数百 MB 资产必须使用上述流式发布。最终可上传大小仍取反向代理、Kestrel/Multipart、单文件、单次和每日额度的最小值。

调用示例：

```json
{
  "appIdOrKey": "microi-developer-toolbox",
  "versionNo": "v1.1.0",
  "directory": "D:/build/microi-developer-toolbox/dist",
  "entryPath": "index.html",
  "confirmExecution": "microi-developer-toolbox"
}
```

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
