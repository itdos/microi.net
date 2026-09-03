/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：视觉引擎
 * ApiEngineKey：platform-vision-runtime
 * 从可信吾码官方应用源安装、更新或重新安装“视觉引擎”，都会以官方源码恢复此 Managed 接口。
 * 客户业务扩展只能写入 platform-vision-custom-hook；图片、向量、AI 提示词和身份信息不会传给 Hook。
 */

// Microi 官方接口引擎：platform-vision-runtime
// Version: v1.1.0
// VISION_DETECT_TRACK_SEARCH_VOTE_ASYNC_AI_FALLBACK_V2
var visionParam = V8.Param || {};
var visionAction = text(visionParam.Action || 'Bootstrap').toLowerCase();
var visionUser = V8.CurrentUser || {};

if (!text(visionUser.Id)) return { Code: 1001, Msg: '登录身份已过期。' };

if (visionAction === 'recognize') return await recognize(visionParam);
if (visionAction === 'enroll') return await enroll(visionParam);
if (visionAction === 'result') return getResult(visionParam);
if (visionAction === 'recent') return getRecent(visionParam);
if (visionAction === 'subjects') return getSubjects(visionParam);
if (visionAction === 'dashboard') return getDashboard();
if (visionAction === 'capabilities') return getCapabilities();
if (visionAction === 'bootstrap') return getBootstrap();
return { Code: 0, Msg: '不支持的视觉识别动作。' };

