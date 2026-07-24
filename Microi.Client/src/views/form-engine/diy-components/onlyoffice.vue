<template>
    <div class="onlyoffice-preview-page" :class="{ 'anonymous-view': !isAuthenticated }">
        <div class="onlyoffice-file-bar">
            <div class="file-summary">
                <div class="file-icon-wrap">
                    <el-icon><Document /></el-icon>
                </div>
                <div class="file-meta">
                    <div class="file-name" :title="fileName">{{ fileName || "在线文档" }}</div>
                    <div class="file-desc">
                        <span>{{ fileTypeLabel }}</span>
                        <span class="dot"></span>
                        <span>{{ fileSizeText }}</span>
                        <template v-if="currentVersion">
                            <span class="dot"></span>
                            <span>{{ currentVersion }}</span>
                        </template>
                    </div>
                </div>
            </div>

            <div class="file-actions">
                <el-select
                    v-if="showVersionSelect"
                    v-model="selectedVersion"
                    class="version-select"
                    size="small"
                    filterable
                    placeholder="版本"
                    :disabled="previewLoading || saveLoading"
                    @change="switchVersion"
                >
                    <el-option
                        v-for="item in versionOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                    />
                </el-select>

                <el-button class="download-btn" type="primary" :disabled="!filePath || previewLoading" :loading="downloadLoading" @click="downloadFile">
                    <el-icon><Download /></el-icon>
                    <span>下载文件</span>
                </el-button>

                <el-button v-if="canSaveOffice" class="save-btn" type="success" :disabled="previewLoading" :loading="saveLoading" @click="saveOfficeFile">
                    <el-icon><Document /></el-icon>
                    <span>{{ saveButtonText }}</span>
                </el-button>
            </div>
        </div>

        <div class="onlyoffice-editor-panel">
            <DynamicOnlyOfficeEditor
                v-if="Load"
                ref="officeEditor"
                :document-server-url="serverUrl"
                :config="editorConfig"
                @editor-ready="onEditorReady"
            />
            <div v-else class="empty-file">
                <el-icon><WarningFilled /></el-icon>
                <span>{{ previewLoading ? "正在获取文档预览地址..." : previewError || "未指定预览文件" }}</span>
            </div>
        </div>
    </div>
</template>

<script>
import DynamicOnlyOfficeEditor from "../diy-components/onlyoffice-base.vue";
import { computed, getCurrentInstance } from "vue";
import { useDiyStore } from "@/pinia";
import { Document, Download, WarningFilled } from "@element-plus/icons-vue";

