<template>
    <div>
        <div
            id="divLogin"
            :style="{
                backgroundImage: 'url(' + (DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockImgUrl, false) : '') + ')'
            }"
        >
            <div class="divLoginCenter" :style="{ opacity: '1' }">
                <div class="loginCenterBgCover" />
                <div class="login-title">
                    <div>
                        {{ WebTitle }}
                    </div>
                    <span style="font-size: 18px">{{ SystemSubTitle }}</span>
                </div>

                <!-- 账号输入框 -->
                <div class="login-input-param">
                    <el-input 
                        v-model="Account" 
                        type="text" 
                        size="large"
                        :placeholder="$t('Msg.InputAccount')"
                    >
                        <template #prefix>
                            <div class="input-icon-wrapper" :style="{ backgroundColor: SysConfig.ThemeColor || '#409EFF' }">
                                <el-icon color="white"><User /></el-icon>
                            </div>
                        </template>
                    </el-input>
                </div>

                <!-- 密码输入框 -->
                <div class="login-input-param pwd">
                    <el-input 
                        v-model="Pwd" 
                        type="password" 
                        size="large"
                        :placeholder="$t('Msg.InputPwd')" 
                        @keyup.enter="Login"
                    >
                        <template #prefix>
                            <div class="input-icon-wrapper" :style="{ backgroundColor: SysConfig.ThemeColor || '#409EFF' }">
                                <el-icon color="white"><Key /></el-icon>
                            </div>
                        </template>
                    </el-input>
                </div>

                <!-- 验证码输入框 -->
                <div v-if="SysConfig.EnableCaptcha" class="login-input-param captcha">
                    <el-input 
                        v-model="CaptchaValue" 
                        type="text" 
                        size="large"
                        placeholder="请输入验证码计算结果（0 ~ 9）" 
                        @keyup.enter="Login"
                        maxlength="6"
                    >
                        <template #prefix>
                            <div class="input-icon-wrapper" :style="{ backgroundColor: SysConfig.ThemeColor || '#409EFF' }">
                                <el-icon color="white"><Lock /></el-icon>
                            </div>
                        </template>
                        <template #append v-if="SysConfig.EnableCaptcha">
                            <div class="captcha-wrapper">
                                <img 
                                    id="CaptchaImg" 
                                    src="" 
                                    class="captcha-img" 
                                    @click="GetCaptcha()" 
                                    title="点击刷新验证码"
                                />
                            </div>
                        </template>
                    </el-input>
                </div>

                <!-- 界面风格选择 -->
                <div class="style-selector-wrapper" v-if="hasWebOS">
                    <div class="style-selector-label">选择界面风格</div>
                    <div class="style-selector-options">
                        <div 
                            class="style-option" 
                            :class="{ active: SystemStyle === 'Classic' }" 
                            @click="SystemStyle = 'Classic'"
                        >
                            <div class="style-option-icon">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 3h18v12H3V3zm0 14h18v2H3v-2zm4 3h10v1H7v-1z"/></svg>
                            </div>
                            <div class="style-option-text">经典传统</div>
                            <div class="style-option-check" v-if="SystemStyle === 'Classic'">✓</div>
                        </div>
                        <div 
                            class="style-option" 
                            :class="{ active: SystemStyle === 'macOS' }" 
                            @click="SystemStyle = 'macOS'"
                        >
                            <div class="style-option-icon">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                            </div>
                            <div class="style-option-text">macOS 风格</div>
                            <div class="style-option-check" v-if="SystemStyle === 'macOS'">✓</div>
                        </div>
                        <div 
                            class="style-option" 
                            :class="{ active: SystemStyle === 'Windows' }" 
                            @click="SystemStyle = 'Windows'"
                        >
                            <div class="style-option-icon">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .08V5.67L20 3zm-10 9.04l10-.08V21l-10-1.39V12.04zM3 12.5l6 .09v6.73l-6-1.07V12.5z"/></svg>
                            </div>
                            <div class="style-option-text">Windows 风格</div>
                            <div class="style-option-check" v-if="SystemStyle === 'Windows'">✓</div>
                        </div>
                    </div>
                </div>

                <!-- 登录按钮 -->
                <div v-if="PageType != 'BindWeChat'" class="login-button-wrapper">
                    <el-button
                        type="primary"
                        size="large"
                        :loading="LoginWaiting"
                        @click="Login"
                        class="login-button"
                    >
                        <el-icon><Unlock /></el-icon>
                        <span>登 录</span>
                    </el-button>
                </div>

                <!-- 隐私协议 -->
                <div v-if="SysConfig.EnablePrivacyPolicy" class="privacy-policy-wrapper">
                    <el-checkbox v-model="CheckPrivacyPolicy" class="privacy-checkbox">
                        <span class="privacy-text" @click.stop="ShowPrivacyPolicy = true">
                            {{ SysConfig.PrivacyPolicyName || "同意隐私协议" }}
                        </span>
                    </el-checkbox>
                </div>

                <!-- 底部提示 -->
                <div class="bottomTips">
                    <p v-if="SysConfig.EnableReg" class="register-link">
                        <a href="javascript:;" @click="OpenReg">
                            <el-icon><UserFilled /></el-icon>
                            <span>立即注册</span>
                        </a>
                    </p>
                    <p v-if="PageType == 'BindWeChat'">
                        <el-button type="primary" size="small" @click="BindWeChat()">
                            <el-icon><Right /></el-icon>
                            <span>立即绑定</span>
                        </el-button>
                    </p>
                    <div class="bottom-content" v-html="LoginBottomContent"></div>
                </div>
            </div>
            <div class="divLoginTime">
                <div style="position: absolute; bottom: 0; left: 0">
                    <p>{{ CurrentTime.Format("HH:mm:ss") }}</p>
                    <p>
                        {{ DiyCommon.Months[CurrentTime.getMonth()] + DiyCommon.GetLanDate(CurrentTime.getDate()) + ", " + DiyCommon.Weeks[CurrentTime.getDay()] }}
                    </p>
                </div>
            </div>

            <el-dialog width="800px" :append-to-body="true" v-model="ShowPrivacyPolicy" :title="SysConfig.PrivacyPolicyName || '同意隐私协议'" :close-on-click-modal="false" draggable>
                <div v-html="SysConfig.PrivacyPolicy" style="width: 100%; text-align: left"></div>
            </el-dialog>

            <!-- 用户注册对话框 -->
            <el-dialog 
                width="500px" 
                :append-to-body="true" 
                v-model="ShowRegSysUser" 
                title="用户注册" 
                :close-on-click-modal="false" 
                draggable
                class="register-dialog"
            >
                <el-form ref="form" :model="RegModel" label-width="100px" class="register-form">
                    <el-form-item label="手机号" prop="Phone">
                        <el-input 
                            v-model="RegModel.Phone" 
                            placeholder="请输入手机号"
                            clearable
                        />
                    </el-form-item>
                    <el-form-item label="密码" prop="Pwd">
                        <el-input 
                            v-model="RegModel.Pwd" 
                            type="password"
                            placeholder="请输入密码"
                            show-password
                            clearable
                        />
                    </el-form-item>
                    <el-form-item label="重复密码" prop="Pwd2">
                        <el-input 
                            v-model="RegModel.Pwd2" 
                            type="password"
                            placeholder="请再次输入密码"
                            show-password
                            clearable
                        />
                    </el-form-item>
                    <el-form-item label="图形验证码">
                        <el-input 
                            v-model="RegCaptchaValue" 
                            placeholder="请输入图形验证码"
                            clearable
                        >
                            <template #append>
                                <img 
                                    id="CaptchaImgReg" 
                                    class="reg-captcha-img" 
                                    src="" 
                                    @click="GetCaptcha(null, '#CaptchaImgReg', 'RegCaptchaId')" 
                                    title="点击刷新验证码"
                                />
                            </template>
                        </el-input>
                    </el-form-item>
                    <el-form-item label="短信验证码">
                        <el-input 
                            v-model="RegModel.SmsCaptchaValue" 
                            placeholder="请输入短信验证码"
                            clearable
                        >
                            <template #append>
                                <el-button 
                                    type="primary" 
                                    link 
                                    @click="SendSms"
                                    class="sms-button"
                                >
                                    获取验证码
                                </el-button>
                            </template>
                        </el-input>
                    </el-form-item>
                </el-form>
                <template #footer>
                    <div class="dialog-footer">
                        <el-button @click="ShowRegSysUser = false">取消</el-button>
                        <el-button type="primary" @click="Reg()">提交</el-button>
                    </div>
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
import { hasWebOS } from "@/utils/webos-detect.js";
import { storeToRefs } from "pinia";
// 浏览器原生支持 setInterval，不需要导入 Node.js 的 timers 模块
import Cookies from "js-cookie";
import { getLangs } from "@/utils/langs";
import JSEncrypt from "jsencrypt"; // RSA加密库
// Element Plus 图标
import { User, Key, Lock, UserFilled, Loading, Right, Unlock } from "@element-plus/icons-vue";
// 直接导入工具函数
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/utils/api.itdos";

