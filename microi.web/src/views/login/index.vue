<template>
    <div>
        <div
            id="divLogin"
            :style="{
                backgroundImage: 'url(' + (DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockImgUrl, false) : '') + ')',
                '--LockBgCss': 'url(' + (DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockImgUrl, false) : '') + ')'
            }"
        >
            <!-- <div v-if="DiyCommon && !DiyCommon.ShowVideo() && DesktopBg.LockImgAero" class="microi-ui-lock-aero" />
            <div style="position: absolute; width: 100%; height: 100%; z-index: -10" /> -->
            <!-- <div v-if="DiyCommon && DiyCommon.ShowVideo()" style="position: absolute; width: 100%; height: 100%; z-index: -20">
                <video
                    id="videoLogin"
                    class="video"
                    :poster="DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockImgUrl) : ''"
                    :muted="!DesktopBg.LockVideoVoice"
                    :src="DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockVideoUrl) : ''"
                    autoplay="autoplay"
                    data-autoplay="true"
                    preload="auto"
                    loop="loop"
                    webkit-playsinline="true"
                    playsinline="true"
                    x5-video-player-type="h5"
                >
                    <source :src="DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockVideoUrl) : ''" type="video/mp4" />
                </video>
            </div> -->
            <div class="divLoginCenter" :style="{ opacity: '1' }">
                <div class="loginCenterBgCover" />
                <div class="login-title">
                    <!-- {{ $t('Msg.WelcomeUse') }} -->
                    <div>
                        {{ WebTitle }}
                    </div>
                    <span style="font-size: 18px">{{ SystemSubTitle }}</span>
                </div>

                <div class="login-input-param" style="margin-bottom: 15px">
                    <div class="form-group row">
                        <label class="sr-only" />
                        <!-- input-group-sm -->
                        <div class="input-group">
                            <div class="input-group-prepend">
                                <span class="input-group-text" :style="{ backgroundColor: SysConfig.ThemeColor || '' }"
                                    ><el-icon color="white"><User /></el-icon
                                ></span>
                            </div>
                            <input v-model="Account" type="text" class="form-control" :placeholder="$t('Msg.InputAccount')" />
                            <!-- <div class="input-group-addon">.00</div> -->
                        </div>
                    </div>
                </div>
                <div class="login-input-param" style="margin-bottom: 15px">
                    <div class="form-group row">
                        <label class="sr-only" />
                        <div class="input-group">
                            <div class="input-group-prepend">
                                <span class="input-group-text" :style="{ backgroundColor: SysConfig.ThemeColor || '' }"
                                    ><el-icon color="white"><Key /></el-icon
                                ></span>
                            </div>
                            <input v-model="Pwd" type="password" class="form-control" :placeholder="$t('Msg.InputPwd')" @keyup.enter="Login" />

                            <div class="input-group-prepend">
                                <span class="input-group-text go" :style="{ backgroundColor: SysConfig.ThemeColor || '' }">
                                    <img id="CaptchaImg" src="" v-if="SysConfig.EnableCaptcha" style="height: 36px" @click="GetCaptcha()" />
                                    <input class="captcha-result" v-model="CaptchaValue" v-if="SysConfig.EnableCaptcha" placeholder="验证码" @keyup.enter="Login" />
                                    <el-icon v-if="PageType != 'BindWeChat'" @click="Login" class="hand" style="width: 50px; height: 36px; line-height: 36px; color: #fff; font-size: 20px">
                                        <Loading v-if="LoginWaiting" class="is-loading" />
                                        <Right v-else />
                                    </el-icon>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-if="SysConfig.EnablePrivacyPolicy" class="login-input-param" style="margin-bottom: 15px">
                    <div class="form-group row">
                        <label class="sr-only" />
                        <el-checkbox v-model="CheckPrivacyPolicy">
                            <a href="javascript:;" style="color: #fff !important; text-decoration: underline !important" @click="ShowPrivacyPolicy = true">
                                {{ SysConfig.PrivacyPolicyName || "同意隐私协议" }}
                            </a>
                        </el-checkbox>
                    </div>
                </div>
                <div class="bottomTips" style="text-align: center; margin-top: 30px">
                    <div>
                        <p v-if="SysConfig.EnableReg">
                            <a href="javascript:;" @click="OpenReg"
                                ><el-icon style="margin-right: 2px; vertical-align: middle"><UserFilled /></el-icon> 立即注册</a
                            >
                        </p>
                        <p v-if="PageType == 'BindWeChat'">
                            <el-button type="primary" @click="BindWeChat()"
                                ><el-icon class="hand" style="margin-right: 2px"><Right /></el-icon> 立即绑定</el-button
                            >
                        </p>

                        <!-- <p>
                            <a href="javascript:;">
                                <i class="fas fa-code-branch" style="margin-right:2px;" />
                                {{ $t('Msg.Version') }}{{ Lang == 'zh-CN' ? '：' : ': ' }}{{$root.OsVersion}}
                            </a>
                        </p> -->
                        <!-- <p>
                            <i class="far fa-copyright" style="margin-right:2px;" />
                            <a :href="DiyCommon.IsNull(ClientCompanyUrl) ? 'javascript:;' : ClientCompanyUrl">{{ ClientCompany }}</a>
                        </p> -->
                        <p v-html="LoginBottomContent"></p>
                    </div>

                    <!-- 默认中文/英文,如果选了无，则不显示多语言2025-6-1 liu-->
                    <!-- <p v-if="SysConfig.SysLang">
            <a href="javascript:;" :style="{ fontWeight: Lang == 'en' ? 'bold' : '' }" @click="DiyCommon.ChangeLang('en')">
              <i class="fas fa-language" style="font-size: 48px;"></i>
              EN
            </a>
            |
            <a href="javascript:;" :style="{ fontWeight: Lang == 'zh-CN' ? 'bold' : '' }" @click="DiyCommon.ChangeLang('zh-CN')">CN</a>
          </p> -->
                </div>
            </div>
            <div
                class="divLoginTime"
                :style="{
                    bottom: LoginCover ? '7.5%' : '100%',
                    opacity: LoginCover ? '1' : '0'
                }"
            >
                <div style="position: absolute; bottom: 0; left: 0">
                    <p>{{ CurrentTime.Format("HH:mm:ss") }}</p>
                    <p>
                        {{ DiyCommon.Months[CurrentTime.getMonth()] + DiyCommon.GetLanDate(CurrentTime.getDate()) + ", " + DiyCommon.Weeks[CurrentTime.getDay()] }}
                    </p>
                </div>
            </div>
            <el-dialog width="800px" :append-to-body="true" v-model="ShowChooseOS" :title="$t('Msg.ChooseOSType')" :close-on-click-modal="false" draggable>
                <div style="width: 100%">
                    <div class="float-left" @click="SystemStyle = 'WebOS'">
                        <img :class="'imgSystemPreview ' + (SystemStyle == 'WebOS' ? 'active' : '')" :src="DiyCommon.GetServerPath('./static/img/preview-os.jpg')" />
                        <el-radio v-model="SystemStyle" value="WebOS">Web操作系统</el-radio>
                    </div>
                    <div class="pull-right" @click="SystemStyle = 'Classic'">
                        <img :class="'imgSystemPreview ' + (SystemStyle == 'Classic' ? 'active' : '')" :src="DiyCommon.GetServerPath('./static/img/preview-old.jpg')" />
                        <el-radio v-model="SystemStyle" value="Classic">经典系统界面</el-radio>
                    </div>
                </div>
                <div class="clear marginTop10 marginBottom10" />
                <template #footer>
                    <span class="dialog-footer">
                        <el-button type="primary" @click="GotoSystem">立即进入</el-button>
                        <el-button @click="diyStore.setShowGotoWebOS(false)">取 消</el-button>
                    </span>
                </template>
            </el-dialog>

            <el-dialog width="800px" :append-to-body="true" v-model="ShowPrivacyPolicy" :title="SysConfig.PrivacyPolicyName || '同意隐私协议'" :close-on-click-modal="false" draggable>
                <div v-html="SysConfig.PrivacyPolicy" style="width: 100%; text-align: left"></div>
            </el-dialog>

            <el-dialog width="500px" :append-to-body="true" v-model="ShowRegSysUser" title="用户注册" :close-on-click-modal="false" draggable>
                <el-form ref="form" :model="RegModel" label-width="100px">
                    <el-form-item label="手机号">
                        <el-input v-model="RegModel.Phone"></el-input>
                    </el-form-item>
                    <el-form-item label="密码">
                        <el-input v-model="RegModel.Pwd" :show-password="true"></el-input>
                    </el-form-item>
                    <el-form-item label="重复密码">
                        <el-input v-model="RegModel.Pwd2" :show-password="true"></el-input>
                    </el-form-item>
                    <el-form-item label="图形验证码">
                        <el-input placeholder="请输入图形验证码" v-model="RegCaptchaValue">
                            <template #append>
                                <img id="CaptchaImgReg" style="height: 30px" src="" @click="GetCaptcha(null, '#CaptchaImgReg', 'RegCaptchaId')" />
                            </template>
                        </el-input>
                    </el-form-item>
                    <el-form-item label="短信验证码">
                        <el-input placeholder="请输入短信验证码" v-model="RegModel.SmsCaptchaValue">
                            <template #append>
                                <a href="javascript:;" @click="SendSms">获取短信验证码</a>
                            </template>
                        </el-input>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <span class="dialog-footer">
                        <el-button type="primary" @click="Reg()">提交</el-button>
                    </span>
                </template>
            </el-dialog>
        </div>
    </div>
