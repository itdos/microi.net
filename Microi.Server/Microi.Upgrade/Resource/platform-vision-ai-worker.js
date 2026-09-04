/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：视觉引擎
 * ApiEngineKey：platform-vision-ai-worker
 * 此接口只允许持久后台任务调用。AI 仅在租户样本库未匹配后执行，所有图片从当前租户私有 HDFS 读取。
 */

// Microi 官方接口引擎：platform-vision-ai-worker
// Version: v1.0.3
// VISION_AI_WORKER_RESILIENT_MODEL_RETRY_V3
var workerParam = V8.Param || {};
var requestNo = safeKey(workerParam.RequestId || workerParam.RequestNo, 80);
if (!requestNo) return { Code: 0, Msg: 'RequestId 不能为空。' };

var taskId = text(workerParam._BackgroundTaskId);
progress(5, '读取待识别记录');

var request = null;
for (var readAttempt = 0; readAttempt < 6; readAttempt++) {
  request = getRequest(requestNo);
  if (request) break;
  V8.Action.Sleep(200);
}
if (!request) return { Code: 0, Msg: '待识别记录尚未提交或不存在。' };
if (text(request.Status) === 'Failed') {
  return { Code: 0, Data: publicResult(request), Msg: text(request.ErrorMessage) || 'AI 识别请求已失败。' };
}
if (text(request.Status) !== 'AiPending') {
  return { Code: 1, Data: publicResult(request), Msg: '识别记录已处于终态，后台任务幂等结束。' };
}

var profile = getProfile(text(request.ProfileKey));
if (Number(profile.AiFallbackEnabled || 0) !== 1) {
  return await finish(request, 'Unmatched', 'None', null, 'AI 回退已关闭。');
}
if (text(request.Mode) === 'Face' && Number(profile.FaceAiFallbackEnabled || 0) !== 1) {
  return await finish(request, 'Unmatched', 'None', null, '人脸 AI 回退已关闭。');
}

var privatePath = text(request.InputFilePath);
if (!privatePath) return await finish(request, 'Failed', 'None', null, 'AI 回退缺少私有图片。');

