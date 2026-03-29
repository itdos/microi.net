<template>
    <div class="my-work-page">
        <!-- 三个主Tab：我的工作 / 日历 / 公告 -->
        <el-tabs v-model="MainTab" class="main-tabs" @tab-click="MainTabChange">
            <!-- ====== Tab 1: 我的工作 ====== -->
            <el-tab-pane name="work" :lazy="true">
                <template #label>
                    <span class="main-tab-label">
                        <fa-icon :icon="'fas fa-briefcase marginRight5'" />
                        {{ "我的工作" }}
                    </span>
                </template>

                <div class="work-section">
                    <!-- 工作流统计卡片 -->
                    <div class="stats-cards">
                        <div class="stat-card" :class="{ active: WorkType === 'Todo' }" @click="switchWorkType('Todo')">
                            <div class="stat-icon todo-icon"><fa-icon :icon="'fas fa-clock'" /></div>
                            <div class="stat-info">
                                <div class="stat-count">{{ wfStats.Todo }}</div>
                                <div class="stat-label">我的待办</div>
                            </div>
                        </div>
                        <div class="stat-card" :class="{ active: WorkType === 'Sender' }" @click="switchWorkType('Sender')">
                            <div class="stat-icon sender-icon"><fa-icon :icon="'fas fa-paper-plane'" /></div>
                            <div class="stat-info">
                                <div class="stat-count">{{ wfStats.Sender }}</div>
                                <div class="stat-label">我发起的</div>
                            </div>
                        </div>
                        <div class="stat-card" :class="{ active: WorkType === 'Done' }" @click="switchWorkType('Done')">
                            <div class="stat-icon done-icon"><fa-icon :icon="'fas fa-check-circle'" /></div>
                            <div class="stat-info">
                                <div class="stat-count">{{ wfStats.Done }}</div>
                                <div class="stat-label">我处理的</div>
                            </div>
                        </div>
                        <div class="stat-card" :class="{ active: WorkType === 'Copy' }" @click="switchWorkType('Copy')">
                            <div class="stat-icon copy-icon"><fa-icon :icon="'fas fa-copy'" /></div>
                            <div class="stat-info">
                                <div class="stat-count">{{ wfStats.Copy }}</div>
                                <div class="stat-label">抄送我的</div>
                            </div>
                        </div>
                        <div class="stat-card" :class="{ active: WorkType === 'Connect' }" @click="switchWorkType('Connect')">
                            <div class="stat-icon connect-icon"><fa-icon :icon="'fas fa-handshake'" /></div>
                            <div class="stat-info">
                                <div class="stat-count">{{ wfStats.Connect }}</div>
                                <div class="stat-label">我相关的</div>
                            </div>
                        </div>
                    </div>

                    <!-- 工具栏 -->
                    <div class="work-toolbar">
                        <el-button v-if="WorkType == 'Todo'" :type="SelectList.length > 0 ? 'primary' : ''" @click="BatchApproval()">
                            <el-icon class="more-btn mr-1"><CircleCheck /></el-icon> 批量审批
                        </el-button>
                        <div style="flex: 1"></div>
                        <el-input class="search-input" style="width: 200px" v-model="Keyword" :placeholder="$t('Msg.Search')" @input="GetList({ PageIndex: 1 })">
                            <template #append><el-button @click="GetList({ PageIndex: 1 })" :icon="Search"></el-button></template>
                        </el-input>
                        <el-button @click="InitSearch()" :icon="RefreshLeft">
                            {{ $t("Msg.ClearSearch") }}
                        </el-button>
                    </div>

                    <!-- 我的待办表格（wf_work） -->
                    <el-table
                        v-show="WorkType == 'Todo'"
                        v-loading="TableLoading"
                        :data="MyWorkList"
                        @selection-change="TableRowSelectionChange"
                        style="width: 100%"
                        class="work-table"
                        stripe
                        border
                        highlight-current-row
                    >
                        <el-table-column type="selection" label="#" width="40" />
                        <el-table-column type="index" width="40" />
                        <el-table-column :label="'标题'" show-overflow-tooltip width="200">
                            <template #default="scope">
                                <span :title="scope.row.FlowTitle">{{ scope.row.FlowTitle }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column :label="'内容'" show-overflow-tooltip>
                            <template #default="scope">
                                <span v-html="GetNotice(scope.row)"></span>
                            </template>
                        </el-table-column>
                        <el-table-column :label="'发送人'" width="100">
                            <template #default="scope">
                                <span :title="scope.row.Sender">{{ scope.row.Sender }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column :label="'节点名称'" show-overflow-tooltip width="120">
                            <template #default="scope">
                                <span v-html="GetNodeName(scope.row)"></span>
                            </template>
                        </el-table-column>
                        <el-table-column :label="'发起人'" width="100">
                            <template #default="scope">
                                <span :title="scope.row.FirstSender">{{ scope.row.FirstSender || scope.row.Sender }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.CreateTime')" width="150">
                            <template #default="scope">
                                <span :title="scope.row.CreateTime">{{ scope.row.CreateTime }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column fixed="right" :label="$t('Msg.Action')" class="row-last-op" width="240">
                            <template #default="scope">
                                <el-button type="primary" :icon="Tickets" class="marginRight10" @click="OpenWork(scope.row, 'Edit')">
                                    {{ "去处理" }}
                                </el-button>
                                <el-button :icon="Tickets" class="marginRight10" @click="OpenWork(scope.row, 'View', 'Cancel')">
                                    {{ "作废" }}
                                </el-button>
                            </template>
                        </el-table-column>
                        <template #empty>
                            <el-empty :description="TableLoading ? '加载数据中...' : '暂无数据'" />
                        </template>
                    </el-table>

                    <!-- 我发起的/我处理的/抄送我的/我相关的表格（wf_flow） -->
                    <el-table
                        v-show="WorkType != 'Todo'"
                        v-loading="TableLoading"
                        :data="MyWorkList"
                        style="width: 100%"
                        class="work-table"
                        stripe
                        border
                        highlight-current-row
                    >
                        <el-table-column type="index" width="40" />
                        <el-table-column :label="'标题'" show-overflow-tooltip width="200">
                            <template #default="scope">
                                <span :title="scope.row.FlowTitle">{{ scope.row.FlowTitle }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column :label="'内容'" show-overflow-tooltip>
                            <template #default="scope">
                                <span v-html="GetNotice(scope.row)"></span>
                            </template>
                        </el-table-column>
                        <el-table-column v-if="WorkType != 'Sender'" :label="'节点名称'" show-overflow-tooltip width="120">
                            <template #default="scope">
                                <span v-html="GetNodeName(scope.row)"></span>
                            </template>
                        </el-table-column>
                        <el-table-column :label="'发起人'" width="100">
                            <template #default="scope">
                                <span :title="scope.row.FirstSender">{{ scope.row.FirstSender || scope.row.Sender }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column :label="'流程状态'" width="100">
                            <template #default="scope">
                                <span v-html="GetFlowState(scope.row.FlowState)"></span>
                            </template>
                        </el-table-column>
                        <el-table-column :label="$t('Msg.CreateTime')" width="150">
                            <template #default="scope">
                                <span :title="scope.row.CreateTime">{{ scope.row.CreateTime }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column fixed="right" :label="$t('Msg.Action')" class="row-last-op" :width="GetFlowRightBtnsWidth()">
                            <template #default="scope">
                                <el-button type="primary" :icon="Tickets" class="marginRight10" @click="OpenWork(scope.row, 'View')">
                                    {{ "查看" }}
                                </el-button>
                                <el-button
                                    v-if="(WorkType == 'Done' || WorkType == 'Sender') && scope.row.FlowState != 'End' && scope.row.FlowState != 'Cancel'"
                                    type="primary"
                                    :icon="Tickets"
                                    class="marginRight10"
                                    @click="OpenWork(scope.row, 'View', 'Recall')"
                                >
                                    {{ "撤回" }}
                                </el-button>
                            </template>
                        </el-table-column>
                        <template #empty>
                            <el-empty :description="TableLoading ? '加载数据中...' : '暂无数据'" />
                        </template>
                    </el-table>

                    <!-- 分页 -->
                    <el-pagination
                        class="work-pagination"
                        background
                        layout="total, sizes, prev, pager, next, jumper"
                        :total="DataCount"
                        :page-sizes="DiyCommon.PageSizes"
                        :current-page="PageIndex"
                        :page-size="PageSize"
                        @size-change="DiyTableRowSizeChange"
                        @current-change="DiyTableRowCurrentChange"
                    />
                </div>
            </el-tab-pane>

            <!-- ====== Tab 2: 日历 ====== -->
            <el-tab-pane name="calendar" :lazy="true">
                <template #label>
                    <span class="main-tab-label">
                        <fa-icon :icon="'fas fa-calendar-alt marginRight5'" />
                        {{ "日历" }}
                    </span>
                </template>
                <MicroiCalendar />
            </el-tab-pane>

            <!-- ====== Tab 3: 公告 ====== -->
            <el-tab-pane name="notice" :lazy="true">
                <template #label>
                    <el-badge :value="noticeUnreadCount" :hidden="noticeUnreadCount === 0" :max="99" class="notice-badge">
                        <span class="main-tab-label">
                            <fa-icon :icon="'fas fa-bullhorn marginRight5'" />
                            {{ "公告" }}
                        </span>
                    </el-badge>
                </template>
                <div class="notice-section" v-loading="noticeLoading">
                    <div class="notice-list" v-if="noticeList.length > 0">
                        <div class="notice-item" v-for="item in noticeList" :key="item.Id" @click="toggleNoticeExpand(item)">
                            <div class="notice-header">
                                <div class="notice-meta">
                                    <el-tag v-if="item.Fenlei" size="small" effect="light">{{ item.Fenlei }}</el-tag>
                                    <span class="notice-title">{{ item.Biaoti }}</span>
                                </div>
                                <span class="notice-date">{{ (item.CreateTime || "").substring(0, 16) }}</span>
                            </div>
                            <div class="notice-body" v-if="item._expanded" v-html="item.Neirong"></div>
                        </div>
                    </div>
                    <el-empty v-else :description="noticeLoading ? '加载中...' : '暂无公告'" />
                    <el-pagination
                        v-if="noticeCount > noticePageSize"
                        class="notice-pagination"
                        background
                        layout="prev, pager, next"
                        :total="noticeCount"
                        :page-size="noticePageSize"
                        :current-page="noticePageIndex"
                        @current-change="NoticePageChange"
                    />
                </div>
            </el-tab-pane>
        </el-tabs>

        <!-- 工作流表单 Drawer -->
        <el-drawer
            class="diy-form-container"
            :modal="true"
            :size="'90%'"
            :modal-append-to-body="false"
            v-model="ShowFieldFormDrawer"
            :close-on-press-escape="false"
            :destroy-on-close="true"
            :wrapper-closable="false"
            :show-close="false"
            append-to-body
        >
            <template #header
                ><div>
                    <div class="pull-left" style="color: #000; font-size: 15px">
                        <i :class="''" />
                        {{ FlowTitle }}
                    </div>
                    <div class="pull-right">
                        <el-button :icon="Close" @click="ShowFieldFormDrawer = false">{{ $t("Msg.Close") }}</el-button>
                    </div>
                </div></template
            >

            <div class="clear">
                <DiyFormWF v-if="OpenFormType != 'Custom'" ref="refDiyFormWF" @CallbackWFSubmit="CallbackWFSubmit"></DiyFormWF>
                <CustomFormWF v-if="OpenFormType == 'Custom'" ref="refDiyFormWF" @CallbackWFSubmit="CallbackWFSubmit"></CustomFormWF>
            </div>
        </el-drawer>
    </div>
</template>

<script>
import { computed } from "vue";
import { useDiyStore } from "@/pinia";
import _ from "underscore";
import MicroiCalendar from "@/views/fullcalendar/fullcalendar.vue";

export default {
    name: "diy_my_work",
    components: { MicroiCalendar },
    setup() {
        const diyStore = useDiyStore();
        const OsClient = computed(() => diyStore.OsClient);
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        return {
            diyStore,
            OsClient,
            GetCurrentUser
        };
    },
    watch: {},
    data() {
        return {
            MainTab: "work",
            TabsModel: "mywork",
            OpenFormType: "Diy", //Diy、Custom
            OpenFormMode: "",
            Keyword: "",
            WorkType: "Todo",
            ShowForm: false,
            ShowFieldFormDrawer: false,
            TableLoading: false,
            MyWorkList: [],
            CurrentTableId: "",
            CurrentTableRowId: "",
            PageIndex: 1,
            PageSize: 15,
            DataCount: 0,
            CurrentWorkModel: {},
            FlowTitle: "",
            SelectList: [],
            // 工作流统计
            wfStats: { Todo: 0, Sender: 0, Done: 0, Copy: 0, Connect: 0 },
            // 公告未读数
            noticeUnreadCount: 0,
            // 公告
            noticeLoading: false,
            noticeList: [],
            noticeCount: 0,
            noticePageIndex: 1,
            noticePageSize: 10
        };
    },
    mounted() {
        var self = this;
        self.GetList();
        self.loadWFStats();
        self.loadUnreadCount();
    },
    methods: {
        // ====== 主Tab切换 ======
        MainTabChange(tab) {
            var self = this;
            if (tab.paneName === "notice") {
                if (self.noticeList.length === 0) {
                    self.loadNoticeList();
                }
                var d = new Date();
                var p = function (n) { return String(n).padStart(2, "0"); };
                localStorage.setItem("Microi.NoticeLastReadTime", d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()));
                self.noticeUnreadCount = 0;
            }
        },
        // ====== 公告 ======
        async loadNoticeList() {
            var self = this;
            self.noticeLoading = true;
            try {
                var result = await self.DiyCommon.FormEngine.GetTableData({
                    FormEngineKey: "diy_notice",
                    _PageSize: self.noticePageSize,
                    _PageIndex: self.noticePageIndex,
                    _OrderBy: "CreateTime",
                    _OrderByType: "DESC"
                });
                if (result && result.Code === 1) {
                    self.noticeList = (result.Data || []).map(function (item) {
                        item._expanded = false;
                        return item;
                    });
                    self.noticeCount = result.DataCount || 0;
                }
            } catch (e) {
                console.error("加载公告失败:", e);
            } finally {
                self.noticeLoading = false;
            }
        },
        async loadWFStats() {
            var self = this;
            try {
                var result = await self.DiyCommon.PostAsync("/api/WorkFlow/GetWFStats", {});
                if (result && result.Code === 1 && result.Data) {
                    self.wfStats = result.Data;
                }
            } catch (e) {
                console.error("加载工作流统计失败:", e);
            }
        },
        async loadUnreadCount() {
            var self = this;
            try {
                var lastReadTime = localStorage.getItem("Microi.NoticeLastReadTime") || "2000-01-01 00:00:00";
                var result = await self.DiyCommon.FormEngine.GetTableData({
                    FormEngineKey: "diy_notice",
                    _PageSize: 1,
                    _SelectFields: ["Id"],
                    _Where: [{ Name: "CreateTime", Value: lastReadTime, Type: ">" }]
                });
                if (result && result.Code === 1) {
                    self.noticeUnreadCount = result.DataCount || 0;
                }
            } catch (e) {
                console.error("加载未读公告数失败:", e);
            }
        },
        switchWorkType(type) {
            var self = this;
            self.PageIndex = 1;
            self.WorkType = type;
            self.GetList({ PageIndex: 1 });
        },
        toggleNoticeExpand(item) {
            item._expanded = !item._expanded;
        },
        NoticePageChange(page) {
            var self = this;
            self.noticePageIndex = page;
            self.loadNoticeList();
        },
        // ====== 工作流（保留所有原有功能） ======
        GetList(param) {
            var self = this;
            if (self.WorkType == "Todo") {
                self.GetWFWork(param);
            } else {
                self.GetWFFlow(param);
            }
        },
        GetRightBtnsWidth() {
            var self = this;
            if (self.WorkType == "Done" || self.WorkType == "Todo" || self.WorkType == "Sender") {
                return 240;
            }
            return 120;
        },
        GetFlowRightBtnsWidth() {
            var self = this;
            if (self.WorkType == "Done" || self.WorkType == "Sender") {
                return 240;
            }
            return 120;
        },
        InitSearch() {
            var self = this;
            self.Keyword = "";
            self.GetList({ PageIndex: 1 });
        },
        GetNotice(workModel) {
            var self = this;
            try {
                //[{Id:'fieldId',Name:'FieldName',Label:'姓名',Value:'张三'}]
                if (!self.DiyCommon.IsNull(workModel.NoticeFields)) {
                    var noticeFields = JSON.parse(workModel.NoticeFields);
                    var result = "";
                    noticeFields.forEach((noticeField) => {
                        result += `<span class="badge badge-primary">${noticeField.Label + "：" + noticeField.Value}</span> `; // noticeField.Label + '：' + noticeField.Value + '；';
                    });
                    return result;
                }
                return "";
            } catch (error) {
                return "";
            }
        },
        GetFlowState(flowState) {
            if (flowState == "Running") {
                return `<span class="badge badge-success">运行中</span> `;
            } else if (flowState == "End") {
                return `<span class="badge badge-info">已结束</span> `;
            } else if (flowState == "Cancel") {
                return `<span class="badge badge-danger">已作废</span> `;
            }
            return "";
        },
        CallbackWFSubmit(param) {
            var self = this;
            if (param.Code === 1) {
                self.ShowFieldFormDrawer = false;
                self.GetList({ PageIndex: 1 });
                self.loadWFStats();
            }
        },
        GetNodeName(model) {
            var self = this;
            var result = "";

            try {
                var users = [];
                if (self.WorkType == "Done") {
                    users = JSON.parse(model.HandlerUsers);
                } else if (self.WorkType == "Copy") {
                    users = JSON.parse(model.CopyUsers);
                } else if (self.WorkType == "Connect") {
                    users = JSON.parse(model.NotHandlerUsers);
                } else {
                    return `<span class="badge badge-secondary">${model.NodeName}</span> `;
                }
                var tempArr = _.where(users, { Id: self.GetCurrentUser.Id });
                if (tempArr && tempArr.length > 0) {
                    tempArr.forEach((element) => {
                        result += `<span class="badge badge-secondary">${element.NodeName}</span> `;
                    });
                }
                return result;
            } catch (error) {
                return "";
            }
        },
        /**
         * 只有我的待办model为WorkModel，其余均为FlowModel
         * @param {*} model
         * @param {*} formMode
         * @param {*} OpenWorkType
         */
        async OpenWork(model, formMode, OpenWorkType) {
            var self = this;

            if (self.DiyCommon.IsNull(model.TableId)) {
                self.OpenFormType = "Custom";
            } else {
                self.OpenFormType = "Diy";
            }

            if (self.WorkType == "Todo") {
                self.CurrentWorkModel = model;
            } else {
                self.CurrentWorkModel = {};
            }
            self.FlowTitle = model.FlowTitle;

            self.CurrentTableId = model.TableId;
            self.CurrentTableRowId = model.TableRowId;
            self.OpenFormMode = formMode;
            //检查该条业务数据是否已删除，已删除则删除对应的流程数据，zero303加 2025-02-17
            var res = await self.DiyCommon.FormEngine.GetFormData({
                FormEngineKey: self.CurrentTableId,
                Id: self.CurrentTableRowId
            });
            if (res.Code === 2) {
                self.DiyCommon.Tips("此业务数据已删除", false);
                await self.DiyCommon.ApiEngine.Run("deleteFlow", {
                    Id: self.CurrentTableRowId
                });
                self.GetWFWork();
                return;
            }
            //获取所有节点
            //获取当前节点的字段设置
            var currentFlowId = model.FlowId;
            var currentNodeId = model.NodeId;
            if (self.WorkType == "Sender") {
                currentNodeId = model.StartNodeId;
                currentFlowId = model.Id;
            }
            //如果是我处理的，NodeId要从 HandlerUsers 里面去拿
            else if (self.WorkType == "Done" || self.WorkType == "Copy" || self.WorkType == "Connect") {
                currentFlowId = model.Id;
                try {
                    var handlerUsers = [];
                    if (self.WorkType == "Done") {
                        handlerUsers = JSON.parse(model.HandlerUsers);
                    } else if (self.WorkType == "Copy") {
                        handlerUsers = JSON.parse(model.CopyUsers);
                    } else if (self.WorkType == "Connect") {
                        handlerUsers = JSON.parse(model.NotHandlerUsers);
                    }
                    var tempArr = _.where(handlerUsers, { Id: self.GetCurrentUser.Id });
                    if (tempArr && tempArr.length > 0) {
                        //以最后处理的节点Id为准。
                        currentNodeId = tempArr[tempArr.length - 1].NodeId;
                    }
                } catch (error) {}
            }
            //如果是撤回，必须查询出CurrentWorkModel，否则无法撤回  --2023-06-08 by Anderson
            if (currentFlowId && currentNodeId && !self.CurrentWorkModel.Id && (OpenWorkType == "Recall" || OpenWorkType == "Cancel")) {
                //2023-12-07修复流程撤回bug。
                var workModelResult = await self.DiyCommon.FormEngine.GetFormData({
                    FormEngineKey: "WF_Work",
                    _Where: [
                        { Name: "WorkState", Value: "Done", Type: "=" },
                        { Name: "ReceiverId", Value: self.GetCurrentUser.Id, Type: "=" },
                        { Name: "NodeId", Value: currentNodeId, Type: "=" },
                        { Name: "FlowId", Value: currentFlowId, Type: "=" }
                    ]
                });
                if (workModelResult.Code == 1) {
                    self.CurrentWorkModel = workModelResult.Data;
                }
            }
            self.ShowFieldFormDrawer = true;
            //DIY-FROM-WF
            self.$nextTick(function () {
                self.$refs.refDiyFormWF.InitSendWork({
                    CurrentNodeId: currentNodeId,
                    CurrentFlowId: currentFlowId,
                    CurrentWorkModel: self.CurrentWorkModel,
                    OpenFormMode: self.OpenFormMode,
                    CurrentTableId: self.CurrentTableId,
                    CurrentTableRowId: self.CurrentTableRowId,
                    OpenWorkType: OpenWorkType,
                    CurrentFlowDesign: {
                        Id: model.FlowDesignId
                    }
                });
            });
        },
        OpenWorkFLowList() {
            var self = this;
            self.ShowForm = true;
        },
        //WorkType:Todo/Sender/Done
        GetWFWork(param) {
            var self = this;
            if (param && param._PageIndex) {
                self.PageIndex = param.PageIndex;
            }
            self.TableLoading = true;
            self.DiyCommon.Post(
                "/api/WorkFlow/getWFWork",
                {
                    WorkType: self.WorkType,
                    _PageIndex: self.PageIndex,
                    _PageSize: self.PageSize,
                    _Keyword: self.Keyword
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.MyWorkList = result.Data;
                        self.DataCount = result.DataCount;
                    }
                    self.TableLoading = false;
                }
            );
        },
        GetWFFlow(param) {
            var self = this;
            if (param && param._PageIndex) {
                self.PageIndex = param.PageIndex;
            }
            self.TableLoading = true;
            self.DiyCommon.Post(
                "/api/WorkFlow/getWFFlow",
                {
                    WorkType: self.WorkType,
                    _PageIndex: self.PageIndex,
                    _PageSize: self.PageSize,
                    _Keyword: self.Keyword
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.MyWorkList = result.Data;
                        self.DataCount = result.DataCount;
                    }
                    self.TableLoading = false;
                }
            );
        },
        DiyTableRowCurrentChange(val) {
            var self = this;
            self.PageIndex = val;
            self.GetList();
        },
        DiyTableRowSizeChange(val) {
            var self = this;
            self.PageSize = val;
            localStorage.setItem("Microi.DiyTableRowPageSize_MyWork", val);
            self.PageIndex = 1;
            self.GetList({ PageIndex: 1 });
        },

        //刘诚新增批量审批2025-1-11
        TableRowSelectionChange(val) {
            this.SelectList = val;
        },
        async BatchApproval() {
            var self = this;
            if (self.SelectList.length === 0) {
                self.DiyCommon.Tips("请选择要审批的流程", false);
                return;
            }
            var res = "";
            var count = 0;
            self.DiyCommon.OsConfirm("确定要批量审批" + self.SelectList.length + "条数据吗？", async function () {
                self.TableLoading = true;
                for (var i = 0; i < self.SelectList.length; i++) {
                    res = await self.DiyCommon.PostAsync("/api/WorkFlow/sendWork", {
                        //批量审批
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
                self.DiyCommon.Tips("批量审批成功,共计" + count + "个", true);
                self.GetWFWork();
                self.loadWFStats();
            });
        }
        //批量审批代码结束
    }
};
</script>

<style lang="scss" scoped>
.my-work-page {
    height: 100%;
}

// ====== 主Tab样式 ======
.main-tabs {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    min-height: 100%;

    :deep(.el-tabs__header) {
        background: linear-gradient(135deg, #f8faff 0%, #f0f5ff 100%);
        margin: 0;
        padding: 0 20px;
        border-bottom: 1px solid #ebeef5;
        border-radius: 12px 12px 0 0;
    }

    :deep(.el-tabs__nav-wrap::after) {
        display: none;
    }

    :deep(.el-tabs__item) {
        height: 54px;
        line-height: 54px;
        font-size: 15px;
        color: #606266;
        transition: all 0.3s;

        &.is-active {
            color: var(--el-color-primary, #409eff);
            font-weight: 600;
        }
        &:hover {
            color: var(--el-color-primary, #409eff);
        }
    }

    :deep(.el-tabs__active-bar) {
        height: 3px;
        border-radius: 3px;
    }

    :deep(.el-tabs__content) {
        padding: 20px;
    }
}

.main-tab-label {
    display: inline-flex;
    align-items: center;
    gap: 2px;
}

// ====== 统计卡片 ======
.stats-cards {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px;
    margin-bottom: 16px;
}

.stat-card {
    background: #fff;
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    cursor: pointer;
    border: 2px solid #f0f2f5;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);

    &:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }

    &.active {
        border-color: var(--el-color-primary, #409eff);
        background: linear-gradient(135deg, rgba(64, 158, 255, 0.04) 0%, rgba(64, 158, 255, 0.01) 100%);
        box-shadow: 0 4px 16px rgba(64, 158, 255, 0.12);
    }
}

.stat-icon {
    width: 46px;
    height: 46px;
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 19px;
    color: #fff;
    flex-shrink: 0;
}

.todo-icon { background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%); }
.sender-icon { background: linear-gradient(135deg, #9b59b6 0%, #c39bd3 100%); }
.done-icon { background: linear-gradient(135deg, #67c23a 0%, #95d475 100%); }
.copy-icon { background: linear-gradient(135deg, #e6a23c 0%, #f0c78a 100%); }
.connect-icon { background: linear-gradient(135deg, #00b8d4 0%, #4dd0e1 100%); }

.stat-info {
    min-width: 0;
}

.stat-count {
    font-size: 24px;
    font-weight: 700;
    color: #1d2129;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
}

.stat-label {
    font-size: 12px;
    color: #86909c;
    margin-top: 3px;
    white-space: nowrap;
}

.notice-badge {
    :deep(.el-badge__content) {
        font-size: 11px;
    }
}

.work-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    flex-wrap: wrap;
}

.work-table {
    border-radius: 8px;
    overflow: hidden;

    :deep(.el-table__header th) {
        background: #f8fafc !important;
        color: #475569;
        font-weight: 600;
        font-size: 13px;
    }
}

.work-pagination {
    margin-top: 12px;
    padding: 8px 0;
}

// ====== 公告区域 ======
.notice-section {
    min-height: 200px;
}

.notice-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.notice-item {
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 10px;
    padding: 14px 18px;
    cursor: pointer;
    transition: all 0.25s;

    &:hover {
        border-color: var(--el-color-primary, #409eff);
        box-shadow: 0 2px 10px rgba(64, 158, 255, 0.08);
    }
}

.notice-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.notice-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
}

.notice-title {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.notice-date {
    font-size: 12px;
    color: #909399;
    flex-shrink: 0;
}

.notice-body {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #ebeef5;
    font-size: 13px;
    color: #606266;
    line-height: 1.8;
    word-break: break-all;
}

.notice-pagination {
    margin-top: 16px;
    display: flex;
    justify-content: center;
}

// ====== 响应式 ======
@media (max-width: 768px) {
    .main-tabs {
        border-radius: 8px;

        :deep(.el-tabs__header) {
            padding: 0 10px;
            border-radius: 8px 8px 0 0;
        }

        :deep(.el-tabs__item) {
            height: 44px;
            line-height: 44px;
            font-size: 13px;
            padding: 0 10px;
        }

        :deep(.el-tabs__content) {
            padding: 12px;
        }
    }

    .stats-cards {
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }

    .stat-card {
        padding: 12px 10px;
        gap: 10px;
        border-radius: 10px;
    }

    .stat-icon {
        width: 36px;
        height: 36px;
        font-size: 15px;
        border-radius: 10px;
    }

    .stat-count {
        font-size: 18px;
    }

    .work-toolbar {
        flex-direction: column;
        align-items: stretch;

        .search-input {
            width: 100% !important;
        }
    }

    .notice-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
    }
}
</style>

<style lang="scss">
.workflow-history {
    .el-timeline-item__tail {
        left: 14px;
    }
    .el-timeline-item__wrapper {
        padding-left: 45px;
    }
}
</style>
