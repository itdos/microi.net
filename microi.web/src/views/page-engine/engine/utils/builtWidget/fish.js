export const fish = {
  type: 'fish',
  label: '鱼骨图',
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
            label: '人',
            router: '/',
            children: [
              {
                label: '管理缺陷',
                router: '/',
              },
              {
                label: '技能缺陷',
                router: '/',
              },
            ],
          },
          {
            label: '机',
            router: '/',
            children: [
              {
                label: '机器维修',
                router: '/',
              },
              {
                label: '机器管理',
                router: '/',
              },
            ],
          },
          {
            label: '料',
            router: '/',
            children: [
              {
                label: '物料采购',
                router: '/',
              },
              {
                label: '无聊加工',
                router: '/',
              },
            ],
          },
          {
            label: '法',
            router: '/',
            children: [
              {
                label: '施工规则',
                router: '/',
              },
              {
                label: '行为准则',
                router: '/',
              },
            ],
          },
          {
            label: '环',
            router: '/',
            children: [
              {
                label: '操作法则',
                router: '/',
              },
              {
                label: '标准准则',
                router: '/',
              },
            ],
          },
          {
            label: '测',
            router: '/',
            children: [
              {
                label: '单元测试',
                router: '/',
              },
              {
                label: '集成测试',
                router: '/',
              },
            ],
          },
        ]
      },
    },
    {
      sort: 1,
      label: '主干宽度',
      type: 'input',
      value: '100%',
    },
    {
      sort: 2,
      label: '主干颜色',
      type: 'color',
      value: '#409EFF',
    },
    {
      sort: 3,
      label: '主干高度',
      type: 'input',
      value: '6px',
    },
    {
      sort: 4,
      label: '主刺边框',
      type: 'input',
      value: '4px solid #409eff',
    },
    {
      sort: 5,
      label: '主刺外边距',
      type: 'input',
      value: '0 20px',
    },
    {
      sort: 6,
      label: '主刺内边距',
      type: 'input',
      value: '0 10px 0 0',
    },
    {
      sort: 7,
      label: '主刺标签上',
      type: 'input',
      value: '-28px',
    },
    {
      sort: 8,
      label: '主刺标签下',
      type: 'input',
      value: '-28px',
    },
    {
      sort: 9,
      label: '主刺字号',
      type: 'input',
      value: '13px',
    },
    {
      sort: 10,
      label: '主刺字颜色',
      type: 'color',
      value: '#409EFF',
    },
    {
      sort: 11,
      label: '主刺字右移',
      type: 'input',
      value: '-25px',
    },
    {
      sort: 12,
      label: '主刺字宽',
      type: 'input',
      value: 'bold',
    },
    {
      sort: 13,
      label: '副刺边框',
      type: 'input',
      value: '4px solid #409eff',
    },
    {
      sort: 14,
      label: '副刺字号',
      type: 'input',
      value: '12px',
    },
    {
      sort: 15,
      label: '副刺字颜色',
      type: 'color',
      value: '#409EFF',
    },
    {
      sort: 16,
      label: '副刺外边距',
      type: 'input',
      value: '6px auto',
    },
    {
      sort: 17,
      label: '主刺字宽',
      type: 'input',
      value: '',
    },
  ]
}