try {
  progress(20, '读取租户私有图片');
  var bytesResult = await V8.HDFS.GetPrivateFileByte({
    FilePathName: privatePath,
    Limit: true
  });
  if (!bytesResult || Number(bytesResult.Code) !== 1 || !bytesResult.Data) {
    return await finish(request, 'Failed', 'None', null, text(bytesResult && bytesResult.Msg) || '读取私有图片失败。');
  }
  var imageBase64 = System.Convert.ToBase64String(bytesResult.Data);
  var contentType = imageContentType(text(request.InputFileName));
  var mode = text(request.Mode) === 'Face' ? 'Face' : 'General';
  var systemPrompt = mode === 'Face'
    ? '你是合规的视觉分类器。数据库人脸样本已经匹配失败。禁止猜测、确认或暗示现实身份、姓名、犯罪记录、种族、健康、政治等敏感属性；只能返回“未识别人员”以及中性、可见的服饰或场景描述。只输出一个 JSON 对象，不要 Markdown。'
    : '你是零售与通用物体视觉分类器。识别画面中心、秤台或主要区域内最可能的商品、物体、动物、植物或建筑。先确保大类判断正确，再给出能可靠确认的具体品种；例如能看出是鱼但无法可靠区分鱼种时，label 必须返回“鱼”、category 返回“水产鱼类”，不能因为鱼种不确定而返回“无法判断”。若有多个同类物品，名称仍返回品类并在描述中说明可见数量。只输出一个 JSON 对象，不要 Markdown。';
  var defaultPrompt = 'JSON 必须严格使用：{"label":"具体中文名称或可靠大类","category":"中文类别","description":"不超过80字的可见事实","confidence":0.0,"candidates":[{"label":"候选名称","confidence":0.0}]}。confidence 范围 0 到 1，候选最多3个；只有连物体大类也看不清时 label 才写“无法判断”且置信度低。';
  var customPrompt = text(profile.AiPrompt);
  if (customPrompt.length > 1200) customPrompt = customPrompt.substring(0, 1200);
  var aiModels = resolveAiModels(profile);
  if (!aiModels.length) {
    return await finish(request, 'Failed', 'None', null,
      '当前租户没有可用的 Microi.AI 模型，请先在 AI 引擎中启用模型或在识别配置中指定模型。');
  }
  progress(45, '调用 Microi.AI 视觉模型');
  var aiCall = await callVisionAi(aiModels, {
    UserChatMsg: defaultPrompt + (customPrompt ? '\n业务补充：' + customPrompt : ''),
    SystemChatMsg: systemPrompt,
    Mode: 'vision-recognition',
    ReasoningEffort: 'low',
    Attachments: [{
      FileName: text(request.InputFileName || 'vision-frame.jpg'),
      ContentType: contentType,
      FileByteBase64: imageBase64,
      Size: Number(bytesResult.Data.Length || 0)
    }]
  });
  var ai = aiCall && aiCall.Result;
  var aiModel = aiCall && aiCall.Model;
  if (!ai || Number(ai.Code) !== 1 || !text(ai.Data)) {
    return await finish(request, 'Failed', 'None', null,
      cleanText(aiCall && aiCall.Message, 400) || text(ai && ai.Msg) || 'AI 模型多次调用后仍没有返回有效结果。');
  }
  var parsed = parseAiJson(text(ai.Data));
  if (!parsed || !text(parsed.label)) {
    return await finish(request, 'Failed', 'None', null, 'AI 返回格式无法解析。');
  }
  var label = cleanText(parsed.label, 100);
  var category = cleanText(parsed.category, 100);
  var description = cleanText(parsed.description, 500);
  var confidence = clampNumber(parsed.confidence, 0, 1, 0);
  var candidates = sanitizeCandidates(parsed.candidates);
  if (mode === 'Face') {
    label = '未识别人员';
    category = category || '人员';
  }
  var mapped = mode === 'Face' ? null : findSubjectByName(label);
  var update = {
    Id: text(request.Id),
    Status: 'AiMatched',
    MatchSource: 'AI',
    SubjectId: mapped ? text(mapped.Id) : '',
    SubjectName: mapped ? text(mapped.Name) : '',
    CategoryId: mapped ? text(mapped.CategoryId) : '',
    CategoryName: mapped ? text(mapped.CategoryName) : category,
    Confidence: confidence,
    AiLabel: label,
    AiCategory: category,
    AiDescription: description,
    AiCandidates: JSON.stringify(candidates),
    AiModelId: text(aiModel.Id),
    CompletedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
    ElapsedMs: elapsedFrom(request.RequestedAt),
    ErrorMessage: ''
  };
  var saved = V8.FormEngine.UptFormData('mci_vision_request', update);
  if (!saved || Number(saved.Code) !== 1) return saved;
  progress(90, '写入 AI 识别结果');
  runHook('After', 'AiFallback', {
    RequestId: requestNo,
    Mode: mode,
    Status: 'AiMatched',
    MatchSource: 'AI',
    SubjectId: text(update.SubjectId)
  });
  await cleanupFaceImage(request);
  progress(100, 'AI 识别完成');
  request.Status = update.Status;
  request.MatchSource = update.MatchSource;
  request.SubjectId = update.SubjectId;
  request.SubjectName = update.SubjectName;
  request.CategoryId = update.CategoryId;
  request.CategoryName = update.CategoryName;
  request.Confidence = update.Confidence;
  request.AiLabel = update.AiLabel;
  request.AiCategory = update.AiCategory;
  request.AiDescription = update.AiDescription;
  request.AiCandidates = update.AiCandidates;
  request.CompletedAt = update.CompletedAt;
  request.ElapsedMs = update.ElapsedMs;
  return { Code: 1, Data: publicResult(request), Msg: 'AI 视觉识别完成。' };
} catch (error) {
  return await finish(request, 'Failed', 'None', null, 'AI 视觉识别失败：' + cleanText(error && error.message ? error.message : error, 400));
}

async function finish(request, status, source, aiData, message) {
  var update = {
    Id: text(request.Id),
    Status: status,
    MatchSource: source,
    CompletedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
    ElapsedMs: elapsedFrom(request.RequestedAt),
    ErrorMessage: cleanText(message, 500)
  };
  if (aiData) {
    update.AiLabel = cleanText(aiData.Label, 100);
    update.AiCategory = cleanText(aiData.Category, 100);
    update.AiDescription = cleanText(aiData.Description, 500);
  }
  var result = V8.FormEngine.UptFormData('mci_vision_request', update);
  await cleanupFaceImage(request);
  if (!result || Number(result.Code) !== 1) return result;
  request.Status = status;
  request.MatchSource = source;
  request.CompletedAt = update.CompletedAt;
  request.ElapsedMs = update.ElapsedMs;
  request.ErrorMessage = update.ErrorMessage;
  return { Code: status === 'Failed' ? 0 : 1, Data: publicResult(request), Msg: message };
}

