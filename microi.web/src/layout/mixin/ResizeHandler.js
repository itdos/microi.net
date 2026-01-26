import { useAppStore } from "@/pinia";

const { body } = document;
const WIDTH = 992; // refer to Bootstrap's responsive design

export default {
    watch: {
        $route(route) {
            const appStore = useAppStore();
            if (this.device === "mobile" && this.sidebar.opened) {
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
        const appStore = useAppStore();
        const isMobile = this.$_isMobile();
        if (isMobile) {
            appStore.toggleDevice("mobile");
            appStore.closeSideBar(true);
        }
    },
    methods: {
        // use $_ for mixins properties
        // https://vuejs.org/v2/style-guide/index.html#Private-property-names-essential
        $_isMobile() {
            const rect = body.getBoundingClientRect();
            return rect.width - 1 < WIDTH;
        },
        $_resizeHandler() {
            if (!document.hidden) {
                const appStore = useAppStore();
                const isMobile = this.$_isMobile();
                appStore.toggleDevice(isMobile ? "mobile" : "desktop");

                if (isMobile) {
                    appStore.closeSideBar(true);
                }
            }
        }
    }
};
