<template>
    <div>
        <!--以全新页面形式打开Form（路由页面模式）-->
        <div v-if="IsPageMode" class="pluginPage" :class="{ 'mobile-form-page': diyStore.IsPhoneView }" style="margin-top: 10px;">
            <!-- 移动端顶部导航 -->
            <div v-if="diyStore.IsPhoneView" class="mobile-form-header-bar">
                <div class="mobile-header-left">
                    <el-icon class="back-icon" @click="Go_1()">
                        <ArrowLeft />
                    </el-icon>
                </div>
                <div class="mobile-header-center">
                    <span class="mobile-title">{{ GetOpenTitlePage() }}</span>
                </div>
                <div class="mobile-header-right">
                    <el-dropdown trigger="click" v-if="HasMobileActions">
                        <el-icon class="more-icon">
                            <MoreFilled />
                        </el-icon>
                        <template #dropdown>
                            <el-dropdown-menu>
                                <el-dropdown-item v-if="FormMode != 'View'" @click="SaveDiyTableCommonPage(true)">
                                    <el-icon><SuccessFilled /></el-icon>保存
                                </el-dropdown-item>
                                <el-dropdown-item v-if="FormMode == 'View' && ShowUpdateBtn" @click="GotoEdit()">
                                    <el-icon><Edit /></el-icon>编辑
                                </el-dropdown-item>
                                <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                                    <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns">
                                        <el-dropdown-item
                                            :key="'mobile_btn_' + btnIndex"
                                            v-if="btn.IsVisible"
                                            @click="RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)"
                                        >
                                            <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                            {{ btn.Name }}
                                        </el-dropdown-item>
                                    </template>
                                </template>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                </div>
            </div>

            <div>
                <div class="form-header" :class="{ 'mobile-form-header': diyStore.IsPhoneView }" 
                    style="margin-bottom: 10px;">
                    <div class="pull-left" style="font-size: 15px; line-height: 32px;" v-show="!diyStore.IsPhoneView">
                        <i :class="GetOpenTitleIcon()" />
                        {{ GetOpenTitlePage() }}
                    </div>
                    <div class="form-actions pull-right" :class="{ 'mobile-form-actions': diyStore.IsPhoneView }">
                        <el-button v-if="FormMode != 'View'" :loading="SaveDiyTableCommonLoding" type="danger" :icon="SuccessFilled" @click="SaveDiyTableCommonPage(true)">
                            {{ $t("Msg.SaveBack") }}
                        </el-button>
                        <el-button v-if="FormMode == 'View' && ShowUpdateBtn" :loading="SaveDiyTableCommonLoding" type="primary" :icon="Edit" @click="GotoEdit()">
                            {{ $t("Msg.Edit") }}
                        </el-button>
                        <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                            <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns">
                                <el-button
                                    :key="'more_btn_formbtns_page_' + btnIndex"
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
                        <el-button type="default" :icon="Back" @click="Go_1()">
                            {{ $t("Msg.Back") }}
                        </el-button>
                    </div>
                </div>
                <DiyForm
                    v-if="TableId && TableRowId"
                    ref="fieldFormPage"
                    :FormMode="FormMode"
                    :LoadMode="'Page'"
                    :TableId="TableId"
                    :TableRowId="TableRowId"
                    @CallbackFormSubmit="CallbackFormSubmitPage"
                    @CallbackSetFormData="CallbackSetFormData"
                    @CallbackSetDiyTableModel="CallbackSetDiyTableModel"
                    @CallbackGetDiyField="CallbackGetDiyFieldPage"
                    @CallbackReloadForm="CallbackReloadFormPage"
                    @CallbackHideFormBtn="CallbackHideFormBtn"
                    @CallbackFormValueChange="CallbackFormValueChange"
                    
                    :FormWF="FormWF"
                    :TableChildFormMode="TableChildFormMode"
                    :TableName="TableName"
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
                    :ShowHideField="ShowHideField"
                    :DataAppend="DataAppend"
                    @ParentFormSet="ParentFormSet"
                    @CallbackRefreshTable="CallbackRefreshTable"
                    @CallbackParentFormSubmit="CallbackParentFormSubmit"
                    @CallbackFormClose="CallbackFormClose"
                />
            </div>
        </div>

        <!--以弹窗形式打开Form-->
        <el-dialog
            v-if="ShowFieldForm"
            class="diy-form-container"
            draggable
            align-center
            :width="GetOpenFormWidth()"
            :modal="true"
            :modal-append-to-body="true"
            :model-value="ShowFieldForm"
            @update:model-value="ShowFieldForm = $event"
            :close-on-click-modal="CloseFormNeedConfirm == false"
            :close-on-press-escape="CloseFormNeedConfirm == false"
            :show-close="false"
            :append-to-body="true"
            :destroy-on-close="true"
            @closed="onDialogClosed"
        >
            <template #header>
                <div class="pull-left">
                    <fa-icon :class="GetOpenTitleIcon()" />
                    {{ GetOpenTitle() }}
                </div>
                <div class="pull-right" style="display: flex;gap: 10px;align-items: center;justify-content: center;">
                    <el-dropdown
                        v-if="FormMode != 'View' && OpenDiyFormWorkFlowType.WorkType != 'StartWork' && ShowSaveBtn"
                        split-button
                        type="primary"
                        trigger="click"
                        @click="SaveDiyTableCommon(true, 'Close')"
                    >
                        <dynamic-icon :name="BtnLoading ? 'loading' : 's-help'" />
                        {{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.Save") : $t("Msg.Save") }}
                        <template #dropdown
                            ><el-dropdown-menu class="form-submit-btns">
                                <el-dropdown-item
                                    v-if="ShowFormBottomBtns.SaveAdd"
                                    :icon="BtnLoading ? undefined : 's-help'"
                                    :disabled="BtnLoading"
                                    @click="SaveDiyTableCommon(false, 'Insert')"
                                    >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddAdd") : $t("Msg.UptAdd") }}</el-dropdown-item
                                >
                                <el-dropdown-item
                                    v-if="ShowFormBottomBtns.SaveUpdate"
                                    :icon="BtnLoading ? undefined : 's-help'"
                                    :disabled="BtnLoading"
                                    @click="SaveDiyTableCommon(false, 'Update')"
                                    >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddUpdate") : $t("Msg.UptUpdate") }}</el-dropdown-item
                                >
                            </el-dropdown-menu></template
                        >
                    </el-dropdown>
                    <el-button
                        v-if="FormMode == 'View' && LimitEdit() && TableChildFormMode !== 'View' && !TableChildField.Readonly && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
                        :loading="BtnLoading"
                        :icon="Edit"
                        type="primary"
                        @click="FormMode = 'Edit'"
                        >{{ $t("Msg.Edit") }}</el-button
                    >
                    <el-button
                        v-if="
                            FormMode == 'Edit' &&
                            TableChildFormMode !== 'View' &&
                            OpenDiyFormWorkFlowType.WorkType != 'StartWork'
                        "
                        type="info"
                        icon="ArrowLeft"
                        @click="FormMode = 'View'"
                    >
                        {{ $t('Msg.Cancel') + $t('Msg.Edit') }}
                    </el-button>
                    <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                        <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns">
                            <el-button
                                :key="'more_btn_formbtns_' + btnIndex"
                                v-if="btn.IsVisible"
                                :type="GetMoreBtnStyle(btn)"
                                :loading="BtnLoading"
                                @click="RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)"
                            >
                                <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                {{ btn.Name }}
                            </el-button>
                        </template>
                    </template>
                    <el-dropdown trigger="click">
                        <el-button>
                            {{ $t("Msg.More") }}<el-icon class="el-icon--right"><arrow-down /></el-icon>
                        </el-button>
                        <template #dropdown>
                            <el-dropdown-menu class="form-submit-btns">
                                <el-dropdown-item
                                    v-if="
                                        LimitDel() &&
                                        TableChildFormMode !== 'View' &&
                                        FormMode != 'Add' &&
                                        !TableChildField.Readonly &&
                                        ShowDeleteBtn &&
                                        OpenDiyFormWorkFlowType.WorkType != 'StartWork'
                                    "
                                    :loading="BtnLoading"
                                    :icon="BtnLoading ? undefined : Delete"
                                    :disabled="BtnLoading"
                                    type="danger"
                                    @click="DelDiyTableRow(CurrentRowModel, 'ShowFieldForm')"
                                    >{{ $t("Msg.Delete") }}</el-dropdown-item
                                >
                                <el-dropdown-item 
                                    v-if="GetCurrentUser._IsAdmin" 
                                    :icon="View" 
                                    @click="ShowHideField = !ShowHideField">
                                    {{ $t("Msg.ShowHideField") }}
                                </el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                    <el-button :icon="Close" @click="CloseFieldForm('ShowFieldForm', 'Close', TableRowId)">{{ $t("Msg.Close") }}</el-button>
                </div>
            </template>
            <div class="clear">
                <div :class="ShowFormRight() ? 'el-col el-col-20' : 'el-col el-col-24'">
                    <DiyForm
                        ref="fieldForm"
                        :FormWF="FormWF"
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
                        :ShowHideField="ShowHideField"
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
                <div v-if="ShowFormRight()" class="el-col el-col-4" style="background-color: #f5f7fa; height: 100%; padding-left: 15px; padding-right: 15px">
                    <el-tabs v-model="FormRightType">
                        <el-tab-pane v-if="OpenDiyFormWorkFlow" label="流程信息" name="WorkFlow">
                            <WFHistory v-if="OpenDiyFormWorkFlowType.WorkType == 'ViewWork'" ref="refWFHistory"></WFHistory>
                            <WFWorkHandler v-if="OpenDiyFormWorkFlowType.WorkType == 'StartWork'" ref="refWfWorkHandler_2" @CallbackStartWork="CallbackStartWork"></WFWorkHandler>
                        </el-tab-pane>
                        <el-tab-pane v-if="CurrentDiyTableModel.EnableDataLog && isCheckDataLog" label="数据日志" name="DataLog">
                            <div class="datalog-timeline">
                                <el-timeline style="padding-left: 5px">
                                    <el-timeline-item
                                        v-for="item in DataLogList"
                                        :key="item.Id"
                                        :icon="$getIcon(item.Type == 'Update' ? 'edit' : 'delete')"
                                        :type="'primary'"
                                        :color="''"
                                        :size="'large'"
                                        :timestamp="item.CreateTime"
                                    >
                                        <template #dot>
                                            <el-avatar :size="'small'" :src="item.Avatar"></el-avatar>
                                        </template>
                                        <div>{{ item.Title }}</div>
                                        <div v-for="log in item.Content" :key="'datalog_content_' + log.Name" style="background-color: #e8f4ff; margin-bottom: 5px; margin-top: 5px">
                                            <span style="color: red">{{ log.Label }}</span
                                            >： {{ $t('Msg.ModifiedFrom') }} <span style="color: red">{{ log.OVal || $t('Msg.EmptyValue') }}</span> {{ $t('Msg.ModifiedTo') }}
                                            <span style="color: red">{{ log.NVal }}</span>
                                        </div>
                                    </el-timeline-item>
                                </el-timeline>
                                <div v-if="DataLogListLoading || (!DataLogListLoading && DataLogList.length == 0)" style="height: 50px; line-height: 50px">
                                    {{ DataLogListLoading ? $t('Msg.DataLoading') : $t('Msg.NoData') }}
                                </div>
                            </div>
                        </el-tab-pane>
                        <el-tab-pane v-if="CurrentDiyTableModel.EnableDataComment" :label="$t('Msg.DataComment')" name="DataComment">
                            <div style="margin-top: 10px">
                                <el-input type="textarea" :rows="4" :placeholder="$t('Msg.EnterCommentContent')" v-model="CommentContent"> </el-input>
                            </div>
                            <div style="margin-top: 10px">
                                <el-button @click="SubmitComment()" :loading="BtnLoading" type="primary" :icon="BtnLoading ? undefined : QuestionFilled">
                                    {{ $t("Msg.Submit") }}
                                </el-button>
                            </div>
                            <div class="datalog-timeline">
                                <el-timeline style="padding-left: 5px">
                                    <el-timeline-item
                                        v-for="item in DataCommentList"
                                        :key="item.Id"
                                        :icon="$getIcon(item.Type == 'Update' ? 'edit' : 'delete')"
                                        :type="'primary'"
                                        :color="''"
                                        :size="'large'"
                                        :timestamp="item.CreateTime"
                                    >
                                        <template #dot>
                                            <el-avatar :size="'small'" :src="item.Avatar"></el-avatar>
                                        </template>
                                        <div>{{ item.Title }}</div>
                                        <div style="background-color: #e8f4ff; margin-bottom: 5px; margin-top: 5px">
                                            <span v-html="item.Content"></span>
                                        </div>
                                    </el-timeline-item>
                                </el-timeline>
                                <div v-if="DataLogListLoading || (!DataCommentListLoading && DataCommentList.length == 0)" style="height: 50px; line-height: 50px">
                                    {{ DataLogListLoading ? $t('Msg.DataLoading') : $t('Msg.NoData') }}
                                </div>
                            </div>
                        </el-tab-pane>
                    </el-tabs>
                </div>
            </div>
        </el-dialog>

        <!--以抽屉形式打开Form-->
        <el-drawer
            v-if="ShowFieldFormDrawer"
            class="diy-form-container"
            style=""
            :modal="true"
            :size="GetOpenFormWidth()"
            :modal-append-to-body="true"
            :model-value="ShowFieldFormDrawer"
            @update:model-value="ShowFieldFormDrawer = $event"
            :close-on-press-escape="CloseFormNeedConfirm == false"
            :close-on-click-modal="CloseFormNeedConfirm == false"
            :show-close="false"
            :append-to-body="true"
            :destroy-on-close="true"
            @closed="onDrawerClosed"
            @opened="onDrawerOpened"
        >
            <template #header>
                <div class="pull-left" style="color: #000; font-size: 15px">
                    <fa-icon :class="GetOpenTitleIcon()" />
                    {{ GetOpenTitle() }}
                </div>
                <div class="pull-right" style="display: flex;gap: 10px;align-items: center;justify-content: center;">
                    <el-dropdown
                        v-if="FormMode != 'View' && OpenDiyFormWorkFlowType.WorkType != 'StartWork' && ShowSaveBtn"
                        split-button
                        type="primary"
                        trigger="click"
                        @click="SaveDiyTableCommon(true, 'Close')"
                    >
                        <dynamic-icon :name="BtnLoading ? 'loading' : 's-help'" />
                        {{
                            (FormMode == "Add" || FormMode == "Insert") && !DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.DiyConfig.SaveBtnText)
                                ? SysMenuModel.DiyConfig.SaveBtnText
                                : $t("Msg.Save")
                        }}
                        <template #dropdown
                            ><el-dropdown-menu class="form-submit-btns">
                                <el-dropdown-item
                                    v-if="ShowFormBottomBtns.SaveAdd"
                                    :icon="BtnLoading ? undefined : 's-help'"
                                    :disabled="BtnLoading"
                                    @click="SaveDiyTableCommon(false, 'Insert')"
                                    >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddAdd") : $t("Msg.UptAdd") }}</el-dropdown-item
                                >
                                <el-dropdown-item
                                    v-if="ShowFormBottomBtns.SaveUpdate"
                                    :icon="BtnLoading ? undefined : 's-help'"
                                    :disabled="BtnLoading"
                                    @click="SaveDiyTableCommon(false, 'Update')"
                                    >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddUpdate") : $t("Msg.UptUpdate") }}</el-dropdown-item
                                >
                                <el-dropdown-item
                                    v-if="ShowFormBottomBtns.SaveView"
                                    :icon="BtnLoading ? undefined : 's-help'"
                                    :disabled="BtnLoading"
                                    @click="SaveDiyTableCommon(false, 'View')"
                                    >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddView") : $t("Msg.UptView") }}</el-dropdown-item
                                >
                            </el-dropdown-menu></template
                        >
                    </el-dropdown>
                    <el-button
                        v-if="FormMode == 'View' && LimitEdit() && TableChildFormMode !== 'View' && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
                        :loading="BtnLoading"
                        :icon="Edit"
                        type="primary"
                        @click="FormMode = 'Edit'"
                        >{{ $t("Msg.Edit") }}</el-button
                    >
                    <el-button
                        v-if="
                            FormMode == 'Edit' &&
                            TableChildFormMode !== 'View' &&
                            OpenDiyFormWorkFlowType.WorkType != 'StartWork'
                        "
                        type="info"
                        icon="ArrowLeft"
                        @click="FormMode = 'View'"
                    >
                        {{ $t('Msg.Cancel') + $t('Msg.Edit') }}
                    </el-button>
                    <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                        <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns">
                            <el-button
                                :key="'more_btn_formbtns_' + btnIndex"
                                v-if="btn.IsVisible"
                                :type="GetMoreBtnStyle(btn)"
                                :loading="BtnLoading"
                                @click="RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)"
                            >
                                <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                {{ btn.Name }}
                            </el-button>
                        </template>
                    </template>
                    <el-dropdown trigger="click">
                        <el-button>
                            {{ $t("Msg.More") }}<el-icon class="el-icon--right"><arrow-down /></el-icon>
                        </el-button>
                        <template #dropdown>
                            <el-dropdown-menu class="form-submit-btns">
                                <el-dropdown-item
                                    v-if="
                                        LimitDel() &&
                                        TableChildFormMode !== 'View' &&
                                        FormMode != 'Add' &&
                                        !TableChildField.Readonly &&
                                        ShowDeleteBtn &&
                                        OpenDiyFormWorkFlowType.WorkType != 'StartWork'
                                    "
                                    :loading="BtnLoading"
                                    :icon="BtnLoading ? undefined : Delete"
                                    :disabled="BtnLoading"
                                    type="danger"
                                    @click="DelDiyTableRow(CurrentRowModel, 'ShowFieldForm')"
                                    >{{ $t("Msg.Delete") }}</el-dropdown-item
                                >
                                <el-dropdown-item 
                                    v-if="GetCurrentUser._IsAdmin" 
                                    :icon="View" 
                                    @click="ShowHideField = !ShowHideField">
                                    {{ $t("Msg.ShowHideField") }}
                                </el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                    <el-button :icon="Close" @click="CloseFieldForm('ShowFieldFormDrawer', 'Close', TableRowId)">{{ $t("Msg.Close") }}</el-button>
                </div>
            </template>

            <el-row class="clear" :gutter="20">
                <el-col :span="ShowFormRight() ? 20 : 24" :xs="24">
                    <DiyForm
                        ref="fieldForm"
                        :FormWF="FormWF"
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
                </el-col>
                <el-col v-if="ShowFormRight()" :span="ShowFormRight() ? 4 : 24" :xs="24" style="background-color: #f5f7fa; height: 100%; padding-left: 15px; padding-right: 15px">
                    <el-tabs v-model="FormRightType">
                        <el-tab-pane v-if="OpenDiyFormWorkFlow" :label="$t('Msg.WorkflowInfo')" name="WorkFlow">
                            <WFHistory v-if="OpenDiyFormWorkFlowType.WorkType == 'ViewWork'" ref="refWFHistory"></WFHistory>
                            <WFWorkHandler v-if="OpenDiyFormWorkFlowType.WorkType == 'StartWork'" ref="refWfWorkHandler_2" @CallbackStartWork="CallbackStartWork"></WFWorkHandler>
                        </el-tab-pane>
                        <el-tab-pane v-if="CurrentDiyTableModel.EnableDataLog && isCheckDataLog" :label="$t('Msg.DataLog')" name="DataLog">
                            <div class="datalog-timeline">
                                <el-timeline style="padding-left: 5px">
                                    <el-timeline-item
                                        v-for="item in DataLogList"
                                        :key="item.Id"
                                        :icon="$getIcon(item.Type == 'Update' ? 'edit' : 'delete')"
                                        :type="'primary'"
                                        :color="''"
                                        :size="'large'"
                                        :timestamp="item.CreateTime"
                                    >
                                        <template #dot>
                                            <el-avatar :size="'small'" :src="item.Avatar"></el-avatar>
                                        </template>
                                        <div>{{ item.Title }}</div>
                                        <div v-for="log in item.Content" :key="'datalog_content_' + log.Name" style="background-color: #e8f4ff; margin-bottom: 5px; margin-top: 5px">
                                            <span style="color: red">{{ log.Label }}</span
                                            >： {{ $t('Msg.ModifiedFrom') }} <span style="color: red">{{ log.OVal || $t('Msg.EmptyValue') }}</span> {{ $t('Msg.ModifiedTo') }}
                                            <span style="color: red">{{ log.NVal }}</span>
                                        </div>
                                    </el-timeline-item>
                                </el-timeline>
                                <div v-if="DataLogListLoading" style="height: 50px; line-height: 50px">
                                    <el-icon><Loading /></el-icon>
                                    {{ $t("Msg.Loading") }}
                                </div>
                                <div v-if="!DataLogListLoading && DataLogList.length == 0" style="height: 50px; line-height: 50px">
                                    {{ $t("Msg.NoMoreData") }}
                                </div>
                            </div>
                        </el-tab-pane>
                        <el-tab-pane v-if="CurrentDiyTableModel.EnableDataComment" :label="$t('Msg.DataComment')" name="DataComment">
                            <div style="margin-top: 10px">
                                <el-input type="textarea" :rows="4" :placeholder="$t('Msg.EnterCommentContent')" v-model="CommentContent"> </el-input>
                            </div>
                            <div style="margin-top: 10px">
                                <el-button @click="SubmitComment()" :loading="BtnLoading" type="primary" :icon="BtnLoading ? undefined : QuestionFilled">
                                    {{ $t("Msg.Submit") }}
                                </el-button>
                            </div>
                            <div class="datalog-timeline">
                                <el-timeline style="padding-left: 5px; margin-top: 20px">
                                    <el-timeline-item
                                        v-for="item in DataCommentList"
                                        :key="item.Id"
                                        :icon="$getIcon(item.Type == 'Update' ? 'edit' : 'delete')"
                                        :type="'primary'"
                                        :color="''"
                                        :size="'large'"
                                        :timestamp="item.CreateTime"
                                    >
                                        <template #dot>
                                            <el-avatar :size="'small'" :src="item.Avatar"></el-avatar>
                                        </template>
                                        <div>{{ item.Title }}</div>
                                        <div style="background-color: #e8f4ff; margin-bottom: 5px; margin-top: 5px">
                                            <span v-html="item.Content"></span>
                                        </div>
                                    </el-timeline-item>
                                </el-timeline>
                                <div v-if="DataLogListLoading || (!DataCommentListLoading && DataCommentList.length == 0)" style="height: 50px; line-height: 50px">
                                    {{ DataLogListLoading ? $t('Msg.DataLoading') : $t('Msg.NoData') }}
                                </div>
                            </div>
                        </el-tab-pane>
                    </el-tabs>
                </el-col>
            </el-row>
        </el-drawer>
    </div>
</template>

<script>
import { defineAsyncComponent, computed } from "vue";
import { useDiyStore, useTagsViewStore } from "@/pinia";
import _ from "underscore";

export default {
    name: "diy-form-full",
    directives: {},
    components: {
        DiyForm: defineAsyncComponent(() => import("@/views/form-engine/diy-form"))
    },
    setup() {
        const diyStore = useDiyStore();
        const tagsViewStore = useTagsViewStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const OsClient = computed(() => diyStore.OsClient);
        return {
            diyStore,
            tagsViewStore,
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
        },
        // ========== 表单配置参数 ==========
        // 表单默认值（从外部传入或 Init 方法设置）
        DefaultValues: {
            type: Object,
            default() {
                return {};
            }
        },
        // 指定显示的字段列表
        SelectFields: {
            type: Array,
            default() {
                return [];
            }
        },
        // 固定的标签页
        FixedTabs: {
            type: Array,
            default() {
                return [];
            }
        },
        // 隐藏的字段列表
        HideFields: {
            type: Array,
            default() {
                return [];
            }
        }
    },
    watch: {},
    computed: {
        // 判断是否为页面模式（通过路由参数判断）
        IsPageMode() {
            var self = this;
            return self.$route && self.$route.params && self.$route.params.TableId && self.$route.path.indexOf('/diy/form-page') > -1;
        },
        // 判断移动端是否有可用操作
        HasMobileActions() {
            var self = this;
            if (self.FormMode != 'View') return true;
            if (self.FormMode == 'View' && self.ShowUpdateBtn) return true;
            if (!self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig) && !self.DiyCommon.IsNull(self.SysMenuModel.FormBtns) && self.SysMenuModel.FormBtns.length > 0) {
                return self.SysMenuModel.FormBtns.some(btn => btn.IsVisible);
            }
            return false;
        }
    },
    data() {
        return {
            // ========== 打开模式 ==========
            DialogType: "", //Dialog、Drawer、Page
            Width: "",

            // ========== 表相关 ==========
            TableId: "",
            TableName: "",
            SysMenuId: "",
            SysMenuModel: {},
            TableRowId: "",
            CurrentDiyTableModel: {},

            // ========== 弹窗/抽屉控制 ==========
            ShowFieldForm: false,
            ShowFieldFormDrawer: false,
            ShowHideField: false,

            // ========== 表单状态 ==========
            CurrentRowModel: {},
            ShowDiyFieldList: null,
            DiyFieldList: [],
            FormMode: "View",
            BtnLoading: false,
            BtnV8Loading: false,
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
            DataAppend: {},

            // ========== 工作流相关 ==========
            OpenDiyFormWorkFlow: false,
            OpenDiyFormWorkFlowType: {},
            FormWF: {},
            StartWorkSubmited: false,
            FormRightType: "WorkFlow",

            // ========== 数据日志相关 ==========
            isCheckDataLog: true,
            DataLogListLoading: true,
            DataLogList: [],
            DataCommentListLoading: true,
            DataCommentList: [],
            CommentContent: "",

            // ========== 全新页面模式相关 ==========
            SaveDiyTableCommonLoding: false,
            CallbackSetFormDataFinish: false,
            CallbackSetDiyTableModelFinish: false,
            _isReloadingForm: false, // 防止 ReloadForm 死循环
            _isMounted: false, // 防止 mounted 重复执行

            // ========== 抽屉打开上下文 ==========
            _pendingDrawerContext: null
        };
    },
    async mounted() {
        var self = this;
        // 防止 mounted 被重复执行（可能由响应式数据变化触发的重新渲染导致）
        if (self._isMounted) {
            console.warn('[diy-form-full] mounted: 已经执行过，跳过重复执行');
            return;
        }
        self._isMounted = true;
        
        // 如果是页面模式（通过路由访问），则从路由参数初始化
        if (self.IsPageMode) {
            self.TableId = self.$route.params.TableId;
            self.TableRowId = self.$route.params.TableRowId;
            if (!self.TableRowId) {
                var guidResult = await self.DiyCommon.PostAsync("/api/DiyTable/NewGuid");
                if (guidResult.Code == 1) {
                    self.TableRowId = guidResult.Data;
                }
            }
            self.FormMode = self.$route.query.FormMode;
            self.SysMenuId = self.$route.query.SysMenuId;
            if (!self.TableId || !self.FormMode) {
                self.DiyCommon.Tips("缺少参数！格式：/FormMode/TableId/TableRowId", false);
                return;
            }
            // Page 模式下 DiyForm 组件通过 props 自动初始化，无需手动调用 Init()
            // 手动调用会导致与 CallbackReloadFormPage 形成死循环
        }
    },
    methods: {
        /**
         * 初始化方法（外部调用入口）
         * 必传：TableId或TableName、FormMode（Add/Edit/View）、Id（当FormMode为View或Edit时，必传Id）
         * 可传：DialogType（Dialog/Drawer/Page），若不传，则读取表单设计中配置的宽度。
         * 可传：Width宽度
         * 可传：SelectFields：['fieldName']
         * 可传：DefaultValues：{ fieldName: value } 表单默认值
         * 可传：FixedTabs：[] 固定标签页
         * 可传：HideFields：[] 隐藏字段列表
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
            
            // 设置表单相关参数，优先使用 param 传入的值，其次使用 props，最后使用默认值
            self.FieldFormSelectFields = param.SelectFields || self.SelectFields || [];
            self.FieldFormDefaultValues = param.DefaultValues || self.DefaultValues || {};
            self.FieldFormFixedTabs = param.FixedTabs || self.FixedTabs || [];
            self.FieldFormHideFields = param.HideFields || self.HideFields || [];
            
            self.ApiReplace = param.ApiReplace || {};
            self.EventReplace = param.EventReplace || {};
            self.Width = param.Width;
            self.DataAppend = param.DataAppend || {};

            var tableRowModel = {};
            // 支持Id和TableRowId两种参数名
            if (param.Id) {
                tableRowModel.Id = param.Id;
            } else if (param.TableRowId) {
                tableRowModel.Id = param.TableRowId;
            }

            var formMode = param.FormMode;
            var isDefaultOpen = param.IsDefaultOpen;

            self.$nextTick(function () {
                self.OpenDetail(tableRowModel, formMode, isDefaultOpen);
            });
        },

        // ========== 打开详情（核心方法，以diy-table.vue为准） ==========
        OpenDetail(tableRowModel, formMode, isDefaultOpen) {
            var self = this;

            self.BtnLoading = true;
            self.FormMode = formMode;
            self.ShowUpdateBtn = true;
            self.ShowDeleteBtn = true;
            self.ShowSaveBtn = true;

            self.TableRowId = self.DiyCommon.IsNull(tableRowModel) ? "" : tableRowModel.Id;
            if (self.FormMode == "Add" || self.FormMode == "Insert") {
                self.DiyCommon.Post("/api/DiyTable/NewGuid", {}, function (result) {
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
                        return self.FormSet(fieldName, value, tableRowModel);
                    },
                    GetDiyTableRow: self.GetDiyTableRow,
                    EventName: "BtnFormDetailRun"
                };
                self.SetV8DefaultValue(V8);
                await self.DiyCommon.InitV8Code(V8, self.$router);
                if (!self.DiyCommon.IsNull(self.TableRowId)) {
                    V8.Form.Id = self.TableRowId;
                }
                try {
                    await eval("(async () => {\n " + self.SysMenuModel.DetailPageV8 + " \n})()");
                } catch (error) {
                    self.DiyCommon.Tips("执行详情按钮V8代码出现错误：" + error.message, false);
                }
            } else {
                self.FieldFormSelectFields = self.FieldFormSelectFields || [];
                self.FieldFormFixedTabs = [];
            }

            // 确定打开方式
            var dialogType = "";
            if (self.DialogType) {
                dialogType = self.DialogType;
            } else if (self.CurrentDiyTableModel.FormOpenType == "Dialog") {
                dialogType = "Dialog";
            } else if (self.CurrentDiyTableModel.FormOpenType == "Page") {
                dialogType = "Page";
            } else {
                dialogType = "Drawer";
            }

            // 全新页面模式：通过路由跳转
            if (dialogType == "Page") {
                var url = "/diy/form-page/" + self.TableId;
                if (!self.DiyCommon.IsNull(tableRowModel) && !self.DiyCommon.IsNull(tableRowModel.Id)) {
                    url += "/" + tableRowModel.Id;
                }
                url += "?FormMode=" + self.FormMode;
                if (self.SysMenuId) {
                    url += "&SysMenuId=" + self.SysMenuId;
                }
                self.BtnLoading = false;
                self.$router.push(url);
                return;
            }

            // 弹窗/抽屉模式
            if (self.DiyCommon.IsNull(tableRowModel)) {
                self.CurrentRowModel = {};
            }

            //表单更多按钮默认不显示
            if (self.SysMenuModel.FormBtns && Array.isArray(self.SysMenuModel.FormBtns)) {
                self.SysMenuModel.FormBtns.forEach((btn) => {
                    btn.IsVisible = false;
                });
            }

            if (dialogType == "Dialog") {
                self.ShowFieldForm = true;
                if (window.history && window.history.pushState) {
                    $(window).on("popstate", function () {
                        //do something...
                    });
                }
                self.$nextTick(function () {
                    self.$nextTick(function () {
                        self.CloseFormNeedConfirm = false;
                        // 添加重试机制，确保ref存在
                        let retryCount = 0;
                        const maxRetries = 20;
                        const tryInit = () => {
                            if (self.$refs.fieldForm) {
                                self.$refs.fieldForm.Init(true, function (callbackValue) {
                                    if (callbackValue && callbackValue.CurrentRowModel) {
                                        self.CurrentRowModel = callbackValue.CurrentRowModel;
                                        var V8 = callbackValue.V8;
                                        self.HandlerBtns(self.SysMenuModel.FormBtns, self.CurrentRowModel, V8);
                                    }
                                    self.BtnLoading = false;
                                });
                            } else if (retryCount < maxRetries) {
                                retryCount++;
                                setTimeout(tryInit, 50);
                            } else {
                                console.error('[DiyFormFull] Dialog fieldForm ref未找到，已重试', maxRetries, '次');
                                self.BtnLoading = false;
                            }
                        };
                        tryInit();
                    });
                });
            } else {
                // Drawer模式
                self._pendingDrawerContext = {
                    formMode: formMode
                };
                self.ShowFieldFormDrawer = true;
            }
        },

        // ========== 抽屉打开动画完成后初始化表单 ==========
        onDrawerOpened() {
            var self = this;
            var formMode = self._pendingDrawerContext?.formMode;

            self.CloseFormNeedConfirm = false;

            var retryCount = 0;
            var maxRetries = 20;
            var retryInterval = 50;

            var tryInitFieldForm = function() {
                if (self.$refs.fieldForm) {
                    self.$refs.fieldForm.Init(true, function (callbackValue) {
                        if (callbackValue && callbackValue.CurrentRowModel) {
                            self.CurrentRowModel = callbackValue.CurrentRowModel;
                            var V8 = callbackValue.V8;
                            self.HandlerBtns(self.SysMenuModel.FormBtns, self.CurrentRowModel, V8);
                        }
                        self.BtnLoading = false;
                    });
                } else {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(tryInitFieldForm, retryInterval);
                    } else {
                        self.BtnLoading = false;
                        console.error('[DiyFormFull] Drawer fieldForm ref 在 ' + (maxRetries * retryInterval) + 'ms 后仍不存在');
                    }
                }
            };

            tryInitFieldForm();

            self._pendingDrawerContext = null;
        },

        // ========== 抽屉关闭动画完成后的清理 ==========
        onDrawerClosed() {
            var self = this;
            self.CurrentRowModel = {};
            self.CloseFormNeedConfirm = false;
            self._pendingDrawerContext = null;
        },

        // ========== 弹窗关闭动画完成后的清理 ==========
        onDialogClosed() {
            var self = this;
            self.CurrentRowModel = {};
            self.CloseFormNeedConfirm = false;
        },

        // ========== 获取表单宽度 ==========
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
            var title2 = "";
            var title3 = self.DiyCommon.IsNull(self.CurrentDiyTableModel) || self.DiyCommon.IsNull(self.CurrentDiyTableModel.Description) ? "" : self.CurrentDiyTableModel.Description;

            return title1 + (!self.DiyCommon.IsNull(title3) && title3 != title2 ? " - " + title3 : "");
        },

        // ========== 判断右侧面板是否显示 ==========
        ShowFormRight() {
            var self = this;
            if (self.OpenDiyFormWorkFlow) {
                return true;
            }
            if (self.CurrentDiyTableModel.EnableDataLog && self.isCheckDataLog) {
                return true;
            }
            if (self.CurrentDiyTableModel.EnableDataComment) {
                return true;
            }
            return false;
        },

        // ========== 保存表单（以diy-table.vue为准） ==========
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

            var formParam = {
                FormMode: self.FormMode,
                TableRowId: self.TableRowId,
                SavedType: savedType,
                SaveLoading: self.BtnLoading,
                Callback: param && param.Callback ? param.Callback : undefined
            };

            self.$refs.fieldForm.FormSubmit(formParam, async function (isSccuess, formData, outFormV8Result) {
                if (isSccuess === true) {
                    var formModeAfter = formParam.FormMode;
                    if (formParam.SavedType == "Update" || formParam.SavedType == "Edit") {
                        formModeAfter = "Edit";
                    } else if (formParam.SavedType == "Insert" || formParam.SavedType == "Add") {
                        formModeAfter = "Add";
                    } else if (formParam.SavedType == "View") {
                        formModeAfter = "View";
                    }

                    self.FormMode = formModeAfter;
                    self.TableRowId = formParam.TableRowId;
                    self.BtnLoading = formParam.SaveLoading;

                    if (isClose === true && outFormV8Result.Result !== false) {
                        self.ShowFieldForm = false;
                        self.ShowFieldFormDrawer = false;
                    } else {
                        //刷新子表
                        self.$refs.fieldForm.RefreshAllChildTable();
                    }

                    self.$emit("CallbackGetDiyTableRow", formParam);

                    self.$nextTick(function () {
                        if (formParam.Callback) {
                            formParam.Callback();
                        }
                    });
                } else {
                    self.BtnLoading = false;
                }
            });
        },

        // ========== 删除行 ==========
        DelDiyTableRow(rowModel, dialogId) {
            var self = this;
            var title = "";

            var fieldModel = self.ShowDiyFieldList && self.ShowDiyFieldList[0];
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
                };

                var url = self.DiyApi.DelDiyTableRow;
                if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.ApiReplace) && !self.DiyCommon.IsNull(self.CurrentDiyTableModel.ApiReplace.Delete)) {
                    url = self.DiyCommon.RepalceUrlKey(self.CurrentDiyTableModel.ApiReplace.Delete);
                }
                self.DiyCommon.Post(url, param, async function (result) {
                    if (self.DiyCommon.Result(result)) {
                        await self.FormOutAction("Delete", "Delete", rowModel.Id, null, rowModel);
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

        // ========== 回调函数 ==========
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
            self.OpenDetail(row, type);
        },
        CallbackHideFormBtn(btn) {
            var self = this;
            self["Show" + btn + "Btn"] = false;
        },
        CallbackFormValueChange(field, value) {
            var self = this;
            if (self.FormMode !== "View") {
                self.CloseFormNeedConfirm = true;
            }
        },
        CallbackFormClose() {
            var self = this;
            if (self.ShowFieldForm == true) {
                self.CloseFieldForm("ShowFieldForm", "Close", self.TableRowId, true);
            } else if (self.ShowFieldFormDrawer == true) {
                self.CloseFieldForm("ShowFieldFormDrawer", "Close", self.TableRowId, true);
            }
        },

        // ========== 关闭表单 ==========
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
            if (self.$refs.fieldForm) {
                await self.$refs.fieldForm.FormOutAction(actionType, "Close", tableRowId, null);
            }

            if (self.$refs.fieldForm) {
                self.$refs.fieldForm.SetDiyTableRowModelFinish(false);
            }
            self.$nextTick(function () {
                if (self.$refs.fieldForm) {
                    self.$refs.fieldForm.Clear();
                }
                if (!self.DiyCommon.IsNull(dialogId)) {
                    self[dialogId] = false;
                }
                self.$nextTick(function () {
                    self.CurrentRowModel = {};
                    self.CloseFormNeedConfirm = false;
                });
            });
        },

        // ========== 权限判断 ==========
        LimitDel() {
            var self = this;
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

        // ========== 按钮处理（以diy-table.vue为准） ==========
        HandlerBtns(btns, row, v8) {
            var self = this;
            if (btns) {
                if (self.DiyCommon.IsNull(row)) {
                    row = {};
                }
                btns.forEach((btn) => {
                    var isVisible = self.LimitMoreBtn(btn, row, v8);
                    btn.IsVisible = isVisible;
                });
            }
        },
        LimitMoreBtn(btn, row, v8) {
            var self = this;
            var V8 = v8 ? v8 : {};
            V8.Result = null;
            if (row && v8) {
                row._V8 = v8;
            }
            try {
                if (!self.DiyCommon.IsNull(btn.V8CodeShow)) {
                    V8.Form = row;
                    V8.FormSet = (fieldName, value) => {
                        return self.FormSet(fieldName, value, row);
                    };
                    V8.OpenForm = (row, type) => {
                        return self.OpenDetail(row, type, true);
                    };
                    V8.EventName = "​V8BtnLimit";
                    self.SetV8DefaultValue(V8);
                    self.DiyCommon.InitV8Code(V8, self.$router);
                    eval(btn.V8CodeShow);
                } else {
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
            } finally {
            }
            if (V8.Result === false) {
                return false;
            }

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

        // ========== V8引擎相关 ==========
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
            V8.ReloadForm = self.CallbackReloadForm;
            V8.SearchAppend = self.SearchAppendFunc;
            V8.SearchSet = self.SetV8SearchModel;
            V8.SetV8SearchModel = self.SetV8SearchModel;
            var diyFieldList = {};
            self.DiyFieldList.forEach((element) => {
                diyFieldList[element.Name] = element;
            });
            V8.Field = diyFieldList;
            V8.ShowTableChildHideField = self.ShowTableChildHideField;
            V8.FieldSet = self.FieldSet;
            V8.CurrentTableData = self.DiyTableRowList;
            V8.FormClose = self.CallbackFormClose;
        },

        // ========== 更多按钮运行 ==========
        async RunMoreBtn(btn, row, v8) {
            var self = this;
            self.BtnV8Loading = true;
            var V8 = v8 ? v8 : {};
            try {
                if (!self.DiyCommon.IsNull(btn.V8Code)) {
                    V8.Form = self.DeleteFormProperty(row);
                    V8.FormSet = (fieldName, value) => {
                        return self.FormSet(fieldName, value, row);
                    };
                    V8.OpenForm = (row, type) => {
                        return self.OpenDetail(row, type, true);
                    };
                    V8.OpenFormWF = (row, type, wfParam) => {
                        return self.OpenDetail(row, type, true, true, wfParam);
                    };
                    V8.V8Callback = () => {
                        self.BtnV8Loading = false;
                    };
                    V8.EventName = "​V8BtnRun";
                    self.SetV8DefaultValue(V8);
                    await self.DiyCommon.InitV8Code(V8, self.$router);
                    await eval("(async () => {\n " + btn.V8Code + " \n})()");
                    if (!(btn.V8Code.indexOf("V8.V8Callback") > -1)) {
                        self.BtnV8Loading = false;
                    }
                } else {
                    self.BtnV8Loading = false;
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
                self.BtnV8Loading = false;
            } finally {
            }
        },

        // ========== 工具方法 ==========
        DeleteFormProperty(form) {
            Reflect.deleteProperty(form, "_RowMoreBtnsOut");
            Reflect.deleteProperty(form, "_RowMoreBtnsIn");
            return form;
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
        FormSet(fieldName, value, row) {
            var self = this;
            if (row) {
                row[fieldName] = value;
            } else if (self.CurrentRowModel) {
                self.CurrentRowModel[fieldName] = value;
            }
        },
        FieldSet(fieldName, attrName, value) {
            var self = this;
            self.DiyFieldList.forEach((element) => {
                if (element.Name == fieldName) {
                    element[attrName] = value;
                }
            });
        },
        ShowTableChildHideField(fieldName, fields) {
            var self = this;
            self.$emit("CallbackShowTableChildHideField", fieldName, fields);
        },
        SearchAppendFunc(val) {
            var self = this;
            // 此组件中不支持搜索追加
        },
        SetV8SearchModel(val) {
            var self = this;
            // 此组件中不支持搜索设置
        },
        GetDiyTableRow(param) {
            var self = this;
            self.$emit("CallbackGetDiyTableRow", param || {});
        },
        GetMoreBtnStyle(btn) {
            if (btn && btn.Style) {
                return btn.Style;
            }
            return "primary";
        },

        // ========== 提交评论（diy-table.vue有此功能）==========
        SubmitComment() {
            var self = this;
            if (self.DiyCommon.IsNull(self.CommentContent)) {
                self.DiyCommon.Tips(self.$t("Msg.EnterCommentContent"), false);
                return;
            }
            self.BtnLoading = true;
            self.DiyCommon.FormEngine.AddTableData(
                {
                    FormEngineKey: "mic_data_comment",
                    DataId: self.TableRowId,
                    Content: self.CommentContent,
                    TableId: self.TableId
                },
                function (result) {
                    if (result.Code == 1) {
                        self.CommentContent = "";
                        self.GetCommentList();
                    }
                    self.BtnLoading = false;
                }
            );
        },
        GetCommentList() {
            var self = this;
            self.DataCommentListLoading = true;
            self.DataCommentList = [];
            self.DiyCommon.FormEngine.GetTableData(
                {
                    FormEngineKey: "mic_data_comment",
                    _Where: [{ Name: "DataId", Value: self.TableRowId, Type: "=" }]
                },
                function (result) {
                    if (result.Code == 1) {
                        result.Data.forEach((item) => {
                            if (item.Avatar) {
                                item.Avatar = self.DiyCommon.GetServerPath(item.Avatar);
                            } else {
                                item.Avatar = self.DiyCommon.GetServerPath("./static/img/icon/personal.png");
                            }
                        });
                        self.DataCommentList = result.Data;
                    } else {
                        self.DataCommentList = [];
                    }
                    self.DataCommentListLoading = false;
                }
            );
        },

        // ========== 工作流回调（占位，外部可能通过ref调用） ==========
        CallbackStartWork() {
            var self = this;
            // 工作流回调
        },

        // ========== FormSubmitAction 和 FormOutAction 占位（由DiyForm内部处理） ==========
        async FormSubmitAction(actionType, tableRowId, rowModel) {
            var self = this;
            // 由DiyForm组件内部处理
            return null;
        },
        async FormOutAction(actionType, closeType, tableRowId, formData, rowModel) {
            var self = this;
            // 由DiyForm组件内部处理
            return null;
        },

        // ========== 全新页面模式：表单数据回调（兼容diy-form-page.vue的逻辑） ==========
        CallbackSetFormData(formData) {
            var self = this;
            self.CurrentRowModel = formData;
            self.CallbackSetFormDataFinish = true;

            if (self.SysMenuId) {
                self.DiyCommon.Post(
                    "/api/FormEngine/GetFormData-sysmenu",
                    {
                        FormEngineKey: "Sys_Menu",
                        Id: self.SysMenuId
                    },
                    async function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.DiyCommon.ForConvertSysMenu(result.Data);
                            self.SysMenuModel = result.Data;
                            await self.HandlerBtnsAsync(self.SysMenuModel.FormBtns, self.CurrentRowModel, {});
                        }
                    }
                );
            }
        },

        // ========== 页面模式专用：异步版本的HandlerBtns ==========
        async HandlerBtnsAsync(btns, row, v8) {
            var self = this;
            if (btns) {
                if (self.DiyCommon.IsNull(row)) {
                    row = {};
                }
                for (let index = 0; index < btns.length; index++) {
                    var btn = btns[index];
                    var isVisible = await self.LimitMoreBtnAsync(btn, row, v8);
                    btn.IsVisible = isVisible;
                }
            }
        },
        async LimitMoreBtnAsync(btn, row, v8) {
            var self = this;
            var V8 = v8 || {};
            V8.Result = null;
            if (row && v8) {
                row._V8 = v8;
            }
            try {
                if (!self.DiyCommon.IsNull(btn.V8CodeShow)) {
                    V8.Form = row;
                    V8.FormSet = (fieldName, value) => {
                        return self.FormSet(fieldName, value, row);
                    };
                    V8.OpenForm = (row, type) => {
                        return self.OpenDetail(row, type, true);
                    };
                    V8.EventName = "​V8BtnLimit";
                    self.SetV8DefaultValue(V8);
                    await self.DiyCommon.InitV8Code(V8, self.$router);
                    await eval("(async () => {\n " + btn.V8CodeShow + " \n})()");
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
            }
            if (V8.Result === false) {
                return false;
            }
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

        // ========== 页面模式专用方法 ==========
        Go_1() {
            var self = this;
            if (!self.diyStore.IsPhoneView) {
                self.tagsViewStore.delView(self.$route);
            }
            self.$router.go(-1);
        },
        GotoEdit() {
            var self = this;
            self.FormMode = 'Edit';
            self.$nextTick(function () {
                // FormMode变化后DiyForm会自动响应
            });
        },
        SaveDiyTableCommonPage(isBack) {
            var self = this;
            try {
                self.SaveDiyTableCommonLoding = true;

                var param = {};
                var url = self.DiyApi.AddDiyTableRow;
                if (!self.DiyCommon.IsNull(self.TableRowId)) {
                    url = self.DiyApi.UptDiyTableRow;
                    param._TableRowId = self.TableRowId;
                }
                param.FormMode = self.FormMode;
                param.SavedType = "Edit";
                self.$refs.fieldFormPage.FormSubmit(param, async function (success, formData, outFormV8Result) {
                    if (success == true) {
                        if (isBack === true && outFormV8Result.Result !== false) {
                            self.Go_1();
                        } else {
                            self.FormMode = "Edit";
                        }
                    }
                    self.SaveDiyTableCommonLoding = false;
                });
            } catch (error) {
                self.SaveDiyTableCommonLoding = false;
                throw error;
            }
        },
        CallbackFormSubmitPage(param) {
            var self = this;
            self.SaveDiyTableCommonPage(param);
        },
        CallbackGetDiyFieldPage(diyFieldList) {
            var self = this;
            self.DiyFieldList = diyFieldList;
        },
        CallbackReloadFormPage(row, type) {
            var self = this;
            // 防止死循环：如果正在重载中，直接返回
            if (self._isReloadingForm) {
                console.warn('[diy-form-full] CallbackReloadFormPage: 正在重载中，跳过本次调用以防止死循环');
                return;
            }
            
            self._isReloadingForm = true;
            if (self.$refs.fieldFormPage) {
                self.$refs.fieldFormPage.Init();
            }
            
            // 延迟重置标志，确保 Init 完成
            self.$nextTick(() => {
                setTimeout(() => {
                    self._isReloadingForm = false;
                }, 500);
            });
        },

        // ========== 页面模式专用：获取标题（带标签页标题更新） ==========
        GetOpenTitlePage() {
            var self = this;
            var result = "";
            if (self.FormMode) {
                var formMode = self.$t("Msg." + self.FormMode);
                var firstValue = "";
                if (self.FormMode == "Edit" || self.FormMode == "View") {
                    var fieldModel = self.DiyFieldList[0];
                    if (fieldModel && self.CurrentRowModel[fieldModel.Name]) {
                        firstValue = "[" + self.CurrentRowModel[fieldModel.Name] + "]";
                    }
                }
                var tableName = self.DiyCommon.IsNull(self.CurrentDiyTableModel) || self.DiyCommon.IsNull(self.CurrentDiyTableModel.Description) ? "" : " - " + self.CurrentDiyTableModel.Description;
                result = formMode + firstValue + tableName;
                if ((self.CallbackSetFormDataFinish && self.CallbackSetDiyTableModelFinish) || (self.FormMode == "Add" && self.CallbackSetDiyTableModelFinish)) {
                    var item = self.tagsViewStore.visitedViews.filter((item) => item.fullPath == self.$route.fullPath);
                    if (item.length > 0) {
                        item[0].title = result;
                    }
                }
            }
            return result;
        }
    }
};
</script>

<style lang="scss" scoped>
// 移动端表单页面样式（页面模式）
.mobile-form-page {
    padding: 0 10px !important;
    background: #f5f7fa;
    min-height: 100vh;
    padding-top: 45px !important;
    
    .el-row {
        margin: 0 !important;
    }
    
    .el-col {
        padding: 0 !important;
    }
    
    .mobile-form-header {
        // PC端头部样式（在移动端可隐藏）
        display: block;
    }
    
    .mobile-form-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
        
        .el-button {
            margin: 0 !important;
            padding: 8px 16px;
            font-size: 14px;
        }
    }
    
    :deep(.el-form) {
        padding: 10px;
        
        .el-form-item {
            margin-bottom: 16px;
        }
        
        .el-form-item__label {
            font-size: 14px;
            color: #606266;
        }
        
        .el-input,
        .el-select,
        .el-textarea {
            width: 100%;
        }
    }
}

// 表单头部默认样式（页面模式）
.form-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    background: linear-gradient(to bottom, #fafbfc 0%, #f5f7fa 100%);
    border-radius: 8px;
    padding: 8px 12px;
    border: 1px solid #e4e7ed;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    height: 32px;
}

.form-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

// 移动端顶部导航栏样式（页面模式）
.mobile-form-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #fff;
    border-bottom: 1px solid #f0f0f0;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    
    .mobile-header-left,
    .mobile-header-right {
        flex: 0 0 40px;
        display: flex;
        align-items: center;
        
        .back-icon,
        .more-icon {
            font-size: 20px;
            cursor: pointer;
            color: #333;
            
            &:active {
                opacity: 0.6;
            }
        }
    }
    
    .mobile-header-center {
        flex: 1;
        text-align: center;
        overflow: hidden;
        
        .mobile-title {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block;
        }
    }
    
    .mobile-header-right {
        justify-content: flex-end;
    }
}
</style>
