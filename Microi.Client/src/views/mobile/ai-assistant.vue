<template>
    <div
        class="mobile-ai-page"
        :class="{ 'mobile-ai-page--embedded': embedded }"
        data-testid="mobile-ai-assistant"
    >
        <header class="mobile-ai-header">
            <div class="mobile-ai-header__row">
                <button
                    v-if="!embedded"
                    type="button"
                    class="mobile-ai-icon-button"
                    aria-label="返回"
                    @click="goBack"
                >
                    <el-icon><ArrowLeft /></el-icon>
                </button>
                <span v-else class="mobile-ai-icon-spacer" aria-hidden="true"></span>

                <div v-if="!embedded" class="mobile-ai-identity">
                    <span class="mobile-ai-identity__avatar" aria-hidden="true">
                        <img
                            src="/static/mci/ai/assistant-robot.png"
                            alt=""
                            data-testid="mobile-ai-avatar"
                        />
                        <i></i>
                    </span>
                    <span class="mobile-ai-identity__copy">
                        <strong>{{ assistantName }}</strong>
                        <small>{{ headerScopeText }}</small>
                    </span>
                </div>
                <div v-else class="mobile-ai-embedded-scope">
                    <strong>数据权限</strong>
                    <small>{{ headerScopeText }}</small>
                </div>

                <div class="mobile-ai-header__actions">
                    <button
                        v-if="isAuthenticated && ready && enabled"
                        type="button"
                        class="mobile-ai-icon-button"
                        aria-label="对话记录"
                        data-testid="mobile-ai-history"
                        @click="openHistory"
                    >
                        <el-icon><Clock /></el-icon>
                    </button>
                    <button
                        v-if="isAuthenticated && ready && enabled"
                        type="button"
                        class="mobile-ai-icon-button"
                        aria-label="新建对话"
                        data-testid="mobile-ai-new-conversation"
                        @click="startNewConversation"
                    >
                        <el-icon><Plus /></el-icon>
                    </button>
                </div>
            </div>
        </header>

        <main v-if="!isAuthenticated" class="mobile-ai-state">
            <span class="mobile-ai-state__icon"><el-icon><Lock /></el-icon></span>
            <h1>登录后使用 AI 数据分析</h1>
            <p>AI 助手会严格按照当前账号角色和数据权限回答，登录前不读取任何业务数据。</p>
            <button type="button" class="mobile-ai-primary-button" @click="goLogin">去登录</button>
        </main>

        <main v-else-if="!ready" class="mobile-ai-skeleton" aria-label="AI助手加载中">
            <div v-for="index in 5" :key="index" class="mobile-ai-skeleton__card">
                <span></span><span></span>
            </div>
        </main>

        <main v-else-if="!enabled" class="mobile-ai-state">
            <span class="mobile-ai-state__icon"><el-icon><Warning /></el-icon></span>
            <h1>{{ unavailableTitle }}</h1>
            <p>{{ unavailableDescription }}</p>
            <button type="button" class="mobile-ai-secondary-button" @click="goBack">返回</button>
        </main>

        <main v-else class="mobile-ai-workspace">
            <div class="mobile-ai-disclosure" role="note">
                <strong>AI</strong>
                <span>内容由人工智能生成，请注意甄别</span>
            </div>

            <section class="mobile-ai-toolbar" aria-label="AI模型设置">
                <label class="mobile-ai-field">
                    <span>模型通道</span>
                    <el-select
                        v-model="selectedModelId"
                        data-testid="mobile-ai-model"
                        placeholder="选择模型通道"
                        :teleported="false"
                    >
                        <el-option
                            v-for="model in models"
                            :key="model.Id"
                            :label="formatMobileAiModelName(model)"
                            :value="model.Id"
                        />
                    </el-select>
                </label>

                <label v-if="relayOptions.length" class="mobile-ai-field">
                    <span>运行模型</span>
                    <el-select
                        v-model="selectedRelayId"
                        data-testid="mobile-ai-relay-model"
                        placeholder="选择运行模型"
                        :teleported="false"
                    >
                        <el-option
                            v-for="model in relayOptions"
                            :key="model.Id"
                            :label="formatMobileAiRelayName(model)"
                            :value="model.Id"
                        />
                    </el-select>
                </label>

                <label class="mobile-ai-field mobile-ai-field--reasoning">
                    <span>推理强度</span>
                    <el-select
                        v-model="reasoningEffort"
                        data-testid="mobile-ai-reasoning"
                        :disabled="!supportsReasoning"
                        :teleported="false"
                    >
                        <el-option
                            v-for="item in reasoningOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
                    <small v-if="!supportsReasoning" class="mobile-ai-field__hint">当前模型不支持调节，将使用自动模式</small>
                </label>
            </section>

            <section v-if="conversationId" class="mobile-ai-conversation-bar">
                <span>
                    <small>当前对话</small>
                    <strong>{{ conversationTitle }}</strong>
                </span>
                <button
                    type="button"
                    data-testid="mobile-ai-current-rename"
                    @click="requestRename({ Id: conversationId, Title: conversationTitle })"
                >
                    <el-icon><EditPen /></el-icon>改名
                </button>
            </section>

            <section ref="messageList" class="mobile-ai-messages" aria-live="polite">
                <div class="mobile-ai-welcome">
                    <span><i></i>安全分析通道已连接</span>
                    <h1>你好，我已准备好分析你的业务数据</h1>
                    <p>查询范围由当前租户、角色和数据权限共同决定。</p>
                </div>

                <div v-if="!messages.length && prompts.length" class="mobile-ai-prompts">
                    <button v-for="prompt in prompts" :key="prompt" type="button" @click="usePrompt(prompt)">
                        <span>{{ prompt }}</span><b>›</b>
                    </button>
                </div>

                <article
                    v-for="(message, index) in messages"
                    :key="message.id"
                    class="mobile-ai-message"
                    :class="`mobile-ai-message--${message.role}`"
                >
                    <div class="mobile-ai-bubble">
                        <div v-if="message.loading" class="mobile-ai-thinking-live">
                            <i></i><i></i><i></i><span>正在思考</span>
                        </div>
                        <p v-else>{{ message.text }}</p>

                        <div v-if="message.thinking?.length" class="mobile-ai-thinking">
                            <button type="button" @click="toggleThinking(index)">
                                <span>{{ message.thinkingOpen ? '收起思考过程' : '查看思考过程' }}</span>
                                <b :class="{ open: message.thinkingOpen }">⌄</b>
                            </button>
                            <ol v-if="message.thinkingOpen">
                                <li v-for="(step, stepIndex) in message.thinking" :key="`${message.id}-${stepIndex}`">
                                    <i>{{ stepIndex + 1 }}</i><span>{{ step }}</span>
                                </li>
                            </ol>
                        </div>

                        <button
                            v-if="!message.loading && message.role === 'assistant' && message.text"
                            type="button"
                            class="mobile-ai-copy"
                            @click="copyAnswer(message.text)"
                        >
                            <el-icon><CopyDocument /></el-icon>复制
                        </button>
                    </div>
                </article>
            </section>

            <form class="mobile-ai-composer" @submit.prevent="sendQuestion">
                <el-input
                    v-model="question"
                    type="textarea"
                    :maxlength="500"
                    :autosize="{ minRows: 1, maxRows: 4 }"
                    :disabled="sending"
                    resize="none"
                    placeholder="询问客户、合同、跟进、售后或设备数据"
                    data-testid="mobile-ai-input"
                    @keydown.enter.exact.prevent="sendQuestion"
                />
                <button
                    type="submit"
                    class="mobile-ai-send"
                    data-testid="mobile-ai-send"
                    :disabled="!canSend"
                    aria-label="发送"
                >
                    <el-icon v-if="sending" class="mobile-ai-spin"><Loading /></el-icon>
                    <el-icon v-else><Promotion /></el-icon>
                </button>
            </form>
        </main>

        <Transition name="mobile-ai-drawer">
            <div v-if="historyVisible" class="mobile-ai-history-mask" @click="closeHistory">
                <aside class="mobile-ai-history-panel" aria-label="AI对话记录" @click.stop>
                    <header>
                        <span><strong>对话记录</strong><small>仅显示当前账号的会话</small></span>
                        <button type="button" aria-label="关闭对话记录" @click="closeHistory">
                            <el-icon><Close /></el-icon>
                        </button>
                    </header>

                    <button type="button" class="mobile-ai-history-create" @click="startNewConversation">
                        <el-icon><Plus /></el-icon><span>新建 AI 对话</span>
                    </button>

                    <div class="mobile-ai-history-tabs">
                        <button type="button" :class="{ active: historyTab === 'current' }" @click="historyTab = 'current'">AI 对话</button>
                        <button type="button" :class="{ active: historyTab === 'archived' }" @click="historyTab = 'archived'">已归档</button>
                    </div>

                    <el-input v-model="historyQuery" clearable placeholder="搜索对话标题" :prefix-icon="Search" />

                    <div class="mobile-ai-history-list">
                        <div v-if="historyLoading" class="mobile-ai-history-empty">正在读取对话记录…</div>
                        <div v-else-if="!filteredConversations.length" class="mobile-ai-history-empty">
                            {{ historyTab === 'archived' ? '暂无已归档对话' : '暂无对话记录' }}
                        </div>
                        <template v-else>
                            <article
                                v-for="item in filteredConversations"
                                :key="item.Id"
                                class="mobile-ai-history-item"
                                :class="{ active: item.Id === conversationId }"
                                :data-testid="`mobile-ai-conversation-${item.Id}`"
                                @click="selectConversation(item)"
                            >
                                <span>
                                    <strong>{{ item.Title || '新对话' }}</strong>
                                    <small>{{ formatHistoryMeta(item) }}</small>
                                </span>
                                <div>
                                    <button
                                        type="button"
                                        :data-testid="`mobile-ai-rename-${item.Id}`"
                                        @click.stop="requestRename(item)"
                                    >改名</button>
                                    <button
                                        type="button"
                                        :data-testid="`mobile-ai-${item.Archived ? 'restore' : 'archive'}-${item.Id}`"
                                        :disabled="historyActionId === item.Id"
                                        @click.stop="toggleArchive(item, !item.Archived)"
                                    >{{ item.Archived ? '还原' : '归档' }}</button>
                                </div>
                            </article>
                        </template>
                    </div>
                </aside>
            </div>
        </Transition>

        <el-dialog
            v-model="renameVisible"
            title="修改对话标题"
            width="min(420px, calc(100vw - 32px))"
            append-to-body
            align-center
            draggable
            class="mobile-ai-rename-dialog"
        >
            <el-input
                v-model="renameTitle"
                maxlength="60"
                show-word-limit
                autofocus
                data-testid="mobile-ai-rename-input"
                placeholder="请输入对话标题"
                @keyup.enter="confirmRename"
            />
            <template #footer>
                <el-button @click="cancelRename">取消</el-button>
                <el-button type="primary" data-testid="mobile-ai-rename-save" :loading="renameSaving" @click="confirmRename">保存</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
    ArrowLeft,
    Clock,
    Close,
    CopyDocument,
    EditPen,
    Loading,
    Lock,
    Plus,
    Promotion,
    Search,
    Warning
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { useDiyStore } from "@/pinia";
import { DiyCommon } from "@/utils/diy.common";
import { isMobileAiAssistantEnabled } from "@/components/MobileTabBar/mobile-ai-entry.js";
import {
    MOBILE_AI_BOOTSTRAP_FAILURES,
    clearMobileAiBootstrapCache,
    classifyMobileAiBootstrapFailure,
    formatMobileAiModelName,
    formatMobileAiRelayName,
    isMobileAiRelayStation,
    listMobileAiConversations,
    listMobileAiMessages,
    loadMobileAiBootstrap,
    makeMobileAiBootstrapFailure,
    makeMobileAiId,
    mobileAiModelSupportsReasoning,
    newMobileAiConversation,
    normalizeMobileAiMessages,
    renameMobileAiConversation,
    sendMobileAiQuestion,
    setMobileAiConversationArchived
} from "./ai-assistant-api.js";

