/*
 * 告警送达执行器：条件抢占送达台账，向租户扩展传递稳定幂等键，并以行版本完成或释放租约。
 */
var jobName = String((V8.Param && V8.Param.JobName) || '');
if (jobName !== 'MciAiPlatformMinuteSweep') return { Code: 0, Msg: '拒绝非预期平台维护任务调用。' };
function text(value) { return value === null || value === undefined ? '' : String(value).replace(/^\s+|\s+$/g, ''); }
var now = System.DateTime.UtcNow, nowText = now.ToString('yyyy-MM-dd HH:mm:ss'), leaseText = now.AddMinutes(2).ToString('yyyy-MM-dd HH:mm:ss');
var rowsResult = V8.FormEngine.GetTableData('mci_alert_delivery', {
  _Where: [
    ['Status', 'In', ['Pending', 'Failed', 'Sending']],
    ['AND', '(', 'NextRetryTime', '=', null],
    ['OR', 'NextRetryTime', '=', ''],
    ['OR', 'NextRetryTime', '<=', nowText, ')']
  ],
  _OrderBy: 'CreateTime',
  _OrderByType: 'ASC',
  _PageIndex: 1,
  _PageSize: 100
});
if (!rowsResult || rowsResult.Code !== 1) return rowsResult || { Code: 0, Msg: '读取待发送告警失败。' };
var rows = rowsResult.Data || [], deliveredCount = 0, failedCount = 0, claimedCount = 0, skippedCount = 0, failures = [];
for (var i = 0; i < rows.length; i++) {
  var row = rows[i] || {}, rawVersion = row.RowVersion, version = Number(rawVersion || 0), expectedVersion = (rawVersion === null || rawVersion === undefined || rawVersion === '') ? null : version;
  var attempts = Number(row.AttemptCount || 0);
  if (attempts >= 8) { skippedCount++; continue; }
  var leaseExpired = !text(row.LeaseExpiresAt) || text(row.LeaseExpiresAt) <= nowText;
  if (text(row.Status) === 'Sending' && !leaseExpired) { skippedCount++; continue; }
  var claimToken = V8.Method.NewUlid();
  var claim = V8.FormEngine.UptFormDataByWhere('mci_alert_delivery', {
    _Where: [['Id', '=', row.Id], ['AND', 'RowVersion', '=', expectedVersion], ['AND', 'Status', 'In', ['Pending', 'Failed', 'Sending']]],
    Status: 'Sending', ClaimToken: claimToken, LeaseExpiresAt: leaseText, AttemptCount: attempts + 1, RowVersion: version + 1
  });
  if (!claim || claim.Code !== 1) { skippedCount++; continue; }
  var claimed = V8.FormEngine.GetFormData('mci_alert_delivery', { Id: row.Id });
  if (!claimed || claimed.Code !== 1 || !claimed.Data || text(claimed.Data.ClaimToken) !== claimToken || Number(claimed.Data.RowVersion || 0) !== version + 1) { skippedCount++; continue; }
  claimedCount++;
  var alertResult = V8.FormEngine.GetFormData('mci_alert_event', { Id: row.AlertId });
  var routeResult = row.RouteId ? V8.FormEngine.GetFormData('mci_alert_route', { Id: row.RouteId }) : null;
  var alert = alertResult && alertResult.Code === 1 ? alertResult.Data : null, route = routeResult && routeResult.Code === 1 ? routeResult.Data : null;
  var notify = alert ? V8.ApiEngine.Run('mci-alert-notify-extension', {
    HookKey: 'AlertNotify', IdempotencyKey: row.DeliveryKey, EventKind: row.EventKind || 'Trigger', Alert: alert, AlertId: row.AlertId, Route: route,
    Delivery: { Id: row.Id, DeliveryKey: row.DeliveryKey, EventKind: row.EventKind || 'Trigger', Channel: row.Channel, Recipient: row.Recipient, EscalationLevel: Number(row.EscalationLevel || 0) }
  }) : { Code: 0, Msg: '告警事件不存在。' };
  var delivered = notify && notify.Code === 1, nextRetry = delivered ? '' : now.AddMinutes(Math.min(60, Math.pow(2, Math.min(6, attempts)))).ToString('yyyy-MM-dd HH:mm:ss');
  var finish = V8.FormEngine.UptFormDataByWhere('mci_alert_delivery', {
    _Where: [['Id', '=', row.Id], ['AND', 'ClaimToken', '=', claimToken], ['AND', 'RowVersion', '=', version + 1], ['AND', 'Status', '=', 'Sending']],
    Status: delivered ? 'Delivered' : 'Failed', RemoteMessageId: delivered && notify.Data ? text(notify.Data.MessageId) : '', DeliveredTime: delivered ? nowText : '', NextRetryTime: nextRetry,
    LastError: delivered ? '' : text((notify && notify.Msg) || '租户通知扩展失败').slice(0, 1900), ClaimToken: '', LeaseExpiresAt: '', RowVersion: version + 2
  });
  if (!finish || finish.Code !== 1) { failures.push({ DeliveryId: row.Id, Message: '送达结果条件提交失败；渠道必须按DeliveryKey幂等。' }); continue; }
  if (delivered) deliveredCount++; else { failedCount++; failures.push({ DeliveryId: row.Id, Message: text((notify && notify.Msg) || '通知失败').slice(0, 500) }); }
}
return { Code: 1, Data: { Scanned: rows.length, Claimed: claimedCount, Delivered: deliveredCount, Failed: failedCount, Skipped: skippedCount, Failures: failures }, Msg: failures.length ? '告警送达扫描完成，部分渠道待重试。' : '告警送达扫描完成。' };
