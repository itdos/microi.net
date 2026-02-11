<template>
    <div class="home">
        <printDoprint v-if="remoteObj.Id" :remoteObj="remoteObj" />
    </div>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { printDesigner, printDoprint, printPreview, EventBus, usePrintEngineStore } from "./index.js";
import { createPinia } from "pinia";

export default {
    components: {
        printDesigner,
        printDoprint,
        printPreview
    },
    data() {
        return {
            pageid: "", //获取页面主键
            remoteObj: {
                Id: "",
                Title: "",
                Number: "",
                Desc: "",
                DataApi: "",
                PageObj: {},
                PrintObj: {}
            },
            printEngineStore: null
        };
    },
    props: {
        DataAppend: {
            type: Object,
            default: () => {}
        }
    },
    async mounted() {
        // 初始化 pinia store
        const pinia = createPinia();
        this.printEngineStore = usePrintEngineStore(pinia);

        // 设置token
        this.printEngineStore.setToken(DiyCommon.getToken());

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
        this.pageid = this.$route.query.Id;
    },
    methods: {
        async loadFormData() {
            var self = this;
            var appendPageId = this.DataAppend && this.DataAppend.PrintId;
            if(appendPageId){
                self.pageid = appendPageId;
            }
            if (!this.pageid) return;

            var res = await DiyCommon.FormEngine.GetFormData({
                FormEngineKey: "mic_print",
                Id: this.pageid
            });
            if (res.Code === 1 && res.Data) {
                var PageObj = {};
                var PrintObj = {};
                if (res.Data.PageObj) {
                    PageObj = typeof res.Data.PageObj === "string" ? JSON.parse(res.Data.PageObj) : res.Data.PageObj;
                }
                if (res.Data.PrintObj) {
                    PrintObj = typeof res.Data.PrintObj === "string" ? JSON.parse(res.Data.PrintObj) : res.Data.PrintObj;
                }
                this.remoteObj = {
                    Id: this.pageid,
                    Title: res.Data.Title || "",
                    Number: res.Data.Number || "",
                    Desc: res.Data.Desc || "",
                    DataApi: (this.DataAppend && this.DataAppend.DataApi) || res.Data.DataApi || "",
                    PageObj: PageObj,
                    PrintObj: PrintObj
                };
            }
        },
        registerEventListeners() {
            //监听保存打印模板JSON事件
            EventBus.on("savePrintJson", async (savePrintJson) => {
                console.log("监听savePrintJson", savePrintJson);
                var model = {
                    Title: savePrintJson.Title,
                    Desc: savePrintJson.Desc,
                    DataApi: savePrintJson.DataApi,
                    PageObj: JSON.stringify(savePrintJson.PageObj),
                    PrintObj: JSON.stringify(savePrintJson.PrintObj)
                };
                await DiyCommon.FormEngine.UptFormData({
                    FormEngineKey: "mic_print",
                    Id: this.pageid,
                    _RowModel: model
                });
            });
        },
        removeEventListeners() {
            EventBus.off("savePrintJson");
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
