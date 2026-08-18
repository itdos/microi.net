<template>
    <div
        :class="{ 'has-logo': showLogo, 'sidebar-js-bg': ShowStar() }"
        @mouseover="handleCompactMenuMouseOver"
        @focusin="handleCompactMenuMouseOver"
        @mouseleave="scheduleCompactClose"
    >
        <logo v-if="showLogo" :collapse="isCollapse" />
        <el-scrollbar wrap-class="scrollbar-wrapper-microi">
            <el-menu
                class="sidebar-main-menu"
                :key="sidebarRenderKey"
                :default-active="activeMenu"
                :collapse="false"
                :background-color="variables.menuBg"
                :text-color="variables.menuText"
                :unique-opened="true"
                :active-text-color="variables.menuActiveText"
                :collapse-transition="false"
                mode="vertical"
                :show-timeout="100"
                :hide-timeout="100"
                :class="{ 'sidebar-main-menu--compact': isCollapse }"
            >
                <template v-for="(route, routeIndex) in permission_routes" :key="route.path + '-' + (route.meta && route.meta.title || route.Name || '')">
                    <sidebar-item
                        v-if="route.Display !== 0"
                        :key="route.path + '-' + (route.meta && route.meta.title || route.Name || '')"
                        :item="route"
                        :base-path="route.path"
                        :compact-index="routeIndex"
                    />
                </template>
            </el-menu>
            <div style="height: 120px; width: 100%"></div>
        </el-scrollbar>
        <MenuBottom v-show="!isCollapse"></MenuBottom>
        <canvas v-if="ShowStar()" id="canv" width="240" style="width: 240px; height: 100%; position: absolute; top: 0; left: 0; z-index: -1"></canvas>
        <teleport to="body">
            <div
                v-for="(panel, panelIndex) in compactPanels"
                v-show="isCollapse"
                :key="panel.key"
                class="mci-sidebar-menu-popper mci-sidebar-compact-flyout"
                :data-panel-index="panelIndex"
                :style="{ left: `${panel.left}px`, top: `${panel.top}px` }"
                role="menu"
                @mouseenter="cancelCompactClose"
                @mouseleave="scheduleCompactClose"
            >
                <div
                    v-for="node in panel.items"
                    :key="node.key"
                    class="mci-sidebar-flyout-item"
                    :class="{ 'is-active': isCompactNodeActive(node) }"
                    role="menuitem"
                    tabindex="0"
                    :data-target="node.target || undefined"
                    :aria-haspopup="node.hasChildren ? 'menu' : undefined"
                    @mouseenter="openCompactChild(node, panelIndex, $event)"
                    @focus="openCompactChild(node, panelIndex, $event)"
                    @click="handleCompactNodeClick(node, panelIndex, $event)"
                    @keydown.enter.prevent="handleCompactNodeClick(node, panelIndex, $event)"
                    @keydown.space.prevent="handleCompactNodeClick(node, panelIndex, $event)"
                >
                    <menu-item
                        :icon="node.icon"
                        :title="node.title"
                        :menu-id="node.menuId"
                        :badge-config="node.badgeConfig"
                    />
                    <el-icon v-if="node.hasChildren" class="mci-sidebar-flyout-arrow"><ArrowRight /></el-icon>
                </div>
            </div>
        </teleport>
    </div>
</template>

<script>
import Logo from "./Logo";
import SidebarItem from "./SidebarItem";
import MenuItem from "./Item";
import variables from "@/styles/variables.js";
import MenuBottom from "@/layout/components/menu-bottom.vue";
import { AnimateStar } from "@/utils/animate-star";
import path from "@/utils/path";
import { generateTitle } from "@/utils/i18n";
import { isExternal } from "@/utils/validate";
import { ArrowRight } from "@element-plus/icons-vue";
import { useDiyStore, usePermissionStore, useAppStore, useSettingsStore } from "@/pinia";
import { computed, onMounted, onUnmounted, ref } from "vue";

