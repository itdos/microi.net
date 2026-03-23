export const tabel = {
  type: 'tabel',
  label: '表格',
  category: 0, //0 内置组件,1 自定义组件
  show: 1, //是否展示 0隐藏,1展示
  icon: '', // elementplus
  img: '',  //图片图标
  widgetOption: {
    height: 310, //高度
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
          headerData: [
            {
              prop: '任务',
              label: '任务',
              width: '',
              icon: 'Position',
              align: 'center',
            },
            {
              prop: '进度',
              label: '进度',
              width: '',
              progress_ui: true,
              icon: 'Timer',
              align: 'center',
            },
            {
              prop: '占比',
              label: '占比',
              width: '',
              chart_ui: true,
              align: 'center',
            },
            {
              prop: '杂项',
              label: '杂项',
              align: 'center',
              children: [
                {
                  prop: '状态',
                  label: '状态',
                  width: '',
                  status_ui: true,
                  align: 'center',
                },
                {
                  prop: '评级',
                  label: '评级',
                  width: '',
                  align: 'center',
                  rate_ui: true,

                },
              ]
            },


          ],
          bodyData: [
            {
              任务: '小组件研发',
              进度: 100,
              占比: 100,
              状态: '已完成',
              评级: 3,
              progress_ui: 'success',
              status_ui: 'success',
            },
            {
              任务: '表内标签研发',
              进度: 80,
              占比: 80,
              状态: '进行中',
              评级: 3.5,
              progress_ui: 'warning',
              status_ui: 'warning'
            },
            {
              任务: '其它研发',
              进度: 50,
              占比: 50,
              状态: '进行中',
              评级: 5,
              progress_ui: 'warning',
              status_ui: 'warning'
            },
            {
              任务: '其它研发',
              进度: 0,
              占比: 0,
              状态: '未开始',
              评级: 0,
              progress_ui: 'warning',
              status_ui: 'info'
            },
          ],
          total: 4,
          searchData: [
            {
              prop: 'keyword',
              value: '',
              label: '关键词',
              type: 'input'
            }, {
              prop: 'username',
              value: '',
              label: '用户名',
              type: 'input'
            }, {
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
          ]
        },
      },
    },
    {
      sort: 1,
      label: '显示查询',
      type: 'switch',
      value: true,
    },
    {
      sort: 2,
      label: '斑马线',
      type: 'switch',
      value: true,
    },
    {
      sort: 3,
      label: '显示边框',
      type: 'switch',
      value: true,
    },
    {
      sort: 4,
      label: '表格尺寸',
      type: 'select',
      value: 'small',
      typeOptions: {
        options: [
          { label: '小', value: 'small' },
          { label: '中', value: 'medium' },
          { label: '大', value: 'large' },
        ],
      }
    },
    {
      sort: 5,
      label: '进度厚度',
      type: 'number',
      value: 16,
    },
    {
      sort: 6,
      label: '合并列名',
      type: 'input',
      value: '',
    },
    {
      sort: 7,
      label: '每页数量',
      type: 'number',
      value: -1,
    },
    {
      sort: 8,
      label: '表尾合计',
      type: 'switch',
      value: false,
    },
    {
      sort: 9,
      label: '边框颜色',
      type: 'color',
      value: 'var(--el-border-color-lighter)',
    },
    {
      sort: 10,
      label: '表头背景色',
      type: 'color',
      value: 'var(--el-fill-color-light)',
    },
    {
      sort: 11,
      label: '表头字体色',
      type: 'color',
      value: 'var(--el-table-header-text-color)',
    },
    {
      sort: 12,
      label: '内容字体色',
      type: 'color',
      value: 'var(--el-table-text-color)',
    },
    {
      sort: 13,
      label: '日期筛选',
      type: 'switch',
      value: false,
    },
    {
      sort: 14,
      label: 'pie宽度',
      type: 'number',
      value: 30,
    }, {
      sort: 15,
      label: 'pie背景色',
      type: 'color',
      value: '#409eff50',
    }, {
      sort: 16,
      label: 'pie边框色',
      type: 'color',
      value: '#409eff',
    },


  ],
}