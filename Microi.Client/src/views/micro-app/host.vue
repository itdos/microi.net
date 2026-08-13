<template>
    <div ref="host" class="micro-app-host" data-mci-ui-root>
        <micro-app-runtime-error
            v-if="error"
            :message="error"
            :details="runtimeDiagnostics"
            @retry="retry"
            @back="goBack"
            @copy="copyDiagnostics"
        />
        <micro-app-loading-skeleton v-else-if="loading" />
        <micro-app
            v-else-if="entryUrl"
            ref="microApp"
            class="micro-app-host__app"
            :key="microAppKey"
            :name="microAppName"
            :url="entryUrl"
            :data="microAppData"
            :baseroute="baseRoute"
            :default-page="microRoutePath || '/'"
            router-mode="pure"
            iframe
            keep-alive
            @datachange="handleDataChange"
            @mounted="handleMounted"
            @unmount="handleUnmount"
            @beforeshow="handleBeforeShow"
            @aftershow="handleAfterShow"
            @afterhidden="handleAfterHidden"
            @error="handleMicroAppError"
        />
    </div>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { useDiyStore, useTagsViewStore } from "@/pinia";
import { buildMicroAppEntryUrl, shouldUseMicroAppResolveFallback } from "@/utils/microAppEntryUrl.js";
import { resolveMicroAppHostViewport } from "@/utils/microAppViewport.js";
import MicroAppLoadingSkeleton from "./loading-skeleton.vue";
import MicroAppRuntimeError from "./runtime-error.vue";
import { hasRenderableMicroAppContent, shouldAutoRecoverMicroApp } from "./render-health.js";
import {
    MICRO_APP_HOST_ACTION_RESULT_TYPE,
    MICRO_APP_HOST_PROTOCOL,
    createMicroAppHostCapabilities,
    normalizeHostMessage,
    normalizeHostRouteTarget,
    normalizeHostTabTitle,
    parseMicroAppHostAction
} from "./host-bridge.js";
import { applyMicroAppToken } from "./token-sync";
import {
    MICRO_APP_RUNTIME_CACHE_MODE,
    createMicroAppRuntimeName,
    destroyMicroAppRuntimeCache,
    forgetMicroAppRuntimeCache,
    markMicroAppRuntimeActive,
    markMicroAppRuntimeHidden,
    registerMicroAppRuntimeCache
} from "@/utils/microAppRuntimeCache.js";

function safeDecode(value) {
    if (DiyCommon.IsNull(value)) return "";
    try {
        return decodeURIComponent(String(value).replace(/\+/g, "%20"));
    } catch (error) {
        return String(value);
    }
}

function parseQueryString(queryString) {
    if (DiyCommon.IsNull(queryString)) return {};
    const raw = String(queryString).replace(/^\?/, "");
    const params = new URLSearchParams(raw);
    const result = {};
    params.forEach((value, key) => {
        result[key] = value;
    });
    return result;
}

