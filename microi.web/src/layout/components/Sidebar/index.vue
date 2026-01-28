<template>
    <div :class="{ 'has-logo': showLogo, 'sidebar-js-bg': ShowStar() }">
        <logo v-if="showLogo" :collapse="isCollapse" />
        <el-scrollbar wrap-class="scrollbar-wrapper-microi">
            <el-menu
                :default-active="activeMenu"
                :collapse="isCollapse"
                :background-color="variables.menuBg"
                :text-color="variables.menuText"
                :unique-opened="true"
                :active-text-color="variables.menuActiveText"
                :collapse-transition="false"
                mode="vertical"
                :show-timeout="100"
                :hide-timeout="100"
                :class="isCollapse ? 'el-menu--collapse' : ''"
            >
                <template v-for="route in permission_routes" :key="route.path">
                    <sidebar-item v-if="route.Display !== 0" :key="route.path" :item="route" :base-path="route.path" />
                </template>
            </el-menu>
            <div style="height: 120px; width: 100%"></div>
        </el-scrollbar>
        <MenuBottom v-show="!isCollapse"></MenuBottom>
        <canvas v-if="ShowStar()" id="canv" width="240" style="width: 240px; height: 100%; position: absolute; top: 0; left: 0; z-index: -1"></canvas>
    </div>
</template>

<script>
import Logo from "./Logo";
import SidebarItem from "./SidebarItem";
import variables from "@/styles/variables.js";
import MenuBottom from "@/layout/components/menu-bottom.vue";
import { AnimateStar } from "@/utils/animate-star";
import { useDiyStore, usePermissionStore, useAppStore, useSettingsStore } from "@/pinia";
import { computed } from "vue";

export default {
    components: { SidebarItem, Logo, MenuBottom },
    setup() {
        const diyStore = useDiyStore();
        const permissionStore = usePermissionStore();
        const appStore = useAppStore();
        const settingsStore = useSettingsStore();

        const permission_routes = computed(() => permissionStore.routes);
        const sidebar = computed(() => appStore.sidebar);
        const OsClient = computed(() => diyStore.OsClient);
        const SysConfig = computed(() => diyStore.SysConfig);
        const showLogo = computed(() => settingsStore.sidebarLogo);
        const isCollapse = computed(() => !sidebar.value.opened);

        return {
            permission_routes,
            sidebar,
            OsClient,
            SysConfig,
            showLogo,
            isCollapse,
            variables
        };
    },
    computed: {
        activeMenu() {
            const route = this.$route;
            const { meta, path } = route;
            // if set path, the sidebar will highlight the path you set
            if (meta.activeMenu) {
                return meta.activeMenu;
            }
            return path;
        }
    },
    created() {
        var self = this;
        self.$nextTick(function () {
            // require("@/views/microi/js/animate-star");
            // AnimateStar.run();
            if (self.ShowStar()) {
                new AnimateStar().run();
            }
        });
    },
    mounted() {
        var self = this;
        self.$nextTick(function () {
            // require("@/views/microi/js/animate-star");
            // AnimateStar.run();
            if (self.ShowStar()) {
                new AnimateStar().run();
            }
        });
    },
    methods: {
        MenuClick(route) {
            var self = this;
            self.DiyCommon.Tips("用户点击了菜单！");
        },
        ShowStar() {
            return false;
            var self = this;
            if (self.DiyCommon.IsNull(self.SysConfig.MenuBg) || self.SysConfig.MenuBg == "Style1") {
                return true;
            }
            return false;
        }
    }
};
</script>
<style scoped lang="scss">
// 默认侧边栏背景 - 使用主题色渐变
.has-logo {
    background: linear-gradient(180deg, 
        var(--color-primary, #409eff) 0%, 
        color-mix(in srgb, var(--color-primary, #409eff) 85%, black) 100%
    );
}

.sidebar-js-bg {
    // 星空背景样式（特殊主题）
    background-image: -webkit-radial-gradient(ellipse farthest-corner at center top, color-mix(in srgb, var(--color-primary, #409eff) 30%, #1a1a1a) 0%, #0a0a0a 100%);
    background-image: radial-gradient(ellipse farthest-corner at center top, color-mix(in srgb, var(--color-primary, #409eff) 30%, #1a1a1a) 0%, #0a0a0a 100%);
}

// 菜单项现代化样式
:deep(.el-menu) {
    border-right: none;
    background: transparent !important;

    .el-menu-item,
    .el-sub-menu__title {
        position: relative;
        margin: 4px 8px;
        border-radius: 8px;
        transition: all 0.2s ease;
        overflow: hidden;
        color: var(--sidebar-text-color, rgba(255, 255, 255, 0.9)) !important;

        &:hover {
            background: var(--sidebar-hover-bg, rgba(255, 255, 255, 0.15)) !important;
            transform: translateX(2px);
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
            color: var(--sidebar-text-color, #ffffff) !important;

            i {
                transform: scale(1.05);
                color: var(--sidebar-text-color, #ffffff) !important;
            }

            span {
                color: var(--sidebar-text-color, #ffffff) !important;
            }
        }

        // 活动状态
        &.is-active {
            background: var(--sidebar-active-bg, rgba(255, 255, 255, 0.25)) !important;
            color: var(--sidebar-text-color, #ffffff) !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            font-weight: 600;

            &::before {
                content: '';
                position: absolute;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 4px;
                height: 70%;
                background: var(--sidebar-text-color, #ffffff);
                border-radius: 0 4px 4px 0;
                box-shadow: 0 0 8px var(--sidebar-text-color, rgba(255, 255, 255, 0.8));
            }

            i {
                color: var(--sidebar-text-color, #ffffff) !important;
                filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
            }

            span {
                color: var(--sidebar-text-color, #ffffff) !important;
            }
        }

        // 图标美化
        i {
            margin-right: 8px;
            font-size: 18px;
            transition: all 0.2s ease;
            color: var(--sidebar-text-color, rgba(255, 255, 255, 0.9)) !important;
        }

        // 文字颜色
        span {
            color: var(--sidebar-text-color, rgba(255, 255, 255, 0.9)) !important;
        }
    }

    // 子菜单样式
    .el-sub-menu {
        .el-menu {
            background: rgba(0, 0, 0, 0.05) !important;
        }

        .el-menu-item {
            padding-left: 50px !important;
            
            &::before {
                left: 35px;
            }
        }
    }
}

// 确保折叠时文字隐藏
:deep(.el-menu--collapse) {
    .el-menu-item,
    .el-submenu__title {
        span {
            height: 0;
            width: 0;
            overflow: hidden;
            visibility: hidden;
            display: inline-block;
        }

        i {
            margin-right: 0;
        }
    }
}
</style>
