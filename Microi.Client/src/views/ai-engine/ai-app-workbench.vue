<template>
    <div class="ai-app-workbench" :class="'is-' + appViewMode">
        <section v-if="appViewMode === 'gallery'" class="app-gallery">
            <header class="app-gallery-hero">
                <div class="gallery-title">
                    <el-icon><Grid /></el-icon>
                    <div>
                        <strong>AI应用</strong>
                        <span>选择已有应用预览运行效果，或进入开发工作台继续迭代源码。</span>
                    </div>
                </div>
                <div class="gallery-tools">
                    <el-input
                        v-model="keyword"
                        clearable
                        placeholder="搜索AI应用"
                        size="small"
                        @keyup.enter="loadApps"
                    />
                    <el-button size="small" @click="loadApps">刷新</el-button>
                    <el-button type="primary" size="small" @click="openCreate('Web')">新建Web应用</el-button>
                    <el-button size="small" @click="openCreate('UniApp')">新建UniApp应用</el-button>
                </div>
            </header>
            <div class="app-gallery-grid" v-loading="appLoading">
                <article
                    v-for="app in apps"
                    :key="app.Id"
                    class="app-card"
                    :class="{ active: currentApp?.Id === app.Id }"
                    @dblclick="enterDevelop(app)"
                >
                    <div class="app-card-top">
                        <el-tag size="small" effect="dark">{{ app.AppType || "Web" }}</el-tag>
                        <span>v{{ app.CurrentVersion || 1 }}</span>
                    </div>
                    <h4>{{ app.Name }}</h4>
                    <p>{{ app.Description || "暂无应用说明" }}</p>
                    <div class="app-card-meta">
                        <span>Key</span>
                        <strong>{{ app.AppKey || app.Id }}</strong>
                    </div>
                    <div class="app-card-meta">
                        <span>状态</span>
                        <strong>{{ app.BuildStatus || "Draft" }}</strong>
                    </div>
                    <div class="app-card-actions">
                        <el-button
                            :icon="View"
                            :loading="previewingAppId === app.Id"
                            :disabled="!!previewingAppId && previewingAppId !== app.Id"
                            @click.stop="previewApp(app)"
                        >
                            预览
                        </el-button>
                        <el-button type="primary" :icon="EditPen" @click.stop="enterDevelop(app)">开发</el-button>
                    </div>
                </article>
                <el-empty v-if="!apps.length && !appLoading" :image-size="96" description="暂无AI应用">
                    <el-button type="primary" @click="openCreate('UniApp')">创建第一个应用</el-button>
                </el-empty>
            </div>
        </section>

        <template v-else>
        <aside class="app-panel develop-chat-panel">
            <div class="app-develop-head">
                <el-button class="back-gallery" text :icon="Back" @click="backToGallery">应用宫格</el-button>
                <div>
                    <strong>{{ currentApp?.Name || "应用开发" }}</strong>
                    <span>{{ currentApp?.AppType || "-" }} · {{ currentApp?.AppKey || currentApp?.Id || "-" }}</span>
                </div>
            </div>
            <div v-if="currentApp" class="app-chat app-chat-in-panel">
                <div class="app-chat-header">
                    <div>
                        <strong>应用AI对话</strong>
                        <small>{{ currentApp.Name }}</small>
                    </div>
                    <el-button
                        v-if="appChatSending"
                        size="small"
                        text
                        :icon="CircleClose"
                        @click="cancelAppChat"
                    >
                        停止
                    </el-button>
                </div>
                <div ref="appChatWrapRef" class="app-chat-messages">
                    <div
                        v-for="item in appChatMessages"
                        :key="item.id"
                        class="app-chat-message"
                        :class="'is-' + item.role"
                    >
                        <div class="app-message-meta">
                            <strong>{{ item.role === "user" ? "你" : "AI引擎" }}</strong>
                            <small>{{ item.time }}</small>
                            <el-tag v-if="item.modelId" size="small" effect="plain">{{ item.modelId }}</el-tag>
                        </div>
                        <div v-if="item.thinking" class="app-thinking">
                            <button type="button" @click="item.thinkingCollapsed = !item.thinkingCollapsed">
                                <el-icon><Cpu /></el-icon>
                                <span>思考过程</span>
                                <small>{{ thinkingParagraphCount(item.thinking) }} 段</small>
                            </button>
                            <pre v-show="!item.thinkingCollapsed">{{ item.thinking }}</pre>
                        </div>
                        <div v-if="item.role === 'assistant' && item.streaming && !item.content && !item.thinking" class="app-thinking-placeholder">
                            <span></span><span></span><span></span><em>正在思考</em>
                        </div>
                        <pre v-if="item.content" :class="{ streaming: item.streaming }">{{ item.content }}</pre>
                        <div v-if="item.attachments && item.attachments.length" class="app-chat-attachments">
                            <span
                                v-for="file in item.attachments"
                                :key="`${item.id}_${file.FileName}_${file.Size}`"
                                class="attachment-chip readonly"
                            >
                                <el-icon><Paperclip /></el-icon>
                                {{ file.FileName }}
                            </span>
                        </div>
                    </div>
                    <div v-if="!appChatMessages.length" class="app-chat-empty">
                        选中应用后，可以让 AI 继续修改页面、补接口、解释源码。
                    </div>
                </div>
                <div class="app-chat-composer">
                    <input
                        ref="appFileInputRef"
                        class="attachment-input"
                        type="file"
                        multiple
                        accept="image/*,.txt,.md,.json,.csv,.xml,.yaml,.yml,.js,.ts,.vue,.cs,.sql,.log"
                        @change="handleAppAttachmentChange"
                    />
                    <el-input
                        v-model="appPrompt"
                        type="textarea"
                        resize="none"
                        :autosize="{ minRows: 2, maxRows: 5 }"
                        placeholder="例如：把预约页面改成先选技师再选服务"
                        :disabled="appChatSending"
                        @keydown.enter.exact="handleAppChatEnter"
                    />
                    <div v-if="appSelectedFiles.length" class="app-attachment-list">
                        <span
                            v-for="(file, index) in appSelectedFiles"
                            :key="`${file.name}_${file.size}_${index}`"
                            class="attachment-chip"
                        >
                            <el-icon><Paperclip /></el-icon>
                            {{ file.name }}
                            <button type="button" @click="removeAppAttachment(index)">
                                <el-icon><CircleClose /></el-icon>
                            </button>
                        </span>
                    </div>
                    <div class="app-composer-footer">
                        <el-tooltip content="上传文件或图片" placement="top">
                            <el-button class="icon-action" text :icon="Paperclip" @click="triggerAppAttachmentPicker" />
                        </el-tooltip>
                        <el-select
                            v-model="currentAiModel"
                            value-key="Id"
                            filterable
                            :loading="modelLoading"
                            placeholder="选择模型"
                            class="app-model-select"
                        >
                            <el-option
                                v-for="model in aiModels"
                                :key="model.Id"
                                :label="formatModelName(model)"
                                :value="model"
                            />
                        </el-select>
                        <el-button
                            v-if="appChatSending"
                            class="stop-btn"
                            :icon="CircleClose"
                            @click="cancelAppChat"
                        >
                            停止
                        </el-button>
                        <el-button
                            v-else
                            class="app-send-btn"
                            type="primary"
                            :icon="Top"
                            :disabled="!canSendAppChat"
                            @click="sendAppChat"
                        />
                    </div>
                </div>
            </div>
        </aside>

        <section class="file-panel">
            <header>
                <strong>源码树</strong>
                <el-tag v-if="currentApp" size="small">{{ currentApp.AppType }}</el-tag>
            </header>
            <div v-if="!currentApp" class="empty-area">
                <span>请选择或创建一个AI应用</span>
            </div>
            <div v-else class="file-list source-tree-wrap">
                <el-tree
                    v-if="fileTreeData.length"
                    ref="fileTreeRef"
                    class="source-tree"
                    :data="fileTreeData"
                    node-key="key"
                    :props="{ children: 'children', label: 'label' }"
                    :expand-on-click-node="true"
                    :highlight-current="true"
                    @node-click="handleFileNodeClick"
                >
                    <template #default="{ data }">
                        <div class="source-tree-node" :class="{ active: activeFile?.FilePath === data.file?.FilePath }">
                            <el-icon v-if="data.isDirectory"><Folder /></el-icon>
                            <el-icon v-else><Document /></el-icon>
                            <span class="source-tree-name">{{ data.label }}</span>
                            <small v-if="!data.isDirectory">{{ formatFileSize(getFileSize(data.file)) }}</small>
                        </div>
                    </template>
                </el-tree>
                <el-empty v-else :image-size="76" description="暂无源码文件" />
            </div>
        </section>

        <main class="app-stage">
            <header class="stage-toolbar">
                <div class="stage-title">
                    <h3>{{ currentApp?.Name || "AI应用工作台" }}</h3>
                    <span v-if="currentApp">{{ currentApp.Description || "源代码存私有桶，发布文件存公有桶。" }}</span>
                    <span v-else>一个应用一条主记录，源码、版本、发布记录独立管理。</span>
                </div>
                <div class="stage-actions">
                    <el-button :disabled="!activeFile" @click="formatActiveFile">格式化</el-button>
                    <el-button :disabled="!activeFile" :loading="fileSaving" @click="saveActiveFile">保存源码</el-button>
                    <el-button :disabled="!currentApp" @click="downloadZip('source')">下载源码ZIP</el-button>
                    <el-button :disabled="!currentApp" @click="downloadZip('build')">下载编译ZIP</el-button>
                    <el-button :disabled="!currentApp" :loading="building" type="primary" @click="buildApp">运行/发布</el-button>
                    <el-button v-if="previewUrl" @click="copyPreviewUrl">复制预览地址</el-button>
                    <el-button v-if="previewUrl" tag="a" :href="previewUrl" target="_blank">打开预览</el-button>
                </div>
            </header>
            <div v-if="activeFile" class="active-file-meta">
                <span class="path">{{ activeFile.FilePath }}</span>
                <span>{{ formatFileSize(activeFileSize) }}</span>
                <span>创建：{{ formatMetaTime(activeFile.CreateTime || activeFile.CreateDate) }}</span>
                <span>修改：{{ formatMetaTime(activeFile.UpdateTime || activeFile.ModifyTime) }}</span>
            </div>
            <div v-if="currentApp" class="publish-meta">
                <span>应用Key：{{ currentApp.AppKey || "未生成" }}</span>
                <span v-if="previewUrl" class="url">{{ previewUrl }}</span>
            </div>

            <section v-if="currentApp" class="app-content">
                <div class="viewer-card">
                    <div class="viewer-tabs">
                        <button type="button" :class="{ active: activeView === 'preview' }" @click="activeView = 'preview'">
                            预览视图
                        </button>
                        <button type="button" :class="{ active: activeView === 'source' }" @click="activeView = 'source'">
                            源码视图
                        </button>
                        <button type="button" :class="{ active: activeView === 'versions' }" @click="activeView = 'versions'">
                            版本记录
                        </button>
                    </div>

                    <div v-show="activeView === 'preview'" v-loading="previewLoading" class="preview-pane">
                        <iframe v-if="previewHtml" :srcdoc="previewHtml" class="preview-frame"></iframe>
                        <iframe v-else-if="previewUrl" :src="previewUrl" class="preview-frame"></iframe>
                        <div v-else class="empty-area">
                            <p v-if="currentApp.AppType === 'UniApp'">
                                UniApp应用已生成源码，点击“运行/发布”后，服务端会生成 H5 预览版本并在这里展示。
                            </p>
                            <p v-else>点击“运行/发布”后，Web应用会发布到公有桶并在这里预览。</p>
                        </div>
                    </div>

                    <div v-show="activeView === 'source'" class="source-pane">
                        <DiyCodeEditor
                            v-if="activeFile"
                            v-model="activeContent"
                            :field="editorField"
                            :height="editorHeight"
                            FormMode="Edit"
                            v8CodeType="client"
                        />
                        <div v-else class="empty-area">
                            <p>选择左侧文件后可以在线查看、编辑源码。</p>
                        </div>
                    </div>

                    <div v-show="activeView === 'versions'" class="version-pane">
                        <el-table :data="versions" size="small" height="100%" border>
                            <el-table-column prop="VersionNo" label="版本" width="90" />
                            <el-table-column prop="Status" label="状态" width="120" />
                            <el-table-column prop="PreviewUrl" label="预览地址" min-width="220" show-overflow-tooltip />
                            <el-table-column prop="CreateTime" label="创建时间" width="170" />
                            <el-table-column prop="ChangeSummary" label="说明" min-width="220" show-overflow-tooltip />
                        </el-table>
                    </div>
                </div>

            </section>

            <div v-else class="empty-stage">
                <h3>开始创建第一个 AI 应用</h3>
                <p>Web应用可直接发布到公有桶预览；UniApp应用会在服务端生成 H5 预览版本，并保留完整源码和版本记录。</p>
                <el-button type="primary" @click="openCreate('UniApp')">创建美容美发预约UniApp应用</el-button>
            </div>
        </main>
        </template>

        <el-dialog v-model="createVisible" title="新建AI应用" width="520px">
            <el-form label-width="90px">
                <el-form-item label="应用类型">
                    <el-radio-group v-model="createForm.AppType">
                        <el-radio-button label="Web">Web网站</el-radio-button>
                        <el-radio-button label="UniApp">UniApp移动端</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="应用名称">
                    <el-input v-model="createForm.Name" placeholder="例如：美容美发预约UniApp应用" />
                </el-form-item>
                <el-form-item label="应用Key">
                    <el-input v-model="createForm.AppKey" placeholder="唯一英文Key，例如：beauty-booking" />
                </el-form-item>
                <el-form-item label="需求描述">
                    <el-input
                        v-model="createForm.Description"
                        type="textarea"
                        :rows="4"
                        placeholder="描述应用页面、接口引擎、交互和发布要求"
                    />
                </el-form-item>
                <el-form-item label="生成骨架">
                    <el-switch v-model="createForm.WithStarter" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="createVisible = false">取消</el-button>
                <el-button type="primary" :loading="creating" @click="createApp">创建</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { computed, defineAsyncComponent, getCurrentInstance, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useDiyStore } from "@/pinia";