</template>

<script>
// Element Plus 的 el-dialog 自带 draggable 属性，不需要自定义指令
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
// 使用 Pinia 替代 Vuex
import { useDiyStore, useSettingsStore, useUserStore, usePermissionStore } from "@/pinia";
import { storeToRefs } from "pinia";
// 浏览器原生支持 setInterval，不需要导入 Node.js 的 timers 模块
import Cookies from "js-cookie";
import { getLangs } from "@/utils/langs";
import JSEncrypt from "jsencrypt"; // RSA加密库
// Element Plus 图标
import { User, Key, UserFilled, Loading, Right } from "@element-plus/icons-vue";
// 直接导入工具函数
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/utils/api.itdos";

export default {
    name: "Login",
    components: {
        User,
        Key,
        UserFilled,
        Loading,
        Right
    },
    beforeCreate() {},
    setup() {
        // Pinia stores
        const diyStore = useDiyStore();
        const settingsStore = useSettingsStore();
        const userStore = useUserStore();
        const permissionStore = usePermissionStore();
        const router = useRouter();
        const route = useRoute();

        // 使用 storeToRefs 保持响应性
        const { CurrentTime, DesktopBg, LoginCover, OsClient, Lang, WebTitle, SystemSubTitle, ClientCompany, ClientCompanyUrl, SysConfig } = storeToRefs(diyStore);

        const { title } = storeToRefs(settingsStore);

        // SystemStyle 需要特殊处理（双向绑定）
        const SystemStyle = computed({
            get: () => diyStore.SystemStyle,
            set: (val) => diyStore.setState("SystemStyle", val)
        });

        return {
            // Pinia store 实例
            diyStore,
            settingsStore,
            userStore,
            permissionStore,
            router,
            route,
            // 响应式状态
            CurrentTime,
            DesktopBg,
            LoginCover,
            OsClient,
            Lang,
            WebTitle,
            SystemSubTitle,
            ClientCompany,
            ClientCompanyUrl,
            SysConfig,
            title,
            SystemStyle,
            // 工具函数
            DiyCommon,
            DiyApi
        };
    },
    computed: {
        OsVersionString() {
            // 从全局属性获取版本号
            return this.$root?.OsVersion || this.OsVersion || "";
        },
        LoginBottomContent() {
            var loginBottomContent = this.SysConfig?.LoginBottomContent || 
`<div>
    <p> © $CompanyName$ </p>
    <p> $OsVersion$ </p>
    <p> 当前语言：$CurrentLang$ </p>
</div>`;
            return loginBottomContent
                .replace("$CurrentLang$", this.currentLang)
                .replace("$OsVersion$", this.OsVersionString)
                .replace("$SysShortTitle$", this.SysConfig?.SysShortTitle || "")
                .replace("$SysTitle$", this.SysConfig?.SysTitle || "")
                .replace("$CompanyName$", this.SysConfig?.CompanyName || "");
        }
    },
    data() {
        return {
            // 存储定时器引用，用于组件销毁时清理，防止内存泄漏
            timers: [],
            currentLang: "简体中文",
            langOptions: [],
            PageType: "",
            WxKey: "",
            ShowRegSysUser: false,
            ShowPrivacyPolicy: false,
            CheckPrivacyPolicy: true,
            ShowCaptcha: false,
            ShowChooseOS: false,
            Account: "",
            Pwd: "",
            tipId: "",
            redirect: undefined,
            otherQuery: {},
            LoginResult: {},
            LoginWaiting: false,
            CaptchaId: "",
            RegCaptchaId: "",
            CaptchaValue: "",
            RegCaptchaValue: "",
            RegModel: {
                Phone: "",
                Pwd: "",
                Pwd2: "",
                SmsCaptchaValue: ""
            },
            // RSA公钥（1024位，已测试可用）
            publicKey: `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R
XaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ
1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg
1DsI9VJ7gTHGL3R7sQIDAQAB
-----END PUBLIC KEY-----`
            // TokenLoginCount : 0
        };
    },
    // Vue 3: beforeDestroy 改为 beforeUnmount
    beforeUnmount() {
        var self = this;
        // 清理所有定时器，防止内存泄漏
        self.timers.forEach(function (timer) {
            clearInterval(timer);
        });
        self.timers = [];
    },
    watch: {
        $route: {
            handler: function (route) {
                const query = route.query;
                if (query) {
                    this.redirect = query.redirect;
                    this.otherQuery = this.getOtherQuery(query);
                }
            },
            immediate: true
        }
    },
    mounted() {
        // console.log("-------> Login mounted");
        var self = this;
        // 初始化登录表单为显示状态，确保一直显示
        self.diyStore.setLoginCover(false);
        try {
            //以下代码报错会导致前端无法正常登录，新增try catch --by anderson 2025-06-18
            self.langOptions = getLangs();
            let lang = translate.language.getCurrent();
            let tempLang = self.langOptions.find((item) => item.value === lang).label;
            if (tempLang) self.currentLang = tempLang;
        } catch (error) {}

        if (self.DiyCommon && self.DiyApi) {
            self.TokenLogin();
        }
        $("#divLogin").css({
            opacity: 1
        });
        // 已改用 CSS transform: translate(-50%, -50%) 实现居中，无需 jQuery 计算

        var lastAccount = self.diyStore.getLastLoginAccount();
        if (!self.DiyCommon.IsNull(lastAccount)) {
            self.Account = lastAccount;
        }
        self.$nextTick(function () {
            if (self.DiyCommon.ShowVideo()) {
                self.DiyCommon.LoadVideoLogin();
            }
        });

        try {
            self.DiyCommon.PostAsync(
                "/api/diyTable/getSysConfig",
                {
                    _SearchEqual: {
                        IsEnable: 1
                    },
                    OsClient: self.OsClient
                },
                function (sysConfigResult) {
                    if (sysConfigResult.Code == 1) {
                        var sysConfig = sysConfigResult.Data;
                        self.GetCaptcha(sysConfig);
                    }
                }
            );
        } catch (error) {}
        var pageTypeReg = new RegExp("(^|&)" + "PageType" + "=([^&]*)(&|$)");
        var pageTypeRegResult = window.location.search.substr(1).match(pageTypeReg);
        var pageType = pageTypeRegResult != null ? pageTypeRegResult[2] : null;
        if (pageType == "BindWeChat") {
            self.PageType = "BindWeChat";
        }

        var wxKeyReg = new RegExp("(^|&)" + "WxKey" + "=([^&]*)(&|$)");
        var wxKeyRegResult = window.location.search.substr(1).match(wxKeyReg);
        var wxKey = wxKeyRegResult != null ? wxKeyRegResult[2] : null;
        self.WxKey = wxKey;

        setTimeout(function () {
            self.loadLang();
        }, 2000);
    },

    methods: {
        // RSA加密密码
        encryptPassword(password) {
            var self = this;
            try {
                var encrypt = new JSEncrypt();
                encrypt.setPublicKey(self.publicKey);
                var encrypted = encrypt.encrypt(password);
                if (!encrypted) {
                    console.error("RSA加密返回空值");
                    return null;
                }
                return encrypted;
            } catch (error) {
                console.error("密码加密失败:", error);
                return null;
            }
        },
        loadLang() {
            //兼容旧版本语言配置
            let currentLang = this.SysConfig?.SysLang;
            if (!currentLang) {
                currentLang = "zh-CN";
            }
            if (currentLang != "en" && currentLang != "zh-CN" && currentLang != "none" && typeof window.translate !== "undefined") {
                let lang = translate.language.getCurrent();
                if (lang != currentLang) {
                    translate.changeLanguage(currentLang);
                }
            }
        },
        BindWeChat() {
            var self = this;
            // 加密密码
            var encryptedPwd = self.encryptPassword(self.Pwd);
            if (!encryptedPwd) {
                return;
            }

            self.DiyCommon.Post(
                "/apiengine/bind-wechat",
                {
                    Account: self.Account,
                    Pwd: encryptedPwd, // 使用加密后的密码
                    OsClient: self.OsClient,
                    WxKey: self.WxKey,
                    _CaptchaId: self.CaptchaId,
                    _CaptchaValue: self.CaptchaValue
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        window.location.href = result.Data.RedirectUrl;
                    }
                }
            );
        },
        SendSms() {
            var self = this;
            // 保存当前的验证码ID和图片，防止被刷新
            var currentCaptchaId = self.RegCaptchaId;
            var currentCaptchaImgSrc = $("#CaptchaImgReg").attr("src");

            self.DiyCommon.Post({
                url: "/api/sms/send",
                data: {
                    Phone: self.RegModel.Phone,
                    _CaptchaId: self.RegCaptchaId,
                    _CaptchaValue: self.RegCaptchaValue,
                    OsClient: self.OsClient
                },
                dataType: "json",
                success: function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips("发送成功！");
                        // 确保图形验证码不被刷新，恢复之前的验证码ID和图片
                        // 使用 $nextTick 确保在 DOM 更新后再恢复验证码
                        self.$nextTick(function () {
                            if (currentCaptchaId && currentCaptchaImgSrc) {
                                self.RegCaptchaId = currentCaptchaId;
                                $("#CaptchaImgReg").attr("src", currentCaptchaImgSrc);
                            }
                        });
                    }
                }
            });
        },
        OpenReg() {
            var self = this;
            self.GetCaptcha(null, "#CaptchaImgReg", "RegCaptchaId");
            self.ShowRegSysUser = true;
        },
        Reg() {
            var self = this;
            if (!self.RegModel.Pwd || !self.RegModel.Phone) {
                self.DiyCommon.Tips("帐号密码不能为空！", false);
                return;
            }
            if (self.RegModel.Pwd != self.RegModel.Pwd2) {
                self.DiyCommon.Tips("两次密码不一致！", false);
                return;
            }

            // 加密密码
            var encryptedPwd = self.encryptPassword(self.RegModel.Pwd);
            if (!encryptedPwd) {
                return;
            }

            self.DiyCommon.Post({
                url: "/api/SysUser/reg",
                data: {
                    Account: self.RegModel.Phone,
                    Pwd: encryptedPwd, // 使用加密后的密码
                    _SmsCaptchaValue: self.RegModel.SmsCaptchaValue,
                    OsClient: self.OsClient
                },
                dataType: "json",
                success: function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips("注册成功！");
                        self.ShowRegSysUser = false;
                    }
                }
            });
        },
        GetCaptcha(sysConfig, imgId, captchaId) {
            var self = this;
            sysConfig = sysConfig || self.SysConfig;
            if (sysConfig) {
                self.diyStore.setSysConfig(sysConfig);
                // Logo
                if (sysConfig.EnableCaptcha || imgId) {
                    self.$axios
                        .get(self.DiyCommon.GetApiBase() + "/api/Captcha/getCaptcha", {
                            params: {
                                OsClient: self.OsClient
                            },
                            responseType: "arraybuffer"
                        })
                        .then((response) => {
                            if (response && response.headers && response.headers.captchaid) {
                                self[captchaId || "CaptchaId"] = response.headers.captchaid;
                            }
                            return "data:image/png;base64," + btoa(new Uint8Array(response.data).reduce((data, byte) => data + String.fromCharCode(byte), ""));
                        })
                        .then((data) => {
                            $(imgId || "#CaptchaImg").attr("src", data);
                        });
                }
            }
        },

        getOtherQuery(query) {
            return Object.keys(query).reduce((acc, cur) => {
                if (cur !== "redirect" && cur !== "token") {
                    acc[cur] = query[cur];
                }
                return acc;
            }, {});
        },
        DisplayLogin() {
            this.diyStore.setLoginCover(false);
        },
        HiddenLogin() {
            this.diyStore.setLoginCover(true);
        },
        TokenLogin() {
            var self = this;
            //token自动登录  2022-04-09
            //取所有单点登录
            var diySsoList = self.DiyCommon.Post(
                "/api/FormEngine/getTableDataAnonymous",
                {
                    FormEngineKey: "Diy_Sso",
                    // _SearchEqual: { IsEnable: true },
                    _Where: [["IsEnable", "=", 1]],
                    OsClient: self.OsClient
                },
                function (result) {
                    self.LoginResult = result;
                    if (result.Code == 1 && Array.isArray(result.Data) && result.Data.length > 0) {
                        // console.log("-------> SsoLogin href：" + location.href);
                        for (let index = 0; index < result.Data.length; index++) {
                            const diySso = result.Data[index];
                            var token = decodeURIComponent((new RegExp("[?|&|%3F]" + diySso.TokenName + "%3D" + "([^&;]+?)(&|#|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
                            if (!token) {
                                token = decodeURIComponent((new RegExp("[?|&|%3F]" + diySso.TokenName + "=" + "([^&;]+?)(&|#|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
                            }
                            if (!self.DiyCommon.IsNull(token) && token != "$V8.CurrentToken$") {
                                console.log("-------> SsoLogin token：" + token);
                                //登录
                                if (diySso.ClientSsoApi.toLowerCase() == self.DiyApi.TokenLogin().toLowerCase()) {
                                    var newtoken = token.replace("Bearer%20", "").replace("Bearer ", "");
                                    // 使用统一的 Token 存储方法
                                    self.DiyCommon.setToken(newtoken);
                                }
                                self.DiyCommon.Post(
                                    diySso.ClientSsoApi,
                                    {
                                        //'/api/SysUser/SsoPengrui'
                                        _token: token,
                                        Token: token,
                                        TokenName: diySso.TokenName,
                                        OsClient: self.OsClient
                                    },
                                    function (result) {
                                        console.log("-------> SsoLogin ssoApiResult：", result);
                                        if (result.Code == 1) {
                                            self.diyStore.setState("SystemStyle", "Classic");
                                            self.GotoSystem();
                                        }
                                    }
                                );
                                break;
                            }
                        }
                    }
                }
            );
        },
        async Login() {
            var self = this;

            if (self.LoginWaiting == true) {
                return;
            }

            if (self.SysConfig.EnablePrivacyPolicy && !self.CheckPrivacyPolicy) {
                self.DiyCommon.Tips(`请先勾选[${self.SysConfig.PrivacyPolicyName || "同意隐私协议"}]！`, false);
                return;
            }

            self.LoginWaiting = true;
            // 使用 Vue 响应式状态控制加载图标，移除 jQuery 操作

            // 加密密码
            var encryptedPwd = self.encryptPassword(self.Pwd);
            if (!encryptedPwd) {
                self.LoginWaiting = false;
                return;
            }

            var loginApi = self.DiyApi.Login();
            if (self.SysConfig.DiySystem) {
                // loginApi = self.DiyApi.DiyLogin;
            }
            // self.DiyCommon.Post(self.DiyApi.Login(), {
            // self.DiyCommon.Post(self.DiyApi.DiyLogin, {
            var loginParam = {
                Account: self.Account,
                Pwd: encryptedPwd, // 使用RSA加密后的密码
                // Pwd: self.Base64.encode(self.Pwd),
                OsClient: self.OsClient,
                _ClientType: "PC"
            };
            if (self.SysConfig.EnableCaptcha) {
                loginParam._CaptchaId = self.CaptchaId;
                loginParam._CaptchaValue = self.CaptchaValue;
            }
            self.DiyCommon.Post(loginApi, loginParam, async function (result) {
                // if(result.Code == 1004){
                //     self.GetCaptcha();
                //     self.CaptchaValue = '';
                // }
                if (self.DiyCommon.Result(result)) {
                    self.LoginResult = result;
                    if (false) {
                        //self.OsClient == 'Tdx' || self.OsClient == 'Nbgysh'
                        self.diyStore.setState("SystemStyle", "WebOS");
                        self.GotoSystem();
                    } else {
                        if (result.DataAppend.SysConfig) {
                            self.diyStore.setSysConfig(result.DataAppend.SysConfig);
                            if (!self.DiyCommon.IsNull(result.DataAppend.SysConfig.LoginEndV8Code)) {
                                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);;
                                try {
                                    V8.EventName = "LoginEnd";
                                    await eval("(async () => {\n " + result.DataAppend.SysConfig.LoginEndV8Code + " \n})()");
                                } catch (error) {
                                    console.error("执行登录结束V8代码出现错误：" + error.message);
                                } finally {
                                    // 清理V8引用防止内存泄漏
                                    if (V8) {
                                        try {
                                            var keys = Object.keys(V8);
                                            for (var i = 0; i < keys.length; i++) {
                                                V8[keys[i]] = null;
                                            }
                                            for (var i = 0; i < keys.length; i++) {
                                                delete V8[keys[i]];
                                            }
                                        } catch (e) { /* ignore */ }
                                    }
                                }
                            }
                        }

                        if (self.DiyCommon.IsNull(self.SystemStyle)) {
                            // self.ShowChooseOS = true;
                            self.diyStore.setState("SystemStyle", "Classic");
                            self.GotoSystem();
                        } else {
                            self.GotoSystem();
                        }
                    }
                } else {
                    self.GetCaptcha();
                    self.CaptchaValue = "";
                    // 使用 Vue 响应式状态控制
                }
                self.LoginWaiting = false;
            });
        },
        async GotoSystem() {
            var self = this;
            if (self.DiyCommon.IsNull(self.SystemStyle)) {
                self.DiyCommon.Tips(self.$t("Msg.ChooseOSType"));
                return;
            }
            self.ShowChooseOS = false;
            self.diyStore.setState("SystemStyle", self.SystemStyle);

            document.body.classList.remove("Classic");
            document.body.classList.remove("WebOS");
            document.body.classList.add(self.SystemStyle);

            // $('#divLogin').css({
            //     opacity: 0
            // })
            self.diyStore.setLastLoginAccount(self.LoginResult.Data.Account);
            try {
                self.$parent.GetDesktop();
            } catch (error) {}
            self.DiyCommon.Tips((!self.DiyCommon.IsNull(self.LoginResult.Data.Name) ? self.LoginResult.Data.Name : self.LoginResult.Data.Account) + self.$t("Msg.WelcomeBack"));
            try {
                // 设置用户身份之前销毁登录页面视频
                self.DiyCommon.DisposeVideoLogin();
                self.diyStore.setCurrentUser(self.LoginResult.Data);

                // 设置用户角色到 userStore (用于 permission.js 检查)
                const roles = self.LoginResult.Data.Roles || ["admin"];
                self.userStore.setRoles(roles);
                self.userStore.setName(self.LoginResult.Data.Name || self.LoginResult.Data.Account);
                self.userStore.setAvatar(self.LoginResult.Data.Avatar || "");


                // 立即生成动态路由（修复：登录后无法跳转的问题）
                console.log('[Login] 开始加载动态路由...');
                const permissionStore = self.permissionStore;
                const accessRoutes = await permissionStore.generateRoutes(roles);
                // 动态添加路由
                accessRoutes.forEach((route) => {
                    self.$router.addRoute(route);
                });
                console.log('[Login] 动态路由已加载，数量:', accessRoutes.length);
                // 然后调用桌面视频
                self.$nextTick(function () {
                    self.DiyCommon.LoadVideoDesktop();
                });
            } catch (error) {
                console.error("GotoSystem error:", error);
            }

            // 等待 DOM 更新
            await self.$nextTick();
            // 短暂等待确保路由完全注册（50ms足够，因为已经在登录时加载）
            await new Promise(resolve => setTimeout(resolve, 50));

            if (self.SystemStyle == "WebOS") {
                self.$router.push({
                    path: "/os",
                    replace: true
                });
            } else {
                var url = "/";
                //这里需要跳转到sys_menu的第一个路由
                //2022-07-05新增：以系统设置的默认首页路由为优先
                if (self.SysConfig && self.SysConfig.DefaultIndexUrl) {
                    url = self.SysConfig.DefaultIndexUrl;
                    url = url.replace("$V8.CurrentToken$", self.DiyCommon.getToken());
                    if (url.startsWith("/iframe/")) {
                        url = "/iframe/" + encodeURIComponent(url.replace("/iframe/", ""));
                    } else if (url.startsWith("http")) {
                        window.location.href = url;
                        return;
                    }
                } else if (self.LoginResult.DataAppend && self.LoginResult.DataAppend.SysMenuHomePage && self.LoginResult.DataAppend.SysMenuHomePage.Url) {
                    url = self.LoginResult.DataAppend.SysMenuHomePage.Url;
                }
                
                // 检查是否是移动端设备，且没有指定redirect参数
                // 移动端默认跳转到移动端首页
                if (self.diyStore.IsPhoneView) {
                    url = "/mobile/home";
                    console.log('[Login] 检测到移动端设备，跳转到移动端首页:', url);
                }
                
                self.$router.push({
                    path: self.DiyCommon.IsNull(self.redirect) || self.redirect == "/" ? url : self.redirect,
                    query: self.otherQuery,
                    replace: true
                });
                
                // 登录成功后尝试连接WebSocket
                self.$nextTick(() => {
                    console.log('[Login] 登录成功，尝试连接WebSocket...');
                    if (typeof window.tryConnectWebSocket === 'function') {
                        setTimeout(() => {
                            const result = window.tryConnectWebSocket();
                            console.log('[Login] WebSocket连接结果:', result);
                        }, 1000);  // 延迟1秒等待页面跳转完成
                    }
                });
            }
        }
    }
};
</script>

<style lang="scss">
/* 加载旋转动画 */
.is-loading {
    animation: rotating 2s linear infinite;
}

@keyframes rotating {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

.captcha-result {
    height: 36px;
    width: 60px;
    line-height: 36px;
    color: #000;
    background: #fff;
    padding-left: 5px;
    padding-right: 5px;
    font-size: 12px;
    text-align: center;
}
.imgSystemPreview {
    width: 370px;
    display: block;
    margin-bottom: 15px;
}

.imgSystemPreview.active {
    box-shadow: rgba(0, 0, 0, 0.1) 4px 4px 40px;
    border: solid 2px #fff;
}

#divLogin .bottomTips p {
    margin-bottom: 15px;
    display: block;
    padding-left: 10px;
    padding-right: 10px;
}

#divLogin .bottomTips a {
    text-decoration: underline;
}

#divLogin {
    font-size: 12px;
    position: fixed;
    background-color: var(--taskbar-color);
    /*bg*/
    width: 100%;
    height: 100%;
    z-index: 99;
    color: #fff;
    text-align: center;
    left: 0;
    /* top: -100%; */
    top: 0;
    transition: 0.7s;
    -moz-transition: 0.7s;
    -webkit-transition: 0.7s;
    -o-transition: 0.7s;
    overflow: hidden;
    display: block !important;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;

    .login-title {
        margin-bottom: 15px;
        font-size: 25px;
        font-weight: bold;
    }

    .divLoginCenter {
        width: 375px;
        max-width: 90%;
        padding: 30px;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        margin-top: 0 !important;
        transition: 0.7s;

        .form-control {
            background-color: #fff;
            border: 1px solid #c2cad8;
            box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075);
            padding: 2px 8px;
            border-radius: 2px;
        }

        .input-group .form-control:last-child {
            border-bottom-left-radius: 0;
            border-top-left-radius: 0;
        }

        .input-group .form-control:not(:first-child):not(:last-child) {
            border-radius: 0;
        }
    }

    @media (min-width: 1365px) {
        .divLoginCenter {
            width: 500px;
            max-width: 90%;
            // height: 500px;
            padding-top: 50px;
            padding-left: 50px;
            padding-right: 50px;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            margin-top: 0 !important;
        }

        // .loginCenterBgCover {
        //     border-radius: 50%;
        // }
    }
}

