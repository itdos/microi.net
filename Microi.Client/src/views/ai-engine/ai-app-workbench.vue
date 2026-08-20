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
                    <el-button size="small" @click="openCreate('MicroService')">新建微服务</el-button>
                </div>
            </header>
            <div class="app-gallery-grid" v-mci-loading:cards="appLoading">
                <article
                    v-for="app in pagedApps"
                    :key="app.Id"
                    class="app-card"
                    :class="{ active: currentApp?.Id === app.Id }"
                    @dblclick="enterDevelop(app)"
                >
                    <div class="app-card-top">
                        <el-tag size="small" effect="dark">{{ appTypeLabel(app.AppType || "Web") }}</el-tag>
                        <span>{{ formatVersionNo(getAppCurrentVersion(app)) }}</span>
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
            <el-pagination
                v-if="apps.length > appPageSize"
                v-model:current-page="appPageIndex"
                class="app-gallery-pagination"
                background
                layout="total, prev, pager, next"
                :page-size="appPageSize"
                :total="apps.length"
            />
        </section>

        <template v-else>
        <aside class="app-panel develop-chat-panel">
            <div class="app-develop-head">
                <el-button class="back-gallery" text :icon="Back" @click="backToGallery">应用商城</el-button>
                <div>
                    <strong>{{ currentApp?.Name || "应用开发" }}</strong>
                    <span>{{ appTypeLabel(currentApp?.AppType || "") }} · {{ currentApp?.AppKey || currentApp?.Id || "-" }}</span>
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
                            :loading="effectiveModelLoading"
                            placeholder="选择模型"
                            class="app-model-select"
                        >
                            <el-option
                                v-for="model in effectiveAiModels"
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
                <div class="file-tree-title">
                    <strong>{{ fileTreeMode === 'build' ? '编译代码树' : '源码树' }}</strong>
                    <el-tag v-if="currentApp" size="small">{{ appTypeLabel(currentApp.AppType) }}</el-tag>
                </div>
                <el-segmented
                    v-if="currentApp"
                    v-model="fileTreeMode"
                    :options="fileTreeModeOptions"
                    size="small"
                    @change="switchFileTreeMode"
                />
            </header>
            <div v-if="!currentApp" class="empty-area">
                <span>请选择或创建一个AI应用</span>
            </div>
            <div v-else class="file-list source-tree-wrap">
                <el-tree
                    v-if="visibleFileTreeData.length"
                    ref="fileTreeRef"
                    class="source-tree"
                    :data="visibleFileTreeData"
                    node-key="key"
                    :props="{ children: 'children', label: 'label' }"
                    :expand-on-click-node="true"
                    :highlight-current="true"
                    @node-click="handleFileNodeClick"
                >
                    <template #default="{ data }">
                        <div class="source-tree-node" :class="{ active: currentTreeFile?.FilePath === data.file?.FilePath }">
                            <el-icon v-if="data.isDirectory"><Folder /></el-icon>
                            <el-icon v-else><Document /></el-icon>
                            <span class="source-tree-name">{{ data.label }}</span>
                            <small v-if="!data.isDirectory">{{ formatFileSize(getFileSize(data.file)) }}</small>
                        </div>
                    </template>
                </el-tree>
                <el-empty
                    v-else
                    :image-size="76"
                    :description="fileTreeMode === 'build'
                        ? (buildFilesUnavailableReason || '暂无编译文件')
                        : (sourceFilesUnavailableReason || '暂无源码文件')"
                />
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
                    <el-select
                        v-if="sortedVersions.length"
                        v-model="selectedVersionKey"
                        size="small"
                        class="version-select"
                        placeholder="选择版本"
                        @change="selectVersionByKey"
                    >
                        <el-option
                            v-for="item in sortedVersions"
                            :key="versionKey(item)"
                            :label="versionLabel(item)"
                            :value="versionKey(item)"
                        />
                    </el-select>
                    <el-button :disabled="!currentEditorFile" :loading="fileSaving" @click="saveCurrentFile">
                        {{ fileTreeMode === 'build' ? '保存编译文件' : '保存源码' }}
                    </el-button>
                    <el-button :disabled="!currentApp" @click="downloadZip('source')">下载源码ZIP</el-button>
                    <el-button :disabled="!currentApp" @click="downloadZip('build')">下载编译ZIP</el-button>
                    <el-button :disabled="!currentApp" :loading="building" type="primary" @click="buildApp">运行/发布</el-button>
                    <el-button :disabled="!currentApp" :loading="packaging" @click="makeOfflinePackage">制作离线包</el-button>
                    <el-button v-if="previewUrl" @click="copyPreviewUrl">复制预览地址</el-button>
                    <el-button v-if="previewUrl" tag="a" :href="previewUrl" target="_blank">打开预览</el-button>
                </div>
            </header>
            <div v-if="currentEditorFile" class="active-file-meta">
                <span class="path">{{ currentEditorFile.FilePath }}</span>
                <span>{{ formatFileSize(currentEditorFileSize) }}</span>
                <span v-if="fileTreeMode !== 'build'">创建：{{ formatMetaTime(currentEditorFile.CreateTime || currentEditorFile.CreateDate) }}</span>
                <span v-if="fileTreeMode !== 'build'">修改：{{ formatMetaTime(currentEditorFile.UpdateTime || currentEditorFile.ModifyTime) }}</span>
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
                        <button type="button" :class="{ active: activeView === 'source' || activeView === 'build' }" @click="showCodeView">
                            代码视图
                        </button>
                        <button type="button" :class="{ active: activeView === 'versions' }" @click="activeView = 'versions'">
                            版本记录
                        </button>
                    </div>

                    <div v-show="activeView === 'preview'" v-mci-loading:page="previewLoading" class="preview-pane">
                        <div v-if="previewUrl" class="preview-toolbar">
                            <span>预览设备</span>
                            <el-radio-group v-model="previewDeviceMode" size="small">
                                <el-radio-button value="desktop">PC端</el-radio-button>
                                <el-radio-button value="mobile">移动端</el-radio-button>
                            </el-radio-group>
                        </div>
                        <div v-if="previewUrl" class="preview-canvas" :class="`is-${previewDeviceMode}`">
                            <micro-app
                                v-if="isMicroServicePreview"
                                :key="previewMicroAppKey"
                                class="preview-frame preview-micro-app"
                                :name="previewMicroAppName"
                                :url="previewMicroAppEntryUrl"
                                :data="previewMicroAppData"
                                :default-page="previewMicroRoute"
                                router-mode="pure"
                                iframe
                            />
                            <iframe v-else :src="previewUrl" class="preview-frame"></iframe>
                        </div>
                        <div v-else class="empty-area">
                            <p v-if="currentApp.AppType === 'UniApp'">
                                UniApp应用已生成源码，点击“运行/发布”后，服务端会生成 H5 预览版本并在这里展示。
                            </p>
                            <p v-else-if="currentApp.AppType === 'MicroService'">
                                微服务源码可由在线 AI、MCP 或 VS Code 共同维护；点击“运行/发布”会生成在线预览并同步 MicroApp 运行元数据。
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
                            <p>{{ files.length ? '选择左侧文件后可以在线查看、编辑源码。' : sourceFilesUnavailableReason }}</p>
                        </div>
                    </div>

                    <div v-show="activeView === 'build'" class="source-pane build-pane">
                        <DiyCodeEditor
                            v-if="activeBuildFile"
                            v-model="activeBuildContent"
                            :field="editorField"
                            :height="editorHeight"
                            FormMode="Edit"
                            v8CodeType="client"
                        />
                        <div v-else class="empty-area">
                            <p>{{ buildFiles.length ? '请在左侧编译代码树中选择文件。' : (buildFilesUnavailableReason || '当前应用还没有可查看的编译产物。') }}</p>
                        </div>
                    </div>

                    <div v-show="activeView === 'versions'" class="version-pane">
                        <el-table :data="sortedVersions" size="small" height="100%" border @row-click="selectVersion">
                            <el-table-column label="版本" width="100">
                                <template #default="scope">{{ formatVersionNo(getAppCurrentVersion(scope.row)) }}</template>
                            </el-table-column>
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
                <p>支持 Web、UniApp 和微服务三类在线应用；微服务源码还可与 VS Code 双向衔接，并作为页面或弹窗运行。</p>
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
                        <el-radio-button label="MicroService">微服务</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="应用名称">
                    <el-input v-model="createForm.Name" placeholder="例如：美容美发预约UniApp应用" />
                </el-form-item>
                <el-form-item label="应用Key">
                    <el-input v-model="createForm.AppKey" placeholder="唯一英文Key，例如：beauty-booking" />
                </el-form-item>
                <el-form-item label="应用分类">
                    <el-select v-model="createForm.Category" style="width: 100%">
                        <el-option
                            v-for="item in appCategoryOptions"
                            :key="item.value"
                            :label="item.label"
                            :value="item.value"
                        />
                    </el-select>
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
import { useRoute, useRouter } from "vue-router";
import { useDiyStore } from "@/pinia";
import { Back, CircleClose, Cpu, Document, EditPen, Folder, Grid, Paperclip, Top, View } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

