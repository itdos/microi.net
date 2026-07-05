<template>
    <div class="ai-engine-page" :class="{ 'is-app-workspace': activeWorkspace === 'apps' }">
        <aside class="ai-engine-sidebar">
            <div class="workspace-tabs" :class="{ 'single-tab': !isAiAdmin }">
                <button
                    type="button"
                    class="workspace-tab"
                    :class="{ active: activeWorkspace === 'chat' }"
                    @click="activeWorkspace = 'chat'"
                >
                    <el-icon><Cpu /></el-icon>
                    <span>AI对话</span>
                </button>
                <button
                    v-if="isAiAdmin"
                    type="button"
                    class="workspace-tab"
                    :class="{ active: activeWorkspace === 'apps' }"
                    @click="activeWorkspace = 'apps'"
                >
                    <el-icon><FolderOpened /></el-icon>
                    <span>AI应用</span>
                </button>
            </div>

            <template v-if="activeWorkspace === 'chat'">
                <div class="sidebar-actions">
                    <el-button class="new-chat-btn" :icon="EditPen" @click="newConversation">新建AI对话</el-button>
                    <el-input
                        v-model="historyKeyword"
                        clearable
                        :prefix-icon="Search"
                        placeholder="搜索历史"
                        size="small"
                    />
                </div>

                <div class="sidebar-section-title">AI对话</div>
                <div class="conversation-list" v-loading="historyLoading">
                    <button
                        v-for="item in filteredConversations"
                        :key="item.id"
                        type="button"
                        class="conversation-item"
                        :class="{ active: item.id === currentConversationId }"
                        @click="selectConversation(item)"
                    >
                        <span class="conversation-title">{{ item.title }}</span>
                        <small>{{ item.lastTime || "-" }}</small>
                    </button>
                    <el-empty
                        v-if="!filteredConversations.length && !historyLoading"
                        :image-size="70"
                        description="暂无聊天"
                    />
                </div>
            </template>

            <template v-else>
                <div class="app-sidebar-intro">
                    <strong>AI应用工坊</strong>
                    <p>在这里管理 AI 生成的 Web / UniApp 应用，直接查看源码、预览运行，并继续对话迭代。</p>
                </div>
            </template>
        </aside>

        <main class="ai-engine-main" :class="{ 'is-apps': activeWorkspace === 'apps' }">
            <header class="ai-engine-header">
                <div class="header-left">
                    <div v-if="activeWorkspace === 'apps'" class="header-workspace-switch">
                        <button type="button" @click="activeWorkspace = 'chat'">AI对话</button>
                        <button type="button" class="active" @click="activeWorkspace = 'apps'">AI应用</button>
                    </div>
                    <h2>{{ activeWorkspace === "apps" ? "AI应用" : "AI引擎" }}</h2>
                    <el-tag size="small" effect="plain">{{ osClient }}</el-tag>
                </div>
                <div class="header-tools">
                    <el-button class="store-link-btn" type="primary" plain :icon="ShoppingBag" @click="goMicroiStore">
                        应用商城
                    </el-button>
                    <el-button v-if="isAiAdmin" :icon="Grid" @click="openModelDrawer">AI引擎列表</el-button>
                </div>
            </header>

            <AiAppWorkbench
                v-if="activeWorkspace === 'apps' && isAiAdmin"
                class="inline-project-workbench"
                :selected-ai-model="selectedAiModel"
                :ai-models="aiModelList"
                :model-loading="modelLoading"
                @update:selected-ai-model="selectedAiModel = $event"
            />

            <template v-else>
            <section ref="messageWrapRef" class="message-wrap">
                <div v-if="messages.length === 0" class="empty-state">
                    <div class="empty-hero">
                        <span class="hero-kicker">AI引擎</span>
                        <h1>让 AI 直接进入你的业务现场</h1>
                        <p>描述目标即可连续对话，我会结合 Skills、MCP 建模能力和当前租户上下文，辅助你分析数据、编写 V8、创建低代码模块。</p>
                    </div>
                    <div class="platform-stats" v-loading="statsLoading">
                        <div v-for="stat in statCards" :key="stat.key" class="platform-stat">
                            <span>{{ stat.label }}</span>
                            <strong>{{ stat.value }}</strong>
                            <small>{{ stat.desc }}</small>
                        </div>
                    </div>
                    <div class="quick-prompts">
                        <button
                            v-for="prompt in quickPrompts"
                            :key="prompt.title"
                            type="button"
                            class="quick-prompt"
                            @click="useQuickPrompt(prompt)"
                        >
                            <el-icon><component :is="prompt.icon" /></el-icon>
                            <strong>{{ prompt.title }}</strong>
                            <span>{{ prompt.desc }}</span>
                        </button>
                    </div>
                </div>

                <div v-else class="message-list">
                    <article
                        v-for="message in messages"
                        :key="message.id"
                        class="message"
                        :class="'is-' + message.role"
                    >
                        <div class="message-avatar">
                            <img v-if="message.role === 'user' && currentUserAvatar" :src="currentUserAvatar" alt="" />
                            <el-icon v-else-if="message.role === 'user'"><User /></el-icon>
                            <el-icon v-else><Cpu /></el-icon>
                        </div>
                        <div class="message-body">
                            <div class="message-meta">
                                <strong>{{ message.role === "user" ? currentUserName : "AI引擎" }}</strong>
                                <span>{{ message.time }}</span>
                                <el-tag v-if="message.modelId" size="small" effect="plain">{{ message.modelId }}</el-tag>
                                <el-tag v-if="message.mode" size="small" effect="plain">{{ modeName(message.mode) }}</el-tag>
                                <button
                                    v-if="message.role === 'assistant' && (message.content || message.code)"
                                    type="button"
                                    class="message-copy-btn"
                                    @click="copyText([message.content, message.code].filter(Boolean).join('\n\n'))"
                                >
                                    <el-icon><CopyDocument /></el-icon>
                                    复制
                                </button>
                            </div>

                            <div v-if="message.thinking" class="message-thinking">
                                <button
                                    type="button"
                                    class="thinking-toggle"
                                    @click="message.thinkingCollapsed = !message.thinkingCollapsed"
                                >
                                    <el-icon><Cpu /></el-icon>
                                    <span>思考过程</span>
                                    <small>{{ thinkingParagraphCount(message.thinking) }} 段</small>
                                </button>
                                <pre v-show="!message.thinkingCollapsed" class="thinking-content">{{ message.thinking }}</pre>
                            </div>

                            <div v-if="message.role === 'assistant' && message.streaming && !message.content && !message.thinking" class="thinking-placeholder">
                                <span class="thinking-dot"></span>
                                <span class="thinking-dot"></span>
                                <span class="thinking-dot"></span>
                                <em>正在思考</em>
                            </div>

                            <pre v-if="message.content" class="message-text" :class="{ streaming: message.streaming }">{{ message.content }}</pre>

                            <div v-if="message.attachments && message.attachments.length" class="message-attachments">
                                <span
                                    v-for="file in message.attachments"
                                    :key="`${message.id}_${file.FileName}_${file.Size}`"
                                    class="attachment-chip readonly"
                                >
                                    <el-icon><Paperclip /></el-icon>
                                    {{ file.FileName }}
                                </span>
                            </div>

                            <div v-if="message.code" class="code-block">
                                <div class="code-toolbar">
                                    <span>V8 / JavaScript</span>
                                    <el-button text :icon="CopyDocument" @click="copyText(message.code)">复制代码</el-button>
                                </div>
                                <pre>{{ message.code }}</pre>
                            </div>

                            <div v-if="message.queryRows && message.queryRows.length" class="query-result">
                                <el-table
                                    :data="message.queryRows"
                                    size="small"
                                    :max-height="queryResultMaxHeight(message.queryRows)"
                                    border
                                >
                                    <el-table-column
                                        v-for="column in Object.keys(message.queryRows[0] || {})"
                                        :key="column"
                                        :prop="column"
                                        :label="column"
                                        min-width="130"
                                        show-overflow-tooltip
                                    />
                                </el-table>
                            </div>

                            <div v-if="message.actions && message.actions.length" class="mcp-actions">
                                <div class="mcp-actions-title">
                                    <el-icon><Operation /></el-icon>
                                    <span>MCP 建模动作</span>
                                </div>
                                <div class="mcp-action-list">
                                    <div
                                        v-for="(action, index) in message.actions"
                                        :key="`${message.id}_${index}`"
                                        class="mcp-action-item"
                                    >
                                        <div class="mcp-action-info">
                                            <strong>{{ action.Title || action.Action }}</strong>
                                            <small>{{ action.Action }}</small>
                                        </div>
                                        <el-button
                                            size="small"
                                            type="primary"
                                            plain
                                            :loading="action.__loading"
                                            @click="executeMcpAction(action)"
                                        >
                                            执行
                                        </el-button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                </div>
            </section>

            <footer class="composer">
                <div class="composer-box">
                    <el-input
                        v-model="inputText"
                        type="textarea"
                        resize="none"
                        :autosize="{ minRows: 2, maxRows: 8 }"
                        placeholder="描述你想做什么，或上传图片/文件让 AI 分析"
                        :disabled="sending"
                        @keydown.enter.exact="handleEnter"
                    />

                    <div v-if="selectedFiles.length" class="attachment-list">
                        <span
                            v-for="(file, index) in selectedFiles"
                            :key="`${file.name}_${file.size}_${index}`"
                            class="attachment-chip"
                        >
                            <el-icon><Paperclip /></el-icon>
                            {{ file.name }}
                            <button type="button" @click="removeAttachment(index)">
                                <el-icon><CircleClose /></el-icon>
                            </button>
                        </span>
                    </div>

                    <div class="composer-footer">
                        <div class="composer-left">
                            <input
                                ref="fileInputRef"
                                class="attachment-input"
                                type="file"
                                multiple
                                accept="image/*,.txt,.md,.json,.csv,.xml,.yaml,.yml,.js,.ts,.vue,.cs,.sql,.log"
                                @change="handleAttachmentChange"
                            />
                            <el-tooltip content="上传文件或图片" placement="top">
                                <el-button class="icon-action" text :icon="Paperclip" @click="triggerAttachmentPicker" />
                            </el-tooltip>
                            <span>{{ currentIntentText }}</span>
                        </div>
                        <div class="composer-right">
                            <el-select
                                v-model="selectedAiModel"
                                value-key="Id"
                                filterable
                                :loading="modelLoading"
                                placeholder="选择模型"
                                class="composer-model-select"
                            >
                                <el-option
                                    v-for="model in aiModelList"
                                    :key="model.Id"
                                    :label="formatModelName(model)"
                                    :value="model"
                                />
                            </el-select>
                            <el-button v-if="sending" class="stop-btn" :icon="CircleClose" @click="cancelRequest">停止</el-button>
                            <el-button
                                v-else
                                class="send-btn"
                                type="primary"
                                :icon="Top"
                                :disabled="sendDisabled"
                                @click="sendMessage"
                            />
                        </div>
                    </div>
                </div>
            </footer>
            </template>
        </main>

        <el-drawer
            v-model="modelDrawerVisible"
            title="AI引擎列表"
            size="86%"
            destroy-on-close
            append-to-body
        >
            <div class="ai-model-drawer-content">
                <DiyTable
                    v-if="aiModelTableId && aiSysMenuId"
                    :key="aiSysMenuId + '_' + aiModelTableId"
                    :PropsTableId="aiModelTableId"
                    :PropsSysMenuId="aiSysMenuId"
                    ContainerClass="ai-engine-table-drawer"
                />
                <el-empty v-else description="未找到 mic_ai 表配置" />
            </div>
        </el-drawer>

    </div>
