import Vue from 'vue'
import Vuex from 'vuex'
import getters from './getters'

Vue.use(Vuex)

// https://webpack.js.org/guides/dependency-management/#requirecontext
const modulesFiles = require.context('./modules', true, /\.js$/)

// you do not need `import app from './modules/app'`
// it will auto require all vuex module from modules file
const modules = modulesFiles.keys().reduce((modules, modulePath) => {
	// set './app.js' => 'app'
	const moduleName = modulePath.replace(/^\.\/(.*)\.\w+$/, '$1')
	const value = modulesFiles(modulePath)
	modules[moduleName] = value.default
	return modules
}, {})

//注意：发布前，一定要将DiyStore的来源修改为from 'microi.net',平时开发测试可以require('../views/diy/store/diy.store')   -----by itdos 
// const tValue = require('../views/diy/store/diy.store')
// modules['DiyStore'] = tValue.default;
// import { DiyStore } from 'microi.net'
// modules['DiyStore'] = DiyStore;
import { DiyStore } from '@/utils/microi.net.import'
modules['DiyStore'] = DiyStore;


const store = new Vuex.Store({
	modules,
	getters,
 
	// DiyChat 暂时不需要的
	state: {
		user: window.localStorage.getItem('user'), token: window.localStorage.getItem('token'), //登录标识
		onlineStatus: { status: 'online', text: '在线' }, //用户在线状态   【 online：在线、  offline：离开、 busy：忙碌、 invisible：隐身】
	},
	mutations: {
		// 将token存储到sessionStorage
		SET_TOKEN(state, data) {
			state.token = data; window.localStorage.setItem('token', data);
		},
		// 获取用户名
		SET_USER(state, data) {
			state.user = data; window.localStorage.setItem('user', data);
		},
		// 退出
		LOGOUT(state) {
			state.user = null; state.token = null;
			window.localStorage.removeItem('user'); window.localStorage.removeItem('token');
		},
	},
	//-----end
})

export default store