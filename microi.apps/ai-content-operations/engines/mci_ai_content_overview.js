function isAdmin() {
  var user = V8.CurrentUser || {};
  return !!user.Id && (String(user.Account || '').toLowerCase() === 'admin' || Number(user.Level || 0) >= 9999);
}
if (!isAdmin()) return { Code: 0, Msg: '权限不足：只有管理员可以查看 AI 内容运营总览。' };

function count(tableName, where) {
  var result = V8.FormEngine.GetTableDataCount(tableName, { _Where: where || [] });
  if (!result || result.Code !== 1) return 0;
  if (typeof result.Data === 'number') return result.Data;
  if (result.Data && result.Data.Count !== undefined) return Number(result.Data.Count || 0);
  return Number(result.DataCount || 0);
}

return {
  Code: 1,
  Data: {
    QueuedContent: count('mci_ai_content_item', [['Status', 'In', ['Queued', 'Researching', 'Drafting']]]),
    QualityReview: count('mci_ai_content_item', [['Status', 'In', ['QualityReview', 'BlockedQuality', 'NeedsReview']]]),
    PublishPending: count('mci_ai_publish_task', [['Status', 'In', ['Pending', 'Retry', 'Claimed', 'Publishing']]]),
    PublishNeedsReview: count('mci_ai_publish_task', [['Status', '=', 'NeedsReview']]),
    Published: count('mci_ai_publish_task', [['Status', '=', 'Succeeded']]),
    GeneratedAt: DateNow('yyyy-MM-dd HH:mm:ss')
  }
};