defineOptions({ name: "mobile_ai_assistant" });

const props = defineProps({
    embedded: { type: Boolean, default: false }
});
const emit = defineEmits(["close"]);
const embedded = computed(() => props.embedded);

const router = useRouter();
const route = useRoute();
const diyStore = useDiyStore();
const currentUser = computed(() => diyStore.GetCurrentUser || {});
const isAuthenticated = computed(() => Boolean((diyStore.Token || DiyCommon.getToken?.()) && currentUser.value.Id));
const featureEnabled = computed(() => isMobileAiAssistantEnabled(diyStore.SysConfig));
const assistantName = "AI助手";

const ready = ref(false);
const enabled = ref(false);
const bootstrapFailure = ref(null);
const scopeLabel = ref("");
const roleText = ref("");
const models = ref([]);
const relayModels = ref([]);
const prompts = ref([]);
const selectedModelId = ref("");
const selectedRelayId = ref("");
const reasoningEffort = ref("auto");
const reasoningOptions = [
    { value: "auto", label: "自动推理" },
    { value: "low", label: "简洁推理" },
    { value: "medium", label: "标准推理" },
    { value: "high", label: "深度推理" }
];

const question = ref("");
const sending = ref(false);
const messages = ref([]);
const messageList = ref(null);
const conversationId = ref("");
const conversationTitle = ref("新对话");

