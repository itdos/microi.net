<template>
  <div class="home">
    <iframe
      ref="myIframe"
      @load="onIframeLoad"
      id="iframe"
      :src="DataAppend.Url"
      frameborder="0"
      style="width: 100%; height: 100%"
    ></iframe>
  </div>
</template>
<script>
import { DiyCommon } from "@/utils/diy.common";
export default {
  props: {
    DataAppend: {
      type: Object,
      default: () => {}
    }
  },
  data() {
    return {
      url: "", //获取页面主键
      loading: ""
    };
  },
  methods: {
    onIframeLoad() {
      console.log("Iframe 已加载完成");
      this.loading = false;
      this.sendMessageToIframe();
    },
    async sendMessageToIframe() {
      const iframe = this.$refs.myIframe;
      if (this.DataAppend && this.DataAppend.PrintId) {
        // 使用 postMessage 发送数据给 iframe
        var res = await DiyCommon.FormEngine.GetFormData({
          FormEngineKey: "mic_print",
          Id: this.DataAppend.PrintId
        });

        if (res.Code === 1 && res.Data) {
          var PageObj = {};
          if (res.Data.PageObj) {
            PageObj = JSON.parse(res.Data.PageObj);
          }
          var demoObj = {
            Id: this.DataAppend.PrintId,
            Title: res.Data.Title || "",
            Number: res.Data.Number || "",
            Desc: res.Data.Desc || "",
            DataApi: this.DataAppend.DataApi || "",
            PageObj: PageObj, // '' 也可以
            PrintObj: res.Data.PrintObj || {}
          };
          const dataToSend = {
            iframeToken: DiyCommon.getToken(),
            iframeFormData: JSON.stringify(demoObj)
          };
          console.log("dataToSend", dataToSend);
          // 使用 postMessage 发送数据给 iframe
          iframe.contentWindow.postMessage(dataToSend, "*");
        }
      }
    }
  }
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
