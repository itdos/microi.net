import {
  workbench,
  progress,
  links,
  carousel,
  statistic,
  tabel,
  calendar,
  collapse,
  image,
  video,
  steps,
  timeline,
  browser,
  line,
  bar,
  pie,
  map,
  funnel,
  linebar,
  gantt,
  fish,
  webgl,
  office,
  areamap,
  fullcalendar,
  html,
  descriptions
} from './builtWidget/index.js';


/**
 * 内置组件
 * utils/builtWidget.js
 * 组件列表 ## 三级 
 */
export const widgetList = [
  workbench,
  progress,
  links,
  carousel,
  statistic,
  tabel,
  calendar,
  collapse,
  image,
  video,
  steps,
  timeline,
  browser,
  line,
  bar,
  pie,
  map,
  funnel,
  linebar,
  gantt,
  fish,
  webgl,
  office,
  areamap,
  fullcalendar,
  html,
  descriptions
]

//组件配置 四级
export const widgetOption = {
  number: '',//组件编号
  wrapperNumber: '',//容器编号
  span: 24, //占位(栅格)
  offset: 0, //栅格左侧的间隔格数
  push: 0, //栅格向右移动格数
  pull: 0, //栅格向左移动格数
  height: 210,
  marginTop: 0, //上移
  dynamicStyle: {
    padding: '8px', //内边距
    backgroundColor: '',//背景色,默认透明 transparent
  },
}

//遍历组装组件列表 
for (let i = 0, len = widgetList.length; i < len; i++) {
  const item = widgetList[i]
  const tempHeight = item.widgetOption.height
  item.widgetOption = {
    ...widgetOption,
    ...item.widgetOption
  }
  item.widgetOption.height = tempHeight || 210

}
