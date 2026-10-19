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
// 直接导入工具函数
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/utils/api.itdos";
import { getFirstValidRoutePath, hasAccessibleRoutePath, normalizeMenuRoutePath } from "@/pinia/modules/permission";
import { getStoredLanguage, resolveSysLocale } from "@/lang";
import { resolveLoginResourceUrl, resolveLoginSystemLogoUrl } from "@/utils/login-branding.js";
import { normalizeLoginWallpapers, pickNextLoginWallpaper } from "@/utils/login-wallpaper.js";
import { getPlatformSysConfig } from "@/utils/platform-sys-config.js";
import { mergeLoginSysConfig } from "@/utils/platform-edition.js";
import {
    DEFAULT_LOGIN_METHOD_KEYS,
    isLoginMethodDisplayEnabled
} from "@/utils/login-method-visibility.js";
import {
    getIdentityCapabilities,
    isPasskeySupported,
    runExternalLogin,
    verifyWithFace,
    verifyWithPasskey,
    verifyWithTotp
} from "@/utils/identity-verification.js";
import {
    getLegacySsoCapabilities,
    getSsoCapabilities,
    readLegacySsoCredential,
    runFederatedLogin
} from "@/utils/sso-federation.js";
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

// 所有登录风格共用此业务选项，模板不得另建登录、Token、验证码或 SSO 链路。
export function setupLoginState() {
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
    }

