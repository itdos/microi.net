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
                    <el-icon class="menu-icon" :style="{ color: WebSocketOnline ? themeColor : '#606266' }"><ChatDotRound /></el-icon>
                </el-badge>
            </div>

            <!-- 搜索 -->
            <search id="header-search" class="right-menu-item hover-effect" />

            <lang-select class="right-menu-item hover-effect" />

            <ThemeSelect class="right-menu-item hover-effect" />

            <el-dropdown class="avatar-container right-menu-item hover-effect" trigger="click">
                <div class="avatar-wrapper">
                    <img :src="GetCurrentUserAvatar()" class="user-avatar" />
                    <span style="margin-left: 5px; font-size: 14px">
                        {{ GetCurrentUser.Name }}
                    </span>
                    <el-icon><CaretBottom /></el-icon>
                </div>
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item @click="OpenUptPwd">
                            <span style="display: block">
                                <el-icon><Setting /></el-icon>
                                {{ "修改密码" }}</span
                            >
                        </el-dropdown-item>
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
        <el-dialog 
            draggable
            align-center
            title="修改密码" v-model="dialogUptPwd" :modal-append-to-body="false" :close-on-click-modal="false" width="450px">
            <el-form ref="FormUptPwd" :model="FormUptPwd" :rules="FormUptPwdRules" label-width="100px">
                <el-form-item label="旧密码" prop="Pwd">
                    <el-input v-show="false" type="text" />
                    <el-input v-show="false" type="password" />
                    <el-input v-model="FormUptPwd.Pwd" type="password" />
                </el-form-item>
                <el-form-item label="新密码" prop="NewPwd">
                    <el-input v-model="FormUptPwd.NewPwd" type="password" />
                </el-form-item>
                <el-form-item label="重复新密码" prop="NewPwd2">
                    <el-input v-model="FormUptPwd.NewPwd2" type="password" />
                </el-form-item>
            </el-form>
            <template #footer>
                <div class="dialog-footer">
                    <el-button :icon="Close" @click="dialogUptPwd = false">取 消</el-button>
                    <el-button type="primary" :icon="Check" @click="UptSysUser">确 定</el-button>
                </div>
            </template>
        </el-dialog>

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
import { useDiyStore, useAppStore, useUserStore } from "@/pinia";
import { computed } from "vue";
// import { aw } from 'public/three/static/js/DRACOLoader-DSa8Sn_h';

export default {
    components: {
        Breadcrumb,
        Hamburger,
        LangSelect,
        Search,
        ThemeSelect
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
        const themeColor = computed(() => diyStore.themeColor || "#409eff");

        return {
            diyStore,
            appStore,
            userStore,
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
            themeColor
        };
    },
    data() {
        return {
            src: "/im/#/",
            myIframe: null,
            ShowChat: false,
            ChatType: "",
            ShowUnreadCount: true,
            dialogUptPwd: false,
            FormUptPwd: {
                Pwd: "",
                NewPwd: "",
                NewPwd2: ""
            },
            FormUptPwdRules: {
                Pwd: [
                    {
                        required: true,
                        message: "旧密码不能为空",
                        trigger: "blur"
                    }
                ],
                NewPwd: [
                    {
                        required: true,
                        message: "新密码不能为空",
                        trigger: "blur"
                    }
                ],
                NewPwd2: [
                    {
                        required: true,
                        message: "重复密码不能为空",
                        trigger: "blur"
                    }
                ]
            }
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
    async mounted() {
        var self = this;

        setTimeout(function () {
            self.loadLang();
        }, 2000);

        setInterval(function () {
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

        // 动态修改 CSS 变量
        document.documentElement.style.setProperty("--color-primary", self.themeColor || "#409eff");
    },
    methods: {
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
                // 使用 postMessage 发送数据给 iframe
                iframe.contentWindow.postMessage(dataToSend, "*");
            }
        },
        GetNavbarMicroiStyle() {
            var self = this;
            var result = {};
            if (self.SysConfig.TopWidthFull) {
                result["padding-left"] = "10px";
                result["padding-right"] = "10px";
            }
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
        // 修改密码
        OpenUptPwd() {
            var self = this;
            self.dialogUptPwd = true;
        },
        UptSysUser() {
            var self = this;
            self.$refs.FormUptPwd.validate((valid) => {
                if (valid) {
                    if (self.FormUptPwd.NewPwd != self.FormUptPwd.NewPwd2) {
                        self.DiyCommon.OsAlert("再次密码输入不一致！", {
                            Icon: error
                        });
                        return;
                    }
                    var url = "/api/SysUser/uptsysuser";
                    var param = {};
                    param.Id = self.GetCurrentUser.Id;
                    ((param.Pwd = self.Base64.encode(self.FormUptPwd.Pwd)),
                        (param.NewPwd = self.Base64.encode(self.FormUptPwd.NewPwd)),
                        // self.LoadingCount++;
                        self.DiyCommon.Post(url, param, function (result) {
                            // self.LoadingCount--;
                            if (self.DiyCommon.Result(result)) {
                                self.DiyCommon.OsAlert(self.$t("Msg.Success"));
                                self.dialogUptPwd = false;
                            }
                        }));
                } else {
                    return false;
                }
            });
        },
        GetCurrentUserAvatar() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.GetCurrentUser.Avatar)) {
                return self.DiyCommon.GetServerPath(self.GetCurrentUser.Avatar);
            }
            return self.DiyCommon.GetServerPath("./static/img/icon/personal.png");
        },
        GotoDesktop() {
            this.diyStore.setState("ShowGotoWebOS", true);
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
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
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
            background: rgba(0, 0, 0, 0.025);
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
            color: #5a5e66;
            white-space: nowrap;

            &.hover-effect {
                cursor: pointer;
                transition: background 0.3s;
                border-radius: 4px;

                &:hover {
                    background: rgba(0, 0, 0, 0.025);
                }
            }

            &.tenant-name {
                font-size: 14px;
                color: #606266;
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
</style>
