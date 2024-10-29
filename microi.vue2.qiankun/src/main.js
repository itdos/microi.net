import Vue from 'vue'

import Cookies from 'js-cookie'

import 'normalize.css/normalize.css' // a modern alternative to CSS resets

import Element from 'element-ui'
import './styles/element-variables.scss'
import enLang from 'element-ui/lib/locale/lang/en'// 如果使用中文语言包请默认支持，无需额外引入，请删除该依赖

import '@/styles/index.scss' // global css

import App from './App'
import store from './store'
import router from './router'

import './icons' // icon
import './permission' // permission control
import './utils/error-log' // error log

import * as filters from './filters' // global filters

/**
 * If you don't want to use mock-server
 * you want to use MockJs for mock api
 * you can execute: mockXHR()
 *
 * Currently MockJs will be used in the production environment,
 * please remove it before going online ! ! !
 */
// if (process.env.NODE_ENV === 'production') {
//   const { mockXHR } = require('../mock')
//   mockXHR()
// }

Vue.use(Element, {
  size: Cookies.get('size') || 'medium', // set element-ui default size
  locale: enLang // 如果使用中文，无需设置，请删除
})

// register global utility filters
Object.keys(filters).forEach(key => {
  Vue.filter(key, filters[key])
})

Vue.config.productionTip = false

//-------microi.net
import '../public/static/css/fontawesome/css/all.min.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.min'

import '@/styles/microi.service.framework.scss'

import { DosCommon } from 'microi.net'
Vue.prototype.DosCommon = DosCommon

import { DiyCommon } from 'microi.net'
Vue.prototype.DiyCommon = DiyCommon;

import { DiyApi } from 'microi.net'
Vue.prototype.DiyApi = DiyApi

import $ from 'jquery'
window.$ = window.jQuery = window.jquery = require("jquery");

// DiyCommon.SetApiBase('https://api.chinaseagull.com');
// DiyCommon.SetOsClient('Haiou');
// DiyCommon.SetApiBase('https://api-china.itdos.com');
// DiyCommon.SetOsClient('iTdos');
// DiyCommon.SetApiBase('https://localhost:7268');
DiyCommon.SetApiBase('https://api-zl.nbcmc.cn');
DiyCommon.SetOsClient('nbcmc');

import i18n from './lang'
//-------end

window.microi_vue = new Vue({
  el: '#app',
  router,
  store,
  i18n,
  render: h => h(App)
})
//若i18n的$t报错，请使用microi_vue.$t
Vue.prototype.microi_vue = microi_vue;
// debugger;

//2023-06-17：已知问题：如果从 microi.service 引用，目前暂未发现问题，之前有发现过问题没从microi.service中引用，但现在没出现了 ：（
import microiService from 'microi.service'
const { bootstrap, mount, unmount } = microiService.microiRegister()

//2023-06-17：已知问题：如果从 源码中 引用，会出现主服务加载微服务.js资源时未从微服务的域名前缀获取，导致微服务无法打法，直接跳转到首页。
// import { microiRegister } from './microi.service/main-micro'
// const { bootstrap, mount, unmount } = microiRegister()

export { bootstrap, mount, unmount }
