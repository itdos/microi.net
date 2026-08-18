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
const whiteList = ["/login", "/auth-redirect", "/access-login", "/mci-redis-manager"]; // no redirect whitelist

function removeCredentialParameter(paramName) {
    if (!paramName) return;
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete(paramName);
        const rawHash = url.hash || "";
        const queryIndex = rawHash.indexOf("?");
        if (queryIndex >= 0) {
            const hashPath = rawHash.substring(0, queryIndex);
            const hashQuery = new URLSearchParams(rawHash.substring(queryIndex + 1));
            hashQuery.delete(paramName);
            url.hash = hashPath + (hashQuery.toString() ? "?" + hashQuery.toString() : "");
        }
        window.history.replaceState(window.history.state, document.title, url.toString());
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
    if ([1001, 1002].includes(Number(error.code))) return true;
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
    if (Array.isArray(from?.matched) && from.matched.length > 0) {
        cancelRouteLoading();
    } else {
        startRouteLoading();
    }
    // 安全/稳定性修复：整个守卫包一层 try/catch 兜底，
    // 避免任意 await 抛错导致 next() 不被调用而出现"白屏永久无法导航"。
    try {
    const isAnonymousRoute = to.matched.some((record) => record.meta?.anonymous === true);
    // The access-key exchange page must not wait for unrelated SSO discovery.
    // A fresh browser may have no tenant cache yet; the URL carries OsClient.
    if (to.path === "/access-login") {
        next();
        return;
    }
    //   document.title = getPageTitle(to.meta.title)
    //2022-09-14 所有页面均需要token自动登录
    var diySsoArray = sessionStorage.getItem("Diy_Sso");
    // Never persist an incoming credential in sessionStorage. Existing deployments
    // may still contain the legacy value, so remove it during the compatibility pass.
    try { sessionStorage.removeItem("LastSsoToken"); } catch (_) { }
    var lastSsoToken = DiyCommon.getToken();
    if (!diySsoArray) {
        var diySsoResult = await DiyCommon.PostAsync("/api/FormEngine/GetTableDataAnonymous", {
            FormEngineKey: "Diy_Sso",
            _Where: [["IsEnable", "=", 1]],
            OsClient: DiyCommon.GetOsClient()
        });
        if (diySsoResult.Code == 1 && Array.isArray(diySsoResult.Data) && diySsoResult.Data.length > 0) {
            diySsoArray = diySsoResult.Data;
        } else {
            diySsoArray = [];
        }
        sessionStorage.setItem("Diy_Sso", JSON.stringify(diySsoArray));
    } else {
        // 安全/稳定性修复：sessionStorage 数据可能损坏，避免 JSON.parse 抛错导致守卫卡死
        try {
            diySsoArray = JSON.parse(diySsoArray);
            if (!Array.isArray(diySsoArray)) diySsoArray = [];
        } catch (e) {
            console.warn("[permission] Diy_Sso JSON 解析失败，已重置：", e && e.message);
            diySsoArray = [];
            try { sessionStorage.removeItem("Diy_Sso"); } catch (_) { }
        }
    }
    if (diySsoArray.length > 0) {
    }
    // 直接检测URL中的token参数，无需Diy_Sso配置即可自动登录
    var directTokenMatch = /[?&]token=([^&;#]+)/i.exec(location.href);
    if (!directTokenMatch) {
        directTokenMatch = /[?&]token%3D([^&;#]+)/i.exec(location.href);
    }
    var directToken = directTokenMatch ? decodeURIComponent(directTokenMatch[1].replace(/\+/g, "%20")) : null;
    if (directToken) removeCredentialParameter("token");
    if (directToken && ((directToken !== lastSsoToken) || !DiyCommon.getToken()) && directToken != "$V8.CurrentToken$") {
        var newtoken = directToken.replace("Bearer%20", "").replace("Bearer ", "");
        DiyCommon.setToken(newtoken);
        var directLoginResult = await DiyCommon.PostAsync(DiyApi.TokenLogin(), {
            _token: directToken,
            Token: directToken,
            OsClient: DiyCommon.GetOsClient()
        });
        if (directLoginResult.Code == 1) {
            const diyStore = useDiyStore(pinia);
            diyStore.setState("SystemStyle", "Classic");
            diyStore.setCurrentUser(directLoginResult.Data);
            // 优先级：当前目标 > redirect > 用户个人首页 > 系统默认首页 > /
            // 1. 当前目标路径不是/login，说明用户要直接访问该页面
            if (to.path && to.path !== '/login' && to.path !== '/') {
                next({ ...to, replace: true });
                return;
            }
            // 2. 检查路由redirect参数
            var redirectPath = to.query && to.query.redirect;
            if (redirectPath) {
                redirectPath = redirectPath.split('?')[0];
                if (redirectPath && redirectPath !== '/login' && redirectPath !== '/') {
                    next({ path: normalizeMenuRoutePath(redirectPath), replace: true });
                    return;
                }
            }
            // 3. 检查用户个人首页配置
            var userDefaultIndexUrl = await getAuthorizedUserDefaultIndexUrl(directLoginResult.Data);
            if (userDefaultIndexUrl) {
                next({ path: userDefaultIndexUrl, replace: true });
                return;
            }
            // 4. 检查系统默认首页配置
            var sysConfigResult = await DiyCommon.FormEngine.GetFormDataAnonymous({
                FormEngineKey: "Sys_Config",
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
            next({ path: "/" });
            return;
        }
    }
    for (let index = 0; index < diySsoArray.length; index++) {
        const diySso = diySsoArray[index];
        var token = decodeURIComponent((new RegExp("[?|&|%3F]" + diySso.TokenName + "%3D" + "([^&;]+?)(&|#|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
        if (!token) {
            token = decodeURIComponent((new RegExp("[?|&|%3F]" + diySso.TokenName + "=" + "([^&;]+?)(&|#|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
        }
        // console.log('-------> SsoAutoLogin token：' + token);
        if (((token && token !== lastSsoToken) || (token && !DiyCommon.getToken())) && token != "$V8.CurrentToken$") {
            // && token != DiyCommon.getToken()
            removeCredentialParameter(diySso.TokenName);
            //登录
            if (diySso.ClientSsoApi.toLowerCase() == DiyApi.TokenLogin().toLowerCase()) {
                var newtoken = token.replace("Bearer%20", "").replace("Bearer ", "");
                // 使用统一的 Token 存储方法
                DiyCommon.setToken(newtoken);
            }
            var ssoApiResult = await DiyCommon.PostAsync(diySso.ClientSsoApi, {
                //'/api/SysUser/SsoPengrui'
                _token: token,
                Token: token,
                TokenName: diySso.TokenName,
                OsClient: DiyCommon.GetOsClient()
            });
            // console.log('-------> SsoAutoLogin ssoApiResult：', ssoApiResult);
            if (ssoApiResult.Code == 1) {
                const diyStore = useDiyStore(pinia);
                diyStore.setState("SystemStyle", "Classic");
                diyStore.setCurrentUser(ssoApiResult.Data);

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
                console.log("-------> SsoAutoLogin SysConfig：", sysConfigResult);
                if (sysConfigResult.Code == 1) {
                    var sysConfig = sysConfigResult.Data;
                    if (sysConfig && sysConfig.DefaultIndexUrl) {
                        var url = String(sysConfig.DefaultIndexUrl || "");
                        url = url.replace("$V8.CurrentToken$", DiyCommon.getToken());
                        console.log("-------> SsoAutoLogin DefaultIndexUrl：" + url);
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

    const hasToken = DiyCommon.getToken();

    if (hasToken) {
        if (to.path === "/access-login") {
            next();
            return;
        }
        const accessKeyDiyStore = useDiyStore(pinia);
        const accessKeyAllowedRoutes = getAccessKeyAllowedRoutes(accessKeyDiyStore.GetCurrentUser);
        if (accessKeyAllowedRoutes.length > 0) {
            const targetPath = normalizeMenuRoutePath(to.path || "/");
            const allowAllPages = accessKeyAllowedRoutes.includes("*");
            if (allowAllPages) {
                const accessKeyUserStore = useUserStore(pinia);
                const permissionStore = usePermissionStore(pinia);
                if (!accessKeyUserStore.roles || accessKeyUserStore.roles.length === 0) {
                    accessKeyUserStore.setRoles(["access-key"]);
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
                    next({ ...to, replace: true });
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
                const accessKeyUserStore = useUserStore(pinia);
                if (!accessKeyUserStore.roles || accessKeyUserStore.roles.length === 0) {
                    accessKeyUserStore.setRoles(["access-key"]);
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
            const userStore = useUserStore(pinia);
            const hasRoles = userStore.roles && userStore.roles.length > 0;
            const permissionStore = usePermissionStore(pinia);
            if (hasRoles && permissionStore.addRoutes && permissionStore.addRoutes.length > 0) {
                const fallbackPath = getPermissionFallbackPath(permissionStore.addRoutes, to.path);
                if (fallbackPath) {
                    next({ path: fallbackPath, replace: true });
                } else {
                    next();
                }
            } else {
                try {
                    // 设置角色，避免无限循环
                    const currentRoles = hasRoles ? userStore.roles : ["admin"];
                    if (!hasRoles) userStore.setRoles(currentRoles);
                    
                    const accessRoutes = await permissionStore.generateRoutes(currentRoles);
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
                        next({ ...to, replace: true });
                    }
                } catch (error) {
                    console.error("[permission] 动态路由初始化失败：", error);
                    // 同域切换 OsClient 时，浏览器里可能仍残留其它租户的 Token。
                    // 菜单接口明确返回 NoLogin/1001/1002 时必须清理并跳登录页，否则 next(false) 会留下空白页。
                    if (!DiyCommon.getToken() || isAuthenticationFailure(error)) {
                        await userStore.resetToken();
                        if (isAnonymousRoute) {
                            next({ ...to, replace: true });
                        } else {
                            next({ path: "/login", query: { redirect: to.fullPath } });
                        }
                    } else {
                        next(false);
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
