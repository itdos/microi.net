<template>
    <div
        v-show="ShowClassicTop != 0"
        class="sidebar-logo-microi-container-microi"
        :class="{ collapse: collapse }"
    >
        <router-link class="sidebar-logo-microi-link" @click="GetSysLogoLink()" to="">
            <span
                class="sidebar-logo-microi-shell"
                :class="{
                    'is-fallback': !logoSource || logoLoadFailed || !logoLoadReady
                }"
                :style="logoShellStyle"
            >
                <img
                    v-if="logoSource && !logoLoadFailed"
                    ref="logoImage"
                    class="sidebar-logo-microi"
                    :src="logoSource"
                    alt=""
                    aria-hidden="true"
                    @load="HandleSysLogoLoad"
                    @error="HandleSysLogoError"
                />
                <span
                    v-if="!logoSource || logoLoadFailed || !logoLoadReady"
                    class="sidebar-logo-microi-fallback"
                    aria-hidden="true"
                >
                    {{ logoFallbackText }}
                </span>
            </span>
            <h1
                class="sidebar-title-microi"
                v-if="!collapse && IsDisplayShortTitle()"
                :title="SysConfig.SysShortTitle"
                :style="{
                    color: 'var(--sidebar-text-color, #ffffff)',
                    fontSize: SysConfig.SysTitleFontSize ? SysConfig.SysTitleFontSize + 'px' : '20px'
                }"
            >
                {{
                    !DiyCommon.IsNull(SysConfig.SysShortTitle)
                        ? truncateString(SysConfig.SysShortTitle, SysConfig.BiaotiJQ ? SysConfig.BiaotiJQ : 12)
                        : DiyCommon.IsNull(ShortTitle)
                          ? truncateString(WebTitle, SysConfig.BiaotiJQ ? SysConfig.BiaotiJQ : 12)
                          : truncateString(ShortTitle, SysConfig.BiaotiJQ ? SysConfig.BiaotiJQ : 12)
                }}
            </h1>
        </router-link>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore, useSettingsStore } from "@/pinia";
import {
    resolveSidebarSystemLogoUrl,
    resolveTenantBrandFallbackText
} from "@/utils/login-branding.js";

// 官方内置图只能作为 iTdos 自身的缺省值。子租户没有 Logo 或图片加载
// 失败时必须显示自己的标题首字，不能泄露为吾码官方品牌。
const LOCAL_LOGO_FALLBACK = typeof window === "undefined"
    ? "/static/img/logo/itdos.svg"
    : new URL("/static/img/logo/itdos.svg", window.location.origin).href;
