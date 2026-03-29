import { hiprint } from "vue-plugin-hiprint";
const templateMap = {};
export function newHiprintPrintTemplate(key, options) {
  // 先清理旧模板，避免内存泄露
  if (templateMap[key]) {
    try { templateMap[key].clear && templateMap[key].clear(); } catch (e) { /* ignore */ }
    delete templateMap[key];
  }
  let template = new hiprint.PrintTemplate(options);
  templateMap[key] = template;
  return template;
}
export function getHiprintPrintTemplate(key) {
  return templateMap[key];
}
export function removeHiprintPrintTemplate(key) {
  if (templateMap[key]) {
    try { templateMap[key].clear && templateMap[key].clear(); } catch (e) { /* ignore */ }
    delete templateMap[key];
  }
}
