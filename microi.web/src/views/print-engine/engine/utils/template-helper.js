import { hiprint } from "vue-plugin-hiprint";
const templateMap = {};
export function newHiprintPrintTemplate(key, options) {
  let template = new hiprint.PrintTemplate(options);
  templateMap[key] = template;
  return template;
}
export function getHiprintPrintTemplate(key) {
  return templateMap[key];
}
