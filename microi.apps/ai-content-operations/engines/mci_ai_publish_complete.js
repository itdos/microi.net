var user = V8.CurrentUser || {};
if (!user.Id) return { Code: 0, Msg: '未登录或访问密钥无效。' };

function safeWorker(value) {
  var worker = String(value || '').trim();
  return /^[A-Za-z0-9._:-]{1,80}$/.test(worker) ? worker : '';
}
function safeText(value, maxLength) {
  var text = String(value || '');
  text = text
    .replace(/(authorization|cookie|token|api[_-]?key|client[_-]?secret|password|passwd)\s*[:=]\s*[^\s,;]+/ig, '$1=[REDACTED]');
  return text.length > maxLength ? text.substring(0, maxLength) : text;
}
function safeUrl(value) {
  var url = String(value || '').trim();
  return /^https?:\/\//i.test(url) ? url.substring(0, 2000) : '';
}

var workerId = safeWorker(V8.Param.WorkerId);
if (!workerId) return { Code: 0, Msg: 'WorkerId 格式不合法。' };
var owner = String(user.Id) + ':' + workerId;
var taskId = String(V8.Param.TaskId || '').trim();
var fence = Number(V8.Param.FencingToken || 0);
if (!taskId || fence < 1) return { Code: 0, Msg: 'TaskId 和 FencingToken 不能为空。' };
var resultStatus = String(V8.Param.ResultStatus || '').trim();
if (['Succeeded', 'Failed', 'NeedsReview', 'BlockedQuality'].indexOf(resultStatus) < 0) {
  return { Code: 0, Msg: 'ResultStatus 只允许 Succeeded、Failed、NeedsReview 或 BlockedQuality。' };
}

var attemptKey = taskId + ':' + fence;
var replay = V8.FormEngine.GetFormData('mci_ai_publish_attempt', { _Where: [['AttemptKey', '=', attemptKey]] });
if (replay && replay.Code === 1 && replay.Data) {
  return { Code: 1, Data: { Replayed: true, TaskId: taskId, Status: replay.Data.Status, PublicUrl: replay.Data.PublicUrl || '' }, Msg: '该栅栏令牌的结果已记录。' };
}
var taskResult = V8.FormEngine.GetFormData('mci_ai_publish_task', { Id: taskId });
if (!taskResult || taskResult.Code !== 1 || !taskResult.Data) return { Code: 0, Msg: '发布任务不存在。' };
var task = taskResult.Data;
if (String(task.LeaseOwner || '') !== owner || Number(task.FencingToken || 0) !== fence || ['Claimed', 'Publishing'].indexOf(String(task.Status || '')) < 0) {
  return { Code: 0, Msg: '租约或栅栏令牌已失效，拒绝旧工作节点回写。' };
}

var submissionState = String(V8.Param.SubmissionState || 'Unknown');
if (['NotSubmitted', 'Submitted', 'Unknown'].indexOf(submissionState) < 0) submissionState = 'Unknown';
var retryable = resultStatus === 'Failed'
  && V8.Param.Retryable === true
  && submissionState === 'NotSubmitted'
  && Number(task.AttemptCount || 0) < Number(task.MaxAttempts || 3);
var taskStatus = retryable ? 'Retry' : resultStatus;
var now = System.DateTime.Now;
var nowText = now.ToString('yyyy-MM-dd HH:mm:ss');
var nextRetry = retryable ? now.AddMinutes(Math.min(60, Math.max(2, Number(task.AttemptCount || 1) * 5))).ToString('yyyy-MM-dd HH:mm:ss') : null;
var publicUrl = safeUrl(V8.Param.PublicUrl);
var remoteTaskId = safeText(V8.Param.RemoteTaskId, 500);
var errorCode = safeText(V8.Param.ErrorCode, 200);
var errorMessage = safeText(V8.Param.ErrorMessage, 4000);
var responseSummary = safeText(V8.Param.ResponseSummary, 4000);

