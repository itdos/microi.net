/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：系统设置；ApiEngineKey：platform-hdfs-upload。
 * 安装、更新或重新安装应用会恢复本接口。长期个性化返回请修改
 * CreateIfMissing 接口 platform-hdfs-upload-hook，避免升级覆盖。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-hdfs-upload
 * Version: v1.0.4
 * Function:
 * - 在可信上传请求内调用平台流式上传原子方法；开启旧版兼容时补齐旧字段并统一返回文件数组，关闭时保持新版形态；调用租户扩展接口，保留上传鉴权、公私桶、配额、裁剪和内容安全。
 */

if (!V8.CurrentUser || !V8.CurrentUser.Id) return { Code: 1001, Msg: '登录身份已过期，请重新登录。' };

// 流、用户、租户、公私桶、裁剪和配额由可信宿主验证；文件字节不进入 Jint。
var result = await V8.Method.UploadCurrentRequestAsync();
if (!result || result.Code !== 1) return result || { Code: 0, Msg: '上传未返回结果。' };
// 显式转成普通 JS 对象，避免 Jint 的 CLR 动态对象与数组判断差异。
result = JSON.parse(JSON.stringify(result));
if (V8.Method.IsLegacyUploadCompatibilityEnabled() && result.Data) {
  var rows = Array.isArray(result.Data) ? result.Data : [result.Data];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!row || typeof row !== 'object') continue;
    var name = String(row.Name || row.name || '');
    var dot = name.lastIndexOf('.');
    var extension = dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
    // 私有文件沿用本次授权地址，不能按 FileServer + Path 拼出公开地址。
    row.url = row.Url || row.url || '';
    row.type = ['jpg','jpeg','png','gif','webp','bmp','svg','ico','avif','heic'].indexOf(extension) >= 0 ? 'image'
      : ['mp4','mov','m4v','webm','avi','mkv','3gp'].indexOf(extension) >= 0 ? 'video'
      : ['mp3','wav','ogg','m4a','aac','flac','amr'].indexOf(extension) >= 0 ? 'audio' : 'file';
    row.size = row.Size == null ? (row.size || 0) : row.Size;
    row.duration = row.Duration == null ? (row.duration || 0) : row.Duration;
    row.uploading = false;
    row.progress = 100;
    row.path = row.Path || row.path || '';
    row.name = dot > 0 ? name.slice(0, dot) : name;
    row.id = row.Id || row.id || '';
  }
  // 旧移动端固定按数组读取；包括 Multiple=false 的单文件结果。
  result.Data = rows;
}
// 租户可在 Hook 中返回 {Code:1, UploadResult:修改后的完整结果} 增加业务属性。
var hook = V8.ApiEngine.Run('platform-hdfs-upload-hook', { Stage: 'AfterUpload', Result: result });
if (!hook || hook.Code !== 1) return hook || { Code: 0, Msg: '上传返回扩展未返回结果。' };
return hook.UploadResult || result;
