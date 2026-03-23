/**
 * 页面信息
 * utils/formjson.js
 * 页面信息 ## 一级
 */
export const formData = {
  Id: '', //页面ID
  Title: '',//页面标题
  Number: '',//页面编号
  Desc: '',//页面描述
  JsonObj: {
    //页面配置
    formConfig: {},
    //容器列表
    wrapperList: []
  },
}
//页面配置 ## 二级
export const formConfig = {
  gutter: 0, //栅格间距 (默认10)
  mask: true, //是否开启遮罩
  drag: true, //是否开启拖拽
  left: true, //是否显示左边栏
  hover: true, //悬停阴影
  shadow: true, //是否显示阴影
  link: false, //启用链接
  watermark: false, //是否开启水印
  mobile: false, //是否移动端视图
  dark: false, // 暗黑模式
  autoRefresh: 0,//自动刷新间隔，0秒不刷新
  lastRefreshTime: '',//最后刷新时间
  watermarkStyle: {
    content: 'Microi吾码',
    font: {
      fontSize: 16,
      color: 'rgba(255, 0, 0, 0.15)',
    },
    rotate: -22,
  },
  dynamicStyle: {
    padding: '4px', //内边距
    backgroundColor: '', //背景色 transparent
    opacity: 1 //透明度
  }
}

//容器列表 ## 二级
export const wrapperList = [
  {
    type: 'pannel',
    label: '卡片',
    hidden: false,
    icon: '',
    img: '',  //图片图标
    wrapperOption: {},
    widgetList: []
  },
]

//容器配置 ## 三级
export const wrapperOption = {
  number: '',//容器编号
  gutter: 0, //栅格间距 (默认0)
  span: 12, //占位(栅格)
  offset: 0, //栅格左侧的间隔格数
  push: 0, //栅格向右移动格数
  pull: 0, //栅格向左移动格数
  height: 300, //高度
  marginTop: 0, //上移
  margin: '0px 10px 10px 0px', //外边距(实际是应用的内边距,外边距会使el-row塌陷)
  pannelColor: '',//面板背景色
  dynamicStyle: {
    padding: '10px', //内边距
    backgroundColor: '',//背景色,默认透明 transparent,内容背景
  },
  titleOption: {
    hidden: true, //是否显示标题
    title: '未命名',  //卡片标题
    dynamicStyle: {
      textAlign: 'left', //标题对齐方式
      padding: '0px',//标题内边距
      height: '20px',//标题高度
      lineHeight: '20px',//标题行高
      fontSize: '14px',//标题字体大小
      color: '',//标题颜色
    },
    moreOption: {
      hidden: true,//更多是否显示
      icon: 'More',//更多图标
      iconShow: false,//更多图标是否显示
      text: '更多',//更多文字
      linkurl: '/',//更多链接
      linktype: 'router',//更多链接类型 'router' | '_parent' | '_blank' | '_self' | '_top' 
      refresh: '0',
      datetime: '0',
      autotime: false,//自动刷新
      autotimeval: 1,//自动刷新时间间隔s
      dynamicStyle: {
        color: '',//更多颜色
        fontSize: '12px',//更多字体大小
      }
    }
  }
}
//遍历组装容器列表
for (let i = 0, len = wrapperList.length; i < len; i++) {
  const item = wrapperList[i]
  item.wrapperOption = {
    ...wrapperOption,
    ...item.wrapperOption
  }
}
