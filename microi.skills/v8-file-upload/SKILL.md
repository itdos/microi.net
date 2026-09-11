---
name: v8-file-upload
description: Microi V8 与 MCP 文件上传下载指南。用于处理流式 AI 应用发布、V8.FilesByteBase64、V8.Method.Upload、私有文件 URL、文件响应、HDFS、OSS、MinIO 和 S3 存储。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 文件上传下载

你正在为 Microi 吾码平台编写文件上传/下载/返回相关代码。平台分布式存储（HDFS）支持阿里云OSS、MinIO、亚马逊S3，存储方案由 SaaS 引擎按租户配置。

公开入口覆盖 `V8.uploadFile`、多文件 `V8.uploadFiles` 与 MCP `microi_upload_file_base64`。多文件上传必须限制并发、逐文件返回结果；Base64 工具只接受明确文件名、大小和租户内目标范围，写后回读路径、大小与哈希。

## 表单字段的公有桶与私有桶（强制）

### 旧上传返回与接口引擎扩展

- 系统设置 `CompatiblePlatformOldVersion` 默认关闭，空值/缺字段也关闭；开启时旧 HTTP 上传
  保留 `Code/Data`，单文件也统一返回数组（包括 `Multiple=false`），补 `url/type/size/duration/uploading/progress/path/name/id`。
  图片 `type=image`，名称去掉最后一个扩展名；`url` 必须沿用实际 `Url`，不能把私有文件改拼公有地址。
- `/api/HDFS/upload`、`/api/Upload`、`/apiengine/platform-hdfs-upload` 使用当前租户上传引擎。
  只有主库确认完整地址、别名及固定 Key 缺失才执行编译兜底；禁用、StopHttp、拒绝或异常不兜底。
- `V8.Method.UploadCurrentRequestAsync()` 复用已验证的当前请求文件流，重复调用只上传一次；
  `V8.Method.IsLegacyUploadCompatibilityEnabled()` 读取宿主取得的开关，二者均不接受参数。
  它们绑定当前租户与选定引擎，普通脚本或嵌套其它引擎不能借用；无请求时使用原有 `V8.Method.Upload`。
- 返回编排由系统设置应用拥有的 Managed `platform-hdfs-upload` 实现；持久定制使用
  CreateIfMissing `platform-hdfs-upload-hook`，返回 `{Code:1, UploadResult:完整结果}`。
  先用 `JSON.parse(JSON.stringify(V8.Param.Result))` 转为普通 JS 对象，再判断 `Data` 数组并遍历追加字段；不能直接对 CLR 包装对象使用 `Array.isArray` 或 `length` 分支。
  系统设置及基础空库包都交付可空字段，但上传引擎只由系统设置包拥有；不携带租户开关值。
- MCP 复用 `microi_add_field`、`microi_update_field`、`microi_create_engine`、
  `microi_save_engine_code` 和管理员回读；验收分别覆盖真实上传、配置缓存、引擎优先、缺失及错误分支。

