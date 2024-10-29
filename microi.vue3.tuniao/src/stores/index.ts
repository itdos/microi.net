import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import useUser from './modules/user.ts'
import useForm from './modules/form.ts'

const pinia = createPinia();
pinia.use(
  // 默认即为JSON序列化
  piniaPluginPersistedstate
);
export { useUser, useForm }
export default pinia;