/*
 * 临时授权回收：只移除本申请真正新增且已无其它有效权益覆盖的角色，精确条件更新避免覆盖并发变更。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
var jobName = text(V8.Param && V8.Param.JobName), force = V8.Param && V8.Param.Force === true;
if (!admin() && jobName !== 'MciAiPlatformMinuteSweep') return fail('拒绝非平台维护任务或超级管理员调用。');
if (force && !admin()) return fail('只有超级管理员可以强制回收授权。');
function list(value) {
  if (!value) return [];
  if (value.length !== undefined && typeof value !== 'string') { var a = []; for (var i = 0; i < value.length; i++) a.push(text(value[i])); return a; }
  var source = text(value); if (!source) return [];
  try { var parsed = JSON.parse(source); if (parsed && parsed.length !== undefined) { var b = []; for (var j = 0; j < parsed.length; j++) b.push(text(parsed[j])); return b; } } catch (error) {}
  return source.split(',');
}
function unique(values) { var seen = {}, result = []; for (var i = 0; i < values.length; i++) { var value = text(values[i]); if (value && !seen[value]) { seen[value] = true; result.push(value); } } result.sort(); return result; }
function serializeLike(original, values) { var normalized = unique(values); return text(original).charAt(0) === '[' ? JSON.stringify(normalized) : normalized.join(','); }
var now = DateNow('yyyy-MM-dd HH:mm:ss'), requestId = text(V8.Param && V8.Param.RequestId), where = [['Status', '=', 'Active']];
if (requestId) where.push(['AND', 'RequestId', '=', requestId]);
else where.push(['AND', 'ExpiresAt', '<=', now]);
var result = V8.FormEngine.GetTableData('mci_access_entitlement', { _Where: where, _OrderBy: 'ExpiresAt', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 500 }, V8.DbTrans);
if (!result || result.Code !== 1) return result || fail('扫描临时授权失败。');
var rows = result.Data || [], expired = 0, superseded = 0, conflicts = 0, requestIds = {};
for (var i = 0; i < rows.length; i++) {
  var row = rows[i] || {}, rowRequestId = text(row.RequestId), userId = text(row.UserId), roleId = text(row.RoleId);
  if (!force && (!row.ExpiresAt || text(row.ExpiresAt) > now)) continue;
  requestIds[rowRequestId] = true;
  var covers = V8.FormEngine.GetTableData('mci_access_entitlement', { _Where: [['UserId', '=', userId], ['AND', 'RoleId', '=', roleId], ['AND', 'Status', '=', 'Active']], _SelectFields: ['Id', 'ExpiresAt'], _PageIndex: 1, _PageSize: 100 }, V8.DbTrans);
  var coverRows = covers && covers.Code === 1 ? (covers.Data || []) : [], covered = false;
  for (var c = 0; c < coverRows.length; c++) {
    if (text(coverRows[c].Id) === text(row.Id)) continue;
    if (!coverRows[c].ExpiresAt || text(coverRows[c].ExpiresAt) > now) { covered = true; break; }
  }
  if (covered) {
    var markSuperseded = V8.FormEngine.UptFormDataByWhere('mci_access_entitlement', { _Where: [['Id', '=', row.Id], ['AND', 'Status', '=', 'Active']], Status: 'Superseded', RevokeTime: now, RevokeMessage: '角色仍由其它有效授权权益覆盖。' }, V8.DbTrans);
    if (markSuperseded && markSuperseded.Code === 1) superseded++; else conflicts++;
    continue;
  }
  var userResult = V8.FormEngine.GetFormData('Sys_User', { Id: userId, _SelectFields: ['Id', 'RoleIds'] }, V8.DbTrans);
  if (!userResult || userResult.Code !== 1 || !userResult.Data) {
    conflicts++;
    V8.FormEngine.UptFormDataByWhere('mci_access_entitlement', { _Where: [['Id', '=', row.Id], ['AND', 'Status', '=', 'Active']], Status: 'Conflict', RevokeTime: now, RevokeMessage: '用户不存在或无法读取。' }, V8.DbTrans);
    continue;
  }
  var before = text(userResult.Data.RoleIds), roles = unique(list(before)), after = [];
  for (var r = 0; r < roles.length; r++) if (roles[r] !== roleId) after.push(roles[r]);
  var finalStatus = force ? 'Revoked' : 'Expired', message = roles.length === after.length ? '角色已不存在，按幂等结果完成回收。' : '角色已从用户当前角色集合中安全移除。';
  if (roles.length !== after.length) {
    var afterText = serializeLike(before, after);
    var updateUser = V8.FormEngine.UptFormDataByWhere('Sys_User', { _Where: [['Id', '=', userId], ['AND', 'RoleIds', '=', before]], RoleIds: afterText }, V8.DbTrans);
    var verify = V8.FormEngine.GetFormData('Sys_User', { Id: userId, _SelectFields: ['Id', 'RoleIds'] }, V8.DbTrans);
    if (!updateUser || updateUser.Code !== 1 || !verify || verify.Code !== 1 || unique(list(verify.Data.RoleIds)).indexOf(roleId) >= 0) {
      conflicts++;
      V8.FormEngine.UptFormDataByWhere('mci_access_entitlement', { _Where: [['Id', '=', row.Id], ['AND', 'Status', '=', 'Active']], Status: 'Conflict', RevokeTime: now, RevokeMessage: '用户角色发生并发修改，未覆盖。' }, V8.DbTrans);
      continue;
    }
  }
  var finish = V8.FormEngine.UptFormDataByWhere('mci_access_entitlement', { _Where: [['Id', '=', row.Id], ['AND', 'Status', '=', 'Active']], Status: finalStatus, RevokeTime: now, RevokeMessage: message }, V8.DbTrans);
  if (finish && finish.Code === 1) expired++; else conflicts++;
}
for (var requestKey in requestIds) {
  if (!requestIds.hasOwnProperty(requestKey) || !requestKey) continue;
  var remaining = V8.FormEngine.GetTableDataCount('mci_access_entitlement', { _Where: [['RequestId', '=', requestKey], ['AND', 'Status', '=', 'Active']] }, V8.DbTrans);
  if (remaining && remaining.Code === 1 && Number(remaining.Data || remaining.DataCount || 0) === 0) {
    V8.FormEngine.UptFormDataByWhere('mci_access_request', { _Where: [['Id', '=', requestKey], ['AND', 'Status', 'In', ['Applied', 'PartiallyApplied']]], Status: force ? 'Revoked' : 'Expired', ResultJson: JSON.stringify({ ReclaimedTime: now, Force: force }) }, V8.DbTrans);
  }
}
return { Code: 1, Data: { Scanned: rows.length, Reclaimed: expired, Superseded: superseded, Conflicts: conflicts, HasMore: rows.length >= 500 }, Msg: conflicts ? '临时授权回收完成，存在并发冲突。' : '临时授权回收完成。' };
