import { reactive, ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
interface userType {
	id ?: string;
	username ?: string;
	nickname ?: string;
	avatar ?: null | string;
	email ?: null | string;
	roles ?: string;
	createTime ?: string;
	updateTime ?: string;
}
const useUser = defineStore("userInfo",
	() => {
		let userInfo = reactive({
			data: {} as userType, // 登陆用户信息
			MdeptData: {} as userType, // 通讯录用户信息
		});
		let token = ref<string>("");
		let sysConfigData = ref<any>({});
		// 设置userInfo信息
		const setUserInfo = (obj : userType = {}) => {
			userInfo.data = { ...obj };
		};
		// 设置token
		const setToken = (str : string = "") => {
			token.value = str;
		};
		// 清空缓存
		const clearStorage = () => {
			setUserInfo();
			setToken();
		};
		// 设置通讯录用户信息
		const setMdeptUserInfo = (obj : userType = {}) => {
			userInfo.MdeptData = { ...obj };
		};
		// 设置系统配置信息
		const setsysConfigInfo = (obj : userType = {}) => {
			sysConfigData.value = { ...obj };
		};
		return { userInfo, token, sysConfigData, setUserInfo, setToken, setMdeptUserInfo,setsysConfigInfo };
	},
	{
		persist: {
			// 调整为兼容多端的API
			storage: {
				setItem(key, value) {
					uni.setStorageSync(key, value)
				},
				getItem(key) {
					return uni.getStorageSync(key) 
				},
			},
		},
	}
);
// 热更新 编辑你的 store，并直接在你的应用中与它们互动，
// 而不需要重新加载页面，允许你保持当前的 state、并添加甚至删除 state、action 和 getter。
if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useUser, import.meta.hot));
}
export default useUser