</template>

<script setup>
import { computed, defineAsyncComponent, getCurrentInstance, nextTick, onMounted, reactive, ref } from "vue";
import { useDiyStore } from "@/pinia";
import {
    CircleClose,
    CopyDocument,
    Cpu,
    DataAnalysis,
    EditPen,
    FolderOpened,
    Grid,
    MagicStick,
    Operation,
    Paperclip,
    Search,
    ShoppingBag,
    Top,
    User
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

const DiyTable = defineAsyncComponent(() => import("@/views/form-engine/diy-table.vue"));
const AiAppWorkbench = defineAsyncComponent(() => import("./ai-app-workbench.vue"));
const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;
const diyStore = useDiyStore();

const SOURCE = "ai-engine-workbench";
const AI_DATA_PERMISSION = { id: "AiDataAnalysis", name: "AI数据分析" };
const AI_BUILDER_PERMISSION = { id: "AiLowCodeModeling", name: "低代码建模" };
const ACTION_ENDPOINTS = {
    GetDbSchema: "/api/V8Engine/GetDbSchema",
    CreateTable: "/api/V8Engine/CreateTable",
    AddField: "/api/V8Engine/AddField",
    CreateModule: "/api/V8Engine/CreateModule",
    CreateApiEngine: "/api/V8Engine/CreateApiEngine",
    UpdateApiEngineCode: "/api/V8Engine/UpdateApiEngineCode",
    SavePageEngine: "/api/V8Engine/SavePageEngine",
    ValidateLowCodeSystem: "/api/V8Engine/ValidateLowCodeSystem",
    RefreshSchemaCache: "/api/V8Engine/RefreshSchemaCache"
};

const osClient = computed(() => DiyCommon.GetOsClient());
const currentUser = computed(() => diyStore.GetCurrentUser || {});
const aiModelList = ref([]);
const selectedAiModel = ref(null);
const modelLoading = ref(false);
const historyLoading = ref(false);
const historyKeyword = ref("");
const conversations = ref([]);
const messages = ref([]);
const currentConversationId = ref(makeId("chat"));
const inputText = ref("");
const sending = ref(false);
const messageWrapRef = ref(null);
const fileInputRef = ref(null);
const selectedFiles = ref([]);
const inferredMode = ref("chat");
const aiSysMenuId = ref("");
const aiModelTableId = ref("");
const modelDrawerVisible = ref(false);
const activeWorkspace = ref("chat");
const statsLoading = ref(false);
const platformStats = reactive({
    DiyTableCount: 0,
    SysMenuCount: 0,
    ApiEngineCount: 0,
    UserCount: 0
});
const actionContext = reactive({
    lastTableId: "",
    lastTableName: ""
});
let abortController = null;

const quickPrompts = computed(() => [
    {
        title: "创建业务模块",
        desc: "生成表、字段、菜单和按钮方案",
        icon: MagicStick,
        text: "帮我创建一个客户跟进管理模块，包含客户、联系人、跟进记录三张表，并生成后台菜单。"
    },
    {
        title: "编写 V8 代码",
        desc: "根据需求生成接口引擎或表单事件代码",
        icon: Cpu,
        text: "帮我写一个接口引擎，查询最近 30 天新增客户数量，并按天分组返回。"
    },
    {
        title: "分析数据",
        desc: "用自然语言查询当前租户数据",
        icon: DataAnalysis,
        text: "帮我分析本月新增数据最多的业务表。"
    }
]);

const filteredConversations = computed(() => {
    const keyword = historyKeyword.value.trim().toLowerCase();
    if (!keyword) return conversations.value;
    return conversations.value.filter((item) => item.title.toLowerCase().includes(keyword));
});

const sendDisabled = computed(() => sending.value || (!inputText.value.trim() && selectedFiles.value.length === 0));
const currentIntentText = computed(() => `自动识别：${modeName(detectWorkMode(inputText.value, selectedFiles.value.length > 0))}`);
const isAiAdmin = computed(() => {
    const user = currentUser.value || {};
    return user._IsAdmin === true || user.IsAdmin === true || Number(user.Level || 0) >= 999;
});
const currentUserName = computed(() => {
    const user = currentUser.value || {};
    return user.Name || user.Account || "你";
});
const currentUserAvatar = computed(() => {
    const user = currentUser.value || {};
    const avatar = user.Avatar || user.HeadIcon || user.HeadImg || "";
    if (!avatar) return "";
    return typeof DiyCommon.GetServerPath === "function" ? DiyCommon.GetServerPath(avatar) : avatar;
});
const statCards = computed(() => [
    { key: "table", label: "表单数量", value: platformStats.DiyTableCount || 0, desc: "Form Engine" },
    { key: "module", label: "模块数量", value: platformStats.SysMenuCount || 0, desc: "Module Engine" },
    { key: "api", label: "接口引擎", value: platformStats.ApiEngineCount || 0, desc: "API Engine" },
    { key: "user", label: "系统用户", value: platformStats.UserCount || 0, desc: "Users" }
]);

onMounted(async () => {
    await Promise.all([loadAiModels(), loadHistory(), loadAiEngineMeta(), loadPlatformStats()]);
});

function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowText() {
    const date = new Date();
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function modeName(mode) {
    if (mode === "project") return "AI应用";
    const map = {
        chat: "AI对话",
        code: "V8 编程",
        data: "数据分析",
        builder: "低代码建模"
    };
    return map[mode] || mode;
}

function formatModelName(model) {
    if (!model) return "";
    return `${model.Name || model.AiModel || "AI"}${model.AiModel ? ` (${model.AiModel})` : ""}`;
}

function isOk(result) {
    const current = unwrapDosResult(result);
    return current && Number(current.Code ?? current.code) === 1;
}

function getData(result) {
    const current = unwrapDosResult(result);
    return current?.Data || current?.data || [];
}

function unwrapDosResult(result) {
    let current = result || {};
    if (current?.Data && typeof current.Data === "object" && current.Data.Code !== undefined) {
        current = current.Data;
    }
    if (current?.data && typeof current.data === "object" && current.data.Code !== undefined) {
        current = current.data;
    }
    return current;
}

async function loadAiEngineMeta() {
    await Promise.all([loadAiMenuMeta(), loadAiModelTableId()]);
}

async function loadAiMenuMeta() {
    try {
        const result = await DiyCommon.FormEngine.GetTableData("Sys_Menu", {
            _Where: [
                ["(", "Url", "=", "/mic-ai-engine"],
                ["OR", "Url", "=", "mic-ai-engine"],
                ["OR", "Name", "=", "AI引擎"],
                ["OR", "Name", "=", "AI引擎", ")"]
            ],
            _SelectFields: ["Id", "Name", "Url", "ComponentPath", "PageBtns"],
            _PageSize: 20
        });
        if (!isOk(result)) return;
        const list = getData(result);
        const menu = list.find((item) => String(item.Url || item.ComponentPath || "").includes("mic-ai-engine"))
            || list.find((item) => item.Name === "AI引擎")
            || list.find((item) => item.Name === "AI引擎")
            || list[0];
        aiSysMenuId.value = menu?.Id || "";
    } catch (error) {
        console.warn("[AiEngine] load ai menu meta failed", error);
    }
}

async function loadAiModelTableId() {
    try {
        const result = await DiyCommon.FormEngine.GetFormData("diy_table", {
            _Where: [["Name", "=", "mic_ai"]],
            _SelectFields: ["Id", "Name"]
        });
        if (isOk(result)) {
            aiModelTableId.value = getData(result)?.Id || "";
        }
    } catch (error) {
        console.warn("[AiEngine] load mic_ai table id failed", error);
    }
}

async function loadAiModels() {
    modelLoading.value = true;
    try {
        const result = await DiyCommon.FormEngine.GetTableData("mic_ai", {
            _Where: [["IsEnable", "=", "1"]],
            _OrderBy: "CreateTime",
            _OrderByType: "DESC",
            _PageSize: 100
        });
        if (isOk(result)) {
            aiModelList.value = getData(result) || [];
            if (!selectedAiModel.value && aiModelList.value.length) {
                selectedAiModel.value = aiModelList.value[0];
            }
        } else {
            ElMessage.error(result?.Msg || "加载 AI 模型失败");
        }
    } finally {
        modelLoading.value = false;
    }
}

async function loadPlatformStats() {
    statsLoading.value = true;
    try {
        const result = await DiyCommon.PostAsync("/api/systemmonitor/GetPlatformStats", {}, null, null, "json");
        if (!isOk(result)) return;
        const data = getData(result) || {};
        platformStats.DiyTableCount = data.DiyTableCount || 0;
        platformStats.SysMenuCount = data.SysMenuCount || 0;
        platformStats.ApiEngineCount = data.ApiEngineCount || 0;
        platformStats.UserCount = data.UserCount || 0;
    } catch (error) {
        console.warn("[AiEngine] load platform stats failed", error);
    } finally {
        statsLoading.value = false;
    }
}

async function loadHistory() {
    historyLoading.value = true;
    try {
        const result = await DiyCommon.FormEngine.GetTableData("mic_ai_record", {
            _Where: currentUser.value?.Id ? [["UserId", "=", currentUser.value.Id]] : [],
            _OrderBy: "CreateTime",
            _OrderByType: "DESC",
            _PageSize: 500
        });
        if (!isOk(result)) return;
        const grouped = new Map();
        (getData(result) || []).forEach((row) => {
            const record = parseRecord(row.Content);
            if (!record || record.Source !== SOURCE || !record.ConversationId) return;
            if (!grouped.has(record.ConversationId)) {
                grouped.set(record.ConversationId, {
                    id: record.ConversationId,
                    title: record.Title || firstLine(record.Content) || "新对话",
                    lastTime: record.Time || "",
                    records: []
                });
            }
            const group = grouped.get(record.ConversationId);
            group.records.push(record);
            if (record.Role === "user" && (!group.title || group.title === "新对话")) {
                group.title = firstLine(record.Content);
            }
        });
        conversations.value = Array.from(grouped.values())
            .map((item) => ({
                ...item,
                records: item.records.sort((a, b) => String(a.CreatedAt || "").localeCompare(String(b.CreatedAt || "")))
            }))
            .sort((a, b) => String(b.lastTime || "").localeCompare(String(a.lastTime || "")));
    } finally {
        historyLoading.value = false;
    }
}

function parseRecord(content) {
    if (!content) return null;
    try {
        return typeof content === "string" ? JSON.parse(content) : content;
    } catch {
        return null;
    }
}

function firstLine(text) {
    return String(text || "")
        .split(/\r?\n/)
        .find(Boolean)
        ?.slice(0, 36) || "新对话";
}

function newConversation() {
    cancelRequest();
    currentConversationId.value = makeId("chat");
    messages.value = [];
    inputText.value = "";
    selectedFiles.value = [];
    actionContext.lastTableId = "";
    actionContext.lastTableName = "";
}

function selectConversation(item) {
    cancelRequest();
    currentConversationId.value = item.id;
    selectedFiles.value = [];
    messages.value = (item.records || []).map((record) => {
        const role = record.Role || "assistant";
        const content = normalizeLoadedMessageContent(record, role);
        return {
            id: record.Id || makeId("msg"),
            role,
            mode: record.Mode || "chat",
            content,
            rawContent: record.RawContent || record.Content || content || "",
            thinking: record.Thinking || "",
            thinkingCollapsed: true,
            streaming: false,
            error: record.Error || "",
            code: record.Code || "",
            actions: hydrateMcpActions(record.Actions || []),
            queryRows: record.QueryRows || [],
            attachments: record.Attachments || [],
            modelId: record.ModelId || record.AiModel || "",
            time: record.Time || ""
        };
    });
    scrollToBottom();
}

function normalizeLoadedMessageContent(record, role) {
    const content = record?.Content || "";
    if (content) return content;
    if (role !== "assistant") return "";
    if (record?.Error) return `AI请求失败：${record.Error}`;
    if (record?.Msg) return `AI请求失败：${record.Msg}`;
    if (record?.Code || record?.Thinking || (record?.Actions || []).length || (record?.QueryRows || []).length) return "";
    return "该次 AI 响应异常结束，未返回可显示内容。";
}

function useQuickPrompt(prompt) {
    inputText.value = prompt.text;
}

function handleEnter(event) {
    if (event.shiftKey) return;
    event.preventDefault();
    sendMessage();
}

function cancelRequest() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    sending.value = false;
}

function triggerAttachmentPicker() {
    fileInputRef.value?.click();
}

function handleAttachmentChange(event) {
    const files = Array.from(event.target.files || []);
    const merged = [...selectedFiles.value, ...files].slice(0, 10);
    selectedFiles.value = merged;
    event.target.value = "";
}

function removeAttachment(index) {
    selectedFiles.value.splice(index, 1);
}

async function openModelDrawer() {
    if (!isAiAdmin.value) {
        ElMessage.warning("只有管理员可以查看 AI引擎列表");
        return;
    }
    if (!aiModelTableId.value) {
        await loadAiModelTableId();
    }
    if (!aiSysMenuId.value) {
        await loadAiMenuMeta();
    }
    modelDrawerVisible.value = true;
}

function goMicroiStore() {
    proxy.$router.push({ path: "/microi-store" });
}

async function sendMessage() {
    const text = inputText.value.trim();
    if (sendDisabled.value) return;
    if (!selectedAiModel.value?.AiModel) {
        ElMessage.warning("请先选择 AI 模型");
        return;
    }

    const mode = detectWorkMode(text, selectedFiles.value.length > 0);
    inferredMode.value = mode;

    const attachmentPayload = await readAttachments();
    const attachmentMeta = attachmentPayload.map((item) => ({
        FileName: item.FileName,
        ContentType: item.ContentType,
        Size: item.Size
    }));
    const visibleText = text || "请分析我上传的附件。";

    const userMessage = reactive({
        id: makeId("user"),
        role: "user",
        mode,
        content: visibleText,
        rawContent: visibleText,
        attachments: attachmentMeta,
        modelId: selectedAiModel.value?.AiModel || "",
        time: nowText()
    });
    messages.value.push(userMessage);
    inputText.value = "";
    selectedFiles.value = [];
    await saveMessage(userMessage);

    const deniedText = getModePermissionDeniedText(mode);
    if (deniedText) {
        const deniedMessage = reactive({
            id: makeId("ai"),
            role: "assistant",
            mode,
            content: deniedText,
            rawContent: deniedText,
            thinking: "",
            thinkingCollapsed: true,
            streaming: false,
            code: "",
            actions: [],
            queryRows: [],
            attachments: [],
            modelId: selectedAiModel.value?.AiModel || "",
            time: nowText()
        });
        messages.value.push(deniedMessage);
        await saveMessage(deniedMessage);
        refreshCurrentConversationTitle(userMessage);
        scrollToBottom();
        return;
    }

    const assistantMessage = reactive({
        id: makeId("ai"),
        role: "assistant",
        mode,
        content: "",
        rawContent: "",
        thinking: "",
        thinkingCollapsed: false,
        streaming: true,
        code: "",
        actions: [],
        queryRows: [],
        attachments: [],
        modelId: selectedAiModel.value?.AiModel || "",
        time: nowText()
    });
    messages.value.push(assistantMessage);
    sending.value = true;
    scrollToBottom();

    try {
        if (mode === "code") {
            await sendCodeQuestion(visibleText, assistantMessage);
        } else if (mode === "data") {
            await sendDataQuestion(visibleText, assistantMessage);
        } else if (mode === "project") {
            await sendProjectQuestion(visibleText, assistantMessage);
        } else if (mode === "builder") {
            await sendBuilderQuestion(visibleText, assistantMessage, attachmentPayload);
        } else {
            await sendChatQuestion(visibleText, assistantMessage, attachmentPayload);
        }
    } catch (error) {
        if (error?.name === "AbortError") {
            assistantMessage.content = assistantMessage.content || "已停止";
        } else {
            assistantMessage.content = error?.message || "AI 请求失败";
            assistantMessage.error = assistantMessage.content;
            ElMessage.error(assistantMessage.content);
        }
    } finally {
        if (assistantMessage && !assistantMessage.content && !assistantMessage.thinking && !assistantMessage.code) {
            assistantMessage.content = "AI 暂无可显示内容，请稍后重试或切换模型。";
        }
        assistantMessage.streaming = false;
        await saveMessage(assistantMessage);
        refreshCurrentConversationTitle(userMessage);
        sending.value = false;
        abortController = null;
        scrollToBottom();
    }
}

function detectWorkMode(text, hasAttachment = false) {
    const value = String(text || "").trim();
    const lower = value.toLowerCase();
    if (/(web|网站|官网|网页|h5|uniapp|uni-app|移动端|小程序|app项目|新项目|前端项目|源码项目|电商网站|预约功能)/i.test(value)) {
        return "project";
    }
    if (!value && hasAttachment) return "chat";
    if (/(创建|生成|新增|设计|菜单|模块|表单|表\b|字段|流程|工作流|界面|页面|低代码|建模)/.test(value)) {
        return "builder";
    }
    if (/(v8|接口引擎|表单事件|按钮代码|脚本|javascript|js\b|c#|代码|sql|bug|报错|函数)/i.test(lower)) {
        return "code";
    }
    if (/(统计|分析|查询|多少|排行|趋势|报表|top|同比|环比|本月|本周|数据表|数据量)/.test(value)) {
        return "data";
    }
    return "chat";
}

function validateModePermission(mode) {
    if (mode === "data" && !hasAiPermission(AI_DATA_PERMISSION)) {
        ElMessage.warning("当前角色未配置 AI 数据分析权限");
        return false;
    }
    if ((mode === "builder" || mode === "project") && !hasAiPermission(AI_BUILDER_PERMISSION)) {
        ElMessage.warning("当前角色未配置低代码建模权限");
        return false;
    }
    return true;
}

function getModePermissionDeniedText(mode) {
    if (mode === "data" && !hasAiPermission(AI_DATA_PERMISSION)) {
        return "当前角色未配置 AI 数据分析权限，请联系管理员在角色权限中授权后再使用。";
    }
    if ((mode === "builder" || mode === "project") && !isAiAdmin.value) {
        return "当前账号没有低代码建模权限。为避免误操作创建或修改表、字段、菜单、接口引擎，只有管理员可以执行该能力。";
    }
    return "";
}

function hasAiPermission(permission) {
    if (isAiAdmin.value || isSuperUser()) return true;
    if (!aiSysMenuId.value) return false;
    const limits = currentUser.value?._RoleLimits || [];
    return limits.some((limit) => {
        const menuId = limit.FkId || limit.SysMenuId || limit.MenuId;
        if (String(menuId || "") !== String(aiSysMenuId.value)) return false;
        const list = normalizePermission(limit.Permission);
        return list.includes(permission.id) || list.includes(permission.name);
    });
}

function isSuperUser() {
    const user = currentUser.value || {};
    const level = Number(user.Level || 0);
    return user.IsAdmin === true
        || user._IsAdmin === true
        || level >= 999
        || user.Account === "admin"
        || String(user.RoleName || "").includes("管理员");
}

function normalizePermission(permission) {
    if (Array.isArray(permission)) return permission;
    if (typeof permission !== "string") return [];
    try {
        const parsed = JSON.parse(permission);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return permission.split(",").map((item) => item.trim()).filter(Boolean);
    }
}

async function readAttachments() {
    const files = selectedFiles.value.slice(0, 10);
    const payload = [];
    for (const file of files) {
        const contentType = file.type || "application/octet-stream";
        const item = {
            FileName: file.name,
            ContentType: contentType,
            Size: file.size
        };
        if (contentType.startsWith("image/")) {
            item.FileByteBase64 = await fileToDataUrl(file);
        } else if (isTextFile(file) && file.size <= 512 * 1024) {
            item.Text = await file.text();
        } else {
            item.Text = `附件：${file.name}，类型：${contentType}，大小：${formatFileSize(file.size)}。当前前端仅发送图片和 512KB 内文本文件的完整内容。`;
        }
        payload.push(item);
    }
    return payload;
}

function isTextFile(file) {
    const type = file.type || "";
    const name = file.name.toLowerCase();
    return type.startsWith("text/")
        || /\.(txt|md|json|csv|xml|yaml|yml|js|ts|vue|cs|sql|log)$/i.test(name);
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function formatFileSize(size) {
    if (!size) return "0B";
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function queryResultMaxHeight(rows) {
    const count = Array.isArray(rows) ? rows.length : 0;
    if (count <= 2) return undefined;
    return Math.min(420, 54 + count * 42);
}

function buildDataThinkingSummary(data, question) {
    const lines = [
        "已识别为数据分析请求。",
        "判断依据：用户询问当前系统内的数量、统计或数据概况，需要读取租户数据库中的业务/系统表。"
    ];
    if (question) lines.push(`用户问题：${question}`);
    if (data?.Source) lines.push(`数据源策略：${data.Source}`);
    if (data?.GeneratedSQL) lines.push(`执行方式：生成只读 SELECT 语句并在服务端受控执行。`);
    const count = Array.isArray(data?.QueryResult) ? data.QueryResult.length : 0;
    lines.push(`结果处理：返回 ${count} 条结果用于前端表格展示，同时生成自然语言回答。`);
    return lines.join("\n");
}

function buildSystemPrompt(mode) {
    const modelName = selectedAiModel.value?.Name || "";
    const modelKey = selectedAiModel.value?.AiModel || "";
    const lines = [
        "你是 Microi 吾码 AI 助手。",
        `当前租户：${osClient.value}。`,
        `运行态模型信息：Name=${modelName || modelKey}，Id=${modelKey}。`,
        "涉及当前会话、模型、租户等运行态信息时，以运行态上下文为准，不要编造成业务数据查询结果。",
        "普通聊天只能做常规问答、附件理解、安全的数据分析建议，不要把普通聊天伪装成 SQL 查询结果。"
    ];
    if (mode === "builder") {
        lines.push("低代码建模必须先输出可核对方案；涉及写入平台时只输出可人工确认的 MCP 动作，不要声称已经执行。");
    }
    if (mode === "code") {
        lines.push("V8 编程回答要遵守 Microi V8 API、参数化查询、多语言和性能规范。");
    }
    return lines.join("\n");
}

async function sendChatQuestion(text, assistantMessage, attachments = []) {
    await sendChatStream({
        UserChatMsg: text,
        SystemChatMsg: buildSystemPrompt("chat"),
        AiModel: selectedAiModel.value.AiModel,
        OsClient: osClient.value,
        Attachments: attachments,
        ConversationId: currentConversationId.value,
        Source: SOURCE,
        Mode: "chat"
    }, assistantMessage);
}

async function sendProjectQuestion(text, assistantMessage) {
    const appType = inferProjectType(text);
    const appName = inferProjectName(text, appType);
    const result = await DiyCommon.ApiEngine.Run("ai_app_create", {
        OsClient: osClient.value,
        AppType: appType,
        Name: appName,
        Description: text,
        WithStarter: true
    });
    if (!isOk(result)) throw new Error(unwrapDosResult(result)?.Msg || "AI应用创建失败");
    const data = getData(result) || {};
    assistantMessage.content = [
        `已创建 ${appType} AI应用：${data.Name || appName}`,
        `应用Id：${data.Id || ""}`,
        `已生成源码文件：${Array.isArray(data.Files) ? data.Files.length : 0} 个`,
        "已自动切换到【AI应用】，你可以查看源码树、编辑文件并运行预览。"
    ].join("\n");
    activeWorkspace.value = "apps";
}

function inferProjectType(text) {
    return /(uniapp|uni-app|移动端|小程序|app|安卓|ios)/i.test(text || "") ? "UniApp" : "Web";
}

function inferProjectName(text, projectType) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    const match = value.match(/(?:创建|搭建|生成|开发|做)(?:一个|一套|全新的)?(.{2,28}?)(?:项目|网站|网页|移动端|小程序|app|功能|，|,|。|$)/i);
    if (match?.[1]) return match[1].replace(/^(Web|UniApp|H5)/i, "").trim() || `${projectType} AI应用`;
    return projectType === "UniApp" ? "AI移动端应用" : "AI Web应用";
}

async function sendBuilderQuestion(text, assistantMessage, attachments = []) {
    const prompt = buildMcpPrompt(text);
    await sendChatStream({
        UserChatMsg: prompt,
        SystemChatMsg: buildSystemPrompt("builder"),
        AiModel: selectedAiModel.value.AiModel,
        OsClient: osClient.value,
        Attachments: attachments,
        ConversationId: currentConversationId.value,
        Source: SOURCE,
        Mode: "builder"
    }, assistantMessage, { extractActions: true });
    assistantMessage.actions = extractMcpActions(assistantMessage.rawContent || assistantMessage.content);
    assistantMessage.content = stripActionJson(assistantMessage.content || "");
}

async function sendChatStream(payload, assistantMessage, options = {}) {
    abortController = new AbortController();
    const response = await fetch(`${DiyCommon.GetApiBase()}/api/Ai/ChatStream`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            authorization: DiyCommon.getToken() ? `Bearer ${DiyCommon.getToken()}` : "",
            lang: DiyCommon.GetCurrentLang ? DiyCommon.GetCurrentLang() : "zh-CN"
        },
        body: JSON.stringify(payload),
        signal: abortController.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    await readChatSse(response, assistantMessage, options);
}

async function sendDataQuestion(text, assistantMessage) {
    const result = await DiyCommon.PostAsync("/api/Ai/NL2SQL", {
        Question: text,
        AiModel: selectedAiModel.value.AiModel,
        OsClient: osClient.value
    }, null, null, "json");
    if (!isOk(result)) throw new Error(result?.Msg || "数据分析失败");
    const data = result.Data || {};
    assistantMessage.thinking = data.Thinking || buildDataThinkingSummary(data, text);
    assistantMessage.thinkingCollapsed = false;
    assistantMessage.content = [
        data.Answer || "查询完成",
        data.GeneratedSQL ? `SQL: ${data.GeneratedSQL}` : ""
    ].filter(Boolean).join("\n\n");
    assistantMessage.queryRows = Array.isArray(data.QueryResult) ? data.QueryResult.slice(0, 100) : [];
}

async function sendCodeQuestion(text, assistantMessage) {
    abortController = new AbortController();
    const response = await fetch(`${DiyCommon.GetApiBase()}/api/Ai/NL2V8Engine`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            authorization: DiyCommon.getToken() ? `Bearer ${DiyCommon.getToken()}` : "",
            lang: DiyCommon.GetCurrentLang ? DiyCommon.GetCurrentLang() : "zh-CN"
        },
        body: JSON.stringify({
            Question: text,
            AiModel: selectedAiModel.value.AiModel,
            AiModelId: selectedAiModel.value.Id || "",
            OsClient: osClient.value,
            CurrentCode: "",
            ConversationId: currentConversationId.value,
            Source: SOURCE,
            Mode: "code"
        }),
        signal: abortController.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    await readSse(response, assistantMessage);
}

async function readChatSse(response, assistantMessage, options = {}) {
    if (!response.body) {
        const text = await response.text();
        applyStreamText(assistantMessage, text);
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let eventName = "";
    let dataLines = [];
    let fullText = "";

    const dispatch = () => {
        if (!eventName && dataLines.length === 0) return;
        const data = dataLines.join("\n");
        dataLines = [];
        if (eventName === "message") {
            fullText += data;
            applyStreamText(assistantMessage, fullText);
        } else if (eventName === "result") {
            if (!fullText && data) {
                try {
                    const parsed = JSON.parse(data);
                    fullText = typeof parsed === "string" ? parsed : normalizeAiText(parsed);
                    applyStreamText(assistantMessage, fullText);
                } catch {
                    fullText = data;
                    applyStreamText(assistantMessage, fullText);
                }
            }
        } else if (eventName === "error") {
            throw new Error(data || "AI 对话失败");
        }
        eventName = "";
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
            if (line === "") {
                dispatch();
            } else if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).replace(/^ /, ""));
            }
        }
    }
    if (buffer) dispatch();
    if (options.extractActions) {
        assistantMessage.actions = extractMcpActions(fullText);
    }
}

