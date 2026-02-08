import { formData, formConfig, wrapperList, } from './formjson'
//自动生成编号
export const generateId = function () {
  return Math.floor(Math.random() * 100000 + Math.random() * 20000 + Math.random() * 5000);
};

//深拷贝
export const deepClone = function (origin) {
  if (origin === undefined) {
    return undefined
  }
  return JSON.parse(JSON.stringify(origin))
}

//浅拷贝
export const overwriteObj = function (obj1, obj2) {
  Object.keys(obj2).forEach(prop => {
    obj1[prop] = obj2[prop]
  })
}

//判断对象是否为空
export const isEmpty = function (obj) {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}
//格式化日期
export function formatDate(paramdate, format = '{y}-{m}-{d}') {
  const date = new Date(paramdate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，需要加1
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  // 支持不同的格式化模式
  let formattedDate = format
    .replace('{y}', year)
    .replace('{m}', month)
    .replace('{d}', day)
    .replace('{h}', hour)
    .replace('{i}', minute);

  return formattedDate
}

//构建默认页面数据
export function buildDefaultJsonObj() {
  let resultFormData = {
    "formConfig": {
      "gutter": 0,
      "mask": true,
      "drag": true,
      "left": true,
      "hover": true,
      "shadow": true,
      "link": false,
      "watermark": false,
      "watermarkStyle": {
        "content": "Microi吾码",
        "font": {
          "fontSize": 16,
          "color": "rgba(255, 0, 0, 0.15)"
        },
        "rotate": -22
      },
      "dynamicStyle": {
        "padding": "10px",
        "backgroundColor": "",
        "opacity": 1
      }
    },
    "wrapperList": []
  };
  return resultFormData
}

//构建默认页面数据
export function buildDefaultFormJson() {
  let resultFormData = deepClone(formData)
  resultFormData.JsonObj.formConfig = deepClone(formConfig)
  let newId = generateId()
  resultFormData.Id = newId //创建一个页面主键
  resultFormData.Number = 'page_' + newId //创建一个页面编号
  return resultFormData
}

//构建默认容器数据
export function buildDefaultWrapperJson(wrapperIdx) {
  let resultWrapperData = deepClone(wrapperList[wrapperIdx])
  // resultWrapperData.wrapperOption = deepClone(wrapperOption)
  let newId = generateId()
  resultWrapperData.wrapperOption.number = newId //创建一个容器编号
  return resultWrapperData
}

//构建默认组件数据
export function buildDefaultWidgetJson(wrapperNumber, widgetTemp) {
  let resultWidgetData = deepClone(widgetTemp)
  // resultWidgetData.widgetOption = deepClone(widgetOption)
  let newId = generateId()
  resultWidgetData.widgetOption.number = newId //创建一个组件编号
  resultWidgetData.widgetOption.wrapperNumber = wrapperNumber //获取容器编号
  return resultWidgetData
}

//多级对象通过[xxx.yyy.zzz]方式获取对应层级值
export function getNestedValue(obj, path) {
  if (!path || !obj) return null
  const keys = path.split('.')
  let reuslt = keys.reduce(
    (acc, key) => (acc && acc[key] !== undefined ? acc[key] : null),
    obj
  )
  return reuslt
}
//多级对象通过[xxx.yyy.zzz]方式获取对应层级值
export function setNestedValue(obj, path, value) {
  if (!path || !obj) return
  const keys = path.split('.')
  const lastKey = keys.pop()
  let currentObj = keys.reduce(
    (acc, key) =>
      acc && acc[key] !== undefined ? acc[key] : (acc[key] = {}),
    obj
  )
  currentObj[lastKey] = value
}

/**
 * 将 HTML 字符串转义为安全的字符串
 * @param {string} str - 原始 HTML 字符串
 * @returns {string} - 转义后的字符串
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 将转义后的字符串还原为原始的 HTML 字符串
 * @param {string} str - 转义后的字符串
 * @returns {string} - 原始 HTML 字符串
 */
export function unescapeHtml(str) {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}