- `ImgUpload`、`FileUpload`、`RichText` 的“禁止匿名访问”是字段权威策略：`Limit=false` 写公有桶，`Limit=true` 写私有桶。普通用户只要通过当前菜单/表的新增或编辑动作授权，也必须按该字段配置执行；不得按用户等级把全部非超级管理员上传统一改成私有桶。
- 浏览器上传必须携带 `FormEngineKey + FieldId + SysMenuId`，编辑已有记录再带 `FormDataId`，TableChild 再带父子授权上下文。后端先用 FormEngine 校验动作权限，再从当前租户回读 `diy_field.Component/Config`，用权威 `Limit` 覆盖请求值，并把目录固定为 `ImgUpload→img`、`FileUpload→file`、`RichText→editor`。
- 客户端 `Limit`、`Path`、字段 Id 和菜单 Id 都只是待验证线索。没有可验证字段上下文的普通交互式上传默认私有并限制到安全一级目录；不能为了恢复公有字段语义而重新信任裸 `Limit=false`。
- 兼容旧移动端/定制页面时，在普通系统设置 `sys_config.HdfsUploadRules` 配置目录与角色规则，无需逐个改客户端。`Path` 使用区分大小写的租户内相对路径；`RoleIds` 是真实角色 Id 数组，或显式启用 `AllAuthenticated`；`IncludeSubdirectories` 和 `AllowPublic` 默认关闭。只有后端有效角色命中且显式允许公有，才尊重请求 `Limit=false`。规则不是秘密，不必放入后端私有设置，修改权限与服务端判定必须严格受控。
- 后端 v8.2.9+ 的配置 `Path` 支持 `*`（单层任意字符）、`**`（零到多层目录，须独占层级）、`?`、`[abc]`、`[a-z]`、`[!0-9]`/`[^0-9]`、`{a,b}` 候选及组合；优先 `files/{inspection,quality}/**` 这类最小业务前缀，不能为省事直接向全部用户配置 `** + AllowPublic`。只匹配请求目录，不匹配文件名或服务端追加的年月。实际上传路径不接受通配符；保留目录先于 glob 校验，不能用宽泛规则绕过。最多512字符/规则、4层花括号、32候选、4096令牌；有界动态规划和有界语法缓存不得缓存租户授权结果。先更新全部后端节点再配置新语法，精确旧规则仍兼容。
- 目录规则只扩展无字段上下文上传，不绕过表/菜单/行权限、租户隔离、保留路径、文件类型、内容检测及配额；不能授予访问密钥会话、私有文件读取或应用发布权限。规则通过系统设置共享缓存读取，保存/删除后失效；应用包只发布字段和可空 DDL，禁止附带会覆盖租户规则的配置数据。验收覆盖授权/未授权角色、路径边界、公私桶、禁用用户、跨租户、规则撤销及缓存生效。
- 老 `ImgUpload/FileUpload` 缺失 `Limit` 时兼容为公有；老 `RichText` 缺失上传配置时默认私有。微信待审图片与裁剪/压缩 `_origin` 原图始终私有，字段公有配置不能放宽这些特殊边界。客户端保存与预览必须以上传响应的实际 `Limit` 为准。

## 交互式图片默认压缩（强制）

- `ImgUpload`、PC、UniApp/H5/小程序以及 MCP 普通图片上传在未显式传 `Preview` 时，必须按 `Preview=true` 处理；字段设计器新配置默认开启。只有业务明确要求公开原始画质时才允许显式关闭，不能把“客户端漏传”解释为关闭。
- 默认展示图目标为不超过约 `500 KB`、最长边不超过 `1920 px`；可按真实用途进一步收紧。压缩必须使用 Windows/Linux/容器一致的跨平台实现，并限制输入字节、像素总量与解码并发，避免超大图触发 OOM。
- 压缩流程固定为“先将原始字节写入当前租户 HDFS 私有桶的 `_origin` 对象 → 生成压缩展示图 → 写入目标公有/私有位置 → 回读大小与格式”。即使展示图是公有资源，原图也只能保存在私有桶。
- 压缩、解码或编码失败时必须失败关闭，返回可诊断错误；禁止静默把几十 MB 的未压缩原图发布到公有桶。返回字段中的 `Size` 应表示展示图实际字节数，`OriginalSize` 可用于管理员审计，但业务字段不得保存私有桶真实地址或签名 URL。
- 历史治理只迁移超过目标体积的图片：先为旧对象补齐私有原图副本，再上传压缩展示图、原子更新全部业务引用并逐条回读。确认没有引用后才删除旧公有对象；批量任务要有清单、检查点、幂等映射和失败重试，不能边扫描边不可逆覆盖。

## 表单引擎图片裁剪（强制）

