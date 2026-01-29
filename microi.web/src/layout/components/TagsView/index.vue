<template>
    <div id="tags-view-container-microi" class="tags-view-container-microi" :style="GetTagsViewContainerMicroiStyle()">
        <el-tabs class="parent-tabs" v-model="activeTab" closable @tab-remove="removeTab" @tab-click="handleTabClick">
            <el-tab-pane v-for="(tab, index) in visitedViews" :key="tab.fullPath + index" :name="tab.fullPath">
                <template #label>
                    <item v-if="tab.meta" :icon="tab.meta && tab.meta.icon" :title="generateTitle(tab.meta.title === undefined || tab.meta.title === '' ? tab.title : tab.meta.title)" @contextmenu.prevent="openMenu(tab, $event)" />
                </template>
            </el-tab-pane>
        </el-tabs>

        <!-- 🔥 使用 keep-alive 保持所有页面状态 -->
        <router-view v-slot="{ Component }">
            <keep-alive :max="5">
                <component 
                    v-if="Component" 
                    :is="Component" 
                    :key="$route.fullPath" 
                />
            </keep-alive>
        </router-view>

        <ul v-show="visible" :style="{ left: left + 'px', top: top + 'px' }" class="contextmenu">
            <li @click="refreshSelectedTag(selectedTag)">
                <el-icon><Refresh /></el-icon> {{ $t("tagsView.refresh") }}
            </li>
            <li v-if="!isAffix(selectedTag)" @click="closeSelectedTag(selectedTag)">
                <el-icon><Close /></el-icon> {{ $t("tagsView.close") }}
            </li>
            <li @click="closeOthersTags">
                <el-icon><CircleClose /></el-icon> {{ $t("tagsView.closeOthers") }}
            </li>
            <!-- <li @click="closeAllTags(selectedTag)"><el-icon><CircleCloseFilled /></el-icon> {{ $t('tagsView.closeAll') }}</li> -->
        </ul>
    </div>
</template>

