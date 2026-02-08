export const descriptions =
{
  type: 'descriptions',
  label: '描述列表',
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
        dataJson: [{
          label: '参与度',
          value: '项目维护',
          span: 1,
          rowspan: 1,
          align: 'center',
          labelAlign: 'center',
          width: '150px'
        }, {
          label: '评分',
          value: 3,
          span: 1,
          rowspan: 1,
          align: 'center',
          labelAlign: 'center',
          rate_ui: true,
        }, {
          label: '占比',
          value: 30,
          span: 1,
          rowspan: 1,
          align: 'left',
          labelAlign: 'center',
          progress_ui: true,
          progress_status: '',
          progress_color: '#5cb87a',
        },
        {
          label: '图例',
          value: 30,
          span: 1,
          rowspan: 1,
          align: 'left',
          labelAlign: 'center',
          chart_ui: true,
        },


        {
          label: '综合评价',
          value: '及格',
          span: 1,
          rowspan: 1,
          align: 'center',
          labelAlign: 'center',
          tag_ui: true,
          tag_status: 'warning',

        }]
      },
    },
    {
      sort: 1,
      label: '显示边框',
      type: 'switch',
      value: true,
    },
    {
      sort: 2,
      label: '每行列数',
      type: 'number',
      value: 5,
    },
    {
      sort: 3,
      label: '排列方式',
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
    }, {
      sort: 4,
      label: '列表尺寸',
      type: 'select',
      value: 'small',
      typeOptions: {
        options: [
          {
            value: 'default',
            label: '默认',
          },
          {
            value: 'large',
            label: '大',
          },
          {
            value: 'small',
            label: '小',
          },
        ]
      },
    }, {
      sort: 5,
      label: '标题',
      type: 'input',
      value: '',
    }, {
      sort: 6,
      label: '扩展标题',
      type: 'input',
      value: '',
    }, {
      sort: 7,
      label: '列宽',
      type: 'input',
      value: '',
    },
    {
      sort: 8,
      label: '进度厚度',
      type: 'number',
      value: 8,
    },
    {
      sort: 9,
      label: 'pie宽度',
      type: 'number',
      value: 30,
    }, {
      sort: 10,
      label: 'pie背景色',
      type: 'color',
      value: '#409eff50',
    }, {
      sort: 11,
      label: 'pie边框色',
      type: 'color',
      value: '#409eff',
    },

  ],
}