export default {
    components: {
        DynamicOnlyOfficeEditor,
        Document,
        Download,
        WarningFilled
    },
    setup() {
        const instance = getCurrentInstance();
        const diyStore = useDiyStore();
        const OsClient = computed(() => diyStore.OsClient);
        const SysConfig = computed(() => diyStore.SysConfig);
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const DiyCommon = instance?.appContext?.config?.globalProperties?.DiyCommon;
        return {
            diyStore,
            OsClient,
            SysConfig,
            GetCurrentUser,
            DiyCommon,
            Document,
            Download,
            WarningFilled
        };
    },
    data() {
        return {
            Load: false,
            serverUrl: "",
            editorConfig: {},
            editorInstance: null,
            documentKeySeed: Date.now(),
            filePath: "",
            fileName: "",
            fileType: "",
            fileSize: "",
            sourceFilePath: "",
            sourceApiUrl: "",
            isPrivate: false,
            hdfs: "",
            formEngineKey: "",
            formDataId: "",
            fieldId: "",
            sysMenuId: "",
            tableChildAuth: null,
            canEdit: false,
            requestedCanEdit: false,
            isAuthenticated: false,
            enableVersion: false,
            officeFileMeta: null,
            officeVersions: [],
            selectedVersion: "",
            currentVersion: "",
            previewLoading: false,
            previewError: "",
            downloadLoading: false,
            saveLoading: false,
            pendingDownloadAs: null
        };
    },
    computed: {
        fileTypeLabel() {
            if (!this.fileType) return "Office 文件";
            return this.fileType.toUpperCase() + " 文件";
        },
        fileSizeText() {
            return this.formatFileSize(this.fileSize);
        },
        canSaveOffice() {
            return this.canEdit && this.filePath && this.Load && this.getDocumentType(this.fileType) !== "pdf";
        },
        saveButtonText() {
            return this.enableVersion ? "保存为新版本" : "保存文件";
        },
        showVersionSelect() {
            return this.enableVersion || this.versionOptions.length > 0;
        },
        versionOptions() {
            const options = this.officeVersions.map((item) => ({
                value: item.Path || item.FilePathName || item.path || item.Version,
                label: `${item.Version || "未命名版本"}${item.IsLatest ? "（最新）" : ""}`
            })).filter((item) => !!item.value);
            if (!options.length && this.enableVersion) {
                const value = this.sourceFilePath || this.filePath || "current";
                options.push({
                    value,
                    label: this.currentVersion ? `${this.currentVersion}（当前）` : "当前文件"
                });
            }
            return options;
        }
    },
    async mounted() {
        const sessionPayload = this.readOfficeSessionPayload();
        this.applyRoutePayload(sessionPayload || {});
        const canOpen = await this.validateOfficeAccess();
        if (!canOpen) return;
        await this.loadOfficeFileMeta();
        await this.openCurrentFile();
    },
    beforeUnmount() {
        this.clearPendingDownloadAs();
    },
    methods: {
        safeDecode(value) {
            if (!value) return "";
            try {
                return decodeURIComponent(value);
            } catch (error) {
                return value;
            }
        },
        parseBoolean(value) {
            return value === true || value === 1 || value === "1" || value === "true" || value === "True";
        },
        parseTableChildAuth(value) {
            if (!value) return null;
            if (typeof value === "object" && !Array.isArray(value)) return value;
            try {
                const parsed = JSON.parse(this.safeDecode(value));
                return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                    ? parsed
                    : null;
            } catch (error) {
                return null;
            }
        },
        readOfficeSessionPayload() {
            const key = this.safeDecode(this.$route.query.officeSessionKey || "");
            if (!key) return null;
            try {
                const raw = window.sessionStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch (error) {
                return null;
            }
        },
        applyRoutePayload(payload) {
            const query = this.$route.query || {};
            const explicitFileUrl = this.safeDecode(
                query.fileUrl || query.documentUrl || query.sourceUrl ||
                payload.fileUrl || payload.documentUrl || payload.sourceUrl || ""
            );
            const routeFilePath = explicitFileUrl || this.safeDecode(query.filePath || payload.filePath || payload.url || "");
            let sourceFilePath = this.safeDecode(query.filePathName || query.sourceFilePath || query.storagePath || payload.filePathName || payload.sourceFilePath || "");
            let isPrivate = this.parseBoolean(query.isPrivate || query.limit || query.Limit || payload.isPrivate || payload.Limit);

            if (!sourceFilePath && this.isExpiringSignedUrl(routeFilePath)) {
                sourceFilePath = this.deriveFilePathNameFromSignedUrl(routeFilePath);
                isPrivate = true;
            }

            this.sourceFilePath = sourceFilePath;
            this.sourceApiUrl = this.isApiEngineSource(routeFilePath) ? routeFilePath : "";
            this.isPrivate = isPrivate;
            this.hdfs = this.safeDecode(query.hdfs || query.HDFS || payload.hdfs || payload.HDFS || "");
            this.formEngineKey = this.safeDecode(query.formEngineKey || query.FormEngineKey || payload.formEngineKey || payload.FormEngineKey || "");
            this.formDataId = this.safeDecode(query.formDataId || query.FormDataId || payload.formDataId || payload.FormDataId || "");
            this.fieldId = this.safeDecode(query.fieldId || query.FieldId || payload.fieldId || payload.FieldId || "");
            this.sysMenuId = this.safeDecode(query.sysMenuId || query.SysMenuId || query.menuId || query.MenuId || payload.sysMenuId || payload.SysMenuId || payload.menuId || payload.MenuId || "");
            this.tableChildAuth = this.parseTableChildAuth(
                payload.tableChildAuth || payload.TableChildAuth || payload._TableChildAuth ||
                query.TableChildAuth || query._TableChildAuth
            );
            this.requestedCanEdit = this.parseBoolean(query.canEdit || query.allowEdit || query.edit || query.CanEdit || payload.canEdit || payload.AllowEdit);
            this.canEdit = false;
            this.enableVersion = this.parseBoolean(query.enableOfficeVersion || query.EnableOfficeVersion || payload.enableOfficeVersion || payload.EnableOfficeVersion);
            this.fileName = this.safeDecode(query.fileName || query.name || payload.fileName || payload.Name || "") || this.getFileNameFromUrl(sourceFilePath || routeFilePath);
            if (!this.fileName && this.sourceApiUrl) this.fileName = "接口引擎导出.xlsx";
            this.fileType = this.safeDecode(query.fileType || payload.fileType || "") || this.getFileExtension(this.fileName || sourceFilePath || routeFilePath);
            if (!this.fileType && this.sourceApiUrl) this.fileType = "xlsx";
            this.fileSize = query.fileSize || query.size || payload.fileSize || payload.Size || "";
            this.filePath = routeFilePath;
            if (this.enableVersion && !this.selectedVersion) {
                this.selectedVersion = this.sourceFilePath || this.filePath || "current";
            }
            this.serverUrl = (this.SysConfig && this.SysConfig.OnlyOfficeApiBase) || "";

            if (payload.fileMeta) {
                this.applyOfficeFileMeta(payload.fileMeta, {
                    preferPath: this.sourceFilePath
                });
            }
            if (this.fileName) {
                document.title = this.fileName + " - 在线文档";
            }
        },
        async validateOfficeAccess() {
            this.previewError = "";
            this.isAuthenticated = await this.validateCurrentUser();
            this.canEdit = this.requestedCanEdit && this.isAuthenticated;

            if (!this.isAuthenticated && this.isPrivate) {
                this.previewError = "私有文件需要登录后查看";
                this.Load = false;
                return false;
            }
            if (this.sourceApiUrl) {
                try {
                    const normalizedSourceUrl = this.resolveApiEnginePreviewUrl(this.sourceApiUrl);
                    const prepared = await this.prepareApiEnginePreview(normalizedSourceUrl);
                    this.filePath = prepared.FileUrl;
                    this.sourceFilePath = prepared.FilePathName || this.sourceFilePath;
                    this.fileName = prepared.FileName || this.fileName;
                    this.fileType = prepared.FileType || this.getFileExtension(this.fileName) || this.fileType;
                    this.fileSize = prepared.FileSize || this.fileSize;
                    this.isPrivate = false;
                    return true;
                } catch (error) {
                    this.previewError = error?.message || "接口引擎文件地址不可用于在线预览";
                    this.Load = false;
                    return false;
                }
            }
            if (!this.isAuthenticated && !this.validateAnonymousPublicSource()) {
                this.previewError = "匿名预览只允许访问当前租户的公有文件";
                this.Load = false;
                return false;
            }
            if (!this.isAuthenticated && this.sourceFilePath) {
                // 匿名场景只使用经过校验的公有存储路径，忽略 URL 中可伪造的 filePath。
                this.filePath = this.toPublicFileUrl(this.sourceFilePath);
            }
            return true;
        },
        isApiEngineSource(value) {
            if (!value) return false;
            try {
                const apiBase = this.getRuntimeApiBase() || window.location.origin;
                const parsed = new URL(String(value), apiBase);
                return /^\/apiengine\//i.test(parsed.pathname || "");
            } catch (error) {
                return false;
            }
        },
        getRuntimeApiBase() {
            return String(this.DiyCommon?.GetApiBase?.() || "").trim().replace(/\/+$/, "");
        },
        getPublicApiBase() {
            const candidates = [
                this.SysConfig && this.SysConfig.ApiBase,
                this.getRuntimeApiBase()
            ];
            for (let i = 0; i < candidates.length; i++) {
                const value = String(candidates[i] || "").trim();
                if (!value) continue;
                try {
                    const parsed = new URL(value, window.location.origin);
                    if (/^https?:$/.test(parsed.protocol) && !this.isLoopbackHost(parsed.hostname)) {
                        return parsed.origin + parsed.pathname.replace(/\/+$/, "");
                    }
                } catch (error) {}
            }
            return "";
        },
        isLoopbackHost(hostname) {
            const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
            return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
        },
        resolveApiEnginePreviewUrl(value) {
            const raw = String(value || "").trim();
            if (!raw || raw.includes("\\") || raw.includes("..")) {
                throw new Error("接口引擎文件地址不合法");
            }
            const runtimeApiBase = this.getRuntimeApiBase();
            const publicApiBase = this.getPublicApiBase();
            const base = runtimeApiBase || publicApiBase || window.location.origin;
            let source;
            try {
                source = new URL(raw, base);
            } catch (error) {
                throw new Error("接口引擎文件地址格式错误");
            }
            if (!/^https?:$/.test(source.protocol) || source.username || source.password || source.hash) {
                throw new Error("接口引擎文件地址只允许 HTTP/HTTPS 且不能包含认证信息或片段");
            }
            let decodedPath = "";
            try {
                decodedPath = decodeURIComponent(source.pathname || "");
            } catch (error) {
                throw new Error("接口引擎文件地址编码错误");
            }
            if (!/^\/apiengine\/[^/]+\/?$/i.test(decodedPath) || decodedPath.includes("..") || decodedPath.includes("\\")) {
                throw new Error("在线预览只允许当前平台的接口引擎文件地址");
            }

            const osClient = String(this.OsClient || this.DiyCommon?.GetOsClient?.() || "").trim();
            const lowerPath = decodedPath.toLowerCase();
            const marker = ("--OsClient--" + osClient + "--").toLowerCase();
            const queryTenant = String(source.searchParams.get("OsClient") || source.searchParams.get("osClient") || "");
            if (!osClient || (!lowerPath.includes(marker) && queryTenant.toLowerCase() !== osClient.toLowerCase())) {
                throw new Error("接口引擎地址必须显式指定当前 OsClient");
            }

            const allowedOrigins = [];
            [runtimeApiBase, publicApiBase].forEach((candidate) => {
                if (!candidate) return;
                try {
                    const origin = new URL(candidate, window.location.origin).origin;
                    if (!allowedOrigins.includes(origin)) allowedOrigins.push(origin);
                } catch (error) {}
            });
            if (!this.isLoopbackHost(source.hostname) && !allowedOrigins.includes(source.origin)) {
                throw new Error("匿名预览只允许当前平台 ApiBase 下的接口引擎");
            }
            return source.toString();
        },
        async prepareApiEnginePreview(fileUrl) {
            const osClient = String(this.OsClient || this.DiyCommon?.GetOsClient?.() || "").trim();
            const apiBase = this.getRuntimeApiBase() || String(this.SysConfig?.ApiBase || "").trim().replace(/\/+$/, "");
            if (!apiBase || !osClient) throw new Error("当前平台 ApiBase 或 OsClient 未就绪");
            this.previewLoading = true;
            try {
                const response = await fetch(apiBase + "/api/HDFS/PrepareOfficePreviewFromUrl", {
                    method: "POST",
                    credentials: "omit",
                    headers: {
                        "Content-Type": "application/json",
                        OsClient: osClient
                    },
                    body: JSON.stringify({
                        OsClient: osClient,
                        FileUrl: fileUrl,
                        FileName: this.fileName
                    })
                });
                let result = null;
                try {
                    result = await response.json();
                } catch (error) {
                    throw new Error("预览文件准备接口返回格式错误");
                }
                if (!response.ok || result?.Code !== 1 || !result.Data?.FileUrl) {
                    throw new Error(result?.Msg || "接口引擎文件准备失败");
                }
                return result.Data;
            } finally {
                this.previewLoading = false;
            }
        },
        async validateCurrentUser() {
            const token = this.DiyCommon?.getToken?.() || "";
            if (!token) return false;
            const osClient = this.OsClient || this.DiyCommon?.GetOsClient?.() || "";
            const apiBase = this.DiyCommon?.GetApiBase?.() || "";
            const url = apiBase ? apiBase.replace(/\/+$/, "") + "/api/SysUser/GetCurrentUser" : "/api/SysUser/GetCurrentUser";
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        authorization: /^Bearer\s/i.test(token) ? token : "Bearer " + token,
                        OsClient: osClient
                    },
                    body: JSON.stringify({ OsClient: osClient })
                });
                const result = await response.json();
                if (response.ok && result?.Code === 1 && result.Data?.Id) {
                    this.diyStore.setCurrentUser(result.Data);
                    return true;
                }
            } catch (error) {
                console.warn("在线文档登录态校验失败", error);
            }
            // 只清理本次校验的旧 Token，避免另一个并发请求已续签时误删新 Token。
            if ((this.DiyCommon?.getToken?.() || "") === token) {
                this.DiyCommon?.removeToken?.();
                this.diyStore.setCurrentUser({ Id: "", Avatar: "", NickName: "" });
            }
            return false;
        },
        validateAnonymousPublicSource() {
            const raw = String(this.sourceFilePath || this.filePath || "").trim();
            if (!raw || raw.includes("..") || raw.includes("\\")) return false;
            const osClient = String(this.OsClient || this.DiyCommon?.GetOsClient?.() || "").trim().toLowerCase();
            const isTenantPath = (path) => {
                try {
                    const normalized = decodeURIComponent(String(path || "")).replace(/^\/+/, "").toLowerCase();
                    return !!osClient && (normalized === osClient || normalized.startsWith(osClient + "/"));
                } catch (error) {
                    return false;
                }
            };
            if (!/^https?:\/\//i.test(raw)) return isTenantPath(raw);
            try {
                const source = new URL(raw);
                const fileServer = new URL((this.SysConfig && this.SysConfig.FileServer) || "", window.location.origin);
                return source.origin === fileServer.origin && isTenantPath(source.pathname);
            } catch (error) {
                return false;
            }
        },
        async loadOfficeFileMeta() {
            if (!this.isAuthenticated || !this.formEngineKey || !this.formDataId || !this.fieldId || !this.DiyCommon?.Post) return;
            try {
                const result = await this.postJson("/api/HDFS/GetOfficeFileMeta", {
                    FormEngineKey: this.formEngineKey,
                    FormDataId: this.formDataId,
                    FieldId: this.fieldId,
                    SysMenuId: this.sysMenuId,
                    _TableChildAuth: this.tableChildAuth || undefined,
                    FilePathName: this.sourceFilePath,
                    HDFS: this.hdfs || (this.SysConfig && this.SysConfig.HDFS) || "Aliyun"
                });
                if (result?.Code === 1 && result.Data) {
                    this.enableVersion = this.enableVersion || result.Data.EnableVersion === true;
                    if (result.Data.FileMeta) {
                        this.applyOfficeFileMeta(result.Data.FileMeta, {
                            preferPath: this.sourceFilePath
                        });
                    }
                }
            } catch (error) {
                console.warn("GetOfficeFileMeta failed", error);
            }
        },
        applyOfficeFileMeta(fileMeta, options = {}) {
            if (!fileMeta || typeof fileMeta !== "object") return;
            this.officeFileMeta = fileMeta;
            this.officeVersions = this.normalizeVersions(fileMeta.Versions || fileMeta.versions || []);
            const latestPath = fileMeta.Path || fileMeta.FilePathName || fileMeta.path || "";
            const preferPath = options.preferPath || (options.forceLatest ? latestPath : this.sourceFilePath);
            const matchedVersion = !options.forceLatest ? this.findVersionMeta(preferPath) : null;
            const latestVersion = this.officeVersions.find((item) => item.IsLatest) || this.officeVersions[this.officeVersions.length - 1];
            const selectedPath =
                (matchedVersion && (matchedVersion.Path || matchedVersion.FilePathName || matchedVersion.path)) ||
                latestPath ||
                (latestVersion && (latestVersion.Path || latestVersion.FilePathName || latestVersion.path)) ||
                this.sourceFilePath;

            this.currentVersion =
                (matchedVersion && (matchedVersion.Version || matchedVersion.version)) ||
                fileMeta.Version ||
                fileMeta.version ||
                "";
            this.fileName =
                (matchedVersion && (matchedVersion.Name || matchedVersion.FileName || matchedVersion.name)) ||
                fileMeta.Name ||
                fileMeta.FileName ||
                this.fileName;
            this.fileSize =
                (matchedVersion && (matchedVersion.Size || matchedVersion.FileSize || matchedVersion.size)) ||
                fileMeta.Size ||
                fileMeta.FileSize ||
                this.fileSize;
            if (selectedPath) {
                this.sourceFilePath = selectedPath;
                this.selectedVersion = selectedPath;
            } else if (this.enableVersion && !this.selectedVersion) {
                this.selectedVersion = this.sourceFilePath || this.filePath || "current";
            }
            this.fileType = this.getFileExtension(this.fileName || this.sourceFilePath || this.filePath);
        },
        normalizeVersions(versions) {
            if (typeof versions === "string") {
                try {
                    versions = JSON.parse(versions);
                } catch (error) {
                    versions = [];
                }
            }
            return Array.isArray(versions) ? versions.filter((item) => item && (item.Path || item.FilePathName || item.Version)) : [];
        },
        normalizeComparePath(path) {
            if (!path) return "";
            let value = String(path).trim();
            try {
                if (/^https?:\/\//i.test(value)) value = new URL(value).pathname || value;
            } catch (error) {}
            return this.safeDecode(value).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
        },
        findVersionMeta(pathOrVersion) {
            if (!pathOrVersion || !this.officeVersions.length) return null;
            const normalized = this.normalizeComparePath(pathOrVersion);
            return this.officeVersions.find((item) => {
                const version = String(item.Version || item.version || "");
                const path = item.Path || item.FilePathName || item.path || "";
                return version === pathOrVersion || this.normalizeComparePath(path) === normalized;
            }) || null;
        },
        async openCurrentFile() {
            const filePath = await this.resolvePreviewFilePath(this.filePath);
            this.filePath = filePath;
            this.editorConfig = this.buildEditorConfig(filePath, this.GetCurrentUser || {});
            this.Load = !!filePath;
            this.loadRemoteFileSize();
        },
        async reloadEditor() {
            const filePath = await this.resolvePreviewFilePath("");
            this.filePath = filePath;
            this.documentKeySeed = Date.now();
            this.editorConfig = this.buildEditorConfig(filePath, this.GetCurrentUser || {});
            this.Load = false;
            await this.$nextTick();
            this.Load = !!filePath;
        },
        getFileExtension(url) {
            if (!url) return "";
            const baseUrl = String(url).split("?")[0].split("#")[0];
            const extension = baseUrl.split(".").pop();
            return String(extension || "").toLowerCase();
        },
        getFileNameFromUrl(url) {
            if (!url) return "";
            const baseUrl = String(url).split("?")[0].split("#")[0];
            const name = baseUrl.split("/").pop();
            return this.safeDecode(name || "");
        },
        isExpiringSignedUrl(url) {
            if (!url || !/^https?:\/\//i.test(url)) return false;
            return /([?&](X-Amz-|OSSAccessKeyId|Signature|Expires|Expires=|x-oss-))/i.test(url);
        },
        deriveFilePathNameFromSignedUrl(url) {
            try {
                const parsed = new URL(url);
                return decodeURIComponent(parsed.pathname || "").replace(/^\/+/, "");
            } catch (error) {
                return "";
            }
        },
        shouldRefreshPrivateUrl() {
            return !!this.sourceFilePath && (this.isPrivate || this.isExpiringSignedUrl(this.filePath));
        },
        toPublicFileUrl(filePathName) {
            if (!filePathName) return "";
            if (/^(https?:|blob:|data:)/i.test(filePathName)) return filePathName;
            if (this.DiyCommon?.GetServerPath) return this.DiyCommon.GetServerPath(filePathName);
            const fileServer = (this.SysConfig && this.SysConfig.FileServer) || "";
            return fileServer ? fileServer.replace(/\/+$/, "") + "/" + String(filePathName).replace(/^\/+/, "") : filePathName;
        },
        resolvePreviewFilePath(fallbackUrl) {
            if (this.sourceApiUrl) {
                return Promise.resolve(fallbackUrl || this.filePath || "");
            }
            if (!this.sourceFilePath || (!this.isPrivate && !this.isExpiringSignedUrl(fallbackUrl))) {
                return Promise.resolve(fallbackUrl || this.toPublicFileUrl(this.sourceFilePath) || "");
            }
            this.previewLoading = true;
            this.previewError = "";
            return this.getFreshPrivateFileUrl(this.sourceFilePath)
                .then((url) => url || fallbackUrl)
                .catch((error) => {
                    this.previewError = error?.message || "文档预览地址获取失败";
                    return fallbackUrl || "";
                })
                .finally(() => {
                    this.previewLoading = false;
                });
        },
        getFreshPrivateFileUrl(filePathName) {
            return this.postJson("/api/HDFS/GetPrivateFileUrl", {
                FilePathName: filePathName,
                HDFS: this.hdfs || (this.SysConfig && this.SysConfig.HDFS) || "Aliyun",
                FormEngineKey: this.formEngineKey,
                FormDataId: this.formDataId,
                FieldId: this.fieldId,
                SysMenuId: this.sysMenuId,
                _TableChildAuth: this.tableChildAuth || undefined,
                Limit: true,
                ForOfficePreview: true,
                OsClient: this.OsClient || this.DiyCommon?.GetOsClient?.() || ""
            }).then((result) => {
                if ((this.DiyCommon.Result && this.DiyCommon.Result(result)) || result?.Code === 1) {
                    return result.Data;
                }
                throw new Error(result?.Msg || "文档预览地址获取失败");
            });
        },
        buildEditorConfig(filePath, currentUser) {
            if (!filePath) return {};
            const documentType = this.getDocumentType(this.fileType);
            const allowEdit = this.canEdit && documentType !== "pdf";
            return {
                width: "100%",
                height: "100%",
                documentType,
                document: {
                    fileType: this.fileType,
                    key: this.buildDocumentKey(filePath),
                    title: this.fileName || "查看文档",
                    url: filePath,
                    permissions: {
                        edit: allowEdit,
                        download: true
                    }
                },
                editorConfig: {
                    callbackUrl: (this.SysConfig && this.SysConfig.OnlyOfficeCallbackUrl) || "",
                    mode: allowEdit ? "edit" : "view",
                    lang: "zh-CN",
                    user: {
                        id: currentUser.Id || "preview-user",
                        name: currentUser.Name || currentUser.Account || "预览用户"
                    }
                },
                events: {
                    onDownloadAs: this.onDownloadAs
                }
            };
        },
        buildDocumentKey(filePath) {
            const raw = `${this.sourceFilePath || filePath || ""}|${this.currentVersion || ""}|${this.documentKeySeed}`;
            let hash = 0;
            for (let i = 0; i < raw.length; i++) {
                hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
            }
            return `document-${Math.abs(hash)}-${this.documentKeySeed}`;
        },
        getDocumentType(fileType) {
            const type = String(fileType || "").toLowerCase();
            if (type === "xls" || type === "xlsx" || type === "csv") return "cell";
            if (type === "ppt" || type === "pptx") return "slide";
            if (type === "pdf") return "pdf";
            return "word";
        },
        formatFileSize(size) {
            if (typeof size === "string" && /[a-zA-Z\u4e00-\u9fa5]/.test(size)) return size;
            const bytes = Number(size);
            if (!bytes || bytes < 0) return "未知大小";
            const units = ["B", "KB", "MB", "GB", "TB"];
            let value = bytes;
            let unitIndex = 0;
            while (value >= 1024 && unitIndex < units.length - 1) {
                value = value / 1024;
                unitIndex++;
            }
            const precision = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
            return value.toFixed(precision) + " " + units[unitIndex];
        },
        loadRemoteFileSize() {
            // 接口引擎响应文件通常每次请求都会重新生成，不能为探测大小额外执行一次 HEAD。
            if (!this.filePath || this.fileSize || this.sourceApiUrl) return;
            fetch(this.filePath, { method: "HEAD" })
                .then((response) => {
                    const length = response.headers.get("content-length");
                    if (length) this.fileSize = length;
                })
                .catch(() => {});
        },
        async switchVersion(value) {
            const selected = this.officeVersions.find((item) => {
                return item.Path === value || item.FilePathName === value || item.Version === value;
            });
            if (!selected) return;
            this.sourceFilePath = selected.Path || selected.FilePathName || "";
            this.fileName = selected.Name || selected.FileName || this.fileName;
            this.fileSize = selected.Size || selected.FileSize || this.fileSize;
            this.currentVersion = selected.Version || "";
            this.selectedVersion = this.sourceFilePath || value;
            this.fileType = this.getFileExtension(this.fileName || this.sourceFilePath);
            this.syncRouteState();
            await this.reloadEditor();
        },
        async downloadFile() {
            if (!this.filePath || this.downloadLoading || this.previewLoading) return;
            this.downloadLoading = true;
            try {
                if (this.shouldRefreshPrivateUrl()) {
                    this.filePath = await this.getFreshPrivateFileUrl(this.sourceFilePath);
                }
                const response = await fetch(this.filePath);
                if (!response.ok) throw new Error("download failed");
                const blobUrl = URL.createObjectURL(await response.blob());
                this.triggerDownload(blobUrl, this.getDownloadFileName());
                window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            } catch (error) {
                this.triggerDownload(this.filePath, this.getDownloadFileName(), true);
            } finally {
                this.downloadLoading = false;
            }
        },
        async saveOfficeFile() {
            if (!this.canSaveOffice || this.saveLoading) return;
            this.saveLoading = true;
            try {
                const downloadUrl = await this.requestEditorDownloadUrl();
                const result = await this.postJson("/api/HDFS/SaveOfficeDocument", {
                    DownloadUrl: downloadUrl,
                    FilePathName: this.sourceFilePath,
                    FileName: this.fileName,
                    FileType: this.fileType,
                    Limit: this.isPrivate,
                    HDFS: this.hdfs || (this.SysConfig && this.SysConfig.HDFS) || "Aliyun",
                    FormEngineKey: this.formEngineKey,
                    FormDataId: this.formDataId,
                    FieldId: this.fieldId,
                    SysMenuId: this.sysMenuId,
                    _TableChildAuth: this.tableChildAuth || undefined,
                    EnableVersion: this.enableVersion,
                    CurrentFileMeta: this.officeFileMeta
                });
                if (!((this.DiyCommon.Result && this.DiyCommon.Result(result)) || result?.Code === 1)) {
                    throw new Error(result?.Msg || "保存失败");
                }
                const data = result.Data || {};
                if (data.FileMeta) {
                    this.applyOfficeFileMeta(data.FileMeta, {
                        forceLatest: true,
                        preferPath: data.FilePathName
                    });
                }
                if (data.FilePathName) {
                    this.sourceFilePath = data.FilePathName;
                    this.selectedVersion = data.FilePathName;
                }
                if (data.FileName) this.fileName = data.FileName;
                if (data.FileSize) this.fileSize = data.FileSize;
                if (data.Version) this.currentVersion = data.Version;
                this.syncRouteState();
                document.title = this.fileName ? `${this.fileName} - 在线文档` : document.title;
                this.DiyCommon?.Tips?.(this.enableVersion ? "已保存为新版本" : "文件已保存", true);
            } catch (error) {
                this.DiyCommon?.Tips?.(error?.message || "文件保存失败", false);
            } finally {
                this.saveLoading = false;
            }
        },
        requestEditorDownloadUrl() {
            this.clearPendingDownloadAs();
            return new Promise((resolve, reject) => {
                const timer = window.setTimeout(() => {
                    this.pendingDownloadAs = null;
                    reject(new Error("OnlyOffice 导出当前文档超时"));
                }, 30000);
                this.pendingDownloadAs = { resolve, reject, timer };
                try {
                    this.$refs.officeEditor.downloadAs(this.fileType);
                } catch (error) {
                    this.clearPendingDownloadAs();
                    reject(error);
                }
            });
        },
        onDownloadAs(event) {
            const data = event?.data || event?.url || event;
            const url = typeof data === "string" ? data : data?.url || data?.Url || "";
            if (!this.pendingDownloadAs) return;
            if (!url) {
                this.pendingDownloadAs.reject(new Error("OnlyOffice 未返回导出文件地址"));
                this.clearPendingDownloadAs();
                return;
            }
            this.pendingDownloadAs.resolve(url);
            this.clearPendingDownloadAs();
        },
        clearPendingDownloadAs() {
            if (this.pendingDownloadAs?.timer) {
                window.clearTimeout(this.pendingDownloadAs.timer);
            }
            this.pendingDownloadAs = null;
        },
        postJson(url, data) {
            return new Promise((resolve, reject) => {
                if (!this.DiyCommon?.Post) {
                    reject(new Error("接口服务未初始化"));
                    return;
                }
                this.DiyCommon.Post(url, data, resolve, () => reject(new Error("接口请求失败")));
            });
        },
        buildOfficeSessionPayload() {
            return {
                fileName: this.fileName,
                fileSize: this.fileSize,
                fileUrl: this.sourceApiUrl,
                filePathName: this.sourceFilePath,
                hdfs: this.hdfs,
                isPrivate: this.isPrivate,
                formEngineKey: this.formEngineKey,
                formDataId: this.formDataId,
                fieldId: this.fieldId,
                sysMenuId: this.sysMenuId,
                tableChildAuth: this.tableChildAuth,
                canEdit: this.canEdit,
                enableOfficeVersion: this.enableVersion,
                fileMeta: this.officeFileMeta
            };
        },
        syncRouteState() {
            if (!this.$route) return;
            const sessionKey = `microi-office-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            try {
                window.sessionStorage.setItem(sessionKey, JSON.stringify(this.buildOfficeSessionPayload()));
            } catch (error) {}

            const query = {
                ...this.$route.query,
                fileName: this.fileName || undefined,
                fileSize: this.fileSize || undefined,
                fileUrl: this.sourceApiUrl || undefined,
                filePathName: this.sourceFilePath || undefined,
                fileType: this.fileType || undefined,
                hdfs: this.hdfs || undefined,
                formEngineKey: this.formEngineKey || undefined,
                formDataId: this.formDataId || undefined,
                fieldId: this.fieldId || undefined,
                sysMenuId: this.sysMenuId || undefined,
                isPrivate: this.isPrivate ? "1" : "0",
                canEdit: this.canEdit ? "1" : "0",
                enableOfficeVersion: this.enableVersion ? "1" : "0",
                officeSessionKey: sessionKey
            };
            delete query.filePath;
            delete query.documentUrl;
            delete query.sourceUrl;
            Object.keys(query).forEach((key) => {
                if (query[key] === undefined || query[key] === null || query[key] === "") delete query[key];
            });
            const params = new URLSearchParams();
            Object.keys(query).forEach((key) => {
                const value = query[key];
                if (Array.isArray(value)) {
                    value.forEach((item) => params.append(key, item));
                } else {
                    params.set(key, value);
                }
            });
            const baseUrl = window.location.href.split("#")[0];
            const hashPath = this.$route.path || "/online-office";
            const queryString = params.toString();
            window.history.replaceState(
                window.history.state,
                document.title,
                `${baseUrl}#${hashPath}${queryString ? `?${queryString}` : ""}`
            );
        },
        getDownloadFileName() {
            return this.fileName || "document." + (this.fileType || "docx");
        },
        triggerDownload(url, fileName, openInNewTab = false) {
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            if (openInNewTab) {
                link.target = "_blank";
                link.rel = "noopener noreferrer";
            }
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },
        onEditorReady(editorInstance) {
            this.editorInstance = editorInstance;
        }
    }
};
</script>

