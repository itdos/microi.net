import store from '@/store'

// 微信公众号授权
export function wxAuthorize() {
	// 非静默授权，第一次有弹框
	let local = window.location.href; // 获取页面url
	console.log(local)
	let appid = 'appid' // 公众号appid
	let code = getUrlCode().code; // 截取code
	// 获取之前的code
	let oldCode = uni.getStorageSync('wechatCode')
	if (code == null || code === '' || code == 'undefined' || code == oldCode) {
		// 如果没有code，就去请求获取code
		console.log('当前没有code，进入授权页面')
		let uri = encodeURIComponent(local)
		// 设置旧的code为0，避免死循环
		uni.setStorageSync('wechatCode',0)
		window.location.href =
			`https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${uri}&response_type=code&scope=snsapi_userinfo&state=123#wechat_redirect`
	} else {
		console.log('存在code，使用code换取用户信息')
		// 保存最新code
		uni.setStorageSync('wechatCode',code)
		uni.request({
			method: 'GET',
			url: 'https://xxx.com/api/Wechatoauth/accesstoken', // 你的接口地址
			data: {
				code
			},
			success: res => {
				if (res.data.code == 1) {
					// 成功的逻辑
					// console.log(res.data.data);
					console.log('获取用户信息成功');
					vuex('userInfo', res.data.data)
					vuex('isLogin', true)
					console.log('已登录')
				} else {
					// 失败的逻辑
					// window.alert('获取用户信息失败')
					console.log(res)
					console.log('获取用户信息失败')
				}
			},
			fail: (err) => {
				// window.alert(res)
				window.alert('请求失败')
				console.log(err)
			}
		});
	}
}

// vuex存储
function vuex(name, value) {
	store.commit('$uStore', {
		name,
		value
	})
}


function getUrlCode() {
	// 截取url中的code方法
	var url = location.search;
	// this.winUrl = url;
	var theRequest = new Object();
	if (url.indexOf('?') != -1) {
		var str = url.substr(1);
		var strs = str.split('&');
		for (var i = 0; i < strs.length; i++) {
			theRequest[strs[i].split('=')[0]] = strs[i].split('=')[1];
		}
	}
	return theRequest;
}
