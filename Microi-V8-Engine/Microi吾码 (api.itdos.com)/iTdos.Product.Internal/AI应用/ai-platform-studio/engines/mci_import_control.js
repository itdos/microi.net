/*
 * 可恢复导入状态控制。暂停和取消在分片边界生效；恢复需重新提交后台任务。
 */
function fail(msg) { return { Code: 0, Msg: msg }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能控制导入批次。');
var jobId = String((V8.Param && V8.Param.ImportJobId) || ''), action = String((V8.Param && V8.Param.Action) || '');
if (!jobId || !action) return fail('ImportJobId和Action不能为空。');
var current = V8.FormEngine.GetFormData('mci_import_job', { Id: jobId });
if (!current || current.Code !== 1 || !current.Data) return fail('导入批次不存在。');
var status = String(current.Data.Status || ''), nextStatus = status, msg = '';
if (action === 'Pause') {
  if (status !== 'Running') return fail('只有处理中的批次可以暂停。');
  nextStatus = 'Paused'; msg = '已请求在当前安全分片结束后暂停。';
} else if (action === 'Resume') {
  if (status !== 'Paused' && status !== 'Failed' && status !== 'Staged') return fail('当前状态不能恢复执行。');
  nextStatus = 'Staged'; msg = '批次已恢复为待执行，请提交新的后台任务。';
} else if (action === 'Cancel') {
  if (status === 'RolledBack' || status === 'RollingBack') return fail('回滚中的批次不能取消。');
  nextStatus = 'Cancelled'; msg = '已请求在当前安全分片结束后取消。';
} else if (action === 'RetryFailed') {
  if (status === 'Running' || status === 'RollingBack') return fail('处理中不能重置失败行。');
  var failedRows = V8.FormEngine.GetTableData('mci_import_row', { _Where: [['JobId', '=', jobId], ['AND', 'Status', '=', 'Failed']], _SelectFields: ['Id', 'NormalizedJson', 'Action'], _PageIndex: 1, _PageSize: 2000 });
  if (!failedRows || failedRows.Code !== 1) return failedRows || fail('读取失败行失败。');
  for (var i = 0; i < (failedRows.Data || []).length; i++) {
    var row = failedRows.Data[i], normalized = {};
    try { normalized = JSON.parse(String(row.NormalizedJson || '{}')); } catch (error) { normalized = {}; }
    var inferredAction = normalized && normalized.Id ? 'Update' : (String(row.Action || '') === 'Update' ? 'Update' : 'Add');
    var reset = V8.FormEngine.UptFormData('mci_import_row', { Id: row.Id, Status: 'Pending', Action: inferredAction, ErrorCode: '', ErrorMessage: '' }, V8.DbTrans);
    if (!reset || reset.Code !== 1) return reset || fail('重置失败行失败。');
  }
  nextStatus = 'Staged'; msg = '失败行已重置为待处理，请确认修正后的动作和数据再执行。';
} else return fail('不支持的控制动作。');
var total = Number(current.Data.TotalCount || 0), success = Number(current.Data.SuccessCount || 0);
var update = V8.FormEngine.UptFormData('mci_import_job', { Id: jobId, Status: nextStatus, FailedCount: action === 'RetryFailed' ? 0 : current.Data.FailedCount, Progress: action === 'RetryFailed' && total > 0 ? Math.floor(success * 100 / total) : current.Data.Progress, LastError: '' });
if (!update || update.Code !== 1) return update || fail('更新导入状态失败。');
return { Code: 1, Data: { JobId: jobId, PreviousStatus: status, Status: nextStatus, BackgroundTaskId: current.Data.BackgroundTaskId || '' }, Msg: msg };
