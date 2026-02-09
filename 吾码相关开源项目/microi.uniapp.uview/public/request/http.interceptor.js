// 这里的vm，就是我们在vue文件里面的this，所以我们能在这里获取vuex的变量，比如存放在里面的token
// 同时，我们也可以在此使用getApp().globalData，如果你把token放在getApp().globalData的话，也是可以使用的
import qs from 'qs'
const install = (Vue, vm) => {
	Vue.prototype.$u.http.setConfig({
		baseUrl: `${vm.$apiHost}`,
		showLoading: true, // 是否显示请求中的loading
		loadingText: '正在加载', // 请求loading中的文字提示		
		loadingTime: 800, // 在此时间内，请求还没回来的话，就显示加载中动画，单位ms
		loadingMask: true, // 展示loading的时候，是否给一个透明的蒙层，防止触摸穿透
		// 如果将此值设置为true，拦截回调中将会返回服务端返回的所有数据response，而不是response.data
		// 设置为true后，就需要在this.$u.http.interceptor.response进行多一次的判断，请打印查看具体值
		originalData: true,
		// 设置自定义头部
		header: {
			"content-type": "application/json;charset=UTF-8",
			// 'authorization': vm.vuex_token,
		},
	});

	let httpConfig = null;

	// 请求拦截，配置Token等参数
	Vue.prototype.$u.http.interceptor.request = (config) => {
		config.header['Authorization'] = vm.vuex_token
		if (!config.url.includes('Engine')) {
			config.data = qs.stringify(config.data)
			config.header['content-type'] = 'application/x-www-form-urlencoded'
		} 
		if (!vm.vuex_token) {
			httpConfig = config
		}
		
		return config;
	}

	// 响应拦截，判断状态码是否通过
	Vue.prototype.$u.http.interceptor.response = async res => {

		if (res.statusCode == 200) {
			let {
				Code: status,
				Msg: message
			} = res.data


			let token = res.header.Authorization || res.header.authorization
			if (token) {
				vm.$u.vuex('vuex_token', `Bearer ${token}`)
				wx.setStorageSync('authorization', `Bearer ${token}`);
				wx.setStorageSync('authorization_time', vm.$util.DateFormat(new Date(), 'yyyy-MM-dd HH:mm:ss'));
			}


			// 用户登录过期
			if (vm.$config.overdueCode.includes(status)) {
				setTimeout(_=>{
					return vm.$Router.replaceAll({
						name: 'login'
					})
				},500)
			}

			// 错误信息
			else if (vm.$config.errorCode.includes(status)) {
				return vm.$u.toast(message)
			}
			else{
				return res
			}

			

		} else {
			return vm.$u.toast(res.data)
		}
	}
}

export default install
