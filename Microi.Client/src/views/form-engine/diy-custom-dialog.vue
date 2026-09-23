<template>
    <div>
        <!--以弹窗形式打开Form-->
        <el-dialog
            v-if="OpenType != 'Drawer'"
            class="diy-form-container mci-unified-dialog"
            draggable
            align-center
            :width="width"
            :modal="true"
            :modal-class="GetUnifiedOverlayClass()"
            :modal-append-to-body="false"
            v-model="ShowDialog"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :destroy-on-close="true"
            :show-close="false"
            append-to-body
            @open="HandleUnifiedOverlayOpen"
            @close="HandleUnifiedOverlayClose"
        >
            <template #header>
                <div class="diy-custom-dialog__header">
                    <div class="diy-custom-dialog__title">
                        <i :class="TitleIcon" />
                        <span class="diy-custom-dialog__title-text">{{ dialogHeader.title || title }}</span>
                        <span v-for="(tag, index) in dialogHeader.tags" :key="'tag-' + index" class="diy-custom-dialog__tag" :data-tone="tag.tone">{{ tag.text }}</span>
                        <MciRenderSourceBadge
                            v-if="renderSourceType"
                            :type="renderSourceType"
                            placement="inline"
                            :instance-key="ComponentName + ':' + ShowDialog"
                            :source-info="renderSourceInfo"
                        />
                    </div>
                    <div class="diy-custom-dialog__actions">
                        <el-button v-for="action in dialogHeader.actions" :key="action.id" :type="action.tone === 'default' ? '' : action.tone" :disabled="action.disabled" @click="RunMicroAppHeaderAction(action)">{{ action.text }}</el-button>
                        <el-button :icon="Close" @click="ShowDialog = false">{{ $t("Msg.Close") }}</el-button>
                    </div>
                </div>
            </template>
            <div class="clear diy-custom-dialog__body" :class="{ 'diy-custom-dialog__body--micro-app': isMicroAppDialog }" :style="dialogBodyStyle">
                <Suspense v-if="!DiyCommon.IsNull(ComponentName)">
                    <component ref="refDialogContent" :is="ComponentName" :DataAppend="DataAppend" @FormSet="FormSet" @header-change="SetMicroAppHeader" :pageLifetimes="pageLifetimes" />
                    <template #fallback>
                        <MicroAppLoadingSkeleton v-if="isMicroAppDialog" />
                    </template>
                </Suspense>
            </div>
        </el-dialog>
        <!--以抽屉形式打开Form-->
        <el-drawer
            v-if="OpenType == 'Drawer'"
            class="diy-form-container"
            :modal="true"
            :size="width"
            :modal-append-to-body="false"
            v-model="ShowDialog"
            :close-on-press-escape="false"
            :destroy-on-close="true"
            :wrapper-closable="false"
            :show-close="false"
            append-to-body
        >
            <template #header>
                <div class="diy-custom-dialog__header">
                    <div class="diy-custom-dialog__title">
                        <i :class="TitleIcon" />
                        <span class="diy-custom-dialog__title-text">{{ dialogHeader.title || title }}</span>
                        <span v-for="(tag, index) in dialogHeader.tags" :key="'drawer-tag-' + index" class="diy-custom-dialog__tag" :data-tone="tag.tone">{{ tag.text }}</span>
                        <MciRenderSourceBadge
                            v-if="renderSourceType"
                            :type="renderSourceType"
                            placement="inline"
                            :instance-key="ComponentName + ':' + ShowDialog"
                            :source-info="renderSourceInfo"
                        />
                    </div>
                    <div class="diy-custom-dialog__actions">
                        <el-button v-for="action in dialogHeader.actions" :key="action.id" :type="action.tone === 'default' ? '' : action.tone" :disabled="action.disabled" @click="RunMicroAppHeaderAction(action)">{{ action.text }}</el-button>
                        <el-button :icon="Close" @click="ShowDialog = false">{{ $t("Msg.Close") }}</el-button>
                    </div>
                </div>
            </template>

            <div class="clear diy-custom-dialog__body" :class="{ 'diy-custom-dialog__body--micro-app': isMicroAppDialog }" :style="dialogBodyStyle">
                <!-- && !DiyCommon.IsNull(ComponentPath) -->
                <!-- :DataAppend="GetDataAppend(field)" -->
                <Suspense v-if="!DiyCommon.IsNull(ComponentName)">
                    <component ref="refDialogContent" :is="ComponentName" :DataAppend="DataAppend" @FormSet="FormSet" @header-change="SetMicroAppHeader" :pageLifetimes="pageLifetimes" />
                    <template #fallback>
                        <MicroAppLoadingSkeleton v-if="isMicroAppDialog" />
                    </template>
                </Suspense>
            </div>
        </el-drawer>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore } from "@/pinia";
