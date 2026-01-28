// Pinia Store - Diy (核心业务 store)
import { defineStore } from "pinia";
import { DiyCommon } from "@/utils/diy.common.js";

export const useDiyStore = defineStore("diy", {
    state: () => ({
        IsPhoneView: false, //是否是移动端分辨率访问系统
        OsClient: "",
        ApiBase: "",
        FileServer: "",
        MediaServer: "",
        ChatType: "",

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
        Version: "v2.5.1",
        Mac: "",
        BaiduMapAk: "Eq3opqeD03kLwdeyBf308xiSCz6a7FIV",
        DiyChat: {
            Show: false,
            CurrentLastContact: {}
        },
        SysConfig: (() => {
            try {
                const config = window.localStorage.getItem("Microi.SysConfig");
                return config ? JSON.parse(config) : {};
            } catch {
                return {};
            }
        })(),
        ShowClassicTop: 1,
        ShowClassicLeft: 1,
        themeColor: localStorage.getItem("Microi.themeColor") || "#409eff"
    }),

    getters: {
        GetCurrentUser: (state) => {
            let currentUser = state.CurrentUser;
            if (DiyCommon.IsNull(currentUser?.Id)) {
                try {
                    const cache = localStorage.getItem("Microi.CurrentUser");
                    if (!DiyCommon.IsNull(cache)) {
                        return JSON.parse(cache);
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
                localStorage.setItem("Microi." + key, value);
            }
        },

        setSysConfig(val) {
            this.SysConfig = val;
            if (typeof val === "string") {
                localStorage.setItem("Microi.SysConfig", val);
            } else {
                localStorage.setItem("Microi.SysConfig", JSON.stringify(val));
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
            localStorage.setItem("Microi.CurrentUser", JSON.stringify(obj));
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
            localStorage.setItem("Microi.DesktopBg", JSON.stringify(obj));
            this.DesktopBg = obj;
        },

        setThemeColor(color) {
            this.themeColor = color;
            localStorage.setItem("Microi.themeColor", color);
        }
    },

    persist: {
        key: "microi-diy",
        storage: localStorage,
        paths: ["Lang", "ThemeClass", "SystemStyle"]
    }
});
