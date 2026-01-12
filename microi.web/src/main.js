import Vue from "vue";
Vue.prototype.Vue = Vue;

//------- microi.net
import { RegMicroiComponents, DiyCommon } from "./utils/microi.net.import.js";
RegMicroiComponents(Vue);
//------- end

import { Base64 } from "js-base64";
Vue.prototype.Base64 = Base64;
import Cookies from "js-cookie";

import "normalize.css/normalize.css"; // a modern alternative to CSS resets

import Element from "element-ui";
import "./styles/element-variables.scss";
import "element-ui/lib/theme-chalk/index.css";
import "@/assets/styles/global.css"; // 引入全局样式

import "@/styles/index.scss"; // global css
import "@/styles/microi.chat/fonts/iconfont.css";
import "@/styles/microi.chat/reset.scss";
import "@/styles/microi.chat/layout.scss";

import App from "./App";
import store from "./store";
import router from "./router";

import i18n from "./lang"; // internationalization
import "./icons"; // icon
import "./permission"; // permission control
import "./utils/error-log"; // error log

import * as filters from "./filters"; // global filters

// 导入插件管理器(李赛赛：插件系统)
import { initializePluginSystem } from "@/views/plugins/index.js";

Vue.use(Element, {
    theme: "chalk", // 使用 chalk 主题
    size: Cookies.get("size") || "mini" // set element-ui default size
    // i18n: (key, value) => i18n.t(key, value)
});

// register global utility filters
Object.keys(filters).forEach((key) => {
    Vue.filter(key, filters[key]);
});

Vue.config.productionTip = false;

//by itdos
import "../public/static/css/fontawesome/css/all.min.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.min";
import "bootstrap";

import animated from "animate.css";
Vue.use(animated);

import "./views/microi/css/itdos.classic.scss";
import "./styles/itdos.diy.scss";

import axios from "axios";
Vue.prototype.$axios = axios;

import { DiyOsClient } from "./utils/itdos.osclient";
Vue.prototype.DiyOsClient = DiyOsClient;

import $ from "jquery";
window.$ = window.jQuery = window.jquery = require("jquery");

Vue.prototype.$websocket = null;
import * as websocket from "@microsoft/signalr";

// import VueAMap from 'vue-amap'
// Vue.use(VueAMap)
// Vue.prototype.VueAMap = VueAMap;

// import startQiankun from '@/views/microi/microiservice/index'// 注入乾坤基座配置

// DiyCommon.SetApiBase('https://api-china.itdos.com');
// DiyCommon.SetOsClient('iTdos');

import { registerMicroApps, addGlobalUncaughtErrorHandler, start } from "qiankun";

