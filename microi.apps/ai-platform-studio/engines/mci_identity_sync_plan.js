/*
 * 身份同步计划：来源可以由调用方传入，也可由租户 Hook 返回；不读取连接器密钥原文。
 */
function fail(msg) { return { Code: 0, Msg: msg }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能生成身份同步计划。');
function list(value) {
  if (!value) return [];
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch (error) { return []; } }
  var result = [];
  if (value.length === undefined) return result;
  for (var i = 0; i < value.length; i++) result.push(value[i]);
  return result;
}
function clean(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function normalize(record, index) {
  return {
    SourceIndex: index,
    ExternalId: clean(record.ExternalId || record.Id || record.id),
    Account: clean(record.Account || record.account || record.UserName || record.username).toLowerCase(),
    Name: clean(record.Name || record.name || record.DisplayName || record.displayName),
    Email: clean(record.Email || record.email),
    Phone: clean(record.Phone || record.phone),
    DeptId: clean(record.DeptId || record.departmentId),
    DeptName: clean(record.DeptName || record.departmentName),
    RoleIds: record.RoleIds || record.roleIds || ''
  };
}
var connectorId = String((V8.Param && V8.Param.ConnectorId) || '');
if (!connectorId) return fail('ConnectorId不能为空。');
var connectorResult = V8.FormEngine.GetFormData('mci_identity_connector', { Id: connectorId });
if (!connectorResult || connectorResult.Code !== 1 || !connectorResult.Data) return fail('身份连接器不存在。');
var connector = connectorResult.Data;
if (Number(connector.Enabled || 0) !== 1) return fail('身份连接器未启用。');
var source = list(V8.Param && V8.Param.SourceRecords), sourceMeta = { Mode: 'Request', Pages: 0, TotalResults: source.length, HasMore: false };
if (!source.length) {
  if (String(connector.ConnectorType || '').toUpperCase() === 'SCIM') {
    var nextStart = 1, maxRecords = Math.min(1000, Math.max(1, Number((V8.Param && V8.Param.DirectoryMaxRecords) || 1000))), pageCount = 0, hasMore = true, totalResults = 0;
    source = [];
    while (hasMore && source.length < maxRecords && pageCount < 5) {
      var page = V8.Method.ReadIdentityDirectoryPage({ ConnectorId: connectorId, ResourceType: 'Users', StartIndex: nextStart, Count: Math.min(200, maxRecords - source.length) });
      if (!page || page.Code !== 1 || !page.Data) return fail(page && page.Msg ? page.Msg : 'SCIM目录读取失败。');
      var records = list(page.Data.Records);
      for (var p = 0; p < records.length && source.length < maxRecords; p++) source.push(records[p]);
      pageCount++;
      totalResults = Number(page.Data.TotalResults || source.length);
      hasMore = page.Data.HasMore === true && records.length > 0;
      nextStart = Number(page.Data.NextStartIndex || (nextStart + records.length));
    }
    sourceMeta = { Mode: 'SCIM', Pages: pageCount, TotalResults: totalResults, Fetched: source.length, NextStartIndex: nextStart, HasMore: hasMore };
  } else {
    var hook = V8.ApiEngine.Run('mci-identity-source-extension', {
      HookKey: 'IdentitySource', Connector: {
        Id: connector.Id,
        ConnectorKey: connector.ConnectorKey,
        ConnectorType: connector.ConnectorType,
        Endpoint: connector.Endpoint,
        SecretReference: connector.SecretReference,
        MappingJson: connector.MappingJson
      }
    });
    if (!hook || hook.Code !== 1) return fail(hook && hook.Msg ? hook.Msg : '租户身份源扩展失败。');
    source = list(hook.Data && hook.Data.Records);
    sourceMeta = { Mode: 'Extension', Pages: 1, TotalResults: source.length, Fetched: source.length, HasMore: false };
  }
}
if (source.length > 1000) return fail('单次身份同步计划最多处理1000条，请分片执行。');
var accounts = [];
var normalized = [];
var conflicts = [];
var seen = {};
for (var i = 0; i < source.length; i++) {
  var item = normalize(source[i] || {}, i);
  if (!item.Account) { conflicts.push({ Type: 'MissingAccount', SourceIndex: i, Message: '账号不能为空。', Source: item }); continue; }
  if (seen[item.Account]) { conflicts.push({ Type: 'DuplicateSourceAccount', SourceIndex: i, Message: '来源账号重复。', Source: item }); continue; }
  seen[item.Account] = true;
  accounts.push(item.Account);
  normalized.push(item);
}
var users = [];
if (accounts.length) {
  var usersResult = V8.FormEngine.GetTableData('Sys_User', {
    _Where: [['Account', 'In', accounts]],
    _SelectFields: ['Id', 'Account', 'Name', 'Email', 'Phone', 'DeptId', 'DeptName', 'RoleIds', 'State'],
    _PageIndex: 1,
    _PageSize: 2000
  });
  if (!usersResult || usersResult.Code !== 1) return usersResult || fail('读取现有账号失败。');
  users = usersResult.Data || [];
}
var userMap = {};
for (var u = 0; u < users.length; u++) userMap[String(users[u].Account || '').toLowerCase()] = users[u];
var adds = [], updates = [], unchanged = [];
for (var n = 0; n < normalized.length; n++) {
  var next = normalized[n], current = userMap[next.Account];
  if (!current) { adds.push(next); continue; }
  var patch = { Id: current.Id };
  var changed = false;
  var fields = ['Name', 'Email', 'Phone', 'DeptId', 'DeptName', 'RoleIds'];
  for (var f = 0; f < fields.length; f++) {
    var field = fields[f];
    if (next[field] !== '' && JSON.stringify(next[field]) !== JSON.stringify(current[field] || '')) { patch[field] = next[field]; changed = true; }
  }
  if (changed) updates.push({ Account: next.Account, Patch: patch, Source: next });
  else unchanged.push({ Account: next.Account, UserId: current.Id });
}
var plan = { ConnectorId: connectorId, Adds: adds, Updates: updates, Conflicts: conflicts, Unchanged: unchanged };
var planJson = JSON.stringify(plan);
return {
  Code: 1,
  Data: {
    Plan: plan,
    PlanHash: String(V8.EncryptHelper.Sha256Hex(planJson)).toLowerCase(),
    Summary: { Add: adds.length, Update: updates.length, Conflict: conflicts.length, Unchanged: unchanged.length },
    Source: sourceMeta,
    SafeDefaults: { NewUserState: 0, PasswordCreated: false, SecretResolvedInV8: false }
  }
};
