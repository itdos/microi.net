---
name: v8-file-upload
description: Microi V8 文件上传下载指南。用于处理 V8.FilesByteBase64、V8.Method.Upload、私有文件 URL、文件响应、HDFS、OSS、MinIO 和 S3 存储。
---

# Microi V8 文件上传下载

你正在为 Microi 吾码平台编写文件上传/下载/返回相关代码。平台分布式存储（HDFS）支持阿里云OSS、MinIO、亚马逊S3，存储方案由 SaaS 引擎按租户配置。

## 核心 API

| API | 说明 |
|-----|------|
| `V8.FilesByteBase64` | 接收上传时携带的文件字典 `{ FileName: base64 }` |
| `V8.Method.Upload({...})` | 服务端上传文件到 HDFS（推荐） |
| `V8.Method.GetPrivateFileUrl({FilePathName})` | 生成私有桶临时访问 URL |
| `V8.Http.GetResponse({Url}).RawBytes` | 下载远程文件为字节数组 |
| 接口返回 `{ FileName, ContentType, FileByteBase64 }` | 接口直接响应文件 |

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
  Limit: false,        // false=公有桶 / true=私有桶（需临时URL访问）
  Preview: false,      // true=自动生成预览图
  Path: '/business/orders',  // 存储路径前缀
  OsClient: V8.OsClient
});

if (upResult.Code !== 1) return upResult;

// upResult.Data = [{ FileName, Path, FullPath, Size, ... }, ...]
var filePath = upResult.Data[0].Path;  // 相对路径，存数据库
var fullUrl  = upResult.Data[0].FullPath;  // 完整 URL（公有桶）
```

### UniApp / H5 客户端直传路径规则

移动端通过 `/api/HDFS/UniappUpload` 上传时，前端必须走 `microi.v8.js` 的 `V8.uploadFile`，不要在页面里手写 `uni.uploadFile`。客户端上传的 `Path` 与服务端 `V8.Method.Upload` 示例不同，必须是安全相对路径：

- 正确：`mall/pay-proof`、`mall/member/avatar`、`order/proof`
- 错误：`/mall/pay-proof`、`https://...`、`C:\...`、`../x`、`mall//x`、`~x`
- multipart 请求不能带 `Content-Type: application/json`，否则后端可能读不到 `Path` 表单字段并返回“移动端文件上传路径不合法！”
- `OsClient` 只能保留一个规范字段，避免同时提交 `OsClient`、`osclient` 或 query/header/formData 多处互相冲突。
- 生产 H5 不能只依赖 `uni.uploadFile`。页面从 `uni.chooseImage` 得到的 `tempFiles[0].file`、`tempFiles[0]`、`blob:` / `data:` 临时路径都要传给 `V8.uploadFile`，并设置 `preferFetch:true`；SDK 必须能用 `fetch + FormData` 兜底，否则线上可能报 `未找到 MicroiV8 上传适配器。`。

## 公有桶 vs 私有桶

### 应用商城 ZIP

应用商城的 AI 应用/微服务资产禁止逐文件 Base64 持久化到数据库。编译产物打成公有 ZIP，源码 ZIP 默认不生成、由发布者逐应用勾选；数据库只保存路径和校验元数据。

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

| 类型 | `Limit` | 访问 URL | 用途 |
|------|---------|---------|------|
| 公有桶 | `false` | 直接拼接 `V8.SysConfig.FileServer + Path` | 头像、产品图、公开文档 |
| 私有桶 | `true` | 必须用 `V8.Method.GetPrivateFileUrl` 获取临时 URL | 合同、身份证、敏感数据 |

### 默认 MinIO 桶名与安装验收

- Microi 一键安装的默认私有桶固定为 `mci-private`，默认公有桶固定为 `mci-public`；禁止使用 `mci-publish` 等近似名称。
- 安装脚本创建 `mci-public` 后必须设置匿名下载权限，并把 `HDFS=MinIO`、内外网端点、AccessKey/SecretKey、`MinIOPrivateBucketName=mci-private`、`MinIOPublicBucketName=mci-public` 同步写入当前租户的 `sys_osclients`。
- 安装脚本还必须同步当前有效 `sys_config`：`ApiBase` 使用对外可访问的 API 端口，`FileServer` 使用 `http://<访问IP>:<MinIO API端口>/mci-public`。`ApiBase` 不能误用 Web 前端端口，因为 V8 代码会直接在其后拼接 `/api/...` 或 `/apiengine/...`。
- 安装验收必须使用真实登录 Token 分别执行一次 `Limit=false` 和 `Limit=true` 上传：公有文件匿名访问应返回 `200`，私有文件匿名访问应返回 `403`，私有文件通过签名 URL 访问应返回 `200`，并核对下载内容与上传内容一致。

