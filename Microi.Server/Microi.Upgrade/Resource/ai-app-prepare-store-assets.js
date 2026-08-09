/*
 * V8 ApiEngine
 * ApiEngineKey: ai_app_prepare_store_assets
 * Version: v1.1.9
 * Function:
 * - 生成并上传应用商城源码/编译 ZIP；支持大型应用拆分上传与精确包版本绑定。
 */

function ok(data, msg) { return { Code: 1, Data: data || null, Msg: msg || '成功' }; }
function fail(msg, data) { return { Code: 0, Data: data || null, Msg: msg || '执行失败' }; }
function text(value, fallback) { return value === null || value === undefined ? (fallback || '') : String(value); }
function isBlank(value) { return text(value).replace(/^\s+|\s+$/g, '') === ''; }
function toArray(value) {
  var list = []; if (!value || value.length === undefined) return list;
  for (var i = 0; i < value.length; i++) list.push(value[i]);
  return list;
}
function normalizeExactVersion(value) {
  var version = text(value).replace(/^\s+|\s+$/g, '');
  var match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return '';
  return 'v' + parseInt(match[1], 10) + '.' + parseInt(match[2], 10) + '.' + parseInt(match[3], 10);
}
function packageVersionOf(value, fallback) {
  var version = normalizeExactVersion(value || fallback);
  if (isBlank(version)) throw new Error('PackageVersion 必须是 v1.2.3 形式的精确语义版本');
  return version;
}
function currentUser() {
  var user = V8.CurrentUser || {};
  if (!user || isBlank(user.Id) || isBlank(user.Level)) {
    var token = V8.Method.GetCurrentToken ? V8.Method.GetCurrentToken() : null;
    if (token && token.CurrentUser) user = token.CurrentUser;
  }
  return user || {};
}
function sha256(base64) {
  return text(V8.EncryptHelper.Sha256Hex(base64)).toLowerCase();
}
function uploadZip(app, role, zip) {
  if (!zip || isBlank(zip.FileByteBase64)) throw new Error(role + ' ZIP 未返回文件内容');
  var files = {}; files[text(zip.FileName, app.AppKey + '-' + role + '.zip')] = zip.FileByteBase64;
  var result = V8.Method.Upload({
    OsClient: V8.OsClient,
    Path: '/microi/app-store/ai-app-packages/' + text(app.AppKey || app.Id) + '/' + DateNow('yyyyMMddHHmmss'),
    Limit: false,
    Preview: false,
    FilesByteBase64: files
  });
  if (!result || result.Code !== 1 || !result.Data) {
    throw new Error(role + ' ZIP 上传失败：' + ((result && result.Msg) || '接口无返回'));
  }
  var item = result.Data;
  if (item[0]) item = item[0];
  else if (item.Count && item.Count > 0) item = item[0];
  item = item || {};
  var uploadedName = text(item.FileName || item.Name || zip.FileName);
  var storedPath = text(item.FilePathName || item.FilePath || item.Path || item.Url || item.url || item.FileUrl);
  var returnedFullPath = text(item.FullPath || item.Url || item.url || item.FileUrl);
  var publicPath = /^https?:\/\//i.test(returnedFullPath) ? returnedFullPath : storedPath;
  if (!/^https?:\/\//i.test(publicPath)) {
    var fileServer = text(V8.SysConfig && V8.SysConfig.FileServer).replace(/\/+$/g, '');
    if (isBlank(fileServer)) throw new Error('SysConfig.FileServer不能为空，无法生成可跨平台安装的公开ZIP地址');
    publicPath = fileServer + '/' + publicPath.replace(/^\/+/, '');
  }
  return {
    Id: item.Id || '',
    Name: uploadedName,
    FileName: uploadedName,
    Path: publicPath,
    FilePathName: storedPath,
    FullPath: publicPath,
    Size: item.Size || zip.Size || System.Convert.FromBase64String(zip.FileByteBase64).Length,
    CreateTime: item.CreateTime || DateNow('yyyy-MM-dd HH:mm:ss'),
    FileRole: role,
    Limit: false,
    Sha256: sha256(zip.FileByteBase64),
    HashAlgorithm: 'SHA256-Base64Text'
  };
}
function getApp(appId) {
  return V8.FormEngine.GetFormData('sys_microistore', {
    _Where: [['Id', '=', appId]],
    _SelectFields: ['Id','Name','AppName','AppKey','AppType','ApplicationType','AppVersion','Description','Status','BuildStatus','CurrentVersion','PreviewUrl'],
    _PageSize: 1
  });
}
function manifestItem(app, packageVersion, includeSource, buildZip, sourceZip) {
  return {
    SchemaVersion: 2,
    AppId: app.Id,
    AppKey: app.AppKey,
    AppName: app.Name || app.AppName,
    ApplicationType: app.ApplicationType || app.AppType,
    PackageVersion: packageVersion,
    IncludeSource: includeSource,
    BuildZip: buildZip,
    SourceZip: sourceZip,
    PreparedTime: DateNow('yyyy-MM-dd HH:mm:ss')
  };
}

