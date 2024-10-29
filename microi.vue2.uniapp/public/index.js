import Vue from 'vue'
import uView from 'uview-ui'; // 引入全局uView

import {
	router
} from './router' // 导航路由

import config from './config' //相关配置
import util from './util' //工具类
// import jWeixin from 'weixin-js-sdk'; //微信jssdk
import mixin from './mixin'; // 全局混入
import qs from 'qs'

let vuexStore = require('./store/$u.mixin.js'); // 引入uView提供的对vuex的简写法文件
Object.keys(util).forEach(key => Vue.filter(key, util[key])); //过滤器

Vue.prototype.$qs = qs
Vue.prototype.$util = util
Vue.prototype.$config = config

Vue.prototype.$apiHost = config.apiHost
// Vue.prototype.$jWeixin = jWeixin

Vue.use(router);
Vue.use(uView);
Vue.use(mixin);

Vue.mixin(vuexStore);