<template>
    <div class="navbar-microi" :style="GetNavbarMicroiStyle()" v-if="ShowClassicTop != 0">
        <hamburger id="hamburger-container-microi" :is-active="sidebar.opened" class="hamburger-container-microi" @toggleClick="toggleSideBar" />

        <breadcrumb id="breadcrumb-container" class="breadcrumb-container" />

        <div class="right-menu">
            <!-- v-if="device !== 'mobile'" -->
            <template>
                <!-- 租户名称 -->
                <div v-if="GetCurrentUser.TenantName" class="right-menu-item tenant-name">
                    {{ GetCurrentUser.TenantName }}
                </div>

                <!-- 聊天图标 -->
                <div v-if="ShowChat" class="right-menu-item hover-effect" @click="SwitchDiyChatShow()">
                    <el-badge :value="$root.UnreadCount" :max="99" :hidden="$root.UnreadCount == 0 || !ShowUnreadCount">
                        <i class="el-icon-chat-dot-round menu-icon" :style="{ color: WebSocketOnline ? $store.state.themeColor : '#606266' }"></i>
                    </el-badge>
                </div>

                <!-- 搜索 -->
                <search id="header-search" class="right-menu-item hover-effect" />

                <!-- <template v-if="GetCurrentUser._IsAdmin == true && SystemStyle == 'Classic'">
                    <ThemeSelect />
                </template> -->
                <!-- <error-log class="errLog-container right-menu-item hover-effect" /> -->

                <!-- <screenfull id="screenfull" class="right-menu-item hover-effect" /> -->

                <!-- <el-tooltip :content="$t('navbar.size')" effect="dark" placement="bottom">
                    <size-select id="size-select" class="right-menu-item hover-effect" />
                    </el-tooltip> -->

                <lang-select class="right-menu-item hover-effect" v-if="SysConfig.SysLang" />

                <theme-select class="right-menu-item hover-effect" />
            </template>

            <el-dropdown class="avatar-container right-menu-item hover-effect" trigger="click">
                <div class="avatar-wrapper">
                    <img :src="GetCurrentUserAvatar()" class="user-avatar" />
                    <span style="margin-left: 5px; font-size: 13px">
                        {{ GetCurrentUser.Name }}
                    </span>
                    <i class="el-icon-caret-bottom" />
                </div>
                <el-dropdown-menu slot="dropdown">
                    <!-- <router-link to="/">
                        <el-dropdown-item>
                            {{ $t("navbar.dashboard") }}
                        </el-dropdown-item>
                    </router-link> -->
                    <el-dropdown-item v-if="GetCurrentUser.TenantName">
                        {{ GetCurrentUser.TenantName }}
                    </el-dropdown-item>
                    <el-dropdown-item divided @click.native="OpenUptPwd">
                        <span style="display: block">
                            <i class="el-icon-setting"></i>
                            {{ "修改密码" }}</span
                        >
                    </el-dropdown-item>
                    <el-dropdown-item divided @click.native="logout">
                        <span style="display: block">
                            <i class="el-icon-back"></i>
                            {{ $t("navbar.logOut") }}</span
                        >
                    </el-dropdown-item>
                </el-dropdown-menu>
            </el-dropdown>
        </div>
        <el-dialog title="修改密码" :visible.sync="dialogUptPwd" :modal-append-to-body="false" :close-on-click-modal="false" width="450px">
            <el-form ref="FormUptPwd" :model="FormUptPwd" :rules="FormUptPwdRules" label-width="100px" size="mini">
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
            <div slot="footer" class="dialog-footer">
                <el-button size="mini" icon="el-icon-close" @click="dialogUptPwd = false">取 消</el-button>
                <el-button type="primary" size="mini" icon="el-icon-check" @click="UptSysUser">确 定</el-button>
            </div>
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
import { mapGetters, mapState } from "vuex";
import Breadcrumb from "@/components/Breadcrumb";
import Hamburger from "@/components/Hamburger";
// import ErrorLog from "@/components/ErrorLog";
// import Screenfull from "@/components/Screenfull";
import SizeSelect from "@/components/SizeSelect";
import LangSelect from "@/components/LangSelect";
import Search from "@/components/HeaderSearch";
import ThemeSelect from "@/layout/components/ThemeSelect";
import request from "@/axios/interceptor";
// import { aw } from 'public/three/static/js/DRACOLoader-DSa8Sn_h';
import config from "@/utils/config";

