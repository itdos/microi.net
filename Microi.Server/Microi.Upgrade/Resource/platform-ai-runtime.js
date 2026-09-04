/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：AI助手
 * ApiEngineKey：platform-ai-runtime
 * 从可信吾码官方应用源安装、更新或重新安装“AI助手”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/* PLATFORM_RUNTIME_DISPATCH_MARKER_V1 */
var aiRuntimeRoute = String(V8.Param.ApiAddress || '').replace(/\?.*$/, '').toLowerCase();
var aiRuntimeActions = {
  '/api/ai/updateconversationtitle':'UpdateConversationTitle',
  '/api/ai/recognizeintent':'RecognizeIntent',
  '/api/ai/chat':'Chat',
  '/api/ai/nl2sql':'NL2SQL',
  '/api/ai/nl2v8enginesync':'NL2V8EngineSync'
};
if(aiRuntimeActions[aiRuntimeRoute]) V8.Param.Action = aiRuntimeActions[aiRuntimeRoute];



// Microi官方接口引擎：platform-ai-runtime
// Version: v1.1.1
// AI_RUNTIME_MANAGED_NON_STREAM_V1：非流式兼容动作由 V8 编排，身份、租户、密钥和权限由 V8.AI 绑定。
var param = V8.Param || {};
var action = text(param.Action);
var currentUser = V8.CurrentUser || {};
var supportedActions = {
  UpdateConversationTitle: true,
  RecognizeIntent: true,
  Chat: true,
  NL2SQL: true,
  NL2V8EngineSync: true,
  ProcessImage: true
};

if (!supportedActions[action]) return { Code: 0, Msg: '不支持的 AI 运行时动作。' };
if (!text(currentUser.Id)) return { Code: 1001, Msg: '登录身份已过期。' };

// 只把来源、阶段和动作交给租户 Hook；问题、回答、标题、SQL、模型、附件、
// 历史、租户、用户、密钥和 Endpoint 均不会进入可编辑 Hook。
var hookResult = V8.ApiEngine.Run('platform-ai-custom-hook', {
  SourceApiEngineKey: 'platform-ai-runtime',
  Stage: 'Before',
  Action: action
});
if (!hookResult || Number(hookResult.Code) !== 1) {
  return hookResult || { Code: 0, Msg: 'AI助手个性化 Hook 未返回结果。' };
}

if (action === 'UpdateConversationTitle') {
  return await V8.AI.UpdateConversationTitle(
    text(param.ConversationId),
    text(param.Title),
    text(param.Source));
}
if (action === 'RecognizeIntent') {
  return await V8.AI.RecognizeIntent(copyIntentParam(param));
}
if (action === 'Chat') {
  return await V8.AI.Chat(copyChatParam(param));
}
if (action === 'NL2SQL') {
  return await V8.AI.NL2SQL(copyNl2SqlParam(param));
}
if (action === 'ProcessImage') {
  return processImage(param);
}
return await V8.AI.NL2V8(copyNl2V8Param(param));

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function copyChatParam(source) {
  return {
    UserChatMsg: text(source.UserChatMsg),
    SystemChatMsg: text(source.SystemChatMsg),
    AiModel: text(source.AiModel),
    RelayModel: text(source.RelayModel),
    AiModelId: text(source.AiModelId),
    AiId: text(source.AiId),
    ConversationId: text(source.ConversationId),
    Mode: text(source.Mode),
    ReasoningEffort: text(source.ReasoningEffort),
    Attachments: nonEmptyList(source.Attachments),
    ChatHistory: nonEmptyList(source.ChatHistory)
  };
}

