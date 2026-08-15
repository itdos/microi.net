<template>
    <div class="navbar-microi" :style="GetNavbarMicroiStyle()" v-if="ShowClassicTop != 0">
        <hamburger id="hamburger-container-microi" :is-active="sidebar.opened" class="hamburger-container-microi" @toggleClick="toggleSideBar" />

        <breadcrumb id="breadcrumb-container" class="breadcrumb-container" />

        <div class="right-menu">
            <!-- 租户名称 -->
            <div v-if="GetCurrentUser.TenantName" class="right-menu-item tenant-name">
                {{ GetCurrentUser.TenantName }}
            </div>

            <!-- 聊天图标 -->
            <div v-if="ShowChat" class="right-menu-item hover-effect" @click="SwitchDiyChatShow()">
                <el-badge :value="$root.UnreadCount" :max="99" :hidden="$root.UnreadCount == 0 || !ShowUnreadCount"
                    style="display: flex;">
                    <el-icon class="menu-icon" :style="{ color: WebSocketOnline ? 'var(--mci-color-primary, #409eff)' : 'var(--el-text-color-regular)' }"><ChatDotRound /></el-icon>
                </el-badge>
            </div>

            <!-- 搜索 -->
            <BackgroundTaskCenter />

            <search id="header-search" class="right-menu-item hover-effect" />

            <lang-select class="right-menu-item hover-effect" />

            <ThemeSelect class="right-menu-item hover-effect" />

            <!-- PC AI助手：与移动端、小程序复用同一机器人和同一接口能力 -->
            <DesktopAiAssistant />

            <!-- 蓝牙打印机：PC 与平板共用全局连接状态 -->
            <BluetoothPrinterEntry />

            <!-- 切换界面风格 -->
            <el-dropdown v-if="hasWebOS" trigger="hover">
                <a class="wbtn right-menu-item hover-effect" title="切换界面风格" style="display:flex;align-items:center;cursor:pointer;">
                    <font-awesome-icon icon="fa-solid fa-display" style="color: var(--el-text-color-regular);font-size:18px;" />
                </a>
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item @click="switchStyle('Classic')">
                            <span style="display:flex;align-items:center;gap:8px;width:100%;">
                                <el-icon><Monitor /></el-icon>
                                <span style="flex:1;">经典传统</span>
                                <el-icon v-if="SystemStyle === 'Classic'" style="color:var(--el-color-primary);"><Check /></el-icon>
                            </span>
                        </el-dropdown-item>
                        <el-dropdown-item @click="switchStyle('macOS')">
                            <span style="display:flex;align-items:center;gap:8px;width:100%;">
                                <font-awesome-icon icon="fa-brands fa-apple" style="font-size:16px;width:16px;" />
                                <span style="flex:1;">macOS 风格</span>
                                <el-icon v-if="SystemStyle === 'macOS'" style="color:var(--el-color-primary);"><Check /></el-icon>
                            </span>
                        </el-dropdown-item>
                        <el-dropdown-item @click="switchStyle('Windows')">
                            <span style="display:flex;align-items:center;gap:8px;width:100%;">
                                <font-awesome-icon icon="fa-brands fa-windows" style="font-size:16px;width:16px;" />
                                <span style="flex:1;">Windows 风格</span>
                                <el-icon v-if="SystemStyle === 'Windows'" style="color:var(--el-color-primary);"><Check /></el-icon>
                            </span>
                        </el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown>

            <!-- 浏览器全屏 -->
            <div class="right-menu-item hover-effect" @click="toggleBrowserFullScreen" :title="isBrowserFullScreen ? '退出全屏' : '全屏'">
                <el-icon class="menu-icon"><FullScreen v-if="!isBrowserFullScreen" /><Close v-else /></el-icon>
            </div>

            <el-dropdown class="avatar-container right-menu-item hover-effect" trigger="hover">
                <div class="avatar-wrapper">
                    <span
                        v-if="CurrentUserAvatarLoading"
                        class="mci-avatar-skeleton user-avatar"
                        style="--mci-skeleton-size: 20px"
                        role="status"
                        aria-label="头像加载中"
                    ></span>
                    <img v-else :src="GetCurrentUserAvatar()" class="user-avatar" alt="" />
                    <span style="margin-left: 5px; font-size: 14px">
                        {{ GetCurrentUser.Name }}
                    </span>
                    <el-icon><CaretBottom /></el-icon>
                </div>
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item @click="OpenPersonalSettings">
                            <span style="display: block">
                                <el-icon><User /></el-icon>
                                {{ "个人中心" }}</span
                            >
                        </el-dropdown-item>
                        <!-- <el-dropdown-item v-if="hasWebOS" @click="GotoWebOSDesktop">
                            <span style="display: block">
                                <el-icon><Grid /></el-icon>
                                切换到桌面模式</span
                            >
                        </el-dropdown-item> -->
                        <el-dropdown-item divided @click="logout">
                            <span style="display: block">
                                <el-icon><Back /></el-icon>
                                {{ $t("navbar.logOut") }}</span
                            >
                        </el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown>
        </div>
        <!-- 遮罩层 -->
        <div v-show="DiyChatShow" @click="SwitchDiyChatShow" class="chat_overlay"></div>
        <div class="diy-chat" v-show="DiyChatShow">
            <DiyChat v-if="ShowChat && ChatType == '吾码IM'" ref="refDiyChat"></DiyChat>
            <iframe v-if="ShowChat && ChatType == '腾讯IM'" ref="myIframe" id="iframe" :src="src" frameborder="0" width="100%" height="100%" @load="onIframeLoad"></iframe> -->
        </div>
    </div>