import { Back, CircleClose, Cpu, Document, EditPen, Folder, Grid, Paperclip, Top, View } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { css as beautifyCss, html as beautifyHtml, js as beautifyJs } from "js-beautify";

const DiyCodeEditor = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-code-editor.vue"));
const props = defineProps({
    selectedAiModel: {
        type: Object,
        default: null
    },
    aiModels: {
        type: Array,
        default: () => []
    },
    modelLoading: {
        type: Boolean,
        default: false
    }
});
const emit = defineEmits(["update:selectedAiModel"]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;
const diyStore = useDiyStore();

const keyword = ref("");
const appViewMode = ref("gallery");
const appLoading = ref(false);
const previewingAppId = ref("");
const apps = ref([]);
const currentApp = ref(null);
const files = ref([]);
const versions = ref([]);
const activeFile = ref(null);
const activeContent = ref("");
const activeView = ref("source");
const fileSaving = ref(false);
const building = ref(false);
const previewUrl = ref("");
const previewHtml = ref("");
const previewLoading = ref(false);
const createVisible = ref(false);
const creating = ref(false);
const appPrompt = ref("");
const appChatMessages = ref([]);
const appChatSending = ref(false);
const appChatWrapRef = ref(null);
const appFileInputRef = ref(null);
const appSelectedFiles = ref([]);
const fileTreeRef = ref(null);
let appAbortController = null;

const createForm = reactive({
    AppType: "UniApp",
    Name: "美容美发预约UniApp应用",
    AppKey: "beauty-booking",
    Description: "面向美容美发门店的技师预约移动端应用，包含首页服务推荐、服务项目、技师列表、预约下单、个人中心等基础功能，接口统一预留吾码接口引擎调用。",
    WithStarter: true
});

const currentAiModel = computed({
    get() {
        return props.selectedAiModel || null;
    },
    set(value) {
        emit("update:selectedAiModel", value);
    }
});
const currentUser = computed(() => diyStore.GetCurrentUser || {});
const currentUserId = computed(() => String(currentUser.value?.Id || "").trim());
const editorHeight = computed(() => "calc(100vh - 250px)");
const editorField = computed(() => ({
    Id: activeFile.value?.Id || activeFile.value?.FilePath || "ai-app-file",
    Name: "SourceCode",
    Label: activeFile.value?.FilePath || "源码",
    Config: {
        CodeEditor: {
            Height: "620",
            Language: getEditorLanguage(activeFile.value?.FilePath || "")
        }
    }
}));
const activeFileSize = computed(() => getFileSize(activeFile.value, activeContent.value));
const fileTreeData = computed(() => buildFileTree(files.value));
const canSendAppChat = computed(() => (
    !appChatSending.value
    && currentApp.value
    && currentAiModel.value?.AiModel
    && (appPrompt.value.trim() || appSelectedFiles.value.length)
));

onMounted(loadApps);

watch(currentUserId, (value, oldValue) => {
    if (!value || value === oldValue) return;
    loadApps();
    if (currentApp.value?.Id) {
        loadAppChatHistory(currentApp.value.Id);
    }
});

function unwrapResult(result) {
    let current = result || {};
    if (current?.Data && typeof current.Data === "object" && current.Data.Code !== undefined) {
        current = current.Data;
    }
    if (current?.data && typeof current.data === "object" && current.data.Code !== undefined) {
        current = current.data;
    }
    return current;
}

function isOk(result) {
    const current = unwrapResult(result);
    return current && Number(current.Code ?? current.code) === 1;
}

function dataOf(result) {
    const current = unwrapResult(result);
    return current?.Data ?? current?.data ?? null;
}

function buildFileTree(fileRows = []) {
    const root = [];
    const dirMap = new Map();

    const ensureDir = (segments) => {
        let parentChildren = root;
        let currentPath = "";
        let currentNode = null;
        segments.forEach((segment) => {
            currentPath = currentPath ? `${currentPath}/${segment}` : segment;
            if (!dirMap.has(currentPath)) {
                const node = {
                    key: `dir:${currentPath}`,
                    label: segment,
                    isDirectory: true,
                    path: currentPath,
                    children: []
                };
                dirMap.set(currentPath, node);
                parentChildren.push(node);
            }
            currentNode = dirMap.get(currentPath);
            parentChildren = currentNode.children;
        });
        return currentNode;
    };

    (fileRows || [])
        .filter((item) => Number(item?.IsDirectory || 0) !== 1 && item?.FilePath)
        .forEach((file) => {
            const normalized = String(file.FilePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
            const parts = normalized.split("/").filter(Boolean);
            if (!parts.length) return;
            const fileName = parts.pop();
            const parent = parts.length ? ensureDir(parts) : null;
            const children = parent ? parent.children : root;
            children.push({
                key: `file:${normalized}`,
                label: fileName,
                isDirectory: false,
                path: normalized,
                file: { ...file, FilePath: normalized },
                children: []
            });
        });

    const sortTree = (nodes) => {
        nodes.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return String(a.label).localeCompare(String(b.label), "zh-CN");
        });
        nodes.forEach((node) => sortTree(node.children || []));
        return nodes;
    };

    return sortTree(root);
}

