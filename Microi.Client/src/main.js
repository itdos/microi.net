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
// Element Plus 深色模式变量（配合 html.dark 类自动生效）
import "element-plus/theme-chalk/dark/css-vars.css";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
// Element Plus 图标 - 直接加载所有图标，避免延迟加载导致部分图标不显示
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import "./styles/element-variables.scss";
// Bootstrap 兼容样式（替代已移除的 Bootstrap）
import "@/styles/bootstrap-compat.scss";
// Element Plus 图标兼容样式
import "@/styles/element-icons-compat.scss";
import App from "./App.vue";
// 使用 Pinia 替代 Vuex
import pinia, { useDiyStore } from "./pinia";
import router from "./router";
import i18n, { translateEngineLiteral } from "./lang"; // internationalization
// Vite SVG 图标注册
import "virtual:svg-icons-register";
import "./permission"; // permission control
import { setupErrorHandler } from "./utils/error-log"; // error log
import "animate.css";
import "./styles/itdos.diy.scss";
// MCI (Microi Cool Interface) 设计系统 — 移动端及全局变量
import "./styles/mci-design.scss";
import axios from "axios";
import { DiyOsClient } from "./utils/itdos.osclient";
import { reportApiServiceFailure } from "./utils/api-service-status.js";
import { syncClassicShellVisibilityFromUrl } from "./utils/classic-shell-visibility.js";
import { isEmbeddedWebosWindowRuntime } from "./utils/webos-embedded-runtime.js";
import { installLegacyQrCodeDownload } from "./utils/legacy-qrcode.js";
import { installMciDialogRuntime } from "./utils/mci-dialog-runtime.js";
// 主题色工具 - 360 极速浏览器兼容方案
import { initThemeColor, setThemeColor } from "./utils/theme-color";
import { resolveUserThemeColor } from "./utils/user-visual-preferences.js";
import $ from "jquery";
window.$ = window.jQuery = window.jquery = $;
import * as websocket from "@microsoft/signalr";
import {
    REALTIME_CONNECTED_EVENT,
    buildRealtimeHubUrl,
    dispatchRealtimeState,
    getRealtimeRetryDelay
} from "./utils/realtime-connection.js";
import microApp from "@micro-zoe/micro-app";
const isWebosEmbeddedRuntime = isEmbeddedWebosWindowRuntime();
window.__MICROI_WEBOS_EMBEDDED_RUNTIME__ = isWebosEmbeddedRuntime;

// 初始化主题色系统（必须在样式加载后执行）
initThemeColor();
// 统一 Element Plus Dialog：大圆角、主题标题及拖动兜底。运行时观察器会
// 在 Vue 内部拖动重渲染后恢复契约，避免 class 被组件补丁覆盖。
installMciDialogRuntime();

// 前端微服务运行时。MicroApp 用于承载按租户从数据库/独立地址发布的 Vue3 定制页面。
microApp.start();
window.microApp = microApp;

