<template>
    <div class="home">
        <formRenderer v-if="remoteObj.Id" :remoteObj="remoteObj" />
    </div>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { formRenderer, EventBus, usePageEngineStore } from "./index.js";

export default {
    components: {
        formRenderer
    },
    data() {
        return {
            pageid: "", //获取页面主键
            RoutePath: "", //--2025-03-29新增根据路由获取界面引擎数据 --by Anderosn
            filePath: "",
            remoteObj: {
                Id: "",
                Title: "",
                Number: "",
                Desc: "",
                JsonObj: {},
                filePath: ""
            },
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
        this.pageid = this.$route.query.Id || this.$route.params?.Id || "";
        this.filePath = this.$route.query.filePath || this.$route.params?.filePath || "";
        this.RoutePath = this.$route.fullPath;
        let index = this.$route.fullPath.indexOf("?"); // 找到逗号的位置
        if (index !== -1) {
            this.RoutePath = this.$route.fullPath.slice(0, index); // 截断字符串
        }
    },
    methods: {
        async loadFormData() {
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
                    JsonObj = typeof res.Data.JsonObj === "string" ? JSON.parse(res.Data.JsonObj) : res.Data.JsonObj;
                }
                this.remoteObj = {
                    Id: this.pageid,
                    Title: res.Data.Title || "",
                    Number: res.Data.Number || "",
                    Desc: res.Data.Desc || "",
                    JsonObj: JsonObj,
                    filePath: this.filePath
                };
            }
        },
        registerEventListeners() {
            //监听保存页面JSON事件
            EventBus.on("saveFormJson", (saveFormJson) => {
                console.log("监听saveFormJson", saveFormJson);
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
                if (item.path) {
                    this.$router.push({
                        path: item.path,
                        query: {
                            name: item.name,
                            adcode: item.adcode
                        }
                    });
                }
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
