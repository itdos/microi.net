export const workcenter = {
  type: 'workcenter',
  label: '工作中心',
  category: 0,
  show: 1,
  icon: 'Briefcase',
  img: '',
  widgetOption: {
    height: 560,
  },
  widgetParams: [
    {
      sort: 0,
      label: '显示内容',
      type: 'select',
      value: 'work',
      typeOptions: {
        options: [
          { label: '我的工作', value: 'work' },
          { label: '日历', value: 'calendar' },
          { label: '公告', value: 'notice' },
        ],
      },
    },
    {
      sort: 1,
      label: '待办表单模块',
      type: 'sysmenu',
      value: '',
      typeOptions: {},
    },
    {
      sort: 2,
      label: '流程表单模块',
      type: 'sysmenu',
      value: '',
      typeOptions: {},
    },
  ],
}