// 创建 Vue 3 应用实例
const app = createApp(App);
// 注册全局属性（替代 Vue.prototype）
app.config.globalProperties.Base64 = Base64;
app.config.globalProperties.$localStorageManager = LocalStorageManager;
app.config.globalProperties.$axios = axios;
app.config.globalProperties.DiyOsClient = DiyOsClient;
app.config.globalProperties.$websocket = null;
app.config.globalProperties.OsVersion = `v${packageInfo.version}`;
app.config.globalProperties.$pet = value => translateEngineLiteral("PageEngine", value);
app.config.globalProperties.$prt = value => translateEngineLiteral("PrintEngine", value);
// 注册 microi 组件到 Vue 3（组件已经是异步的）
RegMicroiComponents(app);
// 注册 drag 指令 (Vue 3 方式)
import drag from "@/utils/dos.common";
app.directive("drag", drag);
// 注册安全 HTML 指令 v-safe-html，替代直接 v-html，防止 XSS
import { SafeHtmlDirective } from "@/utils/safe-html";
app.directive("safe-html", SafeHtmlDirective);
// 统一内容骨架屏：替代半透明遮罩式 v-loading，并保持主题与布局语义。
import { MciLoadingDirective } from "@/utils/mci-loading";
app.directive("mci-loading", MciLoadingDirective);
// 注册 chat 组件 (Vue 3 方式)
import chatComponents from "@/views/chat/components.js";
app.use(chatComponents);
// 【重要】在 Pinia 初始化之前先迁移旧的 localStorage 数据
// 这样 Pinia persist 插件才能正确读取已迁移的数据
if (!isWebosEmbeddedRuntime) LocalStorageManager.init();
// 使用 Pinia
app.use(pinia);
if (isWebosEmbeddedRuntime) {
    // Router 首次导航前从父页共享存储做一次只读白名单引导；之后只接受父页
    // postMessage 更新内存态，嵌入 Pinia 不安装持久化插件。
    const snapshot = LocalStorageManager.getAll() || {};
    const embeddedDiyStore = useDiyStore(pinia);
    embeddedDiyStore.$patch({
        ApiBase: snapshot.ApiBase || snapshot.SysConfig?.ApiBase || '',
        OsClient: snapshot.OsClient || DiyCommon.GetOsClient() || '',
        FileServer: snapshot.FileServer || snapshot.SysConfig?.FileServer || '',
        MediaServer: snapshot.MediaServer || snapshot.SysConfig?.MediaServer || '',
        Token: snapshot.Token || '',
        TokenExpires: snapshot.TokenExpires || '',
        CurrentUser: snapshot.CurrentUser || {},
        SysConfig: snapshot.SysConfig || {},
        SystemStyle: snapshot.SystemStyle || '',
        themeColor: snapshot.themeColor || '',
    });
}
// 使用 Element Plus
app.use(ElementPlus, {
    locale: zhCn,
    size: Cookies.get("size") || "small"//default
});
// 兼容历史表单/菜单 V8：旧版通过 window.downloadQRCode 批量生成二维码。
// 若宿主已注册同名业务实现则保留原实现，避免覆盖租户定制逻辑。
installLegacyQrCodeDownload(window, {
    notify(message, type) {
        if (type === "error") {
            DiyCommon.Tips(message, false);
        } else {
            DiyCommon.Tips(message, true);
        }
    }
});
// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component);
}
// 注册动态图标组件
import DynamicIcon from "./components/DynamicIcon/index.vue";
app.component("DynamicIcon", DynamicIcon);
// 注册 FontAwesome 兼容图标组件
import FaIcon from "./components/FaIcon/index.vue";
app.component("FaIcon", FaIcon);
// 将所有图标添加到全局属性
import { markRaw } from "vue";
const icons = {};
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    const rawIcon = markRaw(component);
    icons[key] = rawIcon;
    if (!app.config.globalProperties[key]) {
        app.config.globalProperties[key] = rawIcon;
    }
}
app.config.globalProperties.$icons = icons;
// 修复性能：原全局 mixin 会为每个组件实例挂上几百个 computed，启动与 HMR 明显变慢。
// 现有 app.component(key, component) 注册 + globalProperties.$icons 已足够覆盖用法，删除 mixin。
// 原代码：app.mixin({ computed: { ...Object.fromEntries(Object.entries(ElementPlusIconsVue).map(...)) } })
// 导入图标兼容工具
import { getIconComponent, convertIconName } from "./utils/icon-compat.js";
// 全局方法：将旧版 el-icon-xxx 转换为图标组件
app.config.globalProperties.$getIcon = getIconComponent;
app.config.globalProperties.$convertIconName = convertIconName;
// ======== WebOS 依赖注册 ========
// FontAwesome 图标库（WebOS 桌面使用）
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
library.add(fas, far, fab);
app.component('font-awesome-icon', FontAwesomeIcon);
// ve-plus（WebOS 桌面弹层/上下文菜单）
// WebOS 内部按需导入 Layer/layer。不要在宿主应用全量 app.use(VePlus)：
// 其 Avatar、Grid、Link、Loading、Menu、Select、Switch 等短组件名会与
// Element Plus 图标/组件重复注册，并在每次冷启动/HMR 时产生 Vue 警告。
import 've-plus/dist/ve-plus.css';
// 管理后台主题桥接层必须晚于第三方组件样式加载，保证浅色/暗色令牌生效。
import './styles/mci-admin-theme.scss';
import './styles/mci-loading.scss';
// WebOS 样式（使用 glob 动态加载，webos 目录不存在时静默跳过）
import.meta.glob('@/views/webos/styles/*.scss', { eager: true });
// ======== WebOS 依赖注册结束 ========

