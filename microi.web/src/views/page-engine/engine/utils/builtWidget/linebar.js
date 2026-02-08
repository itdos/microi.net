export const linebar = {
  type: 'linebar',
  label: '折柱混合',
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
          xAxis: ['周一', '周二', '周三', '周四', '周五', '周六', '周天'],
          series: [
            {
              name: '蒸发量',
              type: 'bar',
              unit: 'ml',
              data: [
                2.0, 4.9, 7.0, 23.2, 25.6, 76.7, 135.6, 162.2, 32.6, 20.0, 6.4, 3.3,
              ],
            },
            {
              name: '降水量',
              type: 'bar',
              unit: 'ml',
              data: [
                2.6, 5.9, 9.0, 26.4, 28.7, 70.7, 175.6, 182.2, 48.7, 18.8, 6.0, 2.3,
              ],
            },
            {
              name: '温度',
              type: 'line',
              unit: '°C',
              data: [
                2.0, 2.2, 3.3, 4.5, 6.3, 10.2, 20.3, 23.4, 23.0, 16.5, 12.0, 6.2,
              ],
            },
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
      label: '显示查询',
      type: 'switch',
      value: false,
    },
    {
      sort: 2,
      label: 'X轴留白',
      type: 'switch',
      value: true,
    },
    {
      sort: 3,
      label: '单位左',
      type: 'input',
      value: '',
    },
    {
      sort: 4,
      label: '单位右',
      type: 'input',
      value: '',
    },
    {
      sort: 5,
      label: '标题',
      type: 'input',
      value: '',
    },
    {
      sort: 6,
      label: '副标题',
      type: 'input',
      value: '',
    },
    {
      sort: 7,
      label: '显示图例',
      type: 'switch',
      value: true,
    },
    {
      sort: 8,
      label: '图例排列',
      type: 'select',
      value: 'horizontal',
      typeOptions: {
        options: [
          {
            value: 'horizontal',
            label: '水平',
          },
          {
            value: 'vertical',
            label: '垂直',
          },
        ]
      },
    },
    {
      sort: 9,
      label: '图例位置',
      type: 'select',
      value: 'center',
      typeOptions: {
        options: [
          {
            value: 'center',
            label: '居中',
          },
          {
            value: 'left',
            label: '左侧',
          },
          {
            value: 'right',
            label: '右侧',
          },
        ]
      },
    },
    {
      sort: 10,
      label: '提示框',
      type: 'switch',
      value: true,
    },
    {
      sort: 11,
      label: 'trigger',
      type: 'select',
      value: 'axis',
      typeOptions: {
        options: [
          {
            value: 'axis',
            label: 'axis',
          },
          {
            value: 'item',
            label: 'item',
          },
          {
            value: 'none',
            label: 'none',
          },
        ]
      },
    },
    {
      sort: 12,
      label: '柱状效果',
      type: 'select',
      value: 'shadow',
      typeOptions: {
        options: [
          {
            value: 'shadow',
            label: 'shadow',
          },
          {
            value: 'line',
            label: 'line',
          },
          {
            value: 'none',
            label: 'none',
          },
        ]
      },
    },
    {
      sort: 13,
      label: '显示工具箱',
      type: 'switch',
      value: true,
    },
    {
      sort: 14,
      label: '显示标签',
      type: 'switch',
      value: false,
    },
    {
      sort: 15,
      label: '标签位置',
      type: 'select',
      value: 'outside',
      typeOptions: {
        options: [
          {
            value: 'inside',
            label: 'inside',
          },
          {
            value: 'outside',
            label: 'outside',
          },
          {
            value: 'center',
            label: 'center',
          },
          {
            value: 'left',
            label: 'left',
          },
          {
            value: 'right',
            label: 'right',
          },
          {
            value: 'top',
            label: 'top',
          },
          {
            value: 'bottom',
            label: 'bottom',
          }
        ]
      },
    },
    {
      sort: 16,
      label: '分割线左',
      type: 'switch',
      value: false,
    },
    {
      sort: 17,
      label: '分割线右',
      type: 'switch',
      value: false,
    },
    {
      sort: 18,
      label: '日期筛选',
      type: 'switch',
      value: false,
    },
  ]
}