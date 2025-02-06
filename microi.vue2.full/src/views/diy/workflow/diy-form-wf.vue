<template>
<div class="diy-form-wf">
    <div class="pull-left" style="width:calc(100% - 380px)">
        <DiyForm
            ref="diyFormWfWork"
            :load-mode="''"
            :form-mode="OpenFormMode"
            :table-id="CurrentTableId"
            :table-row-id="CurrentTableRowId"
            :default-values="CurrentDefaultValues"
            :hide-fields="CurrentHideFields"
            :show-fields="CurrentShowFields"
            :form-wf="FormWF"
            :readonly-fields="CurrentReadonlyFields"
            @CallbackGetDiyField="CallbackGetDiyField"
            />
    </div>
    <div class="pull-right" style="width:360px;background-color:#F5F7FA;height:100%;padding-left:15px;padding-right:15px;">
        <WFWorkHandler ref="refWfWorkHandler"
            @CallbackStartWork="CallbackStartWork"
            @CallbackSendWork="CallbackSendWork"
            @CallbackRecallOrCancelWork="CallbackRecallOrCancelWork"
            @CallbackHandOverWork="CallbackHandOverWork"
            @CallbackFieldSet="CallbackFieldSet"
            @CallbackGetFormData="CallbackGetFormData"
            :form-data="FormData"
            ></WFWorkHandler>
    </div>
</div>
</template>

