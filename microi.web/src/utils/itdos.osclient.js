// Pinia store 适配层
import pinia from "@/pinia";
import { useDiyStore } from "@/pinia";
import { DiyCommon, DosCommon } from "@/utils/microi.net.import";
import _, { any } from "underscore";
import config from "@/config.json";

// 辅助函数：获取 DiyStore
const getDiyStore = () => useDiyStore(pinia);

// Vuex 兼容层 - 用于逐步迁移
const store = {
    state: {
        get DiyStore() {
            return getDiyStore().$state;
        }
    },
    commit: (mutation, payload) => {
        const diyStore = getDiyStore();
        const [module, mutationName] = mutation.split("/");
        if (module === "DiyStore") {
            switch (mutationName) {
                case "SetState":
                    diyStore.setState(payload.key, payload.value);
                    break;
                case "SetSysConfig":
                    diyStore.setSysConfig(payload);
                    break;
                default:
                    console.warn(`Unknown mutation: ${mutation}`);
            }
        }
    },
    dispatch: (action, payload) => {
        const diyStore = getDiyStore();
        const [module, actionName] = action.split("/");
        if (module === "DiyStore") {
            switch (actionName) {
                case "SetDesktopBg":
                    diyStore.setDesktopBg(payload);
                    break;
                default:
                    console.warn(`Unknown action: ${action}`);
            }
        }
    }
};

