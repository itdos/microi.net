<template>
    <section :class="'app-main-microi' + (isPhoneView ? ' mobile-view' : '')" v-mci-loading:page="routeLoading">
        <header
            v-if="showMobileMicroAppHeader"
            class="micro-app-mobile-header"
            data-micro-app-mobile-header
        >
            <button
                class="micro-app-mobile-header__back"
                type="button"
                :aria-label="$t('Msg.Back')"
                :title="$t('Msg.Back')"
                @click="goBackFromMobileMicroApp"
            >
                <el-icon><ArrowLeft /></el-icon>
            </button>
            <div class="micro-app-mobile-header__title">
                <span>{{ $t("Msg.MicroService") }}</span>
                <strong>{{ mobileMicroAppTitle }}</strong>
            </div>
            <span class="micro-app-mobile-header__spacer" aria-hidden="true"></span>
        </header>
        <router-view v-slot="{ Component }">
            <!-- 路由内容不使用 out-in 淡出；异步路由加载期间保留旧页面，避免整页闪白。 -->
            <template v-if="$route.meta?.keepAlive === false">
                <component :is="Component" :key="key" />
            </template>
            <keep-alive v-else :include="isPhoneView ? undefined : cachedViews" :max="20">
                <component :is="Component" :key="key" />
            </keep-alive>
        </router-view>
        <MciRenderSourceBadge
            v-if="routeRenderSource === 'custom'"
            :type="routeRenderSource"
            placement="edge"
            :instance-key="$route.fullPath"
            dismissible
            :source-info="routeSourceInfo"
        />
        <section id="MicroiService"></section>
    </section>
</template>

<script>
import { useTagsViewStore, useDiyStore } from "@/pinia";
import { computed, watch } from "vue";
import { routeLoading } from "@/utils/mci-loading";
import MciRenderSourceBadge from "@/components/MciRenderSourceBadge/index.vue";
import { resolveRouteRenderSource } from "@/utils/framework-presentation.js";

export default {
    name: "AppMain",
    components: { MciRenderSourceBadge },
    setup() {
        const tagsViewStore = useTagsViewStore();
        const diyStore = useDiyStore();
        const cachedViews = computed(() => tagsViewStore.cachedViews);
        const isPhoneView = computed(() => diyStore.IsPhoneView);

        return {
            cachedViews,
            diyStore,
            isPhoneView,
            routeLoading,
            tagsViewStore
        };
    },
    computed: {
        showMobileMicroAppHeader() {
            return this.isPhoneView
                && this.diyStore.IsMiniProgram !== true
                && this.$route.meta?.microAppHost === true;
        },
        mobileMicroAppTitle() {
            const fallback = this.$t("Msg.MicroService");
            const title = String(this.$route.meta?.title || "").trim();
            if (title && title !== fallback) return title;
            const appKey = String(this.$route.params?.appKey || "").trim();
            if (!appKey) return fallback;
            try {
                return decodeURIComponent(appKey);
            } catch (_) {
                return appKey;
            }
        },
        routeRenderSource() {
            return resolveRouteRenderSource(this.$route.meta || {});
        },
        routeSourceInfo() {
            const meta = this.$route.meta || {};
            return {
                title: meta.title || "",
                componentName: meta.ComponentName || "",
                componentPath: meta.ComponentPath || "",
                frameworkRoute: this.$route.fullPath || this.$route.path || ""
            };
        },
        key() {
            // A micro-app host snapshots one exact top-level tab route. Query
            // changes therefore create a new host and cannot mutate a host that
            // Vue is removing while micro-app moves its child into native cache.
            return this.$route.meta?.microAppHost === true
                ? this.$route.fullPath
                : this.$route.path;
        }
    },
    watch: {
        // 监听路由变化，移动端也添加到缓存
        $route: {
            handler(route) {
                // 移动端路由也需要添加到缓存中
                if (this.isPhoneView && route.name && route.meta?.keepAlive !== false) {
                    this.tagsViewStore.addView(route);
                }
            },
            immediate: true
        }
    },
    methods: {
        goBackFromMobileMicroApp() {
            if (window.history.state?.back) {
                this.$router.back();
                return;
            }
            this.$router.push("/mobile/workspace");
        }
    },
    async mounted() {
        var self = this;
    }
};
</script>

<style lang="scss" scoped>
.app-main-microi {
    /* 50= navbar  50  */
    min-height: calc(100vh - 50px);
    width: 100%;
    position: relative;
    overflow: hidden;
}

.micro-app-mobile-header {
    position: relative;
    z-index: 40;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    width: 100%;
    height: calc(56px + var(--status-bar-height, var(--mci-safe-top, 0px)));
    min-height: 56px;
    padding: var(--status-bar-height, var(--mci-safe-top, 0px)) 10px 0;
    border-bottom: 1px solid var(--mci-border-color, var(--el-border-color-lighter, #edf3f5));
    box-sizing: border-box;
    color: var(--mci-text-primary, var(--el-text-color-primary, #0f172a));
    background: var(--mci-bg-card, var(--el-bg-color, #fff));
    background-image: linear-gradient(135deg, var(--mci-color-primary-soft, #eef5ff), transparent 72%);
    box-shadow: var(--mci-shadow-sm, 0 2px 8px rgba(15, 23, 42, 0.06));
}

.micro-app-mobile-header__back {
    display: inline-flex;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 50%;
    padding: 0;
    color: var(--mci-text-primary, var(--el-text-color-primary, #0f172a));
    background: transparent;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}

.micro-app-mobile-header__back:active {
    background: var(--mci-bg-soft, var(--el-fill-color-light, #f1f5f9));
}

.micro-app-mobile-header__back:focus-visible {
    outline: 2px solid var(--mci-color-primary, var(--el-color-primary, #409eff));
    outline-offset: -2px;
}

.micro-app-mobile-header__back .el-icon {
    font-size: 22px;
}

.micro-app-mobile-header__title {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    text-align: center;
}

.micro-app-mobile-header__title span {
    color: var(--mci-color-primary, var(--el-color-primary, #409eff));
    font-size: 10px;
    font-weight: 650;
    line-height: 1.15;
    letter-spacing: .08em;
}

.micro-app-mobile-header__title strong {
    display: block;
    max-width: 100%;
    overflow: hidden;
    font-size: 17px;
    font-weight: 700;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.micro-app-mobile-header__spacer {
    display: block;
    width: 44px;
    height: 44px;
}

.fixed-header-microi + .app-main-microi {
    padding-top: 50px;
}

.hasTagsView {
    .app-main-microi {
        /* 84 = navbar + tags-view = 50 + 34 */
        min-height: calc(100vh - 84px);
    }

    .fixed-header-microi + .app-main-microi {
        padding-top: 84px;
    }
}

// 移动端样式
.mobile-view {
    .app-main-microi {
        min-height: 100vh;
        padding-top: 0;
        padding-bottom: 60px; // 为底部导航栏留出空间
        overflow: visible; // 允许内容撑开文档高度，使 window scroll 可用（移动端卡片列表滚动依赖此）
    }
}
</style>

<style lang="scss">
// fix css style bug in open el-dialog
.el-popup-parent--hidden {
    .fixed-header-microi {
        padding-right: 15px;
    }
}
</style>
