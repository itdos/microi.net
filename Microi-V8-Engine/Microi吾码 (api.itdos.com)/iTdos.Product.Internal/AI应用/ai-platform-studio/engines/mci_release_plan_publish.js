/*
 * 发布计划固定：对白名单步骤、门禁、审批策略和证据做规范化，生成稳定计划哈希并以 CAS 保存。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能固定发布计划。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function parse(value, fallback, label) { if (value === null || value === undefined || value === '') return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (error) { throw new Error(label + '不是有效JSON。'); } }
function list(value, label) { var rows = parse(value, [], label); if (!rows || rows.length === undefined || typeof rows === 'string') throw new Error(label + '必须是JSON数组。'); var out = []; for (var i = 0; i < rows.length; i++) out.push(rows[i]); return out; }
function object(value, label) { var row = parse(value, {}, label); if (!row || typeof row !== 'object' || row.length !== undefined) throw new Error(label + '必须是JSON对象。'); return row; }
function stable(value, depth) {
  if (depth > 40) throw new Error('发布计划JSON嵌套不能超过40层。');
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!isFinite(value)) throw new Error('发布计划包含非有限数字。'); return JSON.stringify(value); }
  if (value.length !== undefined && typeof value !== 'string') { var rows = []; for (var a = 0; a < value.length; a++) rows.push(stable(value[a], depth + 1)); return '[' + rows.join(',') + ']'; }
  if (typeof value !== 'object') throw new Error('发布计划只允许JSON数据。');
  var keys = Object.keys(value).sort(), fields = [];
  for (var k = 0; k < keys.length; k++) { var key = keys[k]; if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('发布计划包含禁止字段：' + key); fields.push(JSON.stringify(key) + ':' + stable(value[key], depth + 1)); }
  return '{' + fields.join(',') + '}';
}
function secretKey(key) { return /(^|[._-])(password|passwd|pwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|connection[-_]?string|conn[-_]?str|db[-_]?conn|redis[-_]?pwd)($|[._-])/i.test(key) || /(AuthToken|BearerToken|ClientSecret|PrivateKey)$/i.test(key); }
function scanSecret(value, path, depth) {
  if (depth > 40 || value === null || value === undefined) return '';
  if (typeof value === 'string') return /^\s*(Bearer\s+[A-Za-z0-9._~-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i.test(value) ? (path || 'value') : '';
  if (value.length !== undefined && typeof value !== 'string') { for (var a = 0; a < value.length; a++) { var arrayHit = scanSecret(value[a], path + '[' + a + ']', depth + 1); if (arrayHit) return arrayHit; } return ''; }
  if (typeof value !== 'object') return '';
  var keys = Object.keys(value);
  for (var k = 0; k < keys.length; k++) { var key = keys[k], next = path ? path + '.' + key : key; if (secretKey(key) && value[key] !== null && value[key] !== undefined && text(value[key]) !== '') return next; var hit = scanSecret(value[key], next, depth + 1); if (hit) return hit; }
  return '';
}
function requiredBoolean(value) { return value === false || value === 0 || text(value).toLowerCase() === 'false' ? false : true; }
function normalizeGates(value) {
  var rows = list(value, 'GatesJson'); if (rows.length > 50) throw new Error('发布门禁最多50项。');
  var allowed = { NoCriticalAlerts: 1, NoIdentityConflicts: 1, PortalVersion: 1, FeatureFlag: 1, NoConfigurationDrift: 1, ChangeSet: 1, Extension: 1 }, seen = {}, out = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]; if (!row || typeof row !== 'object' || row.length !== undefined) throw new Error('第' + (i + 1) + '个门禁必须是JSON对象。');
    var key = text(row.Key || ('gate-' + (i + 1))), type = text(row.Type); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,98}$/.test(key) || !allowed[type] || seen[key]) throw new Error('门禁Key重复、格式无效或Type不受支持：' + key); seen[key] = true;
    var gate = { Key: key, Type: type, Required: requiredBoolean(row.Required) };
    if (type === 'PortalVersion') gate.ProjectId = text(row.ProjectId);
    if (type === 'FeatureFlag') { gate.FlagKey = text(row.FlagKey); gate.ExpectedEnabled = row.ExpectedEnabled === false ? false : true; gate.Context = object(row.Context || {}, 'FeatureFlag.Context'); if (!gate.FlagKey) throw new Error('FeatureFlag门禁缺少FlagKey。'); }
    if (type === 'NoConfigurationDrift') gate.Environment = text(row.Environment);
    if (type === 'ChangeSet') { gate.ChangeSetId = text(row.ChangeSetId); gate.ExpectedPlanHash = text(row.ExpectedPlanHash).toLowerCase(); if (!gate.ChangeSetId) throw new Error('ChangeSet门禁缺少ChangeSetId。'); }
    if (type === 'Extension') { gate.OperationKey = text(row.OperationKey); gate.Params = object(row.Params || {}, 'Extension.Params'); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,118}$/.test(gate.OperationKey)) throw new Error('Extension门禁缺少有效OperationKey。'); }
    out.push(gate);
  }
  return out;
}
function normalizeSteps(value, rollback) {
  var label = rollback ? 'RollbackJson' : 'ResourcesJson', rows = list(value, label); if (rows.length > 100) throw new Error(label + '最多100项。');
  var allowedAction = rollback ? { Verify: 1, PortalRollback: 1, Extension: 1 } : { Verify: 1, PortalPublish: 1, Extension: 1 }, verifyTypes = { FeatureFlag: 1, ConfigurationProfile: 1, ServicePolicy: 1, AssetVersion: 1, Portal: 1, ChangeSet: 1 }, seen = {}, out = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i]; if (!row || typeof row !== 'object' || row.length !== undefined) throw new Error(label + '第' + (i + 1) + '项必须是JSON对象。');
    var stepKey = text(row.StepKey || ('step-' + (i + 1))), action = text(row.Action); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,98}$/.test(stepKey) || !allowedAction[action] || seen[stepKey]) throw new Error(label + '步骤Key重复、格式无效或Action不受支持：' + stepKey); seen[stepKey] = true;
    var step = { StepKey: stepKey, Action: action, ResourceType: text(row.ResourceType), ResourceId: text(row.ResourceId), ResourceKey: text(row.ResourceKey), ExpectedHash: text(row.ExpectedHash).toLowerCase(), Params: {} };
    var params = object(row.Params || {}, label + '.Params');
    if (action === 'Verify') { if (!verifyTypes[step.ResourceType] || !step.ResourceId || !step.ExpectedHash) throw new Error('Verify步骤必须声明受支持的ResourceType、ResourceId和ExpectedHash。'); }
    if (action === 'PortalPublish') { step.ResourceType = 'Portal'; step.ResourceId = step.ResourceId || text(params.ProjectId); if (!step.ResourceId || !step.ExpectedHash) throw new Error('PortalPublish步骤缺少ResourceId或ExpectedHash。'); step.Params = { ChangeSummary: text(params.ChangeSummary) }; }
    if (action === 'PortalRollback') { step.ResourceType = 'Portal'; step.ResourceId = step.ResourceId || text(params.ResourceId); if (!step.ResourceId || !step.ExpectedHash || !text(params.TargetVersionId)) throw new Error('PortalRollback步骤缺少ResourceId、ExpectedHash或TargetVersionId。'); step.Params = { TargetVersionId: text(params.TargetVersionId), ChangeSummary: text(params.ChangeSummary) }; }
    if (action === 'Extension') { step.OperationKey = text(row.OperationKey || params.OperationKey); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,118}$/.test(step.OperationKey)) throw new Error('Extension步骤缺少有效OperationKey。'); delete params.OperationKey; step.Params = params; }
    out.push(step);
  }
  return out;
}
var param = V8.Param || {}, releaseKey = text(param.ReleaseKey), name = text(param.Name), versionNo = text(param.VersionNo), environment = text(param.Environment || 'Test'), expectedHash = text(param.ExpectedPlanHash).toLowerCase();
if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,98}$/.test(releaseKey) || !name) return fail('ReleaseKey格式无效，Name不能为空。');
if (!/^v?\d+\.\d+(\.\d+)?([-.][0-9A-Za-z.-]+)?$/.test(versionNo)) return fail('VersionNo必须是语义版本。');
if (['Development', 'Test', 'Staging', 'Production'].indexOf(environment) < 0) return fail('Environment无效。');
var gates, resources, rollback, policy, evidence;
try {
  gates = normalizeGates(param.Gates || param.GatesJson); resources = normalizeSteps(param.Resources || param.ResourcesJson, false); rollback = normalizeSteps(param.Rollback || param.RollbackJson, true); policy = object(param.ApprovalPolicy || param.ApprovalPolicyJson, 'ApprovalPolicyJson'); evidence = object(param.Evidence || param.EvidenceJson, 'EvidenceJson');
  var required = Number(policy.RequiredApprovals === undefined ? (environment === 'Production' ? 2 : 1) : policy.RequiredApprovals); if (!isFinite(required) || required < 1 || required > 10 || Math.floor(required) !== required) throw new Error('RequiredApprovals必须是1到10的整数。');
  policy = { RequiredApprovals: required, SeparationOfDuties: policy.SeparationOfDuties === undefined ? environment === 'Production' : requiredBoolean(policy.SeparationOfDuties) };
  var secretPath = scanSecret({ Gates: gates, Resources: resources, Rollback: rollback, Evidence: evidence }, '', 0); if (secretPath) throw new Error('发布计划中发现疑似秘密字段[' + secretPath + ']，请改用安全引用。');
} catch (error) { return fail(error.message); }
var snapshot = { ReleaseKey: releaseKey, Name: name, VersionNo: versionNo, Environment: environment, PortalProjectId: text(param.PortalProjectId), Gates: gates, Resources: resources, Rollback: rollback, ApprovalPolicy: policy, Evidence: evidence, ChangeSummary: text(param.ChangeSummary) };
var canonical; try { canonical = stable(snapshot, 0); } catch (error) { return fail(error.message); }
if (canonical.length > 1048576) return fail('发布计划不能超过1MB。');
var planHash = text(V8.EncryptHelper.Sha256Hex(canonical)).toLowerCase(), existing = V8.FormEngine.GetFormData('mci_release_plan', { _Where: [['ReleaseKey', '=', releaseKey]] }, V8.DbTrans), row = existing && existing.Code === 1 ? existing.Data : null, currentHash = text(row && row.PlanHash).toLowerCase();
if (currentHash !== expectedHash) return fail('发布计划已变化，请刷新后重新校验。', { Conflict: true, CurrentPlanHash: currentHash });
if (row && ['Draft', 'Rejected'].indexOf(text(row.Status)) < 0) return fail('当前状态不允许修改发布计划，请先完成或重新打开审批流。');
if (row && currentHash === planHash) return { Code: 1, Data: { ReleasePlanId: row.Id, PlanHash: planHash, RowVersion: Number(row.RowVersion || 0), Reused: true, DryRun: !!param.DryRun, Snapshot: snapshot }, Msg: '发布计划内容未变化，已幂等复用。' };
if (param.DryRun === true || Number(param.DryRun || 0) === 1) return { Code: 1, Data: { DryRun: true, ReleasePlanId: row ? row.Id : '', PlanHash: planHash, CurrentPlanHash: currentHash, Snapshot: snapshot }, Msg: '发布计划协议、安全边界和执行步骤校验通过，尚未保存。' };
var planId = row ? text(row.Id) : text(V8.Method.NewUlid()), rawVersion = row && row.RowVersion, rowVersion = Number(rawVersion || 0), expectedVersion = rawVersion === null || rawVersion === undefined || rawVersion === '' ? null : rowVersion;
var data = { Id: planId, ReleaseKey: releaseKey, Name: name, VersionNo: versionNo, Environment: environment, PortalProjectId: snapshot.PortalProjectId, GatesJson: JSON.stringify(gates), ResourcesJson: JSON.stringify(resources), RollbackJson: JSON.stringify(rollback), ApprovalPolicyJson: JSON.stringify(policy), EvidenceJson: JSON.stringify(evidence), PlanHash: planHash, Status: 'Draft', LastCheckTime: '', LastCheckJson: '{}', ChangeSummary: snapshot.ChangeSummary, ApprovedBy: '', ApprovalTime: '', LastRunId: '', ReleasedTime: '', RowVersion: rowVersion + 1 }, save;
if (row) { data._Where = [['Id', '=', planId], ['AND', 'RowVersion', '=', expectedVersion], ['AND', 'PlanHash', '=', currentHash || null]]; save = V8.FormEngine.UptFormDataByWhere('mci_release_plan', data, V8.DbTrans); }
else save = V8.FormEngine.AddFormData('mci_release_plan', data, V8.DbTrans);
if (!save || save.Code !== 1) return save || fail('保存发布计划发生并发冲突。');
var verify = V8.FormEngine.GetFormData('mci_release_plan', { Id: planId }, V8.DbTrans); if (!verify || verify.Code !== 1 || text(verify.Data.PlanHash).toLowerCase() !== planHash || Number(verify.Data.RowVersion || 0) !== rowVersion + 1) return fail('发布计划保存回读失败，事务已回滚。');
return { Code: 1, Data: { ReleasePlanId: planId, PlanHash: planHash, RowVersion: rowVersion + 1, Reused: false, Snapshot: snapshot }, Msg: '发布计划已固定为可审计草稿。' };
