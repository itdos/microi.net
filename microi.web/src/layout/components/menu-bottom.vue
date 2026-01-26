<template>
    <div class="menu-bottom-bg" v-if="ShowMenuBottom()">
        <div class="container">
            <div class="row">
                <div class="col-md-24 item" id="MenuBottomContent"></div>
            </div>
        </div>
    </div>
</template>
<script>
import { computed } from "vue";
import { useDiyStore } from "@/pinia";
import { createApp, h, defineComponent } from "vue";
export default {
    name: "SidebarLogo",
    props: {
        // collapse: {
        //     type: Boolean,
        //     required: true,
        // },
    },
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
    computed: {},
    data() {
        return {
            mountedApp: null
        };
    },
    mounted() {
        var self = this;
        if (self.ShowMenuBottom()) {
            var html = self.SysConfig.MenuBottomContent;
            if (!html) {
                html = `<div class="col-md-12 item">
                            {{ OsVersion}}
                        </div>
                        <div class="col-md-12 item">
                            © ${this.SysConfig?.CompanyName || this.SysConfig?.SysTitle || ""}
                        </div>`;
            }
            // Vue 3: 使用 createApp 替代 Vue.extend
            const DynamicComponent = defineComponent({
                template: `<div style="width:100%">` + html + `</div>`,
                data() {
                    return {
                        OsVersion: self.$root.OsVersion,
                        CompanyName: self.SysConfig?.CompanyName || self.SysConfig?.SysTitle || "",
                        SysTitle: self.SysConfig?.SysTitle || ""
                    };
                },
                created() {
                    // this.getData()
                },
                methods: {}
            });
            // Vue 3: 使用 createApp 挂载组件
            const container = document.getElementById("MenuBottomContent");
            if (container) {
                self.mountedApp = createApp(DynamicComponent);
                self.mountedApp.mount(container);
            }
        }
    },
    beforeUnmount() {
        // Vue 3: 清理挂载的应用
        if (this.mountedApp) {
            this.mountedApp.unmount();
        }
    },

    methods: {
        ShowMenuBottom() {
            var self = this;
            if (!self.SysConfig.MenuBottomContent) {
                return false;
            }
            return true;
        }
    }
};
</script>
<style lang="scss">
.menu-bottom-bg {
    opacity: 0.95;
    height: 90px;
    font-size: 13px !important;
    background-image: url(../img/menu-bottom-bg.svg);
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