function applyStreamText(message, rawText) {
    const raw = String(rawText || "");
    const parsed = splitThinkingText(raw);
    message.rawContent = raw;
    message.thinking = parsed.thinking;
    message.content = parsed.content;
    if (message.thinking && !message.content) {
        message.content = "";
    }
    scrollToBottom();
}

function splitThinkingText(text) {
    const raw = String(text || "");
    let thinking = "";
    let content = raw;
    const closed = raw.match(/<think>([\s\S]*?)<\/think>/i);
    if (closed) {
        thinking = closed[1].trim();
        content = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trimStart();
    } else {
        const openIndex = raw.toLowerCase().indexOf("<think>");
        if (openIndex >= 0) {
            thinking = raw.slice(openIndex + 7).trim();
            content = raw.slice(0, openIndex).trimStart();
        }
    }
    content = content.replace(/<\/?think>/gi, "").trimStart();
    return { thinking, content };
}

function thinkingParagraphCount(text) {
    return String(text || "").split(/\n\s*\n/).filter((item) => item.trim()).length || 1;
}

async function readSse(response, assistantMessage) {
    if (!response.body) {
        applyStreamText(assistantMessage, await response.text());
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let eventName = "";
    let dataLines = [];
    let fullText = "";

    const dispatch = () => {
        if (!eventName && dataLines.length === 0) return;
        const data = dataLines.join("\n");
        dataLines = [];
        if (eventName === "message") {
            fullText += data;
            const streamParts = splitThinkingText(fullText);
            assistantMessage.rawContent = fullText;
            assistantMessage.thinking = streamParts.thinking;
            const parsed = parseCodeResponse(streamParts.content);
            assistantMessage.content = parsed.explanation || (parsed.code ? "代码生成中..." : streamParts.content);
            assistantMessage.code = parsed.code;
            scrollToBottom();
        } else if (eventName === "result") {
            try {
                const metadata = JSON.parse(data);
                if (metadata?.GeneratedCode && !assistantMessage.code) {
                    assistantMessage.code = metadata.GeneratedCode;
                }
            } catch {}
        } else if (eventName === "error") {
            throw new Error(data || "AI 生成失败");
        }
        eventName = "";
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
            if (line === "") {
                dispatch();
            } else if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).replace(/^ /, ""));
            }
        }
    }
    if (buffer) dispatch();
    const streamParts = splitThinkingText(fullText);
    assistantMessage.rawContent = fullText;
    assistantMessage.thinking = streamParts.thinking;
    const parsed = parseCodeResponse(streamParts.content);
    assistantMessage.content = parsed.explanation || (parsed.code ? "代码生成完成" : streamParts.content || "生成完成");
    assistantMessage.code = parsed.code || assistantMessage.code;
}