export default {
    name: "Login",
    components: {
        User,
        Key,
        Lock,
        UserFilled,
        Loading,
        Right,
        Unlock
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
            DiyApi,
            hasWebOS
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
        // self.diyStore.setLoginCover(false);
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

        // 默认选中经典传统界面
        if (self.DiyCommon.IsNull(self.SystemStyle)) {
            self.diyStore.setState("SystemStyle", "Classic");
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
                "/api/DiyTable/GetSysConfig",
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
                        .get(self.DiyCommon.GetApiBase() + "/api/Captcha/GetCaptcha", {
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
            // this.diyStore.setLoginCover(false);
        },
        HiddenLogin() {
            // this.diyStore.setLoginCover(true);
        },
        TokenLogin() {
            var self = this;
            //token自动登录  2022-04-09
            //取所有单点登录
            var diySsoList = self.DiyCommon.Post(
                "/api/FormEngine/GetTableDataAnonymous",
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
                            self.diyStore.setState("SystemStyle", "Classic");
                        }
                        self.GotoSystem();
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
            self.diyStore.setState("SystemStyle", self.SystemStyle);

            document.body.classList.remove("Classic");
            document.body.classList.remove("WebOS");
            document.body.classList.remove("macOS");
            document.body.classList.remove("Windows");
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

            if (self.SystemStyle == "WebOS" || self.SystemStyle == "macOS" || self.SystemStyle == "Windows") {
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
                    } else if (url.startsWith("http") && !self.diyStore.IsPhoneView) {
                        window.location.href = url;
                        return;
                    }
                } else if (self.LoginResult.DataAppend && self.LoginResult.DataAppend.SysMenuHomePage && self.LoginResult.DataAppend.SysMenuHomePage.Url) {
                    url = self.LoginResult.DataAppend.SysMenuHomePage.Url;
                }
                
                // 检查是否是移动端设备，且没有指定redirect参数
                // 移动端默认跳转到移动端首页
                // if (self.diyStore.IsPhoneView) {
                //     url = "/mobile/home";
                //     console.log('[Login] 检测到移动端设备，跳转到移动端首页:', url);
                // }
                
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

<style lang="scss" scoped>
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

/* ==================== 登录输入框样式 ==================== */
.login-input-param.captcha{
    :deep(.el-input .el-input__wrapper){
        border-radius: 6px 0 0 6px;
    }
}
.login-input-param {
    margin-bottom: 20px;
    
    :deep(.el-input-group__append){
        padding : 0px;
    }
    :deep(.el-input) {
        .el-input__wrapper {
            border-radius: 6px;
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3) inset;
            background-color: rgba(255, 255, 255, 0.95);
            padding: 0;
            transition: all 0.3s ease;
            
            &:hover {
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6) inset;
                background-color: rgba(255, 255, 255, 1);
            }
            
            &.is-focus {
                box-shadow: 0 0 0 1px var(--el-color-primary) inset;
                background-color: rgba(255, 255, 255, 1);
            }
        }
        
        .el-input__prefix {
            margin-right: 0;
        }
        
        .el-input__inner {
            padding-left: 8px;
            height: 40px;
        }
    }
}

/* 图标容器样式 */
.input-icon-wrapper {
    width: 45px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 0px;
    margin-right: 10px;
    border-radius: 6px 0 0 6px;
    transition: all 0.3s ease;
    
    .el-icon {
        font-size: 20px;
    }
}

/* 验证码样式 */
.captcha-wrapper {
    padding: 0;
    background: transparent;
    
    .captcha-img {
        height: 40px;
        width: 120px;
        cursor: pointer;
        display: block;
        border-radius: 0 6px 6px 0;
        transition: opacity 0.3s ease;
        
        &:hover {
            opacity: 0.8;
        }
    }
}

/* ==================== 界面风格选择器样式 ==================== */
.style-selector-wrapper {
    margin-bottom: 8px;
    margin-top: 4px;

    .style-selector-label {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.85);
        margin-bottom: 10px;
        text-align: left;
        font-weight: 500;
        letter-spacing: 0.5px;
    }

    .style-selector-options {
        display: flex;
        gap: 10px;
        justify-content: center;
    }

    .style-option {
        flex: 1;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 5px;
        border-radius: 10px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.08);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        color: rgba(255, 255, 255, 0.8);

        &:hover {
            border-color: rgba(255, 255, 255, 0.45);
            background: rgba(255, 255, 255, 0.15);
            transform: translateY(-2px);
            color: #fff;
        }

        &.active {
            border-color: var(--el-color-primary);
            background: rgba(var(--el-color-primary-rgb, 64, 158, 255), 0.2);
            color: #fff;
            box-shadow: 0 0 16px rgba(var(--el-color-primary-rgb, 64, 158, 255), 0.3);

            .style-option-icon {
                color: var(--el-color-primary-light-3);
            }
        }

        .style-option-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
        }

        .style-option-text {
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
        }

        .style-option-check {
            position: absolute;
            top: 4px;
            right: 6px;
            font-size: 11px;
            color: var(--el-color-primary-light-3);
            font-weight: bold;
        }
    }
}