// 设置插件管理器的路由和store实例（李赛赛：插件系统）
// 初始化插件系统
async function initPlugins() {
    try {
        await initializePluginSystem({
            router: router,
            store: store
        });
    } catch (error) {
        console.error("插件系统初始化失败:", error);
    }
}
new Vue({
    el: "#app_microi",
    router,
    store,
    i18n,
    render: (h) => h(App),
    computed: {
        GetCurrentUser: function () {
            return this.$store.getters["DiyStore/GetCurrentUser"];
        }
    },
    data() {
        return {
            OsVersion: "v3.22.4",
            SignalROnCloseTimer: {},
            UnreadCount: 0,
            InitDiyWebcoketCount: 0,
            // 存储定时器引用，用于应用销毁时清理，防止内存泄漏
            appTimers: []
        };
    },
    async created() {
        var self = this;

        var systemStyle = localStorage.getItem("Microi.SystemStyle");
        if (!self.DiyCommon.IsNull(systemStyle)) {
            self.$store.commit("DiyStore/SetState", {
                key: "SystemStyle",
                value: systemStyle
            });
            document.body.classList.add(systemStyle);
        }

        var showClassicTop = decodeURIComponent((new RegExp("[?|&|%3F]" + "ShowClassicTop=" + "([^&;]+?)(&|#|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
        if (!self.DiyCommon.IsNull(showClassicTop) && (showClassicTop == "false" || showClassicTop == 0)) {
            //需要隐藏顶部
            self.$store.commit("DiyStore/SetState", {
                key: "ShowClassicTop",
                value: 0
            });
        }

        var showClassicLeft = decodeURIComponent((new RegExp("[?|&|%3F]" + "ShowClassicLeft=" + "([^&;]+?)(&|#|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
        if (!self.DiyCommon.IsNull(showClassicLeft) && (showClassicLeft == "false" || showClassicLeft == 0)) {
            //需要隐藏左侧菜单
            self.$store.commit("DiyStore/SetState", {
                key: "ShowClassicLeft",
                value: 0
            });
        }

        var osClient = DiyCommon.GetOsClient();
        await DiyOsClient.OsClientInit(true);
    },
    mounted() {
        // console.log('-------> main.js mounted');
        var self = this;
        store.commit("DiyStore/SetCurrentTime", { Data: new Date() });
        // 保存定时器引用，用于应用销毁时清理
        var currentTimeTimer = setInterval(function () {
            store.commit("DiyStore/SetCurrentTime", {
                Data: new Date().AddTime("s", 1)
            });
        }, 1000);
        self.appTimers.push(currentTimeTimer);

        self.$nextTick(function () {
            LoadRate(80);
        });
        // var timer = setInterval(() => {
        // 	self.InitDiyWebcoket(timer);
        // }, 5000);
        // self.InitDiyWebcoket();
        // 在Vue实例挂载后初始化插件
        initPlugins();
    },
    beforeDestroy() {
        var self = this;
        // 清理所有定时器，防止内存泄漏
        self.appTimers.forEach(function (timer) {
            clearInterval(timer);
        });
        self.appTimers = [];
        // 关闭 WebSocket 连接
        if (self.$websocket) {
            try {
                self.$websocket.stop();
            } catch (error) {
                console.log("关闭 WebSocket 连接失败:", error);
            }
        }
    },
    methods: {
        InitDiyWebcoket(timer) {
            var self = this;
            if (!self.DiyCommon.IsNull(self.GetCurrentUser.Id)) {
                // && self.InitDiyWebcoketCount <= 10
                if (self.$websocket == null || (self.$websocket.connectionState != "Connected" && self.$websocket.connectionState != "Connecting")) {
                    const url =
                        DiyCommon.GetApiBase() +
                        `/diy-websocket?UserId=${self.GetCurrentUser.Id}&UserName=${self.GetCurrentUser.Name}&UserAvatar=${self.DiyCommon.GetServerPath(
                            self.GetCurrentUser.Avatar
                        )}&OsClient=${DiyCommon.GetOsClient()}`;
                    console.log("准备连接消息服务器...");
                    // self.InitDiyWebcoketCount++;
                    try {
                        self.$websocket = new websocket.HubConnectionBuilder()
                            .withUrl(url)
                            .withAutomaticReconnect({
                                nextRetryDelayInMilliseconds: (retryContext) => {
                                    return 5000; //2022-03-24从1000修改为5000
                                }
                            })
                            .build();
                        Vue.prototype.$websocket = self.$websocket;
                        self.$websocket.serverTimeoutInMilliseconds = 1000 * 60 * 20;
                        self.$websocket.keepAliveIntervalInMilliseconds = 1000 * 60 * 20;
                        self.$websocket.start().then(function () {
                            console.log("连接消息服务器成功！");
                            // clearInterval(timer);
                            // self.InitDiyWebcoketCount = 0;
                        });
                        self.$websocket.onclose((error) => {
                            console.log("消息服务器已断开！", error);
                        });
                        self.$websocket.onreconnected((connectionId) => {
                            console.log("消息服务器已重新连接！", connectionId);
                        });
                        self.$websocket.onreconnecting((error) => {
                            console.log("消息服务器正在重连...", error);
                        });
                    } catch (error) {
                        //console.log('消息服务器正在重连...', error);
                        // setTimeout(() => {
                        //     self.InitDiyWebcoket();//timer
                        // }, 5000);
                    }
                }
            } else {
                setTimeout(() => {
                    self.InitDiyWebcoket(); //timer
                }, 5000);
            }
        },
        OpenDiyChat(userModel) {
            var self = this;
            if (self.$websocket == null) {
                self.DiyCommon.Tips("正在连接消息服务器，请重试...", false);
                return;
            }
            self.$websocket
                .invoke("SendConnectToUser", {
                    FromUserId: self.GetCurrentUser.Id,
                    FromUserName: self.GetCurrentUser.Name,
                    FromUserAvatar: self.DiyCommon.GetServerPath(self.GetCurrentUser.Avatar),
                    ToUserId: userModel.Id,
                    ToUserName: userModel.Name,
                    ToUserAvatar: self.DiyCommon.GetServerPath(userModel.Avatar),
                    OsClient: self.DiyCommon.GetOsClient()
                })
                .then((_) => {
                    self.$store.commit("DiyStore/SetDiyChatCurrentLastContact", {
                        ContactUserId: userModel.Id,
                        ContactUserName: userModel.Name,
                        ContactUserAvatar: self.DiyCommon.GetServerPath(userModel.Avatar),
                        UserId: self.GetCurrentUser.Id,
                        UserName: self.GetCurrentUser.Name,
                        UserAvatar: self.DiyCommon.GetServerPath(self.GetCurrentUser.Avatar)
                    });
                    self.$store.commit("DiyStore/SetDiyChatShow", true);
                })
                .catch((err) => {
                    console.error(`建立与[${userModel.Name}]的聊天失败：`, err);
                    self.DiyCommon.Tips(err.toString(), false);
                });
            //获取与这个人的所有聊天记录
            self.$websocket
                .invoke("SendChatRecordToUser", {
                    FromUserId: self.GetCurrentUser.Id,
                    FromUserName: self.GetCurrentUser.Name,
                    ToUserId: userModel.Id,
                    ToUserName: userModel.Name,
                    OsClient: self.DiyCommon.GetOsClient()
                })
                .then((res) => {
                    console.log(`获取与[${userModel.Name}]的聊天记录成功！`);
                })
                .catch((err) => {
                    console.error(`获取与[${userModel.Name}]的聊天记录失败：`, err);
                });
        }
    }
});
