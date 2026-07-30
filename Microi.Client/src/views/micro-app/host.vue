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
            @error="handleMicroAppError"
        />
    </div>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { buildMicroAppEntryUrl, shouldUseMicroAppResolveFallback } from "@/utils/microAppEntryUrl.js";
import { resolveMicroAppHostViewport } from "@/utils/microAppViewport.js";
import MicroAppLoadingSkeleton from "./loading-skeleton.vue";
import MicroAppRuntimeError from "./runtime-error.vue";
import { applyMicroAppToken } from "./token-sync";

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

function normalizeMicroAppName(value) {
    let name = String(value || "micro-app")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!name) name = "micro-app";
    if (!/^[a-z]/.test(name)) name = "app-" + name;
    return name.substring(0, 64);
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
    data() {
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
            hostViewport: { width: 0, height: 0, safeAreaBottom: 0 },
            resizeObserver: null,
            visualViewportHandler: null
        };
    },
    computed: {
        microAppName() {
            const routeKey = this.$route?.meta?.Id || this.$route?.path || this.microRoutePath || "";
            return normalizeMicroAppName(`${this.appKey || this.$route?.meta?.title || this.$route?.name}-${routeKey}`);
        },
        microAppKey() {
            return `${this.microAppName}@${this.entryUrl}@${this.retryKey}`;
        },
        baseRoute() {
            return this.$route?.path || "/";
        },
        microAppData() {
            return {
                apiBase: DiyCommon.GetApiBase(),
                osClient: DiyCommon.GetOsClient(),
                token: DiyCommon.getToken(),
                menuId: this.$route?.meta?.Id || "",
                menuName: this.$route?.meta?.title || "",
                appKey: this.appKey,
                version: this.appVersion,
                hostViewport: this.hostViewport,
                microRoute: this.microRoutePath,
                route: {
                    path: this.$route?.path || "",
                    fullPath: this.$route?.fullPath || "",
                    query: this.$route?.query || {},
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
                reasonCode: this.reasonCode
            };
        }
    },
    created() {
        this.resolveEntryUrl();
    },
    mounted() {
        this.startViewportContract();
    },
    beforeUnmount() {
        this.stopViewportContract();
    },
    watch: {
        "$route.fullPath"() {
            this.resolveEntryUrl();
        }
    },
    methods: {
        handleDataChange(event) {
            const payload = event?.detail?.data ?? event?.detail ?? event ?? {};
            if (applyMicroAppToken(payload)) return;
            const type = String(payload?.type || payload?.Type || "").toLowerCase();
            const handled = payload?.handled === true || payload?.Handled === true;
            const errorType = String(payload?.errorType || payload?.ErrorType || "business").toLowerCase();
            if ((type === "error" || type === "app:error") && !handled && ["load", "protocol", "runtime"].includes(errorType)) {
                const data = payload?.data ?? payload?.Data ?? payload;
                this.setRuntimeError(data?.message || data?.Msg || "微服务运行异常", {
                    reasonCode: data?.reasonCode || data?.ReasonCode || "MICRO_APP_RUNTIME_ERROR"
                });
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
            this.setRuntimeError(detail?.message || detail?.error?.message || "微服务挂载失败", {
                reasonCode: "MICRO_APP_MOUNT_FAILED"
            });
        },
        setRuntimeError(message, extra = {}) {
            this.error = String(message || "微服务运行异常");
            this.mountState = "error";
            if (extra.httpStatus !== undefined) this.httpStatus = String(extra.httpStatus || "");
            if (extra.reasonCode !== undefined) this.reasonCode = String(extra.reasonCode || "");
        },
        async resolveManagedRuntime(config) {
            const requirePage = this.$route?.meta?.microAppFriendlyRoute === true;
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
        retry() {
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
        extractRouteConfig() {
            const route = this.$route || {};
            const meta = route.meta || {};
            const query = route.query || {};
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
            this.loading = true;
            this.error = "";
            this.entryUrl = "";
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
                        MenuId: this.$route?.meta?.Id || "",
                        AppKey: config.appKey,
                        Version: config.version
                    });
                    if (result.Code !== 1) {
                        throw new Error(result.Msg || "接口引擎未返回前端微服务地址");
                    }
                    url = result.Data || "";
                }

                if (!url && config.appKey) {
                    url = await this.resolveManagedRuntime(config);
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
                this.entryUrl = url;
                this.mountState = "mounting";
            } catch (error) {
                this.setRuntimeError(error?.message || String(error), {
                    httpStatus: error?.httpStatus,
                    reasonCode: error?.reasonCode || "MICRO_APP_LOAD_FAILED"
                });
            } finally {
                this.loading = false;
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
    overflow: auto;
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
    box-sizing: border-box;
}
</style>