.loginCenterBgCover {
    width: 100%;
    height: 100%;
    position: absolute;
    background-color: var(--bg-color);
    left: 0;
    top: 0;
    opacity: 0.5;
    z-index: -1;
    /* border-radius: 4px; */
    box-shadow: 0 0 60px 6px #000;
}

#divLogin .divLoginTime {
    position: absolute;
    width: 100%;
    height: 100%;
    transition: 0.7s;
    -moz-transition: 0.7s;
    -webkit-transition: 0.7s;
    -o-transition: 0.7s;
}

#divLogin .divLoginTime p {
    text-align: left;
    color: #fff;
}

#divLogin .input-group-text {
    background-color: var(--bg-color);
}

#divLogin .input-group-text.go {
    padding: 0;
}

#divLogin .input-group-text i {
    color: var(--theme-color);
}

#divLogin .divLoginTime {
    left: 5%;
    bottom: 7.5%;
}

#divLogin .divLoginTime p {
    font-size: 20px;
}

@media (max-width: 767px) {
    #divLogin .divLoginTime p {
        font-size: 20px;
    }
}

@media (min-width: 768px) {
    #divLogin .divLoginTime p {
        font-size: 25px;
    }
}

@media (min-width: 992px) {
    #divLogin .divLoginTime p {
        font-size: 35px;
    }
}

@media (min-width: 1200px) {
    #divLogin .divLoginTime p {
        font-size: 45px;
    }
}

.microi-ui-lock-aero:before,
.microi-ui-lock-aero:after {
    background-image: var(--LockBgCss);
    box-sizing: content-box;
}
</style>