- `ImgUpload.Crop` 支持 `Enabled`、`Mode=free/fixed/select`、`Ratio`、`CustomWidth/CustomHeight`以及 `AllowZoom/AllowRotate/AllowFlip`。`Enabled` 只表示表单用户的默认状态，不得当作裁剪能力总开关；新增/编辑表单把裁剪开关合并到紧凑上传面板，旁边同时显示公有/私有桶、单/多图与最大数量、压缩状态和最大体积。旧字段未配置时该开关默认关闭，但用户仍可主动开启。
- 裁剪弹层必须同时提供“取消本次上传”“不裁剪直接上传”“应用裁剪并上传”三个不同动作。多图选择按队列逐张处理；直接上传只跳过当前图片的裁剪，不能取消或阻塞后续图片。
- 多图模式下后端可能为每个单文件请求返回 `Data: [{...}]`，单图模式返回 `Data: {...}`。PC/移动端必须先归一化对象/数组，再按客户端 `uid` 替换上传占位项并生成预览 URL，禁止把接口成功误显示成空列表。
- 开启裁剪时，前端必须上传最终裁剪图，并在同一 multipart 请求中以 `MicroiOriginalFile` 附带同名、未改动的原图及 `CropEnabled=true`。不得仅传坐标后由后端重演，否则 EXIF 方向、旋转或镜像可能导致前后端结果不一致。
- 后端必须校验裁剪图与原图一一同名，两者字节数都计入单次限制和每日配额，但原图不计为第二个业务文件。未宣告裁剪却传原图、宣告裁剪却漏传/错配原图都要失败关闭。
- HDFS 写入顺序固定为“未改动原图写入私有 `_origin` 对象 → 可选压缩裁剪图 → 写入业务展示图”。裁剪原图写入失败时不得发布展示图；即使 `Preview=false`，裁剪原图仍必须私有保留。不得返回或持久化原图真实路径。

## 富文本图片、视频与附件（强制）

- `RichText.Limit=false` 只用于需匿名长期访问的官网公告、商品详情等公开正文；内部内容用 `true`。普通用户经表单新增/编辑授权后也按后端回读到的该字段配置选择桶；仅修改请求中的 `Limit` 不能改变策略，客户端必须以上传响应的实际 `Limit` 为准。
- RichText 分别配置 `Image`、`Video`、`File` 的 `Enabled/MaxSize/MaxCount`；图片另传 `Preview/CompressMaxSize/CompressMaxWidth`，并继续遵循“原图私有、展示图公有或私有”的压缩链路。附件类型白名单用 `File.Accept` 进一步收紧，不能放宽服务端白名单。
- 私有正文持久化 `/__microi_richtext_private__/...` 稳定对象标识，严禁保存对象存储签名 URL、`OpenPrivateFile` Ticket、DiyToken 或其它会过期的凭据。每次打开记录时携带 `FormEngineKey/FormDataId/FieldId/SysMenuId` 批量换取短效审计代理地址。
- 私有文件后端授权必须重新校验当前租户、菜单、表、行和 RichText 字段，并确认所请求路径精确存在于 `img/video/source.src` 或 `a.href`；普通上传字段的对象/数组只认 `Path/FilePath/FilePathName`，不得递归把 `Name/Size/Metadata` 等任意标量当作路径。未经当前租户 FileServer 主机权威校验的绝对 HTTP(S) URL 不得等价为本地对象 Key；正文文字、`data-src/data-href`、脚本标签和前缀相似路径都必须失败关闭。
- 外部匿名页面没有后台记录权限上下文，不能解析私有标识。公开文章应由设计者把 RichText 字段配置为 `Limit=false`，有该表单新增/编辑权限的用户即可按权威配置发布；不得通过延长私有 URL 有效期模拟公开资源。

