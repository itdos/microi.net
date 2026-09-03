export const homeoverview = {
  type: 'homeoverview',
  label: '智能首页概览',
  category: 0,
  show: 1,
  icon: 'TrendCharts',
  img: '',
  widgetOption: {
    height: 440,
  },
  widgetParams: [
    {
      sort: 0,
      label: '接口引擎 Key',
      type: 'input',
      value: 'platform-home-overview',
      typeOptions: {
        rows: 1,
        dataJson: {},
      },
    },
  ],
}
