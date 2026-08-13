import { hiprint } from "vue-plugin-hiprint";
import { printT } from '../i18n.js'
export const provider2 = function () {

  var addElementTypes = function (context) {
    context.removePrintElementTypes("providerModule2");
    context.addPrintElementTypes("providerModule2", [
      new hiprint.PrintElementTypeGroup(printT('常规'), [

        {
          tid: "providerModule2.header",
          title: printT('单据表头'),
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
          title: printT('单据类型'),
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
          title: printT('订单编号'),
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
          title: printT('业务日期'),
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
          title: printT('平台名称'),
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
          title: printT('装订线'),
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
          title: printT('网页'),
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
      new hiprint.PrintElementTypeGroup(printT('客户'), [
        {
          tid: "providerModule2.khname",
          title: printT('客户名称'),
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
          title: printT('客户电话'),
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
        {
          tid: "providerModule2.address",
          title: printT('收货地址'),
          data: "XX省XX市XX区XX路XX号",
          type: "longText",
          options: {
            field: "address",
            testData: "XX省XX市XX区XX路XX号",
            width: 200,
          },
        },
      ]),
      new hiprint.PrintElementTypeGroup(printT('财务'), [
        {
          tid: "providerModule2.amount",
          title: printT('金额'),
          data: "¥1,000.00",
          type: "text",
          options: {
            field: "amount",
            testData: "¥1,000.00",
            height: 16,
            fontSize: 6.75,
            fontWeight: "700",
            textAlign: "right",
            textContentVerticalAlign: "middle",
          },
        },
        {
          tid: "providerModule2.amountUpper",
          title: printT('大写金额'),
          data: "壹仟元整",
          type: "text",
          options: {
            field: "amountUpper",
            testData: "壹仟元整",
            height: 16,
            fontSize: 6.75,
            fontWeight: "700",
            textAlign: "left",
            textContentVerticalAlign: "middle",
          },
        },
        {
          tid: "providerModule2.taxRate",
          title: printT('税率'),
          data: "13%",
          type: "text",
          options: {
            field: "taxRate",
            testData: "13%",
            height: 16,
            fontSize: 6.75,
            textAlign: "center",
            textContentVerticalAlign: "middle",
          },
        },
      ]),
      new hiprint.PrintElementTypeGroup(printT('签章'), [
        {
          tid: "providerModule2.signLine",
          title: printT('签名行'),
          type: "text",
          options: {
            testData: "签名：_______________",
            height: 16,
            fontSize: 6.75,
            textAlign: "left",
            textContentVerticalAlign: "middle",
          },
        },
        {
          tid: "providerModule2.sealImage",
          title: printT('印章'),
          data: "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
          type: "image",
          options: {
            title: printT('印章'),
            field: "sealImage",
            src: "data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
            width: 80,
            height: 80,
          },
        },
        {
          tid: "providerModule2.dateLine",
          title: printT('日期行'),
          type: "text",
          options: {
            testData: "日期：____年____月____日",
            height: 16,
            fontSize: 6.75,
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