<script>
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
import _ from 'underscore'
import { DiyCommon } from '@/utils/microi.net.import';
export default {
    name: 'diy_form_wf',
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
            DiyFieldList:[],
            FormWF:{},
            OpenFormMode:'',
            CurrentTableId:'',
            CurrentTableRowId:'',
            //暂时未用到
            CurrentDefaultValues:{},
            //暂时未用到
            CurrentHideFields:[],
            CurrentShowFields:[],
            CurrentReadonlyFields:[],
            //是否已经提交过发起流程了，提交过后，表单需要置为修改模式，而不是新增模式。
            StartWorkSubmited:false,
            FormData:{},
        }
    },
    mounted() {
        var self = this;
    },
    methods: {
        CallbackGetFormData(){
            var self = this;
            var formData = self.$refs.diyFormWfWork.GetFormData();
            self.FormData = formData;
        },
        CallbackFieldSet(fieldName, attrName, value){
            var self = this;
            self.$refs.diyFormWfWork.FieldSet(fieldName, attrName, value);
        },
        CallbackGetDiyField(diyFieldList) {
            var self = this
            self.DiyFieldList = diyFieldList
        },
        /**
         * 移交工作，其实不需要提交表单，无法修改表单。但需要执行节点开始V8、结束V8。
         * @param {*} param 
         */
        async CallbackHandOverWork(param, callback){
            var self= this;
            try {
                //-------第1步：在表单提交前，先执行节点开始v8。 
                //此v8说明：
                //a、可以终止表单和流程的提交（也就是它是在【表单提前交V8事件】之前执行）
                //b、可以修改表单中的值

                //先获取表单数据
                var formData = self.$refs.diyFormWfWork.GetFormData();
                var oldFormData = self.$refs.diyFormWfWork.GetOldFormData();
                // 判断需要执行的V8
                var v8Result = await self.$refs.refWfWorkHandler.RunNodeStartV8({
                    Form : formData,
                    OldForm : oldFormData,
                });
                if(v8Result.Result === false){
                    if(callback){
                        callback();
                    }
                    return;
                }
                if(!v8Result.Form){
                    v8Result.Form = formData;
                }
                //-------第1步 END
                
                var formParam =  {
                    FormMode: 'Edit',//表单加载模式，处理工作一定是修改
                    SavedType: "Edit",//表单提交后自动刷新后的状态，变成编辑
                };
                //-------第2步：提交表单
                self.$refs.diyFormWfWork.FormSubmit(formParam,
                    async function (success, formData) {
                        if (success == true) {
                            //注意：这里一定要回写一下，因为FormSubmit内部无法引用更新这些值
                            self.OpenFormMode = formParam.FormMode;
                            self.CurrentTableRowId = formParam.TableRowId;
                            
                            //-------第3步：撤回工作
                            self.$refs.refWfWorkHandler.HandOverWork({
                                FormData : v8Result.Form,
                                OldForm : oldFormData,
                                DiyFieldList : self.DiyFieldList
                            }, function(result){
                                if (result.Code == 1) {
                                    self.$emit('CallbackWFSubmit', {Code : 1});
                                }else{
                                    self.$emit('CallbackWFSubmit', {Code : 0});
                                }
                                //-------第3步 END
                                if(callback){
                                    callback();
                                }
                            });
                            
                        }else{
                            if(callback){
                                callback();
                            }
                        }
                    }
                );

               
                
            } catch (error) {
                if(callback){
                    callback();
                }
                throw error;
            }
        },
        /**
         * 撤回、作废工作，其实不需要提交表单，无法修改表单。但需要执行节点开始V8、结束V8。
         * @param {*} param 
         */
        async CallbackRecallOrCancelWork(param, callback){
            var self= this;
            try {
                //-------第1步：在表单提交前，先执行节点开始v8。 
                //此v8说明：
                //a、可以终止表单和流程的提交（也就是它是在【表单提前交V8事件】之前执行）
                //b、可以修改表单中的值

                //先获取表单数据
                var formData = self.$refs.diyFormWfWork.GetFormData();
                var oldFormData = self.$refs.diyFormWfWork.GetOldFormData();
                // 判断需要执行的V8
                var v8Result = await self.$refs.refWfWorkHandler.RunNodeStartV8({
                    Form : formData,
                    OldForm : oldFormData,
                });
                if(v8Result.Result === false){
                    if(callback){
                        callback();
                    }
                    return;
                }
                if(v8Result.Form){
                    self.$refs.diyFormWfWork.SetFormData(v8Result.Form);
                }else{
                    v8Result.Form = formData;
                }
                //-------第1步 END

                //-------第2步：撤回、作废工作
                self.$refs.refWfWorkHandler.RecallOrCancelWork({
                    FormData : v8Result.Form,
                    OldForm : oldFormData,
                    DiyFieldList : self.DiyFieldList,
                    CurrentApprovalType : param.CurrentApprovalType
                }, function(result){
                    if (result.Code == 1) {
                        self.$emit('CallbackWFSubmit', {Code : 1});
                    }else{
                        self.$emit('CallbackWFSubmit', {Code : 0});
                    }
                    //-------第3步 END
                    if(callback){
                        callback();
                    }
                });
                
                
            } catch (error) {
                if(callback){
                    callback();
                }
                throw error;
            }
        },
        /**
         * 处理工作前，提交表单
         * @param {*} param 
         * @param {*} callback 回调函数，表单提交完成后、工作处理后，必须调用，它会将提交按钮重置为可点击。
         */
        async CallbackSendWork(param, callback){
            var self= this;
            self.FormWF = {
                IsWF : true,
                WorkType : 'SendWork',
                FlowDesignId : param.CurrentFlowDesign.Id,
            }
            try {
                //-------第1步：在表单提交前，先执行节点开始v8。 
                //此v8说明：
                //a、可以终止表单和流程的提交（也就是它是在【表单提前交V8事件】之前执行）
                //b、可以修改表单中的值
                //c、获取用户点击的是同意还是拒绝、填写的意见
                //d、获取用户添加了哪些审批人、选择了哪些审批人

                //先获取表单数据
                var formData = self.$refs.diyFormWfWork.GetFormData();
                var oldFormData = self.$refs.diyFormWfWork.GetOldFormData();
                // 判断需要执行的V8
                var refWfWorkHandler = self.$refs.refWfWorkHandler;
                if(Array.isArray(self.$refs.refWfWorkHandler)){
                    refWfWorkHandler = self.$refs.refWfWorkHandler[0];
                }
                var v8Result = {};
                try {
                    v8Result = await self.$refs.refWfWorkHandler.RunNodeStartV8({
                        Form : formData,
                        OldForm : oldFormData,
                    });
                } catch (error) {
                    console.log('self.$refs.refWfWorkHandler error：',error);
                    v8Result = await refWfWorkHandler.RunNodeStartV8({
                        Form : formData,
                        OldForm : oldFormData,
                    });
                }
                
                if(v8Result.Result === false){
                    if(callback){
                        callback();
                    }
                    return;
                }
                if(v8Result.Form){
                    self.$refs.diyFormWfWork.SetFormData(v8Result.Form);
                }else{
                    v8Result.Form = formData;
                }
                //-------第1步 END

                var formParam =  {
                    FormMode: 'Edit',//表单加载模式，处理工作一定是修改
                    SavedType: "Edit",//表单提交后自动刷新后的状态，变成编辑
                };
                //-------第2步：提交表单
                self.$refs.diyFormWfWork.FormSubmit(formParam,
                    async function (success, formData) {
                        if (success == true) {
                            //注意：这里一定要回写一下，因为FormSubmit内部无法引用更新这些值
                            self.OpenFormMode = formParam.FormMode;
                            self.CurrentTableRowId = formParam.TableRowId;
                            
                            //-------第3步：发送工作
                            console.log('self.$refs.refWfWorkHandler:', self.$refs.refWfWorkHandler);
                            console.log('refWfWorkHandler:', refWfWorkHandler);
                            try {
                                self.$refs.refWfWorkHandler.SendWork({
                                    FormData:v8Result.Form,
                                    OldForm : oldFormData,
                                    DiyFieldList : self.DiyFieldList
                                }, function(result){
                                    if (result.Code == 1) {
                                        self.$emit('CallbackWFSubmit', {Code : 1});
                                    }else{
                                        self.$emit('CallbackWFSubmit', {Code : 0});
                                    }
                                    //-------第3步 END
                                    if(callback){
                                        callback();
                                    }
                                });
                            } catch (error) {
                                console.log('self.$refs.refWfWorkHandler error：',error);
                                refWfWorkHandler.SendWork({
                                    FormData:v8Result.Form,
                                }, function(result){
                                    if (result.Code == 1) {
                                        self.$emit('CallbackWFSubmit', {Code : 1});
                                    }else{
                                        self.$emit('CallbackWFSubmit', {Code : 0});
                                    }
                                    //-------第3步 END
                                    if(callback){
                                        callback();
                                    }
                                });
                            }
                            
                        }else{
                            if(callback){
                                callback();
                            }
                        }
                    }
                );
            } catch (error) {
                if(callback){
                    callback();
                }
                throw error;
            }
        },
        /**
         * 发起工作前，提交表单
         * @param {*} param 
         * @param {*} callback  回调函数，表单提交完成后、流程发起后，必须调用，它会将提交按钮重置为可点击。
         */
        async CallbackStartWork(param, callback){
            var self = this;
            self.FormWF = {
                IsWF : true,
                WorkType : 'StartWork',
                FlowDesignId : param.CurrentFlowDesign.Id,
            }
            try {
                //-------第1步：在表单提交前，先执行节点开始v8。 
                //此v8说明：
                //a、可以终止表单和流程的提交（也就是它是在【表单提前交V8事件】之前执行）
                //b、可以修改表单中的值
                //c、获取用户点击的是同意还是拒绝、填写的意见
                //d、获取用户添加了哪些审批人、选择了哪些审批人

                //先获取表单数据
                var formData = self.$refs.diyFormWfWork.GetFormData();
                var oldFormData = self.$refs.diyFormWfWork.GetOldFormData();
                // 判断需要执行的V8
                var v8Result = await self.$refs.refWfWorkHandler.RunNodeStartV8({
                    Form : formData,
                    OldForm : oldFormData,
                });
                if(v8Result.Result === false){
                    if(callback){
                        callback();
                    }
                    return;
                }
                if(v8Result.Form){
                    self.$refs.diyFormWfWork.SetFormData(v8Result.Form);
                }else{
                    v8Result.Form = formData;
                }
                //-------第1步 END
                //第一次表单提交是Add，但第二次提交一定要是Edit（有可能因为没找到审批人，导致表单提交成功，但流程提交失败，这时候重新提交，表单就需要是修改操作，不然生成重复数据）
                var formParam = {
                    FormMode: self.StartWorkSubmited == false ? 'Add' : 'Edit',//表单加载模式：新增、编辑
                    SavedType: "Edit",//表单提交后自动刷新后的状态，变成编辑
                };
                //-------第2步：提交表单
                self.$refs.diyFormWfWork.FormSubmit(formParam,
                    async function (success, formData) {
                        if (success == true) {
                            self.StartWorkSubmited = true;
                            //注意：这里一定要回写一下，因为FormSubmit内部无法引用更新这些值
                            self.OpenFormMode = 'Edit';

                            //-------第3步：发起工作
                            self.$refs.refWfWorkHandler.StartWork({
                                FormData : v8Result.Form,
                                OldForm : oldFormData,
                                DiyFieldList : self.DiyFieldList
                            }, function(result){
                                if (result.Code == 1) {
                                    self.$emit('CallbackWFSubmit', {Code : 1});
                                }else{
                                    self.$emit('CallbackWFSubmit', {Code : 0});
                                }
                                //-------第3步 END
                                if(callback){
                                    callback();
                                }
                            });
                        }else{
                            if(callback){
                                callback();
                            }
                        }
                    }
                );
            } catch (error) {
                if(callback){
                    callback();
                }
                throw error;
            }
        },
        /**
         * 初始化DiyForm 以及 InitStartWork
         * @param {*} param  传入：
         */
        InitStartWork(param){
            var self = this;
            self.FormWF = {
                IsWF : true,
                WorkType : 'StartWork',
            }
            self.OpenFormMode = param.OpenFormMode;
            self.CurrentTableId = param.CurrentTableId;
            param.DiyFieldList = self.DiyFieldList;

            self.$nextTick(function(){
                self.$refs.refWfWorkHandler.InitStartWork(param, function(callbackObj){
                    self.CurrentTableRowId = callbackObj.CurrentTableRowId;
                    self.CurrentShowFields = callbackObj.CurrentShowFields;
                    self.CurrentReadonlyFields = callbackObj.CurrentReadonlyFields;

                    self.$refs.diyFormWfWork.Init();
                });
            });
        },
        /**
         * 初始化DiyForm 以及 InitSendWork
         */
		InitSendWork(param){
            var self = this;
            self.FormWF = {
                IsWF : true,
                WorkType : 'SendWork',
            }
            self.OpenFormMode = param.OpenFormMode;
            self.CurrentTableId = param.CurrentTableId;
            self.CurrentTableRowId = param.CurrentTableRowId;
            self.$nextTick(function(){
                self.$refs.refWfWorkHandler.InitSendWork(param, function(callbackObj){
                    self.CurrentShowFields = callbackObj.CurrentShowFields;
                    self.CurrentReadonlyFields = callbackObj.CurrentReadonlyFields;

                    self.$refs.diyFormWfWork.Init(true);
                });
            });
		},
    }
}
</script>

<style lang="scss">
.diy-form-wf{
    .el-radio--mini.is-bordered{
        margin-right: 0px;
    }
}
</style>
