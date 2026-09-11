/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1
 * 租户上传返回扩展：仅首次安装创建，官方升级不会覆盖本接口。
 * 在此扩展返回属性；文件访问权限与租户隔离仍由平台校验。
 * 示例：var result = JSON.parse(JSON.stringify(V8.Param.Result));
 * var rows = Array.isArray(result.Data) ? result.Data : [result.Data];
 * rows.forEach(function (row) { row.BusinessTag = 'example'; });
 * return { Code: 1, UploadResult: result };
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: platform-hdfs-upload-hook
 * Version: v1.0.6
 * Function:
 * - 上传成功后扩展返回值，当前租户的自定义代码在应用升级时保留。返回Code=1使用原上传结果，或通过UploadResult返回扩展后的完整结果。
 */

return { Code : 1 };
