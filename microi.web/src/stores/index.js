// Pinia Store 入口
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

// 创建 Pinia 实例
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

export default pinia;

// 导出所有 stores
export { useAppStore } from "./modules/app";
export { useUserStore } from "./modules/user";
export { usePermissionStore } from "./modules/permission";
export { useTagsViewStore } from "./modules/tagsView";
export { useSettingsStore } from "./modules/settings";
export { useErrorLogStore } from "./modules/errorLog";
export { useDiyStore } from "./modules/diy";
// export { useAutopageStore } from './modules/autopage';
