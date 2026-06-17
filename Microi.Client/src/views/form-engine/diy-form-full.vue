<template>
    <div>
        <!--以全新页面形式打开Form（路由页面模式）-->
        <div v-if="IsPageMode" class="pluginPage"
            :class="{ 'mobile-form-page': diyStore.IsPhoneView, 'mini-program' : diyStore.IsMiniProgram }"
            style="margin-top: 10px;">
            <!-- 移动端顶部导航（小程序 webview 模式下隐藏，避免与小程序原生导航栏重复） -->
            <div v-if="diyStore.IsPhoneView && !diyStore.IsMiniProgram" class="mobile-form-header-bar">
                <div class="mobile-header-left">
                    <el-icon class="back-icon" @click="Go_1()">
                        <ArrowLeft />
                    </el-icon>
                </div>
                <div class="mobile-header-center">
                    <span class="mobile-title">{{ GetOpenTitlePage() }}</span>
                </div>
                <!-- <div class="mobile-header-right">
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
                                <template v-if="!DiyCommon.IsNull(SysMenuModel) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
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
                </div> -->
            </div>

            <div>
                <!--PC端表单头部操作栏（移动端改用FAB浮动按钮）-->
                <div v-if="!diyStore.IsPhoneView" class="form-header" style="margin-bottom: 5px;">
                    <div class="" style="font-size: 15px; line-height: 32px;min-width: 200px;">
                        <i :class="GetOpenTitleIcon()" />
                        {{ GetOpenTitlePage() }}
                    </div>
                    <div class="form-actions">
                        <!-- 工作流：醒目的【发起流程/处理工作】按钮（PageMode 顶部） -->
                        <el-button v-if="ShowWfTopSubmitBtn" :loading="WfSubmitting || BtnLoading" type="danger" :icon="SuccessFilled" @click="TriggerWfSubmit()">
                            {{ WfTopSubmitBtnText }}
                        </el-button>
                        <el-button v-if="FormMode != 'View' && !ShowWfTopSubmitBtn" :loading="SaveDiyTableCommonLoding" type="danger" :icon="SuccessFilled" @click="SaveDiyTableCommonPage(true)">
                            {{ $t("Msg.Save") }}
                        </el-button>
                        <el-dropdown trigger="click">
                            <el-button>
                                {{ $t("Msg.More") }}<el-icon class="el-icon--right"><arrow-down /></el-icon>
                            </el-button>
                            <template #dropdown>
                                <el-dropdown-menu class="form-submit-btns">
                                    <el-dropdown-item v-if="FormMode != 'View'" :disabled="SaveDiyTableCommonLoding || BtnLoading" @click="SaveToDraftBox">
                                        <fa-icon icon="far fa-save" class="mr-1" />
                                        保存至草稿箱
                                    </el-dropdown-item>
                                    <el-dropdown-item :disabled="DraftListLoading" @click="OpenDraftDialog">
                                        <fa-icon icon="far fa-folder-open" class="mr-1" />
                                        从草稿箱加载
                                    </el-dropdown-item>
                                </el-dropdown-menu>
                            </template>
                        </el-dropdown>
                        <el-button v-if="FormMode == 'View' && ShowUpdateBtn" :loading="SaveDiyTableCommonLoding" type="primary" :icon="Edit" @click="GotoEdit()">
                            {{ $t("Msg.Edit") }}
                        </el-button>
                        <el-button
                            v-if="FormMode == 'Edit'"
                            type="info"
                            @click="FormMode = 'View'"
                        >
                            {{ $t('Msg.Cancel')}}
                        </el-button>
                        <template v-if="!DiyCommon.IsNull(SysMenuModel) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
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
                <el-row class="page-mode-row" :gutter="20">
                    <el-col :span="ShowFormRight() && !diyStore.IsPhoneView ? 18 : 24" :xs="24">
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
                    </el-col>
                    <el-col v-if="ShowFormRight() && !diyStore.IsPhoneView" :span="6" class="page-right-col">
                        <FormRightPanel
                            ref="formRightPanel"
                            v-model="FormRightType"
                            v-model:commentContent="CommentContent"
                            :openDiyFormWorkFlow="OpenDiyFormWorkFlow"
                            :openDiyFormWorkFlowType="OpenDiyFormWorkFlowType"
                            :enableDataLog="!!(CurrentDiyTableModel.EnableDataLog && isCheckDataLog)"
                            :enableDataComment="!!CurrentDiyTableModel.EnableDataComment"
                            :enableDataVersion="!!CurrentDiyTableModel.EnableDataVersion"
                            :dataLogList="DataLogList"
                            :dataLogListLoading="DataLogListLoading"
                            :dataCommentList="DataCommentList"
                            :dataCommentListLoading="DataCommentListLoading"
                            :dataVersionList="DataVersionList"
                            :dataVersionListLoading="DataVersionListLoading"
                            :diyFieldList="DiyFieldList"
                            :replyComment="ReplyComment"
                            :btnLoading="BtnLoading"
                            :form-data="WfFormData"
                            :formMode="FormMode"
                            :hideInlineSubmit="ShowWfTopSubmitBtn"
                            @submit-comment="SubmitComment"
                            @reply-comment="StartReplyComment"
                            @cancel-reply-comment="CancelReplyComment"
                            @callback-start-work="CallbackStartWork"
                            @callback-send-work="CallbackSendWork"
                            @callback-get-form-data="CallbackGetFormData"
                            @callback-field-set="CallbackFieldSet"
                            @refresh-data-log="LoadDataLog"
                            @refresh-data-comment="LoadDataComment"
                            @refresh-data-version="LoadDataVersion"
                            @preview-data-version="PreviewDataVersion"
                            @load-data-version="LoadDataVersionToForm"
                        />
                    </el-col>
                </el-row>

                <!--移动端底部固定操作条（Page模式）：保存/编辑/发起流程常驻在底部 -->
                <div class="mobile-form-bottom-bar" v-if="diyStore.IsPhoneView && (ShowWfTopSubmitBtn || FormMode != 'View' || (FormMode == 'View' && ShowUpdateBtn))">
                    <el-button v-if="ShowWfTopSubmitBtn"
                        :loading="WfSubmitting || BtnLoading" type="danger" :icon="SuccessFilled" class="mobile-form-bottom-btn"
                        @click="TriggerWfSubmit()">
                        {{ WfTopSubmitBtnText }}
                    </el-button>
                    <el-button v-else-if="FormMode != 'View'" :loading="SaveDiyTableCommonLoding" type="danger" :icon="SuccessFilled" class="mobile-form-bottom-btn" @click="SaveDiyTableCommonPage(true)">
                        {{ $t('Msg.Save') }}
                    </el-button>
                    <el-button v-else-if="FormMode == 'View' && ShowUpdateBtn" :loading="SaveDiyTableCommonLoding" type="primary" :icon="Edit" class="mobile-form-bottom-btn" @click="GotoEdit()">
                        {{ $t('Msg.Edit') }}
                    </el-button>
                </div>

                <!--移动端FAB浮动操作按钮（Page模式）：仅放置取消编辑/更多按钮，支持拖拽-->
                <div class="mobile-fab-container" v-if="diyStore.IsPhoneView && HasFabMenuItemsPage" :style="GetFabContainerStyle()">
                    <transition name="fab-overlay">
                        <div class="mobile-fab-overlay" v-if="showMobileFabMenu" @click="showMobileFabMenu = false"></div>
                    </transition>
                    <transition name="fab-menu">
                        <div class="mobile-fab-menu" v-if="showMobileFabMenu">
                            <!--右侧信息（流程信息/数据日志/数据评论）-->
                            <div class="mobile-fab-menu-item" v-if="ShowFormRight()" @click="showMobileFabMenu = false; showMobileRightDrawer = true">
                                <div class="mobile-fab-menu-icon info"><fa-icon icon="far fa-list-alt" /></div>
                                <span class="mobile-fab-menu-label">{{ $t('Msg.WorkflowInfo') }}</span>
                            </div>
                            <!--取消编辑-->
                            <div class="mobile-fab-menu-item" v-if="FormMode == 'Edit'" @click="showMobileFabMenu = false; FormMode = 'View'">
                                <div class="mobile-fab-menu-icon cancel"><el-icon><ArrowLeft /></el-icon></div>
                                <span class="mobile-fab-menu-label">{{ $t('Msg.Cancel') + $t('Msg.Edit') }}</span>
                            </div>
                            <div class="mobile-fab-menu-item" v-if="FormMode != 'View'" @click="showMobileFabMenu = false; SaveToDraftBox()">
                                <div class="mobile-fab-menu-icon draft"><fa-icon icon="far fa-save" /></div>
                                <span class="mobile-fab-menu-label">保存至草稿箱</span>
                            </div>
                            <div class="mobile-fab-menu-item" @click="showMobileFabMenu = false; OpenDraftDialog()">
                                <div class="mobile-fab-menu-icon draft-list"><fa-icon icon="far fa-folder-open" /></div>
                                <span class="mobile-fab-menu-label">从草稿箱加载</span>
                            </div>
                            <!--表单更多按钮 FormBtns-->
                            <template v-if="!DiyCommon.IsNull(SysMenuModel) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                                <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns" :key="'fab_formbtn_' + btnIndex">
                                    <div class="mobile-fab-menu-item" v-if="btn.IsVisible" @click="showMobileFabMenu = false; RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)">
                                        <div class="mobile-fab-menu-icon v8"><fa-icon :icon="DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon" /></div>
                                        <span class="mobile-fab-menu-label">{{ btn.Name }}</span>
                                    </div>
                                </template>
                            </template>
                        </div>
                    </transition>
                    <div class="mobile-fab-btn" :class="{ 'is-open': showMobileFabMenu }"
                        @mousedown="OnFabPointerDown" @touchstart="OnFabPointerDown" @click="OnFabClick">
                        <el-icon class="mobile-fab-icon"><CloseBold v-if="showMobileFabMenu" /><MoreFilled v-else /></el-icon>
                    </div>
                </div>
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
                <div>
                    <fa-icon :class="GetOpenTitleIcon()" />
                    {{ GetOpenTitle() }}
                </div>
                <div v-if="!diyStore.IsPhoneView" style="display: flex;gap: 10px;align-items: center;justify-content: center;">
                    <!-- 工作流：醒目的【发起流程/处理工作】按钮（Dialog模式顶部） -->
                    <el-button v-if="ShowWfTopSubmitBtn" :loading="WfSubmitting || BtnLoading" type="danger" :icon="SuccessFilled" @click="TriggerWfSubmit()">
                        {{ WfTopSubmitBtnText }}
                    </el-button>
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
                            FormMode == 'Edit'
                            && TableChildFormMode !== 'View'
                            && OpenDiyFormWorkFlowType.WorkType != 'StartWork'
                            && !diyStore.IsPhoneView
                        "
                        type="info"
                        icon="ArrowLeft"
                        @click="FormMode = 'View'"
                    >
                        {{ $t('Msg.Cancel') + $t('Msg.Edit') }}
                    </el-button>
                    <template v-if="!DiyCommon.IsNull(SysMenuModel) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
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
                                <el-dropdown-item v-if="FormMode != 'View'" :disabled="BtnLoading" @click="SaveToDraftBox">
                                    <fa-icon icon="far fa-save" class="mr-1" />
                                    保存至草稿箱
                                </el-dropdown-item>
                                <el-dropdown-item :disabled="DraftListLoading" @click="OpenDraftDialog">
                                    <fa-icon icon="far fa-folder-open" class="mr-1" />
                                    从草稿箱加载
                                </el-dropdown-item>
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
                <!--移动端仅显示关闭按钮-->
                <div v-if="diyStore.IsPhoneView" style="display: flex;align-items: center;">
                    <el-button :icon="Close" @click="CloseFieldForm('ShowFieldForm', 'Close', TableRowId)" />
                </div>
            </template>
            <el-row class="clear" :gutter="20">
                <el-col :span="ShowFormRight() ? 18 : 24" :xs="24">
                    <DiyForm
                        ref="fieldForm"
                        :AutoInit="false"
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
                </el-col>
                <el-col v-if="ShowFormRight() && !diyStore.IsPhoneView" :span="6" style="background-color: var(--el-fill-color-light, #f5f7fa); height: 100%; padding-left: 15px; padding-right: 15px">
                    <FormRightPanel
                        ref="formRightPanel"
                        v-model="FormRightType"
                        v-model:commentContent="CommentContent"
                        :openDiyFormWorkFlow="OpenDiyFormWorkFlow"
                        :openDiyFormWorkFlowType="OpenDiyFormWorkFlowType"
                        :enableDataLog="!!(CurrentDiyTableModel.EnableDataLog && isCheckDataLog)"
                        :enableDataComment="!!CurrentDiyTableModel.EnableDataComment"
                        :enableDataVersion="!!CurrentDiyTableModel.EnableDataVersion"
                        :dataLogList="DataLogList"
                        :dataLogListLoading="DataLogListLoading"
                        :dataCommentList="DataCommentList"
                        :dataCommentListLoading="DataCommentListLoading"
                        :dataVersionList="DataVersionList"
                        :dataVersionListLoading="DataVersionListLoading"
                        :diyFieldList="DiyFieldList"
                        :replyComment="ReplyComment"
                        :btnLoading="BtnLoading"
                        :form-data="WfFormData"
                        :formMode="FormMode"
                        :hideInlineSubmit="ShowWfTopSubmitBtn"
                        @submit-comment="SubmitComment"
                        @reply-comment="StartReplyComment"
                        @cancel-reply-comment="CancelReplyComment"
                        @callback-start-work="CallbackStartWork"
                        @callback-send-work="CallbackSendWork"
                        @callback-get-form-data="CallbackGetFormData"
                        @callback-field-set="CallbackFieldSet"
                        @refresh-data-log="LoadDataLog"
                        @refresh-data-comment="LoadDataComment"
                        @refresh-data-version="LoadDataVersion"
                        @preview-data-version="PreviewDataVersion"
                        @load-data-version="LoadDataVersionToForm"
                    />
                </el-col>
            </el-row>

            <!--移动端底部固定操作条（Dialog模式）：保存/编辑/发起流程常驻在底部 -->
            <div class="mobile-form-bottom-bar" v-if="diyStore.IsPhoneView && (
                ShowWfTopSubmitBtn
                || (FormMode != 'View' && ShowSaveBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork')
                || (FormMode == 'View' && LimitEdit() && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork')
            )">
                <el-button v-if="ShowWfTopSubmitBtn"
                    :loading="WfSubmitting || BtnLoading" type="danger" :icon="SuccessFilled" class="mobile-form-bottom-btn"
                    @click="TriggerWfSubmit()">
                    {{ WfTopSubmitBtnText }}
                </el-button>
                <el-button v-else-if="FormMode != 'View' && ShowSaveBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
                    :loading="BtnLoading" type="danger" :icon="SuccessFilled" class="mobile-form-bottom-btn"
                    @click="SaveDiyTableCommon(true, 'Close')">
                    {{ $t('Msg.Save') }}
                </el-button>
                <el-button v-else-if="FormMode == 'View' && LimitEdit() && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
                    :loading="BtnLoading" type="primary" :icon="Edit" class="mobile-form-bottom-btn"
                    @click="FormMode = 'Edit'">
                    {{ $t('Msg.Edit') }}
                </el-button>
            </div>

            <!--移动端FAB浮动操作按钮（Dialog模式）：仅放置取消编辑/更多/删除，支持拖拽-->
            <div class="mobile-fab-container" v-if="diyStore.IsPhoneView && HasFabMenuItemsDialog" :style="GetFabContainerStyle()">
                <transition name="fab-overlay">
                    <div class="mobile-fab-overlay" v-if="showMobileFabMenu" @click="showMobileFabMenu = false"></div>
                </transition>
                <transition name="fab-menu">
                    <div class="mobile-fab-menu" v-if="showMobileFabMenu">
                        <!--右侧信息（流程信息/数据日志/数据评论）-->
                        <div class="mobile-fab-menu-item" v-if="ShowFormRight()" @click="showMobileFabMenu = false; showMobileRightDrawer = true">
                            <div class="mobile-fab-menu-icon info"><fa-icon icon="far fa-list-alt" /></div>
                            <span class="mobile-fab-menu-label">{{ $t('Msg.WorkflowInfo') }}</span>
                        </div>
                        <!--取消编辑-->
                        <div class="mobile-fab-menu-item" v-if="FormMode == 'Edit' && OpenDiyFormWorkFlowType.WorkType != 'StartWork'" @click="showMobileFabMenu = false; FormMode = 'View'">
                            <div class="mobile-fab-menu-icon cancel"><el-icon><ArrowLeft /></el-icon></div>
                            <span class="mobile-fab-menu-label">{{ $t('Msg.Cancel') + $t('Msg.Edit') }}</span>
                        </div>
                        <div class="mobile-fab-menu-item" v-if="FormMode != 'View'" @click="showMobileFabMenu = false; SaveToDraftBox()">
                            <div class="mobile-fab-menu-icon draft"><fa-icon icon="far fa-save" /></div>
                            <span class="mobile-fab-menu-label">保存至草稿箱</span>
                        </div>
                        <div class="mobile-fab-menu-item" @click="showMobileFabMenu = false; OpenDraftDialog()">
                            <div class="mobile-fab-menu-icon draft-list"><fa-icon icon="far fa-folder-open" /></div>
                            <span class="mobile-fab-menu-label">从草稿箱加载</span>
                        </div>
                        <!--表单更多按钮 FormBtns-->
                        <template v-if="!DiyCommon.IsNull(SysMenuModel) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                            <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns" :key="'dialog_fab_btn_' + btnIndex">
                                <div class="mobile-fab-menu-item" v-if="btn.IsVisible" @click="showMobileFabMenu = false; RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)">
                                    <div class="mobile-fab-menu-icon v8"><fa-icon :icon="DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon" /></div>
                                    <span class="mobile-fab-menu-label">{{ btn.Name }}</span>
                                </div>
                            </template>
                        </template>
                        <!--删除-->
                        <div class="mobile-fab-menu-item" v-if="LimitDel() && FormMode != 'Add' && ShowDeleteBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'" @click="showMobileFabMenu = false; DelDiyTableRow(CurrentRowModel, 'ShowFieldForm')">
                            <div class="mobile-fab-menu-icon delete"><el-icon><Delete /></el-icon></div>
                            <span class="mobile-fab-menu-label">{{ $t('Msg.Delete') }}</span>
                        </div>
                    </div>
                </transition>
                <div class="mobile-fab-btn" :class="{ 'is-open': showMobileFabMenu }"
                    @mousedown="OnFabPointerDown" @touchstart="OnFabPointerDown" @click="OnFabClick">
                    <el-icon class="mobile-fab-icon"><CloseBold v-if="showMobileFabMenu" /><MoreFilled v-else /></el-icon>
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
                <div style="color: var(--el-text-color-primary); font-size: 15px;min-width: 200px;">
                    <fa-icon :class="GetOpenTitleIcon()" />
                    {{ GetOpenTitle() }}
                </div>
                <div v-if="!diyStore.IsPhoneView" style="display: flex;gap: 10px;align-items: center;justify-content: center;">
                    <!-- 工作流：醒目的【发起流程/处理工作】按钮（Drawer模式顶部） -->
                    <el-button v-if="ShowWfTopSubmitBtn" :loading="WfSubmitting || BtnLoading" type="danger" :icon="SuccessFilled" @click="TriggerWfSubmit()">
                        {{ WfTopSubmitBtnText }}
                    </el-button>
                    <el-dropdown
                        v-if="FormMode != 'View' && OpenDiyFormWorkFlowType.WorkType != 'StartWork' && ShowSaveBtn"
                        split-button
                        type="primary"
                        trigger="click"
                        @click="SaveDiyTableCommon(true, 'Close')"
                    >
                        <dynamic-icon :name="BtnLoading ? 'loading' : 's-help'" />
                        {{
                            (FormMode == "Add" || FormMode == "Insert") && !DiyCommon.IsNull(SysMenuModel) && !DiyCommon.IsNull(SysMenuModel.SaveBtnText)
                                ? SysMenuModel.SaveBtnText
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
                            FormMode == 'Edit'
                            && TableChildFormMode !== 'View'
                            && OpenDiyFormWorkFlowType.WorkType != 'StartWork'
                            && !diyStore.IsPhoneView
                        "
                        type="info"
                        icon="ArrowLeft"
                        @click="FormMode = 'View'"
                    >
                        {{ $t('Msg.Cancel') + $t('Msg.Edit') }}
                    </el-button>
                    <template v-if="!DiyCommon.IsNull(SysMenuModel) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
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
                                <el-dropdown-item v-if="FormMode != 'View'" :disabled="BtnLoading" @click="SaveToDraftBox">
                                    <fa-icon icon="far fa-save" class="mr-1" />
                                    保存至草稿箱
                                </el-dropdown-item>
                                <el-dropdown-item :disabled="DraftListLoading" @click="OpenDraftDialog">
                                    <fa-icon icon="far fa-folder-open" class="mr-1" />
                                    从草稿箱加载
                                </el-dropdown-item>
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
                <!--移动端仅显示关闭按钮-->
                <div v-if="diyStore.IsPhoneView" style="display: flex;align-items: center;">
                    <el-button type="primary" :icon="Close" @click="CloseFieldForm('ShowFieldFormDrawer', 'Close', TableRowId)" />
                </div>
            </template>

            <el-row class="clear" :gutter="20">
                <el-col :span="ShowFormRight() ? 18 : 24" :xs="24">
                    <DiyForm
                        ref="fieldForm"
                        :AutoInit="false"
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
                </el-col>
                <el-col v-if="ShowFormRight() && !diyStore.IsPhoneView" :span="6" style="background-color: var(--el-fill-color-light, #f5f7fa); height: 100%; padding-left: 15px; padding-right: 15px">
                    <FormRightPanel
                        ref="formRightPanel"
                        v-model="FormRightType"
                        v-model:commentContent="CommentContent"
                        :openDiyFormWorkFlow="OpenDiyFormWorkFlow"
                        :openDiyFormWorkFlowType="OpenDiyFormWorkFlowType"
                        :enableDataLog="!!(CurrentDiyTableModel.EnableDataLog && isCheckDataLog)"
                        :enableDataComment="!!CurrentDiyTableModel.EnableDataComment"
                        :enableDataVersion="!!CurrentDiyTableModel.EnableDataVersion"
                        :dataLogList="DataLogList"
                        :dataLogListLoading="DataLogListLoading"
                        :dataCommentList="DataCommentList"
                        :dataCommentListLoading="DataCommentListLoading"
                        :dataVersionList="DataVersionList"
                        :dataVersionListLoading="DataVersionListLoading"
                        :diyFieldList="DiyFieldList"
                        :replyComment="ReplyComment"
                        :btnLoading="BtnLoading"
                        :form-data="WfFormData"
                        :formMode="FormMode"
                        :hideInlineSubmit="ShowWfTopSubmitBtn"
                        @submit-comment="SubmitComment"
                        @reply-comment="StartReplyComment"
                        @cancel-reply-comment="CancelReplyComment"
                        @callback-start-work="CallbackStartWork"
                        @callback-send-work="CallbackSendWork"
                        @callback-get-form-data="CallbackGetFormData"
                        @callback-field-set="CallbackFieldSet"
                        @refresh-data-log="LoadDataLog"
                        @refresh-data-comment="LoadDataComment"
                        @refresh-data-version="LoadDataVersion"
                        @preview-data-version="PreviewDataVersion"
                        @load-data-version="LoadDataVersionToForm"
                    />
                </el-col>
            </el-row>

            <!--移动端底部固定操作条（Drawer模式）：保存/编辑/发起流程常驻在底部 -->
            <div class="mobile-form-bottom-bar" v-if="diyStore.IsPhoneView && (
                ShowWfTopSubmitBtn
                || (FormMode != 'View' && ShowSaveBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork')
                || (FormMode == 'View' && LimitEdit() && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork')
            )">
                <el-button v-if="ShowWfTopSubmitBtn"
                    :loading="WfSubmitting || BtnLoading" type="danger" :icon="SuccessFilled" class="mobile-form-bottom-btn"
                    @click="TriggerWfSubmit()">
                    {{ WfTopSubmitBtnText }}
                </el-button>
                <el-button v-else-if="FormMode != 'View' && ShowSaveBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
                    :loading="BtnLoading" type="danger" :icon="SuccessFilled" class="mobile-form-bottom-btn"
                    @click="SaveDiyTableCommon(true, 'Close')">
                    {{ $t('Msg.Save') }}
                </el-button>
                <el-button v-else-if="FormMode == 'View' && LimitEdit() && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
                    :loading="BtnLoading" type="primary" :icon="Edit" class="mobile-form-bottom-btn"
                    @click="FormMode = 'Edit'">
                    {{ $t('Msg.Edit') }}
                </el-button>
            </div>

            <!--移动端FAB浮动操作按钮（Drawer模式）：仅放置取消编辑/更多/删除，支持拖拽-->
            <div class="mobile-fab-container" v-if="diyStore.IsPhoneView && HasFabMenuItemsDrawer" :style="GetFabContainerStyle()">
                <transition name="fab-overlay">
                    <div class="mobile-fab-overlay" v-if="showMobileFabMenu" @click="showMobileFabMenu = false"></div>
                </transition>
                <transition name="fab-menu">
                    <div class="mobile-fab-menu" v-if="showMobileFabMenu">
                        <!--右侧信息（流程信息/数据日志/数据评论）-->
                        <div class="mobile-fab-menu-item" v-if="ShowFormRight()" @click="showMobileFabMenu = false; showMobileRightDrawer = true">
                            <div class="mobile-fab-menu-icon info"><fa-icon icon="far fa-list-alt" /></div>
                            <span class="mobile-fab-menu-label">{{ $t('Msg.WorkflowInfo') }}</span>
                        </div>
                        <!--取消编辑-->
                        <div class="mobile-fab-menu-item" v-if="FormMode == 'Edit' && OpenDiyFormWorkFlowType.WorkType != 'StartWork'" @click="showMobileFabMenu = false; FormMode = 'View'">
                            <div class="mobile-fab-menu-icon cancel"><el-icon><ArrowLeft /></el-icon></div>
                            <span class="mobile-fab-menu-label">{{ $t('Msg.Cancel') + $t('Msg.Edit') }}</span>
                        </div>
                        <div class="mobile-fab-menu-item" v-if="FormMode != 'View'" @click="showMobileFabMenu = false; SaveToDraftBox()">
                            <div class="mobile-fab-menu-icon draft"><fa-icon icon="far fa-save" /></div>
                            <span class="mobile-fab-menu-label">保存至草稿箱</span>
                        </div>
                        <div class="mobile-fab-menu-item" @click="showMobileFabMenu = false; OpenDraftDialog()">
                            <div class="mobile-fab-menu-icon draft-list"><fa-icon icon="far fa-folder-open" /></div>
                            <span class="mobile-fab-menu-label">从草稿箱加载</span>
                        </div>
                        <!--表单更多按钮 FormBtns-->
                        <template v-if="!DiyCommon.IsNull(SysMenuModel) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
                            <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns" :key="'drawer_fab_btn_' + btnIndex">
                                <div class="mobile-fab-menu-item" v-if="btn.IsVisible" @click="showMobileFabMenu = false; RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)">
                                    <div class="mobile-fab-menu-icon v8"><fa-icon :icon="DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon" /></div>
                                    <span class="mobile-fab-menu-label">{{ btn.Name }}</span>
                                </div>
                            </template>
                        </template>
                        <!--删除-->
                        <div class="mobile-fab-menu-item" v-if="LimitDel() && FormMode != 'Add' && ShowDeleteBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'" @click="showMobileFabMenu = false; DelDiyTableRow(CurrentRowModel, 'ShowFieldFormDrawer')">
                            <div class="mobile-fab-menu-icon delete"><el-icon><Delete /></el-icon></div>
                            <span class="mobile-fab-menu-label">{{ $t('Msg.Delete') }}</span>
                        </div>
                    </div>
                </transition>
                <div class="mobile-fab-btn" :class="{ 'is-open': showMobileFabMenu }"
                    @mousedown="OnFabPointerDown" @touchstart="OnFabPointerDown" @click="OnFabClick">
                    <el-icon class="mobile-fab-icon"><CloseBold v-if="showMobileFabMenu" /><MoreFilled v-else /></el-icon>
                </div>
            </div>
        </el-drawer>

        <!--移动端右侧信息抽屉（流程信息/数据日志/数据评论），三种模式共用-->
        <el-drawer
            v-if="diyStore.IsPhoneView && ShowFormRight()"
            class="diy-form-right-drawer"
            :model-value="showMobileRightDrawer"
            @update:model-value="showMobileRightDrawer = $event"
            direction="rtl"
            size="92%"
            :append-to-body="true"
            :destroy-on-close="false"
            :show-close="true"
        >
            <template #header>
                <span style="font-size: 15px; font-weight: 600;">
                    <fa-icon icon="far fa-list-alt" style="margin-right: 6px;" />
                    {{ $t('Msg.WorkflowInfo') }}
                </span>
            </template>
            <FormRightPanel
                ref="formRightPanelMobile"
                v-model="FormRightType"
                v-model:commentContent="CommentContent"
                :openDiyFormWorkFlow="OpenDiyFormWorkFlow"
                :openDiyFormWorkFlowType="OpenDiyFormWorkFlowType"
                :enableDataLog="!!(CurrentDiyTableModel.EnableDataLog && isCheckDataLog)"
                :enableDataComment="!!CurrentDiyTableModel.EnableDataComment"
                :enableDataVersion="!!CurrentDiyTableModel.EnableDataVersion"
                :dataLogList="DataLogList"
                :dataLogListLoading="DataLogListLoading"
                :dataCommentList="DataCommentList"
                :dataCommentListLoading="DataCommentListLoading"
                :dataVersionList="DataVersionList"
                :dataVersionListLoading="DataVersionListLoading"
                :diyFieldList="DiyFieldList"
                :replyComment="ReplyComment"
                :btnLoading="BtnLoading"
                :form-data="WfFormData"
                :formMode="FormMode"
                :hideInlineSubmit="ShowWfTopSubmitBtn"
                :isMobileDrawer="true"
                @submit-comment="SubmitComment"
                @reply-comment="StartReplyComment"
                @cancel-reply-comment="CancelReplyComment"
                @callback-start-work="CallbackStartWork"
                @callback-send-work="CallbackSendWork"
                @callback-get-form-data="CallbackGetFormData"
                @callback-field-set="CallbackFieldSet"
                @refresh-data-log="LoadDataLog"
                @refresh-data-comment="LoadDataComment"
                @refresh-data-version="LoadDataVersion"
                @preview-data-version="PreviewDataVersion"
                @load-data-version="LoadDataVersionToForm"
            />
        </el-drawer>
        <el-dialog
            v-model="ShowDataVersionPreviewDialog"
            class="data-version-preview-dialog"
            :title="'数据版本预览 ' + ((PreviewDataVersionItem && PreviewDataVersionItem.Version) || '')"
            :width="diyStore.IsPhoneView ? '94%' : '920px'"
            append-to-body
            destroy-on-close
            @opened="ApplyDataVersionPreviewData"
        >
            <DiyForm
                v-if="ShowDataVersionPreviewDialog && TableId"
                :key="'data_version_preview_' + PreviewDataVersionKey"
                ref="fieldFormDataVersionPreview"
                :FormMode="'View'"
                :LoadMode="'DataVersionPreview'"
                :TableId="TableId"
                :TableName="TableName"
                :TableRowId="''"
                :DefaultValues="PreviewDataVersionData || {}"
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
                @CallbackGetDiyField="CallbackGetDiyFieldPreview"
                @CallbackSetDiyTableModel="CallbackSetDiyTableModel"
            />
        </el-dialog>
        <el-dialog
            v-model="ShowDraftDialog"
            class="draft-box-dialog"
            title="草稿箱"
            :width="diyStore.IsPhoneView ? '92%' : '760px'"
            append-to-body
            destroy-on-close
        >
            <div class="draft-box-toolbar">
                <div class="draft-box-heading">
                    <div class="draft-box-title">当前表单草稿</div>
                    <div class="draft-box-subtitle">{{ (CurrentDiyTableModel && (CurrentDiyTableModel.Description || CurrentDiyTableModel.Name)) || TableName }}</div>
                </div>
                <el-button size="small" :loading="DraftListLoading" @click="LoadDraftList(false)">刷新</el-button>
            </div>
            <el-skeleton v-if="DraftListLoading" :rows="4" animated />
            <el-empty v-else-if="!DraftList || DraftList.length == 0" description="暂无草稿" />
            <div v-else class="draft-box-list">
                <div
                    v-for="draft in DraftList"
                    :key="draft.Id"
                    class="draft-box-item"
                    :class="{ 'is-current': CurrentDraftId == draft.Id }"
                >
                    <div class="draft-box-main">
                        <div class="draft-box-name">
                            {{ draft.DraftName || '未命名草稿' }}
                            <el-tag v-if="CurrentDraftId == draft.Id" size="small" type="success" effect="plain">当前</el-tag>
                        </div>
                        <div class="draft-box-meta">
                            <span>{{ draft.CreateTime }}</span>
                            <span>{{ draft.FormMode || 'Edit' }}</span>
                            <span v-if="draft.TableRowId">数据：{{ draft.TableRowId }}</span>
                        </div>
                    </div>
                    <div class="draft-box-actions">
                        <el-button size="small" type="primary" @click="LoadDraftToForm(draft)">加载</el-button>
                        <el-button size="small" type="danger" text @click="DeleteDraft(draft)">删除</el-button>
                    </div>
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import { defineAsyncComponent, computed } from "vue";
import { useDiyStore, useTagsViewStore } from "@/pinia";
import _ from "underscore";
import { resolveV8ButtonVisibility, runV8ButtonVisibilityCode, runV8ButtonVisibilityCodeAsync } from "@/utils/v8-button-visibility";
import {
    diyFormFullCleanupMixin,
    diyFormFullMobileMixin,
    diyFormFullStateMixin,
    diyFormFullDialogMixin,
    diyFormFullDataMixin,
    diyFormFullWorkflowMixin,
    diyFormFullPermissionMixin
} from "./mixins";

export default {
    name: "diy-form-full",
    directives: {},
    mixins: [
        diyFormFullCleanupMixin,
        diyFormFullMobileMixin,
        diyFormFullStateMixin,
        diyFormFullDialogMixin,
        diyFormFullDataMixin,
        diyFormFullWorkflowMixin,
        diyFormFullPermissionMixin
    ],
    components: {
        DiyForm: defineAsyncComponent(() => import("@/views/form-engine/diy-form")),
        FormRightPanel: defineAsyncComponent(() => import("@/views/form-engine/form-right-panel"))
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
    // 🔥 关键内存修复：补齐 beforeUnmount 钩子
    // 之前缺失这个钩子，每次打开/关闭表单都会泄漏：
    //  1) 全局 popstate handler（dialog/drawer 栈）
    //  2) 大对象引用（DataLogList、DataCommentList、DiyTableRowList、SysMenuModel、FormWF、DataAppend）
    //  3) ParentV8_Data 闭包持有
    //  4) Element Plus 子组件 ref（fieldForm、refWFHistory 等）
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

            // 通过 Init 方法打开的表单，明确标记为非直接页面模式（即使在页面路由下也是弹窗/抽屉）
            self._isDirectPageMode = false;

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

            // 支持通过 Init 传入 ParentV8（如 V8.OpenAnyForm 调用时的上下文传递）
            if (param.ParentV8) {
                self.ParentV8_Data = param.ParentV8;
            }

            var tableRowModel = {};
            // 支持Id和TableRowId两种参数名
            if (param.Id) {
                tableRowModel.Id = param.Id;
            } else if (param.TableRowId) {
                tableRowModel.Id = param.TableRowId;
            }

            var formMode = param.FormMode;
            var isDefaultOpen = param.IsDefaultOpen;
            var isOpenWorkFlowForm = param.IsOpenWorkFlowForm;
            var wfParam = param.WFParam;

            self.$nextTick(async function () {
                if (self._isDestroyed) { return; }
                await self.EnsureSysMenuModel();
                if (self._isDestroyed) { return; }
                self.OpenDetail(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam);
            });
        },

        async OpenDetailHandler(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam) {
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

            // 工作流模式不支持Page路由跳转（路由无法传递工作流参数），强制使用Drawer
            if (dialogType == "Page" && isOpenWorkFlowForm) {
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
                var dialogOpenToken = self._beginFieldFormOpen();
                self.ShowFieldForm = true;
                 // 移动端：推入历史记录，拦截返回键关闭弹窗而非路由回退
                                // if (self.diyStore.IsPhoneView && window.history && window.history.pushState) {
                                //     window.history.pushState({ dialogOpen: true }, '');
                                //     self._dialogPopstateHandler = function () {
                                //         if (self.ShowFieldForm) {
                                //             window.removeEventListener('popstate', self._dialogPopstateHandler);
                                //             self._dialogPopstateHandler = null;
                                //             self.CloseFieldForm('ShowFieldForm', 'Close', self.TableRowId, true);
                                //         }
                                //     };
                                //     window.addEventListener('popstate', self._dialogPopstateHandler);
                                // }

                // zhy移动端：若为栈底（栈空），推入历史记录并注册单一全局 popstate 处理器；嵌套打开仅入栈
                if (self.diyStore.IsPhoneView) {
                    // 使用全局单例堆栈来管理 dialog 模式下的 popstate
                    var dialogId = self._generateInstanceId('dialog');
                    if (!self._currentDialogInstanceIds) { self._currentDialogInstanceIds = []; }
                    self._currentDialogInstanceIds.push(dialogId);

                    window.__microi_dialog_stack = window.__microi_dialog_stack || [];
                    var closeDialogFn = function (isPop) {
                        try { self.CloseFieldForm('ShowFieldForm', 'Close', self.TableRowId, true, !!isPop); } catch (e) {}
                    };
                    window.__microi_dialog_stack.push({ id: dialogId, owner: self, closeFn: closeDialogFn });

                    if (window.__microi_dialog_stack.length === 1 && window.history && window.history.pushState) {
                        try { window.history.pushState({ dialogStack: true }, ''); window.__microi_protected_count = (window.__microi_protected_count || 0) + 1; } catch (e) {}
                        if (!window.__microi_dialog_popstate_handler) {
                            window.__microi_dialog_popstate_handler = function () {
                                try {
                                    if (window.__microi_ignore_pop) { window.__microi_ignore_pop = false; return; }
                                    // 浏览器已消费一条历史，先递减计数
                                    try { window.__microi_protected_count = Math.max(0, (window.__microi_protected_count || 0) - 1); } catch (e) {}
                                    // 仅 peek 顶层项，由 CloseFieldFormHandler 负责真正移除堆栈项
                                    var item = (window.__microi_dialog_stack && window.__microi_dialog_stack.length) ? window.__microi_dialog_stack[window.__microi_dialog_stack.length - 1] : null;
                                    if (item && item.closeFn) {
                                        try { item.closeFn(true); } catch (e) {}
                                    }
                                    // 给予 CloseFieldFormHandler 一次事件循环机会去移除堆栈项，再决定是否需要重新 push 保护条目
                                    setTimeout(function () {
                                        try {
                                            if (window.__microi_dialog_stack && window.__microi_dialog_stack.length > 0 && (!window.__microi_protected_count || window.__microi_protected_count === 0) && window.history && window.history.pushState) {
                                                try { window.history.pushState({ dialogStack: true }, ''); window.__microi_protected_count = (window.__microi_protected_count || 0) + 1; } catch (e) {}
                                            }
                                        } catch (e) {}
                                    }, 0);
                                } finally {
                                    if (!window.__microi_dialog_stack || window.__microi_dialog_stack.length === 0) {
                                        try { window.removeEventListener('popstate', window.__microi_dialog_popstate_handler); } catch (e) {}
                                        window.__microi_dialog_popstate_handler = null;
                                    }
                                }
                            };
                            try { window.addEventListener('popstate', window.__microi_dialog_popstate_handler); } catch (e) {}
                        }
                    }
                }
                self._initFieldFormWhenReady({
                    token: dialogOpenToken,
                    formMode: formMode,
                    isOpenWorkFlowForm: isOpenWorkFlowForm,
                    wfParam: wfParam,
                    dialogId: 'ShowFieldForm',
                    source: 'Dialog'
                });
            } else {
                // Drawer模式
                // 2026-04-26 Anderson 修复 V8.ReloadForm bug：
                // 如果抽屉已经打开（典型场景：用户在表单V8按钮里调用 V8.ReloadForm 重载当前表单），
                // 设置 ShowFieldFormDrawer=true 不会再次触发 @opened 事件，onDrawerOpened 不会被调用，
                // 导致 fieldForm.Init() 永远不会执行，表单不会用新参数刷新。
                // 此时直接走 onDrawerOpened 的初始化逻辑即可（diy-form.vue 内部对 TableRowId/FormMode props 变化已有响应式处理）。
                var _drawerAlreadyOpen = self.ShowFieldFormDrawer === true;
                var drawerOpenToken = self._beginFieldFormOpen();
                self._pendingDrawerContext = {
                    formMode: formMode,
                    isOpenWorkFlowForm: isOpenWorkFlowForm,
                    wfParam: wfParam,
                    token: drawerOpenToken
                };
                if (_drawerAlreadyOpen) {
                    // 抽屉已打开 → 直接调用初始化逻辑（等价于 V8.ReloadForm）
                    self.$nextTick(function () {
                        self.onDrawerOpened();
                    });
                    return;
                }
                self.ShowFieldFormDrawer = true;
                // 移动端：推入历史记录，拦截返回键关闭抽屉而非路由回退
                                // if (self.diyStore.IsPhoneView && window.history && window.history.pushState) {
                                //     window.history.pushState({ drawerOpen: true }, '');
                                //     self._drawerPopstateHandler = function () {
                                //         if (self.ShowFieldFormDrawer) {
                                //             // 先清除引用，popstate已消费历史条目，CloseFieldFormHandler不需要再调history.back()
                                //             window.removeEventListener('popstate', self._drawerPopstateHandler);
                                //             self._drawerPopstateHandler = null;
                                //             self.CloseFieldForm('ShowFieldFormDrawer', 'Close', self.TableRowId, true);
                                //         }
                                //     };
                                //     window.addEventListener('popstate', self._drawerPopstateHandler);
                                // }

                // zhy移动端：若为栈底（栈空），推入历史记录并注册单一全局 popstate 处理器；嵌套打开仅入栈
                if (self.diyStore.IsPhoneView) {
                    // 使用全局单例堆栈来管理多实例情况下的 popstate
                    var drawerId = self._generateInstanceId('drawer');
                    // 保存当前实例 id，便于程序化关闭时清理对应堆栈项
                    if (!self._currentDrawerInstanceIds) { self._currentDrawerInstanceIds = []; }
                    self._currentDrawerInstanceIds.push(drawerId);

                    // 全局堆栈初始化
                    window.__microi_drawer_stack = window.__microi_drawer_stack || [];

                    // push 一个可调用的关闭函数到全局堆栈（pop 时只关闭该实例顶部）
                    var closeFn = function (isPop) {
                        try { self.CloseFieldForm('ShowFieldFormDrawer', 'Close', self.TableRowId, true, !!isPop); } catch (e) {}
                    };
                    window.__microi_drawer_stack.push({ id: drawerId, owner: self, closeFn: closeFn });

                    // 仅在全局堆栈从空到非空时推入浏览器历史并注册单例 popstate 处理器
                    if (window.__microi_drawer_stack.length === 1 && window.history && window.history.pushState) {
                        try { window.history.pushState({ drawerStack: true }, ''); window.__microi_protected_count = (window.__microi_protected_count || 0) + 1; } catch (e) {}
                        if (!window.__microi_drawer_popstate_handler) {
                            window.__microi_drawer_popstate_handler = function () {
                                try {
                                    if (window.__microi_ignore_pop) { window.__microi_ignore_pop = false; return; }
                                    // 浏览器已消费一条历史，先递减计数
                                    try { window.__microi_protected_count = Math.max(0, (window.__microi_protected_count || 0) - 1); } catch (e) {}
                                    // 仅 peek 顶层项，由 CloseFieldFormHandler 负责真正移除堆栈项
                                    var item = (window.__microi_drawer_stack && window.__microi_drawer_stack.length) ? window.__microi_drawer_stack[window.__microi_drawer_stack.length - 1] : null;
                                    if (item && item.closeFn) {
                                        try { item.closeFn(true); } catch (e) {}
                                    }
                                    // 给予 CloseFieldFormHandler 一次事件循环机会去移除堆栈项，再决定是否需要重新 push 保护条目
                                    setTimeout(function () {
                                        try {
                                            if (window.__microi_drawer_stack && window.__microi_drawer_stack.length > 0 && (!window.__microi_protected_count || window.__microi_protected_count === 0) && window.history && window.history.pushState) {
                                                try { window.history.pushState({ drawerStack: true }, ''); window.__microi_protected_count = (window.__microi_protected_count || 0) + 1; } catch (e) {}
                                            }
                                        } catch (e) {}
                                    }, 0);
                                } finally {
                                    if (!window.__microi_drawer_stack || window.__microi_drawer_stack.length === 0) {
                                        try { window.removeEventListener('popstate', window.__microi_drawer_popstate_handler); } catch (e) {}
                                        window.__microi_drawer_popstate_handler = null;
                                    }
                                }
                            };
                            try { window.addEventListener('popstate', window.__microi_drawer_popstate_handler); } catch (e) {}
                        }
                    }
                }
            }
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
            var v8CodeShowResult;
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
                    v8CodeShowResult = runV8ButtonVisibilityCode(btn.V8CodeShow, { V8, row, btn, self, v8, _ });
                } else {
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
            } finally {
            }
            var v8Visible = resolveV8ButtonVisibility(V8, v8CodeShowResult);
            if (v8Visible !== null) {
                return v8Visible;
            }

            if (self.GetCurrentUser._IsAdmin === true) {
                return true;
            }
            var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (roleLimitModel.length > 0) {
                var result = false;
                roleLimitModel.forEach((element) => {
                    // 兼容 Permission 为字符串或数组的情况
                    var permission = element.Permission;
                    if (typeof permission === 'string') {
                        try { permission = JSON.parse(permission); } catch(e) { /* 保持原字符串 */ }
                    }
                    if (Array.isArray(permission)) {
                        if (permission.includes(btn.Id)) {
                            result = true;
                        }
                    } else if (typeof permission === 'string') {
                        if (permission.indexOf(btn.Id) > -1) {
                            result = true;
                        }
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
                    var buttonRow = self.GetCurrentFormButtonRow(row);
                    V8.Form = self.DeleteFormProperty(buttonRow);
                    V8.FormSet = (fieldName, value) => {
                        return self.FormSet(fieldName, value, buttonRow);
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
        GetCurrentFormButtonRow(row) {
            var self = this;
            var currentFormData = {};
            var activeForm = null;
            if (typeof self.GetActiveFieldForm === "function") {
                activeForm = self.GetActiveFieldForm();
            } else if (self.$refs) {
                activeForm = self.$refs.fieldForm || self.$refs.fieldFormPage;
                if (Array.isArray(activeForm)) {
                    activeForm = activeForm[0];
                }
            }
            if (activeForm && typeof activeForm.GetFormData === "function") {
                currentFormData = activeForm.GetFormData() || {};
            }
            var buttonRow = {
                ...(row || {}),
                ...(currentFormData || {})
            };
            if (row && row._V8) {
                buttonRow._V8 = row._V8;
            }
            self.CurrentRowModel = {
                ...(self.CurrentRowModel || {}),
                ...buttonRow
            };
            return buttonRow;
        },
        DeleteFormProperty(form) {
            var cleanForm = {
                ...(form || {})
            };
            Reflect.deleteProperty(cleanForm, "_RowMoreBtnsOut");
            Reflect.deleteProperty(cleanForm, "_RowMoreBtnsIn");
            return cleanForm;
        },
        ParentFormSet(fieldName, value) {
            var self = this;
            self.$emit("ParentFormSet", fieldName, value);
        },
        FormSet(fieldName, value, row) {
            var self = this;
            if (row) {
                row[fieldName] = value;
            }
            if (self.CurrentRowModel) {
                self.CurrentRowModel[fieldName] = value;
            }
            var activeForm = typeof self.GetActiveFieldForm === "function" ? self.GetActiveFieldForm() : null;
            if (activeForm && typeof activeForm.SetFormData === "function") {
                activeForm.SetFormData({
                    [fieldName]: value
                });
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
        async EnsureSysMenuModel() {
            var self = this;
            if (self.DiyCommon.IsNull(self.SysMenuId)) {
                return;
            }
            if (!self.DiyCommon.IsNull(self.SysMenuModel) && self.SysMenuModel.Id == self.SysMenuId) {
                return;
            }
            var result = await self.DiyCommon.PostAsync("/api/FormEngine/GetFormData-sysmenu", {
                FormEngineKey: "Sys_Menu",
                Id: self.SysMenuId
            });
            if (self.DiyCommon.Result(result)) {
                self.DiyCommon.ForConvertSysMenu(result.Data);
                self.SysMenuModel = result.Data;
            }
        },
        CallbackSetFormData(formData) {
            var self = this;
            self.CurrentRowModel = formData;
            self.CallbackSetFormDataFinish = true;

            self.EnsureSysMenuModel().then(async function () {
                await self.HandlerBtnsAsync(self.SysMenuModel.FormBtns, self.CurrentRowModel, {});
            });
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
            var v8CodeShowResult;
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
                    v8CodeShowResult = await runV8ButtonVisibilityCodeAsync(btn.V8CodeShow, { V8, row, btn, self, v8, _ });
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
            }
            var v8Visible = resolveV8ButtonVisibility(V8, v8CodeShowResult);
            if (v8Visible !== null) {
                return v8Visible;
            }
            if (self.GetCurrentUser._IsAdmin === true) {
                return true;
            }
            var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (roleLimitModel.length > 0) {
                var result = false;
                roleLimitModel.forEach((element) => {
                    // 兼容 Permission 为字符串或数组的情况
                    var permission = element.Permission;
                    if (typeof permission === 'string') {
                        try { permission = JSON.parse(permission); } catch(e) { /* 保持原字符串 */ }
                    }
                    if (Array.isArray(permission)) {
                        if (permission.includes(btn.Id)) {
                            result = true;
                        }
                    } else if (typeof permission === 'string') {
                        if (permission.indexOf(btn.Id) > -1) {
                            result = true;
                        }
                    }
                });
                return result;
            }
            return false;
        },

}
};
</script>

<style lang="scss" scoped src="./styles/diy-form-full.scoped.scss"></style>

<style lang="scss" src="./styles/diy-form-full.global.scss"></style>