export default {
    name: "SidebarLogo",
    props: {
        collapse: {
            type: Boolean,
            required: true
        }
    },
    setup() {
        const diyStore = useDiyStore();
        const settingsStore = useSettingsStore();

        const title = computed(() => settingsStore.title);
        const WebTitle = computed(() => diyStore.WebTitle);
        const ShortTitle = computed(() => diyStore.ShortTitle);
        const OsClient = computed(() => diyStore.OsClient);
        const ThemeClass = computed(() => diyStore.ThemeClass);
        const SysConfig = computed(() => diyStore.SysConfig);
        const ShowClassicTop = computed(() => diyStore.ShowClassicTop);

        return {
            diyStore,
            settingsStore,
            title,
            WebTitle,
            ShortTitle,
            OsClient,
            ThemeClass,
            SysConfig,
            ShowClassicTop
        };
    },
    computed: {
        configuredLogoSource() {
            return resolveSidebarSystemLogoUrl(
                this.SysConfig && this.SysConfig.SysLogo,
                this.OsClient,
                (path, returnNoImg) => this.DiyCommon.GetServerPath(path, returnNoImg),
                LOCAL_LOGO_FALLBACK
            );
        },
        logoFallbackText() {
            return resolveTenantBrandFallbackText(
                this.SysConfig && this.SysConfig.SysShortTitle,
                this.ShortTitle,
                this.WebTitle,
                this.OsClient
            );
        },
        logoShellStyle() {
            const logoSize = this.GetSysLogoHeight();
            return {
                width: logoSize,
                height: logoSize,
                backgroundImage: this.logoLoadReady && this.logoSource
                    ? `url(${JSON.stringify(this.logoSource)})`
                    : "none"
            };
        }
    },
    data() {
        return {
            logoSource: "",
            logoLoadFailed: false,
            logoLoadReady: false,
            logoRetryAttempt: 0,
            logoHealthTimers: []
        };
    },
    watch: {
        configuredLogoSource: {
            immediate: true,
            handler(value) {
                this.logoSource = value || "";
                this.logoLoadFailed = false;
                this.logoLoadReady = false;
                this.logoRetryAttempt = 0;
                this.QueueSysLogoHealthCheck();
            }
        },
        "$route.fullPath"() {
            this.logoRetryAttempt = 0;
            this.QueueSysLogoHealthCheck();
        }
    },
    mounted() {
        this.QueueSysLogoHealthCheck();
    },
    beforeUnmount() {
        this.ClearSysLogoHealthTimers();
    },
    methods: {
        // ... 其他方法
        truncateString(str, maxLength) {
            if (str.length > maxLength) {
                return str.substring(0, maxLength - 3) + "...";
            }
            return str;
        },
        GetSysLogo() {
            return this.logoSource;
        },
        HandleSysLogoLoad(event) {
            this.logoLoadReady = Boolean(event && event.target && event.target.naturalWidth > 0);
            this.logoLoadFailed = !this.logoLoadReady;
        },
        HandleSysLogoError() {
            this.logoLoadReady = false;
            this.RetrySysLogoLoad();
        },
        ClearSysLogoHealthTimers() {
            (this.logoHealthTimers || []).forEach((timer) => window.clearTimeout(timer));
            this.logoHealthTimers = [];
        },
        QueueSysLogoHealthCheck() {
            if (typeof window === "undefined") return;
            this.ClearSysLogoHealthTimers();
            [400, 1400, 3200].forEach((delay) => {
                this.logoHealthTimers.push(window.setTimeout(() => {
                    this.EnsureSysLogoHealthy();
                }, delay));
            });
        },
        EnsureSysLogoHealthy() {
            if (!this.logoSource) return;
            const image = this.$refs.logoImage;
            if (image && image.naturalWidth > 0) {
                this.logoLoadReady = true;
                this.logoLoadFailed = false;
                return;
            }
            if (image && !image.complete) return;
            this.RetrySysLogoLoad();
        },
        RetrySysLogoLoad() {
            const configuredSource = this.configuredLogoSource;
            if (!configuredSource || this.logoRetryAttempt >= 2) {
                this.logoLoadReady = false;
                this.logoLoadFailed = true;
                return;
            }

            this.logoRetryAttempt += 1;
            this.logoLoadReady = false;
            this.logoLoadFailed = false;
            this.logoSource = "";
            this.$nextTick(() => {
                this.logoSource = configuredSource;
            });
        },
        GetSysLogoHeight() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysConfig.SysLogoHeight)) {
                return self.SysConfig.SysLogoHeight > 45 ? 45 : self.SysConfig.SysLogoHeight + "px";
            }
            return "40px";
        },
        IsDisplayShortTitle() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysConfig.SysLogoType)) {
                if (self.SysConfig.SysLogoType == "图形") {
                    return false;
                }
            }
            return true;
        },
        GetSysLogoLink() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysConfig.SysLogoLink)) {
                if (self.SysConfig.SysLogoLink.indexOf("http") > -1) {
                    window.open(self.SysConfig.SysLogoLink, "_blank", "noopener,noreferrer");
                    return;
                }
                self.$router.push(self.SysConfig.SysLogoLink);
                return;
            }
            self.$router.push("/");
        }
    }
};
</script>

<style lang="scss" scoped>
.sidebarLogoFade-enter-active {
    transition: opacity 1.5s;
}

.sidebarLogoFade-enter,
.sidebarLogoFade-leave-to {
    opacity: 0;
}

.sidebar-logo-microi-container-microi {
    position: relative;
    width: 100%;
    height: 63px;
    line-height: 63px;
    // background: #fff;
    text-align: center;
    overflow: hidden;

    & .sidebar-logo-microi-link {
        height: 100%;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: left; //2025-05-08 LOGO+系统标题靠左显示 --by Anderson
        padding: 0 20px;

        & .sidebar-logo-microi-shell {
            width: 32px;
            height: 32px;
            flex: 0 0 auto;
            position: relative;
            display: grid;
            place-items: center;
            overflow: hidden;
            background-position: center;
            background-repeat: no-repeat;
            background-size: contain;
            border-radius: 7px;

            &.is-fallback {
                background: rgba(255, 255, 255, 0.18);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.24);
            }
        }

        & .sidebar-logo-microi {
            display: block;
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            opacity: 0;
            pointer-events: none;
            vertical-align: middle;
        }

        & .sidebar-logo-microi-fallback {
            position: relative;
            z-index: 1;
            color: var(--sidebar-text-color, #ffffff);
            font-size: 18px;
            font-weight: 700;
            line-height: 1;
            text-transform: uppercase;
        }

        & .sidebar-title-microi {
            display: inline-block;
            margin: 0;
            // color: #000;
            font-weight: 600;
            line-height: 25px;
            font-family:
                Avenir,
                Helvetica Neue,
                Arial,
                Helvetica,
                sans-serif;
            vertical-align: middle;
        }
    }

    &.collapse {
        .sidebar-logo-microi-link{
            padding: 0;
            justify-content: center;
        }
        .sidebar-logo-microi-shell {
            margin-right: 0px;
            margin-left: 0;
        }
    }
}
</style>
