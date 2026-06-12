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
                    </div>
                </div>
            </div>
            <el-button class="download-btn" type="primary" :disabled="!filePath || previewLoading" :loading="downloadLoading" @click="downloadFile">
                <el-icon><Download /></el-icon>
                <span>下载文件</span>
            </el-button>
        </div>

        <div class="onlyoffice-editor-panel">
            <!--
        https://api.onlyoffice.com/zh-CN/docs/docs-api/get-started/how-it-works/opening-file/
        https://helpcenter.onlyoffice.com/docs/installation/docs-community-install-docker.aspx?_ga=2.51711023.782359554.1594636128-1157782750.1587541027
        -->
            <DynamicOnlyOfficeEditor v-if="Load" :document-server-url="serverUrl" :config="editorConfig" @editor-ready="onEditorReady" />
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
            serverUrl: "", // 默认地址，可动态修改
            editorConfig: {},
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
            previewLoading: false,
            previewError: "",
            downloadLoading: false
        };
    },
    computed: {
        fileTypeLabel() {
            if (!this.fileType) {
                return "Office 文件";
            }
            return this.fileType.toUpperCase() + " 文件";
        },
        fileSizeText() {
            return this.formatFileSize(this.fileSize);
        }
    },
    async mounted() {
        var self = this;
        var routeFilePath = self.safeDecode(self.$route.query.filePath || "");
        var sourceFilePath = self.safeDecode(self.$route.query.filePathName || self.$route.query.sourceFilePath || self.$route.query.storagePath || "");
        var fileName = self.safeDecode(self.$route.query.fileName || self.$route.query.name || "");
        var fileSize = self.$route.query.fileSize || self.$route.query.size || "";
        var isPrivate = self.parseBoolean(self.$route.query.isPrivate || self.$route.query.limit || self.$route.query.Limit);
        if (!sourceFilePath && self.isExpiringSignedUrl(routeFilePath)) {
            sourceFilePath = self.deriveFilePathNameFromSignedUrl(routeFilePath);
            isPrivate = true;
        }

        self.sourceFilePath = sourceFilePath;
        self.isPrivate = isPrivate;
        self.hdfs = self.safeDecode(self.$route.query.hdfs || self.$route.query.HDFS || "");
        self.formEngineKey = self.safeDecode(self.$route.query.formEngineKey || self.$route.query.FormEngineKey || "");
        self.formDataId = self.safeDecode(self.$route.query.formDataId || self.$route.query.FormDataId || "");
        self.fieldId = self.safeDecode(self.$route.query.fieldId || self.$route.query.FieldId || "");
        self.fileName = fileName || self.getFileNameFromUrl(sourceFilePath || routeFilePath);
        self.fileType = self.getFileExtension(self.fileName || sourceFilePath || routeFilePath);
        self.fileSize = fileSize;

        const currentUser = self.GetCurrentUser || {};
        self.serverUrl = (self.SysConfig && self.SysConfig.OnlyOfficeApiBase) || "";
        if (self.fileName) {
            document.title = self.fileName + " - 在线文档";
        }
        const filePath = await self.resolvePreviewFilePath(routeFilePath);
        self.filePath = filePath;
        self.editorConfig = self.buildEditorConfig(filePath, currentUser);
        self.Load = !!filePath;
        self.loadRemoteFileSize();
    },
    methods: {
        safeDecode(value) {
            if (!value) {
                return "";
            }
            try {
                return decodeURIComponent(value);
            } catch (error) {
                return value;
            }
        },
        parseBoolean(value) {
            return value === true || value === 1 || value === "1" || value === "true" || value === "True";
        },
        getFileExtension(url) {
            if (!url) {
                return "";
            }
            // 处理URL中的查询参数部分
            const baseUrl = url.split("?")[0];

            // 获取最后一个点后面的部分
            const extension = baseUrl.split(".").pop();

            return extension.toLowerCase();
        },
        getFileNameFromUrl(url) {
            if (!url) {
                return "";
            }
            const baseUrl = url.split("?")[0].split("#")[0];
            const name = baseUrl.split("/").pop();
            return this.safeDecode(name || "");
        },
        isExpiringSignedUrl(url) {
            if (!url || !/^https?:\/\//i.test(url)) {
                return false;
            }
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
        resolvePreviewFilePath(fallbackUrl) {
            if (!this.sourceFilePath || (!this.isPrivate && !this.isExpiringSignedUrl(fallbackUrl))) {
                return Promise.resolve(fallbackUrl || this.sourceFilePath || "");
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
            return new Promise((resolve, reject) => {
                if (!this.DiyCommon || !this.DiyCommon.Post) {
                    reject(new Error("文件服务未初始化"));
                    return;
                }
                this.DiyCommon.Post(
                    "/api/HDFS/GetPrivateFileUrl",
                    {
                        FilePathName: filePathName,
                        HDFS: this.hdfs || (this.SysConfig && this.SysConfig.HDFS) || "Aliyun",
                        FormEngineKey: this.formEngineKey,
                        FormDataId: this.formDataId,
                        FieldId: this.fieldId,
                        Limit: true
                    },
                    (result) => {
                        if ((this.DiyCommon.Result && this.DiyCommon.Result(result)) || result?.Code === 1) {
                            resolve(result.Data);
                        } else {
                            reject(new Error(result?.Msg || "文档预览地址获取失败"));
                        }
                    },
                    () => reject(new Error("文档预览地址获取失败"))
                );
            });
        },
        buildEditorConfig(filePath, currentUser) {
            if (!filePath) {
                return {};
            }
            return {
                width: "100%",
                height: "100%",
                document: {
                    fileType: this.fileType,
                    key: "document-" + Date.now(),
                    title: this.fileName || "查看文档",
                    url: filePath,
                    permissions: {
                        edit: false,
                        download: true
                    }
                },
                // documentType: "word",
                // token : 'nas.OnlyOffice',
                editorConfig: {
                    callbackUrl: "https://example.com/url-to-callback.ashx",
                    // mode: 'edit',
                    mode: "view",
                    lang: "zh-CN",
                    user: {
                        id: currentUser.Id || "preview-user",
                        name: currentUser.Name || currentUser.Account || "预览用户"
                    }
                }
            };
        },
        formatFileSize(size) {
            if (typeof size === "string" && /[a-zA-Z\u4e00-\u9fa5]/.test(size)) {
                return size;
            }
            const bytes = Number(size);
            if (!bytes || bytes < 0) {
                return "未知大小";
            }
            const units = ["B", "KB", "MB", "GB", "TB"];
            var value = bytes;
            var unitIndex = 0;
            while (value >= 1024 && unitIndex < units.length - 1) {
                value = value / 1024;
                unitIndex++;
            }
            const precision = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
            return value.toFixed(precision) + " " + units[unitIndex];
        },
        loadRemoteFileSize() {
            if (!this.filePath || this.fileSize) {
                return;
            }
            fetch(this.filePath, { method: "HEAD" })
                .then((response) => {
                    const length = response.headers.get("content-length");
                    if (length) {
                        this.fileSize = length;
                    }
                })
                .catch(() => {});
        },
        async downloadFile() {
            if (!this.filePath || this.downloadLoading || this.previewLoading) {
                return;
            }
            this.downloadLoading = true;
            try {
                if (this.shouldRefreshPrivateUrl()) {
                    this.filePath = await this.getFreshPrivateFileUrl(this.sourceFilePath);
                }
                const response = await fetch(this.filePath);
                if (!response.ok) {
                    throw new Error("download failed");
                }
                const blobUrl = URL.createObjectURL(await response.blob());
                this.triggerDownload(blobUrl, this.getDownloadFileName());
                window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            } catch (error) {
                this.triggerDownload(this.filePath, this.getDownloadFileName(), true);
            } finally {
                this.downloadLoading = false;
            }
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
        updateServer() {
            // 切换服务器地址时会自动重新初始化编辑器
            this.$forceUpdate();
        },
        onEditorReady(editorInstance) {
            console.log("编辑器已准备就绪", editorInstance);
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
    max-width: min(720px, 52vw);
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

.download-btn {
    height: 38px;
    padding: 0 16px;
    border-radius: 8px;
    font-weight: 600;
    box-shadow: 0 8px 18px rgba(36, 81, 214, 0.18);

    .el-icon {
        margin-right: 6px;
    }
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

    .download-btn {
        width: 100%;
    }
}
</style>
