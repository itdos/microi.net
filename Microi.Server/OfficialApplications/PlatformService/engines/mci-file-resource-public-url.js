/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 官方应用：系统日志/监控。Managed；ApiEngineKey: mci-file-resource-public-url
 * 从可信官方源安装、更新或重新安装将恢复本接口；不承载租户个性化代码。
 */
/* Version: v1.0.0
 * 匿名只读公开下载选择：不读文件体、不复制、不接收URL或Ready；私有资源永不返回NAS地址。
 */
var key = String(V8.Param.FilePathName || '');
if (!key || key.length > 1000 || /[\\%?#:\x00-\x20\x7f]/.test(key)) return { Code: 1, Data: { UseBackup: false } };
return V8.Method.GetPublicResourceBackupUrl({ FilePathName: key });
