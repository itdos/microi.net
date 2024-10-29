//只要是未登录状态，想要跳转到名单内的路径时，直接跳到登录页
import dayjs from 'dayjs';
import { tnNavPage } from '@tuniao/tnui-vue3-uniapp/utils'
import Qs from 'qs'
// import { useUser } from '@/stores';
// import pinia from '@/stores/pinia.ts'
// const userStore = useUser(pinia)
// 页面白名单，不受拦截
const whiteList = [
	'/pages/login/index'
]
function hasPermission(url: string) {
	let islogin = uni.getStorageSync('Token');//在这可以使用token、vuex
	// 在白名单中或有登录判断条件可以直接跳转
	if (whiteList.indexOf(url) !== -1 || islogin) {
		return true
	}
	return false
}
const interceptor = {
	invoke: (e: { url: string; }) => {
		if (!hasPermission(e.url)) {
			// tnNavPage('/pages/login/index', 'navigateTo')
			uni.reLaunch({
				url: '/pages/login/index'
			})
			return false
		}
		return true
	},
}
// 点击跳转前拦截
uni.addInterceptor('navigateTo',interceptor)
// 点击返回前拦截
uni.addInterceptor('navigateBack', interceptor)