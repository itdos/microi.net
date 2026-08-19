<template>
    <div class="forklift-management left-right-page">
        <el-row :gutter="10" class="main-container left-right-layout" v-if="ShowRowView">
            <el-col v-if="!diyStore.IsPhoneView" :span="colData.Left" class="left-right-col left-tree-col">
                <el-card class="box-card left-tree-card">
                    <LeftView :LeftTreeData="LeftTreeData" @LeftViewClick="LeftViewClick" @ShowRightClick="ShowRightClick"></LeftView>
                </el-card>
            </el-col>
            <el-col :span="diyStore.IsPhoneView ? 24 : colData.Right" class="left-right-col right-table-col">
                <el-card class="products-card right-content-card">
                    <div class="mobile-tree-toolbar" v-if="diyStore.IsPhoneView">
                        <el-button circle type="primary" @click="MobileTreeDrawer = true" title="打开项目目录" aria-label="打开项目目录">
                            <el-icon><Operation /></el-icon>
                        </el-button>
                    </div>
                    <div class="right-content-body">
                        <RightView ref="ref_RightView" class="right-form-panel" :RightViewData="RightViewData" v-if="(RightViewType === '表单' || RightViewType === '表单/表格') && ShowRightView"></RightView>
                        <div class="left-right-table-host" v-if="(RightViewType === '表格' || RightViewType === '表单/表格') && ShowRightView">
                            <DiyTableRowlist
                                ref="ref_RightDiyTable"
                                ContainerClass="left-right-diy-table"
                                :PropsWhere="whereList"
                                :ParentV8="clickData"
                                :DataAppend="rightTableDataAppend"
                                :TableChildConfig="tableChildRelation.TableChildConfig || null"
                                :TableChildFkFieldName="tableChildRelation.ChildFieldName || LeftTreeData.ZibiaoGLZD || ''"
                                :PrimaryTableFieldName="tableChildRelation.ParentFieldName || LeftTreeData.FubiaoGLZD || 'Id'"
                                :TableChildTableRowId="selectedParentValue"
                                :FatherFormModel="selectedParentRow"
                            ></DiyTableRowlist>
                        </div>
                    </div>
                </el-card>
            </el-col>
        </el-row>
        <el-drawer
            v-if="diyStore.IsPhoneView"
            v-model="MobileTreeDrawer"
            direction="ltr"
            size="88%"
            :append-to-body="true"
            :modal="true"
            :close-on-click-modal="true"
            :close-on-press-escape="true"
            :show-close="true"
            class="left-tree-mobile-drawer"
        >
            <template #header>
                <div class="mobile-tree-drawer-title">
                    <el-icon><Operation /></el-icon>
                    <span>{{ LeftTreeData.ShubiaoT || "项目目录" }}</span>
                </div>
            </template>
            <LeftView
                class="mobile-tree-drawer-content"
                :LeftTreeData="LeftTreeData"
                @LeftViewClick="MobileLeftViewClick"
                @ShowRightClick="ShowRightClick"
            ></LeftView>
        </el-drawer>
    </div>
</template>

<script>
import { computed, defineAsyncComponent } from "vue";
import { useDiyStore } from "@/pinia";
import LeftView from "@/views/form-engine/left-right/LeftView.vue";
import RightView from "@/views/form-engine/left-right/RightView.vue";

// 🔥 改为异步导入，避免循环依赖和初始化顺序问题
const DiyTableRowlist = defineAsyncComponent(() => import("@/views/form-engine/diy-table.vue"));

