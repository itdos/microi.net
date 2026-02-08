export const steps = {
  type: 'steps',
  label: '步骤',
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
        dataJson: {
          activeIndex: 0,
          stepArr: [
            {
              title: '项目启动进场',
              description: '计划开始',
              timestamp: '2024-10-13',
              icon: 'Position',
              status: 'success',
              subdata: [
                {
                  id: '001001',
                  content: '收入合同(1笔)',
                  timestamp: '',
                  color: '#0bbd87',
                  router: '/',
                },
                {
                  id: '001002',
                  content: '支出合同(1笔)',
                  timestamp: '',
                  color: '#0bbd87',
                  router: '/',
                },
                {
                  id: '001003',
                  content: '销售订单(2笔)',
                  timestamp: '',
                  color: '#0bbd87',
                  router: '/',
                },
                {
                  id: '001004',
                  content: '断货(2笔)',
                  timestamp: '',
                  color: '#F56C6C',
                  router: '/',
                },
              ],
            },
            {
              title: '实施调研',
              description: '按时完成',
              timestamp: '2024-10-14',
              icon: 'Edit',
              status: 'finish',
              subdata: [
                {
                  id: '002001',
                  router: '/',
                  content: '合同收款(1笔)',
                  timestamp: '',
                  color: '#0bbd87',
                },
                {
                  id: '002002',
                  router: '/',
                  content: '销售开票(1笔)',
                  timestamp: '',
                  color: '#0bbd87',
                },
              ],
            },
            {
              title: '项目方案',
              description: '逾期1.0天',
              timestamp: '2024-10-15',
              icon: 'Collection',
              status: 'error',
              subdata: [
                {
                  id: '003001',
                  router: '/',
                  content: '合同收款(1笔)',
                  timestamp: '',
                  color: '#0bbd87',
                },
              ],
            },
            {
              title: '项目上线',
              description: '正常上线',
              timestamp: '2024-10-16',
              icon: 'Timer',
              status: 'process',
              subdata: [
                {
                  id: '004001',
                  router: '/',
                  content: '收入合同(1笔)',
                  timestamp: '',
                  color: '#0bbd87',
                  router: '/',
                },
                {
                  id: '004002',
                  router: '/',
                  content: '指出合同(1笔)',
                  timestamp: '',
                  color: '#0bbd87',
                  router: '/',
                },
                {
                  id: '004003',
                  router: '/',
                  content: '采购订单(1笔)',
                  timestamp: '',
                  color: '#0bbd87',
                  router: '/',
                },
                {
                  id: '004004',
                  router: '/',
                  content: '采购付款(1笔)',
                  timestamp: '',
                  color: '#0bbd87',
                  router: '/',
                },
              ],
            },
            {
              title: '项目验收',
              description: '计划结束',
              timestamp: '2024-10-20',
              icon: 'CollectionTag',
              status: 'wait',
              subdata: [
                {
                  id: '005001',
                  router: '/',
                  content: '填报执行单',
                  timestamp: '',
                  color: '#0bbd87',
                  router: '/',
                },
              ],
            },
          ]
        }
      },
    },
    {
      sort: 1,
      label: '步骤间距',
      type: 'input',
      value: '',

    },
    {
      sort: 2,
      label: '排列方向',
      type: 'radio',
      value: 'horizontal',
      typeOptions: {
        options: [
          { label: '水平', value: 'horizontal' },
          { label: '垂直', value: 'vertical' },
        ],
      },
    },
    {
      sort: 3,
      label: '居中显示',
      type: 'switch',
      value: false,
      typeOptions: {

      },
    },
    {
      sort: 4,
      label: '简洁模式',
      type: 'switch',
      value: false,
      typeOptions: {

      },
    },

  ],
}