import App from './App'
import store from './store'
import { Microi, MicroiStore, V8 } from './config/microi.uniapp'
import tabBar from './pages/naviBar/tabBar' // 底部导航栏
import UniAutoComplete from '@/components/uni-auto-complete'
import { preloadAllResources } from './utils/preload' // 导入预加载工具
// import Vconsole from 'vconsole'
// let vConsole = new Vconsole()
// #ifndef VUE3
import Vue from 'vue'

Vue.config.performance = false;
Vue.config.productionTip = false
Vue.prototype.$store = store
Vue.prototype.$adpid = "1111111111"
Vue.prototype.$backgroundAudioData = {
	playing: false,
	playTime: 0,
	formatedPlayTime: '00:00:00'
}
Vue.prototype.Microi = Microi;
Vue.prototype.V8 = V8;
Vue.prototype.$MicroiStore = MicroiStore;
Vue.component('tab-bar', tabBar) // 全局注入底部导航栏
Vue.use(UniAutoComplete)
App.mpType = 'app'
const app = new Vue({
	store,
	MicroiStore,
	...App
})
app.$mount()
// #endif

// #ifdef VUE3
import {
	createSSRApp
} from 'vue'
export function createApp() {
	const app = createSSRApp(App)
	app.use(store)
	app.use(UniAutoComplete)
	app.provide('Microi', Microi);  // 注入Microi实例
	app.provide('V8', V8);  // 注入Microi实例
	app.component('tab-bar', tabBar) // 全局注入底部导航栏
	// app.config.globalProperties.Microi = Microi
	app.config.globalProperties.$MicroiStore = MicroiStore
	app.config.globalProperties.$adpid = "1111111111"
	app.config.performance = false;
	app.config.globalProperties.$backgroundAudioData = {
		playing: false,
		playTime: 0,
		formatedPlayTime: '00:00:00'
	}
	// 添加这行代码，提前预加载资源
	setTimeout(() => preloadAllResources(Microi), 100);
	
	return {
		app
	}
}
// #endif