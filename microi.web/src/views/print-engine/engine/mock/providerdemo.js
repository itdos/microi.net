import { hiprint } from "vue-plugin-hiprint";
export const provider1 = function () {

  var addElementTypes = function (context) {
    context.removePrintElementTypes("providerModule1");
    context.addPrintElementTypes("providerModule1", [
      new hiprint.PrintElementTypeGroup("表格/文本", [
        {
          tid: "providerModule1.table", //元素类型的标识
          title: "订单数据", //用户托拽列表中显示的名称
          type: "table",
          columns: [
            [
              { title: "名称", align: "center", field: "NAME", width: 100, fiexed: false, rowspan: 1, colspan: 1 },
              { title: "数量", align: "center", field: "SL", width: 100 },
              { title: "条码", align: "center", field: "TM", width: 100 },
              { title: "规格", align: "center", field: "GG", width: 100 },
              { title: "单价", align: "center", field: "DJ", width: 100 },
              { title: "金额", align: "center", field: "JE", width: 100 },
              { title: "备注", align: "center", field: "DETAIL", width: 100 },
            ],
          ],
          options: {
            field: "table", //字段名称
            fontFamily: "",
            fields: [
              { text: "名称", field: "NAME" },
              { text: "数量", field: "SL" },
              { text: "规格", field: "GG" },
              { text: "条码", field: "TM" },
              { text: "单价", field: "DJ" },
              { text: "金额", field: "JE" },
              { text: "备注", field: "DETAIL" },
            ],
          },

          footerFormatter: function (options, rows, data, currentPageGridRowsData) {
            console.log(currentPageGridRowsData);
            if (data && data["totalCap"]) {
              return `<td style="padding:0 10px" colspan="100">${"应收金额大写: " + data["totalCap"]}</td>`;
            }
            return '<td style="padding:0 10px" colspan="100">应收金额大写: </td>';
          },
        },
        {
          tid: "providerModule1.customText", title: "文本", customText: "自定义文本", custom: true, type: "text",
          //title：标题;value：值;options：打印元素的选项值;templateData：模板数据;target：文本控件dom。
          // formatter: function (title, value, options, templateData, target) { return value == '1' ? '测试' : value; },
          //样式函数
          // styler: function (value, options, target, templateData) { return { color: 'red' } }
        },
        {
          tid: "providerModule1.longText",
          title: "长文本",
          type: "longText",
          options: {
            field: "test.longText",
            width: 200,
            testData: "长文本分页/不分页测试",
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