async function recognize(param) {
  var mode = normalizeMode(param.Mode);
  if (!mode) return { Code: 0, Msg: 'Mode 只支持 General 或 Face。' };
  var image = readImage(param);
  if (!image) return { Code: 0, Msg: '请提交 JPEG、PNG 或 WebP 图片。' };
  var requestNo = safeKey(param.RequestId || param.RequestNo, 80) || text(V8.Method.NewUlid());
  var existing = getRequest(requestNo);
  if (existing) return { Code: 1, Data: publicRequest(existing), Msg: '已返回相同 RequestId 的识别结果。' };

  var profile = getProfile(param.ProfileKey);
  var modelKey = mode === 'Face' ? text(profile.FaceModelKey) : text(profile.GeneralModelKey);
  if (!modelKey) modelKey = 'builtin-visual-fingerprint-v1';
  var frameId = safeKey(param.FrameId, 100);
  var streamSessionId = safeKey(param.StreamSessionId, 80);
  var frameSequence = clampInteger(param.FrameSequence, 0, 2147483647, 0);
  var before = runHook('Before', 'Recognize', {
    RequestId: requestNo,
    Mode: mode,
    FrameId: frameId
  });
  if (!before || Number(before.Code) !== 1) return before || { Code: 0, Msg: '视觉识别 Hook 未返回结果。' };

  var started = new Date().getTime();
  var analyzed = await analyzeVision({
    FileByteBase64: image.Base64,
    FileName: image.FileName,
    ModelKey: modelKey,
    PipelineKey: modelKey,
    Mode: mode,
    FrameId: frameId,
    StreamSessionId: streamSessionId,
    FrameSequence: frameSequence,
    ResetStream: flag(param.ResetStream, false)
  });
  if (!analyzed || Number(analyzed.Code) !== 1 || !analyzed.Data) {
    return analyzed || { Code: 0, Msg: '视觉流水线没有返回结果。' };
  }

  var pipeline = analyzed.Data;
  var rawDetections = rowsFromValue(pipeline.Detections);
  var vector = {
    ModelKey: text(pipeline.PipelineKey || modelKey),
    ModelVersion: text(pipeline.PipelineVersion),
    QualityScore: Number(pipeline.QualityScore || 0),
    ImageWidth: Number(pipeline.ImageWidth || 0),
    ImageHeight: Number(pipeline.ImageHeight || 0)
  };
  var minimumQuality = clampNumber(profile.MinQualityScore, 0, 1, 0.05);
  if (Number(vector.QualityScore || 0) < minimumQuality) {
    var lowQuality = addRequest(attachAnalysis({
      RequestNo: requestNo,
      FrameId: frameId,
      Mode: mode,
      Status: 'LowQuality',
      MatchSource: 'None',
      ProfileKey: text(profile.ProfileKey),
      ModelKey: text(vector.ModelKey),
      ModelVersion: text(vector.ModelVersion),
      InputFileName: image.FileName,
      InputSha256: text(V8.EncryptHelper.Sha256Hex(image.Base64)).toLowerCase(),
      ImageWidth: Number(vector.ImageWidth || 0),
      ImageHeight: Number(vector.ImageHeight || 0),
      QualityScore: Number(vector.QualityScore || 0),
      RequestedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
      CompletedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
      ElapsedMs: new Date().getTime() - started,
      ErrorMessage: '图片清晰度不足，请稳定摄像头或补充光照后重试。'
    }, {
      StreamSessionId: streamSessionId,
      FrameSequence: frameSequence,
      Detections: publicRawDetections(rawDetections),
      Stability: null
    }));
    if (!lowQuality || Number(lowQuality.Code) !== 1) return lowQuality;
    return { Code: 1, Data: publicRequest(getRequest(requestNo) || lowQuality), Msg: '图片清晰度不足，未进入身份或商品判断。' };
  }

  var candidatesResult = V8.FormEngine.GetTableData('mci_vision_sample', {
    _Where: [
      ['Status', '=', 'Ready'],
      ['Mode', '=', mode],
      ['ModelKey', '=', text(vector.ModelKey)]
    ],
    _SelectFields: [
      'Id', 'SampleNo', 'SubjectId', 'SubjectName', 'CategoryId', 'CategoryName',
      'EmbeddingBase64', 'ModelKey', 'ModelVersion', 'QualityScore'
    ],
    _OrderBy: 'QualityScore',
    _OrderByType: 'DESC',
    _PageIndex: 1,
    _PageSize: clampInteger(profile.CandidateLimit, 1, 2000, 1000)
  });
  if (candidatesResult && Number(candidatesResult.Code) !== 1 && Number(candidatesResult.Code) !== 2) {
    return candidatesResult;
  }
  var sampleRows = rows(candidatesResult);
  var candidates = [];
  var sampleById = {};
  for (var i = 0; i < sampleRows.length; i++) {
    var sample = sampleRows[i];
    if (!text(sample.Id) || !text(sample.EmbeddingBase64)) continue;
    var sampleEmbedding = unprotectEmbedding(sample.EmbeddingBase64);
    if (!sampleEmbedding) continue;
    sampleById[text(sample.Id)] = sample;
    candidates.push({
      Key: text(sample.Id),
      Name: text(sample.SubjectName),
      EmbeddingBase64: sampleEmbedding
    });
  }

  var profileThreshold = mode === 'Face'
    ? clampNumber(profile.FaceThreshold, 0, 1, 0.86)
    : clampNumber(profile.GeneralThreshold, 0, 1, 0.82);
  var detectedItems = [];
  var bestItem = null;
  for (var detectionIndex = 0; detectionIndex < rawDetections.length; detectionIndex++) {
    var detection = rawDetections[detectionIndex] || {};
    var top = null;
    var topMatches = [];
    if (candidates.length > 0 && text(detection.EmbeddingBase64)) {
      var searched = await searchVision({
        QueryEmbeddingBase64: text(detection.EmbeddingBase64),
        Candidates: candidates,
        Threshold: 0,
        TopK: clampInteger(profile.TopK, 1, 20, 5),
        EfSearch: clampInteger(profile.HnswEfSearch, 10, 1000, 80),
        IndexKey: safeKey('samples-' + mode + '-' + text(vector.ModelKey), 80)
      });
      if (!searched || Number(searched.Code) !== 1 || !searched.Data) return searched;
      topMatches = rowsFromValue(searched.Data.Matches);
      if (topMatches.length > 0) top = topMatches[0];
    }
    var sample = top ? sampleById[text(top.Key)] : null;
    var subject = sample ? getSubject(text(sample.SubjectId)) : null;
    var threshold = subject && text(subject.ThresholdOverride)
      ? clampNumber(subject.ThresholdOverride, 0, 1, profileThreshold)
      : profileThreshold;
    var similarity = top ? Number(top.Similarity || 0) : 0;
    var matched = !!sample && !!subject && Number(subject.Enabled || 0) === 1 && similarity >= threshold;
    var item = {
      DetectionIndex: Number(detection.Index === undefined ? detectionIndex : detection.Index),
      TrackId: safeKey(detection.TrackId, 80),
      Label: text(detection.Label),
      DetectionConfidence: round6(detection.Confidence),
      Box: publicBox(detection.Box),
      SampleId: sample ? text(sample.Id) : '',
      SubjectId: subject ? text(subject.Id) : '',
      SubjectName: subject ? text(subject.Name) : '',
      CategoryId: subject ? text(subject.CategoryId || sample.CategoryId) : '',
      CategoryName: subject ? text(subject.CategoryName || sample.CategoryName) : '',
      Similarity: round6(similarity),
      Threshold: round6(threshold),
      Matched: matched,
      Candidates: publicMatches(topMatches, sampleById, 3)
    };
    detectedItems.push(item);
    if (!bestItem || (matched && !bestItem.Matched)
        || (matched === bestItem.Matched && similarity > Number(bestItem.Similarity || 0))) bestItem = item;
  }
  if (!bestItem) {
    bestItem = {
      DetectionIndex: -1, TrackId: '', Label: '', DetectionConfidence: 0, Box: null,
      SampleId: '', SubjectId: '', SubjectName: '', CategoryId: '', CategoryName: '',
      Similarity: 0, Threshold: profileThreshold, Matched: false, Candidates: []
    };
  }
  var matchedSample = text(bestItem.SampleId) ? sampleById[text(bestItem.SampleId)] : null;
  var matchedSubject = text(bestItem.SubjectId) ? getSubject(text(bestItem.SubjectId)) : null;
  var similarity = Number(bestItem.Similarity || 0);
  var isMatched = bestItem.Matched === true;
  var stability = await stabilizeContinuousFrame(param, profile, streamSessionId, frameId, bestItem);
  if (stability && stability.Stable) {
    if (text(stability.Key) === '__unmatched__') {
      isMatched = false;
      matchedSubject = null;
      matchedSample = null;
    } else {
      var stableSubject = getSubject(text(stability.Key));
      if (stableSubject && Number(stableSubject.Enabled || 0) === 1) {
        matchedSubject = stableSubject;
        isMatched = true;
        bestItem.SubjectId = text(stableSubject.Id);
        bestItem.SubjectName = text(stableSubject.Name);
        bestItem.CategoryId = text(stableSubject.CategoryId);
        bestItem.CategoryName = text(stableSubject.CategoryName);
        bestItem.Matched = true;
      }
    }
  }
  var analysisMeta = {
    StreamSessionId: streamSessionId,
    FrameSequence: frameSequence,
    Detections: detectedItems,
    Stability: stability
  };

  if (flag(param.Continuous, false) && (!stability || !stability.Stable)) {
    var observingRow = attachAnalysis({
      RequestNo: requestNo,
      FrameId: frameId,
      Mode: mode,
      Status: 'Received',
      MatchSource: 'None',
      LocalSimilarity: round6(similarity),
      ProfileKey: text(profile.ProfileKey),
      ModelKey: text(vector.ModelKey),
      ModelVersion: text(vector.ModelVersion),
      InputFileName: image.FileName,
      InputSha256: text(V8.EncryptHelper.Sha256Hex(image.Base64)).toLowerCase(),
      ImageWidth: Number(vector.ImageWidth || 0),
      ImageHeight: Number(vector.ImageHeight || 0),
      QualityScore: Number(vector.QualityScore || 0),
      RequestedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
      CompletedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
      ElapsedMs: new Date().getTime() - started
    }, analysisMeta);
    var observingAdded = addRequest(observingRow);
    if (!observingAdded || Number(observingAdded.Code) !== 1) return observingAdded;
    return {
      Code: 1,
      Data: publicRequest(getRequest(requestNo) || observingRow),
      Msg: '正在进行连续帧投票，尚未形成稳定结论。'
    };
  }

  if (isMatched) {
    var retainedPath = shouldRetainInput(profile, mode) ? uploadPrivateImage(image, requestNo, 'requests') : '';
    var localRow = attachAnalysis({
      RequestNo: requestNo,
      FrameId: frameId,
      Mode: mode,
      Status: 'LocalMatched',
      MatchSource: 'Database',
      SubjectId: text(matchedSubject.Id),
      SubjectName: text(matchedSubject.Name),
      CategoryId: text(matchedSubject.CategoryId || bestItem.CategoryId),
      CategoryName: text(matchedSubject.CategoryName || bestItem.CategoryName),
      LocalSimilarity: round6(similarity),
      Confidence: round6(similarity),
      ProfileKey: text(profile.ProfileKey),
      ModelKey: text(vector.ModelKey),
      ModelVersion: text(vector.ModelVersion),
      InputFileName: image.FileName,
      InputFilePath: retainedPath,
      InputSha256: text(V8.EncryptHelper.Sha256Hex(image.Base64)).toLowerCase(),
      ImageWidth: Number(vector.ImageWidth || 0),
      ImageHeight: Number(vector.ImageHeight || 0),
      QualityScore: Number(vector.QualityScore || 0),
      RequestedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
      CompletedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
      ElapsedMs: new Date().getTime() - started
    }, analysisMeta);
    var localAdded = addRequest(localRow);
    if (!localAdded || Number(localAdded.Code) !== 1) return localAdded;
    var localSaved = getRequest(requestNo) || localRow;
    runHook('After', 'Recognize', {
      RequestId: requestNo,
      Mode: mode,
      Status: 'LocalMatched',
      MatchSource: 'Database',
      SubjectId: text(localRow.SubjectId)
    });
    return {
      Code: 1,
      Data: publicRequest(localSaved),
      Msg: '已匹配租户样本库。'
    };
  }

  var aiEnabled = Number(profile.AiFallbackEnabled || 0) === 1;
  if (mode === 'Face') {
    aiEnabled = aiEnabled
      && Number(profile.FaceAiFallbackEnabled || 0) === 1
      && flag(param.ConsentConfirmed, false);
  }
  if (!aiEnabled) {
    var unmatchedRow = attachAnalysis({
      RequestNo: requestNo,
      FrameId: frameId,
      Mode: mode,
      Status: 'Unmatched',
      MatchSource: 'None',
      LocalSimilarity: round6(similarity),
      ProfileKey: text(profile.ProfileKey),
      ModelKey: text(vector.ModelKey),
      ModelVersion: text(vector.ModelVersion),
      InputFileName: image.FileName,
      InputSha256: text(V8.EncryptHelper.Sha256Hex(image.Base64)).toLowerCase(),
      ImageWidth: Number(vector.ImageWidth || 0),
      ImageHeight: Number(vector.ImageHeight || 0),
      QualityScore: Number(vector.QualityScore || 0),
      RequestedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
      CompletedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
      ElapsedMs: new Date().getTime() - started,
      ErrorMessage: mode === 'Face' && !flag(param.ConsentConfirmed, false)
        ? '人脸 AI 回退需要本次明确知情同意。'
        : ''
    }, analysisMeta);
    var unmatchedAdded = addRequest(unmatchedRow);
    if (!unmatchedAdded || Number(unmatchedAdded.Code) !== 1) return unmatchedAdded;
    runHook('After', 'Recognize', {
      RequestId: requestNo,
      Mode: mode,
      Status: 'Unmatched',
      MatchSource: 'None'
    });
    return {
      Code: 1,
      Data: publicRequest(getRequest(requestNo) || unmatchedRow),
      Msg: unmatchedRow.ErrorMessage || '样本库未匹配，AI 回退已关闭。'
    };
  }

  var pendingPath = uploadPrivateImage(image, requestNo, 'pending');
  if (!pendingPath) return { Code: 0, Msg: '样本库未匹配，但私有图片暂存失败，未提交 AI。' };
  var pendingRow = attachAnalysis({
    RequestNo: requestNo,
    FrameId: frameId,
    Mode: mode,
    Status: 'AiPending',
    MatchSource: 'None',
    LocalSimilarity: round6(similarity),
    ProfileKey: text(profile.ProfileKey),
    ModelKey: text(vector.ModelKey),
    ModelVersion: text(vector.ModelVersion),
    InputFileName: image.FileName,
    InputFilePath: pendingPath,
    InputSha256: text(V8.EncryptHelper.Sha256Hex(image.Base64)).toLowerCase(),
    ImageWidth: Number(vector.ImageWidth || 0),
    ImageHeight: Number(vector.ImageHeight || 0),
    QualityScore: Number(vector.QualityScore || 0),
    RequestedAt: DateNow('yyyy-MM-dd HH:mm:ss'),
    ElapsedMs: new Date().getTime() - started
  }, analysisMeta);
  var pendingAdded = addRequest(pendingRow);
  if (!pendingAdded || Number(pendingAdded.Code) !== 1) return pendingAdded;
  var savedPending = getRequest(requestNo) || pendingRow;
  var queued = V8.Method.ManageBackgroundTask({
    Action: 'RunApiEngine',
    TargetApiEngineKey: 'platform-vision-ai-worker',
    Param: { RequestId: requestNo },
    Title: 'AI 识别：' + requestNo,
    Options: {
      IdempotencyKey: 'vision-ai:' + requestNo,
      ConcurrencyKey: 'vision-ai:' + V8.OsClient,
      MaxAttempts: 3,
      RetryOnFailure: true
    }
  });
  if (!queued || Number(queued.Code) !== 1) {
    V8.FormEngine.UptFormData('mci_vision_request', {
      Id: text(savedPending.Id),
      Status: 'Failed',
      ErrorMessage: text(queued && queued.Msg) || 'AI 后台任务提交失败。',
      CompletedAt: DateNow('yyyy-MM-dd HH:mm:ss')
    });
    return queued || { Code: 0, Msg: 'AI 后台任务提交失败。' };
  }
  var backgroundId = text(queued.Data && (queued.Data.Id || queued.Data.TaskId));
  if (text(savedPending.Id) && backgroundId) {
    V8.FormEngine.UptFormData('mci_vision_request', {
      Id: text(savedPending.Id),
      BackgroundTaskId: backgroundId
    });
    savedPending.BackgroundTaskId = backgroundId;
  }
  runHook('After', 'Recognize', {
    RequestId: requestNo,
    Mode: mode,
    Status: 'AiPending',
    MatchSource: 'None'
  });
  return {
    Code: 1,
    Data: publicRequest(savedPending),
    Msg: '样本库未匹配，AI 模型正在异步识别。'
  };
}

