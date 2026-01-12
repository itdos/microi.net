import { DosCommon } from "@/utils/dos.common.js";
import { DiyCommon } from "@/utils/diy.common.js";
const state = {
    OsClient: "",
    ApiBase: "",
    FileServer: "",
    MediaServer: "",

    DesktopBg: {
        // 桌面背景图片
        ImgUrl: "",
        // 是否虚化
        ImgAero: false,
        // 视频桌面
        VideoUrl: "",
        // 注：muted=false为开启声音，VideoVoice为true表示开启声音。
        // 若默认为true，会导致chrome触发【Uncaught (in promise) DOMException: play() failed because the user didn't interact with the document first.】错误。
        VideoVoice: false,
        // Js特效
        JsCover: "",

        // 锁屏背景图片
        LockImgUrl: "",
        // 桌面背景图片
        LockImgAero: false,
        // 视频桌面
        LockVideoUrl: "",
        LockVideoVoice: false,
        // Js特效
        LockJsCover: "",

        // 主题色
        Color: "",
        // 背景图片版本，更新默认背景图时增大数字
        BgVersion: {
            Tzy: 7,
            Tdx: 8,
            ToutGate: 8,
            Nbgysh: 7,
            iTdos: 7,
            Api: 7,
            Auth: 7
        },
        // 客户端标识（如：Tdx、Tzy）
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
    SysConfig: window.localStorage.getItem("Microi.SysConfig") || {},
    ShowClassicTop: 1,
    ShowClassicLeft: 1
};
const mutations = {
    SetState: (state, { key, value }) => {
        if (state.hasOwnProperty(key)) {
            state[key] = value;
            localStorage.setItem("Microi." + key, value);
        }
    },
    SetSysConfig(state, val) {
        state.SysConfig = val;
        if (typeof val == "string") {
            localStorage.setItem("Microi.SysConfig", val);
        } else {
            localStorage.setItem("Microi.SysConfig", JSON.stringify(val));
        }
    },
    SetDiyChatShow(state, val) {
        state.DiyChat.Show = val;
    },
    SetDiyChatCurrentLastContact(state, val) {
        state.DiyChat.CurrentLastContact = val;
    },
    SetShowGotoWebOS(state, val) {
        state.ShowGotoWebOS = val;
    },
    SetLang(state, val) {
        state.Lang = val;
    },
    SetOsClient(state, val) {
        state.OsClient = val;
    },
    SetOsLoading(state, val) {
        state.OsLoading = val;
    },
    SetCurrentUser(state, obj) {
        //处理Permission
        // obj._Permission = [];
        if (!DiyCommon.IsNull(obj._RoleLimits)) {
            obj._RoleLimits.forEach((roleLimit) => {
                if (!DiyCommon.IsNull(roleLimit.Permission)) {
                    roleLimit.Permission = JSON.parse(roleLimit.Permission);
                    // obj._Permission.push();
                } else {
                    roleLimit.Permission = [];
                }
            });
        } else {
            obj._RoleLimits = [];
        }
        state.CurrentUser = obj;
        localStorage.setItem("Microi.CurrentUser", JSON.stringify(obj));
    },
    SetLoginCover(state, obj) {
        state.LoginCover = obj.Data;
    },
    SetCurrentTime(state, obj) {
        state.CurrentTime = obj.Data;
    },
    SetDesktopBg(state, obj) {
        state.DesktopBg = obj;
    }
};
const actions = {
    // SetDesktopBg之所以使用actions，是将来可能会有异步处理，数据同步至服务器
    SetDesktopBg({ commit, state }, obj) {
        for (var item in state.DesktopBg) {
            if (DiyCommon.IsNull(obj[item]) && obj[item] != "") {
                obj[item] = state.DesktopBg[item];
            }
        }
        localStorage.setItem("Microi.DesktopBg", JSON.stringify(obj));
        commit("SetDesktopBg", obj);
    },
    SetLang({ commit }, val) {
        commit("SetLang", val);
    }
};
// 返回改变后的数值
const getters = {
    GetCurrentUser: (state) => {
        var currentUser = state.CurrentUser;
        if (DiyCommon.IsNull(currentUser.Id)) {
            var cache = localStorage.getItem("Microi.CurrentUser");
            if (!DiyCommon.IsNull(cache)) {
                return JSON.parse(cache);
            }
        }
        return state.CurrentUser;
    }
};
// export default DiyStore
// export {
//     DiyStore
// }
export default {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
};
