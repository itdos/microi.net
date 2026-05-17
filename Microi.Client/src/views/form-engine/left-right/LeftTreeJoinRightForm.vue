<template>
    <div class="forklift-management">
        <el-row :gutter="10" class="main-container" v-if="ShowRowView">
            <el-col :span="colData.Left">
                <el-card class="box-card" style="height: 85vh">
                    <LeftView :LeftTreeData="LeftTreeData" @LeftViewClick="LeftViewClick" @ShowRightClick="ShowRightClick"></LeftView>
                </el-card>
            </el-col>
            <el-col :span="colData.Right">
                <el-card class="products-card" style="height: 85vh; overflow-y: auto; padding:0px;">
                    <RightView ref="ref_RightView" style="height: 200px" :RightViewData="RightViewData" v-if="(RightViewType === '表单' || RightViewType === '表单/表格') && ShowRightView"></RightView>
                    <DiyTableRowlist
                        ref="ref_RightDiyTable"
                        :PropsWhere="whereList"
                        :ParentV8="clickData"
                        :DataAppend="rightTableDataAppend"
                        v-if="(RightViewType === '表格' || RightViewType === '表单/表格') && ShowRightView"
                    ></DiyTableRowlist>
                </el-card>
            </el-col>
        </el-row>
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
            LastClickNode : {},
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
            var res = await this.DiyCommon.FormEngine.GetFormData({
                FormEngineKey: "diy_LeftJoinRightView",
                _Where: [
                    {
                        Name: "GuanlianCD",
                        Value: this.MenuId,
                        Type: "Like"
                    }
                ]
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
                if (self.$refs.ref_RightDiyTable) {
                    self.$refs.ref_RightDiyTable.DiyTableRowList = [];
                    self.$refs.ref_RightDiyTable.TableMultipleSelection = [];
                    self.$refs.ref_RightDiyTable.TableSelectedRow = {};
                }
                self.clickData = {
                    Origin: "BomProject",
                    IsAllCategory: true
                };
                self.rightTableDataAppend = {};
                if (self.RightViewType === "表格" || self.RightViewType === "表单/表格") {
                    self.whereList = [];
                }
                return;
            }
            if(self.LastClickNode.Id == data.Id){
                return;
            }
            self.LastClickNode = data;
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
                    Origin: origin,
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

                this.whereList = [
                    {
                        Name: this.LeftTreeData.ZibiaoGLZD,
                        Value: `${data[this.LeftTreeData.FubiaoGLZD]}`,
                        Type: this.WhereType
                    }
                ];
            }
        },
        ShowRightClick(item) {
            this.ShowRightView = item;
        },
    }
};
</script>

<style scoped>
.forklift-management {
    padding: 0px;
    margin-top: 10px;
    :deep(.el-card__body){
        padding: 10px;
    }
}

.main-container {
    height: calc(100vh - 40px);
}

/* 左侧分类卡片 */
.box-card {
    height: 87vh;
    display: flex;
    flex-direction: column;
    /* 添加以下两行确保卡片本身不会溢出 */
    overflow: hidden;
    position: relative;
}

/* 卡片内容区域 - 关键修改 */
.box-card :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden; /* 保持隐藏溢出 */
    padding: 10px;
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
</style>
