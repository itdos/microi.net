<template>
<div class="custom-form-wf">
    <div class="pull-left container-left">
        <el-form ref="form" :model="FormData" label-width="80px">
            <el-form-item label="姓名">
                <el-input v-model="FormData.Name"></el-input>
            </el-form-item>
            <el-form-item label="金额">
                <el-input-number v-model="FormData.Money"></el-input-number>
            </el-form-item>
        </el-form>
    </div>
    <div class="pull-right container-right">
        <WFWorkHandler ref="refWfWorkHandler_v1"
            @CallbackStartWork="CallbackStartWork"
            @CallbackSendWork="CallbackSendWork"
            ></WFWorkHandler>
    </div>
</div>
</template>

<script>
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
import _ from 'underscore'
export default {
    name: 'CustomFormWF',
	components: {
    },
    
    computed: {
		...mapState({
            OsClient: (state) => state.DiyStore.OsClient,
        }),
    },
	watch: {
	},
    data() {
        return {
            //表单数据
            FormData:{},
            //表单的打开模式，可能新增、修改、预览
            OpenFormMode:'',
            //表单数据Id
            CurrentTableRowId:'',
            //当前工作实体
            CurrentWorkModel:{},
            //当前节点实体
            CurrentNodeModel:{},
            //当前流程设计图实体
            CurrentFlowDesign:{},
            //指定了的审批人
            CurrentSelectUsers:[],
            //添加了的审批人
            CurrentAddUsers:[],
            //是否已经提交过发起流程了，提交过后，表单需要置为修改模式，而不是新增模式。
            StartWorkSubmited:false,
        }
    },
    mounted() {
        var self = this;
    },
    methods: {
        /**
         * 处理工作
         * @param {*} param 
         * @param {*} callback 回调函数，表单提交完成后、工作处理后，必须调用。
         */
        CallbackSendWork(param, callback){
            var self= this;
            //以下数据为工作流右侧返回的用户选择的各项操作数据，如是否同意、意见内容、是否添加了审批人等
            self.CurrentNodeModel = param.CurrentNodeModel;
            self.CurrentFlowDesign = param.CurrentFlowDesign;
            self.CurrentApprovalType = param.CurrentApprovalType;
            self.CurrentApprovalIdea = param.CurrentApprovalIdea;
            self.CurrentSelectUsers = param.CurrentSelectUsers;
            self.CurrentAddUsers = param.CurrentAddUsers;
            self.CurrentBackNodeId= param.CurrentBackNodeId;
            //-------end
            
            self.OpenFormMode = 'Edit';
            //提前自定义表单数据
            if(true){//假设表单已提交成功
                //获取通知字段，后期会改成后端获取，前端不再需要此段代码
                var noticeFields = [];
                if (!self.DiyCommon.IsNull(self.CurrentNodeModel.FieldsConfig)) {
                    var fieldsConfig = JSON.parse(self.CurrentNodeModel.FieldsConfig);
                    fieldsConfig.forEach(config => {
                        if (config.Notice == true) {
                            noticeFields.push({
                                Id: config.Id,
                                Name: config.Name,
                                Label: config.Label,
                                Value: formData[config.Name] ? formData[config.Name] : ''
                            });
                        }
                    });
                }
                self.DiyCommon.Post('/api/WorkFlow/sendWork', {
                    WorkId: self.CurrentWorkModel.Id,
                    FormData: JSON.stringify(formData),
                    ApprovalType: self.CurrentApprovalType,
                    ApprovalIdea: self.CurrentApprovalIdea,
                    BackNodeId :self.CurrentBackNodeId,
                    NoticeFields: JSON.stringify(noticeFields),
                    AddUsers : self.CurrentAddUsers,
                    SelectUsers : self.CurrentSelectUsers,
                }, function(result){
                    if (self.DiyCommon.Result(result)) {
                        //处理流程发送成功后
                        var receivers = '';
                        result.Data.Receivers.forEach(user => {
                            receivers += user.Name + ',';
                        });
                        try {
                            receivers = receivers.TrimEnd(',');
                        } catch (error) {
                            
                        }
                        if(result.Data.FlowEnd){
                            self.DiyCommon.Tips('流程处理成功！<br>流程已结束！', true, 10);
                        }
                        else if(self.CurrentNodeModel.NodeType != "End" || receivers){
                            self.DiyCommon.Tips('流程处理成功！<br>已发送至待办人：' + receivers + '。<br>已发送至节点：' + result.Data.ToNodeName + '。', true, 10);
                        }
                        self.$emit('CallbackWFSubmit', {Code : 1});
                    }else{
                        self.$emit('CallbackWFSubmit', {Code : 0});
                    }
                    //告诉工作流引擎核心，已经处理完表单提交和流程提交
                    if(callback){
                        callback();
                    }
                });
            }
        },
        /**
         * 发起工作
         * @param {*} param 
         * @param {*} callback  回调函数，表单提交完成后、流程发起后，必须调用。
         */
        CallbackStartWork(param, callback){
            var self = this;
            //以下数据为工作流右侧返回的用户选择的各项操作数据，如是否同意、意见内容、是否添加了审批人等
            self.CurrentNodeModel = param.CurrentNodeModel;
            self.CurrentFlowDesign = param.CurrentFlowDesign;
            self.CurrentApprovalIdea = param.CurrentApprovalIdea;
            self.CurrentSelectUsers = param.CurrentSelectUsers;
            self.CurrentAddUsers = param.CurrentAddUsers;
            //-----end

            //注意：第一次提交是Add，第二次提交是Edit。因为表单提前成功，流程有可能会提交失败，比如说未节点审批人配置不正确等。
            //第一次提交是Add，但第二次提交一定要是Edit
            self.OpenFormMode = self.StartWorkSubmited == false ? 'Add' : 'Edit';
            //在这里提交自定义表单数据
            var formData = self.FormData;
            if(true){//假设自定义表单数据已经提交
                self.StartWorkSubmited = true;//标记已经提交过1次，若流程发起失败，再次发起，表单数据则是修改。
                self.OpenFormMode = 'Edit';
                //获取通知字段，后期会改成后端获取，前端不再需要此段代码
                var noticeFields = [];
                if (!self.DiyCommon.IsNull(self.CurrentNodeModel.FieldsConfig)) {
                    var fieldsConfig = JSON.parse(self.CurrentNodeModel.FieldsConfig);
                    fieldsConfig.forEach(config => {
                        if (config.Notice == true) {
                            noticeFields.push({
                                Id: config.Id,
                                Name: config.Name,
                                Label: config.Label,
                                Value: formData[config.Name] ? formData[config.Name] : ''
                            });
                        }
                    });
                }
                //发起工作
                self.DiyCommon.Post('/api/WorkFlow/startWork', {
                    FlowDesignId: self.CurrentFlowDesign.Id,
                    FormData: JSON.stringify(formData),
                    TableRowId: self.CurrentTableRowId,//formData.Id,
                    NoticeFields: JSON.stringify(noticeFields),
                    ApprovalIdea : self.CurrentApprovalIdea,
                    AddUsers : self.CurrentAddUsers,
                    SelectUsers : self.CurrentSelectUsers,
                }, function(result){
                    if (self.DiyCommon.Result(result)) {
                        var receivers = '';
                        result.Data.Receivers.forEach(user => {
                            receivers += user.Name + ',';
                        });
                        try {
                            receivers = receivers.TrimEnd(',');
                        } catch (error) {
                            
                        }
                        self.DiyCommon.Tips('流程发起成功！<br>已发送至待办人：' + receivers + '。<br>已发送至节点：' + result.Data.ToNodeName + '。', true, 10);
                        
                        self.$emit('CallbackWFSubmit', {Code : 1});
                    }else{
                        self.$emit('CallbackWFSubmit', {Code : 0});
                    }
                    //告诉工作流引擎核心，已经处理完表单提交和流程提交
                    if(callback){
                        callback();
                    }
                });
            }
            
        },
        /**
         * 初始化DiyForm 以及 InitStartWork
         * @param {*} param 
         */
        InitStartWork(param){
            var self = this;
            self.OpenFormMode = param.OpenFormMode;
            self.$nextTick(function(){
                self.$refs.refWfWorkHandler_v1.InitStartWork(param, function(callbackObj){
                    //初始化发起流程时，此回调函数会返回一个全新的表单数据Id。自定义表单可以不用管。
                    self.CurrentTableRowId = callbackObj.CurrentTableRowId;
                    //加载自定义表单数据
                    //your code...
                });
            });
        },
		InitSendWork(param){
            var self = this;
            self.OpenFormMode = param.OpenFormMode;
            self.CurrentTableRowId = param.CurrentTableRowId;
            self.CurrentWorkModel = param.CurrentWorkModel;
            self.$nextTick(function(){
                self.$refs.refWfWorkHandler_v1.InitSendWork(param, function(callbackObj){
                    //加载自定义表单数据
                    //your code...
                });
            });
		},
    }
}
</script>

<style lang="scss">
.custom-form-wf{
    .el-radio--mini.is-bordered{
        margin-right: 0px;
    }
    .container-left{
        width:calc(100% - 380px)
    }
    .container-right{
        width:360px;background-color:#F5F7FA;height:100%;padding-left:15px;padding-right:15px;
    }
}
</style>
