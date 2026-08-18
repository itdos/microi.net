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
                        {{ title }}
                    </div>
                    <div class="diy-custom-dialog__actions">
                        <el-button :icon="Close" @click="ShowDialog = false">{{ $t("Msg.Close") }}</el-button>
                    </div>
                </div>
            </template>
            <div class="clear diy-custom-dialog__body" :class="{ 'diy-custom-dialog__body--micro-app': isMicroAppDialog }" :style="dialogBodyStyle">
                <Suspense v-if="!DiyCommon.IsNull(ComponentName)">
                    <component :is="ComponentName" :DataAppend="DataAppend" @FormSet="FormSet" :pageLifetimes="pageLifetimes" />
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
                        {{ title }}
                    </div>
                    <div class="diy-custom-dialog__actions">
                        <el-button :icon="Close" @click="ShowDialog = false">{{ $t("Msg.Close") }}</el-button>
                    </div>
                </div>
            </template>

            <div class="clear diy-custom-dialog__body" :class="{ 'diy-custom-dialog__body--micro-app': isMicroAppDialog }" :style="dialogBodyStyle">
                <!-- && !DiyCommon.IsNull(ComponentPath) -->
                <!-- :DataAppend="GetDataAppend(field)" -->
                <Suspense v-if="!DiyCommon.IsNull(ComponentName)">
                    <component :is="ComponentName" :DataAppend="DataAppend" @FormSet="FormSet" :pageLifetimes="pageLifetimes" />
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
import MicroAppLoadingSkeleton from "@/views/micro-app/loading-skeleton.vue";
export default {
    name: "DiyCustomDialog",
    directives: {},
    components: { MicroAppLoadingSkeleton },
    setup() {
        const diyStore = useDiyStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const OsClient = computed(() => diyStore.OsClient);
        return { diyStore, GetCurrentUser, OsClient };
    },
    computed: {
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
            const value = this.diyStore && this.diyStore.SysConfig
                ? this.diyStore.SysConfig.DisableFormMaskBlur
                : undefined;
            const blurDisabled = value === 1
                || value === "1"
                || value === true
                || String(value || "").trim().toLowerCase() === "true";
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
        Show() {
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
    min-width: 0;
    color: var(--el-text-color-primary);
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.diy-custom-dialog__actions {
    flex: 0 0 auto;
    margin-left: auto;
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
