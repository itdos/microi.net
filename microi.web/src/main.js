// Vue 3 + Vite + Pinia 入口文件
import { createApp, nextTick, defineAsyncComponent, watch } from "vue";
import packageInfo from "../package.json";
// 延迟导入组件注册函数，只在需要时同步执行
import { RegMicroiComponents } from "./utils/microi.net.import.js";
import { DiyCommon } from "./utils/diy.common.js";
import LocalStorageManager from "./utils/localStorage-manager.js";
import { Base64 } from "js-base64";
import Cookies from "js-cookie";
import "normalize.css/normalize.css"; // a modern alternative to CSS resets
// Element Plus
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
// Element Plus 图标 - 按需导入常用图标，其他图标异步加载
import {
    ArrowDown, ArrowRight, ArrowLeft, ArrowUp,
    Search, Plus, Edit, Delete, Close, Check,
    Refresh, Setting, User, Lock, View, Hide,
    Download, Upload, Document, Folder, Menu,
    MoreFilled, Warning, InfoFilled, SuccessFilled, CircleCloseFilled,
    Loading, Calendar, Clock, Star, StarFilled, Tickets, QuestionFilled,
    CircleCheck, List, RefreshLeft, UploadFilled, CirclePlusFilled, 
    Minus, DocumentCopy, Rank, Tools, CircleClose, CaretBottom, Back, Grid, LocationFilled, Location,
    ChatDotRound, Position, DArrowRight
} from "@element-plus/icons-vue";
// 其他图标懒加载
const ElementPlusIconsVueLazy = () => import("@element-plus/icons-vue");
import "./styles/element-variables.scss";
// Bootstrap 兼容样式（替代已移除的 Bootstrap）
import "@/styles/bootstrap-compat.scss";
// Element Plus 图标兼容样式
import "@/styles/element-icons-compat.scss";
import App from "./App.vue";
// 使用 Pinia 替代 Vuex
import pinia, { useDiyStore } from "./pinia";
import router from "./router";
import i18n from "./lang"; // internationalization
// Vite SVG 图标注册
import "virtual:svg-icons-register";
import "./permission"; // permission control
import "./utils/error-log"; // error log
import "animate.css";
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
// 注册 microi 组件到 Vue 3（组件已经是异步的）
RegMicroiComponents(app);
// 注册 drag 指令 (Vue 3 方式)
import drag from "@/utils/dos.common";
app.directive("drag", drag);
// 注册 chat 组件 (Vue 3 方式)
import chatComponents from "@/views/chat/components.js";
app.use(chatComponents);
// 【重要】在 Pinia 初始化之前先迁移旧的 localStorage 数据
// 这样 Pinia persist 插件才能正确读取已迁移的数据
LocalStorageManager.init();
// 使用 Pinia
app.use(pinia);
// 使用 Element Plus
app.use(ElementPlus, {
    locale: zhCn,
    size: Cookies.get("size") || "default"
});
// 首先注册常用图标（同步导入的）
const commonIcons = {
    ArrowDown, ArrowRight, ArrowLeft, ArrowUp,
    Search, Plus, Edit, Delete, Close, Check,
    Refresh, Setting, User, Lock, View, Hide,
    Download, Upload, Document, Folder, Menu,
    MoreFilled, Warning, InfoFilled, SuccessFilled, CircleCloseFilled,
    Loading, Calendar, Clock, Star, StarFilled, Tickets, QuestionFilled,
    CircleCheck, List, RefreshLeft, UploadFilled, CirclePlusFilled,
    Minus, DocumentCopy, Rank, Tools, CircleClose, CaretBottom, Back, Grid, LocationFilled, Location,
    ChatDotRound, Position, DArrowRight, Plus
};
for (const [key, component] of Object.entries(commonIcons)) {
    app.component(key, component);
}
// 延迟加载其他图标（在空闲时加载）
const loadAllIcons = async () => {
    const allIcons = await ElementPlusIconsVueLazy();
    for (const [key, component] of Object.entries(allIcons)) {
        if (!commonIcons[key]) {
            app.component(key, component);
        }
    }
    // 更新全局图标对象
    for (const [key, component] of Object.entries(allIcons)) {
        icons[key] = markRaw(component);
    }
};
// 使用 requestIdleCallback 在浏览器空闲时加载其他图标
if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(loadAllIcons, { timeout: 3000 });
} else {
    setTimeout(loadAllIcons, 1000);
}
// 注册动态图标组件
import DynamicIcon from "./components/DynamicIcon/index.vue";
app.component("DynamicIcon", DynamicIcon);
// 注册 FontAwesome 兼容图标组件
import FaIcon from "./components/FaIcon/index.vue";
app.component("FaIcon", FaIcon);
// 将常用图标先添加到全局属性
import { markRaw } from "vue";
const icons = {};
for (const [key, component] of Object.entries(commonIcons)) {
    icons[key] = markRaw(component);
}
app.config.globalProperties.$icons = icons;
// 全局混入：让所有组件都能在模板中使用图标
app.mixin({
    computed: {
        // 使用计算属性将图标暴露到模板中
        ...Object.fromEntries(
            Object.entries(commonIcons).map(([key, value]) => [
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

function applyThemeVariables(color) {
    if (!color) return;
    // 主题色变量
    document.documentElement.style.setProperty("--color-primary", color);
    document.documentElement.style.setProperty("--theme-color", color);
    document.documentElement.style.setProperty("--el-color-primary", color);

    // 计算主题色亮度，自动设置文字颜色
    let r, g, b;
    if (color.startsWith("#")) {
        const hex = color.replace("#", "");
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
    } else if (color.startsWith("rgb")) {
        const rgb = color.match(/\d+/g) || [0, 0, 0];
        r = parseInt(rgb[0]);
        g = parseInt(rgb[1]);
        b = parseInt(rgb[2]);
    } else {
        r = g = b = 0;
    }
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 180 ? "#303133" : "#ffffff";
    document.documentElement.style.setProperty("--color-primary-text", textColor);

    // 侧边栏主题变量
    document.documentElement.style.setProperty("--sidebar-bg-color", color);
    if (brightness > 180) {
        document.documentElement.style.setProperty("--sidebar-text-color", "rgba(48, 49, 51, 0.9)");
        document.documentElement.style.setProperty("--sidebar-hover-bg", "rgba(0, 0, 0, 0.08)");
        document.documentElement.style.setProperty("--sidebar-active-bg", "rgba(0, 0, 0, 0.12)");
    } else {
        document.documentElement.style.setProperty("--sidebar-text-color", "rgba(255, 255, 255, 0.9)");
        document.documentElement.style.setProperty("--sidebar-hover-bg", "rgba(255, 255, 255, 0.15)");
        document.documentElement.style.setProperty("--sidebar-active-bg", "rgba(255, 255, 255, 0.25)");
    }
}
// 初始化逻辑
async function initApp() {
    // 初始化 LocalStorage 管理器（迁移旧数据）
    LocalStorageManager.init();
    
    const diyStore = useDiyStore();
    var systemStyle = LocalStorageManager.get("SystemStyle") || diyStore.SystemStyle;
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

    // 初始化主题色（兼容生产环境 CSS 顺序差异）
    const themeColor = diyStore.themeColor || diyStore.SysConfig?.ThemeColor || "#409eff";
    applyThemeVariables(themeColor);

    // 监听主题变化并实时应用
    watch(
        () => diyStore.themeColor,
        (val) => {
            if (val) applyThemeVariables(val);
        },
        { immediate: false }
    );
}
// mounted 逻辑
function onAppMounted() {
    LoadRate(40);
    nextTick(() => {
        LoadRate(40);
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
    
    // 尝试连接WebSocket（如果已登录）
    tryConnectWebSocket();
}

// WebSocket连接管理
let websocketRetryCount = 0;  // 重连次数
const MAX_RETRY_COUNT = 3;    // 最多重连3次
let lastConnectAttempt = 0;   // 上次尝试连接时间

// 导出全局方法供外部调用（登录后、点击聊天图标时）
window.tryConnectWebSocket = function(forceRetry = false) {
    const diyStore = useDiyStore();
    const GetCurrentUser = diyStore.GetCurrentUser;
    const ChatType = diyStore.ChatType || "吾码IM";
    const token = DiyCommon.getToken();
    const currentWebsocket = app.config.globalProperties.$websocket;
    
    // 检查是否需要连接
    const needConnect = !token ? false : 
        !DiyCommon.IsNull(GetCurrentUser?.Id) && ChatType == "吾码IM";
    
    if (!needConnect) {
        console.log('[WebSocket] 不满足连接条件，跳过');
        return { success: false, reason: '未登录或不支持聊天' };
    }
    
    // 检查已连接
    if (currentWebsocket?.state === "Connected") {
        console.log('[WebSocket] 已连接，无需重连');
        return { success: true, reason: '已连接' };
    }
    
    // 强制重试时重置计数器
    if (forceRetry) {
        console.log('[WebSocket] 强制重试，重置计数器');
        websocketRetryCount = 0;
    }
    
    // 检查重连次数
    if (websocketRetryCount >= MAX_RETRY_COUNT) {
        console.warn(`[WebSocket] 已达到最大重连次数(${MAX_RETRY_COUNT})，停止尝试`);
        return { success: false, reason: `已达到最大重连次数(${MAX_RETRY_COUNT})` };
    }
    
    // 防止短时间内多次连接
    const now = Date.now();
    if (now - lastConnectAttempt < 2000) {
        console.log('[WebSocket] 连接请求过于频繁，跳过');
        return { success: false, reason: '连接请求过于频繁' };
    }
    lastConnectAttempt = now;
    
    // 执行连接
    websocketRetryCount++;
    console.log(`[WebSocket] 第${websocketRetryCount}次尝试连接...`);
    
    return InitDiyWebcoket();
};

// 导出重置重连计数器的方法（用户刷新页面时自动重置）
window.resetWebSocketRetry = function() {
    websocketRetryCount = 0;
    console.log('[WebSocket] 重连计数器已重置');
};

// WebSocket 初始化
function InitDiyWebcoket() {
    const diyStore = useDiyStore();
    const GetCurrentUser = diyStore.GetCurrentUser;
    const ChatType = diyStore.ChatType || "吾码IM";
    const token = DiyCommon.getToken();

    console.log('[WebSocket] 检查初始化条件:', {
        UserId: GetCurrentUser?.Id,
        UserName: GetCurrentUser?.Name,
        ChatType: ChatType,
        HasToken: !!token
    });

    // 未登录时不连接WebSocket
    if (!token) {
        console.log('[WebSocket] 未登录，跳过连接');
        return { success: false, reason: '未登录' };
    }

    if (!DiyCommon.IsNull(GetCurrentUser?.Id) && ChatType == "吾码IM") {
        const currentWebsocket = app.config.globalProperties.$websocket;
        console.log('[WebSocket] 当前连接状态:', currentWebsocket?.state || 'null');
        
        if (currentWebsocket == null || (currentWebsocket.state != "Connected" && currentWebsocket.state != "Connecting")) {
            const url = DiyCommon.GetApiBase() + `/diy-websocket`;
            const token = DiyCommon.getToken();
            
            console.log('[WebSocket] 开始连接:', url);
            try {
                const ws = new websocket.HubConnectionBuilder()
                    .withUrl(url, {
                        accessTokenFactory: () => {
                            return token;
                        }
                    })
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
                    console.log("[成功] 连接消息服务器成功！");
                    // 连接成功后重置重连计数器
                    if (window.resetWebSocketRetry) {
                        window.resetWebSocketRetry();
                    }
                }).catch(function(error) {
                    console.error("[错误] 连接消息服务器失败:", error);
                });
                ws.onclose((error) => {
                    console.log("消息服务器已断开！", error);
                });
                ws.onreconnected((connectionId) => {
                    console.log("消息服务器已重新连接！", connectionId);
                });
                ws.onreconnecting((error) => {
                    console.log("消息服务器正在重连...", error);
                });
                return { success: true, reason: '连接中' };
            } catch (error) {
                console.error("[错误] 消息服务器连接异常:", error);
                return { success: false, reason: error.toString() };
            }
        } else {
            console.log('[WebSocket] 已连接或正在连接中，跳过');
            return { success: true, reason: '已连接或连接中' };
        }
    } else {
        console.warn('[WebSocket] 未满足初始化条件，跳过');
        return { success: false, reason: '未满足初始化条件' };
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