function copyIntentParam(source) {
  var result = copyChatParam(source);
  var attachments = source.Attachments;
  if (attachments && typeof attachments !== 'string' && typeof attachments.length === 'number') {
    var summaries = [];
    for (var i = 0; i < Math.min(Number(attachments.length || 0), 10); i++) {
      var item = attachments[i] || {};
      summaries.push({
        FileName: text(item.FileName).slice(0, 200),
        ContentType: text(item.ContentType).slice(0, 100),
        Size: Number(item.Size || 0),
        Text: text(item.Text).slice(0, 1000)
      });
    }
    if (summaries.length) {
      result.UserChatMsg += '\n附件摘要：' + JSON.stringify(summaries);
    }
  }
  // 意图识别只需要问题和受限附件摘要，不需要把 JS 集合绑定到 .NET List<T>。
  result.Attachments = null;
  result.ChatHistory = null;
  return result;
}

// Jint cannot bind an empty JavaScript array to List<T>; it throws
// "Object must implement IConvertible" before V8.AI is entered. Preserve
// non-empty payloads, but represent an empty optional collection as null.
function nonEmptyList(value) {
  if (!value) return null;
  return Number(value.length || 0) > 0 ? value : null;
}

function copyNl2SqlParam(source) {
  return {
    Question: text(source.Question),
    AiModel: text(source.AiModel),
    AiModelId: text(source.AiModelId),
    AiId: text(source.AiId),
    ReasoningEffort: text(source.ReasoningEffort)
  };
}

function copyNl2V8Param(source) {
  return {
    Question: text(source.Question),
    AiModel: text(source.AiModel),
    CurrentCode: text(source.CurrentCode),
    ReasoningEffort: text(source.ReasoningEffort),
    ChatHistory: nonEmptyList(source.ChatHistory)
  };
}