const historyVisible = ref(false);
const historyLoading = ref(false);
const historyLoaded = ref(false);
const historyTab = ref("current");
const historyQuery = ref("");
const conversations = ref([]);
const historyActionId = ref("");

const renameVisible = ref(false);
const renameTarget = ref(null);
const renameTitle = ref("");
const renameSaving = ref(false);

let progressTimer = null;
let sessionGeneration = 0;

function nextSessionGeneration() {
    sessionGeneration += 1;
    return sessionGeneration;
}

function isCurrentSession(generation) {
    return generation === sessionGeneration;
}

const selectedModel = computed(() => models.value.find((item) => String(item.Id) === String(selectedModelId.value)) || null);
const relayOptions = computed(() => isMobileAiRelayStation(selectedModel.value) ? relayModels.value : []);
const selectedRelay = computed(() => relayModels.value.find((item) => String(item.Id) === String(selectedRelayId.value)) || null);
const supportsReasoning = computed(() => mobileAiModelSupportsReasoning(selectedModel.value, selectedRelay.value?.Id || ""));
const canSend = computed(() => {
    const relayReady = !isMobileAiRelayStation(selectedModel.value) || Boolean(selectedRelay.value);
    return !sending.value && !historyLoading.value && Boolean(question.value.trim()) && Boolean(selectedModel.value) && relayReady;
});
const headerScopeText = computed(() => {
    if (!isAuthenticated.value) return "登录后启用 · 匿名状态不读取数据";
    if (!ready.value) return "正在校验账号与数据权限";
    if (!enabled.value) return featureEnabled.value
        ? (bootstrapFailure.value?.header || "当前角色未授权")
        : "系统未开启";
    return `${scopeLabel.value || roleText.value || "当前角色"} · 数据权限已校验`;
});
const unavailableTitle = computed(() => {
    if (!featureEnabled.value) return "当前系统未开启 AI助手";
    return bootstrapFailure.value?.title || "当前角色暂未开通 AI助手";
});
const unavailableDescription = computed(() => {
    if (!featureEnabled.value) return "请联系管理员开启 AI助手功能。";
    return bootstrapFailure.value?.description || "请联系管理员配置可用模型、业务域和数据范围。";
});
const filteredConversations = computed(() => {
    const archived = historyTab.value === "archived";
    const keyword = historyQuery.value.trim().toLowerCase();
    return conversations.value.filter((item) => {
        const stateMatches = Boolean(item.Archived) === archived;
        const keywordMatches = !keyword || String(item.Title || "").toLowerCase().includes(keyword);
        return stateMatches && keywordMatches;
    });
});

function selectionStorageKey() {
    return `mci_mobile_ai_selection:${DiyCommon.GetOsClient?.() || "default"}:${currentUser.value.Id || "anonymous"}`;
}

