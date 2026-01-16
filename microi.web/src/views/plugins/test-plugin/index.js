// 测试插件入口文件
import Layout from "@/layout";

// 导入测试组件
import TestHome from "./components/TestHome.vue";
import TestCounter from "./components/TestCounter.vue";
import TestForm from "./components/TestForm.vue";
import "./window.js";
// 插件路由配置
export const routes = [
    {
        path: "/home",
        component: Layout,
        children: [
            {
                path: "/home",
                name: "test-home",
                component: TestHome,
                meta: {
                    title: "测试首页",
                    icon: "el-icon-house"
                }
            }
        ]
    },
    {
        path: "/counter",
        component: Layout,
        children: [
            {
                path: "/counter",
                name: "test-counter",
                component: TestCounter,
                meta: {
                    title: "计数器测试",
                    icon: "el-icon-plus"
                }
            }
        ]
    },
    {
        path: "/form",
        component: Layout,
        children: [
            {
                path: "/form",
                name: "test-form",
                component: TestForm,
                meta: {
                    title: "表单测试",
                    icon: "el-icon-edit"
                }
            }
        ]
    }
];

// 插件组件注册
export const components = {
    TestHome,
    TestCounter,
    TestForm
};

// 插件Vuex模块
export const store = {
    namespaced: true,
    state: {
        counter: 0,
        formData: {
            name: "",
            email: "",
            message: ""
        },
        testList: [
            { id: 1, name: "测试项目1", status: "active" },
            { id: 2, name: "测试项目2", status: "inactive" },
            { id: 3, name: "测试项目3", status: "active" }
        ]
    },
    mutations: {
        INCREMENT_COUNTER(state) {
            state.counter++;
        },
        DECREMENT_COUNTER(state) {
            state.counter--;
        },
        SET_COUNTER(state, value) {
            state.counter = value;
        },
        UPDATE_FORM_DATA(state, { field, value }) {
            state.formData[field] = value;
        },
        RESET_FORM_DATA(state) {
            state.formData = {
                name: "",
                email: "",
                message: ""
            };
        },
        ADD_TEST_ITEM(state, item) {
            state.testList.push({
                id: Date.now(),
                ...item
            });
        },
        REMOVE_TEST_ITEM(state, id) {
            const index = state.testList.findIndex((item) => item.id === id);
            if (index > -1) {
                state.testList.splice(index, 1);
            }
        }
    },
    actions: {
        async incrementCounter({ commit }) {
            // 模拟异步操作
            await new Promise((resolve) => setTimeout(resolve, 100));
            commit("INCREMENT_COUNTER");
        },
        async decrementCounter({ commit }) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            commit("DECREMENT_COUNTER");
        },
        async resetCounter({ commit }) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            commit("SET_COUNTER", 0);
        },
        async submitForm({ commit, state }) {
            // 模拟表单提交
            await new Promise((resolve) => setTimeout(resolve, 1000));
            // console.log("表单数据:", state.formData);
            commit("RESET_FORM_DATA");
            return { success: true, message: "表单提交成功！" };
        }
    },
    getters: {
        counterValue: (state) => state.counter,
        formData: (state) => state.formData,
        testList: (state) => state.testList,
        activeTestItems: (state) => state.testList.filter((item) => item.status === "active"),
        inactiveTestItems: (state) => state.testList.filter((item) => item.status === "inactive"),
        testListCount: (state) => state.testList.length
    }
};

// 插件初始化函数
export async function init() {
    // console.log("测试插件初始化完成");

    // 可以在这里进行一些初始化操作
    // 比如加载配置、注册全局事件等

    // 示例：注册全局事件
    window.addEventListener("test-plugin-event", (event) => {
        console.log("测试插件收到事件:", event.detail);
    });

    // 示例：设置一些默认配置
    localStorage.setItem(
        "test-plugin-config",
        JSON.stringify({
            theme: "light",
            autoSave: true,
            notifications: true
        })
    );
}

// 插件卸载函数
export async function destroy() {
    console.log("测试插件卸载完成");

    // 清理插件相关的资源
    // 比如移除事件监听器、清理定时器等

    // 示例：移除事件监听器
    window.removeEventListener("test-plugin-event", () => {});

    // 示例：清理本地存储
    localStorage.removeItem("test-plugin-config");
}
