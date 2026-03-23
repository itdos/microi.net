export const calendar = {
  type: 'calendar',
  label: '日历',
  category: 0, //0 内置组件,1 自定义组件
  show: 1, //是否展示 0隐藏,1展示
  icon: '', // elementplus
  img: '',  //图片图标
  widgetOption: {
    height: 280, //高度
  },
  widgetParams: [{
    sort: 0,
    label: '数据来源', //属性名称
    type: 'textarea', //表单组件类型(input,textarea,number,color,select,switch,slider)
    value: '', //表单组件内容
    typeOptions: {
      rows: 3, //表单组件设置,多行文本框默认3行
      dataJson: [
        {
          date: '2024-12-01',
          content:
            '12月事件01',
        },
        {
          date: '2024-12-10',
          content:
            '12月事件02',
        },
      ]
    },
  }]
}