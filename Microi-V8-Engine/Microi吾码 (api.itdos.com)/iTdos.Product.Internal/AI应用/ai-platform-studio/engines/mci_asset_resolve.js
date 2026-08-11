/*
 * 资产依赖解析：校验不可变内容哈希、语义版本范围、缺失依赖和循环依赖，输出确定性加载顺序。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function authenticated() { var u = V8.CurrentUser || {}; return u && u.Id; }
if (!authenticated()) return fail('登录身份已失效，无法解析资产包。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function parse(value, fallback) { if (!value) return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (error) { throw new Error('资产包版本内容损坏。'); } }
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
function versionParts(value) {
  var core = text(value).replace(/^v/i, '').split('-')[0].split('.'), out = [];
  for (var i = 0; i < 3; i++) out.push(parseInt(core[i] || 0, 10) || 0);
  return out;
}
function compareVersion(left, right) {
  var a = versionParts(left), b = versionParts(right);
  for (var i = 0; i < 3; i++) { if (a[i] > b[i]) return 1; if (a[i] < b[i]) return -1; }
  return 0;
}
function normalizeDependency(value) {
  if (typeof value === 'string') return { PackageKey: text(value), MinVersion: '', MaxVersion: '', Optional: false };
  value = value || {};
  return { PackageKey: text(value.PackageKey || value.Key), MinVersion: text(value.MinVersion), MaxVersion: text(value.MaxVersion), Optional: value.Optional === true || Number(value.Optional || 0) === 1 };
}
function readPublished(packageKey) {
  var packageResult = V8.FormEngine.GetFormData('mci_asset_package', { _Where: [['PackageKey', '=', packageKey], ['AND', 'Status', '=', 'Published']] });
  if (!packageResult || packageResult.Code !== 1 || !packageResult.Data || !packageResult.Data.CurrentVersionId) return null;
  var versionResult = V8.FormEngine.GetFormData('mci_asset_version', { Id: packageResult.Data.CurrentVersionId });
  if (!versionResult || versionResult.Code !== 1 || !versionResult.Data || versionResult.Data.Status !== 'Published') return null;
  var version = versionResult.Data, manifest = parse(version.ManifestJson, {}), content = parse(version.ContentJson, {}), dependencies = parse(version.DependenciesJson, []);
  if (!dependencies || dependencies.length === undefined) throw new Error('资产依赖清单必须是数组。');
  var canonical = '{"Content":' + stable(content, 0) + ',"Dependencies":' + stable(dependencies, 0) + ',"Manifest":' + stable(manifest, 0) + '}';
  var actualHash = String(V8.EncryptHelper.Sha256Hex(canonical)).toLowerCase(), expectedHash = String(version.ContentHash || '').toLowerCase();
  if (actualHash !== expectedHash) {
    var legacyHash = String(V8.EncryptHelper.Sha256Hex(JSON.stringify({ Manifest: manifest, Content: content, Dependencies: dependencies }))).toLowerCase();
    if (legacyHash !== expectedHash) throw new Error('资产包完整性校验失败：' + packageKey);
    warnings.push('资产包使用旧版非规范化摘要，建议重新发布：' + packageKey);
  }
  return { Package: packageResult.Data, Version: version, Manifest: manifest, Content: content, Dependencies: dependencies };
}
var packageKey = text(V8.Param && V8.Param.PackageKey);
if (!packageKey) return fail('PackageKey不能为空。');
var visited = {}, stack = [], ordered = [], edges = [], warnings = [], maxPackages = 60;
function walk(key, constraint, depth) {
  if (depth > 16) return '资产依赖层级不能超过16层。';
  var stackIndex = stack.indexOf(key);
  if (stackIndex >= 0) return '资产依赖存在循环：' + stack.slice(stackIndex).concat([key]).join(' -> ');
  var marker = '$' + key;
  if (visited[marker]) return '';
  var node;
  try { node = readPublished(key); } catch (error) { return error.message; }
  if (!node) {
    if (constraint && constraint.Optional) { warnings.push('可选依赖不可用：' + key); return ''; }
    return '必需资产依赖不存在或未发布：' + key;
  }
  var actualVersion = text(node.Version.VersionNo);
  if (constraint && constraint.MinVersion && compareVersion(actualVersion, constraint.MinVersion) < 0) return key + '版本低于最低要求' + constraint.MinVersion + '。';
  if (constraint && constraint.MaxVersion && compareVersion(actualVersion, constraint.MaxVersion) > 0) return key + '版本高于最高兼容版本' + constraint.MaxVersion + '。';
  stack.push(key);
  for (var i = 0; i < node.Dependencies.length; i++) {
    var dep = normalizeDependency(node.Dependencies[i]);
    if (!dep.PackageKey) return key + '包含空依赖Key。';
    edges.push({ From: key, To: dep.PackageKey, Optional: dep.Optional, MinVersion: dep.MinVersion, MaxVersion: dep.MaxVersion });
    var error = walk(dep.PackageKey, dep, depth + 1);
    if (error) return error;
  }
  stack.pop();
  visited[marker] = true;
  ordered.push(node);
  if (ordered.length > maxPackages) return '资产依赖图最多允许' + maxPackages + '个包。';
  return '';
}
var graphError = walk(packageKey, null, 0);
if (graphError) return fail(graphError, { DependencyPath: stack.slice(0) });
var root = ordered[ordered.length - 1];
if (!root) return { Code: 2, Msg: '资产包不存在或尚未发布。' };
function projection(node) {
  return {
    Package: { Id: node.Package.Id, PackageKey: node.Package.PackageKey, Name: node.Package.Name, AssetType: node.Package.AssetType, Scope: node.Package.Scope },
    Version: { Id: node.Version.Id, VersionNo: node.Version.VersionNo, ContentHash: node.Version.ContentHash, SignatureHash: node.Version.SignatureHash, MinPlatformVersion: node.Version.MinPlatformVersion, MaxPlatformVersion: node.Version.MaxPlatformVersion },
    Manifest: node.Manifest, Content: node.Content, Dependencies: node.Dependencies
  };
}
var rootProjection = projection(root), resolved = [];
for (var o = 0; o < ordered.length - 1; o++) resolved.push(projection(ordered[o]));
rootProjection.ResolvedDependencies = resolved;
rootProjection.LoadOrder = ordered.map(function (item) { return { PackageKey: item.Package.PackageKey, VersionNo: item.Version.VersionNo, ContentHash: item.Version.ContentHash }; });
rootProjection.DependencyGraph = edges;
rootProjection.Warnings = warnings;
return { Code: 1, Data: rootProjection, Msg: warnings.length ? '资产依赖已解析，存在可选依赖警告。' : '资产依赖已完整解析。' };
