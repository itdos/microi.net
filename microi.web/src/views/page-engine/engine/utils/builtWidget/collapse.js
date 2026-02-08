export const collapse = {
  type: 'collapse',
  label: '折叠面板',
  category: 0, //0 内置组件,1 自定义组件
  show: 1, //是否展示 0隐藏,1展示
  icon: '', // elementplus
  img: '',  //图片图标
  widgetOption: {
    height: 210, //高度
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
            title: '版本号:v3.16.20',
            content: '表单引擎、模块引擎新增V8代码加密传输功能，但这导致必须要在sy...',
          },
          {
            title: '版本号:v3.17.1',
            content:
              '表单引擎、模块引擎新增V8代码加密传输功能，【必须】手动去数据库管理工具给【diy_field】表新增字段：【AppVisible、bit、可为空】。然后去【表单引擎】—&gt;【diy_field】...',
          },
          {
            title: '版本号:v4.0.0',
            content:
              '表单引擎、模块引擎新增V8代码加密传输功能，Microi v4.0microi v3.x版本已应用数百套产品，因此仍然长期持续维护，新增v4分支Vue2升级为Vue3.NET6升级到.NET8node14升级...',
          },
        ]
      },
    },
    {
      sort: 1,
      label: '内容边距',
      type: 'input',
      value: '10px',

    },
    {
      sort: 2,
      label: '内容字号',
      type: 'input',
      value: '12px',

    },
    {
      sort: 3,
      label: '字体颜色',
      type: 'color',
      value: '',

    },
  ],
}