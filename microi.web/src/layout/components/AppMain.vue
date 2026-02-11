<template>
    <section :class="'app-main-microi' + (isPhoneView ? ' mobile-view' : '')">
        <router-view v-slot="{ Component }">
            <!-- 移动端不使用动画，PC端保留动画 -->
            <transition :name="isPhoneView ? '' : 'fade-transform'" mode="out-in">
                <!-- 🔥 支持通过 meta.keepAlive 控制是否缓存 -->
                <template v-if="$route.meta?.keepAlive === false">
                    <!-- 不缓存的页面，每次都重新创建 -->
                    <component :is="Component" :key="key" />
                </template>
                <keep-alive v-else :include="isPhoneView ? undefined : cachedViews" :max="20">
                    <component :is="Component" :key="key" />
                </keep-alive>
            </transition>
        </router-view>
        <section id="MicroiService"></section>
    </section>
</template>

<script>
import { useTagsViewStore, useDiyStore } from "@/pinia";
import { computed, watch } from "vue";

export default {
    name: "AppMain",
    setup() {
        const tagsViewStore = useTagsViewStore();
        const diyStore = useDiyStore();
        const cachedViews = computed(() => tagsViewStore.cachedViews);
        const isPhoneView = computed(() => diyStore.IsPhoneView);

        return {
            cachedViews,
            isPhoneView,
            tagsViewStore
        };
    },
    computed: {
        key() {
            return this.$route.path;
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
