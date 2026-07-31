<template>
    <div
        v-if="item.Display !== 0 && !item.hidden"
        class="sidebar-menu-node"
        :data-menu-level="normalizedLevel"
        :data-compact-index="normalizedLevel === 0 && compactIndex >= 0 ? compactIndex : undefined"
        :style="menuLevelStyle"
    >
        <template v-if="hasOneShowingChild(item.children, item) && (!onlyOneChild.children || onlyOneChild.noShowingChildren) && !item.alwaysShow">
            <!-- :to="resolvePath(DiyCommon.IsNull(onlyOneChild.Link) ? onlyOneChild.path : onlyOneChild.Link)" -->
            <!-- :to="resolvePath(onlyOneChild.path)" -->
            <!-- @click="GotoLink(onlyOneChild.path)" -->
            <span>
                <app-link v-if="onlyOneChild.meta" :to="resolvePath(onlyOneChild)">
                    <el-menu-item :index="resolvePath(onlyOneChild)" :class="{ 'submenu-title-noDropdown-microi': !isNest }">
                        <item
                            :icon="onlyOneChild.meta.icon || (item.meta && item.meta.icon)"
                            :title="generateTitle(onlyOneChild.meta.title)"
                            :menu-id="onlyOneChild.meta.Id"
                            :badge-config="onlyOneChild.meta.MenuBadgeConfig"
                        />
                    </el-menu-item>
                </app-link>
            </span>
        </template>
        <el-sub-menu v-else ref="subMenu" :index="getItemPath(item)" popper-append-to-body>
            <template #title>
                <span class="submenu-title-link" @click="handleSubMenuTitleClick(item)">
                    <item
                        v-if="item.meta"
                        :icon="item.meta && item.meta.icon"
                        :title="generateTitle(item?.meta?.title)"
                        :menu-id="item.meta.Id"
                        :badge-config="item.meta.MenuBadgeConfig"
                    />
                </span>
            </template>
            <sidebar-item
                v-for="child in item.children?.filter((c) => c.Display !== 0)"
                :key="child.path"
                :is-nest="true"
                :level="normalizedLevel + 1"
                :item="child"
                :base-path="resolvePath(child)"
                class="nest-menu"
            />
        </el-sub-menu>
    </div>
</template>

<script>
import { useDiyStore, useAppStore } from "@/pinia";
import { computed } from "vue";
// Element Plus 组件已全局注册，无需本地导入
// 使用浏览器兼容的 path 工具
import path from "@/utils/path";
import { generateTitle } from "@/utils/i18n";
import { isExternal } from "@/utils/validate";
import Item from "./Item";
import AppLink from "./Link";
import FixiOSBug from "./FixiOSBug";

export default {
    name: "SidebarItem",
    components: { Item, AppLink },
    mixins: [FixiOSBug],
    props: {
        // route object
        item: {
            type: Object,
            required: true
        },
        isNest: {
            type: Boolean,
            default: false
        },
        basePath: {
            type: String,
            default: ""
        },
        level: {
            type: Number,
            default: 0
        },
        compactIndex: {
            type: Number,
            default: -1
        }
    },
    setup() {
        const diyStore = useDiyStore();
        const appStore = useAppStore();
        const SysConfig = computed(() => diyStore.SysConfig);
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);

        return {
            diyStore,
            appStore,
            SysConfig,
            GetCurrentUser
        };
    },
    data() {
        this.onlyOneChild = null;
        return {};
    },
    computed: {
        normalizedLevel() {
            const level = Number(this.level);
            return Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
        },
        menuLevelStyle() {
            // Element Plus 默认每层增加 20px，再叠加子菜单容器 padding。
            // 复杂业务菜单达到三级后文字区会被压缩到只剩约两个汉字。
            // 使用 10px 的紧凑层级节奏并在第三级封顶，既保留树形关系，
            // 也让更深层级继续拥有稳定的可读宽度。
            const indent = 20 + Math.min(this.normalizedLevel, 3) * 10;
            return {
                "--mci-sidebar-menu-indent": `${indent}px`
            };
        }
    },
    methods: {
        hasOneShowingChild(children = [], parent) {
            const showingChildren = children.filter((item) => {
                // 检查 Display 属性 (1 显示, 0 隐藏) 和 hidden 属性
                if (item.Display === 0 || item.hidden) {
                    return false;
                } else {
                    // Temp set(will be used if only has one showing child)
                    this.onlyOneChild = item;
                    return true;
                }
            });

            // When there is only one child router, the child router is displayed by default
            if (showingChildren.length === 1) {
                return true;
            }

            // Show parent if there are no child router to display
            if (showingChildren.length === 0) {
                this.onlyOneChild = {
                    ...parent,
                    path: "",
                    noShowingChildren: true
                };
                return true;
            }

            return false;
        },
        GotoLink(routePath) {
            if (routePath) {
                var path = routePath.toString();
                window.open();
            }
        },
        // 获取 item 的路径字符串（用于 el-sub-menu 的 index）
        getItemPath(item) {
            return item.path || "";
        },
        handleSubMenuTitleClick(item) {
            // 紧凑态不再让 Element Plus 递归折叠整棵菜单树；点击一级父菜单时
            // 先恢复完整侧栏，再由用户选择子项，避免隐藏菜单在窄栏中展开。
            if (this.normalizedLevel === 0 && !this.appStore.sidebar.opened) {
                this.appStore.toggleSideBar();
                return;
            }
            // A parent menu title is responsible for expanding/collapsing its children.
            // Do not route it to the first child, and keep compatibility with hosts that
            // inject the historical MenuClick hook without assuming that it exists.
            if (typeof this.MenuClick === "function") {
                this.MenuClick(item);
            }
            if (Array.isArray(item?.children) && item.children.some((child) => child?.Display !== 0)) {
                return;
            }
            const targetPath = this.resolvePath(item);
            if (!targetPath || this.$route?.path === targetPath || this.$route?.fullPath === targetPath) {
                return;
            }
            if (isExternal(targetPath)) {
                window.open(targetPath, "_blank", "noopener,noreferrer");
                return;
            }
            this.$router.push(targetPath).catch(() => {});
        },
        resolvePath(routeModel) {
            // 兼容传入字符串或对象
            var routePath = typeof routeModel === "string" ? routeModel : routeModel.path || "";
            // console.log('resolvePath', routeModel);
            if (!routePath) {
                return this.basePath;
            }
            if (routePath.indexOf("http") > -1) {
            }
            if (isExternal(routePath)) {
                var urlParam = typeof routeModel === "object" ? routeModel.UrlParam : "";
                return routePath + (urlParam ? "?" + urlParam : "");
            }
            if (isExternal(this.basePath)) {
                return this.basePath;
            }
            //by itdos.com  2022-03-31
            if (routePath.startsWith("/iframe")) {
                return routePath;
            }
            var result = "";
            var urlParam = typeof routeModel === "object" ? routeModel.UrlParam : "";
            if (routePath) {
                result = path.resolve(this.basePath, routePath + (urlParam ? "?" + urlParam : ""));
            } else {
                result = path.resolve(this.basePath, routePath);
            }
            return result;
        },

        generateTitle
    }
};
</script>

<style scoped>
.submenu-title-link {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
    width: auto;
    height: 100%;
}
</style>