function handleFileNodeClick(data) {
    if (!data || data.isDirectory || !data.file) return;
    openFile(data.file);
}

function getFileSize(file, content) {
    const candidates = [
        file?.FileSize,
        file?.Size,
        file?.ContentLength,
        file?.Length,
        file?.FileByteSize,
        file?.FileBytes
    ];
    const value = candidates.map((item) => Number(item)).find((item) => Number.isFinite(item) && item >= 0);
    if (value !== undefined) return value;
    if (content !== undefined && content !== null) {
        return new Blob([String(content)]).size;
    }
    return 0;
}

function formatFileSize(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatMetaTime(value) {
    const text = String(value || "").trim();
    return text || "-";
}

async function runAiAppEngine(key, params = {}) {
    const result = await DiyCommon.ApiEngine.Run(key, {
        ...params,
        CurrentUserId: currentUserId.value,
        CurrentUserName: currentUser.value?.Name || currentUser.value?.Account || "",
        OsClient: DiyCommon.GetOsClient()
    });
    if (!isOk(result)) {
        const current = unwrapResult(result);
        throw new Error(current?.Msg || current?.msg || `${key} 执行失败`);
    }
    return dataOf(result);
}

async function loadApps() {
    appLoading.value = true;
    try {
        const list = await runAiAppEngine("ai_app_list", {
            Keyword: keyword.value,
            PageSize: 200
        });
        apps.value = normalizeAppList(Array.isArray(list) ? list : []);
        if (!currentApp.value && apps.value.length && appViewMode.value === "develop") {
            await selectApp(apps.value[0]);
        }
    } catch (error) {
        ElMessage.error(error.message || "加载AI应用失败");
    } finally {
        appLoading.value = false;
    }
}

function normalizeAppList(list) {
    const grouped = new Map();
    list.filter(isCurrentUserApp).forEach((app) => {
        const key = getAppGroupKey(app);
        const old = grouped.get(key);
        if (!old || appSortScore(app) > appSortScore(old)) {
            grouped.set(key, app);
        }
    });
    return Array.from(grouped.values()).sort((a, b) => appSortScore(b) - appSortScore(a));
}

function isCurrentUserApp(app) {
    const userKeys = [
        currentUser.value?.Id,
        currentUser.value?.Account,
        currentUser.value?.Name
    ].map((item) => String(item || "").trim()).filter(Boolean);
    if (!userKeys.length) return true;
    const ownerKeys = [
        app?.OwnerUserId,
        app?.UserId,
        app?.CreateUserId,
        app?.OwnerName,
        app?.CreateUser
    ].map((item) => String(item || "").trim()).filter(Boolean);
    if (!ownerKeys.length) return true;
    return ownerKeys.some((owner) => userKeys.includes(owner));
}

function getAppGroupKey(app) {
    const rootKey = String(app?.RootAppId || app?.MainAppId || app?.ParentAppId || "").trim();
    if (rootKey) return rootKey;
    const key = String(app?.AppId || app?.AppKey || app?.Name || app?.Id || "").trim();
    return normalizeGeneratedAppKey(key) || String(app?.Id || Math.random());
}

function normalizeGeneratedAppKey(value) {
    return String(value || "")
        .trim()
        .replace(/(?:验收|测试|预览)[a-z0-9_-]*$/i, "")
        .replace(/-(?:e2e|layout|preview|test|demo|build|version)-[a-z0-9]+$/i, "")
        .replace(/-v\d+$/i, "")
        .replace(/-{2,}/g, "-")
        .replace(/-$/g, "");
}

function appSortScore(app) {
    const time = Date.parse(String(app?.UpdateTime || app?.CreateTime || "").replace(/-/g, "/")) || 0;
    const version = Number(app?.CurrentVersion || app?.Version || 0);
    return time + version;
}

async function selectApp(app) {
    currentApp.value = app;
    previewUrl.value = normalizePreviewUrl(app.PreviewUrl || "");
    previewHtml.value = "";
    activeFile.value = null;
    activeContent.value = "";
    appChatMessages.value = [];
    try {
        const detail = await runAiAppEngine("ai_app_detail", { AppId: app.Id });
        const selected = detail?.App || app;
        currentApp.value = selected;
        previewUrl.value = normalizePreviewUrl(selected.PreviewUrl || "");
        await refreshPreviewHtml();
        files.value = detail?.Files || [];
        versions.value = detail?.Versions || [];
        const firstFile = files.value.find((item) => Number(item.IsDirectory || 0) !== 1);
        if (firstFile) await openFile(firstFile, { focusSource: false });
        if (previewUrl.value || previewHtml.value) {
            activeView.value = "preview";
        }
        await loadAppChatHistory(selected.Id);
    } catch (error) {
        ElMessage.error(error.message || "加载应用详情失败");
    }
}

async function enterDevelop(app) {
    appViewMode.value = "develop";
    await selectApp(app);
    if (previewUrl.value || previewHtml.value) {
        activeView.value = "preview";
    }
}

async function previewApp(app) {
    if (!app?.Id) return;
    previewingAppId.value = app.Id;
    const previewWindow = window.open("about:blank", "_blank");
    try {
        if (previewWindow && previewWindow.document) {
            previewWindow.document.write(buildPreviewMessageHtml("正在准备AI应用预览..."));
            previewWindow.document.close();
        }
        const url = await ensureAppPreviewUrl(app);
        if (!url) throw new Error("预览地址为空，请先运行/发布应用");
        if (previewWindow) {
            previewWindow.location.href = url;
        } else {
            window.open(url, "_blank");
        }
    } catch (error) {
        if (previewWindow) previewWindow.close();
        ElMessage.error(error.message || "打开预览失败");
    } finally {
        previewingAppId.value = "";
    }
}

async function ensureAppPreviewUrl(app) {
    let url = normalizePreviewUrl(app.PreviewUrl || "");
    if (!url || String(app.AppType || "").toLowerCase() === "uniapp") {
        const data = await runAiAppEngine("ai_app_build", { AppId: app.Id });
        url = normalizePreviewUrl(data?.PreviewUrl || url);
        await loadApps();
    }
    return url;
}

function backToGallery() {
    appViewMode.value = "gallery";
}

async function loadAppChatHistory(appId) {
    if (!appId) return;
    try {
        const result = await DiyCommon.FormEngine.GetTableData("mic_ai_record", {
            _Where: currentUserId.value ? [["UserId", "=", currentUserId.value]] : [],
            _OrderBy: "CreateTime",
            _OrderByType: "ASC",
            _PageSize: 100,
            _SelectFields: ["Id", "Content", "CreateTime"]
        });
        const rows = (result?.Data || result?.data || []).map((row) => parseChatRecord(row.Content || row.content))
            .filter((item) => item && item.Source === "ai-app-workbench" && item.ConversationId === `ai_app_${appId}`);
        appChatMessages.value = rows.map((item) => ({
            id: item.Id || makeId(item.Role === "user" ? "user" : "ai"),
            role: item.Role === "user" ? "user" : "assistant",
            content: item.Content || "",
            rawContent: item.RawContent || item.Content || "",
            thinking: item.Thinking || "",
            thinkingCollapsed: item.Role !== "user",
            attachments: Array.isArray(item.Attachments) ? item.Attachments : [],
            streaming: false,
            modelId: item.ModelId || item.AiModel || "",
            time: item.Time || ""
        }));
        scrollAppChat();
    } catch (error) {
        console.warn("[AiApp] load chat history failed", error);
    }
}

function parseChatRecord(content) {
    if (!content) return null;
    try {
        return typeof content === "string" ? JSON.parse(content) : content;
    } catch {
        return null;
    }
}

async function openFile(file, options = {}) {
    if (Number(file.IsDirectory || 0) === 1) return;
    const { focusSource = true } = options;
    activeFile.value = file;
    try {
        const data = await runAiAppEngine("ai_app_get_file", {
            AppId: currentApp.value.Id,
            FilePath: file.FilePath
        });
        activeContent.value = formatSourceCode(data?.Content || "", file.FilePath);
        activeFile.value = {
            ...file,
            ...(data || {}),
            FilePath: file.FilePath,
            FileSize: getFileSize(file, data?.Content || "")
        };
        if (focusSource) activeView.value = "source";
    } catch (error) {
        ElMessage.error(error.message || "读取文件失败");
    }
}

function formatActiveFile() {
    if (!activeFile.value) return;
    activeContent.value = formatSourceCode(activeContent.value, activeFile.value.FilePath);
    ElMessage.success("源码已格式化");
}

function formatSourceCode(content, filePath) {
    const value = String(content || "");
    const name = String(filePath || "").toLowerCase();
    const options = {
        indent_size: 2,
        indent_char: " ",
        preserve_newlines: true,
        max_preserve_newlines: 2,
        wrap_line_length: 120,
        end_with_newline: true
    };
    try {
        if (name.endsWith(".json")) {
            return JSON.stringify(JSON.parse(value), null, 2) + "\n";
        }
        if (name.endsWith(".css") || name.endsWith(".scss") || name.endsWith(".less")) {
            return beautifyCss(value, options);
        }
        if (name.endsWith(".html") || name.endsWith(".vue") || name.endsWith(".xml")) {
            return beautifyHtml(value, {
                ...options,
                wrap_attributes: "auto",
                extra_liners: []
            });
        }
        if (name.endsWith(".js") || name.endsWith(".ts") || name.endsWith(".mjs") || name.endsWith(".cjs")) {
            return beautifyJs(value, options);
        }
    } catch (error) {
        console.warn("[AiApp] format source failed", error);
    }
    return value;
}

function getEditorLanguage(filePath) {
    const name = String(filePath || "").toLowerCase();
    if (name.endsWith(".json")) return "json";
    if (name.endsWith(".css")) return "css";
    if (name.endsWith(".html") || name.endsWith(".vue")) return "html";
    if (name.endsWith(".sql")) return "sql";
    if (name.endsWith(".ts")) return "typescript";
    return "javascript";
}

function openCreate(type) {
    createForm.AppType = type;
    createForm.Name = type === "UniApp" ? "美容美发预约UniApp应用" : "AI Web应用";
    createForm.AppKey = makeAppKey(createForm.Name);
    createForm.Description = type === "UniApp"
        ? "面向美容美发门店的技师预约移动端应用，包含首页服务推荐、服务项目、技师列表、预约下单、个人中心等基础功能，接口统一预留吾码接口引擎调用。"
        : "";
    createForm.WithStarter = true;
    createVisible.value = true;
}

async function createApp() {
    if (!createForm.Name.trim()) {
        ElMessage.warning("请输入应用名称");
        return;
    }
    createForm.AppKey = String(createForm.AppKey || "").trim();
    if (createForm.AppKey && !/^[A-Za-z][A-Za-z0-9_-]{1,79}$/.test(createForm.AppKey)) {
        ElMessage.warning("应用Key必须以英文字母开头，只允许英文字母、数字、-、_");
        return;
    }
    creating.value = true;
    try {
        const data = await runAiAppEngine("ai_app_create", { ...createForm });
        createVisible.value = false;
        ElMessage.success("AI应用创建成功");
        await loadApps();
        const app = apps.value.find((item) => item.Id === data?.Id) || data;
        if (app?.Id) await enterDevelop(app);
    } catch (error) {
        ElMessage.error(error.message || "创建应用失败");
    } finally {
        creating.value = false;
    }
}

async function saveActiveFile() {
    if (!currentApp.value || !activeFile.value) return;
    fileSaving.value = true;
    try {
        const content = formatSourceCode(activeContent.value, activeFile.value.FilePath);
        activeContent.value = content;
        await runAiAppEngine("ai_app_save_file", {
            AppId: currentApp.value.Id,
            AppName: currentApp.value.Name,
            FilePath: activeFile.value.FilePath,
            Content: content
        });
        ElMessage.success("源码已保存");
        await selectApp(currentApp.value);
    } catch (error) {
        ElMessage.error(error.message || "保存文件失败");
    } finally {
        fileSaving.value = false;
    }
}

async function buildApp() {
    if (!currentApp.value) return;
    building.value = true;
    try {
        const data = await runAiAppEngine("ai_app_build", {
            AppId: currentApp.value.Id
        });
        previewUrl.value = normalizePreviewUrl(data?.PreviewUrl || previewUrl.value);
        await refreshPreviewHtml();
        if (previewUrl.value || previewHtml.value) activeView.value = "preview";
        ElMessage.success(data?.Message || "应用发布任务已处理");
        await loadApps();
        if (currentApp.value?.Id) {
            const app = apps.value.find((item) => item.Id === currentApp.value.Id) || currentApp.value;
            await selectApp(app);
        }
    } catch (error) {
        ElMessage.error(error.message || "运行/发布失败");
    } finally {
        building.value = false;
    }
}

async function downloadZip(kind) {
    if (!currentApp.value) return;
    try {
        const key = kind === "build" ? "ai_app_download_build_zip" : "ai_app_download_source_zip";
        const data = await runAiAppEngine(key, {
            AppId: currentApp.value.Id
        });
        const payload = normalizeDownloadPayload(data);
        if (!payload.FileByteBase64) {
            throw new Error("接口未返回ZIP文件内容");
        }
        const suffix = kind === "build" ? "build" : "source";
        const fileName = payload.FileName || `${safeFileName(currentApp.value.Name || currentApp.value.Id)}-${suffix}.zip`;
        downloadBase64File(payload.FileByteBase64, fileName, payload.ContentType || "application/zip");
        ElMessage.success(kind === "build" ? "编译ZIP已开始下载" : "源码ZIP已开始下载");
    } catch (error) {
        ElMessage.error(error.message || "下载ZIP失败");
    }
}

function normalizeDownloadPayload(data) {
    if (!data) return {};
    if (data.FileByteBase64 || data.fileByteBase64) {
        return {
            FileName: data.FileName || data.fileName,
            ContentType: data.ContentType || data.contentType,
            FileByteBase64: data.FileByteBase64 || data.fileByteBase64
        };
    }
    if (data.Data || data.data) {
        return normalizeDownloadPayload(data.Data || data.data);
    }
    return data;
}

function downloadBase64File(base64, fileName, contentType) {
    const byteCharacters = atob(String(base64 || ""));
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
    }
    const blob = new Blob(byteArrays, { type: contentType || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "ai-app.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
}

function safeFileName(value) {
    return String(value || "ai-app")
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, "_")
        .slice(0, 80);
}

function makeAppKey(value) {
    const raw = String(value || "ai-app")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-_]+|[-_]+$/g, "");
    const key = raw || "ai-app";
    return /^[a-z]/.test(key) ? key.slice(0, 80) : `app-${key}`.slice(0, 80);
}