const DiyCodeEditor = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-code-editor.vue"));
const props = defineProps({
    selectedAiModel: {
        type: Object,
        default: null
    },
    selectedRelayModel: {
        type: String,
        default: ""
    },
    aiModels: {
        type: Array,
        default: () => []
    },
    modelLoading: {
        type: Boolean,
        default: false
    },
    mode: {
        type: String,
        default: "auto",
        validator: (value) => ["auto", "gallery", "detail"].includes(value)
    },
    standalone: {
        type: Boolean,
        default: false
    }
});
const emit = defineEmits(["update:selectedAiModel"]);

const componentInstance = getCurrentInstance();
const { proxy } = componentInstance;
const routeCoordinatorKey = Symbol.for("microi.ai-app-workbench.route-coordinator");
const routeCoordinator = globalThis[routeCoordinatorKey] || (globalThis[routeCoordinatorKey] = { token: null });
const DiyCommon = proxy.DiyCommon;
const diyStore = useDiyStore();
const route = useRoute();
const router = useRouter();

const keyword = ref("");
const appViewMode = ref(props.mode === "detail" || route.params.appId || route.query.appId ? "develop" : "gallery");
const appLoading = ref(false);
const previewingAppId = ref("");
const apps = ref([]);
const appPageIndex = ref(1);
const appPageSize = 12;
const currentApp = ref(null);
const files = ref([]);
const versions = ref([]);
const activeFile = ref(null);
const activeContent = ref("");
const buildFiles = ref([]);
const buildFilesUnavailableReason = ref("");
const activeBuildFile = ref(null);
const activeBuildContent = ref("");
const fileTreeMode = ref("source");
const fileTreeModeOptions = [
    { label: "源码", value: "source" },
    { label: "编译", value: "build" }
];
const activeView = ref("source");
const selectedVersionKey = ref("");
const fileSaving = ref(false);
const building = ref(false);
const packaging = ref(false);
const previewUrl = ref("");
const previewLoading = ref(false);
const previewDeviceMode = ref("desktop");
const selectedPreviewRoute = ref("");
const createVisible = ref(false);
const creating = ref(false);
const appPrompt = ref("");
const appChatMessages = ref([]);
const appChatSending = ref(false);
const appChatWrapRef = ref(null);
const appFileInputRef = ref(null);
const appSelectedFiles = ref([]);
const fileTreeRef = ref(null);
const localAiModels = ref([]);
const localSelectedAiModel = ref(null);
const localRelayModel = ref("");
const localModelLoading = ref(false);
const runtimePages = ref([]);
let appAbortController = null;

const createForm = reactive({
    AppType: "UniApp",
    Category: "business",
    Name: "美容美发预约UniApp应用",
    AppKey: "beauty-booking",
    Description: "面向美容美发门店的技师预约移动端应用，包含首页服务推荐、服务项目、技师列表、预约下单、个人中心等基础功能，接口统一预留吾码接口引擎调用。",
    WithStarter: true
});
const appCategoryOptions = [
    { label: "游戏", value: "game" },
    { label: "企业应用", value: "business" },
    { label: "办公协同", value: "office" },
    { label: "教育学习", value: "education" },
    { label: "效率工具", value: "tools" },
    { label: "生活服务", value: "lifestyle" },
    { label: "创意设计", value: "creative" },
    { label: "数据分析", value: "data" },
    { label: "营销运营", value: "marketing" },
    { label: "其它", value: "other" }
];

