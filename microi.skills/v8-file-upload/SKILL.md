---
name: v8-file-upload
description: Microi V8 与 MCP 文件上传下载指南。用于处理流式 AI 应用发布、V8.FilesByteBase64、V8.Method.Upload、私有文件 URL、文件响应、HDFS、OSS、MinIO 和 S3 存储。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 文件上传下载

你正在为 Microi 吾码平台编写文件上传/下载/返回相关代码。平台分布式存储（HDFS）支持阿里云OSS、MinIO、亚马逊S3，存储方案由 SaaS 引擎按租户配置。

公开入口覆盖 `V8.uploadFile`、多文件 `V8.uploadFiles` 与 MCP `microi_upload_file_base64`。多文件上传必须限制并发、逐文件返回结果；Base64 工具只接受明确文件名、大小和租户内目标范围，写后回读路径、大小与哈希。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-file-upload-000 sha256=b48ce09f93a43efd30e700af637db3881355e8d2baaf45165ea2bd0bdfda25cf -->
## 核心 API

| API | 说明 |
|-----|------|
| `V8.FilesByteBase64` | 接收上传时携带的文件字典 `{ FileName: base64 }` |
| `V8.Method.Upload({...})` | 服务端上传文件到 HDFS（推荐） |
| `V8.Method.GetPrivateFileUrl({FilePathName})` | 生成私有桶临时访问 URL |
| `V8.Http.GetResponse({Url}).RawBytes` | 下载远程文件为字节数组 |
| 接口返回 `{ FileName, ContentType, FileByteBase64 }` | 接口直接响应文件 |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-001 sha256=a7572bc0fd333c8f0c240d0f62db4763225ba9f69bfd45d0e0d41ae3f4b1edd0 -->
## 第三方数据库附件迁移

当第三方表只保存附件路径时，先用 `microi_inspect_external_database` / `microi_query_external_database` 或 `V8.Dbs.<DbKey>` 查询记录。`microi_import_external_attachment` 允许后端已确认的 `Level >= 9999` 当前用户直接提供 HTTP/HTTPS URL、API 节点可读的本机绝对路径或 UNC 路径。

- 导入工具必须显式确认；HTTP、私网、重定向、本机和 UNC 均可访问，但最终能力受 API 服务进程账号、网络、磁盘及对象存储权限约束。
- 下载与上传使用临时文件和文件流，不经过 Base64；不设固定 20/100 MB 上限，`MaxBytes=0` 或省略表示不设置 MCP 上限，可处理 200/500 MB 或更大文件。
- 带签名参数或用户凭据的源 URL、鉴权 Header 和本机/UNC 路径不得出现在结果、日志或目标表；脱敏审计只记录来源 SHA-256、类型和字节数，目标字段只保存吾码租户内相对路径。
- 使用第三方附件 Id/版本作为幂等键，回读目标记录后才标记成功；多节点重投不能重复产生业务附件。
- 批量迁移应落任务状态表并分页处理，失败可重试；不要让 MCP 一次加载整库路径或大文件集合。

可信后端 V8 可用 `V8.Http.GetResponse({ Url: url }).RawBytes` 下载，再用 `System.Convert.ToBase64String` 和 `V8.Method.Upload` 上传。该路径同样必须校验域名、大小、Content-Type、后缀和最终重定向目标。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-002 sha256=ab3fa9eda3090868f45651aaddfa6b5ecd390535123f4666c9b67fba6a6e34f7 -->
## 接收前端上传的文件

前端发起文件上传时，平台自动把文件以 base64 形式注入到 `V8.FilesByteBase64`：

