<template>
<div class="pluginPage">
    <el-row>
        <el-col :span="24">
            <el-card class="box-card" style="margin-bottom:20px;">
                <div class="">
                    <div class="pull-left" style="font-size:15px;font-weight:bold;">
                        <i :class="GetOpenTitleIcon()" />
                        {{ GetOpenTitle() }}
                    </div>
                    <div class="pull-right">
                        <el-button
                            v-if="FormMode != 'View'"
                            :loading="SaveDiyTableCommonLoding"
                            type="danger"
                            icon="el-icon-success"
                            @click="SaveDiyTableCommon(true)">
                            {{ $t('Msg.SaveBack') }}
                        </el-button>
                            <!-- $t('Msg.Add') -->
                        <el-button
                            v-if="FormMode == 'View' && ShowUpdateBtn"
                            :loading="SaveDiyTableCommonLoding"
                            type="primary"
                            :icon="'el-icon-edit'"
                            @click="GotoEdit()">
                            {{ $t('Msg.Edit') }}
                        </el-button>
                        <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) 
                                && !DiyCommon.IsNull(SysMenuModel.FormBtns)
                                && SysMenuModel.FormBtns.length > 0">
                            <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns"
                                >
                                    <!-- v-if="LimitMoreBtn(btn)" -->
                                <el-button
                                    :key="'more_btn_formbtns_' + btnIndex"
                                    v-if="btn.IsVisible"
                                    type="primary"
                                    size="mini"
                                    :loading="BtnLoading"
                                    @click.native="RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)">
                                    <i :class="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)"></i> {{ btn.Name }}
                                </el-button>
                            </template>
                        </template>
                        <!-- <el-button
                            v-if="LimitDel() && FormMode != 'Add'"
                            :loading="BtnLoading"
                            type="danger"
                            size="mini"
                            icon="el-icon-delete"
                            @click="DelDiyTableRow(CurrentRowModel, 'ShowFieldForm')">{{ $t('Msg.Delete') }}</el-button> -->
                        <el-button
                            type="default"
                            icon="el-icon-back"
                            @click="Go_1()">
                            {{ $t('Msg.Back') }}
                        </el-button>
                    </div>
                    <div class="clear"></div>
                </div>
                <DiyForm
                    ref="fieldForm"
                    :form-mode="FormMode"
                    :load-mode="'Page'"
                    :table-id="TableId"
                    :table-row-id="TableRowId"
                    @CallbackFormSubmit="CallbackFormSubmit"
                    @CallbackSetFormData="CallbackSetFormData"
                    @CallbackSetDiyTableModel="CallbackSetDiyTableModel"
                    @CallbackGetDiyField="CallbackGetDiyField"
                    @CallbackReloadForm="CallbackReloadForm"
                    @CallbackHideFormBtn="CallbackHideFormBtn"
                    />
            </el-card>
        </el-col>
    </el-row>
</div>
</template>

