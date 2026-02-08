/**
 * @description: 自定义扩展组件
 * @author: mrcroi_lisaisai
 * @createTime: 2024/11/26 9:09
 **/

import { defineAsyncComponent } from 'vue'

export const newWidgets = [
  {
    type: 'test',
    label: '测试',
    category: 0, //0 内置组件,1 自定义组件
    show: 1, //是否展示 0隐藏,1展示
    icon: '', // elementplus
    img: 'https://www.nbweixin.cn/autopage/logoarr1/%E9%97%AE%E5%8D%B7%E8%B0%83%E6%9F%A5.png', //图片图标
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
            icon: 'https://www.nbweixin.cn/autopage/photo.png',
            title: '早安，Ah jung，开始您一天的工作吧！',
            subTitle: '今日阴转大雨，15℃ - 25℃，出门记得带伞哦。',
          },
        },
      },
      {
        sort: 1,
        label: '测试属性',
        type: 'input',
        value: '',
        typeOptions: {},
      },
    ],
  }
]
export const newComponents = [
  {
    'test-widget': defineAsyncComponent(() =>
      import('../components/test-widget.vue')
    ),
  },
]