function restoreSelections() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(selectionStorageKey()) || "{}");
    } catch (error) {}
    selectedModelId.value = models.value.some((item) => String(item.Id) === String(saved.modelId))
        ? saved.modelId
        : (models.value[0]?.Id || "");
    selectedRelayId.value = relayModels.value.some((item) => String(item.Id) === String(saved.relayModel))
        ? saved.relayModel
        : (relayModels.value[0]?.Id || "");
    reasoningEffort.value = reasoningOptions.some((item) => item.value === saved.reasoningEffort)
        ? saved.reasoningEffort
        : "auto";
}

function saveSelections() {
    try {
        localStorage.setItem(selectionStorageKey(), JSON.stringify({
            modelId: selectedModelId.value,
            relayModel: selectedRelayId.value,
            reasoningEffort: reasoningEffort.value
        }));
    } catch (error) {}
}

watch(selectedModelId, () => {
    if (isMobileAiRelayStation(selectedModel.value) && !relayOptions.value.some((item) => item.Id === selectedRelayId.value)) {
        selectedRelayId.value = relayOptions.value[0]?.Id || "";
    }
    if (!supportsReasoning.value) reasoningEffort.value = "auto";
    saveSelections();
});
watch(selectedRelayId, () => {
    if (!supportsReasoning.value) reasoningEffort.value = "auto";
    saveSelections();
});
watch(reasoningEffort, saveSelections);

async function loadBootstrap(force = false, generation = sessionGeneration) {
    ready.value = false;
    enabled.value = false;
    bootstrapFailure.value = null;
    if (!isAuthenticated.value) {
        ready.value = true;
        return;
    }
    if (!featureEnabled.value) {
        ready.value = true;
        return;
    }
    try {
        if (force) clearMobileAiBootstrapCache();
        const data = await loadMobileAiBootstrap(DiyCommon, currentUser.value.Id, force);
        if (!isCurrentSession(generation)) return;
        enabled.value = data.Enabled === true || Number(data.Enabled) === 1;
        scopeLabel.value = data.ScopeLabel || "当前角色";
        roleText.value = data.RoleText || "已授权用户";
        models.value = Array.isArray(data.Models) ? data.Models : [];
        relayModels.value = Array.isArray(data.RelayModels) ? data.RelayModels : [];
        prompts.value = Array.isArray(data.Prompts) ? data.Prompts : [];
        restoreSelections();
        if (!enabled.value) {
            bootstrapFailure.value = makeMobileAiBootstrapFailure(MOBILE_AI_BOOTSTRAP_FAILURES.unauthorized);
        } else if (!models.value.length) {
            enabled.value = false;
            bootstrapFailure.value = makeMobileAiBootstrapFailure(MOBILE_AI_BOOTSTRAP_FAILURES.modelMissing);
        }
    } catch (error) {
        if (!isCurrentSession(generation)) return;
        bootstrapFailure.value = classifyMobileAiBootstrapFailure(error);
        enabled.value = false;
    } finally {
        if (isCurrentSession(generation)) ready.value = true;
    }
}

function resetAssistantSession() {
    clearProgress();
    scopeLabel.value = "";
    roleText.value = "";
    models.value = [];
    relayModels.value = [];
    prompts.value = [];
    messages.value = [];
    question.value = "";
    conversationId.value = "";
    conversationTitle.value = "新对话";
    conversations.value = [];
    historyLoaded.value = false;
    historyLoading.value = false;
    historyActionId.value = "";
    historyQuery.value = "";
    historyVisible.value = false;
    renameVisible.value = false;
    renameTarget.value = null;
    renameTitle.value = "";
    renameSaving.value = false;
    sending.value = false;
}

function goBack() {
    if (renameVisible.value) return cancelRename();
    if (historyVisible.value) return closeHistory();
    if (embedded.value) {
        emit("close");
        return;
    }
    router.back();
}

function goLogin() {
    router.push({ path: "/login", query: { redirect: route.fullPath } });
}

function scrollToBottom() {
    nextTick(() => {
        if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight;
    });
}

function clearProgress() {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
}

function beginProgress(message) {
    const steps = [
        "正在验证角色与数据权限",
        "正在应用租户和业务范围",
        "正在汇总授权业务数据",
        "正在等待所选模型生成结论"
    ];
    let cursor = 0;
    message.thinking = [steps[0]];
    progressTimer = setInterval(() => {
        cursor += 1;
        if (cursor < steps.length && message.loading) {
            message.thinking.push(steps[cursor]);
            scrollToBottom();
        } else {
            clearProgress();
        }
    }, 1100);
}

function usePrompt(prompt) {
    if (sending.value) return;
    question.value = prompt;
    sendQuestion();
}

function toggleThinking(index) {
    if (messages.value[index]) messages.value[index].thinkingOpen = !messages.value[index].thinkingOpen;
}

