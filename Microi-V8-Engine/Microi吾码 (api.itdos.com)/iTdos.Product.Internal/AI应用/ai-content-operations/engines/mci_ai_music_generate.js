/*
 * V8 ApiEngine
 * ApiEngineKey: mci-ai-music-generate
 * Version: v1.0.0
 * Function:
 * - 管理员按资产幂等生成 MiniMax 纯音乐；优先调用服务端 V8.AI 安全原子能力，旧后端仅以当前租户 mic_ai 配置作兼容调用，绝不返回或落库供应商密钥。
 */

function isAdmin() {
  var user = V8.CurrentUser || {};
  return !!user.Id && (String(user.Account || '').toLowerCase() === 'admin' || Number(user.Level || 0) >= 9999);
}
var isWorker = String(V8.Param.JobName || '') === 'MciAiMusicWorker';
if (!isWorker && !isAdmin()) return { Code: 0, Msg: '权限不足：只有管理员可以提交 MiniMax 音乐任务。' };

function safeError(value) {
  var text = String(value || 'MiniMax 音乐生成失败。')
    .replace(/(authorization|cookie|token|api[_-]?key|secret|password|passwd)\s*[:=]\s*[^\s,;]+/ig, '$1=[REDACTED]');
  return text.length > 1000 ? text.substring(0, 1000) : text;
}
function parseJson(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '')); } catch (e) { return null; }
}
function normalizeUrl(value) {
  var text = String(value || '').trim();
  if (!/^https:\/\//i.test(text)) return '';
  return text.length > 2000 ? '' : text;
}
function hexToBase64(value) {
  var hex = String(value || '').trim();
  if (hex.length < 8 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return '';
  return System.Convert.ToBase64String(System.Convert.FromHexString(hex));
}
function publicHdfsUrl(path) {
  var value = String(path || '').trim().replace(/^\/+/, '');
  return value ? 'https://static.itdos.com/' + value : '';
}

var assetId = String(V8.Param.AssetId || '').trim();
var requestId = String(V8.Param.RequestId || '').trim();
var prompt = String(V8.Param.Prompt || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
var model = String(V8.Param.Model || 'music-3.0').trim().toLowerCase();
if (isWorker) {
  var candidatesResult = V8.FormEngine.GetTableData('mci_ai_content_asset', {
    _Where: [['AssetType', '=', 'AudioMusic'], ['AND', 'Status', '=', 'Draft']],
    _OrderBy: 'CreateTime',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 1
  });
  var candidates = candidatesResult && candidatesResult.Code === 1 ? (candidatesResult.Data || []) : [];
  if (!candidates.length) return { Code: 1, Data: { Skipped: true, Reason: 'NoDraftAudioMusic' }, Msg: '当前没有待生成的 MiniMax 音乐资产。' };
  assetId = String(candidates[0].Id || '');
  requestId = 'mci-music:' + String(candidates[0].AssetKey || candidates[0].Id || '');
  prompt = String(candidates[0].Prompt || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  model = String(candidates[0].Model || 'music-2.6').trim().toLowerCase();
}
if (!assetId) return { Code: 0, Msg: 'AssetId 不能为空。请先创建 AudioMusic 资产。' };
if (!/^[A-Za-z0-9._:-]{8,160}$/.test(requestId)) return { Code: 0, Msg: 'RequestId 只允许 8-160 位字母、数字、点、下划线、冒号或短横线。' };
if (!prompt || prompt.length > 2000) return { Code: 0, Msg: '纯音乐 Prompt 长度必须为 1-2000 个字符。' };
if (['music-3.0', 'music-2.6'].indexOf(model) < 0) return { Code: 0, Msg: '音乐模型只允许 music-3.0 或 music-2.6。' };
var assetResult = V8.FormEngine.GetFormData('mci_ai_content_asset', { Id: assetId });
if (!assetResult || assetResult.Code !== 1 || !assetResult.Data) return { Code: 0, Msg: '音乐资产不存在。' };
var asset = assetResult.Data;
if (String(asset.AssetType || '') !== 'AudioMusic') return { Code: 0, Msg: '只有 AudioMusic 类型资产可以生成音乐。' };
if (!isWorker) {
  return { Code: 1, Data: { AssetId: asset.Id, Status: String(asset.Status || 'Draft'), RequestId: requestId }, Msg: 'MiniMax 音乐资产已进入持久队列；由 MciAiMusicWorker 认领，禁止立即重复提交。' };
}
var existingUrl = normalizeUrl(asset.FileUrl);
if (existingUrl && ['ReviewRequired', 'Approved'].indexOf(String(asset.Status || '')) >= 0) {
  return { Code: 1, Data: { AssetId: asset.Id, FileUrl: existingUrl, Model: asset.Model, Replayed: true }, Msg: '该音乐资产已有生成结果，未重复消耗额度。' };
}

var fingerprint = V8.EncryptHelper.Sha256Hex(model + '|' + prompt + '|' + asset.Id);
var affected = V8.Db.FromSql(
  "UPDATE mci_ai_content_asset SET Status=@p0,Model=@p1,Prompt=@p2,ArtifactHash=@p3,UpdateTime=@p4 " +
  "WHERE Id=@p5 AND AssetType='AudioMusic' AND Status IN ('Draft','Failed')"
)
  .AddInParameter('@p0', 'Generating')
  .AddInParameter('@p1', model)
  .AddInParameter('@p2', prompt)
  .AddInParameter('@p3', fingerprint)
  .AddInParameter('@p4', DateNow('yyyy-MM-dd HH:mm:ss'))
  .AddInParameter('@p5', asset.Id)
  .ExecuteNonQuery();
if (Number(affected || 0) !== 1) {
  assetResult = V8.FormEngine.GetFormData('mci_ai_content_asset', { Id: asset.Id });
  asset = assetResult && assetResult.Code === 1 ? assetResult.Data : null;
  return { Code: 2, Data: { AssetId: assetId, Status: asset && asset.Status || 'Unknown' }, Msg: '该音乐资产正在生成或已被处理，未重复调用 MiniMax。' };
}

var generated;
try {
  if (isAdmin() && V8.AI && typeof V8.AI.GenerateMiniMaxMusic === 'function') {
    generated = await V8.AI.GenerateMiniMaxMusic({
      RequestId: requestId,
      Prompt: prompt,
      Model: model,
      IsInstrumental: true,
      SampleRate: 44100,
      Bitrate: 256000,
      Format: 'mp3'
    });
  } else {
    // 兼容尚未部署 GenerateMiniMaxMusic 原子能力的旧后端。仅平台管理员可运行，
    // Key 只存在当前服务端调用栈中，不写入业务表、缓存、日志或返回值。
    var aiResult = V8.FormEngine.GetFormData('mic_ai', {
      _Where: [['IsEnable', '=', 1], ['AND', 'Endpoint', 'Like', 'api.minimaxi.com']],
      _SelectFields: ['Id', 'Endpoint', 'ApiKey', 'Name', 'IsEnable']
    });
    var ai = aiResult && aiResult.Code === 1 ? aiResult.Data : null;
    var endpoint = String(ai && ai.Endpoint || '').trim().replace(/\/$/, '');
    var apiKey = String(ai && ai.ApiKey || '').trim();
    if (!/^https:\/\/api\.minimaxi\.com\/v1$/i.test(endpoint) || !apiKey) {
      throw new Error('当前租户没有启用 MiniMax 官方音乐 API 配置。');
    }
    var requestPayload = {
      model: model,
      prompt: prompt,
      is_instrumental: true,
      output_format: 'url',
      audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' }
    };
    var upstream = V8.Http.Post({
      Url: endpoint + '/music_generation',
      PostParamString: JSON.stringify(requestPayload),
      ParamType: 'json',
      Timeout: 600,
      Headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' }
    });
    var response = parseJson(upstream);
    var statusCode = Number(response && response.base_resp && response.base_resp.status_code || 0);
    if (!response || statusCode !== 0) {
      throw new Error(String(response && response.base_resp && response.base_resp.status_msg || 'MiniMax 音乐接口返回失败。'));
    }
    var audioValue = String(response.data && response.data.audio || '').trim();
    var fileUrl = normalizeUrl(audioValue);
    var storage = fileUrl ? 'MiniMaxTemporaryUrl' : '';
    if (!fileUrl && audioValue) {
      var fileBase64 = hexToBase64(audioValue);
      if (!fileBase64) throw new Error('MiniMax 返回的音乐不是有效十六进制 MP3。');
      var signature = audioValue.substring(0, 6).toLowerCase();
      if (signature !== '494433' && audioValue.substring(0, 2).toLowerCase() !== 'ff') throw new Error('MiniMax 返回的音乐缺少 MP3 文件签名。');
      var files = {};
      files['minimax-music-' + fingerprint.substring(0, 12) + '.mp3'] = fileBase64;
      var uploaded = V8.Method.Upload({
        OsClient: V8.OsClient,
        Path: '/ai-content/music/2026-08-13',
        Limit: false,
        Preview: false,
        FilesByteBase64: files
      });
      if (!uploaded || uploaded.Code !== 1 || !uploaded.Data) throw new Error((uploaded && uploaded.Msg) || 'MiniMax 音乐写入 HDFS 失败。');
      fileUrl = publicHdfsUrl(uploaded.Data.Path);
      if (!fileUrl) throw new Error('MiniMax 音乐已上传，但 HDFS 没有返回文件路径。');
      storage = 'Microi.HDFS';
    }
    generated = {
      Code: 1,
      Data: {
        FileUrl: fileUrl,
        Model: model,
        DurationMilliseconds: Number(response.extra_info && response.extra_info.music_duration || 0),
        SampleRate: Number(response.extra_info && response.extra_info.music_sample_rate || 44100),
        Channels: Number(response.extra_info && response.extra_info.music_channel || 2),
        Bitrate: Number(response.extra_info && response.extra_info.bitrate || 256000),
        Storage: storage
      }
    };
  }
} catch (error) {
  var errorText = safeError(error && (error.Message || error.message) || error);
  V8.FormEngine.UptFormData('mci_ai_content_asset', { Id: asset.Id, Status: 'Failed', ReviewStatus: 'Pending', QualityReview: errorText });
  return { Code: 0, Msg: errorText };
}

if (!generated || generated.Code !== 1 || !generated.Data) {
  var failedText = safeError(generated && generated.Msg || 'MiniMax 音乐生成失败。');
  V8.FormEngine.UptFormData('mci_ai_content_asset', { Id: asset.Id, Status: 'Failed', ReviewStatus: 'Pending', QualityReview: failedText });
  return generated || { Code: 0, Msg: failedText };
}
var fileUrl = normalizeUrl(generated.Data.FileUrl || generated.Data.DownloadUrl);
if (!fileUrl) {
  V8.FormEngine.UptFormData('mci_ai_content_asset', { Id: asset.Id, Status: 'Failed', ReviewStatus: 'Pending', QualityReview: 'MiniMax 已响应，但没有返回安全的 HTTPS 音乐地址。' });
  return { Code: 0, Msg: 'MiniMax 已响应，但没有返回安全的 HTTPS 音乐地址；不会用同一资产自动重试。' };
}
var durationMs = Number(generated.Data.DurationMilliseconds || 0);
var mediaInfo = {
  Provider: 'MiniMax',
  Model: String(generated.Data.Model || model),
  IsInstrumental: true,
  SampleRate: Number(generated.Data.SampleRate || 44100),
  Channels: Number(generated.Data.Channels || 2),
  Bitrate: Number(generated.Data.Bitrate || 256000),
  Format: 'mp3',
  Storage: String(generated.Data.Storage || 'TemporaryUrl'),
  RequiresHdfsPersist: String(generated.Data.Storage || '').toLowerCase().indexOf('hdfs') < 0
};
V8.FormEngine.UptFormData('mci_ai_content_asset', {
  Id: asset.Id,
  FileUrl: fileUrl,
  Model: String(generated.Data.Model || model),
  Duration: durationMs > 0 ? Math.ceil(durationMs / 1000) : Number(generated.Data.Duration || 0),
  Resolution: mediaInfo.SampleRate + 'Hz/' + Math.round(mediaInfo.Bitrate / 1000) + 'kbps/' + mediaInfo.Channels + 'ch',
  Status: 'ReviewRequired',
  ReviewStatus: 'Pending',
  QualityScore: 0,
  MediaInfoJson: JSON.stringify(mediaInfo),
  QualityReview: mediaInfo.RequiresHdfsPersist ? 'MiniMax 纯音乐已生成；临时地址必须先转存当前租户 HDFS，再进行试听、响度和版权用途复核。' : 'MiniMax 纯音乐已写入当前租户 HDFS，等待试听和响度复核。'
});
return {
  Code: 1,
  Data: { AssetId: asset.Id, FileUrl: fileUrl, Model: mediaInfo.Model, Duration: durationMs > 0 ? durationMs / 1000 : 0, Replayed: false, RequiresHdfsPersist: mediaInfo.RequiresHdfsPersist },
  Msg: 'MiniMax 纯音乐已生成；完成 HDFS 转存与试听前不得进入成片。'
};
