<template>
    <section class="micro-app-dev-component" :style="{ minHeight: `${frameHeight}px` }">
        <div v-if="loading" class="micro-app-dev-component__loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>正在加载定制组件...</span>
        </div>
        <el-alert
            v-else-if="error"
            :title="error"
            type="warning"
            :closable="false"
            show-icon
        />
        <micro-app
            v-else-if="entryUrl"
            class="micro-app-dev-component__app"
            :style="{ height: `${frameHeight}px` }"
            :key="microAppKey"
            :name="microAppName"
            :url="entryUrl"
            :data="microAppData"
            :default-page="routePath"
            router-mode="pure"
            iframe
            @datachange="handleDataChange"
        />
    </section>
</template>

<script>
import { Loading } from "@element-plus/icons-vue";
import { DiyCommon } from "@/utils/diy.common";
import {
    findLegacyMicroAppPage,
    serializeMicroAppComponentData
} from "@/utils/microAppDevComponentResolver.js";

let pageRowsPromise = null;

async function loadMicroAppPages() {
    if (!pageRowsPromise) {
        pageRowsPromise = DiyCommon.FormEngine.GetTableData("sys_microiservice_page", {
            _Where: [["IsEnable", "=", 1]],
            _SelectFields: [
                "Id",
                "MicroServiceId",
                "MicroServiceKey",
                "PageKey",
                "PageTitle",
                "RoutePath",
                "EntryPath",
                "IsEnable",
                "BuildVersion",
                "RouteMetaJson"
            ],
            _PageIndex: 1,
            _PageSize: 5000
        }).catch((error) => {
            pageRowsPromise = null;
            throw error;
        });
    }
    return pageRowsPromise;
}

function normalizeName(value) {
    let result = String(value || "dev-component").toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!result || !/^[a-z]/.test(result)) result = "app-" + (result || "dev-component");
    return result.substring(0, 64);
}

function normalizeRoute(value) {
    const route = String(value || "/").trim();
    return route.startsWith("/") ? route : "/" + route;
}

export default {
    name: "MicroAppDevComponent",
    components: { Loading },
    inheritAttrs: false,
    props: {
        legacyComponentPath: {
            type: String,
            required: true
        }
    },
    data() {
        return {
            loading: true,
            error: "",
            page: null,
            entryUrl: "",
            frameHeight: 120,
            instanceId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        };
    },
    computed: {
        routePath() {
            return normalizeRoute(this.page?.RoutePath || "/");
        },
        microAppName() {
            return normalizeName(`${this.page?.MicroServiceKey || "custom"}-${this.page?.PageKey || this.routePath}-${this.instanceId}`);
        },
        microAppKey() {
            return `${this.microAppName}@${this.entryUrl}`;
        },
        componentData() {
            return serializeMicroAppComponentData(this.$attrs);
        },
        microAppData() {
            return {
                apiBase: DiyCommon.GetApiBase(),
                osClient: DiyCommon.GetOsClient(),
                token: DiyCommon.getToken(),
                currentUser: DiyCommon.GetCurrentUser?.() || {},
                appKey: this.page?.MicroServiceKey || "",
                version: this.page?.BuildVersion || "",
                microRoute: this.routePath,
                componentMode: true,
                componentData: this.componentData,
                route: {
                    microRoute: this.routePath,
                    microRoutePath: this.routePath,
                    query: {}
                }
            };
        }
    },
    created() {
        this.resolvePage();
    },
    methods: {
        async resolvePage() {
            this.loading = true;
            this.error = "";
            try {
                const result = await loadMicroAppPages();
                const page = findLegacyMicroAppPage(result, this.legacyComponentPath);
                if (!page || !page.MicroServiceKey) {
                    throw new Error(`组件未找到: ${this.legacyComponentPath}`);
                }
                this.page = page;
                let version = String(page.BuildVersion || "").trim();
                if (!version) {
                    const serviceResult = await DiyCommon.FormEngine.GetTableData("sys_microiservice", {
                        _Where: [["MsKey", "=", page.MicroServiceKey]],
                        _SelectFields: ["Id", "MsKey", "BuildVersion", "IsEnable"],
                        _PageIndex: 1,
                        _PageSize: 1
                    });
                    const rows = Array.isArray(serviceResult?.Data) ? serviceResult.Data : [];
                    const service = rows[0];
                    if (!service || Number(service.IsEnable) === 0) {
                        throw new Error(`微服务未发布或已停用: ${page.MicroServiceKey}`);
                    }
                    version = service.BuildVersion || "";
                    this.page.BuildVersion = version;
                }
                const versionPart = version ? `/${encodeURIComponent(version)}` : "";
                this.entryUrl = `${String(DiyCommon.GetApiBase() || "").replace(/\/+$/, "")}/micro-app/${encodeURIComponent(DiyCommon.GetOsClient())}/${encodeURIComponent(page.MicroServiceKey)}${versionPart}/${page.EntryPath || "index.html"}`;
            } catch (error) {
                this.error = error?.message || String(error);
            } finally {
                this.loading = false;
            }
        },
        handleDataChange(event) {
            const payload = event?.detail?.data ?? event?.detail ?? event ?? {};
            const type = String(payload?.type || payload?.Type || "");
            if (type === "dev-component:resize") {
                const height = Number(payload.height || payload.Height || 0);
                if (height > 0) this.frameHeight = Math.max(80, Math.min(height, 1600));
                return;
            }
            if (type !== "dev-component:event") return;
            const eventName = payload.event || payload.Event;
            const args = Array.isArray(payload.args) ? payload.args : [payload.data ?? payload.Data];
            if (eventName) this.$emit(eventName, ...args);
        }
    }
};
</script>

<style lang="scss" scoped>
.micro-app-dev-component {
    width: 100%;
    overflow: hidden;
}

.micro-app-dev-component__loading {
    display: flex;
    min-height: 80px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--el-text-color-secondary);
}

.micro-app-dev-component__app {
    display: block;
    width: 100%;
    border: 0;
}
</style>