### 复盘：MinIO 已可上传但系统设置仍指向官方地址

- 触发场景：一键安装和桶初始化均成功，用户手工上传也成功，但读取系统设置时发现 `ApiBase`、`FileServer` 仍是空库模板中的官方地址。
- 根因：安装流程只回写了 `sys_osclients` 的 MinIO 配置，没有同步前端和 V8 公共使用的 `sys_config` 地址字段。
- 通用规则：数据库还原并创建默认桶后，必须按安装模式选择的访问 IP 和动态端口同时回写有效 `sys_config.ApiBase/FileServer`；其中 `ApiBase` 指向 API 服务，`FileServer` 指向公有桶根地址。
- 自动化检查：安装完成后通过 `GetSysConfig` 回读两个字段，断言均使用本次访问 IP 和实际端口；再执行公有上传并使用 `FileServer + Path` 匿名下载，内容必须一致。

公开页面图片（首页 banner、商品主图、头像等）应返回公有 URL，例如 `V8.SysConfig.FileServer + Path`。不要把公有图片统一转成 `GetPrivateFileUrl` 的 `static-private` 签名地址；部分 H5/浏览器会因响应头或跨域策略触发 ORB/CORS 拦截，表现为 uni-app `<image>` 内层 `background-image: none`。

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

- 私有文件访问必须经过后端短期票据代理：签发链接时记录当前登录用户，实际 `GET/HEAD` 打开或下载时再记录一次访问行为；支持 `Range` 流式响应，并对同一次分片请求做短时去重，不能把文件完整读入内存。
- 用户把私有链接转发给别人后，接收者没有有效登录身份时按“匿名访问”记录，禁止根据签发人猜测实际访问人；票据仍按原有效期失效。
- 代理创建或包装失败时必须失败关闭，不得退回未经审计的真实签名 URL；行为日志中也禁止保存真实签名 URL、Token、Authorization 或存储密钥。
- `Limit:false` 的公有文件允许通过 CDN/公有桶直接访问，不要求记录用户行为日志，也不要为了审计强制改走私有代理。

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

## 跨平台文件同步登录会话

文件柜、文件同步等需要连接另一套 Microi API 的工具，必须把远程平台视为独立登录会话：

- 用户必须先完成远程登录，登录成功后显示远程用户名称、帐号、ApiBase、OsClient 和登录状态，并提供明确的退出登录操作。
- 历史远程连接通过 `mci_` 前缀表保存，并按 `V8.CurrentUser.Id` 做行级隔离；不得把帐号、密码或 Token 放入 `localStorage`。
- 密码和 Token 只能由受保护的接口引擎写入、读取和清理。数据库必须保存可校验的加密密文，普通 FormEngine 列表不得返回密文字段。
- 加密密钥优先使用租户专用 `FileCabinetSecret`，可使用仅后端可见的持久化租户密钥兜底；禁止使用进程级临时密钥，否则服务重启后无法解密历史连接。
- 历史连接列表只返回脱敏元数据；一键重连时再按记录 Id 和当前用户读取凭据。删除连接必须同时清除保存的密码和 Token。
- 远程目标登录后必须调用文件柜能力探针（如 `mci_file_sync_capability`）检查同步协议版本。接口不存在、返回 404/非标准结果或协议版本过低时，提示目标平台更新【文件柜】应用，不得继续同步。
- 验收至少覆盖：登录成功显示身份、退出后 Token 清空、历史连接一键重连、删除连接、密文落库、服务重启后仍可解密、目标平台缺少能力接口时的升级提示。

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

## Office 文件在线编辑版本号规则

当文件上传控件开启【Office 在线预览】、【允许在线编辑】和【开启 Office 文件版本号】时，前后端必须遵循统一版本规则：

