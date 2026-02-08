export const statistic = {
  type: 'statistic',
  label: '统计面板',
  category: 0, //0 内置组件,1 自定义组件
  show: 1, //是否展示 0隐藏,1展示
  icon: '', // elementplus
  img: '',  //图片图标
  widgetOption: {
    height: 210, //高度
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
          "data": [
            {
              "name": "个人销售成交额",
              "value": 100000,
              "icon": "Top",
              "bgColor": "",
              "bgImage": "linear-gradient(to right bottom, rgb(236, 71, 134), rgb(185, 85, 164))",
              "linkUrl": "/"
            },
            {
              "name": "同比上月业绩",
              "value": 100000,
              "icon": "Top",
              "bgColor": "",
              "bgImage": "linear-gradient(to right bottom, rgb(134, 94, 192), rgb(81, 68, 180))",
              "linkUrl": "/"
            },
            {
              "name": "测试3",
              "value": 100000,
              "icon": "Bottom",
              "bgColor": "",
              "bgImage": "linear-gradient(to right bottom, rgb(86, 205, 243), rgb(113, 157, 227))",
              "linkUrl": "/"
            },
            {
              "name": "测试4",
              "value": 100000,
              "icon": "CaretTop",
              "bgColor": "",
              "bgImage": "linear-gradient(to right bottom, rgb(252, 188, 37), rgb(246, 128, 87))",
              "linkUrl": "/"
            },
            {
              "name": "测试5",
              "value": 100000,
              "icon": "CaretTop",
              "bgColor": "#67C23A",
              "bgImage": "",
              "linkUrl": "/"
            },
            {
              "name": "测试6",
              "value": 100000,
              "icon": "CaretTop",
              "bgColor": "#914F2C",
              "bgImage": "",
              "linkUrl": "/"
            }
          ],
          "searchData": [
            {
              "prop": "department",
              "value": "5",
              "label": "部门",
              "type": "select",
              "optionUrl": "http://localhost:5267/api/printData/getSelectData?query=",
              "options": [
                {
                  "label": "全部",
                  "value": ""
                },
                {
                  "label": "前端",
                  "value": "0"
                },
                {
                  "label": "后端",
                  "value": "1"
                },
                {
                  "label": "测试",
                  "value": "2"
                },
                {
                  "label": "运维",
                  "value": "3"
                },
                {
                  "label": "产品",
                  "value": "4"
                },
                {
                  "label": "设计",
                  "value": "5"
                }
              ]
            },
            {
              "prop": "date",
              "value": "本年",
              "label": "日期",
              "type": "select",
              "optionUrl": "http://localhost:5267/api/printData/getSelectData?query=",
              "options": [
                {
                  "label": "本年",
                  "value": "本年"
                },
                {
                  "label": "本月",
                  "value": "本月"
                }
              ]
            }
            ,
            {
              "prop": "keyword",
              "value": "",
              "label": "关键词",
              "type": "input"
            }
          ]
        }
      },
    },
    {
      sort: 1,
      label: '栅格宽度',
      type: 'slider',
      value: 8,
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
      label: '块状色彩', //属性名称
      type: 'input', //表单组件类型(input,textarea,number,color,select,switch,slider)
      value: '#ff444f,#FF71D2,#FBBD12,#914F2C,#409EFF,#6e26ba,#67C23A,#000', //表单组件内容

    },
    {
      sort: 5,
      label: '内边距',
      type: 'input',
      value: '20px',

    },
    {
      sort: 6,
      label: '边框圆角',
      type: 'input',
      value: '8px',

    },

    {
      sort: 7,
      label: '标题字号',
      type: 'input',
      value: '13px',

    },
    {
      sort: 8,
      label: '标题字宽',
      type: 'input',
      value: '400',

    },
    {
      sort: 9,
      label: '标题颜色',
      type: 'color',
      value: '#fff',

    },
    {
      sort: 10,
      label: '标题边距',
      type: 'input',
      value: '0px 0px 10px 0',

    },
    {
      sort: 11,
      label: '值字号',
      type: 'input',
      value: '18px',

    },
    {
      sort: 12,
      label: '值字宽',
      type: 'input',
      value: '400',

    },
    {
      sort: 13,
      label: '值颜色',
      type: 'color',
      value: '#fff',

    },
    {
      sort: 14,
      label: '图标位置',
      type: 'radio',
      value: 'prefix',
      typeOptions: {
        options: [
          { label: '前置', value: 'prefix' },
          { label: '后置', value: 'suffix' },
        ],
      },
    },
    {
      sort: 15,
      label: '图标颜色',
      type: 'color',
      value: '#fff',

    },

    {
      sort: 16,
      label: '图标大小',
      type: 'input',
      value: '16px',

    },
    {
      sort: 17,
      label: '块背景图',
      type: 'input',
      value: new URL('../../assets/demo/statistic_bg.png', import.meta.url).href,
    },
    {
      sort: 18,
      label: '显示查询',
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
      label: '数字精度',
      type: 'number',
      value: 0,
    },
    {
      sort: 21,
      label: '值内边距',
      type: 'input',
      value: 0,
    },
    {
      sort: 22,
      label: '值外边距',
      type: 'input',
      value: 0,
    },
    {
      sort: 23,
      label: '图标边距',
      type: 'input',
      value: 0,
    },
  ],
}