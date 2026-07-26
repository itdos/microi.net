<template>
    <div :class="{ 'has-logo': showLogo, 'sidebar-js-bg': ShowStar() }">
        <logo v-if="showLogo" :collapse="isCollapse" />
        <el-scrollbar wrap-class="scrollbar-wrapper-microi">
            <el-menu
                :key="sidebarRenderKey"
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
                <template v-for="route in permission_routes" :key="route.path + '-' + (route.meta && route.meta.title || route.Name || '')">
                    <sidebar-item v-if="route.Display !== 0" :key="route.path + '-' + (route.meta && route.meta.title || route.Name || '')" :item="route" :base-path="route.path" />
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
import { computed, onMounted, onUnmounted, ref } from "vue";

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
        const sidebarRenderKey = ref(0);
        const refreshSidebar = () => {
            sidebarRenderKey.value += 1;
        };

        onMounted(() => {
            window.addEventListener("microi:lang-routes-reloaded", refreshSidebar);
        });
        onUnmounted(() => {
            window.removeEventListener("microi:lang-routes-reloaded", refreshSidebar);
        });

        return {
            permission_routes,
            sidebar,
            OsClient,
            SysConfig,
            showLogo,
            isCollapse,
            sidebarRenderKey,
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
            var self = this;
            return false;
        }
    }
};
</script>
<style scoped lang="scss">
// 侧边栏背景由主题运行时生成：浅色保留品牌渐变，暗色使用低饱和表面渐变。
.has-logo {
    background: var(--sidebar-bg-gradient, linear-gradient(180deg,
        var(--color-primary, #409eff) 0%,
        var(--color-primary-dark, #2c7acc) 100%
    ));
}

.sidebar-js-bg {
    // 星空背景样式（特殊主题）
    background-image: -webkit-radial-gradient(ellipse farthest-corner at center top, #2d5a99 0%, #0a0a0a 100%);
    background-image: radial-gradient(ellipse farthest-corner at center top, #2d5a99 0%, #0a0a0a 100%);
}

// 菜单项现代化样式
:deep(.el-menu) {
    border-right: none;
    background: transparent !important;
    padding: 4px 0 8px;

    .el-sub-menu__title {
        height: 46px;
        line-height: 46px;
    }

    .el-menu-item,
    .el-sub-menu__title {
        position: relative;
        box-sizing: border-box;
        margin: 2px 8px;
        border-radius: 8px;
        background: transparent !important;
        transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
        overflow: hidden;
        color: var(--sidebar-text-color, rgba(255, 255, 255, 0.9)) !important;

        &:hover {
            background: var(--sidebar-hover-bg, rgba(255, 255, 255, 0.12)) !important;
            transform: translateX(1px);
            box-shadow: none;
            color: var(--sidebar-text-color, #ffffff) !important;

            .sub-el-icon {
                transform: scale(1.05);
                color: var(--sidebar-text-color, #ffffff) !important;
            }

            .menu-title {
                color: var(--sidebar-text-color, #ffffff) !important;
            }
        }

        // 活动状态
        &.is-active {
            background: var(--sidebar-active-bg, rgba(255, 255, 255, 0.25)) !important;
            color: var(--sidebar-active-text-color, var(--sidebar-text-color, #ffffff)) !important;
            box-shadow: none;
            font-weight: 600;

            &::before {
                content: '';
                position: absolute;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 3px;
                height: 56%;
                background: var(--sidebar-active-text-color, var(--sidebar-text-color, #ffffff));
                border-radius: 0 3px 3px 0;
                box-shadow: none;
            }

            .sub-el-icon {
                color: var(--sidebar-active-text-color, var(--sidebar-text-color, #ffffff)) !important;
                filter: none;
            }

            .menu-title {
                color: var(--sidebar-active-text-color, var(--sidebar-text-color, #ffffff)) !important;
            }
        }

        // 图标美化
        .sub-el-icon {
            margin-right: 8px;
            font-size: 18px;
            transition: all 0.2s ease;
            color: var(--sidebar-text-color, rgba(255, 255, 255, 0.9)) !important;
        }

        // 文字颜色
        .menu-title {
            color: var(--sidebar-text-color, rgba(255, 255, 255, 0.9)) !important;
        }
    }

    .el-menu-item {
        width: calc(100% - 16px);
    }

    // Element Plus 的箭头使用 width: inherit；一级标题不能继承整行宽度。
    .el-sub-menu__title {
        width: auto;
    }

    // 子菜单样式
    .el-sub-menu {
        &.is-opened {
            > .el-sub-menu__title {
                background: var(--sidebar-opened-title-bg, transparent) !important;
                box-shadow: none;
            }
        }

        &.is-active {
            > .el-sub-menu__title {
                background: var(--sidebar-parent-active-bg, rgba(255, 255, 255, 0.1)) !important;
                color: var(--sidebar-active-text-color, var(--sidebar-text-color, #ffffff)) !important;

                i,
                span {
                    color: inherit !important;
                }
            }
        }

        .el-menu {
            box-sizing: border-box;
            width: 100% !important;
            margin: 2px 0 6px;
            padding: 2px 8px 2px 14px;
            border-radius: 0;
            background: transparent !important;
            box-shadow: none;

            .el-menu-item,
            .el-sub-menu__title {
                min-width: 0 !important;
                width: auto;
                margin: 2px 0;
                background: var(--sidebar-submenu-item-bg, transparent) !important;

                &:hover {
                    background: var(--sidebar-submenu-hover-bg, var(--sidebar-hover-bg, rgba(255, 255, 255, 0.12))) !important;
                }

                &.is-active {
                    background: var(--sidebar-submenu-active-bg, var(--sidebar-active-bg, rgba(255, 255, 255, 0.22))) !important;
                }
            }
        }
    }
}
:deep(.el-sub-menu .el-sub-menu__icon-arrow) {
    width: 1em;
    height: 1em;
    margin-top: -6px;
    margin-right: 0;
    font-size: 12px;
}

// 确保折叠时文字隐藏
:deep(.el-menu--collapse) {
    .el-icon.el-sub-menu__icon-arrow{
        display: none;
    }
    .el-sub-menu__title{
        margin: 0px 0px;
        .menu-title{
            display: none;
        }
    }
    .el-sub-menu {
        .el-menu {
            margin: 0;
            padding: 0;
            box-shadow: none;
        }
    }
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