// 使用 router 和 i18n
app.use(router);
app.use(i18n);
// Vue 3 生产环境配置
// Vue 的逐组件 Performance API 标记在大型表格重新激活时会产生数百次
// mark/measure/clear 调用，开发环境一次菜单切换就可能额外阻塞主线程
// 150ms 以上。性能追踪改为显式开启，日常 Vite 热更新不再默认承担该开销。
const enableVuePerformanceTracing = import.meta.env.DEV
    && (new URLSearchParams(window.location.search).get("VuePerf") === "1"
        || localStorage.getItem("Microi.Debug.VuePerformance") === "1");
app.config.performance = enableVuePerformanceTracing;
app.config.warnHandler = import.meta.env.DEV ? undefined : () => {};
// 必须在 mount 前安装。除常规错误上报外，它会精确兜住 Element Plus Tabs
// 卸载竞态，避免路由地址已改变而 RouterView 仍停留在旧页面。
setupErrorHandler(app);
// 挂载应用
app.mount("#app_microi");
// 通知独立 Loading 脚本：Vue 入口已被浏览器执行并成功挂载。
// 注意：挂载不等于业务就绪。租户配置与后端初始化完成后才发送 microi:app-ready，
// 避免 Loading 到 100% 后提前消失并露出尚未初始化的空白页面。
window.__MICROI_APP_MOUNTED__ = true;
window.__MICROI_APP_BUILD_TARGET__ = import.meta.env.LEGACY ? "legacy" : "modern";
function dispatchMicroiBootEvent(eventName, detail) {
    try {
        window.dispatchEvent(new CustomEvent(eventName, { detail: detail || {} }));
    } catch (error) {
        var bootEvent = document.createEvent("CustomEvent");
        bootEvent.initCustomEvent(eventName, false, false, detail || {});
        window.dispatchEvent(bootEvent);
    }
}
dispatchMicroiBootEvent("microi:app-mounted", { buildTarget: window.__MICROI_APP_BUILD_TARGET__ });
// 将一些方法和属性暴露到全局（用于兼容旧代码）
window.__VUE_APP__ = app;
// ============= 应用生命周期逻辑 =============
// 存储定时器引用，用于应用销毁时清理
const appTimers = [];

