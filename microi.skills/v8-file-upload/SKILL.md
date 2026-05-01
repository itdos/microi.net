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

## 公有桶 vs 私有桶

| 类型 | `Limit` | 访问 URL | 用途 |
|------|---------|---------|------|
| 公有桶 | `false` | 直接拼接 `V8.SysConfig.FileServer + Path` | 头像、产品图、公开文档 |
| 私有桶 | `true` | 必须用 `V8.Method.GetPrivateFileUrl` 获取临时 URL | 合同、身份证、敏感数据 |

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
```

常用 ContentType：
- `application/vnd.ms-excel` / `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `application/pdf`
- `image/png` / `image/jpeg`
- `application/octet-stream`（通用二进制）

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

## 表单字段存储格式

| 控件 | 值结构 |
|------|--------|
| `ImgUpload`（单图） | `'/upload/xxx/abc.png'`（字符串路径） |
| `ImgUpload`（多图） | `'[{"Path":"...","FileName":"..."}]'`（JSON 字符串） |
| `FileUpload` | 同上 |

读取多图字段：

```javascript
var fileServer = V8.SysConfig.FileServer;
if (V8.Form.Pictures && V8.Form.Pictures.indexOf('[') !== -1) {
  var imgs = JSON.parse(V8.Form.Pictures);
  imgs.forEach(function(it) {
    console.log(fileServer + it.Path);
  });
}
```

## 安全注意

- ❌ 不要让前端任意指定 `Path`（路径穿越风险），只允许后端固定路径
- ❌ 不要不校验文件类型 / 大小：根据 ContentType + 后缀双重校验
- ❌ 敏感文件（合同、身份证）必须用私有桶 `Limit: true`
- ✅ 公有桶 URL 可缓存到前端，私有桶临时 URL 每次重新生成
- ✅ 删除数据时同步清理 HDFS 文件（避免存储泄漏）
- ✅ Excel/PDF 等导出文件通过【响应文件】配置返回，不要拼接到 JSON 数据里
