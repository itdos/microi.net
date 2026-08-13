/*
 * V8 ApiEngine
 * ApiEngineKey: mci-ai-content-quality-gate
 * Version: v1.1.0
 * Function:
 * - 对文章与视频逐平台执行硬质量门禁；视频只允许唯一、带可听音轨且有 ffprobe/哈希证据的 VideoMaster，禁止把 VideoClip 分镜原片当作作品发布。
 */

function isAdmin() {
  var user = V8.CurrentUser || {};
  return !!user.Id && (String(user.Account || '').toLowerCase() === 'admin' || Number(user.Level || 0) >= 9999);
}
if (!isAdmin()) return { Code: 0, Msg: '权限不足：只有管理员可以执行质量门禁。' };

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (e) { return fallback; }
}
function plainText(value) {
  return String(value || '')
    .replace(/<topic\b[^>]*>[\s\S]*?<\/topic>/ig, ' ')
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
}
function containsMarkup(value) {
  return /<\/?(?:p|div|span|br|topic|a|strong|em)\b|<[^>]+>|&(?:lt|gt|nbsp);/i.test(String(value || ''));
}
function approved(asset) {
  return String(asset.ReviewStatus || '') === 'Approved'
    && String(asset.Status || '') === 'Approved'
    && Number(asset.QualityScore || 0) >= 80
    && String(asset.QualityReview || '').trim().length >= 20;
}
function normalizePlatform(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}
function assetMatches(asset, platform) {
  var target = normalizePlatform(asset && asset.Platform);
  var requested = normalizePlatform(platform);
  if (!target || target === 'all' || target === 'allplatforms' || target === 'allvideoplatforms' || target === '全部视频平台') return true;
  if (target === requested) return true;
  if (requested.indexOf('douyin') >= 0 && target.indexOf('抖音') >= 0) return true;
  if (requested.indexOf('kuaishou') >= 0 && target.indexOf('快手') >= 0) return true;
  return false;
}
function shortPlatform(value) {
  var text = normalizePlatform(value);
  return text.indexOf('douyin') >= 0 || text.indexOf('抖音') >= 0
    || text.indexOf('kuaishou') >= 0 || text.indexOf('快手') >= 0;
}
function masterReasons(asset) {
  var reasons = [];
  var info = parseJson(asset && asset.MediaInfoJson, {});
  var hash = String(asset && asset.ArtifactHash || '');
  if (Number(asset && asset.HasAudio || 0) !== 1) reasons.push('VideoMaster 未确认 HasAudio=1');
  if (!/^[a-f0-9]{64}$/i.test(hash)) reasons.push('VideoMaster 缺少 SHA-256 成片哈希');
  if (!info || Number(info.Width || 0) < 1 || Number(info.Height || 0) < 1) reasons.push('VideoMaster 缺少 ffprobe 分辨率证据');
  if (!info || Number(info.Duration || 0) < 8) reasons.push('VideoMaster 时长不足 8 秒，疑似仍是分镜原片');
  if (!info || Number(info.Fps || 0) < 1) reasons.push('VideoMaster 缺少实际 FPS 证据');
  if (!info || Number(info.AudioStreamCount || 0) < 1 || !String(info.AudioCodec || '')) reasons.push('VideoMaster 没有可验证音轨');
  if (!info || Number(info.IntegratedLoudnessLufs || -99) < -30) reasons.push('VideoMaster 音轨过静或缺少响度证据');
  return reasons;
}

var contentId = String(V8.Param.ContentId || '').trim();
if (!contentId) return { Code: 0, Msg: 'ContentId 不能为空。' };
var itemResult = V8.FormEngine.GetFormData('mci_ai_content_item', { Id: contentId });
if (!itemResult || itemResult.Code !== 1 || !itemResult.Data) return { Code: 0, Msg: '内容稿件不存在。' };
var item = itemResult.Data;
var assetsResult = V8.FormEngine.GetTableData('mci_ai_content_asset', {
  _Where: [['ContentId', '=', contentId]],
  _OrderBy: 'SequenceNo',
  _OrderByType: 'ASC',
  _PageIndex: 1,
  _PageSize: 200
});
var assets = assetsResult && assetsResult.Code === 1 ? (assetsResult.Data || []) : [];