</template>

<script>
import Breadcrumb from "@/components/Breadcrumb";
import Hamburger from "@/components/Hamburger";
import LangSelect from "@/components/LangSelect";
import Search from "@/components/HeaderSearch";
import ThemeSelect from "@/layout/components/ThemeSelect";
import BackgroundTaskCenter from "@/layout/components/BackgroundTaskCenter.vue";
import DesktopAiAssistant from "@/components/DesktopAiAssistant/index.vue";
import BluetoothPrinterEntry from "@/components/BluetoothPrinterEntry/index.vue";
import { useDiyStore, useAppStore, useUserStore } from "@/pinia";
import { computed } from "vue";
import { hasWebOS } from "@/utils/webos-detect.js";
// import { aw } from 'public/three/static/js/DRACOLoader-DSa8Sn_h';

export default {
    components: {
        Breadcrumb,
        Hamburger,
        LangSelect,
        Search,
        ThemeSelect,
        BackgroundTaskCenter,
        DesktopAiAssistant,
        BluetoothPrinterEntry
    },
    setup() {
        const diyStore = useDiyStore();
        const appStore = useAppStore();
        const userStore = useUserStore();

        const sidebar = computed(() => appStore.sidebar);
        const device = computed(() => appStore.device);
        const avatar = computed(() => userStore.avatar);
        const ThemeClass = computed(() => diyStore.ThemeClass);
        const ThemeBodyClass = computed(() => diyStore.ThemeBodyClass);
        const Lang = computed(() => diyStore.Lang);
        const WebTitle = computed(() => diyStore.WebTitle);
        const OsClient = computed(() => diyStore.OsClient);
        const SystemStyle = computed(() => diyStore.SystemStyle);
        const DiyChatShow = computed(() => diyStore.DiyChat?.Show);
        const ShowClassicTop = computed(() => diyStore.ShowClassicTop);
        const SysConfig = computed(() => diyStore.SysConfig);
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);

        return {
            diyStore,
            appStore,
            userStore,
            hasWebOS,
            sidebar,
            device,
            avatar,
            ThemeClass,
            ThemeBodyClass,
            Lang,
            WebTitle,
            OsClient,
            SystemStyle,
            DiyChatShow,
            ShowClassicTop,
            SysConfig,
            GetCurrentUser,
        };
    },
    data() {
        return {
            src: "/im/#/",
            myIframe: null,
            ShowChat: false,
            ChatType: "",
            ShowUnreadCount: true,
            CurrentUserAvatarUrl: "./static/img/icon/personal.png",
            CurrentUserAvatarLoading: false,
            isBrowserFullScreen: !!document.fullscreenElement
        };
    },
    computed: {
        WebSocketOnline: function () {
            return !(this.$websocket == null || this.$websocket.state != "Connected");
        },
        currentLang: function () {
            return this.SysConfig?.SysLang;
        }
    },
    watch: {
        "GetCurrentUser.Avatar": {
            immediate: true,
            handler() {
                this.LoadCurrentUserAvatar();
            }
        }
    },
    async mounted() {
        var self = this;

        setTimeout(function () {
            self.loadLang();
        }, 2000);

        // 保存定时器引用以便组件卸载时清理，防止内存泄漏
        self._blinkTimer = setInterval(function () {
            self.ShowUnreadCount = !self.ShowUnreadCount;
        }, 700);

        if (self.SysConfig) {
            if (self.SysConfig.EnableChat && self.SysConfig.EnableChat != "关闭") {
                self.ShowChat = true;
                if (self.SysConfig.EnableChat.length > 1) {
                    self.ChatType = self.SysConfig.EnableChat || "吾码IM";
                } else {
                    self.ChatType = "吾码IM";
                }
                self.$root.ChatType = self.ChatType;
            }
        }

        // 监听浏览器全屏状态变化
        this._fullscreenChangeHandler = () => {
            this.isBrowserFullScreen = !!document.fullscreenElement;
        };
        document.addEventListener('fullscreenchange', this._fullscreenChangeHandler);
    },
    beforeUnmount() {
        if (this._fullscreenChangeHandler) {
            document.removeEventListener('fullscreenchange', this._fullscreenChangeHandler);
        }
        // 清理未读计数闪烁定时器
        if (this._blinkTimer) {
            clearInterval(this._blinkTimer);
            this._blinkTimer = null;
        }
    },
    methods: {
        OpenPersonalSettings() {
            this.$router.push("/micro-app/microi-platform-service/personal-settings").catch(() => {});
        },
        toggleBrowserFullScreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        },
        loadLang() {
            //兼容旧版本语言配置

            if (this.currentLang && this.currentLang != "en" && this.currentLang != "zh-CN" && this.currentLang != "none" && typeof window.translate !== "undefined") {
                let lang = translate.language.getCurrent();
                if (lang != this.currentLang) {
                    translate.changeLanguage(this.currentLang);
                }
            }
        },
        async loadUserSig(sdkAppid, secretKey, expire) {
            let self = this;
            // let result = await request({
            //     url: `${self.DiyCommon.GetApiBase()}/api/Im/GetUserSig`,
            //     method: "get",
            //     params: {
            //         userId: self.GetCurrentUser?.Account,
            //         sdkAppid: sdkAppid,
            //         secretKey: secretKey,
            //         expire: expire
            //     }
            // });
            // if (result.status == 200) {
            //     return result.data;
            // }
            // return null;
        },
        async onIframeLoad() {
            let self = this;
            console.log("腾讯即时通信IM Iframe 已加载完成", self.SysConfig);

            let sdkAppid = self.SysConfig?.IMSdkAppid; //应用id
            let secretKey = self.SysConfig?.IMSecretKey; //应用密钥
            let expire = 604800; //过期时间
            if (!sdkAppid || !secretKey) return;
            let userSig = await self.loadUserSig(sdkAppid, secretKey, expire);

            //模拟数据库数据
            let demoObj = {
                SDKAppID: self.SysConfig?.IMSdkAppid, //应用id
                userID: self.GetCurrentUser?.Account, //用户id
                userSig: userSig //用户签名
            };
            if (demoObj.userSig && self.ShowChat) {
                const iframe = self.$refs.myIframe;
                // 要发送的数据
                const dataToSend = {
                    iframeFormData: JSON.stringify(demoObj)
                };
                // 安全修复：限定同源发送，避免 userSig 被任意第三方 origin 拦截
                try {
                    var iframeOrigin = window.location.origin;
                    try {
                        if (iframe && iframe.src) {
                            iframeOrigin = new URL(iframe.src, window.location.href).origin;
                        }
                    } catch (_) { /* fallback to current origin */ }
                    iframe.contentWindow.postMessage(dataToSend, iframeOrigin);
                } catch (e) {
                    console.warn('[Navbar] IM iframe postMessage 失败：', e && e.message);
                }
            }
        },
        GetNavbarMicroiStyle() {
            var self = this;
            var result = {};
            // if (self.SysConfig.TopWidthFull) {
            //     result["padding-left"] = "10px";
            //     result["padding-right"] = "10px";
            // }
            return result;
        },
        SwitchDiyChatShow() {
            var self = this;
            
            // 切换聊天显示状态
            self.diyStore.setState("DiyChat", { ...self.diyStore.DiyChat, Show: !self.DiyChatShow });
            
            if (self.DiyChatShow && self.ChatType == "吾码IM") {
                // 检查WebSocket连接状态
                const globalWs = window.__VUE_APP__?.config?.globalProperties?.$websocket;
                const wsConnected = globalWs?.state === 'Connected';
                
                console.log('[聊天图标] WebSocket状态:', {
                    存在: !!globalWs,
                    状态: globalWs?.state,
                    已连接: wsConnected
                });
                
                // 如果未连接，尝试重连（强制重试模式）
                if (!wsConnected) {
                    console.log('[聊天图标] WebSocket未连接，尝试重连...');
                    if (typeof window.tryConnectWebSocket === 'function') {
                        const result = window.tryConnectWebSocket(true);  // forceRetry=true
                        console.log('[聊天图标] 重连结果:', result);
                        
                        if (!result.success) {
                            self.$message?.warning(`聊天服务连接失败: ${result.reason}`);
                        }
                    }
                }
                
                // 如果已连接，获取最近联系人列表
                if (globalWs?.state === 'Connected' && globalWs.invoke) {
                    globalWs.invoke("SendLastContacts", {
                            UserId: self.GetCurrentUser.Id,
                            ContactUserId: "",
                            OsClient: self.DiyCommon.GetOsClient()
                        })
                        .then((res) => {
                            console.log('[聊天图标] 获取最近联系人成功');
                        })
                        .catch((err) => {
                            console.error('获取最近联系人列表失败：', err);
                        });
                } else if (globalWs?.state !== 'Connected') {
                    console.warn('[聊天图标] WebSocket未就绪，稍后再试...');
                }
            }
        },
        GetCurrentUserAvatar() {
            return this.CurrentUserAvatarUrl || "./static/img/icon/personal.png";
        },
        async LoadCurrentUserAvatar() {
            var self = this;
            var user = self.GetCurrentUser || {};
            if (self.DiyCommon.IsNull(user.Avatar)) {
                self.CurrentUserAvatarUrl = "./static/img/icon/personal.png";
                self.CurrentUserAvatarLoading = false;
                return;
            }
            var avatar = user.Avatar;
            var userId = user.Id;
            self.CurrentUserAvatarLoading = true;
            try {
                var url = await self.DiyCommon.GetUserAvatarUrl(avatar, userId);
                if (self.GetCurrentUser?.Avatar === avatar && self.GetCurrentUser?.Id === userId) {
                    self.CurrentUserAvatarUrl = url || "./static/img/icon/personal.png";
                }
            } catch (error) {
                console.warn("加载当前用户头像失败：", error);
                self.CurrentUserAvatarUrl = "./static/img/icon/personal.png";
            } finally {
                if (self.GetCurrentUser?.Avatar === avatar && self.GetCurrentUser?.Id === userId) {
                    self.CurrentUserAvatarLoading = false;
                }
            }
        },
        GotoDesktop() {
            this.diyStore.setState("ShowGotoWebOS", true);
        },
        switchStyle(style) {
            const current = this.diyStore.SystemStyle;
            if (current === style) return;
            this.diyStore.setState('SystemStyle', style);
            if (style === 'macOS' || style === 'Windows') {
                // 切换到 WebOS 桌面
                this.$router.push('/os');
            } else {
                // 切换到经典传统界面（如果当前在 /os 则跳回首页）
                if (this.$route.path === '/os') {
                    this.$router.push('/');
                }
            }
        },
        GotoWebOSDesktop() {
            this.switchStyle('macOS');
        },
        toggleSideBar() {
            this.appStore.toggleSideBar();
        },
        async logout() {
            var self = this;
            self.DiyCommon.OsConfirm("确认退出登录？", async function () {
                await self.userStore.logout();
                // 退出登录   -- by  itdos
                // self.DiyCommon.LogoutLogic();
                // self.DiyCommon.Authorization = "";
                // self.SetLoginCover({
                //     Data: true
                // });
                $("#divLogin").css({
                    top: "0%"
                });

                // self.DiyCommon.Post(self.DiyApi.Logout, {}, function(result) {})
                // self.DiyCommon.Tips(self.$t('Msg.LogoutSuccess'));
                // self.CloseMenuStart();

                // 设置用户身份之前销毁桌面视频
                // self.DiyCommon.DisposeVideoDesktop();
                // self.SetCurrentUser({});
                self.diyStore.setCurrentUser({});

                // //然后调用登录页面视频
                // self.$nextTick(function(){
                //     self.DiyCommon.LoadVideoLogin();
                // });

                self.$router.push(`/login?redirect=${self.$route.fullPath}`);
            });
        }
    }
};
</script>

