/* 配置模板：非敏感值、Secret引用、继承协议、稳定摘要、DryRun、CAS和不可变版本。 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能发布配置模板。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function parse(value, fallback, label) { if (!value) return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (error) { throw new Error(label + '不是有效JSON。'); } }
function enabled(value, fallback) { if (value === null || value === undefined || value === '') return fallback ? 1 : 0; return value === false || value === 0 || text(value) === '0' || text(value).toLowerCase() === 'false' ? 0 : 1; }
function stable(value, depth) {
  if (depth > 60) throw new Error('配置JSON嵌套不能超过60层。');
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!isFinite(value)) throw new Error('配置包含非有限数字。'); return JSON.stringify(value); }
  if (value.length !== undefined && typeof value !== 'string') { var rows = []; for (var a = 0; a < value.length; a++) rows.push(stable(value[a], depth + 1)); return '[' + rows.join(',') + ']'; }
  if (typeof value !== 'object') throw new Error('配置只允许JSON数据。');
  var keys = Object.keys(value).sort(), fields = [];
  for (var k = 0; k < keys.length; k++) { var key = keys[k]; if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('配置包含禁止字段：' + key); fields.push(JSON.stringify(key) + ':' + stable(value[key], depth + 1)); }
  return '{' + fields.join(',') + '}';
}
function sensitiveKey(key) { return /(^|[._-])(password|passwd|pwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|connection[-_]?string|conn[-_]?str|db[-_]?conn|redis[-_]?pwd)($|[._-])/i.test(key) || /(AuthToken|BearerToken|ClientSecret|PrivateKey)$/i.test(key); }
function scanSensitive(value, path, depth) {
  if (depth > 60 || value === null || value === undefined) return '';
  if (value.length !== undefined && typeof value !== 'string') { for (var i = 0; i < value.length; i++) { var arrayHit = scanSensitive(value[i], path + '[' + i + ']', depth + 1); if (arrayHit) return arrayHit; } return ''; }
  if (typeof value !== 'object') return '';
  var keys = Object.keys(value);
  for (var k = 0; k < keys.length; k++) { var key = keys[k], nextPath = path ? path + '.' + key : key, item = value[key]; if (sensitiveKey(key) && item !== null && item !== undefined && text(item) !== '') return nextPath; var hit = scanSensitive(item, nextPath, depth + 1); if (hit) return hit; }
  return '';
}
function validateReferences(value) {
  if (!value || typeof value !== 'object' || value.length !== undefined) throw new Error('SecretReferencesJson必须是JSON对象。');
  var keys = Object.keys(value); if (keys.length > 100) throw new Error('敏感值引用最多100项。');
  for (var i = 0; i < keys.length; i++) { var path = text(keys[i]), settingKey = text(value[keys[i]]); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(path) || !/^[A-Za-z][A-Za-z0-9._:-]{1,119}$/.test(settingKey)) throw new Error('敏感值引用格式无效：' + path); }
}
var param = V8.Param || {}, profileKey = text(param.ProfileKey), name = text(param.Name), versionNo = text(param.VersionNo), parentProfileId = text(param.ParentProfileId), expectedHash = text(param.ExpectedContentHash).toLowerCase();
if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,118}$/.test(profileKey) || !name) return fail('ProfileKey格式无效，Name不能为空。');
if (!/^v?\d+\.\d+(\.\d+)?([-.][0-9A-Za-z.-]+)?$/.test(versionNo)) return fail('VersionNo必须是语义版本。');
var category = text(param.Category || 'Business'), environment = text(param.Environment || 'Development');
if (['Business', 'Runtime', 'Theme', 'Integration'].indexOf(category) < 0 || ['Development', 'Test', 'Staging', 'Production'].indexOf(environment) < 0) return fail('Category或Environment无效。');
var schema, values, references;
try { schema = parse(param.Schema || param.SchemaJson, {}, 'SchemaJson'); values = parse(param.Values || param.ValuesJson, {}, 'ValuesJson'); references = parse(param.SecretReferences || param.SecretReferencesJson, {}, 'SecretReferencesJson'); if (!schema || typeof schema !== 'object' || schema.length !== undefined || !values || typeof values !== 'object' || values.length !== undefined) throw new Error('SchemaJson和ValuesJson必须是JSON对象。'); validateReferences(references); var sensitivePath = scanSensitive(values, '', 0); if (sensitivePath) throw new Error('非敏感配置中发现疑似秘密字段[' + sensitivePath + ']，请改用SecretReferencesJson。'); }
catch (error) { return fail(error.message); }
var existing = V8.FormEngine.GetFormData('mci_configuration_profile', { _Where: [['ProfileKey', '=', profileKey]] }, V8.DbTrans), row = existing && existing.Code === 1 ? existing.Data : null;
if (row && parentProfileId && text(row.Id) === parentProfileId) return fail('配置模板不能继承自身。');
if (parentProfileId) {
  var cursor = parentProfileId, visited = {}, depth = 0;
  while (cursor) { if (visited[cursor] || (row && text(row.Id) === cursor)) return fail('配置模板继承存在循环。'); visited[cursor] = true; depth++; if (depth > 10) return fail('配置模板继承不能超过10层。'); var parentResult = V8.FormEngine.GetFormData('mci_configuration_profile', { Id: cursor }, V8.DbTrans); if (!parentResult || parentResult.Code !== 1 || !parentResult.Data) return fail('父配置模板不存在。'); cursor = text(parentResult.Data.ParentProfileId); }
}
var enabledValue = enabled(param.Enabled, true), snapshot = { ProfileKey: profileKey, Name: name, Category: category, Environment: environment, ParentProfileId: parentProfileId, VersionNo: versionNo, Schema: schema, Values: values, SecretReferences: references, Owner: text(param.Owner), Enabled: enabledValue };
var canonical; try { canonical = stable(snapshot, 0); } catch (error) { return fail(error.message); }
if (canonical.length > 524288) return fail('配置模板不能超过512KB。');
var contentHash = text(V8.EncryptHelper.Sha256Hex(canonical)).toLowerCase(), currentHash = text(row && row.ContentHash).toLowerCase();
if (currentHash !== expectedHash) return fail('配置模板已变化，请刷新后重新校验。', { Conflict: true, CurrentHash: currentHash });
if (row && currentHash === contentHash) return { Code: 1, Data: { ProfileId: row.Id, ContentHash: contentHash, VersionNo: row.VersionNo, Reused: true, DryRun: !!param.DryRun }, Msg: '配置内容未变化，已幂等复用。' };
var versionConflict = row ? V8.FormEngine.GetFormData('mci_resource_version', { _Where: [['ResourceType', '=', 'ConfigurationProfile'], ['AND', 'ResourceId', '=', row.Id], ['AND', 'VersionNo', '=', versionNo]] }, V8.DbTrans) : null;
if (versionConflict && versionConflict.Code === 1 && versionConflict.Data && text(versionConflict.Data.ContentHash).toLowerCase() !== contentHash) return fail('该配置版本号已用于其它内容，请递增版本号。');
if (param.DryRun === true || Number(param.DryRun || 0) === 1) return { Code: 1, Data: { DryRun: true, ProfileId: row ? row.Id : '', ContentHash: contentHash, CurrentHash: currentHash, Snapshot: snapshot }, Msg: '配置协议、敏感值边界和继承链校验通过，尚未发布。' };
var profileId = row ? text(row.Id) : text(V8.Method.NewUlid()), now = DateNow('yyyy-MM-dd HH:mm:ss'), rawVersion = row && row.RowVersion, rowVersion = Number(rawVersion || 0), expectedVersion = rawVersion === null || rawVersion === undefined || rawVersion === '' ? null : rowVersion;
var profileData = { Id: profileId, ProfileKey: profileKey, Name: name, Category: category, Environment: environment, ParentProfileId: parentProfileId, VersionNo: versionNo, SchemaJson: JSON.stringify(schema), ValuesJson: JSON.stringify(values), SecretReferencesJson: JSON.stringify(references), ContentHash: contentHash, RowVersion: rowVersion + 1, Status: 'Published', Owner: text(param.Owner), LastValidatedTime: now, PublishedTime: now, Enabled: enabledValue }, save;
if (row) { profileData._Where = [['Id', '=', profileId], ['AND', 'RowVersion', '=', expectedVersion], ['AND', 'ContentHash', '=', currentHash || null]]; save = V8.FormEngine.UptFormDataByWhere('mci_configuration_profile', profileData, V8.DbTrans); }
else save = V8.FormEngine.AddFormData('mci_configuration_profile', profileData, V8.DbTrans);
if (!save || save.Code !== 1) return save || fail('保存配置模板发生并发冲突。');
var versionId = text(V8.Method.NewUlid()), addVersion = V8.FormEngine.AddFormData('mci_resource_version', { Id: versionId, ResourceType: 'ConfigurationProfile', ResourceId: profileId, ResourceKey: profileKey, VersionNo: versionNo, ContentHash: contentHash, SnapshotJson: canonical, ChangeSummary: text(param.ChangeSummary), Status: 'Published', PublishedTime: now }, V8.DbTrans);
if (!addVersion || addVersion.Code !== 1) return addVersion || fail('保存配置不可变版本失败。');
var verify = V8.FormEngine.GetFormData('mci_configuration_profile', { Id: profileId }, V8.DbTrans);
if (!verify || verify.Code !== 1 || text(verify.Data.ContentHash).toLowerCase() !== contentHash || Number(verify.Data.RowVersion || 0) !== rowVersion + 1) return fail('配置模板发布回读失败，事务已回滚。');
return { Code: 1, Data: { ProfileId: profileId, VersionId: versionId, ContentHash: contentHash, VersionNo: versionNo, RowVersion: rowVersion + 1, Reused: false }, Msg: '配置模板已发布。' };
