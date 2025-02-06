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
            <el-form-item label="Id">
                <el-input placeholder="一定要包含Id值" v-model="FormData.Id"></el-input>
            </el-form-item>
        </el-form>
    </div>
    <div class="pull-right container-right">
        <WFWorkHandler ref="refWfWorkHandler_3"
            @CallbackStartWork="CallbackStartWork"
            @CallbackSendWork="CallbackSendWork"
            @CallbackRecallOrCancelWork="CallbackRecallOrCancelWork"
            @CallbackHandOverWork="CallbackHandOverWork"
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
            //表单数据（一定要包含Id值）
            FormData:{
                Id:'123456789'
            },
            //表单数据Id
            CurrentTableRowId:'',
            CurrentShowFields:[],
            CurrentReadonlyFields:[],
            //是否已经提交过发起流程了，提交过后，表单需要置为修改模式，而不是新增模式。
            StartWorkSubmited:false,
        }
    },
    mounted() {
        var self = this;
    },
    methods: {
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
                var formData = self.FormData;
                // 判断需要执行的V8
                var v8Result = await self.$refs.refWfWorkHandler_3.RunNodeStartV8({
                    Form : formData
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

               
                //-------第2步：撤回工作
                self.$refs.refWfWorkHandler_3.HandOverWork({
                    FormData : v8Result.Form,
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
                var formData = self.FormData;
                // 判断需要执行的V8
                var v8Result = await self.$refs.refWfWorkHandler_3.RunNodeStartV8({
                    Form : formData
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

               
                //-------第2步：撤回、作废工作
                self.$refs.refWfWorkHandler_3.RecallOrCancelWork({
                    FormData : v8Result.Form,
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
            try {
                //-------第1步：在表单提交前，先执行节点开始v8。 
                //此v8说明：
                //a、可以终止表单和流程的提交（也就是它是在【表单提前交V8事件】之前执行）
                //b、可以修改表单中的值
                //c、获取用户点击的是同意还是拒绝、填写的意见
                //d、获取用户添加了哪些审批人、选择了哪些审批人

                //先获取表单数据
                var formData = self.FormData;
                // 判断需要执行的V8
                var v8Result = await self.$refs.refWfWorkHandler_3.RunNodeStartV8({
                    Form : formData
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

               
                //-------第2步：提交表单
                //你的定制表单提交code...
                //这里假设已经提交成功
                if(true){
                    //-------第3步：发送工作
                    self.$refs.refWfWorkHandler_3.SendWork({
                        FormData : v8Result.Form,
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
            try {
                //-------第1步：在表单提交前，先执行节点开始v8。 
                //此v8说明：
                //a、可以终止表单和流程的提交（也就是它是在【表单提前交V8事件】之前执行）
                //b、可以修改表单中的值
                //c、获取用户点击的是同意还是拒绝、填写的意见
                //d、获取用户添加了哪些审批人、选择了哪些审批人

                //先获取表单数据
                var formData = self.FormData;
                // 判断需要执行的V8
                var v8Result = await self.$refs.refWfWorkHandler_3.RunNodeStartV8({
                    Form : formData
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

                //第一次表单提交是Add，但第二次提交一定要是Edit（有可能因为没找到审批人，导致表单提交成功，但流程提交失败，这时候重新提交，表单就需要是修改操作，不然生成重复数据）
               
                //-------第2步：提交定制表单
                //你的定制表单提交code...
                //这里假设已经提交成功
                
                if(true){
                    self.StartWorkSubmited = true;

                    //-------第3步：发起工作
                    self.$refs.refWfWorkHandler_3.StartWork({
                        FormData : v8Result.Form,
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
                else{
                    if(callback){
                        callback();
                    }
                }
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
            self.$nextTick(function(){
                self.$refs.refWfWorkHandler_3.InitStartWork(param, function(callbackObj){
                    self.CurrentShowFields = callbackObj.CurrentShowFields;
                    self.CurrentReadonlyFields = callbackObj.CurrentReadonlyFields;
                    //加载定制表单数据
                    //your code...
                });
            });
        },
        /**
         * 初始化DiyForm 以及 InitSendWork
         */
		InitSendWork(param){
            var self = this;
            self.CurrentTableRowId = param.CurrentTableRowId;
            self.DiyCommon.Tips('您的定制表单Id为：' + param.CurrentTableRowId);
            self.$nextTick(function(){
                self.$refs.refWfWorkHandler_3.InitSendWork(param, function(callbackObj){
                    self.CurrentShowFields = callbackObj.CurrentShowFields;
                    self.CurrentReadonlyFields = callbackObj.CurrentReadonlyFields;

                    //加载定制表单数据
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
