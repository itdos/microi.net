/**

*/

import App from './App'
import store from './store'

import Vue from 'vue'
Vue.config.productionTip = false
App.mpType = 'app'

// 引入全局TuniaoUI
import TuniaoUI from 'tuniao-ui'
Vue.use(TuniaoUI)

// 引入TuniaoUI提供的vuex简写方法
let vuexStore = require('@/store/$t.mixin.js')
Vue.mixin(vuexStore)

// let microiStore = require('@/common/microi.uniapp.js')
// Vue.mixin(microiStore)

// 引入TuniaoUI对小程序分享的mixin封装
let mpShare = require('tuniao-ui/libs/mixin/mpShare.js')
Vue.mixin(mpShare)

// 引入Microi相关 -------START
import { Microi, MicroiStore } from "@/common/microi.uniapp.js"
Vue.prototype.Microi = Microi;
Vue.prototype.$MicroiStore = MicroiStore;
!Microi.ConsoleLog || console.log('Microi：main.js vue2')
// 引入Microi相关 -------END

const app = new Vue({
  store,
  MicroiStore,
  ...App
})

app.$mount()