export default {
    components: { SidebarItem, Logo, MenuBottom, MenuItem, ArrowRight },
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
    data() {
        return {
            compactPanels: [],
            compactCloseTimer: null,
            compactPanelSequence: 0,
            compactRootKey: ""
        };
    },
    watch: {
        isCollapse(value) {
            if (!value) this.closeCompactMenu();
        },
        "$route.fullPath"() {
            this.closeCompactMenu();
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
    beforeUnmount() {
        this.cancelCompactClose();
    },
    methods: {
        visibleCompactChildren(item) {
            return Array.isArray(item?.children)
                ? item.children.filter((child) => child?.Display !== 0 && !child?.hidden)
                : [];
        },
        resolveCompactPath(routeModel, basePath = "") {
            const routePath = typeof routeModel === "string" ? routeModel : routeModel?.path || "";
            if (!routePath) return basePath;
            if (isExternal(routePath)) {
                const urlParam = typeof routeModel === "object" ? routeModel?.UrlParam : "";
                return routePath + (urlParam ? `?${urlParam}` : "");
            }
            if (isExternal(basePath)) return basePath;
            const urlParam = typeof routeModel === "object" ? routeModel?.UrlParam : "";
            return path.resolve(basePath || "/", routePath + (urlParam ? `?${urlParam}` : ""));
        },
        buildCompactNode(item, basePath = "", fallbackIcon = "") {
            if (!item || item.Display === 0 || item.hidden) return null;
            const visibleChildren = this.visibleCompactChildren(item);
            const meta = item.meta || {};

            // 与 SidebarItem 的单子级扁平化规则保持一致，避免收缩态凭空多出一层。
            if (visibleChildren.length === 1 && (!visibleChildren[0]?.children || visibleChildren[0]?.noShowingChildren) && !item.alwaysShow) {
                const onlyChild = visibleChildren[0];
                const childMeta = onlyChild.meta || {};
                const target = this.resolveCompactPath(onlyChild, basePath);
                return {
                    key: childMeta.Id || target || `${childMeta.title || onlyChild.Name}-leaf`,
                    source: onlyChild,
                    basePath: target,
                    title: this.generateCompactTitle(childMeta.title || onlyChild.Name || meta.title || item.Name || ""),
                    icon: childMeta.icon || meta.icon || fallbackIcon,
                    menuId: childMeta.Id || "",
                    badgeConfig: childMeta.MenuBadgeConfig || "",
                    target,
                    hasChildren: false
                };
            }

            if (visibleChildren.length === 0) {
                const target = basePath || this.resolveCompactPath(item, "");
                return {
                    key: meta.Id || target || `${meta.title || item.Name}-leaf`,
                    source: item,
                    basePath: target,
                    title: this.generateCompactTitle(meta.title || item.Name || ""),
                    icon: meta.icon || fallbackIcon,
                    menuId: meta.Id || "",
                    badgeConfig: meta.MenuBadgeConfig || "",
                    target,
                    hasChildren: false
                };
            }

            return {
                key: meta.Id || basePath || `${meta.title || item.Name}-group`,
                source: item,
                basePath,
                title: this.generateCompactTitle(meta.title || item.Name || ""),
                icon: meta.icon || fallbackIcon,
                menuId: meta.Id || "",
                badgeConfig: meta.MenuBadgeConfig || "",
                target: "",
                hasChildren: true
            };
        },
        buildCompactChildren(node) {
            if (!node?.hasChildren || !node?.source) return [];
            return this.visibleCompactChildren(node.source)
                .map((child) => {
                    const childBasePath = this.resolveCompactPath(child, node.basePath || "");
                    return this.buildCompactNode(child, childBasePath, node.icon || "");
                })
                .filter(Boolean);
        },
        generateCompactTitle(title) {
            try {
                return generateTitle.call(this, title || "");
            } catch (error) {
                return title || "";
            }
        },
        handleCompactMenuMouseOver(event) {
            if (!this.isCollapse || !event?.target) return;
            const rootElement = event.target.closest?.('.sidebar-menu-node[data-menu-level="0"][data-compact-index]');
            if (!rootElement || !event.currentTarget?.contains(rootElement)) return;
            const routeIndex = Number(rootElement.dataset.compactIndex);
            const item = this.permission_routes[routeIndex];
            if (!item) return;
            const rootKey = item.meta?.Id || item.path || String(routeIndex);
            this.cancelCompactClose();
            if (this.compactRootKey === rootKey && this.compactPanels.length) return;
            const rect = rootElement.getBoundingClientRect();
            this.openCompactMenu({
                item,
                basePath: item.path || "",
                rootKey,
                rect: {
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height
                }
            });
        },
        openCompactMenu(payload) {
            if (!this.isCollapse || !payload?.item || !payload?.rect) return;
            this.cancelCompactClose();
            const rootNode = this.buildCompactNode(payload.item, payload.basePath || payload.item.path || "");
            if (!rootNode?.hasChildren) {
                this.closeCompactMenu();
                return;
            }
            const rootItems = this.buildCompactChildren(rootNode);
            if (!rootItems.length) {
                this.closeCompactMenu();
                return;
            }
            this.compactRootKey = payload.rootKey || rootNode.key;
            this.compactPanels = [{
                key: `compact-root-${++this.compactPanelSequence}`,
                items: rootItems,
                left: Math.round(payload.rect.right + 4),
                top: Math.round(payload.rect.top)
            }];
            this.$nextTick(() => this.fitCompactPanel(0));
        },
        openCompactChild(node, panelIndex, event) {
            if (!this.isCollapse) return;
            this.cancelCompactClose();
            this.compactPanels = this.compactPanels.slice(0, panelIndex + 1);
            if (!node?.hasChildren || !event?.currentTarget) return;
            const childItems = this.buildCompactChildren(node);
            if (!childItems.length) return;
            const rect = event.currentTarget.getBoundingClientRect();
            this.compactPanels.push({
                key: `compact-child-${panelIndex + 1}-${node.key}-${++this.compactPanelSequence}`,
                items: childItems,
                left: Math.round(rect.right + 4),
                top: Math.round(rect.top)
            });
            this.$nextTick(() => this.fitCompactPanel(panelIndex + 1));
        },
        fitCompactPanel(panelIndex) {
            const panelElement = document.querySelector(`.mci-sidebar-compact-flyout[data-panel-index="${panelIndex}"]`);
            const panel = this.compactPanels[panelIndex];
            if (!panelElement || !panel) return;
            const rect = panelElement.getBoundingClientRect();
            const viewportGap = 8;
            let top = panel.top;
            let left = panel.left;
            if (top + rect.height > window.innerHeight - viewportGap) {
                top = Math.max(viewportGap, window.innerHeight - rect.height - viewportGap);
            }
            if (left + rect.width > window.innerWidth - viewportGap) {
                const previousPanel = panelIndex > 0
                    ? document.querySelector(`.mci-sidebar-compact-flyout[data-panel-index="${panelIndex - 1}"]`)
                    : null;
                const anchorLeft = previousPanel?.getBoundingClientRect().left || 54;
                left = Math.max(viewportGap, anchorLeft - rect.width - 4);
            }
            if (top !== panel.top || left !== panel.left) {
                this.compactPanels[panelIndex] = { ...panel, top, left };
            }
        },
        handleCompactNodeClick(node, panelIndex, event) {
            if (node?.hasChildren) {
                this.openCompactChild(node, panelIndex, event);
                return;
            }
            if (!node?.target) return;
            this.closeCompactMenu();
            if (isExternal(node.target)) {
                window.open(node.target, "_blank", "noopener,noreferrer");
                return;
            }
            if (this.$route?.fullPath === node.target || this.$route?.path === node.target) return;
            this.$router.push(node.target).catch(() => {});
        },
        isCompactNodeActive(node) {
            return Boolean(node?.target) && (this.$route?.fullPath === node.target || this.$route?.path === node.target);
        },
        scheduleCompactClose() {
            this.cancelCompactClose();
            this.compactCloseTimer = window.setTimeout(() => {
                this.compactPanels = [];
                this.compactRootKey = "";
                this.compactCloseTimer = null;
            }, 180);
        },
        cancelCompactClose() {
            if (this.compactCloseTimer) {
                window.clearTimeout(this.compactCloseTimer);
                this.compactCloseTimer = null;
            }
        },
        closeCompactMenu() {
            this.cancelCompactClose();
            this.compactPanels = [];
            this.compactRootKey = "";
        },
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
:deep(.sidebar-main-menu) {
    border-right: none;
    background: transparent !important;
    padding: 6px 0 10px;

    .el-sub-menu__title {
        height: 42px;
        line-height: 42px;
    }

    .el-menu-item,
    .el-sub-menu__title {
        position: relative;
        box-sizing: border-box;
        margin: 3px 8px;
        border: 1px solid transparent;
        border-bottom: 0 !important;
        border-radius: 10px;
        background: transparent !important;
        transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
        overflow: hidden;
        color: var(--sidebar-text-color, rgba(255, 255, 255, 0.9)) !important;

        &:hover {
            background: var(--sidebar-hover-bg, rgba(255, 255, 255, 0.12)) !important;
            border-color: color-mix(in srgb, var(--sidebar-text-color, #fff) 10%, transparent);
            transform: translateX(2px);
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
            border-color: color-mix(in srgb, var(--sidebar-active-text-color, var(--sidebar-text-color, #fff)) 18%, transparent);
            color: var(--sidebar-active-text-color, var(--sidebar-text-color, #ffffff)) !important;
            box-shadow: 0 6px 18px rgba(7, 18, 38, .08);
            font-weight: 600;

            &::before {
                content: '';
                position: absolute;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 3px;
                height: 48%;
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

    // Element Plus 默认把菜单层级换算为 20/40/60/80px 左内边距，
    // 同时每层 el-menu 还会继续缩窄内容盒。深层业务菜单因此只剩
    // 两三个汉字。层级缩进由 SidebarItem 的 CSS 变量统一控制，
    // 第三级以后封顶，保留树形辨识度但不继续吞噬文字宽度。
    &:not(.el-menu--collapse) {
        .el-menu-item,
        .el-sub-menu__title {
            padding-left: var(--mci-sidebar-menu-indent, 20px) !important;
        }

        .el-menu-item {
            padding-right: 12px !important;
        }

        .el-sub-menu__title {
            padding-right: 36px !important;
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
        border-bottom: 0 !important;
        box-shadow: none !important;

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
            padding: 2px 0 6px;
            border-radius: 0;
            border-bottom: 0 !important;
            background: transparent !important;
            box-shadow: none;

            .el-menu-item,
            .el-sub-menu__title {
                min-width: 0 !important;
                width: calc(100% - 16px);
                margin: 2px 8px;
                border-bottom: 0 !important;
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

</style>
