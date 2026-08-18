<template>
    <div
        v-show="ShowClassicTop != 0"
        class="sidebar-logo-microi-container-microi"
        :class="{ collapse: collapse }"
    >
        <router-link class="sidebar-logo-microi-link" @click="GetSysLogoLink()" to="">
            <span
                class="sidebar-logo-microi-shell"
                :style="{ width: GetSysLogoHeight(), height: GetSysLogoHeight() }"
            >
                <img
                    ref="logoImage"
                    class="sidebar-logo-microi"
                    :src="logoSource"
                    alt="系统 Logo"
                    @load="HandleSysLogoLoad"
                    @error="HandleSysLogoError"
                />
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
import { resolveLoginSystemLogoUrl } from "@/utils/login-branding.js";

// Hash 路由切换后，相对路径会被错误解析到业务路由。始终从当前站点根目录
// 解析本地兜底 Logo，保证微服务页面切换也不会让 Logo 消失。
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
            return resolveLoginSystemLogoUrl(this.SysConfig && this.SysConfig.SysLogo, (path, returnNoImg) =>
                this.DiyCommon.GetServerPath(path, returnNoImg)
            ) || LOCAL_LOGO_FALLBACK;
        }
    },
    data() {
        return {
            logoSource: LOCAL_LOGO_FALLBACK
        };
    },
    watch: {
        configuredLogoSource: {
            immediate: true,
            handler(value) {
                this.logoSource = value || LOCAL_LOGO_FALLBACK;
                if (this.$refs.logoImage) this.$refs.logoImage.style.visibility = "visible";
            }
        }
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
            return this.configuredLogoSource;
        },
        HandleSysLogoLoad(event) {
            if (event && event.target) event.target.style.visibility = "visible";
        },
        HandleSysLogoError(event) {
            if (this.logoSource !== LOCAL_LOGO_FALLBACK) {
                this.logoSource = LOCAL_LOGO_FALLBACK;
                return;
            }
            // 本地兜底资源若也不可用，只隐藏损坏图标；标题仍正常显示。
            if (event && event.target) event.target.style.visibility = "hidden";
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
            overflow: hidden;
            background: url("/static/img/logo/itdos.svg") center / contain no-repeat;
            border-radius: 7px;
        }

        & .sidebar-logo-microi {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
            vertical-align: middle;
            //margin-left: 40px;
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
