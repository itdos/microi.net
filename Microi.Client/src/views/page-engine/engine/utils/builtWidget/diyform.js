export const diyform = {
  type: 'diyform',
  label: 'DIY表单',
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
      label: '表ID',
      type: 'input',
      value: '',
      typeOptions: {
        rows: 1,
        dataJson: {},
      },
    },
    {
      sort: 1,
      label: '记录ID',
      type: 'input',
      value: '',
    },
    {
      sort: 2,
      label: '表单模式',
      type: 'select',
      value: 'View',
      typeOptions: {
        options: [
          { label: '查看', value: 'View' },
          { label: '编辑', value: 'Upt' },
          { label: '新增', value: 'Add' },
        ],
      },
    },
    {
      sort: 3,
      label: '表名',
      type: 'input',
      value: '',
    },
  ],
}
