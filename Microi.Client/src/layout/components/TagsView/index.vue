<template>
    <div id="tags-view-container-microi" class="tags-view-container-microi" :style="GetTagsViewContainerMicroiStyle()">
        <el-tabs class="parent-tabs" v-model="activeTab" closable @tab-remove="removeTab" @tab-click="handleTabClick">
            <!-- 🔥 使用 fullPath 作为唯一标识，确保每个标签都能正确保存完整的路由信息（包括查询参数） -->
            <el-tab-pane v-for="(tab, index) in visitedViews" :key="tab.fullPath" :name="tab.fullPath">
                <template #label>
                    <item v-if="tab.meta" :icon="tab.meta && tab.meta.icon" :title="generateTitle(tab.meta.title === undefined || tab.meta.title === '' ? tab.title : tab.meta.title)" @contextmenu.prevent="openMenu(tab, $event)" @dblclick="toggleFullScreenCurrentTab()" />
                </template>
            </el-tab-pane>
        </el-tabs>

        <!-- 🔥 使用 keep-alive 保持页面状态，支持通过 meta.keepAlive 配置是否缓存 -->
        <div class="mci-route-view-host" v-mci-loading:page="routeLoading">
            <router-view v-slot="{ Component }">
                <template v-if="$route.meta?.keepAlive === false">
                    <component
                        v-if="Component"
                        :is="Component"
                        :key="$route.fullPath"
                    />
                </template>
                <keep-alive v-else :max="5">
                    <component
                        v-if="Component"
                        :is="Component"
                        :key="$route.fullPath"
                    />
                </keep-alive>
            </router-view>
        </div>

        <!-- 全屏提示 -->
        <transition name="fade">
            <div v-if="fullscreenTipVisible" class="fullscreen-tip">
                按 <kbd>ESC</kbd> 退出全屏 · 按 <kbd>Alt</kbd> + <kbd>Enter</kbd> 进入全屏
            </div>
        </transition>

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
            <li @click="toggleFullScreen(selectedTag)">
                <el-icon><FullScreen /></el-icon> {{ $t("tagsView.fullScreen") }}
            </li>
            <li v-if="canShowModuleDesign(selectedTag)" @click="openModuleDesign(selectedTag)">
                <el-icon><QuestionFilled /></el-icon> {{ $t("Msg.ModuleDesign") }}
            </li>
            <li v-if="canShowPageEngineDesign(selectedTag)" @click="openPageEngineDesign(selectedTag)">
                <el-icon><EditPen /></el-icon> 界面设计
            </li>
            <!-- <li @click="closeAllTags(selectedTag)"><el-icon><CircleCloseFilled /></el-icon> {{ $t('tagsView.closeAll') }}</li> -->
        </ul>
        <DiyFormFull v-if="showModuleDesignDialog" ref="refTagsViewMenuDesignDialog" />
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
            padding: 4px 5px;
            // border: 1px solid #e4e7ed;
            border-bottom: none;
            border-radius: 20px;
            font-weight: 400;
            font-size: 13px;
            color: var(--el-text-color-regular, #606266);
            transition: all 0.2s ease;
            // background: #f5f7fa;
            margin: 0;
            height: auto;
            line-height: normal;

            &:hover {
                color: var(--color-primary, #409eff);
                background: var(--color-primary-08);
            }

            &.is-active {
                color: var(--color-primary-text, #ffffff) !important;
                background: var(--color-primary, #409eff);
                border-color: var(--color-primary, #409eff) !important;
                border-bottom-color: transparent !important;
                z-index: 1;
                // font-weight: 500;
                box-shadow: 0 2px 8px var(--color-primary-25);

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
                font-size: 13px;
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

    // 全屏提示样式
    .fullscreen-tip {
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 13px;
        z-index: 9999;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        kbd {
            display: inline-block;
            padding: 2px 6px;
            margin: 0 2px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
        }
    }

    // 右键菜单样式优化
    .contextmenu {
        position: fixed;
        background: var(--el-bg-color-overlay, #ffffff);
        border: 1px solid var(--el-border-color, #e2e8f0);
        border-radius: 8px;
        padding: 6px 0;
        box-shadow: var(--mci-shadow-dropdown, 0 4px 20px rgba(0, 0, 0, 0.15));
        z-index: 3000;
        list-style: none;
        margin: 0;

        li {
            display: flex;
            align-items: center;
            padding: 8px 16px;
            cursor: pointer;
            color: var(--el-text-color-regular, #606266);
            font-size: 13px;
            transition: all 0.2s ease;

            &:hover {
                background: var(--color-primary-10);
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
import { computed, defineAsyncComponent } from "vue";
import { routeLoading } from "@/utils/mci-loading";

import { AppMain } from "../../components";

export default {
    components: {
        ScrollPane,
        Item,
        AppMain,
        DiyFormFull: defineAsyncComponent(() => import("@/views/form-engine/diy-form-full.vue"))
    },
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
            routeLoading,
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
            activeTab: "", //当前页签
            fullscreenTipVisible: false,
            fullscreenTipTimer: null,
            showModuleDesignDialog: false,
            pageEngineDesignMap: {}
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

        // 从 sessionStorage 恢复全屏状态（仅当前标签页有效，新开tab不会全屏）
        var fsData = sessionStorage.getItem('microi_tab_fullscreen');
        if (fsData) {
            try {
                var before = JSON.parse(fsData);
                this.diyStore.setState("_beforeFullScreen", before);
                this.diyStore.setState("ShowClassicTop", 0);
                this.diyStore.setState("ShowClassicLeft", 0);
                this.diyStore.setState("IsTabFullScreen", true);
            } catch(e) {}
        } else if (this.diyStore.IsTabFullScreen) {
            // sessionStorage中没有全屏数据但Pinia状态却是全屏，说明是新tab，重置
            this.exitFullScreen();
        }

        // ESC 退出全屏 + Alt+Enter 进入全屏
        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this.diyStore.IsTabFullScreen) {
                e.preventDefault();
                e.stopImmediatePropagation();
                this.exitFullScreen();
                return;
            }
            if (e.altKey && e.key === 'Enter') {
                e.preventDefault();
                if (!this.diyStore.IsTabFullScreen) {
                    this.toggleFullScreenCurrentTab();
                }
            }
        };
        document.addEventListener('keydown', this._keyHandler);
        this._langRoutesHandler = () => {
            this.$nextTick(() => {
                this.refreshCurrentTagTitle();
            });
        };
        window.addEventListener("microi:lang-routes-reloaded", this._langRoutesHandler);
        this._pageEngineDesignHandler = (event) => {
            const detail = event && event.detail ? event.detail : {};
            if (!detail.routeFullPath || !detail.pageId) return;
            this.pageEngineDesignMap[detail.routeFullPath] = {
                pageId: detail.pageId,
                title: detail.title || "界面引擎"
            };
        };
        window.addEventListener("microi:page-engine-design-context", this._pageEngineDesignHandler);
    },
    beforeUnmount() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        if (this._langRoutesHandler) {
            window.removeEventListener("microi:lang-routes-reloaded", this._langRoutesHandler);
        }
        if (this._pageEngineDesignHandler) {
            window.removeEventListener("microi:page-engine-design-context", this._pageEngineDesignHandler);
        }
        if (this.fullscreenTipTimer) {
            clearTimeout(this.fullscreenTipTimer);
        }
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
            // 🔥 修复：使用 fullPath 确保保留所有查询参数
            const targetPath = tab.name || tab.paneName;
            if (targetPath && this.$route.fullPath !== targetPath) {
                // 直接使用 fullPath 跳转，保留所有参数
                this.$router.push(targetPath).catch(err => {
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
            // if (self.SysConfig.TopWidthFull) {
            //     result["padding-left"] = "10px";
            //     result["padding-right"] = "10px";
            // }
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
        refreshCurrentTagTitle() {
            try {
                var resolved = this.$router.resolve(this.$route.fullPath);
                var matched = resolved && resolved.matched && resolved.matched.length
                    ? resolved.matched[resolved.matched.length - 1]
                    : null;
                var meta = Object.assign({}, this.$route.meta || {}, matched && matched.meta || {});
                this.tagsViewStore.updateVisitedView(Object.assign({}, this.$route, {
                    meta: meta,
                    title: meta.title || this.$route.name || ""
                }));
                this.activeTab = this.$route.fullPath;
            } catch (error) {
                console.warn("[TagsView] refresh tag title failed:", error);
            }
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
            // console.log('[TagsView] 刷新页面:', view.fullPath);
            
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
        emitRefreshEvent(payload = {}) {
            // 通过自定义事件触发刷新，传递 SysMenuId 精确匹配
            const sysMenuId = payload.sysMenuId || this.$route.meta?.Id || this.$route.meta?.id;
            const event = new CustomEvent('page-refresh', {
                detail: { 
                    sysMenuId: sysMenuId,
                    fullPath: payload.fullPath || this.$route.fullPath,
                    timestamp: Date.now() 
                }
            });
            window.dispatchEvent(event);
            // console.log('[TagsView] 已触发 page-refresh 事件，SysMenuId:', sysMenuId, '路由:', this.$route.fullPath);
        },
        closeSelectedTag(view) {
            if (this.visitedViews.length == 1) {
                this.DiyCommon.Tips("已经是最后一个了！", false);
                return;
            }
            
            console.log('[TagsView] 关闭页面:', view.fullPath);
            
            // Store 会精确销毁该 fullPath 对应的 micro-app 原生缓存；
            // 普通 Vue 页面仍沿用自身 keep-alive 淘汰规则。
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
            const extraMenuItems = Number(this.canShowModuleDesign(tag)) + Number(this.canShowPageEngineDesign(tag));
            const menuHeight = 155 + extraMenuItems * 40; // 预估菜单高度
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
        isAdminUser() {
            const user = this.diyStore && this.diyStore.GetCurrentUser;
            if (!user) return false;
            const adminValue = String(user._IsAdmin ?? "").toLowerCase();
            const isAdmin = user._IsAdmin === true || Number(user._IsAdmin) === 1 || adminValue === "true";
            return isAdmin || Number(user.Level || 0) >= 9999;
        },
        getSysMenuIdFromTag(tag = {}) {
            const meta = tag.meta || {};
            const query = tag.query || {};
            const params = tag.params || {};
            return meta.Id || meta.id || meta.SysMenuId || meta.sysMenuId || query.SysMenuId || query.Id || params.SysMenuId || params.Id || "";
        },
        canShowModuleDesign(tag) {
            return this.isAdminUser() && !!this.getSysMenuIdFromTag(tag);
        },
        getPageEngineIdFromTag(tag = {}) {
            const meta = tag.meta || {};
            const mapped = this.pageEngineDesignMap[tag.fullPath] || {};
            return meta.PageEngineId || mapped.pageId || "";
        },
        canShowPageEngineDesign(tag) {
            return this.isAdminUser() && !!this.getPageEngineIdFromTag(tag);
        },
        openPageEngineDesign(tag) {
            const pageId = this.getPageEngineIdFromTag(tag);
            this.closeMenu();
            if (!pageId) {
                this.DiyCommon.Tips("当前标签未绑定界面引擎，无法打开界面设计！", false);
                return;
            }
            this.$router.push({ path: "/mic/autopage", query: { Id: pageId } });
        },
        openModuleDesign(tag) {
            const sysMenuId = this.getSysMenuIdFromTag(tag);
            this.closeMenu();
            if (!sysMenuId) {
                this.DiyCommon.Tips("当前标签未绑定模块，无法打开模块设计！", false);
                return;
            }
            this.showModuleDesignDialog = true;
            let retryCount = 0;
            const maxRetries = 40;
            const tryOpen = () => {
                const dialog = this.$refs.refTagsViewMenuDesignDialog;
                if (dialog && dialog.Init) {
                    dialog.Init({
                        TableName: "sys_menu",
                        TableRowId: sysMenuId,
                        DialogType: "Dialog",
                        Height: "80vh",
                        FormMode: "Edit",
                        SubmitEvent: (formData, callback) => {
                            if (callback) callback();
                            this.emitRefreshEvent({
                                sysMenuId,
                                fullPath: tag.fullPath || this.$route.fullPath
                            });
                        }
                    });
                    return;
                }
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(tryOpen, 50);
                    return;
                }
                this.DiyCommon.Tips("模块设计表单加载失败，请稍后重试！", false);
            };
            this.$nextTick(tryOpen);
        },
        closeMenu() {
            this.visible = false;
        },
        toggleFullScreen(view) {
            // 先切换到该页签
            if (this.$route.fullPath !== view.fullPath) {
                this.$router.push(view.fullPath);
            }
            this.enterFullScreen();
        },
        toggleFullScreenCurrentTab() {
            if (this.diyStore.IsTabFullScreen) {
                this.exitFullScreen();
            } else {
                this.enterFullScreen();
            }
        },
        enterFullScreen() {
            // 保存当前状态到 sessionStorage（仅当前标签页有效，新开tab不会全屏）
            var before = {
                ShowClassicTop: this.diyStore.ShowClassicTop,
                ShowClassicLeft: this.diyStore.ShowClassicLeft
            };
            sessionStorage.setItem('microi_tab_fullscreen', JSON.stringify(before));
            this.diyStore.setState("_beforeFullScreen", before);
            // 隐藏顶部和左侧
            this.diyStore.setState("ShowClassicTop", 0);
            this.diyStore.setState("ShowClassicLeft", 0);
            this.diyStore.setState("IsTabFullScreen", true);
            // 显示全屏提示
            this.showFullscreenTip();
        },
        exitFullScreen() {
            const before = this.diyStore._beforeFullScreen;
            this.diyStore.setState("ShowClassicTop", before.ShowClassicTop);
            this.diyStore.setState("ShowClassicLeft", before.ShowClassicLeft);
            this.diyStore.setState("IsTabFullScreen", false);
            sessionStorage.removeItem('microi_tab_fullscreen');
        },
        showFullscreenTip() {
            this.fullscreenTipVisible = true;
            if (this.fullscreenTipTimer) {
                clearTimeout(this.fullscreenTipTimer);
            }
            this.fullscreenTipTimer = setTimeout(() => {
                this.fullscreenTipVisible = false;
            }, 5000);
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
    background: var(--el-bg-color, #fff);
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
            border: 1px solid var(--el-border-color, #d8dce5);
            color: var(--el-text-color-regular, #495060);
            background: var(--el-bg-color-overlay, #fff);
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
                background-color: var(--color-primary, #409eff);
                color: var(--mci-text-on-primary, #fff);
                border-color: var(--color-primary, #409eff);
                &::before {
                    content: "";
                    background: currentColor;
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
        background: var(--el-bg-color-overlay, #fff);
        z-index: 9;
        position: absolute;
        list-style-type: none;
        padding: 5px 0;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 400;
        color: var(--el-text-color-regular, #333);
        border: 1px solid var(--el-border-color, #e2e8f0);
        box-shadow: var(--mci-shadow-dropdown, 2px 2px 3px 0 rgba(0, 0, 0, 0.3));
        li {
            margin: 0;
            padding: 7px 16px;
            cursor: pointer;
            &:hover {
                background: var(--el-fill-color-light, #eee);
            }
        }
    }
}

.mci-route-view-host {
    position: relative;
    min-height: calc(100vh - 83px);
    background: var(--mci-bg-page, var(--el-bg-color-page, #f7f9fc));
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
                background-color: var(--el-fill-color-darker, #b4bccc);
                color: var(--el-text-color-primary, #fff);
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