export default {
    beforeCreate() {},
    computed: {
        LoginButtonText() {
            if (!this.LoginWaiting) return "登录";
            if (this.LoginStage === "routes") return "正在加载工作台...";
            if (this.LoginStage === "entering") return "正在进入系统...";
            return "正在安全接入...";
        },
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
        },
        LoginBackgroundUrl() {
            if (this.ActiveLoginWallpaperUrl) return this.ActiveLoginWallpaperUrl;
            return resolveLoginResourceUrl(
                this.DesktopBg?.LockImgUrl || this.SysConfig?.LoginBgImg,
                (value, returnNoImg) => this.DiyCommon.GetServerPath(value, returnNoImg)
            );
        },
        LoginBackgroundStyle() {
            return {
                backgroundImage: this.LoginBackgroundUrl
                    ? `url(${JSON.stringify(this.LoginBackgroundUrl)})`
                    : "none"
            };
        },
        PreviousLoginBackgroundStyle() {
            return {
                backgroundImage: this.PreviousLoginWallpaperUrl
                    ? `url(${JSON.stringify(this.PreviousLoginWallpaperUrl)})`
                    : "none"
            };
        },
        LoginThemeSignature() {
            return String(this.diyStore?.themeColor || this.SysConfig?.ThemeColor || "#409eff").trim().toLowerCase();
        },
        DefaultLoginMethodsHidden() {
            return DEFAULT_LOGIN_METHOD_KEYS.every((methodKey) => !isLoginMethodDisplayEnabled(this.SysConfig, methodKey));
        },
        LoginMethodItems() {
            const capabilities = this.IdentityCapabilities || {};
            const methods = [];
            if (isLoginMethodDisplayEnabled(this.SysConfig, "Passkey")) {
                methods.push({
                    key: "Passkey",
                    name: "生物登录",
                    description: "Windows Hello、Face ID、Touch ID 或安全密钥",
                    glyph: "⌁",
                    tone: "passkey",
                    available: !!capabilities.PasskeyEnabled && this.PasskeyAvailable,
                    status: !this.IdentityCapabilitiesLoaded
                        ? "读取中"
                        : (!capabilities.PasskeyEnabled ? "未开启" : (!this.PasskeyAvailable ? "需 HTTPS" : "免账号密码"))
                });
            }
            if (isLoginMethodDisplayEnabled(this.SysConfig, "Totp")) {
                methods.push({
                    key: "Totp",
                    name: "Authenticator",
                    description: "使用 Microsoft Authenticator 等应用的 6 位动态口令",
                    glyph: "6",
                    tone: "totp",
                    available: !!capabilities.TotpEnabled,
                    status: !this.IdentityCapabilitiesLoaded ? "读取中" : (capabilities.TotpEnabled ? "动态口令" : "未开启")
                });
            }
            if (capabilities.FaceEnabled) {
                methods.push({
                    key: "Face",
                    name: "严格人脸核验",
                    description: "服务端活体检测，适合高风险登录与特殊业务场景",
                    glyph: "◎",
                    tone: "face",
                    available: true,
                    status: "活体核验"
                });
            }
            const externalDefaults = [
                { key: "Microi", name: "Microi 登录", description: "使用 Microi 官方账号授权登录", glyph: "M", tone: "microi" },
                { key: "Gitee", name: "Gitee", description: "使用 Gitee 账号授权登录", glyph: "G", tone: "gitee" },
                { key: "WeChat", name: "微信", description: "使用微信开放平台扫码登录", glyph: "微", tone: "wechat" },
                { key: "GitHub", name: "GitHub", description: "使用 GitHub 账号授权登录", glyph: "GH", tone: "github" }
            ];
            const externalProviders = new Map(
                (capabilities.ExternalProviders || []).map((provider) => [String(provider.Key || "").toLowerCase(), provider])
            );
            externalDefaults.forEach((definition) => {
                if (!isLoginMethodDisplayEnabled(this.SysConfig, definition.key)) return;
                const provider = externalProviders.get(definition.key.toLowerCase());
                const providerAvailable = !!provider?.Available;
                methods.push({
                    key: `External:${definition.key}`,
                    provider: provider?.Key || definition.key,
                    name: provider?.Name || definition.name,
                    description: provider?.Description || definition.description,
                    glyph: definition.glyph,
                    tone: definition.tone,
                    available: providerAvailable,
                    status: !this.IdentityCapabilitiesLoaded
                        ? "读取中"
                        : (providerAvailable ? (provider?.Kind === "qr" ? "扫码登录" : "授权登录") : (provider?.Enabled ? "待配置" : "未开启"))
                });
            });
            (capabilities.FederatedProviders || []).forEach((provider) => {
                const protocol = String(provider.Protocol || "SSO").toUpperCase();
                methods.push({
                    key: `Federated:${provider.ConnectionKey}`,
                    connectionKey: provider.ConnectionKey,
                    federated: true,
                    name: provider.Name || provider.ConnectionKey,
                    description: provider.Description || `使用企业 ${protocol} 身份源登录`,
                    glyph: protocol === "OIDC" ? "ID" : (protocol === "SAML2" ? "S" : (protocol === "CAS" ? "C" : "↗")),
                    tone: "federated",
                    available: provider.Enabled !== false,
                    status: !this.IdentityCapabilitiesLoaded ? "读取中" : protocol
                });
            });
            return methods;
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
            LoginWallpapers: [],
            ActiveLoginWallpaperUrl: "",
            ActiveLoginWallpaperName: "",
            PreviousLoginWallpaperUrl: "",
            WallpaperTransitioning: false,
            WallpaperTransitionFrame: 0,
            WallpaperTransitionTimer: 0,
            WallpaperLoading: false,
            WallpaperLoadVersion: 0,
            ThemeTransitioning: false,
            ThemeTransitionFrame: 0,
            ThemeTransitionTimer: 0,
            LoginVisualReady: false,
            LoginComponentUnmounted: false,
            tipId: "",
            redirect: undefined,
            otherQuery: {},
            LoginResult: {},
            LoginWaiting: false,
            LoginStage: "idle",
            IdentityLoginWaiting: "",
            IdentityCapabilities: {},
            IdentityCapabilitiesLoaded: false,
            LoginMethodsVisible: false,
            PasskeyAvailable: isPasskeySupported(),
            ShowTotpLogin: false,
            TotpLoginAccount: "",
            TotpLoginCode: "",
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
        window.removeEventListener("keydown", self.HandleLoginMethodsEscape);
        document.body.classList.remove("mci-login-methods-open");
        self.WallpaperLoadVersion += 1;
        if (self.WallpaperTransitionFrame) cancelAnimationFrame(self.WallpaperTransitionFrame);
        if (self.ThemeTransitionFrame) cancelAnimationFrame(self.ThemeTransitionFrame);
        clearTimeout(self.WallpaperTransitionTimer);
        clearTimeout(self.ThemeTransitionTimer);
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
            this.IdentityCapabilitiesLoaded = false;
            this.LoadIdentityCapabilities();
        },
        GetCurrentUser: function () {
            this.RefreshCurrentAccountAvatar();
        },
        SystemLogoUrl: function () {
            this.SystemLogoLoadFailed = false;
        },
        LoginThemeSignature: function (value, previousValue) {
            if (!this.LoginVisualReady || !previousValue || value === previousValue) return;
            this.PlayLoginThemeTransition();
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
            self.LoadIdentityCapabilities();
        }
        window.addEventListener("keydown", self.HandleLoginMethodsEscape);

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
            self.LoginVisualReady = true;
            if (self.DiyCommon.ShowVideo()) {
                self.DiyCommon.LoadVideoLogin();
            }
        });

        try {
            getPlatformSysConfig(self.DiyCommon, {
                _SearchEqual: {
                    IsEnable: 1
                },
                OsClient: self.OsClient
            }).then(async function (sysConfigResult) {
                if (sysConfigResult.Code == 1) {
                    var sysConfig = sysConfigResult.Data;
                    // 服务端可以公开与部署私钥配对的公钥；本地显式配置仍优先。
                    self.publicKey = resolveLoginRsaPublicKey(
                        sysConfig && sysConfig.LoginRsaPublicKey
                            ? String(sysConfig.LoginRsaPublicKey).replace(/\\n/g, "\n").trim()
                            : ""
                    );
                    self.GetCaptcha(sysConfig);
                    await self.LoadLoginWallpapers(sysConfig);
                }
            }).catch(function () {});
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
        async LoadIdentityCapabilities() {
            const capabilities = {};
            try {
                Object.assign(capabilities, await getIdentityCapabilities(this.DiyCommon, this.OsClient));
            } catch (_) {}
            try {
                const sso = await getSsoCapabilities(this.DiyCommon, this.OsClient);
                capabilities.FederatedProviders = Array.isArray(sso.Providers) ? sso.Providers : [];
                capabilities.SsoProtocols = Array.isArray(sso.Protocols) ? sso.Protocols : [];
                capabilities.LegacySsoCompatibilityCount = Number(sso.LegacyCompatibilityCount || 0);
            } catch (_) {
                capabilities.FederatedProviders = [];
            } finally {
                this.IdentityCapabilities = capabilities;
                this.IdentityCapabilitiesLoaded = true;
            }
        },
        OpenLoginMethods() {
            this.LoginMethodsVisible = true;
            document.body.classList.add("mci-login-methods-open");
            this.$nextTick(() => this.$refs.loginMethodsDialog?.focus());
        },
        CloseLoginMethods() {
            this.LoginMethodsVisible = false;
            document.body.classList.remove("mci-login-methods-open");
        },
        HandleLoginMethodsEscape(event) {
            if (event?.key === "Escape" && this.LoginMethodsVisible) this.CloseLoginMethods();
        },
        StartLoginMethod(method) {
            if (!method?.available) return;
            this.CloseLoginMethods();
            if (method.key === "Passkey") return this.LoginWithPasskey();
            if (method.key === "Totp") return this.OpenTotpLogin();
            if (method.key === "Face") return this.LoginWithFace();
            if (method.federated) return this.LoginWithFederated(method.connectionKey);
            if (method.provider) return this.LoginWithExternal(method.provider);
        },
        ValidateIdentityLoginPolicy() {
            if (this.SysConfig.EnablePrivacyPolicy && !this.CheckPrivacyPolicy) {
                this.DiyCommon.Tips(`请先勾选[${this.SysConfig.PrivacyPolicyName || "同意隐私协议"}]！`, false);
                return false;
            }
            return true;
        },
        CompleteIdentityLogin(result) {
            if (!result || result.Code !== 1) throw new Error(result?.Msg || "身份验证登录失败。");
            this.LoginResult = result;
            this.PersistRememberedLogin(result.Data || {});
            this.diyStore.setState("SystemStyle", "Classic");
            return this.GotoSystem();
        },
        async LoginWithPasskey() {
            if (this.IdentityLoginWaiting || !this.ValidateIdentityLoginPolicy()) return;
            this.IdentityLoginWaiting = "Passkey";
            try {
                const result = await verifyWithPasskey({
                    diyCommon: this.DiyCommon,
                    osClient: this.OsClient,
                    account: "",
                    purpose: "Login",
                    clientType: this.diyStore.IsPhoneView ? "Mobile" : "PC"
                });
                this.IdentityLoginWaiting = "";
                await this.CompleteIdentityLogin(result);
            } catch (error) {
                this.DiyCommon.Tips(error?.message || "设备生物识别登录失败。", false);
            } finally {
                this.IdentityLoginWaiting = "";
            }
        },
        LoginWithPreferredIdentity() {
            if (this.IdentityCapabilities.PasskeyEnabled && this.PasskeyAvailable) {
                return this.LoginWithPasskey();
            }
            if (this.IdentityCapabilities.TotpEnabled) {
                this.OpenTotpLogin();
                return;
            }
            return this.LoginWithFace();
        },
        OpenTotpLogin() {
            if (!this.ValidateIdentityLoginPolicy()) return;
            this.TotpLoginAccount = this.Account || this.diyStore.getLastLoginAccount() || "";
            this.TotpLoginCode = "";
            this.ShowTotpLogin = true;
            this.$nextTick(() => {
                const target = this.TotpLoginAccount ? this.$refs.totpCodeInput : this.$refs.totpAccountInput;
                target?.focus?.();
            });
        },
        NormalizeTotpLoginCode(value) {
            this.TotpLoginCode = String(value || "").replace(/\D/g, "").slice(0, 6);
        },
        async LoginWithTotp() {
            if (this.IdentityLoginWaiting || !this.ValidateIdentityLoginPolicy()) return;
            const account = String(this.TotpLoginAccount || "").trim();
            const code = String(this.TotpLoginCode || "").replace(/\D/g, "");
            if (!account || code.length !== 6) {
                this.DiyCommon.Tips("请输入账号和 6 位 Authenticator 动态口令。", false);
                return;
            }
            this.IdentityLoginWaiting = "Totp";
            try {
                const result = await verifyWithTotp({
                    diyCommon: this.DiyCommon,
                    osClient: this.OsClient,
                    account,
                    code,
                    purpose: "Login",
                    clientType: this.diyStore.IsPhoneView ? "Mobile" : "PC"
                });
                this.Account = account;
                this.ShowTotpLogin = false;
                this.IdentityLoginWaiting = "";
                await this.CompleteIdentityLogin(result);
            } catch (error) {
                this.DiyCommon.Tips(error?.message || "Authenticator 登录失败。", false);
            } finally {
                this.IdentityLoginWaiting = "";
            }
        },
        async LoginWithFace() {
            if (this.IdentityLoginWaiting || !this.ValidateIdentityLoginPolicy()) return;
            if (this.DiyCommon.IsNull(this.Account)) {
                this.DiyCommon.Tips("严格人脸登录需要先输入账号。", false);
                return;
            }
            this.IdentityLoginWaiting = "Face";
            try {
                const result = await verifyWithFace({
                    diyCommon: this.DiyCommon,
                    osClient: this.OsClient,
                    account: this.Account,
                    purpose: "Login",
                    clientType: this.diyStore.IsPhoneView ? "Mobile" : "PC"
                });
                await this.CompleteIdentityLogin(result);
            } catch (error) {
                this.DiyCommon.Tips(error?.message || "严格人脸登录失败。", false);
            } finally {
                this.IdentityLoginWaiting = "";
            }
        },
        async LoginWithExternal(provider) {
            if (this.IdentityLoginWaiting || !this.ValidateIdentityLoginPolicy()) return;
            this.IdentityLoginWaiting = provider || "External";
            try {
                const result = await runExternalLogin({
                    diyCommon: this.DiyCommon,
                    osClient: this.OsClient,
                    provider,
                    mode: "Login",
                    clientType: this.diyStore.IsPhoneView ? "Mobile" : "PC"
                });
                await this.CompleteIdentityLogin(result);
            } catch (error) {
                this.DiyCommon.Tips(error?.message || "外部登录失败。", false);
            } finally {
                this.IdentityLoginWaiting = "";
            }
        },
        async LoginWithFederated(connectionKey) {
            if (this.IdentityLoginWaiting || !this.ValidateIdentityLoginPolicy()) return;
            this.IdentityLoginWaiting = connectionKey || "SSO";
            try {
                const result = await runFederatedLogin({
                    diyCommon: this.DiyCommon,
                    osClient: this.OsClient,
                    connectionKey,
                    clientType: this.diyStore.IsPhoneView ? "Mobile" : "PC"
                });
                await this.CompleteIdentityLogin(result);
            } catch (error) {
                this.DiyCommon.Tips(error?.message || "企业单点登录失败。", false);
            } finally {
                this.IdentityLoginWaiting = "";
            }
        },
        RemoveSsoCredentialFromUrl(parameterNames) {
            if (typeof window === "undefined" || !window.history?.replaceState) return;
            let safeUrl = window.location.href;
            (parameterNames || []).forEach((parameterName) => {
                const escaped = String(parameterName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                if (!escaped) return;
                safeUrl = safeUrl
                    .replace(new RegExp(`([?&])${escaped}=[^&#;]*`, "gi"), "$1")
                    .replace(new RegExp(`(%3F|%26)${escaped}%3D.*?(?=%26|%23|&|#|$)`, "gi"), "$1");
            });
            safeUrl = safeUrl.replace(/\?&/g, "?").replace(/&&+/g, "&").replace(/[?&](?=#|$)/g, "");
            if (safeUrl !== window.location.href) window.history.replaceState(window.history.state, "", safeUrl);
        },
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
        async LoadLoginWallpapers(sysConfig, forceRandom = false) {
            var loadVersion = ++this.WallpaperLoadVersion;
            this.WallpaperLoading = true;
            try {
                var result = await this.DiyCommon.PostAsync({
                    url: "/apiengine/platform-login-wallpapers",
                    data: {
                        OsClient: this.OsClient
                    },
                    skipAuthorization: true,
                    suppressAuthFailure: true,
                    suppressErrorNotification: true
                });
                if (loadVersion !== this.WallpaperLoadVersion || this.LoginComponentUnmounted) return;
                this.LoginWallpapers = normalizeLoginWallpapers(
                    result && result.Code === 1 ? result.Data : [],
                    (value, returnNoImg) => this.DiyCommon.GetServerPath(value, returnNoImg)
                );
                if (forceRandom || this.isEnabledFlag(sysConfig?.LoginBgImgRandom)) {
                    await this.ApplyRandomLoginWallpaper(forceRandom);
                }
            } catch (error) {
                // 壁纸属于体验增强，失败时继续使用 SysConfig.LoginBgImg。
                this.LoginWallpapers = [];
            } finally {
                if (loadVersion === this.WallpaperLoadVersion) this.WallpaperLoading = false;
            }
        },
        PreloadLoginWallpaper(url) {
            return new Promise((resolve) => {
                if (!url || typeof Image === "undefined") {
                    resolve(false);
                    return;
                }
                var settled = false;
                var image = new Image();
                var finish = function (success) {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timeoutId);
                    image.onload = null;
                    image.onerror = null;
                    resolve(success);
                };
                var timeoutId = setTimeout(function () { finish(false); }, 8000);
                image.onload = function () { finish((image.naturalWidth || image.width) > 0); };
                image.onerror = function () { finish(false); };
                image.src = url;
            });
        },
        PrefersReducedLoginMotion() {
            return typeof window !== "undefined"
                && typeof window.matchMedia === "function"
                && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        },
        PlayLoginThemeTransition() {
            if (this.PrefersReducedLoginMotion() || this.LoginComponentUnmounted) return;
            if (this.ThemeTransitionFrame) cancelAnimationFrame(this.ThemeTransitionFrame);
            clearTimeout(this.ThemeTransitionTimer);
            this.ThemeTransitioning = false;
            this.$nextTick(() => {
                this.ThemeTransitionFrame = requestAnimationFrame(() => {
                    this.ThemeTransitionFrame = 0;
                    if (this.LoginComponentUnmounted) return;
                    this.ThemeTransitioning = true;
                    this.ThemeTransitionTimer = setTimeout(() => {
                        this.ThemeTransitioning = false;
                        this.ThemeTransitionTimer = 0;
                    }, 720);
                });
            });
        },
        SetActiveLoginWallpaper(wallpaper) {
            const nextUrl = String(wallpaper?.Url || "").trim();
            if (!nextUrl) return false;
            const previousUrl = this.LoginBackgroundUrl;
            const shouldAnimate = !!previousUrl
                && previousUrl !== nextUrl
                && !this.PrefersReducedLoginMotion();

            if (this.WallpaperTransitionFrame) cancelAnimationFrame(this.WallpaperTransitionFrame);
            clearTimeout(this.WallpaperTransitionTimer);
            this.PreviousLoginWallpaperUrl = shouldAnimate ? previousUrl : "";
            this.WallpaperTransitioning = shouldAnimate;
            this.ActiveLoginWallpaperUrl = nextUrl;
            this.ActiveLoginWallpaperName = wallpaper?.Name || "";

            if (!shouldAnimate) return true;
            this.$nextTick(() => {
                this.WallpaperTransitionFrame = requestAnimationFrame(() => {
                    this.WallpaperTransitionFrame = 0;
                    if (this.LoginComponentUnmounted) return;
                    this.WallpaperTransitioning = false;
                    this.WallpaperTransitionTimer = setTimeout(() => {
                        this.PreviousLoginWallpaperUrl = "";
                        this.WallpaperTransitionTimer = 0;
                    }, 1040);
                });
            });
            return true;
        },
        async ApplyRandomLoginWallpaper(showEmptyTip = false) {
            var attemptedUrls = new Set();
            while (true) {
                var candidates = this.LoginWallpapers.filter((item) => !attemptedUrls.has(item.Url));
                if (candidates.length === 0) break;
                var wallpaper = pickNextLoginWallpaper(candidates, this.ActiveLoginWallpaperUrl);
                if (!wallpaper) break;
                attemptedUrls.add(wallpaper.Url);
                if (await this.PreloadLoginWallpaper(wallpaper.Url)) {
                    if (!this.LoginComponentUnmounted) {
                        this.SetActiveLoginWallpaper(wallpaper);
                    }
                    return true;
                }
                this.LoginWallpapers = this.LoginWallpapers.filter((item) => item.Url !== wallpaper.Url);
            }
            if (showEmptyTip) this.DiyCommon.Tips("暂无可用壁纸，已保留系统默认登录背景。", false);
            return false;
        },
        async ChangeLoginWallpaper() {
            if (this.WallpaperLoading || this.PreviousLoginWallpaperUrl) return;
            if (this.LoginWallpapers.length === 0) {
                await this.LoadLoginWallpapers(this.SysConfig, true);
                return;
            }
            this.WallpaperLoading = true;
            try {
                await this.ApplyRandomLoginWallpaper(true);
            } finally {
                this.WallpaperLoading = false;
            }
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
        async BindWeChat() {
            var self = this;
            if (self.LoginWaiting) return;
            if (self.DiyCommon.IsNull(self.Account) || self.DiyCommon.IsNull(self.Pwd)) {
                self.DiyCommon.Tips("请输入账号和密码！", false);
                return;
            }
            if (self.SysConfig.EnablePrivacyPolicy && !self.CheckPrivacyPolicy) {
                self.DiyCommon.Tips(`请先勾选[${self.SysConfig.PrivacyPolicyName || "同意隐私协议"}]！`, false);
                return;
            }
            var encryptedPwd = self.encryptPassword(self.Pwd);
            if (!encryptedPwd) return;

            self.LoginWaiting = true;
            try {
                const loginParam = {
                    Account: self.Account,
                    Pwd: encryptedPwd,
                    OsClient: self.OsClient,
                    _ClientType: self.diyStore.IsPhoneView ? "Mobile" : "PC"
                };
                if (self.EnableCaptcha) {
                    loginParam._CaptchaId = self.CaptchaId;
                    loginParam._CaptchaValue = self.CaptchaValue;
                }
                const result = await self.DiyCommon.PostAsync(self.DiyApi.Login(), loginParam);
                if (!self.DiyCommon.Result(result)) {
                    if (self.EnableCaptcha) {
                        self.GetCaptcha();
                        self.CaptchaValue = "";
                    }
                    return;
                }

                // 旧 bind-wechat 接口会把账号密码交给租户可编辑 V8。新版先通过
                // 标准登录签发 DiyToken，再以 POST 表单进入最小微信 OAuth 网关；
                // Token 不进入 URL、浏览器历史或 Referer。
                const authorization = self.DiyCommon.getToken();
                if (!authorization) {
                    self.DiyCommon.Tips("登录成功但未获得会话票据，请重试。", false);
                    return;
                }
                const form = document.createElement("form");
                form.method = "POST";
                form.action = self.DiyCommon.GetApiBase() + "/api/WeChat/BindSysUser";
                for (const [name, value] of Object.entries({
                    authorization: /^Bearer\s+/i.test(authorization)
                        ? authorization
                        : "Bearer " + authorization,
                    OsClient: self.OsClient,
                    ReturnUrl: ""
                })) {
                    const input = document.createElement("input");
                    input.type = "hidden";
                    input.name = name;
                    input.value = value || "";
                    form.appendChild(input);
                }
                document.body.appendChild(form);
                form.submit();
            } catch (error) {
                self.DiyCommon.Tips("微信绑定登录失败，请稍后重试。", false);
            } finally {
                self.LoginWaiting = false;
            }
        },
        async SendSms() {
            var self = this;
            // 保存当前的验证码ID和图片，防止被刷新
            var currentCaptchaId = self.RegCaptchaId;
            var currentCaptchaImgSrc = $("#CaptchaImgReg").attr("src");

            try {
                var result = await self.DiyCommon.PostAsync({
                    url: "/apiengine/send_sms_reg",
                    data: {
                        Phone: self.RegModel.Phone,
                        _CaptchaId: self.RegCaptchaId,
                        _CaptchaValue: self.RegCaptchaValue,
                        OsClient: self.OsClient
                    },
                    dataType: "json",
                    skipAuthorization: true,
                    suppressAuthFailure: true
                });
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
            } catch (error) {}
        },
        OpenReg() {
            var self = this;
            self.GetCaptcha(null, "#CaptchaImgReg", "RegCaptchaId");
            self.ShowRegSysUser = true;
        },
        async Reg() {
            var self = this;
            if (!self.RegModel.Pwd || !self.RegModel.Phone) {
                self.DiyCommon.Tips("帐号密码不能为空！", false);
                return;
            }
            if (self.RegModel.Pwd != self.RegModel.Pwd2) {
                self.DiyCommon.Tips("两次密码不一致！", false);
                return;
            }

            var registeredPhone = self.RegModel.Phone;
            var registeredPassword = self.RegModel.Pwd;
            try {
                var result = await self.DiyCommon.PostAsync({
                    url: "/apiengine/platform_auth_sms_login",
                    data: {
                        Phone: registeredPhone,
                        SmsCode: self.RegModel.SmsCaptchaValue,
                        // 此 Managed 接口接收 HTTPS 明文密码，并由可信 Core 原子做现代密码哈希；
                        // 旧 RSA 密文不能复用，否则会被当作真实密码保存。
                        Password: registeredPassword,
                        OsClient: self.OsClient,
                        _ClientType: self.diyStore.IsPhoneView ? "Mobile" : "PC",
                        Did: self.DiyCommon.GetDid()
                    },
                    dataType: "json",
                    skipAuthorization: true,
                    suppressAuthFailure: true
                });
                if (!self.DiyCommon.Result(result)) return;

                // HTTP 响应头是首选；兼容未暴露 authorization 响应头的跨域部署，
                // 再从接口引擎固定返回投影恢复同一 DiyToken。
                var token = result.DataAppend?.Token || result.Data?.Authorization || "";
                if (self.DiyCommon.IsNull(token)) {
                    self.DiyCommon.Tips("注册成功，但未收到登录凭据，请重新登录。", false);
                    return;
                }
                self.DiyCommon.ApplyAuthorizationToken(token, "");

                self.Account = registeredPhone;
                self.Pwd = registeredPassword;
                self.ShowRegSysUser = false;
                self.RegModel.Pwd = "";
                self.RegModel.Pwd2 = "";
                self.RegModel.SmsCaptchaValue = "";
                self.RegCaptchaValue = "";
                try {
                    await self.CompleteIdentityLogin(result);
                } catch (error) {
                    if (!self.LoginComponentUnmounted) {
                        self.DiyCommon.Tips("注册并登录成功，但进入系统失败，请重试。", false);
                    }
                }
            } catch (error) {}
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
        async TokenLogin() {
            var self = this;
            try {
                const legacyConnections = await getLegacySsoCapabilities(self.DiyCommon, self.OsClient);
                for (const diySso of legacyConnections) {
                    const token = readLegacySsoCredential(location.href, diySso.TokenName);
                    if (!token) continue;
                    self.RemoveSsoCredentialFromUrl([diySso.TokenName]);
                    const usesDiyToken = String(diySso.ClientSsoApi).toLowerCase()
                        === self.DiyApi.TokenLogin().toLowerCase();
                    const previousToken = self.DiyCommon.getToken();
                    if (usesDiyToken) {
                        self.DiyCommon.setToken(token.replace(/^Bearer(?:%20|\s)+/i, ""));
                    }
                    let ssoResult;
                    try {
                        ssoResult = await self.DiyCommon.PostAsync(diySso.ClientSsoApi, {
                            _token: token,
                            Token: token,
                            TokenName: diySso.TokenName,
                            OsClient: self.OsClient
                        });
                    } catch (error) {
                        if (usesDiyToken) {
                            if (previousToken) self.DiyCommon.setToken(previousToken);
                            else self.DiyCommon.removeToken();
                        }
                        throw error;
                    }
                    if (ssoResult.Code == 1) {
                        self.LoginResult = ssoResult;
                        self.diyStore.setCurrentUser(ssoResult.Data);
                        self.diyStore.setState("SystemStyle", "Classic");
                        self.GotoSystem();
                    } else if (usesDiyToken) {
                        if (previousToken) self.DiyCommon.setToken(previousToken);
                        else self.DiyCommon.removeToken();
                    }
                    return;
                }
            } catch (_) {
                // Standard account/password and federated login remain available.
            }
            // An unconfigured generic token must never activate a session, and
            // must not remain in browser history or referrer-bearing URLs.
            if (readLegacySsoCredential(location.href, "token")) {
                self.RemoveSsoCredentialFromUrl(["token"]);
            }
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
            self.LoginStage = "auth";

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
                    self.LoginStage = "routes";
                    try {
                        const navigated = await self.GotoSystem();
                        if (!navigated && !self.LoginComponentUnmounted) {
                            self.LoginWaiting = false;
                            self.LoginStage = "idle";
                        }
                    } catch (error) {
                        console.error("GotoSystem error:", error);
                        if (!self.LoginComponentUnmounted) {
                            self.LoginWaiting = false;
                            self.LoginStage = "idle";
                            self.DiyCommon.Tips("登录成功，但进入系统失败，请重试。", false);
                        }
                    }
                } else {
                    if (self.EnableCaptcha) {
                        self.GetCaptcha();
                        self.CaptchaValue = "";
                    }
                    self.LoginWaiting = false;
                    self.LoginStage = "idle";
                }
            });
        },
        async GotoSystem() {
            var self = this;
            if (self.DiyCommon.IsNull(self.SystemStyle)) {
                self.DiyCommon.Tips(self.$t("Msg.ChooseOSType"));
                return false;
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
                const authorizedUser = await self.userStore.ensureAuthorizationSnapshot(
                    self.LoginResult.Data
                );
                self.LoginResult.Data = authorizedUser;
                self.diyStore.setCurrentUser(authorizedUser);

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
                self.userStore.setRoles([]);
                self.DiyCommon.Tips(error?.message || "用户权限初始化失败，请重试。", false);
                return false;
            }

            // 等待 DOM 更新
            await self.$nextTick();
            // 短暂等待确保路由完全注册（50ms足够，因为已经在登录时加载）
            await new Promise(resolve => setTimeout(resolve, 50));
            self.LoginStage = "entering";

            if (self.SystemStyle == "WebOS" || self.SystemStyle == "macOS" || self.SystemStyle == "Windows") {
                const navigationFailure = await self.$router.push({
                    path: "/os",
                    replace: true
                });
                if (navigationFailure) throw navigationFailure;
            } else {
                var url = "/";
                var fallbackUrl = getFirstValidRoutePath(accessRoutes.length > 0 ? accessRoutes : self.permissionStore.addRoutes);
                // 优先级：用户个人首页 > 系统默认首页 > 菜单首页 > 首个有权限菜单。
                // 个人中心只接受内部路由，避免把普通用户字段变成外部跳转入口。
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
                        return true;
                    }
                } else if (self.LoginResult.DataAppend && self.LoginResult.DataAppend.SysMenuHomePage && self.LoginResult.DataAppend.SysMenuHomePage.Url) {
                    url = String(self.LoginResult.DataAppend.SysMenuHomePage.Url || "");
                }
                if (url && url.startsWith("http") && !self.diyStore.IsPhoneView) {
                    window.location.href = url;
                    return true;
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
                // Router 的对象式跳转中 query 会覆盖 path 内的查询参数；先解析完整
                // 深链接，再合并参数，避免首次登录后丢失记录 Id、编号和锚点。
                var resolvedTarget = self.$router.resolve(targetPath);
                const navigationFailure = await self.$router.push({
                    path: resolvedTarget.path,
                    query: { ...self.otherQuery, ...resolvedTarget.query },
                    hash: resolvedTarget.hash,
                    replace: true
                });
                if (navigationFailure) throw navigationFailure;

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
                    self.diyStore.setSysConfig(mergeLoginSysConfig(self.diyStore.SysConfig, self.LoginResult.DataAppend.SysConfig));
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
            return true;
        }
    }
};
