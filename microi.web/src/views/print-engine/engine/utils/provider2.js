import { hiprint } from "vue-plugin-hiprint";
export const provider2 = function () {

  var addElementTypes = function (context) {
    context.removePrintElementTypes("providerModule2");
    context.addPrintElementTypes("providerModule2", [
      new hiprint.PrintElementTypeGroup("常规", [

        {
          tid: "providerModule2.header",
          title: "单据表头",
          data: "单据表头",
          type: "text",
          options: {
            testData: "单据表头",
            height: 17,
            fontSize: 16.5,
            fontWeight: "700",
            textAlign: "center",
            hideTitle: true,
          },
        },
        {
          tid: "providerModule2.type",
          title: "单据类型",
          data: "单据类型",
          type: "text",
          options: {
            testData: "单据类型",
            height: 16,
            fontSize: 15,
            fontWeight: "700",
            textAlign: "center",
            hideTitle: true,
          },
        },
        {
          tid: "providerModule2.order",
          title: "订单编号",
          data: "XS888888888",
          type: "text",
          options: {
            field: "order",
            testData: "XS888888888",
            height: 16,
            fontSize: 6.75,
            fontWeight: "700",
            textAlign: "left",
            textContentVerticalAlign: "middle",
          },
        },
        {
          tid: "providerModule2.date",
          title: "业务日期",
          data: "2020-01-01",
          type: "text",
          options: {
            field: "date",
            testData: "2020-01-01",
            height: 16,
            fontSize: 6.75,
            fontWeight: "700",
            textAlign: "left",
            textContentVerticalAlign: "middle",
          },
        },
        {
          tid: "providerModule2.platform",
          title: "平台名称",
          data: "平台名称",
          type: "text",
          options: {
            field: "platform",
            testData: "平台名称",
            height: 17,
            fontSize: 16.5,
            fontWeight: "700",
            textAlign: "center",
            hideTitle: true,
          },
        },

        {
          tid: "providerModule2.bindingline",
          title: "装订线",
          data: "",
          type: "text",
          options: {
            field: "",
            testData: "装订线",
            width: 15,
            height: 62,
            lineHeight: 18,
            fixed: true,
            backgroundColor: "#ffffff"
          },
        },

        {
          tid: "providerModule2.iframe",
          title: "网页",
          type: "html",
          options: {
            width: 200,
            height: 200,
            formatter: `function(t, e, d) {
              var html =  \`<head><style>
                 .htmlprint {
                   width: 100%;
                   height: 100%;
                   padding: 10px;
                 }
              }
             </style>
             <script>
                function onIframeClick(event) {
                event.preventDefault(); // 阻止默认行为
                console.log("Iframe 被点击");
                }
             </script>
           </head>
            <body>

               <p>温馨提示：内嵌网页需自适应，记得把我删掉</p>
            <div class="htmlprint">
         
             <iframe
                src="https://www.nbweixin.cn/autopage/"
                frameborder="0"
                width="100%"
                height="100%"
                onload="onIframeLoad(event)"
               ></iframe>
    
            </div>
            </body>\`
            return html;
           }`,
          },
        },

      ]),
      new hiprint.PrintElementTypeGroup("客户", [
        {
          tid: "providerModule2.khname",
          title: "客户名称",
          data: "高级客户",
          type: "text",
          options: {
            field: "realname",
            testData: "高级客户",
            height: 16,
            fontSize: 6.75,
            fontWeight: "700",
            textAlign: "left",
            textContentVerticalAlign: "middle",
          },
        },
        {
          tid: "providerModule2.tel",
          title: "客户电话",
          data: "18888888888",
          type: "text",
          options: {
            field: "tel",
            testData: "18888888888",
            height: 16,
            fontSize: 6.75,
            fontWeight: "700",
            textAlign: "left",
            textContentVerticalAlign: "middle",
          },
        },
      ]),
    ]);
  };
  return {
    addElementTypes: addElementTypes,
  };
};
