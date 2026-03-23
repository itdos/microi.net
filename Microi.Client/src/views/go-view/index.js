/**
 * go-view 大屏可视化集成入口
 * 参考 page-engine 的集成模式
 * 导出: GoViewEditor, GoViewPreview, setupGoView
 */
import GoViewEditor from './editor.vue'
import GoViewPreview from './preview.vue'
import { setupGoView } from './setup.js'

export { GoViewEditor, GoViewPreview, setupGoView }

export default { GoViewEditor, GoViewPreview, setupGoView }
