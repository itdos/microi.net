<template>
    <section class="micro-app-dialog">
        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
        <micro-app-loading-skeleton v-else-if="loading" />
        <micro-app
            v-else-if="entryUrl"
            class="micro-app-dialog__app"
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
import { DiyCommon } from "@/utils/diy.common";
import { buildMicroAppEntryUrl } from "@/utils/microAppEntryUrl.js";
import MicroAppLoadingSkeleton from "./loading-skeleton.vue";
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
    components: { MicroAppLoadingSkeleton },
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
                    // GetFormData 在部分老库会被历史字段元数据影响；列表查询只取首条，
                    // 并兼容旧前端/网关的不同 DosResult 包装结构。
                    const result = await DiyCommon.FormEngine.GetTableData("sys_microiservice", {
                        _Where: [["MsKey", "=", this.appKey]],
                        _PageIndex: 1,
                        _PageSize: 1
                    });
                    const rows = Array.isArray(result)
                        ? result
                        : (Array.isArray(result?.Data)
                            ? result.Data
                            : (Array.isArray(result?.Data?.Data) ? result.Data.Data : []));
                    const resultCode = result?.Code ?? result?.code;
                    const service = rows[0];
                    if ((resultCode !== undefined && resultCode !== null && Number(resultCode) !== 1) || !service) {
                        throw new Error(`未找到已发布微服务：${this.appKey}`);
                    }
                    if (Number(service.IsEnable) === 0) throw new Error(`微服务已停用：${this.appKey}`);
                    version = service.BuildVersion || "";
                }
                this.appVersion = version;
                this.entryUrl = buildMicroAppEntryUrl({
                    apiBase: DiyCommon.GetApiBase(),
                    osClient: DiyCommon.GetOsClient(),
                    appKey: this.appKey,
                    version
                });
            } catch (error) {
                this.error = error?.message || String(error);
                this.invokeCallback("OnError", { message: this.error });
            } finally {
                this.loading = false;
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
    height: 100%;
    min-height: 100%;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-bg-color-page);
}

.micro-app-dialog__app {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 100%;
}
</style>