<style lang="scss" scoped>
.navbar-microi {
    height: 50px;
    position: relative;
    background: var(--el-bg-color, #fff);
    color: var(--el-text-color-regular, #334155);
    border-bottom: 1px solid var(--el-border-color, #e2e8f0);
    box-shadow: var(--mci-shadow-card, 0 1px 4px rgba(0, 21, 41, 0.08));
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: nowrap;

    .hamburger-container-microi {
        display: flex;
        align-items: center;
        height: 100%;
        cursor: pointer;
        transition: background 0.3s;
        -webkit-tap-highlight-color: transparent;
        padding: 0 10px;
        flex-shrink: 0;

        &:hover {
            background: var(--el-fill-color-light, rgba(0, 0, 0, 0.025));
        }
    }

    .breadcrumb-container {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
    }

    .errLog-container {
        display: flex;
        align-items: center;
        flex-shrink: 0;
    }

    .right-menu {
        display: flex;
        align-items: center;
        gap: 2px;
        height: 100%;
        flex-shrink: 0;
        padding-right: 10px;
        // padding-top: 15px;

        &:focus {
            outline: none;
        }

        .right-menu-item {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 8px;
            height: 40px;
            font-size: 18px;
            color: var(--el-text-color-regular, #5a5e66);
            white-space: nowrap;

            &.hover-effect {
                cursor: pointer;
                transition: background 0.3s;
                border-radius: 4px;

                &:hover {
                    background: var(--el-fill-color-light, rgba(0, 0, 0, 0.025));
                }
            }

            &.tenant-name {
                font-size: 13px;
                color: var(--el-text-color-secondary, #606266);
                // font-weight: 500;
            }
        }

        // 统一图标样式
        .menu-icon {
            font-size: 20px;
        }

        .avatar-container {
            margin-right: 0;

            .avatar-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;

                .user-avatar {
                    cursor: pointer;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    object-fit: cover;
                }

                .el-icon {
                    font-size: 12px;
                }
            }
        }
    }
}

.personal-settings-help {
    margin-top: 8px;
    color: var(--el-text-color-secondary, #909399);
    font-size: 12px;
    line-height: 1.6;
}
</style>