官网客户端读取私有文件统一调用 `/apiengine/platform-private-file-url`，提交 `FilePathName` 或有界 `FilePathNames`，并按资源类型提供权威定位参数：普通表单字段使用 `FormEngineKey + FormDataId + FieldId + SysMenuId`；用户头像使用 `ResourceKind=UserAvatar + ResourceId=用户Id`；菜单/部门导入模板分别使用 `MenuImportTemplate`、`DeptImportTemplate` 与对应记录 Id。CAD 私有派生预览使用 `ResourceKind=FormFieldDerivedPreview`，除表单四元组外必须同时提交字段中保存的 `OriginalFilePathName` 和单个派生 `FilePathName`；后端只接受同目录同 basename 的 DWG→`_preview.dxf`、STEP/STP→`_preview.stl` 唯一映射，并在对象存在后签名。文件柜对象使用 `ResourceKind=FileManagerObject`，`ResourceId` 必须与单个 `FilePathName` 大小写精确相同，并提交能力探针返回的当前租户权威 `SysMenuId`；此类签名只允许平台超级管理员 DiyToken 会话，访问密钥和普通菜单用户一律拒绝。后端会从权威字段或对象存储重新读取并精确匹配路径；管理员也不能只传裸路径绕过对象引用，普通客户端禁止换取私有文件原始 Byte/Stream。旧 `/api/HDFS/GetPrivateFileUrl` 与 `/api/HDFS/MallFileUrl` 只保留令牌格式兼容并转发同一 Managed 接口，新代码不得继续引用。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-file-upload-000 sha256=841bb634227ea21cf97abcbee5dc6220042e73139170e6a6c304bfce83274e7a -->
## 核心 API

| API | 说明 |
|-----|------|
| `V8.FilesByteBase64` | 接收上传时携带的文件字典 `{ FileName: base64 }` |
| `V8.Method.Upload({...})` | 服务端上传文件到 HDFS（推荐） |
| `V8.Method.GetPrivateFileUrl({FilePathName})` | 生成私有桶临时访问 URL |
| `/apiengine/platform-private-file-url` | 官网 PC/UniApp 按菜单、记录、字段和对象引用换取私有文件短链 |
| `V8.Http.GetResponse({Url}).RawBytes` | 下载远程文件为字节数组 |
| 接口返回 `{ FileName, ContentType, FileByteBase64 }` | 接口直接响应文件 |

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-001 sha256=bacff382201c915334757946ee60d4a65db4e9663dd9e1f86bb68c1c16589321 -->
## 第三方数据库附件迁移

当第三方表只保存附件路径时，先用 `microi_inspect_external_database` / `microi_query_external_database` 或 `V8.Dbs.<DbKey>` 查询记录。`microi_import_external_attachment` 允许后端已确认的 `Level >= 9999` 当前用户直接提供 HTTP/HTTPS URL、API 节点可读的本机绝对路径或 UNC 路径。

- 导入工具必须显式确认；HTTP、私网、重定向、本机和 UNC 均可访问，但最终能力受 API 服务进程账号、网络、磁盘及对象存储权限约束。
- 下载与上传使用临时文件和文件流，不经过 Base64；不设固定 20/100 MB 上限，`MaxBytes=0` 或省略表示不设置 MCP 上限，可处理 200/500 MB 或更大文件。
- 带签名参数或用户凭据的源 URL、鉴权 Header 和本机/UNC 路径不得出现在结果、日志或目标表；脱敏审计只记录来源 SHA-256、类型和字节数，目标字段只保存吾码租户内相对路径。
- 使用第三方附件 Id/版本作为幂等键，回读目标记录后才标记成功；多节点重投不能重复产生业务附件。
- 写入目标 `FileUpload` 字段前必须回读其权威 `diy_field.Config.FileUpload.Limit`；目标字段为 `Limit=true` 时，迁移上传也必须使用 `Limit=true` 写入私有桶，不得上传到公有桶后仅靠字段路径伪装为私有文件。
- 源附件为空、大小为 `0` 或源对象不可读取时，不得创建目标业务记录并把上传字段保存为 `[]`、`'[]'` 或其它空占位值；应仅在迁移账本中记录为跳过或失败，保留来源 Id、原因和可重试状态。
- 私有附件只有在目标记录回读成功，并使用该记录的权威资源上下文调用 `/apiengine/platform-private-file-url` 取得代理地址，再对该地址执行 `Range: bytes=0-0` 且确认返回 `200/206`、实际读到字节并且不是 JSON 错误后，才允许标记迁移成功；完整验收再核对总字节数或 SHA-256。
- 批量迁移应落任务状态表并分页处理，失败可重试；不要让 MCP 一次加载整库路径或大文件集合。