```javascript
// V8.FilesByteBase64 = { '文件名1.png': 'base64...', '文件名2.pdf': 'base64...' }
if (!V8.FilesByteBase64) {
  return { Code: 0, Msg: '请上传文件' };
}

var fileNames = Object.keys(V8.FilesByteBase64);
var firstFile = fileNames[0];
var firstBase64 = V8.FilesByteBase64[firstFile];

// 上传到 HDFS
var upResult = V8.Method.Upload({
  FilesByteBase64: V8.FilesByteBase64,
  Limit: true,         // 业务上传默认私有桶（需临时 URL 访问）
  Preview: false,      // true=自动生成预览图
  Path: '/business/orders',  // 存储路径前缀
  OsClient: V8.OsClient
});

if (upResult.Code !== 1) return upResult;

// upResult.Data = [{ FileName, Path, FullPath, Size, ... }, ...]
var filePath = upResult.Data[0].Path;  // 相对路径，存数据库
var fullUrl  = upResult.Data[0].FullPath;  // 完整 URL（公有桶）
```

### 平台上传分层限制

Token 不是无限上传授权。所有 HTTP、表单、V8 和移动端上传入口必须在解码 Base64、解析图片或调用对象存储前执行服务端校验。上传限制分为四层，不能把租户业务值误称为平台硬上限：

1. **租户业务配置**：有效正数/布尔值按 `sys_osclients` 当前租户 → 代码默认值解析。租户可以按业务需要提高或降低默认值，不要求安装者维护额外环境变量或修改 `appsettings`。
2. **平台绝对上限**：最终业务值再与代码内固定灾难保护上限取较小值，租户和安装参数都不能放大。
3. **HTTP 解析上限**：Kestrel 请求正文与 Multipart 固定为 2048 MB，普通表单单值固定为 128 MB，是所有租户共享的请求解析硬顶。
4. **字段级限制**：前端 `FileUpload` / `ImgUpload` 的 `MaxSize`、`MaxCount` 等只能与当前租户有效值取更小值，不能提高后端上限，也不能替代服务端校验。

业务配置与固定边界：

| `sys_osclients` 字段 | 代码默认值 | 平台固定边界 |
|---|---:|---:|
| `FileUploadEnabled` | `true` | — |
| `FileUploadMaxFileMB` | 100 MB | 1024 MB |
| `FileUploadMaxRequestMB` | 200 MB | 2048 MB |
| `FileUploadMaxCount` | 10 | 100 |
| `FileUploadDailyUserQuotaMB` | 2048 MB | 10 TB |
| `FileUploadDailyTenantQuotaMB` | 20480 MB | 10 TB |

- `sys_osclients` 六个字段全部可空；空值、无效值或老数据库缺列时使用代码默认值，不会因升级自动停用上传。`FileUploadMaxRequestMB` 指一次上传所有文件的业务合计大小，不等于 Kestrel HTTP 请求正文上限。
- 固定灾难保护和 HTTP/Multipart/Form 解析上限不属于安装配置；租户值即使更大也会被这些边界截断。最终单次总量还不能超过帐号或租户的有效日额度，单文件不能超过最终单次总量。
- `FileUploadEnabled=0` 表示禁用当前租户的交互式上传，不表示绕过限制。平台内部受控任务仍受全局大小硬上限；租户配置刷新应走现有 SaaS 引擎重载和共享 Redis 发布订阅，不能依赖单节点内存。
- 帐号与租户每日额度在共享 Redis 中用单次原子脚本预留，支持多节点；Redis 不可用时失败关闭，不能降级成无限上传。
- 额度按 UTC 日期统计。为防并发重试绕过限制，后续对象存储失败也不退还已经预留的额度。
- 每日额度只阻断短期滥用；对象存储必须另外配置租户/桶总容量、账单告警、生命周期与实际用量对账。Redis 计数不能作为长期容量事实源。
- 普通交互式用户无论客户端是否传 `Limit:false`，服务端都强制使用私有桶，并只允许平台预定义安全一级目录；公有资产必须经过授权的发布流程或超级管理员。
- 反向代理、Ingress/IIS 的请求体上限应与进程级 HTTP 解析硬顶协调。字段自身的类型、后缀、大小和数量配置只能进一步收紧当前租户有效值，不能替代平台硬顶。

