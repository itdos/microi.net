/*
 * 服务调用许可：RequestId幂等、共享Redis固定窗口限流、持久调用结果重建熔断、半开探测配额。
 * 本接口只编排通用原子能力；实际HTTP调用仍由调用方使用V8.Http完成。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function authenticated() { var u = V8.CurrentUser || {}; return u && u.Id; }
if (!authenticated()) return fail('登录身份已失效，无法申请服务调用许可。');
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
function list(value) { if (!value) return []; if (value.length !== undefined && typeof value !== 'string') { var out = []; for (var i = 0; i < value.length; i++) out.push(value[i]); return out; } return []; }
function parse(value, fallback) { if (!value) return fallback; if (typeof value !== 'string') return value; try { return JSON.parse(value); } catch (ignore) { return fallback; } }
function degrade(policy, reason, append) {
  var config = policy && policy.Degrade ? policy.Degrade : { Mode: 'Fail' }, mode = text(config.Mode || 'Fail'), data = { Degraded: true, Reason: reason, Degrade: config, Policy: policy || null };
  if (append) { var keys = Object.keys(append); for (var i = 0; i < keys.length; i++) data[keys[i]] = append[keys[i]]; }
  if (mode === 'Static' || mode === 'FallbackService') return { Code: 1, Data: data, Msg: '服务已按策略降级。' };
  return fail(reason, data);
}
var param = V8.Param || {}, currentUser = V8.CurrentUser || {}, isAdmin = Number(currentUser.Level || 0) >= 9999;
var serviceKey = text(param.ServiceKey), requestId = text(param.RequestId), subject = text(isAdmin && param.SubjectKey ? param.SubjectKey : currentUser.Id), fromServiceKey = text(param.FromServiceKey), traceId = text(param.TraceId);
if (!serviceKey || !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,118}$/.test(serviceKey)) return fail('ServiceKey格式无效。');
if (!requestId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{5,119}$/.test(requestId)) return fail('RequestId必须是6至120位稳定幂等键。');
if (fromServiceKey && !/^[A-Za-z0-9][A-Za-z0-9._:-]{1,118}$/.test(fromServiceKey)) return fail('FromServiceKey格式无效。');
if (traceId.length > 100) return fail('TraceId不能超过100字符。');
var requestHash = text(V8.EncryptHelper.Sha256Hex(serviceKey + ':' + subject + ':' + requestId)).toLowerCase(), requestKey = 'mci:service:request:' + requestHash;
var priorPermitId = text(V8.Cache.Get(requestKey));
if (priorPermitId) {
  var priorPermit = parse(V8.Cache.Get('mci:service:permit:' + priorPermitId), null);
  if (priorPermit && text(priorPermit.CallerUserId) === text(currentUser.Id)) { priorPermit.Reused = true; return { Code: 1, Data: priorPermit, Msg: '已幂等复用服务调用许可。' }; }
  V8.Cache.Remove(requestKey);
}
var claimKey = requestKey + ':claim';
if (!V8.Cache.SetIfNotExists(claimKey, text(currentUser.Id), 20)) {
  priorPermitId = text(V8.Cache.Get(requestKey));
  var racingPermit = priorPermitId ? parse(V8.Cache.Get('mci:service:permit:' + priorPermitId), null) : null;
  if (racingPermit && text(racingPermit.CallerUserId) === text(currentUser.Id)) { racingPermit.Reused = true; return { Code: 1, Data: racingPermit, Msg: '已幂等复用服务调用许可。' }; }
  return fail('相同RequestId正在其它节点处理，请稍后重试。', { Retryable: true, RequestIdHash: requestHash.substring(0, 16) });
}
var resolution = V8.ApiEngine.Run('mci-service-resolve', { ServiceKey: serviceKey, SubjectKey: subject });
if (!resolution || resolution.Code !== 1 || !resolution.Data || !resolution.Data.Selected) {
  V8.Cache.Remove(claimKey);
  if (resolution && resolution.Code === 2 && resolution.Data) return degrade(resolution.Data.Policy, resolution.Msg || '没有可用服务实例。', { Service: resolution.Data.Service });
  return resolution || fail('服务解析失败。');
}
var resolved = resolution.Data, selected = resolved.Selected, policy = resolved.Policy || { PolicyKey: '__default__:' + text(resolved.Service.Id), ContentHash: 'default', Retry: { MaxAttempts: 1, BaseDelayMs: 0, RetryStatusCodes: [] }, Circuit: { FailureThreshold: 5, BreakSeconds: 30, HalfOpenMaxCalls: 1 }, RateLimit: { Requests: 0, WindowSeconds: 60, Scope: 'Subject' }, Degrade: { Mode: 'Fail', ServiceKey: '', StaticResponse: null }, TimeoutMs: 10000 };
var nowSeconds = Number(V8.Method.GetTimestamp()), rate = policy.RateLimit || {}, requestLimit = Math.max(0, Math.min(100000, Number(rate.Requests || 0))), windowSeconds = Math.max(1, Math.min(3600, Number(rate.WindowSeconds || 60))), scope = text(rate.Scope || 'Subject');
if (requestLimit > 0) {
  var windowId = Math.floor(nowSeconds / windowSeconds), scopeHash = scope === 'Tenant' ? 'tenant' : text(V8.EncryptHelper.Sha256Hex(subject)).substring(0, 24), rateKey = 'mci:service:rate:' + text(V8.EncryptHelper.Sha256Hex(serviceKey + ':' + policy.ContentHash + ':' + scopeHash + ':' + windowId)).substring(0, 40);
  var used = Number(V8.Cache.HashIncrement(rateKey, 'Count', 1)); V8.Cache.Expire(rateKey, windowSeconds + 5);
  if (used > requestLimit) { V8.Cache.Remove(claimKey); return fail('服务调用已超过当前限流窗口。', { RateLimited: true, Limit: requestLimit, Used: used, WindowSeconds: windowSeconds, RetryAfterSeconds: windowSeconds - (nowSeconds % windowSeconds) }); }
}
var circuit = policy.Circuit || {}, threshold = Math.max(1, Math.min(100, Number(circuit.FailureThreshold || 5))), breakSeconds = Math.max(1, Math.min(3600, Number(circuit.BreakSeconds || 30))), halfOpenMaxCalls = Math.max(1, Math.min(20, Number(circuit.HalfOpenMaxCalls || 1)));
var outcomes = V8.FormEngine.GetTableData('mci_service_call_outcome', { _Where: [['PolicyHash', '=', text(policy.ContentHash)], ['AND', 'InstanceId', '=', selected.Id], ['AND', 'Status', '=', 'Applied']], _SelectFields: ['Id', 'Success', 'AppliedTimestamp'], _OrderBy: 'AppliedTimestamp', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: threshold });
if (outcomes && outcomes.Code !== 1) { V8.Cache.Remove(claimKey); return outcomes; }
var outcomeRows = outcomes && outcomes.Code === 1 ? list(outcomes.Data) : [], consecutiveFailures = 0, latestFailureTimestamp = 0, circuitGeneration = '';
for (var oi = 0; oi < outcomeRows.length; oi++) { var outcome = outcomeRows[oi] || {}; if (Number(outcome.Success || 0) === 1) break; consecutiveFailures++; if (!latestFailureTimestamp) { latestFailureTimestamp = Number(outcome.AppliedTimestamp || 0); circuitGeneration = text(outcome.Id); } }
if (consecutiveFailures >= threshold && latestFailureTimestamp > 0) {
  var openUntil = latestFailureTimestamp + breakSeconds;
  if (nowSeconds < openUntil) { V8.Cache.Remove(claimKey); return degrade(policy, '服务熔断器处于打开状态。', { CircuitOpen: true, OpenUntilTimestamp: openUntil, RetryAfterSeconds: openUntil - nowSeconds }); }
  var halfOpenKey = 'mci:service:half-open:' + text(V8.EncryptHelper.Sha256Hex(policy.ContentHash + ':' + selected.Id + ':' + circuitGeneration)).substring(0, 40), halfOpenCalls = Number(V8.Cache.HashIncrement(halfOpenKey, 'Calls', 1)); V8.Cache.Expire(halfOpenKey, Math.max(60, breakSeconds * 2));
  if (halfOpenCalls > halfOpenMaxCalls) { V8.Cache.Remove(claimKey); return degrade(policy, '服务熔断器正在半开探测，当前探测配额已用尽。', { CircuitHalfOpen: true, HalfOpenMaxCalls: halfOpenMaxCalls, HalfOpenCalls: halfOpenCalls }); }
}
var retry = policy.Retry || {}, maxAttempts = Math.max(1, Math.min(3, Number(retry.MaxAttempts || 1))), baseDelayMs = Math.max(0, Math.min(5000, Number(retry.BaseDelayMs || 0))), timeoutMs = Math.max(50, Math.min(600000, Number(policy.TimeoutMs || 10000)));
var permitTtl = Math.max(60, Math.min(3600, Math.ceil((timeoutMs * maxAttempts + baseDelayMs * Math.max(0, maxAttempts - 1)) / 1000) + 60)), permitId = text(V8.Method.NewUlid()), permit = { PermitId: permitId, RequestIdHash: requestHash.substring(0, 16), CallerUserId: text(currentUser.Id), Service: resolved.Service, Selected: selected, Policy: policy, FromServiceKey: fromServiceKey, TraceId: traceId, AcquiredTimestamp: nowSeconds, ExpiresTimestamp: nowSeconds + permitTtl, CircuitState: consecutiveFailures >= threshold ? 'HalfOpen' : 'Closed', Reused: false };
if (!V8.Cache.Set('mci:service:permit:' + permitId, JSON.stringify(permit), permitTtl)) { V8.Cache.Remove(claimKey); return fail('写入共享调用许可失败。'); }
V8.Cache.Set(requestKey, permitId, permitTtl); V8.Cache.Remove(claimKey);
return { Code: 1, Data: permit, Msg: '服务调用许可已签发。' };
