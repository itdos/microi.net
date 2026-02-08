import printDesigner from './print-designer.vue'
import { EventBus } from '../utils/eventBus.js'
import { usePrintEngineStore } from '../stores/printEngine.js'

// 按需引入
export { printDesigner, EventBus, usePrintEngineStore };
const component = [printDesigner, EventBus, usePrintEngineStore];

const install = function (App) {

  component.forEach((item) => {
    App.component(item.name, item);
  });
}
export default { install }
