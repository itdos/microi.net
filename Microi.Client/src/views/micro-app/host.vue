<template>
    <div class="micro-app-host">
        <el-alert
            v-if="error"
            class="micro-app-host__alert"
            :title="error"
            type="error"
            show-icon
            :closable="false"
        />
        <div v-else-if="loading" class="micro-app-host__loading">
            <el-icon class="is-loading"><Loading /></el-icon>
        </div>
        <micro-app
            v-else-if="entryUrl"
            class="micro-app-host__app"
            :key="microAppKey"
            :name="microAppName"
            :url="entryUrl"
            :data="microAppData"
            :baseroute="baseRoute"
            keep-alive
        />
    </div>
</template>

<script>
import { Loading } from "@element-plus/icons-vue";
import { DiyCommon } from "@/utils/diy.common";

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

function normalizeMicroAppName(value) {
    let name = String(value || "micro-app")
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!name) name = "micro-app";
    if (!/^[a-z]/.test(name)) name = "app-" + name;
    return name.substring(0, 64);
}

function joinUrl(baseUrl, path) {
    return String(baseUrl || "").replace(/\/+$/, "") + "/" + String(path || "").replace(/^\/+/, "");
}

export default {
    name: "MicroAppHost",
    components: { Loading },
    data() {
        return {
            loading: true,
            error: "",
            entryUrl: "",
            appKey: "",
            appVersion: ""
        };
    },
    computed: {
        microAppName() {
            return normalizeMicroAppName(this.appKey || this.$route?.meta?.title || this.$route?.name);
        },
        microAppKey() {
            return `${this.microAppName}@${this.entryUrl}`;
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
                route: {
                    path: this.$route?.path || "",
                    fullPath: this.$route?.fullPath || "",
                    query: this.$route?.query || {}
                }
            };
        }
    },
    created() {
        this.resolveEntryUrl();
    },
    watch: {
        "$route.fullPath"() {
            this.resolveEntryUrl();
        }
    },
    methods: {
        extractRouteConfig() {
            const route = this.$route || {};
            const meta = route.meta || {};
            const query = route.query || {};
            const metaParams = parseQueryString(meta.UrlParam);
            const all = {
                ...metaParams,
                ...query
            };

            const microAppUrl = safeDecode(all.src || all.url || meta.MicroAppUrl || meta.Url || "");
            const urlApiEngineId = all.urlApiEngineId || meta.MicroAppUrlApiEngineId || meta.UrlApiEngineId || "";
            let appKey = all.appKey || all.AppKey || all.key || "";
            let version = all.version || all.Version || "";

            if (!appKey && route.path && route.path.indexOf("/micro-app-host/") === 0) {
                appKey = safeDecode(route.path.replace("/micro-app-host/", "").split("/")[0]);
            }

            if (!appKey && microAppUrl) {
                const match = microAppUrl.match(/\/micro-app\/([^/]+)\/([^/?#]+)(?:\/([^/?#]+))?/i);
                if (match) {
                    appKey = safeDecode(match[2]);
                    if (!version && match[3] && match[3] !== "index.html") {
                        version = safeDecode(match[3]);
                    }
                }
            }

            return {
                appKey: String(appKey || "").trim(),
                version: String(version || "").trim(),
                microAppUrl,
                urlApiEngineId: String(urlApiEngineId || "").trim()
            };
        },
        async resolveEntryUrl() {
            this.loading = true;
            this.error = "";
            this.entryUrl = "";

            try {
                const config = this.extractRouteConfig();
                this.appKey = config.appKey;
                this.appVersion = config.version;

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
                    const versionPart = config.version ? `/${encodeURIComponent(config.version)}` : "";
                    url = `/micro-app/${encodeURIComponent(DiyCommon.GetOsClient())}/${encodeURIComponent(config.appKey)}${versionPart}/index.html`;
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

                this.entryUrl = url;
            } catch (error) {
                this.error = error?.message || String(error);
            } finally {
                this.loading = false;
            }
        }
    }
};
</script>

<style lang="scss" scoped>
.micro-app-host {
    min-height: calc(100vh - 100px);
    background: var(--el-bg-color);
}

.micro-app-host__alert {
    margin: 12px;
    width: auto;
}

.micro-app-host__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 100px);
    color: var(--el-color-primary);
    font-size: 24px;
}

.micro-app-host__app {
    display: block;
    min-height: calc(100vh - 100px);
}
</style>
