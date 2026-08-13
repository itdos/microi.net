# v8-file-upload 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-file-upload-005 sha256=431aed9f824e7a604e8e1e02e03404cc4940814f352e6afd3f7639a106d1f332 -->
## 公有桶 vs 私有桶

### 应用商城 ZIP

应用商城的 AI 应用/微服务资产禁止逐文件 Base64 持久化到数据库。源码/安装包场景可以生成 ZIP；真实在线编译目录优先使用下节的 MCP 流式发布。数据库只保存路径和校验元数据。

在线商城安装的后台任务只传 `StoreId/StoreApiBase/StoreOsClient` 等定位信息，不能复制整行、`Form/Row/Btn` 或 `AppPakcet`。兼容旧 Base64 包的导入器必须按片限制真实上传数量/体积，片间靠已提交的 `AppId + FilePath + Hash` 复用；上传后统计大小优先使用包内 `Size/Sha256`，禁止再次 `FromBase64String` 构造完整字节数组。

```javascript
var zipResult = V8.Method.CreateZip({
  Entries: [
    { Path: 'index.html', Content: '<html></html>' },
    { Path: 'assets/app.js', FileByteBase64: jsBase64 }
  ],
  MaxFileCount: 20000,
  MaxEntryBytes: 268435456,
  MaxTotalBytes: 2147483648
});

var extractResult = V8.Method.ExtractZip({
  FileByteBase64: zipBase64,
  MaxFileCount: 20000,
  MaxCompressionRatio: 200
});
```

`System.IO` 在 Jint 沙箱中被禁止，不能在 V8 代码里直接构造 `MemoryStream/ZipArchive`；必须使用以上受控方法。

### AI 应用编译目录流式发布（首选）

发布 Web、UniApp、MicroService 的 `dist` / H5 编译目录时，必须优先使用 `microi_publish_application_directory_stream`，不要把每个文件读成 Base64 后传给 `ai_app_build`、`microi_publish_microservice` 或普通 JSON 接口。旧工具仅为小文件兼容保留。

标准流程：

1. 先运行不带 `confirmExecution` 的预检。MCP 按流计算 SHA-256，拒绝符号链接、`.git`、`node_modules`、密钥/`.env`、路径穿越、超过 20000 个文件或超过 20 GB 的垃圾目录；默认不发布 `.map`。
2. 确认后把 `confirmExecution` 精确设为 `appIdOrKey`。每个文件通过 multipart 原始流进入 `/api/V8Engine/UploadApplicationAssetStream`，不构造整文件 `Buffer`、Base64 或 JSON 文件体。
3. 文件只写不可变版本目录。全部成功后，清单确认接口只接收 `Path/Sha256/Size`，由 HDFS Provider 的 `CopyObject` 在服务端复制到 root 与 `latest`；非入口先复制，入口最后复制。
4. 历史版本 URL 保留语义版本；分享/在线使用 URL 使用不含版本号的 root 稳定地址。重试必须复用同一版本与摘要，不能覆盖已有但缺少完整性证明的历史对象。
5. 该控制面只允许当前 Token 租户的 `Level >= 9999` 交互式管理员；访问密钥会话不得发布。单文件、HTTP/Multipart 和每日额度仍然生效，不能把“使用流”理解成无限上传。

几十 MB **不是** Jint 或 HDFS 的固定上限。旧链路失败的原因是二进制先膨胀为约 `4/3` 的 Base64，又在 JSON、Jint 字符串、.NET 字符串/字节数组之间产生多份累计分配；文件数量、并发和当前进程内存共同决定触发点。描述问题时必须明确“旧 Base64/Jint 发布链路的累计分配”，不得写成“几十 MB 就达到 Jint 硬上限”。HDFS 上传本身应走二进制流。

```json
{
  "appIdOrKey": "flower-store",
  "versionNo": "v1.2.0",
  "directory": "D:/build/flower-store/dist",
  "entryPath": "index.html",
  "changeSummary": "修复移动端布局",
  "confirmExecution": "flower-store"
}
```