function normalizeMicroRoutePath(value) {
    const routePath = safeDecode(value || "/").trim().replace(/^#/, "");
    if (!routePath || routePath === "/") return "/";
    return routePath.startsWith("/") ? routePath : "/" + routePath;
}

function parseMicroAppPath(value) {
    const result = {
        appKey: "",
        version: "",
        routePath: "",
        isEntryUrl: false,
        isFriendlyRoute: false
    };
    if (DiyCommon.IsNull(value)) return result;

    const rawUrl = safeDecode(value).trim();
    let parsedUrl = null;
    try {
        parsedUrl = new URL(rawUrl, window.location.origin);
    } catch (error) {
        parsedUrl = null;
    }

    const pathname = (parsedUrl ? parsedUrl.pathname : rawUrl.split(/[?#]/)[0]).replace(/\/+$/, "");
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] !== "micro-app") return result;

    const indexHtmlIndex = segments.findIndex((segment) => segment.toLowerCase() === "index.html");
    if (indexHtmlIndex > -1) {
        result.isEntryUrl = true;
        result.appKey = safeDecode(segments[2] || "");
        if (indexHtmlIndex > 3) {
            result.version = safeDecode(segments[3] || "");
        }
    } else {
        result.isFriendlyRoute = true;
        result.appKey = safeDecode(segments[1] || "");
        result.routePath = normalizeMicroRoutePath(segments.slice(2).map(safeDecode).join("/"));
    }

    if (parsedUrl) {
        const version = parsedUrl.searchParams.get("v") || parsedUrl.searchParams.get("version") || "";
        if (!result.version && version) result.version = safeDecode(version);
        const routePath = parsedUrl.searchParams.get("microRoute") || parsedUrl.searchParams.get("routePath") || "";
        if (routePath) result.routePath = normalizeMicroRoutePath(routePath);
    }

    return result;
}

function removeMicroRouteQuery(url) {
    if (DiyCommon.IsNull(url)) return "";
    const rawUrl = String(url);
    try {
        const parsedUrl = new URL(rawUrl, window.location.origin);
        parsedUrl.searchParams.delete("microRoute");
        parsedUrl.searchParams.delete("routePath");
        if (/^https?:\/\//i.test(rawUrl)) {
            return parsedUrl.toString();
        }
        return parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
    } catch (error) {
        return rawUrl
            .replace(/([?&])(microRoute|routePath)=[^&#]*&?/gi, "$1")
            .replace(/[?&]$/, "");
    }
}

function joinUrl(baseUrl, path) {
    return String(baseUrl || "").replace(/\/+$/, "") + "/" + String(path || "").replace(/^\/+/, "");
}

export default {
    name: "MicroAppHost",
    components: { MicroAppLoadingSkeleton, MicroAppRuntimeError },
    setup() {
        return { diyStore: useDiyStore(), tagsViewStore: useTagsViewStore() };
    },
    data() {
        const route = this.$route || {};
        return {
            loading: true,
            error: "",
            entryUrl: "",
            appKey: "",
            appVersion: "",
            microRoutePath: "",
            pageKey: "",
            publishStatus: "",
            assetSource: "",
            httpStatus: "",
            reasonCode: "",
            mountState: "idle",
            retryKey: 0,
            resolveGeneration: 0,
            mountWatchdog: null,
            autoMountRetryCount: 0,
            mountReadyGeneration: 0,
            mountReadyAttempt: -1,
            childReadyRendered: false,
            hostViewport: { width: 0, height: 0, safeAreaBottom: 0 },
            resizeObserver: null,
            visualViewportHandler: null,
            isHostActive: true,
            runtimeInstanceName: "",
            cacheState: "cold",
            ownedRoutePath: route.path || "",
            ownedRouteFullPath: route.fullPath || "",
            ownedRouteName: route.name || "",
            ownedRouteMeta: { ...(route.meta || {}) },
            ownedRouteQuery: { ...(route.query || {}) }
        };
    },
    computed: {
        microAppName() {
            return this.runtimeInstanceName;
        },
        microAppKey() {
            return `${this.microAppName}@${this.entryUrl}@${this.retryKey}`;
        },
        baseRoute() {
            return this.ownedRoutePath || "/";
        },
        microAppData() {
            const permissionContext = {
                sysMenuId: this.ownedRouteMeta?.Id || "",
                moduleEngineKey: this.ownedRouteMeta?.ModuleEngineKey || "",
                diyTableId: this.ownedRouteMeta?.DiyTableId || ""
            };
            return {
                apiBase: DiyCommon.GetApiBase(),
                osClient: DiyCommon.GetOsClient(),
                token: DiyCommon.getToken(),
                menuId: permissionContext.sysMenuId,
                menuName: this.ownedRouteMeta?.title || "",
                moduleEngineKey: permissionContext.moduleEngineKey,
                diyTableId: permissionContext.diyTableId,
                permissionContext,
                appKey: this.appKey,
                version: this.appVersion,
                themeColor: this.diyStore.themeColor || this.diyStore.SysConfig?.ThemeColor || "#409eff",
                themeMode: document.documentElement.classList.contains("dark") ? "dark" : "light",
                systemStyle: this.diyStore.SystemStyle || "Classic",
                systemTitle: this.diyStore.SysConfig?.SysTitle || this.diyStore.SysConfig?.SysShortTitle || DiyCommon.GetOsClient(),
                systemShortTitle: this.diyStore.SysConfig?.SysShortTitle || "",
                hostCapabilities: createMicroAppHostCapabilities(),
                hostGeneration: this.resolveGeneration,
                hostMountAttempt: this.retryKey,
                hostViewport: this.hostViewport,
                cache: {
                    mode: MICRO_APP_RUNTIME_CACHE_MODE,
                    state: this.cacheState,
                    instanceName: this.microAppName,
                    stateEvent: "appstate-change"
                },
                microRoute: this.microRoutePath,
                route: {
                    path: this.ownedRoutePath,
                    fullPath: this.ownedRouteFullPath,
                    query: this.ownedRouteQuery,
                    microRoute: this.microRoutePath,
                    microRoutePath: this.microRoutePath
                }
            };
        },
        runtimeDiagnostics() {
            return {
                appKey: this.appKey,
                pageKey: this.pageKey,
                routePath: this.microRoutePath,
                version: this.appVersion,
                entryUrl: this.entryUrl,
                httpStatus: this.httpStatus,
                publishStatus: this.publishStatus,
                assetSource: this.assetSource,
                mountState: this.mountState,
                cacheMode: MICRO_APP_RUNTIME_CACHE_MODE,
                cacheState: this.cacheState,
                cacheInstance: this.microAppName,
                childReadyRendered: this.childReadyRendered,
                reasonCode: this.reasonCode
            };
        }
    },
    created() {
        this.resolveEntryUrl();
    },
    mounted() {
        this.startViewportContract();
        window.addEventListener("page-refresh", this.handleHostPageRefresh);
    },
    beforeUnmount() {
        this.isHostActive = false;
        this.clearMountWatchdog();
        this.resolveGeneration += 1;
        this.stopViewportContract();
        window.removeEventListener("page-refresh", this.handleHostPageRefresh);
        if (this.microAppName && !this.$refs.microApp) {
            forgetMicroAppRuntimeCache(this.microAppName, "host-cancelled-before-mount");
        }
    },
    methods: {
        async handleDataChange(event) {
            const payload = event?.detail?.data ?? event?.detail ?? event ?? {};
            if (applyMicroAppToken(payload)) return;
            const hostAction = parseMicroAppHostAction(payload);
            if (hostAction) {
                await this.handleHostAction(hostAction);
                return;
            }
            const type = String(payload?.type || payload?.Type || "").toLowerCase();
            if (type === "micro-app:ready") {
                const data = payload?.data ?? payload?.Data ?? {};
                const readyGeneration = Number(data?.hostGeneration || data?.HostGeneration || 0);
                const readyAttempt = Number(data?.hostMountAttempt ?? data?.HostMountAttempt ?? -1);
                if (readyGeneration && readyGeneration !== this.resolveGeneration) return;
                if (readyAttempt >= 0 && readyAttempt !== this.retryKey) return;
                // 子应用信号只表示它执行到了渲染确认点。最终成功仍由宿主对
                // micro-app-body/#app 的真实 DOM 与几何尺寸复核，避免 iframe
                // 初始化竞态把“已执行脚本”误判成“用户已经看见内容”。
                this.mountReadyGeneration = readyGeneration || this.resolveGeneration;
                this.mountReadyAttempt = readyAttempt >= 0 ? readyAttempt : this.retryKey;
                this.childReadyRendered = data?.rendered === true || data?.Rendered === true;
                this.mountState = "verifying";
                this.startContentWatchdog(this.resolveGeneration, this.retryKey);
                return;
            }
            if (type === "micro-app:interaction") {
                window.dispatchEvent(new CustomEvent("microi:close-global-overlays"));
                return;
            }
            const handled = payload?.handled === true || payload?.Handled === true;
            const errorType = String(payload?.errorType || payload?.ErrorType || "business").toLowerCase();
            if ((type === "error" || type === "app:error") && !handled && ["load", "protocol", "runtime"].includes(errorType)) {
                const data = payload?.data ?? payload?.Data ?? payload;
                this.setRuntimeError(data?.message || data?.Msg || "微服务运行异常", {
                    reasonCode: data?.reasonCode || data?.ReasonCode || "MICRO_APP_RUNTIME_ERROR"
                });
            }
        },
        async handleHostAction(request) {
            try {
                let result = {};
                switch (request.action) {
                    case "closeTab":
                        result = await this.closeCurrentHostTab();
                        break;
                    case "navigate":
                        result = await this.navigateHostRoute(request.data, false);
                        break;
                    case "replaceTab":
                        result = await this.navigateHostRoute(request.data, true);
                        break;
                    case "back":
                        result = await this.goBackHostRoute();
                        break;
                    case "forward":
                        result = await this.goForwardHostRoute();
                        break;
                    case "reloadTab":
                        this.retry();
                        result = { accepted: true };
                        break;
                    case "setTabTitle":
                        result = this.setCurrentHostTabTitle(request.data);
                        break;
                    case "showMessage":
                        result = this.showHostMessage(request.data);
                        break;
                    default:
                        throw Object.assign(new Error("宿主不支持该微服务操作"), { code: "HOST_ACTION_UNSUPPORTED" });
                }
                this.sendHostActionResult(request, true, result);
            } catch (error) {
                const message = error?.message || String(error);
                this.sendHostActionResult(request, false, null, {
                    code: error?.code || "HOST_ACTION_FAILED",
                    message
                });
                const silent = request.data?.silent === true || request.data?.Silent === true;
                if (!silent) this.$message?.error?.(message);
            }
        },
        sendHostActionResult(request, success, data = null, error = null) {
            const app = this.$refs.microApp;
            if (!app || typeof app.setData !== "function") return;
            app.setData({
                type: MICRO_APP_HOST_ACTION_RESULT_TYPE,
                protocol: MICRO_APP_HOST_PROTOCOL,
                requestId: request.requestId,
                action: request.action,
                success,
                data,
                error
            });
        },
        getCurrentVisitedView() {
            return this.tagsViewStore?.visitedViews?.find((view) => view.fullPath === this.ownedRouteFullPath) || null;
        },
        async closeCurrentHostTab() {
            const visitedViews = this.tagsViewStore?.visitedViews || [];
            const currentView = this.getCurrentVisitedView();
            if (!currentView) {
                throw Object.assign(new Error("当前页面不在系统 Tab 中"), { code: "HOST_TAB_NOT_FOUND" });
            }
            if (currentView.meta?.affix) {
                throw Object.assign(new Error("固定 Tab 不能关闭"), { code: "HOST_TAB_AFFIXED" });
            }
            if (visitedViews.length <= 1) {
                throw Object.assign(new Error("已经是最后一个 Tab，不能关闭"), { code: "HOST_TAB_LAST" });
            }

            const closedPath = currentView.fullPath;
            const { visitedViews: remainingViews } = await this.tagsViewStore.delView(currentView);
            const nextView = remainingViews.slice(-1)[0];
            if (nextView?.fullPath) await this.$router.push(nextView.fullPath);
            else await this.$router.push("/");
            return { closedPath, nextPath: nextView?.fullPath || "/" };
        },
        resolveHostRoute(input) {
            const target = normalizeHostRouteTarget(input);
            const resolved = this.$router.resolve(target);
            if (!resolved?.matched?.length || resolved.name === "page_404" || resolved.matched.some((record) => record.name === "page_404")) {
                throw Object.assign(new Error("目标系统路由不存在或当前用户无权访问"), { code: "HOST_ROUTE_NOT_FOUND" });
            }
            return { target, resolved };
        },
        async navigateHostRoute(input, replaceCurrentTab) {
            const currentView = this.getCurrentVisitedView();
            const { target, resolved } = this.resolveHostRoute(input);
            if (replaceCurrentTab) await this.$router.replace(target);
            else await this.$router.push(target);

            const activeRoute = this.$router?.currentRoute?.value || this.$route;
            if (replaceCurrentTab && currentView && currentView.fullPath !== activeRoute?.fullPath) {
                this.tagsViewStore.addView(activeRoute);
                await this.tagsViewStore.delView(currentView);
            }
            return { fullPath: activeRoute?.fullPath || resolved.fullPath, replaced: replaceCurrentTab };
        },
        async goBackHostRoute() {
            const backPath = this.$router?.options?.history?.state?.back;
            if (typeof backPath === "string" && backPath.startsWith("/")) {
                this.$router.back();
                return { accepted: true };
            }
            await this.$router.push("/");
            return { accepted: true, fullPath: "/" };
        },
        async goForwardHostRoute() {
            const forwardPath = this.$router?.options?.history?.state?.forward;
            if (typeof forwardPath === "string" && forwardPath.startsWith("/")) {
                this.$router.forward();
                return { accepted: true };
            }
            return { accepted: false, reason: "NO_FORWARD_ROUTE" };
        },
        setCurrentHostTabTitle(input) {
            const title = normalizeHostTabTitle(input);
            const currentView = this.getCurrentVisitedView();
            if (!currentView) {
                throw Object.assign(new Error("当前页面不在系统 Tab 中"), { code: "HOST_TAB_NOT_FOUND" });
            }
            this.tagsViewStore.updateVisitedView({
                ...currentView,
                title,
                meta: { ...(currentView.meta || {}), title }
            });
            return { title };
        },
        showHostMessage(input) {
            const result = normalizeHostMessage(input);
            this.$message?.[result.messageType]?.(result.message);
            return result;
        },
        handleHostPageRefresh(event) {
            const detail = event?.detail || {};
            if (detail.fullPath && detail.fullPath !== this.ownedRouteFullPath) return;
            const menuId = this.ownedRouteMeta?.Id || this.ownedRouteMeta?.id || "";
            if (detail.sysMenuId && menuId && detail.sysMenuId !== menuId) return;
            this.retry();
        },
        handleMounted() {
            this.cacheState = "active";
            this.ensureRuntimeCacheRegistration();
            markMicroAppRuntimeActive(this.microAppName);
            this.pushViewportContract();
            this.mountState = "settling";
            this.startContentWatchdog(this.resolveGeneration, this.retryKey);
        },
        handleBeforeShow() {
            this.cacheState = "showing";
            this.mountState = "restoring";
            this.ensureRuntimeCacheRegistration();
            markMicroAppRuntimeActive(this.microAppName);
        },
        handleAfterShow() {
            const generation = this.resolveGeneration;
            this.cacheState = "active";
            markMicroAppRuntimeActive(this.microAppName);
            this.forcePushRuntimeContext("host:resume");
            this.$nextTick(() => {
                if (!this.isHostActive || generation !== this.resolveGeneration) return;
                this.updateViewportContract();
                this.mountState = "verifying";
                this.startContentWatchdog(generation, this.retryKey);
            });
        },
        handleAfterHidden() {
            this.cacheState = "hidden";
            this.mountState = "hidden";
            this.clearMountWatchdog();
            void markMicroAppRuntimeHidden(this.microAppName);
        },
        ensureRuntimeCacheRegistration() {
            if (!this.microAppName) return;
            void registerMicroAppRuntimeCache({
                name: this.microAppName,
                appKey: this.appKey,
                routeFullPath: this.ownedRouteFullPath,
                version: this.appVersion
            });
        },
        handleUnmount() {
            this.clearMountWatchdog();
            forgetMicroAppRuntimeCache(this.microAppName);
            this.cacheState = "destroyed";
            if (!this.error) this.mountState = "unmounted";
        },
        handleMicroAppError(event) {
            const detail = event?.detail ?? event ?? {};
            this.recoverMountFailure(
                detail?.message || detail?.error?.message || "微服务挂载失败",
                "MICRO_APP_MOUNT_FAILED"
            );
        },
        setRuntimeError(message, extra = {}) {
            this.clearMountWatchdog();
            this.error = String(message || "微服务运行异常");
            this.mountState = "error";
            if (extra.httpStatus !== undefined) this.httpStatus = String(extra.httpStatus || "");
            if (extra.reasonCode !== undefined) this.reasonCode = String(extra.reasonCode || "");
        },
        clearMountWatchdog() {
            if (this.mountWatchdog) clearTimeout(this.mountWatchdog);
            this.mountWatchdog = null;
        },
        startMountWatchdog(generation, attempt = this.retryKey) {
            this.clearMountWatchdog();
            const deadline = Date.now() + 12000;
            const inspect = () => {
                if (
                    generation !== this.resolveGeneration
                    || attempt !== this.retryKey
                    || this.mountState !== "mounting"
                    || this.error
                ) return;

                // mounted/ready 事件可能早于宿主监听器注册，或在 KeepAlive
                // 激活期间丢失。真实可见 DOM 才是最终事实；绝不能在页面已
                // 渲染时因生命周期信号缺失而把健康实例当作超时实例销毁。
                if (this.hasRenderableMicroAppContent() === true) {
                    this.markMicroAppReady();
                    return;
                }

                if (Date.now() < deadline) {
                    this.mountWatchdog = setTimeout(inspect, 250);
                    return;
                }
                this.recoverMountFailure("微服务首次挂载超时，宿主已尝试自动恢复。", "MICRO_APP_MOUNT_TIMEOUT");
            };
            this.mountWatchdog = setTimeout(inspect, 250);
        },
        markMicroAppReady() {
            this.clearMountWatchdog();
            this.mountReadyGeneration = this.resolveGeneration;
            this.mountReadyAttempt = this.retryKey;
            this.mountState = "mounted";
            this.cacheState = "active";
            markMicroAppRuntimeActive(this.microAppName);
            this.pushViewportContract();
        },
        hasRenderableMicroAppContent() {
            return hasRenderableMicroAppContent(this.$refs.microApp, window.getComputedStyle?.bind(window));
        },
        startContentWatchdog(generation, attempt) {
            this.clearMountWatchdog();
            const deadline = Date.now() + 4000;
            const inspect = () => {
                if (generation !== this.resolveGeneration || attempt !== this.retryKey || this.error) return;
                const hasContent = this.hasRenderableMicroAppContent();
                if (hasContent === true) {
                    this.markMicroAppReady();
                    return;
                }
                if (Date.now() < deadline) {
                    this.mountWatchdog = setTimeout(inspect, 250);
                    return;
                }
                this.recoverMountFailure("微服务容器已挂载，但子应用未渲染任何内容，宿主已尝试自动恢复。", "MICRO_APP_CONTENT_EMPTY");
            };
            this.mountWatchdog = setTimeout(inspect, 250);
        },
        async destroyStuckMicroApp() {
            try {
                await destroyMicroAppRuntimeCache(this.microAppName, "host-recovery");
            } catch (_) {
                // 挂载失败实例可能尚未完成注册，继续使用 key 强制创建新实例。
            }
        },
        async recoverMountFailure(message, reasonCode) {
            this.clearMountWatchdog();
            if (shouldAutoRecoverMicroApp(this.autoMountRetryCount, this.entryUrl)) {
                this.autoMountRetryCount += 1;
                const generation = this.resolveGeneration;
                this.mountState = "recovering";
                await this.destroyStuckMicroApp();
                if (generation !== this.resolveGeneration) return;
                this.retryKey += 1;
                this.mountReadyGeneration = 0;
                this.mountReadyAttempt = -1;
                this.childReadyRendered = false;
                this.mountState = "mounting";
                await this.$nextTick();
                this.startMountWatchdog(generation, this.retryKey);
                return;
            }
            this.setRuntimeError(message, { reasonCode });
        },
        async resolveManagedRuntime(config) {
            const requirePage = this.ownedRouteMeta?.microAppFriendlyRoute === true;
            let result = null;
            try {
                result = await DiyCommon.PostAsync("/api/MicroApp/Resolve", {
                    OsClient: DiyCommon.GetOsClient(),
                    AppKey: config.appKey,
                    Version: config.version,
                    RoutePath: config.microRoutePath,
                    RequirePage: requirePage
                });
            } catch (resolveError) {
                if (!shouldUseMicroAppResolveFallback(null, { requirePage, requestedVersion: config.version })) {
                    throw resolveError;
                }
            }
            if (Number(result?.Code) !== 1) {
                if (shouldUseMicroAppResolveFallback(result, { requirePage, requestedVersion: config.version })) {
                    this.publishStatus = "CompatibilityFallback";
                    this.assetSource = "managed-stable-entry";
                    return buildMicroAppEntryUrl({
                        apiBase: DiyCommon.GetApiBase(),
                        osClient: DiyCommon.GetOsClient(),
                        appKey: config.appKey
                    });
                }
                const error = new Error(result?.Msg || "无法解析微服务运行入口");
                error.reasonCode = result?.Data?.ReasonCode || "MICRO_APP_RESOLVE_FAILED";
                throw error;
            }
            const runtime = result.Data || {};
            this.appVersion = String(runtime.Version || config.version || "");
            this.pageKey = String(runtime.Page?.PageKey || "");
            this.publishStatus = String(runtime.PublishStatus || "");
            this.assetSource = String(runtime.AssetSource || runtime.StorageMode || "");
            return String(runtime.EntryUrl || "");
        },
        async probeEntry(url) {
            let parsed = null;
            try { parsed = new URL(url, window.location.origin); } catch (_) { return; }
            if (parsed.origin !== window.location.origin && parsed.origin !== new URL(DiyCommon.GetApiBase(), window.location.origin).origin) {
                return;
            }
            this.mountState = "probing";
            const response = await fetch(parsed.toString(), {
                method: "GET",
                headers: { Accept: "text/html,application/xhtml+xml" },
                cache: "no-store"
            });
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
        async retry() {
            this.clearMountWatchdog();
            this.autoMountRetryCount = 0;
            await this.destroyStuckMicroApp();
            this.retryKey += 1;
            this.resolveEntryUrl();
        },
        goBack() {
            if (window.history.length > 1) this.$router.back();
            else this.$router.push("/");
        },
        async copyDiagnostics() {
            const text = JSON.stringify({ ...this.runtimeDiagnostics, message: this.error, pageUrl: window.location.href }, null, 2);
            try {
                await navigator.clipboard.writeText(text);
                this.$message?.success?.("诊断信息已复制");
            } catch (_) {
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                textarea.remove();
                this.$message?.success?.("诊断信息已复制");
            }
        },
        startViewportContract() {
            this.stopViewportContract();
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
            this.resizeObserver = null;
            if (this.visualViewportHandler) {
                window.visualViewport?.removeEventListener("resize", this.visualViewportHandler);
                window.removeEventListener("resize", this.visualViewportHandler);
            }
            this.visualViewportHandler = null;
        },
        updateViewportContract() {
            const host = this.$refs.host;
            if (!host) return;
            const rect = host.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || rect.height;
            this.hostViewport = resolveMicroAppHostViewport(rect, window.visualViewport, viewportHeight);
            host.style.height = `${this.hostViewport.height}px`;
            host.style.minHeight = `${this.hostViewport.height}px`;
            host.style.setProperty("--micro-app-available-width", `${this.hostViewport.width}px`);
            host.style.setProperty("--micro-app-available-height", `${this.hostViewport.height}px`);
            this.pushViewportContract();
        },
        pushViewportContract() {
            const app = this.$refs.microApp;
            if (app && typeof app.setData === "function") {
                app.setData({ ...this.microAppData, type: "host:resize" });
            }
        },
        forcePushRuntimeContext(type = "host:context") {
            const data = { ...this.microAppData, type };
            if (this.microAppName && typeof window.microApp?.forceSetData === "function") {
                window.microApp.forceSetData(this.microAppName, data);
                return;
            }
            const app = this.$refs.microApp;
            if (app && typeof app.setData === "function") app.setData(data);
        },
        extractRouteConfig() {
            const route = {
                path: this.ownedRoutePath,
                fullPath: this.ownedRouteFullPath,
                name: this.ownedRouteName
            };
            const meta = this.ownedRouteMeta || {};
            const query = this.ownedRouteQuery || {};
            const metaParams = parseQueryString(meta.UrlParam);
            const all = {
                ...metaParams,
                ...query
            };

            let microAppUrl = safeDecode(all.src || all.url || meta.MicroAppUrl || meta.Url || "");
            const urlApiEngineId = all.urlApiEngineId || meta.MicroAppUrlApiEngineId || meta.UrlApiEngineId || "";
            let appKey = all.appKey || all.AppKey || all.key || meta.MicroServiceKey || meta.MsKey || meta.AppKey || "";
            let version = all.version || all.Version || "";
            let microRoutePath = safeDecode(all.microRoute || all.routePath || meta.MicroServiceRoutePath || meta.RoutePath || "");
            const routePathConfig = parseMicroAppPath(route.path || "");

            if (!appKey && routePathConfig.appKey) {
                appKey = routePathConfig.appKey;
            }
            if (!microRoutePath && routePathConfig.routePath) {
                microRoutePath = routePathConfig.routePath;
            }

            if (microAppUrl) {
                const microAppUrlConfig = parseMicroAppPath(microAppUrl);
                if (microAppUrlConfig.appKey) {
                    appKey = microAppUrlConfig.appKey;
                }
                if (!version && microAppUrlConfig.version) {
                    version = microAppUrlConfig.version;
                }
                if (!microRoutePath && microAppUrlConfig.routePath) {
                    microRoutePath = microAppUrlConfig.routePath;
                }
                if (microAppUrlConfig.isFriendlyRoute) {
                    microAppUrl = "";
                }
                if (microAppUrlConfig.isEntryUrl) {
                    // Managed micro-app entries always use the stable, versionless
                    // endpoint. BuildVersion is only a cache-busting query value.
                    microAppUrl = "";
                }
                try {
                    const parsedUrl = new URL(microAppUrl, window.location.origin);
                    if (!microRoutePath) {
                        microRoutePath = safeDecode(parsedUrl.searchParams.get("microRoute") || parsedUrl.searchParams.get("routePath") || "");
                    }
                } catch (error) {
                    // Keep the host tolerant of legacy relative values.
                }
            }

            if (!appKey && route.path && route.path.indexOf("/micro-app-host/") === 0) {
                appKey = safeDecode(route.path.replace("/micro-app-host/", "").split("/")[0]);
            }

            return {
                appKey: String(appKey || "").trim(),
                version: String(version || "").trim(),
                microRoutePath: normalizeMicroRoutePath(microRoutePath || "/"),
                microAppUrl: removeMicroRouteQuery(microAppUrl),
                urlApiEngineId: String(urlApiEngineId || "").trim()
            };
        },
        async resolveEntryUrl() {
            const generation = ++this.resolveGeneration;
            this.clearMountWatchdog();
            this.mountReadyGeneration = 0;
            this.mountReadyAttempt = -1;
            this.childReadyRendered = false;
            this.loading = true;
            this.error = "";
            this.entryUrl = "";
            this.runtimeInstanceName = "";
            this.cacheState = "cold";
            this.httpStatus = "";
            this.reasonCode = "";
            this.mountState = "resolving";

            try {
                const config = this.extractRouteConfig();
                this.appKey = config.appKey;
                this.appVersion = config.version;
                this.microRoutePath = config.microRoutePath;

                let url = config.microAppUrl;
                if (config.urlApiEngineId) {
                    const result = await DiyCommon.ApiEngine.Run(config.urlApiEngineId, {
                        MenuId: this.ownedRouteMeta?.Id || "",
                        AppKey: config.appKey,
                        Version: config.version
                    });
                    if (generation !== this.resolveGeneration) return;
                    if (result.Code !== 1) {
                        throw new Error(result.Msg || "接口引擎未返回前端微服务地址");
                    }
                    url = result.Data || "";
                }

                if (!url && config.appKey) {
                    url = await this.resolveManagedRuntime(config);
                    if (generation !== this.resolveGeneration) return;
                    if (!url) {
                        url = buildMicroAppEntryUrl({
                            osClient: DiyCommon.GetOsClient(),
                            appKey: config.appKey,
                            version: config.version
                        });
                    }
                }

                if (!url) {
                    throw new Error("未配置前端微服务 appKey、src 或 UrlApiEngineId");
                }

                if (url.indexOf("$V8.CurrentToken$") > -1) {
                    url = url.replace(/\$V8\.CurrentToken\$/g, DiyCommon.getToken());
                }
                if (url.indexOf("$ApiBase$") > -1 || url.indexOf("$OsClient$") > -1) {
                    url = DiyCommon.RepalceUrlKey(url);
                }
                if (url.startsWith("/")) {
                    url = joinUrl(DiyCommon.GetApiBase(), url);
                }

                await this.probeEntry(url);
                if (generation !== this.resolveGeneration) return;
                this.runtimeInstanceName = createMicroAppRuntimeName({
                    osClient: DiyCommon.GetOsClient(),
                    appKey: this.appKey,
                    menuId: this.ownedRouteMeta?.Id || this.ownedRoutePath,
                    routeFullPath: this.ownedRouteFullPath,
                    version: this.appVersion,
                    entryUrl: url
                });
                void registerMicroAppRuntimeCache({
                    name: this.runtimeInstanceName,
                    appKey: this.appKey,
                    routeFullPath: this.ownedRouteFullPath,
                    version: this.appVersion
                });
                this.entryUrl = url;
                this.cacheState = "starting";
                this.mountState = "mounting";
                this.startMountWatchdog(generation, this.retryKey);
            } catch (error) {
                if (generation !== this.resolveGeneration) return;
                this.setRuntimeError(error?.message || String(error), {
                    httpStatus: error?.httpStatus,
                    reasonCode: error?.reasonCode || "MICRO_APP_LOAD_FAILED"
                });
            } finally {
                if (generation === this.resolveGeneration) this.loading = false;
            }
        }
    }
};
</script>

<style lang="scss" scoped>
.micro-app-host {
    --micro-app-available-width: 100%;
    --micro-app-available-height: 100%;
    --micro-app-safe-area-bottom: env(safe-area-inset-bottom, 0px);
    position: relative;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: 100%;
    height: auto;
    min-width: 0;
    min-height: 1px;
    // The outer host only owns viewport geometry. The micro-app boundary below
    // is the framework fallback scroller; a child with a real constrained
    // scroll container keeps its content inside that boundary, so only the
    // child's scrollbar is active.
    overflow: hidden;
    contain: layout paint;
    isolation: isolate;
    background: var(--mci-bg-base, var(--el-bg-color));
}

.micro-app-host__app {
    display: block;
    flex: 1 1 auto;
    width: var(--micro-app-available-width);
    height: var(--micro-app-available-height);
    min-width: 0;
    min-height: var(--micro-app-available-height);
    padding-bottom: var(--micro-app-safe-area-bottom);
    overflow-x: auto;
    overflow-y: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
    contain: layout paint;
    isolation: isolate;
}
</style>
