// Vue 3 + Vite + Pinia 入口文件
import { createApp, nextTick } from "vue";

import packageInfo from "../package.json";

//------- microi.net
import { RegMicroiComponents, DiyCommon } from "./utils/microi.net.import.js";
//------- end

// LocalStorage 管理器
import LocalStorageManager from "./utils/localStorage-manager.js";

import { Base64 } from "js-base64";
import Cookies from "js-cookie";

import "normalize.css/normalize.css"; // a modern alternative to CSS resets

// Element Plus
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
// Element Plus 图标
import * as ElementPlusIconsVue from "@element-plus/icons-vue";

import "./styles/element-variables.scss";
import "@/assets/styles/global.css"; // 引入全局样式

import "@/styles/index.scss"; // global css
// Bootstrap 兼容样式（替代已移除的 Bootstrap）
import "@/styles/bootstrap-compat.scss";
// Element Plus 图标兼容样式
import "@/styles/element-icons-compat.scss";
import "@/styles/microi.chat/fonts/iconfont.css";
import "@/styles/microi.chat/reset.scss";
import "@/styles/microi.chat/layout.scss";

import App from "./App.vue";
// 使用 Pinia 替代 Vuex
import pinia, { useDiyStore } from "./stores";
import router from "./router";

import i18n from "./lang"; // internationalization
// Vite SVG 图标注册
import "virtual:svg-icons-register";
import "./permission"; // permission control
import "./utils/error-log"; // error log

import "animate.css";

import "./views/microi/css/itdos.classic.scss";
import "./styles/itdos.diy.scss";

import axios from "axios";

import { DiyOsClient } from "./utils/itdos.osclient";

import $ from "jquery";
window.$ = window.jQuery = window.jquery = $;

import * as websocket from "@microsoft/signalr";

// 创建 Vue 3 应用实例
const app = createApp(App);

// 注册全局属性（替代 Vue.prototype）
app.config.globalProperties.Base64 = Base64;
app.config.globalProperties.$localStorageManager = LocalStorageManager;
app.config.globalProperties.$axios = axios;
app.config.globalProperties.DiyOsClient = DiyOsClient;
app.config.globalProperties.$websocket = null;
app.config.globalProperties.OsVersion = `v${packageInfo.version}`;

// 注册 microi 组件到 Vue 3
RegMicroiComponents(app);

// 注册 drag 指令 (Vue 3 方式)
import drag from "./utils/dos.common";
app.directive("drag", drag);

// 注册 chat 组件 (Vue 3 方式)
import chatComponents from "./views/diy/microi.chat/components.js";
app.use(chatComponents);

// 使用 Pinia
app.use(pinia);

// 使用 Element Plus
app.use(ElementPlus, {
    locale: zhCn,
    size: Cookies.get("size") || "default"
});

// 全局注册 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
}

// 注册动态图标组件
import DynamicIcon from "./components/DynamicIcon/index.vue";
app.component("DynamicIcon", DynamicIcon);

// 注册 FontAwesome 兼容图标组件
import FaIcon from "./components/FaIcon/index.vue";
app.component("FaIcon", FaIcon);

// 将所有图标添加到全局属性，避免与组件方法冲突
import { markRaw } from "vue";
const icons = {};
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    icons[key] = markRaw(component);
}
app.config.globalProperties.$icons = icons;

// 全局混入：让所有组件都能在模板中使用图标
app.mixin({
    computed: {
        // 使用计算属性将图标暴露到模板中
        ...Object.fromEntries(
            Object.entries(icons).map(([key, value]) => [
                key,
                function () {
                    return value;
                }
            ])
        )
    }
});

// 导入图标兼容工具
import { getIconComponent, convertIconName } from "./utils/icon-compat.js";
// 全局方法：将旧版 el-icon-xxx 转换为图标组件
app.config.globalProperties.$getIcon = getIconComponent;
app.config.globalProperties.$convertIconName = convertIconName;

// 使用 router 和 i18n
app.use(router);
app.use(i18n);

// Vue 3 生产环境配置
app.config.performance = import.meta.env.DEV;
app.config.warnHandler = import.meta.env.DEV ? undefined : () => {};

// 挂载应用
app.mount("#app_microi");

// 将一些方法和属性暴露到全局（用于兼容旧代码）
window.__VUE_APP__ = app;

// ============= 应用生命周期逻辑 =============

// 存储定时器引用，用于应用销毁时清理
const appTimers = [];

