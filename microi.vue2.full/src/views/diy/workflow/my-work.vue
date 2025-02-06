<template>
<div>
    <!-- <el-tabs type="border-card"
        v-model="TabsModel"
        @tab-click="TabsClick"
        > -->
        <!-- <el-tab-pane name="mywork">
            <span slot="label"><i class="el-icon-date"></i> 我的工作</span> -->
            <!--
                实际上可以使用DiyTable来实现，为了更方便的实现定制效果，这里暂时使用定制表格
                <DiyTable
                :ref="'refDiyTableTask'"
                :props-table-id="'70e53f26-0b0d-4653-b893-f9225b40136a'"
                :props-sys-menu-id="'3f6fca15-d3ce-453c-9dc1-d4dc161644f1'"
                    /> -->
            <!-- :class="'table-rowlist-tabs box-card-top-tabs'" -->
            <div
                id="diy-table"
                :class="'diy-table'"
                :style="{padding : '0px'}">
                <el-tabs
                    id="table-rowlist-tabs"
                    v-model="WorkType"
                    @tab-click="WorkTypeChange"
                    type="border-card"
                    >
                    <el-tab-pane
                        :name="'Todo'"
                        :lazy="true">
                        <span slot="label"
                            >


                                <i :class="'fas fa-list-ol marginRight5'"
                                />
                                <template>
                                    {{ '我的待办' }}
                                </template>

                        </span>
                    </el-tab-pane>
                    <el-tab-pane
                        :name="'Sender'"
                        :lazy="true">
                        <span slot="label"
                            >
                            <i :class="'fas fa-hand-point-up marginRight5'"
                            />
                            <template>
                                {{ '我发起的' }}
                            </template>
                        </span>
                    </el-tab-pane>
                    <el-tab-pane
                        :name="'Done'"
                        :lazy="true">
                        <span slot="label"
                            >
                            <i :class="'fas fa-hand-point-right marginRight5'"
                            />
                            <template>
                                {{ '我处理的' }}
                            </template>
                        </span>
                    </el-tab-pane>
                    <el-tab-pane
                        :name="'Copy'"
                        :lazy="true">
                        <span slot="label"
                            >
                            <i :class="'fas fa-copy marginRight5'"
                            />
                            <template>
                                {{ '抄送我的' }}
                            </template>
                        </span>
                    </el-tab-pane>
                    <el-tab-pane
                        :name="'Connect'"
                        :lazy="true">
                        <span slot="label"
                            >
                            <el-tooltip class="item" effect="dark" content="我接收过但不是由我处理的工作" placement="bottom">
                                <span><i :class="'fas fa-handshake marginRight5'" />  {{ '我相关的' }}</span>
                            </el-tooltip>
                        </span>
                    </el-tab-pane>
                    <el-row>
                        <el-col :span="24">
                            <!--DIY子表-->
                            <el-card class="box-card box-card-table-row-list">
                                <!--DIY功能按钮 新版-->
                                <el-form
                                    size="mini"
                                    inline
                                    @submit.native.prevent
                                    class=""
                                    >
                                    <el-button
                                      style="margin-right: 10px;"
                                      :type="SelectList.length>0 ? 'primary' : ''"
                                        @click="BatchApproval()">
                                        <i class="more-btn mr-1 far fa-check-circle"></i> 批量审批
                                    </el-button>
                                    <el-form-item
                                        size="mini">
                                        <el-input
                                            class="input-left-borderbg"
                                            style="margin-top:1px;"
                                            v-model="Keyword"
                                            :placeholder="$t('Msg.Search')"
                                            @input="GetList({PageIndex : 1})"
                                            >
                                            <el-button @click="GetList({PageIndex : 1})" slot="append" icon="el-icon-search"></el-button>
                                        </el-input>
                                    </el-form-item>
                                    <el-form-item size="mini"
                                        >
                                        <el-button
                                            @click="InitSearch()"
                                            icon="el-icon-refresh-left"
                                            >
                                            {{ $t('Msg.ClearSearch') }}
                                        </el-button>
                                    </el-form-item>
                                </el-form>
                                <!--DIY表格-->
                                <el-table
                                    v-loading="TableLoading"
                                    :data="MyWorkList"
                                    @selection-change="TableRowSelectionChange"
                                    style="width: 100%;height: 100%;"
                                    :class="'clear no-border-outside table-table table-data'"
                                    stripe
                                    border
                                    highlight-current-row
                                    >
                                    <el-table-column
                                        v-if="WorkType == 'Todo'"
                                        type="selection"
                                        label="#"
                                        width="40">
                                    </el-table-column>
                                    <el-table-column
                                        type="index"
                                        width="40" />
                                    <el-table-column
                                            :label="'标题'"
                                            show-overflow-tooltip
                                            width="200"
                                            >
                                            <template slot-scope="scope">
                                                <span :title="scope.row.FlowTitle">{{ scope.row.FlowTitle }}</span>
                                            </template>
                                    </el-table-column>
                                    <el-table-column
                                            :label="'内容'"
                                            show-overflow-tooltip
                                            >
                                            <template slot-scope="scope">
                                                <span v-html="GetNotice(scope.row)"></span>
                                            </template>
                                    </el-table-column>
                                    <el-table-column
                                        v-if="WorkType == 'Todo'"
                                            :label="'发送人'"
                                            width="100">
                                            <template slot-scope="scope">
                                                <span :title="scope.row.Sender">{{ scope.row.Sender }}</span>
                                            </template>
                                    </el-table-column>
                                    <el-table-column
                                        v-if="WorkType != 'Sender'"
                                            :label="'节点名称'"
                                            show-overflow-tooltip
                                            width="120">
                                            <template slot-scope="scope">
                                                <span v-html="GetNodeName(scope.row)"></span>
                                                <!-- <span :title="scope.row.NodeName">{{ scope.row.NodeName }}</span> -->
                                            </template>
                                    </el-table-column>
                                    <el-table-column
                                            :label="'发起人'"
                                            width="100">
                                            <template slot-scope="scope">
                                                <span :title="scope.row.FirstSender">{{ scope.row.FirstSender || scope.row.Sender }}</span>
                                            </template>
                                    </el-table-column>
                                    <el-table-column
                                        v-if="WorkType != 'Todo'"
                                            :label="'流程状态'"
                                            width="100">
                                            <template slot-scope="scope">
                                                <span v-html="GetFlowState(scope.row.FlowState)"></span>
                                            </template>
                                    </el-table-column>
                                    <el-table-column
                                            :label="$t('Msg.CreateTime')"
                                            width="150">
                                            <template slot-scope="scope">
                                                <span :title="scope.row.CreateTime">{{ scope.row.CreateTime }}</span>
                                            </template>
                                    </el-table-column>
                                    <el-table-column
                                        fixed="right"
                                        :label="$t('Msg.Action')"
                                        class="row-last-op"
                                        :width="GetRightBtnsWidth()"
                                        >
                                        <template slot-scope="scope">
                                           <el-button
                                                size="mini"
                                                type="primary"
                                                icon="el-icon-tickets"
                                                class="marginRight10"
                                                @click="OpenWork(scope.row, WorkType == 'Todo' ? 'Edit' : 'View')">
                                                {{ WorkType == 'Todo' ? '去处理' : '查看' }}
                                            </el-button>
                                            <el-button
                                                v-if="WorkType == 'Todo'"
                                                size="mini"
                                                icon="el-icon-tickets"
                                                class="marginRight10"
                                                @click="OpenWork(scope.row, 'View', 'Cancel')">
                                                {{ '作废' }}
                                            </el-button>
                                            <el-button
                                                v-if="(WorkType == 'Done' || WorkType == 'Sender') && scope.row.FlowState != 'End' && scope.row.FlowState != 'Cancel'"
                                                type="primary"
                                                size="mini"
                                                icon="el-icon-tickets"
                                                class="marginRight10"
                                                @click="OpenWork(scope.row, 'View', 'Recall')">
                                                {{ '撤回' }}
                                            </el-button>
                                        </template>
                                    </el-table-column>
                                    <template slot="empty">
                                        <el-empty :description="TableLoading ? '加载数据中...' : '暂无数据'"></el-empty>
                                        <div style="height:32px;" v-if="!TableLoading">
                                            <el-button type="default">重新加载</el-button>
                                        </div>
                                    </template>
                                </el-table>

                                <el-pagination
                                    style="margin-top:10px;float:left;margin-bottom:10px;clear:both;margin-left:10px;"
                                    background
                                    layout="total, sizes, prev, pager, next, jumper"
                                    :total="DataCount"
                                    :page-sizes="DiyCommon.PageSizes"
                                    :current-page="PageIndex"
                                    :page-size="PageSize"
                                    @size-change="DiyTableRowSizeChange"
                                    @current-change="DiyTableRowCurrentChange" />
                            </el-card>
                        </el-col>
                    </el-row>
                </el-tabs>

                <el-drawer
                    class="diy-form-container"
                    :modal="true"
                    :size="'90%'"
                    :modal-append-to-body="false"
                    :visible.sync="ShowFieldFormDrawer"
                    :close-on-press-escape="false"
                    :destroy-on-close="true"
                    :wrapper-closable="false"
                    :show-close="false"
                    append-to-body
                    >
                    <div slot="title">
                        <div class="pull-left" style="color:#000;font-size:15px;">
                            <i :class="''" />
                            {{ FlowTitle }}
                        </div>
                        <div class="pull-right">

                            <el-button
                                size="mini"
                                icon="el-icon-close"
                                @click="ShowFieldFormDrawer = false;">{{ $t('Msg.Close') }}</el-button>
                        </div>
                    </div>

                    <div class="clear">
                        <DiyFormWF
                            v-if="OpenFormType != 'Custom'"
                            ref="refDiyFormWF"
                            @CallbackWFSubmit="CallbackWFSubmit"
                            ></DiyFormWF>
                        <CustomFormWF
                            v-if="OpenFormType == 'Custom'"
                            ref="refDiyFormWF"
                            @CallbackWFSubmit="CallbackWFSubmit"
                            ></CustomFormWF>
                    </div>
                </el-drawer>
            </div>
        <!-- </el-tab-pane> -->
        <!-- <el-tab-pane name="startwork">
            <span slot="label"><i class="el-icon-date"></i> 发起新流程</span>
            <DiyFlowIndex />
        </el-tab-pane> -->
        <!-- <DiyTest /> -->
    <!-- </el-tabs> -->

