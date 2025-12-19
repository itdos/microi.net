<template>
  <div class="home">
    <iframe ref="myIframe" @load="onIframeLoad" id="iframe" src="/autopage/#/renderer" frameborder="0" style="width: 100%; height: 100%"></iframe>
  </div>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
export default {
  data() {
    return {
      pageid: "", //获取页面主键
      RoutePath: "", //--2025-03-29新增根据路由获取界面引擎数据 --by Anderosn
      loading: "",
      filePath: ""
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
    this.pageid = this.$route.query.Id || this.$route.params?.Id || "";
    this.filePath = this.$route.query.filePath || this.$route.params?.filePath || "";
    this.RoutePath = this.$route.fullPath;
    let index = this.$route.fullPath.indexOf("?"); // 找到逗号的位置
    if (index !== -1) {
      this.RoutePath = this.$route.fullPath.slice(0, index); // 截断字符串
    }
  },
  methods: {
    onIframeLoad() {
      this.loading = false;
      this.sendMessageToIframe();
    },
    async sendMessageToIframe() {
      const iframe = this.$refs.myIframe;
      let lang = "none";
      if (typeof window.translate !== "undefined") {
        lang = translate.language.getCurrent();
        console.log("translate.language.getCurrent()", lang);
      }

      // 使用 postMessage 发送数据给 iframe
      var _where = [];
      if (this.pageid) {
        _where.push({
          Name: "Id",
          Value: this.pageid,
          Type: "="
        });
      } else {
        //--2025-03-29新增根据路由获取界面引擎数据 --by Anderosn
        _where.push({
          Name: "RoutePath",
          Value: this.RoutePath,
          Type: "="
        });
      }
      var res = await DiyCommon.FormEngine.GetFormData({
        FormEngineKey: "mic_page",
        _Where: _where
      });

      if (res.Code === 1 && res.Data) {
        var JsonObj = {};
        this.pageid = res.Data.Id;
        if (res.Data.JsonObj) {
          JsonObj = JSON.parse(res.Data.JsonObj);
        }
        var demoObj = {
          Id: this.pageid,
          Title: res.Data.Title || "",
          Number: res.Data.Number || "",
          Desc: res.Data.Desc || "",
          JsonObj: JsonObj,
          filePath: this.filePath
        };
        const dataToSend = {
          iframeToken: DiyCommon.getToken(),
          iframeLang: lang,
          iframeFormData: JSON.stringify(demoObj)
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
            break;
          //监听日历选择日期事件
          case "calendarSelDate":
            // crm 日历事件
            // var res = await DiyCommon.FormEngine.GetTableData({
            //   FormEngineKey : 'diy_richengguanli',
            //   _Where: [{Name: 'Riqi', Value: event.data.value, Type: '='}]
            // });
            // var arr = '';
            // if(res.Code === 1 && res.Data.length>0){
            //   res.Data.forEach((item,index)=>{
            //     var fuhao = '';
            //     if(index > 0){
            //       fuhao = ', ';
            //     }
            //     arr = arr +fuhao+item.Xingming + '：'+ '[' +item.ShijianLX +']'+item.ShijianMS
            //   });
            // }else{
            //   arr = '今日无事件';
            // }
            // this.DiyCommon.Tips(arr,true);
            console.log("已接到到来自iframe消息,calendarSelDate", event.data.value);
            break;
          //卡片更多跳转
          case "cartMoreLink":
            console.log("已接到到来自iframe消息,cartMoreLink 监听", event.data.value);
            if (event.data.value) this.$router.push(event.data.value);
            break;
          //链接组件跳转
          case "linkWidget":
            console.log("已接到到来自iframe消息,linkWidget", event.data.value);
            if (event.data.value) this.$router.push(event.data.value);
            break;
          //鱼骨图跳转
          case "fishWidget":
            console.log("已接到到来自iframe消息,fishWidget", event.data.value);
            if (event.data.value) this.$router.push(event.data.value);
            break;
          //步骤跳转
          case "stepsWidget":
            console.log("已接到到来自iframe消息,stepsWidget", event.data.value);
            if (event.data.value) this.$router.push(event.data.value);
            break;
          //点击区域地图事件
          case "areaMapWidget":
            console.log("已接到到来自iframe消息,areaMapWidget", event.data.value);
            let obj = JSON.parse(event.data.value);
            if (obj.path) {
              this.$router.push({
                path: obj.path,
                query: {
                  name: obj.name,
                  adcode: obj.adcode
                }
              });
            }
            break;
          default:
            break;
        }
      }
    }
  }
};
</script>

<style lang="scss">
  // Anderson注释：否则将导致页面边距10px消失
.microi.Classic .fixed-header-microi,
.microi.Classic .hasTagsView .app-main-microi {
  // padding-left: 0px !important;
  // padding-right: 0px !important;
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