底层断点式单文件工具是 `microi_upload_application_asset_stream`。除诊断或精确恢复单文件外，不要只调用它而遗漏最终清单确认，否则稳定入口不会切换。

| 类型 | `Limit` | 访问 URL | 用途 |
|------|---------|---------|------|
| 公有桶 | `false` | 直接拼接 `V8.SysConfig.FileServer + Path` | 产品图、Banner、公开文档 |
| 私有桶 | `true` | 必须用 `V8.Method.GetPrivateFileUrl` 获取临时 URL | 合同、身份证、敏感数据 |

### 默认 MinIO 桶名与安装验收

- Microi 一键安装的默认私有桶固定为 `mci-private`，默认公有桶固定为 `mci-public`；禁止使用 `mci-publish` 等近似名称。
- `MinIOEndPointInternet` / `MinIOPrivateEndPoint` 同时兼容 `host:port` 与 `http(s)://host:port`。Provider 必须先归一化为 Host、Port、UseSsl，再调用 MinIO SDK 的 host/port 重载；不得把包含协议的整串 URL 直接作为 hostname，否则会出现 `Invalid URI: The hostname could not be parsed.`。显式 URL 的协议优先于历史 SSL 开关；端点禁止携带用户名密码、桶路径、查询或片段。
- 安装脚本创建 `mci-public` 后必须设置匿名下载权限，并把 `HDFS=MinIO`、内外网端点、AccessKey/SecretKey、`MinIOPrivateBucketName=mci-private`、`MinIOPublicBucketName=mci-public` 同步写入当前租户的 `sys_osclients`。
- 安装脚本还必须同步当前有效 `sys_config`：`ApiBase` 使用对外可访问的 API 端口，`FileServer` 使用 `http://<访问IP>:<MinIO API端口>/mci-public`。`ApiBase` 不能误用 Web 前端端口，因为 V8 代码会直接在其后拼接 `/api/...` 或 `/apiengine/...`。
- 安装验收必须使用真实登录 Token 分别执行一次 `Limit=false` 和 `Limit=true` 上传：公有文件匿名访问应返回 `200`，私有文件匿名访问应返回 `403`，私有文件通过签名 URL 访问应返回 `200`，并核对下载内容与上传内容一致。

### 复盘：签名 HEAD 被代理转换为 GET 导致上传后回读误报

- 触发场景：`PutObject` 已返回成功、对象可通过 GET 下载，但公有桶和私有桶的上传后 `StatObject` 均对桶根路径返回 `AccessDenied`；常见于启用严格回读校验后，MinIO Endpoint 前的 Nginx 同时启用了缓存与默认的 `proxy_cache_convert_head on`。
- 根因判断：S3 SigV4 的签名包含 HTTP 方法；代理把客户端签名的 HEAD 转为上游 GET 后会造成签名不一致。另一个可能原因是对象级凭据缺少桶级 `ListBucket` / `GetBucketLocation` 权限，因此不能只凭 `AccessDenied /bucket/` 推断对象未落盘，也不能把空 Region 当作唯一原因。
- 通用规则：优先在 MinIO 代理位置设置 `proxy_cache_convert_head off`；若仍使用缓存，缓存键需区分 `$request_method`。平台不得跳过上传后回读：当 HEAD/Stat 失败时，使用同一凭据生成签名 GET，并以 `Range: bytes=0-0` 回读；禁用重定向，非空对象必须同时验证期望总长度与首字节，空对象验证长度为零，`404` 判不存在，`403`、网络错误和证据不足继续失败关闭。禁止记录或返回带签名查询参数的 URL。
- 配置边界：只有实时回读证明 Endpoint、桶名、Region 或凭据确实错误时才修改 SaaS 配置；对象 GET 正常而仅 HEAD 失败时应修复代理或兼容回读路径，不能猜测内网地址、降低校验强度或轮换正常凭据。
- 自动化检查：覆盖签名 GET 的单字节 Range、期望总长度、首字节实际读取、空对象、长度不符、重定向、`403` 和 `404`；真实环境同时验证公有桶与私有桶的 `Put -> Range GET -> 内容一致`，并对比相同签名在 GET 与 HEAD 方法下的响应。

