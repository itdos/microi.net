<template>
    <div
        v-show="ShowClassicTop != 0"
        class="sidebar-logo-microi-container-microi"
        :class="{ collapse: collapse }"
        :style="{
            background: SysConfig.MenuBg == 'Custom' && SysConfig.LogoBgColor ? SysConfig.LogoBgColor : '#fff'
        }"
    >
        <transition name="sidebarLogoFade">
            <router-link v-if="collapse" key="collapse" class="sidebar-logo-microi-link" @click="GetSysLogoLink()" to="">
                <img class="sidebar-logo-microi" :style="{ height: GetSysLogoHeight() }" :src="GetSysLogo()" />
            </router-link>
            <router-link v-else key="expand" class="sidebar-logo-microi-link" @click="GetSysLogoLink()" to="">
                <img class="sidebar-logo-microi" :style="{ height: GetSysLogoHeight() }" :src="GetSysLogo()" />
                <h1
                    class="sidebar-title-microi"
                    v-if="IsDisplayShortTitle()"
                    :title="SysConfig.SysShortTitle"
                    :style="{
                        color: SysConfig.SysTitleColor ? SysConfig.SysTitleColor : '#000',
                        fontSize: SysConfig.SysTitleFontSize ? SysConfig.SysTitleFontSize + 'px' : '20px'
                    }"
                >
                    {{
                        !DiyCommon.IsNull(SysConfig.SysShortTitle)
                            ? truncateString(SysConfig.SysShortTitle, SysConfig.BiaotiJQ ? SysConfig.BiaotiJQ : 12)
                            : DiyCommon.IsNull(ShortTitle)
                              ? truncateString(WebTitle, SysConfig.BiaotiJQ ? SysConfig.BiaotiJQ : 12)
                              : truncateString(ShortTitle, SysConfig.BiaotiJQ ? SysConfig.BiaotiJQ : 12)
                    }}
                </h1>
            </router-link>
        </transition>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore, useSettingsStore } from "@/pinia";
export default {
    name: "SidebarLogo",
    props: {
        collapse: {
            type: Boolean,
            required: true
        }
    },
    setup() {
        const diyStore = useDiyStore();
        const settingsStore = useSettingsStore();

        const title = computed(() => settingsStore.title);
        const WebTitle = computed(() => diyStore.WebTitle);
        const ShortTitle = computed(() => diyStore.ShortTitle);
        const OsClient = computed(() => diyStore.OsClient);
        const ThemeClass = computed(() => diyStore.ThemeClass);
        const SysConfig = computed(() => diyStore.SysConfig);
        const ShowClassicTop = computed(() => diyStore.ShowClassicTop);

        return {
            diyStore,
            settingsStore,
            title,
            WebTitle,
            ShortTitle,
            OsClient,
            ThemeClass,
            SysConfig,
            ShowClassicTop
        };
    },
    computed: {},
    data() {
        return {
            //   title: '吾码 Microi 低代码平台',
            //   logo: 'https://wpimg.wallstcn.com/69a1c46c-eb1c-4b46-8bd4-e9e686ef5251.png'
        };
    },
    mounted() {},
    methods: {
        // ... 其他方法
        truncateString(str, maxLength) {
            if (str.length > maxLength) {
                return str.substring(0, maxLength - 3) + "...";
            }
            return str;
        },
        GetSysLogo() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysConfig.SysLogo)) {
                return self.DiyCommon.GetServerPath(self.SysConfig.SysLogo);
            }
            return self.DiyCommon.GetServerPath("/static/img/logo/itdos.svg");
        },
        GetSysLogoHeight() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysConfig.SysLogoHeight)) {
                return self.SysConfig.SysLogoHeight > 45 ? 45 : self.SysConfig.SysLogoHeight + "px";
            }
            return "40px";
        },
        IsDisplayShortTitle() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysConfig.SysLogoType)) {
                if (self.SysConfig.SysLogoType == "图形") {
                    return false;
                }
            }
            return true;
        },
        GetSysLogoLink() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysConfig.SysLogoLink)) {
                if (self.SysConfig.SysLogoLink.indexOf("http") > -1) {
                    window.open(self.SysConfig.SysLogoLink);
                    return;
                }
                self.$router.push(self.SysConfig.SysLogoLink);
                return;
            }
            self.$router.push("/");
        }
    }
};
</script>

<style lang="scss" scoped>
.sidebarLogoFade-enter-active {
    transition: opacity 1.5s;
}

.sidebarLogoFade-enter,
.sidebarLogoFade-leave-to {
    opacity: 0;
}

.sidebar-logo-microi-container-microi {
    position: relative;
    width: 100%;
    height: 63px;
    line-height: 63px;
    // background: #fff;
    text-align: center;
    overflow: hidden;

    & .sidebar-logo-microi-link {
        height: 100%;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: left; //2025-05-08 LOGO+系统标题靠左显示 --by Anderson
        padding: 0 20px;

        & .sidebar-logo-microi {
            width: 32px;
            height: 32px;
            vertical-align: middle;
            //margin-left: 40px;
        }

        & .sidebar-title-microi {
            display: inline-block;
            margin: 0;
            // color: #000;
            font-weight: 600;
            line-height: 25px;
            font-family:
                Avenir,
                Helvetica Neue,
                Arial,
                Helvetica,
                sans-serif;
            vertical-align: middle;
        }
    }

    &.collapse {
        .sidebar-logo-microi-link{
            padding: 0;
            justify-content: center;
        }
        .sidebar-logo-microi {
            margin-right: 0px;
            margin-left: 0;
        }
    }
}
</style>
