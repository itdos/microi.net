/*
 * V8 ApiEngine
 * ApiEngineKey: mci-ai-content-quality-gate
 * Version: v1.0.0
 * Function:
 * - 请补充该 V8 代码的完整功能说明。
 */

function isAdmin() {
  var user = V8.CurrentUser || {};
  return !!user.Id && (String(user.Account || '').toLowerCase() === 'admin' || Number(user.Level || 0) >= 9999);
}
if (!isAdmin()) return { Code: 0, Msg: '权限不足：只有管理员可以执行质量门禁。' };
var contentId = String(V8.Param.ContentId || '');
if (!contentId) return { Code: 0, Msg: 'ContentId 不能为空。' };
var itemResult = V8.FormEngine.GetFormData('mci_ai_content_item', { Id: contentId });
if (!itemResult || itemResult.Code !== 1 || !itemResult.Data) return { Code: 0, Msg: '内容稿件不存在。' };
var item = itemResult.Data;
var assetsResult = V8.FormEngine.GetTableData('mci_ai_content_asset', {
  _Where: [['ContentId', '=', contentId]],
  _OrderBy: 'SequenceNo',
  _OrderByType: 'ASC',
  _PageIndex: 1,
  _PageSize: 100
});
var assets = assetsResult && assetsResult.Code === 1 ? (assetsResult.Data || []) : [];
function approved(asset) {
  return String(asset.ReviewStatus || '') === 'Approved'
    && Number(asset.QualityScore || 0) >= 80
    && String(asset.QualityReview || '').trim().length >= 10;
}
function shortPlatform(value) {
  var text = String(value || '').toLowerCase();
  return text.indexOf('douyin') >= 0 || text.indexOf('抖音') >= 0
    || text.indexOf('kuaishou') >= 0 || text.indexOf('快手') >= 0;
}
var commonReasons = [];
var title = String(item.Title || '');
var markdown = String(item.Markdown || '');
if (!title) commonReasons.push('标题为空');
if (title.indexOf('Microi吾码') >= 0) commonReasons.push('标题包含禁用品牌词');
if (markdown.length < 1200) commonReasons.push('正文信息量不足');
if (markdown.indexOf('Microi吾码AI') < 0) commonReasons.push('正文缺少约定的自然品牌露出');
if (String(item.SourceEvidenceJson || '').length < 5) commonReasons.push('缺少来源证据');

var platformInput = V8.Param.Platforms || ['CSDN', 'Zhihu', 'Xiaohongshu', 'Douyin', 'Kuaishou'];
if (typeof platformInput === 'string') platformInput = platformInput.split(',');
var results = [];
var blocked = commonReasons.length > 0;
for (var p = 0; p < platformInput.length; p++) {
  var platform = String(platformInput[p] || '').trim();
  if (!platform) continue;
  var reasons = commonReasons.slice(0);
  var mode = 'Article';
  if (shortPlatform(platform)) {
    var approvedVideos = [];
    var approvedCards = [];
    for (var i = 0; i < assets.length; i++) {
      var asset = assets[i] || {};
      var target = String(asset.Platform || '').toLowerCase();
      var matches = !target || target === platform.toLowerCase()
        || (platform.toLowerCase().indexOf('douyin') >= 0 && target.indexOf('抖音') >= 0)
        || (platform.toLowerCase().indexOf('kuaishou') >= 0 && target.indexOf('快手') >= 0);
      if (!matches || !approved(asset)) continue;
      if (String(asset.AssetType || '') === 'Video' && String(asset.Status || '') === 'Approved') approvedVideos.push(asset);
      if (String(asset.AssetType || '') === 'ImageCard') approvedCards.push(asset);
    }
    if (approvedVideos.length > 0) {
      mode = 'Video';
    } else if (approvedCards.length >= 6 && approvedCards.length <= 9) {
      mode = 'ImageText';
    } else {
      reasons.push('抖音/快手缺少审核通过的视频，且高质量原生竖版卡片不是 6-9 张');
    }
  }
  var passed = reasons.length === 0;
  if (!passed) blocked = true;
  results.push({ Platform: platform, Passed: passed, Mode: mode, Status: passed ? 'Approved' : 'BlockedQuality', Reasons: reasons });
}
var score = Math.max(0, 100 - commonReasons.length * 20 - results.filter(function (x) { return !x.Passed; }).length * 10);
V8.FormEngine.UptFormData('mci_ai_content_item', {
  Id: item.Id,
  QualityScore: score,
  QualityStatus: blocked ? 'Blocked' : 'Approved',
  QualityResultJson: JSON.stringify(results),
  Status: blocked ? 'BlockedQuality' : 'Ready',
  LastError: blocked ? results.filter(function (x) { return !x.Passed; }).map(function (x) { return x.Platform + ': ' + x.Reasons.join('；'); }).join('\n') : ''
});
return { Code: 1, Data: { ContentId: item.Id, Passed: !blocked, Score: score, Platforms: results }, Msg: blocked ? '质量门禁已阻断不合格平台素材。' : '质量门禁通过。' };