// 初始化逻辑
async function initApp() {
    // 初始化 LocalStorage 管理器（迁移旧数据）
    if (!isWebosEmbeddedRuntime) LocalStorageManager.init();
    
    const diyStore = useDiyStore();
    var systemStyle = LocalStorageManager.get("SystemStyle") || diyStore.SystemStyle;
    if (!DiyCommon.IsNull(systemStyle)) {
        diyStore.setState("SystemStyle", systemStyle);
        document.body.classList.add(systemStyle);
    }
    // URL 参数是当前地址的一次性框架显示策略，不得残留为后续路由或刷新状态。
    syncClassicShellVisibilityFromUrl(diyStore, location.href);
    var osClient = DiyCommon.GetOsClient();
    if (isWebosEmbeddedRuntime) {
        // 子窗口使用父桌面同一租户的只读启动快照，禁止重复租户初始化和持久化写入。
        diyStore.setOsClient(osClient);
    } else {
        await DiyOsClient.OsClientInit(true);
    }

    // 初始化主题色（兼容生产环境 CSS 顺序差异）
    const themeColor = resolveUserThemeColor(
        diyStore.GetCurrentUser || {},
        diyStore.themeColor,
        diyStore.SysConfig?.ThemeColor,
        "#409eff"
    );
    setThemeColor(themeColor);

    // 监听主题变化并实时应用
    watch(
        () => [diyStore.GetCurrentUser?.ThemeColor, diyStore.themeColor, diyStore.SysConfig?.ThemeColor],
        () => {
            setThemeColor(resolveUserThemeColor(
                diyStore.GetCurrentUser || {},
                diyStore.themeColor,
                diyStore.SysConfig?.ThemeColor,
                "#409eff"
            ));
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
    if (import.meta.env.DEV && !isWebosEmbeddedRuntime) {
        LocalStorageManager.init();
    }
    if (!isWebosEmbeddedRuntime) {
        diyStore.setCurrentTime(new Date());
        // 保存定时器引用，用于应用销毁时清理
        var currentTimeTimer = setInterval(function () {
            diyStore.setCurrentTime(new Date().AddTime("s", 1));
        }, 1000);
        appTimers.push(currentTimeTimer);
    }
    // 内存监控（开发环境）
    if (import.meta.env.DEV && !isWebosEmbeddedRuntime) {
        setupMemoryMonitor();
    }
    
    // 清理聊天事件注册标志（页面刷新时重置）
    if (!isWebosEmbeddedRuntime && window._chatEventsRegistered) {
        console.log('[启动] 清理遗留的聊天事件标志');
        window._chatEventsRegistered = false;
    }
    
    // 尝试连接WebSocket（如果已登录）
    if (!isWebosEmbeddedRuntime) tryConnectWebSocket();
}

// SignalR 连接管理：首次连接和断线重连都使用有限退避。达到上限后保持
// Exhausted，只有用户再次点击聊天图标或登录身份变化才会重置，避免无限风暴。
let websocketInitialRetryCount = 0;
let websocketInitialRetryTimer = null;
let websocketStartPromise = null;
let websocketStoppedByClient = false;
let lastForcedRetryAt = 0;

function currentRealtimeIdentity() {
    const diyStore = useDiyStore();
    const user = diyStore.GetCurrentUser || {};
    const apiBase = String(DiyCommon.GetApiBase() || "").replace(/\/+$/, "");
    const osClient = String(DiyCommon.GetOsClient() || diyStore.OsClient || "").trim();
    const userId = String(user.Id || "").trim();
    return {
        apiBase,
        osClient,
        userId,
        key: `${apiBase}|${osClient.toLowerCase()}|${userId}`
    };
}

function emitRealtimeState(state, detail = {}) {
    const identity = currentRealtimeIdentity();
    return dispatchRealtimeState({ state, osClient: identity.osClient, ...detail });
}

function clearInitialRealtimeRetry() {
    if (websocketInitialRetryTimer) {
        window.clearTimeout(websocketInitialRetryTimer);
        websocketInitialRetryTimer = null;
    }
}

function emitRealtimeConnected(state, connectionId) {
    const detail = emitRealtimeState("Connected", {
        connectionId,
        reason: state === "Reconnected" ? "连接已恢复" : "连接成功"
    });
    window.dispatchEvent(new CustomEvent(REALTIME_CONNECTED_EVENT, {
        detail: { ...detail, state }
    }));
}

function scheduleInitialRealtimeRetry(identity, error) {
    clearInitialRealtimeRetry();
    const retryDelay = getRealtimeRetryDelay({ previousRetryCount: websocketInitialRetryCount });
    if (retryDelay === null) {
        emitRealtimeState("Exhausted", {
            retryCount: websocketInitialRetryCount,
            reason: error?.message || String(error || "首次连接重试已达上限")
        });
        return;
    }
    websocketInitialRetryCount++;
    emitRealtimeState("Reconnecting", {
        retryCount: websocketInitialRetryCount,
        retryDelay,
        reason: error?.message || String(error || "首次连接失败")
    });
    websocketInitialRetryTimer = window.setTimeout(() => {
        websocketInitialRetryTimer = null;
        startRealtimeConnection(identity);
    }, retryDelay);
}

function createRealtimeConnection(identity) {
    const url = buildRealtimeHubUrl(identity.apiBase, identity.osClient, DiyCommon.GetDid());
    let ws = null;
    ws = new websocket.HubConnectionBuilder()
        .withUrl(url, {
            // Token 可能在长页面会话中续签；每次握手都读取最新值，不能捕获旧 Token。
            accessTokenFactory: () => DiyCommon.getToken() || ""
        })
        .withAutomaticReconnect({
            nextRetryDelayInMilliseconds(retryContext) {
                const retryDelay = getRealtimeRetryDelay(retryContext);
                ws.__microiAutomaticRetryCount = Number(retryContext.previousRetryCount || 0) + 1;
                ws.__microiAutomaticRetryDelay = retryDelay;
                return retryDelay;
            }
        })
        .build();
    ws.__microiIdentityKey = identity.key;
    ws.__microiEverConnected = false;
    ws.__microiAutomaticRetryCount = 0;
    ws.__microiAutomaticRetryDelay = null;
    // 15 秒心跳、45 秒失联判断能及时显示真实状态，又不会制造高频流量。
    ws.keepAliveIntervalInMilliseconds = 15000;
    ws.serverTimeoutInMilliseconds = 45000;

    ws.onreconnecting((error) => {
        emitRealtimeState("Reconnecting", {
            retryCount: ws.__microiAutomaticRetryCount || 1,
            retryDelay: ws.__microiAutomaticRetryDelay,
            reason: error?.message || String(error || "连接中断")
        });
    });
    ws.onreconnected((connectionId) => {
        websocketInitialRetryCount = 0;
        ws.__microiEverConnected = true;
        ws.__microiAutomaticRetryCount = 0;
        ws.__microiAutomaticRetryDelay = null;
        emitRealtimeConnected("Reconnected", connectionId);
    });
    ws.onclose((error) => {
        if (websocketStoppedByClient || app.config.globalProperties.$websocket !== ws) return;
        emitRealtimeState(ws.__microiEverConnected ? "Exhausted" : "Disconnected", {
            retryCount: ws.__microiAutomaticRetryCount,
            reason: error?.message || String(error || "连接已断开")
        });
    });
    return ws;
}

async function startRealtimeConnection(identity) {
    if (websocketStartPromise) return websocketStartPromise;
    websocketStartPromise = (async () => {
        let ws = app.config.globalProperties.$websocket;
        if (ws && ws.__microiIdentityKey !== identity.key) {
            websocketStoppedByClient = true;
            clearInitialRealtimeRetry();
            try { await ws.stop(); } catch (_) {}
            websocketStoppedByClient = false;
            if (app.config.globalProperties.$websocket === ws) {
                app.config.globalProperties.$websocket = null;
            }
            ws = null;
        }
        if (!ws) {
            ws = createRealtimeConnection(identity);
            app.config.globalProperties.$websocket = ws;
        }
        if (ws.state === "Connected") {
            emitRealtimeConnected("Connected", ws.connectionId);
            return;
        }
        if (ws.state === "Connecting" || ws.state === "Reconnecting") return;

        emitRealtimeState("Connecting", { retryCount: websocketInitialRetryCount });
        try {
            await ws.start();
            websocketInitialRetryCount = 0;
            clearInitialRealtimeRetry();
            ws.__microiEverConnected = true;
            emitRealtimeConnected("Connected", ws.connectionId);
        } catch (error) {
            console.error("[Realtime] 连接消息服务器失败:", error);
            scheduleInitialRealtimeRetry(identity, error);
        }
    })().finally(() => {
        websocketStartPromise = null;
    });
    return websocketStartPromise;
}

// 登录后、点击聊天图标时共用。同步返回启动结果，实际状态通过
// microi-realtime-state-changed 通知各组件。
window.tryConnectWebSocket = function(forceRetry = false) {
    if (isWebosEmbeddedRuntime) {
        emitRealtimeState("Unavailable", { reason: "WebOS 嵌入窗口复用父页面实时通道" });
        return { success: false, reason: "WebOS嵌入窗口复用父页面实时通道" };
    }
    const diyStore = useDiyStore();
    const identity = currentRealtimeIdentity();
    if (diyStore.IsPhoneView !== true && diyStore.IsPhoneView !== false) {
        return { success: false, reason: "设备类型未确定" };
    }
    if (!DiyCommon.getToken() || !identity.userId || !identity.osClient || !identity.apiBase) {
        emitRealtimeState("Disconnected", { reason: "未登录或租户上下文未就绪" });
        return { success: false, reason: "未登录" };
    }

    const current = app.config.globalProperties.$websocket;
    if (current?.state === "Connected" && current.__microiIdentityKey === identity.key) {
        return { success: true, reason: "已连接" };
    }
    if (forceRetry) {
        const now = Date.now();
        if (now - lastForcedRetryAt < 2000) {
            return { success: false, reason: "手动重试过于频繁，请稍后再试" };
        }
        lastForcedRetryAt = now;
        websocketInitialRetryCount = 0;
        clearInitialRealtimeRetry();
    } else if (websocketInitialRetryTimer || current?.state === "Connecting" || current?.state === "Reconnecting") {
        return { success: true, reason: "连接或有限重试进行中" };
    }

    startRealtimeConnection(identity);
    return { success: true, reason: forceRetry ? "已开始手动重试" : "连接中" };
};

window.getRealtimeConnectionState = function() {
    return window.__MICROI_REALTIME_STATE__ || { state: "Disconnected", retryCount: 0 };
};

emitRealtimeState(isWebosEmbeddedRuntime ? "Unavailable" : "Disconnected", {
    reason: isWebosEmbeddedRuntime ? "复用父页面实时通道" : "尚未连接"
});

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
            websocketStoppedByClient = true;
            clearInitialRealtimeRetry();
            ws.stop();
        } catch (error) {
            console.log("关闭 WebSocket 连接失败:", error);
        }
    }
});
// 执行初始化。只有租户配置、主题和后端基础数据初始化完成，启动页才允许退出。
initApp().then(async function () {
    // 租户配置完成后仍需等待首个路由组件解析并至少完成两帧绘制。
    // 否则启动层虽然等到了后端，仍可能在异步路由尚未呈现时露出短暂白屏。
    await router.isReady();
    await nextTick();
    await new Promise(function (resolve) {
        requestAnimationFrame(function () {
            requestAnimationFrame(resolve);
        });
    });
    window.__MICROI_APP_READY__ = true;
    window.__MICROI_APP_BOOT_ERROR__ = "";
    dispatchMicroiBootEvent("microi:app-ready", {
        buildTarget: window.__MICROI_APP_BUILD_TARGET__
    });
}).catch(function (error) {
    var failedApiBase = "";
    var failedOsClient = "";
    try { failedApiBase = DiyCommon.GetApiBase(); } catch (readApiBaseError) {}
    try { failedOsClient = DiyCommon.GetOsClient(); } catch (readOsClientError) {}
    reportApiServiceFailure(error, {
        apiBase: failedApiBase,
        osClient: failedOsClient,
        url: error?.config?.url || (failedApiBase ? failedApiBase + "/api/FormEngine/GetSysConfig" : "")
    });
    window.__MICROI_APP_BOOT_ERROR__ = error?.message || String(error || "应用初始化失败");
    dispatchMicroiBootEvent("microi:app-boot-failed", {
        message: window.__MICROI_APP_BOOT_ERROR__,
        apiBase: failedApiBase,
        osClient: failedOsClient
    });
    console.error("[Microi] 应用初始化失败：", error);
});
onAppMounted();
// 导出 app 实例供其他模块使用
export { app, pinia, router };