var DiyOsClient = {
    /**
     * 初始化os时，首先知道是哪个osclient，才能获取到ApiBase
     * 指定osclient方式及权重：
     * 1、index.html
     * 2、url的OsClient参数
     * 3、域名对应
     * 4、DiyCommon.SetOsClient/SetApiBase【原理是localStorage和vuex】
     * @param {*} init
     */
    OsClientInit: async function (init) {
        var self = this;
        //先获取ApiBase
        var apiBase = DiyOsClient.GetApiBase();
        store.commit("DiyStore/SetState", {
            key: "ApiBase",
            value: apiBase
        });
        DiyCommon.SetApiBase(apiBase);

        //预获取OsClient
        if (DiyOsClient.GetOsClientNotDomain() == "") {
            var getOsClientByDomainResult = await DiyCommon.PostAsync("/api/Os/GetOsClientByDomain", {
                Domain: location.host.toLocaleLowerCase()
            });
            if (getOsClientByDomainResult.Code == 1 && getOsClientByDomainResult.Data) {
                var osClient = getOsClientByDomainResult.Data.OsClient || getOsClientByDomainResult.Data.OSCLIENT;
                DiyCommon.SetOsClient(osClient);
            }
        }

        var osClient = DiyOsClient.GetOsClient();
        store.commit("DiyStore/SetState", {
            key: "OsClient",
            value: osClient
        });
        DiyCommon.SetOsClient(osClient);

        var href = window.location.href.toLowerCase();
        //同步从服务器中获取配置信息，一种是使用await，一种是使用 Promise、Then里面获取
        var sysConfig = null;
        var sysConfigResult = await DiyCommon.PostAsync("/api/diyTable/getSysConfig", {
            _SearchEqual: {
                IsEnable: 1
            },
            OsClient: osClient
        });
        if (sysConfigResult.Code == 1) {
            sysConfig = sysConfigResult.Data;
            if (DiyCommon.IsNull(sysConfig)) {
                DiyCommon.Tips("获取系统设置信息为空！", false);
            } else {
                store.commit("DiyStore/SetSysConfig", sysConfig);
            }
        } else {
            DiyCommon.Tips("获取系统设置信息失败：" + sysConfigResult.Msg, false);
        }

        //-----------------end
        if (!DiyCommon.IsNull(sysConfig)) {
            store.commit("DiyStore/SetSysConfig", sysConfig);
            //设置cdn相关
            if (!DiyCommon.IsNull(sysConfig.FileServer)) {
                var fileServer = sysConfig.FileServer;
                //2023-10-31新增：FileServer以环境变量优先
                try {
                    if (FileServer) {
                        fileServer = FileServer;
                    }
                } catch (error) {}
                store.commit("DiyStore/SetState", {
                    key: "FileServer",
                    value: fileServer
                });
            } else {
                var fileServer = DiyOsClient.GetFileServer(osClient);
                store.commit("DiyStore/SetState", {
                    key: "FileServer",
                    value: fileServer
                });
            }
            if (!DiyCommon.IsNull(sysConfig.MediaServer)) {
                store.commit("DiyStore/SetState", {
                    key: "MediaServer",
                    value: sysConfig.MediaServer
                });
            } else {
                var mediaServer = DiyOsClient.GetMediaServer(osClient);
                store.commit("DiyStore/SetState", {
                    key: "MediaServer",
                    value: mediaServer
                });
            }

            // 取背景
            var desktopBg = localStorage.DesktopBg;
            if (!DiyCommon.IsNull(desktopBg)) {
                try {
                    desktopBg = JSON.parse(desktopBg);
                    if (
                        !DiyCommon.IsNull(desktopBg.BgVersion) &&
                        !DiyCommon.IsNull(desktopBg.BgVersion[osClient]) &&
                        !DiyCommon.IsNull(desktopBg.OsClient) &&
                        desktopBg.OsClient == osClient &&
                        desktopBg.BgVersion[osClient] >= store.state.DiyStore.DesktopBg.BgVersion[osClient]
                    ) {
                        store.dispatch("DiyStore/SetDesktopBg", desktopBg);
                        // 设置主题色
                        if (!DiyCommon.IsNull(desktopBg.Color)) {
                            DiyCommon.SetThemeColor(desktopBg.Color);
                        }
                    } else {
                        init = true;
                    }
                } catch (error) {
                    init = true;
                    console.log(error);
                }
            } else {
                init = true;
            }

            if (DiyCommon.IsNull(localStorage.lang)) {
                DiyCommon.ChangeLang(DiyCommon.IsNull(sysConfig.SysLang) ? "zh-CN" : sysConfig.SysLang, true);
            } else {
                DiyCommon.ChangeLang(localStorage.lang, true);
            }
            DiyCommon.SetWebTitle(DiyCommon.IsNull(sysConfig.SysTitle) ? "Loading..." : sysConfig.SysTitle);
            DiyCommon.SetShortTitle(DiyCommon.IsNull(sysConfig.SysShortTitle) ? "Loading..." : sysConfig.SysShortTitle);
            DiyCommon.SetClientCompany(DiyCommon.IsNull(sysConfig.CompanyName) ? "Loading..." : sysConfig.CompanyName);
            if (!DiyCommon.IsNull(sysConfig.FaviconIco)) {
                var link = document.querySelector("link[rel*='icon']") || document.createElement("link");
                link.type = "image/x-icon";
                link.rel = "shortcut icon";
                link.href = DiyCommon.GetServerPath(sysConfig.FaviconIco);
                document.getElementsByTagName("head")[0].appendChild(link);
            }
            store.commit("DiyStore/SetState", {
                key: "EnableEnEdit",
                value: true
            });

            if (DiyCommon.IsNull(store.state.DiyStore.DesktopBg.ImgUrl) || init === true) {
                store.dispatch("DiyStore/SetDesktopBg", {
                    ImgUrl: DiyCommon.GetServerPath("/static/img/desktop-bg.jpg"),
                    ImgAero: false,
                    VideoUrl: "",
                    VideoVoice: store.state.DiyStore.DesktopBg.VideoVoice,

                    LockImgUrl: DiyCommon.GetServerPath(DiyCommon.IsNull(sysConfig.LoginBgImg) ? "./static/img/desktop-bg.jpg" : sysConfig.LoginBgImg),
                    LockImgAero: false,
                    LockVideoUrl: "",
                    LockVideoVoice: store.state.DiyStore.DesktopBg.LockVideoVoice,

                    OsClient: osClient,
                    Color: "13"
                });
                DiyCommon.SetThemeColor("13");
            }
        }
    },
    GetApiBase: function () {
        // 读取 config.json 中的配置（修改 JSON 文件后，Vite HMR 会自动更新）
        if (config && config.ApiBaseDev) {
            return config.ApiBaseDev.replace(/\/+$/, "");
        }
        
        //如果index.html指定了ApiBase，这个权重最大
        if (!DiyCommon.IsNull(ApiBase)) {
            return ApiBase.trim().replace(/\/+$/, "");
        }
        
        return "https://api.itdos.com";
    },

    GetOsClient: function () {
        var self = this;
        var osClient = DiyOsClient.GetOsClientNotDomain();
        if (osClient == "") {
            return "iTdos";
        }

        return osClient;

        // 根据域名判断是哪个客户，只会在一套os程序为N个客户提供服务时才会执行以下代码
        // 后来还是通过默认的ApiBase从SysOsClient中获取
        // var domainOsClient = _.find(this.DomainOsClients, function(item){
        //     if (href.indexOf(item.Domain) > -1) {
        //         return true;
        //     }
        //     return false;
        // });
        // if (domainOsClient) {
        //     return domainOsClient.OsClient;
        // }else{
        //     return 'iTdos'
        // }
    },
    GetOsClientNotDomain: function () {
        var self = this;
        //如果Index.html指定了OsClient，这个权力最大
        //一般单独部署的客户，都是以Index.html为准，但iTdos官方是一套程序支持N个客户，不是以index.html为准，而是以域名为准
        if (!DiyCommon.IsNull(OsClient)) {
            return OsClient;
        }
        var href = window.location.href.toLowerCase();
        var reg190317 = new RegExp("(^|&)" + "OsClient" + "=([^&]*)(&|$)");
        var r190317 = window.location.search.substr(1).match(reg190317);
        var osClient = r190317 != null ? r190317[2] : null;
        //2020-04-02 ?OsClient=xxx优先，本地调试用
        if (osClient) {
            return osClient;
        }
        if (!DiyCommon.IsNull(localStorage.getItem("Microi.OsClient"))) {
            return localStorage.getItem("Microi.OsClient");
        }
        return "";
    },
    //此函数其实不再使用，FileServer都是通过系统设置里面的FileServer获取了。 --2022-06-09
    GetFileServer: function (osClient) {
        try {
            if (FileServer) {
                return FileServer;
            }
        } catch (error) {}
        return "https://static.itdos.com";
    },
    //此函数其实不再使用，MediaServer都是通过系统设置里面的MediaServer获取了。 --2022-06-09
    GetMediaServer: function (osClient) {
        return "https://static.itdos.com";
    }
};
export { DiyOsClient };
