/*
 * V8 ApiEngine
 * ApiEngineKey: mci-ai-publish-claim
 * Version: v1.0.0
 * Function:
 * - 请补充该 V8 代码的完整功能说明。
 */

var user = V8.CurrentUser || {};
if (!user.Id) return { Code: 0, Msg: '未登录或访问密钥无效。' };

function safeWorker(value) {
  var worker = String(value || '').trim();
  return /^[A-Za-z0-9._:-]{1,80}$/.test(worker) ? worker : '';
}
function parseDate(value) {
  if (!value) return null;
  try { return System.DateTime.Parse(String(value)); } catch (e) { return null; }
}
function parseJson(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(String(value)); } catch (e) { return fallback; }
}

var workerId = safeWorker(V8.Param.WorkerId);
if (!workerId) return { Code: 0, Msg: 'WorkerId 只允许 1-80 位字母、数字、点、下划线、冒号或短横线。' };
var owner = String(user.Id) + ':' + workerId;
var leaseSeconds = Number(V8.Param.LeaseSeconds || 300);
if (leaseSeconds < 60) leaseSeconds = 60;
if (leaseSeconds > 900) leaseSeconds = 900;
var batchSize = Number(V8.Param.BatchSize || 5);
if (batchSize < 1) batchSize = 1;
if (batchSize > 20) batchSize = 20;
var now = System.DateTime.Now;
var nowText = now.ToString('yyyy-MM-dd HH:mm:ss');
var leaseUntil = now.AddSeconds(leaseSeconds).ToString('yyyy-MM-dd HH:mm:ss');

var candidatesResult = V8.FormEngine.GetTableData('mci_ai_publish_task', {
  _Where: [['Status', 'In', ['Pending', 'Retry']]],
  _OrderBy: 'CreateTime',
  _OrderByType: 'ASC',
  _PageIndex: 1,
  _PageSize: Math.min(100, batchSize * 5)
});
var candidates = candidatesResult && candidatesResult.Code === 1 ? (candidatesResult.Data || []) : [];
var claimed = [];
for (var i = 0; i < candidates.length && claimed.length < batchSize; i++) {
  var candidate = candidates[i] || {};
  var retryAt = parseDate(candidate.NextRetryTime);
  var activeLease = parseDate(candidate.LeaseUntil);
  if (retryAt && retryAt > now) continue;
  if (activeLease && activeLease > now) continue;
  var oldFence = Number(candidate.FencingToken || 0);
  var affected = V8.Db.FromSql(
    "UPDATE mci_ai_publish_task SET Status=@p0,LeaseOwner=@p1,LeaseUntil=@p2,FencingToken=COALESCE(FencingToken,0)+1,AttemptCount=COALESCE(AttemptCount,0)+1,UpdateTime=@p3 " +
    "WHERE Id=@p4 AND Status IN ('Pending','Retry') AND COALESCE(FencingToken,0)=@p5 AND (LeaseUntil IS NULL OR LeaseUntil='' OR LeaseUntil<@p6)"
  )
    .AddInParameter('@p0', 'Claimed')
    .AddInParameter('@p1', owner)
    .AddInParameter('@p2', leaseUntil)
    .AddInParameter('@p3', nowText)
    .AddInParameter('@p4', candidate.Id)
    .AddInParameter('@p5', oldFence)
    .AddInParameter('@p6', nowText)
    .ExecuteNonQuery();
  if (Number(affected || 0) !== 1) continue;

  var taskResult = V8.FormEngine.GetFormData('mci_ai_publish_task', { Id: candidate.Id });
  if (!taskResult || taskResult.Code !== 1 || !taskResult.Data) continue;
  var task = taskResult.Data;
  var contentResult = V8.FormEngine.GetFormData('mci_ai_content_item', { Id: task.ContentId });
  var assetResult = V8.FormEngine.GetTableData('mci_ai_content_asset', {
    _Where: [['ContentId', '=', task.ContentId], ['Status', '=', 'Approved']],
    _OrderBy: 'SequenceNo',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 100
  });
  claimed.push({
    TaskId: task.Id,
    FencingToken: Number(task.FencingToken || oldFence + 1),
    LeaseUntil: task.LeaseUntil,
    Platform: task.Platform,
    AccountId: task.AccountId,
    AccountName: task.AccountName,
    ContentMode: task.ContentMode,
    AttemptNo: Number(task.AttemptCount || 1),
    Payload: parseJson(task.PayloadJson, {}),
    Content: contentResult && contentResult.Code === 1 ? contentResult.Data : null,
    Assets: assetResult && assetResult.Code === 1 ? (assetResult.Data || []) : []
  });
}
return { Code: 1, Data: { WorkerId: workerId, LeaseSeconds: leaseSeconds, Tasks: claimed }, Msg: claimed.length ? '已安全认领 ' + claimed.length + ' 个发布任务。' : '当前没有可认领的发布任务。' };
