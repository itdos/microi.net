<template>
    <el-dropdown trigger="click" @command="handleSetSize">
        <div>
            <svg-icon class-name="size-icon" icon-class="size" />
        </div>
        <template #dropdown
            ><el-dropdown-menu>
                <el-dropdown-item v-for="item of sizeOptions" :key="item.value" :disabled="size === item.value" :command="item.value">
                    {{ item.label }}
                </el-dropdown-item>
            </el-dropdown-menu></template
        >
    </el-dropdown>
</template>

<script>
import { computed } from "vue";
import { useAppStore, useTagsViewStore } from "@/stores";

export default {
    setup() {
        const appStore = useAppStore();
        const tagsViewStore = useTagsViewStore();
        const size = computed(() => appStore.size);
        return { appStore, tagsViewStore, size };
    },
    data() {
        return {
            sizeOptions: [
                { label: "Default", value: "default" },
                { label: "Medium", value: "medium" },
                { label: "Small", value: "small" },
                { label: "Mini", value: "mini" }
            ]
        };
    },
    computed: {},
    // size 已迁移到 setup() 中
    methods: {
        handleSetSize(size) {
            this.$ELEMENT.size = size;
            this.appStore.setSize(size);
            this.refreshView();
            this.$message({
                message: "Switch Size Success",
                type: "success"
            });
        },
        refreshView() {
            // In order to make the cached page re-rendered
            this.tagsViewStore.delAllCachedViews();

            const { fullPath } = this.$route;

            this.$nextTick(() => {
                this.$router.replace({
                    path: "/redirect" + fullPath
                });
            });
        }
    }
};
</script>
