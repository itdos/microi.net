<template>
    <section ref="host" class="micro-app-dialog" data-mci-ui-root>
        <micro-app-runtime-error
            v-if="error"
            :message="error"
            :details="runtimeDiagnostics"
            @retry="retry"
            @back="close"
            @copy="copyDiagnostics"
        />
        <micro-app-loading-skeleton v-else-if="loading" />
        <micro-app
            v-else-if="entryUrl"
            ref="microApp"
            class="micro-app-dialog__app"
            :key="microAppKey"
            :name="microAppName"
            :url="entryUrl"
            :data="microAppData"
            :default-page="routePath"
            router-mode="pure"
            iframe
            @datachange="handleDataChange"
            @mounted="handleMounted"
            @unmount="handleUnmount"
            @error="handleMicroAppError"
        />
    </section>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { useDiyStore } from "@/pinia";
import { buildMicroAppEntryUrl, shouldUseMicroAppResolveFallback } from "@/utils/microAppEntryUrl.js";
import MicroAppLoadingSkeleton from "./loading-skeleton.vue";
import MicroAppRuntimeError from "./runtime-error.vue";
import { applyMicroAppToken } from "./token-sync";

function normalizeName(value) {
    let result = String(value || "app-dialog").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!result || !/^[a-z]/.test(result)) result = "app-" + (result || "dialog");
    return result.substring(0, 64);
}

function normalizeRoute(value) {
    const route = String(value || "/").trim();
    return route.startsWith("/") ? route : "/" + route;
}