<style scoped lang="scss">
.onlyoffice-preview-page {
    height: calc(100vh - 70px);
    min-height: 560px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
    overflow: hidden;
}

.onlyoffice-preview-page.anonymous-view {
    height: calc(100vh - 20px);
    min-height: 0;
    padding: 10px;
    background: #f5f7fa;
}

.onlyoffice-file-bar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    background: #fff;
    border: 1px solid #e7ebf3;
    border-radius: 8px;
    box-shadow: 0 6px 18px rgba(28, 47, 84, 0.06);
}

.file-summary {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
}

.file-icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    color: #2451d6;
    background: linear-gradient(135deg, #eef4ff 0%, #e7edff 100%);
    font-size: 24px;
}

.file-meta {
    min-width: 0;
}

.file-name {
    max-width: min(720px, 45vw);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #17233d;
    font-size: 15px;
    font-weight: 600;
}

.file-desc {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 5px;
    color: #7b8798;
    font-size: 12px;
}

.dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #c8d1df;
}

.file-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
}

.version-select {
    width: 150px;
}

.download-btn,
.save-btn {
    height: 38px;
    padding: 0 16px;
    border-radius: 8px;
    font-weight: 600;

    .el-icon {
        margin-right: 6px;
    }
}

.download-btn {
    box-shadow: 0 8px 18px rgba(36, 81, 214, 0.18);
}

