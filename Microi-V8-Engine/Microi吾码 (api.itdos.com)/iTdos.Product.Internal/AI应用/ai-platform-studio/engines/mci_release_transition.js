/*
 * 发布审批状态机：不可变审批证据、职责分离、审批阈值和计划 CAS。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能变更发布审批状态。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function parse(value, fallback) { if (!value) return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (error) { return fallback; } }
function rows(value) { var out = []; if (!value || value.length === undefined) return out; for (var i = 0; i < value.length; i++) out.push(value[i]); return out; }
var param = V8.Param || {}, planId = text(param.ReleasePlanId), action = text(param.Action), expectedHash = text(param.ExpectedPlanHash).toLowerCase(), expectedVersion = Number(param.ExpectedRowVersion);
if (!planId || ['Submit', 'Approve', 'Reject', 'Cancel', 'Reopen'].indexOf(action) < 0) return fail('ReleasePlanId或Action无效。');
if (!expectedHash || !isFinite(expectedVersion) || expectedVersion < 0) return fail('ExpectedPlanHash和ExpectedRowVersion不能为空。');
var planResult = V8.FormEngine.GetFormData('mci_release_plan', { Id: planId }, V8.DbTrans); if (!planResult || planResult.Code !== 1 || !planResult.Data) return { Code: 2, Msg: '发布计划不存在。' };
var plan = planResult.Data, status = text(plan.Status), planHash = text(plan.PlanHash).toLowerCase(), rowVersion = Number(plan.RowVersion || 0), currentUser = V8.CurrentUser || {}, userId = text(currentUser.Id), userName = text(currentUser.Name || currentUser.Account || currentUser.Id), now = DateNow('yyyy-MM-dd HH:mm:ss');
if (planHash !== expectedHash || rowVersion !== expectedVersion) return fail('发布计划已变化，请刷新后重试。', { Conflict: true, CurrentPlanHash: planHash, CurrentRowVersion: rowVersion, Status: status });
var policy = parse(plan.ApprovalPolicyJson, {}), requiredApprovals = Math.max(1, Math.min(10, Number(policy.RequiredApprovals || 1))), separation = policy.SeparationOfDuties === true;
function updatePlan(fields, allowedStatuses) {
  fields._Where = [['Id', '=', planId], ['AND', 'PlanHash', '=', planHash], ['AND', 'RowVersion', '=', rowVersion], ['AND', 'Status', 'In', allowedStatuses]];
  fields.RowVersion = rowVersion + 1;
  var update = V8.FormEngine.UptFormDataByWhere('mci_release_plan', fields, V8.DbTrans); if (!update || update.Code !== 1) return update || fail('发布计划状态并发更新失败。');
  var verify = V8.FormEngine.GetFormData('mci_release_plan', { Id: planId }, V8.DbTrans); if (!verify || verify.Code !== 1 || Number(verify.Data.RowVersion || 0) !== rowVersion + 1 || text(verify.Data.Status) !== text(fields.Status)) return fail('发布计划状态回读失败，事务已回滚。');
  return { Code: 1, Data: verify.Data };
}
if (action === 'Submit') {
  if (status !== 'Draft') return fail('只有草稿计划可以提交审批。');
  var resources = parse(plan.ResourcesJson, []), rollback = parse(plan.RollbackJson, []), evidence = parse(plan.EvidenceJson, {}); if (!resources || resources.length === undefined || resources.length < 1) return fail('发布计划至少需要一个资源步骤。');
  if (text(plan.Environment) === 'Production' && (!rollback || rollback.length === undefined || rollback.length < 1)) return fail('生产发布必须声明回滚步骤。');
  if (text(plan.Environment) === 'Production' && (!evidence || typeof evidence !== 'object' || Object.keys(evidence).length < 1)) return fail('生产发布必须记录测试与回读证据。');
  var nextRound = Number(plan.ReviewRound || 0) + 1, submitted = updatePlan({ Status: 'Reviewing', ReviewRound: nextRound, ApprovedBy: '', ApprovalTime: '', LastCheckTime: '', LastCheckJson: '{}' }, ['Draft']);
  if (!submitted || submitted.Code !== 1) return submitted;
  return { Code: 1, Data: { ReleasePlanId: planId, Status: 'Reviewing', ReviewRound: nextRound, RowVersion: rowVersion + 1, RequiredApprovals: requiredApprovals }, Msg: '发布计划已提交审批。' };
}
if (action === 'Cancel') {
  var cancellable = ['Draft', 'Reviewing', 'Approved', 'Blocked', 'Ready', 'Failed', 'Rejected']; if (cancellable.indexOf(status) < 0) return fail('当前状态不允许取消发布。');
  var cancelled = updatePlan({ Status: 'Cancelled', ApprovedBy: '', ApprovalTime: '' }, cancellable); if (!cancelled || cancelled.Code !== 1) return cancelled;
  return { Code: 1, Data: { ReleasePlanId: planId, Status: 'Cancelled', RowVersion: rowVersion + 1 }, Msg: '发布计划已取消。' };
}
if (action === 'Reopen') {
  var reopenable = ['Rejected', 'Blocked', 'Cancelled', 'Failed']; if (reopenable.indexOf(status) < 0) return fail('当前状态不允许重新打开。');
  var reopened = updatePlan({ Status: 'Draft', ApprovedBy: '', ApprovalTime: '', LastCheckTime: '', LastCheckJson: '{}' }, reopenable); if (!reopened || reopened.Code !== 1) return reopened;
  return { Code: 1, Data: { ReleasePlanId: planId, Status: 'Draft', RowVersion: rowVersion + 1 }, Msg: '发布计划已重新打开，修改后需要重新提交审批。' };
}
if (status !== 'Reviewing' && status !== 'Approved') return fail('只有审批中的计划可以审批。');
var reviewRound = Number(plan.ReviewRound || 0); if (reviewRound < 1) return fail('发布计划缺少有效审批轮次。');
var approvalKey = text(V8.EncryptHelper.Sha256Hex(planId + ':' + planHash + ':' + reviewRound + ':' + userId)).toLowerCase(), existing = V8.FormEngine.GetFormData('mci_release_approval', { _Where: [['ApprovalKey', '=', approvalKey]] }, V8.DbTrans), existingDecision = existing && existing.Code === 1 && existing.Data ? text(existing.Data.Decision) : '';
if (existingDecision) {
  if (existingDecision !== action) return fail('本审批轮次已经提交过相反结论，审批证据不可覆盖。');
  return { Code: 1, Data: { ReleasePlanId: planId, Status: status, ReviewRound: reviewRound, Decision: action, Reused: true, RowVersion: rowVersion }, Msg: '相同审批结论已存在，已幂等复用。' };
}
if (separation && text(plan.CreateUserId) === userId) return fail('审批策略要求职责分离，计划创建人不能审批自己的生产发布。');
var add = V8.FormEngine.AddFormData('mci_release_approval', { Id: text(V8.Method.NewUlid()), ApprovalKey: approvalKey, ReleasePlanId: planId, PlanHash: planHash, ReviewRound: reviewRound, ApproverUserId: userId, ApproverName: userName, Decision: action, Comment: text(param.Comment).slice(0, 1900), DecisionTime: now }, V8.DbTrans);
if (!add || add.Code !== 1) return add || fail('保存不可变审批证据失败。');
if (action === 'Reject') {
  var rejected = updatePlan({ Status: 'Rejected', ApprovedBy: '', ApprovalTime: '' }, ['Reviewing']); if (!rejected || rejected.Code !== 1) return rejected;
  return { Code: 1, Data: { ReleasePlanId: planId, Status: 'Rejected', ReviewRound: reviewRound, Decision: 'Reject', RowVersion: rowVersion + 1 }, Msg: '发布计划已驳回。' };
}
var approvalResult = V8.FormEngine.GetTableData('mci_release_approval', { _Where: [['ReleasePlanId', '=', planId], ['AND', 'PlanHash', '=', planHash], ['AND', 'ReviewRound', '=', reviewRound], ['AND', 'Decision', '=', 'Approve']], _OrderBy: 'DecisionTime', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 20 }, V8.DbTrans), approvals = approvalResult && approvalResult.Code === 1 ? rows(approvalResult.Data) : [];
var approverNames = [], seen = {}; for (var i = 0; i < approvals.length; i++) { var approvalUserId = text(approvals[i].ApproverUserId), approvalName = text(approvals[i].ApproverName || approvalUserId); if (!approvalUserId || seen[approvalUserId]) continue; if (separation && approvalUserId === text(plan.CreateUserId)) continue; seen[approvalUserId] = true; approverNames.push(approvalName); }
var approved = approverNames.length >= requiredApprovals, nextStatus = approved ? 'Approved' : 'Reviewing', changed = updatePlan({ Status: nextStatus, ApprovedBy: approverNames.join('、').slice(0, 1900), ApprovalTime: approved ? now : '' }, ['Reviewing']); if (!changed || changed.Code !== 1) return changed;
return { Code: 1, Data: { ReleasePlanId: planId, Status: nextStatus, ReviewRound: reviewRound, Decision: 'Approve', ApprovalCount: approverNames.length, RequiredApprovals: requiredApprovals, RowVersion: rowVersion + 1 }, Msg: approved ? '发布计划审批通过。' : ('审批已记录，还需要' + (requiredApprovals - approverNames.length) + '人批准。') };