<style lang="scss" scoped>
// TagsView 现代化样式
#tags-view-container-microi {
    :deep(.parent-tabs) {
        .el-tabs__header {
            margin: 0;
            background: transparent;
            // border-bottom: 2px solid #e4e7ed;
            padding: 0;
        }

        .el-tabs__nav {
            display: flex;
            gap: 6px;
            border: none;
        }

        .el-tabs__item {
            position: relative;
            padding: 6px 0px;
            // border: 1px solid #e4e7ed;
            border-bottom: none;
            border-radius: 4px 4px 0 0;
            font-weight: 400;
            font-size: 13px;
            color: #606266;
            transition: all 0.2s ease;
            // background: #f5f7fa;
            margin: 0;
            height: auto;
            line-height: normal;

            &:hover {
                color: var(--color-primary, #409eff);
                background: color-mix(in srgb, var(--color-primary, #409eff) 8%, white);
            }

            &.is-active {
                color: var(--color-primary-text, #ffffff) !important;
                background: linear-gradient(135deg, var(--color-primary, #409eff) 0%, color-mix(in srgb, var(--color-primary, #409eff) 85%, white) 100%) !important;
                border-color: var(--color-primary, #409eff) !important;
                border-bottom-color: transparent !important;
                z-index: 1;
                // font-weight: 500;
                box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary, #409eff) 25%, transparent);

                &::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 50%;
                    background: linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, transparent 100%);
                    border-radius: 4px 4px 0 0;
                    pointer-events: none;
                }

                i {
                    color: var(--color-primary-text, #ffffff) !important;
                }

                span {
                    color: var(--color-primary-text, #ffffff) !important;
                }
            }

            .el-icon {
                margin-right: 4px;
                font-size: 14px;
                transition: transform 0.3s ease;
            }

            &:hover .el-icon {
                transform: scale(1.1);
            }
        }

        .el-tabs__nav-wrap::after {
            display: none;
        }

        .el-tabs__active-bar {
            display: none;
        }
    }

    // 右键菜单样式优化
    .contextmenu {
        position: fixed;
        background: #ffffff;
        border-radius: 8px;
        padding: 6px 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 3000;
        list-style: none;
        margin: 0;

        li {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            cursor: pointer;
            color: #606266;
            font-size: 14px;
            transition: all 0.2s ease;

            &:hover {
                background: color-mix(in srgb, var(--color-primary, #409eff) 10%, white);
                color: var(--color-primary, #409eff);
            }

            .el-icon {
                margin-right: 8px;
                font-size: 16px;
            }
        }
    }
}
</style>

<script>
import ScrollPane from "./ScrollPane";
import { generateTitle } from "@/utils/i18n";
// 使用浏览器兼容的 path 工具
import path from "@/utils/path";
import Item from "../Sidebar/Item"; // by itdos
import { useDiyStore, useTagsViewStore, usePermissionStore } from "@/pinia";
import { computed } from "vue";

import { AppMain } from "../../components";

export default {
    components: { ScrollPane, Item, AppMain },
    setup() {
        const diyStore = useDiyStore();
        const tagsViewStore = useTagsViewStore();
        const permissionStore = usePermissionStore();

        const SysConfig = computed(() => diyStore.SysConfig);
        const ShowClassicTop = computed(() => diyStore.ShowClassicTop);
        const visitedViews = computed(() => tagsViewStore.visitedViews);
        const cachedViews = computed(() => tagsViewStore.cachedViews);
        const routes = computed(() => permissionStore.routes);

        return {
            diyStore,
            tagsViewStore,
            permissionStore,
            SysConfig,
            ShowClassicTop,
            visitedViews,
            cachedViews,
            routes
        };
    },
    data() {
        return {
            visible: false,
            top: 0,
            left: 0,
            selectedTag: {},
            affixTags: [],
            tabs: [], //页签集合
            activeTab: "" //当前页签
        };
    },
    watch: {
        $route(newRoute) {
            this.addTags();
            this.moveToCurrentTag();
        },
        visible(value) {
            if (value) {
                document.body.addEventListener("click", this.closeMenu);
            } else {
                document.body.removeEventListener("click", this.closeMenu);
            }
        }
    },
    mounted() {
        this.activeTab = this.$route.fullPath;

        // 🔥 注释掉 initTags，不自动添加固定的首页标签
        // this.initTags();
        this.addTags();
    },
    methods: {
        removeTab(targetName) {
            let item = this.visitedViews.find((item) => item.fullPath === targetName);
            if (item) {
                this.closeSelectedTag(item);
            }

            // let tabs = this.tabs;
            // let activeName = this.activeTab;
            // if (activeName === targetName) {
            //   tabs.forEach((tab, index) => {
            //     if (tab.name === targetName) {
            //       const nextTab = tabs[index + 1] || tabs[index - 1];
            //       if (nextTab) {
            //         activeName = nextTab.name;
            //       }
            //     }
            //   });
            // }
            // this.activeTab = activeName;
            // this.tabs = tabs.filter((tab) => tab.name !== targetName);
            // this.$router.push({ name: activeName });
        },
        handleTabClick(tab) {
            // Bug修复：确保切换标签页时更新URL和activeTab
            const targetPath = tab.name || tab.paneName;
            if (targetPath && this.$route.fullPath !== targetPath) {
                this.$router.push({ path: targetPath }).catch(err => {
                    // 忽略重复导航错误
                    if (err.name !== 'NavigationDuplicated') {
                        console.error('路由跳转失败:', err);
                    }
                });
            }
            this.activeTab = targetPath;
        },
        generateTitle, // generateTitle by vue-i18n
        GetTagsViewContainerMicroiStyle() {
            var self = this;
            var result = {};
            if (self.SysConfig.TopWidthFull) {
                result["padding-left"] = "10px";
                result["padding-right"] = "10px";
            }
            return result;
        },
        isActive(route) {
            return route.fullPath === this.$route.fullPath;
        },
        isAffix(tag) {
            return tag && tag.meta && tag.meta.affix;
        },
        filterAffixTags(routes, basePath = "/") {
            let tags = [];
            routes.forEach((route) => {
                if (route.meta && route.meta.affix) {
                    const tagPath = path.resolve(basePath, route.path);
                    tags.push({
                        fullPath: tagPath,
                        path: tagPath,
                        name: route.name,
                        meta: { ...route.meta }
                    });
                }
                if (route.children) {
                    const tempTags = this.filterAffixTags(route.children, route.path);
                    if (tempTags.length >= 1) {
                        tags = [...tags, ...tempTags];
                    }
                }
            });
            return tags;
        },
        initTags() {
            const affixTags = (this.affixTags = this.filterAffixTags(this.routes));
            for (const tag of affixTags) {
                // Must have tag name
                if (tag.name) {
                    this.tagsViewStore.addVisitedView(tag);
                }
            }
        },
        addTags() {
            const { name } = this.$route;
            if (name) {
                this.tagsViewStore.addView(this.$route);
            }
            return false;
        },
        moveToCurrentTag() {
            this.$nextTick(() => {
                this.activeTab = this.$route.fullPath;
            });
            // const tags = this.$refs.tag;
            // this.$nextTick(() => {
            //   for (const tag of tags) {
            //     if (tag.to.path === this.$route.path) {
            //       this.$refs.scrollPane.moveToTarget(tag);
            //       // when query is different then update
            //       if (tag.to.fullPath !== this.$route.fullPath) {
            //         this.$store.dispatch("tagsView/updateVisitedView", this.$route);
            //       }
            //       break;
            //     }
            //   }
            // });
        },
        refreshSelectedTag(view) {
            // 🔥 刷新功能：触发全局事件通知组件刷新数据
            console.log('[TagsView] 刷新页面:', view.fullPath);
            
            // 如果要刷新的不是当前页面，先切换过去
            if (this.$route.fullPath !== view.fullPath) {
                this.$router.push(view.fullPath).then(() => {
                    // 切换后触发刷新事件
                    this.emitRefreshEvent();
                });
            } else {
                // 直接触发刷新事件
                this.emitRefreshEvent();
            }
        },
        emitRefreshEvent() {
            // 通过自定义事件触发刷新，传递 SysMenuId 精确匹配
            const sysMenuId = this.$route.meta?.Id || this.$route.meta?.id;
            const event = new CustomEvent('page-refresh', {
                detail: { 
                    sysMenuId: sysMenuId,
                    fullPath: this.$route.fullPath,
                    timestamp: Date.now() 
                }
            });
            window.dispatchEvent(event);
            console.log('[TagsView] 已触发 page-refresh 事件，SysMenuId:', sysMenuId, '路由:', this.$route.fullPath);
        },
        closeSelectedTag(view) {
            if (this.visitedViews.length == 1) {
                this.DiyCommon.Tips("已经是最后一个了！", false);
                return;
            }
            
            console.log('[TagsView] 关闭页面:', view.fullPath);
            
            // 🔥 关键修复：关闭时不强制销毁 keep-alive，避免影响其他标签页
            // 只从 store 中移除，依赖 keep-alive 的 max 属性自动淘汰缓存
            this.tagsViewStore.delView(view).then(({ visitedViews }) => {
                // 如果关闭的是当前页面，需要跳转到其他页面
                if (this.isActive(view)) {
                    this.$nextTick(() => {
                        this.toLastView(visitedViews, view);
                    });
                }
            });
        },
        closeOthersTags() {
            this.$router.push(this.selectedTag);
            this.tagsViewStore.delOthersViews(this.selectedTag).then(() => {
                this.moveToCurrentTag();
            });
        },
        closeAllTags(view) {
            this.tagsViewStore.delAllViews().then(({ visitedViews }) => {
                if (this.affixTags.some((tag) => tag.path === view.path)) {
                    return;
                }
                this.toLastView(visitedViews, view);
            });
        },
        toLastView(visitedViews, view) {
            const latestView = visitedViews.slice(-1)[0];
            if (latestView) {
                this.$router.push(latestView.fullPath);
            } else {
                // now the default is to redirect to the home page if there is no tags-view,
                // you can adjust it according to your needs.
                if (view.name === "Dashboard") {
                    // to reload home page
                    this.$router.replace({ path: "/redirect" + view.fullPath });
                } else {
                    //首页也可能不是/，可能是微服务
                    this.$router.push("/");
                }
            }
        },
        openMenu(tag, e) {
            //重新塑造tag
            let tempname = e.target.offsetParent?.id?.replace("tab-", "");
            tag = this.visitedViews.find((item) => item.fullPath === tempname);
            if (!tag) return;

            const menuMinWidth = 105;
            const menuHeight = 120; // 预估菜单高度
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // 计算水平位置
            let left = e.clientX + 15; // 15: margin right
            if (left + menuMinWidth > viewportWidth) {
                left = viewportWidth - menuMinWidth - 10;
            }

            // 计算垂直位置，使用 clientY 因为菜单是 fixed 定位
            let top = e.clientY;
            if (top + menuHeight > viewportHeight) {
                top = viewportHeight - menuHeight - 10;
            }

            this.left = left;
            this.top = top;
            this.visible = true;
            this.selectedTag = tag;
        },
        closeMenu() {
            this.visible = false;
        },
        handleScroll() {
            this.closeMenu();
        }
    }
};
</script>

<style lang="scss" scoped>
.tags-view-container-microi {
    height: 33px; //修改了值
    width: 100%;
    background: #fff;
    border: 0;
    box-shadow:
        0 1px 3px 0 rgba(0, 0, 0, 0.12),
        0 0 3px 0 rgba(0, 0, 0, 0.04);
    .tags-view-wrapper-microi {
        .tags-view-item-microi {
            display: inline-block;
            position: relative;
            cursor: pointer;
            height: 26px;
            line-height: 26px;
            border: 1px solid #d8dce5;
            color: #495060;
            background: #fff;
            padding: 0 8px;
            font-size: 12px;
            margin-left: 5px;
            margin-top: 4px;
            &:first-of-type {
                margin-left: 15px;
            }
            &:last-of-type {
                margin-right: 15px;
            }
            &.active {
                background-color: #42b983;
                color: #fff;
                border-color: #42b983;
                &::before {
                    content: "";
                    background: #fff;
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    position: relative;
                    margin-right: 2px;
                }
            }
        }
    }
    .contextmenu {
        margin: 0;
        background: #fff;
        z-index: 9;
        position: absolute;
        list-style-type: none;
        padding: 5px 0;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 400;
        color: #333;
        box-shadow: 2px 2px 3px 0 rgba(0, 0, 0, 0.3);
        li {
            margin: 0;
            padding: 7px 16px;
            cursor: pointer;
            &:hover {
                background: #eee;
            }
        }
    }
}

// 保留嵌套tabs样式（如diy-form内部的tabs）
.parent-tabs :deep(.el-tabs__content) {
    .el-tabs {
        .el-tabs__item {
            border-top-left-radius: 0px;
            border-top-right-radius: 0px;
        }
        .el-tabs__item.is-active {
            background-color: initial !important;
            color: var(--color-primary) !important;
        }
        .el-tabs__active-bar {
            background-color: var(--color-primary) !important;
        }
    }
}
</style>

<style lang="scss">
//reset element css of el-icon-close
.tags-view-wrapper-microi {
    .tags-view-item-microi {
        .el-icon-close {
            width: 16px;
            height: 16px;
            vertical-align: 2px;
            border-radius: 50%;
            text-align: center;
            transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
            transform-origin: 100% 50%;
            &:before {
                transform: scale(0.6);
                display: inline-block;
                vertical-align: -3px;
            }
            &:hover {
                background-color: #b4bccc;
                color: #fff;
            }
        }
    }
}

/* 添加 fade 过渡动画 */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