### 复盘：旧空库缺少可选字段导致 MinIO 初始化后中断

- 触发场景：MinIO 容器、私有桶和公有桶均已成功创建，但安装器更新 `sys_osclients` 时因旧库缺少 `NetworkIsInternet` 返回 `Unknown column`，整套安装停在 API 部署之前。
- 根因：安装器在 API/Upgrade 尚未启动时依赖了并非 MinIO 必需、且存量数据库不保证存在的旧可选字段；同时只按 `OsClient` 更新且没有写后回读。
- 通用规则：MinIO 安装前先校验真正必需的物理字段，并按 `OsClient + OsClientType + OsClientNetwork + IsEnable + IsDeleted` 唯一定位运行租户。内外网端点由 API 允许的启动项 `OsClientNetwork` 选择，安装器不得再写 `NetworkIsInternet`；配置更新后逐字段回读一致才继续。
- 恢复规则：桶初始化成功而配置写入失败不需要删除桶或数据卷。中断的新安装应先备份现有 Compose 并记录绑定数据目录，只对对应编排执行不带 `-v` 的 `docker compose down`，保留数据恢复点后再使用最新版脚本；禁止直接删除数据库或对象存储目录。
- 自动化检查：用一个不含 `NetworkIsInternet`、但包含 MinIO 必需字段的临时 MySQL 表执行 schema、唯一租户、UPDATE 和回读闭环；再插入重复三参数租户，断言安装器失败关闭且不批量覆盖。

### 复盘：MinIO 已可上传但系统设置仍指向官方地址

- 触发场景：一键安装和桶初始化均成功，用户手工上传也成功，但读取系统设置时发现 `ApiBase`、`FileServer` 仍是空库模板中的官方地址。
- 根因：安装流程只回写了 `sys_osclients` 的 MinIO 配置，没有同步前端和 V8 公共使用的 `sys_config` 地址字段。
- 通用规则：数据库还原并创建默认桶后，必须按安装模式选择的访问 IP 和动态端口同时回写有效 `sys_config.ApiBase/FileServer`；其中 `ApiBase` 指向 API 服务，`FileServer` 指向公有桶根地址。
- 自动化检查：安装完成后通过 `GetSysConfig` 回读两个字段，断言均使用本次访问 IP 和实际端口；再执行公有上传并使用 `FileServer + Path` 匿名下载，内容必须一致。

公开页面图片（首页 banner、商品主图、公开活动头像等）应返回公有 URL，例如 `V8.SysConfig.FileServer + Path`。不要把公有图片统一转成 `GetPrivateFileUrl` 的 `static-private` 签名地址；部分 H5/浏览器会因响应头或跨域策略触发 ORB/CORS 拦截，表现为 uni-app `<image>` 内层 `background-image: none`。

### `sys_user.Avatar` 固定使用私有桶

- `sys_user` 是内部系统用户表，`Avatar` 可能暴露员工身份信息，因此字段配置必须保持 `ImgUpload.Limit=true`，上传端也必须显式传 `Limit:true`；自定义用户管理页不能因为绕过表单引擎而回退到公有上传。
- 数据库继续只保存租户内相对路径，例如 `/tenant_demo/avatar/20240218/user.png`。历史公有头像迁移时，应把同一文件复制到私有桶的同一路径，确认私有对象可访问后再停用公有访问；不得为了迁移批量改写路径或制造重复日期目录。
- PC、移动端、聊天、工作流等任何页面渲染 `sys_user.Avatar` 时，禁止 `FileServer + Avatar`、`GetServerPath(Avatar)` 或把相对路径直接交给 `<img>`。前端应调用 `DiyCommon.GetUserAvatarUrl(avatar, userId)`，接口/V8 应调用 `V8.Method.GetPrivateFileUrl({ FilePathName: avatar })`，并为临时 URL 设置短期缓存与失败占位图。
- `ContactUserAvatar`、`FromUserAvatar`、`SenderAvatar` 等从 `sys_user.Avatar` 派生的快照字段同样按私有路径处理；消息数据只保存原始相对路径，不能把会过期的临时 URL 持久化到数据库。

#### 复盘：字段改私有后卡片仍访问公有桶

