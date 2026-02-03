<template>
    <div class="menu-bottom-bg" v-if="SysConfig && SysConfig.MenuBottomContent">
        <div class="container">
            <div class="row">
                <div class="col-md-24 item" v-html="MenuBottomContent"></div>
            </div>
        </div>
    </div>
</template>
<script>
import { computed } from "vue";
import { useDiyStore } from "@/pinia";

export default {
    name: "MenuBottom",
    setup() {
        const diyStore = useDiyStore();
        const OsClient = computed(() => diyStore.OsClient);
        const SysConfig = computed(() => diyStore.SysConfig);

        return {
            diyStore,
            OsClient,
            SysConfig
        };
    },
    computed: {
        MenuBottomContent() {
            var content = this.SysConfig?.MenuBottomContent || "";
            if (!content) {
                return "";
            }
            // 替换变量
            return content
                .replace(/\$OsVersion\$/g, this.$root?.OsVersion || "")
                .replace(/\{{ OsVersion }}/g, this.$root?.OsVersion || "")
                .replace(/\$CompanyName\$/g, this.SysConfig?.CompanyName || "")
                .replace(/\{{ CompanyName }}/g, this.SysConfig?.CompanyName || "")
                .replace(/\$SysTitle\$/g, this.SysConfig?.SysTitle || "")
                .replace(/\{{ SysTitle }}/g, this.SysConfig?.SysTitle || "");
        }
    }
};
</script>
<style lang="scss">
.menu-bottom-bg {
    opacity: 0.95;
    height: 90px;
    font-size: 13px !important;
    background-image: url(@/assets/img/menu-bottom-bg.svg);
    background-size: cover;
    padding-top: 30px;
    width: 100%;
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 1;
    .icon {
        width: 22px;
        height: 22px;
    }
    a {
        color: #ccc;
    }
    .item {
        text-align: center;
        line-height: 22px;
        color: #ccc;
    }
}
</style>
