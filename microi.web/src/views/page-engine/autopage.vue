<template>
  <div class="home">
    <iframe
      ref="myIframe"
      @load="onIframeLoad"
      id="iframe"
      src="/autopage/"
      frameborder="0"
      style="width: 100%; height: 100%"
    ></iframe>
  </div>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
export default {
  data() {
    return {
      pageid: "", //获取页面主键
      loading: "",
    };
  },
  mounted() {
    // 监听iframe内部的message事件
    window.addEventListener("message", this.handleMessage);
  },
  beforeDestroy() {
    // 组件销毁前移除监听器
    window.removeEventListener("message", this.handleMessage, false);
  },
  created: function () {
    //获取页面参数
    this.pageid = this.$route.query.Id;
  },
  methods: {
    onIframeLoad() {
      console.log("Iframe 已加载完成");
      this.loading = false;
      this.sendMessageToIframe();
    },
    async sendMessageToIframe() {
      const iframe = this.$refs.myIframe;

      // 使用 postMessage 发送数据给 iframe
      var res = await DiyCommon.FormEngine.GetFormData({
        FormEngineKey: "mic_page",
        Id: this.pageid,
      });

      if (res.Code === 1 && res.Data) {
        var JsonObj = {};
        if (res.Data.JsonObj) {
          JsonObj = JSON.parse(res.Data.JsonObj);
        }
        var demoObj = {
          Id: this.pageid,
          Title: res.Data.Title || "",
          Number: res.Data.Number || "",
          Desc: res.Data.Desc || "",
          JsonObj: JsonObj,
        };
        const dataToSend = {
          iframeToken: DiyCommon.getToken(),
          iframeFormData: JSON.stringify(demoObj),
        };
        // 使用 postMessage 发送数据给 iframe
        iframe.contentWindow.postMessage(dataToSend, "*");
      }
    },
    // 获取iframe传过来的信息
    async handleMessage(event) {
      // event表示iframe传过来的信息
      if (event.data) {
        switch (event.data.key) {
          //保存页面json
          case "saveFormJson":
            console.log("已接到到来自iframe消息,saveFormJson");
            var obj = JSON.parse(event.data.value);
            var model = {
              Title: obj.Title,
              Desc: obj.Desc,
              JsonObj: JSON.stringify(obj.JsonObj),
            };
            var res = await DiyCommon.FormEngine.UptFormData({
              FormEngineKey: "mic_page",
              Id: this.pageid,
              _RowModel: model,
            });
            break;
          //监听日历选择日期事件
          case "calendarSelDate":
            console.log(
              "已接到到来自iframe消息,calendarSelDate",
              event.data.value
            );
            break;
          //卡片更多跳转
          case "cartMoreLink":
            console.log(
              "已接到到来自iframe消息,cartMoreLink 监听",
              event.data.value
            );
            break;
          //链接组件跳转
          case "linkWidget":
            console.log("已接到到来自iframe消息,linkWidget", event.data.value);
            break;
          //鱼骨图跳转
          case "fishWidget":
            console.log("已接到到来自iframe消息,fishWidget", event.data.value);
            break;
          //地图marker点击事件
          case "mapWidget":
            console.log("已接到到来自iframe消息,mapWidget", event.data.value);
            break;
          //步骤跳转
          case "stepsWidget":
            console.log("已接到到来自iframe消息,stepsWidget", event.data.value);
            break;
          default:
            break;
        }
      }
    },
  },
};
</script>

<style lang="scss">
.microi.Classic .fixed-header-microi,
.microi.Classic .hasTagsView .app-main-microi {
  padding-left: 0px !important;
  padding-right: 0px !important;
}
.microi.Classic .app-main-microi {
  padding-top: 0px !important;
}
</style>

<style lang="scss" scoped>
.home {
  width: 100%;
  height: 100vh;
  background-color: #fff;
}
</style>
