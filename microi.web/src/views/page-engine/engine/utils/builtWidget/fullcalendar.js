export const fullcalendar = {
  type: 'fullcalendar',
  label: '日历看板',
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
        dataJson: [{
          id: 'event_01',
          title: '完成高级日历组件开发',
          start: '2025-05-12',
          end: '2025-05-13',
          allDay: true,
        }, {
          id: 'event_02',
          title: '本地部署小程序接口服务',
          start: '2025-05-12',
          end: '2025-05-13',
          allDay: true,
        }, {
          id: 'event_03',
          title: '鞋子模型腾讯会议',
          start: '2025-05-12T15:00:00',
          end: '',
          allDay: false,
        }]
      }
    },
    {
      sort: 1,
      label: '事件颜色',
      type: 'color',
      value: '#f08f00',
    },
    {
      sort: 2,
      label: '周计方式',
      type: 'input',
      value: 'ISO',
    },
    {
      sort: 3,
      label: '全天事件',
      type: 'switch',
      value: true,
    },
    {
      sort: 4,
      label: '启用编辑',
      type: 'switch',
      value: true,
    },
    {
      sort: 5,
      label: '启用选择',
      type: 'switch',
      value: false,
    }, {
      sort: 6,
      label: '镜像选择',
      type: 'switch',
      value: true,
    }, {
      sort: 7,
      label: '事件限制',
      type: 'switch',
      value: true,
    }, {
      sort: 8,
      label: '显示周末',
      type: 'switch',
      value: true,
    }, {
      sort: 9,
      label: '日期链接',
      type: 'switch',
      value: false,
    }, {
      sort: 10,
      label: '开启拖拽',
      type: 'switch',
      value: true,
    }, {
      sort: 11,
      label: '添加事件',
      type: 'input',
      value: '',
    }, {
      sort: 12,
      label: '删除事件',
      type: 'input',
      value: '',
    }, {
      sort: 13,
      label: '拖拽事件',
      type: 'input',
      value: '',
    }
  ],
}