- 触发条件：把 `sys_user.Avatar` 改为 `Limit=true`，但模块卡片仍配置 `TableCardImgField=Avatar`。
- 根因：通用卡片渲染器只读取了字段值，没有读取图片字段的 `Config.ImgUpload.Limit`，仍统一调用 `GetServerPath/FileServer`。
- 修复规则：通用图片渲染器必须同时检查字段配置；私有字段先异步换取临时地址，`sys_user.Avatar` 还要有表名+字段名语义兜底，避免元数据缓存短暂陈旧时泄露到公有路径。
- 验收断言：筛选一条有头像的系统用户，页面中 `/tenant_demo/avatar/` 的直接公有请求数必须为 0，私有代理图片 `naturalWidth > 0`，并同时验证无头像占位图不报错。

定制移动端项目的 Hero、Banner、音频、视频、字体等大资源也应优先上传到目标租户公有 HDFS，再通过 FileServer/CDN 引用；小型导航图标和离线关键素材才保留在主包。上传前可适度压缩，但必须在多尺寸截图或试听/试播中确认质量，禁止以明显失真换取包体扫描通过。完整移动端规则见 `microi-uniapp-frontend/SKILL.md`。

后台 `ImgUpload` 字段通常保存相对路径或 JSON：接口返回给移动端前先解析出 `Path`，再按公私有场景转换 URL：

```javascript
function publicFileUrl(path) {
  if (!path) return '';
  if (/^https?:/i.test(path)) return path;
  return String(V8.SysConfig.FileServer || '').replace(/\/+$/, '') + '/' + String(path).replace(/^\/+/, '');
}
```

### 私有桶临时 URL

```javascript
var url = V8.Method.GetPrivateFileUrl({
  FilePathName: '/private/contract/2024/abc.pdf',
  OsClient: V8.OsClient,    // 可选，默认当前
  Expires: 600              // 可选，过期秒数
});
// 后端审计代理 URL，过期不可访问；真实对象存储签名 URL 不会返回前端
```

- 普通客户端调用 `/api/HDFS/GetPrivateFileUrl` 时，不能只提交 `FilePathName`，必须同时提交 `FormEngineKey`、`FormDataId`、`FieldId`、`SysMenuId`。服务端校验菜单、菜单绑定表、记录数据范围、字段归属以及字段值确实引用该路径后，才签发临时票据。
- `FieldId` 必须属于目标表，且组件为 `FileUpload` 或 `ImgUpload`；`SysMenuId` 必须是当前用户真实拥有、并绑定目标表的菜单。
- 普通用户禁止通过该入口直接取得私有文件 `Byte` / `Stream`。签发失败时不能回退裸路径、真实对象存储签名地址或公有 URL。
- 私有文件访问必须经过后端短期票据代理：签发链接时记录当前登录用户，实际 `GET/HEAD` 打开或下载时再记录一次访问行为；支持 `Range` 流式响应，并对同一次分片请求做短时去重，不能把文件完整读入内存。
- 审计代理由平台后端回源对象存储，必须使用服务端内网端点生成上游地址，不能先生成公网 MinIO 签名地址再让后端绕公网回源。否则同一对象经内网上传成功后，可能在公网端点表现为 404。
- 备份包、安装包、导出包等重要大文件不能只信任 `PutObject` 成功响应；必须在写入后通过同一私有桶和内网端点执行 `ObjectExist` 回读（可行时再核对大小或 SHA-256），通过后才能把业务记录标记为完成。
- 平台任务若绕过 `V8.Method.Upload` 直接使用底层 `PutObject`，必须保证写入对象键与后续 `V8.Method.GetPrivateFileUrl` 的租户前缀规则一致。像 `/database-backups/` 这种服务端保留目录只能做严格白名单规范化，禁止对普通租户文件泛化去除 `/{OsClient}/` 隔离前缀。
- 下载验收至少对新签发地址执行一次 `Range: bytes=0-0`，断言返回 `200/206`、内容长度大于 0 且不是 JSON 错误；完整交付再核对下载字节数或 SHA-256。若产品要求保留当前业务页，应在新浏览上下文打开代理地址，并在浏览器拦截弹窗时给出品牌化反馈。
- 用户把私有链接转发给别人后，接收者没有有效登录身份时按“匿名访问”记录，禁止根据签发人猜测实际访问人；票据仍按原有效期失效。
- 代理创建或包装失败时必须失败关闭，不得退回未经审计的真实签名 URL；行为日志中也禁止保存真实签名 URL、Token、Authorization 或存储密钥。
- `Limit:false` 的公有文件允许通过 CDN/公有桶直接访问，不要求记录用户行为日志，也不要为了审计强制改走私有代理。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-006 sha256=8d4fedab2418c7df7973b78d4b9d6c5fa77907929d401800689cd1b5b468f32f -->
## 接口直接响应文件（下载/导出）

