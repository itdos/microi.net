import Vue from 'vue'
import App from './App'
import store from '@/store';
import uView from "uview-ui";
import miToast from 'components/mi-toast.vue'
import './utils/filters.js'
Vue.use(uView);
Vue.config.productionTip = false
let vuexStore = require("@/store/$u.mixin.js");
Vue.mixin(vuexStore);
Vue.component('mi-toast', miToast)

import { wxAuthorize } from 'utils/wxauth.js'
Vue.prototype.wxOauth = wxAuthorize

import jwx from '@/utils/jwx.js'
Vue.prototype.$jwx = jwx

App.mpType = 'app'

const app = new Vue({
	store,
	...App
})


// http拦截器，将此部分放在new Vue()和app.$mount()之间，才能App.vue中正常使用
import httpInterceptor from '@/common/http.interceptor.js'
Vue.use(httpInterceptor, app)

// http接口API集中管理引入部分
import httpApi from '@/common/http.api.js'
Vue.use(httpApi, app)

app.$mount()