async function enroll(param) {
  var subjectId = safeKey(param.SubjectId, 80);
  if (!subjectId) return { Code: 0, Msg: 'SubjectId 不能为空。' };
  var subject = getSubject(subjectId);
  if (!subject || Number(subject.Enabled || 0) !== 1) return { Code: 0, Msg: '识别对象不存在或已停用。' };
  var subjectMode = normalizeMode(subject.RecognitionMode);
  var requestedMode = normalizeMode(param.Mode);
  if (!subjectMode) return { Code: 0, Msg: '识别对象没有有效的识别模式。' };
  if (requestedMode && requestedMode !== subjectMode) {
    return { Code: 0, Msg: '样本模式必须与识别对象的识别模式一致。' };
  }
  var mode = subjectMode;
  if (mode === 'Face' && !flag(param.ConsentConfirmed, false)) {
    return { Code: 0, Msg: '录入人脸样本前必须确认已取得本人或合法授权。' };
  }
  var image = readImage(param);
  if (!image) return { Code: 0, Msg: '请提交 JPEG、PNG 或 WebP 样本图片。' };
  var profile = getProfile(param.ProfileKey);
  var modelKey = mode === 'Face' ? text(profile.FaceModelKey) : text(profile.GeneralModelKey);
  if (!modelKey) modelKey = 'builtin-visual-fingerprint-v1';
  var sampleNo = safeKey(param.SampleNo, 80) || text(V8.Method.NewUlid());
  var before = runHook('Before', 'Enroll', {
    SampleNo: sampleNo,
    SubjectId: subjectId,
    Mode: mode
  });
  if (!before || Number(before.Code) !== 1) return before || { Code: 0, Msg: '视觉样本 Hook 未返回结果。' };

  var analyzed = await analyzeVision({
    FileByteBase64: image.Base64,
    FileName: image.FileName,
    ModelKey: modelKey,
    PipelineKey: modelKey,
    Mode: mode,
    FrameId: sampleNo
  });
  if (!analyzed || Number(analyzed.Code) !== 1 || !analyzed.Data) return analyzed;
  var pipeline = analyzed.Data;
  var enrollmentDetections = rowsFromValue(pipeline.Detections);
  if (enrollmentDetections.length === 0) {
    return { Code: 0, Msg: mode === 'Face' ? '样本图片未检测到可用人脸。' : '样本图片未检测到可用目标。' };
  }
  var selectedDetection = selectEnrollmentDetection(enrollmentDetections, param.DetectionIndex);
  if (!selectedDetection || !text(selectedDetection.EmbeddingBase64)) {
    return { Code: 0, Msg: '样本目标没有生成有效视觉特征。' };
  }
  var vector = {
    EmbeddingBase64: text(selectedDetection.EmbeddingBase64),
    EmbeddingFormat: text(pipeline.EmbeddingFormat || 'microi-f32-le-v1'),
    EmbeddingDimensions: Number(selectedDetection.EmbeddingDimensions || 0),
    ModelKey: text(pipeline.PipelineKey || modelKey),
    ModelVersion: text(pipeline.PipelineVersion),
    QualityScore: Number(pipeline.QualityScore || 0),
    Warnings: pipeline.Warnings || []
  };
  var protectedEmbedding = protectEmbedding(vector.EmbeddingBase64);
  if (!protectedEmbedding) return { Code: 0, Msg: '视觉特征向量保护失败，样本未写入。' };
  var privatePath = uploadPrivateImage(image, sampleNo, 'samples/' + mode.toLowerCase());
  if (!privatePath) return { Code: 0, Msg: '样本图片写入租户私有存储失败。' };
  var added = V8.FormEngine.AddFormData('mci_vision_sample', {
    SampleNo: sampleNo,
    SubjectId: text(subject.Id),
    SubjectName: text(subject.Name),
    CategoryId: text(subject.CategoryId),
    CategoryName: text(subject.CategoryName),
    Mode: mode,
    ImagePath: privatePath,
    OriginalFileName: image.FileName,
    EmbeddingBase64: protectedEmbedding,
    EmbeddingFormat: text(vector.EmbeddingFormat),
    EmbeddingDimensions: Number(vector.EmbeddingDimensions || 0),
    ModelKey: text(vector.ModelKey),
    ModelVersion: text(vector.ModelVersion),
    QualityScore: Number(vector.QualityScore || 0),
    Status: 'Ready',
    Source: text(param.Source || 'Manual'),
    EnrolledAt: DateNow('yyyy-MM-dd HH:mm:ss')
  });
  if (!added || Number(added.Code) !== 1) return added;
  // SampleNo 是平台自动编号字段，AddFormData 会用最终编号覆盖调用方提供的
  // 幂等/帧标识。必须以实际持久化返回值为准，避免返回空 Id 或不存在的编号。
  var saved = added.Data || {};
  var persistedSampleNo = text(saved.SampleNo) || sampleNo;
  if (!text(saved.Id)) saved = getSample(persistedSampleNo) || saved;
  runHook('After', 'Enroll', {
    SampleNo: persistedSampleNo,
    SampleId: text(saved.Id),
    SubjectId: subjectId,
    Mode: mode,
    Status: 'Ready'
  });
  return {
    Code: 1,
    Data: {
      Id: text(saved.Id),
      SampleNo: persistedSampleNo,
      SubjectId: text(subject.Id),
      SubjectName: text(subject.Name),
      CategoryName: text(subject.CategoryName),
      Mode: mode,
      ModelKey: text(vector.ModelKey),
      ModelVersion: text(vector.ModelVersion),
      QualityScore: Number(vector.QualityScore || 0),
      Status: 'Ready',
      DetectionIndex: Number(selectedDetection.Index || 0),
      DetectionCount: enrollmentDetections.length,
      Warnings: vector.Warnings || []
    },
    Msg: '视觉样本录入成功。'
  };
}

