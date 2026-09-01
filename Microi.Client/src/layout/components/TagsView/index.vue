<template>
    <div id="tags-view-container-microi" class="tags-view-container-microi" :style="GetTagsViewContainerMicroiStyle()">
        <div class="tags-view-strip">
            <el-tabs class="parent-tabs mci-tabs mci-tabs--workspace" v-model="activeTab" closable @tab-remove="removeTab" @tab-click="handleTabClick">
                <!-- 🔥 使用 fullPath 作为唯一标识，确保每个标签都能正确保存完整的路由信息（包括查询参数） -->
                <el-tab-pane v-for="(tab, index) in visitedViews" :key="tab.fullPath" :name="tab.fullPath">
                    <template #label>
                        <item v-if="tab.meta" :icon="ResolveTabIcon(tab.meta && tab.meta.icon, index)" :title="generateTitle(tab.meta.title === undefined || tab.meta.title === '' ? tab.title : tab.meta.title)" @contextmenu.prevent="openMenu(tab, $event)" @dblclick="toggleFullScreenCurrentTab()" />
                    </template>
                </el-tab-pane>
            </el-tabs>

            <div class="tags-view-runtime-version" data-testid="runtime-version">
                {{ runtimeVersionText }}
            </div>
        </div>

        <!-- 🔥 使用 keep-alive 保持页面状态，支持通过 meta.keepAlive 配置是否缓存 -->
        <div class="mci-route-view-host" v-mci-loading:page="routeLoading">
            <router-view v-slot="{ Component }">
                <template v-if="$route.meta?.keepAlive === false">
                    <component
                        v-if="Component"
                        :is="Component"
                        :key="GetRouteViewKey($route)"
                    />
                </template>
                <keep-alive v-else :max="5">
                    <component
                        v-if="Component"
                        :is="Component"
                        :key="GetRouteViewKey($route)"
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
            <li v-if="canShowFormDesign(selectedTag)" @click="openFormDesign(selectedTag)">
                <el-icon><EditPen /></el-icon> {{ $t("Msg.FormDesign") }}
            </li>
            <li v-if="canShowModuleDesign(selectedTag)" @click="openModuleDesign(selectedTag)">
                <el-icon><QuestionFilled /></el-icon> {{ $t("Msg.ModuleDesign") }}
            </li>
            <li v-if="canShowWorkflowDesign(selectedTag)" @click="openWorkflowDesign(selectedTag)">
                <el-icon><Connection /></el-icon> {{ $t("Msg.WorkflowDesign") }}
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
    :deep(.parent-tabs.mci-tabs) {
        .el-tabs__header { margin: 0; }
        .el-tabs__nav { gap: 0; }
        .el-tabs__item {
            height: 28px;
            margin: 0;
            padding: 0 10px;
            border-radius: 0;
            font-size: 13px;
            font-weight: 500;
            line-height: 28px;

            i,
            span { color: inherit !important; }
        }
        .el-tabs__nav-wrap::after,
        .el-tabs__active-bar { display: block; }
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
            transition: color 0.2s ease, background-color 0.2s ease;

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
import { resolveTabIcon } from "@/utils/tab-icon.js";
import { getPageTabRouteViewKey } from "@/utils/page-tab-route-runtime.js";
import { apiServiceState } from "@/utils/api-service-status.js";
import { buildRuntimeVersionText } from "@/utils/runtime-version-text.js";
import {
    getBoundWorkflowDesignId,
    getWorkflowDesignPath
} from "@/utils/workflow-menu-binding.js";
import {
    getTabDiyTableId,
    getTabSysMenuId,
    hydrateTabFormDesignContext
} from "@/utils/tab-design-context.js";

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
        const runtimeVersionText = computed(() => buildRuntimeVersionText({
            backendVersion: apiServiceState.backendVersion,
            frontendVersion: apiServiceState.frontendVersion
        }));

        return {
            diyStore,
            tagsViewStore,
            permissionStore,
            SysConfig,
            ShowClassicTop,
            visitedViews,
            cachedViews,
            routeLoading,
            routes,
            runtimeVersionText
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
            formDesignMap: {},
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
        this._formDesignLookups = new Map();
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
        if (this._formDesignLookups) this._formDesignLookups.clear();
    },
    methods: {
        GetRouteViewKey(route) {
            return getPageTabRouteViewKey(route);
        },
        ResolveTabIcon(icon, index) {
            return resolveTabIcon(icon, index);
        },
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
            const extraMenuItems = Number(this.canShowFormDesign(tag))
                + Number(this.canShowModuleDesign(tag))
                + Number(this.canShowWorkflowDesign(tag))
                + Number(this.canShowPageEngineDesign(tag));
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
            this.warmupFormDesignContext(tag).catch((error) => {
                console.warn("[TagsView] form design context warmup failed:", error);
            });
        },
        isAdminUser() {
            const user = this.diyStore && this.diyStore.GetCurrentUser;
            if (!user) return false;
            const adminValue = String(user._IsAdmin ?? "").toLowerCase();
            const isAdmin = user._IsAdmin === true || Number(user._IsAdmin) === 1 || adminValue === "true";
            return isAdmin || Number(user.Level || 0) >= 9999;
        },
        getSysMenuIdFromTag(tag = {}) {
            return getTabSysMenuId(tag);
        },
        canShowModuleDesign(tag) {
            return this.isAdminUser() && !!this.getSysMenuIdFromTag(tag);
        },
        canShowWorkflowDesign(tag) {
            return this.isAdminUser() && !!getBoundWorkflowDesignId((tag && tag.meta) || {});
        },
        openWorkflowDesign(tag) {
            const workflowDesignPath = getWorkflowDesignPath((tag && tag.meta) || {});
            this.closeMenu();
            if (!workflowDesignPath) {
                this.DiyCommon.Tips(this.$t("Msg.WorkflowDesignNotBound"), false);
                return;
            }
            this.$router.push(workflowDesignPath);
        },
        getDiyTableIdFromTag(tag = {}) {
            return getTabDiyTableId(tag, this.formDesignMap);
        },
        canShowFormDesign(tag) {
            return this.isAdminUser() && !!this.getDiyTableIdFromTag(tag);
        },
        warmupFormDesignContext(tag = {}) {
            if (!this.isAdminUser()) return Promise.resolve("");
            const direct = this.getDiyTableIdFromTag(tag);
            if (direct) return Promise.resolve(direct);

            const sysMenuId = this.getSysMenuIdFromTag(tag);
            if (!sysMenuId) return Promise.resolve("");
            if (!this._formDesignLookups) this._formDesignLookups = new Map();
            if (this._formDesignLookups.has(sysMenuId)) return this._formDesignLookups.get(sysMenuId);

            const lookup = hydrateTabFormDesignContext(tag, this.formDesignMap, (menuId) => (
                this.DiyCommon.FormEngine.GetFormData("sys_menu", {
                    Id: menuId,
                    _SelectFields: ["Id", "DiyTableId", "DiyTableName"]
                })
            )).finally(() => {
                this._formDesignLookups.delete(sysMenuId);
            });
            this._formDesignLookups.set(sysMenuId, lookup);
            return lookup;
        },
        async openFormDesign(tag) {
            this.closeMenu();
            const diyTableId = this.getDiyTableIdFromTag(tag) || await this.warmupFormDesignContext(tag);
            if (!diyTableId) {
                this.DiyCommon.Tips("当前标签未绑定表单，无法打开表单设计！", false);
                return;
            }
            this.$router.push({
                path: `/diy/diy-design/${diyTableId}`,
                query: { PageType: "" }
            });
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
    --mci-shell-version-right: 18px;
    height: 36px;
    width: 100%;
    background: transparent;
    border: 0;
    box-shadow: none;

    .tags-view-strip {
        display: flex;
        align-items: stretch;
        width: 100%;
        height: 100%;
        min-width: 0;
        margin-bottom: 10px;
    }

    .parent-tabs {
        flex: 1 1 0;
        min-width: 0;
    }

    .tags-view-runtime-version {
        display: inline-flex;
        flex: 0 0 auto;
        align-self: center;
        align-items: center;
        height: 22px;
        margin: 0 var(--mci-shell-version-right) 0 var(--mci-space-3, 12px);
        padding: 0 var(--mci-space-2, 8px);
        box-sizing: border-box;
        border: 1px solid color-mix(
            in srgb,
            var(--mci-color-primary, var(--el-color-primary, #409eff)) 24%,
            transparent
        );
        border-radius: var(--mci-radius-full, 999px);
        background: color-mix(
            in srgb,
            var(--mci-color-primary, var(--el-color-primary, #409eff)) 10%,
            var(--mci-bg-elevated, var(--el-bg-color, #ffffff))
        );
        color: var(--mci-text-secondary, var(--el-text-color-secondary, #64648c));
        font-size: var(--mci-text-xs, 12px);
        // font-weight: var(--mci-font-medium, 500);
        font-variant-numeric: tabular-nums;
        line-height: 1;
        white-space: nowrap;
        transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
    }

    .tags-view-wrapper-microi {
        .tags-view-item-microi {
            display: inline-block;
            position: relative;
            cursor: pointer;
            height: 30px;
            line-height: 29px;
            border: 1px solid transparent;
            border-bottom: 0;
            border-radius: 9px 9px 2px 2px;
            color: var(--el-text-color-regular, #495060);
            background: transparent;
            padding: 0 10px;
            font-size: 12px;
            margin-left: 4px;
            margin-top: 6px;
            transition: color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
            &:first-of-type {
                margin-left: 15px;
            }
            &:last-of-type {
                margin-right: 15px;
            }
            &.active {
                background: color-mix(in srgb, var(--color-primary, #409eff) 10%, var(--el-bg-color-overlay, #fff));
                color: var(--color-primary, #409eff);
                border-color: color-mix(in srgb, var(--color-primary, #409eff) 16%, transparent);
                box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary, #409eff) 10%, transparent);
                &::before {
                    display: none;
                }
            }

            &:not(.active):hover {
                color: var(--el-text-color-primary, #303133);
                background: color-mix(in srgb, var(--el-fill-color-light, #f5f7fa) 72%, transparent);
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
    background: transparent;
}

// 仅保留经典嵌套 Tabs 的兼容外观，统一 mci-tabs 不再被旧下划线规则覆盖。
.parent-tabs :deep(.el-tabs__content) {
    .el-tabs:not(.mci-tabs) {
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
            transition: color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), background-color 0.3s cubic-bezier(0.645, 0.045, 0.355, 1), transform 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
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
