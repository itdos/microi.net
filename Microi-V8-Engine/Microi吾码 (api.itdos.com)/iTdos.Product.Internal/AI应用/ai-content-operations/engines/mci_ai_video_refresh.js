/*
 * V8 ApiEngine
 * ApiEngineKey: mci-ai-video-refresh
 * Version: v1.0.0
 * Function:
 * - 请补充该 V8 代码的完整功能说明。
 */

function isAdmin() {
  var user = V8.CurrentUser || {};
  return !!user.Id && (String(user.Account || '').toLowerCase() === 'admin' || Number(user.Level || 0) >= 9999);
}
if (!isAdmin()) return { Code: 0, Msg: '权限不足：只有管理员可以回读 MiniMax 视频任务。' };
var assetId = String(V8.Param.AssetId || '');
if (!assetId) return { Code: 0, Msg: 'AssetId 不能为空。' };
var assetResult = V8.FormEngine.GetFormData('mci_ai_content_asset', { Id: assetId });
if (!assetResult || assetResult.Code !== 1 || !assetResult.Data) return { Code: 0, Msg: '视频资产不存在。' };
var asset = assetResult.Data;
if (!asset.MiniMaxTaskHandle) return { Code: 0, Msg: '视频资产尚无 MiniMax 任务句柄。' };
var task = await V8.AI.GetMiniMaxVideoTask({ TaskHandle: String(asset.MiniMaxTaskHandle) });
if (!task || task.Code !== 1 || !task.Data) return task || { Code: 0, Msg: 'MiniMax 任务查询失败。' };
var status = String(task.Data.Status || 'Unknown');
if (status !== 'Success') {
  V8.FormEngine.UptFormData('mci_ai_content_asset', {
    Id: asset.Id,
    Status: status === 'Fail' ? 'Failed' : status,
    QualityReview: status === 'Fail' ? String(task.Data.FailureReason || 'MiniMax 视频生成失败。') : String(asset.QualityReview || '')
  });
  return { Code: 1, Data: { AssetId: asset.Id, Status: status }, Msg: status === 'Fail' ? '视频生成失败。' : '视频仍在生成中。' };
}
if (!task.Data.FileHandle) return { Code: 0, Msg: 'MiniMax 已成功但未返回文件句柄，禁止伪造完成状态。' };
var file = null;
if (V8.AI && typeof V8.AI.PersistMiniMaxVideoFile === 'function') {
  file = await V8.AI.PersistMiniMaxVideoFile({ FileHandle: String(task.Data.FileHandle) });
}
var fileUrl = file && file.Code === 1 && file.Data ? String(file.Data.FileUrl || '') : '';
var permanent = !!(file && file.Code === 1 && file.Data && file.Data.Permanent === true && fileUrl);
if (!fileUrl) {
  file = await V8.AI.GetMiniMaxVideoFile({ FileHandle: String(task.Data.FileHandle) });
  fileUrl = file && file.Code === 1 && file.Data ? String(file.Data.DownloadUrl || '') : '';
}
if (!fileUrl) return file || { Code: 0, Msg: '视频文件地址读取失败。' };
V8.FormEngine.UptFormData('mci_ai_content_asset', {
  Id: asset.Id,
  MiniMaxFileHandle: String(task.Data.FileHandle),
  FileUrl: fileUrl,
  Status: 'ReviewRequired',
  ReviewStatus: 'Pending',
  QualityScore: 0,
  QualityReview: (permanent ? '视频已转存当前租户 HDFS。' : '当前仅保存 MiniMax 临时地址，需尽快转存 HDFS。')
    + '必须检查办公室叙事、字幕/声音、墙面文字、人脸、手部、广告感和实际信息价值；未验片不得发布。'
});
return { Code: 1, Data: { AssetId: asset.Id, Status: 'ReviewRequired', FileUrl: fileUrl, Permanent: permanent }, Msg: permanent ? '视频已生成并转存当前租户 HDFS，等待验片。' : '视频已生成，等待验片；临时地址应尽快转存到本租户文件服务。' };
