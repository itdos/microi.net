export const video = {
  type: 'video',
  label: '视频',
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
      label: '视频地址',
      type: 'input',
      value: 'https://static.itdos.com/download/microi/microi.pageengine/demo.mp4',//new URL('../../assets/demo/demo.mp4', import.meta.url).href,
    },
    {
      sort: 1,
      label: '控制器开关',
      type: 'switch',
      value: false,
    },
    {
      sort: 2,
      label: '自动播放',
      type: 'switch',
      value: true,
    },
    {
      sort: 3,
      label: '循环播放',
      type: 'switch',
      value: true,
    },
    {
      sort: 4,
      label: '静音',
      type: 'switch',
      value: true,
    },
  ]
}