function normalizeAiText(data) {
    if (data == null) return "";
    if (typeof data === "string") return data;
    return JSON.stringify(data, null, 2);
}

function parseCodeResponse(text) {
    const codeBlocks = [];
    const codeRegex = /```(?:javascript|js|csharp|sql|json)?\s*([\s\S]*?)```/gi;
    let match;
    while ((match = codeRegex.exec(text)) !== null) {
        codeBlocks.push(match[1].trim());
    }
    const code = codeBlocks.join("\n\n");
    const explanation = text.replace(/```(?:javascript|js|csharp|sql|json)?\s*[\s\S]*?```/gi, "").trim();
    return { explanation, code };
}

function buildMcpPrompt(text) {
    return [
        "线上AI已接入 Microi skills + MCP 受控工具桥：低代码建模动作必须输出 McpActions，由前端按钮调用 /api/V8Engine 对应工具执行。",
        "当前支持表、字段、菜单、接口引擎、界面引擎、校验和缓存刷新；复杂 AI 应用源码走 ai_app_* 接口引擎并存储到 HDFS。",
        "你是 Microi 吾码线上低代码建模助手。",
        `当前租户 OsClient=${osClient.value}。`,
        "你需要根据用户需求给出简洁方案，并在确实需要写入平台时，输出可人工确认执行的 MCP 动作。",
        "可用动作：CreateTable、AddField、CreateModule、CreateApiEngine、UpdateApiEngineCode、SavePageEngine、ValidateLowCodeSystem、RefreshSchemaCache。",
        "字段物理类型必须使用 varchar(N)、mediumtext、longtext、int、bigint、decimal(18,N)，日期时间用 varchar(25)，不要使用 datetime/date/timestamp/float/double/boolean。",
        `高风险能力权限：${AI_DATA_PERMISSION.name}、${AI_BUILDER_PERMISSION.name} 已由前端校验；后端执行动作时仍必须做权限与租户边界校验。`,
        "如果要输出动作，请在回答末尾单独给一个 JSON 代码块，格式为：",
        '{"McpActions":[{"Action":"CreateTable","Title":"创建客户表","Params":{"Name":"diy_customer","Description":"客户表"}}]}',
        "不要直接假装已经执行，动作需要用户点击执行。",
        "",
        "用户需求：",
        text
    ].join("\n");
}

