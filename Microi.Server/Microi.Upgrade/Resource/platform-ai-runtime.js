/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：AI助手
 * ApiEngineKey：platform-ai-runtime
 * 从可信吾码官方应用源安装、更新或重新安装“AI助手”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

// Microi官方接口引擎：platform-ai-runtime
// Version: v1.0.0
// AI_RUNTIME_MANAGED_NON_STREAM_V1：非流式兼容动作由 V8 编排，身份、租户、密钥和权限由 V8.AI 绑定。
var param = V8.Param || {};
var action = text(param.Action);
var currentUser = V8.CurrentUser || {};
var supportedActions = {
  UpdateConversationTitle: true,
  RecognizeIntent: true,
  Chat: true,
  NL2SQL: true,
  NL2V8EngineSync: true
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
  return await V8.AI.RecognizeIntent(copyChatParam(param));
}
if (action === 'Chat') {
  return await V8.AI.Chat(copyChatParam(param));
}
if (action === 'NL2SQL') {
  return await V8.AI.NL2SQL(copyNl2SqlParam(param));
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
    Attachments: source.Attachments || null,
    ChatHistory: source.ChatHistory || null
  };
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
    ChatHistory: source.ChatHistory || null
  };
}