- 新上传的 Office 文件（`pdf/doc/docx/xls/xlsx/ppt/pptx`）要立即写入初始版本 `v1.0.0`，字段 JSON 的 `Path` 指向该原始文件，`Version` 为 `v1.0.0`，`Versions[0]` 保存同一份原始文件路径。
- 用户进入 OnlyOffice 在线编辑页后，每次手动点击【保存文件】才生成新版本；第一次保存生成 `v1.0.1`，之后依次生成 `v1.0.2`、`v1.0.3`。
- 未开启版本号时，保存文件直接覆盖当前 `Path` 对应的 HDFS/OSS 源文件。
- 开启版本号时，保存文件必须生成带版本号后缀的新文件，例如 `contract_v1.0.1.docx`，字段 JSON 的 `Path` 指向最新版本，`Versions` 保留历史版本路径。
- 在线 Office 路由和文件上传字段都要能读取 `Versions`，用于右上角切换历史版本预览/编辑。

### OnlyOffice 服务端取文件与匿名预览规则

- OnlyOffice 文档服务器会在服务端再次下载文件。浏览器可以下载但 OnlyOffice 提示“下载失败”时，优先检查生成地址是否为 `localhost/127.0.0.1/内网域名`。
- OnlyOffice 可能先对文档地址发起 `HEAD` 探测。响应文件接口除了 `GET 200`，还必须让 `HEAD` 返回相同的 `Content-Type/Content-Length/Content-Disposition`，不能返回 `405`。
- 私有文件在线预览调用 `GetPrivateFileUrl` 或 `/api/HDFS/GetPrivateFileUrl` 时传 `ForOfficePreview:true`。审计代理应优先使用租户系统配置的公网 `ApiBase`，但仍把真实对象存储签名地址保存在共享 Redis ticket 中，禁止直接返回真实签名地址。
- `/online-office` 可以匿名访问。公有存储模式只允许当前 `OsClient` 目录下的 `filePathName`；接口模式通过 `fileUrl` 接收当前平台正式 `ApiBase`，或由同端口本地后端读取的 loopback `/apiengine/...` 响应文件地址，并要求 URL 显式携带当前 `OsClient`。两种模式都拒绝跨租户、路径穿越和任意第三方 URL；`isPrivate=1` 必须登录。
- 匿名接口引擎预览不要求 V8 代码先上传 HDFS：接口开启【响应文件】和【允许匿名】后，完整地址 URL 编码传给 `fileUrl`，同时传 `fileName/fileType`。页面通过匿名安全中转让当前后端限域读取源文件，并以确定性路径缓存到当前租户公有对象存储；OnlyOffice 只接收公网 `FileServer` 地址。loopback 仅允许同端口本地后端访问，禁止开放任意 URL 代理。
- `canEdit` 只是前端请求参数，不是权限。最终编辑条件必须是“有效登录态 && canEdit=true”；匿名始终只读，不能因 URL 参数放开编辑。
- 匿名预览页隐藏左侧菜单、顶部导航和页签；已登录用户保持原系统布局。
- 匿名导出响应接口应配置频率限制或保证生成逻辑足够轻量，不能让单个公网 URL 无界消耗 CPU/内存；如业务仍需要落盘缓存，缓存事实必须进入共享 Redis/HDFS，不能用进程内变量。

字段 JSON 示例：

```json
{
  "Name": "contract.docx",
  "Path": "/itdos/file/20260622/contract_v1.0.1.docx",
  "Version": "v1.0.1",
  "Versions": [
    { "Version": "v1.0.0", "Name": "contract.docx", "Path": "/itdos/file/20260622/contract.docx", "IsLatest": false },
    { "Version": "v1.0.1", "Name": "contract_v1.0.1.docx", "Path": "/itdos/file/20260622/contract_v1.0.1.docx", "IsLatest": true }
  ]
}
```

## ImgUpload / FileUpload 字段值兼容规则

`ImgUpload` 不能假设只是一种值结构。PC 表单、移动端、旧数据、单图/多图、公开/私有桶会混合出现以下格式：

| 场景 | 可能的值 |
|------|----------|
| 空值/占位 | `''`、`null`、`undefined`、`'[]'`、`'null'`、`'正在上传中...'` |
| 旧单图 | `'/upload/xxx/a.png'`、`'https://cdn/a.png'` |
| 新单图 | `{ Path, Name, Size, Id, State }` 或 JSON 字符串 `'{"Path":"..."}'` |
| 多图 | `[{ Path, Name, Id, State }]` 或 JSON 字符串 `'[{"Path":"..."}]'` |
| 其它兼容字段 | `Path`、`FilePathName`、`FullPath`、`Url`、`url`、`src` |

