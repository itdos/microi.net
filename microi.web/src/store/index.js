// Vuex 4 for Vue 3 - Vite compatible
import { createStore } from "vuex";
import getters from "./getters";
import createPersistedState from "vuex-persistedstate";

// Vite 方式加载模块 (替代 require.context)
import app from "./modules/app.js";
import autopage from "./modules/autopage.js";
import contextmenu from "./modules/contextmenu.js";
import errorLog from "./modules/errorLog.js";
import permission from "./modules/permission.js";
import settings from "./modules/settings.js";
import tagsView from "./modules/tagsView.js";
import DiyStore from "./modules/diy.store.js";

const modules = {
    app,
    autopage,
    contextmenu,
    errorLog,
    permission,
    settings,
    tagsView,
    DiyStore
};

const store = createStore({
    modules,
    getters,
    state: {
        themeColor: "",
        // 重命名为 currentUser 避免与 user 模块冲突
        currentUser: window.localStorage.getItem("Microi.CurrentUser"),
        token: window.localStorage.getItem("Microi.Token"), //登录标识
        onlineStatus: { status: "online", text: "在线" } //用户在线状态   【 online：在线、  offline：离开、 busy：忙碌、 invisible：隐身】
    },
    mutations: {
        // 将token存储到sessionStorage
        SET_TOKEN(state, data) {
            state.token = data;
            window.localStorage.setItem("Microi.Token", data);
        },
        // 获取用户名
        SET_USER(state, data) {
            state.currentUser = data;
            window.localStorage.setItem("Microi.CurrentUser", data);
        },
        // 退出
        LOGOUT(state) {
            state.currentUser = null;
            state.token = null;
            window.localStorage.removeItem("Microi.CurrentUser");
            window.localStorage.removeItem("Microi.Token");
        },
        SET_COLOR(state, data) {
            state.themeColor = data;
        }
    },
    plugins: [
        createPersistedState({
            storage: window.localStorage, // 使用 sessionStorage
            paths: ["themeColor"] // 只持久化 user 和 token
        })
    ]
    //-----end
});

export default store;
