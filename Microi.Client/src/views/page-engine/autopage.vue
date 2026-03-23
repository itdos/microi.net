<template>
    <div class="home" style="margin-top: 10px;">
        <formDesigner v-if="remoteObj.Id" :remoteObj="remoteObj" :components="newComponents" :widgets="newWidgets" />
    </div>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { formDesigner, EventBus, usePageEngineStore } from "./index.js";
import { newComponents, newWidgets } from "@/utils/extendedWidget";

export default {
    components: {
        formDesigner
    },
    data() {
        return {
            pageid: "", //获取页面主键
            remoteObj: {
                Id: "",
                Title: "",
                Number: "",
                Desc: "",
                JsonObj: {}
            },
            newComponents: newComponents,
            newWidgets: newWidgets,
            pageEngineStore: null
        };
    },
    async mounted() {
        // 初始化 store
        this.pageEngineStore = usePageEngineStore();

        // 设置token
        this.pageEngineStore.setToken(DiyCommon.getToken());

        // 注册事件监听
        this.registerEventListeners();

        // 加载表单数据
        await this.loadFormData();
    },
    beforeDestroy() {
        // 移除所有事件监听
        this.removeEventListeners();
    },
    created: function () {
        //获取页面参数
        this.pageid = this.$route.query.Id || this.$route.params?.Id;
    },
    methods: {
        async loadFormData() {
            if (!this.pageid) return;

            var res = await DiyCommon.FormEngine.GetFormData({
                FormEngineKey: "mic_page",
                Id: this.pageid
            });

            if (res.Code === 1 && res.Data) {
                var JsonObj = {};
                if (res.Data.JsonObj) {
                    JsonObj = typeof res.Data.JsonObj === "string" ? JSON.parse(res.Data.JsonObj) : res.Data.JsonObj;
                }
                this.remoteObj = {
                    Id: this.pageid,
                    Title: res.Data.Title || "",
                    Number: res.Data.Number || "",
                    Desc: res.Data.Desc || "",
                    JsonObj: JsonObj
                };
            }
        },
        registerEventListeners() {
            //监听保存页面JSON事件
            EventBus.on("saveFormJson", async (saveFormJson) => {
                console.log("监听saveFormJson", saveFormJson);
                if (saveFormJson.Id == this.pageid) {
                    var model = {
                        Title: saveFormJson.Title,
                        Desc: saveFormJson.Desc,
                        JsonObj: JSON.stringify(saveFormJson.JsonObj)
                    };
                    await DiyCommon.FormEngine.UptFormData({
                        FormEngineKey: "mic_page",
                        Id: this.pageid,
                        _RowModel: model
                    });
                }
            });

            //监听日历选择日期事件
            EventBus.on("calendarSelDate", (data) => {
                console.log("监听calendarSelDate", data);
            });

            //卡片更多跳转
            EventBus.on("cartMoreLink", (linkurl, linktype) => {
                console.log("监听cartMoreLink", linkurl, linktype);
                if (linktype == "router" && linkurl) {
                    this.$router.push(linkurl);
                }
            });

            //链接组件跳转
            EventBus.on("linkWidget", (linkurl, linktype) => {
                console.log("监听linkWidget", linkurl, linktype);
                if (linktype == "router" && linkurl) {
                    this.$router.push(linkurl);
                }
            });

            //鱼骨图跳转
            EventBus.on("fishWidget", (linkurl) => {
                console.log("监听fishWidget", linkurl);
                if (linkurl) {
                    this.$router.push(linkurl);
                }
            });

            //步骤跳转
            EventBus.on("stepsWidget", (id, linkurl) => {
                console.log("监听stepsWidget", id, linkurl);
                if (linkurl) {
                    this.$router.push(linkurl);
                }
            });

            //地图marker点击事件
            EventBus.on("mapMarkerClick", (item) => {
                console.log("监听mapMarkerClick", item);
            });

            //点击区域地图事件
            EventBus.on("areaMapClick", (item) => {
                console.log("监听areaMapClick", item);
            });

            //点击高级日历组件事件
            EventBus.on("fullCalendarClick", (item) => {
                console.log("监听fullCalendarClick", item);
            });
        },
        removeEventListeners() {
            EventBus.off("saveFormJson");
            EventBus.off("calendarSelDate");
            EventBus.off("cartMoreLink");
            EventBus.off("linkWidget");
            EventBus.off("fishWidget");
            EventBus.off("stepsWidget");
            EventBus.off("mapMarkerClick");
            EventBus.off("areaMapClick");
            EventBus.off("fullCalendarClick");
        }
    }
};
</script>

<style lang="scss">
// Anderson注释：否则将导致页面边距10px消失
.microi.Classic .fixed-header-microi,
.microi.Classic .hasTagsView .app-main-microi {
    // 2025-05-08注释，这两句导致加载界面引擎后，其它页面样式也会错乱  --by Anderson
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
