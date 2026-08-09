/*
 * 服务发现：策略完整性校验、主体匹配、版本/机房/标签路由和稳定加权选择。
 * 普通调用方只获得命中的单个端点；候选拓扑仅超级管理员可见。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function authenticated() { var u = V8.CurrentUser || {}; return u && u.Id; }
if (!authenticated()) return fail('登录身份已失效，无法解析服务。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function list(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    try { var parsed = JSON.parse(value); if (parsed && parsed.length !== undefined && typeof parsed !== 'string') return list(parsed); }
    catch (ignore) { }
    var parts = value.split(','), clean = []; for (var p = 0; p < parts.length; p++) if (text(parts[p])) clean.push(text(parts[p])); return clean;
  }
  if (value.length !== undefined) { var out = []; for (var i = 0; i < value.length; i++) out.push(value[i]); return out; }
  return [];
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
  for (var k = 0; k < keys.length; k++) { var key = keys[k]; if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new Error('策略包含禁止字段。'); fields.push(JSON.stringify(key) + ':' + stable(value[key], depth + 1)); }
  return '{' + fields.join(',') + '}';
}
function containsAny(actual, expected) {
  var left = list(actual), right = list(expected);
  for (var i = 0; i < left.length; i++) for (var j = 0; j < right.length; j++) if (text(left[i]) === text(right[j])) return true;
  return false;
}
function policyView(row) {
  var match = parse(row.MatchJson, {}, 'MatchJson'), targets = list(parse(row.TargetsJson, [], 'TargetsJson'));
  var retry = parse(row.RetryJson, { MaxAttempts: 1, BaseDelayMs: 0, RetryStatusCodes: [] }, 'RetryJson');
  var circuit = parse(row.CircuitJson, { FailureThreshold: 5, BreakSeconds: 30, HalfOpenMaxCalls: 1 }, 'CircuitJson');
  var rate = parse(row.RateLimitJson, { Requests: 0, WindowSeconds: 60, Scope: 'Subject' }, 'RateLimitJson');
  var degrade = parse(row.DegradeJson, { Mode: 'Fail', ServiceKey: '', StaticResponse: null }, 'DegradeJson');
  var snapshot = { PolicyKey: text(row.PolicyKey), Name: text(row.Name), ServiceId: text(row.ServiceId), VersionNo: text(row.VersionNo), Match: match, Targets: targets, Retry: retry, Circuit: circuit, RateLimit: rate, Degrade: degrade, TimeoutMs: Number(row.TimeoutMs || 10000), Owner: text(row.Owner), Enabled: Number(row.Enabled || 0) === 1 ? 1 : 0 };
  var canonical = stable(snapshot, 0), calculated = text(V8.EncryptHelper.Sha256Hex(canonical)).toLowerCase(), expected = text(row.ContentHash).toLowerCase();
  if (expected && expected !== calculated) throw new Error('策略[' + text(row.PolicyKey) + ']完整性校验失败。');
  return { Row: row, Snapshot: snapshot, ContentHash: expected || calculated, Integrity: expected ? 'Verified' : 'Legacy' };
}
function policyMatches(policy, subject, roleIds) {
  var match = policy.Snapshot.Match || {}, denied = list(match.DeniedRoleIds), allowed = list(match.AllowedRoleIds), subjects = list(match.SubjectKeys);
  if (denied.length && containsAny(roleIds, denied)) return false;
  if (allowed.length && !containsAny(roleIds, allowed)) return false;
  if (subjects.length && subjects.indexOf(subject) < 0) return false;
  var percentage = Number(match.Percentage === undefined ? 100 : match.Percentage);
  if (!isFinite(percentage) || percentage <= 0) return false;
  if (percentage < 100) { var percentageHash = text(V8.EncryptHelper.Sha256Hex(policy.Snapshot.PolicyKey + ':' + subject)).substring(0, 8); if ((parseInt(percentageHash, 16) % 10000) >= Math.floor(percentage * 100)) return false; }
  return true;
}
function labelsMatch(actual, expected) {
  if (!expected || typeof expected !== 'object' || expected.length !== undefined) return true;
  var keys = Object.keys(expected);
  for (var i = 0; i < keys.length; i++) if (text(actual && actual[keys[i]]) !== text(expected[keys[i]])) return false;
  return true;
}
function versionMatches(actual, expected) { if (!expected || expected === '*') return true; return text(actual).replace(/^v/i, '') === text(expected).replace(/^v/i, ''); }
function safeInstance(instance) { return { Id: instance.Id, InstanceKey: instance.InstanceKey, Endpoint: instance.Endpoint, VersionNo: instance.VersionNo, Zone: instance.Zone, Weight: Number(instance.Weight || 0) }; }

var param = V8.Param || {}, serviceKey = text(param.ServiceKey), currentUser = V8.CurrentUser || {}, isAdmin = Number(currentUser.Level || 0) >= 9999;
if (!serviceKey) return fail('ServiceKey不能为空。');
var subject = text(isAdmin && param.SubjectKey ? param.SubjectKey : currentUser.Id), roleIds = list(currentUser.RoleIds);
var serviceResult = V8.FormEngine.GetFormData('mci_service_registry', { _Where: [['ServiceKey', '=', serviceKey], ['AND', 'Enabled', '=', 1]] });
if (!serviceResult || serviceResult.Code !== 1 || !serviceResult.Data) return { Code: 2, Msg: '服务目录项不存在或已停用。' };
var service = serviceResult.Data, policyResult = V8.FormEngine.GetTableData('mci_service_route_policy', { _Where: [['ServiceId', '=', service.Id], ['AND', 'Enabled', '=', 1]], _OrderBy: 'UpdateTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 100 });
if (policyResult && policyResult.Code !== 1) return policyResult;
var policyRows = policyResult && policyResult.Code === 1 ? list(policyResult.Data) : [], parsedPolicies = [];
try { for (var pr = 0; pr < policyRows.length; pr++) parsedPolicies.push(policyView(policyRows[pr])); }
catch (policyError) { return fail(policyError.message); }
parsedPolicies.sort(function (left, right) {
  var priorityDiff = Number((right.Snapshot.Match || {}).Priority || 0) - Number((left.Snapshot.Match || {}).Priority || 0); if (priorityDiff) return priorityDiff;
  var timeDiff = text(right.Row.UpdateTime || right.Row.CreateTime).localeCompare(text(left.Row.UpdateTime || left.Row.CreateTime)); if (timeDiff) return timeDiff;
  return text(left.Snapshot.PolicyKey).localeCompare(text(right.Snapshot.PolicyKey));
});
var selectedPolicy = null;
for (var pi = 0; pi < parsedPolicies.length; pi++) if (policyMatches(parsedPolicies[pi], subject, roleIds)) { selectedPolicy = parsedPolicies[pi]; break; }
var now = System.DateTime.UtcNow.ToString('yyyy-MM-dd HH:mm:ss'), instancesResult = V8.FormEngine.GetTableData('mci_service_instance', {
  _Where: [['ServiceId', '=', service.Id], ['AND', 'State', '=', 'Ready'], ['AND', 'LeaseExpiresAt', '>', now], ['AND', 'Weight', '>', 0]],
  _SelectFields: ['Id', 'InstanceKey', 'Endpoint', 'VersionNo', 'Zone', 'LabelsJson', 'Weight', 'LeaseExpiresAt', 'FencingToken'],
  _OrderBy: 'InstanceKey', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 200
});
if (!instancesResult || instancesResult.Code !== 1) return instancesResult || fail('读取服务实例失败。');
var instances = list(instancesResult.Data), candidates = [], targets = selectedPolicy ? selectedPolicy.Snapshot.Targets : [];
try {
  for (var ii = 0; ii < instances.length; ii++) {
    var instance = instances[ii], labels = parse(instance.LabelsJson, {}, 'LabelsJson'), targetWeight = targets.length ? 0 : 100, matchedTarget = '';
    for (var ti = 0; ti < targets.length; ti++) {
      var target = targets[ti] || {};
      if (Number(target.Enabled === undefined ? 1 : target.Enabled) !== 1 || !versionMatches(instance.VersionNo, target.VersionNo) || (text(target.Zone) && text(target.Zone) !== text(instance.Zone)) || !labelsMatch(labels, target.Labels)) continue;
      targetWeight = Number(target.Weight || 0); matchedTarget = text(target.VersionNo) + (text(target.Zone) ? '/' + text(target.Zone) : ''); break;
    }
    var effectiveWeight = Math.max(0, Math.floor(Number(instance.Weight || 0) * Math.max(0, targetWeight)));
    if (effectiveWeight > 0) candidates.push({ Instance: instance, EffectiveWeight: effectiveWeight, MatchedTarget: matchedTarget });
  }
} catch (instanceError) { return fail(instanceError.message); }
var policyProjection = selectedPolicy ? { PolicyKey: selectedPolicy.Snapshot.PolicyKey, VersionNo: selectedPolicy.Snapshot.VersionNo, ContentHash: selectedPolicy.ContentHash, Integrity: selectedPolicy.Integrity, Retry: selectedPolicy.Snapshot.Retry, Circuit: selectedPolicy.Snapshot.Circuit, RateLimit: selectedPolicy.Snapshot.RateLimit, Degrade: selectedPolicy.Snapshot.Degrade, TimeoutMs: selectedPolicy.Snapshot.TimeoutMs } : null;
if (!candidates.length) return { Code: 2, Msg: '当前没有符合策略且租约有效的就绪实例。', Data: { Service: { Id: service.Id, ServiceKey: service.ServiceKey, Name: service.Name, Environment: service.Environment }, Policy: policyProjection, Degrade: policyProjection ? policyProjection.Degrade : { Mode: 'Fail' }, Degraded: true, ResolvedAt: now } };
var totalWeight = 0; for (var wi = 0; wi < candidates.length; wi++) totalWeight += candidates[wi].EffectiveWeight;
var hashInput = serviceKey + ':' + subject + ':' + (selectedPolicy ? selectedPolicy.ContentHash : 'default'), hash = text(V8.EncryptHelper.Sha256Hex(hashInput)).substring(0, 12), bucket = parseInt(hash, 16) % totalWeight, cursor = 0, selectedCandidate = candidates[0];
for (var ci = 0; ci < candidates.length; ci++) { cursor += candidates[ci].EffectiveWeight; if (bucket < cursor) { selectedCandidate = candidates[ci]; break; } }
var selected = safeInstance(selectedCandidate.Instance), data = { Service: { Id: service.Id, ServiceKey: service.ServiceKey, Name: service.Name, Environment: service.Environment }, Selected: selected, Policy: policyProjection, Selection: { SubjectKeyHash: text(V8.EncryptHelper.Sha256Hex(subject)).substring(0, 16), Bucket: bucket, TotalWeight: totalWeight, MatchedTarget: selectedCandidate.MatchedTarget }, ResolvedAt: now };
if (isAdmin) { data.Candidates = []; for (var ai = 0; ai < candidates.length; ai++) data.Candidates.push({ Instance: candidates[ai].Instance, EffectiveWeight: candidates[ai].EffectiveWeight, MatchedTarget: candidates[ai].MatchedTarget }); }
return { Code: 1, Data: data };