/* ==================== 登录按钮样式 ==================== */
.login-button-wrapper {
    margin-top: 30px;
    margin-bottom: 20px;
    text-align: center;
    
    .login-button {
        width: 60%;
        min-width: 200px;
        height: 45px;
        font-size: 16px;
        font-weight: 500;
        border-radius: 6px;
        transition: all 0.3s ease;
        
        .el-icon {
            margin-right: 8px;
            font-size: 18px;
        }
        
        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        &:active {
            transform: translateY(0);
        }
    }
}

/* ==================== 隐私协议样式 ==================== */
.privacy-policy-wrapper {
    margin-bottom: 20px;
    text-align: center;
    
    .privacy-checkbox {
        :deep(.el-checkbox__label) {
            color: #fff;
            font-size: 13px;
        }
        
        :deep(.el-checkbox__inner) {
            border-color: rgba(255, 255, 255, 0.6);
            background-color: transparent;
        }
        
        :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
            background-color: var(--el-color-primary);
            border-color: var(--el-color-primary);
        }
    }
    
    .privacy-text {
        cursor: pointer;
        text-decoration: underline;
        transition: opacity 0.3s ease;
        
        &:hover {
            opacity: 0.8;
        }
    }
}

/* ==================== 底部提示样式 ==================== */
.bottomTips {
    text-align: center;
    margin-top: 20px;
    color: rgba(255, 255, 255, 0.9);
    
    p {
        margin-bottom: 12px;
        padding: 0 10px;
    }
    
    a {
        color: #fff;
        text-decoration: none;
        transition: all 0.3s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        
        .el-icon {
            font-size: 16px;
        }
        
        &:hover {
            opacity: 0.8;
            text-decoration: underline;
        }
    }
    
    .register-link {
        a {
            font-size: 14px;
            font-weight: 500;
        }
    }
    
    :deep(.bottom-content) {
        font-size: 12px;
        line-height: 1.6;
        opacity: 0.85;
        
        p {
            margin: 8px 0;
        }
        a {
            color: #fff !important;
        }
    }
}