const currentAiModel = computed({
    get() {
        return props.selectedAiModel || localSelectedAiModel.value || null;
    },
    set(value) {
        localSelectedAiModel.value = value || null;
        emit("update:selectedAiModel", value);
    }
});
const effectiveAiModels = computed(() => props.aiModels.length ? props.aiModels : localAiModels.value);
const effectiveModelLoading = computed(() => props.modelLoading || localModelLoading.value);
const currentUser = computed(() => diyStore.GetCurrentUser || {});
const currentUserId = computed(() => String(currentUser.value?.Id || "").trim());
const editorHeight = computed(() => "calc(100vh - 250px)");
const editorField = computed(() => ({
    Id: currentEditorFile.value?.Id || currentEditorFile.value?.FilePath || "ai-app-file",
    Name: "SourceCode",
    Label: currentEditorFile.value?.FilePath || "代码",
    Config: {
        CodeEditor: {
            Height: "620",
            Language: getEditorLanguage(currentEditorFile.value?.FilePath || "")
        }
    }
}));
const currentEditorFile = computed(() => fileTreeMode.value === "build" ? activeBuildFile.value : activeFile.value);
const currentEditorContent = computed(() => fileTreeMode.value === "build" ? activeBuildContent.value : activeContent.value);
const currentEditorFileSize = computed(() => getFileSize(currentEditorFile.value, currentEditorContent.value));
const sourceFilesUnavailableReason = computed(() => files.value.length
    ? ""
    : "当前安装包只有已发布运行产物，没有携带私有源码。请从原开发服务器重新制作包含源码的离线包，或在保存了源码的服务器上用 VS Code 拉取。"
);
const isMicroServicePreview = computed(() => (currentApp.value?.ApplicationType || currentApp.value?.AppType) === "MicroService");
const microServiceRoutes = computed(() => {
    const routeFile = files.value.find((item) => /(^|\/)microi\.routes\.json$/i.test(String(item?.FilePath || item?.FileName || "")));
    let sourceRoutes = [];
    try {
        const routes = JSON.parse(String(routeFile?.Content || routeFile?.FileContent || "[]"));
        sourceRoutes = Array.isArray(routes) ? routes : routes?.routes || [];
    } catch {
        sourceRoutes = [];
    }
    const merged = new Map();
    [...sourceRoutes, ...runtimePages.value].forEach((item) => {
        const path = normalizeMicroRoute(item?.path || item?.Path || item?.RoutePath || "/");
        const old = merged.get(path) || {};
        merged.set(path, {
            ...item,
            ...old,
            path,
            name: String(item?.name || item?.Name || item?.PageKey || old?.name || ""),
            title: String(item?.title || item?.Title || item?.PageTitle || old?.title || ""),
            sourceFile: ""
        });
    });
    return Array.from(merged.values()).map((item) => ({
            ...item,
            sourceFile: resolveRouteSourceFile(item)
        }));
});
const previewMicroRoute = computed(() => {
    if (selectedPreviewRoute.value) return normalizeMicroRoute(selectedPreviewRoute.value);
    const home = microServiceRoutes.value.find((item) => item?.isHome || item?.IsHome) || microServiceRoutes.value[0];
    return normalizeMicroRoute(home?.path || "/");
});
const previewMicroAppName = computed(() => {
    let name = String(currentApp.value?.AppKey || currentApp.value?.Id || "ai-app-preview")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!name || !/^[a-z]/.test(name)) name = `app-${name || "preview"}`;
    const routeName = previewMicroRoute.value
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "home";
    return `${name.substring(0, 34)}-workbench-${routeName.substring(0, 24)}`;
});
const previewMicroAppVersion = computed(() => {
    const runtimeVersion = String(currentApp.value?.RuntimeBuildVersion || "").trim();
    if (runtimeVersion) return runtimeVersion;
    const match = String(previewUrl.value || "").match(/\/(v\d+\.\d+\.\d+)(?:\/|$)/i);
    return match?.[1] || formatVersionNo(getAppCurrentVersion(currentApp.value));
});
const previewMicroAppEntryUrl = computed(() => {
    const apiBase = String(DiyCommon.GetApiBase ? DiyCommon.GetApiBase() : "").replace(/\/+$/, "");
    const osClient = encodeURIComponent(String(DiyCommon.GetOsClient ? DiyCommon.GetOsClient() : ""));
    const appKey = encodeURIComponent(String(currentApp.value?.AppKey || ""));
    const version = encodeURIComponent(previewMicroAppVersion.value);
    const entryPath = String(currentApp.value?.RuntimeEntryPath || "index.html").replace(/^\/+/, "");
    return `${apiBase}/micro-app/${osClient}/${appKey}/${version}/${entryPath}`;
});
const previewMicroAppKey = computed(() => `${previewMicroAppName.value}@${previewMicroAppEntryUrl.value}@${previewMicroRoute.value}`);
const previewMicroAppData = computed(() => ({
    apiBase: DiyCommon.GetApiBase ? DiyCommon.GetApiBase() : "",
    osClient: DiyCommon.GetOsClient ? DiyCommon.GetOsClient() : "",
    token: DiyCommon.getToken ? DiyCommon.getToken() : "",
    appKey: currentApp.value?.AppKey || "",
    version: previewMicroAppVersion.value,
    microRoute: previewMicroRoute.value,
    dialog: false,
    dialogData: {},
    route: { microRoute: previewMicroRoute.value, microRoutePath: previewMicroRoute.value }
}));
const visibleFileTreeData = computed(() => buildFileTree(fileTreeMode.value === "build" ? buildFiles.value : files.value));
const pagedApps = computed(() => {
    const start = (appPageIndex.value - 1) * appPageSize;
    return apps.value.slice(start, start + appPageSize);
});
const currentTreeFile = computed(() => fileTreeMode.value === "build" ? activeBuildFile.value : activeFile.value);
const sortedVersions = computed(() => [...(versions.value || [])].sort((a, b) => versionScore(b) - versionScore(a)));
const currentChatModelId = computed(() => (
    /Microi(?:吾码)?\.?(?:AI)?中转站/i.test(`${currentAiModel.value?.Name || ""} ${currentAiModel.value?.AiModel || ""}`)
        ? String(props.selectedRelayModel || localRelayModel.value || "").trim()
        : String(currentAiModel.value?.AiModel || "").trim()
));
const canSendAppChat = computed(() => (
    !appChatSending.value
    && currentApp.value
    && currentAiModel.value?.Id
    && currentChatModelId.value
    && (appPrompt.value.trim() || appSelectedFiles.value.length)
));

onMounted(async () => {
    if (props.standalone) await loadStandaloneAiModels();
    if (props.mode === "detail") {
        await openAppFromRoute();
        return;
    }
    var routeToken = claimRouteOpen();
    await loadApps();
    await completeRouteOpen(routeToken);
});

watch(() => [route.params.appId, route.query.appId], async () => {
    if (props.mode === "gallery") return;
    var routeToken = claimRouteOpen();
    // 给按 fullPath 创建的新实例一次挂载机会；新实例会立即覆盖旧令牌。
    await new Promise((resolve) => setTimeout(resolve, 50));
    await completeRouteOpen(routeToken);
});

watch(currentAiModel, () => {
    if (props.standalone && isRelayModel(currentAiModel.value)) loadStandaloneRelayModels();
});

