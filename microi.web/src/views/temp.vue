<template>
    <div>temp</div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore } from "@/pinia";
export default {
    name: "temp",
    components: {},
    setup() {
        const diyStore = useDiyStore();
        const OsClient = computed(() => diyStore.OsClient);
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);

        return {
            diyStore,
            OsClient,
            GetCurrentUser
        };
    },
    computed: {},
    props: {
        test1: {
            type: String,
            default: ""
        },
        test2: {
            type: Object,
            default() {
                return {};
            }
        }
    },
    watch: {},
    data() {
        return {};
    },
    mounted() {
        var self = this;
    },
    methods: {}
};
</script>

<style lang="scss" scoped></style>