export default {
    components: {
        LeftView,
        RightView,
        DiyTableRowlist
    },
    setup() {
        const diyStore = useDiyStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        return { diyStore, GetCurrentUser };
    },
    data() {
        return {
            colData: {
                Left: 8,
                Right: 16
            },
            ShowRowView: false,
            MenuId: this.$route.meta.Id,
            LeftTreeData: {},
            RightViewData: {},
            whereList: [],
            clickData: {
                Origin: "BomProject"
            },
            LeftViewType: "",
            RightViewType: "",
            WhereType: "",
            ShowRightView: true,
            rightTableDataAppend: {},
            tableChildRelation: {},
            selectedParentRow: {},
            selectedParentValue: "",
            // “全部”是左右布局的初始选中态。保持点击态与筛选态一致，
            // 避免首次点击“全部”时把已经加载好的右表数据误清空。
            LastClickNode: { _IsAllCategory: true },
            MobileTreeDrawer: false,
            MobileTreeTitle: "全部项目"
        };
    },
    computed: {},
    created() {
        this.getPageConfigureItems();
    },
    methods: {
        /**
         * 获取页面初始化配置项方法
         * */
        async getPageConfigureItems() {
            var res = await this.DiyCommon.PostAsync(this.DiyApi.GetLeftRightPageConfig, {
                SysMenuId: this.MenuId
            });
            if (res.Code !== 1) {
                this.DiyCommon.Tips(res.Msg, false);
            } else {
                if (res.Data.ZuoyouXSZB && res.Data.ZuoyouXSZB.split("/").length === 2) {
                    var ZuoyouXSZB = res.Data.ZuoyouXSZB.split("/");

                    this.colData = {
                        Left: parseInt(ZuoyouXSZB[0], 10),
                        Right: parseInt(ZuoyouXSZB[1], 10)
                    };
                }
                if (!res.Data.YoubianZSZJ) {
                    this.$notify.error({
                        title: "错误提示",
                        message: "右边展示组件未设置！",
                        position: "bottom-right"
                    });
                    return;
                }
                if (res.Data.YoubianZSZJ === "表格" && (!res.Data.FubiaoGLZD || !res.Data.ZibiaoGLZD)) {
                    this.$notify.error({
                        title: "错误提示",
                        message: "父表或子表关联字段未设置，右边展示组件初始化失败！",
                        position: "bottom-right"
                    });
                    return;
                }
                if (res.Data.YoubianZSZJ === "表格" && !res.Data.GuanlianPPLJ) {
                    this.$notify.error({
                        title: "错误提示",
                        message: "右边展示组件匹配逻辑未设置，条件匹配失败",
                        position: "bottom-right"
                    });
                    return;
                }
                this.WhereType = res.Data.GuanlianPPLJ;
                this.whereList = [
                    // {
                    //     Name: res.Data.ZibiaoGLZD,
                    //     Value: "XXXXXXXXXX",
                    //     Type: this.WhereType
                    // }
                ];
                this.RightViewType = res.Data.YoubianZSZJ;
                this.tableChildRelation = res.Data.TableChildRelation || {};
                this.LeftTreeData = {
                    ...res.Data
                };
                this.ShowRowView = true;
            }
        },
        async LeftViewClick(data) {
            var self = this;
            if (data && data._IsAllCategory === true) {
                if (self.LastClickNode && self.LastClickNode._IsAllCategory === true) {
                    return;
                }
                self.LastClickNode = data;
                self.ShowRightClick(true);
                self.clickData = {
                    Origin: "BomProject",
                    IsAllCategory: true
                };
                self.rightTableDataAppend = {};
                self.selectedParentRow = {};
                self.selectedParentValue = "";
                self.MobileTreeTitle = "全部项目";
                if (self.RightViewType === "表格" || self.RightViewType === "表单/表格") {
                    self.whereList = [];
                }
                return;
            }
            if(self.LastClickNode.Id == data.Id){
                return;
            }
            self.LastClickNode = data;
            self.MobileTreeTitle = data.TreeTitle || data.Name || data.Code || "已选项目";
            if (this.LeftTreeData.YincangBSF) {
                if (data[this.LeftTreeData.YincangBSF]) {
                    this.ShowRightClick(false);
                } else {
                    this.ShowRightClick(true);
                }
            }
            var self = this;
            if (self.LeftTreeData.ShujieDDJSJ) {
                var V8 = {
                    Origin: self.clickData && self.clickData.Origin ? self.clickData.Origin : "LeftTreeJoinRightForm",
                    Form: data,
                    CurrentUser: self.GetCurrentUser
                };
                await self.DiyCommon.InitV8Code(V8, self.$router);
                try {
                    await eval("(async () => {\n " + self.LeftTreeData.ShujieDDJSJ + " \n})()");
                    var result = await V8.Result;
                } catch (error) {
                    self.DiyCommon.Tips("树节点点击事件V8引擎代码出现错误：" + error.message, false);
                } finally {
                    
                }
            }
            if (this.RightViewType === "表单" || this.RightViewType === "表单/表格") {
                var param = {
                    TableName: this.LeftTreeData.GuanlianBD,
                    FormMode: "View",
                    Id: data.Id,
                    DialogType: "Drawer"
                };
                this.$nextTick(() => {
                    if (this.$refs.ref_RightView) {
                        this.$refs.ref_RightView.Init(param);
                    } else {
                        console.warn("ref_RightView 还未加载");
                    }
                });
            }
            if (this.RightViewType === "表格" || this.RightViewType === "表单/表格") {
                // 先清空表格数据，避免重复key问题
                if (this.$refs.ref_RightDiyTable) {
                    this.$refs.ref_RightDiyTable.DiyTableRowList = [];
                    this.$refs.ref_RightDiyTable.TableMultipleSelection = [];
                }

                // 更新 clickData，将选中的分类数据传递到右侧表格组件
                this.clickData = {
                    Origin: "BomProject",
                    Id: data.Id,
                    ...data // 传递完整的分类数据，以便右侧新增时可以关联
                };
                this.rightTableDataAppend = {
                    ParentField: this.LeftTreeData.ZibiaoGLZD,
                    ParentData: data,
                    ParentValue: data[this.LeftTreeData.FubiaoGLZD],
                    LeftTreeData: this.LeftTreeData
                };
                this.selectedParentRow = { ...data };
                this.selectedParentValue = data[this.tableChildRelation.ParentFieldName || this.LeftTreeData.FubiaoGLZD || "Id"] == null
                    ? ""
                    : String(data[this.tableChildRelation.ParentFieldName || this.LeftTreeData.FubiaoGLZD || "Id"]);

                this.whereList = [
                    {
                        Name: this.LeftTreeData.ZibiaoGLZD,
                        Value: `${data[this.LeftTreeData.FubiaoGLZD]}`,
                        Type: this.WhereType
                    }
                ];
            }
        },
        async MobileLeftViewClick(data) {
            await this.LeftViewClick(data);
            this.MobileTreeDrawer = false;
        },
        ShowRightClick(item) {
            this.ShowRightView = item;
        },
    }
};
</script>

