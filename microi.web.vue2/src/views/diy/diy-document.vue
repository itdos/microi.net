<template>
    <div class="diy-document">
        <div class="right-document">
            <div class="menu-container pull-left">
                <el-tree
                    node-key="Id"
                    :default-expanded-keys="DefaultExpandedKeys"
                    :data="DiyTableRowTreeList"
                    :props="TreeProps"
                    highlight-current
                    :default-expand-all="true"
                    :expand-on-click-node="false"
                    @node-click="TreeClick"
                ></el-tree>
            </div>
            <div class="pull-right content-container">
                <div class="add" v-if="!DiyCommon.IsNull(GetCurrentUser) && OsClient == 'iTdos'">
                    <el-button v-if="!DiyCommon.IsNull(CurrentDiyTableRowModel.Id)" type="success" icon="el-icon-edit" @click="OpenDiyForm(CurrentDiyTableRowModel)">{{ $t("Msg.Edit") }}</el-button>
                    <el-button type="primary" icon="el-icon-plus" @click="OpenDiyForm()">{{ $t("Msg.Add") }}</el-button>
                </div>
                <div class="title">{{ CurrentDiyTableRowModel.Title }}</div>
                <div class="desc">
                    {{ CurrentDiyTableRowModel.UpdateTime || CurrentDiyTableRowModel.CreateTime }}
                </div>
                <div v-if="!CurrentDiyTableRowModel.IframeUrl" class="content" v-html="CurrentDiyTableRowModel.Content"></div>
                <iframe
                    v-else
                    :src="CurrentDiyTableRowModel.IframeUrl"
                    ref="iframe"
                    id="iframepage"
                    name="mainIFrame"
                    frameBorder="0"
                    allowtransparency="true"
                    style="background-color: transparent; height: calc(100vh - 89px)"
                    scrolling="yes"
                    width="100%"
                >
                </iframe>
            </div>
        </div>
        <el-dialog v-el-drag-dialog :width="'80%'" :visible.sync="ShowDiyForm" :title="ShowDiyFormTitle" :close-on-click-modal="false">
            <DiyForm ref="refDiyForm" :form-mode="DiyFormMode" :table-name="DiyTableName" :table-row-id="CurrentDiyTableRowModel.Id" />
            <span slot="footer" class="dialog-footer">
                <el-button :loading="SaveDiyFormLoding" type="primary" size="mini" icon="el-icon-s-help" @click="SaveDiyForm">{{ $t("Msg.Save") }}</el-button>
                <el-button size="mini" icon="el-icon-close" @click="ShowDiyForm = false">{{ $t("Msg.Cancel") }}</el-button>
            </span>
        </el-dialog>
    </div>
</template>

