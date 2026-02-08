export const funnel = {
  type: 'funnel',
  label: '漏斗图',
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
          data: [
            { value: 60, name: '访问' },
            { value: 40, name: '查询' },
            { value: 20, name: '订单' },
            { value: 80, name: '点击' },
            { value: 100, name: '展示' },
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
      label: '单位',
      type: 'input',
      value: '',
    },
    {
      sort: 3,
      label: '标题',
      type: 'input',
      value: '',
    },
    {
      sort: 4,
      label: '副标题',
      type: 'input',
      value: '',
    },
    {
      sort: 5,
      label: '显示图例',
      type: 'switch',
      value: true,
    },
    {
      sort: 6,
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
      sort: 7,
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
      sort: 8,
      label: '提示框',
      type: 'switch',
      value: true,
    },
    {
      sort: 9,
      label: 'trigger',
      type: 'select',
      value: 'item',
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
      sort: 10,
      label: '显示工具箱',
      type: 'switch',
      value: true,
    },
    {
      sort: 11,
      label: '显示标签',
      type: 'switch',
      value: true,
    },

    {
      sort: 12,
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
      sort: 13,
      label: '日期筛选',
      type: 'switch',
      value: false,
    },
    {
      sort: 14,
      label: '排序方式',
      type: 'select',
      value: 'descending',
      typeOptions: {
        options: [
          {
            value: 'descending',
            label: '降序',
          },
          {
            value: 'ascending',
            label: '升序',
          },
          {
            value: 'none',
            label: '不排序',
          },
        ]
      },
    }
  ]
}