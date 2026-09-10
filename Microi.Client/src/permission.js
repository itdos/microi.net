import router from "./router";
// 使用 Pinia stores
import { useUserStore, usePermissionStore, useDiyStore } from "./pinia";
import pinia from "./pinia";
import { getFirstValidRoutePath, hasAccessibleRoutePath, normalizeMenuRoutePath } from "./pinia/modules/permission";
// Element Plus 消息组件
import { ElMessage } from "element-plus";
import { getToken } from "@/utils/auth.js"; // get token from cookie
import getPageTitle from "@/utils/get-page-title";
import { DiyCommon, DiyApi } from "@/utils/microi.net.import";
import Cookies from "js-cookie";
import { normalizeAccessRoute } from "@/views/system/components/user-access-key-utils";
import { cancelRouteLoading, finishRouteLoading, startRouteLoading } from "@/utils/mci-loading";
import { createDynamicRouteRematch, shouldStartInitialRouteLoading, readRouteBootstrap, createRouteBootstrapError } from "@/router/navigation-state";
import { getLegacySsoCapabilities, readLegacySsoCredential, withoutLegacySsoCredential, legacySsoTarget, isLegacySsoDeepLink } from "@/utils/sso-federation.js";
import { waitForPlatformBootstrap } from "@/utils/runtime-endpoint-query.js";
const whiteList = ["/login", "/auth-redirect", "/access-login", "/mci-redis-manager"]; // no redirect whitelist

let legacySsoCapabilityCache = { osClient: "", expiresAt: 0, data: [] };
let lastRecordedMenuVisit = { menuId: "", at: 0 };

function recordHomeMenuVisit(to) {
    try {
        if (!DiyCommon.getToken()) return;
        const path = String(to?.path || "");
        if (!path || ["/", "/login", "/access-login"].includes(path)) return;
        const menuId = String(to?.meta?.SourceMenuId || to?.meta?.Id || "").trim();
        if (!menuId) return;
        const user = useDiyStore(pinia).GetCurrentUser || {};
        if (user._AccessKeySession === true) return;
        const now = Date.now();
        if (lastRecordedMenuVisit.menuId === menuId && now - lastRecordedMenuVisit.at < 15000) return;
        lastRecordedMenuVisit = { menuId, at: now };
        Promise.resolve(DiyCommon.ApiEngine.Run("platform-home-overview", {
            Action: "RecordMenuOpen",
            MenuId: menuId
        })).catch(() => {});
    } catch (_) {
        // 兼容尚未安装首页资源的旧租户；访问统计绝不能阻断路由跳转。
    }
}

async function loadLegacySsoCapabilities() {
    const osClient = String(DiyCommon.GetOsClient() || "");
    const now = Date.now();
    if (legacySsoCapabilityCache.osClient === osClient
        && legacySsoCapabilityCache.expiresAt > now) {
        return legacySsoCapabilityCache.data;
    }
    const data = await getLegacySsoCapabilities(DiyCommon, osClient);
    legacySsoCapabilityCache = {
        osClient,
        expiresAt: now + 15000,
        data: Array.isArray(data) ? data : []
    };
    return legacySsoCapabilityCache.data;
}

function removeCredentialParameter(paramName) {
    if (!paramName) return;
    try {
        const url = withoutLegacySsoCredential(window.location.href, paramName);
        window.history.replaceState(window.history.state, document.title, url);
    } catch (_) {}
}

function getAccessKeyAllowedRoutes(currentUser) {
    if (!currentUser || currentUser._AccessKeySession !== true) return [];
    const routes = Array.isArray(currentUser._AccessKeyAllowedRoutes)
        ? currentUser._AccessKeyAllowedRoutes
        : [];
    return routes
        .map((path) => normalizeAccessRoute(path))
        .filter(Boolean);
}

function isAuthenticationFailure(error) {
    if (!error) return false;
    if (error.isAuthFailure === true) return true;
    if (Number(error.response?.status) === 401) return true;
    if ([1001, 1002].includes(Number(error.code ?? error.Code))) return true;
    var message = String(error.message || error.Msg || "").trim().toLowerCase();
    return message === "nologin"
        || message.includes("nologin")
        || message.includes("未登录")
        || message.includes("token失效")
        || message.includes("token签名")
        || message.includes("身份验证失败")
        || message.includes("请重新登录");
}

