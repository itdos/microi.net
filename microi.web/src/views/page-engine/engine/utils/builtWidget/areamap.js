export const areamap = {
  type: 'areamap',
  label: '区域地图',
  category: 0, //0 内置组件,1 自定义组件
  show: 1, //是否展示 0隐藏,1展示
  icon: '', // elementplus
  img: '',  //图片图标 
  widgetOption: {
    height: 280, //高度
  },
  widgetParams: [
    {
      sort: 0,
      label: '数据来源', //属性名称
      type: 'textarea', //表单组件类型(input,textarea,number,color,select,switch,slider)
      value: '', //表单组件内容
      typeOptions: {
        rows: 3, //表单组件设置,多行文本框默认3行
        dataJson: [
          {
            name: '杭州市',
            value: 74,
            path: '/test'
          },
          {
            name: '宁波市',
            value: 3,
          },
          {
            name: '温州市',
            value: 82,
          },
          {
            name: '嘉兴市',
            value: 23,
          },
          {
            name: '湖州市',
            value: 92,
          },
          {
            name: '绍兴市',
            value: 59,
          },
          {
            name: '金华市',
            value: 4,
          },
          {
            name: '衢州市',
            value: 28,
          },
          {
            name: '舟山市',
            value: 6,
          },
          {
            name: '台州市',
            value: 13,
          },
          {
            name: '丽水市',
            value: 78,
          },
        ]
      }
    }, {
      sort: 1,
      label: '省编号',
      type: 'input',
      value: '330000',
    },
    {
      sort: 2,
      label: '是否下钻',
      type: 'switch',
      value: true,
    }, {
      sort: 3,
      label: 'tooltip',
      type: 'input',
      value: '统计值',
    }, {
      sort: 4,
      label: '最小值',
      type: 'number',
      value: 0,
    }, {
      sort: 5,
      label: '最大值',
      type: 'number',
      value: 100,
    }, {
      sort: 6,
      label: '块颜色组',
      type: 'input',
      value: '#F5F67A, #E6B6E6, #BDD7BE, #F3CCBB, #F0938C',
    }, {
      sort: 7,
      label: '字体颜色',
      type: 'color',
      value: '#ffffff',
    }, {
      sort: 8,
      label: '字体大小',
      type: 'number',
      value: 14,
    }, {
      sort: 9,
      label: '模拟数据',
      type: 'switch',
      value: false
    },
    {
      sort: 10,
      label: 'geoJson',
      type: 'input',
      value: 'https://www.nbweixin.cn/autopage/mapjson'
    },
    {
      sort: 11,
      label: '回调接口',
      type: 'input',
      value: '',
    },
    {
      sort: 12,
      label: '路由地址',
      type: 'input',
      value: '/',
    },
    {
      sort: 13,
      label: '市编号',
      type: 'input',
      value: '330000',
    },
  ],
}