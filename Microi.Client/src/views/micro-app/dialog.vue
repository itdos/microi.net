<template>
    <section class="micro-app-dialog">
        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
        <div v-else-if="loading" class="micro-app-dialog__loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>正在加载应用...</span>
        </div>
        <micro-app
            v-else-if="entryUrl"
            class="micro-app-dialog__app"
            :key="microAppKey"
            :name="microAppName"
            :url="entryUrl"
            :data="microAppData"
            :default-page="routePath"
            router-mode="pure"
            @datachange="handleDataChange"
        />
    </section>
</template>

<script>
import { Loading } from "@element-plus/icons-vue";
import { DiyCommon } from "@/utils/diy.common";

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
    components: { Loading },
    props: {
        DataAppend: { type: Object, default: () => ({}) }
    },
    data() {
        return {
            loading: true,
            error: "",
            entryUrl: "",
            appVersion: "",
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
            return `${this.microAppName}@${this.entryUrl}`;
        },
        microAppData() {
            return {
                apiBase: DiyCommon.GetApiBase(),
                osClient: DiyCommon.GetOsClient(),
                token: DiyCommon.getToken(),
                appKey: this.appKey,
                version: this.appVersion,
                microRoute: this.routePath,
                dialog: true,
                dialogData: this.DataAppend?.Data || {},
                route: { microRoute: this.routePath, microRoutePath: this.routePath }
            };
        }
    },
    created() {
        this.resolveEntryUrl();
    },
    methods: {
        async resolveEntryUrl() {
            this.loading = true;
            this.error = "";
            try {
                if (!this.appKey) throw new Error("OpenAppDialog 缺少 AppKey");
                let version = String(this.DataAppend?.Version || "").trim();
                if (!version) {
                    const result = await DiyCommon.FormEngine.GetFormData("sys_microiservice", {
                        _Where: [["MsKey", "=", this.appKey]],
                        _SelectFields: ["Id", "MsKey", "BuildVersion", "IsEnable"]
                    });
                    if (!result || result.Code !== 1 || !result.Data) throw new Error(`未找到已发布微服务：${this.appKey}`);
                    if (Number(result.Data.IsEnable) === 0) throw new Error(`微服务已停用：${this.appKey}`);
                    version = result.Data.BuildVersion || "";
                }
                this.appVersion = version;
                const versionPart = version ? `/${encodeURIComponent(version)}` : "";
                this.entryUrl = `${String(DiyCommon.GetApiBase() || "").replace(/\/+$/, "")}/micro-app/${encodeURIComponent(DiyCommon.GetOsClient())}/${encodeURIComponent(this.appKey)}${versionPart}/index.html`;
            } catch (error) {
                this.error = error?.message || String(error);
                this.invokeCallback("OnError", { message: this.error });
            } finally {
                this.loading = false;
            }
        },
        handleDataChange(event) {
            const payload = event?.detail?.data ?? event?.detail ?? event ?? {};
            const type = String(payload?.type || payload?.Type || "").toLowerCase();
            const data = payload?.data ?? payload?.Data ?? payload;
            if (type === "app-dialog:success" || type === "success") {
                this.invokeCallback("OnSuccess", data);
                this.close();
            } else if (type === "app-dialog:cancel" || type === "cancel") {
                this.invokeCallback("OnCancel", data);
                this.close();
            } else if (type === "app-dialog:error" || type === "error") {
                this.invokeCallback("OnError", data);
            }
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
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-bg-color-page);
}

.micro-app-dialog__loading {
    display: flex;
    min-height: 360px;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--el-text-color-secondary);
}

.micro-app-dialog__app {
    display: block;
    width: 100%;
}
</style>
