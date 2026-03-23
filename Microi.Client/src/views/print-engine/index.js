// 打印引擎本地入口文件（替代 npm 包 microi-printengine）
import printDesigner from './engine/components/print-designer.vue'
import printDoprint from './engine/components/print-doprint.vue'
import printPreview from './engine/components/print-doprint.vue'
import { EventBus } from './engine/utils/eventBus.js'
import { usePrintEngineStore } from './engine/stores/printEngine.js'

// 导入全局样式
import './engine/style.css'

// 初始化 hiprint 插件（取消自动连接）
import { hiPrintPlugin } from 'vue-plugin-hiprint'
hiPrintPlugin.disAutoConnect()

export { printDesigner, printDoprint, printPreview, EventBus, usePrintEngineStore }
