export const links = {
  type: 'links', //组件类型
  label: '快捷导航', //组件名称
  category: 0, //0 内置组件,1 自定义组件
  show: 1, //是否展示 0隐藏,1展示
  icon: '', // elementplus
  img: '',  //图片图标
  widgetOption: {
    height: 250, //高度
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
            title: '会员中心',
            iconUrl: new URL('../../assets/demo/会员中心.png', import.meta.url).href,
            linkUrl: '/',
          },
          {
            title: '投诉建议',
            iconUrl: new URL('../../assets/demo/投诉建议.png', import.meta.url).href,
            linkUrl: '/',
          },
          {
            title: '问卷调查',
            iconUrl: new URL('../../assets/demo/问卷调查.png', import.meta.url).href,
            linkUrl: '/',
          },
          {
            title: '资料打印',
            iconUrl: new URL('../../assets/demo/资料打印.png', import.meta.url).href,
            linkUrl: '/',
          },

          {
            title: '待我审批',
            iconUrl: new URL('../../assets/demo/待我审批.png', import.meta.url).href,
            linkUrl: '/',
          },
          {
            title: '我的收藏',
            iconUrl: new URL('../../assets/demo/我的收藏.png', import.meta.url).href,
            linkUrl: '/',
          },
          {
            title: '资料下载',
            iconUrl: new URL('../../assets/demo/资料下载.png', import.meta.url).href,
            linkUrl: '/',
          },
          {
            title: '我的卡包',
            iconUrl: new URL('../../assets/demo/我的卡包.png', import.meta.url).href,
            linkUrl: '/',
          },
        ]
      },
    },
    {
      sort: 1,
      label: '栅格宽度',
      type: 'slider',
      value: 6,
      typeOptions: {
        min: 1,
        max: 24,
        step: 1,
      },
    },
    {
      sort: 2,
      label: '背景颜色',
      type: 'color',
      value: '',

    },
    {
      sort: 3,
      label: '栅格边距',
      type: 'input',
      value: '5px',

    },
    {
      sort: 4,
      label: '标题字号',
      type: 'input',
      value: '13px',

    },
    {
      sort: 5,
      label: '标题字宽',
      type: 'input',
      value: '400',

    },
    {
      sort: 6,
      label: '标题颜色',
      type: 'color',
      value: '',

    },
    {
      sort: 7,
      label: '标题边距',
      type: 'input',
      value: '5px 0px 10px 0',

    },
    {
      sort: 8,
      label: '图标宽度',
      type: 'input',
      value: '60px',

    },
    {
      sort: 9,
      label: '图标高度',
      type: 'input',
      value: '60px',

    },
  ]
}