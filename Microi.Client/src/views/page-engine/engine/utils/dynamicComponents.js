/**
 * 动态注册组件
 * utils/dynamicComponents.js
 */

import { defineAsyncComponent } from 'vue';
function loadComponentsFromFolder(folderPath) {
  const components = {};
  let modules = import.meta.glob('../components/form-designer/widget/*.vue', { eager: false });
  if (folderPath == 'widgetArrt') {
    modules = import.meta.glob('../components/form-designer/widget/widget-attr/*.vue', { eager: false });
  }
  for (const path in modules) {
    const componentName = path.match(/\/([^/]+)\.vue$/)[1];
    components[componentName] = defineAsyncComponent(modules[path]);
  }
  return components;
}
export default loadComponentsFromFolder;