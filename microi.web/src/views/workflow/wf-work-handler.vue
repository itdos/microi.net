<template>
    <div class="wf-work-handler">
        <template v-if="OpenFormMode == 'Edit'">
            <!--同意、拒绝、移交-->
            <div style="margin-top: 10px" v-if="CurrentNodeModel.NodeType != 'Business' && CurrentStartType != 'StartWork'">
                <!--如果是业务节点，不需要显示同意或不同意-->
                <el-radio-group v-model="CurrentApprovalType" @change="ChangeCurrentApprovalType">
                    <el-radio :value="'Agree'" border>同意</el-radio>
                    <el-radio :value="'Disagree'" border>拒绝</el-radio>
                    <el-radio v-if="CurrentNodeModel.AllowHandOver" :value="'HandOver'" border>移交</el-radio>
                    <!-- <el-radio :value="'Recall'" border>撤回</el-radio> -->
                </el-radio-group>
            </div>
            <!--请选择退回节点-->
            <div style="margin-top: 10px" v-if="CurrentApprovalType == 'Disagree'">
                <el-select v-model="CurrentBackNodeId" filterable clearable placeholder="请选择退回节点" @change="ChangeCurrentBackNodeId">
                    <el-option v-for="node in CurrentBackNodes" :key="node.Id" :label="node.NodeName" :value="node.Id"> </el-option>
                </el-select>
            </div>
        </template>

        <template v-if="OpenFormMode == 'Edit' || OpenFormMode == 'Add'">
            <!--选择审批人：-->
            <div style="margin-top: 10px" v-if="NextNodeConfirmUsersData.AllowSelectUsers === true && NextNodeConfirmUsersData.SelectUsers.length">
                <div style="margin-bottom: 5px">选择审批人：</div>
                <el-checkbox-group v-model="CurrentSelectUsers" :max="20">
                    <el-checkbox v-for="user in NextNodeConfirmUsersData.SelectUsers" :value="user.Id" :key="user.Id">{{ user.Name }}</el-checkbox>
                </el-checkbox-group>
            </div>
            <!--添加审批人：-->
            <div style="margin-top: 10px" v-if="NextNodeConfirmUsersData.AllowAddUsers === true && CurrentApprovalType != 'HandOver'">
                <div style="margin-bottom: 5px">添加审批人：</div>
                <el-select v-model="CurrentAddUsers" filterable clearable multiple placeholder="请选择" style="width: 100%">
                    <el-option v-for="user in SysUserList" :key="'addUser_' + user.Id" :label="user.Name" :value="user.Id"> </el-option>
                </el-select>
            </div>
            <!--指定移交人：-->
            <div style="margin-top: 10px" v-if="CurrentApprovalType === 'HandOver' && !CurrentNodeModel.HideHandOverSelect">
                <div style="margin-bottom: 5px">指定移交人：</div>
                <el-select v-model="CurrentAddHandOverUsers" filterable clearable multiple placeholder="请选择" style="width: 100%">
                    <el-option v-for="user in SysUserList" :key="'addUser2_' + user.Id" :label="user.Name" :value="user.Id"> </el-option>
                </el-select>
            </div>
            <!--请输入意见/评论-->
            <div style="margin-top: 10px">
                <el-input type="textarea" :rows="4" placeholder="请输入意见/评论" v-model="CurrentApprovalIdea"> </el-input>
            </div>
            <!--提交-->
            <div style="margin-top: 10px">
                <el-button @click="SubmitWF" :loading="BtnLoading" :disabled="DisableSubmitWF()" type="primary" :icon="QuestionFilled">
                    {{ CurrentStartType == "StartWork" ? "发起流程" : "处理工作" }}
                    <!-- $t('Msg.Submit') -->
                </el-button>
            </div>
        </template>

        <template v-if="OpenWorkType == 'Recall' || OpenWorkType == 'Cancel'">
            <!--撤回、作废-->
            <div style="margin-top: 10px">
                <el-checkbox v-model="DefaultSelect" border>{{ OpenWorkType == "Recall" ? "撤回" : "作废" }}</el-checkbox>
            </div>
        </template>
        <template v-if="OpenWorkType == 'Recall' || OpenWorkType == 'Cancel'">
            <!--请输入撤回、作废原因-->
            <div style="margin-top: 10px">
                <el-input type="textarea" :rows="2" :placeholder="`请输入${OpenWorkType == 'Recall' ? '撤回' : '作废'}原因`" v-model="CurrentApprovalIdea"> </el-input>
            </div>
            <!--撤回提交-->
            <div style="margin-top: 10px">
                <el-button @click="SubmitRecallOrCancelWork" :loading="BtnLoading" type="primary" :icon="QuestionFilled">{{ $t("Msg.Submit") }} </el-button>
            </div>
        </template>

        <!--流转记录-->
        <el-tabs v-model="WorkFlowInfo" style="margin-top: 10px">
            <el-tab-pane label="流转记录" name="History">
                <div style="min-height: 100px">
                    <WFHistory ref="refWFHistory"></WFHistory>
                </div>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script>
