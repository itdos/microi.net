function isAdmin() {
  var user = V8.CurrentUser || {};
  return !!user.Id && (String(user.Account || '').toLowerCase() === 'admin' || Number(user.Level || 0) >= 9999);
}
if (!isAdmin()) return { Code: 0, Msg: '权限不足：只有管理员可以创建 MiniMax 视频任务。' };
var assetId = String(V8.Param.AssetId || '');
if (!assetId) return { Code: 0, Msg: 'AssetId 不能为空。请先在“AI内容素材”新增 Video 资产。' };
var assetResult = V8.FormEngine.GetFormData('mci_ai_content_asset', { Id: assetId });
if (!assetResult || assetResult.Code !== 1 || !assetResult.Data) return { Code: 0, Msg: '视频资产不存在。' };
var asset = assetResult.Data;
if (String(asset.AssetType || '') !== 'Video') return { Code: 0, Msg: '只有 Video 类型资产可以提交视频生成。' };
var contentResult = V8.FormEngine.GetFormData('mci_ai_content_item', { Id: asset.ContentId });
if (!contentResult || contentResult.Code !== 1 || !contentResult.Data) return { Code: 0, Msg: '关联内容稿件不存在。' };
var content = contentResult.Data;
var requestId = 'mci-content:' + String(content.SlotKey || content.Id) + ':video:' + String(asset.AssetKey || asset.Id);
var result = await V8.AI.CreateMiniMaxVideo({
  RequestId: requestId,
  Prompt: String(asset.Prompt || ''),
  Model: String(asset.Model || 'MiniMax-Hailuo-2.3'),
  Duration: Number(asset.Duration || 6),
  Resolution: String(asset.Resolution || '768P'),
  FirstFrameImage: String(asset.FirstFrameUrl || '')
});
if (!result || result.Code !== 1 || !result.Data) {
  V8.FormEngine.UptFormData('mci_ai_content_asset', { Id: asset.Id, Status: 'Failed', QualityReview: (result && result.Msg) || 'MiniMax 创建任务失败。' });
  return result || { Code: 0, Msg: 'MiniMax 创建任务失败。' };
}
V8.FormEngine.UptFormData('mci_ai_content_asset', {
  Id: asset.Id,
  MiniMaxTaskHandle: String(result.Data.TaskHandle || ''),
  Model: String(result.Data.Model || asset.Model || ''),
  Duration: Number(result.Data.Duration || asset.Duration || 6),
  Resolution: String(result.Data.Resolution || asset.Resolution || '768P'),
  Status: String(result.Data.Status || 'Queueing'),
  ReviewStatus: 'Pending',
  QualityScore: 0,
  QualityReview: ''
});
return { Code: 1, Data: { AssetId: asset.Id, Status: result.Data.Status || 'Queueing', Replayed: result.Data.Replayed === true }, Msg: 'MiniMax 视频任务已创建；生成成功后仍必须验片。' };
