// Pinia Store - Diy (核心业务 store)
import { defineStore } from "pinia";
import { DiyCommon } from "@/utils/diy.common.js";
import LocalStorageManager from "@/utils/localStorage-manager.js";

export const useDiyStore = defineStore("diy", {
    state: () => ({
        IsPhoneView: false, //是否是移动端分辨率访问系统
        IsMiniProgram: false, //是否在小程序 webview 中运行（由 App.vue 初始化检测）
        OsClient: "",
        ApiBase: "",
        FileServer: "",
        MediaServer: "",
        ChatType: "吾码IM",
        
        // Token 相关
        Token: LocalStorageManager.get("Token") || "",
        TokenExpires: LocalStorageManager.get("TokenExpires") || "",
        Did: LocalStorageManager.get("Did") || "",
        LastLoginAccount: LocalStorageManager.get("LastLoginAccount") || "",
        DemoSelfLogout: LocalStorageManager.get("DemoSelfLogout") || false,

        DesktopBg: {
            ImgUrl: "",
            ImgAero: false,
            VideoUrl: "",
            VideoVoice: false,
            JsCover: "",
            LockImgUrl: "",
            LockImgAero: false,
            LockVideoUrl: "",
            LockVideoVoice: false,
            LockJsCover: "",
            Color: "",
            BgVersion: {
                Tzy: 7,
                Tdx: 8,
                ToutGate: 8,
                Nbgysh: 7,
                iTdos: 7,
                Api: 7,
                Auth: 7
            },
            OsClient: ""
        },
        CurrentTime: new Date(),
        LoginCover: true,
        CurrentUser: {
            Id: "",
            Avatar: "",
            NickName: ""
        },
        OsLoading: false,

        ClientCompany: "Loading...",
        ClientCompanyUrl: "",
        Lang: "zh-CN",
        CaptchaSendedSec: 0,
        ShowGotoWebOS: false,
        ThemeBodyClass: "bg-img-white",
        ThemeClass: "theme-orange",
        SystemStyle: "",
        WebTitle: "Loading...",
        ShortTitle: "",
        SystemSubTitle: "",
        EnableEnEdit: true,
        Mac: "",
        BaiduMapAk: "Eq3opqeD03kLwdeyBf308xiSCz6a7FIV",
        DiyChat: {
            Show: false,
            CurrentLastContact: {}
        },
        SysConfig: (() => {
            try {
                const config = LocalStorageManager.get("SysConfig");
                return config || {};
            } catch {
                return {};
            }
        })(),
        ShowClassicTop: 1,
        ShowClassicLeft: 1,
        themeColor: LocalStorageManager.get("themeColor") || "#409eff"
    }),

    getters: {
        GetCurrentUser: (state) => {
            let currentUser = state.CurrentUser;
            if (DiyCommon.IsNull(currentUser?.Id)) {
                try {
                    const cache = LocalStorageManager.get("CurrentUser");
                    if (!DiyCommon.IsNull(cache)) {
                        return cache;
                    }
                } catch {
                    return state.CurrentUser;
                }
            }
            return state.CurrentUser;
        }
    },

    actions: {
        setState(key, value) {
            if (this.$state.hasOwnProperty(key)) {
                this.$state[key] = value;
                // 不再单独存储 IsPhoneView，统一由 persist 管理
            }
        },
        
        setIsPhoneView(value) {
            this.IsPhoneView = value;
        },

        /**
         * 检测并设置是否在小程序 webview 中运行
         * 通过 URL 参数 source=xx-miniprogram 或 hideTabBar=1 或微信环境变量判断
         */
        detectMiniProgram() {
            try {
                // 方式1：微信环境变量
                if (window.__wxjs_environment === 'miniprogram') {
                    this.IsMiniProgram = true;
                    return;
                }
                // 方式2：URL 参数检测（hash 路由模式下参数在 hash 中）
                var href = location.href || '';
                var hash = location.hash || '';
                var search = location.search || '';
                var sourceReg = /source=(wx-miniprogram|alipay-miniprogram|tt-miniprogram|lark-miniprogram|xhs-miniprogram|miniprogram)/;
                if (sourceReg.test(hash) || sourceReg.test(search) || sourceReg.test(href)) {
                    this.IsMiniProgram = true;
                    return;
                }
                // 方式3：hideTabBar 参数（小程序 webview 跳转时附加）
                if (/hideTabBar=1/.test(hash) || /hideTabBar=1/.test(search)) {
                    this.IsMiniProgram = true;
                    return;
                }
                // 方式4：微信 JSSDK
                if (window.wx && window.wx.miniProgram) {
                    this.IsMiniProgram = true;
                    return;
                }
            } catch (e) {
                console.warn('[diyStore] detectMiniProgram error:', e);
            }
        },

        setIsMiniProgram(value) {
            this.IsMiniProgram = value;
        },

        setSysConfig(val) {
            this.SysConfig = val;
            LocalStorageManager.set("SysConfig", val);
            // APK (5+App) 环境：同时写入 plus.storage（原生 App 级全局存储，不受域名隔离）
            // 这样 hbuilder-app 壳页面下次启动时能通过 plus.storage 读到标题和公司名
            if (typeof window !== 'undefined' && window.plus) {
                try {
                    plus.storage.setItem('microi_apk_syscfg', JSON.stringify({
                        SysTitle: val?.SysTitle || '',
                        CompanyName: val?.CompanyName || ''
                    }));
                } catch(e) {}
            }
        },

        setDiyChatShow(val) {
            this.DiyChat.Show = val;
        },

        setDiyChatCurrentLastContact(val) {
            this.DiyChat.CurrentLastContact = val;
        },

        setShowGotoWebOS(val) {
            this.ShowGotoWebOS = val;
        },

        setLang(val) {
            this.Lang = val;
        },

        setOsClient(val) {
            this.OsClient = val;
        },

        setOsLoading(val) {
            this.OsLoading = val;
        },

        setCurrentUser(obj) {
            // 处理 Permission
            if (!DiyCommon.IsNull(obj._RoleLimits)) {
                obj._RoleLimits.forEach((roleLimit) => {
                    if (!DiyCommon.IsNull(roleLimit.Permission)) {
                        roleLimit.Permission = JSON.parse(roleLimit.Permission);
                    } else {
                        roleLimit.Permission = [];
                    }
                });
            } else {
                obj._RoleLimits = [];
            }
            this.CurrentUser = obj;
            LocalStorageManager.set("CurrentUser", obj);
        },

        setLoginCover(val) {
            this.LoginCover = val;
        },

        setCurrentTime(val) {
            this.CurrentTime = val;
        },

        setDesktopBg(obj) {
            for (const item in this.DesktopBg) {
                if (DiyCommon.IsNull(obj[item]) && obj[item] !== "") {
                    obj[item] = this.DesktopBg[item];
                }
            }
            LocalStorageManager.set("DesktopBg", obj);
            this.DesktopBg = obj;
        },

        setThemeColor(color) {
            this.themeColor = color;
            LocalStorageManager.set("themeColor", color);
        },
        
        // Token 相关 actions
        setToken(token) {
            this.Token = token;
            LocalStorageManager.set("Token", token);
        },
        
        getToken() {
            return this.Token || LocalStorageManager.get("Token") || "";
        },
        
        removeToken() {
            this.Token = "";
            LocalStorageManager.remove("Token");
        },
        
        setTokenExpires(expires) {
            this.TokenExpires = expires;
            LocalStorageManager.set("TokenExpires", expires);
        },
        
        getTokenExpires() {
            return this.TokenExpires || LocalStorageManager.get("TokenExpires") || "";
        },
        
        setDid(did) {
            this.Did = did;
            LocalStorageManager.set("Did", did);
        },
        
        getDid() {
            return this.Did || LocalStorageManager.get("Did") || "";
        },
        
        setLastLoginAccount(account) {
            this.LastLoginAccount = account;
            LocalStorageManager.set("LastLoginAccount", account);
        },
        
        getLastLoginAccount() {
            return this.LastLoginAccount || LocalStorageManager.get("LastLoginAccount") || "";
        },
        
        setDemoSelfLogout(val) {
            this.DemoSelfLogout = val;
            LocalStorageManager.set("DemoSelfLogout", val);
        }
    },

    persist: {
        key: "microi.net",
        storage: localStorage,
        paths: ["Lang", "ThemeClass", "SystemStyle", "IsPhoneView", "CurrentUser", "SysConfig", "DesktopBg", "themeColor", "ApiBase", "OsClient", "Token", "TokenExpires", "LastLoginAccount", "DemoSelfLogout", "Did"]
    }
});
