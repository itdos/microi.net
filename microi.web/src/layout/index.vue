<template>
    <div :class="classObj" class="app-wrapper-microi">
        <div v-if="device === 'mobile' && sidebar.opened" class="drawer-bg-microi" @click="handleClickOutside" />
        <!-- 左边菜单区域 -->
        <sidebar v-if="ShowClassicLeft != 0" class="sidebar-container-microi" :style="GetMenuBg()" />
        <div :class="{ hasTagsView: needTagsView }" class="main-container-microi" :style="GetMainContainerMicroiStyle()">
            <!-- <app-main> -->
            <!-- v-if="ShowClassicTop != 0" -->
            <div key="" :class="{ 'fixed-header-microi': fixedHeader }" :style="GetFixedHeaderMicroiStyle()">
                <!-- 面包屑区域 -->
                <navbar />
                <!-- 页签+内容区域 -->
                <tags-view v-if="needTagsView" />
            </div>
            <!-- <app-main /> -->

            <!-- 右边设置区域（Settings 组件已移除）-->
            <!-- <right-panel v-if="showSettings">
                <settings />
            </right-panel> -->
        </div>
    </div>
</template>

<script>
import RightPanel from "@/components/RightPanel";
// Settings,
import { Navbar, Sidebar, TagsView } from "./components";
import ResizeMixin from "./mixin/ResizeHandler";
import { useDiyStore, useAppStore, useSettingsStore, usePermissionStore } from "@/stores";
import { computed } from "vue";

export default {
    name: "Layout",
    components: {
        Navbar,
        RightPanel,
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
                hideSidebar: !this.sidebar.opened,
                openSidebar: this.sidebar.opened,
                withoutAnimation: this.sidebar.withoutAnimation,
                mobile: this.device === "mobile"
            };
        }
    },
    mounted() {
        var self = this;
        var head = document.head || document.getElementsByTagName("head")[0];

        //
        var style = document.createElement("style");
        style.setAttribute("type", "text/css");
        style.innerHTML = ``;
        if (self.SysConfig && self.SysConfig.ActiveMenuBg) {
            // style.innerHTML += `.microi .el-scrollbar .el-menu .el-menu-item.is-active{background-color:${self.SysConfig.ActiveMenuBg} !important}`;
            style.innerHTML += `#app-microi .sidebar-container-microi .el-submenu .el-menu-item.is-active
                          ,#app-microi .sidebar-container-microi .el-submenu .el-menu-item:hover
                          ,#app-microi .sidebar-container-microi .el-menu-item.is-active
                          ,#app-microi .sidebar-container-microi .el-submenu__title:hover
                          ,#app-microi .sidebar-container-microi .submenu-title-noDropdown-microi:hover
                          ,#app-microi .sidebar-container-microi .submenu-title-noDropdown-microi.is-active
                          ,#app-microi .sidebar-container-microi .nest-menu .el-submenu .el-submenu__title:hover
                          {background-color:${self.SysConfig.ActiveMenuBg} !important}`;
        }
        if (self.SysConfig && self.SysConfig.ActiveMenuColor) {
            style.innerHTML += `.microi .el-scrollbar .el-menu .el-menu-item.is-active span
                        ,.microi .el-scrollbar .el-menu .el-menu-item:hover span
                        ,.microi .el-scrollbar .el-menu .el-menu-item.is-active i
                        ,.microi .el-scrollbar .el-menu .el-menu-item:hover i
                        ,#app-microi .sidebar-container-microi .el-submenu__title:hover i
                        ,#app-microi .sidebar-container-microi .el-submenu__title:hover span
                          ,#app-microi .sidebar-container-microi .submenu-title-noDropdown-microi.is-active i
                          ,#app-microi .sidebar-container-microi .submenu-title-noDropdown-microi.is-active span
                        {color:${self.SysConfig.ActiveMenuColor} !important}`;
        }

        // 设置菜单文字和箭头颜色
        if (self.SysConfig && self.SysConfig.MenuWordColor) {
            style.innerHTML += `#app-microi .sidebar-container-microi .el-submenu__title
                        ,#app-microi .sidebar-container-microi .el-submenu__title i
                        ,#app-microi .sidebar-container-microi .el-submenu__title .el-submenu__icon-arrow
                        ,#app-microi .sidebar-container-microi .nest-menu .el-submenu__title
                        ,#app-microi .sidebar-container-microi .nest-menu .el-submenu__title i
                        ,#app-microi .sidebar-container-microi .nest-menu .el-submenu__title .el-submenu__icon-arrow
                        {color:${self.SysConfig.MenuWordColor} !important}`;
        }
        head.appendChild(style);
    },
    methods: {
        handleClickOutside() {
            this.appStore.closeSideBar({ withoutAnimation: false });
        },
        GetMenuBg() {
            var self = this;
            var result = {};
            if (self.SysConfig.MenuBg == "Custom" && !self.DiyCommon.IsNull(self.SysConfig.MenuBackgroundColor)) {
                result["backgroundColor"] = self.SysConfig.MenuBackgroundColor;
            }
            if (self.SysConfig.MenuBg == "Custom" && !self.DiyCommon.IsNull(self.SysConfig.MenuBoxShadow)) {
                result["boxShadow"] = self.SysConfig.MenuBoxShadow;
            }
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
            var result = {}; //marginLeft : self.SysConfig.MenuBg == 'Custom' && self.SysConfig.MenuWidth ? self.SysConfig.MenuWidth : '240px'
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
</style>
