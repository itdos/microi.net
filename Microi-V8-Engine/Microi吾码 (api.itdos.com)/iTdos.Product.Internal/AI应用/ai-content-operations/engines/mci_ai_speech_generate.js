/*
 * V8 ApiEngine
 * ApiEngineKey: mci-ai-speech-generate
 * Version: v1.0.0
 * Function:
 * - 管理员按对白资产稳定幂等生成 MiniMax 男女短对白；只调用服务端 V8.AI 安全原子能力，生成文件直接转存当前租户 HDFS。
 */

function isAdmin() {
  var user = V8.CurrentUser || {};
  return !!user.Id && (String(user.Account || '').toLowerCase() === 'admin' || Number(user.Level || 0) >= 9999);
}
if (!isAdmin()) return { Code: 0, Msg: '权限不足：只有管理员可以生成 MiniMax 对白。' };
if (!V8.AI || typeof V8.AI.GenerateMiniMaxSpeech !== 'function') {
  return { Code: 0, Msg: '当前吾码后端尚未部署受保护的 MiniMax Speech/TTS 能力；为避免浏览器或 V8 暴露 Key，已失败关闭。' };
}

var assetId = String(V8.Param.AssetId || '').trim();
if (!assetId) return { Code: 0, Msg: 'AssetId 不能为空。请先创建 AudioDialogue 资产。' };
var assetResult = V8.FormEngine.GetFormData('mci_ai_content_asset', { Id: assetId });
if (!assetResult || assetResult.Code !== 1 || !assetResult.Data) return { Code: 0, Msg: '对白资产不存在。' };
var asset = assetResult.Data;
if (String(asset.AssetType || '') !== 'AudioDialogue') return { Code: 0, Msg: '只有 AudioDialogue 类型资产可以生成对白。' };
var text = String(asset.Prompt || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
if (!text) return { Code: 0, Msg: '对白文本不能为空。' };
var speaker = String(asset.Speaker || '').trim().toLowerCase();
if (speaker !== 'female' && speaker !== 'male') return { Code: 0, Msg: '对白角色必须选择 female 或 male。' };
if (['Approved', 'ReviewRequired'].indexOf(String(asset.Status || '')) >= 0 && String(asset.FileUrl || '')) {
  return { Code: 1, Data: { AssetId: asset.Id, Status: asset.Status, Replayed: true }, Msg: '该对白资产已有 HDFS 文件，未重复调用 MiniMax。' };
}

var contentResult = V8.FormEngine.GetFormData('mci_ai_content_item', { Id: asset.ContentId });
if (!contentResult || contentResult.Code !== 1 || !contentResult.Data) return { Code: 0, Msg: '关联内容稿件不存在。' };
var content = contentResult.Data;
var requestId = 'mci-speech:' + String(content.SlotKey || content.Id) + ':' + String(asset.AssetKey || asset.Id);
V8.FormEngine.UptFormData('mci_ai_content_asset', {
  Id: asset.Id,
  Status: 'Generating',
  ReviewStatus: 'Pending',
  QualityReview: ''
});
var result = await V8.AI.GenerateMiniMaxSpeech({
  RequestId: requestId,
  Text: text,
  Speaker: speaker,
  Model: 'speech-2.8-hd',
  Speed: 1,
  Volume: 1,
  Pitch: 0,
  Emotion: 'calm',
  SampleRate: 32000,
  Bitrate: 128000,
  Channel: 1,
  Format: 'mp3'
});
if (!result || result.Code !== 1 || !result.Data || !/^https:\/\//i.test(String(result.Data.FileUrl || ''))) {
  var failure = String(result && result.Msg || 'MiniMax 对白生成失败。').substring(0, 1000);
  V8.FormEngine.UptFormData('mci_ai_content_asset', {
    Id: asset.Id,
    Status: result && result.Code === 2 ? 'ReviewRequired' : 'Failed',
    ReviewStatus: 'Pending',
    QualityReview: failure
  });
  return result || { Code: 0, Msg: failure };
}
var durationMs = Number(result.Data.DurationMilliseconds || 0);
var mediaInfo = {
  Provider: 'MiniMax',
  AssetType: 'AudioDialogue',
  Speaker: String(result.Data.Speaker || speaker),
  VoiceId: String(result.Data.VoiceId || ''),
  Model: String(result.Data.Model || 'speech-2.8-hd'),
  DurationMilliseconds: durationMs,
  SampleRate: Number(result.Data.SampleRate || 32000),
  Channels: Number(result.Data.Channels || 1),
  Bitrate: Number(result.Data.Bitrate || 128000),
  Format: String(result.Data.Format || 'mp3'),
  TextSha256: String(result.Data.TextSha256 || ''),
  SubtitleRequested: result.Data.SubtitleRequested === true,
  Storage: String(result.Data.Storage || 'Microi.HDFS'),
  Permanent: result.Data.Permanent === true
};
var update = V8.FormEngine.UptFormData('mci_ai_content_asset', {
  Id: asset.Id,
  FileUrl: String(result.Data.FileUrl || ''),
  Model: mediaInfo.Model,
  Duration: durationMs > 0 ? Math.ceil(durationMs / 1000) : 0,
  Status: 'ReviewRequired',
  ReviewStatus: 'Pending',
  QualityScore: 0,
  MediaInfoJson: JSON.stringify(mediaInfo),
  QualityReview: 'MiniMax 对白已写入当前租户 HDFS；必须试听、按准确台词制作字幕并与配乐完成混音后才能进入 VideoMaster。'
});
if (!update || update.Code !== 1) return update || { Code: 0, Msg: '对白已生成，但资产记录更新失败。' };
return {
  Code: 1,
  Data: { AssetId: asset.Id, FileUrl: result.Data.FileUrl, Speaker: speaker, DurationMilliseconds: durationMs, Replayed: result.Data.Replayed === true },
  Msg: 'MiniMax 对白已生成并写入 HDFS，等待试听与母版混音。'
};
