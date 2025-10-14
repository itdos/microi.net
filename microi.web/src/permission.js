import router from "./router";
import store from "./store";
import { Message } from "element-ui";
// import NProgress from 'nprogress' // progress bar
// import 'nprogress/nprogress.css' // progress bar style
import { getToken } from "@/utils/auth.js"; // get token from cookie
import getPageTitle from "@/utils/get-page-title";
import { DiyCommon, DiyApi } from "@/utils/microi.net.import";
import Cookies from "js-cookie";

// NProgress.configure({ showSpinner: false }) // NProgress Configuration

const whiteList = ["/login", "/auth-redirect"]; // no redirect whitelist

router.beforeEach(async (to, from, next) => {
  // start progress bar
  //   NProgress.start()

  // set page title
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
  // console.log('-------> Diy_Sso：', diySsoArray);
  if (diySsoArray.length > 0) {
    // console.log('-------> SsoAutoLogin href：' + location.href);
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
        localStorage.setItem(DiyCommon.TokenKey, newtoken);
        Cookies.set(DiyCommon.TokenKey, newtoken);
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
        store.commit("DiyStore/SetState", {
          key: "SystemStyle",
          value: "Classic"
        });
        store.commit("DiyStore/SetCurrentUser", ssoApiResult.Data);

        //--- 2023-06-06新增此逻辑
        //这里需要跳转到sys_menu的第一个路由
        //2022-07-05新增：以系统设置的默认首页路由为优先
        // var sysConfig = store.getters['DiyStore/SysConfig'];
        var sysConfigResult = await DiyCommon.FormEngine.GetFormDataAnonymous({
          FormEngineKey: "Sys_Config",
          // _Where: [{ Name: "IsEnable", Value: 1, Type: "=" }],
          _Where: [[ "IsEnable", "=" , 1]],
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

  // determine whether the user has logged in
  const hasToken = DiyCommon.getToken();

  if (hasToken) {
    if (to.path === "/login") {
      // if is logged in, redirect to the home page
      next({ path: "/" });
      //   NProgress.done()
    } else {
      // determine whether the user has obtained his permission roles through getInfo
      const hasRoles = store.getters.roles && store.getters.roles.length > 0;
      if (hasRoles) {
        next();
      } else {
        try {
          // get user info
          // note: roles must be a object array! such as: ['admin'] or ,['developer','editor']
          const { roles } = await store.dispatch("user/getInfo");

          // generate accessible routes map based on roles
          //   const accessRoutes = await store.dispatch('permission/generateRoutes', roles)
          //这里获取模块 generateRoutes
          const accessRoutes = await store.dispatch("permission/generateRoutes", ["admin"]);
          // dynamically add accessible routes
          router.addRoutes(accessRoutes);

          // hack method to ensure that addRoutes is complete
          // set the replace: true, so the navigation will not leave a history record
          next({ ...to, replace: true });
        } catch (error) {
          console.log("iTdos permission error：", error);
          // console.log(error);
          // remove token and go to login page to re-login
          await store.dispatch("user/resetToken");

          //   Message.error(error || 'Has Error')// by itdos 注释
          // console.log(error)

          // next(`/login?redirect=${to.path}`)
          // console.log('--> to.fullPath：' + to.fullPath);
          next(`/login?redirect=${to.fullPath}`); //2022-03-31
          //   NProgress.done()
        }
      }
    }
  } else {
    /* has no token*/
    if (whiteList.indexOf(to.path) !== -1) {
      // in the free login whitelist, go directly
      next();
    } else {
      // other pages that do not have permission to access are redirected to the login page.
      // next(`/login?redirect=${to.path}`)
      // console.log('--> to.fullPath：' + to.fullPath);
      next(`/login?redirect=${to.fullPath}`); //2022-03-31
      //   NProgress.done()
    }
  }
});

router.afterEach(() => {
  // finish progress bar
  //   NProgress.done()
});
