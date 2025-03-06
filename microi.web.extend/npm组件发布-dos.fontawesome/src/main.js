import Vue from 'vue'
// 直接引用
import Element from 'element-ui';

// 按需引用
// import {
//   Button
// } from 'element-ui';

// 样式文件
import 'element-ui/lib/theme-chalk/index.css';

// import '@fortawesome/fontawesome-free/css/all.css'
// import '@fortawesome/fontawesome-free/js/all.js'

// 直接引用
Vue.use(Element, { size: 'small' });
// 按需引用
// Vue.use(Button)

import App from './App.vue'

new Vue({
  el: '#app',
  render: h => h(App)
})
