import axios from "axios";
import { ElMessageBox, ElMessage } from "element-plus";
const MessageBox = ElMessageBox;
const Message = ElMessage;
// Pinia store
import pinia from "@/pinia";
import { useUserStore } from "@/pinia";
// import { getToken } from '@/utils/auth.js'
import { DiyCommon, DosCommon } from "@/utils/microi.net.import";
import { reportApiServiceFailure, reportApiServiceRecovered } from "@/utils/api-service-status.js";

// 辅助函数：获取 UserStore
const getUserStore = () => useUserStore(pinia);

// create an axios instance
const service = axios.create({
    baseURL: import.meta.env.VITE_BASE_API, // url = base url + request url
    // withCredentials: true, // send cookies when cross-domain requests
    timeout: 10 * 60 * 1000 // 通用请求超时：允许接口引擎/V8/导入导出等合法长任务同步等待到10分钟
});

// request interceptor
service.interceptors.request.use(
    (config) => {
        // do something before request is sent
        const requestToken = DiyCommon.getToken();
        config.__microiRequestToken = requestToken;
        if (requestToken) {
            // let each request carry token
            // ['X-Token'] is a custom headers key
            // please modify it according to the actual situation
            config.headers["X-Token"] = requestToken;
        }
        return config;
    },
    (error) => {
        // do something with request error
        console.log(error); // for debug
        return Promise.reject(error);
    }
);

// response interceptor
service.interceptors.response.use(
    /**
     * If you want to get http information such as headers or status
     * Please return  response => response
     */

    /**
     * Determine the request status by custom code
     * Here is just an example
     * You can also judge the status by HTTP Status Code
    */
    (response) => {
        reportApiServiceRecovered({
            apiBase: DiyCommon.GetApiBase(),
            url: response.config?.url,
            requestUrl: response.request?.responseURL,
            osClient: DiyCommon.GetOsClient(),
            method: response.config?.method,
            responseData: response.data
        });
        const requestToken = response.config && response.config.__microiRequestToken;
        if (DiyCommon && typeof DiyCommon.ApplyAuthorizationToken === "function") {
            DiyCommon.ApplyAuthorizationToken(
                response.headers?.authorization || response.headers?.token,
                requestToken
            );
            // DiyCommon is the cross-tab source of truth. Keep the router-facing
            // Pinia store synchronized so a token issued/rotated by this axios
            // instance cannot leave the two request paths in different states.
            const currentToken = DiyCommon.getToken();
            const userStore = getUserStore();
            if (userStore.token !== currentToken) {
                userStore.setToken(currentToken);
            }
        }
        const res = response.data;

        // 修复：适配 Microi 后端返回格式 { Code: 1, Data, Msg }
        // 原模板代码使用 res.code !== 20000 与实际不符，会导致所有请求被误报，且 Token 失效不能重登录。
        if (res && res.Code !== 1) {
            const authMessage = String(res.Msg || res.Message || "").toLowerCase();
            const isAuthFailure = res.Code === 1001
                || res.Code === 1002
                || authMessage.includes("nologin")
                || authMessage.includes("token签名")
                || authMessage.includes("token失效")
                || authMessage.includes("请重新登录");
            const tokenChanged = isAuthFailure
                && DiyCommon
                && typeof DiyCommon.HasTokenChangedSinceRequest === "function"
                && DiyCommon.HasTokenChangedSinceRequest(requestToken);
            const authTransitionActive = isAuthFailure
                && DiyCommon
                && typeof DiyCommon.IsAuthTransitionActive === "function"
                && DiyCommon.IsAuthTransitionActive();
            if (tokenChanged || authTransitionActive) {
                return Promise.reject(new Error(res.Msg || "Stale token request failed"));
            }
            Message({
                message: res.Msg || "Error",
                type: "error",
                duration: 5 * 1000
            });

            // 1001: Token 失效; 1002: 身份验证失败
            if (isAuthFailure) {
                if (DiyCommon && typeof DiyCommon.OpenLogin === "function") {
                    DiyCommon.OpenLogin();
                }
            }
            return Promise.reject(new Error(res.Msg || "Error"));
        } else {
            return res;
        }
    },
    (error) => {
        reportApiServiceFailure(error, {
            apiBase: DiyCommon.GetApiBase(),
            osClient: DiyCommon.GetOsClient(),
            url: error.config?.url,
            requestUrl: error.request?.responseURL,
            method: error.config?.method
        });
        console.log("err" + error); // for debug
        const authTransitionActive = DiyCommon
            && typeof DiyCommon.IsAuthTransitionActive === "function"
            && DiyCommon.IsAuthTransitionActive();
        if (!authTransitionActive) {
            Message({
                message: error.message,
                type: "error",
                duration: 5 * 1000
            });
        }
        return Promise.reject(error);
    }
);

export default service;
