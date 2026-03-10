/**
 * go-view 初始化设置
 * 在 microi.web 中注册 go-view 所需的 NaiveUI 组件和插件
 * 仅在第一次加载 go-view 页面时执行
 */
import { createPinia } from 'pinia'
import { setupNaive } from './src/plugins/naive'
import { setupCustomComponents } from './src/plugins/customComponents'
import { setupDirectives } from './src/plugins/directives'
import { setHtmlTheme } from '@goview/utils'
import 'iconify-icon'
import { addCollection } from 'iconify-icon'
// 标尺样式
import 'vue3-sketch-ruler/lib/style.css'
// 动画库
import 'animate.css/animate.min.css'

let initialized = false

export function setupGoView(app) {
  if (initialized) return
  initialized = true

  // 注册 NaiveUI 全局组件
  setupNaive(app)

  // 注册自定义组件（GoSkeleton, GoLoading, SketchRule）
  setupCustomComponents(app)

  // 注册指令（vue3-lazyload）
  setupDirectives(app)

  // 设置暗色主题
  setHtmlTheme()

  // 注册图标集（按需加载独立包，避免引入 409MB 的 @iconify/json）
  try {
    import('@iconify-json/uim/icons.json').then(m => addCollection(m.default))
    import('@iconify-json/line-md/icons.json').then(m => addCollection(m.default))
    import('@iconify-json/wi/icons.json').then(m => addCollection(m.default))
  } catch (e) {
    console.warn('go-view: iconify icons not loaded', e)
  }

  // 挂载 $vue 引用（go-view 内部需要通过 window.$vue 注册动态组件）
  window['$vue'] = app

  // 国际化兼容
  if (!window['$t']) {
    window['$t'] = (key) => key
  }

  // 捕获未处理的 Promise 异常（go-view 内部依赖）
  window.addEventListener('unhandledrejection', event => {
    console.warn(`[go-view] UNHANDLED PROMISE REJECTION:`, event.reason)
  })

  console.log('[go-view] setup completed')
}