<style scoped>
.forklift-management {
    /*
    这里的 - 75px，跟【.el-tabs.el-tabs--top.parent-tabs】的margin-btoom:10px是有关系的，
    否则上面空隙就不对等
    2026-08-18 Anderson：修改为-85px，否则底部没有空隙
    */
    height: calc(100vh - 85px);
    min-height: 520px;
    padding: 0;
    margin-top: 0;
    box-sizing: border-box;
    overflow: hidden;
}

.main-container {
    height: 100%;
    min-height: 0;
}

.left-right-layout {
    align-items: stretch;
}

.left-right-col {
    height: 100%;
    min-height: 0;
}

/* 左侧分类卡片 */
.box-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
}

.left-tree-card :deep(.el-card__body),
.right-content-card :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 10px;
    min-height: 0;
    overflow: hidden;
}

/* 搜索框 */
.el-input {
    margin-bottom: 5px;
}

/* 树形组件 - 关键修改 */
.custom-tree {
    flex: 1;
    overflow-y: auto;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    padding: 5px;
}

.custom-tree-node {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    padding-right: 8px;
}

.tree-actions {
    display: inline-block;
}

.tree-actions .el-button {
    padding: 0 2px;
}

/* 右侧产品卡片 */
.products-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.right-content-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.right-form-panel {
    flex: 0 0 auto;
    max-height: 38%;
    overflow: auto;
    margin-bottom: 8px;
}

