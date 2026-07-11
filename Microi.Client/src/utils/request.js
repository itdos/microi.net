import axios from "axios";
import { ElMessageBox, ElMessage } from "element-plus";
const MessageBox = ElMessageBox;
const Message = ElMessage;
// Pinia store
import pinia from "@/pinia";
import { useUserStore } from "@/pinia";
// import { getToken } from '@/utils/auth.js'
import { DiyCommon, DosCommon } from "@/utils/microi.net.import";

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
        const userStore = getUserStore();
        config.__microiRequestToken = DiyCommon.getToken();
        if (userStore.token) {
            // let each request carry token
            // ['X-Token'] is a custom headers key
            // please modify it according to the actual situation
            config.headers["X-Token"] = DiyCommon.getToken();
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
        const res = response.data;

        // 修复：适配 Microi 后端返回格式 { Code: 1, Data, Msg }
        // 原模板代码使用 res.code !== 20000 与实际不符，会导致所有请求被误报，且 Token 失效不能重登录。
        if (res && res.Code !== 1) {
            const isAuthFailure = res.Code === 1001 || res.Code === 1002;
            const requestToken = response.config && response.config.__microiRequestToken;
            const tokenChanged = isAuthFailure
                && DiyCommon
                && typeof DiyCommon.HasTokenChangedSinceRequest === "function"
                && DiyCommon.HasTokenChangedSinceRequest(requestToken);
            if (tokenChanged) {
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
        console.log("err" + error); // for debug
        Message({
            message: error.message,
            type: "error",
            duration: 5 * 1000
        });
        return Promise.reject(error);
    }
);

export default service;