var affected = V8.Db.FromSql(
  "UPDATE mci_ai_publish_task SET Status=@p0,NextRetryTime=@p1,LeaseOwner=NULL,LeaseUntil=NULL,RemoteTaskId=@p2,PublicUrl=@p3,LastError=@p4,CompletedTime=@p5,UpdateTime=@p6 " +
  "WHERE Id=@p7 AND LeaseOwner=@p8 AND FencingToken=@p9 AND Status IN ('Claimed','Publishing')"
)
  .AddInParameter('@p0', taskStatus)
  .AddInParameter('@p1', nextRetry)
  .AddInParameter('@p2', remoteTaskId)
  .AddInParameter('@p3', publicUrl)
  .AddInParameter('@p4', errorMessage)
  .AddInParameter('@p5', taskStatus === 'Retry' ? null : nowText)
  .AddInParameter('@p6', nowText)
  .AddInParameter('@p7', taskId)
  .AddInParameter('@p8', owner)
  .AddInParameter('@p9', fence)
  .ExecuteNonQuery();
if (Number(affected || 0) !== 1) {
  replay = V8.FormEngine.GetFormData('mci_ai_publish_attempt', { _Where: [['AttemptKey', '=', attemptKey]] });
  if (replay && replay.Code === 1 && replay.Data) return { Code: 1, Data: { Replayed: true, TaskId: taskId, Status: replay.Data.Status } };
  return { Code: 0, Msg: '结果回写竞争失败，任务可能已被其它节点处理。' };
}

var addAttempt = V8.FormEngine.AddFormData('mci_ai_publish_attempt', {
  AttemptKey: attemptKey,
  PublishTaskId: taskId,
  AttemptNo: Number(task.AttemptCount || 1),
  FencingToken: fence,
  Status: resultStatus,
  StartedTime: safeText(V8.Param.StartedTime, 25) || nowText,
  FinishedTime: nowText,
  RemoteTaskId: remoteTaskId,
  PublicUrl: publicUrl,
  ArtifactHash: safeText(V8.Param.ArtifactHash, 100),
  PublisherNode: workerId,
  ResponseSummary: responseSummary,
  ErrorCode: errorCode,
  ErrorMessage: errorMessage
});
if (!addAttempt || addAttempt.Code !== 1) return addAttempt || { Code: 0, Msg: '发布尝试记录写入失败。' };

var taskListResult = V8.FormEngine.GetTableData('mci_ai_publish_task', {
  _Where: [['ContentId', '=', task.ContentId]],
  _PageIndex: 1,
  _PageSize: 500
});
var taskList = taskListResult && taskListResult.Code === 1 ? (taskListResult.Data || []) : [];
var succeeded = 0;
var unresolved = 0;
var failed = 0;
var urls = [];
for (var i = 0; i < taskList.length; i++) {
  var row = taskList[i] || {};
  var rowStatus = row.Id === taskId ? taskStatus : String(row.Status || '');
  if (rowStatus === 'Succeeded') {
    succeeded++;
    var url = row.Id === taskId ? publicUrl : safeUrl(row.PublicUrl);
    if (url) urls.push({ Platform: row.Platform, AccountName: row.AccountName, Url: url });
  } else if (['Failed', 'BlockedQuality', 'NeedsReview'].indexOf(rowStatus) >= 0) {
    failed++;
  } else {
    unresolved++;
  }
}
var contentStatus = unresolved > 0 ? 'Publishing' : (succeeded > 0 ? (failed > 0 ? 'PartiallyPublished' : 'Published') : (failed > 0 ? 'NeedsReview' : 'Ready'));
V8.FormEngine.UptFormData('mci_ai_content_item', {
  Id: task.ContentId,
  Status: contentStatus,
  PublicUrlsJson: JSON.stringify(urls),
  PublishedTime: unresolved === 0 && succeeded > 0 ? nowText : null,
  LastError: contentStatus === 'NeedsReview' ? errorMessage : ''
});

return {
  Code: 1,
  Data: { Replayed: false, TaskId: taskId, AttemptKey: attemptKey, TaskStatus: taskStatus, ContentStatus: contentStatus, RetryAt: nextRetry, PublicUrl: publicUrl },
  Msg: retryable ? '确认请求尚未提交，已进入安全重试。' : (resultStatus === 'Succeeded' ? '发布结果和公开页面地址已记录。' : '发布结果已记录，未进行不安全的自动重试。')
};
