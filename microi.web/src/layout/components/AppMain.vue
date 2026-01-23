<template>
    <section class="app-main-microi">
        <router-view v-slot="{ Component }">
            <transition name="fade-transform" mode="out-in">
                <keep-alive :include="cachedViews">
                    <component :is="Component" :key="key" />
                </keep-alive>
            </transition>
        </router-view>
        <section id="MicroiService"></section>
    </section>
</template>

<script>
import { useTagsViewStore } from "@/stores";
import { computed } from "vue";

export default {
    name: "AppMain",
    setup() {
        const tagsViewStore = useTagsViewStore();
        const cachedViews = computed(() => tagsViewStore.cachedViews);

        return {
            cachedViews
        };
    },
    computed: {
        key() {
            return this.$route.path;
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
</style>

<style lang="scss">
// fix css style bug in open el-dialog
.el-popup-parent--hidden {
    .fixed-header-microi {
        padding-right: 15px;
    }
}
</style>