var commonReasons = [];
var rawTitle = String(item.Title || '');
var title = plainText(rawTitle);
var markdown = String(item.Markdown || '');
var isVideoContent = String(item.ContentType || '').toLowerCase() === 'video';
if (!title) commonReasons.push('标题为空');
if (containsMarkup(rawTitle) || title.indexOf('<') >= 0 || title.indexOf('>') >= 0) commonReasons.push('标题包含 HTML/XML/topic 标记');
if (title.length > 80) commonReasons.push('标题超过视频与资讯平台通用安全长度 80 字');
if (title.indexOf('Microi吾码') >= 0) commonReasons.push('标题包含禁用品牌词');
if (!isVideoContent && markdown.length < 1200) commonReasons.push('正文信息量不足');
if (!isVideoContent && markdown.indexOf('Microi吾码AI') < 0) commonReasons.push('正文缺少约定的自然品牌露出');
if (isVideoContent && plainText(markdown).length < 60) commonReasons.push('视频说明不足，无法形成完整作品语义');
if (String(item.SourceEvidenceJson || '').length < 5) commonReasons.push('缺少来源证据');

var platformInput = V8.Param.Platforms || ['CSDN', 'Zhihu', 'Xiaohongshu', 'Weibo', 'Douyin', 'Kuaishou', 'Bilibili', 'Shipinhao', 'Baijiahao', 'Toutiaohao', 'Souhuhao'];
if (typeof platformInput === 'string') platformInput = platformInput.split(',');
var results = [];
var blocked = commonReasons.length > 0;
for (var p = 0; p < platformInput.length; p++) {
  var platform = String(platformInput[p] || '').trim();
  if (!platform) continue;
  var reasons = commonReasons.slice(0);
  var mode = isVideoContent ? 'Video' : 'Article';
  var masterAssets = [];
  var approvedCards = [];
  for (var i = 0; i < assets.length; i++) {
    var asset = assets[i] || {};
    if (!assetMatches(asset, platform) || !approved(asset)) continue;
    if (String(asset.AssetType || '') === 'VideoMaster') masterAssets.push(asset);
    if (String(asset.AssetType || '') === 'ImageCard') approvedCards.push(asset);
  }
  if (isVideoContent || shortPlatform(platform)) {
    if (masterAssets.length === 1) {
      mode = 'Video';
      reasons = reasons.concat(masterReasons(masterAssets[0]));
    } else if (!isVideoContent && approvedCards.length >= 6 && approvedCards.length <= 9) {
      mode = 'ImageText';
    } else if (masterAssets.length > 1) {
      reasons.push('同一平台只能有一个审核通过的 VideoMaster 成片');
    } else {
      reasons.push('缺少唯一审核通过的 VideoMaster 成片；VideoClip 分镜原片禁止直接发布');
    }
  }
  var passed = reasons.length === 0;
  if (!passed) blocked = true;
  results.push({
    Platform: platform,
    Passed: passed,
    Mode: mode,
    Status: passed ? 'Approved' : 'BlockedQuality',
    MasterAssetKey: masterAssets.length === 1 ? String(masterAssets[0].AssetKey || '') : '',
    Reasons: reasons
  });
}
var score = Math.max(0, 100 - commonReasons.length * 20 - results.filter(function (x) { return !x.Passed; }).length * 10);
V8.FormEngine.UptFormData('mci_ai_content_item', {
  Id: item.Id,
  Title: title,
  QualityScore: score,
  QualityStatus: blocked ? 'Blocked' : 'Approved',
  QualityResultJson: JSON.stringify(results),
  Status: blocked ? 'BlockedQuality' : 'Ready',
  LastError: blocked ? results.filter(function (x) { return !x.Passed; }).map(function (x) { return x.Platform + ': ' + x.Reasons.join('；'); }).join('\n') : ''
});
return { Code: 1, Data: { ContentId: item.Id, Passed: !blocked, Score: score, Title: title, Platforms: results }, Msg: blocked ? '质量门禁已阻断不合格平台素材。' : '质量门禁通过：每个平台只允许一个带可听音轨的 VideoMaster。' };