任何端（PC、uni-app、H5、小程序）渲染图片前都必须先做“归一化 -> 取 Path -> 转最终 URL”，不要直接 `JSON.parse` 后只处理数组，也不要直接把字段值拼到 `FileServer`。

推荐归一化：

```javascript
function normalizeUploadValue(value) {
  if (value == null || value === '' || value === 'undefined' || value === 'null') return [];
  if (value === '正在上传中...' || value === '[]' || value === '[ ]') return [];

  var raw = value;
  if (typeof raw === 'string') {
    var s = raw.trim();
    if ((s.indexOf('{') === 0 || s.indexOf('[') === 0)) {
      try { raw = JSON.parse(s); } catch (e) { raw = s; }
    } else {
      raw = s;
    }
  }

  if (Array.isArray(raw)) {
    return raw.map(normalizeUploadItem).filter(function (it) { return !!it.Path; });
  }

  var one = normalizeUploadItem(raw);
  return one.Path ? [one] : [];
}

function normalizeUploadItem(item) {
  if (!item) return {};
  if (typeof item === 'string') {
    return { Path: item, Name: item.split('/').pop() || item, State: 1 };
  }
  if (typeof item === 'object') {
    var path = item.Path || item.FilePathName || item.FullPath || item.Url || item.url || item.src || '';
    return {
      Id: item.Id || item.id || '',
      Name: item.Name || item.FileName || item.name || (path ? String(path).split('/').pop() : ''),
      Size: item.Size || item.size || '',
      CreateTime: item.CreateTime || item.createTime || '',
      State: item.State == null ? 1 : item.State,
      Path: path
    };
  }
  return {};
}
```

公开图片 URL 解析原则与 `Microi.Client/src/utils/diy.common.js` 的 `GetServerPath` 一致：

```javascript
function publicUploadUrl(path) {
  if (!path) return '';
  var s = String(path).trim();
  if (!s || s === '正在上传中...') return '';
  if (s.indexOf('.') === 0) return s;              // ./static/img/loading.gif 等本地静态资源
  if (/^(https?:|data:|blob:)/i.test(s)) return s; // 已经是最终 URL
  if (s.indexOf('{') === 0 || s.indexOf('[') === 0) {
    var list = normalizeUploadValue(s);
    s = list.length ? list[0].Path : '';
  }
  if (!s) return '';
  return String(V8.SysConfig.FileServer || '').replace(/\/+$/, '') + '/' + s.replace(/^\/+/, '');
}
```

私有桶（`Limit === true`）不要拼 `FileServer`，必须把归一化后的 `Path` 传给 `V8.Method.GetPrivateFileUrl({ FilePathName: path })` 或后端签名接口换临时 URL。

## 安全注意

- ❌ 不要让前端任意指定 `Path`（路径穿越风险），只允许后端固定路径
- ❌ 不要不校验文件类型 / 大小：根据 ContentType + 后缀双重校验
- ❌ 敏感文件（合同、身份证）必须用私有桶 `Limit: true`
- ✅ 公有桶 URL 可缓存到前端，私有桶临时 URL 每次重新生成
- ✅ 删除数据时同步清理 HDFS 文件（避免存储泄漏）
- ✅ Excel/PDF 等导出文件通过【响应文件】配置返回，不要拼接到 JSON 数据里

### 复盘：ZIP 发布端与安装端 SHA256 口径不一致

- 触发场景：应用包已成功生成 ZIP 和摘要，但安装端下载 ZIP 后调用不存在的哈希辅助函数，或尝试通过当前 V8 环境不可用的 `.NET SHA256.Create()` 校验，导致安装中断。
- 根因：发布端实际使用 `V8.EncryptHelper.Sha256Hex(FileByteBase64)`，安装端却按原始字节设计了另一套实现，函数名称、输入数据和运行时能力均未对齐。
- 通用规则：文件摘要必须在包清单中记录算法和输入口径；当前应用 ZIP 统一使用 `SHA256-Base64Text`，发布端与安装端都对同一份 Base64 文本调用 `V8.EncryptHelper.Sha256Hex`。禁止仅凭函数名推测算法，也不要在未验证 V8 互操作能力时直接实例化 `.NET` 加密对象。
- 自动化检查：生成同时包含源码 ZIP、编译 ZIP 的应用包，再从官方地址下载并安装；分别篡改 Base64 文本和摘要，正常包应安装成功，两个篡改包都必须在解压前被拒绝。
