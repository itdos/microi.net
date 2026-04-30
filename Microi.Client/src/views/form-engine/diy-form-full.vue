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
                        <el-button v-if="FormMode != 'View'" :loading="SaveDiyTableCommonLoding" type="danger" :icon="SuccessFilled" @click="SaveDiyTableCommonPage(true)">
                            {{ $t("Msg.Save") }}
                        </el-button>
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
                            :dataLogList="DataLogList"
                            :dataLogListLoading="DataLogListLoading"
                            :dataCommentList="DataCommentList"
                            :dataCommentListLoading="DataCommentListLoading"
                            :btnLoading="BtnLoading"
                            @submit-comment="SubmitComment"
                            @callback-start-work="CallbackStartWork"
                        />
                    </el-col>
                </el-row>

                <!--移动端底部固定操作条（Page模式）：保存/编辑常驻在底部-->
                <div class="mobile-form-bottom-bar" v-if="diyStore.IsPhoneView && (FormMode != 'View' || (FormMode == 'View' && ShowUpdateBtn))">
                    <el-button v-if="FormMode != 'View'" :loading="SaveDiyTableCommonLoding" type="danger" :icon="SuccessFilled" class="mobile-form-bottom-btn" @click="SaveDiyTableCommonPage(true)">
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
                            <!--表单更多按钮 FormBtns-->
                            <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
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
                <!--移动端仅显示关闭按钮-->
                <div v-if="diyStore.IsPhoneView" style="display: flex;align-items: center;">
                    <el-button :icon="Close" @click="CloseFieldForm('ShowFieldForm', 'Close', TableRowId)" />
                </div>
            </template>
            <el-row class="clear" :gutter="20">
                <el-col :span="ShowFormRight() ? 20 : 24" :xs="24">
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
                <el-col v-if="ShowFormRight() && !diyStore.IsPhoneView" :span="4" style="background-color: var(--el-fill-color-light, #f5f7fa); height: 100%; padding-left: 15px; padding-right: 15px">
                    <FormRightPanel
                        ref="formRightPanel"
                        v-model="FormRightType"
                        v-model:commentContent="CommentContent"
                        :openDiyFormWorkFlow="OpenDiyFormWorkFlow"
                        :openDiyFormWorkFlowType="OpenDiyFormWorkFlowType"
                        :enableDataLog="!!(CurrentDiyTableModel.EnableDataLog && isCheckDataLog)"
                        :enableDataComment="!!CurrentDiyTableModel.EnableDataComment"
                        :dataLogList="DataLogList"
                        :dataLogListLoading="DataLogListLoading"
                        :dataCommentList="DataCommentList"
                        :dataCommentListLoading="DataCommentListLoading"
                        :btnLoading="BtnLoading"
                        @submit-comment="SubmitComment"
                        @callback-start-work="CallbackStartWork"
                    />
                </el-col>
            </el-row>

            <!--移动端底部固定操作条（Dialog模式）：保存/编辑常驻在底部-->
            <div class="mobile-form-bottom-bar" v-if="diyStore.IsPhoneView && (
                (FormMode != 'View' && ShowSaveBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork')
                || (FormMode == 'View' && LimitEdit() && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork')
            )">
                <el-button v-if="FormMode != 'View' && ShowSaveBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
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
                        <!--表单更多按钮 FormBtns-->
                        <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
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
                <!--移动端仅显示关闭按钮-->
                <div v-if="diyStore.IsPhoneView" style="display: flex;align-items: center;">
                    <el-button type="primary" :icon="Close" @click="CloseFieldForm('ShowFieldFormDrawer', 'Close', TableRowId)" />
                </div>
            </template>

            <el-row class="clear" :gutter="20">
                <el-col :span="ShowFormRight() ? 20 : 24" :xs="24">
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
                <el-col v-if="ShowFormRight() && !diyStore.IsPhoneView" :span="4" style="background-color: var(--el-fill-color-light, #f5f7fa); height: 100%; padding-left: 15px; padding-right: 15px">
                    <FormRightPanel
                        ref="formRightPanel"
                        v-model="FormRightType"
                        v-model:commentContent="CommentContent"
                        :openDiyFormWorkFlow="OpenDiyFormWorkFlow"
                        :openDiyFormWorkFlowType="OpenDiyFormWorkFlowType"
                        :enableDataLog="!!(CurrentDiyTableModel.EnableDataLog && isCheckDataLog)"
                        :enableDataComment="!!CurrentDiyTableModel.EnableDataComment"
                        :dataLogList="DataLogList"
                        :dataLogListLoading="DataLogListLoading"
                        :dataCommentList="DataCommentList"
                        :dataCommentListLoading="DataCommentListLoading"
                        :btnLoading="BtnLoading"
                        @submit-comment="SubmitComment"
                        @callback-start-work="CallbackStartWork"
                    />
                </el-col>
            </el-row>

            <!--移动端底部固定操作条（Drawer模式）：保存/编辑常驻在底部-->
            <div class="mobile-form-bottom-bar" v-if="diyStore.IsPhoneView && (
                (FormMode != 'View' && ShowSaveBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork')
                || (FormMode == 'View' && LimitEdit() && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork')
            )">
                <el-button v-if="FormMode != 'View' && ShowSaveBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
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
                        <!--表单更多按钮 FormBtns-->
                        <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
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
                :dataLogList="DataLogList"
                :dataLogListLoading="DataLogListLoading"
                :dataCommentList="DataCommentList"
                :dataCommentListLoading="DataCommentListLoading"
                :btnLoading="BtnLoading"
                :isMobileDrawer="true"
                @submit-comment="SubmitComment"
                @callback-start-work="CallbackStartWork"
            />
        </el-drawer>
    </div>
</template>

<script>
import { defineAsyncComponent, computed } from "vue";
import { useDiyStore, useTagsViewStore } from "@/pinia";
import _ from "underscore";
import { set } from "lodash";

export default {
    name: "diy-form-full",
    directives: {},
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
    watch: {
        // 监听路由变化，在页面模式下重新初始化表单
        $route: {
            handler(newRoute, oldRoute) {
                var self = this;

                // 检查是否为表单页面路由
                var isFormPageRoute = newRoute && newRoute.params && newRoute.params.TableId && newRoute.path.indexOf('/diy/form-page') > -1;

                // 只在直接页面模式下处理路由变化
                if (!self._isDirectPageMode || !isFormPageRoute) return;

                // keep-alive 停用状态下不处理路由变化，防止缓存实例干扰新实例
                if (self._isDeactivated) return;

                // 确保已经 mounted 过
                if (!self._isMounted) return;

                // 路由确实发生了变化（比较 fullPath 以包含 query 参数的变化）
                if (oldRoute && newRoute.fullPath !== oldRoute.fullPath) {
                    self.reinitPageForm();
                }
            },
            immediate: false
        }
    },
    computed: {
        // 判断是否为页面模式（通过路由参数判断 + 必须是直接访问，非嵌套子表 + 未被 keep-alive 停用）
        IsPageMode() {
            var self = this;
            // 被 keep-alive 停用的实例不应该渲染页面模式内容，防止缓存实例因路由变化重新挂载 DiyForm 导致重复请求
            if (self._isDeactivated) return false;
            // 必须同时满足：1. 路由是 form-page 路径  2. 是直接页面访问（非弹窗内的子表）
            var isFormPageRoute = self.$route && self.$route.params && self.$route.params.TableId && self.$route.path.indexOf('/diy/form-page') > -1;
            return isFormPageRoute && self._isDirectPageMode;
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
        },
        // 判断当前表单FormBtns是否有可见按钮（用于FAB菜单是否显示）
        HasVisibleFormBtns() {
            var self = this;
            if (self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig) || self.DiyCommon.IsNull(self.SysMenuModel.FormBtns) || self.SysMenuModel.FormBtns.length == 0) return false;
            return self.SysMenuModel.FormBtns.some(btn => btn.IsVisible);
        },
        // Page模式：FAB菜单是否有内容（取消编辑 / 表单更多按钮）
        HasFabMenuItemsPage() {
            var self = this;
            if (self.FormMode == 'Edit') return true;
            if (self.HasVisibleFormBtns) return true;
            return false;
        },
        // Dialog模式：FAB菜单是否有内容（取消编辑 / FormBtns / 删除）
        HasFabMenuItemsDialog() {
            var self = this;
            if (self.FormMode == 'Edit' && self.OpenDiyFormWorkFlowType.WorkType != 'StartWork') return true;
            if (self.HasVisibleFormBtns) return true;
            if (self.LimitDel && typeof self.LimitDel == 'function' && self.LimitDel()
                && self.FormMode != 'Add' && self.ShowDeleteBtn
                && self.OpenDiyFormWorkFlowType.WorkType != 'StartWork') return true;
            return false;
        },
        // Drawer模式：与Dialog相同
        HasFabMenuItemsDrawer() {
            return this.HasFabMenuItemsDialog;
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
            _isDirectPageMode: false, // 标识是否为直接通过路由访问的页面模式（非嵌套的子表弹窗）
            _isDeactivated: false, // keep-alive 停用标记，防止缓存实例响应路由变化导致重复请求

            // ========== 抽屉打开上下文 ==========
            _pendingDrawerContext: null,

            // ========== 移动端历史管理（按实例） ==========
            // 抽屉组件相关数据
            _drawerStack: [], // 存储抽屉组件实例的栈结构
            _drawerHandlers: {}, // 存储抽屉组件的处理函数映射

            // 对话框组件相关数据
            _dialogStack: [], // 存储对话框组件实例的栈结构
            _dialogHandlers: {}, // 存储对话框组件的处理函数映射

            // 全局处理函数
            _drawerGlobalHandler: null, // 抽屉组件的全局处理函数
            _dialogGlobalHandler: null, // 对话框组件的全局处理函数

            // ========== 移动端FAB ==========
            showMobileFabMenu: false,
            showMobileRightDrawer: false,
            // FAB拖拽位置（相对视口右下角的偏移，单位 px），null 表示使用默认位置
            fabPosition: null
        };
    },
    activated() {
        this._isDeactivated = false;
        // Page模式下，如果之前已保存/关闭过表单（Go_1被调用），重新激活时需要完全初始化
        if (this._isDirectPageMode && this._needsReinit) {
            this._needsReinit = false;
            this.reinitPageForm();
        }
    },
    deactivated() {
        this._isDeactivated = true;
    },
    // 🔥 关键内存修复：补齐 beforeUnmount 钩子
    // 之前缺失这个钩子，每次打开/关闭表单都会泄漏：
    //  1) 全局 popstate handler（dialog/drawer 栈）
    //  2) 大对象引用（DataLogList、DataCommentList、DiyTableRowList、SysMenuModel、FormWF、DataAppend）
    //  3) ParentV8_Data 闭包持有
    //  4) Element Plus 子组件 ref（fieldForm、refWFHistory 等）
    beforeUnmount() {
        var self = this;
        self._isDestroyed = true;

        // 1. 解除全局 popstate 监听（即使关闭逻辑没走到 onDialogClosed/onDrawerClosed 也兜底清理）
        try { self._cleanupDialogPopstate && self._cleanupDialogPopstate(); } catch (e) {}
        try { self._cleanupDrawerPopstate && self._cleanupDrawerPopstate(); } catch (e) {}

        // 2. 清理实例上挂的全局栈引用（避免与其他实例错配）
        try {
            if (window.__microi_dialog_stack && window.__microi_dialog_stack.length === 0) {
                window.__microi_dialog_stack = null;
            }
            if (window.__microi_drawer_stack && window.__microi_drawer_stack.length === 0) {
                window.__microi_drawer_stack = null;
            }
            if (typeof window.__microi_protected_count === 'number') window.__microi_protected_count = 0;
            if (typeof window.__microi_ignore_pop === 'boolean') window.__microi_ignore_pop = false;
        } catch (e) {}

        // 3. 清理大对象/数组引用（这些都是响应式的，断开能让 GC 立即回收）
        try {
            if (Array.isArray(self.DataLogList)) self.DataLogList.length = 0;
            self.DataLogList = [];
            if (Array.isArray(self.DataCommentList)) self.DataCommentList.length = 0;
            self.DataCommentList = [];
            if (Array.isArray(self.DiyTableRowList)) self.DiyTableRowList.length = 0;
            self.DiyTableRowList = [];
        } catch (e) {}

        // 4. 清理 V8/工作流相关的闭包引用
        self.ParentV8_Data = null;
        self.FormWF = null;
        self.DataAppend = null;
        self.CurrentRowModel = null;
        self.SysMenuModel = null;
        self.OpenDiyFormWorkFlowType = null;

        // 5. 主动调用子表单组件的 Clear（释放其内部 V8/字段缓存）
        try {
            var fieldForm = self.$refs && self.$refs.fieldForm;
            if (fieldForm) {
                if (Array.isArray(fieldForm)) {
                    fieldForm.forEach(function (c) { if (c && typeof c.Clear === 'function') { try { c.Clear(); } catch (e) {} } });
                } else if (typeof fieldForm.Clear === 'function') {
                    try { fieldForm.Clear(); } catch (e) {}
                }
            }
        } catch (e) {}

        // 6. 清理实例上的本地堆栈记录
        self._dialogStack = null;
        self._dialogHandlers = null;
        self._drawerStack = null;
        self._drawerHandlers = null;
        self._currentDialogInstanceIds = null;
        self._currentDrawerInstanceIds = null;
        self._dialogGlobalHandler = null;
        self._drawerGlobalHandler = null;
        self._pendingDrawerContext = null;
    },
    async mounted() {
        var self = this;
        // 防止 mounted 被重复执行（可能由响应式数据变化触发的重新渲染导致）
        if (self._isMounted) {
            console.warn('[diy-form-full] mounted: 已经执行过，跳过重复执行');
            return;
        }
        self._isMounted = true;

        // 判断是否为直接通过路由访问的页面模式
        var isFormPageRoute = self.$route && self.$route.params && self.$route.params.TableId && self.$route.path.indexOf('/diy/form-page') > -1;
        if (isFormPageRoute) {
            // 标记为直接页面访问模式
            self._isDirectPageMode = true;

            self.TableId = self.$route.params.TableId;
            self.TableRowId = self.$route.params.TableRowId;
            if (!self.TableRowId) {
                var guidResult = await self.DiyCommon.PostAsync("/api/FormEngine/NewGuid");
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

        // 加载FAB拖拽位置
        self.LoadFabPosition();
    },
    methods: {
        // ========== 移动端FAB拖拽 ==========
        LoadFabPosition() {
            try {
                var raw = localStorage.getItem('microi_fab_position_form');
                if (raw) {
                    var pos = JSON.parse(raw);
                    if (pos && typeof pos.right == 'number' && typeof pos.bottom == 'number') {
                        this.fabPosition = this.ClampFabPosition(pos.right, pos.bottom);
                    }
                }
            } catch (e) { /* ignore */ }
        },
        SaveFabPosition() {
            try {
                if (this.fabPosition) {
                    localStorage.setItem('microi_fab_position_form', JSON.stringify(this.fabPosition));
                }
            } catch (e) { /* ignore */ }
        },
        GetFabContainerStyle() {
            if (this.fabPosition) {
                return { right: this.fabPosition.right + 'px', bottom: this.fabPosition.bottom + 'px' };
            }
            return {};
        },
        // 夹紧位置：保证不被顶部/底部操作条遮挡
        ClampFabPosition(right, bottom, btnSize) {
            var size = btnSize || 54;
            var minMargin = 8;
            // 底部保留：兼顾底部操作条 + 底部安全区
            var bottomBarEl = document.querySelector('.mobile-form-bottom-bar');
            var bottomReserved = bottomBarEl && bottomBarEl.offsetHeight ? (bottomBarEl.offsetHeight + 8) : minMargin;
            var topReserved = 60; // 顶部导航预留
            var maxRight = Math.max(minMargin, window.innerWidth - size - minMargin);
            var maxBottom = Math.max(bottomReserved, window.innerHeight - size - topReserved);
            return {
                right: Math.max(minMargin, Math.min(maxRight, right)),
                bottom: Math.max(bottomReserved, Math.min(maxBottom, bottom))
            };
        },
        OnFabPointerDown(e) {
            var self = this;
            var isTouch = e.type === 'touchstart';
            if (!isTouch && e.button !== 0) return;
            var pt = isTouch ? e.touches[0] : e;
            var startX = pt.clientX, startY = pt.clientY;
            var btnEl = e.currentTarget;
            var containerEl = btnEl.closest('.mobile-fab-container');
            if (!containerEl) return;
            var rect = btnEl.getBoundingClientRect();
            var btnW = rect.width, btnH = rect.height;
            var startRight = window.innerWidth - rect.right;
            var startBottom = window.innerHeight - rect.bottom;
            var moved = false;
            var threshold = 5;
            var minMargin = 8;
            var bottomBarEl = document.querySelector('.mobile-form-bottom-bar');
            var bottomReserved = bottomBarEl && bottomBarEl.offsetHeight ? (bottomBarEl.offsetHeight + 8) : minMargin;
            var topReserved = 60;
            var maxRight = window.innerWidth - btnW - minMargin;
            var maxBottom = window.innerHeight - btnH - topReserved;
            var lastRight = startRight, lastBottom = startBottom;
            var rafId = null;

            var applyDom = function() {
                rafId = null;
                containerEl.style.right = lastRight + 'px';
                containerEl.style.bottom = lastBottom + 'px';
            };
            var moveHandler = function(ev) {
                var p = isTouch ? (ev.touches[0] || ev.changedTouches[0]) : ev;
                if (!p) return;
                var dx = p.clientX - startX;
                var dy = p.clientY - startY;
                if (!moved && Math.hypot(dx, dy) > threshold) moved = true;
                if (moved) {
                    lastRight = Math.max(minMargin, Math.min(maxRight, startRight - dx));
                    lastBottom = Math.max(bottomReserved, Math.min(maxBottom, startBottom - dy));
                    if (rafId == null) rafId = requestAnimationFrame(applyDom);
                    if (ev.cancelable) ev.preventDefault();
                }
            };
            var upHandler = function() {
                if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
                if (isTouch) {
                    document.removeEventListener('touchmove', moveHandler, { passive: false });
                    document.removeEventListener('touchend', upHandler);
                    document.removeEventListener('touchcancel', upHandler);
                } else {
                    document.removeEventListener('mousemove', moveHandler);
                    document.removeEventListener('mouseup', upHandler);
                }
                if (moved) {
                    self._fabDragJustMoved = true;
                    self.fabPosition = { right: lastRight, bottom: lastBottom };
                    self.SaveFabPosition();
                    setTimeout(function() { self._fabDragJustMoved = false; }, 50);
                }
            };
            if (isTouch) {
                document.addEventListener('touchmove', moveHandler, { passive: false });
                document.addEventListener('touchend', upHandler);
                document.addEventListener('touchcancel', upHandler);
            } else {
                document.addEventListener('mousemove', moveHandler);
                document.addEventListener('mouseup', upHandler);
            }
        },
        OnFabClick() {
            if (this._fabDragJustMoved) return;
            this.showMobileFabMenu = !this.showMobileFabMenu;
        },

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

            self.$nextTick(function () {
                self.OpenDetail(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam);
            });
        },

        // ========== 打开详情（核心方法，以diy-table.vue为准） ==========
        OpenDetail(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam) {
            var self = this;

            self.BtnLoading = true;
            self.FormMode = formMode;
            self.ShowUpdateBtn = true;
            self.ShowDeleteBtn = true;
            self.ShowSaveBtn = true;

            self.TableRowId = self.DiyCommon.IsNull(tableRowModel) ? "" : tableRowModel.Id;
            if (self.FormMode == "Add" || self.FormMode == "Insert") {
                // 2026-04-17 Fix：如果父组件（diy-table）已经调用 NewGuid 并传入了 Id，则复用，避免重复请求
                if (!self.DiyCommon.IsNull(self.TableRowId)) {
                    self.$nextTick(function () {
                        self.OpenDetailHandler(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam);
                    });
                } else {
                    self.DiyCommon.Post("/api/FormEngine/NewGuid", {}, function (result) {
                        if (self.DiyCommon.Result(result)) {
                            self.TableRowId = result.Data;
                            self.$nextTick(function () {
                                self.OpenDetailHandler(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam);
                            });
                        } else {
                            self.BtnLoading = false;
                        }
                    });
                }
            } else {
                self.$nextTick(function () {
                    self.OpenDetailHandler(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam);
                });

                // 加载数据日志（角色权限检查）
                self.isCheckDataLog = false;
                if (self.CurrentDiyTableModel && self.CurrentDiyTableModel.DataLogRole && self.CurrentDiyTableModel.DataLogRole.length > 0) {
                    var DataLogRole = self.CurrentDiyTableModel.DataLogRole;
                    DataLogRole.forEach((item) => {
                        if (self.GetCurrentUser.RoleIds && self.GetCurrentUser.RoleIds.indexOf(item) != -1) {
                            self.isCheckDataLog = true;
                        }
                    });
                } else {
                    self.isCheckDataLog = true;
                }

                if (self.CurrentDiyTableModel.EnableDataLog && self.isCheckDataLog) {
                    self.DataLogListLoading = true;
                    self.DataLogList = [];
                    self.DiyCommon.FormEngine.GetTableData(
                        {
                            FormEngineKey: "microi_datalog",
                            _Where: [{ Name: "DataId", Value: self.TableRowId, Type: "=" }]
                        },
                        function (result) {
                            if (result.Code == 1) {
                                result.Data.forEach((item) => {
                                    if (item.Content) {
                                        item.Content = JSON.parse(item.Content);
                                    } else {
                                        item.Content = [];
                                    }
                                    if (item.Avatar) {
                                        item.Avatar = self.DiyCommon.GetServerPath(item.Avatar);
                                    } else {
                                        item.Avatar = self.DiyCommon.GetServerPath("./static/img/icon/personal.png");
                                    }
                                });
                                self.DataLogList = result.Data;
                            } else {
                                self.DataLogList = [];
                            }
                            self.DataLogListLoading = false;
                        }
                    );
                }

                // 加载数据评论
                if (self.CurrentDiyTableModel.EnableDataComment) {
                    self.GetCommentList();
                }
            }
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
                                // 工作流面板初始化
                                if (isOpenWorkFlowForm == true) {
                                    if (self.DiyCommon.IsNull(wfParam)) { wfParam = { WorkType: "ViewWork" }; }
                                    wfParam.FormMode = formMode;
                                    self.InitWorkFlow(wfParam);
                                }
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
                // 2026-04-26 Anderson 修复 V8.ReloadForm bug：
                // 如果抽屉已经打开（典型场景：用户在表单V8按钮里调用 V8.ReloadForm 重载当前表单），
                // 设置 ShowFieldFormDrawer=true 不会再次触发 @opened 事件，onDrawerOpened 不会被调用，
                // 导致 fieldForm.Init() 永远不会执行，表单不会用新参数刷新。
                // 此时直接走 onDrawerOpened 的初始化逻辑即可（diy-form.vue 内部对 TableRowId/FormMode props 变化已有响应式处理）。
                var _drawerAlreadyOpen = self.ShowFieldFormDrawer === true;
                self._pendingDrawerContext = {
                    formMode: formMode,
                    isOpenWorkFlowForm: isOpenWorkFlowForm,
                    wfParam: wfParam
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

        // ========== 抽屉打开动画完成后初始化表单 ==========
        onDrawerOpened() {
            var self = this;
            var formMode = self._pendingDrawerContext?.formMode;
            var isOpenWorkFlowForm = self._pendingDrawerContext?.isOpenWorkFlowForm;
            var wfParam = self._pendingDrawerContext?.wfParam;

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
                    // 工作流面板初始化
                    if (isOpenWorkFlowForm == true) {
                        if (self.DiyCommon.IsNull(wfParam)) { wfParam = { WorkType: "ViewWork" }; }
                        wfParam.FormMode = formMode;
                        self.InitWorkFlow(wfParam);
                    }
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
            self.showMobileFabMenu = false;
            self.CurrentRowModel = {};
            self.CloseFormNeedConfirm = false;
            self._pendingDrawerContext = null;
            self.OpenDiyFormWorkFlow = false;
            self.OpenDiyFormWorkFlowType = {};
            self.StartWorkSubmited = false;
            // 清理移动端返回键拦截
            self._cleanupDrawerPopstate();
        },

        // ========== 弹窗关闭动画完成后的清理 ==========
        onDialogClosed() {
            var self = this;
            self.showMobileFabMenu = false;
            self.CurrentRowModel = {};
            self.CloseFormNeedConfirm = false;
            self.OpenDiyFormWorkFlow = false;
            self.OpenDiyFormWorkFlowType = {};
            self.StartWorkSubmited = false;
            // 清理移动端返回键拦截
            self._cleanupDialogPopstate();
        },

        // ========== 清理移动端Drawer返回键拦截 ==========
        // Fix 2026-04-28：仅在全局堆栈为空时才卸载全局 popstate 处理器与重置保护计数，
        // 否则会误伤其它仍处于打开状态的 drawer/diy-form-full 实例（嵌套或并存场景）。
        _cleanupDrawerPopstate() {
            var self = this;
            try {
                // 先把本实例残留在全局堆栈中的项移除（防御性清理；正常 close 流程已处理）
                try {
                    if (window.__microi_drawer_stack && window.__microi_drawer_stack.length) {
                        for (var i = window.__microi_drawer_stack.length - 1; i >= 0; i--) {
                            var it = window.__microi_drawer_stack[i];
                            if (it && it.owner === self) {
                                window.__microi_drawer_stack.splice(i, 1);
                            }
                        }
                    }
                } catch (e) {}
                // 仅当全局堆栈已清空时，才卸载全局处理器与重置全局保护标志
                try {
                    if (!window.__microi_drawer_stack || window.__microi_drawer_stack.length === 0) {
                        if (window.__microi_drawer_popstate_handler) {
                            try { window.removeEventListener('popstate', window.__microi_drawer_popstate_handler); } catch (e) {}
                            window.__microi_drawer_popstate_handler = null;
                        }
                        try { window.__microi_drawer_stack = []; } catch (e) {}
                        // 仅在 dialog 堆栈也为空时才重置共享的保护/忽略标志，避免影响仍打开的 dialog
                        if (!window.__microi_dialog_stack || window.__microi_dialog_stack.length === 0) {
                            try { window.__microi_protected_count = 0; } catch (e) {}
                            try { window.__microi_ignore_pop = false; } catch (e) {}
                        }
                    }
                } catch (e) {}
                // 清理本组件内的记录（仅本实例，安全）
                if (self._drawerStack) { self._drawerStack = []; }
                if (self._drawerHandlers) { self._drawerHandlers = {}; }
                if (self._currentDrawerInstanceIds) { self._currentDrawerInstanceIds = []; }
            } catch (e) {}
        },

        // ========== 清理移动端Dialog返回键拦截 ==========
        // Fix 2026-04-28：同上，避免误清空仍存活的兄弟/嵌套 dialog 实例的全局堆栈。
        _cleanupDialogPopstate() {
            var self = this;
            try {
                try {
                    if (window.__microi_dialog_stack && window.__microi_dialog_stack.length) {
                        for (var j = window.__microi_dialog_stack.length - 1; j >= 0; j--) {
                            var dit = window.__microi_dialog_stack[j];
                            if (dit && dit.owner === self) {
                                window.__microi_dialog_stack.splice(j, 1);
                            }
                        }
                    }
                } catch (e) {}
                try {
                    if (!window.__microi_dialog_stack || window.__microi_dialog_stack.length === 0) {
                        if (window.__microi_dialog_popstate_handler) {
                            try { window.removeEventListener('popstate', window.__microi_dialog_popstate_handler); } catch (e) {}
                            window.__microi_dialog_popstate_handler = null;
                        }
                        try { window.__microi_dialog_stack = []; } catch (e) {}
                        if (!window.__microi_drawer_stack || window.__microi_drawer_stack.length === 0) {
                            try { window.__microi_protected_count = 0; } catch (e) {}
                            try { window.__microi_ignore_pop = false; } catch (e) {}
                        }
                    }
                } catch (e) {}
                if (self._dialogStack) { self._dialogStack = []; }
                if (self._dialogHandlers) { self._dialogHandlers = {}; }
                if (self._currentDialogInstanceIds) { self._currentDialogInstanceIds = []; }
            } catch (e) {}
        },

        // ========== 获取表单宽度 ==========
        GetOpenFormWidth() {
            var self = this;
            if (self.diyStore.IsPhoneView) {//self.DiyCommon.GetPageBodyClientWH().Width < 768
                return "100%";
            }
            if (self.Width) {
                return self.Width;
            }

            var result = self.DiyCommon.IsNull(self.CurrentDiyTableModel.FormOpenWidth) ? "50%" : self.CurrentDiyTableModel.FormOpenWidth;
            return result;
        },

        // ========== zhy生成实例ID ==========
        _generateInstanceId(prefix) {
            var self = this;
            var t = Date.now().toString(36);
            var r = Math.random().toString(36).slice(2, 8);
            return (prefix ? prefix + '_' : '') + t + '_' + r;
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

        // ========== 关闭表单 ,zhy加了isPopstate，根据 isPopstate 决定是否回退历史，移动端不回退==========
        async CloseFieldForm(dialogId, actionType, tableRowId, isForceClose, isPopstate) {
            var self = this;
            if (self.FormMode == "View" || self.CloseFormNeedConfirm == false || isForceClose) {
                await self.CloseFieldFormHandler(dialogId, actionType, tableRowId, isPopstate);
            } else {
                self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmClose") + "？", async function () {
                    await self.CloseFieldFormHandler(dialogId, actionType, tableRowId, isPopstate);
                });
            }
        },
        async CloseFieldFormHandler(dialogId, actionType, tableRowId, isPopstate) {
            var self = this;
            // 移动端关闭Drawer时：如果是通过代码关闭（非popstate触发），需要回退pushState推入的历史记录
                        // if (dialogId === 'ShowFieldFormDrawer' && self._drawerPopstateHandler) {
                        //     // 先移除监听，避免history.back()触发的popstate再次执行关闭
                        //     window.removeEventListener('popstate', self._drawerPopstateHandler);
                        //     self._drawerPopstateHandler = null;
                        //     window.history.back();
                        // }
                        // // 移动端关闭Dialog时：同上
                        // if (dialogId === 'ShowFieldForm' && self._dialogPopstateHandler) {
                        //     window.removeEventListener('popstate', self._dialogPopstateHandler);
                        //     self._dialogPopstateHandler = null;
                        //     window.history.back();
                        // }

            // zhy如果是通过代码关闭（非 popstate 触发），需要移除对应实例的监听并回退历史
            try {
                // Drawer 模式：从全局堆栈中移除对应的项；若移除后堆栈为空，则卸载全局处理器并消费历史（programmatic close 最后一个）
                if (dialogId === 'ShowFieldFormDrawer' && self.diyStore.IsPhoneView) {
                    var myId = null;
                    try {
                        if (self._currentDrawerInstanceIds && self._currentDrawerInstanceIds.length) {
                            myId = self._currentDrawerInstanceIds.pop();
                        }
                    } catch (e) {}
                    //移除顶部抽屉
                    try {
                        if (window.__microi_drawer_stack && window.__microi_drawer_stack.length) {
                            for (var i = window.__microi_drawer_stack.length - 1; i >= 0; i--) {
                                var it = window.__microi_drawer_stack[i];
                                if (!it) { continue; }
                                if (it.owner === self || (myId && it.id === myId)) {
                                    window.__microi_drawer_stack.splice(i, 1);
                                    break;
                                }
                            }
                        }
                        if (!window.__microi_drawer_stack || window.__microi_drawer_stack.length === 0) {
                            try { if (window.__microi_drawer_popstate_handler) { window.removeEventListener('popstate', window.__microi_drawer_popstate_handler); window.__microi_drawer_popstate_handler = null; } } catch (e) {}
                            try { window.__microi_drawer_stack = []; } catch (e) {}
                            // 仅在非 popstate（即程序化）场景下，回退历史以消费先前 pushState
                            try {
                                if (!isPopstate && window.history && window.history.length) {
                                    // 程序化回退：消费一个保护计数并设忽略标志，防止由 history.back 触发的 popstate 再次关闭
                                    try { window.__microi_protected_count = Math.max(0, (window.__microi_protected_count || 0) - 1); } catch (e) {}
                                    try { window.__microi_ignore_pop = true; } catch (e) {}
                                    try { window.history.back(); } catch (e) {}
                                }
                            } catch (e) {}
                        }
                    } catch (e) {}
                }

                // Dialog 模式：同理处理全局 dialog 堆栈
                if (dialogId === 'ShowFieldForm' && self.diyStore.IsPhoneView) {
                    var myDialogId = null;
                    try {
                        if (self._currentDialogInstanceIds && self._currentDialogInstanceIds.length) {
                            myDialogId = self._currentDialogInstanceIds.pop();
                        }
                    } catch (e) {}
                    try {
                        if (window.__microi_dialog_stack && window.__microi_dialog_stack.length) {
                            for (var j = window.__microi_dialog_stack.length - 1; j >= 0; j--) {
                                var dit = window.__microi_dialog_stack[j];
                                if (!dit) { continue; }
                                if (dit.owner === self || (myDialogId && dit.id === myDialogId)) {
                                    window.__microi_dialog_stack.splice(j, 1);
                                    break;
                                }
                            }
                        }
                        if (!window.__microi_dialog_stack || window.__microi_dialog_stack.length === 0) {
                            try { if (window.__microi_dialog_popstate_handler) { window.removeEventListener('popstate', window.__microi_dialog_popstate_handler); window.__microi_dialog_popstate_handler = null; } } catch (e) {}
                            try { window.__microi_dialog_stack = []; } catch (e) {}
                            try {
                                if (!isPopstate && window.history && window.history.length) {
                                    try { window.__microi_protected_count = Math.max(0, (window.__microi_protected_count || 0) - 1); } catch (e) {}
                                    try { window.__microi_ignore_pop = true; } catch (e) {}
                                    try { window.history.back(); } catch (e) {}
                                }
                            } catch (e) {}
                        }
                    } catch (e) {}
                }
            } catch (e) {}
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

        // ========== 获取当前激活的右侧面板（PC=formRightPanel；移动端抽屉=formRightPanelMobile） ==========
        GetActiveRightPanel() {
            // 移动端时，若抽屉已渲染，优先使用移动端面板；否则回退至 PC 面板（PC 面板可能仍存在）
            if (this.diyStore.IsPhoneView) {
                if (this.$refs.formRightPanelMobile) return this.$refs.formRightPanelMobile;
            }
            return this.$refs.formRightPanel || this.$refs.formRightPanelMobile;
        },
        GetActiveWfWorkHandler() {
            var p = this.GetActiveRightPanel();
            return p && p.$refs ? p.$refs.refWfWorkHandler : null;
        },
        GetActiveWfHistory() {
            var p = this.GetActiveRightPanel();
            return p && p.$refs ? p.$refs.refWFHistory : null;
        },

        // ========== 工作流回调（发起流程按钮点击时触发） ==========
        // 单事务合并：表单保存 + StartWork 在后端单一 DbTrans 内完成（/api/WorkFlow/StartWorkWithForm）
        async CallbackStartWork(param, callback) {
            var self = this;

            try {
                var formData = self.$refs.fieldForm.GetFormData();
                var wfHandler = self.GetActiveWfWorkHandler();
                if (!wfHandler) {
                    if (callback) { callback(); }
                    return;
                }

                // 第1步：执行节点开始V8（可终止提交、修改表单值、获取审批信息）
                var v8Result = await wfHandler.RunNodeStartV8({ Form: formData });
                if (v8Result.Result === false) {
                    if (callback) { callback(); }
                    return;
                }
                if (v8Result.Form) {
                    self.$refs.fieldForm.SetFormData(v8Result.Form);
                } else {
                    v8Result.Form = formData;
                }

                var formMode = self.StartWorkSubmited == false && self.OpenDiyFormWorkFlowType.FormMode == "Add" ? "Add" : "Edit";

                // 第2步：通过 _AlternateSubmit 钩子，把"表单保存 + StartWork"合并为单事务后端调用
                var formParam = {
                    FormMode: formMode,
                    SavedType: "Edit",
                    _AlternateSubmit: wfHandler.BuildStartWorkAlternateSubmit({
                        FormData: v8Result.Form,
                        OldForm: param ? param.OldForm : null,
                        FormMode: formMode,
                        DiyFieldList: param ? param.DiyFieldList : null
                    })
                };

                self.$refs.fieldForm.FormSubmit(formParam, async function (success, formData2) {
                    if (success == true) {
                        self.StartWorkSubmited = true;
                        self.FormMode = "Edit";
                        self.OpenDiyFormWorkFlowType.FormMode = "Edit";
                        // 工作流已在事务中完成，无需再单独调用 StartWork
                        self.ShowFieldForm = false;
                        self.ShowFieldFormDrawer = false;
                        self.GetDiyTableRow();
                    }
                    if (callback) { callback(); }
                });
            } catch (error) {
                if (callback) { callback(); }
                throw error;
            }
        },

        // ========== 工作流面板初始化（从diy-table-rowlist.vue移植） ==========
        InitWorkFlow(wfParam) {
            var self = this;
            self.OpenDiyFormWorkFlowType = wfParam;
            self.FormWF = self.GetFormWF();
            if (wfParam.WorkType == "ViewWork") {
                // 获取此数据对应的最后一个流程
                if (self.FormMode != "Add" && self.FormMode != "Insert" && !self.DiyCommon.IsNull(self.TableRowId)) {
                    self.DiyCommon.GetDiyTableRowModel(
                        {
                            FormEngineKey: "WF_Work",
                            _SearchEqual: {
                                TableRowId: self.TableRowId
                            }
                        },
                        function (result) {
                            if (result.Code == 1 && !self.DiyCommon.IsNull(result.Data)) {
                                self.OpenDiyFormWorkFlow = true;
                                self.FormRightType = "WorkFlow";
                                self.FormWF = self.GetFormWF();
                                var historyParam = {
                                    CurrentFlowId: result.Data.FlowId,
                                    CurrentFlowDesignId: result.Data.FlowDesignId,
                                    CurrentNodeId: result.Data.NodeId
                                };
                                var retryCount = 0;
                                var maxRetries = 40;
                                var tryInitHistory = function () {
                                    var hist = self.GetActiveWfHistory();
                                    if (hist) {
                                        hist.Init(historyParam);
                                    } else if (retryCount < maxRetries) {
                                        retryCount++;
                                        setTimeout(tryInitHistory, 50);
                                    }
                                };
                                self.$nextTick(tryInitHistory);
                            }
                        }
                    );
                }
            } else {
                if (self.DiyCommon.IsNull(wfParam.FlowDesignId)) {
                    self.DiyCommon.Tips("未传入FlowDesignId", false);
                    return;
                }
                self.OpenDiyFormWorkFlow = true;
                self.FormRightType = "WorkFlow";
                self.FormWF = self.GetFormWF();
                // 移动端 StartWork 必须打开右抽屉，否则 WFWorkHandler 无法挂载
                if (self.diyStore.IsPhoneView) {
                    self.showMobileRightDrawer = true;
                }
                var param = {
                    CurrentFlowDesignId: wfParam.FlowDesignId,
                    OpenFormMode: wfParam.FormMode,
                    CurrentTableId: self.TableId
                };
                // 使用重试机制等待WFWorkHandler组件挂载完成
                // 因为OpenDiyFormWorkFlow刚设为true，多层v-if嵌套的组件可能需要多个tick才能完成挂载
                var retryCount = 0;
                var maxRetries = 40;
                var tryInitStartWork = function () {
                    var handler = self.GetActiveWfWorkHandler();
                    if (handler) {
                        handler.InitStartWork(param, function (callbackObj) {
                        });
                    } else if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(tryInitStartWork, 50);
                    } else {
                        console.error('[DiyFormFull] refWfWorkHandler_2 始终未挂载，已重试' + maxRetries + '次');
                    }
                };
                self.$nextTick(tryInitStartWork);
            }
        },

        // ========== 获取表单工作流状态 ==========
        GetFormWF() {
            var self = this;
            return {
                IsWF: self.OpenDiyFormWorkFlow == true,
                WorkType: self.OpenDiyFormWorkFlowType.WorkType,
                FlowDesignId: self.OpenDiyFormWorkFlowType.FlowDesignId
            };
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

        // ========== 页面模式专用方法 ==========

        /**
         * Page模式下重新初始化表单（销毁旧的 DiyForm 并重建）
         * 通过清空 TableRowId 使 v-if 条件为 false，销毁整个 DiyForm 组件树（包括子表），
         * 然后在下一个 tick 重新设置参数，触发 DiyForm 重新创建和初始化。
         */
        reinitPageForm() {
            var self = this;
            // 清空 TableRowId，通过 v-if="TableId && TableRowId" 销毁 DiyForm 组件树
            self.TableRowId = '';
            self.CallbackSetFormDataFinish = false;
            self.CallbackSetDiyTableModelFinish = false;

            self.$nextTick(function () {
                // 重新从路由参数读取
                self.TableId = self.$route.params.TableId;
                self.FormMode = self.$route.query.FormMode;
                self.SysMenuId = self.$route.query.SysMenuId;

                var newTableRowId = self.$route.params.TableRowId;
                if (newTableRowId) {
                    self.TableRowId = newTableRowId;
                } else if (self.FormMode === 'Add' || self.FormMode === 'Insert') {
                    self.DiyCommon.PostAsync("/api/FormEngine/NewGuid").then(guidResult => {
                        if (guidResult.Code == 1) {
                            self.TableRowId = guidResult.Data;
                        }
                    });
                }
            });
        },

        Go_1() {
            var self = this;
            // 标记需要重新初始化，以便 keep-alive 重新激活时能正确重置表单状态
            self._needsReinit = true;
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
    background: var(--el-fill-color-light, #f5f7fa);
    min-height: 100vh;
    padding-top: calc(45px + var(--status-bar-height, 0px)) !important;
    padding-bottom: calc(74px + env(safe-area-inset-bottom, 0px)) !important;

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
            font-size: 13px;
        }
    }

    :deep(.el-form) {
        padding: 0px;

        .el-form-item {
            margin-bottom: 16px;
        }

        .el-form-item__label {
            font-size: 13px;
            color: var(--el-text-color-regular, #606266);
        }

        .el-input,
        .el-select,
        .el-textarea {
            width: 100%;
        }
    }
}
.mobile-form-page.mini-program{
    padding-top: calc(0px + var(--status-bar-height, 0px)) !important;
}

// 表单头部默认样式（页面模式）
.form-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    background: var(--el-fill-color-light, linear-gradient(to bottom, #fafbfc 0%, #f5f7fa 100%));
    border-radius: 8px;
    padding: 8px 12px;
    border: 1px solid var(--el-border-color-lighter, #e4e7ed);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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
    padding-top: calc(12px + var(--status-bar-height, 0px));
    background: var(--el-bg-color, #fff);
    border-bottom: 1px solid var(--el-border-color-lighter, #f0f0f0);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;

    .mobile-header-left,
    .mobile-header-right {
        // flex: 0 0 40px;
        display: flex;
        align-items: center;

        .back-icon,
        .more-icon {
            font-size: 20px;
            cursor: pointer;
            color: var(--el-text-color-primary, #333);

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
            color: var(--el-text-color-primary, #333);
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

// 移动端FAB浮动操作按钮样式（Page模式）
.mobile-fab-container {
    position: fixed;
    bottom: 100px;
    right: 20px;
    z-index: 2000;
}

.mobile-fab-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 2000;
    backdrop-filter: blur(2px);
}

.mobile-fab-btn {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--color-primary, #409eff), #267be0);
    display: flex;
    justify-content: center;
    align-items: center;
    color: #fff;
    font-size: 26px;
    z-index: 2002;
    position: relative;
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.45), 0 2px 6px rgba(0, 0, 0, 0.15);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    &:active {
        transform: scale(0.92);
        box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
    }

    &.is-open {
        background: linear-gradient(135deg, #f56c6c, #e04040);
        box-shadow: 0 4px 16px rgba(245, 108, 108, 0.45), 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .mobile-fab-icon {
        font-size: 26px;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
}

.mobile-fab-menu {
    position: absolute;
    bottom: 66px;
    right: 0;
    z-index: 2001;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    padding-bottom: 4px;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    scrollbar-width: none;
    &::-webkit-scrollbar {
        display: none;
    }
}

.mobile-fab-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    animation: fabItemSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;

    &:active {
        opacity: 0.7;
        transform: scale(0.96);
    }
}

@for $i from 1 through 10 {
    .mobile-fab-menu-item:nth-child(#{$i}) {
        animation-delay: #{$i * 0.04}s;
    }
}

.mobile-fab-menu-label {
    background: var(--el-bg-color, #fff);
    color: var(--el-text-color-primary, #333);
    font-size: 13px;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: 20px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
    white-space: nowrap;
    letter-spacing: 0.3px;
}

.mobile-fab-menu-icon {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #fff;
    font-size: 16px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    flex-shrink: 0;

    &.save {
        background: linear-gradient(135deg, #f56c6c, #e04040);
    }
    &.edit {
        background: linear-gradient(135deg, #409eff, #267be0);
    }
    &.cancel {
        background: linear-gradient(135deg, #909399, #73767a);
    }
    &.v8 {
        background: linear-gradient(135deg, #409eff, #267be0);
    }
    &.delete {
        background: linear-gradient(135deg, #f56c6c, #c62828);
    }
}

@keyframes fabItemSlideUp {
    from {
        opacity: 0;
        transform: translateY(16px) scale(0.8);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.fab-overlay-enter-active {
    transition: opacity 0.25s ease;
}
.fab-overlay-leave-active {
    transition: opacity 0.2s ease;
}
.fab-overlay-enter-from,
.fab-overlay-leave-to {
    opacity: 0;
}

.fab-menu-enter-active {
    transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fab-menu-leave-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
}
.fab-menu-enter-from {
    opacity: 0;
    transform: translateY(10px) scale(0.9);
}
.fab-menu-leave-to {
    opacity: 0;
    transform: translateY(10px) scale(0.9);
}

// 移动端底部固定操作条（Page模式）
.mobile-form-bottom-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1900;
    display: flex;
    gap: 10px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
    background: var(--el-bg-color, #fff);
    border-top: 1px solid var(--el-border-color-lighter, #f0f0f0);
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);

    .mobile-form-bottom-btn {
        flex: 1;
        height: 44px;
        font-size: 15px;
        border-radius: 8px;
    }
}
</style>

<style lang="scss">
// 移动端 drawer 安全区域（不能 scoped，因为 drawer 是 append-to-body）
@media (max-width: 768px) {
    .diy-form-container.el-drawer {
        .el-drawer__header {
            padding-top: calc(10px + var(--status-bar-height, 0px));
        }

        .el-drawer__body {
            padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        }
    }
    .diy-form-container.el-dialog {
        .el-dialog__body {
            padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
        }
    }
}

// Drawer/Dialog 内移动端 FAB 样式（不能 scoped，因为 drawer/dialog 是 append-to-body）
.diy-form-container {
    .mobile-fab-container {
        position: fixed;
        bottom: 100px;
        right: 20px;
        z-index: 2000;
    }

    .mobile-fab-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.25);
        z-index: 1999;
        backdrop-filter: blur(2px);
    }

    .mobile-fab-btn {
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--color-primary, #409eff), #267be0);
        display: flex;
        justify-content: center;
        align-items: center;
        color: #fff;
        font-size: 26px;
        z-index: 2002;
        position: relative;
        box-shadow: 0 4px 16px rgba(64, 158, 255, 0.45), 0 2px 6px rgba(0, 0, 0, 0.15);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            transform: scale(0.92);
            box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
        }

        &.is-open {
            background: linear-gradient(135deg, #f56c6c, #e04040);
            box-shadow: 0 4px 16px rgba(245, 108, 108, 0.45), 0 2px 6px rgba(0, 0, 0, 0.15);
        }

        .mobile-fab-icon {
            font-size: 26px;
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
    }

    .mobile-fab-menu {
        position: absolute;
        bottom: 66px;
        right: 0;
        z-index: 2001;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        padding-bottom: 4px;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        scrollbar-width: none;
        &::-webkit-scrollbar {
            display: none;
        }
    }

    .mobile-fab-menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        animation: drawerFabItemSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;

        &:active {
            opacity: 0.7;
            transform: scale(0.96);
        }
    }

    @for $i from 1 through 10 {
        .mobile-fab-menu-item:nth-child(#{$i}) {
            animation-delay: #{$i * 0.04}s;
        }
    }

    .mobile-fab-menu-label {
        background: var(--el-bg-color, #fff);
        color: #333;
        font-size: 13px;
        font-weight: 500;
        padding: 8px 14px;
        border-radius: 20px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
        white-space: nowrap;
        letter-spacing: 0.3px;
    }

    .mobile-fab-menu-icon {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #fff;
        font-size: 16px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
        flex-shrink: 0;

        &.save { background: linear-gradient(135deg, #f56c6c, #e04040); }
        &.edit { background: linear-gradient(135deg, #409eff, #267be0); }
        &.cancel { background: linear-gradient(135deg, #909399, #73767a); }
        &.v8 { background: linear-gradient(135deg, #409eff, #267be0); }
        &.delete { background: linear-gradient(135deg, #f56c6c, #c62828); }
    }

    @keyframes drawerFabItemSlideUp {
        from { opacity: 0; transform: translateY(16px) scale(0.8); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .fab-overlay-enter-active { transition: opacity 0.25s ease; }
    .fab-overlay-leave-active { transition: opacity 0.2s ease; }
    .fab-overlay-enter-from,
    .fab-overlay-leave-to { opacity: 0; }

    .fab-menu-enter-active { transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .fab-menu-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
    .fab-menu-enter-from { opacity: 0; transform: translateY(10px) scale(0.9); }
    .fab-menu-leave-to { opacity: 0; transform: translateY(10px) scale(0.9); }

    // 移动端底部固定操作条（Dialog/Drawer模式）
    .mobile-form-bottom-bar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2050;
        display: flex;
        gap: 10px;
        padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
        background: var(--el-bg-color, #fff);
        border-top: 1px solid var(--el-border-color-lighter, #f0f0f0);
        box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);

        .mobile-form-bottom-btn {
            flex: 1;
            height: 44px;
            font-size: 15px;
            border-radius: 8px;
        }
    }
}
</style>
