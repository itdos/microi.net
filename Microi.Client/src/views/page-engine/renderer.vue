<template>
    <div class="home" :class="{ 'is-embedded': isEmbedded }">
        <formRenderer v-if="remoteObj.Id" :remoteObj="remoteObj" />
        <div v-else class="pe-page-skeleton">
            <div class="pe-page-skeleton__header"></div>
            <div class="pe-page-skeleton__stats">
                <span v-for="item in 4" :key="'stat-' + item"></span>
            </div>
            <div class="pe-page-skeleton__grid">
                <div v-for="item in 4" :key="'panel-' + item" class="pe-page-skeleton__panel">
                    <i></i>
                    <b></b>
                    <em></em>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { DiyCommon } from "@/utils/diy.common";
import { formRenderer, EventBus, usePageEngineStore } from "./index.js";
import { computed } from "vue";
import { useDiyStore } from "@/pinia";

export default {
    components: {
        formRenderer
    },
    setup() {
        const diyStore = useDiyStore();
        const currentUser = computed(() => diyStore.GetCurrentUser || {});
        return { currentUser };
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
                filePath: "",
                CanDesign: false,
                IsEmbedded: false
            },
            pageEngineStore: null
        };
    },
    computed: {
        isEmbedded() {
            return this.$route.meta?.embedded === true || this.$route.query?.embedded === "1";
        },
        canDesignPage() {
            var user = this.currentUser || {};
            var adminValue = String(user._IsAdmin ?? "").toLowerCase();
            var isAdmin = user._IsAdmin === true || Number(user._IsAdmin) === 1 || adminValue === "true";
            return isAdmin || Number(user.Level || 0) >= 9999;
        }
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

        if (this.isEmbedded) {
            document.documentElement.classList.add("pe-embedded-document");
            document.body.classList.add("pe-embedded-document");
        }
    },
    beforeUnmount() {
        // 移除所有事件监听
        this.removeEventListeners();
        document.documentElement.classList.remove("pe-embedded-document");
        document.body.classList.remove("pe-embedded-document");
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
        openPageDesigner(pageId) {
            var targetPageId = pageId || this.remoteObj.Id;
            if (!targetPageId || !this.canDesignPage) return;
            if (this.isEmbedded && window.parent && window.parent !== window) {
                window.parent.postMessage({
                    key: "openPageDesigner",
                    pageId: targetPageId
                }, window.location.origin);
                return;
            }
            this.$router.push({
                path: "/mic/autopage",
                query: { Id: targetPageId }
            });
        },
        handlePageDesignerMessage(event) {
            if (event.origin && event.origin !== window.location.origin && event.origin !== "null") return;
            var data = event.data || {};
            if (data.key !== "openPageDesigner" || !data.pageId) return;
            this.openPageDesigner(data.pageId);
        },
        publishPageDesignContext() {
            if (!this.remoteObj.Id || !this.canDesignPage) return;
            var detail = {
                pageId: this.remoteObj.Id,
                routeFullPath: this.$route.fullPath,
                title: this.remoteObj.Title || this.$t("Msg.PageEngine.title")
            };
            this.$route.meta.PageEngineId = this.remoteObj.Id;
            window.dispatchEvent(new CustomEvent("microi:page-engine-design-context", { detail: detail }));
        },
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
                    try {
                        JsonObj = typeof res.Data.JsonObj === "string" ? JSON.parse(res.Data.JsonObj) : res.Data.JsonObj;
                    } catch (error) {
                        console.error("[PageEngine] JsonObj parse failed:", error);
                        JsonObj = {};
                    }
                }
                this.remoteObj = {
                    Id: this.pageid,
                    Title: res.Data.Title || "",
                    Number: res.Data.Number || "",
                    Desc: res.Data.Desc || "",
                    JsonObj: JsonObj,
                    filePath: this.filePath,
                    CanDesign: this.canDesignPage,
                    IsEmbedded: this.isEmbedded
                };
                this.publishPageDesignContext();
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
            EventBus.on("cartMoreLink", (linkurl, linktype = "router") => {
                console.log("监听cartMoreLink", linkurl, linktype);
                if ((!linktype || linktype == "router") && linkurl) {
                    this.$router.push(linkurl);
                }
            });

            //链接组件跳转
            EventBus.on("linkWidget", (linkurl, linktype = "router") => {
                console.log("监听linkWidget", linkurl, linktype);
                if ((!linktype || linktype == "router") && linkurl) {
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
            EventBus.on("openPageDesigner", (pageId) => {
                this.openPageDesigner(pageId);
            });
            window.addEventListener("message", this.handlePageDesignerMessage);
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
            EventBus.off("openPageDesigner");
            window.removeEventListener("message", this.handlePageDesignerMessage);
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

html.pe-embedded-document,
body.pe-embedded-document,
body.pe-embedded-document #app {
    height: auto !important;
    min-height: 0 !important;
    overflow: hidden !important;
}
</style>

<style lang="scss" scoped>
.home {
    position: relative;
    width: 100%;
    height: 100%;
    // background-color: #fff;
}

.home.is-embedded {
    height: auto;
    min-height: 0;
    overflow: visible;
}

.pe-page-skeleton {
    width: 100%;
    min-height: calc(100vh - 130px);
    padding: 12px;
    box-sizing: border-box;
}

.pe-page-skeleton__header,
.pe-page-skeleton__stats span,
.pe-page-skeleton__panel,
.pe-page-skeleton__panel i,
.pe-page-skeleton__panel b,
.pe-page-skeleton__panel em {
    display: block;
    border-radius: 6px;
    background: linear-gradient(90deg, var(--el-fill-color-light), var(--el-fill-color), var(--el-fill-color-light));
    background-size: 220% 100%;
    animation: pe-page-skeleton-pulse 1.3s ease-in-out infinite;
}

.pe-page-skeleton__header {
    width: 180px;
    height: 18px;
    margin-bottom: 16px;
}

.pe-page-skeleton__stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 12px;
}

.pe-page-skeleton__stats span {
    height: 88px;
}

.pe-page-skeleton__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.pe-page-skeleton__panel {
    min-height: 240px;
    padding: 16px;
    box-sizing: border-box;
    background: var(--el-bg-color, #fff);
    border: 1px solid var(--el-border-color-lighter);
}

.pe-page-skeleton__panel i {
    width: 32%;
    height: 14px;
    margin-bottom: 24px;
}

.pe-page-skeleton__panel b {
    height: 120px;
    margin-bottom: 16px;
}

.pe-page-skeleton__panel em {
    width: 72%;
    height: 12px;
}

@keyframes pe-page-skeleton-pulse {
    0% {
        background-position: 0% 50%;
    }
    100% {
        background-position: 100% 50%;
    }
}

@media screen and (max-width: 768px) {
    .pe-page-skeleton__stats,
    .pe-page-skeleton__grid {
        grid-template-columns: 1fr;
    }
}
</style>
