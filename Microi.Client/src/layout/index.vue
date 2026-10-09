<template>
    <!-- WebOS 模式：如果 webos 模块存在且当前为 macOS/Windows 风格，渲染 WebOS 应用容器 -->
    <component :is="WebOSAppContainer" v-if="isWebOS && WebOSAppContainer && !hideShellForAnonymous" />
    <!-- 经典传统模式（仅当非 WebOS 时渲染，避免 WebOS 异步加载期间闪烁经典传统布局） -->
    <div v-else-if="!isWebOS || hideShellForAnonymous" :class="classObj" class="app-wrapper-microi">
        <navbar v-if="!hideShellForAnonymous && isHybridNavigation" :hybrid-active-root="hybridNavigation.activeRoot" :hybrid-has-sidebar="showSidebar" @select-navigation-root="selectNavigationRoot" />
        <!-- 左边菜单区域（移动端不显示） -->
        <sidebar v-if="showSidebar" :navigation-routes="isHybridNavigation ? hybridNavigation.sidebarRoutes : null" :show-brand="!isHybridNavigation" class="sidebar-container-microi" :style="GetMenuBg()" />
        <div :class="{ hasTagsView: !hideShellForAnonymous && needTagsView && !diyStore.IsPhoneView, 'mobile-view': diyStore.IsPhoneView, 'anonymous-shell-hidden': hideShellForAnonymous }" class="main-container-microi" :style="GetMainContainerMicroiStyle()">
            <!-- 顶部导航区域（移动端不显示） -->
            <div v-if="!hideShellForAnonymous && !diyStore.IsPhoneView" class="classic-workspace" :class="{ 'fixed-header-microi': fixedHeader, 'with-tags': needTagsView }" :style="GetFixedHeaderMicroiStyle()">
                <!-- 面包屑区域 -->
                <navbar v-if="!isHybridNavigation" />
                <!-- 页签+内容区域（TagsView 内部已包含 router-view，PC 端内容在这里渲染） -->
                <tags-view v-if="needTagsView" />
            </div>

            <!-- 页面主内容区域：移动端或PC端没有TagsView时使用（因为TagsView内部已有router-view） -->
            <app-main v-if="hideShellForAnonymous || diyStore.IsPhoneView || !needTagsView" />

            <!-- 右边设置区域（Settings 组件已移除）-->
            <!-- <right-panel v-if="showSettings">
                <settings />
            </right-panel> -->
        </div>
        
        <!-- 移动端底部导航栏 -->
        <mobile-tab-bar v-if="!hideShellForAnonymous" />
    </div>
    <PlatformReminderDialog v-if="!hideShellForAnonymous && !isEmbeddedWebosWindow" />
</template>

<script>
import RightPanel from "@/components/RightPanel";
import MobileTabBar from "@/components/MobileTabBar";
import PlatformReminderDialog from './components/PlatformReminderDialog.vue';
// Settings,
import { AppMain, Navbar, Sidebar, TagsView } from "./components";
import ResizeMixin from "./mixin/ResizeHandler";
import { useDiyStore, useAppStore, useSettingsStore, usePermissionStore } from "@/pinia";
import { computed, shallowRef, markRaw } from "vue";
import { loadAppContainer, getAppContainerSync } from "@/utils/webos-detect.js";
import { isEmbeddedWebosWindowRuntime } from "@/utils/webos-embedded-runtime.js";
import { DiyCommon } from "@/utils/microi.net.import";
import { resolveUserNavigationLayout } from '@/utils/user-visual-preferences';
import { firstNavigationLeaf, navigationTarget, resolveHybridNavigation } from '@/utils/hybrid-navigation';