可信后端 V8 可用 `V8.Http.GetResponse({ Url: url }).RawBytes` 下载，再用 `System.Convert.ToBase64String` 和 `V8.Method.Upload` 上传。该路径同样必须校验域名、大小、Content-Type、后缀和最终重定向目标。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-002 sha256=d55c1a7fce715bf15224a74a2ae3006f38bab04bfe876ad88d9cc064fbe7cb9a -->
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

### AI 应用超大资产断点续传

Unity `Data`、WASM、Windows 安装包、视频模型等发布资产不得进入 Base64、JSON 或 Jint。`microi_publish_application_directory_stream` 在协议 v3 下与 `@microi.net/cli` 共用同一套传输客户端：单文件大于 128 MiB 时自动切换为原始字节断点续传，小文件继续兼容旧版单请求链路。

- 默认分片 16 MiB；5 GiB 文件为 320 片。分片通过 `application/octet-stream` 发送，必须携带精确 `Content-Length` 与 SHA-256。
- 服务端逐片写入 HDFS 后重新流式回读校验；完成时按顺序合并、再次核对整文件 SHA-256，再生成不可变版本完整性标记。
- 会话 Id 由租户、应用、版本、路径和文件摘要确定。网络中断或进程重启后先读取远端状态，只续传缺失分片；已成功的相同摘要请求直接幂等返回。
- 吾码不为协议 v3 设置业务文件/目录字节上限，状态中的 `ApplicationAssetResumableProductSizeLimitBytes=0` 表示没有产品配置上限。每个对象仍受协议技术边界（最多 10000 片、单片最多 1 GiB）、JavaScript 安全整数、对象存储、磁盘、网关和网络条件约束。
- 该链路只允许通过能力鉴权的当前租户超级管理员，并继续受 `DisableFileUpload` 负向总开关控制；它不是普通用户上传或任意 HDFS 路径写入接口。
- 每个会话都在 `mci_ai_app_file` 保留审计记录，`StorageScope=ApplicationAssetMultipartSession`。管理员在 **系统引擎 → 超大文件上传记录** 查看状态、阶段、已传字节/分片、进度、心跳、错误和恢复建议；成功、失败和取消记录都不静默删除。

### 普通业务上传的分层限制

以下限制适用于 HTTP、表单、V8、移动端和旧版应用资产单请求，不适用于上面的受信任 v3 断点续传。Token 不是无限上传授权；普通入口必须在解码 Base64、解析图片或调用对象存储前执行服务端校验：

1. **租户业务配置**：有效正数/布尔值按 `sys_osclients` 当前租户 → 代码默认值解析。租户可以按业务需要提高或降低默认值，不要求安装者维护额外环境变量或修改 `appsettings`。
2. **平台绝对上限**：最终业务值再与代码内固定灾难保护上限取较小值，租户和安装参数都不能放大。
3. **HTTP 解析上限**：Kestrel 请求正文与 Multipart 固定为 2048 MB，普通表单单值固定为 128 MB，是所有租户共享的请求解析硬顶。
4. **字段级限制**：前端 `FileUpload` / `ImgUpload` / `RichText` 的 `MaxSize`、`MaxCount` 等只能与当前租户有效值取更小值，不能提高后端上限，也不能替代服务端校验。

业务配置与固定边界：

| `sys_osclients` 字段 | 代码默认值 | 平台固定边界 |
|---|---:|---:|
| `DisableFileUpload` | `false`（关闭，即允许上传） | — |
| `FileUploadMaxFileMB` | 100 MB | 1024 MB |
| `FileUploadMaxRequestMB` | 200 MB | 2048 MB |
| `FileUploadMaxCount` | 10 | 100 |
| `FileUploadDailyUserQuotaMB` | 2048 MB | 10 TB |
| `FileUploadDailyTenantQuotaMB` | 20480 MB | 10 TB |