export default {
    components: {
        Breadcrumb,
        Hamburger,
        // ErrorLog,
        // Screenfull,
        SizeSelect,
        LangSelect,
        Search,
        ThemeSelect
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
        ...mapGetters(["sidebar", "avatar", "device"]),
        ...mapState({
            ThemeClass: (state) => state.DiyStore.ThemeClass,
            ThemeBodyClass: (state) => state.DiyStore.ThemeBodyClass,
            Lang: (state) => state.DiyStore.Lang,
            WebTitle: (state) => state.DiyStore.WebTitle,
            OsClient: (state) => state.DiyStore.OsClient,
            SystemStyle: (state) => state.DiyStore.SystemStyle,
            DiyChatShow: (state) => state.DiyStore.DiyChat.Show,
            ShowClassicTop: (state) => state.DiyStore.ShowClassicTop,
            SysConfig: (state) => state.DiyStore.SysConfig
        }),
        GetCurrentUser: function () {
            return this.$store.getters["DiyStore/GetCurrentUser"];
        },
        WebSocketOnline: function () {
            return !(this.$websocket == null || this.$websocket.connectionState != "Connected");
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
        document.documentElement.style.setProperty("--color-primary", self.$store.state.themeColor);
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
            let result = await request({
                url: `${config.apiBaseUrl}/api/Im/GetUserSig`,
                method: "get",
                params: {
                    userId: self.GetCurrentUser?.Account,
                    sdkAppid: sdkAppid,
                    secretKey: secretKey,
                    expire: expire
                }
            });
            if (result.status == 200) {
                return result.data;
            }
            return null;
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
            self.$store.commit("DiyStore/SetDiyChatShow", !self.DiyChatShow);
            if (self.DiyChatShow && self.ChatType == "吾码IM") {
                //吾码IM websocket 通信
                self.$websocket
                    .invoke("SendLastContacts", {
                        UserId: self.GetCurrentUser.Id,
                        ContactUserId: "",
                        OsClient: self.DiyCommon.GetOsClient()
                    })
                    .then((res) => {})
                    .catch((err) => {
                        console.log("获取最近联系人列表失败：", err);
                    });
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
                    (param.Pwd = self.Base64.encode(self.FormUptPwd.Pwd)),
                        (param.NewPwd = self.Base64.encode(self.FormUptPwd.NewPwd)),
                        // self.LoadingCount++;
                        self.DiyCommon.Post(url, param, function (result) {
                            // self.LoadingCount--;
                            if (self.DiyCommon.Result(result)) {
                                self.DiyCommon.OsAlert(self.$t("Msg.Success"));
                                self.dialogUptPwd = false;
                            }
                        });
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
            this.$store.commit("DiyStore/SetShowGotoWebOS", true);
        },
        toggleSideBar() {
            this.$store.dispatch("app/toggleSideBar");
        },
        async logout() {
            var self = this;
            self.DiyCommon.OsConfirm("确认退出登录？", async function () {
                await self.$store.dispatch("user/logout");
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
                self.$store.commit("DiyStore/SetCurrentUser", {});

                // //然后调用登录页面视频
                // self.$nextTick(function(){
                //     self.DiyCommon.LoadVideoLogin();
                // });

                // 用户手动注销
                localStorage.setItem("Microi.DemoSelfLogout", "1");

                self.$router.push(`/login?redirect=${self.$route.fullPath}`);
            });
        }
    }
};
</script>

<style lang="scss" scoped>
.navbar-microi {
    height: 50px;
    overflow: hidden;
    position: relative;
    background: #fff;
    box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);

    .hamburger-container-microi {
        line-height: 46px;
        height: 100%;
        float: left;
        cursor: pointer;
        transition: background 0.3s;
        -webkit-tap-highlight-color: transparent;

        &:hover {
            background: rgba(0, 0, 0, 0.025);
        }
    }

    .breadcrumb-container {
        float: left;
    }

    .errLog-container {
        display: inline-block;
        vertical-align: top;
    }

    .right-menu {
        float: right;
        height: 100%;
        line-height: 50px;

        &:focus {
            outline: none;
        }

        .right-menu-item {
            display: inline-block;
            padding: 0 8px;
            height: 100%;
            font-size: 18px;
            color: #5a5e66;
            vertical-align: middle;
            line-height: 50px;

            &.hover-effect {
                cursor: pointer;
                transition: background 0.3s;

                &:hover {
                    background: rgba(0, 0, 0, 0.025);
                }
            }

            &.tenant-name {
                font-size: 14px;
                color: #606266;
            }
        }

        // 统一图标样式
        .menu-icon {
            font-size: 20px;
            vertical-align: middle;
        }

        .avatar-container {
            margin-right: 30px;

            .avatar-wrapper {
                margin-top: 5px;
                position: relative;

                .user-avatar {
                    cursor: pointer;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                }

                .el-icon-caret-bottom {
                    cursor: pointer;
                    position: absolute;
                    right: -20px;
                    top: 25px;
                    font-size: 12px;
                }
            }
        }
    }
}
</style>
