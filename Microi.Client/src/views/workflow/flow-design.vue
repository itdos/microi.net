<template>
    <div>
        <WorkFlowDesigner></WorkFlowDesigner>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore } from "@/pinia";
import "./css/index.css";
import WorkFlowDesigner from "./component/designer";
export default {
    name: "diy-flow-design",
    components: {
        WorkFlowDesigner
    },
    setup() {
        const diyStore = useDiyStore();
        const OsClient = computed(() => diyStore.OsClient);
        return {
            diyStore,
            OsClient
        };
    },
    watch: {},
    data() {
        return {};
    },
    mounted() {
        var self = this;
    },
    methods: {
        Test() {}
    }
};
</script>

<style lang="scss" scoped></style>