function normalizeIframeRouteUrl(url) {
    if (!url) return url;
    var rawUrl = String(url).trim();
    if (rawUrl.startsWith("/iframe/")) {
        rawUrl = rawUrl.replace("/iframe/", "");
    }
    try {
        rawUrl = decodeURIComponent(rawUrl);
    } catch (error) { }
    return "/iframe/" + encodeURIComponent(rawUrl);
}

function getUserDefaultIndexUrl(user) {
    var value = user && user.DefaultIndexUrl ? String(user.DefaultIndexUrl).trim() : "";
    if (!value || /^(https?:)?\/\//i.test(value)) return "";
    var normalized = normalizeMenuRoutePath(value);
    var routePath = normalized.split(/[?#]/)[0];
    return routePath === "/login" || routePath === "/access-login" ? "" : normalized;
}

async function getAuthorizedUserDefaultIndexUrl(user) {
    var candidate = getUserDefaultIndexUrl(user);
    if (!candidate) return "";
    try {
        const userStore = useUserStore(pinia);
        const permissionStore = usePermissionStore(pinia);
        var accessRoutes = permissionStore.addRoutes || [];
        if (accessRoutes.length === 0) {
            const roles = userStore.roles && userStore.roles.length > 0 ? userStore.roles : ["admin"];
            if (!userStore.roles || userStore.roles.length === 0) userStore.setRoles(roles);
            accessRoutes = await permissionStore.generateRoutes(roles);
            accessRoutes.forEach((route) => {
                try { router.addRoute(route); } catch (_) { }
            });
        }
        var candidatePath = candidate.split(/[?#]/)[0];
        return hasAccessibleRoutePath(accessRoutes, candidatePath) ? candidate : "";
    } catch (error) {
        console.warn("[permission] 用户默认首页权限校验失败：", error && error.message);
        return "";
    }
}

function getPermissionFallbackPath(routes, targetPath) {
    const normalizedTarget = normalizeMenuRoutePath(targetPath || "/");
    if (hasAccessibleRoutePath(routes, normalizedTarget)) return "";
    if (normalizedTarget !== "/") return "";
    return getFirstValidRoutePath(routes);
}

router.beforeEach(async (to, from, next) => {
    // 已经进入平台壳层后的路由切换保留当前内容，目标页面及表单各自负责
    // 局部骨架屏。整页骨架会在首次加载异步模块时遮住旧页面，造成明显闪屏。
    const shellMounted = typeof document !== "undefined"
        && Boolean(document.querySelector("#tags-view-container-microi, .app-main-microi"));
    if (shouldStartInitialRouteLoading(from, shellMounted)) {
        startRouteLoading();
    } else {
        cancelRouteLoading();
    }
    // 安全/稳定性修复：整个守卫包一层 try/catch 兜底，
    // 避免任意 await 抛错导致 next() 不被调用而出现"白屏永久无法导航"。
    try {
    // A fresh browser has no tenant cache. Never let the compatibility default
    // iTdos reach SSO/auth requests before domain tenant discovery completes.
    if (!(await waitForPlatformBootstrap())) {
        cancelRouteLoading();
        next(false);
        return;
    }
    // AI 应用主数据与管理入口已统一到应用商城。旧租户菜单、收藏夹或
    // 外部链接仍可能访问 /mci-ai-app，因此在权限和动态路由装载前做
    // 稳定兼容跳转；携带 appId 时继续进入对应应用的开发工作台。
    if (to.path === "/mci-ai-app") {
        const legacyAppId = String(to.query?.appId || "").trim();
        if (legacyAppId) {
            next({ name: "mic_ai_app_detail", params: { appId: legacyAppId }, replace: true });
        } else {
            next({ path: "/microi-store", replace: true });
        }
        return;
    }
    const isAnonymousRoute = to.matched.some((record) => record.meta?.anonymous === true);
    // The access-key exchange page must not wait for unrelated SSO discovery.
    // A fresh browser may have no tenant cache yet; the URL carries OsClient.
    if (to.path === "/access-login") {
        next();
        return;
    }
    //   document.title = getPageTitle(to.meta.title)
    // Legacy URL-token compatibility may only use the narrow SSO projection.
    // Remove historical browser caches that contained whole diy_sso rows.
    try {
        sessionStorage.removeItem("Diy_Sso");
        sessionStorage.removeItem("LastSsoToken");
    } catch (_) { }
    var lastSsoToken = DiyCommon.getToken();
    var diySsoArray = [];
    try {
        diySsoArray = await loadLegacySsoCapabilities();
    } catch (_) {
        diySsoArray = [];
    }
    var matchedLegacyCredential = false;
    var cleanedLegacyTarget = null;
    for (let index = 0; index < diySsoArray.length; index++) {
        const diySso = diySsoArray[index];
        const token = readLegacySsoCredential(location.href, diySso.TokenName);
        if (token) {
            matchedLegacyCredential = true;
            removeCredentialParameter(diySso.TokenName);
            cleanedLegacyTarget = legacySsoTarget(to, diySso.TokenName);
            to = router.resolve(cleanedLegacyTarget);
        }
        if (token && (token !== lastSsoToken || !DiyCommon.getToken())) {
            const usesDiyToken = String(diySso.ClientSsoApi).toLowerCase()
                === DiyApi.TokenLogin().toLowerCase();
            if (usesDiyToken) {
                DiyCommon.setToken(token.replace(/^Bearer(?:%20|\s)+/i, ""));
            }
            let ssoApiResult;
            try {
                ssoApiResult = await DiyCommon.PostAsync(diySso.ClientSsoApi, {
                    _token: token,
                    Token: token,
                    TokenName: diySso.TokenName,
                    OsClient: DiyCommon.GetOsClient()
                });
            } catch (error) {
                if (usesDiyToken) {
                    if (lastSsoToken) DiyCommon.setToken(lastSsoToken);
                    else DiyCommon.removeToken();
                }
                throw error;
            }
            if (ssoApiResult.Code != 1 && usesDiyToken) {
                if (lastSsoToken) DiyCommon.setToken(lastSsoToken);
                else DiyCommon.removeToken();
            }
            // console.log('-------> SsoAutoLogin ssoApiResult：', ssoApiResult);
            if (ssoApiResult.Code == 1) {
                const diyStore = useDiyStore(pinia);
                diyStore.setState("SystemStyle", "Classic");
                diyStore.setCurrentUser(ssoApiResult.Data);

                // Preserve the requested page, including its layout/query options.
                // The next guard still resolves the authoritative user and menu permissions.
                if (isLegacySsoDeepLink(to)) {
                    next(cleanedLegacyTarget);
                    return;
                }

                var ssoUserDefaultIndexUrl = await getAuthorizedUserDefaultIndexUrl(ssoApiResult.Data);
                if (ssoUserDefaultIndexUrl) {
                    next({ path: ssoUserDefaultIndexUrl, replace: true });
                    return;
                }

                //--- 2023-06-06新增此逻辑
                //这里需要跳转到sys_menu的第一个路由
                //2022-07-05新增：以系统设置的默认首页路由为优先
                // var sysConfig = store.getters['DiyStore/SysConfig'];
                var sysConfigResult = await DiyCommon.FormEngine.GetFormDataAnonymous({
                    FormEngineKey: "Sys_Config",
                    // _Where: [{ Name: "IsEnable", Value: 1, Type: "=" }],
                    _Where: [["IsEnable", "=", 1]],
                    OsClient: DiyCommon.GetOsClient()
                });
                if (sysConfigResult.Code == 1) {
                    var sysConfig = sysConfigResult.Data;
                    if (sysConfig && sysConfig.DefaultIndexUrl) {
                        var url = String(sysConfig.DefaultIndexUrl || "");
                        url = url.replace("$V8.CurrentToken$", DiyCommon.getToken());
                        if (url.startsWith("/iframe/")) {
                            url = normalizeIframeRouteUrl(url);
                        } else if (url.startsWith("http")) {
                            window.location.href = url;
                            return;
                        }
                        next({ path: normalizeMenuRoutePath(url) });
                        return;
                    }
                }
                break;
            }
        }
    }
    if (!matchedLegacyCredential && readLegacySsoCredential(location.href, "token")) {
        removeCredentialParameter("token");
        cleanedLegacyTarget = legacySsoTarget(to, "token");
        to = router.resolve(cleanedLegacyTarget);
    }

    if (cleanedLegacyTarget) {
        next(cleanedLegacyTarget);
        return;
    }

    const hasToken = DiyCommon.getToken();

    if (hasToken) {
        if (to.path === "/access-login") {
            next();
            return;
        }
        const userStore = useUserStore(pinia);
        const permissionStore = usePermissionStore(pinia);
        if (!userStore.roles || userStore.roles.length === 0) {
            try {
                // A browser cache only proves that a Token string exists. Resolve the
                // authoritative user before any protected menu request so a revoked or
                // expired session cannot be misreported as a menu-permission failure.
                await readRouteBootstrap(
                    async () => await userStore.getInfo(),
                    error => Boolean(DiyCommon.getToken()) && !isAuthenticationFailure(error)
                );
            } catch (error) {
                if (!DiyCommon.getToken() || isAuthenticationFailure(error)) {
                    console.warn("[permission] 登录身份已失效，转到登录页。");
                    await userStore.resetToken();
                    if (isAnonymousRoute) {
                        next(createDynamicRouteRematch(to));
                    } else {
                        next({ path: "/login", query: { redirect: to.fullPath } });
                    }
                } else {
                    console.error("[permission] 登录身份初始化失败：", error);
                    // 首次导航不能用 next(false) 吞掉真实原因，否则 isReady 只会得到
                    // Navigation aborted，启动页也会误报后端断网。
                    next(createRouteBootstrapError(error, "identity"));
                }
                return;
            }
        }
        const accessKeyDiyStore = useDiyStore(pinia);
        const accessKeyAllowedRoutes = getAccessKeyAllowedRoutes(accessKeyDiyStore.GetCurrentUser);
        if (accessKeyAllowedRoutes.length > 0) {
            const targetPath = normalizeMenuRoutePath(to.path || "/");
            const allowAllPages = accessKeyAllowedRoutes.includes("*");
            if (allowAllPages) {
                if (!userStore.roles || userStore.roles.length === 0) {
                    userStore.setRoles(["access-key"]);
                }
                if (!permissionStore.addRoutes || permissionStore.addRoutes.length === 0) {
                    const accessRoutes = await permissionStore.generateRoutes(["access-key"]);
                    accessRoutes.forEach((route) => {
                        try {
                            router.addRoute(route);
                        } catch (routeError) {
                            console.warn("[permission] add access-key route failed:", route && route.path, routeError);
                        }
                    });
                    if (targetPath === "/") {
                        const firstPath = getFirstValidRoutePath(accessRoutes);
                        if (firstPath) {
                            next({ path: firstPath, replace: true });
                            return;
                        }
                    }
                    if (!accessRoutes || accessRoutes.length === 0) {
                        next();
                        return;
                    }
                    next(createDynamicRouteRematch(to));
                    return;
                }
                if (targetPath === "/") {
                    const firstPath = getFirstValidRoutePath(permissionStore.addRoutes);
                    if (firstPath) {
                        next({ path: firstPath, replace: true });
                        return;
                    }
                }
                next();
                return;
            }
            if (accessKeyAllowedRoutes.includes(targetPath)) {
                if (!userStore.roles || userStore.roles.length === 0) {
                    userStore.setRoles(["access-key"]);
                }
                next();
            } else {
                next({ path: accessKeyAllowedRoutes[0], replace: true });
            }
            return;
        }
        if (to.path === "/login") {
            next({ path: "/" });
        } else {
            const hasRoles = userStore.roles && userStore.roles.length > 0;
            if (hasRoles && permissionStore.addRoutes && permissionStore.addRoutes.length > 0) {
                const fallbackPath = getPermissionFallbackPath(permissionStore.addRoutes, to.path);
                if (fallbackPath) {
                    next({ path: fallbackPath, replace: true });
                } else {
                    next();
                }
            } else {
                try {
                    const currentRoles = userStore.roles;
                    
                    const accessRoutes = await readRouteBootstrap(
                        () => permissionStore.generateRoutes(currentRoles),
                        error => Boolean(DiyCommon.getToken()) && !isAuthenticationFailure(error)
                    );
                    // Vue Router 4: addRoutes 已移除，改用 addRoute 逐个添加
                    accessRoutes.forEach((route) => {
                        try {
                            router.addRoute(route);
                        } catch (routeError) {
                            console.warn("[permission] addRoute failed:", route && route.path, routeError);
                        }
                    });
                    const fallbackPath = getPermissionFallbackPath(accessRoutes, to.path);
                    if (fallbackPath) {
                        next({ path: fallbackPath, replace: true });
                    } else {
                        next(createDynamicRouteRematch(to));
                    }
                } catch (error) {
                    console.error("[permission] 动态路由初始化失败：", error);
                    // 同域切换 OsClient 时，浏览器里可能仍残留其它租户的 Token。
                    // 菜单接口明确返回 NoLogin/1001/1002 时必须清理并跳登录页，否则 next(false) 会留下空白页。
                    if (!DiyCommon.getToken() || isAuthenticationFailure(error)) {
                        await userStore.resetToken();
                        if (isAnonymousRoute) {
                            next(createDynamicRouteRematch(to));
                        } else {
                            next({ path: "/login", query: { redirect: to.fullPath } });
                        }
                    } else {
                        next(createRouteBootstrapError(error, "menu"));
                    }
                }
            }
        }
    } else {
        if (isAnonymousRoute || whiteList.indexOf(to.path) !== -1) {
            next();
        } else {
            next({ path: "/login", query: { redirect: to.fullPath } }); //2022-03-31
        }
    }
    } catch (e) {
        // 守卫顶层错误兜底，避免 next 未调用导致整站卡死
        console.error("[router.beforeEach] 守卫异常：", e);
        try {
            if (to.path === "/login" || to.matched.some((record) => record.meta?.anonymous === true) || (whiteList && whiteList.indexOf(to.path) !== -1)) {
                next();
            } else {
                next({ path: "/login", query: { redirect: to.fullPath || "/" } });
            }
        } catch (_) {
            next(false);
        }
    }
});

router.afterEach((to) => {
    finishRouteLoading();
    recordHomeMenuVisit(to);
    // 5+App 返回键使用：路由完成后立即更新"是否在根页面"标志
    // 在根页面（Tab 首页/登录页）按返回键应双击退出，而不是继续 router.back()
    const ROOT_PATHS = [
        '/mobile/home',
        '/mobile/workspace',
        '/mobile/message',
        '/mobile/profile',
        '/login',
        '/'
    ];
    window.__microi_isRootPage = ROOT_PATHS.some(function(p) {
        return to.path === p || to.path === p + '/';
    });

    // 5+App 状态栏文字颜色动态适配
    // 根据页面顶部背景色自动切换状态栏文字颜色（白底用深色文字，深底用浅色文字）
    if (typeof plus !== 'undefined' && plus.navigator) {
        // 延迟检测，等待 Vue 组件渲染完成
        setTimeout(function() {
            try {
                // Android 平板进入 PC 布局后，App.vue 已按真实状态栏高度下移
                // 当前 WebView；状态栏区域露出白色原生背景，因此固定使用深色图标。
                // 手机布局不进入此分支，继续按页面顶栏颜色保留沉浸式效果。
                if (window.__microi_apkDesktopStatusbarInset === true) {
                    plus.navigator.setStatusBarStyle('dark');
                    return;
                }

                // 查找页面顶部 header 元素（fixed 定位的顶栏）
                var headerEl = document.querySelector(
                    '.home-header, .workspace-header, .message-header, ' +
                    '.user-card, .mobile-form-header-bar, .mobile-header, ' +
                    '.chat-header'
                );
                if (!headerEl) {
                    // 默认：白色背景页面用深色文字
                    plus.navigator.setStatusBarStyle('dark');
                    return;
                }
                var bgColor = window.getComputedStyle(headerEl).backgroundColor;
                if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
                    // 透明背景，尝试检查 background 属性（渐变等）
                    var bg = window.getComputedStyle(headerEl).background;
                    if (bg && /linear-gradient/.test(bg)) {
                        // 渐变背景通常是深色主题色，用浅色文字
                        plus.navigator.setStatusBarStyle('light');
                        return;
                    }
                    plus.navigator.setStatusBarStyle('dark');
                    return;
                }
                // 解析 rgb/rgba 值并计算亮度
                var match = bgColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                if (match) {
                    var r = parseInt(match[1]);
                    var g = parseInt(match[2]);
                    var b = parseInt(match[3]);
                    // 相对亮度公式 (ITU-R BT.709)
                    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                    // 亮度 > 0.5 为浅色背景 → 深色文字；否则为深色背景 → 浅色文字
                    plus.navigator.setStatusBarStyle(luminance > 0.5 ? 'dark' : 'light');
                } else {
                    plus.navigator.setStatusBarStyle('dark');
                }
            } catch(e) {
                // 出错时默认深色文字
                try { plus.navigator.setStatusBarStyle('dark'); } catch(e2) {}
            }
        }, 350);
    }
});

router.onError(() => {
    finishRouteLoading();
});