function stripActionJson(content) {
    return content.replace(/```json\s*[\s\S]*?"McpActions"[\s\S]*?```/gi, "").trim() || content;
}

function extractMcpActions(content) {
    const actions = [];
    const regex = /```json\s*([\s\S]*?)```/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed.McpActions)) {
                actions.push(...parsed.McpActions);
            }
        } catch {}
    }
    return hydrateMcpActions(actions);
}

function hydrateMcpActions(actions = []) {
    return actions.map((item) => reactive({
        Action: item.Action,
        Title: item.Title,
        Params: item.Params || {},
        __result: item.__result || null,
        __loading: false
    })).filter((item) => item.Action && ACTION_ENDPOINTS[item.Action]);
}

async function executeMcpAction(action) {
    if (!isAiAdmin.value) {
        ElMessage.warning("只有管理员可以执行低代码建模动作");
        return;
    }
    const endpoint = ACTION_ENDPOINTS[action.Action];
    if (!endpoint) {
        ElMessage.warning("暂不支持该动作：" + action.Action);
        return;
    }
    action.__loading = true;
    try {
        const payload = prepareMcpActionPayload(action);
        if (shouldSkipAutoSystemField(action, payload)) {
            ElMessage.success(`${action.Title || action.Action} 已跳过：系统基础字段由创建表自动生成`);
            action.__result = { Skipped: true, Reason: "AutoSystemField" };
            return;
        }
        if (action.Action === "AddField" && !payload.TableId) {
            ElMessage.error("请先执行创建表，或在字段动作中提供 TableId");
            return;
        }
        const result = await DiyCommon.PostAsync(endpoint, payload, null, null, "json");
        if (isOk(result)) {
            action.__result = result.Data || result.data || {};
            rememberMcpActionResult(action, action.__result);
            ElMessage.success(`${action.Title || action.Action} 执行成功`);
            const msg = reactive({
                id: makeId("system"),
                role: "assistant",
                mode: "builder",
                content: `${action.Title || action.Action} 执行成功\n${JSON.stringify(result.Data || {}, null, 2)}`,
                time: nowText()
            });
            messages.value.push(msg);
            await saveMessage(msg);
            scrollToBottom();
        } else {
            ElMessage.error(result?.Msg || `${action.Action} 执行失败`);
        }
    } finally {
        action.__loading = false;
    }
}

