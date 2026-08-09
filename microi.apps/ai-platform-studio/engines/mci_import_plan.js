/*
 * 可恢复导入预检：解析 JSON/Excel、校验目标表与字段映射，生成稳定计划哈希。
 * 本接口只读，不直接写入业务表。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function requireAdmin() {
  var user = V8.CurrentUser || {};
  if ((!user || !user.Id) && V8.Method && V8.Method.GetCurrentToken) {
    try { var token = V8.Method.GetCurrentToken(); if (token && token.CurrentUser) user = token.CurrentUser; } catch (error) { }
  }
  return user && user.Id && Number(user.Level || 0) >= 9999;
}
function toList(value) {
  if (!value) return [];
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch (error) { return []; } }
  var result = [];
  if (value.length === undefined) return result;
  for (var i = 0; i < value.length; i++) result.push(value[i]);
  return result;
}
function parseObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { var parsed = JSON.parse(String(value)); return parsed && typeof parsed === 'object' ? parsed : {}; }
  catch (error) { return {}; }
}
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function protectedTable(name) {
  var key = String(name || '').toLowerCase();
  var exact = {
    'diy_table': true, 'diy_field': true, 'sys_user': true, 'sys_menu': true,
    'sys_role': true, 'sys_rolelimit': true, 'sys_apiengine': true,
    'sys_osclients': true, 'sys_config': true, 'mci_import_job': true, 'mci_import_row': true
  };
  return !!exact[key];
}
function sensitiveField(name) {
  return /(password|passwd|pwd|secret|token|private.?key|api.?key|connection.?string|auth.?code|credential)/i.test(String(name || ''));
}
if (!requireAdmin()) return fail('权限不足：只有超级管理员才能使用可恢复导入中心。');
var targetTable = text(V8.Param && V8.Param.TargetTable);
if (!targetTable || !/^[A-Za-z][A-Za-z0-9_]{0,254}$/.test(targetTable)) return fail('TargetTable不合法。');
if (protectedTable(targetTable)) return fail('该平台核心表禁止通过通用导入中心写入，请使用对应治理能力。');
var tableResult = V8.FormEngine.GetFormData('diy_table', { _Where: [['Name', '=', targetTable]], _SelectFields: ['Id', 'Name', 'Description'] });
if (!tableResult || tableResult.Code !== 1 || !tableResult.Data) return fail('目标表不存在或未登记到表单引擎。');
var fieldResult = V8.FormEngine.GetTableData('diy_field', {
  _Where: [['TableId', '=', tableResult.Data.Id]],
  _SelectFields: ['Name', 'Label', 'Type', 'Component', 'NotEmpty', 'IsVirtual', 'Readonly'],
  _OrderBy: 'Sort', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 1000
});
if (!fieldResult || fieldResult.Code !== 1) return fieldResult || fail('读取目标字段失败。');
var fields = fieldResult.Data || [], fieldMap = {}, required = [], fieldSummary = [];
for (var f = 0; f < fields.length; f++) {
  var field = fields[f] || {}, fieldName = text(field.Name);
  if (!fieldName || Number(field.IsVirtual || 0) === 1) continue;
  fieldMap[fieldName.toLowerCase()] = fieldName;
  if (Number(field.NotEmpty || 0) === 1 && fieldName.toLowerCase() !== 'id') required.push(fieldName);
  fieldSummary.push({ Name: fieldName, Label: field.Label || fieldName, Type: field.Type || '', Required: Number(field.NotEmpty || 0) === 1, Readonly: Number(field.Readonly || 0) === 1 });
}
fieldMap.id = 'Id';
var records = toList(V8.Param && V8.Param.Records);
var fileBase64 = text(V8.Param && V8.Param.FileByteBase64);
if (!records.length && fileBase64) {
  if (fileBase64.length > 28 * 1024 * 1024) return fail('Excel Base64超过28MB，请拆分文件后导入。');
  var parsedExcel = V8.Office.ExcelToList({ FileByteBase64: fileBase64, SheetIndex: Number((V8.Param && V8.Param.SheetIndex) || 0) });
  if (!parsedExcel || parsedExcel.Code !== 1) return parsedExcel || fail('Excel解析失败。');
  records = toList(parsedExcel.Data);
}
if (!records.length) return fail('没有可预检的数据。');
if (records.length > 2000) return fail('单个治理批次最多暂存2000行，请拆分文件；执行阶段会继续按小事务分片。');
var mapping = parseObject(V8.Param && V8.Param.Mapping);
var rows = [], invalidCount = 0, addCount = 0, updateCount = 0;
for (var r = 0; r < records.length; r++) {
  var source = records[r] || {}, normalized = {}, safeSource = {}, errors = [];
  var sourceKeys = Object.keys(source).sort();
  for (var s = 0; s < sourceKeys.length; s++) {
    var sourceKey = sourceKeys[s], configured = mapping[sourceKey];
    if (configured === false || configured === null || configured === '') continue;
    var candidate = text(configured || sourceKey), canonical = fieldMap[candidate.toLowerCase()];
    if (!canonical) continue;
    if (sensitiveField(canonical)) { errors.push('字段“' + canonical + '”属于敏感凭据，通用导入已拒绝。'); continue; }
    if (canonical !== 'Id' && /^(_|OsClient$|CreateTime$|UpdateTime$|UserId$|UserName$|IsDeleted$)/i.test(canonical)) continue;
    normalized[canonical] = source[sourceKey];
    safeSource[sourceKey] = source[sourceKey];
  }
  var action = normalized.Id ? 'Update' : 'Add';
  if (action === 'Add') {
    for (var q = 0; q < required.length; q++) {
      var requiredName = required[q];
      if (normalized[requiredName] === null || normalized[requiredName] === undefined || text(normalized[requiredName]) === '') errors.push('必填字段“' + requiredName + '”为空。');
    }
  }
  if (!Object.keys(normalized).length) errors.push('没有可写入的字段，请检查字段映射。');
  var rowPayload = { RowNo: r + 2, Action: action, Source: safeSource, Normalized: normalized, Errors: errors };
  rowPayload.RowHash = String(V8.EncryptHelper.Sha256Hex(JSON.stringify(rowPayload))).toLowerCase();
  rows.push(rowPayload);
  if (errors.length) invalidCount++; else if (action === 'Update') updateCount++; else addCount++;
}
var normalizedMapping = {}, mappingKeys = Object.keys(mapping).sort();
for (var m = 0; m < mappingKeys.length; m++) normalizedMapping[mappingKeys[m]] = mapping[mappingKeys[m]];
var fileHash = fileBase64
  ? String(V8.EncryptHelper.Sha256Hex(fileBase64)).toLowerCase()
  : String(V8.EncryptHelper.Sha256Hex(JSON.stringify(records))).toLowerCase();
var planPayload = { TargetTable: targetTable, FileHash: fileHash, Mapping: normalizedMapping, Rows: rows };
return {
  Code: 1,
  Data: {
    Target: { Id: tableResult.Data.Id, Name: targetTable, Description: tableResult.Data.Description || targetTable },
    Fields: fieldSummary,
    Rows: rows,
    Mapping: normalizedMapping,
    FileHash: fileHash,
    PlanHash: String(V8.EncryptHelper.Sha256Hex(JSON.stringify(planPayload))).toLowerCase(),
    Summary: { Total: rows.length, Add: addCount, Update: updateCount, Invalid: invalidCount },
    CanStage: rows.length > invalidCount
  }
};
