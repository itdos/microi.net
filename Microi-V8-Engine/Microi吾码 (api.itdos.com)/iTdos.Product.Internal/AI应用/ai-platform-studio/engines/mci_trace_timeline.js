/*
 * Trace 时间线：由可信 V8.Method 从按月系统日志集合执行有界查询和字段脱敏。
 */
function fail(msg) { return { Code: 0, Msg: msg }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能查询Trace时间线。');
var traceId = String((V8.Param && V8.Param.TraceId) || '').replace(/^\s+|\s+$/g, '').toLowerCase();
if (!/^[0-9a-f]{32}$/.test(traceId)) return fail('TraceId必须是32位十六进制W3C TraceId。');
var result = V8.Method.GetTraceTimeline({
  TraceId: traceId,
  SearchMonth: String((V8.Param && V8.Param.SearchMonth) || ''),
  PageSize: Math.max(1, Math.min(500, parseInt((V8.Param && V8.Param.PageSize) || 200, 10) || 200))
});
if (!result || result.Code !== 1) return result || fail('Trace时间线查询失败。');
return result;
