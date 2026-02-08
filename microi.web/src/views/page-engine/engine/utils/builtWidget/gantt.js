export const gantt = {
  type: 'gantt',
  label: '甘特图',
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
          tasks: [
            {
              id: 10,
              text: 'RFQ&项目启动',
              type: 'project',
              progress: 0.1,
              open: true,
              person: '张三id,李四id',
              color: "#000",          // 任务栏颜色
              status: '进行中',
            },

            {
              id: 12,
              text: '产品需求 #1.0.1',
              start_date: '2025-01-02 09:00',
              duration: 72, // 72小时 = 3天
              parent: 10,
              progress: 1,
              person: '张三',
              status: '已完成',
              color: "#73767A",
              priority: '中'
            },
            {
              id: 13,
              text: '产品数据 #1.0.2',
              start_date: '2025-01-05 09:00',
              duration: 12, // 72小时 = 3天
              parent: 10,
              progress: 0.8,
              person: '李四',
              status: '风险',
              color: "#73767A",
              priority: '中'

            },
            {
              id: 14,
              text: '环境数据 #1.0.3',
              start_date: '2025-01-08 09:00',
              duration: 24,
              parent: 10,
              progress: 0.1,
              person: '李四',
              status: '未开始',
              color: "#73767A",
              priority: '中'
            },
            {
              id: 20,
              text: '产品设计&开发',
              type: 'project',
              progress: 0,
              person: '王五',
              open: true,
              status: '延误',
              color: "#73767A",
              priority: '中'
            },
            {
              id: 21,
              text: '设计输入信息管理#3.0.1',
              start_date: '2025-01-18 09:00',
              duration: 24,
              parent: 20,
              progress: 0.5,
              person: '王五',
              status: '进行中',
              color: "#73767A",
              priority: '中'
            },
            {
              id: 22,
              text: '产品设计过往教训展开 #3.0.2',
              start_date: '2025-01-20 09:00',
              duration: 5,
              parent: 20,
              progress: 0.2,
              person: '945453a2-e0d1-457a-bf45-025f8707870d',
              status: '未开始',
              color: "#73767A",
              priority: '高'
            },
          ],
          links: [
            { id: 10, source: 12, target: 13, type: 1 },
            { id: 11, source: 13, target: 14, type: 1 },
            { id: 12, source: 14, target: 15, type: 1 },
          ],
          columns: [
            {
              name: 'text',
              label: '任务名称',
              width: 220,
              tree: true,
              align: 'left',
            },
            { name: 'start_date', label: '起始时间', align: 'center', width: 140 },
            { name: 'duration', label: '持续时间', align: 'center', width: 140 },
            {
              name: 'progress',
              label: '进度',
              align: 'center',
              width: 110
            },
            {
              name: 'person',
              label: '负责人',
              align: 'center',
              width: 110
            },
            {
              name: 'status',
              label: '状态',
              align: 'center',
              width: 110
            },
            { name: "priority", label: "优先级", width: 100, align: 'center' },
          ],
          readonly: 'off',
          personapi: 'https://api.nbweixin.cn/apiengine/GetUserList?OsClient=apmstest'

        }
      },
    },
    {
      sort: 1,
      label: '提示框',
      type: 'switch',
      value: true,
    },
    {
      sort: 2,
      label: '允许拖放',
      type: 'switch',
      value: true,
    },
    {
      sort: 3,
      label: '表头高度',
      type: 'number',
      value: 40,
    },
    {
      sort: 4,
      label: '表格行高',
      type: 'number',
      value: 24,
    },
    {
      sort: 5,
      label: 'bar高度',
      type: 'number',
      value: 16,
    },
    {
      sort: 6,
      label: '动态尺寸',
      type: 'switch',
      value: false,
    },
    {
      sort: 7,
      label: '只读模式',
      type: 'switch',
      value: false,
    },
    {
      sort: 8,
      label: '左侧表格',
      type: 'switch',
      value: true,
    },
    {
      sort: 9,
      label: '显示进度',
      type: 'switch',
      value: true,
    },
    {
      sort: 10,
      label: 'bar弹框',
      type: 'switch',
      value: false,
    },
    {
      sort: 11,
      label: '编辑回调',
      type: 'input',
      value: '',
    },
    {
      sort: 12,
      label: '自动计算',
      type: 'switch',
      value: false,
    },
    {
      sort: 13,
      label: '分支排序',
      type: 'switch',
      value: true,
    },
    {
      sort: 14,
      label: '自由排序',
      type: 'switch',
      value: false,
    },
    {
      sort: 15,
      label: '任务字号',
      type: 'number',
      value: 10,
    },
    {
      sort: 16,
      label: '任务字色',
      type: 'color',
      value: '#fff',
    },
    {
      sort: 17,
      label: '左侧宽度',
      type: 'number',
      value: 400,
    },
    {
      sort: 18,
      label: '添加关联',
      type: 'input',
      value: '',
    },
    {
      sort: 19,
      label: '删除关联',
      type: 'input',
      value: '',
    },
    {
      sort: 20,
      label: '日列宽度',
      type: 'number',
      value: 35,
    },
    {
      sort: 21,
      label: '实时更新',
      type: 'switch',
      value: false,
    },
    {
      sort: 22,
      label: '进度颜色',
      type: 'color',
      value: '#529b2e',
    },
    {
      sort: 23,
      label: '默认视图',
      type: 'select',
      value: 'day',
      typeOptions: {
        options: [
          { label: '小时', value: 'hour' },
          { label: '日视图', value: 'day' },
          { label: '周视图', value: 'week' },
          { label: '月视图', value: 'month' },
          { label: '季度视图', value: 'quarter' },
          { label: '年视图', value: 'year' },
        ],
      },
    },
  ],
}