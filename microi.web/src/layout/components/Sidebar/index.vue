<template>
    <div :class="{ 'has-logo': showLogo, 'sidebar-js-bg': ShowStar() }">
        <logo v-if="showLogo" :collapse="isCollapse" />
        <el-scrollbar wrap-class="scrollbar-wrapper-microi">
            <el-menu
                :default-active="activeMenu"
                :collapse="isCollapse"
                :background-color="variables.menuBg"
                :text-color="variables.menuText"
                :unique-opened="false"
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
.sidebar-js-bg {
    // #000d4d  #000105 原先           //#242B49  #5473E8 小罗
    //左边的颜色是中间，右边的颜色是两边
    background-image: -webkit-radial-gradient(ellipse farthest-corner at center top, #242b49 0%, #171717 100%);
    background-image: radial-gradient(ellipse farthest-corner at center top, #242b49 0%, #171717 100%);
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
    }
}
</style>
