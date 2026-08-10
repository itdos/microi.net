import { createApp, nextTick } from 'vue'
import App from './App.vue'
import { notifyInteraction, notifyReady } from './platform/host'
import './styles/tokens.css'
import './styles/app.css'

const app = createApp(App)
app.mount('#app')

document.addEventListener('pointerdown', notifyInteraction, true)
document.addEventListener('click', notifyInteraction, true)

void nextTick(() => {
  requestAnimationFrame(() => notifyReady())
})
