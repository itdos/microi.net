import Vue from 'vue'
import VueRouter from 'vue-router'
import App from '@/App.vue'
import store from '@/store'
import {constantRoutes,asyncRoutes} from '@/router'
Vue.use(VueRouter)

const __qiankun__ = window.__POWERED_BY_QIANKUN__
let router = null;
let instance = null

const microiRegister = () => {
  return {
    async bootstrap(props = {}) {
      Vue.prototype.$MicroBootstrap = props
    },
    async mount(props) {
      Vue.prototype.$MicroMount = props
      render(props)
    },
    async unmount() {
      instance.$destroy()
      instance.$el.innerHTML = ''
      instance = null
    },
    async update(props) {
      console.log('update props', props)
    }
  }
}

//-----
// import VueI18n from 'vue-i18n'
// Vue.use(VueI18n)
// const messages = {
//   cn:{}
// };
// const i18n = new VueI18n({
//   locale: 'cn',
//   // set locale messages
//   messages,
//   silentTranslationWarn: true// 去掉i18n 警告  by itdos
// })
import i18n from '../lang/index' // internationalization
//-----

const render = ({ name, container } = {}) => {
  console.log(name,container)
  Vue.config.productionTip = false
  let routerAll=[]
  if (asyncRoutes != undefined || asyncRoutes != null) {
    routerAll = constantRoutes.concat(asyncRoutes)
  } else {
    routerAll=constantRoutes
  }
  router = new VueRouter({
    scrollBehavior: () => ({ y: 0 }),
    base: __qiankun__ ? name : "/",
    mode: 'hash', // require service support
    routes: routerAll
  })
  console.log(router)
  instance = new Vue({
    router,
    store,
    i18n,
    render: h => h(App)
  }).$mount(container ? container.querySelector('#app') : '#app')
}
__qiankun__ || render()
export { microiRegister, render }
