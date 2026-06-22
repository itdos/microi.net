export const office = {
  type: 'office',
  label: 'Office/PDF预览',
  category: 0,
  show: 1,
  icon: '',
  img: '',
  widgetOption: {
    height: 720,
  },
  widgetParams: [
    {
      sort: 0,
      label: '接口引擎地址',
      type: 'textarea',
      value: '',
      typeOptions: {
        rows: 3,
        dataJson: {
          filePath: new URL('../../assets/demo/demo.xlsx', import.meta.url).href
        }
      }
    },
    {
      sort: 1,
      label: '静态文件地址',
      type: 'input',
      value: '',
      typeOptions: {}
    },
    {
      sort: 2,
      label: '文件类型',
      type: 'select',
      value: 'auto',
      typeOptions: {
        options: [
          { label: '自动识别', value: 'auto' },
          { label: 'PDF', value: 'pdf' },
          { label: 'Word', value: 'docx' },
          { label: 'Excel', value: 'xlsx' },
          { label: 'PPT', value: 'pptx' }
        ]
      }
    },
    {
      sort: 3,
      label: '初始页码',
      type: 'number',
      value: 1,
      typeOptions: { min: 1, max: 9999, step: 1 }
    },
    {
      sort: 4,
      label: '轮询接口秒数',
      type: 'number',
      value: 0,
      typeOptions: { min: 0, max: 3600, step: 5 }
    }
  ],
}