async function copyAnswer(text) {
    try {
        await navigator.clipboard.writeText(String(text || ""));
        ElMessage.success("已复制");
    } catch (error) {
        const textarea = document.createElement("textarea");
        textarea.value = String(text || "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        copied ? ElMessage.success("已复制") : ElMessage.error("复制失败");
    }
}

async function sendQuestion() {
    if (!canSend.value) return;
    const generation = sessionGeneration;
    const content = question.value.trim();
    question.value = "";
    sending.value = true;
    const userMessage = { id: makeMobileAiId("user"), role: "user", text: content, loading: false, thinking: [] };
    const answerMessage = { id: makeMobileAiId("assistant"), role: "assistant", text: "", loading: true, thinking: [], thinkingOpen: true };
    messages.value.push(userMessage, answerMessage);
    beginProgress(answerMessage);
    scrollToBottom();
    try {
        const data = await sendMobileAiQuestion(DiyCommon, {
            Question: content,
            AiModelId: selectedModel.value.Id,
            RelayModel: isMobileAiRelayStation(selectedModel.value) ? selectedRelay.value?.Id || "" : "",
            ReasoningEffort: supportsReasoning.value ? reasoningEffort.value : "auto",
            ConversationId: conversationId.value,
            RequestId: makeMobileAiId("request"),
            Title: conversationId.value ? conversationTitle.value : content
        });
        if (!isCurrentSession(generation)) return;
        answerMessage.loading = false;
        answerMessage.text = data.Answer || "暂未获得分析结果";
        answerMessage.thinking = Array.isArray(data.Thinking) ? data.Thinking.map(String) : answerMessage.thinking;
        answerMessage.thinkingOpen = false;
        conversationId.value = String(data.ConversationId || conversationId.value);
        conversationTitle.value = data.Title || conversationTitle.value || content.slice(0, 36);
        historyLoaded.value = false;
        refreshHistory();
    } catch (error) {
        if (!isCurrentSession(generation)) return;
        answerMessage.loading = false;
        answerMessage.text = error.message || "分析服务暂时不可用，请稍后重试";
        answerMessage.thinkingOpen = false;
    } finally {
        if (isCurrentSession(generation)) {
            clearProgress();
            sending.value = false;
            scrollToBottom();
        }
    }
}

function startNewConversation() {
    nextSessionGeneration();
    const empty = newMobileAiConversation();
    clearProgress();
    messages.value = empty.Messages;
    question.value = "";
    conversationId.value = empty.ConversationId;
    conversationTitle.value = empty.Title;
    historyVisible.value = false;
    historyLoading.value = false;
    historyActionId.value = "";
    renameVisible.value = false;
    renameSaving.value = false;
    sending.value = false;
    scrollToBottom();
}

function openHistory() {
    historyVisible.value = true;
    refreshHistory(true);
}

function closeHistory() {
    historyVisible.value = false;
}

async function refreshHistory(force = false) {
    if (historyLoading.value || (historyLoaded.value && !force)) return;
    const generation = sessionGeneration;
    historyLoading.value = true;
    try {
        const data = await listMobileAiConversations(DiyCommon);
        if (!isCurrentSession(generation)) return;
        conversations.value = Array.isArray(data.Conversations) ? data.Conversations : [];
        historyLoaded.value = true;
    } catch (error) {
        if (!isCurrentSession(generation)) return;
        if (force) ElMessage.error(error.message || "对话记录加载失败");
    } finally {
        if (isCurrentSession(generation)) historyLoading.value = false;
    }
}

async function selectConversation(item) {
    if (!item?.Id || historyLoading.value) return;
    const generation = nextSessionGeneration();
    clearProgress();
    sending.value = false;
    historyActionId.value = "";
    renameSaving.value = false;
    renameVisible.value = false;
    historyLoading.value = true;
    try {
        const data = await listMobileAiMessages(DiyCommon, item.Id);
        if (!isCurrentSession(generation)) return;
        messages.value = normalizeMobileAiMessages(data);
        conversationId.value = String(item.Id);
        conversationTitle.value = item.Title || "新对话";
        historyVisible.value = false;
        scrollToBottom();
    } catch (error) {
        if (!isCurrentSession(generation)) return;
        ElMessage.error(error.message || "对话加载失败");
    } finally {
        if (isCurrentSession(generation)) historyLoading.value = false;
    }
}

function requestRename(item) {
    renameTarget.value = item;
    renameTitle.value = String(item?.Title || "");
    renameVisible.value = true;
}

function cancelRename() {
    renameVisible.value = false;
    renameTarget.value = null;
    renameTitle.value = "";
}

async function confirmRename() {
    const target = renameTarget.value;
    const title = renameTitle.value.trim();
    if (!target?.Id || !title || renameSaving.value) {
        if (!title) ElMessage.warning("请输入对话标题");
        return;
    }
    const generation = sessionGeneration;
    renameSaving.value = true;
    try {
        await renameMobileAiConversation(DiyCommon, target.Id, title);
        if (!isCurrentSession(generation)) return;
        conversations.value.forEach((item) => {
            if (item.Id === target.Id) item.Title = title;
        });
        if (conversationId.value === target.Id) conversationTitle.value = title;
        cancelRename();
        ElMessage.success("标题已更新");
    } catch (error) {
        if (!isCurrentSession(generation)) return;
        ElMessage.error(error.message || "标题更新失败");
    } finally {
        if (isCurrentSession(generation)) renameSaving.value = false;
    }
}

async function toggleArchive(item, archived) {
    if (!item?.Id || historyActionId.value) return;
    const generation = sessionGeneration;
    historyActionId.value = item.Id;
    try {
        await setMobileAiConversationArchived(DiyCommon, item.Id, archived);
        if (!isCurrentSession(generation)) return;
        item.Archived = archived;
        if (archived && item.Id === conversationId.value) startNewConversation();
        ElMessage.success(archived ? "已归档" : "已还原");
    } catch (error) {
        if (!isCurrentSession(generation)) return;
        ElMessage.error(error.message || "操作失败");
    } finally {
        if (isCurrentSession(generation)) historyActionId.value = "";
    }
}

function formatHistoryMeta(item) {
    const count = Number(item.MessageCount || 0);
    const time = String(item.LastTime || "").replace("T", " ").slice(0, 16);
    return `${time || "刚刚"} · ${count} 条消息`;
}

watch(
    () => `${diyStore.OsClient || DiyCommon.GetOsClient?.() || ""}:${isAuthenticated.value}:${currentUser.value.Id || ""}:${featureEnabled.value}`,
    (identity, previousIdentity) => {
        const generation = nextSessionGeneration();
        resetAssistantSession();
        loadBootstrap(previousIdentity !== undefined, generation);
    },
    { immediate: true }
);
onBeforeUnmount(() => {
    nextSessionGeneration();
    clearProgress();
});
</script>

<style lang="scss" scoped>
.mobile-ai-page {
    --mobile-ai-header: #063f59;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    color: var(--mci-text-primary);
    background: var(--mci-bg-base);
}

.mobile-ai-page--embedded {
    position: relative;
    height: 100%;
    min-height: 0;
}

.mobile-ai-page--embedded .mobile-ai-header {
    padding-top: 0;
}

.mobile-ai-page--embedded .mobile-ai-history-mask {
    position: absolute;
}

.mobile-ai-page--embedded .mobile-ai-history-panel {
    padding-top: 12px;
    padding-right: 14px;
    padding-bottom: 14px;
}

button { font: inherit; }

.mobile-ai-header {
    flex: none;
    padding: var(--mci-safe-top) max(10px, var(--mci-safe-right)) 0 max(10px, var(--mci-safe-left));
    color: #fff;
    background:
        linear-gradient(rgba(96, 219, 229, 0.11) 1px, transparent 1px),
        linear-gradient(90deg, rgba(96, 219, 229, 0.08) 1px, transparent 1px),
        var(--mobile-ai-header);
    background-size: 24px 24px;
    box-shadow: var(--mci-shadow-md);
    z-index: 4;
}

.mobile-ai-header__row {
    min-height: 64px;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
}

.mobile-ai-icon-button {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 50%;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
}
.mobile-ai-icon-button:active { transform: scale(0.94); }
.mobile-ai-icon-spacer { width: 44px; height: 44px; }

.mobile-ai-embedded-scope {
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.mobile-ai-embedded-scope strong { font-size: 13px; line-height: 20px; }
.mobile-ai-embedded-scope small {
    overflow: hidden;
    color: rgba(255, 255, 255, 0.72);
    font-size: 11px;
    line-height: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mobile-ai-identity { min-width: 0; display: flex; align-items: center; gap: 10px; }
.mobile-ai-identity__avatar {
    position: relative;
    flex: none;
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    color: var(--mci-color-primary);
    background: #fff;
    font-size: 25px;
}
.mobile-ai-identity__avatar img {
    width: 36px;
    height: 36px;
    display: block;
    object-fit: contain;
}
.mobile-ai-identity__avatar i {
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 9px;
    height: 9px;
    border: 2px solid var(--mobile-ai-header);
    border-radius: 50%;
    background: var(--mci-color-success);
}
.mobile-ai-identity__copy { min-width: 0; display: flex; flex-direction: column; }
.mobile-ai-identity__copy strong { overflow: hidden; font-size: 16px; line-height: 22px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-ai-identity__copy small { overflow: hidden; color: rgba(255, 255, 255, 0.72); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-ai-header__actions { display: flex; gap: 6px; }

.mobile-ai-state {
    flex: 1;
    min-height: 0;
    padding: 28px max(24px, var(--mci-safe-right)) calc(28px + var(--mci-safe-bottom)) max(24px, var(--mci-safe-left));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
}
.mobile-ai-state__icon {
    width: 64px;
    height: 64px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 20px;
    color: var(--mci-color-primary);
    background: var(--mci-bg-elevated);
    box-shadow: var(--mci-shadow-card);
    font-size: 30px;
}
.mobile-ai-state h1 { margin: 22px 0 0; font-size: 20px; }
.mobile-ai-state p { max-width: 440px; margin: 12px 0 24px; color: var(--mci-text-secondary); font-size: 14px; line-height: 1.7; }
.mobile-ai-primary-button,
.mobile-ai-secondary-button {
    min-width: 136px;
    min-height: 44px;
    padding: 0 22px;
    border-radius: var(--mci-shape-button, var(--mci-radius-md));
    cursor: pointer;
}
.mobile-ai-primary-button { border: 0; color: var(--mci-text-on-primary); background: var(--mci-gradient-primary); box-shadow: var(--mci-shadow-button); }
.mobile-ai-secondary-button { border: 1px solid var(--mci-border-color); color: var(--mci-text-primary); background: var(--mci-bg-elevated); }

.mobile-ai-skeleton { flex: 1; min-height: 0; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.mobile-ai-skeleton__card { padding: 18px; border-radius: var(--mci-radius-lg); background: var(--mci-bg-card); }
.mobile-ai-skeleton__card span { display: block; height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--mci-bg-surface), var(--mci-bg-card-hover), var(--mci-bg-surface)); background-size: 220% 100%; animation: mobileAiSkeleton 1.15s ease-in-out infinite; }
.mobile-ai-skeleton__card span:first-child { width: 42%; margin-bottom: 12px; }

.mobile-ai-workspace { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.mobile-ai-disclosure {
    flex: none;
    min-height: 32px;
    padding: 5px max(14px, var(--mci-safe-right)) 5px max(14px, var(--mci-safe-left));
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--mci-text-secondary);
    background: var(--mci-bg-elevated);
    border-bottom: 1px solid var(--mci-border-color);
    font-size: 11px;
}
.mobile-ai-disclosure strong { padding: 2px 6px; border-radius: 999px; color: var(--mci-text-on-primary); background: var(--mci-color-primary); font-size: 9px; }

.mobile-ai-toolbar {
    flex: none;
    padding: 9px max(12px, var(--mci-safe-right)) 9px max(12px, var(--mci-safe-left));
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    border-bottom: 1px solid var(--mci-border-color);
    background: var(--mci-bg-elevated);
}
.mobile-ai-field { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.mobile-ai-field > span { color: var(--mci-text-tertiary); font-size: 10px; }
.mobile-ai-field__hint { color: var(--mci-text-tertiary); font-size: 10px; line-height: 1.35; }
.mobile-ai-field--reasoning { grid-column: 1 / -1; }
.mobile-ai-field :deep(.el-select) { width: 100%; }
.mobile-ai-field :deep(.el-select__wrapper) { min-height: 36px; border-radius: var(--mci-shape-input, var(--mci-radius-sm)); background: var(--mci-bg-surface); box-shadow: 0 0 0 1px var(--mci-border-color) inset; }

.mobile-ai-conversation-bar {
    flex: none;
    min-height: 50px;
    padding: 7px max(14px, var(--mci-safe-right)) 7px max(14px, var(--mci-safe-left));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid var(--mci-border-color);
    background: var(--mci-bg-card);
}
.mobile-ai-conversation-bar > span { min-width: 0; display: flex; flex-direction: column; }
.mobile-ai-conversation-bar small { color: var(--mci-text-tertiary); font-size: 10px; }
.mobile-ai-conversation-bar strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-ai-conversation-bar button { min-height: 36px; padding: 0 10px; display: inline-flex; align-items: center; gap: 4px; border: 0; color: var(--mci-color-primary); background: transparent; cursor: pointer; }

.mobile-ai-messages { flex: 1; min-height: 0; overflow-y: auto; padding: 14px max(14px, var(--mci-safe-right)) 20px max(14px, var(--mci-safe-left)); scroll-behavior: smooth; }
.mobile-ai-welcome { padding: 18px; border: 1px solid var(--mci-border-color); border-radius: var(--mci-radius-lg); background: var(--mci-bg-card); box-shadow: var(--mci-shadow-card); }
.mobile-ai-welcome > span { display: flex; align-items: center; gap: 6px; color: var(--mci-color-success); font-size: 11px; }
.mobile-ai-welcome > span i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.mobile-ai-welcome h1 { margin: 10px 0 0; font-size: 17px; line-height: 1.45; }
.mobile-ai-welcome p { margin: 7px 0 0; color: var(--mci-text-secondary); font-size: 12px; line-height: 1.6; }
.mobile-ai-prompts { margin-top: 12px; display: grid; gap: 8px; }
.mobile-ai-prompts button { min-height: 48px; padding: 0 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--mci-border-color); border-radius: var(--mci-radius-md); color: var(--mci-text-primary); background: var(--mci-bg-elevated); text-align: left; cursor: pointer; }
.mobile-ai-prompts button:active { transform: scale(0.98); }
.mobile-ai-prompts b { color: var(--mci-color-primary); font-size: 23px; }

.mobile-ai-message { margin-top: 14px; display: flex; }
.mobile-ai-message--user { justify-content: flex-end; }
.mobile-ai-message--assistant { justify-content: flex-start; }
.mobile-ai-bubble { max-width: min(86%, 680px); padding: 12px 14px; border-radius: 16px; box-shadow: var(--mci-shadow-sm); }
.mobile-ai-message--user .mobile-ai-bubble { border-bottom-right-radius: 5px; color: var(--mci-text-on-primary); background: var(--mci-gradient-primary); }
.mobile-ai-message--assistant .mobile-ai-bubble { border: 1px solid var(--mci-border-color); border-bottom-left-radius: 5px; background: var(--mci-bg-elevated); }
.mobile-ai-bubble > p { margin: 0; font-size: 14px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.mobile-ai-thinking-live { min-height: 30px; display: flex; align-items: center; gap: 4px; color: var(--mci-text-secondary); font-size: 12px; }
.mobile-ai-thinking-live i { width: 5px; height: 5px; border-radius: 50%; background: var(--mci-color-primary); animation: mobileAiDot 1s ease-in-out infinite; }
.mobile-ai-thinking-live i:nth-child(2) { animation-delay: 0.14s; }
.mobile-ai-thinking-live i:nth-child(3) { animation-delay: 0.28s; }
.mobile-ai-thinking-live span { margin-left: 5px; }
.mobile-ai-thinking { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--mci-border-color); }
.mobile-ai-thinking > button { width: 100%; min-height: 34px; padding: 0; display: flex; align-items: center; justify-content: space-between; border: 0; color: var(--mci-text-secondary); background: transparent; cursor: pointer; font-size: 11px; }
.mobile-ai-thinking > button b { transition: transform var(--mci-duration-fast); }
.mobile-ai-thinking > button b.open { transform: rotate(180deg); }
.mobile-ai-thinking ol { margin: 4px 0 0; padding: 0; display: grid; gap: 7px; list-style: none; }
.mobile-ai-thinking li { display: flex; align-items: flex-start; gap: 8px; color: var(--mci-text-secondary); font-size: 11px; line-height: 1.5; }
.mobile-ai-thinking li i { flex: none; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--mci-color-primary); background: var(--mci-bg-surface); font-style: normal; }
.mobile-ai-copy { min-height: 34px; margin-top: 5px; padding: 0; display: inline-flex; align-items: center; gap: 4px; border: 0; color: var(--mci-text-tertiary); background: transparent; cursor: pointer; font-size: 11px; }

.mobile-ai-composer {
    flex: none;
    padding: 10px max(12px, var(--mci-safe-right)) calc(10px + var(--mci-safe-bottom)) max(12px, var(--mci-safe-left));
    display: flex;
    align-items: flex-end;
    gap: 8px;
    border-top: 1px solid var(--mci-border-color);
    background: var(--mci-bg-elevated);
    box-shadow: 0 -6px 20px rgba(15, 23, 42, 0.06);
}
.mobile-ai-composer :deep(.el-textarea) { flex: 1; }
.mobile-ai-composer :deep(.el-textarea__inner) { min-height: 44px !important; padding: 11px 12px; border-radius: var(--mci-shape-input, var(--mci-radius-md)); color: var(--mci-text-primary); background: var(--mci-bg-surface); box-shadow: 0 0 0 1px var(--mci-border-color) inset; }
.mobile-ai-send { flex: none; width: 46px; height: 46px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; color: var(--mci-text-on-primary); background: var(--mci-gradient-primary); box-shadow: var(--mci-shadow-button); cursor: pointer; font-size: 20px; }
.mobile-ai-send:disabled { opacity: 0.36; box-shadow: none; cursor: not-allowed; }
.mobile-ai-send:not(:disabled):active { transform: scale(0.94); }
.mobile-ai-spin { animation: mobileAiSpin 0.85s linear infinite; }

.mobile-ai-history-mask { position: fixed; inset: 0; z-index: 30; display: flex; justify-content: flex-end; background: var(--mci-bg-mask); }
.mobile-ai-history-panel { width: min(88vw, 390px); height: 100%; padding: calc(var(--mci-safe-top) + 12px) max(14px, var(--mci-safe-right)) calc(var(--mci-safe-bottom) + 14px) 14px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; color: var(--mci-text-primary); background: var(--mci-bg-elevated); box-shadow: var(--mci-shadow-dialog); }
.mobile-ai-history-panel > header { flex: none; min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.mobile-ai-history-panel > header > span { min-width: 0; display: flex; flex-direction: column; }
.mobile-ai-history-panel > header strong { font-size: 18px; }
.mobile-ai-history-panel > header small { color: var(--mci-text-tertiary); font-size: 11px; }
.mobile-ai-history-panel > header button { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; color: var(--mci-text-primary); background: var(--mci-bg-surface); cursor: pointer; }
.mobile-ai-history-create { flex: none; min-height: 46px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--mci-color-primary); border-radius: var(--mci-shape-button, var(--mci-radius-md)); color: var(--mci-color-primary); background: transparent; cursor: pointer; }
.mobile-ai-history-tabs { flex: none; min-height: 42px; display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--mci-border-color); }
.mobile-ai-history-tabs button { position: relative; border: 0; color: var(--mci-text-secondary); background: transparent; cursor: pointer; }
.mobile-ai-history-tabs button.active { color: var(--mci-color-primary); font-weight: 700; }
.mobile-ai-history-tabs button.active::after { content: ""; position: absolute; right: 28%; bottom: -1px; left: 28%; height: 3px; border-radius: 2px; background: var(--mci-color-primary); }
.mobile-ai-history-list { flex: 1; min-height: 0; overflow-y: auto; }
.mobile-ai-history-empty { min-height: 180px; display: flex; align-items: center; justify-content: center; color: var(--mci-text-tertiary); font-size: 13px; }
.mobile-ai-history-item { min-height: 72px; padding: 9px 5px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid var(--mci-border-color); cursor: pointer; }
.mobile-ai-history-item.active { background: var(--mci-bg-surface); }
.mobile-ai-history-item > span { min-width: 0; display: flex; flex-direction: column; }
.mobile-ai-history-item > span strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-ai-history-item > span small { margin-top: 4px; color: var(--mci-text-tertiary); font-size: 10px; }
.mobile-ai-history-item > div { flex: none; display: flex; }
.mobile-ai-history-item > div button { min-width: 44px; min-height: 44px; padding: 0 5px; border: 0; color: var(--mci-color-primary); background: transparent; cursor: pointer; font-size: 11px; }
.mobile-ai-history-item > div button:disabled { opacity: 0.45; }

.mobile-ai-drawer-enter-active,
.mobile-ai-drawer-leave-active { transition: opacity 0.2s ease; }
.mobile-ai-drawer-enter-active .mobile-ai-history-panel,
.mobile-ai-drawer-leave-active .mobile-ai-history-panel { transition: transform 0.24s var(--mci-ease-out); }
.mobile-ai-drawer-enter-from,
.mobile-ai-drawer-leave-to { opacity: 0; }
.mobile-ai-drawer-enter-from .mobile-ai-history-panel,
.mobile-ai-drawer-leave-to .mobile-ai-history-panel { transform: translateX(100%); }

@keyframes mobileAiSkeleton { from { background-position: 120% 0; } to { background-position: -120% 0; } }
@keyframes mobileAiDot { 0%, 100% { transform: translateY(0); opacity: 0.35; } 50% { transform: translateY(-3px); opacity: 1; } }
@keyframes mobileAiSpin { to { transform: rotate(360deg); } }

@media (min-width: 640px) {
    .mobile-ai-toolbar { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .mobile-ai-field--reasoning { grid-column: auto; }
}

@media (prefers-reduced-motion: reduce) {
    .mobile-ai-skeleton__card span,
    .mobile-ai-thinking-live i,
    .mobile-ai-spin { animation: none; }
    .mobile-ai-drawer-enter-active,
    .mobile-ai-drawer-leave-active,
    .mobile-ai-drawer-enter-active .mobile-ai-history-panel,
    .mobile-ai-drawer-leave-active .mobile-ai-history-panel { transition: none; }
}
</style>
