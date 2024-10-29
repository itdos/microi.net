import { createSSRApp } from 'vue'
import TnIcon from '@tuniao/tnui-vue3-uniapp/components/icon/src/icon.vue'
import TnButton from '@tuniao/tnui-vue3-uniapp/components/button/src/button.vue'
import App from './App.vue'
// import * as Pinia from 'pinia';
import { Microi } from "./config/microi.uniapp.js"
// import './router'
import './static/style/index.scss'

export function createApp() {
  const app = createSSRApp(App)
	// app.use(Pinia.createPinia());
  app.component('TnIcon', TnIcon)
  app.component('TnButton', TnButton)
	app.provide('Microi', Microi);  // 注入Microi实例

	// const Microi = inject('Microi'); // 使用注入Microi实例
  return {
    app,
  }
}
