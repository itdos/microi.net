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

| 类型 | `Limit` | 访问 URL | 用途 |
|------|---------|---------|------|
| 公有桶 | `false` | 直接拼接 `V8.SysConfig.FileServer + Path` | 头像、产品图、公开文档 |
| 私有桶 | `true` | 必须用 `V8.Method.GetPrivateFileUrl` 获取临时 URL | 合同、身份证、敏感数据 |

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
// 临时 URL，过期不可访问
```

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