// AI_IMAGE_EXACT_PROCESSING_V1
// 只接收浏览器随本次请求提交的内存图片；不读取 URL、本地路径或租户外对象。
// 生成式编辑继续由 Microi.AI 的 MiniMax 安全原子能力负责，这里只承担可验证、
// 不消耗模型额度的精确缩放、裁剪、拼图、黑白、抠纯色背景和格式转换。
function processImage(source) {
  var operation = text(source.Operation).toLowerCase();
  var supported = {
    grayscale: true,
    'remove-solid-background': true,
    resize: true,
    crop: true,
    rotate: true,
    flip: true,
    convert: true,
    merge: true
  };
  if (!supported[operation]) return { Code: 0, Msg: '不支持的精确图片处理动作。' };
  var images = imageInputs(source.Images || source.Image);
  if (!images.length) return { Code: 0, Msg: '请上传需要处理的图片。' };
  if (images.length > 12) return { Code: 0, Msg: '单次最多处理 12 张图片。' };
  if (operation !== 'merge' && images.length !== 1) return { Code: 0, Msg: '当前工具只允许上传一张图片。' };
  if (operation === 'merge' && images.length < 2) return { Code: 0, Msg: '拼图至少需要两张图片。' };

  var options = source.Options && typeof source.Options === 'object' ? source.Options : {};
  var format = safeFormat(options.OutputFormat || source.OutputFormat || 'png');
  var quality = integerBetween(options.Quality, 1, 100, 92);
  var result;
  if (operation === 'grayscale') {
    result = V8.Image.Grayscale({
      DataUrl: images[0].DataUrl,
      Strength: decimalBetween(options.Strength, 0, 1, 1),
      OutputFormat: format,
      Quality: quality,
      FileName: 'ai-grayscale.' + format
    });
  } else if (operation === 'remove-solid-background') {
    result = V8.Image.RemoveSolidBackground({
      DataUrl: images[0].DataUrl,
      Tolerance: integerBetween(options.Tolerance, 0, 255, 36),
      Feather: integerBetween(options.Feather, 0, 255, 24),
      OutputFormat: 'png',
      FileName: 'ai-cutout.png'
    });
  } else if (operation === 'resize') {
    var width = optionalDimension(options.Width);
    var height = optionalDimension(options.Height);
    if (!width && !height) return { Code: 0, Msg: '缩放至少需要设置宽度或高度。' };
    result = V8.Image.Resize({
      DataUrl: images[0].DataUrl,
      Width: width || null,
      Height: height || null,
      Fit: safeFit(options.Fit),
      Pad: options.Pad === true,
      AllowUpscale: options.AllowUpscale !== false,
      BackgroundColor: safeColor(options.BackgroundColor, '#ffffff'),
      OutputFormat: format,
      Quality: quality,
      FileName: 'ai-resize.' + format
    });
  } else if (operation === 'crop') {
    var info = V8.Image.GetInfo({ DataUrl: images[0].DataUrl });
    if (!info || Number(info.Code) !== 1) return info || { Code: 0, Msg: '无法读取图片尺寸。' };
    var crop = cropRect(info.Data, options);
    result = V8.Image.Crop({
      DataUrl: images[0].DataUrl,
      X: crop.X,
      Y: crop.Y,
      Width: crop.Width,
      Height: crop.Height,
      Clamp: true,
      OutputFormat: format,
      Quality: quality,
      FileName: 'ai-crop.' + format
    });
  } else if (operation === 'rotate') {
    result = V8.Image.Rotate({
      DataUrl: images[0].DataUrl,
      Degrees: decimalBetween(options.Degrees, -360, 360, 90),
      Expand: options.Expand !== false,
      BackgroundColor: safeColor(options.BackgroundColor, 'transparent'),
      OutputFormat: format,
      Quality: quality,
      FileName: 'ai-rotate.' + format
    });
  } else if (operation === 'flip') {
    result = V8.Image.Flip({
      DataUrl: images[0].DataUrl,
      Horizontal: options.Horizontal !== false,
      Vertical: options.Vertical === true,
      OutputFormat: format,
      Quality: quality,
      FileName: 'ai-flip.' + format
    });
  } else if (operation === 'convert') {
    result = V8.Image.Convert({
      DataUrl: images[0].DataUrl,
      OutputFormat: format,
      Quality: quality,
      BackgroundColor: safeColor(options.BackgroundColor, '#ffffff'),
      FileName: 'ai-convert.' + format
    });
  } else {
    result = V8.Image.Merge({
      Mode: safeMergeMode(options.Mode),
      Images: images.map(function (item) { return { DataUrl: item.DataUrl }; }),
      Columns: integerBetween(options.Columns, 1, 12, 2),
      Gap: integerBetween(options.Gap, 0, 128, 12),
      Padding: integerBetween(options.Padding, 0, 128, 12),
      Alignment: 'center',
      BackgroundColor: safeColor(options.BackgroundColor, '#ffffff'),
      OutputFormat: format,
      Quality: quality,
      FileName: 'ai-collage.' + format
    });
  }
  if (!result || Number(result.Code) !== 1 || !result.Data || !text(result.Data.FileByteBase64)) {
    return result || { Code: 0, Msg: '图片处理没有返回有效结果。' };
  }
  var assetId = text(V8.Method.NewUlid()).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!assetId) return { Code: 0, Msg: '无法生成图片资产唯一编号，未写入 HDFS。' };
  var uploadFormat = safeFormat(result.Data.Format || format);
  var uploadFileName = 'ai-' + operation.replace(/[^a-z0-9-]/g, '-') + '-' + assetId + '.' + uploadFormat;
  var uploadFiles = {};
  uploadFiles[uploadFileName] = result.Data.FileByteBase64;
  var upload = V8.Method.Upload({
    FilesByteBase64: uploadFiles,
    Limit: false,
    Preview: false,
    Path: '/ai-images',
    OsClient: V8.OsClient
  });
  if (!upload || Number(upload.Code) !== 1 || !upload.Data) return upload || { Code: 0, Msg: '图片写入 HDFS 失败。' };
  var uploaded = firstRow(upload.Data);
  var filePath = text(uploaded.Path || uploaded.FilePath);
  var fileUrl = text(uploaded.FullPath || uploaded.FileUrl);
  if (!fileUrl && filePath) {
    fileUrl = text(V8.SysConfig && V8.SysConfig.FileServer).replace(/\/+$/, '') + '/' + filePath.replace(/^\/+/, '');
  }
  if (!filePath || !/^https?:\/\//i.test(fileUrl)) {
    return { Code: 0, Msg: '图片已处理，但 HDFS 没有返回可验证的永久地址。' };
  }
  return {
    Code: 1,
    Data: {
      Operation: operation,
      FileName: text(uploaded.Name || uploaded.FileName || result.Data.FileName),
      FilePath: filePath,
      FileUrl: fileUrl,
      FileSize: Number(uploaded.Size || result.Data.Size || 0),
      ContentType: text(result.Data.ContentType),
      Width: Number(result.Data.Width || 0),
      Height: Number(result.Data.Height || 0),
      Format: text(result.Data.Format),
      Permanent: true,
      Storage: 'Microi.HDFS'
    }
  };
}

