<template>
    <div id="app-microi" :class="GetAppClass()">
        <router-view />
        <!-- v-drag -->
        <!-- <div class="diy-chat" v-show="DiyChatShow">
      <DiyChat ref="refDiyChat"></DiyChat>
    </div>
    <DiyFormDialog ref="refDiyFormDialog"></DiyFormDialog> -->
    </div>
</template>
<script setup>
import { onMounted, onBeforeUnmount, getCurrentInstance } from 'vue';
const diyStore = useDiyStore();
const instance = getCurrentInstance();
const { Microi } = instance.appContext.config.globalProperties;

const WindowResize = () => {
    var isPhoneView = window.innerWidth <= 768;
    diyStore.setState('IsPhoneView', isPhoneView);
};

onMounted(() => {
    window.addEventListener('resize', WindowResize);
});

// 组件卸载前清理事件监听器，防止内存泄露
onBeforeUnmount(() => {
    window.removeEventListener('resize', WindowResize);
});
</script>

<script>
import { computed } from "vue";
import { useDiyStore, useSettingsStore } from "@/pinia";
// import drag from '@/views/diy/utils/dos.common';
// import { DiyFormDialog, DiyChat } from "@/utils/microi.net.import";
export default {
    name: "App",
    components: {},
    setup() {
        const diyStore = useDiyStore();
        const settingsStore = useSettingsStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const CurrentTime = computed(() => diyStore.CurrentTime);
        const DesktopBg = computed(() => diyStore.DesktopBg);
        const LoginCover = computed(() => diyStore.LoginCover);
        const OsClient = computed(() => diyStore.OsClient);
        const Lang = computed(() => diyStore.Lang);
        const title = computed(() => settingsStore.title);
        const WebTitle = computed(() => diyStore.WebTitle);
        const SystemSubTitle = computed(() => diyStore.SystemSubTitle);
        const ClientCompany = computed(() => diyStore.ClientCompany);
        const ClientCompanyUrl = computed(() => diyStore.ClientCompanyUrl);
        const DiyChatShow = computed(() => diyStore.DiyChat.Show);
        const ShowClassicTop = computed(() => diyStore.ShowClassicTop);
        const ShowClassicLeft = computed(() => diyStore.ShowClassicLeft);
        return {
            diyStore,
            settingsStore,
            GetCurrentUser,
            CurrentTime,
            DesktopBg,
            LoginCover,
            OsClient,
            Lang,
            title,
            WebTitle,
            SystemSubTitle,
            ClientCompany,
            ClientCompanyUrl,
            DiyChatShow,
            ShowClassicTop,
            ShowClassicLeft
        };
    },
    data() {
        return {
            // 存储定时器引用，用于组件销毁时清理，防止内存泄漏
            timers: [],
            // plusready 事件处理函数引用
            plusreadyHandler: null
        };
    },
    watch: {},

    async mounted() {
        // console.log("-------> App.vue mounted");
        var self = this;

        if (window.plus) {
            self.PageInit();
        } else {
            // 保存事件处理函数引用，以便销毁时移除
            self.plusreadyHandler = function () {
                self.PageInit();
            };
            document.addEventListener("plusready", self.plusreadyHandler, false);
        }
        if (!self.DiyCommon.isClientApp) {
            self.PageInit();
        }
        self.$nextTick(function () {
            var timer = setInterval(function () {
                try {
                    self.$refs.refDiyChat.InitSignalROnEvent(timer);
                } catch (error) {}
            }, 1000);
            // 保存定时器引用
            self.timers.push(timer);
        });
    },
    beforeDestroy() {
        var self = this;
        // 清理所有定时器，防止内存泄漏
        self.timers.forEach(function (timer) {
            clearInterval(timer);
        });
        self.timers = [];
        // 移除 plusready 事件监听器
        if (self.plusreadyHandler) {
            document.removeEventListener("plusready", self.plusreadyHandler, false);
        }
    },
    methods: {
        GetAppClass: function () {
            var result = "";
            if (this.ShowClassicLeft == 0) {
                result += " ShowClassicLeft0 ";
            }
            if (this.ShowClassicTop == 0) {
                result += " ShowClassicTop0 ";
            }
            return result;
        },
        PageInit() {
            var self = this;
            self.GetCurrentUserApp();
            // 保存定时器引用，防止内存泄漏
            var refreshTokenTimer = window.setInterval(self.RefreshToken, 1000 * 60);
            self.timers.push(refreshTokenTimer);
        },
        GetCurrentUserApp() {
            var self = this;
            self.DiyCommon.Get(self.DiyApi.GetCurrentUser(), {}, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.diyStore.setCurrentUser(result.Data);
                }
            });
        },
        RefreshToken() {
            var self = this;
            var authorization = localStorage.getItem("Microi.Token");
            var expires = localStorage.getItem("Microi.Token.Expires");
            if (authorization && expires && new Date() >= new Date(expires)) {
                self.DiyCommon.Post(
                    "/api/SysUser/refreshToken",
                    {
                        authorization: authorization
                        // _ClientType : 'PC'//这里不再传入，因为authorization包含了ClientType --by anderson 2025-06-19
                    },
                    function (result) {}
                );
            }
        },
        SwitchDiyChatShow() {
            var self = this;
            self.diyStore.setDiyChatShow(!self.DiyChatShow);
            if (self.DiyChatShow) {
                // self.$websocket
                //   .invoke("SendLastContacts", {
                //     UserId: self.GetCurrentUser.Id,
                //     ContactUserId: "",
                //     OsClient: self.DiyCommon.GetOsClient()
                //   })
                //   .then((res) => {})
                //   .catch((err) => {
                //     console.log("获取最近联系人列表失败：", err);
                //   });
            }
        }
    }
};
</script>