function normalizePreviewUrl(url) {
    const value = String(url || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    const apiBase = String(DiyCommon.GetApiBase ? DiyCommon.GetApiBase() : "").replace(/\/$/, "");
    if (value.startsWith("/")) {
        return `${apiBase}${value}`;
    }
    return value;
}

async function refreshPreviewHtml(url = previewUrl.value) {
    previewHtml.value = "";
    const target = normalizePreviewUrl(url);
    previewUrl.value = target;
    if (!target || /^data:|^blob:/i.test(target)) return;
    previewLoading.value = true;
    try {
        const response = await fetch(target, {
            headers: {
                authorization: DiyCommon.getToken() ? `Bearer ${DiyCommon.getToken()}` : "",
                lang: DiyCommon.GetCurrentLang ? DiyCommon.GetCurrentLang() : "zh-CN"
            }
        });
        const html = await response.text();
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        previewHtml.value = normalizePreviewHtml(html, target);
    } catch (error) {
        previewHtml.value = "";
        console.warn("[AiApp] preview fetch failed, fallback to iframe src", error);
    } finally {
        previewLoading.value = false;
    }
}

async function copyPreviewUrl() {
    if (!previewUrl.value) return;
    try {
        await navigator.clipboard.writeText(previewUrl.value);
        ElMessage.success("预览地址已复制");
    } catch {
        ElMessage.warning("复制失败，请手动复制预览地址");
    }
}

function buildPreviewMessageHtml(message) {
    const text = escapeHtml(String(message || ""));
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#344054;display:grid;place-items:center;min-height:100vh}.box{padding:22px 26px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.08)}</style></head><body><div class="box">${text}</div></body></html>`;
}

function normalizePreviewHtml(html, baseUrl) {
    const raw = String(html || "").trim();
    const content = isEncodedHtml(raw) ? decodeHtmlEntities(raw) : raw;
    if (!content) return buildPreviewMessageHtml("预览内容为空");
    const base = `<base href="${escapeHtml(getPreviewBaseHref(baseUrl))}">`;
    if (/<head[^>]*>/i.test(content) && !/<base\s/i.test(content)) {
        return content.replace(/<head([^>]*)>/i, `<head$1>${base}`);
    }
    if (/<!doctype html>|<html[\s>]/i.test(content)) return content;
    return `<!doctype html><html><head><meta charset="utf-8">${base}</head><body>${content}</body></html>`;
}

function isEncodedHtml(text) {
    return /^&lt;!doctype/i.test(text) || /^&lt;html[\s&]/i.test(text) || /&lt;(head|body|style|script|div|view|template)[\s&>]/i.test(text);
}

function decodeHtmlEntities(text) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
}

