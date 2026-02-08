import formDesigner from './form-designer/index.vue'
import formRenderer from './form-renderer/index.vue'
import { EventBus } from '../utils/eventBus.js'
import { usePageEngineStore } from '../stores/pageEngine.js'
// 按需引入
export { formDesigner, formRenderer, EventBus, usePageEngineStore };
const component = [formDesigner, formRenderer, EventBus, usePageEngineStore];

const install = function (App) {
  component.forEach((item) => {
    App.component(item.name, item);
  });
}
export default { install }
