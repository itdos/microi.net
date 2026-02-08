/**
 * 界面引擎本地入口文件
 * 替代原先的 npm 包 microi-pageengine
 * 导出: formDesigner, formRenderer, EventBus, usePageEngineStore
 */
import formDesigner from './engine/components/form-designer/index.vue'
import formRenderer from './engine/components/form-renderer/index.vue'
import { EventBus } from './engine/utils/eventBus.js'
import { usePageEngineStore } from './engine/stores/pageEngine.js'

export { formDesigner, formRenderer, EventBus, usePageEngineStore }

export default { formDesigner, formRenderer, EventBus, usePageEngineStore }