export default {
    name: "MicroAppDialog",
    components: { MicroAppLoadingSkeleton, MicroAppRuntimeError },
    setup() {
        return { diyStore: useDiyStore() };
    },
    props: {
        DataAppend: { type: Object, default: () => ({}) }
    },
    data() {
        return {
            loading: true,
            error: "",
            entryUrl: "",
            appVersion: "",
            pageKey: "",
            publishStatus: "",
            assetSource: "",
            httpStatus: "",
            reasonCode: "",
            mountState: "idle",
            retryKey: 0,
            hostViewport: { width: 0, height: 0, safeAreaBottom: 0 },
            resizeObserver: null,
            visualViewportHandler: null,
            themeObserver: null,
            runtimeThemeMode: document.documentElement.classList.contains("dark") ? "dark" : "light",
            runtimeThemeColor: "",
            instanceId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        };
    },
    computed: {
        appKey() {
            return String(this.DataAppend?.AppKey || "").trim();
        },
        routePath() {
            return normalizeRoute(this.DataAppend?.RoutePath || this.DataAppend?.MicroRoute || "/");
        },
        microAppName() {
            return normalizeName(`${this.appKey}-${this.instanceId}`);
        },
        microAppKey() {
            return `${this.microAppName}@${this.entryUrl}@${this.retryKey}`;
        },
        microAppData() {
            const suppliedPermission = this.DataAppend?.PermissionContext || {};
            const permissionContext = {
                sysMenuId: suppliedPermission.sysMenuId || suppliedPermission.SysMenuId || this.DataAppend?.SysMenuId || "",
                moduleEngineKey: suppliedPermission.moduleEngineKey || suppliedPermission.ModuleEngineKey || this.DataAppend?.ModuleEngineKey || "",
                diyTableId: suppliedPermission.diyTableId || suppliedPermission.DiyTableId || this.DataAppend?.DiyTableId || ""
            };
            return {
                apiBase: DiyCommon.GetApiBase(),
                osClient: DiyCommon.GetOsClient(),
                token: DiyCommon.getToken(),
                menuId: permissionContext.sysMenuId,
                moduleEngineKey: permissionContext.moduleEngineKey,
                diyTableId: permissionContext.diyTableId,
                permissionContext,
                appKey: this.appKey,
                version: this.appVersion,
                themeColor: this.runtimeThemeColor || this.diyStore.themeColor || this.diyStore.SysConfig?.ThemeColor || "#409eff",
                themeMode: this.runtimeThemeMode,
                systemStyle: this.diyStore.SystemStyle || "Classic",
                systemTitle: this.diyStore.SysConfig?.SysTitle || this.diyStore.SysConfig?.SysShortTitle || DiyCommon.GetOsClient(),
                systemShortTitle: this.diyStore.SysConfig?.SysShortTitle || "",
                fileServer: this.diyStore.SysConfig?.FileServer || "",
                isOfficialPlatform: this.diyStore.SysConfig?.IsOfficialPlatform === true
                    || Number(this.diyStore.SysConfig?.IsOfficialPlatform || 0) === 1,
                disableFormMaskBlur: this.diyStore.SysConfig?.DisableFormMaskBlur === true
                    || Number(this.diyStore.SysConfig?.DisableFormMaskBlur || 0) === 1,
                currentUser: {
                    Id: this.diyStore.GetCurrentUser?.Id || "",
                    Name: this.diyStore.GetCurrentUser?.Name || this.diyStore.GetCurrentUser?.Account || "",
                    Account: this.diyStore.GetCurrentUser?.Account || "",
                    Level: this.diyStore.GetCurrentUser?.Level ?? 0
                },
                hostViewport: this.hostViewport,
                microRoute: this.routePath,
                dialog: true,
                dialogData: this.DataAppend?.Data || {},
                route: { microRoute: this.routePath, microRoutePath: this.routePath }
            };
        },
        runtimeDiagnostics() {
            return {
                appKey: this.appKey,
                pageKey: this.pageKey,
                routePath: this.routePath,
                version: this.appVersion,
                entryUrl: this.entryUrl,
                httpStatus: this.httpStatus,
                publishStatus: this.publishStatus,
                assetSource: this.assetSource,
                mountState: this.mountState,
                reasonCode: this.reasonCode
            };
        }
    },
    created() {
        this.resolveEntryUrl();
    },
    mounted() {
        this.startThemeContract();
        this.startViewportContract();
    },
    beforeUnmount() {
        this.stopThemeContract();
        this.stopViewportContract();
    },
    methods: {
        async resolveEntryUrl() {
            this.loading = true;
            this.error = "";
            this.entryUrl = "";
            this.httpStatus = "";
            this.reasonCode = "";
            this.mountState = "resolving";
            try {
                if (!this.appKey) throw new Error("OpenAppDialog 缺少 AppKey");
                const requestedVersion = String(this.DataAppend?.Version || "").trim();
                let result = null;
                try {
                    result = await DiyCommon.PostAsync("/api/MicroApp/Resolve", {
                        OsClient: DiyCommon.GetOsClient(),
                        AppKey: this.appKey,
                        Version: requestedVersion,
                        RoutePath: this.routePath
                    });
                } catch (resolveError) {
                    if (!shouldUseMicroAppResolveFallback(null, { requestedVersion })) throw resolveError;
                }
                const usingFallback = Number(result?.Code) !== 1;
                if (usingFallback) {
                    if (!shouldUseMicroAppResolveFallback(result, { requestedVersion })) {
                        const error = new Error(result?.Msg || `未找到已发布微服务：${this.appKey}`);
                        error.reasonCode = result?.Data?.ReasonCode || "MICRO_APP_RESOLVE_FAILED";
                        throw error;
                    }
                }
                const runtime = result?.Data || {};
                this.appVersion = String(runtime.Version || requestedVersion || "");
                this.pageKey = String(runtime.Page?.PageKey || "");
                this.publishStatus = String(runtime.PublishStatus || (usingFallback ? "CompatibilityFallback" : ""));
                this.assetSource = String(runtime.AssetSource || runtime.StorageMode || (usingFallback ? "managed-stable-entry" : ""));
                let url = String(runtime.EntryUrl || "");
                if (!url) {
                    url = buildMicroAppEntryUrl({
                        apiBase: DiyCommon.GetApiBase(),
                        osClient: DiyCommon.GetOsClient(),
                        appKey: this.appKey,
                        version: usingFallback ? "" : this.appVersion
                    });
                }
                if (url.startsWith("/")) url = String(DiyCommon.GetApiBase() || "").replace(/\/+$/, "") + url;
                await this.probeEntry(url);
                this.entryUrl = url;
                this.mountState = "mounting";
            } catch (error) {
                this.error = error?.message || String(error);
                this.httpStatus = String(error?.httpStatus || "");
                this.reasonCode = String(error?.reasonCode || "MICRO_APP_LOAD_FAILED");
                this.mountState = "error";
                this.invokeCallback("OnError", { message: this.error, errorType: "load", handled: false, reasonCode: this.reasonCode });
            } finally {
                this.loading = false;
            }
        },
        async probeEntry(url) {
            this.mountState = "probing";
            const response = await fetch(url, { method: "GET", headers: { Accept: "text/html,application/xhtml+xml" }, cache: "no-store" });
            this.httpStatus = String(response.status);
            const contentType = String(response.headers.get("content-type") || "").toLowerCase();
            const text = await response.text();
            if (!response.ok) {
                const error = new Error(`运行入口请求失败（HTTP ${response.status}）`);
                error.httpStatus = response.status;
                error.reasonCode = "MICRO_APP_ENTRY_HTTP_ERROR";
                throw error;
            }
            if (!contentType.includes("text/html") || !/<head[\s>]/i.test(text) || !/<body[\s>]/i.test(text)) {
                const error = new Error("运行入口未返回完整 HTML 文档");
                error.httpStatus = response.status;
                error.reasonCode = "MICRO_APP_ENTRY_INVALID_HTML";
                throw error;
            }
        },
        handleDataChange(event) {
            const payload = event?.detail?.data ?? event?.detail ?? event ?? {};
            if (applyMicroAppToken(payload)) return;
            const type = String(payload?.type || payload?.Type || "").toLowerCase();
            const data = payload?.data ?? payload?.Data ?? payload;
            if (type === "app-dialog:success" || type === "success") {
                this.invokeCallback("OnSuccess", data);
                this.close();
            } else if (type === "app-dialog:cancel" || type === "cancel") {
                this.invokeCallback("OnCancel", data);
                this.close();
            } else if (type === "app-dialog:error" || type === "error") {
                const handled = payload?.handled === true || payload?.Handled === true || data?.handled === true || data?.Handled === true;
                if (!handled) this.invokeCallback("OnError", { ...data, handled: false, errorType: data?.errorType || "business" });
            }
        },
        handleMounted() {
            this.mountState = "mounted";
            this.pushViewportContract();
        },
        handleUnmount() {
            if (!this.error) this.mountState = "unmounted";
        },
        handleMicroAppError(event) {
            const detail = event?.detail ?? event ?? {};
            this.error = detail?.message || detail?.error?.message || "微服务挂载失败";
            this.reasonCode = "MICRO_APP_MOUNT_FAILED";
            this.mountState = "error";
            this.invokeCallback("OnError", { message: this.error, errorType: "load", handled: false, reasonCode: this.reasonCode });
        },
        retry() {
            this.retryKey += 1;
            this.resolveEntryUrl();
        },
        async copyDiagnostics() {
            const text = JSON.stringify({ ...this.runtimeDiagnostics, message: this.error }, null, 2);
            try {
                await navigator.clipboard.writeText(text);
                this.$message?.success?.("诊断信息已复制");
            } catch (_) {
                console.info("[MicroAppDialog] diagnostics", text);
            }
        },
        startViewportContract() {
            this.updateViewportContract();
            if (typeof ResizeObserver !== "undefined" && this.$refs.host) {
                this.resizeObserver = new ResizeObserver(() => this.updateViewportContract());
                this.resizeObserver.observe(this.$refs.host);
            }
            this.visualViewportHandler = () => this.updateViewportContract();
            window.visualViewport?.addEventListener("resize", this.visualViewportHandler);
            window.addEventListener("resize", this.visualViewportHandler);
        },
        stopViewportContract() {
            this.resizeObserver?.disconnect?.();
            if (this.visualViewportHandler) {
                window.visualViewport?.removeEventListener("resize", this.visualViewportHandler);
                window.removeEventListener("resize", this.visualViewportHandler);
            }
        },
        updateViewportContract() {
            const host = this.$refs.host;
            if (!host) return;
            const rect = host.getBoundingClientRect();
            this.hostViewport = { width: Math.round(rect.width), height: Math.round(rect.height), safeAreaBottom: 0 };
            host.style.setProperty("--micro-app-available-width", `${Math.round(rect.width)}px`);
            host.style.setProperty("--micro-app-available-height", `${Math.round(rect.height)}px`);
            this.pushViewportContract();
        },
        pushViewportContract() {
            const app = this.$refs.microApp;
            if (app && typeof app.setData === "function") app.setData({ ...this.microAppData, type: "host:resize" });
        },
        resolveRuntimeThemeColor() {
            return String(
                this.diyStore.themeColor
                || this.diyStore.SysConfig?.ThemeColor
                || getComputedStyle(document.documentElement).getPropertyValue("--el-color-primary")
                || "#409eff"
            ).trim();
        },
        syncRuntimeTheme(push = true) {
            const nextMode = document.documentElement.classList.contains("dark") ? "dark" : "light";
            const nextColor = this.resolveRuntimeThemeColor();
            const changed = nextMode !== this.runtimeThemeMode || nextColor !== this.runtimeThemeColor;
            this.runtimeThemeMode = nextMode;
            this.runtimeThemeColor = nextColor;
            if (push && changed) this.$nextTick(() => this.pushRuntimeContext("host:theme"));
        },
        startThemeContract() {
            this.syncRuntimeTheme(false);
            if (typeof MutationObserver === "undefined") return;
            this.themeObserver = new MutationObserver(() => this.syncRuntimeTheme(true));
            this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
        },
        stopThemeContract() {
            this.themeObserver?.disconnect?.();
            this.themeObserver = null;
        },
        pushRuntimeContext(type = "host:context") {
            const data = { ...this.microAppData, type };
            if (this.microAppName && typeof window.microApp?.forceSetData === "function") {
                window.microApp.forceSetData(this.microAppName, data);
                return;
            }
            const app = this.$refs.microApp;
            if (app && typeof app.setData === "function") app.setData(data);
        },
        invokeCallback(name, data) {
            const callback = this.DataAppend?.[name];
            if (typeof callback === "function") {
                try { callback(data); } catch (error) { console.error(`[OpenAppDialog] ${name} callback failed`, error); }
            }
        },
        close() {
            this.DataAppend?.V8?.CloseThisDialog?.();
        }
    }
};
</script>

<style lang="scss" scoped>
.micro-app-dialog {
    --micro-app-available-width: 100%;
    --micro-app-available-height: 100%;
    --micro-app-safe-area-bottom: env(safe-area-inset-bottom, 0px);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100%;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--mci-shape-panel, var(--mci-radius-lg, 16px));
    background: var(--mci-bg-base, var(--el-bg-color-page));
}

.micro-app-dialog__app {
    display: block;
    flex: 1 1 auto;
    width: var(--micro-app-available-width);
    height: var(--micro-app-available-height);
    min-width: 0;
    min-height: 0;
    padding-bottom: var(--micro-app-safe-area-bottom);
    box-sizing: border-box;
    overflow: hidden;
}

// micro-app 的 iframe 沙箱会把子应用 body 投影成 light DOM 的
// micro-app-body。弹窗本身必须保持固定高度，但没有自行声明滚动区的
// 历史微服务也不能因此被裁掉；这里提供统一、单一的纵向滚动兜底。
.micro-app-dialog__app :deep(> micro-app-body) {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    -webkit-overflow-scrolling: touch;
}
</style>