var user = currentUser();
var level = parseInt(user.Level || 0, 10);
if (isNaN(level) || level < 9999) return fail('仅超级管理员可配置应用商城 AI 应用包。');
var action = text(V8.Param.Action || 'List');
if (action === 'List') {
  var listResult = V8.FormEngine.GetTableData('sys_microistore', {
    _Where: [['IsDeleted', '<>', 1]],
    _SelectFields: ['Id','Name','AppName','AppKey','AppType','ApplicationType','AppVersion','Description','Status','BuildStatus','CurrentVersion','PreviewUrl','UpdateTime'],
    _OrderBy: 'UpdateTime', _OrderByType: 'DESC', _PageSize: 1000
  });
  if (!listResult || listResult.Code !== 1) return listResult || fail('读取 AI 应用失败');
  return ok({ Apps: toArray(listResult.Data) });
}
if (action === 'SyncStoreRecord') {
  var storeRow = V8.Param.StoreRow || {};
  if (isBlank(storeRow.Id)) return fail('StoreRow.Id不能为空');
  var syncResult = V8.FormEngine.UptFormData('sys_microistore', storeRow);
  if (!syncResult || syncResult.Code !== 1) return syncResult || fail('同步商城记录失败');
  return ok({ Id: storeRow.Id, AppVersion: storeRow.AppVersion }, '商城记录已同步');
}
/* SPLIT_PACKAGE_UPLOAD_V2 */
if (action === 'UploadPreparedFile') {
  var splitAppResult = getApp(text(V8.Param.AppId));
  if (!splitAppResult || splitAppResult.Code !== 1 || !splitAppResult.Data) return fail('AI应用不存在');
  var splitRole = text(V8.Param.FileRole || V8.Param.Role);
  if (splitRole !== 'Build' && splitRole !== 'Source') return fail('FileRole仅支持Build或Source');
  var splitZip = V8.Param.Zip || V8.Param.File;
  if (!splitZip || isBlank(splitZip.FileByteBase64)) return fail('Zip.FileByteBase64不能为空');
  var splitUploaded = uploadZip(splitAppResult.Data, splitRole, splitZip);
  return ok({
    File: splitUploaded,
    FileRole: splitRole,
    PackageVersion: packageVersionOf(V8.Param.PackageVersion, splitAppResult.Data.AppVersion)
  }, splitRole + ' ZIP已独立上传');
}
if (action === 'UploadPrepared') {
  var uploadAppResult = getApp(text(V8.Param.AppId));
  if (!uploadAppResult || uploadAppResult.Code !== 1 || !uploadAppResult.Data) return fail('AI应用不存在');
  var uploadApp = uploadAppResult.Data;
  var uploadPackageVersion = packageVersionOf(V8.Param.PackageVersion, uploadApp.AppVersion);
  if (!V8.Param.BuildZip || isBlank(V8.Param.BuildZip.FileByteBase64)) return fail('BuildZip不能为空');
  var uploadedBuild = uploadZip(uploadApp, 'Build', V8.Param.BuildZip);
  var uploadedSource = null;
  if (V8.Param.SourceZip && !isBlank(V8.Param.SourceZip.FileByteBase64)) uploadedSource = uploadZip(uploadApp, 'Source', V8.Param.SourceZip);
  var uploadedSelection = [{ AppId: uploadApp.Id, AppKey: uploadApp.AppKey, AppName: uploadApp.Name || uploadApp.AppName, ApplicationType: uploadApp.ApplicationType || uploadApp.AppType, IncludeSource: !!uploadedSource }];
  var uploadedManifest = [manifestItem(uploadApp, uploadPackageVersion, !!uploadedSource, uploadedBuild, uploadedSource)];
  var uploadedFiles = [uploadedBuild]; if (uploadedSource) uploadedFiles.push(uploadedSource);
  return ok({
    Selection: uploadedSelection,
    SelectAiApp: JSON.stringify(uploadedSelection),
    Files: uploadedFiles,
    AiAppZipFiles: JSON.stringify(uploadedFiles),
    Manifest: uploadedManifest,
    AiAppPackageManifest: JSON.stringify(uploadedManifest)
  }, '预构建AI应用ZIP已上传。');
}
if (action !== 'Prepare') return fail('不支持的操作：' + action);
var requested = toArray(V8.Param.Apps || V8.Param.Selection);
if (!requested.length) return fail('请至少选择一个 AI 应用。');
if (requested.length > 50) return fail('单次最多发布 50 个 AI 应用。');
var selection = [];
var files = [];
var manifest = [];
for (var i = 0; i < requested.length; i++) {
  var option = requested[i] || {};
  var appId = text(option.AppId || option.Id);
  var appResult = getApp(appId);
  if (!appResult || appResult.Code !== 1 || !appResult.Data) throw new Error('AI 应用不存在：' + appId);
  var app = appResult.Data;
  var packageVersion = packageVersionOf(option.PackageVersion || V8.Param.PackageVersion, app.AppVersion);
  var includeSource = option.IncludeSource === true || option.IncludeSource === 1 || text(option.IncludeSource).toLowerCase() === 'true';
  var buildResult = V8.ApiEngine.Run('ai_app_download_build_zip', { AppId: app.Id });
  if (!buildResult || buildResult.Code !== 1 || !buildResult.Data) {
    throw new Error('生成编译 ZIP 失败（' + (app.Name || app.AppName) + '）：' + ((buildResult && buildResult.Msg) || '接口无返回'));
  }
  var buildFile = uploadZip(app, 'Build', buildResult.Data);
  files.push(buildFile);
  var sourceFile = null;
  if (includeSource) {
    var sourceResult = V8.ApiEngine.Run('ai_app_download_source_zip', { AppId: app.Id });
    if (!sourceResult || sourceResult.Code !== 1 || !sourceResult.Data) {
      throw new Error('生成源码 ZIP 失败（' + (app.Name || app.AppName) + '）：' + ((sourceResult && sourceResult.Msg) || '接口无返回'));
    }
    sourceFile = uploadZip(app, 'Source', sourceResult.Data);
    files.push(sourceFile);
  }
  var selected = {
    AppId: app.Id,
    AppKey: app.AppKey,
    AppName: app.Name || app.AppName,
    ApplicationType: app.ApplicationType || app.AppType,
    IncludeSource: includeSource
  };
  selection.push(selected);
  manifest.push(manifestItem(app, packageVersion, includeSource, buildFile, sourceFile));
}
return ok({
  Selection: selection,
  SelectAiApp: JSON.stringify(selection),
  Files: files,
  AiAppZipFiles: JSON.stringify(files),
  Manifest: manifest,
  AiAppPackageManifest: JSON.stringify(manifest)
}, 'AI 应用 ZIP 已生成并上传。');