.left-right-table-host {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

:deep(.left-right-diy-table) {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

:deep(.left-right-diy-table .table-rowlist-tabs),
:deep(.left-right-diy-table .el-tabs__content),
:deep(.left-right-diy-table .box-card-table-row-list) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

:deep(.left-right-diy-table .el-tabs__content > .el-tab-pane) {
    flex: 0 0 0;
    height: 0;
    min-height: 0;
    overflow: hidden;
}

:deep(.left-right-diy-table .box-card-table-row-list > .el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden !important;
}

:deep(.left-right-diy-table .el-pagination) {
    flex: 0 0 auto;
}

/* 其他样式保持不变 */
.el-table {
    flex: 1;
    overflow-y: auto;
}

.table-pagination {
    margin-top: 15px;
    text-align: right;
}

.product-detail {
    padding: 20px 0;
}

.product-image {
    width: 100%;
    height: 300px;
    object-fit: contain;
}

.empty-image {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: #909399;
}

.empty-image i {
    font-size: 60px;
    margin-bottom: 20px;
}

.drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.drawer-actions {
    display: flex;
    align-items: center;
}

.detail-content {
    padding: 20px;
}

.section-header {
    font-size: 18px;
    font-weight: bold;
    margin: 10px 0 15px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #ebeef5;
}

.table-operation-bar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 5px;
}

.mobile-tree-toolbar {
    display: none;
}

.mobile-tree-drawer-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
}

:global(.left-tree-mobile-drawer .el-drawer__header) {
    margin-bottom: 0;
    padding: 14px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

:global(.left-tree-mobile-drawer .el-drawer__body) {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 12px;
    overflow: hidden;
}

:global(.left-tree-mobile-drawer .mobile-tree-drawer-content) {
    flex: 1;
    min-height: 0;
}

@media (max-width: 767px) {
    .forklift-management {
        height: auto;
        min-height: 0;
        padding: 6px;
        overflow: visible;
    }

    .main-container,
    .left-right-layout,
    .left-right-col {
        height: auto;
        min-height: 0;
    }

    .left-right-layout {
        display: block;
        margin-left: 0 !important;
        margin-right: 0 !important;
    }

    .left-right-col {
        width: 100%;
        max-width: 100%;
        padding-left: 0 !important;
        padding-right: 0 !important;
    }

    .products-card,
    .right-content-card,
    .right-content-body,
    .left-right-table-host,
    :deep(.left-right-diy-table),
    :deep(.left-right-diy-table .table-rowlist-tabs),
    :deep(.left-right-diy-table .el-tabs__content),
    :deep(.left-right-diy-table .box-card-table-row-list),
    :deep(.left-right-diy-table .box-card-table-row-list > .el-card__body) {
        height: auto;
        min-height: 0;
        overflow: visible !important;
    }

    .left-tree-card :deep(.el-card__body) {
        overflow: hidden;
    }

    .right-content-card :deep(.el-card__body) {
        padding: 6px;
        overflow: visible;
    }

    .mobile-tree-toolbar {
        display: flex;
        align-items: center;
        position: fixed;
        top: max(7px, env(safe-area-inset-top));
        right: 12px;
        z-index: 1200;
        margin: 0;
        pointer-events: none;
    }

    .mobile-tree-toolbar .el-button {
        width: 34px;
        height: 34px;
        padding: 0;
        margin: 0;
        pointer-events: auto;
    }
}
</style>
