<template>
    <div>
        <!--以弹窗形式打开Form-->
        <el-dialog
            class="diy-form-container"
            draggable
            :width="GetOpenFormWidth()"
            :modal="!IsTableChild()"
            :modal-append-to-body="false"
            v-model="ShowFieldForm"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :destroy-on-close="FieldFormDialogDestroyOnClose"
            :show-close="false"
            append-to-body
            style=""
        >
            <template #header
                ><div>
                    <div class="pull-left">
                        <i :class="GetOpenTitleIcon()" />
                        {{ GetOpenTitle() }}
                    </div>
                    <div class="pull-right">
                        <el-dropdown v-if="FormMode != 'View' && ShowSaveBtn" split-button type="primary" trigger="click" class="mr-3" @click="SaveDiyTableCommon(true, 'Close')">
                            <dynamic-icon :name="BtnLoading ? 'loading' : 's-help'" />
                            {{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddClose") : $t("Msg.UptClose") }}
                            <template #dropdown
                                ><el-dropdown-menu class="form-submit-btns">
                                    <el-dropdown-item
                                        v-if="ShowFormBottomBtns.SaveAdd"
                                        :icon="$getIcon(BtnLoading ? 'loading' : 's-help')"
                                        :disabled="BtnLoading"
                                        @click="SaveDiyTableCommon(false, 'Insert')"
                                        >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddAdd") : $t("Msg.UptAdd") }}</el-dropdown-item
                                    >
                                    <el-dropdown-item
                                        v-if="ShowFormBottomBtns.SaveUpdate"
                                        :icon="$getIcon(BtnLoading ? 'loading' : 's-help')"
                                        :disabled="BtnLoading"
                                        @click="SaveDiyTableCommon(false, 'Update')"
                                        >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddUpdate") : $t("Msg.UptUpdate") }}</el-dropdown-item
                                    >
                                    <el-dropdown-item
                                        v-if="ShowFormBottomBtns.SaveView"
                                        :icon="$getIcon(BtnLoading ? 'loading' : 's-help')"
                                        :disabled="BtnLoading"
                                        @click="SaveDiyTableCommon(false, 'View')"
                                        >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddView") : $t("Msg.UptView") }}</el-dropdown-item
                                    >
                                </el-dropdown-menu></template
                            >
                        </el-dropdown>
                        <el-button
                            v-if="FormMode == 'View' && LimitEdit() && TableChildFormMode !== 'View' && !TableChildField.Readonly && ShowUpdateBtn"
                            :loading="BtnLoading"
                            type="primary"
                            :icon="QuestionFilled"
                            @click="OpenDetail({ Id: TableRowId }, 'Edit', true)"
                            >{{ $t("Msg.Edit") }}</el-button
                        >
                        <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                            <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns">
                                <!-- v-if="LimitMoreBtn(btn)" -->
                                <el-button
                                    :key="'more_btn_formbtns_' + btnIndex"
                                    v-if="btn.IsVisible"
                                    type="primary"
                                    :loading="BtnLoading"
                                    @click="RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)"
                                >
                                    <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                    {{ btn.Name }}
                                </el-button>
                            </template>
                        </template>
                        <!-- liucheng2025-7-25去掉弹窗的删除按钮，表单的删除情况少，尽量在列表删不要在详情页删，详情页这里位置重要按钮了不太好。 -->
                        <!-- <el-button
            v-if="LimitDel() && TableChildFormMode !== 'View' && !TableChildField.Readonly && ShowDeleteBtn"
            :loading="BtnLoading"
            type="danger"
           
            :icon="Delete"
            @click="DelDiyTableRow(CurrentRowModel, 'ShowFieldForm')"
            >{{ $t("Msg.Delete") }}</el-button
          > -->
                        <el-button :icon="Close" @click="CloseFieldForm('ShowFieldForm', 'Close', TableRowId)">{{ $t("Msg.Close") }}</el-button>
                    </div>
                    <div class="clear"></div></div
            ></template>
            <div class="clear">
                <DiyForm
                    ref="fieldForm"
                    :LoadMode="''"
                    :FormMode="FormMode"
                    :TableChildFormMode="TableChildFormMode"
                    :TableId="TableId"
                    :TableName="TableName"
                    :TableRowId="TableRowId"
                    :DefaultValues="FieldFormDefaultValues"
                    :SelectFields="FieldFormSelectFields"
                    :FixedTabs="FieldFormFixedTabs"
                    :HideFields="FieldFormHideFields"
                    :ParentForm="FatherFormModel"
                    :ApiReplace="ApiReplace"
                    :EventReplace="EventReplace"
                    :ParentV8="ParentV8_Data ? ParentV8_Data : ParentV8"
                    :CurrentTableData="DiyTableRowList"
                    :ActiveDiyTableTab="CurrentTableRowListActiveTab"
                    :DataAppend="DataAppend"
                    @ParentFormSet="ParentFormSet"
                    @CallbackSetDiyTableModel="CallbackSetDiyTableModel"
                    @CallbackGetDiyField="CallbackGetDiyField"
                    @CallbackFormSubmit="CallbackFormSubmit"
                    @CallbackRefreshTable="CallbackRefreshTable"
                    @CallbackParentFormSubmit="CallbackParentFormSubmit"
                    @CallbackReloadForm="CallbackReloadForm"
                    @CallbackHideFormBtn="CallbackHideFormBtn"
                    @CallbackFormValueChange="CallbackFormValueChange"
                    @CallbackFormClose="CallbackFormClose"
                />
            </div>

            <!-- <template #footer class="dialog-footer">
        </template>
        </span> -->
        </el-dialog>
        <!--以抽屉形式打开Form
            v-if="ShowFieldFormDrawer" 用于解决destroy-on-close设置无效的bug。
            v-if="ShowFieldFormDrawer"
        -->
        <!-- :modal="!IsTableChild()" -->
        <el-drawer
            class="diy-form-container"
            :modal="!IsTableChild()"
            :size="GetOpenFormWidth()"
            :modal-append-to-body="false"
            v-model="ShowFieldFormDrawer"
            :close-on-press-escape="false"
            :destroy-on-close="FieldFormDialogDestroyOnClose"
            :wrapper-closable="false"
            :show-close="false"
            append-to-body
            style=""
        >
            <template #header
                ><div>
                    <div class="pull-left" style="color: #000; font-size: 15px">
                        <i :class="GetOpenTitleIcon()" />
                        {{ GetOpenTitle() }}
                    </div>
                    <div class="pull-right">
                        <el-dropdown v-if="FormMode != 'View' && ShowSaveBtn" split-button type="primary" trigger="click" class="mr-3" @click="SaveDiyTableCommon(true, 'Close')">
                            <dynamic-icon :name="BtnLoading ? 'loading' : 's-help'" />
                            {{ FormMode == "Add" || FormMode == "Insert" || FormMode == "Insert" ? $t("Msg.AddClose") : $t("Msg.UptClose") }}
                            <template #dropdown
                                ><el-dropdown-menu class="form-submit-btns">
                                    <el-dropdown-item
                                        v-if="ShowFormBottomBtns.SaveAdd"
                                        :icon="$getIcon(BtnLoading ? 'loading' : 's-help')"
                                        :disabled="BtnLoading"
                                        @click="SaveDiyTableCommon(false, 'Insert')"
                                        >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddAdd") : $t("Msg.UptAdd") }}</el-dropdown-item
                                    >
                                    <el-dropdown-item
                                        v-if="ShowFormBottomBtns.SaveUpdate"
                                        :icon="$getIcon(BtnLoading ? 'loading' : 's-help')"
                                        :disabled="BtnLoading"
                                        @click="SaveDiyTableCommon(false, 'Update')"
                                        >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddUpdate") : $t("Msg.UptUpdate") }}</el-dropdown-item
                                    >
                                    <el-dropdown-item
                                        v-if="ShowFormBottomBtns.SaveView"
                                        :icon="$getIcon(BtnLoading ? 'loading' : 's-help')"
                                        :disabled="BtnLoading"
                                        @click="SaveDiyTableCommon(false, 'View')"
                                        >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddView") : $t("Msg.UptView") }}</el-dropdown-item
                                    >
                                </el-dropdown-menu></template
                            >
                        </el-dropdown>
                        <el-button
                            v-if="FormMode == 'View' && LimitEdit() && TableChildFormMode !== 'View' && ShowUpdateBtn"
                            :loading="BtnLoading"
                            type="primary"
                            :icon="QuestionFilled"
                            @click="OpenDetail({ Id: TableRowId }, 'Edit', true)"
                            >{{ $t("Msg.Edit") }}</el-button
                        >
                        <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                            <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns">
                                <!-- v-if="LimitMoreBtn(btn)" -->
                                <el-button
                                    :key="'more_btn_formbtns_' + btnIndex"
                                    v-if="btn.IsVisible"
                                    type="primary"
                                    :loading="BtnLoading"
                                    @click="RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)"
                                >
                                    <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                    {{ btn.Name }}
                                </el-button>
                            </template>
                        </template>
                        <!-- liucheng2025-7-25去掉弹窗的删除按钮，表单的删除情况少，尽量在列表删不要在详情页删，详情页这里位置重要按钮了不太好。 -->
                        <!-- <el-button
            v-if="LimitDel() && TableChildFormMode !== 'View' && ShowDeleteBtn"
            :loading="BtnLoading"
            type="danger"
           
            :icon="Delete"
            @click="DelDiyTableRow(CurrentRowModel, 'ShowFieldForm')"
            >{{ $t("Msg.Delete") }}</el-button
          > -->
                        <el-button :icon="Close" @click="CloseFieldForm('ShowFieldFormDrawer', 'Close', TableRowId)">{{ $t("Msg.Close") }}</el-button>
                        <!-- <i class="fas fa-arrows-alt-h pull-right" style="font-size:;width:50px;"></i> -->
                    </div>
                </div></template
            >

            <div class="clear">
                <DiyForm
                    ref="fieldForm"
                    :LoadMode="''"
                    :FormMode="FormMode"
                    :TableChildFormMode="TableChildFormMode"
                    :TableId="TableId"
                    :TableName="TableName"
                    :TableRowId="TableRowId"
                    :DefaultValues="FieldFormDefaultValues"
                    :SelectFields="FieldFormSelectFields"
                    :FixedTabs="FieldFormFixedTabs"
                    :HideFields="FieldFormHideFields"
                    :ParentForm="FatherFormModel"
                    :ApiReplace="ApiReplace"
                    :EventReplace="EventReplace"
                    :ParentV8="ParentV8_Data ? ParentV8_Data : ParentV8"
                    :CurrentTableData="DiyTableRowList"
                    :ActiveDiyTableTab="CurrentTableRowListActiveTab"
                    :DataAppend="DataAppend"
                    @ParentFormSet="ParentFormSet"
                    @CallbackSetDiyTableModel="CallbackSetDiyTableModel"
                    @CallbackGetDiyField="CallbackGetDiyField"
                    @CallbackFormSubmit="CallbackFormSubmit"
                    @CallbackRefreshTable="CallbackRefreshTable"
                    @CallbackParentFormSubmit="CallbackParentFormSubmit"
                    @CallbackReloadForm="CallbackReloadForm"
                    @CallbackHideFormBtn="CallbackHideFormBtn"
                    @CallbackFormValueChange="CallbackFormValueChange"
                />
            </div>
            <!-- <span class="demo-drawer__footer">

        </span> -->
        </el-drawer>
    </div>
</template>

<script>
import { defineAsyncComponent, computed } from "vue";
import { useDiyStore } from "@/stores";
import _ from "underscore";

export default {
    name: "diy-form-dialog",
    directives: {},
    components: {
        // Vue 3: 使用 defineAsyncComponent 包装动态 import
        DiyForm: defineAsyncComponent(() => import("@/views/diy/diy-form"))
    },
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
        //子表的DiyTableId
        TableChildTableId: {
            type: String,
            default: ""
        },
        TableChildFormMode: {
            type: String,
            default: ""
        },
        //子表Field对象
        TableChildField: {
            type: Object,
            default() {
                return {};
            }
        },
        ParentV8: {
            type: Object,
            default() {
                return {};
            }
        },
        FatherFormModel: {
            type: Object,
            default() {
                return {};
            }
        }
    },
    watch: {},
    data() {
        return {
            DialogType: "", //Dialog、Drawer
            Width: "",
            TableId: "",
            TableName: "",
            SysMenuId: "",
            SysMenuModel: {},
            TableRowId: "",
            CurrentDiyTableModel: {},
            ShowFieldForm: false,
            ShowFieldFormDrawer: false,
            FieldFormDialogDestroyOnClose: false,
            CurrentRowModel: {},
            ShowDiyFieldList: null,
            DiyFieldList: [],
            FormMode: "View",
            BtnLoading: false,
            ShowFormBottomBtns: {
                SaveClose: true,
                SaveAdd: true,
                SaveUpdate: true,
                SaveView: true
            },
            ShowUpdateBtn: true,
            ShowDeleteBtn: true,
            ShowSaveBtn: true,
            FieldFormHideFields: [],
            FieldFormFixedTabs: [],
            FieldFormSelectFields: [],
            FieldFormDefaultValues: {},
            ParentV8_Data: null,
            CurrentTableRowListActiveTab: {},
            DiyTableRowList: [],
            CloseFormNeedConfirm: false,
            ApiReplace: {},
            EventReplace: {},
            DataAppend: {}
        };
    },
    mounted() {
        var self = this;
    },
    methods: {
        /**
         * 必传：TableId或TableName、FormMode（Add/Edit/View）、Id（当FormMode为View或Edit时，必传Id）
         * 可传：DialogType（Dialog/Drawer），若不传，则读取表单设计中配置的宽度。
         * 可传：Width宽度
         * 可传：SelectFields：['fieldName']
         * 可传：ApiReplace：{ Update : '', Submit : '' }
         * 可传：EventReplace：{ Submit : function, Update : function,  Insert : function}
         * 可传：DataAppend: {}
         */

        Init(param) {
            var self = this;
            self.TableId = param.TableId;
            self.TableName = param.TableName;
            self.FormMode = param.FormMode;
            self.DialogType = param.DialogType;
            self.SysMenuId = param.SysMenuId;
            self.FieldFormSelectFields = param.SelectFields;
            self.ApiReplace = param.ApiReplace;
            self.EventReplace = param.EventReplace;
            self.Width = param.Width;
            self.DataAppend = param.DataAppend;

            var tableRowModel = {};
            if (param.Id) {
                tableRowModel.Id = param.Id;
            }

            // var tableRowModel = param.FormData;
            var formMode = param.FormMode;
            var isDefaultOpen = param.IsDefaultOpen;

            //要么传入 、要么再次查询的对象：
            //SysMenuModel、DiyFieldList
            // if(self.DiyCommon.IsNull(param.SysMenuModel) || self.DiyCommon.IsNull(param.DiyFieldList)){
            //     self.GetAllData();
            // }
            self.$nextTick(function () {
                self.OpenDetail(tableRowModel, formMode, isDefaultOpen);
            });
        },
        //这个其实就是此组件的Init
        //tableRowModel:行数据/表单数据
        //isDefaultOpen：是否默认打开，默认打开不会跳走到定制界面
        //formMode:表单打开方式 Add/View/Edit
        OpenDetail(tableRowModel, formMode, isDefaultOpen) {
            var self = this;
            //2020-10-23从数据库重新获取，以防止被修改过页面缓存数据
            // self.DiyCommon.GetDiyTableRowModel();

            self.BtnLoading = true;
            self.FormMode = formMode;
            self.ShowUpdateBtn = true;
            self.ShowDeleteBtn = true;

            self.TableRowId = self.DiyCommon.IsNull(tableRowModel) ? "" : tableRowModel.Id;
            if (self.FormMode == "Add" || self.FormMode == "Insert") {
                self.DiyCommon.Post("/api/diytable/NewGuid", {}, function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.TableRowId = result.Data;
                        self.$nextTick(function () {
                            self.OpenDetailHandler(tableRowModel, formMode, isDefaultOpen);
                        });
                    } else {
                        self.BtnLoading = false;
                    }
                });
            } else {
                self.$nextTick(function () {
                    self.OpenDetailHandler(tableRowModel, formMode, isDefaultOpen);
                });
            }
        },
        async OpenDetailHandler(tableRowModel, formMode, isDefaultOpen) {
            var self = this;
            if (formMode == "View" && !self.DiyCommon.IsNull(self.SysMenuModel.DetailPageV8)) {
                var V8 = {
                    Form: tableRowModel,
                    FormSet: (fieldName, value) => {
                        return self.FormSet(fieldName, value, row);
                    }, // 给Form表单其它字段赋值
                    GetDiyTableRow: self.GetDiyTableRow,
                    EventName: "BtnFormDetailRun"
                };
                self.SetV8DefaultValue(V8);
                await self.DiyCommon.InitV8Code(V8, self.$router);
                if (!self.DiyCommon.IsNull(self.TableRowId)) {
                    V8.Form.Id = self.TableRowId;
                }
                try {
                    // eval(self.SysMenuModel.DetailPageV8);
                    await eval("(async () => {\n " + self.SysMenuModel.DetailPageV8 + " \n})()");
                } catch (error) {
                    self.DiyCommon.Tips("执行详情按钮V8代码出现错误：" + error.message, false);
                }
            } else {
                //2022-09-01注释
                // self.FieldFormSelectFields = []
                self.FieldFormFixedTabs = [];
            }

            if (self.CurrentDiyTableModel.FormOpenType == "Dialog" || self.CurrentDiyTableModel.FormOpenType == "Drawer" || self.DiyCommon.IsNull(self.CurrentDiyTableModel.FormOpenType)) {
                if (self.DiyCommon.IsNull(tableRowModel)) {
                    self.CurrentRowModel = {};
                    self.FieldFormDialogDestroyOnClose = false;
                } else {
                    self.FieldFormDialogDestroyOnClose = false; // false

                    //2021-09-06 此处不再获取数据详情，而是由DiyForm的Init回调函数获取，否则会查询两次
                    // self.DiyCommon.Post(self.DiyApi.GetDiyTableRowModel, {
                    //     TableId: self.TableId,
                    //     _TableRowId: self.TableRowId,
                    //     // OsClient: self.OsClient
                    // }, function (result) {
                    //     if (self.DiyCommon.Result(result)) {
                    //         self.CurrentRowModel = result.Data;
                    //         //2021-09-06 取到数据后才放开按钮的点击
                    //         self.$nextTick(function(){
                    //             self.BtnLoading = false;
                    //         });
                    //     }
                    // })
                }

                // self.CurrentRowModel = self.DiyCommon.IsNull(tableRowModel) ? {} : tableRowModel;
                self.ShowFieldFormHide = false;

                var dialogType = "";
                if (self.DialogType) {
                    dialogType = self.DialogType;
                } else if (self.CurrentDiyTableModel.FormOpenType == "Dialog") {
                    dialogType = "Dialog";
                } else {
                    dialogType = "Drawer";
                }

                if (dialogType == "Dialog") {
                    self.ShowFieldForm = true;
                    if (window.history && window.history.pushState) {
                        //监听浏览器前进后退事件
                        $(window).on("popstate", function () {
                            //do something...
                        });
                    }
                    self.$nextTick(function () {
                        self.$refs.fieldForm.Init(true, function (callbackValue) {
                            if (callbackValue && callbackValue.CurrentRowModel) {
                                self.CurrentRowModel = callbackValue.CurrentRowModel;
                                var V8 = callbackValue.V8;
                                self.HandlerBtns(self.SysMenuModel.FormBtns, self.CurrentRowModel, V8);
                            }
                            self.BtnLoading = false;
                        });
                    });
                } else {
                    self.ShowFieldFormDrawer = true;
                    // 0.2s后再加载，不然滑动的时候会卡
                    self.$nextTick(function () {
                        setTimeout(function () {
                            if (self.$refs.fieldForm) {
                                self.$refs.fieldForm.Init(true, function (callbackValue) {
                                    if (callbackValue && callbackValue.CurrentRowModel) {
                                        self.CurrentRowModel = callbackValue.CurrentRowModel;
                                        var V8 = callbackValue.V8;
                                        self.HandlerBtns(self.SysMenuModel.FormBtns, self.CurrentRowModel, V8);
                                    }
                                    self.BtnLoading = false;
                                });
                            }
                        }, 200);
                    });
                }
            } else {
                var url = "/diy/form-page/" + self.TableId;
                if (!self.DiyCommon.IsNull(tableRowModel)) {
                    url += "/" + tableRowModel.Id;
                }
                url += "?FormMode=" + self.FormMode;
                self.$router.push(url);
                // self.$router.push(url);
                // self.$router.push('/diy/diy-table-form?TableId='
                //     + self.TableId +
                //     (self.DiyCommon.IsNull(tableRowModel) ? '' : '&TableRowId=' + tableRowModel.Id)
                //     + '&FormMode=' + self.FormMode
                // )
            }
        },
        GetAllData() {
            var self = this;
            var params = [
                {
                    Url: self.DiyApi.GetDiyFieldByDiyTables,
                    Param: {
                        TableIds: [self.TableId],
                        SysMenuId: self.SysMenuId
                    }
                }
            ];
            if (self.SysMenuId) {
                param.push({
                    Url: self.DiyApi.GetSysMenuModel,
                    Param: {
                        Id: self.SysMenuId
                    }
                });
            }
            if (self.TableId) {
                params.push({
                    Url: self.DiyApi.GetDiyTableModel,
                    Param: {
                        Id: self.TableId
                    }
                });
            } else if (self.TableName) {
                params.push({
                    Url: self.DiyApi.GetDiyTableModel,
                    Param: {
                        Name: self.TableName
                    }
                });
            }
            //同时获SysMenuModel、DiyTableModel、DiyFieldList（包含了SysMenu中配置的JoinTables）
            self.DiyCommon.PostAll(params, function (results) {
                if (self.DiyCommon.Result(results[0]) && self.DiyCommon.Result(results[1])) {
                    // && self.DiyCommon.Result(results[2])
                    // self.GetSysMenuModelAfter(results[0]);
                    // self.GetDiyTableModelAfter(results[1]);
                    // self.GetDiyFieldAfter(results[2]);
                }
            });
        },
        GetSysMenuModelAfter(result) {
            var self = this;
            self.DiyCommon.ForConvertSysMenu(result.Data);
            //2021-09-02 提前渲染 页面更多按钮(PageBtns)、页面多Tab（PageTabs）、批量选择更多按钮BatchSelectMoreBtns、更多导出按钮(ExportMoreBtns)
            self.HandlerBtns(result.Data.PageBtns);
            //注意：表单按钮，一定要先打开表单后再进行判断IsVisible
            // self.HandlerBtns(result.Data.FormBtns);
            self.HandlerBtns(result.Data.PageTabs);
            self.HandlerBtns(result.Data.BatchSelectMoreBtns);
            self.HandlerBtns(result.Data.ExportMoreBtns);
            // result.Data.PageBtns.forEach(element => {
            // });

            //-------GetPageTabs()提前预生成
            if (!self.DiyCommon.IsNull(result.Data.DiyConfig) && !self.DiyCommon.IsNull(result.Data.PageTabs) && result.Data.PageTabs.length > 0) {
                //url带上tab参数，  2022-06-01
                var queryTab = self.$route.query.Tab;
                if (!self.DiyCommon.IsNull(queryTab)) {
                    result.Data.PageTabs.forEach((element) => {
                        if (element.Name == queryTab) {
                            self.TableRowListActiveTab = element.Id;
                            self.CurrentTableRowListActiveTab = element;
                            //执行V8
                            //注意：这里要设置搜索条件.V8.SetV8SearchModel([{FieldName : value}, {FieldName2 : value}]);
                            if (!self.DiyCommon.IsNull(element.V8Code)) {
                                self.RunPageTabV8Code(element.V8Code);
                            }
                        }
                    });
                }

                //TableRowListActiveTab 虽然给的默认是空'',但实际上是‘0’，为啥 ？
                if (self.DiyCommon.IsNull(self.TableRowListActiveTab) || self.TableRowListActiveTab == "none" || self.TableRowListActiveTab == "0") {
                    self.TableRowListActiveTab = result.Data.PageTabs[0].Id;
                    var tabModel = result.Data.PageTabs[0];
                    self.CurrentTableRowListActiveTab = tabModel;
                    //执行V8
                    //注意：这里要设置搜索条件.V8.SetV8SearchModel([{FieldName : value}, {FieldName2 : value}]);
                    if (!self.DiyCommon.IsNull(tabModel.V8Code)) {
                        self.RunPageTabV8Code(tabModel.V8Code);
                    }
                    //2020-10-22新增，设置选中第一个Tab，查询一次数据
                    //2022-05-14 这里不再查询数据，全部After处理好了再查询数据
                    // self.GetDiyTableRow({_PageIndex : 1});
                }
                // return self.SysMenuModel.PageTabs;
            } else {
                self.TableRowListActiveTab = "none";
                result.Data.PageTabs = [
                    {
                        Id: "none",
                        Name: ""
                    }
                ];
            }
            //-----

            self.SysMenuModel = result.Data;
            //--------处理模块配置
            if (!self.DiyCommon.IsNull(self.SysMenuModel.TableDiyFieldIds)) {
                //查询列
                // self.ShowDiyFieldList = self.SysMenuModel.TableDiyFieldIds
                self.TableDiyFieldIds = self.SysMenuModel.TableDiyFieldIds;
            } else {
                // self.ShowDiyFieldList = []
                self.TableDiyFieldIds = [];
            }

            // 取出可搜索字段，
            if (!self.DiyCommon.IsNull(self.SysMenuModel.SearchFieldIds)) {
                self.SearchFieldIds = self.SysMenuModel.SearchFieldIds;
            } else {
                self.SearchFieldIds = [];
            }
            // 取出可排序字段，
            if (!self.DiyCommon.IsNull(self.SysMenuModel.SortFieldIds)) {
                self.SortFieldIds = self.SysMenuModel.SortFieldIds;
            } else {
                self.SortFieldIds = [];
            }
            //不错不显示查询列
            if (!self.DiyCommon.IsNull(self.SysMenuModel.NotShowFields)) {
                self.NotShowFields = self.SysMenuModel.NotShowFields;
            } else {
                self.NotShowFields = [];
            }
            //------------------------

            //2022-05-14 这里不再查询数据，全部After处理好了再查询数据
            if (self.DiyCommon.IsNull(self.SysMenuModel.PageTabs) || self.SysMenuModel.PageTabs.length == 0) {
                // self.GetDiyTableRow({_PageIndex : 1});
            }
        },
        GetDiyTableModelAfter(result) {
            var self = this;
            self.DiyCommon.DiyTableStrToJson(result.Data);
            self.CurrentDiyTableModel = result.Data;
        },
        GetDiyFieldAfter(result) {
            var self = this;
            //这里需要DiyFieldStrToJson转换，否则取不到配置数据
            result.Data.forEach((field) => {
                // self.DiyFieldStrToJson(field, formData, isPostSql);
                self.DiyCommon.DiyFieldConfigStrToJson(field);
                //处理别名
                if (self.SysMenuModel.SelectFields && Array.isArray(self.SysMenuModel.SelectFields)) {
                    var search2 = _.where(self.SysMenuModel.SelectFields, {
                        Id: field.Id
                    });
                    if (search2.length > 0 && !self.DiyCommon.IsNull(search2[0].AsName)) {
                        field["AsName"] = search2[0].AsName;
                    }
                }
                //注意：这里面是有异步赋值的，骚年
                self.DiyCommon.SetFieldData(field);
                // if (Array.isArray(field.Data)) {
                //     field.Data.forEach(fieldData => {
                //         if (typeof(fieldData) == 'object') {
                //             fieldData._Checked = false;
                //         }
                //     });
                // }
                // field._SearchChecked = [];
                if (!DiyCommon.IsNull(field.Config.DevComponentName) && !DiyCommon.IsNull(field.Config.DevComponentPath)) {
                    //渲染定制组件
                    try {
                        //2022-06-22新增
                        field.Config.DevComponentPath = field.Config.DevComponentPath.replace("/views", "");

                        // Vue 3: 使用 defineAsyncComponent 包装动态 import
                        var componentPath = field.Config.DevComponentPath;
                        var component = defineAsyncComponent(() => import(/* @vite-ignore */ `@/views${componentPath}`));
                        // Vue 3: 使用全局 app 实例注册组件
                        const app = window.__VUE_APP__;
                        if (app && !app._context.components[field.Config.DevComponentName]) {
                            app.component(field.Config.DevComponentName, component);
                        }
                        if (self.DiyCommon.IsNull(self.DevComponents[field.Config.DevComponentName])) {
                            self.DevComponents[field.Config.DevComponentName] = {
                                Name: "",
                                Path: ""
                            };
                        }
                        self.DevComponents[field.Config.DevComponentName].Name = field.Config.DevComponentName;
                        self.DevComponents[field.Config.DevComponentName].Path = field.Config.DevComponentPath;
                        // console.log('渲染定制组件成功');
                    } catch (error) {
                        console.log("渲染定制组件出现错误：" + error.message);
                    }
                }
            });

            self.DiyFieldList = result.Data;
            // self.$emit("CallbackGetDiyField", self.DiyFieldList)
        },
        LimitDel() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (self.TableChildFormMode != "View" && roleLimitModel.length > 0) {
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf("Del") > -1) {
                        result = true;
                    }
                });
                return result;
            }
            return false;
        },
        LimitEdit() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (self.TableChildFormMode != "View" && roleLimitModel.length > 0) {
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf("Edit") > -1) {
                        result = true;
                    }
                });
                return result;
            }
            return false;
        },
        //这里之所以需要一个HandlerBtns，是因为v-if不支持async LimitMoreBtn，需要提前将结果计算出来放到属性中去
        HandlerBtns(btns, row, v8) {
            var self = this;
            if (btns) {
                if (self.DiyCommon.IsNull(row)) {
                    row = {};
                }
                // btns.forEach(async (btn) => {
                btns.forEach((btn) => {
                    //这里需要暂存一下参数，相同的参数，没必要多次执行，否则会请求几百次接口
                    //但需要在
                    // if (!(self.TempBtnIsVisible.indexOf(btn.Id + row.Id) > -1)) {
                    //     self.TempBtnIsVisible.push(btn.Id + row.Id);
                    // var isVisible = await self.LimitMoreBtn(btn, row);
                    var isVisible = self.LimitMoreBtn(btn, row, v8);
                    btn.IsVisible = isVisible;
                    // self.$set(btn, 'IsVisible', isVisible);
                    // }
                });
            }
        },
        //LimitMoreBtn取消了async await支持，跟每行数据的模板引擎一样，禁止使用await
        LimitMoreBtn(btn, row, v8) {
            var self = this;
            //如果V8配置了不显示
            var V8 = v8 ? v8 : {};
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
                        V8.FormSet = (fieldName, value) => {
                            return self.FormSet(fieldName, value, row);
                        }; // 给Form表单其它字段赋值
                    }
                    V8.OpenForm = (row, type) => {
                        return self.OpenDetail(row, type, true);
                    };
                    V8.EventName = "​V8BtnLimit";
                    self.SetV8DefaultValue(V8);
                    self.DiyCommon.InitV8Code(V8, self.$router);
                    eval(btn.V8CodeShow);
                    // await eval("(async () => {\n " + btn.V8CodeShow + " \n})()")
                } else {
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
            }
            if (V8.Result === false) {
                return false;
            }
            //------------------------------------------------------

            if (self.GetCurrentUser._IsAdmin === true) {
                return true;
            }
            var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (self.TableChildFormMode != "View" && roleLimitModel.length > 0) {
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf(btn.Id) > -1) {
                        result = true;
                    }
                });
                return result;
            }
            return false;
        },
        SetV8DefaultValue(V8, field) {
            var self = this;
            V8.DataAppend = self.DataAppend;
            V8.TableId = self.TableId;
            V8.CurrentUser = self.GetCurrentUser;
            V8.TableRowSelected = self.TableMultipleSelection;
            V8.ParentForm = self.FatherFormModel;
            if (self.ParentV8_Data) {
                V8.ParentV8 = self.ParentV8_Data;
            } else {
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
            self.DiyFieldList.forEach((element) => {
                diyFieldList[element.Name] = element;
            });
            V8.Field = diyFieldList;
            V8.ShowTableChildHideField = self.ShowTableChildHideField;

            V8.FieldSet = self.FieldSet;
            V8.CurrentTableData = self.DiyTableRowList;
            // V8.GetChildTableData = '';
        },
        ParentFormSet(fieldName, value) {
            var self = this;
            self.$emit("ParentFormSet", fieldName, value);
        },
        IsTableChild() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.TableChildTableId)) {
                return true;
            }
            return false;
        },
        GetOpenFormWidth() {
            var self = this;
            if (self.Width) {
                return self.Width;
            }
            if (self.DiyCommon.GetPageBodyClientWH().Width < 768) {
                return "100%";
            }
            var result = self.DiyCommon.IsNull(self.CurrentDiyTableModel.FormOpenWidth) ? "768px" : self.CurrentDiyTableModel.FormOpenWidth;
            return result;
        },
        GetOpenTitleIcon() {
            var self = this;
            return self.DiyCommon.IsNull(self.CurrentRowModel) || self.DiyCommon.IsNull(self.CurrentRowModel.Id) ? "fas fa-plus" : "far fa-edit";
        },
        GetOpenTitle() {
            var self = this;
            var title1 = "";
            if (self.DiyCommon.IsNull(self.CurrentRowModel) || self.DiyCommon.IsNull(self.CurrentRowModel.Id)) {
                title1 = self.$t("Msg.Add");
            } else {
                var fieldModel = self.ShowDiyFieldList && self.ShowDiyFieldList[0];
                var firstValue = "";
                if (fieldModel && !self.DiyCommon.IsNull(fieldModel.Config) && !self.DiyCommon.IsNull(fieldModel.Config.SelectLabel)) {
                    try {
                        firstValue = JSON.parse(self.CurrentRowModel[fieldModel.Name])[fieldModel.Config.SelectLabel];
                    } catch (error) {
                        firstValue = self.CurrentRowModel[fieldModel.Name];
                    }
                } else {
                    if (fieldModel) {
                        firstValue = self.CurrentRowModel[fieldModel.Name];
                    }
                }
                title1 = self.$t("Msg." + self.FormMode) + (firstValue ? " [" + firstValue.toString().substring(0, 10) + "]" : "");
            }
            // var title2 = (self.DiyCommon.IsNull(self.CurrentDiyTableModel) || self.DiyCommon.IsNull(self.CurrentDiyTableModel.Name))
            //             ? '' : self.CurrentDiyTableModel.Name.replace('Diy_', '');
            var title2 = "";
            var title3 = self.DiyCommon.IsNull(self.CurrentDiyTableModel) || self.DiyCommon.IsNull(self.CurrentDiyTableModel.Description) ? "" : self.CurrentDiyTableModel.Description;

            //  + ' - ' + title2
            return title1 + (!self.DiyCommon.IsNull(title3) && title3 != title2 ? " - " + title3 : "");
        },
        //savedType：离开表单类型，保存后的操作：Insert、Update、View
        //param:{CloseForm : true}
        async SaveDiyTableCommon(param, savedType) {
            var self = this;
            if (self.BtnLoading == true) {
                return;
            }
            var isClose = false;
            if (typeof param == "boolean") {
                isClose = param;
            } else if (!self.DiyCommon.IsNull(param)) {
                if (!self.DiyCommon.IsNull(param.CloseForm)) {
                    isClose = param.CloseForm;
                }
                if (!self.DiyCommon.IsNull(param.SavedType)) {
                    savedType = param.SavedType;
                }
            }

            self.BtnLoading = true;

            //必传FormMode、TableRowId
            var formParam = {
                FormMode: self.FormMode,
                TableRowId: self.TableRowId,
                SavedType: savedType,
                SaveLoading: self.BtnLoading
            };
            //必传：FormMode、TableRowId、SavedType、SaveLoading
            self.$refs.fieldForm.FormSubmit(formParam, async function (isSccuess) {
                if (isSccuess === true) {
                    //注意：这里一定要回写一下，因为FormSubmit内部无法引用更新这些值
                    self.FormMode = formParam.FormMode;
                    self.TableRowId = formParam.TableRowId;
                    self.BtnLoading = formParam.SaveLoading;

                    //这里没必要执行离开表单V8，因为DiyForm内部会执行
                    // if (self.FormMode == 'Edit') {//!self.DiyCommon.IsNull(self.TableRowId)
                    //     self.CloseFieldForm(null, 'Update', self.TableRowId);
                    // }else{
                    //     self.CloseFieldForm(null, 'Insert',self.TableRowId);
                    // }

                    if (isClose === true) {
                        self.ShowFieldForm = false;
                        self.ShowFieldFormDrawer = false;
                        self.ShowYanZhen = false;
                    } else {
                        //刷新子表
                        self.$refs.fieldForm.RefreshAllChildTable();
                    }
                    // self.GetDiyTableRow()
                    self.$emit("CallbackGetDiyTableRow", formParam);
                } else {
                    self.BtnLoading = formParam.SaveLoading;
                }
            });
        },
        DelDiyTableRow(rowModel, dialogId) {
            var self = this;
            var title = "";

            var fieldModel = self.ShowDiyFieldList[0];
            if (fieldModel && !self.DiyCommon.IsNull(fieldModel.Config) && !self.DiyCommon.IsNull(fieldModel.Config.SelectLabel)) {
                try {
                    title = JSON.parse(rowModel[fieldModel.Name])[fieldModel.Config.SelectLabel];
                } catch (error) {
                    title = rowModel[fieldModel.Name];
                }
            } else {
                if (fieldModel) {
                    title = rowModel[fieldModel.Name];
                }
            }
            self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + "【" + title + "】？", async function () {
                //如果是表内新增的，直接删除
                if (rowModel._IsInTableAdd === true) {
                    var tIndex = 0;
                    self.DiyTableRowList.forEach((element) => {
                        if (element.Id == rowModel.Id) {
                            self.DiyTableRowList.splice(tIndex, 1);
                        }
                        tIndex++;
                    });
                    return;
                }

                //执行表单提交前V8
                var v8Result = await self.FormSubmitAction("Delete", rowModel.Id, rowModel);
                if (v8Result === false || (v8Result && (v8Result.Code === 0 || (v8Result.Code && v8Result.Code != 1)))) {
                    if (v8Result && v8Result.Msg) {
                        self.DiyCommon.Tips(v8Result.Msg, false);
                    }
                    return;
                }
                var param = {
                    TableId: self.TableId,
                    _TableRowId: rowModel.Id
                    // OsClient: self.OsClient
                };

                var url = self.DiyApi.DelDiyTableRow;
                if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.ApiReplace.Delete)) {
                    url = self.DiyCommon.RepalceUrlKey(self.CurrentDiyTableModel.ApiReplace.Delete);
                }
                self.DiyCommon.Post(url, param, async function (result) {
                    if (self.DiyCommon.Result(result)) {
                        //执行表单提交后V8
                        await self.FormOutAction("Delete", "Delete", rowModel.Id, null, rowModel);

                        //请求接口--------start
                        // try {
                        //   if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.DelCallbakApi)) {
                        //     param.Id = param._TableRowId;
                        //     self.DiyCommon.Post(self.CurrentDiyTableModel.DelCallbakApi, param, function (apiResult) {});
                        //   }
                        // } catch (error) {
                        //   console.log("请求接口 error：", error);
                        // }

                        //--------------end
                        self.DiyCommon.Tips(self.$t("Msg.Success"));

                        if (dialogId) {
                            self.$nextTick(function () {
                                if (!self.DiyCommon.IsNull(dialogId)) {
                                    self[dialogId] = false;
                                }
                            });
                        }

                        self.GetDiyTableRow();
                        self.$emit("CallbackGetDiyTableRow", {});
                    }
                });
            });
        },
        CallbackFormSubmit(param) {
            var self = this;
            self.SaveDiyTableCommon(param);
        },
        CallbackGetDiyField(diyFieldList) {
            var self = this;
            // self.DiyFieldList = diyFieldList
        },
        CallbackSetDiyTableModel(model) {
            var self = this;
            self.CurrentDiyTableModel = model;
        },
        CallbackRefreshTable(param) {
            var self = this;
            // self.GetDiyTableRow(param);
        },
        CallbackParentFormSubmit(param) {
            var self = this;
            self.$emit("CallbackParentFormSubmit", param);
        },
        CallbackReloadForm(row, type) {
            var self = this;
            //tableRowModel, formMode, isDefaultOpen
            self.OpenDetail(row, type);
        },
        CallbackHideFormBtn(btn) {
            var self = this;
            self["Show" + btn + "Btn"] = false;
        },
        async CloseFieldForm(dialogId, actionType, tableRowId, isForceClose) {
            var self = this;
            if (self.FormMode == "View" || self.CloseFormNeedConfirm == false || isForceClose) {
                await self.CloseFieldFormHandler(dialogId, actionType, tableRowId);
            } else {
                self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmClose") + "？", async function () {
                    await self.CloseFieldFormHandler(dialogId, actionType, tableRowId);
                });
            }
        },
        async CloseFieldFormHandler(dialogId, actionType, tableRowId) {
            var self = this;
            //执行离开Form V8。 为什么注释？
            //2021-03-09 取消注释，关闭也需要执行离开表单V8事件。
            //但是注意：DiyForm内部也会执行FormOutAction，所以这里只需要是纯关闭时才执行此V8
            await self.$refs.fieldForm.FormOutAction(actionType, "Close", tableRowId, null);

            //清空表单值
            //2022-07-13：如果在关闭表单弹窗时清空表单值，就会触发上面的watch监控，然后又会请求一次getdiytablerow接口,所以要先标记ParentFormLoadFinish=false
            //TODO 实际上clear还要考虑到把子表数据清空，不然会一闪而过上一条数据的子表数据
            // self.$refs.fieldForm.Clear();
            self.$refs.fieldForm.SetDiyTableRowModelFinish(false);
            self.$nextTick(function () {
                self.$refs.fieldForm.Clear();
                if (!self.DiyCommon.IsNull(dialogId)) {
                    self[dialogId] = false;
                }
            });
        },
        CallbackFormValueChange(field, value) {
            var self = this;
            if (self.FormMode !== "View") {
                self.CloseFormNeedConfirm = true;
            }
        },
        async RunMoreBtn(btn, row, v8) {
            var self = this;
            self.BtnV8Loading = true;
            var V8 = v8 ? v8 : {};
            try {
                if (!self.DiyCommon.IsNull(btn.V8Code)) {
                    if (!V8.Form) {
                        var form = { ...row };
                        V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
                    }
                    if (!V8.FormSet) {
                        V8.FormSet = (fieldName, value) => {
                            return self.FormSet(fieldName, value, row);
                        }; // 给Form表单其它字段赋值
                    }
                    V8.OpenForm = (row, type) => {
                        return self.OpenDetail(row, type, true);
                    };
                    V8.OpenFormWF = (row, type, wfParam) => {
                        return self.OpenDetail(row, type, true, true, wfParam);
                    };
                    // V8.BtnV8Loading = self.BtnV8Loading;
                    V8.V8Callback = () => {
                        self.BtnV8Loading = false;
                    };
                    V8.EventName = "​V8BtnRun";
                    self.SetV8DefaultValue(V8);
                    await self.DiyCommon.InitV8Code(V8, self.$router);
                    // eval(btn.V8Code)
                    await eval("(async () => {\n " + btn.V8Code + " \n})()");
                    // if(!(btn.V8Code.indexOf('V8.BtnV8Loading') > -1)){
                    if (!(btn.V8Code.indexOf("V8.V8Callback") > -1)) {
                        self.BtnV8Loading = false;
                    }
                } else {
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                    self.BtnV8Loading = false;
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
                self.BtnV8Loading = false;
            }
        },
        DeleteFormProperty(form) {
            Reflect.deleteProperty(form, "_RowMoreBtnsOut");
            Reflect.deleteProperty(form, "_RowMoreBtnsIn");
            return form;
        },
        CallbackFormClose() {
            var self = this;
            if (self.ShowFieldForm == true) {
                self.CloseFieldForm("ShowFieldForm", "Close", self.TableRowId, true);
            } else if (self.ShowFieldFormDrawer == true) {
                self.CloseFieldForm("ShowFieldFormDrawer", "Close", self.TableRowId, true);
            }
        }
    }
};
</script>

<style lang="scss" scoped></style>
