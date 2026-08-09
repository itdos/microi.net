/*
 * 发布门禁：验证计划哈希、审批证据、生产证据与内置运行事实，再由租户 Hook 增量扩展。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能执行发布门禁。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function parse(value, fallback, label) { if (!value) return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (error) { throw new Error(label + '不是有效JSON。'); } }
function rows(value) { var out = []; if (!value || value.length === undefined) return out; for (var i = 0; i < value.length; i++) out.push(value[i]); return out; }
function stable(value, depth) { if (depth > 40) throw new Error('发布计划JSON嵌套不能超过40层。'); if (value === null || value === undefined) return 'null'; if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value); if (typeof value === 'number') { if (!isFinite(value)) throw new Error('发布计划包含非有限数字。'); return JSON.stringify(value); } if (value.length !== undefined && typeof value !== 'string') { var array = []; for (var a = 0; a < value.length; a++) array.push(stable(value[a], depth + 1)); return '[' + array.join(',') + ']'; } if (typeof value !== 'object') throw new Error('发布计划只允许JSON数据。'); var keys = Object.keys(value).sort(), fields = []; for (var k = 0; k < keys.length; k++) fields.push(JSON.stringify(keys[k]) + ':' + stable(value[keys[k]], depth + 1)); return '{' + fields.join(',') + '}'; }
function count(tableName, where) { var result = V8.FormEngine.GetTableDataCount(tableName, { _Where: where || [] }, V8.DbTrans); if (!result || result.Code !== 1) return 0; return Number(typeof result.Data === 'number' ? result.Data : (result.DataCount || (result.Data && result.Data.Count) || 0)); }
function check(key, type, required, passed, message) { return { Key: key, Type: type, Required: required !== false, Passed: passed === true, Message: message }; }
var param = V8.Param || {}, planId = text(param.ReleasePlanId), expectedHash = text(param.ExpectedPlanHash).toLowerCase(), expectedVersion = Number(param.ExpectedRowVersion);
if (!planId) return fail('ReleasePlanId不能为空。');
var planResult = V8.FormEngine.GetFormData('mci_release_plan', { Id: planId }, V8.DbTrans); if (!planResult || planResult.Code !== 1 || !planResult.Data) return { Code: 2, Msg: '发布计划不存在。' };
var plan = planResult.Data, status = text(plan.Status), planHash = text(plan.PlanHash).toLowerCase(), rowVersion = Number(plan.RowVersion || 0);
if (['Approved', 'Blocked', 'Ready'].indexOf(status) < 0) return fail('发布计划必须先审批通过，或处于可重检状态。');
if (expectedHash && expectedHash !== planHash) return fail('发布计划哈希已变化，请刷新后重试。', { Conflict: true, CurrentPlanHash: planHash });
if (isFinite(expectedVersion) && expectedVersion >= 0 && expectedVersion !== rowVersion) return fail('发布计划行版本已变化，请刷新后重试。', { Conflict: true, CurrentRowVersion: rowVersion });
var gates, resources, rollback, policy, evidence;
try { gates = rows(parse(plan.GatesJson, [], 'GatesJson')); resources = rows(parse(plan.ResourcesJson, [], 'ResourcesJson')); rollback = rows(parse(plan.RollbackJson, [], 'RollbackJson')); policy = parse(plan.ApprovalPolicyJson, {}, 'ApprovalPolicyJson'); evidence = parse(plan.EvidenceJson, {}, 'EvidenceJson'); }
catch (error) { return fail(error.message); }
var snapshot = { ReleaseKey: text(plan.ReleaseKey), Name: text(plan.Name), VersionNo: text(plan.VersionNo), Environment: text(plan.Environment), PortalProjectId: text(plan.PortalProjectId), Gates: gates, Resources: resources, Rollback: rollback, ApprovalPolicy: policy, Evidence: evidence, ChangeSummary: text(plan.ChangeSummary) }, canonical, actualHash;
try { canonical = stable(snapshot, 0); actualHash = text(V8.EncryptHelper.Sha256Hex(canonical)).toLowerCase(); } catch (error) { return fail(error.message); }
var checks = [];
checks.push(check('plan-hash', 'PlanIntegrity', true, !!planHash && actualHash === planHash, actualHash === planHash ? '计划哈希一致。' : '计划内容已经偏离固定哈希。'));
checks.push(check('resources', 'ReleaseResources', true, resources.length > 0, resources.length > 0 ? ('已固定' + resources.length + '个发布步骤。') : '没有发布资源步骤。'));
var production = text(plan.Environment) === 'Production', evidenceCount = evidence && typeof evidence === 'object' ? Object.keys(evidence).length : 0;
checks.push(check('rollback', 'RollbackPlan', production, !production || rollback.length > 0, rollback.length > 0 ? ('已固定' + rollback.length + '个回滚步骤。') : '生产发布必须有回滚步骤。'));
checks.push(check('evidence', 'ReleaseEvidence', production, !production || evidenceCount > 0, evidenceCount > 0 ? '测试与回读证据已固定。' : '生产发布必须有测试与回读证据。'));
var requiredApprovals = Math.max(1, Math.min(10, Number(policy.RequiredApprovals || 1))), approvalResult = V8.FormEngine.GetTableData('mci_release_approval', { _Where: [['ReleasePlanId', '=', planId], ['AND', 'PlanHash', '=', planHash], ['AND', 'ReviewRound', '=', Number(plan.ReviewRound || 0)], ['AND', 'Decision', '=', 'Approve']], _PageIndex: 1, _PageSize: 20 }, V8.DbTrans), approvals = approvalResult && approvalResult.Code === 1 ? rows(approvalResult.Data) : [], approvers = {}, approvalCount = 0, creatorApproved = false;
for (var ap = 0; ap < approvals.length; ap++) { var approverId = text(approvals[ap].ApproverUserId); if (!approverId || approvers[approverId]) continue; approvers[approverId] = true; if (approverId === text(plan.CreateUserId)) creatorApproved = true; approvalCount++; }
var approvalPassed = approvalCount >= requiredApprovals && !(policy.SeparationOfDuties === true && creatorApproved);
checks.push(check('approvals', 'ApprovalEvidence', true, approvalPassed, approvalPassed ? ('已取得' + approvalCount + '个有效批准。') : ('有效批准不足或违反职责分离，要求' + requiredApprovals + '人。')));
for (var i = 0; i < gates.length; i++) {
  var gate = gates[i] || {}, type = text(gate.Type), required = gate.Required !== false, item;
  if (type === 'NoCriticalAlerts') { var critical = count('mci_alert_event', [['Status', 'In', ['New', 'Acknowledged']], ['AND', 'Severity', 'In', ['Critical', 'High']]]); item = check(gate.Key, type, required, critical === 0, critical === 0 ? '没有活动中的高危告警。' : ('存在' + critical + '条高危告警。')); }
  else if (type === 'NoIdentityConflicts') { var conflicts = count('mci_identity_sync_conflict', [['Status', '=', 'Open']]); item = check(gate.Key, type, required, conflicts === 0, conflicts === 0 ? '没有未解决身份冲突。' : ('存在' + conflicts + '条未解决身份冲突。')); }
  else if (type === 'NoConfigurationDrift') { var driftWhere = [['Status', 'In', ['Changed', 'Reopened']]]; if (text(gate.Environment)) driftWhere.push(['AND', 'Environment', '=', text(gate.Environment)]); var drifts = count('mci_configuration_drift', driftWhere); item = check(gate.Key, type, required, drifts === 0, drifts === 0 ? '没有未处置配置漂移。' : ('存在' + drifts + '条未处置配置漂移。')); }
  else if (type === 'PortalVersion') { var project = V8.FormEngine.GetFormData('mci_portal_project', { Id: text(gate.ProjectId || plan.PortalProjectId) }, V8.DbTrans); var portalPassed = !!(project && project.Code === 1 && project.Data && project.Data.ActiveVersionId && project.Data.PublishedHash); item = check(gate.Key, type, required, portalPassed, portalPassed ? '门户已绑定不可变发布版本。' : '门户尚未发布。'); }
  else if (type === 'FeatureFlag') { var evaluated = V8.ApiEngine.Run('mci-feature-flag-evaluate', { FlagKey: gate.FlagKey, Context: gate.Context || {} }, V8.DbTrans), flagPassed = !!(evaluated && evaluated.Code === 1 && evaluated.Data && evaluated.Data.Enabled === (gate.ExpectedEnabled !== false)); item = check(gate.Key, type, required, flagPassed, evaluated && evaluated.Code === 1 ? text(evaluated.Data.Reason) : text(evaluated && evaluated.Msg) || '功能开关评估失败。'); }
  else if (type === 'ChangeSet') { var changed = V8.ApiEngine.Run('mci-change-set-validate', { ChangeSetId: gate.ChangeSetId, DryRun: true }, V8.DbTrans), changePassed = !!(changed && changed.Code === 1 && changed.Data && changed.Data.Passed && (!text(gate.ExpectedPlanHash) || text(changed.Data.PlanHash).toLowerCase() === text(gate.ExpectedPlanHash).toLowerCase())); item = check(gate.Key, type, required, changePassed, changePassed ? '变更集门禁通过。' : text(changed && changed.Msg) || '变更集门禁未通过。'); }
  else if (type === 'Extension') item = check(gate.Key, type, required, false, '等待租户扩展返回结论。');
  else item = check(gate.Key || ('gate-' + i), type || 'Unknown', required, false, '未知门禁类型。');
  checks.push(item);
}
var extension = V8.ApiEngine.Run('mci-release-gate-extension', { HookKey: 'ReleaseGate', ReleasePlan: snapshot, Checks: checks }, V8.DbTrans); if (!extension || extension.Code !== 1) return fail(text(extension && extension.Msg) || '租户发布门禁扩展失败。');
var extra = extension.Data && extension.Data.Gates ? rows(extension.Data.Gates) : [];
for (var e = 0; e < extra.length; e++) {
  var extensionCheck = extra[e] || {}, extensionKey = text(extensionCheck.Key); if (!extensionKey) continue;
  var merged = false;
  for (var x = 0; x < checks.length; x++) {
    if (checks[x].Key === extensionKey && checks[x].Type === 'Extension') { checks[x] = check(extensionKey, 'Extension', extensionCheck.Required !== false, extensionCheck.Passed === true, text(extensionCheck.Message)); merged = true; break; }
  }
  if (!merged) checks.push(check(extensionKey, text(extensionCheck.Type || 'Extension'), extensionCheck.Required !== false, extensionCheck.Passed === true, text(extensionCheck.Message)));
}
var passed = true; for (var c = 0; c < checks.length; c++) if (checks[c].Required !== false && checks[c].Passed !== true) passed = false;
var checkedAt = DateNow('yyyy-MM-dd HH:mm:ss'), result = { Passed: passed, PlanHash: planHash, Checks: checks, CheckedAt: checkedAt };
if (!(param.DryRun === true || Number(param.DryRun || 0) === 1)) {
  var update = V8.FormEngine.UptFormDataByWhere('mci_release_plan', { _Where: [['Id', '=', planId], ['AND', 'PlanHash', '=', planHash], ['AND', 'RowVersion', '=', rowVersion], ['AND', 'Status', 'In', ['Approved', 'Blocked', 'Ready']]], Status: passed ? 'Ready' : 'Blocked', LastCheckTime: checkedAt, LastCheckJson: JSON.stringify(result), RowVersion: rowVersion + 1 }, V8.DbTrans);
  if (!update || update.Code !== 1) return update || fail('保存门禁结果发生并发冲突。');
  var verify = V8.FormEngine.GetFormData('mci_release_plan', { Id: planId }, V8.DbTrans); if (!verify || verify.Code !== 1 || text(verify.Data.Status) !== (passed ? 'Ready' : 'Blocked') || Number(verify.Data.RowVersion || 0) !== rowVersion + 1) return fail('发布门禁结果回读失败，事务已回滚。');
  result.RowVersion = rowVersion + 1;
}
return { Code: 1, Data: result, Msg: passed ? '发布门禁通过。' : '发布门禁未通过。' };