function getPreviewBaseHref(baseUrl) {
    try {
        return new URL(".", baseUrl).href;
    } catch {
        return baseUrl;
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function handleAppChatEnter(event) {
    if (event.shiftKey) return;
    event.preventDefault();
    sendAppChat();
}

async function sendAppChat() {
    const text = appPrompt.value.trim();
    if (!canSendAppChat.value) return;
    const attachmentPayload = await readAppAttachments();
    const attachmentMeta = appSelectedFiles.value.map((file) => ({
        FileName: file.name,
        ContentType: file.type || "application/octet-stream",
        Size: file.size
    }));
    const modelId = currentAiModel.value.AiModel;
    const time = new Date().toTimeString().slice(0, 5);
    const userMessage = {
        id: makeId("user"),
        role: "user",
        content: text || "请分析这些附件",
        attachments: attachmentMeta,
        modelId,
        time
    };
    const assistantMessage = {
        id: makeId("ai"),
        role: "assistant",
        content: "",
        rawContent: "",
        thinking: "",
        thinkingCollapsed: true,
        streaming: true,
        modelId,
        time
    };
    appChatMessages.value.push(userMessage, assistantMessage);
    appPrompt.value = "";
    appSelectedFiles.value = [];
    appChatSending.value = true;
    let assistantSaved = false;
    scrollAppChat();
    try {
        await saveAppChatMessage(userMessage);
        appAbortController = new AbortController();
        const response = await fetch(`${DiyCommon.GetApiBase()}/api/Ai/ChatStream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                authorization: DiyCommon.getToken() ? `Bearer ${DiyCommon.getToken()}` : "",
                lang: DiyCommon.GetCurrentLang ? DiyCommon.GetCurrentLang() : "zh-CN"
            },
            body: JSON.stringify({
                UserChatMsg: userMessage.content,
                SystemChatMsg: buildAppChatPrompt(),
                AiModel: modelId,
                OsClient: DiyCommon.GetOsClient(),
                ConversationId: `ai_app_${currentApp.value.Id}`,
                Source: "ai-app-workbench",
                Mode: "project",
                Attachments: attachmentPayload
            }),
            signal: appAbortController.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        await readChatSse(response, assistantMessage);
        await saveAppChatMessage(assistantMessage);
        assistantSaved = true;
    } catch (error) {
        if (error?.name === "AbortError") {
            assistantMessage.content = assistantMessage.content || "已停止生成。";
        } else {
            assistantMessage.content = error?.message || "AI应用对话失败";
        }
    } finally {
        if (!assistantMessage.content) {
            assistantMessage.content = "AI 暂无可显示内容，请稍后重试或切换模型。";
        }
        assistantMessage.streaming = false;
        if (!assistantSaved) {
            await saveAppChatMessage(assistantMessage);
        }
        appChatSending.value = false;
        appAbortController = null;
        scrollAppChat();
    }
}

function cancelAppChat() {
    if (appAbortController) {
        appAbortController.abort();
    }
}

function triggerAppAttachmentPicker() {
    appFileInputRef.value?.click();
}

function handleAppAttachmentChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    appSelectedFiles.value = [...appSelectedFiles.value, ...files].slice(0, 10);
    event.target.value = "";
}

function removeAppAttachment(index) {
    appSelectedFiles.value.splice(index, 1);
}

async function readAppAttachments() {
    const filesToRead = appSelectedFiles.value.slice(0, 10);
    const result = [];
    for (const file of filesToRead) {
        const item = {
            FileName: file.name,
            ContentType: file.type || "application/octet-stream",
            Size: file.size
        };
        if (file.type && file.type.startsWith("image/")) {
            const dataUrl = await fileToDataUrl(file);
            item.FileByteBase64 = dataUrl.split(",")[1] || "";
        } else if (isTextFile(file)) {
            const text = await file.text();
            item.Text = text.slice(0, 512 * 1024);
            if (text.length > item.Text.length) {
                item.Text += "\n\n[文件较大，已截断前512KB内容]";
            }
        } else {
            item.Text = `[附件：${file.name}，${formatFileSize(file.size)}，当前模型可根据文件名和类型推断需求；如需解析二进制，请改为上传图片或文本文件。]`;
        }
        result.push(item);
    }
    return result;
}

function isTextFile(file) {
    const name = String(file.name || "").toLowerCase();
    return /^text\//.test(file.type || "")
        || [".txt", ".md", ".json", ".csv", ".xml", ".yaml", ".yml", ".js", ".ts", ".vue", ".cs", ".sql", ".log"].some((suffix) => name.endsWith(suffix));
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function saveAppChatMessage(message) {
    if (!currentApp.value) return;
    try {
        await DiyCommon.FormEngine.AddFormData("mic_ai_record", {
            AiModelId: currentAiModel.value?.Id || "",
            AiModel: currentAiModel.value?.AiModel || "",
            Content: JSON.stringify({
                Source: "ai-app-workbench",
                ConversationId: `ai_app_${currentApp.value.Id}`,
                AppId: currentApp.value.Id,
                AppName: currentApp.value.Name,
                Role: message.role,
                Mode: "project",
                Content: message.content || "",
                RawContent: message.rawContent || message.content || "",
                Thinking: message.thinking || "",
                Attachments: message.attachments || [],
                ModelId: message.modelId || currentAiModel.value?.AiModel || "",
                AiModel: currentAiModel.value?.AiModel || "",
                Time: message.time || new Date().toTimeString().slice(0, 5),
                CreatedAt: new Date().toISOString()
            })
        });
    } catch (error) {
        console.warn("[AiApp] save chat message failed", error);
    }
}

function buildAppChatPrompt() {
    const fileNames = files.value.map((item) => item.FilePath).slice(0, 80).join("\n");
    return [
        "你是 Microi 吾码 AI 应用开发助手。",
        "用户正在编辑一个线上 AI 应用，应用源码存储在 mci_ai_app_file 和 HDFS 私有桶中，发布文件存公有桶。",
        `应用名称：${currentApp.value?.Name || ""}`,
        `应用类型：${currentApp.value?.AppType || ""}`,
        `应用描述：${currentApp.value?.Description || ""}`,
        "如果需要修改源码，请明确指出要修改的文件和建议内容；不要声称已经直接写入，除非前端提供保存动作。",
        "当前源码文件：",
        fileNames || "暂无文件"
    ].join("\n");
}

async function readChatSse(response, message) {
    const reader = response.body?.getReader();
    if (!reader) {
        message.content = await response.text();
        return;
    }
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let eventName = "";
    let dataLines = [];
    const dispatch = () => {
        if (!eventName && dataLines.length === 0) return;
        const data = dataLines.join("\n");
        dataLines = [];
        if (eventName === "message") {
            applyAppStreamText(message, (message.rawContent || "") + data);
            scrollAppChat();
        } else if (eventName === "result") {
            if (!message.content && data) {
                try {
                    const parsed = JSON.parse(data);
                    applyAppStreamText(message, typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
                } catch {
                    applyAppStreamText(message, data);
                }
                scrollAppChat();
            }
        } else if (eventName === "error") {
            throw new Error(data || "AI对话失败");
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
}

function applyAppStreamText(message, rawText) {
    const parts = splitThinkingText(rawText || "");
    message.rawContent = rawText || "";
    message.thinking = parts.thinking;
    message.content = parts.answer;
    if (!message.content && !message.thinking && rawText) {
        message.content = rawText;
    }
}

function splitThinkingText(text) {
    const value = String(text || "");
    const thinkMatch = value.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
    if (!thinkMatch) {
        return { thinking: "", answer: value };
    }
    const thinking = (thinkMatch[1] || "").trim();
    const answer = value.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, "").trim();
    return { thinking, answer };
}

function thinkingParagraphCount(text) {
    return String(text || "").split(/\n\s*\n|\n/).filter((item) => item.trim()).length || 1;
}

function formatModelName(model) {
    if (!model) return "";
    const name = model.Name || model.AiName || "";
    const key = model.AiModel || "";
    return name && key && name !== key ? `${name} (${key})` : (name || key);
}

function scrollAppChat() {
    nextTick(() => {
        if (appChatWrapRef.value) {
            appChatWrapRef.value.scrollTop = appChatWrapRef.value.scrollHeight;
        }
    });
}
</script>

<style scoped>
.ai-app-workbench {
    height: calc(100vh - 150px);
    min-height: 560px;
    display: grid;
    grid-template-columns: minmax(380px, 430px) 300px minmax(0, 1fr);
    gap: 12px;
    background: #f7f9fc;
}

.ai-app-workbench.is-gallery {
    display: block;
    overflow: auto;
    padding: 14px;
}

.app-gallery {
    min-height: 100%;
}

.app-gallery-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 14px;
    padding: 18px 20px;
    border: 1px solid #e8edf5;
    border-radius: 8px;
    background: linear-gradient(135deg, #fff, #fff6f1);
}

.gallery-title {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}

.gallery-title .el-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 8px;
    background: #ff5f2e;
    color: #fff;
    font-size: 20px;
}

.gallery-title strong {
    display: block;
    color: #1f2937;
    font-size: 20px;
}

.gallery-title span {
    display: block;
    margin-top: 4px;
    color: #7a8599;
}

.gallery-tools {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
}

.gallery-tools .el-input {
    width: 240px;
}

.app-gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;
    min-height: 320px;
}

.app-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 226px;
    padding: 16px;
    border: 1px solid #e8edf5;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 10px 30px rgba(15, 23, 42, .04);
    cursor: default;
    transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
}

.app-card:hover,
.app-card.active {
    border-color: rgba(255, 95, 46, .32);
    box-shadow: 0 14px 34px rgba(255, 95, 46, .1);
    transform: translateY(-1px);
}

.app-card-top,
.app-card-meta,
.app-card-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.app-card-top span,
.app-card-meta span {
    color: #98a2b3;
    font-size: 12px;
}

.app-card h4 {
    margin: 0;
    color: #20242c;
    font-size: 16px;
}

.app-card p {
    flex: 1;
    margin: 0;
    color: #697386;
    line-height: 1.6;
}

.app-card-meta strong {
    min-width: 0;
    overflow: hidden;
    color: #344054;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.app-card-actions {
    justify-content: flex-end;
    margin-top: 4px;
}

.app-panel,
.file-panel,
.app-stage,
.viewer-card,
.app-chat {
    min-width: 0;
    background: #fff;
    border: 1px solid #e8edf5;
    border-radius: 8px;
    overflow: hidden;
}

.app-panel,
.file-panel,
.app-stage {
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.ai-app-workbench.is-develop .develop-chat-panel {
    height: 100%;
    min-height: 0;
    min-width: 0;
}

.app-develop-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-bottom: 1px solid #edf1f7;
    background: #fffaf7;
}

.app-develop-head > div {
    min-width: 0;
}

.app-develop-head strong,
.app-develop-head span {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.app-develop-head span {
    margin-top: 3px;
    color: #8a93a3;
    font-size: 12px;
}

.back-gallery {
    flex: 0 0 auto;
}

.app-toolbar,
.app-create,
.file-panel header,
.stage-toolbar,
.app-chat-header,
.app-chat-composer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-bottom: 1px solid #edf1f7;
}

.app-create {
    flex-wrap: wrap;
}

.app-list,
.file-list {
    min-height: 0;
    overflow: auto;
    padding: 8px;
}

.app-list {
    flex: 0 1 230px;
}

.app-item,
.file-item {
    width: 100%;
    border: 0;
    background: transparent;
    border-radius: 6px;
    text-align: left;
    cursor: pointer;
}

.app-item {
    padding: 11px 10px;
}

.app-item strong,
.app-item span {
    display: block;
}

.app-item span {
    margin-top: 4px;
    color: #8a93a3;
    font-size: 12px;
}

.app-item.active,
.app-item:hover,
.file-item.active,
.file-item:hover {
    background: #fff2ed;
    color: #ff5f2e;
}

.file-item {
    display: flex;
    gap: 6px;
    align-items: center;
    min-height: 30px;
    padding: 6px 8px;
}

.file-item em {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-style: normal;
}

.source-tree-wrap {
    flex: 1;
}

.source-tree {
    --el-tree-node-hover-bg-color: #fff2ed;
    background: transparent;
    color: #344054;
}

.source-tree :deep(.el-tree-node__content) {
    min-height: 32px;
    border-radius: 6px;
    padding-right: 6px;
}

.source-tree-node {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
}

.source-tree-node.active {
    color: #ff5f2e;
}

.source-tree-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.source-tree-node small {
    color: #98a2b3;
    font-size: 11px;
}

.stage-toolbar {
    min-height: 62px;
    justify-content: space-between;
}

.active-file-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 34px;
    padding: 0 12px;
    border-bottom: 1px solid #edf1f7;
    color: #7a8599;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
}

.active-file-meta .path {
    min-width: 0;
    max-width: 46%;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #344054;
    font-weight: 600;
}

.publish-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 34px;
    padding: 0 12px;
    border-bottom: 1px solid #edf1f7;
    background: #fffaf7;
    color: #7a8599;
    font-size: 12px;
    white-space: nowrap;
}

.publish-meta .url {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #ff5f2e;
}

.stage-title {
    min-width: 0;
}

.stage-title h3 {
    margin: 0;
    font-size: 16px;
}

.stage-title span {
    display: block;
    margin-top: 4px;
    color: #8a93a3;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.stage-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
}

.app-content {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
}

.viewer-card,
.app-chat {
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.viewer-tabs {
    display: flex;
    gap: 8px;
    padding: 10px;
    border-bottom: 1px solid #edf1f7;
}

.viewer-tabs button {
    height: 30px;
    border: 1px solid #e5eaf2;
    border-radius: 6px;
    background: #fff;
    color: #596273;
    cursor: pointer;
    padding: 0 12px;
}

.viewer-tabs button.active {
    border-color: rgba(255, 95, 46, .28);
    background: #fff2ed;
    color: #ff5f2e;
}

.preview-pane,
.source-pane,
.version-pane {
    flex: 1;
    min-height: 0;
    height: 100%;
    background: #f8fafc;
}

.preview-frame {
    width: 100%;
    height: 100%;
    border: 0;
    background: #fff;
}

.empty-area,
.empty-stage {
    display: grid;
    place-items: center;
    min-height: 260px;
    color: #98a2b3;
    text-align: center;
    padding: 24px;
}

.empty-stage {
    flex: 1;
    align-content: center;
    gap: 12px;
}

.empty-stage h3,
.empty-stage p {
    margin: 0;
}

.app-chat-header {
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 1px solid #edf1f7;
}

.app-chat-header small {
    display: block;
    margin-top: 3px;
    color: #98a2b3;
    max-width: 210px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.app-chat-messages {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 12px;
}

.app-chat-message {
    margin-bottom: 12px;
}

.app-message-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

.app-message-meta strong {
    color: #333946;
    font-size: 13px;
}

.app-message-meta small {
    color: #98a2b3;
}

.app-chat-message pre {
    margin: 5px 0 0;
    border-radius: 8px;
    background: #f4f6fa;
    color: #303642;
    font-family: inherit;
    white-space: pre-wrap;
    word-break: break-word;
    padding: 9px 10px;
}

.app-chat-message.is-assistant pre {
    background: #fff6f2;
}

.app-thinking {
    margin-top: 6px;
    border: 1px solid #edf1f7;
    border-radius: 8px;
    overflow: hidden;
    background: #fafcff;
}

.app-thinking button {
    width: 100%;
    height: 30px;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 0;
    background: transparent;
    color: #667085;
    cursor: pointer;
    padding: 0 9px;
    text-align: left;
}

.app-thinking button small {
    margin-left: auto;
}

.app-thinking pre {
    margin: 0;
    max-height: 140px;
    overflow: auto;
    border-top: 1px solid #edf1f7;
    background: #f8fafc;
    color: #667085;
}

.app-thinking-placeholder {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 8px;
    color: #98a2b3;
}

.app-thinking-placeholder span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ff7a45;
    animation: app-thinking-bounce 1s infinite ease-in-out;
}

.app-thinking-placeholder span:nth-child(2) {
    animation-delay: .16s;
}

.app-thinking-placeholder span:nth-child(3) {
    animation-delay: .32s;
}

.app-thinking-placeholder em {
    font-style: normal;
}

@keyframes app-thinking-bounce {
    0%, 80%, 100% {
        opacity: .35;
        transform: translateY(0);
    }
    40% {
        opacity: 1;
        transform: translateY(-3px);
    }
}

.app-chat-attachments,
.app-attachment-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
}

.attachment-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    min-height: 24px;
    border: 1px solid #edf1f7;
    border-radius: 999px;
    background: #fff;
    color: #667085;
    font-size: 12px;
    padding: 0 8px;
}

.attachment-chip button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: 0;
    background: transparent;
    color: #98a2b3;
    cursor: pointer;
    padding: 0;
}

.attachment-chip.readonly {
    border-radius: 6px;
}

.app-chat-empty {
    color: #9aa2af;
    line-height: 1.7;
}

.app-chat-composer {
    align-items: flex-end;
    flex: 0 0 auto;
    border-top: 1px solid #edf1f7;
    border-bottom: 0;
    background: #fff;
}

.app-chat-composer .el-button {
    flex: 0 0 auto;
}

.app-chat-in-panel {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    margin: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
}

.app-chat-in-panel .app-chat-composer {
    align-items: stretch;
    flex-direction: column;
    padding: 10px;
}

.app-chat-in-panel .app-chat-messages {
    flex: 1 1 auto;
    min-height: 0;
}

.app-composer-footer {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
}

.attachment-input {
    display: none;
}

.icon-action {
    width: 32px;
    height: 32px;
}

.app-model-select {
    width: 100%;
}

.app-send-btn {
    width: 34px;
    height: 34px;
    min-width: 34px;
    border-radius: 50%;
    padding: 0;
}

.stop-btn {
    height: 34px;
}

@media (max-width: 1280px) {
    .ai-app-workbench {
        grid-template-columns: minmax(360px, 420px) minmax(0, 1fr);
    }

    .file-panel {
        display: none;
    }
}

@media (max-width: 920px) {
    .ai-app-workbench {
        height: auto;
        grid-template-columns: 1fr;
    }

    .app-content {
        grid-template-columns: 1fr;
    }

    .app-panel,
    .app-stage {
        min-height: 420px;
    }

    .stage-toolbar {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
