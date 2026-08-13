/*
 * V8 ApiEngine
 * ApiEngineKey: mci-ai-publish-prepare
 * Version: v1.1.0
 * Function:
 * - 按实时帐号准备非敏感发布队列；标题强制纯文本，视频每账号只绑定一个带音轨的 VideoMaster，并把成片哈希加入幂等键，禁止按分镜重复建任务。
 */

function isAdmin() {
  var user = V8.CurrentUser || {};
  return !!user.Id && (String(user.Account || '').toLowerCase() === 'admin' || Number(user.Level || 0) >= 9999);
}
if (!isAdmin()) return { Code: 0, Msg: '权限不足：只有管理员可以准备发布队列。' };

function parseJson(value, fallback) {
  if (value === null || typeof value === 'undefined' || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (e) { return fallback; }
}
function normalizePlatform(value) {
  var text = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  if (text.indexOf('抖音') >= 0 || text.indexOf('douyin') >= 0) return 'douyin';
  if (text.indexOf('快手') >= 0 || text.indexOf('kuaishou') >= 0) return 'kuaishou';
  if (text.indexOf('新浪微博') >= 0 || text === '微博' || text.indexOf('weibo') >= 0 || text.indexOf('xinlang') >= 0) return 'weibo';
  if (text.indexOf('小红书') >= 0 || text.indexOf('xiaohongshu') >= 0) return 'xiaohongshu';
  if (text.indexOf('哔哩') >= 0 || text.indexOf('bilibili') >= 0) return 'bilibili';
  if (text.indexOf('视频号') >= 0 || text.indexOf('shipinhao') >= 0) return 'shipinhao';
  return text;
}
function isShortVideoPlatform(value) {
  var platform = normalizePlatform(value);
  return platform === 'douyin' || platform === 'kuaishou';
}
function approved(asset) {
  return String(asset.ReviewStatus || '') === 'Approved'
    && String(asset.Status || '') === 'Approved'
    && Number(asset.QualityScore || 0) >= 80
    && String(asset.QualityReview || '').trim().length >= 20;
}
function assetMatches(asset, platform) {
  var target = normalizePlatform(asset && asset.Platform);
  if (!target || target === 'all' || target === 'allplatforms' || target === 'allvideoplatforms' || target === '全部视频平台') return true;
  return target === normalizePlatform(platform);
}
function plainText(value, maxLength) {
  var text = String(value || '')
    .replace(/<topic\b[^>]*>([\s\S]*?)<\/topic>/ig, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/ig, ' ')
    .replace(/&amp;/ig, '&')
    .replace(/&lt;/ig, '<')
    .replace(/&gt;/ig, '>')
    .replace(/&quot;/ig, '"')
    .replace(/&#39;|&apos;/ig, "'")
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? text.substring(0, maxLength).trim() : text;
}
function containsMarkup(value) {
  return /<\/?(?:p|div|span|br|topic|a|strong|em)\b|<[^>]+>|&(?:lt|gt|nbsp);/i.test(String(value || ''));
}
function containsSecretKey(value) {
  if (!value || typeof value !== 'object') return false;
  for (var key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    var normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (/token|cookie|apikey|secret|password|passwd|clientsecret|authorization/.test(normalized)) return true;
    if (value[key] && typeof value[key] === 'object' && containsSecretKey(value[key])) return true;
  }
  return false;
}
function isValidMaster(asset) {
  if (!asset || String(asset.AssetType || '') !== 'VideoMaster' || !approved(asset)) return false;
  var info = parseJson(asset.MediaInfoJson, {});
  return Number(asset.HasAudio || 0) === 1
    && /^[a-f0-9]{64}$/i.test(String(asset.ArtifactHash || ''))
    && Number(info.AudioStreamCount || 0) >= 1
    && Number(info.Duration || 0) >= 8
    && Number(info.IntegratedLoudnessLufs || -99) >= -30
    && !!asset.FileUrl;
}

var contentId = String(V8.Param.ContentId || '').trim();
if (!contentId) return { Code: 0, Msg: 'ContentId 不能为空。' };
var contentResult = V8.FormEngine.GetFormData('mci_ai_content_item', { Id: contentId });
if (!contentResult || contentResult.Code !== 1 || !contentResult.Data) return { Code: 0, Msg: '内容稿件不存在。' };
var content = contentResult.Data;
var rawTitle = String(content.Title || '');
var cleanTitle = plainText(rawTitle, 80);
if (!cleanTitle || containsMarkup(rawTitle) || cleanTitle.indexOf('<') >= 0 || cleanTitle.indexOf('>') >= 0) {
  return { Code: 0, Msg: '标题必须是 1-80 字纯文本；HTML、XML 与 topic 标签必须放入平台标签字段，不能进入标题。' };
}
var quality = parseJson(content.QualityResultJson, []);
if (!quality || typeof quality.length === 'undefined') return { Code: 0, Msg: '请先执行平台质量门禁。' };

var accounts = parseJson(V8.Param.Accounts, []);
if (!accounts || typeof accounts.length === 'undefined' || accounts.length < 1) return { Code: 0, Msg: 'Accounts 不能为空；本机连接器必须先实时查询全部已启用帐号。' };
if (accounts.length > 200) return { Code: 0, Msg: '单次最多准备 200 个帐号。' };

var assetResult = V8.FormEngine.GetTableData('mci_ai_content_asset', {
  _Where: [['ContentId', '=', contentId]],
  _OrderBy: 'SequenceNo',
  _OrderByType: 'ASC',
  _PageIndex: 1,
  _PageSize: 200
});
var assets = assetResult && assetResult.Code === 1 ? (assetResult.Data || []) : [];
function findQuality(platform) {
  var target = normalizePlatform(platform);
  for (var i = 0; i < quality.length; i++) if (normalizePlatform(quality[i] && quality[i].Platform) === target) return quality[i];
  return null;
}
function collectAssets(platform, mode) {
  var rows = [];
  for (var i = 0; i < assets.length; i++) {
    var asset = assets[i] || {};
    if (!assetMatches(asset, platform) || !approved(asset) || !asset.FileUrl) continue;
    if (mode === 'Video') {
      if (!isValidMaster(asset)) continue;
    } else if (mode === 'ImageText') {
      if (String(asset.AssetType || '') !== 'ImageCard') continue;
    } else {
      continue;
    }
    rows.push({
      AssetKey: plainText(asset.AssetKey, 160),
      AssetType: plainText(asset.AssetType, 50),
      SequenceNo: Number(asset.SequenceNo || 0),
      FileUrl: plainText(asset.FileUrl, 2000),
      ArtifactHash: plainText(asset.ArtifactHash, 100),
      HasAudio: Number(asset.HasAudio || 0),
      MediaInfo: parseJson(asset.MediaInfoJson, {}),
      QualityScore: Number(asset.QualityScore || 0)
    });
  }
  return rows;
}

var prepared = [];
var createdCount = 0;
var replayedCount = 0;
var blockedCount = 0;
for (var a = 0; a < accounts.length; a++) {
  var account = accounts[a] || {};
  var platform = plainText(account.Platform || account.platform || account.AccountType || account.accountType || account.Type || account.type, 100);
  var accountId = plainText(account.AccountId || account.accountId || account.Id || account.id, 200);
  var accountName = plainText(account.AccountName || account.accountName || account.Name || account.name || accountId, 300);
  if (!platform || !accountId) return { Code: 0, Msg: '第 ' + (a + 1) + ' 个帐号缺少 Platform 或 AccountId。' };
  var gate = findQuality(platform);
  var mode = gate && gate.Mode ? String(gate.Mode) : 'Article';
  var reasons = [];
  if (!gate || gate.Passed !== true) reasons.push(gate && gate.Reasons ? String(gate.Reasons) : '该平台尚未通过质量门禁');
  if (isShortVideoPlatform(platform) && mode !== 'Video' && mode !== 'ImageText') reasons.push('抖音/快手只允许视频或高质量原生图文');
  var selectedAssets = collectAssets(platform, mode);
  if (mode === 'Video' && selectedAssets.length !== 1) reasons.push('视频发布必须且只能绑定一个带音轨的 VideoMaster 成片');
  if (mode === 'ImageText' && (selectedAssets.length < 6 || selectedAssets.length > 9)) reasons.push('高质量原生竖版卡片必须为 6-9 张');
  var status = reasons.length ? 'BlockedQuality' : 'Pending';
  var payload = {
    SchemaVersion: 2,
    ContentId: contentId,
    Title: cleanTitle,
    Summary: plainText(content.Summary, 2000),
    Description: plainText(content.Markdown || content.Summary, 4000),
    Markdown: String(content.Markdown || ''),
    Html: String(content.Html || ''),
    Platform: platform,
    AccountId: accountId,
    ContentMode: mode,
    Assets: selectedAssets,
    QualityGate: gate || { Passed: false, Reasons: reasons }
  };
  var extension = V8.ApiEngine.Run('mci-ai-publish-adapter-extension', {
    ContentId: contentId,
    Platform: platform,
    AccountId: accountId,
    ContentMode: mode,
    PublicPayload: payload
  });
  if (extension && extension.Code === 1 && extension.Data && extension.Data.PublicPayload) payload = extension.Data.PublicPayload;
  payload.Title = plainText(payload.Title, 80);
  payload.Description = plainText(payload.Description || payload.Summary, 4000);
  if (!payload.Title || containsMarkup(payload.Title)) return { Code: 0, Msg: platform + ' 的扩展标题不是安全纯文本。' };
  if (containsSecretKey(payload)) return { Code: 0, Msg: '发布参数检测到疑似凭据字段，已拒绝入库。' };
  var artifactIdentity = mode === 'Video' && selectedAssets.length === 1 ? selectedAssets[0].ArtifactHash : V8.EncryptHelper.Sha256Hex(JSON.stringify(selectedAssets));
  var idempotencyKey = V8.EncryptHelper.Sha256Hex(contentId + '|' + normalizePlatform(platform) + '|' + accountId + '|' + mode + '|' + artifactIdentity);
  var existing = V8.FormEngine.GetFormData('mci_ai_publish_task', { _Where: [['IdempotencyKey', '=', idempotencyKey]] });
  if (existing && existing.Code === 1 && existing.Data) {
    replayedCount++;
    prepared.push({ Id: existing.Data.Id, Platform: platform, AccountId: accountId, Status: existing.Data.Status, Replayed: true });
    continue;
  }
  var add = V8.FormEngine.AddFormData('mci_ai_publish_task', {
    IdempotencyKey: idempotencyKey,
    ContentId: contentId,
    Platform: platform,
    AccountId: accountId,
    AccountName: accountName,
    ContentMode: mode,
    Status: status,
    PayloadJson: JSON.stringify(payload),
    AttemptCount: 0,
    MaxAttempts: 3,
    FencingToken: 0,
    LastError: reasons.join('；')
  });
  if (!add || add.Code !== 1) {
    existing = V8.FormEngine.GetFormData('mci_ai_publish_task', { _Where: [['IdempotencyKey', '=', idempotencyKey]] });
    if (!existing || existing.Code !== 1 || !existing.Data) return add || { Code: 0, Msg: '发布任务创建失败。' };
    replayedCount++;
    prepared.push({ Id: existing.Data.Id, Platform: platform, AccountId: accountId, Status: existing.Data.Status, Replayed: true });
    continue;
  }
  var created = V8.FormEngine.GetFormData('mci_ai_publish_task', { _Where: [['IdempotencyKey', '=', idempotencyKey]] });
  createdCount++;
  if (status === 'BlockedQuality') blockedCount++;
  prepared.push({ Id: created && created.Data ? created.Data.Id : '', Platform: platform, AccountId: accountId, Status: status, Replayed: false });
}
V8.FormEngine.UptFormData('mci_ai_content_item', { Id: contentId, Title: cleanTitle, Status: blockedCount === accounts.length ? 'BlockedQuality' : 'Publishing' });
return {
  Code: 1,
  Data: { ContentId: contentId, AccountCount: accounts.length, Created: createdCount, Replayed: replayedCount, BlockedQuality: blockedCount, Tasks: prepared },
  Msg: blockedCount ? '发布队列已准备；不合格帐号已明确标记为 BlockedQuality。' : '全部帐号已按一个帐号一个成片准备发布队列。'
};
