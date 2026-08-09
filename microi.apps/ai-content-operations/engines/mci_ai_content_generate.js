function isAdmin() {
  var user = V8.CurrentUser || {};
  return !!user.Id && (String(user.Account || '').toLowerCase() === 'admin' || Number(user.Level || 0) >= 9999);
}
if (!isAdmin()) return { Code: 0, Msg: '权限不足：只有管理员可以调用在线 AI 生成稿件。' };

var contentId = String(V8.Param.ContentId || '');
if (!contentId) return { Code: 0, Msg: 'ContentId 不能为空。' };
var itemResult = V8.FormEngine.GetFormData('mci_ai_content_item', { Id: contentId });
if (!itemResult || itemResult.Code !== 1 || !itemResult.Data) return { Code: 0, Msg: '内容稿件不存在。' };
var item = itemResult.Data;
var planResult = V8.FormEngine.GetFormData('mci_ai_content_plan', { Id: item.PlanId });
if (!planResult || planResult.Code !== 1 || !planResult.Data) return { Code: 0, Msg: '内容计划不存在。' };
var plan = planResult.Data;

var sourceResult = V8.FormEngine.GetTableData('mci_ai_content_source', {
  _Where: [['Enabled', '=', 1]],
  _SelectFields: ['SourceKey', 'Name', 'SourceType', 'SourceUrl', 'LocalPath', 'TrustLevel', 'SourceSnapshot', 'SourceHash', 'LastVerifiedTime', 'Notes'],
  _OrderBy: 'LastVerifiedTime',
  _OrderByType: 'DESC',
  _PageIndex: 1,
  _PageSize: 8
});
var sources = sourceResult && sourceResult.Code === 1 ? (sourceResult.Data || []) : [];
var evidence = [];
var sourceText = '';
for (var i = 0; i < sources.length; i++) {
  var source = sources[i] || {};
  var snapshot = String(source.SourceSnapshot || '');
  if (snapshot.length > 5000) snapshot = snapshot.substring(0, 5000);
  sourceText += '\n\n[资料' + (i + 1) + '] ' + String(source.Name || source.SourceKey || '')
    + '\n类型：' + String(source.SourceType || '')
    + '\n地址：' + String(source.SourceUrl || source.LocalPath || '')
    + '\n最近核验：' + String(source.LastVerifiedTime || '')
    + '\n快照：' + snapshot;
  evidence.push({
    SourceKey: source.SourceKey,
    Name: source.Name,
    SourceType: source.SourceType,
    SourceUrl: source.SourceUrl,
    LocalPath: source.LocalPath,
    SourceHash: source.SourceHash,
    LastVerifiedTime: source.LastVerifiedTime
  });
}
if (sources.length === 0) return { Code: 0, Msg: '没有已启用的可信资料快照，拒绝让模型凭空写文章。' };

V8.FormEngine.UptFormData('mci_ai_content_item', { Id: item.Id, Status: 'Drafting', LastError: '' });
var systemPrompt = [
  '你是严谨的中文技术作者，只能依据提供的已核验资料快照形成文章。',
  '标题必须讲一个具体 AI 问题或技术取舍，标题中禁止出现“Microi吾码”。',
  '正文必须自然出现一次“Microi吾码AI”，但不能写成推广软文。',
  '正文按 5-8 分钟阅读设计，6-9 个短章节，段落通常 2-4 句，包含 2-4 个可改造代码块、失败或意外、证据边界。',
  '禁止虚构测试、性能数字、用户故事、截图、外部发布结果或未提供的产品行为。',
  '只返回严格 JSON，不要 Markdown 围栏：{"title":"","summary":"","markdown":"","html":""}。',
  String(plan.ArticlePrompt || '')
].join('\n');
var userPrompt = '时段：' + String(item.SlotKey || '')
  + '\n已有角度（可为空）：' + String(item.Angle || '')
  + '\n请从资料中选择一个窄而实用的新角度，生成可进入人工与质量审核的原创稿件。'
  + sourceText;
var model = String(V8.Param.AiModel || plan.DefaultAiModel || '');
var ai;
try {
  ai = await V8.AI.Chat({
    AiModel: model,
    SystemChatMsg: systemPrompt,
    UserChatMsg: userPrompt,
    ConversationId: 'mci-ai-content:' + String(item.SlotKey || item.Id)
  });
} catch (error) {
  var errorText = String(error && (error.Message || error.message) || error || '在线 AI 调用异常。');
  if (errorText.length > 1800) errorText = errorText.substring(0, 1800);
  V8.FormEngine.UptFormData('mci_ai_content_item', { Id: item.Id, Status: 'Failed', LastError: errorText });
  return { Code: 0, Msg: errorText };
}
if (!ai || ai.Code !== 1) {
  V8.FormEngine.UptFormData('mci_ai_content_item', { Id: item.Id, Status: 'Failed', LastError: (ai && ai.Msg) || '在线 AI 调用失败。' });
  return ai || { Code: 0, Msg: '在线 AI 调用失败。' };
}

var raw = typeof ai.Data === 'string' ? ai.Data : JSON.stringify(ai.Data || {});
raw = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
var generated;
try { generated = JSON.parse(raw); } catch (e) { generated = null; }
if (!generated || !generated.title || !generated.markdown) {
  V8.FormEngine.UptFormData('mci_ai_content_item', {
    Id: item.Id,
    Markdown: raw,
    AiModel: model,
    Status: 'NeedsReview',
    QualityStatus: 'Pending',
    SourceEvidenceJson: JSON.stringify(evidence),
    GeneratedTime: DateNow('yyyy-MM-dd HH:mm:ss'),
    LastError: '模型未返回约定 JSON，原始正文已保留，需人工整理。'
  });
  return { Code: 1, Data: { ContentId: item.Id, Status: 'NeedsReview', Parsed: false }, Msg: '已保留模型原文，但需要人工整理 JSON。' };
}

var title = String(generated.title || '').trim();
var markdown = String(generated.markdown || '').trim();
var summary = String(generated.summary || '').trim();
var html = String(generated.html || '').trim();
V8.FormEngine.UptFormData('mci_ai_content_item', {
  Id: item.Id,
  Title: title,
  Summary: summary,
  Markdown: markdown,
  Html: html,
  AiModel: model,
  Status: 'QualityReview',
  QualityStatus: 'Pending',
  SourceEvidenceJson: JSON.stringify(evidence),
  GeneratedTime: DateNow('yyyy-MM-dd HH:mm:ss'),
  LastError: ''
});
return { Code: 1, Data: { ContentId: item.Id, Title: title, Status: 'QualityReview', Parsed: true, EvidenceCount: evidence.length } };
