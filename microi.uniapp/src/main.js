import { createSSRApp } from 'vue'
import App from './App.vue'
import shareMixin from './utils/share'
import { V8, initializeLoginNavigation } from './utils/request.js'

export function createApp() {
  const app = createSSRApp(App)
  initializeLoginNavigation()
  app.mixin(shareMixin)
  V8.install(app)
  return { app }
}