function prepareMcpActionPayload(action) {
    const payload = {
        OsClient: osClient.value,
        ...(action.Params || {})
    };
    if (action.Action === "AddField") {
        payload.TableId = payload.TableId || payload.DiyTableId || payload.tableId || actionContext.lastTableId;
        payload.Name = payload.Name || payload.FieldName || payload.Key;
        payload.Label = payload.Label || payload.Title || payload.Name;
        payload.Type = payload.Type || "varchar(200)";
        payload.Component = payload.Component || "Text";
    }
    if (action.Action === "CreateModule") {
        payload.DiyTableId = payload.DiyTableId || payload.TableId || actionContext.lastTableId;
    }
    return payload;
}

function shouldSkipAutoSystemField(action, payload) {
    if (action.Action !== "AddField") return false;
    const name = String(payload.Name || "").toLowerCase();
    return ["id", "createtime", "updatetime", "createuser", "osclient"].includes(name);
}

function rememberMcpActionResult(action, data) {
    if (action.Action !== "CreateTable") return;
    const tableId = data?.TableId || data?.Id || data?.DiyTableId || "";
    const tableName = data?.Name || data?.TableName || action.Params?.Name || "";
    if (tableId) actionContext.lastTableId = tableId;
    if (tableName) actionContext.lastTableName = tableName;
}