import { isFormMaskBlurDisabled } from "@/utils/form-mask-blur.js";
import MicroAppLoadingSkeleton from "@/views/micro-app/loading-skeleton.vue";
import MciRenderSourceBadge from "@/components/MciRenderSourceBadge/index.vue";
import { normalizeDialogHeader } from "@/views/micro-app/dialog-header-contract.js";
export default {
    name: "DiyCustomDialog",
    directives: {},
    components: { MicroAppLoadingSkeleton, MciRenderSourceBadge },
    setup() {
        const diyStore = useDiyStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const OsClient = computed(() => diyStore.OsClient);
        return { diyStore, GetCurrentUser, OsClient };
    },
    computed: {
        renderSourceType() {
            if (!this.ComponentName) return "";
            return this.isMicroAppDialog ? "microservice" : "custom";
        },
        renderSourceInfo() {
            const data = this.DataAppend || {};
            return {
                title: this.title,
                appName: data.AppName || data.Name || this.title,
                appKey: data.AppKey || data.MicroServiceKey || "",
                pageKey: data.PageKey || "",
                routePath: data.RoutePath || data.MicroRoute || "",
                frameworkRoute: this.$route?.fullPath || "",
                sourceFile: data.SourceFile || "",
                sourcePath: data.SourcePath || "",
                privateSourcePath: data.PrivateSourcePath || "",
                version: data.Version || data.BuildVersion || "",
                componentName: this.ComponentName,
                componentPath: this.ComponentPath,
                osClient: this.OsClient || "",
                apiBase: this.DiyCommon?.GetApiBase?.() || ""
            };
        },
        isMicroAppDialog() {
            return String(this.ComponentName || "").toLowerCase() === "microappdialog";
        },
        dialogBodyStyle() {
            if (!this.BodyHeight) return {};
            return {
                height: this.BodyHeight,
                minHeight: this.BodyHeight
            };
        }
    },
    props: {
        DataAppend: {
            type: Object,
            default: () => {}
        },
        OpenType: {
            type: String,
            default: ""
        },
        title: {
            type: String,
            default: ""
        },
        TitleIcon: {
            type: String,
            default: ""
        },
        width: {
            type: String,
            default: "80%"
        },
        BodyHeight: {
            type: String,
            default: ""
        },
        ComponentName: {
            type: String,
            default: ""
        },
        ComponentPath: {
            type: String,
            default: ""
        },
        visible: {
            type: Boolean,
            default: false
        }
    },
    watch: {},
    data() {
        return {
            ShowDialog: false,
            dialogHeader: normalizeDialogHeader(null),
            //生命周期
            pageLifetimes: {
                show: function (e) {}
            }
        };
    },
    mounted() {
        var self = this;
    },
    methods: {
        GetUnifiedOverlayClass() {
            const blurDisabled = isFormMaskBlurDisabled(this.diyStore?.SysConfig);
            return [
                "diy-form-modern-overlay",
                "mci-unified-overlay",
                blurDisabled ? "diy-form-modern-overlay--plain mci-unified-overlay--plain" : ""
            ].filter(Boolean).join(" ");
        },
        HandleUnifiedOverlayOpen() {
            this.$nextTick(() => {
                if (typeof document === "undefined") return;
                const overlays = document.querySelectorAll(".mci-unified-overlay");
                const overlay = overlays[overlays.length - 1];
                if (overlay) overlay.classList.remove("is-closing");
            });
        },
        HandleUnifiedOverlayClose() {
            if (typeof document === "undefined") return;
            const overlays = document.querySelectorAll(".mci-unified-overlay");
            const overlay = overlays[overlays.length - 1];
            if (overlay) overlay.classList.add("is-closing");
        },
        FormSet() {
            var self = this;
        },
        SetMicroAppHeader(value) {
            if (this.isMicroAppDialog) this.dialogHeader = normalizeDialogHeader(value);
        },
        RunMicroAppHeaderAction(action) {
            if (!this.isMicroAppDialog || action.disabled) return;
            const handler = this.DataAppend?.OnHeaderAction;
            if (typeof handler === "function") {
                try { handler(action.id, this.DataAppend?.V8); } catch (error) { console.error("[MicroAppDialog] header action failed", error); }
                return;
            }
            const child = this.$refs.refDialogContent;
            if (typeof child?.dispatchHeaderAction !== "function") {
                console.error("[MicroAppDialog] dialog header action receiver is unavailable", action.id);
                return;
            }
            child.dispatchHeaderAction(action.id);
        },
        Show() {
            this.dialogHeader = normalizeDialogHeader(this.isMicroAppDialog ? this.DataAppend?.Header : null);
            this.ShowDialog = true;
        },
        CloseDialog() {
            this.ShowDialog = false;
        }
    }
};
</script>

<style lang="scss" scoped>
.diy-custom-dialog__header {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.diy-custom-dialog__title {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
    color: var(--el-text-color-primary);
    font-size: 15px;
}

.diy-custom-dialog__title-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.diy-custom-dialog__tag {
    border-radius: 999px;
    padding: 2px 8px;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);
    font-size: 12px;
    white-space: nowrap;
}
.diy-custom-dialog__tag[data-tone="success"] { color: var(--el-color-success); background: var(--el-color-success-light-9); }
.diy-custom-dialog__tag[data-tone="warning"] { color: var(--el-color-warning); background: var(--el-color-warning-light-9); }
.diy-custom-dialog__tag[data-tone="danger"] { color: var(--el-color-danger); background: var(--el-color-danger-light-9); }

.diy-custom-dialog__actions {
    flex: 0 0 auto;
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
}

.diy-custom-dialog__actions :deep(.el-button + .el-button) { margin-left: 0; }

@media (max-width: 640px) {
    .diy-custom-dialog__header { flex-wrap: wrap; gap: 8px; }
    .diy-custom-dialog__title { flex-basis: 100%; }
    .diy-custom-dialog__actions { width: 100%; justify-content: flex-end; flex-wrap: wrap; }
    .diy-custom-dialog__actions :deep(.el-button) { min-height: 40px; }
}

.diy-custom-dialog__body--micro-app {
    overflow: hidden;
}

.diy-custom-dialog__body--micro-app :deep(.micro-app-skeleton) {
    height: 100%;
    min-height: 100%;
    box-sizing: border-box;
}
</style>