function imageInputs(value) {
  var list = [];
  if (value && typeof value !== 'string' && typeof value.length === 'number') {
    for (var i = 0; i < value.length; i++) list.push(value[i]);
  } else if (value) list.push(value);
  var result = [];
  for (var index = 0; index < list.length; index++) {
    var item = list[index];
    var dataUrl = typeof item === 'string' ? item : text(item && (item.DataUrl || item.dataUrl));
    if (!/^data:image\/(?:png|jpe?g|webp|bmp);base64,/i.test(dataUrl)) continue;
    if (dataUrl.length > 15 * 1024 * 1024) continue;
    result.push({ DataUrl: dataUrl });
  }
  return result;
}

function firstRow(value) {
  if (value && typeof value !== 'string' && typeof value.length === 'number') return value[0] || {};
  return value || {};
}

function integerBetween(value, minimum, maximum, fallback) {
  var number = Math.round(Number(value));
  return isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function decimalBetween(value, minimum, maximum, fallback) {
  var number = Number(value);
  return isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function optionalDimension(value) {
  var number = Math.round(Number(value));
  return isFinite(number) && number > 0 ? Math.min(8192, number) : 0;
}

function safeFormat(value) {
  var format = text(value).toLowerCase();
  if (format === 'jpg') format = 'jpeg';
  return ['png', 'jpeg', 'webp', 'bmp'].indexOf(format) >= 0 ? format : 'png';
}

function safeFit(value) {
  var fit = text(value).toLowerCase();
  return ['contain', 'cover', 'fill'].indexOf(fit) >= 0 ? fit : 'contain';
}

function safeMergeMode(value) {
  var mode = text(value).toLowerCase();
  return ['horizontal', 'vertical', 'grid', 'overlay'].indexOf(mode) >= 0 ? mode : 'grid';
}

function safeColor(value, fallback) {
  var color = text(value);
  return /^(?:transparent|white|black|#[0-9a-f]{3,8}|rgba?\([0-9.,%\s]+\))$/i.test(color) ? color : fallback;
}

function cropRect(info, options) {
  var sourceWidth = Math.max(1, Number(info.Width || 1));
  var sourceHeight = Math.max(1, Number(info.Height || 1));
  var width = integerBetween(options.Width, 1, sourceWidth, 0);
  var height = integerBetween(options.Height, 1, sourceHeight, 0);
  if (!width || !height) {
    var ratio = text(options.AspectRatio || '1:1').split(':').map(Number);
    var targetRatio = ratio.length === 2 && ratio[0] > 0 && ratio[1] > 0 ? ratio[0] / ratio[1] : 1;
    if (sourceWidth / sourceHeight > targetRatio) {
      height = sourceHeight;
      width = Math.max(1, Math.round(height * targetRatio));
    } else {
      width = sourceWidth;
      height = Math.max(1, Math.round(width / targetRatio));
    }
  }
  return {
    X: integerBetween(options.X, 0, Math.max(0, sourceWidth - width), Math.max(0, Math.floor((sourceWidth - width) / 2))),
    Y: integerBetween(options.Y, 0, Math.max(0, sourceHeight - height), Math.max(0, Math.floor((sourceHeight - height) / 2))),
    Width: width,
    Height: height
  };
}
