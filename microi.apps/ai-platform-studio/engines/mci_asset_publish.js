/*
 * 资产包发布：内容不可变、依赖有界、平台兼容显式，当前指针通过ExpectedCurrentHash保护。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能发布资产包。');
function parse(value, fallback) { if (!value) return fallback; if (typeof value === 'string') { try { return JSON.parse(value); } catch (error) { throw new Error('JSON内容无效。'); } } return value; }
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function list(value) { if (!value) return []; if (value.length !== undefined && typeof value !== 'string') { var out = []; for (var i = 0; i < value.length; i++) out.push(value[i]); return out; } return []; }
function stable(value, depth) {
  if (depth > 80) throw new Error('资产JSON嵌套不能超过80层。');
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!isFinite(value)) throw new Error('资产JSON包含非有限数字。'); return JSON.stringify(value); }
  if (value.length !== undefined && typeof value !== 'string') { var items = []; for (var a = 0; a < value.length; a++) items.push(stable(value[a], depth + 1)); return '[' + items.join(',') + ']'; }
  if (typeof value !== 'object') throw new Error('资产只允许JSON数据。');
  var keys = Object.keys(value).sort(), fields = [];
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('资产JSON包含禁止字段：' + key);
    fields.push(JSON.stringify(key) + ':' + stable(value[key], depth + 1));
  }
  return '{' + fields.join(',') + '}';
}
function normalizeDependency(value) { if (typeof value === 'string') return { PackageKey: text(value), MinVersion: '', MaxVersion: '', Optional: false }; value = value || {}; return { PackageKey: text(value.PackageKey || value.Key), MinVersion: text(value.MinVersion), MaxVersion: text(value.MaxVersion), Optional: value.Optional === true || Number(value.Optional || 0) === 1 }; }
function versionParts(value) { var core = text(value).replace(/^v/i, '').split('-')[0].split('.'), out = []; for (var i = 0; i < 3; i++) out.push(parseInt(core[i] || 0, 10) || 0); return out; }
function compareVersion(left, right) { var a = versionParts(left), b = versionParts(right); for (var i = 0; i < 3; i++) { if (a[i] > b[i]) return 1; if (a[i] < b[i]) return -1; } return 0; }
function validateAsset(pkg, manifest, content, dependencies) {
  if (!manifest || typeof manifest !== 'object' || manifest.length !== undefined) return 'Manifest必须是对象。';
  if (text(manifest.Schema) !== 'microi.asset.v1') return 'Manifest.Schema必须是microi.asset.v1。';
  if (!text(manifest.Name) || !text(manifest.Label)) return 'Manifest必须包含Name和Label。';
  var platforms = list(manifest.Platforms), allowedPlatforms = ['Web', 'MobileWeb', 'UniApp', 'MiniProgram', 'App'];
  if (!platforms.length) return 'Manifest.Platforms至少声明一个运行端。';
  for (var p = 0; p < platforms.length; p++) if (allowedPlatforms.indexOf(text(platforms[p])) < 0) return 'Manifest.Platforms包含不支持的运行端：' + text(platforms[p]);
  if (!content || typeof content !== 'object' || content.length !== undefined) return '资产Content必须是对象。';
  var type = text(pkg.AssetType);
  if (type === 'PageTemplate') {
    var page = content.Page && content.Page.JsonObj ? content.Page.JsonObj : (content.JsonObj || content);
    if (!page || typeof page !== 'object' || !page.formConfig || page.wrapperList === null || page.wrapperList === undefined || page.wrapperList.length === undefined) return '页面模板必须包含JsonObj.formConfig和wrapperList。';
  } else if (type === 'Block') {
    var wrappers = list(content.Wrappers); if (!wrappers.length && content.Wrapper) wrappers = [content.Wrapper];
    if (!wrappers.length) return '区块资产必须包含Wrapper或Wrappers。';
    for (var w = 0; w < wrappers.length; w++) if (!wrappers[w] || !wrappers[w].wrapperOption || wrappers[w].widgetList === null || wrappers[w].widgetList === undefined || wrappers[w].widgetList.length === undefined) return '区块Wrapper结构无效。';
  } else if (type === 'Component') {
    var widget = content.Widget || content;
    if (!widget || !widget.widgetOption) return '组件资产必须包含Widget.widgetOption。';
    var component = manifest.Component;
    if (!component || !text(component.Name)) return '组件资产Manifest必须包含Component.Name。';
    var props = list(component.Props), propNames = {}, setters = ['Text', 'Number', 'Switch', 'Select', 'Radio', 'Color', 'Json', 'Code', 'DataSource', 'Event', 'Slot'];
    if (props.length > 200) return '组件属性最多200项。';
    for (var x = 0; x < props.length; x++) {
      var prop = props[x] || {}, propName = text(prop.Name), setter = text(prop.Setter || 'Text');
      if (!/^[A-Za-z_$][A-Za-z0-9_$.-]{0,99}$/.test(propName)) return '组件属性Name无效。';
      if (propNames['$' + propName]) return '组件属性Name重复：' + propName;
      if (setters.indexOf(setter) < 0) return '组件属性Setter无效：' + setter;
      propNames['$' + propName] = true;
    }
  } else if (type === 'Theme') {
    var theme = content.FormConfig || content.Theme || content;
    if (!theme || typeof theme !== 'object' || theme.length !== undefined) return '主题资产必须包含FormConfig对象。';
  } else if (type === 'DataAdapter') {
    var adapter = content.Adapter || content;
    if (!text(adapter.AdapterKey) || ['ApiEngine', 'DataSource', 'Static'].indexOf(text(adapter.SourceType)) < 0) return '数据适配器必须包含AdapterKey和受支持的SourceType。';
    var forbidden = stable(adapter, 0);
    if (/"(Code|Script|Eval|Function)"\s*:/.test(forbidden)) return '数据适配器只允许声明式映射，不能内嵌可执行代码。';
  } else return '不支持的资产类型：' + type;
  var dependencyKeys = {};
  for (var d = 0; d < dependencies.length; d++) {
    var dep = normalizeDependency(dependencies[d]);
    if (!dep.PackageKey) return '资产依赖Key不能为空。';
    if (dependencyKeys['$' + dep.PackageKey]) return '资产依赖重复：' + dep.PackageKey;
    if ((dep.MinVersion && !/^v?\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$/.test(dep.MinVersion)) || (dep.MaxVersion && !/^v?\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$/.test(dep.MaxVersion))) return '资产依赖版本范围无效：' + dep.PackageKey;
    if (dep.MinVersion && dep.MaxVersion && compareVersion(dep.MinVersion, dep.MaxVersion) > 0) return '资产依赖最低版本不能高于最高版本：' + dep.PackageKey;
    dependencyKeys['$' + dep.PackageKey] = true;
  }
  return '';
}
var packageId = String((V8.Param && V8.Param.PackageId) || ''), versionNo = String((V8.Param && V8.Param.VersionNo) || '').replace(/^\s+|\s+$/g, ''), expectedHash = String((V8.Param && V8.Param.ExpectedCurrentHash) || '').toLowerCase();
if (!packageId || !/^v?\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$/.test(versionNo)) return fail('PackageId不能为空，VersionNo必须是语义版本。');
var packageResult = V8.FormEngine.GetFormData('mci_asset_package', { Id: packageId });
if (!packageResult || packageResult.Code !== 1 || !packageResult.Data) return { Code: 2, Msg: '资产包不存在。' };
var pkg = packageResult.Data, currentHash = '';
if (pkg.CurrentVersionId) {
  var current = V8.FormEngine.GetFormData('mci_asset_version', { Id: pkg.CurrentVersionId });
  if (current && current.Code === 1 && current.Data) currentHash = String(current.Data.ContentHash || '').toLowerCase();
}
if (currentHash !== expectedHash) return fail('资产包当前版本已变化。', { Conflict: true, CurrentHash: currentHash });
var manifest, content, dependencies;
try { manifest = parse(V8.Param.Manifest || V8.Param.ManifestJson, {}); content = parse(V8.Param.Content || V8.Param.ContentJson, {}); dependencies = parse(V8.Param.Dependencies || V8.Param.DependenciesJson, []); } catch (error) { return fail(error.message); }
var manifestStable, contentStable, dependenciesStable;
try { manifestStable = stable(manifest, 0); contentStable = stable(content, 0); dependenciesStable = stable(dependencies, 0); } catch (error) { return fail(error.message); }
if (manifestStable.length > 512000 || contentStable.length > 2097152 || dependenciesStable.length > 128000) return fail('资产Manifest、内容或依赖清单超过安全上限。');
if (!dependencies || dependencies.length === undefined) return fail('资产依赖必须是数组。');
if (dependencies.length > 100) return fail('资产依赖最多100项。');
var validationError = validateAsset(pkg, manifest, content, dependencies);
if (validationError) return fail(validationError);
for (var i = 0; i < dependencies.length; i++) if (normalizeDependency(dependencies[i]).PackageKey === String(pkg.PackageKey || '')) return fail('资产包不能依赖自身。');
var graphStack = [], graphSeen = {};
function currentNode(packageKey) {
  if (packageKey === String(pkg.PackageKey || '')) return { VersionNo: versionNo, Dependencies: dependencies };
  var packageLookup = V8.FormEngine.GetFormData('mci_asset_package', { _Where: [['PackageKey', '=', packageKey], ['AND', 'Status', '=', 'Published']] });
  if (!packageLookup || packageLookup.Code !== 1 || !packageLookup.Data || !packageLookup.Data.CurrentVersionId) return null;
  var versionLookup = V8.FormEngine.GetFormData('mci_asset_version', { Id: packageLookup.Data.CurrentVersionId });
  if (!versionLookup || versionLookup.Code !== 1 || !versionLookup.Data || versionLookup.Data.Status !== 'Published') return null;
  try { return { VersionNo: text(versionLookup.Data.VersionNo), Dependencies: parse(versionLookup.Data.DependenciesJson, []) }; } catch (error) { return null; }
}
function validateGraph(packageKey, constraint, depth) {
  if (depth > 16) return '资产依赖层级不能超过16层。';
  var loopIndex = graphStack.indexOf(packageKey);
  if (loopIndex >= 0) return '资产依赖存在循环：' + graphStack.slice(loopIndex).concat([packageKey]).join(' -> ');
  var node = currentNode(packageKey);
  if (node === null) return constraint && constraint.Optional ? '' : '必需资产依赖不存在或未发布：' + packageKey;
  if (constraint && constraint.MinVersion && compareVersion(node.VersionNo, constraint.MinVersion) < 0) return packageKey + '版本低于最低要求' + constraint.MinVersion + '。';
  if (constraint && constraint.MaxVersion && compareVersion(node.VersionNo, constraint.MaxVersion) > 0) return packageKey + '版本高于最高兼容版本' + constraint.MaxVersion + '。';
  var marker = '$' + packageKey;
  if (graphSeen[marker]) return '';
  var deps = node.Dependencies;
  if (!deps || deps.length === undefined) return packageKey + '的依赖清单不是数组。';
  graphStack.push(packageKey);
  for (var index = 0; index < deps.length; index++) {
    var dep = normalizeDependency(deps[index]);
    if (!dep.PackageKey) return packageKey + '包含空依赖Key。';
    var error = validateGraph(dep.PackageKey, dep, depth + 1);
    if (error) return error;
  }
  graphStack.pop(); graphSeen[marker] = true; return '';
}
var dependencyError = validateGraph(String(pkg.PackageKey || ''), null, 0);
if (dependencyError) return fail(dependencyError, { DependencyPath: graphStack.slice(0) });
var canonical = '{"Content":' + contentStable + ',"Dependencies":' + dependenciesStable + ',"Manifest":' + manifestStable + '}', contentHash = String(V8.EncryptHelper.Sha256Hex(canonical)).toLowerCase();
var duplicate = V8.FormEngine.GetFormData('mci_asset_version', { _Where: [['PackageId', '=', packageId], ['AND', 'ContentHash', '=', contentHash]] });
if (duplicate && duplicate.Code === 1 && duplicate.Data) return { Code: 1, Data: { PackageId: packageId, VersionId: duplicate.Data.Id, VersionNo: duplicate.Data.VersionNo, ContentHash: contentHash, Reused: true }, Msg: '相同内容已发布，已幂等复用。' };
var validation = V8.ApiEngine.Run('mci-asset-validate-extension', { HookKey: 'AssetValidate', Package: pkg, VersionNo: versionNo, Manifest: manifest, Dependencies: dependencies, ContentHash: contentHash });
if (validation && validation.Code !== 1) return validation;
if (V8.Param && (V8.Param.DryRun === true || Number(V8.Param.DryRun || 0) === 1)) {
  return { Code: 1, Data: { DryRun: true, PackageId: packageId, PackageKey: pkg.PackageKey, VersionNo: versionNo, ContentHash: contentHash, CurrentHash: currentHash, AssetType: pkg.AssetType, Platforms: list(manifest.Platforms), DependencyCount: dependencies.length, DependencyPackages: Object.keys(graphSeen).map(function (key) { return key.slice(1); }) }, Msg: '资产协议、内容、依赖图和租户门禁校验通过，尚未发布。' };
}
var versionId = V8.Method.NewUlid(), now = DateNow('yyyy-MM-dd HH:mm:ss');
var add = V8.FormEngine.AddFormData('mci_asset_version', { Id: versionId, PackageId: packageId, VersionNo: versionNo, ContentHash: contentHash, SignatureHash: String((validation && validation.Data && validation.Data.SignatureHash) || ''), MinPlatformVersion: String((V8.Param && V8.Param.MinPlatformVersion) || ''), MaxPlatformVersion: String((V8.Param && V8.Param.MaxPlatformVersion) || ''), DependenciesJson: JSON.stringify(dependencies), ManifestJson: JSON.stringify(manifest), ContentJson: JSON.stringify(content), Status: 'Published', PublishedTime: now }, V8.DbTrans);
if (!add || add.Code !== 1) return add || fail('保存资产版本失败。');
var expectedCurrentVersionId = (pkg.CurrentVersionId === null || pkg.CurrentVersionId === undefined) ? null : text(pkg.CurrentVersionId);
var switchResult = V8.FormEngine.UptFormDataByWhere('mci_asset_package', { _Where: [['Id', '=', packageId], ['AND', 'CurrentVersionId', '=', expectedCurrentVersionId]], CurrentVersionId: versionId, Status: 'Published' }, V8.DbTrans);
var verify = V8.FormEngine.GetFormData('mci_asset_package', { Id: packageId }, V8.DbTrans);
if (!switchResult || switchResult.Code !== 1 || !verify || verify.Code !== 1 || String(verify.Data.CurrentVersionId || '') !== versionId) return fail('资产版本指针发生并发冲突，事务已回滚。');
return { Code: 1, Data: { PackageId: packageId, VersionId: versionId, VersionNo: versionNo, ContentHash: contentHash, Reused: false }, Msg: '资产包版本已发布。' };