### 复盘：“当前租户已停用文件上传”

- 该提示只表示当前运行环境命中的 `sys_osclients.FileUploadEnabled` 被明确设置为 `0/false`。缺列、空值、无效值和新租户都按默认 `true`，不要先把问题归因于 MinIO/HDFS。
- 新版响应同时返回 `DataAppend.ErrorType=TenantFileUploadDisabled`、`OsClient`、`ConfigField=FileUploadEnabled` 和文档地址；客户端必须保留后端 `Msg/DataAppend`，不能只显示“上传失败”。
- 处理时先读取当前 API 进程的 `OsClient + OsClientType + OsClientNetwork`，再精确回读同三元组的启用记录并把 `FileUploadEnabled` 改为 `1`。不能仅按租户名批量覆盖其它网络或环境记录。
- 保存后等待 SaaS 共享配置重载，再分别验证一个小公有图片和一个小私有文件。只有错误转为 endpoint、bucket、签名或 `Invalid URI` 后，才进入对象存储配置排查。
- 不要通过删除 Redis 日额度 Key、扩大文件大小上限或改成公有桶来解除租户停用；这些动作与开关无关，还会扩大安全风险。

### AI / MCP 调整租户上传配额

用户明确授权修改某个租户的上传额度时，AI 可以直接使用标准 MCP 完成，不要把应用层提示误判成阿里云 OSS、MinIO 或 S3 的存储配额，也不要先清 Redis：

1. `microi_get_table_data(tableName: "sys_osclients")` 按 `OsClient`、`IsEnable=1` 查询，选择 `Id/OsClientType/OsClientNetwork` 和六个 `FileUpload*` 配额字段。
2. 先以当前服务器的 `OsClientType + OsClientNetwork` 收窄到实际生效记录；只有用户明确要求多个环境保持一致时才扩展范围。逐条调用 `microi_update_form_data`，`row` 必须包含 `Id`，并传 `confirmExecution: "sys_osclients"`。
3. MB 是存储单位：`20 GB = 20480 MB`。可修改字段为 `FileUploadEnabled`、`FileUploadMaxFileMB`、`FileUploadMaxRequestMB`、`FileUploadMaxCount`、`FileUploadDailyUserQuotaMB`、`FileUploadDailyTenantQuotaMB`。
4. 保存后逐条远程回读；FormEngine 会排队重载 SaaS 运行配置，再用真实小文件上传做生效冒烟。只看到 MCP 返回“更新成功”不算验收。
5. 提高每日配额保留当天已用计数，剩余额度为新上限减已用量。计数按 UTC 日期，失败上传不退款；除非用户明确授权事故处置，不得删除 Redis 配额 Key。

租户 MCP 只能调整业务层配置；平台固定灾难保护、HTTP/Multipart/Form 解析上限和反向代理上限不能通过 `sys_osclients` 绕过。写入 `sys_osclients` 属于控制面操作，只允许当前租户的 `Level >= 9999` 管理身份，并且必须保留 MCP 审计与写后回读。

### UniApp / H5 客户端直传路径规则

移动端通过 `/api/HDFS/UniappUpload` 上传时，前端必须走 `microi.v8.js` 的 `V8.uploadFile`，不要在页面里手写 `uni.uploadFile`。客户端上传的 `Path` 与服务端 `V8.Method.Upload` 示例不同，必须是安全相对路径：

