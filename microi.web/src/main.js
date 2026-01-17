import Vue from "vue";
Vue.prototype.Vue = Vue;

//------- microi.net
import { RegMicroiComponents, DiyCommon } from "./utils/microi.net.import.js";
RegMicroiComponents(Vue);
//------- end

// LocalStorage 管理器
import LocalStorageManager from "./utils/localStorage-manager.js";
Vue.prototype.$localStorageManager = LocalStorageManager;

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
Vue.config.devtools = false;
Vue.config.silent = process.env.NODE_ENV === 'development';

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
            OsVersion: "v4.6.3",
            SignalROnCloseTimer: {},
            UnreadCount: 0,
            InitDiyWebcoketCount: 0,
            // 存储定时器引用，用于应用销毁时清理，防止内存泄漏
            appTimers: [],
            ChatType : '',
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
        
        // 初始化 LocalStorage 管理器（启动时清理）
        if (process.env.NODE_ENV !== 'production') {
            LocalStorageManager.init();
        }
        
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
        
        // ========== 内存监控（开发环境） ==========
        if (process.env.NODE_ENV !== 'production') {
            // 记录初始内存基准
            let initialMemory = null;
            let lastMemory = null;
            
            // 每30秒检查一次内存使用情况
            function memoryMonitorFunc() {
                try {
                    if (performance && performance.memory) {
                        const usedMemoryMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
                        const totalMemoryMB = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
                        const usagePercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2);
                        
                        // 首次记录初始内存
                        if (initialMemory === null) {
                            initialMemory = parseFloat(usedMemoryMB);
                        }
                        
                        // 计算内存增量
                        const memoryGrowth = lastMemory ? (parseFloat(usedMemoryMB) - lastMemory).toFixed(2) : 0;
                        const totalGrowth = (parseFloat(usedMemoryMB) - initialMemory).toFixed(2);
                        lastMemory = parseFloat(usedMemoryMB);
                        
                        // 警告阈值
                        const thresholds = [
                            { limit: 600, color: '#FFA500', severity: 'Microi：⚠️  轻度' },  // 600MB - 橙色警告
                            { limit: 1000, color: '#FF4500', severity: 'Microi：⚠️⚠️ 中度' },  // 1000MB - 红色警告
                            { limit: 1200, color: '#DC143C', severity: 'Microi：🔴 严重' }    // 1200MB - 深红色严重
                        ];
                        
                        // 记录到控制台，带有颜色和等级
                        let currentThreshold = thresholds[0];
                        if (performance.memory.usedJSHeapSize > thresholds[2].limit * 1024 * 1024) {
                            currentThreshold = thresholds[2];
                        } else if (performance.memory.usedJSHeapSize > thresholds[1].limit * 1024 * 1024) {
                            currentThreshold = thresholds[1];
                        }
                        
                        if (performance.memory.usedJSHeapSize > thresholds[0].limit * 1024 * 1024) {
                            console.warn(
                                `%c${currentThreshold.severity} 内存监控(含浏览器其它标签) | 已用: ${usedMemoryMB}MB / 总额: ${totalMemoryMB}MB (${usagePercent}%) | 增长: +${memoryGrowth}MB (总增长: +${totalGrowth}MB) | 开发环境的热重载可能导致某些模块残留，请关闭此标签页以彻底释放内存`,
                                `color: white; background-color: ${currentThreshold.color}; padding: 5px 10px; border-radius: 3px; font-weight: bold;`
                            );
                            
                            // 对于严重情况，输出详细诊断信息
                            if (performance.memory.usedJSHeapSize > thresholds[1].limit * 1024 * 1024) {
                                console.warn('%cMicroi[内存泄漏诊断]', 'color: red; font-weight: bold;', {
                                    '当前内存': `${usedMemoryMB}MB`,
                                    '初始内存': `${initialMemory}MB`,
                                    '总增长': `+${totalGrowth}MB`,
                                    '内存上限': `${totalMemoryMB}MB`,
                                    '使用率': `${usagePercent}%`
                                });
                                
                                // 输出 LocalStorage 使用情况
                                try {
                                    let localStorageSize = 0;
                                    for (let key in localStorage) {
                                        if (localStorage.hasOwnProperty(key)) {
                                            localStorageSize += localStorage[key].length + key.length;
                                        }
                                    }
                                    const localStorageKB = (localStorageSize / 1024).toFixed(2);
                                    console.warn('%cMicroi[LocalStorage 使用情况]', 'color: orange; font-weight: bold;', {
                                        '大小': `${localStorageKB}KB`,
                                        '项数': Object.keys(localStorage).length,
                                        '提示': 'LocalStorage 刷新页面不会清除！如果存储了大量数据，可能导致初始内存过高'
                                    });
                                } catch (e) {
                                    console.debug('无法访问 LocalStorage');
                                }
                            }
                        } else {
                            console.info(
                                `%cMicroi：🟢 正常 内存监控(含浏览器其它标签) | 已用: ${usedMemoryMB}MB / 总额: ${totalMemoryMB}MB (${usagePercent}%) | 增长: +${memoryGrowth}MB `,
                                `color: white; background-color: #28a745; padding: 5px 10px; border-radius: 3px; font-weight: bold;`
                            );
                        }
                    }
                } catch (error) {
                    // 某些浏览器不支持 performance.memory，忽略错误
                    console.debug('浏览器不支持 performance.memory API');
                }
            }
            var memoryMonitorTimer = setInterval(memoryMonitorFunc, 30000); // 30秒检查一次
            memoryMonitorFunc(); // 立即执行一次
            
            self.appTimers.push(memoryMonitorTimer);
            
            // 添加全局方法用于手动诊断
            window.Microi_Memory_Check = function() {
                console.group('%c📊 Microi 内存诊断报告', 'color: white; background-color: #007bff; padding: 5px 10px; font-weight: bold; font-size: 14px;');
                
                // 1. 内存快照
                if (performance && performance.memory) {
                    console.log('%c1️⃣ 内存快照 (performance.memory API)', 'color: #007bff; font-weight: bold;');
                    console.log('%c⚠️ 注意: 这个数据可能包含同一渲染进程中的其他标签页内存', 'color: orange; font-size: 12px;');
                    console.table({
                        '当前使用': `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
                        '初始基准': initialMemory ? `${initialMemory}MB` : '未记录',
                        '总增长': initialMemory ? `+${((performance.memory.usedJSHeapSize / 1024 / 1024) - initialMemory).toFixed(2)}MB` : '未记录',
                        '内存上限': `${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
                        '使用率': `${((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2)}%`
                    });
                }
                
                // 2. LocalStorage 检查
                console.log('%c2️⃣ LocalStorage 检查', 'color: #007bff; font-weight: bold;');
                try {
                    let totalSize = 0;
                    const items = [];
                    for (let key in localStorage) {
                        if (localStorage.hasOwnProperty(key)) {
                            const size = localStorage[key].length + key.length;
                            totalSize += size;
                            items.push({
                                '键名': key,
                                '大小': `${(size / 1024).toFixed(2)}KB`,
                                '预览': localStorage[key].substring(0, 50) + (localStorage[key].length > 50 ? '...' : '')
                            });
                        }
                    }
                    console.log(`总大小: ${(totalSize / 1024).toFixed(2)}KB | 项数: ${items.length}`);
                    console.table(items.sort((a, b) => parseFloat(b['大小']) - parseFloat(a['大小'])).slice(0, 10)); // 显示前10个最大的
                } catch (e) {
                    console.warn('无法访问 LocalStorage');
                }
                
                // 3. SessionStorage 检查
                console.log('%c3️⃣ SessionStorage 检查', 'color: #007bff; font-weight: bold;');
                try {
                    let totalSize = 0;
                    const items = [];
                    for (let key in sessionStorage) {
                        if (sessionStorage.hasOwnProperty(key)) {
                            const size = sessionStorage[key].length + key.length;
                            totalSize += size;
                            items.push({
                                '键名': key,
                                '大小': `${(size / 1024).toFixed(2)}KB`
                            });
                        }
                    }
                    console.log(`总大小: ${(totalSize / 1024).toFixed(2)}KB | 项数: ${items.length}`);
                    if (items.length > 0) {
                        console.table(items.sort((a, b) => parseFloat(b['大小']) - parseFloat(a['大小'])).slice(0, 10));
                    }
                } catch (e) {
                    console.warn('无法访问 SessionStorage');
                }
                
                // 4. 定时器检查
                console.log('%c4️⃣ 应用定时器', 'color: #007bff; font-weight: bold;');
                console.log(`已注册定时器数量: ${self.appTimers.length}`);
                
                // 5. 建议
                console.log('%c5️⃣ 诊断建议', 'color: #007bff; font-weight: bold;');
                const suggestions = [];
                
                if (performance && performance.memory && performance.memory.usedJSHeapSize > 600 * 1024 * 1024) {
                    suggestions.push('⚠️ 内存使用超过600MB，建议刷新页面');
                }
                
                // 检查 LocalStorage 大小
                try {
                    let localStorageSize = 0;
                    for (let key in localStorage) {
                        if (localStorage.hasOwnProperty(key)) {
                            localStorageSize += localStorage[key].length + key.length;
                        }
                    }
                    if (localStorageSize > 500 * 1024) { // 超过500KB
                        suggestions.push(`⚠️ LocalStorage 使用了 ${(localStorageSize / 1024).toFixed(2)}KB，可能影响初始加载。`);
                    }
                } catch (e) {}
                
                if (suggestions.length === 0) {
                    suggestions.push('✅ 一切正常');
                }
                
                suggestions.forEach(s => console.log(s));
                
                console.groupEnd();
            };
            
            // 启动时检查 LocalStorage 异常情况
            try {
                let localStorageSize = 0;
                const itemSizes = [];
                
                for (let key in localStorage) {
                    if (localStorage.hasOwnProperty(key)) {
                        const size = localStorage[key].length + key.length;
                        localStorageSize += size;
                        itemSizes.push({
                            key: key,
                            size: size
                        });
                    }
                }
                
                // 1. 检查是否有单个key占用超过50%的情况
                itemSizes.forEach(item => {
                    const percentage = (item.size / localStorageSize) * 100;
                    if (percentage > 50) {
                        console.warn(
                            `%c⚠️ 发现异常缓存 "${item.key}" 占用 ${(item.size / 1024).toFixed(2)}KB (${percentage.toFixed(1)}%)`,
                            'color: white; background-color: #ff9800; padding: 5px 10px; font-weight: bold;'
                        );
                        console.log(`%c建议: 检查该缓存项是否正常，考虑清理或优化`, 'color: #ff9800; font-weight: bold;');
                    }
                });
                
                // 2. 检查 LocalStorage 总大小
                if (localStorageSize > 2 * 1024 * 1024) { // 超过 2MB
                    console.warn(
                        `%c⚠️ LocalStorage 过大 (${(localStorageSize / 1024).toFixed(2)}KB)`,
                        'color: white; background-color: #ff6b6b; padding: 5px 10px; font-weight: bold;'
                    );
                    console.log(`%c建议: 运行 Microi_Memory_Check() 查看详细信息，考虑清理不必要的缓存`, 'color: #ff6b6b; font-weight: bold;');
                }
            } catch (e) {
                console.debug('无法检查 LocalStorage');
            }
            
            console.info(
                '%c💡 Microi提示: 输入 Microi_Memory_Check() 可查看详细内存诊断报告 | 开发环境的热重载可能导致某些模块残留，届时请关闭此标签页以彻底释放内存',
                `color: white; background-color: #28a745; padding: 5px 10px; border-radius: 3px; font-weight: bold;`
            );
        }
        // ========== 内存监控结束 ==========
        
        var timer = setInterval(() => {
        	self.InitDiyWebcoket(timer);
        }, 5000);
        self.InitDiyWebcoket();
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
            if (!self.DiyCommon.IsNull(self.GetCurrentUser.Id) && self.ChatType == '吾码IM') {
                // && self.InitDiyWebcoketCount <= 10
                if (self.$websocket == null || (self.$websocket.connectionState != "Connected" && self.$websocket.connectionState != "Connecting")) {
                    const url =
                        DiyCommon.GetApiBase() +
                        `/diy-websocket?UserId=${self.GetCurrentUser.Id}&UserName=${self.GetCurrentUser.Name}&UserAvatar=${self.DiyCommon.GetServerPath(
                            self.GetCurrentUser.Avatar
                        )}&OsClient=${DiyCommon.GetOsClient()}`;
                    // console.log("准备连接消息服务器...");
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
                            // console.log("连接消息服务器成功！");
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
                            // console.log("消息服务器正在重连...", error);
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