/* ==================== 系统预览图片样式 ==================== */
.imgSystemPreview {
    width: 370px;
    display: block;
    margin-bottom: 15px;
    border-radius: 8px;
    transition: all 0.3s ease;
    cursor: pointer;
    
    &:hover {
        transform: scale(1.02);
    }
    
    &.active {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        border: 2px solid var(--el-color-primary);
        transform: scale(1.05);
    }
}

/* ==================== 注册对话框样式 ==================== */
.register-dialog {
    :deep(.el-dialog__body) {
        padding: 20px 30px;
    }
    
    .register-form {
        .el-form-item {
            margin-bottom: 22px;
        }
    }
    
    .reg-captcha-img {
        height: 32px;
        cursor: pointer;
        display: block;
        transition: opacity 0.3s ease;
        
        &:hover {
            opacity: 0.8;
        }
    }
    
    .sms-button {
        font-size: 13px;
        padding: 0 15px;
    }
    
    .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }
}

/* ==================== 主登录容器样式 ==================== */
#divLogin {
    font-size: 12px;
    position: fixed;
    background-color: var(--taskbar-color);
    width: 100%;
    height: 100%;
    z-index: 99;
    color: #fff;
    text-align: center;
    left: 0;
    top: 0;
    transition: opacity 0.7s ease;
    overflow: hidden;
    display: block !important;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;

    .login-title {
        margin-bottom: 25px;
        font-size: 28px;
        font-weight: bold;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        
        span {
            display: block;
            margin-top: 8px;
            font-size: 16px !important;
            font-weight: normal;
            opacity: 0.9;
        }
    }

    .divLoginCenter {
        width: 420px;
        max-width: 90%;
        padding: 40px;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        margin-top: 0 !important;
        transition: all 0.7s ease;
        border-radius: 12px;
        :deep(.el-checkbox__input.is-checked + .el-checkbox__label){
            color: #fff !important;
        }
    }

    @media (min-width: 1365px) {
        .divLoginCenter {
            width: 500px;
            max-width: 90%;
            padding: 50px 60px;
        }
    }
    
    @media (max-width: 768px) {
        .divLoginCenter {
            width: 95%;
            padding: 30px 25px;
        }
        
        .login-title {
            font-size: 24px;
            
            span {
                font-size: 14px !important;
            }
        }
    }
}

