<template>
    <div class="menu-bottom-bg" v-if="SysConfig && SysConfig.MenuBottomContent">
        <svg
            class="menu-bottom-wave"
            viewBox="0 0 240 162"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M240.1,13.8c0,49.4,0,98.7,0,148.3c-80,0-160.4-0.1-240.4-0.1c0.1-2,0.2-4,0.2-6c0-45.4-0.2-91.1-0.1-136.5 c0-1.9,0.2-3.8,0.4-6.2c2.3,1,4.5,2.1,5.9,2.8c23,12.1,47.5,15.1,72.7,10c19.5-3.9,38.7-9.5,57.9-14.8c22.8-6.2,45.6-12.6,69.6-9.3 C218.2,3.6,230.1,6.2,240.1,13.8z"
            />
        </svg>
        <div class="container">
            <div class="row">
                <div class="col-md-24 item" v-safe-html="MenuBottomContent"></div>
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
    height: 90px;
    font-size: 13px !important;
    background: transparent;
    padding-top: 30px;
    width: 100%;
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 1;
    overflow: hidden;
    isolation: isolate;

    .menu-bottom-wave {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        z-index: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;

        path {
            fill: var(--sidebar-footer-wave-bg, #324179);
            transition: fill 0.2s ease;
        }
    }

    .container {
        position: relative;
        z-index: 1;
    }

    .icon {
        width: 22px;
        height: 22px;
    }
    a {
        color: var(--sidebar-footer-text-color, #f8fafc) !important;
    }
    .item {
        text-align: center;
        line-height: 22px;
        color: var(--sidebar-footer-text-color, #f8fafc) !important;

        * {
            color: inherit !important;
        }

        svg,
        svg * {
            fill: currentColor !important;
        }
    }
}
</style>