export default {
    name: "Layout",
    components: {
        AppMain,
        Navbar,
        RightPanel,
        MobileTabBar,
        PlatformReminderDialog,
        // Settings,
        Sidebar,
        TagsView
    },
    mixins: [ResizeMixin],
    data() { return { selectedNavigationRoot: '' }; },
    setup() {
        const diyStore = useDiyStore();
        const appStore = useAppStore();
        const settingsStore = useSettingsStore();
        const permissionStore = usePermissionStore();

        // WebOS 自适应：检测 webos 模块并在 macOS/Windows 模式时切换布局
        // 优先使用同步缓存（后续导航无延迟），首次加载走异步
        const cachedMod = getAppContainerSync();
        const WebOSAppContainer = shallowRef(cachedMod ? markRaw(cachedMod.default) : null);
        const isEmbeddedWebosWindow = isEmbeddedWebosWindowRuntime();
        const isWebOS = computed(() => isEmbeddedWebosWindow || ['macOS', 'Windows'].includes(diyStore.SystemStyle));
        if (loadAppContainer && !WebOSAppContainer.value) {
            loadAppContainer().then(m => {
                WebOSAppContainer.value = markRaw(m.default);
            });
        }

        const sidebar = computed(() => appStore.sidebar);
        const device = computed(() => appStore.device);
        const showSettings = computed(() => settingsStore.showSettings);
        const needTagsView = computed(() => settingsStore.tagsView);
        const fixedHeader = computed(() => settingsStore.fixedHeader);
        const ShowClassicTop = computed(() => diyStore.ShowClassicTop);
        const ShowClassicLeft = computed(() => diyStore.ShowClassicLeft);
        const SysConfig = computed(() => diyStore.SysConfig);
        const permission_routes = computed(() => permissionStore.routes);

        return {
            diyStore,
            appStore,
            settingsStore,
            permissionStore,
            WebOSAppContainer,
            isWebOS,
            isEmbeddedWebosWindow,
            sidebar,
            device,
            showSettings,
            needTagsView,
            fixedHeader,
            ShowClassicTop,
            ShowClassicLeft,
            SysConfig,
            permission_routes
        };
    },
    computed: {
        navigationLayout() {
            return resolveUserNavigationLayout(this.diyStore.GetCurrentUser?.NavigationLayout, this.SysConfig?.NavigationLayout);
        },
        isTopNavigation() {
            return !this.diyStore.IsPhoneView && this.navigationLayout === 'Top';
        },
        isHybridNavigation() {
            return !this.diyStore.IsPhoneView && this.navigationLayout === 'TopSide';
        },
        hybridNavigation() {
            return resolveHybridNavigation(this.permission_routes, this.$route.meta?.activeMenu || this.$route.path, this.selectedNavigationRoot);
        },
        showSidebar() {
            return !this.hideShellForAnonymous && !this.diyStore.IsPhoneView && this.ShowClassicLeft != 0
                && !this.isTopNavigation && (!this.isHybridNavigation || this.hybridNavigation.sidebarRoutes.length > 0);
        },
        isCollapse() {
            return !this.sidebar.opened;
        },
        classObj() {
            return {
                hideSidebar: !this.sidebar.opened && !this.diyStore.IsPhoneView,
                openSidebar: this.sidebar.opened && !this.diyStore.IsPhoneView,
                withoutAnimation: this.sidebar.withoutAnimation,
                mobile: this.diyStore.IsPhoneView,
                'phone-view': this.diyStore.IsPhoneView,
                'top-navigation-layout': this.isTopNavigation,
                'hybrid-navigation-layout': this.isHybridNavigation,
                'desktop-shell': !this.diyStore.IsPhoneView && !this.hideShellForAnonymous
            };
        },
        hideShellForAnonymous() {
            const routeRequiresHiddenShell = this.$route?.matched?.some((record) => record.meta?.hideShellForAnonymous === true);
            if (!routeRequiresHiddenShell) return false;
            const token = DiyCommon.getToken();
            const user = this.diyStore.GetCurrentUser || {};
            return !token || !user.Id;
        }
    },
    watch: {
        '$route.fullPath'() { this.selectedNavigationRoot = ''; },
        navigationLayout() { this.selectedNavigationRoot = ''; }
    },
    mounted() {
        var self = this;
    },
    methods: {
        selectNavigationRoot(root) {
            this.selectedNavigationRoot = navigationTarget(root);
            const target = firstNavigationLeaf(root);
            if (/^(https?:|mailto:|tel:)/i.test(target)) {
                window.open(target, '_blank', 'noopener,noreferrer');
            } else if (target !== this.$route.fullPath) {
                this.$router.push(target).catch(() => {});
            }
        },
        handleClickOutside() {
            this.appStore.closeSideBar({ withoutAnimation: false });
        },
        GetMenuBg() {
            var self = this;
            var result = {};
            if (self.isHybridNavigation) {
                const top = self.ShowClassicTop != 0 ? '50px' : '0px';
                result.top = top;
                result.height = `calc(100% - ${top})`;
            }
            if (self.SysConfig.MenuWidth) {
                //这里要判断hideSidebar
                if (self.classObj.openSidebar) {
                    result["width"] = self.SysConfig.MenuWidth; // + ' !important';
                }
            }
            return result;
        },
        GetMainContainerMicroiStyle() {
            var self = this;
            var result = {};
            if (self.isHybridNavigation) {
                const top = self.ShowClassicTop != 0 ? '50px' : '0px';
                // 全局侧栏样式带 #app-microi 优先级；使用动态样式确保混合布局与 Tab 全屏一致。
                result.height = `calc(100% - ${top})`;
                result.minHeight = '0px';
            }

            if (self.hideShellForAnonymous || !self.showSidebar) {
                result["marginLeft"] = "0px";
                return result;
            }
            
            // 移动端不需要设置左边距
            if (self.diyStore.IsPhoneView) {
                result["marginLeft"] = "0px";
                return result;
            }
            
            if (self.SysConfig.MenuWidth && self.isCollapse !== true) {
                result["marginLeft"] = self.SysConfig.MenuWidth;
            }
            if (self.ShowClassicLeft == 0) {
                result["marginLeft"] = "0px";
            }
            return result;
        },
        GetFixedHeaderMicroiStyle() {
            var self = this;
            var result = {};
            //2022-07-22修改为固定
            result["width"] = "100%";
            // if (self.SysConfig.TopWidthFull) {
            //     result["padding-left"] = "0px";
            //     result["padding-right"] = "0px";
            //     result["backgroundColor"] = "#fff";
            // }
            return result;

            if (self.SysConfig.MenuWidth && self.isCollapse !== true) {
                result["width"] = "calc(100% - " + self.SysConfig.MenuWidth + ")"; //'calc(100% - 240px)'
            } else if (self.isCollapse !== true) {
                result["width"] = "calc(100% - 240px)";
            }
            return result;
        }
    }
};
</script>