/* ==================== 登录背景遮罩样式 ==================== */
.loginCenterBgCover {
    width: 100%;
    height: 100%;
    position: absolute;
    background: linear-gradient(135deg, 
        rgba(var(--el-color-primary-rgb, 64, 158, 255), 0.1) 0%,
        rgba(0, 0, 0, 0.4) 100%
    );
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    left: 0;
    top: 0;
    z-index: -1;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

/* ==================== 时间显示样式 ==================== */
#divLogin .divLoginTime {
    left: 5%;
    bottom: 7.5%;
    width: 400px;
    height: auto;
    position: fixed;
    transition: all 0.7s ease;
    
    p {
        text-align: left;
        color: #fff;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        margin: 5px 0;
        font-weight: 300;
        letter-spacing: 1px;
    }
}

/* ==================== 响应式字体大小 ==================== */
@media (max-width: 767px) {
    #divLogin .divLoginTime p {
        font-size: 18px;
    }
}

@media (min-width: 768px) {
    #divLogin .divLoginTime p {
        font-size: 24px;
    }
}

@media (min-width: 992px) {
    #divLogin .divLoginTime p {
        font-size: 30px;
    }
}

@media (min-width: 1200px) {
    #divLogin .divLoginTime p {
        font-size: 30px;
    }
}

/* ==================== 对话框通用优化 ==================== */
:deep(.el-dialog) {
    border-radius: 12px;
    overflow: hidden;
    
    .el-dialog__header {
        padding: 20px 30px;
        background: linear-gradient(135deg, var(--el-color-primary-light-3) 0%, var(--el-color-primary) 100%);
        
        .el-dialog__title {
            color: #fff;
            font-weight: 500;
        }
        
        .el-dialog__headerbtn .el-dialog__close {
            color: #fff;
            
            &:hover {
                color: rgba(255, 255, 255, 0.8);
            }
        }
    }
}

/* ==================== 动画效果 ==================== */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translate(-50%, -45%);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%);
    }
}

.divLoginCenter {
    animation: fadeInUp 0.6s ease-out;
}

/* ==================== 按钮统一样式 ==================== */
:deep(.el-button) {
    border-radius: 6px;
    font-weight: 500;
    transition: all 0.3s ease;
    
    &:hover {
        transform: translateY(-1px);
    }
    
    &:active {
        transform: translateY(0);
    }
}

</style>
