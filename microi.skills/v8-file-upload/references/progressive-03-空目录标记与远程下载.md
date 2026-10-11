# 空目录标记与远程下载

<!-- microi-progressive:chunk id=v8-file-upload-004 sha256=8393c7b2b7ce36e563843f43f42e9a06a8cb69fc7b792930912353d846ee769f -->
## 空目录标记的受控恢复

- 只需移除一个目录占位对象时，使用 `V8.HDFS.DeleteObject({FilePathName:'当前租户目录/', Limit:true/false, EmptyDirectoryOnly:true})` 并等待异步结果。必须是当前租户实际有效超级管理员的可信 V8/DiyToken 会话；不能使用参数中的 `_CurrentUser`、访问密钥或临时维护引擎代替授权。
- HTTP/MCP 必须使用专用 `/api/HDFS/DeleteEmptyDirectoryMarker` / `microi_delete_empty_directory_marker`，显式选择桶并保留末尾 `/`。旧后端缺路由、非标准结果或成功缺少 `DeletionMode=EmptyDirectoryMarkerOnly` / `VerifiedAbsent=true` 均停止，绝不回退普通递归删除。
- MCP 默认 dry run；执行 `confirmExecution` 精确等于 `filePathName`。旧 `/api/HDFS/DeleteObject` 不能作为缺少专用路由时的回退。路径拒绝租户根、跨租户、未知绝对前缀、URL、通配符与穿越。原始列表必须完整、大小明确为零，供应商只删精确标记 key，再完整回读；不允许前缀批量删除、忽略续页或把缺失 Size 默认成零。
- 这不是零字节对象 CAS，也不证明历史 NoPUT。同 key 版本替换没有跨供应商统一条件 DELETE；执行前必须隔离原请求并排除活跃写入。保留历史/当前证据的区别；未知结果先只读回查，不换请求键、不清其它对象、不自动再次 PUT。

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
