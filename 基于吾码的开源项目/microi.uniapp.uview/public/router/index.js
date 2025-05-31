// router.js
import {
	RouterMount,
	createRouter
} from '@/public/plugin/uni-simple-router/uni-simple-router'

import util from '../util/index.js'
import config from '../config/index.js'

import store from '@/public/store';

import Vue from 'vue'

const router = createRouter({
	platform: process.env.VUE_APP_PLATFORM,
	routes: [...ROUTES],
	mode:'hash'
});
//全局路由前置守卫
router.beforeEach(async (to, from, next) => {
	//需要授权的路由
	var strAuthorization = wx.getStorageSync('authorization');
	// var a = await Vue.prototype.$u.api.GetLogin({});
	var strAuthorizationTime = wx.getStorageSync('authorization_time');
	var dateDiffTimeout = false;
	if(strAuthorizationTime){
		var m = util.DateDiff(new Date(strAuthorizationTime), new Date(), 'm');
		if(m > 20){
			dateDiffTimeout = true;
		}
	}
	var isTimeout = false;
	if(!strAuthorization || !strAuthorizationTime || dateDiffTimeout){
		isTimeout = true;
	}
	if(to.name != 'login' && isTimeout && to.meta.requireAuth !== false){
		//自动登陆
		if(wx.getStorageSync('AutoLogin') && wx.getStorageSync('LoginAccount') && wx.getStorageSync('LoginPwd')){
			try{
				var params = {
					Account: wx.getStorageSync('LoginAccount'),
					Pwd: wx.getStorageSync('LoginPwd'),
					OsClient: config.osClient
				}
				var res = await Vue.prototype.$u.api.GetLogin(params)
				if (res.data.Code == 1){
					var user = res.data.Data
					user.Avatar = util.GetServerPath(user.Avatar,'/static/img/my/toux.png')
					Vue.prototype.$u.vuex('vuex_userInfo',user)
					
					var token = 'Bearer ' + (res.header.Authorization || res.header.authorization);
					Vue.prototype.$u.vuex('vuex_token', token)
					wx.setStorageSync('authorization', token);
					wx.setStorageSync('authorization_time', util.DateFormat(new Date(), 'yyyy-MM-dd HH:mm:ss'));
					next();
				}else{
					next({
						name: 'login',
						params: {
							needLogin: true
						}
					})
				}
			}catch(e){
				next({
					name: 'login',
					params: {
						needLogin: true
					}
				})
			}	
			
		}else{
			next({
				name: 'login',
				params: {
					needLogin: true
				}
			})
		}
		
	}
	else if (to.meta.requireAuth) {
		//token是否存在
		if (!store.state.vuex_token) {	
			uni.showModal({
				title: '提示',
				content: '您未登录，请登录后查看',
				confirmText: '去登录',
				success: res => {
					if (res.confirm) {
						next({
							name: 'login',
							params: {
								needLogin: true
							}
						})
					} else {
						next({
							name: from.name
						})
					}
				}
			})
		} else {
			next();
		}
	} else {
		next();
	}

});

// 全局路由后置守卫
router.afterEach((to, from) => {
	console.log('路由跳转成功：', to.path)
	// this.$u.vuex('vuex_routeMeta',to.meta)
})
export {
	router,
	RouterMount
}