function getBootstrap() {
  var capabilities = V8.Vision.GetCapabilities();
  if (!capabilities || Number(capabilities.Code) !== 1) return capabilities;
  return {
    Code: 1,
    Data: {
      Profile: publicProfile(getProfile()),
      Capabilities: capabilities.Data,
      Dashboard: dashboardData(),
      Recent: recentRows(12)
    }
  };
}

function getCapabilities() {
  var result = V8.Vision.GetCapabilities();
  if (!result || Number(result.Code) !== 1) return result;
  return { Code: 1, Data: { Profile: publicProfile(getProfile()), Capabilities: result.Data } };
}

function getDashboard() {
  return { Code: 1, Data: dashboardData() };
}

function getRecent(param) {
  return { Code: 1, Data: recentRows(clampInteger(param.PageSize, 1, 50, 20)) };
}

function getResult(param) {
  var requestNo = safeKey(param.RequestId || param.RequestNo, 80);
  if (!requestNo) return { Code: 0, Msg: 'RequestId 不能为空。' };
  var row = getRequest(requestNo);
  if (!row) return { Code: 2, Msg: '识别请求不存在。' };
  return { Code: 1, Data: publicRequest(row) };
}

function getSubjects(param) {
  var mode = normalizeMode(param.Mode) || '';
  var where = [['Enabled', '=', 1]];
  if (mode) where.push(['AND', 'RecognitionMode', '=', mode]);
  var result = V8.FormEngine.GetTableData('mci_vision_subject', {
    _Where: where,
    _SelectFields: ['Id', 'ObjectNo', 'Name', 'CategoryId', 'CategoryName', 'ObjectType', 'RecognitionMode', 'ReviewRequired'],
    _OrderBy: 'Name',
    _OrderByType: 'ASC',
    _PageIndex: 1,
    _PageSize: 200
  });
  if (!result || Number(result.Code) !== 1) return result;
  return { Code: 1, Data: rows(result) };
}

