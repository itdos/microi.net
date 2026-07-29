export const MOBILE_AI_ENGINE_KEY = "mci_ai_data_assistant";

export const MOBILE_AI_ACTIONS = Object.freeze({
    bootstrap: "Bootstrap",
    listConversations: "History",
    listMessages: "Conversation",
    rename: "Rename",
    archive: "Archive",
    restore: "Restore",
    chat: "Chat"
});

export const MOBILE_AI_BOOTSTRAP_FAILURES = Object.freeze({
    serviceMissing: "service-missing",
    installIncomplete: "install-incomplete",
    unauthorized: "unauthorized",
    modelMissing: "model-missing",
    unavailable: "unavailable"
});

const MOBILE_AI_FAILURE_COPY = Object.freeze({
    [MOBILE_AI_BOOTSTRAP_FAILURES.serviceMissing]: {
        header: "AI助手服务尚未安装",
        title: "当前租户尚未安装 AI助手",
        description: "请安装或升级官方“AI助手”应用后重试。",
        optionLabel: "安全业务数据（需安装 AI助手）"
    },
    [MOBILE_AI_BOOTSTRAP_FAILURES.installIncomplete]: {
        header: "AI助手安装不完整",
        title: "AI助手安装不完整",
        description: "请重新安装或升级官方“AI助手”应用，补齐权限策略和业务域配置。",
        optionLabel: "安全业务数据（安装不完整）"
    },
    [MOBILE_AI_BOOTSTRAP_FAILURES.unauthorized]: {
        header: "当前角色未授权",
        title: "当前角色暂未开通 AI助手",
        description: "请联系管理员为当前角色配置可分析业务域、数据范围和可用模型。",
        optionLabel: "安全业务数据（当前角色未授权）"
    },
    [MOBILE_AI_BOOTSTRAP_FAILURES.modelMissing]: {
        header: "尚未配置可用模型",
        title: "AI助手尚未配置可用模型",
        description: "请联系管理员启用模型，并将模型加入当前角色的 AI助手权限策略。",
        optionLabel: "安全业务数据（无可用模型）"
    },
    [MOBILE_AI_BOOTSTRAP_FAILURES.unavailable]: {
        header: "AI助手服务暂时不可用",
        title: "AI助手暂时不可用",
        description: "服务加载失败，请稍后重试或联系管理员查看服务状态。",
        optionLabel: "安全业务数据（服务不可用）"
    }
});

export function makeMobileAiBootstrapFailure(kind, rawMessage = "") {
    const normalizedKind = MOBILE_AI_FAILURE_COPY[kind]
        ? kind
        : MOBILE_AI_BOOTSTRAP_FAILURES.unavailable;
    return {
        kind: normalizedKind,
        ...MOBILE_AI_FAILURE_COPY[normalizedKind],
        rawMessage: String(rawMessage || "")
    };
}

export function classifyMobileAiBootstrapFailure(error) {
    const rawMessage = String(error?.message || error || "");
    const assistantEngine = /mci_ai_data_assistant/i.test(rawMessage);
    const missing = /不存在|未找到|not\s+found|does\s+not\s+exist|missing/i.test(rawMessage);
    if (assistantEngine && missing && /sys_apiengine|接口引擎|api\s*engine/i.test(rawMessage)) {
        return makeMobileAiBootstrapFailure(MOBILE_AI_BOOTSTRAP_FAILURES.serviceMissing, rawMessage);
    }
    if (missing && /mci_ai_(?:role_policy|data_domain)/i.test(rawMessage)) {
        return makeMobileAiBootstrapFailure(MOBILE_AI_BOOTSTRAP_FAILURES.installIncomplete, rawMessage);
    }
    if (/当前角色.*(?:未开通|未授权)|权限不足|\bNoAuth\b|\bforbidden\b|\b403\b/i.test(rawMessage)) {
        return makeMobileAiBootstrapFailure(MOBILE_AI_BOOTSTRAP_FAILURES.unauthorized, rawMessage);
    }
    return makeMobileAiBootstrapFailure(MOBILE_AI_BOOTSTRAP_FAILURES.unavailable, rawMessage);
}

let bootstrapCache = null;
let bootstrapRequest = null;
let bootstrapGeneration = 0;
const BOOTSTRAP_TTL = 5 * 60 * 1000;

export function unwrapMobileAiResult(result) {
    let current = result;
    for (let index = 0; index < 4; index += 1) {
        if (
            current &&
            Number(current.Code) === 1 &&
            current.Data &&
            typeof current.Data === "object" &&
            current.Data.Code !== undefined
        ) {
            current = current.Data;
        } else {
            break;
        }
    }
    return current || {};
}

