export const browser = {
  type: 'browser',
  label: '浏览器',
  category: 0, //0 内置组件,1 自定义组件
  show: 1, //是否展示 0隐藏,1展示
  icon: '', // elementplus
  img: '',  //图片图标
  widgetOption: {
    height: 280, //高度
  },
  widgetParams: [{
    sort: 0,
    label: '网址',
    type: 'input',
    value: 'https://microi.net',
  }]
}