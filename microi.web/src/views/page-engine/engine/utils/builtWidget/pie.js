export const pie = {
  type: 'pie',
  label: '饼图',
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
            { value: 1048, name: '搜索引擎' },
            { value: 735, name: '直接' },
            { value: 580, name: '邮箱' },
            { value: 484, name: '联盟广告' },
            { value: 300, name: '视频广告' },
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
      label: '内圈半径',
      type: 'number',
      value: 0,
      typeOptions: {
        min: 0,
        max: 9000,
        step: 1
      }
    },
    {
      sort: 3,
      label: '外圈半径',
      type: 'number',
      value: 100,
      typeOptions: {
        min: 1,
        max: 9000,
        step: 1
      }
    },

    {
      sort: 4,
      label: '单位',
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
      value: 'vertical',
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
      value: 'left',
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
      sort: 12,
      label: '显示工具箱',
      type: 'switch',
      value: true,
    },
    {
      sort: 13,
      label: '显示标签',
      type: 'switch',
      value: true,
    },

    {
      sort: 14,
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
      sort: 15,
      label: '边框圆角',
      type: 'number',
      value: 10,
      typeOptions: {
        min: 0,
        max: 900,
        step: 1
      }
    },
    {
      sort: 16,
      label: '边框宽度',
      type: 'number',
      value: 2,
      typeOptions: {
        min: 0,
        max: 900,
        step: 1
      }
    },
    {
      sort: 17,
      label: '内外环间距',
      type: 'number',
      value: 2,
      typeOptions: {
        min: 0,
        max: 900,
        step: 1
      }
    },
    {
      sort: 18,
      label: '南丁格尔',
      type: 'switch',
      value: false,
    },
    {
      sort: 19,
      label: '日期筛选',
      type: 'switch',
      value: false,
    },
    {
      sort: 20,
      label: '标签格式',
      type: 'input',
      value: '{d}%',
    }
  ]
}