- `sys_osclients` 六个现行字段全部可空；`DisableFileUpload` 空值、无效值或 `0/false` 均表示允许上传，只有 `1/true` 才禁止。旧数据库尚未创建新物理字段时才回退读取 `FileUploadEnabled`，升级后旧正向字段即使为 `0` 也不得覆盖新字段的默认允许语义。`FileUploadMaxRequestMB` 指一次上传所有文件的业务合计大小，不等于 Kestrel HTTP 请求正文上限。
- 固定灾难保护和 HTTP/Multipart/Form 解析上限不属于安装配置；租户值即使更大也会被这些边界截断。最终单次总量还不能超过帐号或租户的有效日额度，单文件不能超过最终单次总量。
- `DisableFileUpload=1` 表示禁用当前租户上传，也会阻止 AI 应用资产断点续传；不能把内部发布协议当成绕过开关的后门。普通单请求继续受全局大小硬上限，v3 只移除产品级字节上限；租户配置刷新应走现有 SaaS 引擎重载和共享 Redis 发布订阅，不能依赖单节点内存。
- 帐号与租户每日额度在共享 Redis 中用单次原子脚本预留，支持多节点；Redis 不可用时失败关闭，不能降级成无限上传。
- 额度按 UTC 日期统计。为防并发重试绕过限制，后续对象存储失败也不退还已经预留的额度。
- 每日额度只阻断短期滥用；对象存储必须另外配置租户/桶总容量、账单告警、生命周期与实际用量对账。Redis 计数不能作为长期容量事实源。
- 标准表单字段上传按后端回读的 `diy_field.Config` 决定桶，不能按帐号等级覆盖字段策略。无字段上下文的普通上传默认只允许平台预定义私有一级目录；管理员可通过 `sys_config.HdfsUploadRules` 按真实角色明确扩展业务目录和公有权限，不能信任客户端自报角色或裸 `Limit:false`。源码、应用产物等仍使用独立受控发布流程。
- 反向代理、Ingress/IIS 的请求体上限应与进程级 HTTP 解析硬顶协调。字段自身的类型、后缀、大小和数量配置只能进一步收紧当前租户有效值，不能替代平台硬顶。

### 复盘：“当前租户已停用文件上传”

- 该提示只表示当前运行环境命中的 `sys_osclients.DisableFileUpload` 被明确设置为 `1/true`（或仍在旧库兼容期且 `FileUploadEnabled=0`）。新字段缺列以外的空值、无效值和新租户都按默认允许，不能先把问题归因于 MinIO/HDFS。
- 新版响应同时返回 `DataAppend.ErrorType=TenantFileUploadDisabled`、`OsClient`、`ConfigField=DisableFileUpload`、`ExpectedValue=0` 和文档地址；客户端必须保留后端 `Msg/DataAppend`，不能只显示“上传失败”。
- 处理时先读取当前 API 进程的 `OsClient + OsClientType + OsClientNetwork`，再精确回读同三元组的启用记录并把 `DisableFileUpload` 关闭为 `0`。不能仅按租户名批量覆盖其它网络或环境记录。
- 保存后等待 SaaS 共享配置重载，再分别验证一个小公有图片和一个小私有文件。只有错误转为 endpoint、bucket、签名或 `Invalid URI` 后，才进入对象存储配置排查。
- 不要通过删除 Redis 日额度 Key、扩大文件大小上限或改成公有桶来解除租户停用；这些动作与开关无关，还会扩大安全风险。

### AI / MCP 调整租户上传配额

用户明确授权修改某个租户的上传额度时，AI 可以直接使用标准 MCP 完成，不要把应用层提示误判成阿里云 OSS、MinIO 或 S3 的存储配额，也不要先清 Redis：

1. `microi_get_table_data(tableName: "sys_osclients")` 按 `OsClient`、`IsEnable=1` 查询，选择 `Id/OsClientType/OsClientNetwork`、`DisableFileUpload` 和五个现行 `FileUpload*` 配额字段；`FileUploadEnabled` 只用于诊断未升级旧节点。
2. 先以当前服务器的 `OsClientType + OsClientNetwork` 收窄到实际生效记录；只有用户明确要求多个环境保持一致时才扩展范围。逐条调用 `microi_update_form_data`，`row` 必须包含 `Id`，并传 `confirmExecution: "sys_osclients"`。
3. MB 是存储单位：`20 GB = 20480 MB`。可修改字段为 `DisableFileUpload`、`FileUploadMaxFileMB`、`FileUploadMaxRequestMB`、`FileUploadMaxCount`、`FileUploadDailyUserQuotaMB`、`FileUploadDailyTenantQuotaMB`；不要再写旧 `FileUploadEnabled`。
4. 保存后逐条远程回读；FormEngine 会排队重载 SaaS 运行配置，再用真实小文件上传做生效冒烟。只看到 MCP 返回“更新成功”不算验收。
5. 提高每日配额保留当天已用计数，剩余额度为新上限减已用量。计数按 UTC 日期，失败上传不退款；除非用户明确授权事故处置，不得删除 Redis 配额 Key。