<script>
import _ from 'underscore'
import {
    mapState
} from 'vuex'
import merge from 'webpack-merge'
export default {
    name: 'diy_form_page',
    components: {
    },
    computed: {
        GetCurrentUser: function(){ return this.$store.getters['DiyStore/GetCurrentUser'];},
        ...mapState({
            // OsClient: state => state.DiyStore.OsClient
        })
    },
    data() {
        return {
            BtnLoading:false,
            FormMode:'',
            SaveDiyTableCommonLoding: false,
            DiyFieldList: [],
            TableRowId: '',
            TableId: '',
            SysMenuId:'',
            SysMenuModel:{},
            CurrentDiyTableModel:{},
            CurrentRowModel:{},
            CallbackSetFormDataFinish:false,
            CallbackSetDiyTableModelFinish:false,
            ShowUpdateBtn:true,
            ShowDeleteBtn:true,
        }
    },
    async mounted() {
        var self = this
        self.TableId = self.$route.params.TableId
        self.TableRowId = self.$route.params.TableRowId;
        if(!self.TableRowId){
            var guidResult = await self.DiyCommon.PostAsync('/api/diytable/NewGuid');
            if(guidResult.Code == 1){
                self.TableRowId = guidResult.Data;
            }
        }
        self.FormMode = self.$route.query.FormMode;
        self.SysMenuId = self.$route.query.SysMenuId;
        if(!self.TableId || !self.FormMode){
            self.DiyCommon.Tips('缺少参数！格式：/FormMode/TableId/TableRowId', false);
            return;
        }
        self.$nextTick(function () {
            self.$refs.fieldForm.Init()
        })
        console.log('--DiyFormPage FormBtns Test0：--', 'mounted.');
    },
    methods: {
        async HandlerBtns(btns, row,  v8){
            var self = this;
            if (btns) {
                if(self.DiyCommon.IsNull(row)){
                    row = {};
                }
                // btns.forEach(async (btn) => {
                //     var isVisible = await self.LimitMoreBtn(btn, row, v8);
                //     btn.IsVisible = isVisible;
                // });
                for (let index = 0; index < btns.length; index++) {
                    var btn = btns[index];
                    var isVisible = await self.LimitMoreBtn(btn, row, v8);
                    btn.IsVisible = isVisible;
                }
            }
            console.log('--DiyFormPage FormBtns Test2：--', btns);
        },
        async LimitMoreBtn(btn, row , v8){
            var self = this;
            //如果V8配置了不显示
            var V8 = v8 || {};
            V8.Result = null;
            if (row && v8) {
                row._V8 = v8;
            }
            try {
                if (!self.DiyCommon.IsNull(btn.V8CodeShow)) {
                    if (!V8.Form) {
                        V8.Form = row; // 当前Form表单所有字段值
                    }
                    if (!V8.FormSet) {
                        V8.FormSet = (fieldName, value) => { return self.FormSet(fieldName, value, row)}; // 给Form表单其它字段赋值
                    }
                    V8.OpenForm = (row, type) => { return self.OpenDetail(row, type, true)};
                    V8.EventName = '​V8BtnLimit';
                    self.SetV8DefaultValue(V8);
                    await self.DiyCommon.InitV8Code(V8, self.$router);
                    // eval(btn.V8CodeShow)
                    await eval("(async () => {\n " + btn.V8CodeShow + " \n})()")
                }else{
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                }
            } catch (error) {
                self.DiyCommon.Tips('执行V8引擎代码出现错误：' + error.message, false);
            }
            if (V8.Result === false) {
                return false;
            }
            //------------------------------------------------------

            if (self.GetCurrentUser._IsAdmin === true) {
                return true;
            }
            var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, { FkId : self.SysMenuId });
            if (self.TableChildFormMode != 'View'
                && roleLimitModel.length > 0
                ) {
                var result = false;
                roleLimitModel.forEach(element => {
                    if (element.Permission.indexOf(btn.Id) > -1) {
                        result = true;
                    }
                });
                return result;
            }

            
            return false;
        },
        SetV8DefaultValue(V8, field){
            var self = this;
            V8.ClientType = 'PC';//PC、IOS、Android、H5、WeChat
            V8.FormMode = self.FormMode;
            V8.DataAppend = self.DataAppend;
            V8.TableId = self.TableId;
            V8.CurrentUser = self.GetCurrentUser;
            V8.TableRowSelected = self.TableMultipleSelection;
            V8.ParentForm = self.FatherFormModel;
            if (self.ParentV8_Data) {
                V8.ParentV8 = self.ParentV8_Data;
            }else{
                V8.ParentV8 = self.ParentV8;
            }
            V8.TableRowId = self.TableRowId;
            V8.RefreshTable = self.GetDiyTableRow;
            V8.ParentFormSet = self.ParentFormSet;
            V8.ReloadForm = self.CallbackReloadForm; //(row, type) => { return self.$emit('CallbackReloadForm', row, type)},
            V8.SearchAppend = self.SearchAppendFunc;
            V8.SearchSet = self.SetV8SearchModel;
            V8.SetV8SearchModel = self.SetV8SearchModel;
            //2011-11-22注释
            // V8.Field = self.PropsParentFieldList;
            var diyFieldList = {};
            self.DiyFieldList.forEach(element => {
                diyFieldList[element.Name] = element;
            });
            V8.Field = diyFieldList;
            V8.ShowTableChildHideField = self.ShowTableChildHideField;

            V8.FieldSet = self.FieldSet;
            V8.CurrentTableData = self.DiyTableRowList;
            // V8.GetChildTableData = '';
            V8.FormClose = self.FormClose;
        },
        FormClose(){
            var self = this;
            
        },
        async RunMoreBtn(btn, row, v8){
            var self = this;
            self.BtnV8Loading = true;
            var V8 = v8 ? v8 : {};
            try {
                if (!self.DiyCommon.IsNull(btn.V8Code)) {
                    if (!V8.Form) {
                        var form = {...row};
                        V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
                    }
                    if (!V8.FormSet) {
                        V8.FormSet = (fieldName, value) => { return self.FormSet(fieldName, value, row)}; // 给Form表单其它字段赋值
                    }
                    V8.OpenForm = (row, type) => { return self.OpenDetail(row, type, true)};
                    V8.OpenFormWF = (row, type, wfParam) => { return self.OpenDetail(row, type, true, true, wfParam)};
                    // V8.BtnV8Loading = self.BtnV8Loading;
                    V8.V8Callback = () => {
                        self.BtnV8Loading = false;
                    };
                    V8.EventName = '​V8BtnRun';
                    self.SetV8DefaultValue(V8);
                    await self.DiyCommon.InitV8Code(V8, self.$router);
                    // eval(btn.V8Code)
                    await eval("(async () => {\n " + btn.V8Code + " \n})()");
                    // if(!(btn.V8Code.indexOf('V8.BtnV8Loading') > -1)){
                    if(!(btn.V8Code.indexOf('V8.V8Callback') > -1)){
                        self.BtnV8Loading = false;
                    }
                }else{
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                    self.BtnV8Loading = false;
                }
            } catch (error) {
                self.DiyCommon.Tips('执行V8引擎代码出现错误：' + error.message, false);
                self.BtnV8Loading = false;
            }
            
        },
        DeleteFormProperty(form){
            Reflect.deleteProperty(form, '_RowMoreBtnsOut');
            Reflect.deleteProperty(form, '_RowMoreBtnsIn');
            return form;
        },
        GotoEdit(){
            var self = this;
            self.$router.replace({
                query:merge(self.$route.query,{'FormMode':'Edit'})
            });
            self.FormMode = self.$route.query.FormMode;
            self.$nextTick(function(){
                self.$refs.fieldForm.Init()
            });
        },
        LimitDel(){
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            //这里还需要SysMenuId参数才能判断权限
            if(self.SysMenuId){
                var roleLimitModel = _.find(self.GetCurrentUser._RoleLimits, function(item){
                    return item.FkId == self.SysMenuId;
                });
                if(roleLimitModel){
                    return true;
                }
            }
            return false;
        },
        tabClickField() {

        },
        
        SaveDiyTableCommon(isBack) {
            var self = this
            try {
                self.SaveDiyTableCommonLoding = true

                var param = {}
                var url = self.DiyApi.AddDiyTableRow
                if (!self.DiyCommon.IsNull(self.TableRowId)) {
                    url = self.DiyApi.UptDiyTableRow
                    param._TableRowId = self.TableRowId
                }
                param.FormMode = self.FormMode;
                param.SavedType = 'Edit';
                self.$refs.fieldForm.FormSubmit(param,
                    async function (success, formData, outFormV8Result) {
                        if (success == true) {
                            if (isBack === true && outFormV8Result.Result !== false) {
                                self.Go_1();
                            }else{
                                self.FormMode = 'Edit';
                            }
                        }
                        self.SaveDiyTableCommonLoding = false
                    }
                );
            } catch (error) {
                self.SaveDiyTableCommonLoding = false
                throw error;
            }
        },
        Go_1(){
            var self = this;
            self.$store.dispatch("tagsView/delView", self.$route);
            self.$router.go(-1);
        },
        GetOpenTitleIcon(){
            var self = this;
            return (self.DiyCommon.IsNull(self.CurrentRowModel) || self.DiyCommon.IsNull(self.CurrentRowModel.Id)) ? 'fas fa-plus' : 'far fa-edit'
        },
        GetOpenTitle(){
            var self = this;
            var result = '';
            if(self.FormMode){
                var formMode = self.$t('Msg.' + self.FormMode);
                var firstValue = '';
                if(self.FormMode == 'Edit' || self.FormMode == 'View'){
                    var fieldModel = self.DiyFieldList[0];
                    if (fieldModel && self.CurrentRowModel[fieldModel.Name]) {
                        firstValue = '[' + self.CurrentRowModel[fieldModel.Name] + ']';
                    }
                }
                var tableName = (self.DiyCommon.IsNull(self.CurrentDiyTableModel) || self.DiyCommon.IsNull(self.CurrentDiyTableModel.Description)) 
                            ? '' : ' - ' + self.CurrentDiyTableModel.Description; 

                result = formMode + firstValue + tableName;
                if((self.CallbackSetFormDataFinish && self.CallbackSetDiyTableModelFinish) 
                    || (self.FormMode == 'Add' && self.CallbackSetDiyTableModelFinish)){
                    // var item = this.$store.state.tagsView.visitedViews.filter(item => item.name == 'diy_form_page_' + (self.FormMode == 'Add' ? 'add' : 'edit'))
                    var item = self.$store.state.tagsView.visitedViews.filter(item => item.fullPath == self.$route.fullPath);
                    if (item.length > 0) {
                        item[0].title = result;
                    }
                }
                
            }
            return result;
        },
        CallbackGetDiyField(diyFieldList) {
            var self = this
            self.DiyFieldList = diyFieldList
        },
        CallbackSetFormData(formData){
            var self = this
            self.CurrentRowModel = formData;
            self.CallbackSetFormDataFinish = true;

            if(self.SysMenuId){
                self.DiyCommon.Post('/api/FormEngine/getFormData-sysmenu', {
                    FormEngineKey : 'Sys_Menu',
                    Id : self.SysMenuId
                }, async function(result){
                    if(self.DiyCommon.Result(result)){
                        self.DiyCommon.ForConvertSysMenu(result.Data);
                        self.SysMenuModel = result.Data;
                        console.log('--DiyFormPage FormBtns Test1：--', self.SysMenuModel.FormBtns);
                        await self.HandlerBtns(self.SysMenuModel.FormBtns, self.CurrentRowModel, {});//V8
                        console.log('--DiyFormPage FormBtns Test3：--', self.SysMenuModel.FormBtns);
                    }
                });
            }
        },
        CallbackSetDiyTableModel(model) {
            var self = this;
            self.CurrentDiyTableModel = model;
            self.CallbackSetDiyTableModelFinish = true;
        },
        CallbackFormSubmit(param){
            var self = this;
            self.SaveDiyTableCommon(param);
        },
        CallbackReloadForm(row, type){
            var self = this;
            //tableRowModel, formMode, isDefaultOpen
            // self.OpenDetail(row, type);
            self.$refs.fieldForm.Init()
        },
        CallbackHideFormBtn(btn){
            var self = this;
            self['Show'+btn+'Btn'] = false;
        },
    }
}
</script>

<style lang="scss">
.panel-group {
    margin-bottom: 0px;
}

.field-form {
    min-height: 100px;
}

.panel-group .card-panel-col {
    margin-bottom: 10px !important;
}

.dashboard-editor-container {
    padding: 20px;
    background-color: rgb(240, 242, 245);
    position: relative;
    height: calc(100vh - 84px);
    background-color: transparent;
    padding-top: 0px;

    .github-corner {
        position: absolute;
        top: 0px;
        border: 0;
        right: 0;
    }

    .chart-wrapper {
        background: #fff;
        padding: 16px 16px 0;
        margin-bottom: 32px;
    }
}

@media (max-width:1024px) {
    .chart-wrapper {
        padding: 8px;
    }
}
</style>
