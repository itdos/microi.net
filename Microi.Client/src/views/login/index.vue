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
                <div class="login-brand" :class="{ 'has-subtitle': !!SystemSubTitle }">
                    <div
                        class="login-system-logo"
                        :class="{ 'is-fallback': !SystemLogoUrl || SystemLogoLoadFailed }"
                    >
                        <img
                            v-if="SystemLogoUrl && !SystemLogoLoadFailed"
                            :src="SystemLogoUrl"
                            :alt="(WebTitle || '吾码') + ' Logo'"
                            @error="HandleSystemLogoError"
                        />
                        <span v-else class="login-system-logo-fallback" aria-hidden="true">
                            {{ SystemLogoFallbackText }}
                        </span>
                        <span class="login-system-logo-ring" aria-hidden="true" />
                    </div>
                    <div class="login-title">
                        <div>
                            {{ WebTitle }}
                        </div>
                        <span v-if="SystemSubTitle">{{ SystemSubTitle }}</span>
                    </div>
                </div>

                <!-- 账号输入框 -->
                <div class="login-input-param">
                    <el-input 
                        v-model="Account" 
                        type="text" 
                        size="large"
                        :placeholder="$t('Msg.InputAccount')"
                        autocomplete="username"
                        @input="HandleAccountInput"
                    >
                        <template #prefix>
                            <div
                                class="input-icon-wrapper account-avatar-wrapper"
                                :class="{ 'has-avatar': CurrentAccountAvatarUrl }"
                                :style="{ backgroundColor: CurrentAccountAvatarUrl ? 'rgba(255, 255, 255, 0.96)' : (SysConfig.ThemeColor || '#409EFF') }"
                            >
                                <img
                                    v-if="CurrentAccountAvatarUrl"
                                    :src="CurrentAccountAvatarUrl"
                                    class="account-avatar-img"
                                    alt=""
                                    @error="HandleCurrentAccountAvatarError"
                                />
                                <el-icon v-else color="white"><User /></el-icon>
                            </div>
                        </template>
                        <template #suffix>
                            <el-popover
                                v-model:visible="AccountHistoryVisible"
                                placement="bottom-end"
                                trigger="click"
                                :width="340"
                                :teleported="true"
                                popper-class="login-account-history-popper"
                            >
                                <template #reference>
                                    <button
                                        type="button"
                                        class="input-suffix-action account-history-trigger"
                                        :class="{ 'is-open': AccountHistoryVisible }"
                                        :aria-expanded="AccountHistoryVisible ? 'true' : 'false'"
                                        aria-label="选择历史登录帐号"
                                        title="选择历史登录帐号"
                                        @mousedown.prevent
                                    >
                                        <el-icon><ArrowDown /></el-icon>
                                    </button>
                                </template>
                                <div class="account-history-panel">
                                    <div class="account-history-header">
                                        <div>
                                            <strong>历史登录帐号</strong>
                                            <span>选择后自动回填帐号和密码</span>
                                        </div>
                                        <button
                                            v-if="RememberedAccounts.length > 0"
                                            type="button"
                                            class="account-history-clear"
                                            @click="ClearRememberedAccounts"
                                        >
                                            清空
                                        </button>
                                    </div>
                                    <div v-if="RememberedAccounts.length > 0" class="account-history-list">
                                        <div
                                            v-for="item in RememberedAccounts"
                                            :key="item.Account"
                                            class="account-history-item"
                                            :class="{ 'is-current': IsCurrentRememberedAccount(item) }"
                                        >
                                            <button
                                                type="button"
                                                class="account-history-main"
                                                @click="SelectRememberedAccount(item)"
                                            >
                                                <span class="account-history-avatar">
                                                    <img
                                                        v-if="GetRememberedAvatarSource(item)"
                                                        :src="GetRememberedAvatarSource(item)"
                                                        alt=""
                                                        @error="HandleRememberedAvatarError(item)"
                                                    />
                                                    <el-icon v-else><User /></el-icon>
                                                </span>
                                                <span class="account-history-copy">
                                                    <strong>{{ item.Account }}</strong>
                                                    <span>{{ item.DisplayName || '已记住密码' }}</span>
                                                </span>
                                                <el-icon v-if="IsCurrentRememberedAccount(item)" class="account-history-check"><Check /></el-icon>
                                            </button>
                                            <button
                                                type="button"
                                                class="account-history-delete"
                                                :aria-label="'删除帐号 ' + item.Account"
                                                :title="'删除帐号 ' + item.Account"
                                                @click.stop="RemoveRememberedAccount(item)"
                                            >
                                                <el-icon><Delete /></el-icon>
                                            </button>
                                        </div>
                                    </div>
                                    <div v-else class="account-history-empty">
                                        <span class="account-history-avatar">
                                            <el-icon><User /></el-icon>
                                        </span>
                                        <div>
                                            <strong>暂无历史帐号</strong>
                                            <span>勾选“记住密码”并登录成功后会显示在这里</span>
                                        </div>
                                    </div>
                                </div>
                            </el-popover>
                        </template>
                    </el-input>
                </div>

                <!-- 密码输入框 -->
                <div class="login-input-param pwd">
                    <el-input 
                        v-model="Pwd" 
                        :type="showPassword ? 'text' : 'password'" 
                        size="large"
                        :placeholder="$t('Msg.InputPwd')" 
                        autocomplete="current-password"
                        @keyup.enter="Login"
                    >
                        <template #prefix>
                            <div class="input-icon-wrapper" :style="{ backgroundColor: SysConfig.ThemeColor || '#409EFF' }">
                                <el-icon color="white"><Key /></el-icon>
                            </div>
                        </template>
                        <template #suffix>
                            <button
                                type="button"
                                class="input-suffix-action"
                                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                                :title="showPassword ? '隐藏密码' : '显示密码'"
                                @mousedown.prevent
                                @click="showPassword = !showPassword"
                            >
                                <el-icon
                                    class="password-visibility-icon"
                                >
                                    <View v-if="showPassword" />
                                    <Hide v-else />
                                </el-icon>
                            </button>
                        </template>
                    </el-input>
                </div>

                <!-- 验证码输入框 -->
                <div v-if="EnableCaptcha" class="login-input-param captcha">
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
                        <template #append v-if="EnableCaptcha">
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

                <div class="login-preferences-row">
                    <el-checkbox
                        v-model="RememberPassword"
                        class="remember-password-checkbox"
                        :class="{ 'is-remembered': RememberPassword }"
                    >
                        <span class="remember-password-label">记住密码</span>
                    </el-checkbox>
                </div>

                <!-- 登录按钮 -->
                <div v-if="PageType != 'BindWeChat'" class="login-button-wrapper">
                    <button
                        type="button"
                        :disabled="LoginWaiting"
                        :aria-busy="LoginWaiting ? 'true' : 'false'"
                        @click="Login"
                        class="login-button"
                        :class="{ 'is-charging': LoginWaiting }"
                    >
                        <span class="login-button-energy" aria-hidden="true">
                            <span class="login-button-energy-beam" />
                        </span>
                        <span class="login-button-content">
                            <el-icon v-if="LoginWaiting" class="is-loading"><Loading /></el-icon>
                            <el-icon v-else><Unlock /></el-icon>
                            <span>{{ LoginWaiting ? '正在安全接入...' : '登录' }}</span>
                        </span>
                    </button>
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
                    <div class="bottom-content" v-safe-html="LoginBottomContent"></div>
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

            <el-dialog width="800px" 
                :append-to-body="true" 
                v-model="ShowPrivacyPolicy" 
                :title="SysConfig.PrivacyPolicyName || '同意隐私协议'" 
                :close-on-click-modal="false"
                draggable
                align-center>
                <div v-safe-html="SysConfig.PrivacyPolicy" style="width: 100%; text-align: left"></div>
            </el-dialog>

            <!-- 用户注册对话框 -->
            <el-dialog 
                width="500px" 
                :append-to-body="true" 
                v-model="ShowRegSysUser" 
                title="用户注册" 
                :close-on-click-modal="false" 
                draggable
                align-center
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
import { storeToRefs } from "pinia";
// 浏览器原生支持 setInterval，不需要导入 Node.js 的 timers 模块
import Cookies from "js-cookie";
import { getLangs } from "@/utils/langs";
import JSEncrypt from "jsencrypt"; // RSA加密库
// Element Plus 图标
import { ArrowDown, Check, Delete, User, Key, Lock, UserFilled, Loading, Right, Unlock, View, Hide } from "@element-plus/icons-vue";
// 直接导入工具函数
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/utils/api.itdos";
import { getFirstValidRoutePath, hasAccessibleRoutePath, normalizeMenuRoutePath } from "@/pinia/modules/permission";
import { getStoredLanguage, resolveSysLocale } from "@/lang";
import { resolveLoginSystemLogoUrl } from "@/utils/login-branding.js";
import config from "@/config.json";
import {
    clearRememberedLoginAccounts,
    readRememberedLoginAccounts,
    removeRememberedLoginAccount,
    updateRememberedLoginAccountProfile,
    upsertRememberedLoginAccount
} from "@/utils/login-credential-history.js";