function dashboardData() {
  return {
    SubjectCount: tableCount('mci_vision_subject', [['Enabled', '=', 1]]),
    SampleCount: tableCount('mci_vision_sample', [['Status', '=', 'Ready']]),
    PendingCount: tableCount('mci_vision_request', [['Status', '=', 'AiPending']]),
    TodayCount: tableCount('mci_vision_request', [['CreateTime', 'StartLike', DateNow('yyyy-MM-dd')]])
  };
}

function recentRows(pageSize) {
  var result = V8.FormEngine.GetTableData('mci_vision_request', {
    _SelectFields: [
      'Id', 'RequestNo', 'FrameId', 'StreamSessionId', 'FrameSequence', 'Mode', 'Status', 'MatchSource', 'SubjectId', 'SubjectName',
      'CategoryId', 'CategoryName', 'LocalSimilarity', 'Confidence', 'AiLabel', 'AiCategory',
      'AiDescription', 'AiCandidates', 'ModelKey', 'ModelVersion', 'QualityScore', 'BackgroundTaskId',
      'RequestedAt', 'CompletedAt', 'ElapsedMs', 'DetectionsJson', 'StabilityJson', 'ErrorMessage', 'CreateTime'
    ],
    _OrderBy: 'CreateTime',
    _OrderByType: 'DESC',
    _PageIndex: 1,
    _PageSize: pageSize
  });
  if (!result || Number(result.Code) !== 1) return [];
  var data = rows(result);
  var output = [];
  for (var i = 0; i < data.length; i++) output.push(publicRequest(data[i]));
  return output;
}

function getProfile(profileKey) {
  var where = [['Enabled', '=', 1]];
  if (text(profileKey)) where.push(['AND', 'ProfileKey', '=', safeKey(profileKey, 80)]);
  else where.push(['AND', 'IsDefault', '=', 1]);
  var result = V8.FormEngine.GetFormData('mci_vision_profile', {
    _Where: where,
    _SelectFields: [
      'Id', 'ProfileKey', 'Name', 'GeneralModelKey', 'FaceModelKey', 'GeneralThreshold', 'FaceThreshold',
      'TopK', 'CandidateLimit', 'HnswEfSearch', 'FrameIntervalMs', 'MinQualityScore',
      'TemporalWindowSize', 'TemporalMinimumVotes', 'TemporalMinimumConfidence', 'AiFallbackEnabled',
      'FaceAiFallbackEnabled', 'AiModelId', 'AiModelName', 'AiPrompt', 'RetainInputDays',
      'RetainFaceInput', 'IsDefault', 'Enabled'
    ]
  });
  if (result && Number(result.Code) === 1 && result.Data) return result.Data;
  return {
    ProfileKey: 'default',
    Name: '默认识别策略',
    GeneralModelKey: 'builtin-visual-fingerprint-v1',
    FaceModelKey: 'builtin-visual-fingerprint-v1',
    GeneralThreshold: 0.82,
    FaceThreshold: 0.86,
    TopK: 5,
    CandidateLimit: 1000,
    HnswEfSearch: 80,
    FrameIntervalMs: 1800,
    MinQualityScore: 0.05,
    TemporalWindowSize: 5,
    TemporalMinimumVotes: 3,
    TemporalMinimumConfidence: 0.55,
    AiFallbackEnabled: 1,
    FaceAiFallbackEnabled: 1,
    RetainInputDays: 7,
    RetainFaceInput: 0,
    IsDefault: 1,
    Enabled: 1
  };
}

function publicProfile(profile) {
  return {
    ProfileKey: text(profile.ProfileKey),
    Name: text(profile.Name),
    GeneralModelKey: text(profile.GeneralModelKey),
    FaceModelKey: text(profile.FaceModelKey),
    GeneralThreshold: Number(profile.GeneralThreshold || 0.82),
    FaceThreshold: Number(profile.FaceThreshold || 0.86),
    TopK: Number(profile.TopK || 5),
    CandidateLimit: Number(profile.CandidateLimit || 1000),
    HnswEfSearch: Number(profile.HnswEfSearch || 80),
    FrameIntervalMs: Number(profile.FrameIntervalMs || 1800),
    MinQualityScore: Number(profile.MinQualityScore || 0.05),
    TemporalWindowSize: Number(profile.TemporalWindowSize || 5),
    TemporalMinimumVotes: Number(profile.TemporalMinimumVotes || 3),
    TemporalMinimumConfidence: Number(profile.TemporalMinimumConfidence || 0.55),
    AiFallbackEnabled: Number(profile.AiFallbackEnabled || 0),
    FaceAiFallbackEnabled: Number(profile.FaceAiFallbackEnabled || 0),
    AiModelName: text(profile.AiModelName),
    RetainInputDays: Number(profile.RetainInputDays || 0),
    RetainFaceInput: Number(profile.RetainFaceInput || 0)
  };
}

