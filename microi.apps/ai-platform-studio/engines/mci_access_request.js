/*
 * 访问申请：提交、审批、拒绝、取消、撤销与只读查看共用一个显式状态机。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function list(value) {
  if (!value) return [];
  if (value.length !== undefined && typeof value !== 'string') { var a = []; for (var i = 0; i < value.length; i++) a.push(text(value[i])); return a; }
  var source = text(value); if (!source) return [];
  try { var parsed = JSON.parse(source); if (parsed && parsed.length !== undefined) { var b = []; for (var j = 0; j < parsed.length; j++) b.push(text(parsed[j])); return b; } } catch (error) {}
  return source.split(',');
}
function unique(values) { var seen = {}, result = []; for (var i = 0; i < values.length; i++) { var value = text(values[i]); if (value && !seen[value]) { seen[value] = true; result.push(value); } } result.sort(); return result; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
var current = V8.CurrentUser || {}, currentUserId = text(current.Id), currentName = text(current.Name || current.Account), action = text(V8.Param && V8.Param.Action) || 'Submit';
if (!currentUserId) return { Code: 1001, Msg: '登录身份已过期。' };
var now = DateNow('yyyy-MM-dd HH:mm:ss');
if (action === 'Submit') {
  var requestKey = text(V8.Param && V8.Param.RequestKey) || ('access-request-' + V8.Method.NewUlid());
  var existing = V8.FormEngine.GetFormData('mci_access_request', { _Where: [['RequestKey', '=', requestKey]] }, V8.DbTrans);
  if (existing && existing.Code === 1 && existing.Data) return { Code: 1, Data: existing.Data, Msg: '访问申请已存在，已幂等返回。' };
  var roleIds = unique(list(V8.Param && V8.Param.RoleIds)), targetType = text(V8.Param && V8.Param.TargetType) || 'Self';
  var targetUserIds = unique(list(V8.Param && V8.Param.UserIds)), groupId = text(V8.Param && V8.Param.GroupId), reason = text(V8.Param && V8.Param.Reason);
  if (!roleIds.length || roleIds.length > 20) return fail('RoleIds必须包含1至20个角色。');
  if (reason.length < 6) return fail('申请原因至少6个字符。');
  if (targetType !== 'Self' && targetType !== 'Users' && targetType !== 'Group') return fail('TargetType只允许Self、Users或Group。');
  if (!admin()) { targetType = 'Self'; targetUserIds = [currentUserId]; groupId = ''; }
  else if (targetType === 'Self') { targetUserIds = [currentUserId]; groupId = ''; }
  if (targetType === 'Users' && (!targetUserIds.length || targetUserIds.length > 500)) return fail('Users目标必须包含1至500名用户。');
  if (targetType === 'Group' && !groupId) return fail('Group目标必须指定GroupId。');
  var expiresAt = text(V8.Param && V8.Param.ExpiresAt), startTime = text(V8.Param && V8.Param.RequestedStartTime) || now;
  if (startTime > now) return fail('当前版本只接受立即生效申请，RequestedStartTime不能晚于当前时间。');
  if (expiresAt && expiresAt <= now) return fail('ExpiresAt必须晚于当前时间。');
  if (expiresAt && expiresAt > System.DateTime.UtcNow.AddDays(366).ToString('yyyy-MM-dd HH:mm:ss')) return fail('临时授权最长366天。');
  var add = V8.FormEngine.AddFormData('mci_access_request', {
    RequestKey: requestKey, RequesterUserId: currentUserId, RequesterName: currentName, TargetType: targetType,
    TargetUserIdsJson: JSON.stringify(targetUserIds), GroupId: groupId, ActionType: 'GrantRole', RoleIdsJson: JSON.stringify(roleIds),
    Reason: reason, RequestedStartTime: startTime, ExpiresAt: expiresAt, Status: 'Pending', PlanHash: '', ApprovalRef: '',
    ApprovedBy: '', ApprovedTime: '', DecisionReason: '', ChangeSetId: '', ReviewDueTime: text(V8.Param && V8.Param.ReviewDueTime) || expiresAt, ResultJson: '{}'
  }, V8.DbTrans);
  if (!add || add.Code !== 1) {
    existing = V8.FormEngine.GetFormData('mci_access_request', { _Where: [['RequestKey', '=', requestKey]] }, V8.DbTrans);
    if (existing && existing.Code === 1 && existing.Data) return { Code: 1, Data: existing.Data, Msg: '访问申请已并发创建，已幂等返回。' };
    return add || fail('创建访问申请失败。');
  }
  var created = V8.FormEngine.GetFormData('mci_access_request', { _Where: [['RequestKey', '=', requestKey]] }, V8.DbTrans);
  return { Code: 1, Data: created && created.Code === 1 ? created.Data : { RequestKey: requestKey, Status: 'Pending' }, Msg: '访问申请已提交。' };
}
var requestId = text(V8.Param && V8.Param.RequestId), requestKeyParam = text(V8.Param && V8.Param.RequestKey);
if (!requestId && !requestKeyParam) return fail('RequestId或RequestKey不能为空。');
var requestResult = requestId ? V8.FormEngine.GetFormData('mci_access_request', { Id: requestId }, V8.DbTrans) : V8.FormEngine.GetFormData('mci_access_request', { _Where: [['RequestKey', '=', requestKeyParam]] }, V8.DbTrans);
if (!requestResult || requestResult.Code !== 1 || !requestResult.Data) return { Code: 2, Msg: '访问申请不存在。' };
var request = requestResult.Data; requestId = text(request.Id);
if (action === 'Inspect') {
  if (!admin() && text(request.RequesterUserId) !== currentUserId) return fail('只能查看自己的访问申请。');
  var entitlementResult = V8.FormEngine.GetTableData('mci_access_entitlement', { _Where: [['RequestId', '=', requestId]], _OrderBy: 'CreateTime', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 1000 }, V8.DbTrans);
  return { Code: 1, Data: { Request: request, Entitlements: entitlementResult && entitlementResult.Code === 1 ? (entitlementResult.Data || []) : [] } };
}
if (action === 'Cancel') {
  if (!admin() && text(request.RequesterUserId) !== currentUserId) return fail('只能取消自己的访问申请。');
  if (request.Status === 'Cancelled') return { Code: 1, Data: request, Msg: '访问申请已取消。' };
  if (request.Status !== 'Pending') return fail('只有待审批申请可以取消。');
  var cancel = V8.FormEngine.UptFormDataByWhere('mci_access_request', { _Where: [['Id', '=', requestId], ['AND', 'Status', '=', 'Pending']], Status: 'Cancelled', DecisionReason: text(V8.Param && V8.Param.DecisionReason) || '申请人取消' }, V8.DbTrans);
  if (!cancel || cancel.Code !== 1) return cancel || fail('取消申请失败。');
  return { Code: 1, Data: { RequestId: requestId, Status: 'Cancelled' }, Msg: '访问申请已取消。' };
}
if (!admin()) return fail('只有超级管理员可以审批、拒绝或撤销访问申请。');
if (action === 'Reject') {
  if (request.Status === 'Rejected') return { Code: 1, Data: request, Msg: '访问申请已拒绝。' };
  if (request.Status !== 'Pending') return fail('只有待审批申请可以拒绝。');
  var decisionReason = text(V8.Param && V8.Param.DecisionReason);
  if (decisionReason.length < 4) return fail('拒绝时必须填写审批意见。');
  var reject = V8.FormEngine.UptFormDataByWhere('mci_access_request', { _Where: [['Id', '=', requestId], ['AND', 'Status', '=', 'Pending']], Status: 'Rejected', ApprovedBy: currentName, ApprovedTime: now, DecisionReason: decisionReason }, V8.DbTrans);
  if (!reject || reject.Code !== 1) return reject || fail('拒绝申请失败。');
  return { Code: 1, Data: { RequestId: requestId, Status: 'Rejected' }, Msg: '访问申请已拒绝。' };
}
if (action === 'Revoke') {
  if (request.Status === 'Revoked' || request.Status === 'Expired') return { Code: 1, Data: request, Msg: '访问授权已经结束。' };
  if (request.Status !== 'Applied' && request.Status !== 'PartiallyApplied') return fail('当前申请没有可撤销的生效授权。');
  var revoked = V8.ApiEngine.Run('mci-access-entitlement-expire', { RequestId: requestId, Force: true }, V8.DbTrans);
  if (!revoked || revoked.Code !== 1) return revoked || fail('撤销访问授权失败。');
  return { Code: 1, Data: { RequestId: requestId, Status: revoked.Data && revoked.Data.Conflicts ? 'PartiallyApplied' : 'Revoked', Reclaim: revoked.Data }, Msg: '访问授权撤销已执行。' };
}
if (action !== 'Approve') return fail('Action不受支持。');
if (request.Status === 'Applied' || request.Status === 'PartiallyApplied') return { Code: 1, Data: request, Msg: '访问申请已应用，已幂等返回。' };
if (request.Status !== 'Pending' && request.Status !== 'Approved') return fail('当前状态不允许审批：' + request.Status);
var targetUserIds = unique(list(request.TargetUserIdsJson)), roleIds = unique(list(request.RoleIdsJson)), approvalRef = text(V8.Param && V8.Param.ApprovalRef), approveReason = text(V8.Param && V8.Param.DecisionReason);
if (!approvalRef) return fail('批准访问申请必须填写ApprovalRef。');
if (text(request.RequesterUserId) === currentUserId && targetUserIds.indexOf(currentUserId) >= 0 && approveReason.length < 10) return fail('自助审批属于紧急授权，必须填写至少10个字符的决策依据。');
var planned = V8.ApiEngine.Run('mci-access-change-plan', { ActionType: 'GrantRole', RoleIds: roleIds, UserIds: targetUserIds, GroupId: request.GroupId || '' }, V8.DbTrans);
if (!planned || planned.Code !== 1 || !planned.Data) return planned || fail('访问授权计划生成失败。');
if (Number(planned.Data.Summary && planned.Data.Summary.Missing || 0) > 0) return fail('授权目标中存在无效用户，请修正后重新申请。', planned.Data.Summary);
var planHash = text(planned.Data.PlanHash).toLowerCase();
if (request.Status === 'Pending') {
  var approve = V8.FormEngine.UptFormDataByWhere('mci_access_request', { _Where: [['Id', '=', requestId], ['AND', 'Status', '=', 'Pending']], Status: 'Approved', PlanHash: planHash, ApprovalRef: approvalRef, ApprovedBy: currentName, ApprovedTime: now, DecisionReason: approveReason }, V8.DbTrans);
  if (!approve || approve.Code !== 1) return approve || fail('访问申请审批发生并发冲突。');
} else if (text(request.PlanHash).toLowerCase() !== planHash) return fail('已批准计划与当前授权事实不一致，拒绝继续执行。');
var applied = V8.ApiEngine.Run('mci-access-change-apply', { ActionType: 'GrantRole', RoleIds: roleIds, UserIds: targetUserIds, GroupId: request.GroupId || '', ExpectedPlanHash: planHash, IdempotencyKey: 'access-request:' + requestId, ChangeKey: 'request-' + text(request.RequestKey), ApprovalRef: approvalRef }, V8.DbTrans);
if (!applied || applied.Code !== 1 || !applied.Data) {
  V8.FormEngine.UptFormDataByWhere('mci_access_request', { _Where: [['Id', '=', requestId], ['AND', 'Status', '=', 'Approved']], Status: 'Failed', ResultJson: JSON.stringify({ Message: text(applied && applied.Msg) }) }, V8.DbTrans);
  return applied || fail('访问授权执行失败。');
}
var changeSetId = text(applied.Data.ChangeSetId), itemsResult = V8.FormEngine.GetTableData('mci_access_change_item', { _Where: [['ChangeSetId', '=', changeSetId], ['AND', 'Status', '=', 'Applied']], _PageIndex: 1, _PageSize: 1000 }, V8.DbTrans);
if (!itemsResult || itemsResult.Code !== 1) return itemsResult || fail('读取授权变更证据失败。');
var items = itemsResult.Data || [], entitlements = 0;
for (var it = 0; it < items.length; it++) {
  var item = items[it] || {}, beforeRoles = unique(list(item.BeforeRoleIds));
  for (var rr = 0; rr < roleIds.length; rr++) {
    var roleId = roleIds[rr];
    if (beforeRoles.indexOf(roleId) >= 0) continue;
    var entitlementKey = requestId + ':' + text(item.UserId) + ':' + roleId;
    var evidenceHash = text(V8.EncryptHelper.Sha256Hex(entitlementKey + ':' + text(request.ExpiresAt) + ':' + planHash)).toLowerCase();
    var entitlementAdd = V8.FormEngine.AddFormData('mci_access_entitlement', { EntitlementKey: entitlementKey, RequestId: requestId, ChangeSetId: changeSetId, UserId: text(item.UserId), Account: text(item.Account), RoleId: roleId, GrantedTime: now, ExpiresAt: text(request.ExpiresAt), Status: 'Active', EvidenceHash: evidenceHash, RevokeTime: '', RevokeMessage: '' }, V8.DbTrans);
    if (!entitlementAdd || entitlementAdd.Code !== 1) {
      var entitlementExisting = V8.FormEngine.GetFormData('mci_access_entitlement', { _Where: [['EntitlementKey', '=', entitlementKey]] }, V8.DbTrans);
      if (!entitlementExisting || entitlementExisting.Code !== 1 || text(entitlementExisting.Data.EvidenceHash).toLowerCase() !== evidenceHash) return entitlementAdd || fail('创建临时授权权益失败。');
    }
    entitlements++;
  }
}
var finalStatus = text(applied.Data.Status) === 'PartiallyApplied' ? 'PartiallyApplied' : 'Applied';
var finish = V8.FormEngine.UptFormDataByWhere('mci_access_request', { _Where: [['Id', '=', requestId], ['AND', 'Status', '=', 'Approved'], ['AND', 'PlanHash', '=', planHash]], Status: finalStatus, ChangeSetId: changeSetId, ResultJson: JSON.stringify({ ChangeSetId: changeSetId, EntitlementCount: entitlements, ApplyResult: applied.Data.Result || {} }) }, V8.DbTrans);
if (!finish || finish.Code !== 1) return finish || fail('访问申请结果回写失败。');
return { Code: 1, Data: { RequestId: requestId, RequestKey: request.RequestKey, Status: finalStatus, PlanHash: planHash, ChangeSetId: changeSetId, EntitlementCount: entitlements, ExpiresAt: request.ExpiresAt || '' }, Msg: finalStatus === 'Applied' ? '访问申请已批准并应用。' : '访问申请已应用，部分目标发生冲突。' };
