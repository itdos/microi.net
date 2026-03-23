<template>
    <div v-if="item.Display !== 0 && !item.hidden">
        <template v-if="hasOneShowingChild(item.children, item) && (!onlyOneChild.children || onlyOneChild.noShowingChildren) && !item.alwaysShow">
            <!-- :to="resolvePath(DiyCommon.IsNull(onlyOneChild.Link) ? onlyOneChild.path : onlyOneChild.Link)" -->
            <!-- :to="resolvePath(onlyOneChild.path)" -->
            <!-- @click="GotoLink(onlyOneChild.path)" -->
            <span @click="MenuClick(item)">
                <app-link v-if="onlyOneChild.meta" :to="resolvePath(onlyOneChild)">
                    <el-menu-item :index="resolvePath(onlyOneChild)" :class="{ 'submenu-title-noDropdown-microi': !isNest }">
                        <item :icon="onlyOneChild.meta.icon || (item.meta && item.meta.icon)" :title="generateTitle(onlyOneChild.meta.title)" />
                    </el-menu-item>
                </app-link>
            </span>
        </template>
        <el-sub-menu v-else ref="subMenu" :index="getItemPath(item)" popper-append-to-body>
            <template #title>
                <item v-if="item.meta" :icon="item.meta && item.meta.icon" :title="generateTitle(item?.meta?.title)" />
            </template>
            <sidebar-item
                v-for="child in item.children?.filter((c) => c.Display !== 0)"
                :key="child.path"
                :is-nest="true"
                :item="child"
                :base-path="resolvePath(child)"
                class="nest-menu"
            />
        </el-sub-menu>
    </div>
</template>

<script>
import { useDiyStore } from "@/pinia";
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
        }
    },
    setup() {
        const diyStore = useDiyStore();
        const SysConfig = computed(() => diyStore.SysConfig);
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);

        return {
            diyStore,
            SysConfig,
            GetCurrentUser
        };
    },
    data() {
        this.onlyOneChild = null;
        return {};
    },
    methods: {
        MenuClick(item) {
            var self = this;
            if (self.SysConfig.EnableUserClickLog) {
                self.DiyCommon.AddSysLog({
                    Type: `访问菜单`,
                    Title: `用户[${self.GetCurrentUser.Name}]访问菜单[${item?.meta?.title}]`,
                    Content: ""
                });
            }
        },
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