</div>
</template>

<script>
import Vue from 'vue'
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
// import { DiyForm } from "@/utils/microi.net.import";
// import { DiyFormWF, DiyTable } from "@/utils/microi.net.import";
// import { DiyFlowIndex } from "@/utils/microi.net.import";
// import DiyFlowIndex from '@/views/diy/workflow/index';
// import { DiyTest } from "@/utils/microi.net.import";
import _ from 'underscore'
;

export default {
    name: 'diy_my_work',
	components:{
        // DiyTable, //: (resolve) => require(['@/views/diy/diy-table-rowlist'], resolve),
        // DiyFlowIndex, //: (resolve) => require(['@/views/diy/workflow/index'], resolve),
        // DiyTest,
        // DiyForm,
        // DiyFormWF
    },
    computed: {
		...mapState({
            OsClient: (state) => state.DiyStore.OsClient,
        }),
        GetCurrentUser: function(){ return this.$store.getters['DiyStore/GetCurrentUser'];},
    },
	watch: {
	},
    data() {
        return {
            TabsModel:'mywork',
            OpenFormType:'Diy',//Diy、Custom
            OpenFormMode:'',
            Keyword:'',
            WorkType:'Todo',
            ShowForm:false,
            ShowFieldFormDrawer:false,
            TableLoading:false,
            MyWorkList : [],
            CurrentTableId :'',
            CurrentTableRowId :'',
            PageIndex:1,
            PageSize:15,
            DataCount:0,
            CurrentWorkModel:{},
            FlowTitle:'',
            SelectList: [] //刘诚新增批量审批2025-1-11
        }
    },
    mounted() {
        var self = this;
        self.GetList();
    },
    methods: {
        GetList(param){
            var self = this;
            if(self.WorkType == "Todo"){
                self.GetWFWork(param);
            }
            else{
                self.GetWFFlow(param);
            }
        },
        // TabsClick(tab, event){
        //     var self = this;
        //     if(tab.name == 'mywork'){
        //         self.GetWFWork();
        //     }
        // },
        GetRightBtnsWidth(){
            var self = this;
            if(self.WorkType == 'Done' || self.WorkType == 'Todo' || self.WorkType == 'Sender'){
                return 220;
            }
            return 120;
        },
        InitSearch(){
            var self = this;
            self.Keyword = '';
            self.GetList({PageIndex : 1})
        },
        GetNotice(workModel){
            var self = this;
            try {
                //[{Id:'fieldId',Name:'FieldName',Label:'姓名',Value:'张三'}]
                if (!self.DiyCommon.IsNull(workModel.NoticeFields)) {
                    var noticeFields = JSON.parse(workModel.NoticeFields);
                    var result = '';
                    noticeFields.forEach(noticeField => {
                        result += `<span class="badge badge-primary">${noticeField.Label + '：' + noticeField.Value}</span> `;// noticeField.Label + '：' + noticeField.Value + '；';
                    });
                    return result;
                }
                return '';
            } catch (error) {
                return '';
            }

        },
        GetFlowState(flowState){
            if(flowState == 'Running'){
                return `<span class="badge badge-success">运行中</span> `;
            }else if(flowState == 'End'){
                return `<span class="badge badge-info">已结束</span> `;
            }else if(flowState == 'Cancel'){
                return `<span class="badge badge-danger">已作废</span> `;
            }
            return '';
        },
        CallbackWFSubmit(param){
            var self = this;
            if (param.Code === 1) {
                self.ShowFieldFormDrawer = false;
                //2023-06-14：如果是我的待办，则GetWFWork，其余全是GetWFFlow
                // if(self.WorkType == "Todo"){
                //     self.GetWFWork();
                // }
                // else{
                //     self.GetWFFlow({PageIndex : 1});
                // }
                self.GetList({PageIndex : 1});
            }
        },
        GetNodeName(model){
            var self = this;
            var result = '';

            try {
                var users = [];
                if(self.WorkType == "Done"){
                    users = JSON.parse(model.HandlerUsers);
                }else if(self.WorkType == "Copy"){
                    users = JSON.parse(model.CopyUsers);
                }else if(self.WorkType == "Connect"){
                    users = JSON.parse(model.NotHandlerUsers);
                }else{
                    return `<span class="badge badge-secondary">${model.NodeName}</span> `;;
                }
                // currentNodeId = _.find(handlerUsers, function(item){ return item.Id == self.GetCurrentUser.Id }).NodeId;
                var tempArr = _.where(users, { Id : self.GetCurrentUser.Id });
                if(tempArr && tempArr.length > 0){
                    tempArr.forEach(element => {
                        result += `<span class="badge badge-secondary">${element.NodeName}</span> `;
                    });
                }
                return result;
            } catch (error) {
                return '';
            }
        },
        /**
         * 只有我的待办model为WorkModel，其余均为FlowModel
         * @param {*} model
         * @param {*} formMode
         * @param {*} OpenWorkType
         */
        async OpenWork(model, formMode, OpenWorkType){
            var self = this;

            if(self.DiyCommon.IsNull(model.TableId)){
                self.OpenFormType = 'Custom';
            }else{
                self.OpenFormType = 'Diy';
            }

            if(self.WorkType == 'Todo'){
                self.CurrentWorkModel = model;
            }else{
                self.CurrentWorkModel = {};
            }
            self.FlowTitle = model.FlowTitle;

            self.CurrentTableId = model.TableId;
            self.CurrentTableRowId = model.TableRowId;
            self.OpenFormMode = formMode;
            //获取所有节点
            //获取当前节点的字段设置
            var currentFlowId = model.FlowId;
            var currentNodeId = model.NodeId;
            if (self.WorkType == 'Sender') {
                currentNodeId = model.StartNodeId;
                currentFlowId = model.Id;
            }
            // else if (self.WorkType == 'Copy') {
            //     currentNodeId = model.FromNodeId;
            // }
            //如果是我处理的，NodeId要从 HandlerUsers 里面去拿
            else if(self.WorkType == "Done" || self.WorkType == 'Copy' || self.WorkType == 'Connect'){
                currentFlowId = model.Id;
                try {
                    var handlerUsers = [];
                    if(self.WorkType == "Done"){
                        handlerUsers = JSON.parse(model.HandlerUsers);
                    }else if(self.WorkType == "Copy"){
                        handlerUsers = JSON.parse(model.CopyUsers);
                    }else if(self.WorkType == "Connect"){
                        handlerUsers = JSON.parse(model.NotHandlerUsers);
                    }
                    // currentNodeId = _.find(handlerUsers, function(item){ return item.Id == self.GetCurrentUser.Id }).NodeId;
                    var tempArr = _.where(handlerUsers, { Id : self.GetCurrentUser.Id });
                    if(tempArr && tempArr.length > 0){
                        //以最后处理的节点Id为准。
                        currentNodeId = tempArr[tempArr.length - 1].NodeId;
                    }
                } catch (error) {

                }
            }
            //如果是撤回，必须查询出CurrentWorkModel，否则无法撤回  --2023-06-08 by Anderson
            if(currentFlowId && currentNodeId && !self.CurrentWorkModel.Id && (OpenWorkType == 'Recall' || OpenWorkType == 'Cancel')){
                //2023-12-07修复流程撤回bug。
                var workModelResult = await DiyCommon.FormEngine.GetFormData({
                    FormEngineKey : 'WF_Work',
                    _Where : [{ Name : 'WorkState', Value : 'Done', Type : '=' },
                                // { Name : 'SenderId', Value : self.GetCurrentUser.Id, Type : '=' },//2023-12-07注释：应该是ReceiverId
                                { Name : 'ReceiverId', Value : self.GetCurrentUser.Id, Type : '=' },
                                { Name : 'NodeId', Value : currentNodeId, Type : '=' },
                                { Name : 'FlowId', Value : currentFlowId, Type : '=' },
                                ],
                });
                if(workModelResult.Code == 1){
                    self.CurrentWorkModel = workModelResult.Data;
                }
            }
            self.ShowFieldFormDrawer = true;
            //DIY-FROM-WF
            self.$nextTick(function(){
                self.$refs.refDiyFormWF.InitSendWork({
                    CurrentNodeId : currentNodeId,
                    CurrentFlowId : currentFlowId,
                    CurrentWorkModel : self.CurrentWorkModel,
                    OpenFormMode: self.OpenFormMode,
                    CurrentTableId : self.CurrentTableId,
                    CurrentTableRowId : self.CurrentTableRowId,
                    OpenWorkType : OpenWorkType,
                    CurrentFlowDesign : {
                        Id : model.FlowDesignId
                    }
                });
            });
        },
        WorkTypeChange(tab){
            var self = this;
            self.PageIndex = 1;
            self.WorkType = tab.name;
            self.GetList({PageIndex : 1});
            // if (tab.name == 'Todo'  ) {//|| tab.name == 'Done'  || tab.name == 'Connect'
            //     self.GetWFWork({PageIndex : 1});
            // }
            // else if(tab.name == 'Sender' || tab.name == 'Done' || tab.name == 'Copy' || tab.name == 'Connect'){
            //     self.GetWFFlow({PageIndex : 1});
            // }
            // // else if(tab.name == 'Copy'){
            // //     self.GetWFHistory({PageIndex : 1});
            // // }
        },
        OpenWorkFLowList(){
                var self = this;
                self.ShowForm = true;
        },
        //WorkType:Todo/Sender/Done
        GetWFWork(param){
            var self = this;
            if (param && param._PageIndex) {
                self.PageIndex = param.PageIndex;
            }
            self.TableLoading = true;
            self.DiyCommon.Post('/api/WorkFlow/getWFWork', {
                WorkType : self.WorkType,
                _PageIndex : self.PageIndex,
                _PageSize : self.PageSize,
                _Keyword : self.Keyword
            }, function(result){
                if (self.DiyCommon.Result(result)) {
                    self.MyWorkList = result.Data;
                    self.DataCount = result.DataCount;
                }
                self.TableLoading = false;
            });
        },
        GetWFFlow(param){
            var self = this;
            if (param && param._PageIndex) {
                self.PageIndex = param.PageIndex;
            }
            self.TableLoading = true;
            self.DiyCommon.Post('/api/WorkFlow/getWFFlow', {
                WorkType : self.WorkType,
                _PageIndex : self.PageIndex,
                _PageSize : self.PageSize,
                _Keyword : self.Keyword
            }, function(result){
                if (self.DiyCommon.Result(result)) {
                    self.MyWorkList = result.Data;
                    self.DataCount = result.DataCount;
                }
                self.TableLoading = false;
            });
        },
        /**
         * 没在使用的函数
         */
        GetWFHistory(param){
            var self = this;
            if (param && param._PageIndex) {
                self.PageIndex = param.PageIndex;
            }
            self.TableLoading = true;
            self.DiyCommon.Post('/api/WorkFlow/getWfHistory', {
                WorkType : self.WorkType,
                _PageIndex : self.PageIndex,
                _PageSize : self.PageSize,
                _Keyword : self.Keyword
            }, function(result){
                if (self.DiyCommon.Result(result)) {
                    self.MyWorkList = result.Data;
                    self.DataCount = result.DataCount;
                }
                self.TableLoading = false;
            });
        },
        DiyTableRowCurrentChange(val) {
            var self = this
            self.PageIndex = val
            // self.GetWFWork()
            self.GetList();
        },
        DiyTableRowSizeChange(val) {
            var self = this
            self.PageSize = val
            localStorage.setItem('DiyTableRowPageSize_MyWork', val)
            self.PageIndex = 1
            // self.GetWFWork({PageIndex : 1})
            self.GetList({PageIndex : 1});
        },

        //刘诚新增批量审批2025-1-11
        TableRowSelectionChange(val){
          this.SelectList = val;
        },
        async BatchApproval(){
          var self = this;
          if(self.SelectList.length === 0){
            self.DiyCommon.Tips('请选择要审批的流程', false);
            return;
          }
          var res = '';
          var count = 0;
          self.DiyCommon.OsConfirm('确定要批量审批'+self.SelectList.length+'条数据吗？',true,async function(){
            self.TableLoading = true;
            for(var i = 0; i < self.SelectList.length; i++){
              res = await self.DiyCommon.PostAsync('/api/WorkFlow/sendWork', {//批量审批
                WorkId: self.SelectList[i].Id,
                FlowId: self.SelectList[i].FlowId,
                FormData: {},
                ApprovalType: "Agree",
                ApprovalIdea: "同意",
                NoticeFields: self.SelectList[i].NoticeFields
              });
              count++;
            }

            self.TableLoading = false;
            self.DiyCommon.Tips('批量审批成功,共计'+count+'个',true);
            self.GetWFWork();
          });
        },
        //批量审批代码结束
    }
}
</script>

<style lang="scss">
.workflow-history{
    .el-timeline-item__tail{
        left: 13px;
    }
    .el-timeline-item__wrapper{
        padding-left: 45px;
    }
}
</style>
