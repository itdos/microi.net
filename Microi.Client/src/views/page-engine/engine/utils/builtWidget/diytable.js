export const diytable = {
  type: 'diytable',
  label: 'DIY表格',
  category: 0,
  show: 1,
  icon: 'Document',
  img: '',
  widgetOption: {
    height: 500,
  },
  widgetParams: [
    {
      sort: 0,
      label: '模块ID',
      type: 'input',
      value: '',
      typeOptions: {
        rows: 1,
        dataJson: {},
      },
    },
    {
      sort: 1,
      label: '菜单ID',
      type: 'sysmenu',
      value: '',
    },
    {
      sort: 2,
      label: '容器样式',
      type: 'input',
      value: '',
    },
  ],
}
