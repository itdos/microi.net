// Pinia Store 入口
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { isEmbeddedWebosWindowRuntime } from "@/utils/webos-embedded-runtime.js";

// 创建 Pinia 实例
const pinia = createPinia();
// WebOS 业务窗口与父桌面同源。子 SPA 若安装持久化插件，会把启动时的旧
// Token/CurrentUser 整包写回父页；嵌入窗口只保留内存态，由父页广播更新。
if (!isEmbeddedWebosWindowRuntime()) pinia.use(piniaPluginPersistedstate);

export default pinia;

// 导出所有 stores
export { useAppStore } from "./modules/app";
export { useUserStore } from "./modules/user";
export { usePermissionStore } from "./modules/permission";
export { useTagsViewStore } from "./modules/tagsView";
export { useSettingsStore } from "./modules/settings";
export { useErrorLogStore } from "./modules/errorLog";
export { useDiyStore } from "./modules/diy";
