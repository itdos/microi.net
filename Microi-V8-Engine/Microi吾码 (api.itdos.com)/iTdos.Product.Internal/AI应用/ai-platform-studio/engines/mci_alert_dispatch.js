/*
 * 告警路由：只在当前事务写入可重试送达台账，不在告警事实提交前产生外部副作用。
 */
function fail(msg) { return { Code: 0, Msg: msg }; }
function adminOrInternal() { var u = V8.CurrentUser || {}; return (u && u.Id && Number(u.Level || 0) >= 9999) || String((V8.Param && V8.Param.JobName) || '') === 'MciAiPlatformMinuteSweep'; }
if (!adminOrInternal()) return fail('权限不足：只有超级管理员或平台维护任务才能派发告警。');
function list(value) { if (!value) return []; if (value.length !== undefined && typeof value !== 'string') { var out = []; for (var i = 0; i < value.length; i++) out.push(value[i]); return out; } try { var parsed = JSON.parse(String(value)); return parsed && parsed.length !== undefined ? parsed : []; } catch (error) { return []; } }
var alertId = String((V8.Param && V8.Param.AlertId) || '');
var level = Math.max(0, Math.min(9, parseInt((V8.Param && V8.Param.EscalationLevel) || 0, 10) || 0));
var eventKind = String((V8.Param && V8.Param.EventKind) || (level > 0 ? 'Escalation' : 'Trigger'));
if (['Trigger', 'Reopen', 'Recovery', 'Escalation'].indexOf(eventKind) < 0) return fail('EventKind无效。');
if (!alertId) return fail('AlertId不能为空。');
var alertResult = V8.FormEngine.GetFormData('mci_alert_event', { Id: alertId });
if (!alertResult || alertResult.Code !== 1 || !alertResult.Data) return { Code: 2, Msg: '告警事件不存在。' };
var alert = alertResult.Data;
var routesResult = V8.FormEngine.GetTableData('mci_alert_route', { _Where: [['Enabled', '=', 1]], _OrderBy: 'Priority', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 100 });
if (!routesResult || routesResult.Code !== 1) return routesResult || fail('读取告警路由失败。');
var routes = routesResult.Data || [], route = null;
for (var r = 0; r < routes.length; r++) {
  var match = {}; try { match = JSON.parse(String(routes[r].MatchJson || '{}')); } catch (error) { continue; }
  if (match.Severities && list(match.Severities).indexOf(String(alert.Severity || '')) < 0) continue;
  if (match.ServiceIds && list(match.ServiceIds).indexOf(String(alert.ServiceId || '')) < 0) continue;
  route = routes[r]; break;
}
var channels = route ? list(route.ChannelsJson) : [{ Channel: 'TenantExtension', Recipient: 'default' }];
var deliveries = [];
for (var c = 0; c < channels.length; c++) {
  var channel = channels[c] || {}, channelName = String(channel.Channel || channel.Type || ''), recipient = String(channel.Recipient || channel.Target || '');
  if (!channelName || !recipient) continue;
  var deliveryKey = String(V8.EncryptHelper.Sha256Hex(alertId + ':' + eventKind + ':' + String(route ? route.Id : '') + ':' + level + ':' + channelName + ':' + recipient)).toLowerCase();
  var existing = V8.FormEngine.GetFormData('mci_alert_delivery', { _Where: [['DeliveryKey', '=', deliveryKey]] });
  if (existing && existing.Code === 1 && existing.Data) { deliveries.push(existing.Data); continue; }
  var deliveryId = V8.Method.NewUlid();
  var add = V8.FormEngine.AddFormData('mci_alert_delivery', { Id: deliveryId, DeliveryKey: deliveryKey, AlertId: alertId, RouteId: route ? route.Id : '', EventKind: eventKind, EscalationLevel: level, Channel: channelName, Recipient: recipient, Status: 'Pending', AttemptCount: 0, RowVersion: 0, ClaimToken: '', LeaseExpiresAt: '', NextRetryTime: '' });
  if (!add || add.Code !== 1) continue;
  deliveries.push({ Id: deliveryId, DeliveryKey: deliveryKey, EventKind: eventKind, Status: 'Pending', Channel: channelName, Recipient: recipient });
}
return { Code: 1, Data: { AlertId: alertId, RouteId: route ? route.Id : '', EventKind: eventKind, EscalationLevel: level, Deliveries: deliveries }, Msg: '告警路由已写入持久送达台账。' };