function buildChatHistoryPayload() {
    const contentMessages = messages.value
        .filter((item) => item && item.content && !item.streaming)
        .slice(0, -1)
        .slice(-20);
    return contentMessages.map((item) => ({
        Role: item.role === "assistant" ? "assistant" : "user",
        Content: [item.content, item.code ? `\n\`\`\`javascript\n${item.code}\n\`\`\`` : ""].filter(Boolean).join("\n")
    }));
}

async function saveMessage(message) {
    try {
        await DiyCommon.FormEngine.AddFormData("mic_ai_record", {
            AiModelId: selectedAiModel.value?.Id || "",
            AiModel: selectedAiModel.value?.AiModel || "",
            Content: JSON.stringify({
                Source: SOURCE,
                ConversationId: currentConversationId.value,
                Title: firstLine(messages.value.find((item) => item.role === "user")?.content || message.content),
                Role: message.role,
                Mode: message.mode || inferredMode.value,
                Content: message.content || "",
                RawContent: message.rawContent || message.content || "",
                ModelId: message.modelId || selectedAiModel.value?.AiModel || "",
                AiModel: selectedAiModel.value?.AiModel || "",
                Thinking: message.thinking || "",
                Code: message.code || "",
                Error: message.error || "",
                Attachments: message.attachments || [],
                Actions: (message.actions || []).map((item) => ({
                    Action: item.Action,
                    Title: item.Title,
                    Params: item.Params,
                    __result: item.__result || null
                })),
                QueryRows: message.queryRows || [],
                Time: message.time || nowText(),
                CreatedAt: new Date().toISOString()
            })
        });
        loadHistory();
    } catch (error) {
        console.warn("[AiEngine] save message failed", error);
    }
}

function refreshCurrentConversationTitle(userMessage) {
    const existing = conversations.value.find((item) => item.id === currentConversationId.value);
    if (existing) {
        existing.title = firstLine(userMessage.content);
        existing.lastTime = userMessage.time;
    } else {
        conversations.value.unshift({
            id: currentConversationId.value,
            title: firstLine(userMessage.content),
            lastTime: userMessage.time,
            records: []
        });
    }
}

function scrollToBottom() {
    nextTick(() => {
        if (messageWrapRef.value) {
            messageWrapRef.value.scrollTop = messageWrapRef.value.scrollHeight;
        }
    });
}

async function copyText(text) {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        ElMessage.success("已复制");
    } catch {
        ElMessage.warning("复制失败");
    }
}
</script>

<style scoped>
.ai-engine-page {
    height: calc(100vh - 84px);
    min-height: 0;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    overflow: hidden;
    background: #f7f8fb;
    color: #20242c;
}

.ai-engine-page.is-app-workspace {
    grid-template-columns: minmax(0, 1fr);
}

.ai-engine-page.is-app-workspace .ai-engine-sidebar {
    display: none;
}

.ai-engine-sidebar {
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e3e6ee;
    background: linear-gradient(180deg, #eef7eb 0%, #f7f3df 100%);
}

.workspace-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 14px 14px 6px;
}

.workspace-tabs.single-tab {
    grid-template-columns: 1fr;
}

.workspace-tab {
    height: 44px;
    display: flex;
    align-items: center;
    gap: 9px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: rgba(255, 255, 255, .38);
    color: #435044;
    cursor: pointer;
    padding: 0 12px;
    font-weight: 650;
    justify-content: center;
    text-align: center;
    transition: background .18s, border-color .18s, color .18s, box-shadow .18s;
}

.workspace-tab:hover,
.workspace-tab.active {
    border-color: rgba(255, 95, 46, .22);
    background: #fff;
    color: #ff5f2e;
    box-shadow: 0 10px 24px rgba(43, 55, 78, .07);
}

.sidebar-actions {
    display: grid;
    gap: 10px;
    padding: 10px 16px 16px;
}

.new-chat-btn {
    justify-content: center;
    border: 0;
    border-radius: 8px;
    background: linear-gradient(135deg, #ff6a3d 0%, #ff3f22 100%);
    color: #fff;
    font-weight: 650;
    box-shadow: 0 10px 24px rgba(255, 95, 46, .22);
}

.app-sidebar-intro {
    margin: 12px 16px;
    border: 1px solid rgba(255, 95, 46, .16);
    border-radius: 8px;
    background: rgba(255, 255, 255, .7);
    padding: 14px;
}

.app-sidebar-intro strong {
    display: block;
    color: #1f3329;
    font-size: 15px;
    margin-bottom: 8px;
}

.app-sidebar-intro p {
    margin: 0;
    color: #6f7a72;
    font-size: 13px;
    line-height: 1.7;
}

.sidebar-section-title {
    padding: 10px 18px 6px;
    color: #8a918c;
    font-size: 13px;
}

.conversation-list {
    min-height: 0;
    flex: 1;
    overflow: auto;
    padding: 4px 10px 18px;
}

.conversation-item {
    width: 100%;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #394139;
    cursor: pointer;
    padding: 9px 10px;
    text-align: left;
}

.conversation-item:hover,
.conversation-item.active {
    background: rgba(255, 255, 255, 0.72);
}

.conversation-title {
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
}

.conversation-item small {
    color: #90988f;
    font-size: 12px;
}

.ai-engine-main {
    min-width: 0;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    display: grid;
    grid-template-rows: 64px minmax(0, 1fr) auto;
    background: #fff;
}

.ai-engine-main.is-apps {
    grid-template-rows: 64px minmax(0, 1fr);
}

.ai-engine-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 22px;
    border-bottom: 1px solid #edf0f5;
}