<style lang="scss" scoped>
@import "@/styles/mixin.scss";
@import "@/styles/variables.scss";

.app-wrapper-microi {
    // @include clearfix;
    position: relative;
    height: 100%;
    width: 100%;

    &.mobile.openSidebar {
        position: fixed;
        top: 0;
    }
}

// 桌面壳层占满视口，导航和页签不参与业务内容滚动；移动端仍保留 window 滚动。
.desktop-shell {
    height: 100dvh;
    overflow: hidden;

    .main-container-microi {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        min-width: 0;
        box-sizing: border-box;
    }

    .classic-workspace {
        position: relative !important;
        display: flex;
        flex-direction: column;
        flex: 0 0 auto;
        min-height: 0;
        min-width: 0;
        box-sizing: border-box;
        &.with-tags { flex: 1 1 0; }
    }

    :deep(.navbar-microi) { flex: 0 0 auto; }
    :deep(.tags-view-container-microi) {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        height: auto;
        min-height: 0;
        min-width: 0;
    }
    :deep(.tags-view-strip) { flex: 0 0 28px; height: 28px; }
    :deep(.mci-route-view-host) {
        flex: 1 1 0;
        min-height: 0;
        min-width: 0;
        overflow-x: hidden;
        overflow-y: auto;
    }
    > .main-container-microi > :deep(.app-main-microi) {
        flex: 1 1 0;
        min-height: 0;
        padding-top: 0;
        overflow-x: hidden;
        overflow-y: auto;
    }
}

.fixed-header-microi {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 101;
    width: calc(100% - #{$sideBarWidth});
    transition: none;
}

.hideSidebar .fixed-header-microi {
    width: calc(100% - 54px);
}

.mobile .fixed-header-microi {
    width: 100%;
}

// 移动端样式调整
.mobile-view {
    margin-left: 0 !important;
    // padding-bottom: 60px; // 为底部导航栏留出空间
}

.anonymous-shell-hidden {
    margin-left: 0 !important;

    :deep(.app-main-microi) {
        min-height: 100vh;
        padding-top: 0 !important;
    }
}
</style>