function getSubject(id) {
  if (!text(id)) return null;
  var result = V8.FormEngine.GetFormData('mci_vision_subject', {
    Id: id,
    _SelectFields: [
      'Id', 'ObjectNo', 'Name', 'CategoryId', 'CategoryName', 'ObjectType', 'RecognitionMode',
      'ThresholdOverride', 'ReviewRequired', 'Enabled'
    ]
  });
  return result && Number(result.Code) === 1 ? result.Data : null;
}

function getSample(sampleNo) {
  var result = V8.FormEngine.GetFormData('mci_vision_sample', {
    _Where: [['SampleNo', '=', sampleNo]],
    _SelectFields: ['Id', 'SampleNo', 'SubjectId', 'SubjectName', 'CategoryName', 'Mode', 'ModelKey', 'ModelVersion', 'QualityScore', 'Status']
  });
  return result && Number(result.Code) === 1 ? result.Data : null;
}

function getRequest(requestNo) {
  var result = V8.FormEngine.GetFormData('mci_vision_request', {
    _Where: [['RequestNo', '=', requestNo]],
    _SelectFields: [
      'Id', 'RequestNo', 'FrameId', 'StreamSessionId', 'FrameSequence', 'Mode', 'Status', 'MatchSource', 'SubjectId', 'SubjectName',
      'CategoryId', 'CategoryName', 'LocalSimilarity', 'Confidence', 'AiLabel', 'AiCategory',
      'AiDescription', 'AiCandidates', 'ModelKey', 'ModelVersion', 'QualityScore', 'BackgroundTaskId',
      'RequestedAt', 'CompletedAt', 'ElapsedMs', 'DetectionsJson', 'StabilityJson', 'ErrorMessage', 'CreateTime'
    ]
  });
  return result && Number(result.Code) === 1 ? result.Data : null;
}

function publicRequest(row) {
  row = row || {};
  var status = text(row.Status);
  return {
    Id: text(row.Id),
    RequestId: text(row.RequestNo),
    FrameId: text(row.FrameId),
    StreamSessionId: text(row.StreamSessionId),
    FrameSequence: Number(row.FrameSequence || 0),
    Mode: text(row.Mode),
    Status: status,
    MatchSource: text(row.MatchSource || 'None'),
    DatabaseMatched: text(row.MatchSource) === 'Database',
    AiPending: status === 'AiPending',
    Subject: text(row.SubjectId) ? {
      Id: text(row.SubjectId),
      Name: text(row.SubjectName),
      CategoryId: text(row.CategoryId),
      CategoryName: text(row.CategoryName)
    } : null,
    LocalSimilarity: Number(row.LocalSimilarity || 0),
    Confidence: Number(row.Confidence || 0),
    Ai: text(row.AiLabel) ? {
      Label: text(row.AiLabel),
      Category: text(row.AiCategory),
      Description: text(row.AiDescription),
      Candidates: parseJson(row.AiCandidates, [])
    } : null,
    ModelKey: text(row.ModelKey),
    ModelVersion: text(row.ModelVersion),
    QualityScore: Number(row.QualityScore || 0),
    BackgroundTaskId: text(row.BackgroundTaskId),
    RequestedAt: text(row.RequestedAt || row.CreateTime),
    CompletedAt: text(row.CompletedAt),
    ElapsedMs: Number(row.ElapsedMs || 0),
    DetectedItems: parseJson(row.DetectionsJson, []),
    Stability: parseJson(row.StabilityJson, null),
    ErrorMessage: text(row.ErrorMessage)
  };
}

function addRequest(row) {
  return V8.FormEngine.AddFormData('mci_vision_request', row);
}

async function stabilizeContinuousFrame(param, profile, streamSessionId, frameId, item) {
  if (!flag(param.Continuous, false) || !streamSessionId) return null;
  var windowSize = clampInteger(profile.TemporalWindowSize, 2, 30, 5);
  var minimumVotes = clampInteger(profile.TemporalMinimumVotes, 1, windowSize, 3);
  var minimumConfidence = clampNumber(profile.TemporalMinimumConfidence, 0, 1, 0.55);
  var trackId = safeKey(item.TrackId, 80) || 'primary';
  var cacheKey = 'Microi:' + V8.OsClient + ':Vision:Vote:' + streamSessionId + ':' + trackId;
  var observations = parseJson(V8.Cache.Get(cacheKey), []);
  if (!observations || typeof observations.length !== 'number') observations = [];
  var matched = item.Matched === true && text(item.SubjectId);
  observations.push({
    FrameId: frameId,
    TrackId: trackId,
    Key: matched ? text(item.SubjectId) : '__unmatched__',
    Name: matched ? text(item.SubjectName) : '未匹配',
    Confidence: round6(matched
      ? clampNumber(item.Similarity, 0, 1, 0)
      : Math.max(minimumConfidence, 1 - clampNumber(item.Similarity, 0, 1, 0))),
    TimestampMilliseconds: new Date().getTime()
  });
  while (observations.length > windowSize) observations.shift();
  V8.Cache.Set(cacheKey, JSON.stringify(observations), 120);
  var voted = await stabilizeVision({
    Observations: observations,
    MinimumVotes: minimumVotes,
    WindowSize: windowSize,
    MinimumAverageConfidence: minimumConfidence
  });
  if (!voted || Number(voted.Code) !== 1 || !voted.Data) {
    throw new Error(text(voted && voted.Msg) || '连续帧投票失败。');
  }
  return voted.Data;
}

