import { useAppStore, useDiyStore } from "@/pinia";

const { body } = document;
const WIDTH = 768; // 移动端断点：<=768px 为移动端

export default {
    watch: {
        $route(route) {
            const appStore = useAppStore();
            const diyStore = useDiyStore();
            // 仅在移动端模式下，路由切换时关闭侧边栏
            if (diyStore.IsPhoneView && this.sidebar.opened) {
                appStore.closeSideBar(false);
            }
        }
    },
    beforeMount() {
        window.addEventListener("resize", this.$_resizeHandler);
    },
    beforeUnmount() {
        window.removeEventListener("resize", this.$_resizeHandler);
    },
    mounted() {
        // 不在这里处理，由 App.vue 统一处理 IsPhoneView
    },
    methods: {
        $_isMobile() {
            return window.innerWidth <= WIDTH;
        },
        $_resizeHandler() {
            // resize 事件由 App.vue 处理 IsPhoneView
            // 这里不再做任何处理，避免与 App.vue 冲突
        }
    }
};