租户 MCP 只能调整普通业务上传配置；平台固定灾难保护、HTTP/Multipart/Form 解析上限和反向代理上限不能通过 `sys_osclients` 绕过。协议 v3 的原始分片不读取普通单请求大小字段，但仍要求能力鉴权、总开关、版本快照、逐片/整文件哈希和审计。写入 `sys_osclients` 属于控制面操作，只允许当前租户的 `Level >= 9999` 管理身份，并且必须保留 MCP 审计与写后回读。

### UniApp / H5 客户端直传路径规则

移动端通过 `/api/HDFS/UniappUpload` 上传时，前端必须走 `microi.v8.js` 的 `V8.uploadFile`，不要在页面里手写 `uni.uploadFile`。客户端上传的 `Path` 与服务端 `V8.Method.Upload` 示例不同，必须是安全相对路径：

- 正确：`mall/pay-proof`、`mall/member/avatar`、`order/proof`
- 错误：`/mall/pay-proof`、`https://...`、`C:\...`、`../x`、`mall//x`、`~x`
- multipart 请求不能带 `Content-Type: application/json`，否则后端可能读不到 `Path` 表单字段并返回“移动端文件上传路径不合法！”
- `OsClient` 只能保留一个规范字段，避免同时提交 `OsClient`、`osclient` 或 query/header/formData 多处互相冲突。
- 生产 H5 不能只依赖 `uni.uploadFile`。页面从 `uni.chooseImage` 得到的 `tempFiles[0].file`、`tempFiles[0]`、`blob:` / `data:` 临时路径都要传给 `V8.uploadFile`，并设置 `preferFetch:true`；SDK 必须能用 `fetch + FormData` 兜底，否则线上可能报 `未找到 MicroiV8 上传适配器。`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-003 sha256=d02dfde4abd2349cd92de1daee129bc08ba42142b5f6229736588cb3e0dbf43c -->
## 跨平台文件同步登录会话

文件柜、文件同步等需要连接另一套 Microi API 的工具，必须把远程平台视为独立登录会话：

- 用户必须先完成远程登录，登录成功后显示远程用户名称、帐号、ApiBase、OsClient 和登录状态，并提供明确的退出登录操作。
- 历史远程连接通过 `mci_` 前缀表保存，并按 `V8.CurrentUser.Id` 做行级隔离；不得把帐号、密码或 Token 放入 `localStorage`。
- 密码和 Token 只能由受保护的接口引擎写入、读取和清理。数据库必须保存可校验的加密密文，普通 FormEngine 列表不得返回密文字段。
- 密码和 Token 使用 `V8.Method.ProtectApiEngineSecret/UnprotectApiEngineSecret`，由宿主把密文绑定当前 `OsClient + ApiEngineKey`；不得从已脱敏的 `V8.OsClientModel` 读取 `AuthSecret/DbConn`，也不得使用进程级临时密钥。接口引擎 Key 必须稳定，确保服务重启和应用升级后仍能解密历史连接。
- 历史连接列表只返回脱敏元数据；一键重连时再按记录 Id 和当前用户读取凭据。删除连接必须同时清除保存的密码和 Token。
- 远程目标登录后必须调用文件柜能力探针 `mci_file_sync_capability` 检查同步协议版本，并使用其 `Data.FileManagerSysMenuId` 作为目标租户权威文件柜菜单；禁止硬编码发布端菜单 Id。接口不存在、未返回菜单 Id、返回 404/非标准结果或协议版本过低时，提示目标平台更新【文件柜】应用，不得继续同步。
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