async function runMobileAi(diyCommon, action, payload = {}) {
    if (!diyCommon?.ApiEngine?.Run) {
        throw new Error("AI 服务请求能力不可用");
    }
    const result = unwrapMobileAiResult(
        await diyCommon.ApiEngine.Run(MOBILE_AI_ENGINE_KEY, { Action: action, ...payload })
    );
    if (!result || Number(result.Code) !== 1) {
        throw new Error(result?.Msg || "AI 服务暂时不可用");
    }
    return result.Data || {};
}

export async function loadMobileAiBootstrap(diyCommon, userId, force = false) {
    const osClient = String(diyCommon?.GetOsClient?.() || "");
    const cacheKey = `${osClient}:${String(userId || "")}`;
    const now = Date.now();
    if (
        !force &&
        bootstrapCache?.userId === cacheKey &&
        now - bootstrapCache.time < BOOTSTRAP_TTL
    ) {
        return bootstrapCache.data;
    }
    if (!bootstrapRequest || bootstrapRequest.userId !== cacheKey || force) {
        const generation = ++bootstrapGeneration;
        const promise = runMobileAi(diyCommon, MOBILE_AI_ACTIONS.bootstrap).then((data) => {
            if (generation === bootstrapGeneration) {
                bootstrapCache = { userId: cacheKey, time: Date.now(), data };
            }
            return data;
        });
        bootstrapRequest = { userId: cacheKey, generation, promise };
    }
    const activeRequest = bootstrapRequest;
    try {
        return await activeRequest.promise;
    } finally {
        if (bootstrapRequest === activeRequest) bootstrapRequest = null;
    }
}

export function clearMobileAiBootstrapCache() {
    bootstrapGeneration += 1;
    bootstrapCache = null;
    bootstrapRequest = null;
}

export function listMobileAiConversations(diyCommon) {
    return runMobileAi(diyCommon, MOBILE_AI_ACTIONS.listConversations);
}

export function listMobileAiMessages(diyCommon, conversationId) {
    return runMobileAi(diyCommon, MOBILE_AI_ACTIONS.listMessages, {
        ConversationId: conversationId
    });
}

// v1.1.2 的 NewConversation 语义是本地清空 ConversationId；首次 Chat 由服务端分配 Id。
export function newMobileAiConversation() {
    return {
        ConversationId: "",
        Title: "新对话",
        Messages: []
    };
}

export function renameMobileAiConversation(diyCommon, conversationId, title) {
    return runMobileAi(diyCommon, MOBILE_AI_ACTIONS.rename, {
        ConversationId: conversationId,
        Title: title
    });
}

export function setMobileAiConversationArchived(diyCommon, conversationId, archived) {
    return runMobileAi(
        diyCommon,
        archived ? MOBILE_AI_ACTIONS.archive : MOBILE_AI_ACTIONS.restore,
        { ConversationId: conversationId }
    );
}

export function sendMobileAiQuestion(diyCommon, payload) {
    return runMobileAi(diyCommon, MOBILE_AI_ACTIONS.chat, payload);
}

export function makeMobileAiId(prefix = "mci_ai") {
    let suffix = "";
    try {
        suffix = globalThis.crypto?.randomUUID?.() || "";
    } catch (error) {}
    if (!suffix) suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${suffix}`.replace(/[^A-Za-z0-9_.:-]/g, "");
}

export function isMobileAiRelayStation(model) {
    if (!model) return false;
    if (model.IsRelayStation === true || Number(model.IsRelayStation || 0) === 1) return true;
    return /Microi(?:吾码)?\.?(?:AI)?中转站/i.test(`${model.Name || ""} ${model.AiModel || ""}`);
}

export function mobileAiModelSupportsReasoning(model, runtimeModel = "") {
    if (model && (model.SupportReasoning === true || Number(model.SupportReasoning || 0) === 1)) {
        return true;
    }
    const text = [model?.Name, model?.AiModel, model?.ModelType, model?.Provider, runtimeModel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return /(^|[^a-z0-9])(o1|o3|o4)([^a-z0-9]|$)|gpt[-_. ]?5|reason|thinking|deepseek[-_. ]?r1|qwen[-_. ]?3/.test(text);
}

export function formatMobileAiModelName(model) {
    if (!model) return "暂无可用模型";
    const name = model.Name || model.AiModel || "AI";
    return model.AiModel ? `${name}（${model.AiModel}）` : name;
}

export function formatMobileAiRelayName(model) {
    if (!model) return "请选择运行模型";
    const label = model.DisplayName || model.Name || model.Id;
    return label && label !== model.Id ? `${model.Id} · ${label}` : String(model.Id || label || "");
}

export function normalizeMobileAiMessages(data) {
    const rows = Array.isArray(data?.Messages) ? data.Messages : [];
    return rows.map((row) => ({
        id: row.Id || makeMobileAiId("history"),
        role: row.Role === "assistant" ? "assistant" : "user",
        text: String(row.Content || ""),
        loading: false,
        thinking: Array.isArray(row.Thinking) ? row.Thinking.map(String) : [],
        thinkingOpen: false,
        time: row.Time || row.CreateTime || ""
    }));
}
