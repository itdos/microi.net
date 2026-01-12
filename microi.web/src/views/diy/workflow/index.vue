<template>
    <div id="diy-table" class="pluginPage">
        <el-row>
            <el-col :span="24">
                <el-card class="box-card no-padding-body">
                    <el-form size="mini" :model="SearchModel" inline @submit.native.prevent class="keyword-search">
                        <el-form-item size="mini" v-if="GetCurrentUser._IsAdmin === true">
                            <el-button type="primary" icon="el-icon-plus" @click="OpenDiyTable()">{{ $t("Msg.Add") }}</el-button>
                        </el-form-item>
                        <el-form-item size="mini">
                            <el-input v-model="SearchModel.Keyword" @input="GetDiyTableRow(true)" :placeholder="$t('Msg.Search')" class="input-left-borderbg" style="margin-top: 1px">
                                <el-button slot="append" icon="el-icon-search" @click="GetDiyTableRow(true)"></el-button>
                            </el-input>
                        </el-form-item>
                    </el-form>
                    <template v-if="DataViewType == 'Table'">
                        <el-table v-loading="tableLoading" :data="DiyTableList" style="width: 100%" class="diy-table no-border-outside" stripe border>
                            <el-table-column type="index" width="50" />
                            <el-table-column label="表名" width="180">
                                <template slot-scope="scope">
                                    {{ scope.row.Name }}
                                    <!-- .replace('Diy_', '') -->
                                </template>
                            </el-table-column>
                            <el-table-column prop="Description" label="描述" />
                            <el-table-column prop="CreateTime" :label="$t('Msg.CreateTime')" width="200" />
                            <el-table-column fixed="right" :label="$t('Msg.Operation')" width="180">
                                <template slot-scope="scope">
                                    <el-button type="primary" size="mini" class="marginRight5" icon="el-icon-s-help" @click="$router.push('/wf/flow-design/' + scope.row.Id)">{{
                                        $t("Msg.Design")
                                    }}</el-button>
                                    <el-dropdown trigger="click">
                                        <el-button> {{ $t("Msg.More") }}<i class="el-icon-arrow-down el-icon--right" /> </el-button>
                                        <el-dropdown-menu slot="dropdown" class="table-more-btn">
                                            <el-dropdown-item icon="el-icon-edit" @click.native="OpenDiyTable(scope.row)">
                                                {{ $t("Msg.Edit") }}
                                            </el-dropdown-item>
                                            <el-dropdown-item icon="el-icon-delete" divided @click.native="DelDiyTable(scope.row)">
                                                {{ $t("Msg.Delete") }}
                                            </el-dropdown-item>
                                        </el-dropdown-menu>
                                    </el-dropdown>
                                </template>
                            </el-table-column>
                        </el-table>
                        <el-pagination
                            style="margin-top: 20px; float: left; margin-bottom: 10px; clear: both"
                            background
                            layout="total, sizes, prev, pager, next, jumper"
                            :total="DiyTableCount"
                            :page-size="DiyTablePageSize"
                            :page-sizes="DiyCommon.PageSizes"
                            @size-change="DiyTableSizeChange"
                            @current-change="DiyTableCurrentChange"
                        />
                    </template>
                </el-card>
            </el-col>
        </el-row>
        <template v-if="DataViewType == 'Card'">
            <el-row :gutter="20">
                <el-skeleton style="width: 100%" :loading="tableLoading" animated>
                    <template slot="template">
                        <el-col :xs="24" :span="5" v-for="(model, index) in EmptyData" :key="model.Id" style="margin-top: 20px">
                            <el-card class="box-card card-data-animate no-padding">
                                <el-skeleton-item variant="image" style="width: 100%; height: 150px" />
                                <div class="body">
                                    <el-skeleton-item variant="text" style="width: 100%" />
                                </div>
                                <div class="item">
                                    <el-skeleton-item variant="text" style="width: 100%" />
                                </div>
                                <div class="bottom">
                                    <el-skeleton-item variant="text" style="width: 100%" />
                                </div>
                            </el-card>
                        </el-col>
                    </template>
                    <el-col :xs="24" :span="5" v-for="(model, index) in DiyTableList" :key="model.Id" style="margin-top: 20px">
                        <el-card class="box-card card-data-animate no-padding">
                            <img :src="require('@/assets/img/body-bg.svg')" class="preview" />
                            <div class="body">
                                <span class="title"><i class="el-icon-s-platform"></i> {{ model.FlowName }}</span>
                                <div style="float: right">
                                    <el-button
                                        v-if="GetCurrentUser._IsAdmin === true"
                                        type="text"
                                        size="mini"
                                        class="marginRight5"
                                        icon="el-icon-s-help"
                                        @click="$router.push('/wf/flow-design/' + model.Id)"
                                        >{{ $t("Msg.Design") }}</el-button
                                    >
                                    <el-dropdown trigger="click" v-if="GetCurrentUser._IsAdmin === true">
                                        <el-button type="text"> {{ $t("Msg.More") }}<i class="el-icon-arrow-down el-icon--right" /> </el-button>
                                        <el-dropdown-menu slot="dropdown" class="table-more-btn">
                                            <el-dropdown-item icon="el-icon-edit" @click.native="OpenDiyTable(model)">
                                                {{ $t("Msg.Edit") }}
                                            </el-dropdown-item>
                                            <el-dropdown-item icon="el-icon-delete" divided @click.native="DelDiyTableRow(model)">
                                                {{ $t("Msg.Delete") }}
                                            </el-dropdown-item>
                                        </el-dropdown-menu>
                                    </el-dropdown>
                                </div>
                            </div>
                            <div class="item">
                                {{ model.Description }}
                            </div>
                            <div class="bottom">
                                <i class="el-icon-time"></i> {{ model.CreateTime }}
                                <el-button type="primary" @click="StartFlow(model)" icon="el-icon-plus" size="mini" style="float: right">发起流程</el-button>
                            </div>
                        </el-card>
                    </el-col>
                </el-skeleton>
            </el-row>
            <el-row>
                <el-col :span="24">
                    <el-pagination
                        style="margin-top: 20px; float: left; margin-bottom: 10px; clear: both"
                        background
                        layout="total, sizes, prev, pager, next, jumper"
                        :total="DiyTableCount"
                        :page-size="DiyTablePageSize"
                        :page-sizes="DiyCommon.PageSizes"
                        @size-change="DiyTableSizeChange"
                        @current-change="DiyTableCurrentChange"
                    />
                </el-col>
            </el-row>
        </template>
        <el-dialog v-el-drag-dialog width="768px" :modal-append-to-body="false" :visible.sync="ShowEditModel" :title="ShowEditModelTitle" :close-on-click-modal="false">
            <DiyForm ref="form_diy_flow" :form-mode="DiyFormMode" :table-id="DiyTableId" :table-row-id="CurrentDiyTableModel.Id" />
            <span slot="footer" class="dialog-footer">
                <el-button :loading="SaveDiyTableLoding" type="primary" size="mini" icon="el-icon-s-help" @click="DiySave">{{ $t("Msg.Save") }}</el-button>
                <el-button size="mini" icon="el-icon-close" @click="ShowEditModel = false">{{ $t("Msg.Cancel") }}</el-button>
            </span>
        </el-dialog>
        <el-drawer
            class="diy-form-container"
            :modal="true"
            :size="'90%'"
            :modal-append-to-body="false"
            :visible.sync="ShowStartFlowForm"
            :close-on-press-escape="false"
            :destroy-on-close="true"
            :wrapper-closable="false"
            :show-close="false"
            append-to-body
        >
            <div slot="title">
                <div class="pull-left" style="color: #000; font-size: 15px">
                    <i :class="''" />
                    {{ "发起新流程 - " + CurrentFlowDesign.FlowName }}
                </div>
                <div class="pull-right">
                    <el-button size="mini" icon="el-icon-close" @click="ShowStartFlowForm = false">{{ $t("Msg.Close") }}</el-button>
                </div>
            </div>

            <div class="clear">
                <DiyFormWF v-if="OpenFormType != 'Custom'" ref="refDiyFormWF" @CallbackWFSubmit="CallbackWFSubmit"></DiyFormWF>
                <CustomFormWF v-if="OpenFormType == 'Custom'" ref="refDiyFormWF" @CallbackWFSubmit="CallbackWFSubmit"></CustomFormWF>
            </div>
        </el-drawer>
    </div>
