import router from "./router";
// 使用 Pinia stores
import { useUserStore, usePermissionStore, useDiyStore } from "./pinia";
import pinia from "./pinia";
// Element Plus 消息组件
import { ElMessage } from "element-plus";
import { getToken } from "@/utils/auth.js"; // get token from cookie
import getPageTitle from "@/utils/get-page-title";
import { DiyCommon, DiyApi } from "@/utils/microi.net.import";
import Cookies from "js-cookie";
const whiteList = ["/login", "/auth-redirect"]; // no redirect whitelist

router.beforeEach(async (to, from, next) => {
    //   document.title = getPageTitle(to.meta.title)
    //2022-09-14 所有页面均需要token自动登录
    var diySsoArray = sessionStorage.getItem("Diy_Sso");
    var lastSsoToken = sessionStorage.getItem("LastSsoToken");
    if (!diySsoArray) {
        var diySsoResult = await DiyCommon.PostAsync("/api/FormEngine/getTableDataAnonymous", {
            FormEngineKey: "Diy_Sso",
            _SearchEqual: { IsEnable: true },
            OsClient: DiyCommon.GetOsClient()
        });
        if (diySsoResult.Code == 1 && Array.isArray(diySsoResult.Data) && diySsoResult.Data.length > 0) {
            diySsoArray = diySsoResult.Data;
        } else {
            diySsoArray = [];
        }
        sessionStorage.setItem("Diy_Sso", JSON.stringify(diySsoArray));
    } else {
        diySsoArray = JSON.parse(diySsoArray);
    }
    if (diySsoArray.length > 0) {
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
            console.log("-------> SsoLogin token permission.js：" + token);
            sessionStorage.setItem("LastSsoToken", token);
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
                        var url = sysConfig.DefaultIndexUrl;
                        url = url.replace("$V8.CurrentToken$", DiyCommon.getToken());
                        console.log("-------> SsoAutoLogin DefaultIndexUrl：" + url);
                        if (url.startsWith("/iframe/")) {
                            url = "/iframe/" + encodeURIComponent(url.replace("/iframe/", ""));
                        } else if (url.startsWith("http")) {
                            window.location.href = url;
                            return;
                        }
                        next({ path: url });
                        return;
                    }
                }
                break;
            }
        }
    }

    const hasToken = DiyCommon.getToken();

    if (hasToken) {
        if (to.path === "/login") {
            next({ path: "/" });
        } else {
            const userStore = useUserStore(pinia);
            const hasRoles = userStore.roles && userStore.roles.length > 0;
            if (hasRoles) {
                next();
            } else {
                try {
                    // 设置角色，避免无限循环
                    userStore.setRoles(["admin"]);
                    
                    const permissionStore = usePermissionStore(pinia);
                    const accessRoutes = await permissionStore.generateRoutes(["admin"]);
                    // Vue Router 4: addRoutes 已移除，改用 addRoute 逐个添加
                    accessRoutes.forEach((route) => {
                        router.addRoute(route);
                    });
                    next({ ...to, replace: true });
                } catch (error) {
                    console.log("iTdos permission error：", error);
                    console.log("Token was:", DiyCommon.getToken());
                    await userStore.resetToken();
                    next(`/login?redirect=${to.fullPath}`);
                }
            }
        }
    } else {
        if (whiteList.indexOf(to.path) !== -1) {
            next();
        } else {
            next(`/login?redirect=${to.fullPath}`); //2022-03-31
        }
    }
});

router.afterEach(() => {
});