- 正确：`mall/pay-proof`、`mall/member/avatar`、`order/proof`
- 错误：`/mall/pay-proof`、`https://...`、`C:\...`、`../x`、`mall//x`、`~x`
- multipart 请求不能带 `Content-Type: application/json`，否则后端可能读不到 `Path` 表单字段并返回“移动端文件上传路径不合法！”
- `OsClient` 只能保留一个规范字段，避免同时提交 `OsClient`、`osclient` 或 query/header/formData 多处互相冲突。
- 生产 H5 不能只依赖 `uni.uploadFile`。页面从 `uni.chooseImage` 得到的 `tempFiles[0].file`、`tempFiles[0]`、`blob:` / `data:` 临时路径都要传给 `V8.uploadFile`，并设置 `preferFetch:true`；SDK 必须能用 `fetch + FormData` 兜底，否则线上可能报 `未找到 MicroiV8 上传适配器。`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-003 sha256=5765949bee76ce3ccd05503174ff7601135f1d330f8c11a2bf5f268cdeb74133 -->
## 跨平台文件同步登录会话

文件柜、文件同步等需要连接另一套 Microi API 的工具，必须把远程平台视为独立登录会话：

- 用户必须先完成远程登录，登录成功后显示远程用户名称、帐号、ApiBase、OsClient 和登录状态，并提供明确的退出登录操作。
- 历史远程连接通过 `mci_` 前缀表保存，并按 `V8.CurrentUser.Id` 做行级隔离；不得把帐号、密码或 Token 放入 `localStorage`。
- 密码和 Token 只能由受保护的接口引擎写入、读取和清理。数据库必须保存可校验的加密密文，普通 FormEngine 列表不得返回密文字段。
- 加密密钥优先使用租户专用 `FileCabinetSecret`，可使用仅后端可见的持久化租户密钥兜底；禁止使用进程级临时密钥，否则服务重启后无法解密历史连接。
- 历史连接列表只返回脱敏元数据；一键重连时再按记录 Id 和当前用户读取凭据。删除连接必须同时清除保存的密码和 Token。
- 远程目标登录后必须调用文件柜能力探针（如 `mci_file_sync_capability`）检查同步协议版本。接口不存在、返回 404/非标准结果或协议版本过低时，提示目标平台更新【文件柜】应用，不得继续同步。
- 验收至少覆盖：登录成功显示身份、退出后 Token 清空、历史连接一键重连、删除连接、密文落库、服务重启后仍可解密、目标平台缺少能力接口时的升级提示。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-004 sha256=176fe6d254d2cff9d3dcb4b8620888243d3881704ca1432bbff023c9c553cb74 -->
## 下载远程文件并存到 HDFS

```javascript
// 1) 下载远程图片
var resp = V8.Http.GetResponse({ Url: V8.Param.imageUrl });
if (resp.StatusCode !== 200) return { Code: 0, Msg: '下载失败' };

// 2) 转 base64 后上传到 HDFS
var base64 = System.Convert.ToBase64String(resp.RawBytes);
var fileName = V8.Method.NewGuid() + '.png';

var upResult = V8.Method.Upload({
  FilesByteBase64: { [fileName]: base64 },
  Limit: false,
  Path: '/imported',
  OsClient: V8.OsClient
});

return upResult;
```

> 在 V8/Jint 中避免把 `resp.RawBytes` 直接塞进 `FilesByte`；序列化时可能变成数字/浮点数组，导致 `Unexpected token when reading bytes`。更稳的是 `System.Convert.ToBase64String(resp.RawBytes)` 后使用 `FilesByteBase64`。

移动端公开图片优先使用 `.jpg` / `.png` / `.webp`。如果上传 `.svg`，必须确认对象存储返回正确 `Content-Type: image/svg+xml`，否则浏览器可能拦截或不渲染。

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-公有桶-vs-私有桶.md](references/progressive-01-公有桶-vs-私有桶.md)：公有桶 vs 私有桶；接口直接响应文件（下载/导出）；通过 URL 列表批量下载并入库
- [references/progressive-02-office-文件在线编辑版本号规则.md](references/progressive-02-office-文件在线编辑版本号规则.md)：Office 文件在线编辑版本号规则；ImgUpload / FileUpload 字段值兼容规则；安全注意
<!-- microi-progressive:end -->