// 初始化逻辑
async function initApp() {
    const diyStore = useDiyStore();

    var systemStyle = localStorage.getItem("Microi.SystemStyle");
    if (!DiyCommon.IsNull(systemStyle)) {
        diyStore.setState("SystemStyle", systemStyle);
        document.body.classList.add(systemStyle);
    }

    var showClassicTop = decodeURIComponent((new RegExp("[?|&|%3F]" + "ShowClassicTop=" + "([^&;]+?)(&|#|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
    if (!DiyCommon.IsNull(showClassicTop) && (showClassicTop == "false" || showClassicTop == 0)) {
        diyStore.setState("ShowClassicTop", 0);
    }

    var showClassicLeft = decodeURIComponent((new RegExp("[?|&|%3F]" + "ShowClassicLeft=" + "([^&;]+?)(&|#|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
    if (!DiyCommon.IsNull(showClassicLeft) && (showClassicLeft == "false" || showClassicLeft == 0)) {
        diyStore.setState("ShowClassicLeft", 0);
    }

    var osClient = DiyCommon.GetOsClient();
    await DiyOsClient.OsClientInit(true);
}

// mounted 逻辑
function onAppMounted() {
    nextTick(() => {
        LoadRate(80);
    });
    const diyStore = useDiyStore();

    // 初始化 LocalStorage 管理器（启动时清理）
    if (import.meta.env.DEV) {
        LocalStorageManager.init();
    }

    diyStore.setCurrentTime(new Date());
    // 保存定时器引用，用于应用销毁时清理
    var currentTimeTimer = setInterval(function () {
        diyStore.setCurrentTime(new Date().AddTime("s", 1));
    }, 1000);
    appTimers.push(currentTimeTimer);

    // 内存监控（开发环境）
    if (import.meta.env.DEV) {
        setupMemoryMonitor();
    }

    var timer = setInterval(() => {
        InitDiyWebcoket(timer);
    }, 5000);
    InitDiyWebcoket();
}

// WebSocket 初始化
function InitDiyWebcoket(timer) {
    const diyStore = useDiyStore();
    const GetCurrentUser = diyStore.GetCurrentUser;
    const ChatType = diyStore.ChatType || "";

    if (!DiyCommon.IsNull(GetCurrentUser?.Id) && ChatType == "吾码IM") {
        const currentWebsocket = app.config.globalProperties.$websocket;
        if (currentWebsocket == null || (currentWebsocket.connectionState != "Connected" && currentWebsocket.connectionState != "Connecting")) {
            const url =
                DiyCommon.GetApiBase() +
                `/diy-websocket?UserId=${GetCurrentUser.Id}&UserName=${GetCurrentUser.Name}&UserAvatar=${DiyCommon.GetServerPath(GetCurrentUser.Avatar)}&OsClient=${DiyCommon.GetOsClient()}`;
            try {
                const ws = new websocket.HubConnectionBuilder()
                    .withUrl(url)
                    .withAutomaticReconnect({
                        nextRetryDelayInMilliseconds: (retryContext) => {
                            return 5000;
                        }
                    })
                    .build();
                app.config.globalProperties.$websocket = ws;
                ws.serverTimeoutInMilliseconds = 1000 * 60 * 20;
                ws.keepAliveIntervalInMilliseconds = 1000 * 60 * 20;
                ws.start().then(function () {
                    console.log("连接消息服务器成功！");
                    if (timer) {
                        clearInterval(timer);
                    }
                });
                ws.onclose((error) => {
                    console.log("消息服务器已断开！", error);
                });
                ws.onreconnected((connectionId) => {
                    console.log("消息服务器已重新连接！", connectionId);
                });
                ws.onreconnecting((error) => {
                    // console.log("消息服务器正在重连...", error);
                });
            } catch (error) {
                console.log("消息服务器连接异常:", error);
            }
        }
    }
}

// 内存监控设置
function setupMemoryMonitor() {
    let initialMemory = null;
    let lastMemory = null;

    function memoryMonitorFunc() {
        try {
            if (performance && performance.memory) {
                const usedMemoryMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
                const totalMemoryMB = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
                const usagePercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2);

                if (initialMemory === null) {
                    initialMemory = parseFloat(usedMemoryMB);
                }

                const memoryGrowth = lastMemory ? (parseFloat(usedMemoryMB) - lastMemory).toFixed(2) : 0;
                const totalGrowth = (parseFloat(usedMemoryMB) - initialMemory).toFixed(2);
                lastMemory = parseFloat(usedMemoryMB);

                const thresholds = [
                    { limit: 600, color: "#FFA500", severity: "Microi：⚠️  轻度" },
                    { limit: 1000, color: "#FF4500", severity: "Microi：⚠️⚠️ 中度" },
                    { limit: 1200, color: "#DC143C", severity: "Microi：🔴 严重" }
                ];

                let currentThreshold = thresholds[0];
                if (performance.memory.usedJSHeapSize > thresholds[2].limit * 1024 * 1024) {
                    currentThreshold = thresholds[2];
                } else if (performance.memory.usedJSHeapSize > thresholds[1].limit * 1024 * 1024) {
                    currentThreshold = thresholds[1];
                }

                if (performance.memory.usedJSHeapSize > thresholds[0].limit * 1024 * 1024) {
                    console.warn(
                        `%c${currentThreshold.severity} 内存监控(含浏览器其它标签) | 已用: ${usedMemoryMB}MB / 总额: ${totalMemoryMB}MB (${usagePercent}%) | 增长: +${memoryGrowth}MB (总增长: +${totalGrowth}MB)`,
                        `color: white; background-color: ${currentThreshold.color}; padding: 5px 10px; border-radius: 3px; font-weight: bold;`
                    );
                } else {
                    console.info(
                        `%cMicroi：🟢 正常 内存监控(含浏览器其它标签) | 已用: ${usedMemoryMB}MB / 总额: ${totalMemoryMB}MB (${usagePercent}%) | 增长: +${memoryGrowth}MB `,
                        `color: white; background-color: #28a745; padding: 5px 10px; border-radius: 3px; font-weight: bold;`
                    );
                }
            }
        } catch (error) {
            console.debug("浏览器不支持 performance.memory API");
        }
    }

    var memoryMonitorTimer = setInterval(memoryMonitorFunc, 30000);
    memoryMonitorFunc();
    appTimers.push(memoryMonitorTimer);

    console.info("%c💡 Microi提示: Vue 3 + Vite + Pinia 模式已启用", `color: white; background-color: #007bff; padding: 5px 10px; border-radius: 3px; font-weight: bold;`);
}

// 应用销毁时清理
window.addEventListener("beforeunload", () => {
    appTimers.forEach(function (timer) {
        clearInterval(timer);
    });
    const ws = app.config.globalProperties.$websocket;
    if (ws) {
        try {
            ws.stop();
        } catch (error) {
            console.log("关闭 WebSocket 连接失败:", error);
        }
    }
});

// 执行初始化
initApp();
onAppMounted();

// 导出 app 实例供其他模块使用
export { app, pinia, router };
