import { computed } from "vue";
import { useAppStore } from "@/pinia";

export default {
    setup() {
        const appStore = useAppStore();
        const device = computed(() => appStore.device);
        return { appStore, device };
    },
    mounted() {
        this.fixBugIniOS();
    },
    methods: {
        fixBugIniOS() {
            const $subMenu = this.$refs.subMenu;
            if ($subMenu) {
                const handleMouseleave = $subMenu.handleMouseleave;
                $subMenu.handleMouseleave = (e) => {
                    if (this.device === "mobile") {
                        return;
                    }
                    handleMouseleave(e);
                };
            }
        }
    }
};