.store-link-btn {
    border-color: rgba(255, 95, 46, .36);
    background: linear-gradient(135deg, #fff6f2 0%, #fff 100%);
    color: #ff5f2e;
    font-weight: 650;
}

.inline-project-workbench {
    min-height: 0;
    height: 100%;
    padding: 14px;
    background: #f7f8fb;
}

.header-left,
.header-tools {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.header-workspace-switch {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border: 1px solid #e9edf4;
    border-radius: 8px;
    background: #f7f8fb;
}

.header-workspace-switch button {
    height: 30px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #697386;
    cursor: pointer;
    font-weight: 650;
    padding: 0 12px;
}

.header-workspace-switch button.active,
.header-workspace-switch button:hover {
    background: #fff;
    color: #ff5f2e;
    box-shadow: 0 6px 16px rgba(43, 55, 78, .08);
}

.header-left h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 750;
}

.message-wrap {
    min-height: 0;
    overflow: auto;
    padding: 18px 24px;
}

.empty-state {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    gap: 12px;
    padding: 6px 0 16px;
}

.empty-hero {
    max-width: 780px;
    text-align: center;
}

.hero-kicker {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    border: 1px solid rgba(255, 95, 46, .22);
    border-radius: 999px;
    background: #fff7f3;
    color: #ff5f2e;
    padding: 0 11px;
    font-size: 12px;
    font-weight: 700;
}

.empty-state h1 {
    margin: 0;
    margin-top: 8px;
    color: #24272e;
    font-size: 28px;
    font-weight: 760;
    letter-spacing: 0;
}

.empty-state p {
    max-width: 580px;
    margin: 0;
    color: #747b88;
    font-size: 14px;
    text-align: center;
    line-height: 1.7;
}

.platform-stats {
    width: min(860px, 100%);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 8px;
}

.platform-stat {
    min-height: 78px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border: 1px solid #e7ebf2;
    border-radius: 8px;
    background: linear-gradient(180deg, #fff 0%, #fbfcff 100%);
    box-shadow: 0 12px 30px rgba(35, 44, 63, .05);
    padding: 13px 16px;
}

.platform-stat span {
    color: #7c8595;
    font-size: 12px;
}

.platform-stat strong {
    color: #20242c;
    font-size: 24px;
    line-height: 1.2;
    margin: 4px 0;
}

.platform-stat small {
    color: #a4acb9;
    font-size: 12px;
}

.quick-prompts {
    width: min(760px, 100%);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-top: 8px;
}

.quick-prompt {
    min-height: 104px;
    display: flex;
    flex-direction: column;
    gap: 9px;
    border: 1px solid #e5e8ef;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    padding: 14px;
    text-align: left;
    transition: border-color .18s, box-shadow .18s, transform .18s;
}

.quick-prompt:hover {
    border-color: #b8c5d8;
    box-shadow: 0 12px 30px rgba(29, 36, 52, .08);
    transform: translateY(-1px);
}

.quick-prompt .el-icon {
    color: #ff5f2e;
    font-size: 20px;
}

.quick-prompt strong {
    color: #20242c;
    font-size: 15px;
}

.quick-prompt span {
    color: #7a8290;
    font-size: 13px;
    line-height: 1.45;
}

.message-list {
    max-width: 980px;
    display: grid;
    gap: 22px;
    margin: 0 auto;
}

.message {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 12px;
}

.message-avatar {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #f1f3f6;
    color: #626b78;
    overflow: hidden;
}

.message.is-assistant .message-avatar {
    background: #fff1ec;
    color: #ff5f2e;
}

.message-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.message-body {
    min-width: 0;
}

.message-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 24px;
    margin-bottom: 5px;
}

.message-meta strong {
    font-size: 14px;
}

.message-meta span {
    color: #9aa2af;
    font-size: 12px;
}

.message-copy-btn {
    height: 24px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #87909f;
    cursor: pointer;
    padding: 0 6px;
    margin-left: auto;
}

.message-copy-btn:hover {
    background: #f2f5f9;
    color: #ff5f2e;
}

.message-text {
    margin: 0;
    color: #252a32;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.75;
    white-space: pre-wrap;
    word-break: break-word;
}

.message-text.streaming::after {
    content: "";
    display: inline-block;
    width: 6px;
    height: 16px;
    margin-left: 3px;
    border-radius: 3px;
    background: #ff5f2e;
    vertical-align: -3px;
    animation: cursor-blink 1s steps(2, start) infinite;
}

.thinking-placeholder {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    color: #6b7280;
    font-size: 13px;
}

.thinking-placeholder em {
    font-style: normal;
}

.thinking-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ff6a3d;
    opacity: .35;
    animation: thinking-dot 1s ease-in-out infinite;
}

.thinking-dot:nth-child(2) {
    animation-delay: .15s;
}

.thinking-dot:nth-child(3) {
    animation-delay: .3s;
}

.message-thinking {
    margin: 0 0 8px;
    border: 1px solid #e6eaf1;
    border-radius: 8px;
    background: #f8fafc;
    overflow: hidden;
}

.thinking-toggle {
    width: 100%;
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 7px;
    border: 0;
    background: transparent;
    color: #5d6675;
    cursor: pointer;
    padding: 7px 10px;
    text-align: left;
}

.thinking-toggle small {
    margin-left: auto;
    color: #9aa3b2;
}

.thinking-content {
    max-height: 220px;
    overflow: auto;
    margin: 0;
    border-top: 1px solid #e6eaf1;
    color: #6c7480;
    font-family: inherit;
    font-size: 13px;
    line-height: 1.65;
    padding: 10px 12px;
    white-space: pre-wrap;
    word-break: break-word;
}

@keyframes cursor-blink {
    0%, 45% { opacity: 1; }
    46%, 100% { opacity: 0; }
}

@keyframes thinking-dot {
    0%, 80%, 100% {
        opacity: .35;
        transform: translateY(0);
    }
    40% {
        opacity: 1;
        transform: translateY(-3px);
    }
}

.message-attachments,
.attachment-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.message-attachments {
    margin-top: 8px;
}

.attachment-list {
    padding: 0 12px 8px;
}

.attachment-chip {
    max-width: 260px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #e2e7f0;
    border-radius: 999px;
    background: #f8fafc;
    color: #445064;
    padding: 4px 8px;
    font-size: 12px;
}

.attachment-chip.readonly {
    background: #fff;
}

.attachment-chip button {
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: #8f97a5;
    cursor: pointer;
    padding: 0;
}

.code-block,
.query-result,
.mcp-actions {
    margin-top: 12px;
    border: 1px solid #e4e8f0;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
}

.code-toolbar {
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px 0 14px;
    border-bottom: 1px solid #252b36;
    background: #161b22;
    color: #cbd5e1;
    font-size: 12px;
}

.code-block pre {
    max-height: 380px;
    overflow: auto;
    margin: 0;
    padding: 14px;
    background: #0d1117;
    color: #e6edf3;
    font-size: 13px;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
}

.query-result {
    padding: 10px;
}

.mcp-actions {
    padding: 12px;
}

.mcp-actions-title {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #3d4655;
    font-weight: 650;
    margin-bottom: 10px;
}

.mcp-action-list {
    display: grid;
    gap: 8px;
}

.mcp-action-item {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid #edf0f5;
    border-radius: 7px;
    padding: 8px 10px;
}

.mcp-action-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.mcp-action-info strong,
.mcp-action-info small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mcp-action-info small {
    color: #8b94a3;
}

.composer {
    border-top: 1px solid #edf0f5;
    padding: 14px 24px 18px;
    background: #fff;
}

.composer-box {
    max-width: 980px;
    margin: 0 auto;
    border: 1px solid #dfe3eb;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 14px 38px rgba(25, 32, 44, .08);
    overflow: hidden;
}

.composer-box :deep(.el-textarea__inner) {
    border: 0;
    box-shadow: none;
    padding: 16px 18px 8px;
    font-size: 15px;
}

.composer-footer {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 4px 10px 10px 12px;
}

.composer-left,
.composer-right {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.composer-left span {
    color: #767e8a;
    font-size: 13px;
}

.attachment-input {
    display: none;
}

.icon-action {
    width: 34px;
    height: 34px;
}

.composer-model-select {
    width: 260px;
}

.send-btn {
    width: 40px;
    height: 40px;
    min-width: 40px;
    padding: 0;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.stop-btn {
    height: 36px;
}

:deep(.ai-engine-table-drawer) {
    height: calc(100vh - 120px);
}

@media (max-width: 1080px) {
    .ai-engine-page {
        grid-template-columns: 220px minmax(0, 1fr);
    }

    .ai-engine-header {
        align-items: flex-start;
        flex-direction: column;
        height: auto;
        padding: 12px 18px;
    }

    .quick-prompts {
        grid-template-columns: 1fr;
    }

    .platform-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-height: 760px) and (min-width: 761px) {
    .message-wrap {
        padding-top: 12px;
        padding-bottom: 12px;
    }

    .empty-state h1 {
        font-size: 24px;
    }

    .empty-state p {
        line-height: 1.55;
    }

    .quick-prompts {
        display: none;
    }

    .composer {
        padding-top: 10px;
        padding-bottom: 12px;
    }
}

@media (max-width: 760px) {
    .ai-engine-page {
        height: auto;
        min-height: 100vh;
        grid-template-columns: 1fr;
    }

    .ai-engine-sidebar {
        height: 230px;
        border-right: 0;
        border-bottom: 1px solid #e3e6ee;
    }

    .ai-engine-main {
        min-height: 760px;
    }

    .ai-engine-header {
        padding: 12px 14px;
    }

    .message-wrap {
        padding: 22px 14px;
    }

    .empty-state h1 {
        font-size: 26px;
    }

    .platform-stats {
        grid-template-columns: 1fr;
    }

    .composer {
        padding: 10px 12px 14px;
    }

    .composer-footer {
        align-items: stretch;
        flex-direction: column;
    }

    .composer-right {
        justify-content: flex-end;
        width: 100%;
    }

    .composer-model-select {
        flex: 1;
        width: auto;
    }
}
</style>