</template>

<script>
import elDragDialog from "@/directive/el-drag-dialog";
import _ from "underscore";
import { mapState } from "vuex";
export default {
    name: "DiyFlowIndex",
    directives: {
        elDragDialog
    },
    components: {},
    computed: {
        ...mapState({}),
        GetCurrentUser: function () {
            return this.$store.getters["DiyStore/GetCurrentUser"];
        }
    },
    data() {
        return {
            OpenFormType: "Diy", //Diy、Custom
            EmptyData: [1, 2, 3, 4, 5],
            BtnLoading: false,
            SaveDiyTableLoding: false,
            tableLoading: true,
            ShowEditModelTitle: "",
            ShowEditModel: false,
            SearchModel: {
                Keyword: ""
            },
            DiyTableList: [],
            CurrentDiyTableModel: {},
            DiyTableCount: 0,
            DiyTablePageSize: 15,
            DiyTablePageIndex: 1,
            DataViewType: "Card", //Table
            DiyFormMode: "Add",
            DiyTableId: "9b4f95be-8a22-41b3-9cf7-1f7a94fe2127",
            CurrentTableId: "",
            CurrentHideFields: [],
            ShowStartFlowForm: false,
            CurrentFlowDesign: {},
            CurrentDefaultValues: {},
            CurrentShowFields: [],
            CurrentReadonlyFields: [],
            CurrentStartNodeModel: {},
            CurrentTableRowId: {}
        };
    },
    beforeCreate() {
        var self = this;
        var emptyData = localStorage.getItem("Microi.WF_FlowDesign_EmptyData");
        if (!self.DiyCommon.IsNull(emptyData)) {
            self.EmptyData = JSON.parse(emptyData);
        }
    },
    mounted() {
        var self = this;
        var dataViewType = localStorage.getItem("Microi.DataViewType_" + "WF_FlowDesign");
        if (!self.DiyCommon.IsNull(dataViewType)) {
            self.DataViewType = dataViewType;
        }
        self.GetDiyTableRow(true);
    },
    methods: {
        CallbackWFSubmit(param) {
            var self = this;
            if (param.Code === 1) {
                self.ShowStartFlowForm = false;
            }
        },
        /**
         * 发起流程，显示弹出框，初始化InitStartWork
         */
        StartFlow(model) {
            var self = this;
            if (self.DiyCommon.IsNull(model.TableId)) {
                // 暂时修改为如果没有配置表单引擎，则打开自定义表单发起流程
                // self.DiyCommon.Tips('未配置TableId！', false);
                // return;
                self.OpenFormType = "Custom";
            } else {
                self.OpenFormType = "Diy";
            }
            self.CurrentFlowDesign = model;
            self.ShowStartFlowForm = true;
            self.$nextTick(function () {
                self.$refs.refDiyFormWF.InitStartWork({
                    CurrentFlowDesign: model,
                    CurrentTableId: model.TableId,
                    OpenFormMode: "Add"
                });
            });
        },
        DiySave() {
            var self = this;
            self.SaveDiyTableLoding = true;
            self.$refs.form_diy_flow.FormSubmit(
                {
                    FormMode: self.DiyFormMode,
                    SaveLoading: self.SaveDiyTableLoding
                },
                function (success, formData) {
                    if (success == true) {
                        self.GetDiyTableRow(true);
                        self.ShowEditModel = false;
                        self.$nextTick(function () {
                            self.SaveDiyTableLoding = false;
                        });
                    } else {
                        self.SaveDiyTableLoding = false;
                    }
                }
            );
        },
        DiyTableCurrentChange(val) {
            var self = this;
            self.DiyTablePageIndex = val;
            self.GetDiyTableRow();
        },
        DiyTableSizeChange(val) {
            var self = this;
            self.DiyTablePageSize = val;
            self.DiyTablePageIndex = 1;
            self.GetDiyTableRow(true);
        },
        GetDiyTableRow(initPageIndex) {
            var self = this;
            if (initPageIndex === true) {
                self.DiyTablePageIndex = 1;
            }
            self.tableLoading = true;
            self.DiyCommon.Post(
                self.DiyApi.GetDiyTableRow,
                {
                    TableId: self.DiyTableId,
                    _PageSize: self.DiyTablePageSize,
                    _PageIndex: self.DiyTablePageIndex,
                    // _Keyword: self.SearchModel.Keyword
                    _Where: [{ Name: "FlowName", Value: self.SearchModel.Keyword, Type: "Like" }]
                },
                function (result) {
                    self.tableLoading = false;
                    if (self.DiyCommon.Result(result)) {
                        self.DiyTableList = result.Data;
                        self.DiyTableCount = result.DataCount;
                    }
                }
            );
        },
        DelDiyTableRow(m) {
            var self = this;
            self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + "【" + m.FlowName + "】？", function () {
                self.DiyCommon.Post(
                    self.DiyApi.DelDiyTableRow,
                    {
                        Id: m.Id,
                        TableId: self.DiyTableId
                    },
                    function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.DiyCommon.Tips(self.$t("Msg.Success"));
                            self.GetDiyTableRow();
                        }
                    }
                );
            });
        },
        OpenDiyTable(m) {
            var self = this;
            var url = self.DiyApi.UptDiyTable;
            var title = self.$t("Msg.Add");
            if (self.DiyCommon.IsNull(m)) {
                self.CurrentDiyTableModel = {};
                url = self.DiyApi.AddDiyTable;
                self.DiyFormMode = "Add";
            } else {
                title = m.Name;
                // m.Name = m.Name.replace('Diy_', '')
                self.CurrentDiyTableModel = m;
                self.DiyFormMode = "Edit";
            }
            self.ShowEditModelTitle = title;
            self.ShowEditModel = true;

            self.$nextTick(function () {
                self.$refs.form_diy_flow.Init(true);
            });
        },
        SaveDiyTable() {
            var self = this;
            try {
                self.SaveDiyTableLoding = true;
                var url = "/api/diytable/uptDiyTableRow";
                if (self.DiyCommon.IsNull(self.CurrentDiyTableModel.Id)) {
                    url = "/api/diytable/uptDiyTableRow";
                }
                var { ...param } = self.CurrentDiyTableModel;
                self.DiyCommon.Post(url, param, function (result) {
                    self.SaveDiyTableLoding = false;
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips(self.$t("Msg.Success"));
                        self.GetDiyTableRow(true);
                        self.ShowEditModel = false;
                    }
                });
            } catch (error) {
                console.log(error);
                self.SaveDiyTableLoding = false;
            }
        }
    }
};
</script>

<style lang="scss" scoped></style>