watch(currentUserId, (value, oldValue) => {
    if (!value || value === oldValue) return;
    if (props.mode !== "detail") loadApps();
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

function isRelayModel(model) {
    return /Microi(?:吾码)?\.?(?:AI)?中转站/i.test(`${model?.Name || ""} ${model?.AiModel || ""}`);
}

async function loadStandaloneAiModels() {
    localModelLoading.value = true;
    try {
        const result = await DiyCommon.FormEngine.GetTableData("mic_ai", {
            _Where: [["IsEnable", "=", "1"]],
            _SelectFields: ["Id", "Name", "AiModel", "ModelType", "Provider", "SupportReasoning", "IsRelayModel", "CreateTime"],
            _OrderBy: "CreateTime",
            _OrderByType: "DESC",
            _PageSize: 100
        });
        if (!isOk(result)) throw new Error(unwrapResult(result)?.Msg || "加载 AI 模型失败");
        localAiModels.value = Array.isArray(dataOf(result)) ? dataOf(result) : [];
        if (!localSelectedAiModel.value && localAiModels.value.length) {
            localSelectedAiModel.value = localAiModels.value[0];
        }
        if (isRelayModel(localSelectedAiModel.value)) await loadStandaloneRelayModels();
    } catch (error) {
        ElMessage.error(error?.message || "加载 AI 模型失败");
    } finally {
        localModelLoading.value = false;
    }
}

async function loadStandaloneRelayModels() {
    try {
        const response = await fetch("https://api.itdos.com/apiengine/official_ai_relay_models?OsClient=iTdos");
        const json = await response.json();
        if (!response.ok || Number(json?.Code) !== 1) return;
        const rows = Array.isArray(json?.Data) ? json.Data : Array.isArray(json?.Data?.Data) ? json.Data.Data : [];
        localRelayModel.value = String(rows[0]?.id || rows[0]?.ModelId || "").trim();
    } catch (error) {
        console.warn("[AiApp] load relay models failed", error);
    }
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

function appTypeLabel(value) {
    const map = { MicroService: "微服务", Web: "Web应用", UniApp: "UniApp应用", Regular: "常规应用" };
    return map[String(value || "")] || String(value || "应用");
}

function normalizeMicroRoute(value) {
    const route = String(value || "/").trim();
    return route.startsWith("/") ? route : `/${route}`;
}

function normalizeSourcePath(value) {
    const parts = String(value || "").replace(/\\/g, "/").replace(/^\.\//, "").split("/");
    const safe = [];
    parts.forEach((part) => {
        if (!part || part === ".") return;
        if (part === "..") safe.pop();
        else safe.push(part);
    });
    return safe.join("/");
}

function sourcePathFromImport(metadataPath, importPath) {
    const value = String(importPath || "");
    if (!value || !/\.(vue|jsx?|tsx?)$/i.test(value)) return "";
    if (!value.startsWith(".")) return normalizeSourcePath(value);
    const dir = normalizeSourcePath(metadataPath).split("/").slice(0, -1).join("/");
    return normalizeSourcePath(`${dir}/${value}`);
}

function routeToken(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function existingSourcePath(candidate) {
    const normalized = normalizeSourcePath(candidate).toLowerCase();
    return files.value.find((item) => normalizeSourcePath(item?.FilePath || item?.FileName).toLowerCase() === normalized)?.FilePath || "";
}

function resolveRouteSourceFile(route) {
    const explicit = route?.sourceFile || route?.SourceFile || route?.componentPath || route?.ComponentPath || route?.file || route?.File;
    if (explicit) return existingSourcePath(explicit) || normalizeSourcePath(explicit);

    const routePath = normalizeMicroRoute(route?.path || route?.Path || route?.RoutePath || "/");
    const routeName = String(route?.name || route?.Name || route?.PageKey || "");
    const metadataFiles = files.value.filter((item) => /(^|\/)(main|routes?)\.[cm]?[jt]s$/i.test(String(item?.FilePath || item?.FileName || "")) && item?.Content);
    for (const metadata of metadataFiles) {
        const content = String(metadata.Content || "");
        const imports = new Map();
        const importRegex = /import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/g;
        let match;
        while ((match = importRegex.exec(content))) {
            imports.set(match[1], sourcePathFromImport(metadata.FilePath, match[2]));
        }

        const escapedPath = routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const routeObjectRegex = new RegExp(`path\\s*:\\s*["']${escapedPath}["'][\\s\\S]{0,320}?component\\s*:\\s*([A-Za-z_$][\\w$]*)`, "i");
        const routeObject = content.match(routeObjectRegex);
        if (routeObject && imports.get(routeObject[1])) return existingSourcePath(imports.get(routeObject[1])) || imports.get(routeObject[1]);

        const conditionRegex = /route\.includes\(\s*["']([^"']+)["']\s*\)\s*\?\s*([A-Za-z_$][\w$]*)/g;
        while ((match = conditionRegex.exec(content))) {
            const condition = String(match[1]);
            if ((routePath.includes(condition) || routeName === condition) && imports.get(match[2])) {
                return existingSourcePath(imports.get(match[2])) || imports.get(match[2]);
            }
        }

        if (route?.isHome || route?.IsHome || routePath === "/") {
            const defaultComponent = content.match(/:\s*([A-Za-z_$][\w$]*)\s*\r?\n\s*\r?\n\s*createApp\s*\(/);
            if (defaultComponent && imports.get(defaultComponent[1])) {
                return existingSourcePath(imports.get(defaultComponent[1])) || imports.get(defaultComponent[1]);
            }
        }
    }

    const wantedTokens = [routeName, routePath.split("/").filter(Boolean).pop()].map(routeToken).filter(Boolean);
    const byConvention = files.value.find((item) => {
        const path = normalizeSourcePath(item?.FilePath || "");
        if (!/\.(vue|jsx?|tsx?)$/i.test(path)) return false;
        const base = path.split("/").pop().replace(/\.[^.]+$/, "");
        return wantedTokens.includes(routeToken(base));
    });
    return byConvention?.FilePath || "";
}

function findPreviewRouteForSourceFile(filePath) {
    if (!isMicroServicePreview.value || !/\.(vue|jsx?|tsx?)$/i.test(String(filePath || ""))) return null;
    const normalized = normalizeSourcePath(filePath).toLowerCase();
    return microServiceRoutes.value.find((item) => normalizeSourcePath(item.sourceFile).toLowerCase() === normalized) || null;
}

function handleFileNodeClick(data) {
    if (!data || data.isDirectory || !data.file) return;
    if (fileTreeMode.value === "build") {
        openBuildFile(data.file.FilePath);
    } else {
        const previewRoute = findPreviewRouteForSourceFile(data.file.FilePath);
        const keepPreview = activeView.value === "preview" && !!previewRoute;
        openFile(data.file, {
            focusSource: !keepPreview,
            previewRoute: previewRoute?.path || ""
        });
    }
}

async function switchFileTreeMode(mode) {
    fileTreeMode.value = mode;
    if (mode === "build") {
        activeView.value = "build";
        if (!buildFiles.value.length && !buildFilesUnavailableReason.value) {
            buildFilesUnavailableReason.value = "编译产物在线编辑是可选能力；当前租户未提供编译文件列表接口，请使用已发布预览或在原开发端重新构建。";
        } else if (!activeBuildFile.value && buildFiles.value.length) await openBuildFile(buildFiles.value[0].FilePath);
        return;
    }
    activeView.value = "source";
    if (!activeFile.value) {
        const firstFile = files.value.find((item) => Number(item.IsDirectory || 0) !== 1);
        if (firstFile) await openFile(firstFile);
    }
}

function showCodeView() {
    activeView.value = fileTreeMode.value === "build" ? "build" : "source";
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
        let unownedApps = [];
        try {
            const unownedResult = await DiyCommon.FormEngine.GetTableData("sys_microistore", {
                _Where: [
                    ["ApplicationType", "In", ["Web", "UniApp", "MicroService"]]
                ],
                _SelectFields: [
                    "Id", "Name", "AppName", "AppKey", "AppType", "ApplicationType", "Description",
                    "Status", "OwnerUserId", "OwnerName", "CurrentVersion", "PreviewUrl", "BuildStatus",
                    "LastBuildTaskId", "LastBuildMsg", "LastConversationId", "CreateTime", "UpdateTime"
                ],
                _OrderBy: "UpdateTime",
                _OrderByType: "DESC",
                _PageIndex: 1,
                _PageSize: 200
            });
            if (unownedResult && Number(unownedResult.Code) === 1 && Array.isArray(unownedResult.Data)) {
                unownedApps = unownedResult.Data.filter((app) => !String(app?.OwnerUserId || "").trim());
            }
        } catch (_) {
            // 老库可能尚未具备 OwnerUserId 字段；保留 ai_app_list 的原有结果即可。
        }
        const merged = (Array.isArray(list) ? list : []).concat(unownedApps);
        const normalizedKeyword = String(keyword.value || "").trim().toLowerCase();
        apps.value = normalizeAppList(normalizedKeyword
            ? merged.filter((app) => `${app?.Name || ""} ${app?.Description || ""} ${app?.AppKey || ""}`.toLowerCase().includes(normalizedKeyword))
            : merged);
        appPageIndex.value = 1;
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
        if (!old) {
            grouped.set(key, { ...app });
            return;
        }
        const newer = appSortScore(app) > appSortScore(old) ? app : old;
        const older = newer === app ? old : app;
        grouped.set(key, mergeAppSummary(newer, older));
    });
    return Array.from(grouped.values()).sort((a, b) => appSortScore(b) - appSortScore(a));
}

function mergeAppSummary(primary, secondary) {
    const merged = { ...(secondary || {}), ...(primary || {}) };
    const currentVersion = [primary, secondary].map(getAppCurrentVersion).sort(compareVersionDesc)[0] || "v1.0.0";
    merged.CurrentVersionNo = formatVersionNo(currentVersion);
    merged.PreviewUrl = normalizePreviewUrl(primary?.PreviewUrl || primary?.PublishUrl || primary?.PublicUrl || secondary?.PreviewUrl || secondary?.PublishUrl || secondary?.PublicUrl || "");
    merged.BuildStatus = primary?.BuildStatus || primary?.Status || secondary?.BuildStatus || secondary?.Status || merged.BuildStatus;
    return merged;
}

function compareVersionDesc(a, b) {
    const [am, an, ap] = parseVersionParts(a);
    const [bm, bn, bp] = parseVersionParts(b);
    if (am !== bm) return bm - am;
    if (an !== bn) return bn - an;
    return bp - ap;
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
    if (rootKey) return `root:${rootKey}`;
    const nameKey = normalizeAppNameKey(app?.Name || app?.Title || "");
    const appKey = normalizeGeneratedAppKey(app?.AppId || app?.AppKey || "");
    if (nameKey) return `name:${nameKey}`;
    if (appKey) return `key:${appKey}`;
    return `id:${app?.Id || Math.random()}`;
}

function normalizeGeneratedAppKey(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/(?:验收|测试|预览|演示)[a-z0-9_-]*$/i, "")
        .replace(/-(?:e2e|layout|preview|test|demo|build|version)-[a-z0-9]+$/i, "")
        .replace(/-v\d+(?:\.\d+){0,2}$/i, "")
        .replace(/-{2,}/g, "-")
        .replace(/-$/g, "");
}

function normalizeAppNameKey(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/(?:验收|测试|预览|演示)[a-zA-Z0-9_-]*$/g, "")
        .replace(/(?:应用|项目)$/g, "")
        .toLowerCase();
}

function appSortScore(app) {
    const time = Date.parse(String(app?.UpdateTime || app?.CreateTime || "").replace(/-/g, "/")) || 0;
    const version = versionScore(app);
    return time + version;
}

function getAppCurrentVersion(app) {
    const explicit = app?.CurrentVersionNo || app?.VersionNo || app?.BuildVersion || app?.Version;
    if (explicit) return explicit;
    const previewMatch = String(app?.PreviewUrl || app?.PublishUrl || app?.PublicUrl || "").match(/\/(v\d+\.\d+\.\d+)(?:\/|$)/i);
    return previewMatch?.[1] || app?.CurrentVersion || "v1.0.0";
}

function parseVersionParts(value) {
    const text = String(value || "").trim().replace(/^v/i, "");
    const parts = text.split(".").map((item) => Number(item));
    if (parts.length >= 3 && parts.every((item) => Number.isFinite(item))) {
        return parts.slice(0, 3);
    }
    const numeric = Number(text);
    if (Number.isFinite(numeric) && numeric > 0) {
        return [1, 0, Math.max(0, numeric - 1)];
    }
    return [1, 0, 0];
}

function formatVersionNo(value) {
    const [major, minor, patch] = parseVersionParts(value);
    return `v${major}.${minor}.${patch}`;
}

function versionScore(item) {
    const [major, minor, patch] = parseVersionParts(getAppCurrentVersion(item));
    const time = Date.parse(String(item?.UpdateTime || item?.CreateTime || "").replace(/-/g, "/")) || 0;
    return major * 1000000 + minor * 10000 + patch * 100 + Math.floor(time / 1000000000);
}

function versionKey(item) {
    return String(item?.Id || item?.VersionId || item?.VersionNo || item?.BuildVersion || item?.CreateTime || "");
}

function versionLabel(item) {
    const status = item?.Status || item?.BuildStatus || "Success";
    return `${formatVersionNo(getAppCurrentVersion(item))} · ${status}`;
}

function getVersionPreviewUrl(item) {
    return normalizePreviewUrl(item?.PreviewUrl || item?.PublishUrl || item?.PublicUrl || item?.Url || "");
}

function selectVersion(item) {
    if (!item) return;
    selectedVersionKey.value = versionKey(item);
    const url = getVersionPreviewUrl(item);
    if (url) {
        previewUrl.value = url;
        refreshPreviewHtml(url);
        activeView.value = "preview";
    }
    if (currentApp.value) {
        currentApp.value = {
            ...currentApp.value,
            CurrentVersionNo: getAppCurrentVersion(item),
            BuildStatus: item.Status || item.BuildStatus || currentApp.value.BuildStatus,
            PreviewUrl: url || currentApp.value.PreviewUrl
        };
    }
}

function selectVersionByKey(key) {
    const row = sortedVersions.value.find((item) => versionKey(item) === key);
    if (row) selectVersion(row);
}

async function selectApp(app) {
    currentApp.value = app;
    previewDeviceMode.value = (app?.ApplicationType || app?.AppType) === "UniApp" ? "mobile" : "desktop";
    previewUrl.value = normalizePreviewUrl(app.PreviewUrl || "");
    activeFile.value = null;
    activeContent.value = "";
    buildFiles.value = [];
    buildFilesUnavailableReason.value = "";
    activeBuildFile.value = null;
    activeBuildContent.value = "";
    selectedPreviewRoute.value = "";
    runtimePages.value = [];
    appChatMessages.value = [];
    try {
        const detail = await runAiAppEngine("ai_app_detail", { AppId: app.Id });
        const selected = detail?.App || app;
        currentApp.value = selected;
        const selectedType = selected?.ApplicationType || selected?.AppType;
        previewDeviceMode.value = selectedType === "UniApp" ? "mobile" : "desktop";
        files.value = detail?.Files || [];
        versions.value = detail?.Versions || [];
        if (selectedType === "MicroService") {
            await hydrateMicroServicePreviewMetadata(selected.Id);
            await loadMicroServiceRuntimeMetadata(selected);
            const homeRoute = microServiceRoutes.value.find((item) => item?.isHome || item?.IsHome) || microServiceRoutes.value[0];
            selectedPreviewRoute.value = normalizeMicroRoute(homeRoute?.path || "/");
        }
        // 编译文件管理接口不是所有历史租户都已安装。进入开发工作台时不再自动调用它，
        // 避免只有运行产物的离线应用出现“获取下载项失败: undefined”。
        buildFiles.value = [];
        buildFilesUnavailableReason.value = files.value.length
            ? "编译产物在线编辑是可选能力；需要时请在原开发端重新构建并发布。"
            : "该离线应用未携带私有源码，也未提供可在线编辑的编译文件；已发布运行页面仍可正常预览。";
        const latestVersion = sortedVersions.value[0];
        if (latestVersion) {
            selectedVersionKey.value = versionKey(latestVersion);
            previewUrl.value = selectedType === "MicroService" && currentApp.value?.RuntimeBuildVersion
                ? previewMicroAppEntryUrl.value
                : getVersionPreviewUrl(latestVersion) || normalizePreviewUrl(selected.PreviewUrl || "");
        } else {
            selectedVersionKey.value = "";
            previewUrl.value = selectedType === "MicroService" && currentApp.value?.RuntimeBuildVersion
                ? previewMicroAppEntryUrl.value
                : normalizePreviewUrl(selected.PreviewUrl || "");
        }
        await refreshPreviewHtml();
        const firstFile = files.value.find((item) => Number(item.IsDirectory || 0) !== 1);
        if (firstFile) await openFile(firstFile, { focusSource: false });
        if (previewUrl.value) {
            activeView.value = "preview";
        }
        await loadAppChatHistory(selected.Id);
    } catch (error) {
        ElMessage.error(error.message || "加载应用详情失败");
    }
}

async function enterDevelop(app) {
    var appId = String(app?.Id || "").trim();
    if (!appId) return;
    appViewMode.value = "develop";
    currentApp.value = app;
    var detailPromise = selectApp(app);
    if (String(route.params.appId || route.query.appId || "") !== appId || route.path.indexOf("/mic-ai-app/") !== 0) {
        await Promise.all([
            detailPromise,
            router.push({ name: "mic_ai_app_detail", params: { appId } })
        ]);
    } else {
        await detailPromise;
    }
    if (previewUrl.value) {
        activeView.value = "preview";
    }
}

function claimRouteOpen() {
    var token = {};
    routeCoordinator.token = token;
    return token;
}

async function completeRouteOpen(token) {
    // 主框架按 fullPath 重建页面、KeepAlive 中保留旧实例时，多个实例会同时收到 query 变化。
    // 新实例在 loadApps 之前先抢占令牌，旧实例因此不会再读取一次应用详情。
    if (routeCoordinator.token !== token || componentInstance?.isUnmounted) return;
    await openAppFromRoute();
}

async function openAppFromRoute() {
    var appId = String(route.params.appId || route.query.appId || "").trim();
    if (!appId) {
        appViewMode.value = "gallery";
        return;
    }
    if (appViewMode.value === "develop" && String(currentApp.value?.Id || "") === appId) return;
    var app = apps.value.find((item) => String(item?.Id || "") === appId) || { Id: appId };
    appViewMode.value = "develop";
    await selectApp(app);
    if (previewUrl.value) activeView.value = "preview";
}

async function previewApp(app) {
    if (!app?.Id) return;
    previewingAppId.value = app.Id;
    try {
        const url = await getPublishedPreviewUrl(app);
        if (!url) throw new Error("还没有正式发布版本，请先进入开发工作台点击“运行/发布”。");
        window.open(url, "_blank");
    } catch (error) {
        ElMessage.error(error.message || "打开预览失败");
    } finally {
        previewingAppId.value = "";
    }
}

async function getPublishedPreviewUrl(app) {
    const detail = await runAiAppEngine("ai_app_detail", { AppId: app.Id });
    const latestVersion = [...(detail?.Versions || [])]
        .filter((item) => /success|published|done|完成|成功/i.test(String(item?.Status || item?.BuildStatus || "Success")))
        .sort((a, b) => versionScore(b) - versionScore(a))[0]
        || [...(detail?.Versions || [])].sort((a, b) => versionScore(b) - versionScore(a))[0];
    return getVersionPreviewUrl(latestVersion)
        || normalizePreviewUrl(detail?.App?.PreviewUrl || detail?.App?.PublishUrl || detail?.App?.PublicUrl || "")
        || normalizePreviewUrl(app?.PreviewUrl || app?.PublishUrl || app?.PublicUrl || "");
}

async function backToGallery() {
    await router.push({ path: "/microi-store" });
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
    const { focusSource = true, previewRoute = "" } = options;
    if (previewRoute) selectedPreviewRoute.value = normalizeMicroRoute(previewRoute);
    activeFile.value = file;
    try {
        const data = await runAiAppEngine("ai_app_get_file", {
            AppId: currentApp.value.Id,
            FilePath: file.FilePath
        });
        activeContent.value = String(data?.Content || "");
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

async function loadMicroServiceRuntimeMetadata(app) {
    const appKey = String(app?.AppKey || "").trim();
    if (!appKey) return;
    try {
        const serviceResult = await DiyCommon.FormEngine.GetFormData("sys_microiservice", {
            _Where: [["MsKey", "=", appKey]],
            _SelectFields: ["Id", "MsKey", "MsName", "BuildVersion", "EntryPath", "IsEnable", "PublishTime"]
        });
        if (!serviceResult || Number(serviceResult.Code) !== 1 || !serviceResult.Data) return;
        const service = serviceResult.Data;
        currentApp.value = {
            ...currentApp.value,
            RuntimeServiceId: service.Id,
            RuntimeBuildVersion: service.BuildVersion || "",
            RuntimeEntryPath: service.EntryPath || "index.html"
        };
        const pageResult = await DiyCommon.FormEngine.GetTableData("sys_microiservice_page", {
            _Where: [["MicroServiceId", "=", service.Id], ["AND", "IsEnable", "=", 1]],
            _SelectFields: ["Id", "PageKey", "PageName", "PageTitle", "RoutePath", "EntryPath", "Sort", "IsHome", "IsEnable", "BuildVersion", "RouteMetaJson"],
            _OrderBy: "Sort",
            _OrderByType: "ASC",
            _PageSize: 200
        });
        runtimePages.value = pageResult && Number(pageResult.Code) === 1 && Array.isArray(pageResult.Data)
            ? pageResult.Data
            : [];
    } catch (error) {
        console.warn("[AiApp] load micro service runtime metadata failed", error);
    }
}

async function hydrateMicroServicePreviewMetadata(appId) {
    const indexes = files.value
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => /(^|\/)(microi\.routes\.json|main\.[cm]?[jt]s|routes?\.[cm]?[jt]s)$/i.test(String(item?.FilePath || item?.FileName || "")))
        .filter(({ item }) => !item?.Content);
    await Promise.all(indexes.map(async ({ item, index }) => {
        try {
            const data = await runAiAppEngine("ai_app_get_file", { AppId: appId, FilePath: item.FilePath });
            files.value[index] = { ...item, ...(data || {}), FilePath: item.FilePath };
        } catch (error) {
            console.warn("[AiApp] load micro service preview metadata failed", item.FilePath, error);
        }
    }));
}

async function openBuildFile(path) {
    if (!currentApp.value || !path) return;
    try {
        const data = await runAiAppEngine("ai_app_build_file", { Action: "Get", AppId: currentApp.value.Id, Path: path });
        activeBuildContent.value = String(data?.Content || "");
        activeBuildFile.value = { ...(buildFiles.value.find((item) => item.FilePath === path) || {}), ...(data || {}), FilePath: path };
        fileTreeMode.value = "build";
        activeView.value = "build";
    } catch (error) {
        ElMessage.error(error.message || "读取编译文件失败");
    }
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
    createForm.Category = type === "MicroService" ? "business" : createForm.Category || "business";
    createForm.Name = type === "UniApp" ? "美容美发预约UniApp应用" : type === "MicroService" ? "AI 微服务" : "AI Web应用";
    createForm.AppKey = makeAppKey(createForm.Name);
    createForm.Description = type === "UniApp"
        ? "面向美容美发门店的技师预约移动端应用，包含首页服务推荐、服务项目、技师列表、预约下单、个人中心等基础功能，接口统一预留吾码接口引擎调用。"
        : type === "MicroService"
            ? "可通过 OpenAppDialog 或后台菜单加载的 Vue 微服务，源码支持在线 AI 与 VS Code 协同维护。"
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
        const content = String(activeContent.value || "");
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

async function saveCurrentFile() {
    if (fileTreeMode.value !== "build") return saveActiveFile();
    if (!currentApp.value || !activeBuildFile.value) return;
    const filePath = activeBuildFile.value.FilePath;
    fileSaving.value = true;
    try {
        const content = String(activeBuildContent.value || "");
        await runAiAppEngine("ai_app_build_file", {
            Action: "Save",
            AppId: currentApp.value.Id,
            Path: filePath,
            Content: content
        });
        ElMessage.success("编译文件已保存");
        await selectApp(currentApp.value);
        await openBuildFile(filePath);
    } catch (error) {
        ElMessage.error(error.message || "保存编译文件失败");
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
        if (previewUrl.value) activeView.value = "preview";
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

async function makeOfflinePackage() {
    if (!currentApp.value) return;
    packaging.value = true;
    try {
        const data = await runAiAppEngine("ai_app_publish_store", {
            Action: "OfflinePackage",
            AppId: currentApp.value.Id,
            IncludeSource: true
        });
        const payload = normalizeDownloadPayload(data);
        if (!payload.FileByteBase64) throw new Error("接口未返回离线包内容");
        const fileName = payload.FileName || `${safeFileName(currentApp.value.Name || currentApp.value.Id)}.microi-app.json`;
        downloadBase64File(payload.FileByteBase64, fileName, payload.ContentType || "application/json; charset=utf-8");
        ElMessage.success("应用离线包已生成");
    } catch (error) {
        ElMessage.error(error.message || "制作离线包失败");
    } finally {
        packaging.value = false;
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
    const target = normalizePreviewUrl(url);
    previewUrl.value = target;
    previewLoading.value = false;
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
    const modelId = currentChatModelId.value;
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
                AiModelId: currentAiModel.value?.Id || "",
                RelayModel: props.selectedRelayModel || "",
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
            AiModel: currentChatModelId.value,
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
                ModelId: message.modelId || currentChatModelId.value,
                AiModel: currentChatModelId.value,
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
        "用户正在编辑一个线上 AI 应用，应用主数据存储在 sys_microistore，源码清单存储在 mci_ai_app_file 并对应 HDFS 私有桶，发布文件存公有桶。",
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
    grid-template-columns: minmax(320px, 380px) minmax(220px, 270px) minmax(0, 1fr);
    gap: 10px;
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

.app-gallery-pagination {
    justify-content: center;
    margin-top: 18px;
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

.file-panel header {
    justify-content: space-between;
    flex-wrap: nowrap;
    gap: 8px;
}

.file-tree-title {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
}

.file-tree-title strong,
.file-tree-title :deep(.el-tag) {
    white-space: nowrap;
}

.file-panel header :deep(.el-segmented) {
    flex: 0 0 auto;
    padding: 3px;
    border: 1px solid #e5eaf2;
    border-radius: 9px;
    background: #f4f6fa;
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, .04);
}

.file-panel header :deep(.el-segmented__item) {
    min-width: 42px;
    border-radius: 7px;
}

.file-panel header :deep(.el-segmented__item.is-selected) {
    color: #ff5f2e;
    background: #fff;
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
    gap: 10px;
    min-height: 34px;
    padding: 0 10px;
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
    gap: 10px;
    min-height: 34px;
    padding: 0 10px;
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
    padding: 0 10px;
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

.build-pane { display: flex; flex-direction: column; }

.preview-pane {
    display: flex;
    flex-direction: column;
}

.preview-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    min-height: 48px;
    padding: 7px 12px;
    border-bottom: 1px solid #edf1f7;
    background: #fff;
    color: #667085;
    font-size: 12px;
}

.preview-canvas {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: stretch;
    justify-content: center;
    overflow: auto;
    background: #eef2f7;
}

.preview-canvas.is-desktop .preview-frame {
    width: 100%;
    height: 100%;
}

.preview-canvas.is-mobile {
    align-items: flex-start;
    padding: 20px;
}

.preview-canvas.is-mobile .preview-frame {
    flex: 0 0 430px;
    width: 430px;
    max-width: 100%;
    height: min(780px, calc(100vh - 310px));
    min-height: 620px;
    border: 8px solid #202734;
    border-radius: 28px;
    box-shadow: 0 18px 50px rgba(15, 23, 42, .22);
}

.preview-frame {
    border: 0;
    border-radius: 0;
    background: #eef4f8;
}

.preview-micro-app {
    display: block;
    overflow: auto;
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

.ai-app-workbench {
    --app-primary: var(--mci-color-primary, var(--el-color-primary, #ff5f2e));
    --app-primary-dark: var(--mci-color-primary-dark, var(--el-color-primary-dark-2, #e34f24));
    --app-bg: var(--mci-bg-base, var(--el-bg-color-page, #f7f9fc));
    --app-panel: var(--mci-bg-elevated, var(--el-bg-color, #fff));
    --app-surface: var(--mci-bg-surface, var(--el-fill-color-light, #f4f6fa));
    --app-card: var(--mci-bg-card, var(--el-bg-color, #fff));
    --app-card-hover: var(--mci-bg-card-hover, var(--el-fill-color-extra-light, #fff));
    --app-border: var(--mci-border-color, var(--el-border-color-lighter, #e8edf5));
    --app-text: var(--mci-text-primary, var(--el-text-color-primary, #20242c));
    --app-text-secondary: var(--mci-text-secondary, var(--el-text-color-regular, #606a7a));
    --app-text-tertiary: var(--mci-text-tertiary, var(--el-text-color-placeholder, #98a2b3));
    --app-on-primary: var(--mci-text-on-primary, #fff);
    --app-shadow: var(--mci-shadow-card, 0 14px 34px rgba(15, 23, 42, .07));
    background:
        radial-gradient(circle at 18% 0, color-mix(in srgb, var(--app-primary) 10%, transparent), transparent 30%),
        var(--app-bg);
    color: var(--app-text);
}

html.dark .ai-app-workbench,
body.dark .ai-app-workbench,
.dark .ai-app-workbench,
[data-theme="dark"] .ai-app-workbench {
    --app-bg: var(--mci-bg-base, #0b1118);
    --app-panel: var(--mci-bg-elevated, #101923);
    --app-surface: var(--mci-bg-surface, #172332);
    --app-card: var(--mci-bg-card, rgba(255, 255, 255, .055));
    --app-card-hover: var(--mci-bg-card-hover, rgba(255, 255, 255, .085));
    --app-border: var(--mci-border-color, rgba(255, 255, 255, .10));
    --app-text: var(--mci-text-primary, #f6f8fb);
    --app-text-secondary: var(--mci-text-secondary, #b9c2d0);
    --app-text-tertiary: var(--mci-text-tertiary, #7f8ba0);
    --app-shadow: var(--mci-shadow-card, 0 18px 46px rgba(0, 0, 0, .32));
}

.app-gallery-hero,
.app-card,
.app-panel,
.file-panel,
.app-stage,
.viewer-card,
.app-chat,
.app-chat-message pre,
.app-chat-composer,
.app-chat-in-panel,
.preview-pane,
.source-pane {
    border-color: var(--app-border);
    background: var(--app-card);
    color: var(--app-text);
    box-shadow: var(--app-shadow);
}

.app-gallery-hero {
    background:
        linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 10%, var(--app-panel)), var(--app-panel));
}

.gallery-title .el-icon,
.app-send-btn,
.app-card-actions :deep(.el-button--primary),
.stage-actions :deep(.el-button--primary) {
    border-color: transparent;
    background: linear-gradient(135deg, var(--app-primary), var(--app-primary-dark));
    color: var(--app-on-primary);
    box-shadow: 0 12px 26px color-mix(in srgb, var(--app-primary) 26%, transparent);
}

.gallery-title strong,
.app-card h4,
.app-card-meta strong,
.app-develop-head strong,
.active-file-meta .path,
.app-chat-header strong,
.app-message-meta strong,
.source-tree-node.active {
    color: var(--app-text);
}

.gallery-title span,
.app-card p,
.app-card-top span,
.app-card-meta span,
.app-develop-head span,
.app-item span,
.active-file-meta,
.publish-meta,
.app-chat-empty,
.app-message-meta span,
.source-tree-node small {
    color: var(--app-text-secondary);
}

.app-card:hover,
.app-card.active,
.app-item.active,
.app-item:hover,
.file-item.active,
.file-item:hover,
.source-tree :deep(.el-tree-node__content:hover) {
    border-color: color-mix(in srgb, var(--app-primary) 40%, var(--app-border));
    background: color-mix(in srgb, var(--app-primary) 10%, var(--app-card));
    color: var(--app-primary);
}

.app-develop-head,
.app-toolbar,
.app-create,
.file-panel header,
.stage-toolbar,
.app-chat-header,
.active-file-meta,
.publish-meta {
    border-color: var(--app-border);
    background: color-mix(in srgb, var(--app-primary) 5%, var(--app-panel));
}

.source-tree {
    --el-tree-node-hover-bg-color: color-mix(in srgb, var(--app-primary) 10%, var(--app-card));
    background: transparent;
    color: var(--app-text);
}

.source-tree :deep(.el-tree-node__content) {
    color: var(--app-text);
}

.viewer-tabs button,
.attachment-chip {
    border-color: var(--app-border);
    background: var(--app-surface);
    color: var(--app-text-secondary);
}

.viewer-tabs button.active,
.viewer-tabs button:hover {
    border-color: color-mix(in srgb, var(--app-primary) 36%, var(--app-border));
    background: color-mix(in srgb, var(--app-primary) 12%, var(--app-card));
    color: var(--app-primary);
}

.app-chat-composer :deep(.el-textarea__inner),
.app-model-select :deep(.el-input__wrapper),
.gallery-tools :deep(.el-input__wrapper) {
    background: var(--app-surface);
    color: var(--app-text);
    box-shadow: none;
}

.preview-frame {
    background: #fff;
}

@media (max-width: 1400px) {
    .ai-app-workbench {
        grid-template-columns: minmax(300px, 340px) minmax(210px, 240px) minmax(0, 1fr);
        gap: 8px;
    }

    .stage-actions {
        gap: 6px;
    }
}

@media (max-width: 1160px) {
    .ai-app-workbench {
        grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
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
