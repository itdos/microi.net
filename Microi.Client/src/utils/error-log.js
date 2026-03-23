// Vue 3: 错误处理器在 main.js 中通过 app.config.errorHandler 设置
// 这里只导出配置检查函数
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

// 导出错误处理函数供 main.js 使用
export function setupErrorHandler(app) {
    if (checkNeed()) {
        app.config.errorHandler = function (err, instance, info) {
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
        };
    }
}
