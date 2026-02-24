<template>
    <!-- WebOS 模式：如果 webos 模块存在且当前为 macOS/Windows 风格，渲染 WebOS 应用容器 -->
    <component :is="WebOSAppContainer" v-if="isWebOS && WebOSAppContainer" />
    <!-- 经典传统模式（仅当非 WebOS 时渲染，避免 WebOS 异步加载期间闪烁经典传统布局） -->
    <div v-else-if="!isWebOS" :class="classObj" class="app-wrapper-microi">
        <!-- 遮罩层：仅在移动端且菜单展开时显示 -->
        <div v-if="diyStore.IsPhoneView && sidebar.opened" class="drawer-bg-microi" @click="handleClickOutside" />
        <!-- 左边菜单区域（移动端不显示） -->
        <sidebar v-if="ShowClassicLeft != 0 && !diyStore.IsPhoneView" class="sidebar-container-microi" :style="GetMenuBg()" />
        <div :class="{ hasTagsView: needTagsView && !diyStore.IsPhoneView, 'mobile-view': diyStore.IsPhoneView }" class="main-container-microi" :style="GetMainContainerMicroiStyle()">
            <!-- 顶部导航区域（移动端不显示） -->
            <div v-if="!diyStore.IsPhoneView" :class="{ 'fixed-header-microi': fixedHeader }" :style="GetFixedHeaderMicroiStyle()">
                <!-- 面包屑区域 -->
                <navbar />
                <!-- 页签+内容区域（TagsView 内部已包含 router-view，PC 端内容在这里渲染） -->
                <tags-view v-if="needTagsView" />
            </div>

            <!-- 页面主内容区域：移动端或PC端没有TagsView时使用（因为TagsView内部已有router-view） -->
            <app-main v-if="diyStore.IsPhoneView || !needTagsView" />

            <!-- 右边设置区域（Settings 组件已移除）-->
            <!-- <right-panel v-if="showSettings">
                <settings />
            </right-panel> -->
        </div>
        
        <!-- 移动端底部导航栏 -->
        <mobile-tab-bar />
    </div>
</template>

<script>
import RightPanel from "@/components/RightPanel";
import MobileTabBar from "@/components/MobileTabBar";
// Settings,
import { AppMain, Navbar, Sidebar, TagsView } from "./components";
import ResizeMixin from "./mixin/ResizeHandler";
import { useDiyStore, useAppStore, useSettingsStore, usePermissionStore } from "@/pinia";
import { computed, shallowRef, markRaw } from "vue";
import { loadAppContainer, getAppContainerSync } from "@/utils/webos-detect.js";

export default {
    name: "Layout",
    components: {
        AppMain,
        Navbar,
        RightPanel,
        MobileTabBar,
        // Settings,
        Sidebar,
        TagsView
    },
    mixins: [ResizeMixin],
    setup() {
        const diyStore = useDiyStore();
        const appStore = useAppStore();
        const settingsStore = useSettingsStore();
        const permissionStore = usePermissionStore();

        // WebOS 自适应：检测 webos 模块并在 macOS/Windows 模式时切换布局
        // 优先使用同步缓存（后续导航无延迟），首次加载走异步
        const cachedMod = getAppContainerSync();
        const WebOSAppContainer = shallowRef(cachedMod ? markRaw(cachedMod.default) : null);
        const isWebOS = computed(() => ['macOS', 'Windows'].includes(diyStore.SystemStyle));
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
        isCollapse() {
            return !this.sidebar.opened;
        },
        classObj() {
            return {
                hideSidebar: !this.sidebar.opened && !this.diyStore.IsPhoneView,
                openSidebar: this.sidebar.opened && !this.diyStore.IsPhoneView,
                withoutAnimation: this.sidebar.withoutAnimation,
                mobile: this.diyStore.IsPhoneView,
                'phone-view': this.diyStore.IsPhoneView
            };
        }
    },
    mounted() {
        var self = this;
    },
    methods: {
        handleClickOutside() {
            this.appStore.closeSideBar({ withoutAnimation: false });
        },
        GetMenuBg() {
            var self = this;
            var result = {};
            if (self.SysConfig.MenuBg == "Custom" && !self.DiyCommon.IsNull(self.SysConfig.MenuWidth)) {
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
            
            // 移动端不需要设置左边距
            if (self.diyStore.IsPhoneView) {
                result["marginLeft"] = "0px";
                return result;
            }
            
            if (self.SysConfig.MenuBg == "Custom" && self.SysConfig.MenuWidth && self.isCollapse !== true) {
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
            if (self.SysConfig.TopWidthFull) {
                result["padding-left"] = "0px";
                result["padding-right"] = "0px";
                result["backgroundColor"] = "#fff";
            }
            return result;

            if (self.SysConfig.MenuBg == "Custom" && self.SysConfig.MenuWidth && self.isCollapse !== true) {
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

.drawer-bg-microi {
    background: #000;
    opacity: 0.3;
    width: 100%;
    top: 0;
    height: 100%;
    position: absolute;
    // 这里一定要大一点，否则移动端的左侧菜单弹出后无法显示在最顶层，下次要修改需慎重！ --2025-08-24 by anderson
    z-index: 999;
}

.fixed-header-microi {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 101;
    width: calc(100% - #{$sideBarWidth});
    transition: width 0.28s;
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
</style>