接口引擎需要在配置中开启【**响应文件**】选项，然后返回特殊结构：

平台后端会统一处理响应文件：图片和 PDF 自动 `inline` 在浏览器中打开，其它类型默认下载；PDF、PNG、JPEG、GIF、WebP、AVIF、BMP、TIFF、ICO、SVG 等常见可预览类型会自动校验文件头。V8 代码不要手写复杂的文件头判断，只需要保证 `ContentType` 与真实文件内容一致。

```javascript
// 模板：导出 Excel
var excelResult = V8.Office.ExportExcel({...});
return {
  Code: 1,
  Data: {
    FileName: 'export_' + DateNow('yyyyMMdd_HHmmss') + '.xls',
    ContentType: 'application/vnd.ms-excel',
    FileByteBase64: System.Convert.ToBase64String(excelResult.Data)
  }
};

// 模板：返回图片
var resp = V8.Http.GetResponse({ Url: 'https://example.com/img.png' });
return {
  Code: 1,
  Data: {
    FileName: 'img.png',
    ContentType: 'image/png',
    FileByteBase64: System.Convert.ToBase64String(resp.RawBytes)
  }
};

// 模板：返回 PDF（浏览器直接预览；后端自动校验 %PDF- 文件头）
var pdfResp = V8.Http.GetResponse({ Url: 'https://example.com/report.pdf' });
return {
  Code: 1,
  Data: {
    FileName: 'report.pdf',
    ContentType: 'application/pdf',
    FileByteBase64: System.Convert.ToBase64String(pdfResp.RawBytes)
  }
};
```

常用 ContentType：
- `application/vnd.ms-excel` / `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `application/pdf`
- `image/png` / `image/jpeg`
- `application/octet-stream`（通用二进制）

注意：如果远程系统返回的是错误页、登录页、业务容器格式（例如金蝶 PLM 电子仓 `KD_C_PLM`、或其它文件头不是 `%PDF-` 的伪 PDF），不要在 V8 里伪装成 PDF。后端会返回 JSON 错误，包含 `ExpectedFirstAscii`、`ActualFirstAscii`、`ActualFirstHex`、`Length`，按这些信息排查上游下载接口。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-file-upload-007 sha256=59ebcaa605d26def44cd027c0975a01fffee8670a890b4ed18b4138527be8a1b -->
## 通过 URL 列表批量下载并入库

```javascript
var urls = V8.Param.urls;  // ['https://...', 'https://...']
var savedPaths = [];
for (var i = 0; i < urls.length; i++) {
  try {
    var resp = V8.Http.GetResponse({ Url: urls[i], Timeout: 30 });
    if (resp.StatusCode !== 200) continue;

    var base64 = System.Convert.ToBase64String(resp.RawBytes);
    var fileName = V8.Method.NewGuid() + '.bin';
    var up = V8.Method.Upload({
      FilesByteBase64: { [fileName]: base64 },
      Limit: false,
      Path: '/batch-import/' + DateNow('yyyy-MM-dd'),
      OsClient: V8.OsClient
    });
    if (up.Code === 1) savedPaths.push(up.Data[0].Path);
  } catch (ex) {
    console.error('第' + (i + 1) + '个下载失败：' + ex.message);
  }
}
return { Code: 1, Data: savedPaths };
```

<!-- /microi-progressive:chunk -->
