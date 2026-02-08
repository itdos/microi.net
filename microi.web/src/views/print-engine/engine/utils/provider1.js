import { hiprint } from "vue-plugin-hiprint";
export const provider1 = function () {

  var addElementTypes = function (context) {
    context.removePrintElementTypes("providerModule1");
    context.addPrintElementTypes("providerModule1", [
      new hiprint.PrintElementTypeGroup("表格/文本", [

        {
          tid: "providerModule1.customText", title: "文本", type: "text", options: {
            field: "",
            testData: "测试文本",
          },
        },
        {
          tid: "providerModule1.customText1", title: "键值文本", type: "text", options: {
            field: "keytext_01",
            testData: "测试键值文本",
          },
        },
        {
          tid: "providerModule1.longText",
          title: "长文本",
          type: "longText",
          options: {
            field: "longText_01",
            width: 200,
            testData: "长文本分页/不分页测试",
          },
        },
        {
          tid: "providerModule1.html",
          title: "静态表格",
          type: "html",
          options: {
            width: 500,
            height: 130,
            formatter: `function(t, e, d) {
              var html =  \`<head><style>
                 .htmlprint {
                   width: 100%;
                   height: 100%;
                   padding: 10px;
                 }
                 table {
                   width: 100%;
                   border-collapse: collapse;
                 }
                 th, td {
                   border: 1px solid black;
                   padding: 8px;
                   text-align: center;
                   font-size: 12px;
                 }
              }
             </style>
           </head>
            <body>
            <div class="htmlprint">
              <table>
                <tr>
                  <td colspan="2">合并2列</td>
                  <td rowspan="2">合并2行</td>
                  <td>行1列4</td>
                  <td>行1列5</td>
               </tr>
                <tr>
                  <td>\\\${d.col21}</td>
                  <td>行2列3</td>
                  <td>行2列4</td>
                  <td>行2列5</td>
               </tr>
                <tr>
                  <td>\\\${d.col31}</td>
                  <td>行3列2</td>
                  <td>行3列3</td>
                  <td>行3列4</td>
                  <td>行3列5</td>
               </tr>
            </table>
            </div>
            </body>\`
              // ! 这里的处理很关键
              if (d) {
                  return html.replace(/\\$\{(\\S+)\}/g, (match, key) => {
                      return eval(key);
                  });
              } else {
               return html;
              }
              // ! 这里的处理很关键
           }`,
          },
        },
        {
          tid: "providerModule1.table", //元素类型的标识
          title: "表格", //用户托拽列表中显示的名称
          type: "table",
          columns: [
            [
              { title: "列名1", align: "center", field: "col1" },
              { title: "列名2", align: "center", field: "col2" },
            ],
          ],
          options: {
            field: "tabel_01", //字段名称
            fields: [],
          }
        },

        {
          tid: "providerModule1.image", //元素类型的标识
          title: "图片",
          // field: "image", //打印元素类型所对应的数据Josn的Key
          data: "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==", //打印设置时，显示的默认值
          type: "image",
          options: {
            title: "图片", //标题或内容，field 存在：title为标题，打印结果为 title:data , field 不存在：title为内容，打印结果为 title
            field: "image_01",//字段名称
            src: "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==", //field不存在的情况下，显示src的内容
            transform: 0,//旋转角度
            width: 100,
            height: 100,
          },
          // //设置默认大小100*100
          // styler: function (value, options, templateData) {
          //   return { width: 100, height: 100 };
          // }
        },

        {
          tid: "providerModule1.barcode",
          title: "条形码",
          data: "XS888888888",
          type: "text",
          options: {
            field: "barcode_01",
            testData: "XS888888888",
            height: 52,
            fontSize: 12,
            lineHeight: 18,
            textAlign: "center",
            textType: "barcode",
          },
        },
        {
          tid: "providerModule1.qrcode",
          title: "二维码",
          data: "XS888888888",
          type: "text",
          options: {
            field: "qrcode_01",
            testData: "XS888888888",
            width: 100,
            height: 100,
            fontSize: 12,
            lineHeight: 18,
            hideTitle: true,
            textAlign: "center",
            textType: "qrcode",
          },
        },


      ]),
      new hiprint.PrintElementTypeGroup("辅助/图形", [
        {
          tid: "providerModule1.hline",
          title: "横线",
          type: "hline",
        },
        {
          tid: "providerModule1.vline",
          title: "竖线",
          type: "vline",
        },
        {
          tid: "providerModule1.rect",
          title: "矩形",
          type: "rect",
        },
        {
          tid: "providerModule1.oval",
          title: "椭圆",
          type: "oval",
        },
      ]),
    ]);
  };
  return {
    addElementTypes: addElementTypes,
  };
};