async function cleanupFaceImage(request) {
  if (text(request.Mode) !== 'Face' || !text(request.InputFilePath)) return;
  var deleted = await V8.HDFS.DeleteObject({ FilePathName: text(request.InputFilePath), Limit: true });
  var cleanupStatus = deleted && Number(deleted.Code) === 1 ? 'Deleted' : 'DeleteFailed';
  V8.FormEngine.UptFormData('mci_vision_request', {
    Id: text(request.Id),
    InputFilePath: cleanupStatus === 'Deleted' ? '' : text(request.InputFilePath),
    InputCleanupStatus: cleanupStatus,
    InputDeletedAt: cleanupStatus === 'Deleted' ? DateNow('yyyy-MM-dd HH:mm:ss') : ''
  });
}

function getRequest(value) {
  var result = V8.FormEngine.GetFormData('mci_vision_request', {
    _Where: [['RequestNo', '=', value]],
    _SelectFields: [
      'Id', 'RequestNo', 'FrameId', 'Mode', 'Status', 'MatchSource', 'SubjectId', 'SubjectName',
      'CategoryId', 'CategoryName', 'LocalSimilarity', 'Confidence', 'AiLabel', 'AiCategory',
      'AiDescription', 'AiCandidates', 'ProfileKey', 'ModelKey', 'ModelVersion', 'QualityScore',
      'InputFileName', 'InputFilePath', 'BackgroundTaskId', 'RequestedAt', 'CompletedAt',
      'ElapsedMs', 'ErrorMessage', 'CreateTime'
    ]
  });
  return result && Number(result.Code) === 1 ? result.Data : null;
}

function getProfile(profileKey) {
  var result = V8.FormEngine.GetFormData('mci_vision_profile', {
    _Where: text(profileKey)
      ? [['ProfileKey', '=', profileKey], ['AND', 'Enabled', '=', 1]]
      : [['IsDefault', '=', 1], ['AND', 'Enabled', '=', 1]],
    _SelectFields: ['ProfileKey', 'AiFallbackEnabled', 'FaceAiFallbackEnabled', 'AiModelId', 'AiPrompt']
  });
  return result && Number(result.Code) === 1 ? result.Data : {
    ProfileKey: 'default',
    AiFallbackEnabled: 1,
    FaceAiFallbackEnabled: 1,
    AiModelId: '',
    AiPrompt: ''
  };
}

function resolveAiModels(profile) {
  var where = [['IsEnable', '=', 1]];
  if (text(profile && profile.AiModelId)) {
    where.push(['AND', 'Id', '=', text(profile.AiModelId)]);
  }
  var result = V8.FormEngine.GetTableData('mic_ai', {
    _Where: where,
    _SelectFields: ['Id', 'Name', 'AiModel'],
    _OrderBy: 'CreateTime',
    _OrderByType: 'DESC',
    _PageIndex: 1,
    _PageSize: text(profile && profile.AiModelId) ? 1 : 3
  });
  if (!result || Number(result.Code) !== 1 || !result.Data) return [];
  var data = result.Data.List || result.Data;
  if (typeof data.length !== 'number') data = [data];
  var models = [];
  for (var i = 0; i < data.length && models.length < 3; i++) {
    var model = data[i] || {};
    if (text(model.Id) && text(model.AiModel || model.Name)) models.push(model);
  }
  return models;
}

async function callVisionAi(models, payload) {
  var modelCount = models && typeof models.length === 'number' ? models.length : 0;
  if (!modelCount) return { Result: null, Model: null, Message: '没有可用的视觉模型。' };
  var maximumAttempts = modelCount === 1 ? 3 : Math.min(5, modelCount * 2);
  var lastMessage = '';
  var lastResult = null;
  var lastModel = null;
  for (var attempt = 0; attempt < maximumAttempts; attempt++) {
    var model = models[attempt % modelCount];
    lastModel = model;
    progress(Math.min(75, 45 + attempt * 7),
      '调用 Microi.AI 视觉模型（第 ' + (attempt + 1) + '/' + maximumAttempts + ' 次）');
    try {
      var requestPayload = {
        AiModelId: text(model.Id),
        AiModel: text(model.AiModel || model.Name),
        UserChatMsg: payload.UserChatMsg,
        SystemChatMsg: payload.SystemChatMsg,
        Mode: payload.Mode,
        ReasoningEffort: payload.ReasoningEffort,
        Attachments: payload.Attachments
      };
      lastResult = await V8.AI.Chat(requestPayload);
      if (lastResult && Number(lastResult.Code) === 1 && text(lastResult.Data)) {
        return { Result: lastResult, Model: model, Message: '' };
      }
      lastMessage = text(lastResult && lastResult.Msg) || 'AI 模型没有返回有效结果。';
    } catch (error) {
      lastMessage = text(error && error.message ? error.message : error) || 'AI 模型调用异常。';
      lastResult = null;
    }
    if (attempt + 1 >= maximumAttempts) break;
    var recoverable = isRecoverableAiError(lastMessage);
    if (!recoverable && modelCount === 1) break;
    var delay = recoverable ? Math.min(6000, 1000 * Math.pow(2, attempt)) : 500;
    progress(Math.min(78, 48 + attempt * 7),
      recoverable ? 'AI 服务繁忙，正在自动重试' : '当前模型不可用，尝试下一个已启用模型');
    V8.Action.Sleep(delay);
  }
  return {
    Result: lastResult,
    Model: lastModel,
    Message: 'AI 模型多次调用失败：' + cleanText(lastMessage, 320)
  };
}

