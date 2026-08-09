/* 配置继承解析：校验每层摘要，只合并非敏感值与Secret引用，不读取秘密原文。 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能解析配置模板。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function parse(value, fallback, label) { if (!value) return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (error) { throw new Error(label + '不是有效JSON。'); } }
function stable(value, depth) { if (depth > 60) throw new Error('配置JSON嵌套不能超过60层。'); if (value === null || value === undefined) return 'null'; if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value); if (typeof value === 'number') { if (!isFinite(value)) throw new Error('配置包含非有限数字。'); return JSON.stringify(value); } if (value.length !== undefined && typeof value !== 'string') { var rows = []; for (var a = 0; a < value.length; a++) rows.push(stable(value[a], depth + 1)); return '[' + rows.join(',') + ']'; } if (typeof value !== 'object') throw new Error('配置只允许JSON数据。'); var keys = Object.keys(value).sort(), fields = []; for (var k = 0; k < keys.length; k++) { var key = keys[k]; if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('配置包含禁止字段。'); fields.push(JSON.stringify(key) + ':' + stable(value[key], depth + 1)); } return '{' + fields.join(',') + '}'; }
function merge(base, overlay, depth) { if (depth > 60) throw new Error('配置继承嵌套不能超过60层。'); if (!overlay || typeof overlay !== 'object' || overlay.length !== undefined) return overlay; var result = {}, baseObject = base && typeof base === 'object' && base.length === undefined ? base : {}, baseKeys = Object.keys(baseObject); for (var b = 0; b < baseKeys.length; b++) result[baseKeys[b]] = baseObject[baseKeys[b]]; var keys = Object.keys(overlay); for (var i = 0; i < keys.length; i++) { var key = keys[i], value = overlay[key]; result[key] = value && typeof value === 'object' && value.length === undefined ? merge(result[key], value, depth + 1) : value; } return result; }
var param = V8.Param || {}, profileId = text(param.ProfileId), profileKey = text(param.ProfileKey), result;
if (profileId) result = V8.FormEngine.GetFormData('mci_configuration_profile', { Id: profileId });
else if (profileKey) result = V8.FormEngine.GetFormData('mci_configuration_profile', { _Where: [['ProfileKey', '=', profileKey]] });
else return fail('ProfileId或ProfileKey至少提供一个。');
if (!result || result.Code !== 1 || !result.Data) return { Code: 2, Msg: '配置模板不存在。' };
var current = result.Data, chain = [], visited = {}, depth = 0;
try {
  while (current) {
    var id = text(current.Id); if (!id || visited[id]) return fail('配置模板继承存在循环。'); visited[id] = true; depth++; if (depth > 10) return fail('配置模板继承不能超过10层。');
    if (text(current.Status) !== 'Published' || Number(current.Enabled || 0) !== 1) return fail('配置模板[' + text(current.ProfileKey) + ']未发布或已停用。');
    var schema = parse(current.SchemaJson, {}, 'SchemaJson'), values = parse(current.ValuesJson, {}, 'ValuesJson'), references = parse(current.SecretReferencesJson, {}, 'SecretReferencesJson');
    var snapshot = { ProfileKey: text(current.ProfileKey), Name: text(current.Name), Category: text(current.Category), Environment: text(current.Environment), ParentProfileId: text(current.ParentProfileId), VersionNo: text(current.VersionNo), Schema: schema, Values: values, SecretReferences: references, Owner: text(current.Owner), Enabled: 1 };
    var calculated = text(V8.EncryptHelper.Sha256Hex(stable(snapshot, 0))).toLowerCase(), expected = text(current.ContentHash).toLowerCase(); if (!expected || expected !== calculated) return fail('配置模板[' + text(current.ProfileKey) + ']完整性校验失败。');
    chain.push({ Id: id, ProfileKey: text(current.ProfileKey), VersionNo: text(current.VersionNo), ContentHash: expected, Schema: schema, Values: values, SecretReferences: references });
    if (!text(current.ParentProfileId)) break; var parent = V8.FormEngine.GetFormData('mci_configuration_profile', { Id: text(current.ParentProfileId) }); if (!parent || parent.Code !== 1 || !parent.Data) return fail('配置继承链中的父模板不存在。'); current = parent.Data;
  }
} catch (error) { return fail(error.message); }
chain.reverse(); var effectiveSchema = {}, effectiveValues = {}, effectiveReferences = {};
for (var c = 0; c < chain.length; c++) { effectiveSchema = merge(effectiveSchema, chain[c].Schema, 0); effectiveValues = merge(effectiveValues, chain[c].Values, 0); effectiveReferences = merge(effectiveReferences, chain[c].SecretReferences, 0); }
var effectiveHash = text(V8.EncryptHelper.Sha256Hex(stable({ Schema: effectiveSchema, Values: effectiveValues, SecretReferences: effectiveReferences }, 0))).toLowerCase(), projection = [];
for (var p = 0; p < chain.length; p++) projection.push({ Id: chain[p].Id, ProfileKey: chain[p].ProfileKey, VersionNo: chain[p].VersionNo, ContentHash: chain[p].ContentHash });
return { Code: 1, Data: { ProfileId: text(result.Data.Id), ProfileKey: text(result.Data.ProfileKey), Environment: text(result.Data.Environment), Schema: effectiveSchema, Values: effectiveValues, SecretReferences: effectiveReferences, SecretValuesResolved: false, EffectiveHash: effectiveHash, Chain: projection, ResolvedAt: DateNow('yyyy-MM-dd HH:mm:ss') } };
