/*
 * 告警状态机：显式ExpectedStatus防止多人处置互相覆盖。
 */
function fail(msg, data) { return { Code: 0, Msg: msg, Data: data || null }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能处置告警。');
var alertId = String((V8.Param && V8.Param.AlertId) || ''), action = String((V8.Param && V8.Param.Action) || ''), expected = String((V8.Param && V8.Param.ExpectedStatus) || '');
if (!alertId || !action || !expected) return fail('AlertId、Action和ExpectedStatus不能为空。');
var transitions = { Acknowledge: { New: 'Acknowledged' }, Resolve: { New: 'Resolved', Acknowledged: 'Resolved' }, Reopen: { Resolved: 'New', Closed: 'New' }, Close: { Resolved: 'Closed' } };
if (!transitions[action] || !transitions[action][expected]) return fail('不允许的告警状态迁移：' + expected + ' -> ' + action);
var alertResult = V8.FormEngine.GetFormData('mci_alert_event', { Id: alertId });
if (!alertResult || alertResult.Code !== 1 || !alertResult.Data) return { Code: 2, Msg: '告警不存在。' };
if (String(alertResult.Data.Status || '') !== expected) return fail('告警状态已变化。', { Conflict: true, CurrentStatus: alertResult.Data.Status });
var next = transitions[action][expected], now = DateNow('yyyy-MM-dd HH:mm:ss');
var patch = {
  _Where: [['Id', '=', alertId], ['AND', 'Status', '=', expected]], Status: next,
  AcknowledgeUserId: next === 'Acknowledged' ? String(V8.CurrentUser.Id || '') : alertResult.Data.AcknowledgeUserId,
  AcknowledgeTime: next === 'Acknowledged' ? now : alertResult.Data.AcknowledgeTime,
  Resolution: String((V8.Param && V8.Param.Resolution) || alertResult.Data.Resolution || '')
};
var update = V8.FormEngine.UptFormDataByWhere('mci_alert_event', patch);
var verify = V8.FormEngine.GetFormData('mci_alert_event', { Id: alertId });
if (!update || update.Code !== 1 || !verify || verify.Code !== 1 || String(verify.Data.Status || '') !== next) return fail('告警状态迁移发生并发冲突。', { Conflict: true });
if (next === 'Acknowledged') V8.FormEngine.UptFormDataByWhere('mci_alert_delivery', { _Where: [['AlertId', '=', alertId], ['AND', 'Status', '=', 'Delivered']], Status: 'Acknowledged' });
return { Code: 1, Data: { AlertId: alertId, PreviousStatus: expected, Status: next, ChangedAt: now }, Msg: '告警状态已更新。' };