function isRecoverableAiError(value) {
  var message = text(value).toLowerCase();
  return /(^|\D)(408|409|425|429|500|502|503|504|529)(\D|$)/.test(message)
    || /overload|overloaded|rate.?limit|too many requests|temporar|timeout|timed out|busy|try again|负载|繁忙|限流|超时|稍后重试|服务不可用/.test(message);
}

function findSubjectByName(name) {
  if (!text(name) || name === '无法判断') return null;
  var result = V8.FormEngine.GetFormData('mci_vision_subject', {
    _Where: [['Name', '=', name], ['AND', 'Enabled', '=', 1]],
    _SelectFields: ['Id', 'Name', 'CategoryId', 'CategoryName']
  });
  return result && Number(result.Code) === 1 ? result.Data : null;
}

function runHook(stage, action, metadata) {
  var payload = { SourceApiEngineKey: 'platform-vision-ai-worker', Stage: stage, Action: action };
  for (var key in metadata) if (Object.prototype.hasOwnProperty.call(metadata, key)) payload[key] = metadata[key];
  return V8.ApiEngine.Run('platform-vision-custom-hook', payload);
}

function progress(value, message) {
  if (!taskId) return;
  V8.Method.UpdateBackgroundTask({
    _BackgroundTaskId: taskId,
    Progress: value,
    Msg: message
  });
}

function parseAiJson(value) {
  var raw = text(value).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  var first = raw.indexOf('{');
  var last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) raw = raw.substring(first, last + 1);
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function sanitizeCandidates(value) {
  var result = [];
  var source = value && typeof value.length === 'number' ? value : [];
  for (var i = 0; i < source.length && result.length < 3; i++) {
    var item = source[i] || {};
    var label = cleanText(item.label || item.Label, 100);
    if (!label) continue;
    result.push({ Label: label, Confidence: clampNumber(item.confidence || item.Confidence, 0, 1, 0) });
  }
  return result;
}

function publicResult(row) {
  return {
    Id: text(row.Id),
    RequestId: text(row.RequestNo),
    Mode: text(row.Mode),
    Status: text(row.Status),
    MatchSource: text(row.MatchSource),
    Subject: text(row.SubjectId) ? {
      Id: text(row.SubjectId), Name: text(row.SubjectName), CategoryId: text(row.CategoryId), CategoryName: text(row.CategoryName)
    } : null,
    Confidence: Number(row.Confidence || 0),
    Ai: text(row.AiLabel) ? {
      Label: text(row.AiLabel), Category: text(row.AiCategory), Description: text(row.AiDescription), Candidates: parseJson(row.AiCandidates, [])
    } : null,
    CompletedAt: text(row.CompletedAt),
    ElapsedMs: Number(row.ElapsedMs || 0),
    ErrorMessage: text(row.ErrorMessage)
  };
}

function elapsedFrom(value) {
  var start = Date.parse(text(value));
  return isFinite(start) ? Math.max(0, new Date().getTime() - start) : 0;
}

function imageContentType(fileName) {
  var name = text(fileName).toLowerCase();
  if (/\.png$/.test(name)) return 'image/png';
  if (/\.webp$/.test(name)) return 'image/webp';
  return 'image/jpeg';
}

function parseJson(value, fallback) {
  if (!text(value)) return fallback;
  try { return JSON.parse(text(value)); } catch (e) { return fallback; }
}

function clampNumber(value, minimum, maximum, fallback) {
  var parsed = Number(value);
  if (!isFinite(parsed)) parsed = fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function safeKey(value, maximum) {
  return text(value).replace(/[^a-zA-Z0-9._:-]/g, '').substring(0, maximum || 80);
}

function cleanText(value, maximum) {
  return text(value).replace(/[\u0000-\u001f\u007f]/g, ' ').substring(0, maximum || 500);
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}
