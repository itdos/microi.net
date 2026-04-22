import { createSSRApp } from 'vue'
import App from './App.vue'
import shareMixin from './utils/share'

export function createApp() {
  const app = createSSRApp(App)
  app.mixin(shareMixin)
  return { app }
}