// 历史兼容公钥：仅用于避免登录密码在请求体中直接显示，不替代 HTTPS。
// 显式部署配置仍然优先；未配置时保持旧版客户端与旧版服务端完全兼容。
const DEFAULT_LOGIN_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R
XaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ
1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg
1DsI9VJ7gTHGL3R7sQIDAQAB
-----END PUBLIC KEY-----`;

const resolveLoginRsaPublicKey = (serverPublicKey = "") => {
    if (config && config.LoginRsaPublicKey === false) return "";
    return (config && config.LoginRsaPublicKey)
        || window.MicroiLoginPublicKey
        || serverPublicKey
        || DEFAULT_LOGIN_RSA_PUBLIC_KEY;
};

export default {
    name: "Login",
    components: {
        ArrowDown,
        Check,
        Delete,
        User,
        Key,
        Lock,
        UserFilled,
        Loading,
        Right,
        Unlock,
        View,
        Hide
    },
    beforeCreate() {},
    setup() {
        // Pinia stores
        const diyStore = useDiyStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const settingsStore = useSettingsStore();
        const userStore = useUserStore();
        const permissionStore = usePermissionStore();
        const router = useRouter();
        const route = useRoute();

        // 使用 storeToRefs 保持响应性
        const { CurrentTime, DesktopBg, LoginCover, OsClient, Lang, WebTitle, SystemSubTitle, ClientCompany, ClientCompanyUrl, SysConfig } = storeToRefs(diyStore);

        const { title } = storeToRefs(settingsStore);

        const SystemStyle = computed(() => diyStore.SystemStyle || "Classic");

        return {
            // Pinia store 实例
            diyStore,
            GetCurrentUser,
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
        },
        EnableCaptcha() {
            return this.isEnabledFlag(this.SysConfig?.EnableCaptcha);
        },
        SystemLogoUrl() {
            return resolveLoginSystemLogoUrl(
                this.SysConfig?.SysLogo,
                (value, returnNoImg) => this.DiyCommon.GetServerPath(value, returnNoImg)
            );
        },
        SystemLogoFallbackText() {
            var title = String(this.SysConfig?.SysShortTitle || this.WebTitle || "M").trim();
            return title ? title.charAt(0).toUpperCase() : "M";
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
            showPassword: false,
            RememberPassword: false,
            RememberedAccounts: [],
            AccountHistoryVisible: false,
            SelectedRememberedAccount: "",
            CurrentAccountAvatarUrl: "",
            AvatarResolveVersion: 0,
            SystemLogoLoadFailed: false,
            LoginComponentUnmounted: false,
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
            // 优先使用部署配置；未配置时使用历史公钥，保证存量客户平滑升级。
            // RSA 只避免请求体中出现明文密码，生产环境仍必须强制 HTTPS。
            publicKey: resolveLoginRsaPublicKey()
            // TokenLoginCount : 0
        };
    },
    // Vue 3: beforeDestroy 改为 beforeUnmount
    beforeUnmount() {
        var self = this;
        self.LoginComponentUnmounted = true;
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
        },
        OsClient: function (value, previousValue) {
            if (value === previousValue) return;
            this.LoadRememberedAccounts();
            this.RestoreRememberedAccount(this.Account || this.diyStore.getLastLoginAccount());
        },
        GetCurrentUser: function () {
            this.RefreshCurrentAccountAvatar();
        },
        SystemLogoUrl: function () {
            this.SystemLogoLoadFailed = false;
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

        // 登录页只负责身份验证，界面风格登录后再切换；每次进入默认使用经典传统界面。
        self.diyStore.setState("SystemStyle", "Classic");
        $("#divLogin").css({
            opacity: 1
        });
        // 已改用 CSS transform: translate(-50%, -50%) 实现居中，无需 jQuery 计算

        self.LoadRememberedAccounts();
        var lastAccount = self.diyStore.getLastLoginAccount();
        if (!self.DiyCommon.IsNull(lastAccount)) {
            self.RestoreRememberedAccount(lastAccount);
        } else {
            self.RefreshCurrentAccountAvatar();
        }
        self.$nextTick(function () {
            if (self.DiyCommon.ShowVideo()) {
                self.DiyCommon.LoadVideoLogin();
            }
        });

        try {
            self.DiyCommon.PostAsync(
                "/api/FormEngine/GetSysConfig",
                {
                    _SearchEqual: {
                        IsEnable: 1
                    },
                    OsClient: self.OsClient
                },
                function (sysConfigResult) {
                    if (sysConfigResult.Code == 1) {
                        var sysConfig = sysConfigResult.Data;
                        // 服务端可以公开与部署私钥配对的公钥；本地显式配置仍优先。
                        self.publicKey = resolveLoginRsaPublicKey(
                            sysConfig && sysConfig.LoginRsaPublicKey
                                ? String(sysConfig.LoginRsaPublicKey).replace(/\\n/g, "\n").trim()
                                : ""
                        );
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
        isEnabledFlag(value) {
            if (value === true || value === 1) return true;
            if (typeof value === "string") {
                var text = value.trim().toLowerCase();
                return text === "1" || text === "true" || text === "yes" || text === "on";
            }
            return false;
        },
        HandleSystemLogoError() {
            this.SystemLogoLoadFailed = true;
        },
        NormalizeLoginAccount(value) {
            return String(value == null ? "" : value).trim().toLowerCase();
        },
        GetCredentialStorageOptions() {
            return {
                storage: window.localStorage,
                osClient: this.OsClient
            };
        },
        FindRememberedAccount(account) {
            var normalized = this.NormalizeLoginAccount(account);
            return this.RememberedAccounts.find((item) => this.NormalizeLoginAccount(item.Account) === normalized) || null;
        },
        LoadRememberedAccounts() {
            this.RememberedAccounts = readRememberedLoginAccounts(this.GetCredentialStorageOptions());
        },
        RestoreRememberedAccount(account) {
            var value = String(account == null ? "" : account).trim();
            this.Account = value;
            var remembered = this.FindRememberedAccount(value);
            if (remembered) {
                this.Pwd = remembered.Password;
                this.RememberPassword = true;
                this.SelectedRememberedAccount = remembered.Account;
            } else {
                this.Pwd = "";
                this.RememberPassword = false;
                this.SelectedRememberedAccount = "";
            }
            this.RefreshCurrentAccountAvatar();
        },
        HandleAccountInput(value) {
            if (
                this.SelectedRememberedAccount
                && this.NormalizeLoginAccount(value) !== this.NormalizeLoginAccount(this.SelectedRememberedAccount)
            ) {
                // 避免切换/编辑帐号后仍误用上一个帐号的已回填密码。
                this.Pwd = "";
                this.SelectedRememberedAccount = "";
            }
            this.RefreshCurrentAccountAvatar();
        },
        SelectRememberedAccount(item) {
            if (!item) return;
            this.Account = item.Account;
            this.Pwd = item.Password;
            this.RememberPassword = true;
            this.SelectedRememberedAccount = item.Account;
            this.AccountHistoryVisible = false;
            this.RefreshCurrentAccountAvatar();
        },
        RemoveRememberedAccount(item) {
            if (!item) return;
            var isSelected = this.NormalizeLoginAccount(this.Account) === this.NormalizeLoginAccount(item.Account);
            this.RememberedAccounts = removeRememberedLoginAccount({
                ...this.GetCredentialStorageOptions(),
                account: item.Account
            });
            if (isSelected) {
                this.Pwd = "";
                this.RememberPassword = false;
                this.SelectedRememberedAccount = "";
            }
            this.RefreshCurrentAccountAvatar();
        },
        ClearRememberedAccounts() {
            var self = this;
            self.AccountHistoryVisible = false;
            self.DiyCommon.OsConfirm("确认清空当前系统已记住的全部登录帐号？", function () {
                clearRememberedLoginAccounts(self.GetCredentialStorageOptions());
                self.RememberedAccounts = [];
                self.Pwd = "";
                self.RememberPassword = false;
                self.SelectedRememberedAccount = "";
                self.RefreshCurrentAccountAvatar();
            });
        },
        IsCurrentRememberedAccount(item) {
            return !!item && this.NormalizeLoginAccount(item.Account) === this.NormalizeLoginAccount(this.Account);
        },
        GetRememberedAvatarSource(item) {
            if (!item) return "";
            if (item.AvatarDataUrl) return item.AvatarDataUrl;
            var avatar = String(item.Avatar || "").trim();
            if (/^(?:https?:|data:)/i.test(avatar) || avatar.startsWith(".")) return avatar;
            return "";
        },
        HandleCurrentAccountAvatarError() {
            this.AvatarResolveVersion += 1;
            this.CurrentAccountAvatarUrl = "";
        },
        HandleRememberedAvatarError(item) {
            if (!item) return;
            item.AvatarDataUrl = "";
            item.Avatar = "";
            if (this.IsCurrentRememberedAccount(item)) {
                this.CurrentAccountAvatarUrl = "";
            }
        },
        async RefreshCurrentAccountAvatar() {
            var resolveVersion = ++this.AvatarResolveVersion;
            var account = this.NormalizeLoginAccount(this.Account);
            var remembered = this.FindRememberedAccount(account);
            this.CurrentAccountAvatarUrl = this.GetRememberedAvatarSource(remembered);

            var currentUser = this.GetCurrentUser || {};
            if (!account || this.NormalizeLoginAccount(currentUser.Account) !== account) return;
            var avatar = String(currentUser.Avatar || currentUser.HeadIcon || currentUser.HeadImg || "").trim();
            if (!avatar) return;

            var canResolveWithoutToken = /^(?:https?:|data:|blob:)/i.test(avatar) || avatar.startsWith(".");
            if (!canResolveWithoutToken && !this.DiyCommon.getToken()) return;
            var avatarUrl = await this.DiyCommon.GetUserAvatarUrl(avatar, currentUser.Id);
            if (
                resolveVersion === this.AvatarResolveVersion
                && account === this.NormalizeLoginAccount(this.Account)
                && avatarUrl
            ) {
                this.CurrentAccountAvatarUrl = avatarUrl;
            }
        },
        PersistRememberedLogin(user) {
            var account = String((user && user.Account) || this.Account || "").trim();
            if (!account) return;
            var options = {
                ...this.GetCredentialStorageOptions(),
                account: account
            };
            if (this.RememberPassword) {
                this.RememberedAccounts = upsertRememberedLoginAccount({
                    ...options,
                    password: this.Pwd,
                    user: user
                });
                var savedAccount = this.FindRememberedAccount(account);
                if (!savedAccount || savedAccount.Password !== this.Pwd) {
                    this.DiyCommon.Tips("当前浏览器无法保存记住密码记录，请检查本地存储权限。", false);
                    return;
                }
                this.SelectedRememberedAccount = account;
                this.CacheRememberedAccountAvatar(user);
            } else {
                this.RememberedAccounts = removeRememberedLoginAccount(options);
                this.SelectedRememberedAccount = "";
            }
        },
        async CacheRememberedAccountAvatar(user) {
            var account = String((user && user.Account) || this.Account || "").trim();
            var avatar = String((user && (user.Avatar || user.HeadIcon || user.HeadImg)) || "").trim();
            if (!account || !avatar || !this.FindRememberedAccount(account)) return;
            try {
                var avatarUrl = await this.DiyCommon.GetUserAvatarUrl(avatar, user && user.Id);
                var avatarDataUrl = await this.CreateAvatarThumbnailDataUrl(avatarUrl);
                if (!avatarDataUrl) return;
                updateRememberedLoginAccountProfile({
                    ...this.GetCredentialStorageOptions(),
                    account: account,
                    user: user,
                    avatarDataUrl: avatarDataUrl
                });
                if (!this.LoginComponentUnmounted) {
                    this.LoadRememberedAccounts();
                    this.RefreshCurrentAccountAvatar();
                }
            } catch (error) {
                // 头像快照是体验增强；失败时保留帐号密码记录并回退到默认用户图标。
            }
        },
        async CreateAvatarThumbnailDataUrl(source) {
            var avatarUrl = String(source || "").trim();
            if (!avatarUrl || typeof window.fetch !== "function") return "";
            var objectUrl = "";
            try {
                var absoluteUrl = new URL(avatarUrl, window.location.href);
                var response = await window.fetch(absoluteUrl.href, {
                    credentials: absoluteUrl.origin === window.location.origin ? "include" : "omit",
                    cache: "force-cache"
                });
                if (!response.ok) return "";
                var blob = await response.blob();
                if (!blob || blob.size > 4 * 1024 * 1024 || (blob.type && !blob.type.startsWith("image/"))) return "";
                objectUrl = URL.createObjectURL(blob);
                var image = await new Promise(function (resolve, reject) {
                    var element = new Image();
                    element.onload = function () { resolve(element); };
                    element.onerror = reject;
                    element.src = objectUrl;
                });
                var side = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
                if (!side) return "";
                var canvas = document.createElement("canvas");
                canvas.width = 64;
                canvas.height = 64;
                var context = canvas.getContext("2d");
                if (!context) return "";
                var sourceX = ((image.naturalWidth || image.width) - side) / 2;
                var sourceY = ((image.naturalHeight || image.height) - side) / 2;
                context.drawImage(image, sourceX, sourceY, side, side, 0, 0, 64, 64);
                return canvas.toDataURL("image/png");
            } catch (error) {
                return "";
            } finally {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
            }
        },
        normalizeIframeRouteUrl(url) {
            if (!url) return url;
            var rawUrl = String(url).trim();
            if (rawUrl.startsWith("/iframe/")) {
                rawUrl = rawUrl.replace("/iframe/", "");
            }
            try {
                rawUrl = decodeURIComponent(rawUrl);
            } catch (error) { }
            return "/iframe/" + encodeURIComponent(rawUrl);
        },
        // RSA加密密码
        encryptPassword(password) {
            var self = this;
            try {
                if (!self.publicKey || !String(self.publicKey).trim()) {
                    return password;
                }
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
            let currentLang = resolveSysLocale(this.SysConfig, getStoredLanguage());
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
                if (self.isEnabledFlag(sysConfig.EnableCaptcha) || imgId) {
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
            //token自动登录
            // 直接检测URL中的token参数，无需Diy_Sso配置即可自动登录
            var directTokenMatch = /[?&]token=([^&;#]+)/i.exec(location.href);
            if (!directTokenMatch) {
                directTokenMatch = /[?&]token%3D([^&;#]+)/i.exec(location.href);
            }
            var directToken = directTokenMatch ? decodeURIComponent(directTokenMatch[1].replace(/\+/g, "%20")) : null;
            if (!self.DiyCommon.IsNull(directToken) && directToken != "$V8.CurrentToken$") {
                console.log("-------> SsoLogin direct token login：" + directToken);
                var newtoken = directToken.replace("Bearer%20", "").replace("Bearer ", "");
                self.DiyCommon.setToken(newtoken);
                self.DiyCommon.Post(
                    self.DiyApi.TokenLogin(),
                    {
                        _token: directToken,
                        Token: directToken,
                        OsClient: self.OsClient
                    },
                    function (result) {
                        console.log("-------> SsoLogin direct tokenLogin result：", result);
                        if (result.Code == 1) {
                            self.LoginResult = result;
                            self.diyStore.setCurrentUser(result.Data);
                            self.diyStore.setState("SystemStyle", "Classic");
                            self.GotoSystem();
                        }
                    }
                );
                return;
            }
            // 无直接token参数，回退到Diy_Sso配置方式
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
                                    function (ssoResult) {
                                        console.log("-------> SsoLogin ssoApiResult：", ssoResult);
                                        if (ssoResult.Code == 1) {
                                            self.LoginResult = ssoResult;
                                            self.diyStore.setCurrentUser(ssoResult.Data);
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

            if (self.DiyCommon.IsNull(self.Account)) {
                self.DiyCommon.Tips("请输入账号！", false);
                return;
            }

            if (self.DiyCommon.IsNull(self.Pwd)) {
                self.DiyCommon.Tips("请输入密码！", false);
                return;
            }

            if (self.SysConfig.EnablePrivacyPolicy && !self.CheckPrivacyPolicy) {
                self.DiyCommon.Tips(`请先勾选[${self.SysConfig.PrivacyPolicyName || "同意隐私协议"}]！`, false);
                return;
            }

            // 加密密码
            var encryptedPwd = self.encryptPassword(self.Pwd);
            if (!encryptedPwd) {
                return;
            }

            self.LoginWaiting = true;

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
                _ClientType: self.diyStore.IsPhoneView ? "Mobile" : "PC"
            };
            if (self.EnableCaptcha) {
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
                    self.PersistRememberedLogin(result.Data || {});
                    self.diyStore.setState("SystemStyle", "Classic");
                    self.GotoSystem();
                } else {
                    if (self.EnableCaptcha) {
                        self.GetCaptcha();
                        self.CaptchaValue = "";
                    }
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
            let accessRoutes = [];
            try {
                // 设置用户身份之前销毁登录页面视频
                self.DiyCommon.DisposeVideoLogin();
                self.diyStore.setCurrentUser(self.LoginResult.Data);

                // Login requests use DiyCommon's axios path, while route guards use
                // the user Pinia store. Synchronize them before generating routes so
                // the first detail/metadata requests cannot be sent without a token.
                self.userStore.setToken(self.DiyCommon.getToken());

                // 设置用户角色到 userStore (用于 permission.js 检查)
                const roles = self.LoginResult.Data.Roles || ["admin"];
                self.userStore.setRoles(roles);
                self.userStore.setName(self.LoginResult.Data.Name || self.LoginResult.Data.Account);
                self.userStore.setAvatar(self.LoginResult.Data.Avatar || "");


                // 立即生成动态路由（修复：登录后无法跳转的问题）
                console.log('[Login] 开始加载动态路由...');
                const permissionStore = self.permissionStore;
                accessRoutes = await permissionStore.generateRoutes(roles);
                // 动态添加路由
                accessRoutes.forEach((route) => {
                    try {
                        self.$router.addRoute(route);
                    } catch (routeError) {
                        console.warn("[Login] addRoute failed:", route && route.path, routeError);
                    }
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
                var fallbackUrl = getFirstValidRoutePath(accessRoutes.length > 0 ? accessRoutes : self.permissionStore.addRoutes);
                // 优先级：用户个人首页 > 系统默认首页 > 菜单首页 > 首个有权限菜单。
                // 个人设置只接受内部路由，避免把普通用户字段变成外部跳转入口。
                var userDefaultIndexUrl = self.LoginResult.Data && self.LoginResult.Data.DefaultIndexUrl
                    ? String(self.LoginResult.Data.DefaultIndexUrl).trim()
                    : "";
                if (userDefaultIndexUrl && !/^(https?:)?\/\//i.test(userDefaultIndexUrl)) {
                    url = userDefaultIndexUrl;
                } else if (self.SysConfig && self.SysConfig.DefaultIndexUrl) {
                    url = String(self.SysConfig.DefaultIndexUrl || "");
                    url = url.replace("$V8.CurrentToken$", self.DiyCommon.getToken());
                    if (url.startsWith("/iframe/")) {
                        url = self.normalizeIframeRouteUrl(url);
                    } else if (url.startsWith("http") && !self.diyStore.IsPhoneView) {
                        window.location.href = url;
                        return;
                    }
                } else if (self.LoginResult.DataAppend && self.LoginResult.DataAppend.SysMenuHomePage && self.LoginResult.DataAppend.SysMenuHomePage.Url) {
                    url = String(self.LoginResult.DataAppend.SysMenuHomePage.Url || "");
                }
                if (url && url.startsWith("http") && !self.diyStore.IsPhoneView) {
                    window.location.href = url;
                    return;
                }
                url = normalizeMenuRoutePath(url || fallbackUrl || "/");
                var isRegisteredRoute = function (targetPath) {
                    if (hasAccessibleRoutePath(accessRoutes, targetPath)) return true;
                    var resolved = self.$router.resolve(targetPath);
                    return resolved.matched.some(function (record) {
                        return record.name !== "page_404" && String(record.path || "").indexOf(":pathMatch") === -1;
                    });
                };
                if (!isRegisteredRoute(url) && fallbackUrl) {
                    url = fallbackUrl;
                }
                
                // 检查是否是移动端设备，且没有指定redirect参数
                // 移动端默认跳转到移动端首页
                // if (self.diyStore.IsPhoneView) {
                //     url = "/mobile/home";
                //     console.log('[Login] 检测到移动端设备，跳转到移动端首页:', url);
                // }
                
                var useDefaultTarget = self.DiyCommon.IsNull(self.redirect) || self.redirect == "/";
                var targetPath = useDefaultTarget ? url : normalizeMenuRoutePath(self.redirect);
                if (!isRegisteredRoute(targetPath) && fallbackUrl) {
                    targetPath = fallbackUrl;
                }
                self.$router.push({
                    path: targetPath,
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

            self.$nextTick(async function () {
                if (self.LoginResult.DataAppend.SysConfig) {
                    self.diyStore.setSysConfig(self.LoginResult.DataAppend.SysConfig);
                    if (!self.DiyCommon.IsNull(self.LoginResult.DataAppend.SysConfig.LoginEndV8Code)) {
                        var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                        if (!V8.CurrentUser) {
                            V8.CurrentUser = self.GetCurrentUser;
                        }
                        try {
                            V8.EventName = "LoginEnd";
                            await eval("(async () => {\n " + self.LoginResult.DataAppend.SysConfig.LoginEndV8Code + " \n})()");
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
            });
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

/* ==================== 品牌标题与系统 Logo ==================== */
.login-brand {
    --mci-login-brand-height: 40px;
    --mci-login-brand-subtitle-line-height: 20px;
    --mci-login-brand-subtitle-gap: 2px;
    position: relative;
    z-index: 1;
    margin-bottom: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    text-align: left;

    &.has-subtitle {
        --mci-login-brand-height: 58px;
    }

    .login-title {
        width: auto;
        height: var(--mci-login-brand-height);
        min-width: 0;
        max-width: calc(100% - var(--mci-login-brand-height) - 14px);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;

        > div {
            overflow: hidden;
            line-height: var(--mci-login-brand-height);
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        > span {
            overflow: hidden;
            line-height: var(--mci-login-brand-subtitle-line-height);
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    &.has-subtitle .login-title > div {
        line-height: calc(
            var(--mci-login-brand-height) - var(--mci-login-brand-subtitle-line-height) - var(--mci-login-brand-subtitle-gap)
        );
    }
}

.login-system-logo {
    width: var(--mci-login-brand-height);
    height: var(--mci-login-brand-height);
    padding: 3px;
    box-sizing: border-box;
    position: relative;
    flex: 0 0 var(--mci-login-brand-height);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 50%;
    background: var(--mci-login-logo-bg);
    box-shadow: var(--mci-login-logo-shadow);

    img {
        width: 100%;
        height: 100%;
        display: block;
        border-radius: 50%;
        object-fit: contain;
    }

    &.is-fallback {
        background: var(--mci-login-button-gradient);
    }
}

.login-system-logo-fallback {
    color: var(--mci-login-text-strong);
    font-size: clamp(16px, 2vw, 21px);
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
}

.login-system-logo-ring {
    position: absolute;
    inset: -4px;
    z-index: -1;
    border: 0;
    border-radius: 50%;
    background: var(--mci-login-logo-halo);
    filter: blur(3px);
    opacity: 0.5;
    pointer-events: none;
    transform: scale(0.94);
    animation: mciLoginLogoPulse 5.2s ease-in-out infinite;
}

/* ==================== 登录输入框样式 ==================== */
.login-input-param {
    margin-bottom: 20px;

    :deep(.el-input-group__append) {
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none !important;
    }

    :deep(.el-input) {
        .el-input__wrapper {
            min-height: 48px;
            box-sizing: border-box;
            border: 1px solid transparent;
            border-radius: var(--mci-login-control-radius);
            background: var(--mci-login-input-bg);
            box-shadow: var(--mci-login-input-shadow) !important;
            padding: 0;
            transition: border-color 180ms ease, background-color 180ms ease;

            &:hover {
                border-color: var(--mci-login-input-border-hover);
                background: var(--mci-login-input-bg-hover);
            }

            &.is-focus {
                border-color: var(--mci-login-input-border-focus);
                background: var(--mci-login-input-bg-hover);
                box-shadow: var(--mci-login-input-focus-shadow) !important;
            }
        }

        .el-input__prefix {
            margin-right: 0;
        }

        .el-input__suffix {
            margin-left: 0;
        }
        
        .el-input__inner {
            padding-left: 8px;
            height: 46px;
        }
    }
}

.login-input-param.captcha {
    :deep(.el-input) {
        border: 1px solid transparent;
        border-radius: var(--mci-login-control-radius);
        background: var(--mci-login-input-bg);
        box-shadow: var(--mci-login-input-shadow);
        overflow: hidden;
        transition: border-color 180ms ease, background-color 180ms ease;

        &:hover {
            border-color: var(--mci-login-input-border-hover);
            background: var(--mci-login-input-bg-hover);
        }

        &:focus-within {
            border-color: var(--mci-login-input-border-focus);
            background: var(--mci-login-input-bg-hover);
            box-shadow: var(--mci-login-input-focus-shadow);
        }
    }

    :deep(.el-input .el-input__wrapper) {
        min-height: 46px;
        border: 0;
        border-radius: var(--mci-login-control-radius) 0 0 var(--mci-login-control-radius);
        background: transparent;
        box-shadow: none !important;
    }
}

.account-avatar-wrapper.has-avatar {
    box-shadow: none;
}

.account-avatar-img {
    width: 30px;
    height: 30px;
    display: block;
    border-radius: 50%;
    object-fit: cover;
    background: var(--el-fill-color-light, #f5f7fa);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.input-suffix-action {
    width: 44px;
    height: 46px;
    padding: 0;
    border: 0;
    outline: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-secondary, #909399);
    background: transparent;
    cursor: pointer;
    border-radius: 8px;
    transition: color 180ms ease, background-color 180ms ease, transform 180ms ease;

    &:hover,
    &:focus-visible {
        color: var(--el-color-primary);
        background: var(--el-fill-color-light, #f5f7fa);
    }

    &:active {
        transform: scale(0.94);
    }

    .el-icon {
        font-size: 18px;
    }
}

.account-history-trigger .el-icon {
    transition: transform 180ms ease;
}

.account-history-trigger.is-open .el-icon {
    transform: rotate(180deg);
}

.login-preferences-row {
    min-height: 44px;
    margin: -4px 0 10px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    text-align: left;
}

.remember-password-checkbox {
    height: 44px !important;
    min-height: 44px !important;
    padding: 0 14px 0 10px;
    box-sizing: border-box;
    border: 0;
    border-radius: var(--mci-login-control-radius);
    flex: 0 0 auto;
    background: var(--mci-login-control-bg);
    box-shadow: var(--mci-login-control-shadow);
    transition: transform 180ms ease, background-color 180ms ease;

    &:hover {
        background: var(--mci-login-control-bg-hover);
        transform: translateY(-1px);
    }

    &:active {
        transform: scale(0.98);
    }

    &.is-remembered {
        background: var(--mci-login-control-active-bg);
    }

    :deep(.el-checkbox__input) {
        display: inline-flex;
        align-items: center;
    }

    :deep(.el-checkbox__label) {
        padding-left: 9px;
        color: var(--mci-login-text-strong);
    }

    :deep(.el-checkbox__inner) {
        width: 18px;
        height: 18px;
        border: 1px solid var(--mci-login-checkbox-border);
        border-radius: 5px;
        background: var(--mci-login-checkbox-bg);
        transition: transform 180ms ease, border-color 180ms ease, background-color 180ms ease;
    }

    :deep(.el-checkbox__inner::after) {
        width: 4px;
        height: 8px;
        left: 8px;
        top: 8px;
        border-width: 0 2px 2px 0;
    }

    :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
        border-color: transparent;
        background: var(--mci-login-button-gradient);
        box-shadow: none;
        transform: scale(1.02);
    }

    :deep(.el-checkbox__input.is-focus .el-checkbox__inner) {
        outline: none;
    }

    :deep(.el-checkbox__original:focus-visible + .el-checkbox__inner) {
        outline: 2px solid var(--mci-login-electric);
        outline-offset: 2px;
    }
}

.remember-password-label {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.35px;
}

:global(.login-account-history-popper.el-popper) {
    max-width: calc(100vw - 24px);
    padding: 0 !important;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid var(--el-border-color-light, #e4e7ed) !important;
    border-radius: 14px !important;
    background: var(--el-bg-color-overlay, #fff) !important;
    box-shadow: 0 16px 42px rgba(31, 41, 55, 0.2), 0 3px 10px rgba(31, 41, 55, 0.08) !important;
}

:global(.login-account-history-popper .account-history-panel) {
    color: var(--el-text-color-primary, #303133);
}

:global(.login-account-history-popper .account-history-header) {
    min-height: 64px;
    padding: 13px 14px 11px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
    background: linear-gradient(135deg, var(--el-color-primary-light-9, #ecf5ff), var(--el-bg-color-overlay, #fff));
}

:global(.login-account-history-popper .account-history-header > div) {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

:global(.login-account-history-popper .account-history-header strong) {
    font-size: 14px;
    line-height: 1.35;
}

:global(.login-account-history-popper .account-history-header span) {
    color: var(--el-text-color-secondary, #909399);
    font-size: 11px;
    line-height: 1.35;
}

:global(.login-account-history-popper .account-history-clear) {
    min-width: 44px;
    min-height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 8px;
    color: var(--el-color-danger, #f56c6c);
    background: transparent;
    cursor: pointer;
}

:global(.login-account-history-popper .account-history-clear:hover),
:global(.login-account-history-popper .account-history-clear:focus-visible) {
    background: var(--el-color-danger-light-9, #fef0f0);
    outline: none;
}

:global(.login-account-history-popper .account-history-list) {
    max-height: 304px;
    padding: 8px;
    overflow: auto;
}

:global(.login-account-history-popper .account-history-item) {
    min-height: 58px;
    display: flex;
    align-items: stretch;
    border-radius: 10px;
    transition: background-color 180ms ease;
}

:global(.login-account-history-popper .account-history-item:hover),
:global(.login-account-history-popper .account-history-item.is-current) {
    background: var(--el-color-primary-light-9, #ecf5ff);
}

:global(.login-account-history-popper .account-history-main) {
    min-width: 0;
    min-height: 58px;
    padding: 8px 6px 8px 8px;
    border: 0;
    display: flex;
    flex: 1;
    align-items: center;
    gap: 10px;
    color: inherit;
    background: transparent;
    text-align: left;
    cursor: pointer;
}

:global(.login-account-history-popper .account-history-main:focus-visible) {
    outline: 2px solid var(--el-color-primary);
    outline-offset: -2px;
    border-radius: 10px;
}

:global(.login-account-history-popper .account-history-avatar) {
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 50%;
    color: #fff;
    background: var(--el-color-primary);
    box-shadow: 0 3px 10px rgba(var(--el-color-primary-rgb, 64, 158, 255), 0.22);
}

:global(.login-account-history-popper .account-history-avatar img) {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
}

:global(.login-account-history-popper .account-history-copy) {
    min-width: 0;
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 3px;
}

:global(.login-account-history-popper .account-history-copy strong) {
    overflow: hidden;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
}

:global(.login-account-history-popper .account-history-copy span) {
    overflow: hidden;
    color: var(--el-text-color-secondary, #909399);
    font-size: 11px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
}

:global(.login-account-history-popper .account-history-check) {
    flex: 0 0 auto;
    color: var(--el-color-primary);
    font-size: 16px;
}

:global(.login-account-history-popper .account-history-delete) {
    width: 40px;
    min-height: 44px;
    padding: 0;
    border: 0;
    align-self: center;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-placeholder, #a8abb2);
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
}

:global(.login-account-history-popper .account-history-delete:hover),
:global(.login-account-history-popper .account-history-delete:focus-visible) {
    color: var(--el-color-danger, #f56c6c);
    background: var(--el-color-danger-light-9, #fef0f0);
    outline: none;
}

:global(.login-account-history-popper .account-history-empty) {
    min-height: 112px;
    padding: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

:global(.login-account-history-popper .account-history-empty > div) {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

:global(.login-account-history-popper .account-history-empty strong) {
    font-size: 13px;
}

:global(.login-account-history-popper .account-history-empty span:not(.account-history-avatar)) {
    max-width: 220px;
    color: var(--el-text-color-secondary, #909399);
    font-size: 11px;
    line-height: 1.5;
}

/* 图标容器样式 */
.input-icon-wrapper {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 0px;
    margin-right: 10px;
    border-radius: var(--mci-login-control-radius) 0 0 var(--mci-login-control-radius);
    transition: opacity 180ms ease;
    
    .el-icon {
        font-size: 20px;
    }
}

/* 验证码样式 */
.captcha-wrapper {
    padding: 0;
    background: transparent;
    
    .captcha-img {
        height: 46px;
        width: 120px;
        cursor: pointer;
        display: block;
        border-radius: 0 var(--mci-login-control-radius) var(--mci-login-control-radius) 0;
        transition: opacity 0.3s ease;
        
        &:hover {
            opacity: 0.8;
        }
    }
}

/* ==================== 登录按钮样式 ==================== */
.login-button-wrapper {
    margin-top: 18px;
    margin-bottom: 20px;
    text-align: center;
}

.login-button {
    width: 100%;
    min-height: 54px;
    padding: 0 24px;
    border: 0;
    border-radius: var(--mci-login-control-radius);
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: var(--mci-login-text-strong);
    background: var(--mci-login-button-gradient);
    background-size: 180% 100%;
    box-shadow: var(--mci-login-button-shadow);
    font-family: inherit;
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 1.6px;
    cursor: pointer;
    isolation: isolate;
    animation: mciLoginButtonAura 6s ease-in-out infinite;
    transition: transform 180ms ease, opacity 180ms ease;

    &::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        border-radius: inherit;
        background: var(--mci-login-button-depth);
        opacity: 0.7;
        pointer-events: none;
    }

    &:hover:not(:disabled),
    &:focus-visible:not(:disabled) {
        transform: translateY(-2px);
    }

    &:focus-visible {
        outline: 3px solid var(--mci-login-focus-ring);
        outline-offset: 3px;
    }

    &:active:not(:disabled) {
        transform: scale(0.985);
    }

    &:disabled {
        cursor: wait;
        opacity: 0.9;
    }

    &.is-charging .login-button-energy-beam,
    &.is-charging .login-button-energy::after {
        animation-duration: 880ms;
    }
}

.login-button-content {
    position: relative;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-shadow: 0 1px 8px var(--mci-login-text-shadow);

    .el-icon {
        font-size: 19px;
    }
}

.login-button-energy {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    border-radius: inherit;
    opacity: 0.92;
    pointer-events: none;

    &::after {
        content: "";
        width: 58%;
        height: 2px;
        position: absolute;
        top: 50%;
        left: -62%;
        border-radius: 999px;
        background: var(--mci-login-energy-trace);
        box-shadow: var(--mci-login-energy-trace-shadow);
        opacity: 0;
        transform: translateX(0) translateY(-50%);
        animation: mciLoginCurrentTrace 3.4s ease-in-out infinite;
    }
}

.login-button-energy-beam {
    width: 44%;
    height: 210%;
    position: absolute;
    top: -55%;
    left: -54%;
    border-radius: 50%;
    background: var(--mci-login-energy-beam);
    opacity: 0;
    transform: translateX(0) skewX(-18deg);
    animation: mciLoginEnergySweep 3.4s ease-in-out infinite;
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
            font-size: 13px;
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
    --mci-login-card-radius: 24px;
    --mci-login-control-radius: 12px;
    --mci-login-text-strong: #ffffff;
    --mci-login-text-shadow: rgba(8, 20, 48, 0.42);
    --mci-login-electric: #8cecff;
    --mci-login-electric-soft: rgba(140, 236, 255, 0.72);
    --mci-login-focus-ring: rgba(140, 236, 255, 0.42);
    --mci-login-logo-bg: rgba(255, 255, 255, 0.96);
    --mci-login-logo-shadow: 0 10px 28px rgba(8, 20, 48, 0.24), 0 0 22px rgba(140, 236, 255, 0.2);
    --mci-login-logo-halo: radial-gradient(circle, rgba(140, 236, 255, 0.42) 0%, rgba(115, 87, 255, 0.18) 48%, transparent 72%);
    --mci-login-input-bg: rgba(248, 250, 255, 0.96);
    --mci-login-input-bg-hover: rgba(255, 255, 255, 0.99);
    --mci-login-input-border-hover: rgba(140, 211, 255, 0.5);
    --mci-login-input-border-focus: rgba(78, 168, 255, 0.92);
    --mci-login-input-shadow: 0 10px 26px rgba(5, 16, 38, 0.18);
    --mci-login-input-focus-shadow: 0 0 0 3px rgba(101, 201, 255, 0.2), 0 12px 28px rgba(5, 16, 38, 0.22);
    --mci-login-control-bg: rgba(8, 24, 52, 0.4);
    --mci-login-control-bg-hover: rgba(14, 39, 78, 0.56);
    --mci-login-control-active-bg: rgba(37, 92, 165, 0.46);
    --mci-login-control-shadow: 0 8px 22px rgba(4, 13, 34, 0.2);
    --mci-login-checkbox-bg: rgba(255, 255, 255, 0.12);
    --mci-login-checkbox-border: rgba(211, 232, 255, 0.72);
    --mci-login-button-gradient: linear-gradient(105deg, #176ee8 0%, #386ff2 34%, #655cf2 68%, #7b4fe8 100%);
    --mci-login-button-depth: linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 48%, rgba(20, 30, 108, 0.16));
    --mci-login-button-shadow: 0 15px 34px rgba(36, 91, 224, 0.38), 0 0 30px rgba(104, 100, 255, 0.25);
    --mci-login-energy-beam: linear-gradient(90deg, transparent 0%, rgba(174, 242, 255, 0.08) 20%, rgba(229, 252, 255, 0.58) 50%, rgba(174, 242, 255, 0.1) 80%, transparent 100%);
    --mci-login-energy-trace: linear-gradient(90deg, transparent 0%, rgba(150, 238, 255, 0.28) 24%, #ffffff 72%, transparent 100%);
    --mci-login-energy-trace-shadow: 0 0 12px rgba(140, 236, 255, 0.82);
    --mci-login-card-surface: linear-gradient(145deg, rgba(23, 55, 105, 0.68), rgba(12, 18, 52, 0.82) 58%, rgba(42, 20, 82, 0.76));
    --mci-login-card-glow: linear-gradient(135deg, rgba(87, 215, 255, 0.72), rgba(78, 118, 255, 0.5) 46%, rgba(172, 78, 255, 0.62));
    --mci-login-card-shadow: 0 28px 90px rgba(3, 9, 28, 0.5), 0 0 48px rgba(65, 172, 255, 0.34), 0 0 96px rgba(126, 78, 255, 0.24);
    --mci-login-card-surface-mobile: linear-gradient(145deg, rgba(25, 62, 116, 0.88), rgba(10, 18, 47, 0.94) 62%, rgba(47, 22, 81, 0.9));
    --mci-login-card-shadow-mobile: 0 18px 46px rgba(3, 9, 28, 0.46), 0 0 32px rgba(65, 172, 255, 0.24), 0 0 58px rgba(126, 78, 255, 0.18);
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
        font-size: 28px;
        font-weight: bold;
        line-height: 1.18;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        
        span {
            display: block;
            margin-top: var(--mci-login-brand-subtitle-gap);
            font-size: 16px !important;
            font-weight: normal;
            opacity: 0.9;
        }
    }

    .divLoginCenter {
        width: 500px;
        max-width: calc(100vw - 32px);
        padding: 40px;
        box-sizing: border-box;
        position: absolute;
        top: 50%;
        left: 50%;
        z-index: 1;
        transform: translate(-50%, -50%);
        margin-top: 0 !important;
        transition: opacity 0.7s ease;
        border-radius: var(--mci-login-card-radius);
        isolation: isolate;

        &::before {
            content: "";
            position: absolute;
            inset: -7px;
            z-index: -2;
            border: 0;
            border-radius: calc(var(--mci-login-card-radius) + 7px);
            background: var(--mci-login-card-glow);
            filter: blur(18px);
            opacity: 0.48;
            pointer-events: none;
            transform: scale(0.975);
            animation: mciLoginCardBreath 4.8s ease-in-out infinite;
        }

        :deep(.el-checkbox__input.is-checked + .el-checkbox__label){
            color: #fff !important;
        }
    }

    @media (min-width: 1200px) {
        .divLoginCenter {
            // 固定外框为原宽屏实际视觉宽度，避免 1366px 下滚动条出现后跨断点导致退出登录时骤然变窄。
            width: 620px;
            padding: 50px 60px;
        }
    }
    
    @media (max-width: 768px) {
        .divLoginCenter {
            width: calc(100vw - 24px);
            max-width: 500px;
            padding: 30px 25px;
        }

        .login-preferences-row {
            min-height: 44px;
            align-items: center;
            flex-direction: row;
            justify-content: flex-start;
        }

        .remember-password-checkbox {
            height: 44px !important;
            min-height: 44px !important;
        }

        .login-brand {
            --mci-login-brand-height: 36px;
            --mci-login-brand-subtitle-line-height: 18px;
            margin-bottom: 24px;
            gap: 12px;

            &.has-subtitle {
                --mci-login-brand-height: 50px;
            }

            .login-title {
                max-width: calc(100% - var(--mci-login-brand-height) - 12px);
            }
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
    background: var(--mci-login-card-surface);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    left: 0;
    top: 0;
    z-index: -1;
    border: 0;
    border-radius: var(--mci-login-card-radius);
    box-shadow: var(--mci-login-card-shadow);
}

@media (max-width: 768px) {
    .loginCenterBgCover {
        background: var(--mci-login-card-surface-mobile);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        box-shadow: var(--mci-login-card-shadow-mobile);
    }

    #divLogin .divLoginCenter::before {
        display: none;
    }
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

@keyframes mciLoginCardBreath {
    0%, 100% {
        opacity: 0.38;
        transform: scale(0.975);
    }
    50% {
        opacity: 0.78;
        transform: scale(1.018);
    }
}

@keyframes mciLoginLogoPulse {
    0%, 100% {
        opacity: 0.38;
        transform: scale(0.94);
    }
    50% {
        opacity: 0.72;
        transform: scale(1.06);
    }
}

@keyframes mciLoginButtonAura {
    0%, 100% {
        background-position: 0% 50%;
    }
    50% {
        background-position: 100% 50%;
    }
}

@keyframes mciLoginEnergySweep {
    0%, 46% {
        opacity: 0;
        transform: translateX(0) skewX(-18deg);
    }
    58% {
        opacity: 0.86;
    }
    78%, 100% {
        opacity: 0;
        transform: translateX(350%) skewX(-18deg);
    }
}

@keyframes mciLoginCurrentTrace {
    0%, 38% {
        opacity: 0;
        transform: translateX(0) translateY(-50%);
    }
    52%, 72% {
        opacity: 0.88;
    }
    86%, 100% {
        opacity: 0;
        transform: translateX(285%) translateY(-50%);
    }
}

.divLoginCenter {
    animation: fadeInUp 0.6s ease-out;
}

@media (prefers-reduced-motion: reduce) {
    .divLoginCenter,
    .divLoginCenter::before,
    .login-system-logo-ring,
    .login-button,
    .login-button-energy::after,
    .login-button-energy-beam,
    .is-loading {
        animation: none !important;
    }

    .remember-password-checkbox {
        transition: none !important;
    }

    .login-button:hover:not(:disabled),
    .login-button:focus-visible:not(:disabled),
    .remember-password-checkbox:hover {
        transform: none;
    }
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
