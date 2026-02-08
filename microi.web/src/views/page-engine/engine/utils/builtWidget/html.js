export const html = {
  type: 'html',
  label: '超文本',
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
          col21: '替换值col21',
          col31: '替换值col31',
        },
        dataHtml: "<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    .htmlprint {\n      width: 98%;\n      height: 100%;\n      padding: 10px;\n    }\n    table {\n      width: 100%;\n      border-collapse: collapse;\n    }\n    th,\n    td {\n      border: 1px solid black;\n      padding: 8px;\n      text-align: center;\n      font-size: 12px;\n    }\n  </style>\n</head>\n<body>\n  <div class=\"htmlprint\">\n    <table>\n      <tr>\n        <td colspan=\"2\">合并2列</td>\n        <td rowspan=\"2\">合并2行</td>\n      </tr>\n      <tr>\n        <td>${col21}</td>\n        <td>行2列3</td>\n      </tr>\n      <tr>\n        <td>${col31}</td>\n        <td>行3列2</td>\n        <td>行3列3</td>\n      </tr>\n    </table>\n  </div>\n</body>\n</html>\n"
      },
    },
  ],
}