// v1.1.0 应用可以先于平台 NuGet 运行时发布。以下三层兼容只在旧宿主缺少新增原子
// 方法时启用；实际推理错误仍原样返回，不会被静默降级。平台升级后自动走完整流水线。
async function analyzeVision(param) {
  if (hasVisionMethod('Analyze')) return await V8.Vision.Analyze(param);
  var extracted = await V8.Vision.Extract({
    FileByteBase64: param.FileByteBase64,
    FileName: param.FileName,
    ModelKey: param.ModelKey,
    Mode: param.Mode,
    FrameId: param.FrameId
  });
  if (!extracted || Number(extracted.Code) !== 1 || !extracted.Data) return extracted;
  var source = extracted.Data;
  var detections = rowsFromValue(source.Detections);
  if (detections.length === 0 && text(source.EmbeddingBase64)) {
    detections = [{
      Index: 0,
      ClassId: -1,
      TrackId: '',
      Label: '',
      Confidence: Number(source.QualityScore || 0),
      Box: { X: 0, Y: 0, Width: 1, Height: 1 },
      Landmarks: [],
      MaskRle: [],
      MaskWidth: 0,
      MaskHeight: 0,
      EmbeddingBase64: text(source.EmbeddingBase64),
      EmbeddingDimensions: Number(source.EmbeddingDimensions || 0)
    }];
  }
  return {
    Code: 1,
    Data: {
      TraceId: text(source.TraceId),
      FrameId: text(source.FrameId || param.FrameId),
      StreamSessionId: text(param.StreamSessionId),
      FrameSequence: Number(param.FrameSequence || 0),
      PipelineKey: text(source.ModelKey || param.ModelKey),
      PipelineVersion: text(source.ModelVersion),
      Provider: text(source.Provider),
      Mode: text(source.Mode || param.Mode),
      EmbeddingFormat: text(source.EmbeddingFormat || 'microi-f32-le-v1'),
      ImageWidth: Number(source.ImageWidth || 0),
      ImageHeight: Number(source.ImageHeight || 0),
      QualityScore: Number(source.QualityScore || 0),
      DetectionMilliseconds: 0,
      EmbeddingMilliseconds: Number(source.ElapsedMilliseconds || 0),
      ElapsedMilliseconds: Number(source.ElapsedMilliseconds || 0),
      Detections: detections,
      Warnings: rowsFromValue(source.Warnings).concat(['HostRuntimeCompatibilityMode'])
    },
    Msg: text(extracted.Msg)
  };
}

async function searchVision(param) {
  if (hasVisionMethod('Search')) return await V8.Vision.Search(param);
  var compared = await V8.Vision.CompareBatch({
    QueryEmbeddingBase64: param.QueryEmbeddingBase64,
    Candidates: param.Candidates,
    Threshold: param.Threshold,
    TopK: param.TopK
  });
  if (!compared || Number(compared.Code) !== 1 || !compared.Data) return compared;
  compared.Data.Algorithm = 'ExactCosineCompatibility';
  compared.Data.CacheHit = false;
  compared.Data.ElapsedMilliseconds = Number(compared.Data.ElapsedMilliseconds || 0);
  return compared;
}

async function stabilizeVision(param) {
  if (hasVisionMethod('Stabilize')) return await V8.Vision.Stabilize(param);
  var observations = rowsFromValue(param.Observations);
  var windowSize = clampInteger(param.WindowSize, 1, 30, 5);
  var minimumVotes = clampInteger(param.MinimumVotes, 1, windowSize, 3);
  var minimumAverage = clampNumber(param.MinimumAverageConfidence, 0, 1, 0.55);
  var first = Math.max(0, observations.length - windowSize);
  var groups = {};
  for (var i = first; i < observations.length; i++) {
    var observation = observations[i] || {};
    var key = text(observation.Key);
    if (!key) continue;
    var group = groups[key] || { Key: key, Name: text(observation.Name), TrackId: text(observation.TrackId), Count: 0, Total: 0 };
    group.Count++;
    group.Total += clampNumber(observation.Confidence, 0, 1, 0);
    groups[key] = group;
  }
  var winner = null;
  for (var groupKey in groups) {
    if (!Object.prototype.hasOwnProperty.call(groups, groupKey)) continue;
    var candidate = groups[groupKey];
    if (!winner || candidate.Count > winner.Count
        || (candidate.Count === winner.Count && candidate.Total > winner.Total)) winner = candidate;
  }
  var windowCount = Math.min(windowSize, observations.length);
  var average = winner && winner.Count ? winner.Total / winner.Count : 0;
  return {
    Code: 1,
    Data: {
      Stable: !!winner && winner.Count >= minimumVotes && average >= minimumAverage,
      TrackId: winner ? winner.TrackId : '',
      Key: winner ? winner.Key : '',
      Name: winner ? winner.Name : '',
      VoteCount: winner ? winner.Count : 0,
      WindowCount: windowCount,
      AverageConfidence: round6(average),
      VoteRatio: windowCount > 0 && winner ? round6(winner.Count / windowCount) : 0
    },
    Msg: '旧宿主兼容模式使用接口引擎连续帧投票。'
  };
}

function hasVisionMethod(name) {
  try {
    return !!V8.Vision && typeof V8.Vision[name] === 'function';
  } catch (e) {
    return false;
  }
}

function attachAnalysis(row, meta) {
  row = row || {};
  meta = meta || {};
  row.StreamSessionId = text(meta.StreamSessionId);
  row.FrameSequence = Number(meta.FrameSequence || 0);
  row.DetectionsJson = JSON.stringify(meta.Detections || []);
  row.StabilityJson = meta.Stability ? JSON.stringify(meta.Stability) : '';
  return row;
}

function publicBox(box) {
  if (!box) return null;
  return {
    X: round6(clampNumber(box.X, 0, 1, 0)),
    Y: round6(clampNumber(box.Y, 0, 1, 0)),
    Width: round6(clampNumber(box.Width, 0, 1, 0)),
    Height: round6(clampNumber(box.Height, 0, 1, 0))
  };
}

function publicRawDetections(value) {
  var source = rowsFromValue(value);
  var result = [];
  for (var i = 0; i < source.length; i++) {
    var item = source[i] || {};
    result.push({
      DetectionIndex: Number(item.Index === undefined ? i : item.Index),
      TrackId: safeKey(item.TrackId, 80),
      Label: text(item.Label),
      DetectionConfidence: round6(item.Confidence),
      Box: publicBox(item.Box),
      SampleId: '', SubjectId: '', SubjectName: '', CategoryId: '', CategoryName: '',
      Similarity: 0, Threshold: 0, Matched: false, Candidates: []
    });
  }
  return result;
}

