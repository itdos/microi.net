<template>
    <div class="home">
        <iframe ref="myIframe" @load="onIframeLoad" id="iframe" src="/autoprint/" frameborder="0" style="width: 100%; height: calc(100vh - 100px)"></iframe>
    </div>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
export default {
    data() {
        return {
            pageid: "", //获取页面主键
            loading: ""
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
                FormEngineKey: "mic_print",
                Id: this.pageid
            });

            if (res.Code === 1 && res.Data) {
                var PageObj = {};
                if (res.Data.PageObj) {
                    PageObj = JSON.parse(res.Data.PageObj);
                }
                var demoObj = {
                    Id: this.pageid,
                    Title: res.Data.Title || "",
                    Number: res.Data.Number || "",
                    Desc: res.Data.Desc || "",
                    DataApi: res.Data.DataApi || "",
                    PageObj: PageObj, // '' 也可以
                    PrintObj: res.Data.PrintObj || {}
                };
                const dataToSend = {
                    iframeToken: DiyCommon.getToken(),
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
                    case "savePrintJson":
                        var obj = JSON.parse(event.data.value);
                        //let obj = JSON.parse(event.data.value)
                        var model = {
                            Title: obj.Title,
                            Desc: obj.Desc,
                            DataApi: obj.DataApi,
                            PageObj: JSON.stringify(obj.PageObj),
                            PrintObj: JSON.stringify(obj.PrintObj)
                        };
                        var res = await DiyCommon.FormEngine.UptFormData({
                            FormEngineKey: "mic_print",
                            Id: this.pageid,
                            _RowModel: model
                        });
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
    height: 100%;
    // background-color: #fff;
}
</style>
