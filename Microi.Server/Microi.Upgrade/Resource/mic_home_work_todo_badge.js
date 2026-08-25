/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：mic_home_work_todo_badge
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: mic_home_work_todo_badge
 * Version: v1.0.4
 * Function:
 * - 按真实“我的工作”口径返回五类统计；新后端通过租户级版本门主动失效并使用 30 秒用户缓存，旧后端保持 3 秒缓存，优先调用并行统计原子能力。
 */

var userId = V8.CurrentUser && V8.CurrentUser.Id;
if (!userId) return { Code: 0, Msg: '未获取到当前用户。' };

// 新后端在任何工作流写操作成功后更新 Version。把版本嵌入用户 Key，可用一次
// O(1) Redis SET 失效所有未知用户缓存，避免扫描 Key。旧节点没有版本门时仍只缓存 3 秒。
var workflowVersionKey = 'Microi:' + V8.OsClient + ':WorkflowStats:Version';
var workflowVersion = String(V8.Cache.Get(workflowVersionKey) || '').trim();
var workflowCacheTtlSeconds = workflowVersion ? 30 : 3;
var workflowCacheKey = 'Microi:' + V8.OsClient + ':WorkflowStats:'
  + (workflowVersion || 'legacy') + ':' + String(userId);
var workflowCached = V8.Cache.Get(workflowCacheKey);
if (workflowCached) {
  try {
    var workflowCachedResult = JSON.parse(String(workflowCached));
    if (workflowCachedResult && Number(workflowCachedResult.Code) === 1) return workflowCachedResult;
  } catch (ignoreCache) {}
}
try {
  var nativeStatsResult = V8.Method.GetCurrentUserWorkflowStats();
  if (nativeStatsResult && Number(nativeStatsResult.Code) === 1) {
    var nativeResponse = { Code: 1, Data: nativeStatsResult.Data, Msg: nativeStatsResult.Msg || '' };
    V8.Cache.Set(workflowCacheKey, JSON.stringify(nativeResponse), workflowCacheTtlSeconds);
    return nativeResponse;
  }
} catch (ignoreLegacyBackend) {}

var countRows = function (tableName, where) {
  var result = V8.FormEngine.GetTableDataCount(tableName, { _Where: where });
  if (result.Code !== 1) return result;
  return { Code: 1, DataCount: result.DataCount || 0 };
};

var todoResult = countRows('WF_Work', [['ReceiverId', '=', userId], ['WorkState', '=', 'Todo']]);
if (todoResult.Code !== 1) return todoResult;
var senderResult = countRows('WF_Flow', [['SenderId', '=', userId]]);
if (senderResult.Code !== 1) return senderResult;
var doneResult = countRows('WF_Flow', [['HandlerUsers', 'Like', userId]]);
if (doneResult.Code !== 1) return doneResult;
var connectResult = countRows('WF_Flow', [['NotHandlerUsers', 'Like', userId]]);
if (connectResult.Code !== 1) return connectResult;

var copyUnread = 0;
var pageIndex = 1;
var pageSize = 500;
while (true) {
  var copyResult = V8.FormEngine.GetTableData('WF_Flow', {
    _Where: [['CopyUsers', 'Like', userId]],
    _SelectFields: ['Id', 'CopyUsers'],
    _PageIndex: pageIndex,
    _PageSize: pageSize
  });
  if (copyResult.Code !== 1) return copyResult;
  var rows = copyResult.Data || [];
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    var copyUsers = [];
    try { copyUsers = JSON.parse(String(rows[rowIndex].CopyUsers || '[]')); } catch (error) { copyUsers = []; }
    for (var userIndex = 0; userIndex < copyUsers.length; userIndex++) {
      var item = copyUsers[userIndex] || {};
      var isTargetUser = String(item.Id || '').toLowerCase() === String(userId).toLowerCase();
      var readFlag = item.IsRead;
      var isExplicitUnread = readFlag === false || readFlag === 0 || String(readFlag).toLowerCase() === 'false';
      if (isTargetUser && isExplicitUnread) { copyUnread++; break; }
    }
  }
  var total = copyResult.DataCount || rows.length;
  if (rows.length < pageSize || pageIndex * pageSize >= total) break;
  pageIndex++;
}

var todo = todoResult.DataCount;
var workflowResponse = {
  Code: 1,
  Data: {
    Value: todo + copyUnread,
    Todo: todo,
    Sender: senderResult.DataCount,
    Done: doneResult.DataCount,
    Copy: copyUnread,
    Connect: connectResult.DataCount,
    Buttons: {
      mic_home_work_tab_todo: todo,
      mic_home_work_tab_sender: senderResult.DataCount,
      mic_home_work_tab_done: doneResult.DataCount,
      mic_home_work_tab_copy: copyUnread,
      mic_home_work_tab_connect: connectResult.DataCount
    }
  }
};
V8.Cache.Set(workflowCacheKey, JSON.stringify(workflowResponse), workflowCacheTtlSeconds);
return workflowResponse;
