/**
 * 工作台组件
 */
export const workbench = {
  type: 'workbench',
  label: '工作台',
  category: 0,
  show: 1,
  icon: '',
  img: '',
  widgetOption: {
    height: 100,
  },
  widgetParams: [
    {
      sort: 0,
      label: '数据来源',
      type: 'textarea',
      value: '',
      typeOptions: {
        rows: 3,
        dataJson: {
          icon: new URL('../../assets/demo/photo.png', import.meta.url).href,
          title: '早安，Ah jung，开始您一天的工作吧！',
          subTitle: '今日阴转大雨，15℃ - 25℃，出门记得带伞哦。',
        }
      },
    },
  ],
};