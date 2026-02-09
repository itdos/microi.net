import Vue from 'vue'
import App from './App'

import {
	router,
	RouterMount
} from '@/public/router' // 导航路由
import store from '@/public/store'; //状态管理
import httpInterceptor from '@/public/request/http.interceptor'; // http拦截器，将此部分放在new Vue()和app.$mount()之间，才能App.vue中正常使用
import httpApi from '@/public/request/http.api' // http接口API集中管理引入部分
import '@/public'; //其他入口文件


Vue.config.productionTip = false
App.mpType = 'app'

const app = new Vue({
	store,
	...App
})

Vue.use(httpInterceptor, app);
Vue.use(httpApi, app);

// v1.3.5起 H5端 你应该去除原有的app.$mount();使用路由自带的渲染方式
// #ifdef H5
RouterMount(app, router, '#app')
// #endif

// #ifndef H5
app.$mount(); //为了兼容小程序及app端必须这样写才有效果
// #endif
  