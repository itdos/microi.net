/**
 * 进度组件
 */
export const progress = {
  type: 'progress',
  label: '进度',
  category: 0,
  show: 1,
  icon: '',
  img: '',
  widgetOption: {
    height: 120,
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
          data: [
            {
              title: '个人业绩（年度）',
              value: '￥1,000,00.00',
              subTitle: '目标金额: ￥1,000,000.00',
              percentage: 60,
              color: '#409EFF',
            },
            {
              title: '团队业绩（年度）',
              value: '￥10,000,00.00',
              subTitle: '目标金额: ￥10,000,000.00',
              percentage: 100,
              color: '#67C23A',
            }
          ],
          searchData: [
            {
              prop: 'department',
              value: '5',
              label: '部门',
              type: 'select',
              remote: false,
              optionUrl: 'http://localhost:5267/api/printData/getSelectData?query=',
              options: [
                { label: '全部', value: '' },
                { label: '前端', value: '0' },
                { label: '后端', value: '1' },
                { label: '测试', value: '2' },
                { label: '运维', value: '3' },
                { label: '产品', value: '4' },
                { label: '设计', value: '5' },
              ]
            },
            {
              prop: 'date',
              value: '本年',
              label: '日期',
              type: 'select',
              optionUrl: 'http://localhost:5267/api/printData/getSelectData?query=',
              options: [
                { label: '本年', value: '本年' },
                { label: '本月', value: '本月' },
              ]
            },
          ]
        }
      },
    },
    {
      sort: 1,
      label: '栅格宽度',
      type: 'slider',
      value: 12,
      typeOptions: {
        min: 1,
        max: 24,
        step: 1,
      },
    },
    {
      sort: 2,
      label: '背景颜色',
      type: 'color',
      value: '',
    },
    {
      sort: 3,
      label: '栅格边距',
      type: 'input',
      value: '5px',
    },
    {
      sort: 4,
      label: '对齐方式',
      type: 'select',
      value: 'left',
      typeOptions: {
        options: [
          {
            value: 'left',
            label: '左对齐',
          },
          {
            value: 'center',
            label: '居中',
          },
          {
            value: 'right',
            label: '右对齐',
          },
        ]
      },
    },
    {
      sort: 5,
      label: '进度条类型',
      type: 'radio',
      value: 'line',
      typeOptions: {
        options: [
          {
            value: 'line',
            label: '线性进度条',
          },
          {
            value: 'circle',
            label: '圆形进度条',
          },
        ]
      },
    },
    {
      sort: 6,
      label: '进度条厚度',
      type: 'input',
      value: 10,
    },
    {
      sort: 7,
      label: '进度值显示',
      type: 'switch',
      value: true,
    },
    {
      sort: 8,
      label: '进度值内显',
      type: 'switch',
      value: false,
    },
    {
      sort: 9,
      label: '进度值',
      type: 'switch',
      value: true,
    },
    {
      sort: 10,
      label: '圆形半径',
      type: 'number',
      value: 86,
      typeOptions: {
        min: 1,
        max: 999,
        step: 1,
      },
    },
    {
      sort: 11,
      label: '进度条边距',
      type: 'input',
      value: '0px',
    },
    {
      sort: 12,
      label: '显示标题',
      type: 'switch',
      value: true,
    },
    {
      sort: 13,
      label: '标题字号',
      type: 'input',
      value: '13px',
    },
    {
      sort: 14,
      label: '标题字宽',
      type: 'input',
      value: '400',
    },
    {
      sort: 15,
      label: '标题颜色',
      type: 'color',
      value: '',
    },
    {
      sort: 16,
      label: '标题边距',
      type: 'input',
      value: '0px 0px 10px 0',
    },
    {
      sort: 17,
      label: '值字号',
      type: 'input',
      value: '22px',
    },
    {
      sort: 18,
      label: '值字宽',
      type: 'input',
      value: '600',
    },
    {
      sort: 19,
      label: '值颜色',
      type: 'color',
      value: '',
    },
    {
      sort: 20,
      label: '值边距',
      type: 'input',
      value: '0px 0px 10px 0',
    },
    {
      sort: 21,
      label: '显示副标题',
      type: 'switch',
      value: true,
    },
    {
      sort: 22,
      label: '副标题字号',
      type: 'input',
      value: '13px',
    },
    {
      sort: 23,
      label: '副标题字宽',
      type: 'input',
      value: '400',
    },
    {
      sort: 24,
      label: '副标题颜色',
      type: 'color',
      value: '',
    },
    {
      sort: 25,
      label: '副标题边距',
      type: 'input',
      value: '10px 0px 10px 0px',
    },
    {
      sort: 26,
      label: '显示查询',
      type: 'switch',
      value: false,
    },
    {
      sort: 27,
      label: '日期筛选',
      type: 'switch',
      value: false,
    }
  ],
};