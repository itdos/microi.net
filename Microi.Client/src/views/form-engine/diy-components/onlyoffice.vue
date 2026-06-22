<template>
    <div class="onlyoffice-preview-page">
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
            isPrivate: false,
            hdfs: "",
            formEngineKey: "",
            formDataId: "",
            fieldId: "",
            canEdit: false,
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
            const routeFilePath = this.safeDecode(query.filePath || payload.filePath || payload.url || "");
            let sourceFilePath = this.safeDecode(query.filePathName || query.sourceFilePath || query.storagePath || payload.filePathName || payload.sourceFilePath || "");
            let isPrivate = this.parseBoolean(query.isPrivate || query.limit || query.Limit || payload.isPrivate || payload.Limit);

            if (!sourceFilePath && this.isExpiringSignedUrl(routeFilePath)) {
                sourceFilePath = this.deriveFilePathNameFromSignedUrl(routeFilePath);
                isPrivate = true;
            }

            this.sourceFilePath = sourceFilePath;
            this.isPrivate = isPrivate;
            this.hdfs = this.safeDecode(query.hdfs || query.HDFS || payload.hdfs || payload.HDFS || "");
            this.formEngineKey = this.safeDecode(query.formEngineKey || query.FormEngineKey || payload.formEngineKey || payload.FormEngineKey || "");
            this.formDataId = this.safeDecode(query.formDataId || query.FormDataId || payload.formDataId || payload.FormDataId || "");
            this.fieldId = this.safeDecode(query.fieldId || query.FieldId || payload.fieldId || payload.FieldId || "");
            this.canEdit = this.parseBoolean(query.canEdit || query.allowEdit || query.edit || query.CanEdit || payload.canEdit || payload.AllowEdit);
            this.enableVersion = this.parseBoolean(query.enableOfficeVersion || query.EnableOfficeVersion || payload.enableOfficeVersion || payload.EnableOfficeVersion);
            this.fileName = this.safeDecode(query.fileName || query.name || payload.fileName || payload.Name || "") || this.getFileNameFromUrl(sourceFilePath || routeFilePath);
            this.fileType = this.getFileExtension(this.fileName || sourceFilePath || routeFilePath);
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
        async loadOfficeFileMeta() {
            if (!this.formEngineKey || !this.formDataId || !this.fieldId || !this.DiyCommon?.Post) return;
            try {
                const result = await this.postJson("/api/HDFS/GetOfficeFileMeta", {
                    FormEngineKey: this.formEngineKey,
                    FormDataId: this.formDataId,
                    FieldId: this.fieldId,
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
                Limit: true
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
            if (!this.filePath || this.fileSize) return;
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
                filePathName: this.sourceFilePath,
                hdfs: this.hdfs,
                isPrivate: this.isPrivate,
                formEngineKey: this.formEngineKey,
                formDataId: this.formDataId,
                fieldId: this.fieldId,
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
                filePathName: this.sourceFilePath || undefined,
                fileType: this.fileType || undefined,
                hdfs: this.hdfs || undefined,
                isPrivate: this.isPrivate ? "1" : "0",
                canEdit: this.canEdit ? "1" : "0",
                enableOfficeVersion: this.enableVersion ? "1" : "0",
                officeSessionKey: sessionKey
            };
            delete query.filePath;
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
    height: calc(100vh - 100px);
    min-height: 560px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 6px 10px;
    overflow: hidden;
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
