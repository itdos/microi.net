export const webgl = {
  type: 'webgl',
  label: 'WebGL',
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
          gltfPath: new URL('../../assets/demo/gltf/MaterialsVariantsShoe.gltf', import.meta.url).href,//模型路径
          hdrPath: 'https://static.itdos.com/download/microi/microi.pageengine/demo.hdr',//new URL('../../assets/demo/demo.hdr', import.meta.url).href,//背景路径
          variant: 'midnight',//初始变体
        }
      }
    }, {
      sort: 1,
      label: '缩放',
      type: 'number',
      value: 10,
    }, {
      sort: 2,
      label: '相机角度',
      type: 'number',
      value: 60,
    }, {
      sort: 3,
      label: '近裁剪面',
      type: 'number',
      value: 0.25,
    }, {
      sort: 4,
      label: '远裁剪面',
      type: 'number',
      value: 20,
    },
    {
      sort: 5,
      label: '相机X轴',
      type: 'number',
      value: 2.5,
    }, {
      sort: 6,
      label: '相机Y轴',
      type: 'number',
      value: 1.5,
    }, {
      sort: 7,
      label: '相机Z轴',
      type: 'number',
      value: 3.0,
    },
  ],
}