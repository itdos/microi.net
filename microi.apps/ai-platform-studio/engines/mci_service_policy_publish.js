/* 服务流量与韧性策略：协议校验、稳定摘要、DryRun、CAS发布和不可变版本证据。 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能发布服务策略。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function list(value) { if (!value) return []; if (value.length !== undefined && typeof value !== 'string') { var out = []; for (var i = 0; i < value.length; i++) out.push(value[i]); return out; } return []; }
function enabled(value, fallback) { if (value === null || value === undefined || value === '') return fallback ? 1 : 0; return value === false || value === 0 || text(value) === '0' || text(value).toLowerCase() === 'false' ? 0 : 1; }
function uniqueText(value, max, label) {
  var rows = list(value), seen = {}, out = [];
  for (var i = 0; i < rows.length; i++) { var item = text(rows[i]); if (!item || seen[item]) continue; seen[item] = true; out.push(item); }
  if (out.length > max) throw new Error(label + '最多' + max + '项。');
  out.sort(); return out;
}
function parse(value, fallback, label) { if (!value) return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (error) { throw new Error(label + '不是有效JSON。'); } }
function stable(value, depth) {
  if (depth > 60) throw new Error('策略JSON嵌套不能超过60层。');
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!isFinite(value)) throw new Error('策略包含非有限数字。'); return JSON.stringify(value); }
  if (value.length !== undefined && typeof value !== 'string') { var rows = []; for (var a = 0; a < value.length; a++) rows.push(stable(value[a], depth + 1)); return '[' + rows.join(',') + ']'; }
  if (typeof value !== 'object') throw new Error('策略只允许JSON数据。');
  var keys = Object.keys(value).sort(), fields = [];
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('策略包含禁止字段：' + key);
    fields.push(JSON.stringify(key) + ':' + stable(value[key], depth + 1));
  }
  return '{' + fields.join(',') + '}';
}
function normalizePolicy(param) {
  var targets = list(parse(param.Targets || param.TargetsJson, [], 'TargetsJson')), match = parse(param.Match || param.MatchJson, {}, 'MatchJson');
  var retry = parse(param.Retry || param.RetryJson, {}, 'RetryJson'), circuit = parse(param.Circuit || param.CircuitJson || param.CircuitBreakerJson, {}, 'CircuitJson');
  var rate = parse(param.RateLimit || param.RateLimitJson, {}, 'RateLimitJson'), degrade = parse(param.Degrade || param.DegradeJson, {}, 'DegradeJson');
  if (!match || typeof match !== 'object' || match.length !== undefined) throw new Error('MatchJson必须是JSON对象。');
  match = {
    AllowedRoleIds: uniqueText(match.AllowedRoleIds || match.RoleIds, 100, '允许角色'),
    DeniedRoleIds: uniqueText(match.DeniedRoleIds, 100, '拒绝角色'),
    SubjectKeys: uniqueText(match.SubjectKeys || match.Subjects, 100, '调用主体'),
    Percentage: Math.max(0, Math.min(100, Number(match.Percentage === undefined ? 100 : match.Percentage))),
    Priority: Math.max(-10000, Math.min(10000, Number(match.Priority || 0)))
  };
  if (!isFinite(match.Percentage) || !isFinite(match.Priority)) throw new Error('MatchJson包含无效数字。');
  if (targets.length > 30) throw new Error('版本目标最多30项。');
  var normalizedTargets = [], targetKeys = {};
  for (var i = 0; i < targets.length; i++) {
    var target = targets[i] || {}, version = text(target.VersionNo || target.Version || '*'), zone = text(target.Zone), weight = Number(target.Weight === undefined ? 100 : target.Weight);
    if (version !== '*' && !/^v?\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$/.test(version)) throw new Error('目标版本格式无效：' + version);
    if (!isFinite(weight) || weight < 0 || weight > 10000) throw new Error('目标权重必须在0到10000之间。');
    var targetKey = version + ':' + zone + ':' + stable(target.Labels || {}, 0);
    if (targetKeys[targetKey]) throw new Error('版本目标重复：' + version + (zone ? '/' + zone : ''));
    targetKeys[targetKey] = true;
    if (!target.Labels || typeof target.Labels !== 'object' || target.Labels.length !== undefined) target.Labels = {};
    normalizedTargets.push({ VersionNo: version, Zone: zone, Labels: target.Labels, Weight: weight, Enabled: enabled(target.Enabled, true) });
  }
  var maxAttempts = Math.max(1, Math.min(3, Number(retry.MaxAttempts || retry.maxAttempts || 1))), baseDelayMs = Math.max(0, Math.min(5000, Number(retry.BaseDelayMs || retry.baseDelayMs || 0)));
  var retryStatusCodes = list(retry.RetryStatusCodes || retry.retryStatusCodes), normalizedStatusCodes = [], statusSeen = {};
  for (var r = 0; r < retryStatusCodes.length; r++) { var statusCode = Number(retryStatusCodes[r]); if (!isFinite(statusCode) || statusCode < 100 || statusCode > 599) throw new Error('RetryStatusCodes包含无效HTTP状态码。'); statusCode = Math.floor(statusCode); if (!statusSeen[statusCode]) { statusSeen[statusCode] = true; normalizedStatusCodes.push(statusCode); } }
  if (normalizedStatusCodes.length > 20) throw new Error('RetryStatusCodes最多20项。');
  normalizedStatusCodes.sort(function (a, b) { return a - b; });
  var failureThreshold = Math.max(1, Math.min(100, Number(circuit.FailureThreshold || circuit.failureThreshold || 5))), breakSeconds = Math.max(1, Math.min(3600, Number(circuit.BreakSeconds || circuit.breakSeconds || 30))), halfOpenMaxCalls = Math.max(1, Math.min(20, Number(circuit.HalfOpenMaxCalls || circuit.halfOpenMaxCalls || 1)));
  var requests = Math.max(0, Math.min(100000, Number(rate.Requests || rate.requests || 0))), windowSeconds = Math.max(1, Math.min(3600, Number(rate.WindowSeconds || rate.windowSeconds || 60))), scope = text(rate.Scope || rate.scope || 'Subject');
  if (['Subject', 'Tenant'].indexOf(scope) < 0) throw new Error('RateLimit.Scope只允许Subject或Tenant。');
  var degradeMode = text(degrade.Mode || degrade.mode || 'Fail');
  if (['Fail', 'Static', 'FallbackService'].indexOf(degradeMode) < 0) throw new Error('Degrade.Mode只允许Fail、Static或FallbackService。');
  if (degradeMode === 'FallbackService' && !text(degrade.ServiceKey || degrade.serviceKey)) throw new Error('FallbackService必须配置ServiceKey。');
  return {
    Match: match,
    Targets: normalizedTargets,
    Retry: { MaxAttempts: maxAttempts, BaseDelayMs: baseDelayMs, RetryStatusCodes: normalizedStatusCodes },
    Circuit: { FailureThreshold: failureThreshold, BreakSeconds: breakSeconds, HalfOpenMaxCalls: halfOpenMaxCalls },
    RateLimit: { Requests: requests, WindowSeconds: windowSeconds, Scope: scope },
    Degrade: { Mode: degradeMode, ServiceKey: text(degrade.ServiceKey || degrade.serviceKey), StaticResponse: degrade.StaticResponse === undefined ? (degrade.staticResponse === undefined ? null : degrade.staticResponse) : degrade.StaticResponse }
  };
}
var param = V8.Param || {}, policyKey = text(param.PolicyKey), name = text(param.Name), serviceId = text(param.ServiceId), versionNo = text(param.VersionNo), expectedHash = text(param.ExpectedContentHash).toLowerCase();
if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,118}$/.test(policyKey) || !name || !serviceId) return fail('PolicyKey格式无效，Name和ServiceId不能为空。');
if (!/^v?\d+\.\d+(\.\d+)?([-.][0-9A-Za-z.-]+)?$/.test(versionNo)) return fail('VersionNo必须是语义版本。');
var serviceResult = V8.FormEngine.GetFormData('mci_service_registry', { Id: serviceId });
if (!serviceResult || serviceResult.Code !== 1 || !serviceResult.Data) return { Code: 2, Msg: '服务目录项不存在。' };
var normalized; try { normalized = normalizePolicy(param); } catch (error) { return fail(error.message); }
var timeoutMs = Math.max(50, Math.min(600000, Number(param.TimeoutMs || 10000))), enabledValue = enabled(param.Enabled, true);
var snapshot = { PolicyKey: policyKey, Name: name, ServiceId: serviceId, VersionNo: versionNo, Match: normalized.Match, Targets: normalized.Targets, Retry: normalized.Retry, Circuit: normalized.Circuit, RateLimit: normalized.RateLimit, Degrade: normalized.Degrade, TimeoutMs: timeoutMs, Owner: text(param.Owner), Enabled: enabledValue };
var canonical; try { canonical = stable(snapshot, 0); } catch (error) { return fail(error.message); }
if (canonical.length > 524288) return fail('服务策略不能超过512KB。');
var contentHash = text(V8.EncryptHelper.Sha256Hex(canonical)).toLowerCase(), existing = V8.FormEngine.GetFormData('mci_service_route_policy', { _Where: [['PolicyKey', '=', policyKey]] }, V8.DbTrans);
var row = existing && existing.Code === 1 ? existing.Data : null, currentHash = text(row && row.ContentHash).toLowerCase();
if (currentHash !== expectedHash) return fail('服务策略已变化，请刷新后重新校验。', { Conflict: true, CurrentHash: currentHash });
if (row && currentHash === contentHash) return { Code: 1, Data: { PolicyId: row.Id, ContentHash: contentHash, VersionNo: row.VersionNo, Reused: true, DryRun: !!param.DryRun }, Msg: '策略内容未变化，已幂等复用。' };
var versionConflict = row ? V8.FormEngine.GetFormData('mci_resource_version', { _Where: [['ResourceType', '=', 'ServicePolicy'], ['AND', 'ResourceId', '=', row.Id], ['AND', 'VersionNo', '=', versionNo]] }, V8.DbTrans) : null;
if (versionConflict && versionConflict.Code === 1 && versionConflict.Data && text(versionConflict.Data.ContentHash).toLowerCase() !== contentHash) return fail('该策略版本号已用于其它内容，请递增版本号。');
if (param.DryRun === true || Number(param.DryRun || 0) === 1) return { Code: 1, Data: { DryRun: true, PolicyId: row ? row.Id : '', ContentHash: contentHash, CurrentHash: currentHash, Snapshot: snapshot }, Msg: '服务策略协议和内容校验通过，尚未发布。' };
var policyId = row ? text(row.Id) : V8.Method.NewUlid(), now = DateNow('yyyy-MM-dd HH:mm:ss'), rawVersion = row && row.RowVersion, rowVersion = Number(rawVersion || 0), expectedVersion = (rawVersion === null || rawVersion === undefined || rawVersion === '') ? null : rowVersion;
var policyData = { Id: policyId, PolicyKey: policyKey, Name: name, ServiceId: serviceId, VersionNo: versionNo, MatchJson: JSON.stringify(normalized.Match), TargetsJson: JSON.stringify(normalized.Targets), RetryJson: JSON.stringify(normalized.Retry), CircuitJson: JSON.stringify(normalized.Circuit), RateLimitJson: JSON.stringify(normalized.RateLimit), DegradeJson: JSON.stringify(normalized.Degrade), TimeoutMs: timeoutMs, Owner: text(param.Owner), ContentHash: contentHash, RowVersion: rowVersion + 1, LastValidatedTime: now, Enabled: enabledValue };
var save;
if (row) {
  policyData._Where = [['Id', '=', policyId], ['AND', 'RowVersion', '=', expectedVersion], ['AND', 'ContentHash', '=', currentHash || null]];
  save = V8.FormEngine.UptFormDataByWhere('mci_service_route_policy', policyData, V8.DbTrans);
} else save = V8.FormEngine.AddFormData('mci_service_route_policy', policyData, V8.DbTrans);
if (!save || save.Code !== 1) return save || fail('保存服务策略发生并发冲突。');
var versionId = V8.Method.NewUlid(), addVersion = V8.FormEngine.AddFormData('mci_resource_version', { Id: versionId, ResourceType: 'ServicePolicy', ResourceId: policyId, ResourceKey: policyKey, VersionNo: versionNo, ContentHash: contentHash, SnapshotJson: canonical, ChangeSummary: text(param.ChangeSummary), Status: 'Published', PublishedTime: now }, V8.DbTrans);
if (!addVersion || addVersion.Code !== 1) return addVersion || fail('保存服务策略不可变版本失败。');
var verify = V8.FormEngine.GetFormData('mci_service_route_policy', { Id: policyId }, V8.DbTrans);
if (!verify || verify.Code !== 1 || text(verify.Data.ContentHash).toLowerCase() !== contentHash || Number(verify.Data.RowVersion || 0) !== rowVersion + 1) return fail('服务策略发布回读失败，事务已回滚。');
return { Code: 1, Data: { PolicyId: policyId, VersionId: versionId, ContentHash: contentHash, VersionNo: versionNo, RowVersion: rowVersion + 1, Reused: false }, Msg: '服务流量与韧性策略已发布。' };
