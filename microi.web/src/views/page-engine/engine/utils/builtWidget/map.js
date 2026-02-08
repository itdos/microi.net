export const map = {
  type: 'map',
  label: '地图',
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
      dataJson: [{
        id: '1',
        title: '标题1',
        position: '121.553524,29.870657',
        icon: '',
        content: ``
      },
      {
        id: '2',
        title: '标题2',
        position: '121.52909,29.8565',
        icon: 'https://www.nbweixin.cn/autopage/location.png',
        content: ''
      },
      ]
    },
  },
  {
    sort: 1,
    label: '中心点位置',
    type: 'input',
    value: '121.592474,29.855748',
  },
  {
    sort: 2,
    label: '地图级别',
    type: 'number',
    value: 11,
  },
  {
    sort: 3,
    label: '缩放工具',
    type: 'switch',
    value: true,

  },
  {
    sort: 4,
    label: '比例尺',
    type: 'switch',
    value: true,

  },
  {
    sort: 5,
    label: '鹰眼',
    type: 'switch',
    value: false,

  },
  {
    sort: 6,
    label: '地图类型',
    type: 'switch',
    value: false,

  },
  {
    sort: 7,
    label: '当前定位',
    type: 'switch',
    value: false,
  },
  {
    sort: 8,
    label: '显示标题',
    type: 'switch',
    value: true,
  },
  ]
}