function publicMatches(matches, sampleById, maximum) {
  var source = rowsFromValue(matches);
  var result = [];
  var limit = Math.min(source.length, maximum || 3);
  for (var i = 0; i < limit; i++) {
    var match = source[i] || {};
    var sample = sampleById[text(match.Key)] || {};
    result.push({
      SampleId: text(sample.Id),
      SubjectId: text(sample.SubjectId),
      SubjectName: text(sample.SubjectName),
      CategoryId: text(sample.CategoryId),
      CategoryName: text(sample.CategoryName),
      Similarity: round6(match.Similarity)
    });
  }
  return result;
}

function selectEnrollmentDetection(detections, requestedIndex) {
  var source = rowsFromValue(detections);
  if (source.length === 0) return null;
  if (requestedIndex !== null && requestedIndex !== undefined && text(requestedIndex) !== '') {
    var exact = Number(requestedIndex);
    for (var i = 0; i < source.length; i++) {
      if (Number(source[i].Index === undefined ? i : source[i].Index) === exact) return source[i];
    }
    return null;
  }
  var best = source[0];
  var bestScore = -1;
  for (var j = 0; j < source.length; j++) {
    var box = source[j].Box || {};
    var area = clampNumber(box.Width, 0, 1, 0) * clampNumber(box.Height, 0, 1, 0);
    var score = clampNumber(source[j].Confidence, 0, 1, 0) * 0.8 + Math.sqrt(area) * 0.2;
    if (score > bestScore) { best = source[j]; bestScore = score; }
  }
  return best;
}

function rowsFromValue(value) {
  if (!value) return [];
  var data = value.List || value;
  return typeof data.length === 'number' ? data : [];
}

function runHook(stage, action, metadata) {
  var payload = {
    SourceApiEngineKey: 'platform-vision-runtime',
    Stage: stage,
    Action: action
  };
  metadata = metadata || {};
  for (var key in metadata) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) payload[key] = metadata[key];
  }
  return V8.ApiEngine.Run('platform-vision-custom-hook', payload);
}

function readImage(param) {
  var base64 = text(param.FileByteBase64 || param.ImageBase64 || param.DataUrl);
  var fileName = safeFileName(param.FileName || 'vision-frame.jpg');
  if (!base64 && V8.FilesByteBase64) {
    var keys = Object.keys(V8.FilesByteBase64);
    if (keys.length > 0) {
      fileName = safeFileName(keys[0]);
      base64 = text(V8.FilesByteBase64[keys[0]]);
    }
  }
  var comma = base64.indexOf(',');
  if (base64.toLowerCase().indexOf('data:image/') === 0 && comma > 0) base64 = base64.substring(comma + 1);
  base64 = base64.replace(/\s+/g, '');
  if (!base64 || base64.length > 23000000) return null;
  return { Base64: base64, FileName: fileName };
}

function uploadPrivateImage(image, key, scope) {
  var files = {};
  var fileName = safeKey(key, 80) + '-' + safeFileName(image.FileName);
  files[fileName] = image.Base64;
  var result = V8.Method.Upload({
    FilesByteBase64: files,
    Limit: true,
    Preview: false,
    Multiple: false,
    Path: '/vision/' + scope + '/' + DateNow('yyyyMMdd'),
    OsClient: V8.OsClient
  });
  if (!result || Number(result.Code) !== 1 || !result.Data) return '';
  var uploaded = firstRow(result.Data) || result.Data;
  return text(uploaded.FullPath || uploaded.Path || uploaded.FilePath || uploaded.FilePathName);
}

function protectEmbedding(value) {
  var plain = text(value);
  if (!plain) return '';
  return text(V8.Method.ProtectApiEngineSecret(plain));
}

function unprotectEmbedding(value) {
  var cipher = text(value);
  if (!cipher) return '';
  try {
    return text(V8.Method.UnprotectApiEngineSecret(cipher));
  } catch (e) {
    // 不把无法解密或来自其它接口引擎安全域的向量降级成明文使用。
    return '';
  }
}

function shouldRetainInput(profile, mode) {
  if (mode === 'Face') return Number(profile.RetainFaceInput || 0) === 1;
  return Number(profile.RetainInputDays || 0) > 0;
}

function tableCount(table, where) {
  var result = V8.FormEngine.GetTableDataCount(table, { _Where: where || [] });
  if (!result || Number(result.Code) !== 1) return 0;
  if (result.DataCount !== null && result.DataCount !== undefined) return Number(result.DataCount || 0);
  if (typeof result.Data === 'number' || typeof result.Data === 'string') return Number(result.Data || 0);
  if (result.Data && result.Data.Count !== undefined) return Number(result.Data.Count || 0);
  return 0;
}

function rows(result) {
  if (!result || !result.Data) return [];
  var data = result.Data.List || result.Data;
  return typeof data.length === 'number' ? data : [];
}

function firstRow(data) {
  if (!data) return null;
  var value = data.List || data;
  if (typeof value.length === 'number') return value.length > 0 ? value[0] : null;
  return value;
}

function parseJson(value, fallback) {
  if (!text(value)) return fallback;
  try { return JSON.parse(text(value)); } catch (e) { return fallback; }
}

function normalizeMode(value) {
  var mode = text(value || 'General').toLowerCase();
  if (mode === 'general') return 'General';
  if (mode === 'face') return 'Face';
  return '';
}

function safeKey(value, maximum) {
  var result = text(value).replace(/[^a-zA-Z0-9._:-]/g, '');
  return result.substring(0, maximum || 80);
}

function safeFileName(value) {
  var name = text(value || 'vision-frame.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!/\.(jpg|jpeg|png|webp)$/i.test(name)) name += '.jpg';
  return name.substring(0, 120);
}

function clampInteger(value, minimum, maximum, fallback) {
  var parsed = parseInt(value, 10);
  if (!isFinite(parsed)) parsed = fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function clampNumber(value, minimum, maximum, fallback) {
  var parsed = Number(value);
  if (!isFinite(parsed)) parsed = fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function round6(value) {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

function flag(value, fallback) {
  if (value === true || value === 1 || value === '1' || text(value).toLowerCase() === 'true') return true;
  if (value === false || value === 0 || value === '0' || text(value).toLowerCase() === 'false') return false;
  return fallback === true;
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}