import "./css/index.css";
import { computed } from "vue";
import { useDiyStore } from "@/pinia";
import _ from "underscore";

export default {
    name: "wf_work_handler",
    directives: {},
    components: {},
    setup() {
        const diyStore = useDiyStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const OsClient = computed(() => diyStore.OsClient);
        return {
            diyStore,
            GetCurrentUser,
            OsClient
        };
    },
    props: {
        FormData: {
            type: Object,
            default() {
                return {};
            }
        }
    },
    watch: {},
    data() {
        return {
            DefaultSelect: true,
            WorkFlowInfo: "History", //FlowDesign
            CurrentApprovalType: "",
            CurrentApprovalIdea: "",
            CurrentBackNodeId: [],
            CurrentBackNodes: [],
            CurrentNodeModel: {},
            CurrentWorkModel: {},
            OpenFormMode: "",
            CurrentTableId: "",
            CurrentTableRowId: "",
            CurrentHideFields: [],
            CurrentDefaultValues: {},
            CurrentShowFields: [],
            CurrentReadonlyFields: [],
            CurrentFlowDesign: {},
            CurrentFlowDesignId: "",
            //还是使用CurrentNodeModel
            // CurrentStartNodeModel:{},
            CurrentNodeId: "",
            CurrentFlowId: "",
            //StartWork、SendWork
            CurrentStartType: "",
            BtnLoading: false,
            //获取
            IsNextNodeConfirmUsers: false,
            NextNodeConfirmUsersData: {},
            CurrentSelectUsers: [],
            CurrentAddUsers: [],
            CurrentAddHandOverUsers: [],
            SysUserList: [],
            OpenWorkType: "",
            ForceSelectUsers: []
        };
    },
    mounted() {
        var self = this;
        self.GetSysUser();
    },
    methods: {
        async RunAllowAddUserV8Code(code) {
            var self = this;
            if (!self.DiyCommon.IsNull(code)) {
                var V8 = {
                    EventName: "WFNodeAllowAddUserV8Code"
                };
                V8.Form = self.FormData;
                // V8.OldForm = param.OldForm;
                V8.WF = {
                    ApprovalType: self.CurrentApprovalType,
                    ApprovalIdea: self.CurrentApprovalIdea,
                    AddUsers: self.CurrentAddUsers,
                    SelectUsers: self.CurrentSelectUsers,
                    CurrentFlowDesign: self.CurrentFlowDesign,
                    CurrentFlowDesignId: self.CurrentFlowDesignId,
                    CurrentNode: self.CurrentNodeModel,
                    BackNodeId: self.CurrentBackNodeId
                };
                self.SetV8DefaultValue(V8, self.FormData);
                await self.DiyCommon.InitV8Code(V8, self.$router);
                try {
                    await eval("(async () => {\n " + code + " \n})()");
                    if (V8.WF.ForceSelectUsers) {
                        self.ForceSelectUsers = V8.WF.ForceSelectUsers;
                    } else {
                        self.ForceSelectUsers = [];
                    }
                    return V8.Result;
                } catch (error) {
                    self.DiyCommon.Tips("执行允许添加审批人数据源V8代码出现错误：" + error.message, false);
                    return V8.Result;
                } finally {
                    
                }
            }
            return [];
        },
        SubmitHandOverWork() {
            var self = this;
            self.CurrentApprovalType = "HandOver";
            self.BtnLoading = true;

            //这里的5个值，要和CallbackSendWork接收到的param赋值数量对应
            self.$emit(
                "CallbackHandOverWork",
                {
                    CurrentNodeModel: self.CurrentNodeModel,
                    CurrentFlowDesign: self.CurrentFlowDesign,
                    CurrentFlowDesignId: self.CurrentFlowDesignId,
                    CurrentApprovalType: self.CurrentApprovalType,
                    CurrentApprovalIdea: self.CurrentApprovalIdea,
                    CurrentSelectUsers: self.CurrentSelectUsers,
                    ForceSelectUsers: self.ForceSelectUsers,
                    CurrentBackNodeId: self.CurrentBackNodeId,
                    CurrentAddUsers: self.CurrentAddHandOverUsers
                },
                function () {
                    self.BtnLoading = false;
                }
            );
        },
        HandOverWork(param, callback) {
            var self = this;
            if (self.DiyCommon.IsNull(param.FormData)) {
                param.FormData = {};
            }

            var _formData = param.FormData;
            if (param.FormData) {
                self.DiyCommon.ForRowModelHandler(param.FormData, param.DiyFieldList);
                _formData = self.DiyCommon.ConvertRowModel(param.FormData);
            }

            self.DiyCommon.Post(
                "/api/WorkFlow/handOverWork",
                {
                    WorkId: self.CurrentWorkModel.Id,
                    FlowId: self.CurrentWorkModel.FlowId,
                    ApprovalIdea: self.CurrentApprovalIdea,
                    AddUsers: self.CurrentAddHandOverUsers,
                    ForceSelectUsers: self.ForceSelectUsers,
                    FormData: JSON.stringify(_formData)
                },
                async function (result) {
                    self.BtnLoading = false;
                    if (self.DiyCommon.Result(result)) {
                        //处理返回结果提示
                        var receivers = "";
                        result.Data.Receivers.forEach((user) => {
                            receivers += user.Name + ",";
                        });
                        try {
                            receivers = receivers.TrimEnd(",");
                        } catch (error) {}
                        self.DiyCommon.Tips("工作移交成功！<br>已移交至待办人：" + receivers + "。<br>已移交至节点：" + result.Data.ToNodeName + "。", true, 10);

                        if (!self.DiyCommon.IsNull(self.CurrentNodeModel.EndV8)) {
                            var V8 = {
                                EventName: "WFNodeEnd"
                            };
                            V8.Form = param.FormData;
                            V8.OldForm = param.OldForm;
                            V8.WF = {
                                ApprovalType: self.CurrentApprovalType,
                                ApprovalIdea: self.CurrentApprovalIdea,
                                AddUsers: self.CurrentAddHandOverUsers,
                                SelectUsers: self.CurrentSelectUsers,
                                CurrentFlowDesign: self.CurrentFlowDesign,
                                CurrentFlowDesignId: self.CurrentFlowDesignId,
                                CurrentNode: self.CurrentNodeModel,
                                WorkResult: result.Data,
                                BackNodeId: self.CurrentBackNodeId
                            };
                            self.SetV8DefaultValue(V8, param.FormData);
                            await self.DiyCommon.InitV8Code(V8, self.$router);
                            try {
                                await eval("(async () => {\n " + self.CurrentNodeModel.EndV8 + " \n})()");
                            } catch (error) {
                                self.DiyCommon.Tips("执行节点结束V8代码出现错误：" + error.message, false);
                            } finally {
                                
                            }
                        }

                        self.$emit("CallbackWFSubmit", { Code: 1 });
                    }
                    //告诉工作流引擎核心，已经处理完表单提交和流程提交
                    if (callback) {
                        callback(result);
                    }
                }
            );
        },

        SubmitRecallOrCancelWork() {
            var self = this;
            self.CurrentApprovalType = self.OpenWorkType; //'Recall';
            self.BtnLoading = true;
            //这里的5个值，要和CallbackSendWork接收到的param赋值数量对应
            self.$emit(
                "CallbackRecallOrCancelWork",
                {
                    CurrentNodeModel: self.CurrentNodeModel,
                    CurrentFlowDesign: self.CurrentFlowDesign,
                    CurrentFlowDesignId: self.CurrentFlowDesignId,
                    CurrentApprovalType: self.CurrentApprovalType,
                    CurrentApprovalIdea: self.CurrentApprovalIdea,
                    CurrentSelectUsers: self.CurrentSelectUsers,
                    ForceSelectUsers: self.ForceSelectUsers,
                    CurrentBackNodeId: self.CurrentBackNodeId,
                    CurrentAddUsers: self.CurrentAddUsers
                },
                function () {
                    self.BtnLoading = false;
                }
            );
        },
        RecallOrCancelWork(param, callback) {
            var self = this;
            if (self.DiyCommon.IsNull(param.FormData)) {
                param.FormData = {};
            }
            var url = "/api/WorkFlow/recallWork";
            if (param.CurrentApprovalType == "Cancel") {
                url = "/api/WorkFlow/cancelFlow";
            }
            self.DiyCommon.Post(
                url,
                {
                    WorkId: self.CurrentWorkModel.Id,
                    FlowId: self.CurrentWorkModel.FlowId || self.CurrentFlowId,
                    ApprovalIdea: self.CurrentApprovalIdea
                },
                async function (result) {
                    self.BtnLoading = false;
                    if (self.DiyCommon.Result(result)) {
                        //处理返回结果提示
                        var receivers = "";
                        try {
                            result.Data.Receivers.forEach((user) => {
                                receivers += user.Name + ",";
                            });
                        } catch (error) {}
                        try {
                            receivers = receivers.TrimEnd(",");
                        } catch (error) {}
                        if (param.CurrentApprovalType == "Cancel") {
                            self.DiyCommon.Tips(`流程作废成功！流程已结束！`, true, 10);
                        } else {
                            self.DiyCommon.Tips(`工作撤回成功！<br>已撤回至待办人：${receivers}。<br>已撤回至节点：${result.Data.ToNodeName}。`, true, 10);
                        }

                        if (!self.DiyCommon.IsNull(self.CurrentNodeModel.EndV8)) {
                            var V8 = {
                                EventName: "WFNodeEnd"
                            };
                            V8.Form = param.FormData;
                            V8.OldForm = param.OldForm;
                            V8.WF = {
                                ApprovalType: self.CurrentApprovalType,
                                ApprovalIdea: self.CurrentApprovalIdea,
                                AddUsers: self.CurrentAddUsers,
                                SelectUsers: self.CurrentSelectUsers,
                                CurrentFlowDesign: self.CurrentFlowDesign,
                                CurrentFlowDesignId: self.CurrentFlowDesignId,
                                CurrentNode: self.CurrentNodeModel,
                                WorkResult: result.Data,
                                BackNodeId: self.CurrentBackNodeId
                            };
                            self.SetV8DefaultValue(V8, param.FormData);
                            await self.DiyCommon.InitV8Code(V8, self.$router);
                            try {
                                await eval("(async () => {\n " + self.CurrentNodeModel.EndV8 + " \n})()");
                            } catch (error) {
                                self.DiyCommon.Tips("执行节点结束V8代码出现错误：" + error.message, false);
                            } finally {
                                
                            }
                        }

                        self.$emit("CallbackWFSubmit", { Code: 1 });
                    }
                    //告诉工作流引擎核心，已经处理完表单提交和流程提交
                    if (callback) {
                        callback(result);
                    }
                }
            );
        },
        DisableSubmitWF() {
            var self = this;
            //如果已经请求了下个节点可能要确认的人、或者是业务节点，则可以直接提交了
            if (self.IsNextNodeConfirmUsers == true || self.CurrentNodeModel.NodeType == "Business") {
                return false;
            }
            return true;
        },
        GetSysUser() {
            var self = this;
            self.DiyCommon.Post(
                self.DiyApi.GetSysUser(),
                {
                    // _PageSize: self.SysUserPageSize,
                    // _PageIndex: self.SysUserPageIndex,
                    // _Keyword: self.SearchModel.Keyword,
                    // RoleIds:self.SearchModel.RoleIds,
                    // DeptId:self.SearchModel.DeptId,
                    // State : self.SearchModel.State,
                },
                function (result) {
                    self.tableLoading = false;
                    if (self.DiyCommon.Result(result)) {
                        self.SysUserList = result.Data;
                        // self.SysUserCount = result.DataCount
                    }
                }
            );
        },
        GetNextNodeConfirmUsers() {
            var self = this;
            self.$emit("CallbackGetFormData", {});
            self.$nextTick(function () {
                self.IsNextNodeConfirmUsers = false;
                var approvalType = "";
                if (self.CurrentStartType == "StartWork") {
                    approvalType = "Auto";
                } else if (self.CurrentNodeModel.NodeType == "Business") {
                    approvalType = "Agree";
                } else {
                    approvalType = self.CurrentApprovalType;
                }
                self.DiyCommon.Post(
                    "/api/WorkFlow/getNextNodeConfirmUsers",
                    {
                        NodeId: self.CurrentNodeId,
                        ApprovalType: approvalType,
                        BackNodeId: self.CurrentBackNodeId,
                        WorkId: self.CurrentWorkModel.Id
                    },
                    async function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.NextNodeConfirmUsersData = result.Data;
                            self.IsNextNodeConfirmUsers = true;
                            //2023-12-10 新增：V8指定可添加审批人
                            if (self.NextNodeConfirmUsersData.AllowAddUserV8Code) {
                                var userList = await self.RunAllowAddUserV8Code(self.NextNodeConfirmUsersData.AllowAddUserV8Code);
                                if (userList && userList.length > 0) {
                                    self.SysUserList = userList;
                                }
                            }
                        }
                    }
                );
            });
        },
        ChangeCurrentApprovalType(val) {
            var self = this;
            if (val == "Agree" || (val == "Disagree" && !self.DiyCommon.IsNull(self.CurrentBackNodeId))) {
                self.GetNextNodeConfirmUsers();
            } else if (val == "HandOver") {
                self.IsNextNodeConfirmUsers = true;
            }
        },
        ChangeCurrentBackNodeId(val) {
            var self = this;
            if (!self.DiyCommon.IsNull(val)) {
                self.GetNextNodeConfirmUsers();
            }
        },
        /**
         * 初始化发起流程
         */
        InitStartWork(param, callback) {
            var self = this;

            self.CurrentStartType = "StartWork";

            self.CurrentFlowDesign = param.CurrentFlowDesign;
            self.CurrentFlowDesignId = param.CurrentFlowDesign ? param.CurrentFlowDesign.Id : param.CurrentFlowDesignId;
            self.CurrentTableId = param.CurrentTableId;
            self.OpenFormMode = param.OpenFormMode;

            //----HISTORY
            self.$nextTick(function () {
                self.$refs.refWFHistory.Init({
                    CurrentFlowId: self.CurrentFlowId,
                    CurrentFlowDesignId: self.CurrentFlowDesignId,
                    CurrentNodeId: self.CurrentNodeId
                });
            });

            self.CurrentHideFields = [];
            self.DiyCommon.Post("/api/diytable/NewGuid", {}, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.CurrentTableRowId = result.Data;
                    //获取字段设置
                    var startNode = self.DiyCommon.Post(
                        "/api/WorkFlow/getStartWFNode",
                        {
                            FlowDesignId: self.CurrentFlowDesignId
                        },
                        async function (result) {
                            if (self.DiyCommon.Result(result)) {
                                // self.CurrentStartNodeModel = result.Data;
                                self.CurrentNodeModel = result.Data;
                                self.CurrentNodeId = result.Data.Id;

                                var fieldsConfig = [];
                                // if (!self.DiyCommon.IsNull(self.CurrentStartNodeModel.FieldsConfig)) {
                                //     fieldsConfig = JSON.parse(self.CurrentStartNodeModel.FieldsConfig);
                                // }
                                if (!self.DiyCommon.IsNull(self.CurrentNodeModel.FieldsConfig)) {
                                    fieldsConfig = JSON.parse(self.CurrentNodeModel.FieldsConfig);
                                }
                                //哪些字段要隐藏（不显示的就要隐藏）,或者说哪些字段要显示? 一般是要隐藏的比较少，指定比较少的
                                //哪些字段可编辑，也就是哪些要只读，一般是可编辑的少，
                                var currentHideFields = [];
                                var currentShowFields = [];
                                var currentReadonlyFields = [];
                                fieldsConfig.forEach((config) => {
                                    // if (config.Display == false) {
                                    //     currentHideFields.push(config.Name);
                                    // }
                                    if (config.Display) {
                                        currentShowFields.push(config.Name);
                                    }
                                    if (config.Edit == false) {
                                        currentReadonlyFields.push(config.Name);
                                    }
                                });
                                self.CurrentShowFields = currentShowFields;
                                // self.CurrentHideFields = currentHideFields;
                                self.CurrentReadonlyFields = currentReadonlyFields;

                                // self.ShowStartFlowForm = true;//回调执行
                                self.$emit("CallbackInitStartWork");

                                self.$nextTick(function () {
                                    if (callback) {
                                        // self.$refs.diyFormWfWork.Init();//这句放到callback里面执行
                                        callback({
                                            CurrentTableRowId: self.CurrentTableRowId,
                                            CurrentShowFields: self.CurrentShowFields,
                                            CurrentReadonlyFields: self.CurrentReadonlyFields
                                        });
                                    }
                                    self.GetNextNodeConfirmUsers();
                                });
                            }
                        }
                    );
                } else {
                }
            });
        },
        InitSendWork(param, callback) {
            var self = this;

            self.CurrentFlowDesign = param.CurrentFlowDesign;
            self.CurrentFlowDesignId = param.CurrentFlowDesign ? param.CurrentFlowDesign.Id : param.CurrentFlowDesignId;

            self.OpenWorkType = param.OpenWorkType;

            self.CurrentStartType = "SendWork";
            self.CurrentNodeId = param.CurrentNodeId;
            self.CurrentFlowId = param.CurrentFlowId;
            //----HISTORY
            self.$nextTick(function () {
                self.$refs.refWFHistory.Init({
                    CurrentFlowId: self.CurrentFlowId,
                    CurrentFlowDesignId: self.CurrentFlowDesignId,
                    CurrentNodeId: self.CurrentNodeId
                });
            });
            self.CurrentWorkModel = param.CurrentWorkModel;
            self.OpenFormMode = param.OpenFormMode;
            self.CurrentTableId = param.CurrentTableId;
            self.CurrentTableRowId = param.CurrentTableRowId;

            self.CurrentApprovalType = "";
            self.CurrentApprovalIdea = "";

            self.DiyCommon.Post("/api/WorkFlow/getWFNodeModel", { NodeId: self.CurrentNodeId }, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.CurrentNodeModel = result.Data;

                    self.CurrentBackNodes = [];
                    var currentBackNodes = [];
                    if (!self.DiyCommon.IsNull(result.Data.BackNodes)) {
                        //只存了Id，需要把NodeName赋值一样
                        var backNodes = JSON.parse(result.Data.BackNodes);
                        currentBackNodes = backNodes;
                        // backNodes.forEach(nodeId => {
                        //     var nodeName = _.where();
                        //     currentBackNodes.push({
                        //         Id : nodeId,
                        //         NodeName : nodeId
                        //     });
                        // });
                    }
                    self.CurrentBackNodes = currentBackNodes;

                    var fieldsConfig = [];
                    if (!self.DiyCommon.IsNull(self.CurrentNodeModel.FieldsConfig)) {
                        fieldsConfig = JSON.parse(self.CurrentNodeModel.FieldsConfig);
                    }

                    //哪些字段要隐藏（不显示的就要隐藏）,或者说哪些字段要显示? 一般是要隐藏的比较少，指定比较少的
                    //哪些字段可编辑，也就是哪些要只读，一般是可编辑的少，
                    var currentHideFields = [];
                    var currentShowFields = [];
                    var currentReadonlyFields = [];
                    fieldsConfig.forEach((config) => {
                        // if (config.Display == false) {
                        //     currentHideFields.push(config.Name);
                        // }
                        if (config.Display) {
                            currentShowFields.push(config.Name);
                        }
                        if (config.Edit == false) {
                            currentReadonlyFields.push(config.Name);
                        }
                    });
                    self.CurrentShowFields = currentShowFields; //上级回调函数执行
                    // self.CurrentHideFields = currentHideFields;
                    self.CurrentReadonlyFields = currentReadonlyFields; //上级回调函数执行
                    // self.ShowFieldFormDrawer = true;//上级回调函数执行
                    self.$emit("CallbackInit", {
                        CurrentShowFields: currentShowFields,
                        CurrentReadonlyFields: currentReadonlyFields
                    });
                    self.$nextTick(function () {
                        if (callback) {
                            callback({
                                CurrentShowFields: self.CurrentShowFields,
                                CurrentReadonlyFields: self.CurrentReadonlyFields
                            });
                            //self.$refs.diyFormWfWork.Init(true);//上级回调函数执行  //放到了callback去执行
                        }
                    });

                    if (self.CurrentNodeModel.NodeType == "Business") {
                        self.CurrentApprovalType = "Auto";
                        self.GetNextNodeConfirmUsers();
                    }
                }
            });
        },
        /**
         * 提交流程  可能是发起工作，也可能是处理工作
         */
        SubmitWF() {
            var self = this;
            if (self.CurrentApprovalType === "HandOver") {
                self.SubmitHandOverWork();
            } else if (self.CurrentStartType == "StartWork") {
                self.CurrentApprovalType = "Auto";
                self.SubmitStartWork();
            } else {
                self.SubmitSendWork();
            }
        },
        async SubmitStartWork() {
            var self = this;
            self.BtnLoading = true;
            //在表单提交前，先执行节点开始v8？但这里拿不到表单的数据

            //这里的5个值，要和CallbackStartWork接收到的param赋值数量对应
            self.$emit(
                "CallbackStartWork",
                {
                    CurrentNodeModel: self.CurrentNodeModel,
                    CurrentFlowDesign: self.CurrentFlowDesign,
                    CurrentFlowDesignId: self.CurrentFlowDesignId,
                    CurrentApprovalIdea: self.CurrentApprovalIdea,
                    CurrentAddUsers: self.CurrentAddUsers,
                    CurrentSelectUsers: self.CurrentSelectUsers,
                    ForceSelectUsers: self.ForceSelectUsers
                },
                function () {
                    //表单提交完成的回调函数
                    self.BtnLoading = false;
                }
            );
        },
        /**
         * 需要传入：Form
         * 返回V8对象
         * @param {*} param
         */
        async RunNodeStartV8(param) {
            var self = this;
            if (!self.DiyCommon.IsNull(self.CurrentNodeModel.StartV8)) {
                var V8 = {
                    EventName: "WFNodeStart"
                };
                V8.Form = param.Form;
                V8.OldForm = param.OldForm;
                V8.WF = {
                    ApprovalType: self.CurrentApprovalType,
                    ApprovalIdea: self.CurrentApprovalIdea,
                    AddUsers: self.CurrentAddUsers,
                    SelectUsers: self.CurrentSelectUsers,
                    CurrentFlowDesign: self.CurrentFlowDesign,
                    CurrentFlowDesignId: self.CurrentFlowDesignId,
                    CurrentNode: self.CurrentNodeModel,
                    BackNodeId: self.CurrentBackNodeId
                };
                self.SetV8DefaultValue(V8, param.Form);
                await self.DiyCommon.InitV8Code(V8, self.$router);
                try {
                    await eval("(async () => {\n " + self.CurrentNodeModel.StartV8 + " \n})()");
                    if (V8.WF.ForceSelectUsers) {
                        self.ForceSelectUsers = V8.WF.ForceSelectUsers;
                    } else {
                        self.ForceSelectUsers = [];
                    }
                    return V8;
                } catch (error) {
                    self.DiyCommon.Tips("执行节点开始V8代码出现错误：" + error.message, false);
                    return V8;
                } finally {
                    
                }
            }
            return {};
        },
        /**
         * 传入FormData
         * @param {*} param
         * @param {*} callback
         */
        StartWork(param, callback) {
            var self = this;
            if (self.DiyCommon.IsNull(param.FormData)) {
                param.FormData = {};
            }
            //获取通知字段--后期修改为服务器端自动处理
            var noticeFields = [];
            if (!self.DiyCommon.IsNull(self.CurrentNodeModel.FieldsConfig)) {
                var fieldsConfig = JSON.parse(self.CurrentNodeModel.FieldsConfig);
                fieldsConfig.forEach((config) => {
                    if (config.Notice == true) {
                        noticeFields.push({
                            Id: config.Id,
                            Name: config.Name,
                            Label: config.Label,
                            Value: param.FormData[config.Name] ? param.FormData[config.Name] : ""
                        });
                    }
                });
            }
            var _formData = param.FormData;
            if (param.FormData) {
                self.DiyCommon.ForRowModelHandler(param.FormData, param.DiyFieldList);
                _formData = self.DiyCommon.ConvertRowModel(param.FormData);
            }

            self.DiyCommon.Post(
                "/api/WorkFlow/startWork",
                {
                    FlowDesignId: self.CurrentFlowDesignId,
                    FormData: JSON.stringify(_formData),
                    TableRowId: param.FormData.Id,
                    NoticeFields: JSON.stringify(noticeFields),
                    ApprovalIdea: self.CurrentApprovalIdea,
                    AddUsers: self.CurrentAddUsers,
                    SelectUsers: self.CurrentSelectUsers,
                    ForceSelectUsers: self.ForceSelectUsers
                },
                async function (result) {
                    self.BtnLoading = false;
                    if (self.DiyCommon.Result(result)) {
                        //处理返回结果提示
                        var receivers = "";
                        result.Data.Receivers.forEach((user) => {
                            receivers += user.Name + ",";
                        });
                        try {
                            receivers = receivers.TrimEnd(",");
                        } catch (error) {}

                        self.DiyCommon.Tips("流程发起成功！<br>已发送至待办人：" + receivers + "。<br>已发送至节点：" + result.Data.ToNodeName + "。", true, 10);

                        if (!self.DiyCommon.IsNull(self.CurrentNodeModel.EndV8)) {
                            var V8 = {
                                EventName: "WFNodeEnd"
                            };
                            V8.Form = param.FormData;
                            V8.OldForm = param.OldForm;
                            V8.WF = {
                                ApprovalType: self.CurrentApprovalType,
                                ApprovalIdea: self.CurrentApprovalIdea,
                                AddUsers: self.CurrentAddUsers,
                                SelectUsers: self.CurrentSelectUsers,
                                CurrentFlowDesign: self.CurrentFlowDesign,
                                CurrentFlowDesignId: self.CurrentFlowDesignId,
                                CurrentNode: self.CurrentNodeModel,
                                WorkResult: result.Data
                            };
                            self.SetV8DefaultValue(V8, param.FormData);
                            await self.DiyCommon.InitV8Code(V8, self.$router);
                            try {
                                await eval("(async () => {\n " + self.CurrentNodeModel.EndV8 + " \n})()");
                            } catch (error) {
                                self.DiyCommon.Tips("执行节点结束V8代码出现错误：" + error.message, false);
                            } finally {
                                
                            }
                        }
                        self.$emit("CallbackWFSubmit", { Code: 1 });
                    } else {
                        self.$emit("CallbackWFSubmit", { Code: 0 });
                    }
                    //告诉工作流引擎核心，已经处理完表单提交和流程提交---其实不是了
                    if (callback) {
                        callback(result);
                    }
                }
            );
        },
        SendWork(param, callback) {
            var self = this;
            if (self.DiyCommon.IsNull(param.FormData)) {
                param.FormData = {};
            }
            //获取通知字段
            var noticeFields = [];
            if (!self.DiyCommon.IsNull(self.CurrentNodeModel.FieldsConfig)) {
                var fieldsConfig = JSON.parse(self.CurrentNodeModel.FieldsConfig);
                fieldsConfig.forEach((config) => {
                    if (config.Notice == true) {
                        noticeFields.push({
                            Id: config.Id,
                            Name: config.Name,
                            Label: config.Label,
                            Value: param.FormData[config.Name] ? param.FormData[config.Name] : ""
                        });
                    }
                });
            }

            var _formData = param.FormData;
            if (param.FormData) {
                self.DiyCommon.ForRowModelHandler(param.FormData, param.DiyFieldList);
                _formData = self.DiyCommon.ConvertRowModel(param.FormData);
            }

            self.DiyCommon.Post(
                "/api/WorkFlow/sendWork",
                {
                    WorkId: self.CurrentWorkModel.Id,
                    FlowId: self.CurrentWorkModel.FlowId,
                    FormData: JSON.stringify(_formData),
                    ApprovalType: self.CurrentApprovalType,
                    ApprovalIdea: self.CurrentApprovalIdea,
                    BackNodeId: self.CurrentBackNodeId,
                    NoticeFields: JSON.stringify(noticeFields),
                    AddUsers: self.CurrentAddUsers,
                    SelectUsers: self.CurrentSelectUsers,
                    ForceSelectUsers: self.ForceSelectUsers
                },
                async function (result) {
                    self.BtnLoading = false;
                    if (self.DiyCommon.Result(result)) {
                        //处理返回结果提示
                        //处理流程发送成功后
                        var receivers = "";
                        result.Data.Receivers.forEach((user) => {
                            receivers += user.Name + ",";
                        });
                        try {
                            receivers = receivers.TrimEnd(",");
                        } catch (error) {}
                        if (result.Data.FlowEnd) {
                            self.DiyCommon.Tips("流程处理成功！<br>流程已结束！", true, 10);
                        } else if (self.CurrentNodeModel.NodeType != "End" || receivers) {
                            self.DiyCommon.Tips("流程处理成功！<br>已发送至待办人：" + receivers + "。<br>已发送至节点：" + result.Data.ToNodeName + "。", true, 10);
                        }

                        if (!self.DiyCommon.IsNull(self.CurrentNodeModel.EndV8)) {
                            var V8 = {
                                EventName: "WFNodeEnd"
                            };
                            V8.Form = param.FormData;
                            V8.OldForm = param.OldForm;
                            V8.WF = {
                                ApprovalType: self.CurrentApprovalType,
                                ApprovalIdea: self.CurrentApprovalIdea,
                                AddUsers: self.CurrentAddUsers,
                                SelectUsers: self.CurrentSelectUsers,
                                CurrentFlowDesign: self.CurrentFlowDesign,
                                CurrentFlowDesignId: self.CurrentFlowDesignId,
                                CurrentNode: self.CurrentNodeModel,
                                WorkResult: result.Data,
                                BackNodeId: self.CurrentBackNodeId
                            };
                            self.SetV8DefaultValue(V8, param.FormData);
                            await self.DiyCommon.InitV8Code(V8, self.$router);
                            try {
                                await eval("(async () => {\n " + self.CurrentNodeModel.EndV8 + " \n})()");
                            } catch (error) {
                                self.DiyCommon.Tips("执行节点结束V8代码出现错误：" + error.message, false);
                            } finally {
                                
                            }
                        }

                        self.$emit("CallbackWFSubmit", { Code: 1 });
                    } else {
                        self.$emit("CallbackWFSubmit", { Code: 0 });
                    }
                    //告诉工作流引擎核心，已经处理完表单提交和流程提交
                    if (callback) {
                        callback(result);
                    }
                }
            );
        },
        SubmitSendWork() {
            var self = this;
            if (self.CurrentStartType != "StartWork" && self.CurrentNodeModel.NodeType != "Business" && self.DiyCommon.IsNull(self.CurrentApprovalType)) {
                self.DiyCommon.Tips("请选择审批类型！", false);
                return;
            }
            self.BtnLoading = true;
            //这里的5个值，要和CallbackSendWork接收到的param赋值数量对应
            self.$emit(
                "CallbackSendWork",
                {
                    CurrentNodeModel: self.CurrentNodeModel,
                    CurrentFlowDesign: self.CurrentFlowDesign,
                    CurrentFlowDesignId: self.CurrentFlowDesignId,
                    CurrentApprovalType: self.CurrentApprovalType,
                    CurrentApprovalIdea: self.CurrentApprovalIdea,
                    CurrentSelectUsers: self.CurrentSelectUsers,
                    ForceSelectUsers: self.ForceSelectUsers,
                    CurrentBackNodeId: self.CurrentBackNodeId,
                    CurrentAddUsers: self.CurrentAddUsers
                },
                function () {
                    self.BtnLoading = false;
                }
            );
        },
        SetV8DefaultValue(V8, formData) {
            var self = this;
            // V8.ReloadForm = (row, type) => { return self.$emit('CallbackReloadForm', row, type)},
            V8.CurrentUser = self.GetCurrentUser;
            // V8.HideFormBtn = self.HideFormBtn;
            // V8.Form = self.FormDiyTableModel;
            // V8.OldForm = self.OldForm;
            // V8.FormSet = self.FormSet;
            V8.FormSet = (fieldName, value) => {
                return self.FormSet(fieldName, value, formData);
            };
            // V8.Field = self.GetDiyFieldListObject;
            V8.FieldSet = self.FieldSet;
            // V8.TableRowId = self.TableRowId;
            // V8.TableSearchAppend = self.SearchAppend;
            // V8.TableSearchSet = self.SearchSet;
            // //刷新子表
            // V8.TableRefresh = self.TableRefresh;
            // V8.TableSetData = self.TableSetData;
            // V8.ApiReplace = self.ApiReplace;
            // V8.FormSubmit = self.V8FormSubmit;
            // V8.FormSubmitInside = self.FormSubmit;
            // V8.RefreshTable = self.CallbackRefreshTable;
            // V8.ParentForm = self.ParentForm;
            // V8.ParentV8 = self.ParentV8;
            // V8.ParentFormSet = self.ParentFormSet;
            // V8.FormMode = self.FormMode;
            // V8.TableId = self.TableId;
            // V8.CallbackForm = self.CallbackForm;
            // V8.ShowTableChildHideField = self.ShowTableChildHideField;

            // V8.GetChildTableData = self.GetChildTableData;
            // V8.CurrentTableData = self.CurrentTableData;
        },
       
        FormSet(fieldName, value, formData) {
            var self = this;
            formData[fieldName] = value; // 0
        },
        FieldSet(fieldName, attrName, value) {
            var self = this;
            self.$emit("CallbackFieldSet", fieldName, attrName, value);
            // self.$set(formData, fieldName, value) // 0
        }
    }
};
</script>

<style lang="scss" scoped></style>
