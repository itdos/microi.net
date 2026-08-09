/*
 * 用户标签分配：标签事实以 TagId + UserId 为稳定键，支持有效期、来源证据和条件撤销。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能维护用户标签。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function list(value) {
  if (!value) return [];
  if (value.length !== undefined && typeof value !== 'string') { var a = []; for (var i = 0; i < value.length; i++) a.push(text(value[i])); return a; }
  try { var parsed = JSON.parse(text(value)); if (parsed && parsed.length !== undefined) { var b = []; for (var j = 0; j < parsed.length; j++) b.push(text(parsed[j])); return b; } } catch (error) {}
  return text(value).split(',');
}
function unique(values) { var seen = {}, output = []; for (var i = 0; i < values.length; i++) { var value = text(values[i]); if (value && !seen[value]) { seen[value] = true; output.push(value); } } output.sort(); return output; }
function json(value) { if (value === null || value === undefined || value === '') return '{}'; if (typeof value === 'string') { try { return JSON.stringify(JSON.parse(value)); } catch (error) { throw new Error('ValueJson不是有效JSON。'); } } return JSON.stringify(value); }
var action = text(V8.Param && V8.Param.Action) || 'Assign';
if (action !== 'Assign' && action !== 'Revoke') return fail('Action只允许Assign或Revoke。');
var tagId = text(V8.Param && V8.Param.TagId), userIds = unique(list(V8.Param && V8.Param.UserIds));
if (!tagId || !userIds.length) return fail('TagId和UserIds不能为空。');
if (userIds.length > 500) return fail('单次最多维护500名用户的标签。');
var tagResult = V8.FormEngine.GetFormData('mci_identity_tag', { Id: tagId }, V8.DbTrans);
if (!tagResult || tagResult.Code !== 1 || !tagResult.Data) return { Code: 2, Msg: '标签不存在。' };
if (action === 'Assign' && Number(tagResult.Data.Enabled || 0) !== 1) return fail('标签未启用。');
var usersResult = V8.FormEngine.GetTableData('Sys_User', { _Where: [['Id', 'In', userIds]], _SelectFields: ['Id', 'Account', 'Name', 'State'], _PageIndex: 1, _PageSize: 500 }, V8.DbTrans);
if (!usersResult || usersResult.Code !== 1) return usersResult || fail('读取用户失败。');
var users = usersResult.Data || [], userMap = {};
for (var u = 0; u < users.length; u++) userMap[text(users[u].Id)] = users[u];
var now = DateNow('yyyy-MM-dd HH:mm:ss'), effectiveFrom = text(V8.Param && V8.Param.EffectiveFrom) || now, expiresAt = text(V8.Param && V8.Param.ExpiresAt);
if (expiresAt && expiresAt <= effectiveFrom) return fail('ExpiresAt必须晚于EffectiveFrom。');
var sourceType = text(V8.Param && V8.Param.SourceType) || 'Manual', sourceRef = text(V8.Param && V8.Param.SourceRef), valueJson;
try { valueJson = json(V8.Param && V8.Param.ValueJson); } catch (error) { return fail(error.message); }
var assignedBy = text(V8.CurrentUser && (V8.CurrentUser.Name || V8.CurrentUser.Account)), applied = 0, replayed = 0, conflicts = [], missing = [];
for (var i = 0; i < userIds.length; i++) {
  var userId = userIds[i], user = userMap[userId];
  if (!user) { missing.push(userId); continue; }
  var assignmentKey = tagId + ':' + userId;
  var existingResult = V8.FormEngine.GetFormData('mci_identity_tag_assignment', { _Where: [['AssignmentKey', '=', assignmentKey]] }, V8.DbTrans);
  var existing = existingResult && existingResult.Code === 1 ? existingResult.Data : null;
  if (action === 'Revoke') {
    if (!existing || existing.Status !== 'Active') { replayed++; continue; }
    var revoke = V8.FormEngine.UptFormDataByWhere('mci_identity_tag_assignment', {
      _Where: [['Id', '=', existing.Id], ['AND', 'EvidenceHash', '=', existing.EvidenceHash || ''], ['AND', 'Status', '=', 'Active']],
      Status: 'Revoked', RevokedTime: now,
      EvidenceHash: String(V8.EncryptHelper.Sha256Hex(assignmentKey + ':Revoked:' + now + ':' + String(existing.EvidenceHash || ''))).toLowerCase()
    }, V8.DbTrans);
    var revoked = V8.FormEngine.GetFormData('mci_identity_tag_assignment', { Id: existing.Id }, V8.DbTrans);
    if (!revoke || revoke.Code !== 1 || !revoked || revoked.Code !== 1 || revoked.Data.Status !== 'Revoked') conflicts.push({ UserId: userId, Account: user.Account, Message: '标签分配已被并发修改。' });
    else applied++;
    continue;
  }
  var evidence = String(V8.EncryptHelper.Sha256Hex(JSON.stringify({ AssignmentKey: assignmentKey, ValueJson: valueJson, SourceType: sourceType, SourceRef: sourceRef, EffectiveFrom: effectiveFrom, ExpiresAt: expiresAt, Status: 'Active' }))).toLowerCase();
  if (existing && existing.Status === 'Active' && String(existing.EvidenceHash || '').toLowerCase() === evidence) { replayed++; continue; }
  if (existing) {
    var updated = V8.FormEngine.UptFormDataByWhere('mci_identity_tag_assignment', {
      _Where: [['Id', '=', existing.Id], ['AND', 'EvidenceHash', '=', existing.EvidenceHash || '']],
      Account: text(user.Account), ValueJson: valueJson, SourceType: sourceType, SourceRef: sourceRef,
      EffectiveFrom: effectiveFrom, ExpiresAt: expiresAt, Status: 'Active', EvidenceHash: evidence, AssignedBy: assignedBy, RevokedTime: ''
    }, V8.DbTrans);
    var updatedRead = V8.FormEngine.GetFormData('mci_identity_tag_assignment', { Id: existing.Id }, V8.DbTrans);
    if (!updated || updated.Code !== 1 || !updatedRead || updatedRead.Code !== 1 || String(updatedRead.Data.EvidenceHash || '').toLowerCase() !== evidence) conflicts.push({ UserId: userId, Account: user.Account, Message: '标签分配已被并发修改。' });
    else applied++;
  } else {
    var added = V8.FormEngine.AddFormData('mci_identity_tag_assignment', {
      AssignmentKey: assignmentKey, TagId: tagId, UserId: userId, Account: text(user.Account), ValueJson: valueJson,
      SourceType: sourceType, SourceRef: sourceRef, EffectiveFrom: effectiveFrom, ExpiresAt: expiresAt,
      Status: 'Active', EvidenceHash: evidence, AssignedBy: assignedBy, RevokedTime: ''
    }, V8.DbTrans);
    if (!added || added.Code !== 1) {
      var concurrent = V8.FormEngine.GetFormData('mci_identity_tag_assignment', { _Where: [['AssignmentKey', '=', assignmentKey]] }, V8.DbTrans);
      if (concurrent && concurrent.Code === 1 && String(concurrent.Data.EvidenceHash || '').toLowerCase() === evidence) replayed++;
      else conflicts.push({ UserId: userId, Account: user.Account, Message: '标签分配创建冲突。' });
    } else applied++;
  }
}
return { Code: 1, Data: { Action: action, TagId: tagId, Requested: userIds.length, Applied: applied, Replayed: replayed, MissingUserIds: missing, Conflicts: conflicts }, Msg: conflicts.length ? '用户标签维护完成，存在并发冲突。' : '用户标签维护完成。' };
