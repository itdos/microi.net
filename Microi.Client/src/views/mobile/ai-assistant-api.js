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
