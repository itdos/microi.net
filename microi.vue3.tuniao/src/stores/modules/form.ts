import { reactive, ref } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
const useForm = defineStore("useFormInfo",
	() => {
		let useFormInfo = ref<any>([]);
		// 设置userInfo信息
		const setUseFormInfo = (obj : {}) => {
			if (obj == 'null'){
				useFormInfo.value = []
			} else {
				useFormInfo.value.push(obj);
			}
		};
		return { useFormInfo, setUseFormInfo};
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
	import.meta.hot.accept(acceptHMRUpdate(useForm, import.meta.hot));
}
export default useForm