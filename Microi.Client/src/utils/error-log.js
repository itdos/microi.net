// Vue 3: 错误处理器在 main.js 中通过 app.config.errorHandler 设置。
// Element Plus 2.13.x 的 useOrderedChildren 在整个 Tabs 随路由卸载时存在一个
// 生命周期竞态：父节点映射可能先被释放，TabPane 的 beforeUnmount 随后调用
// unregisterPane，内部对 undefined 执行 indexOf。若错误继续向上抛，Vue 会中断
// RouterView 更新，表现为 URL 已变化但页面仍停留在旧模块。
import { useErrorLogStore } from "@/pinia";
import { isString, isArray } from "@/utils/validate";
import settings from "@/settings";
import { nextTick } from "vue";

// you can set in settings.js
// errorLog:'production' | ['production', 'development']
const { errorLog: needErrorLog } = settings;

export function checkNeed() {
    const env = import.meta.env.MODE;
    if (isString(needErrorLog)) {
        return env === needErrorLog;
    }
    if (isArray(needErrorLog)) {
        return needErrorLog.includes(env);
    }
    return false;
}

let elementPlusTabsRaceReported = false;

export function isElementPlusTabsUnmountRace(err, info) {
    const message = String(err?.message || err || "");
    const stack = String(err?.stack || "");
    const lifecycle = String(info || "");
    return message.includes("Cannot read properties of undefined (reading 'indexOf')")
        && stack.includes("unregisterPane")
        && stack.includes("element-plus")
        && lifecycle.includes("beforeUnmount");
}

// 导出错误处理函数供 main.js 使用
export function setupErrorHandler(app) {
    const shouldPersistError = checkNeed();
    app.config.errorHandler = function (err, instance, info) {
        if (isElementPlusTabsUnmountRace(err, info)) {
            // 仅吞掉已确认的 Element Plus Tabs 卸载竞态，让 Vue 继续完成路由更新。
            // 开发环境只提示一次，避免一个 Tabs 的多个 Pane 重复刷屏。
            if (import.meta.env.DEV && !elementPlusTabsRaceReported) {
                elementPlusTabsRaceReported = true;
                console.warn("[Microi] 已忽略 Element Plus Tabs 卸载竞态，路由切换继续执行。");
            }
            return;
        }

        if (shouldPersistError) {
            nextTick(() => {
                const errorLogStore = useErrorLogStore();
                errorLogStore.addErrorLog({
                    err,
                    vm: instance,
                    info,
                    url: window.location.href
                });
                console.error(err, info);
            });
            return;
        }

        // 未启用持久化错误日志时也不能静默吞掉真实异常。
        console.error(err, info);
    };
}