<script>
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
import elDragDialog from "@/directive/el-drag-dialog";
export default {
    name: "diy_document",
    components: {},
    computed: {
        ...mapState({
            OsClient: (state) => state.DiyStore.OsClient
        }),
        GetCurrentUser: function () {
            return this.$store.getters["DiyStore/GetCurrentUser"];
        }
    },
    directives: {
        elDragDialog
    },
    watch: {},
    data() {
        return {
            DefaultExpandedKeys: [],
            SaveDiyFormLoding: false,
            ShowDiyFormTitle: "",
            ShowDiyForm: false,
            DiyTableName: "Diy_Document",
            DiyFormMode: "Add",
            CurrentDiyTableRowModel: {},
            DiyTableRowTreeList: [],
            TreeProps: {
                children: "_Child",
                label: "Title"
            }
        };
    },
    mounted() {
        var self = this;
        self.GetDiyTableRowTree();
    },
    methods: {
        TreeClick(data) {
            var self = this;
            //如果有下一级，就不用请求了。 后来改成还是要请求，不然不方便修改父级信息。
            if (data._Child && data._Child.length > 0) {
                // return;
            }
            self.DiyCommon.Post(
                "https://api-china.itdos.com/api/diytable/getDiyTableRowModelAnonymous",
                {
                    // self.DiyCommon.Post('/api/diytable/getDiyTableRowModelAnonymous', {
                    Id: data.Id,
                    TableName: "Diy_Document",
                    OsClient: "iTdos"
                },
                async function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.CurrentDiyTableRowModel = result.Data;
                    }
                }
            );
        },
        GetDiyTableRowTree() {
            var self = this;
            self.DiyCommon.Post(
                "https://api-china.itdos.com/api/diytable/getDiyDocumentTree",
                {
                    // self.DiyCommon.Post('/api/diytable/getDiyDocumentTree', {
                    OsClient: "iTdos"
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        // result.Data.forEach(element => {
                        //     self.DefaultExpandedKeys.push(element.Id);
                        //     if(element._Child){
                        //         element._Child.forEach(item => {
                        //             self.DefaultExpandedKeys.push(item.Id);
                        //         });
                        //     }
                        // });
                        self.DiyTableRowTreeList = result.Data;
                        if (result.Data.length > 0 && self.DiyCommon.IsNull(self.CurrentDiyTableRowModel.Id)) {
                            // self.CurrentDiyTableRowModel = result.Data[0];
                            self.DiyCommon.Post(
                                "https://api-china.itdos.com/api/diytable/getDiyTableRowModelAnonymous",
                                {
                                    // self.DiyCommon.Post('/api/diytable/getDiyTableRowModelAnonymous', {
                                    Id: result.Data[0].Id,
                                    TableName: "Diy_Document",
                                    OsClient: "iTdos"
                                },
                                function (result2) {
                                    if (self.DiyCommon.Result(result2)) {
                                        self.CurrentDiyTableRowModel = result2.Data;
                                    }
                                }
                            );
                        }
                    }
                }
            );
        },
        //保存DiyForm，自动识别是新增或编辑
        SaveDiyForm() {
            var self = this;
            self.SaveDiyFormLoding = true;
            self.$refs.refDiyForm.FormSubmit({}, function (success, formData) {
                if (success == true) {
                    //刷新数据
                    self.GetDiyTableRowTree(true);
                    self.ShowDiyForm = false;
                    self.$nextTick(function () {
                        self.SaveDiyFormLoding = false;
                    });
                } else {
                    self.SaveDiyFormLoding = false;
                }
            });
        },
        //打开DiyForm表单，可传入RowModel
        OpenDiyForm(rowModel) {
            var self = this;
            var title = self.$t("Msg.Add") + "平台文档";
            if (self.DiyCommon.IsNull(rowModel)) {
                //表单默认值
                self.CurrentDiyTableRowModel = {};
                //指定加载表单的模式为“新增”
                self.DiyFormMode = "Add";
            } else {
                title = self.$t("Msg.Edit") + "[" + rowModel.Title + "]";
                //这里为了严谨，也可以使用同步接口获取数据库最新RowModel，而不是直接赋值传过来的RowModel
                self.CurrentDiyTableRowModel = rowModel;
                //指定加载表单的模式为“编辑”
                self.DiyFormMode = "Edit";
            }
            self.ShowDiyFormTitle = title;
            self.ShowDiyForm = true;

            //必须要在DOM渲染后再执行初始化DiyForm
            self.$nextTick(function () {
                self.$refs.refDiyForm.Init();
            });
        }
    }
};
</script>

<style lang="scss">
.diy-document {
    .el-tree {
        background-color: #f7f8fa;
    }

    .right-document {
        position: relative;
        .add {
            position: absolute;
            top: 15px;
            right: 15px;
        }
        .content-container {
            width: calc(100% - 280px);
            background-color: #fff;
            padding: 15px;
            .content {
                font-size: 14px;
                height: calc(100vh - 220px);
                overflow-y: auto;
                a {
                    color: #0070c0;
                }
            }
        }
        .menu-container {
            max-height: calc(100vh - 120px);
            overflow-y: auto;
            width: 280px;
            padding: 15px;
            background: #f7f8fa;
        }
        .title {
            font-size: 28px;
            color: #1f2d3d;
            line-height: 45px;
        }
        .desc {
            color: #666;
            line-height: 25px;
        }
    }
}
</style>