.save-btn {
    box-shadow: 0 8px 18px rgba(31, 140, 90, 0.16);
}

.save-btn.is-loading,
.save-btn.is-loading:hover,
.save-btn.is-loading:focus {
    color: #fff !important;
    background: #67c23a !important;
    border-color: #67c23a !important;
}

.save-btn.is-loading::before {
    background-color: transparent !important;
}

.save-btn.is-loading :deep(.el-icon),
.save-btn.is-loading :deep(span) {
    color: #fff !important;
}

.onlyoffice-editor-panel {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    background: #fff;
    border: 1px solid #e7ebf3;
    border-radius: 8px;
}

.empty-file {
    height: 100%;
    min-height: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #8a94a6;
    font-size: 14px;

    .el-icon {
        font-size: 44px;
        color: #c0c8d8;
    }
}

@media (max-width: 768px) {
    .onlyoffice-preview-page {
        height: calc(100vh - 64px);
        min-height: 480px;
        padding: 0 0 8px;
    }

    .onlyoffice-file-bar {
        align-items: stretch;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
    }

    .file-name {
        max-width: calc(100vw - 106px);
    }

    .file-actions {
        align-items: stretch;
        flex-direction: column;
    }

    .version-select,
    .download-btn,
    .save-btn {
        width: 100%;
    }
}
</style>
