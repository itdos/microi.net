<template>
    <div
        id="diy-table"
        :class="'diy-table pluginPage ' + ContainerClass + (_IsTableChild ? ` diy-child-table diy-child-table-${TableChildTableId}` : '')"
        :style="{
            padding: _IsTableChild ? '0px' : '0px',
            paddingTop : (_IsTableChild || diyStore.IsPhoneView) ? '0px' : '0px' }"
    >
        <!-- type="border-card" -->
        <!-- 设备tabs(设备、服务数据) -->
        <el-tabs
            id="table-rowlist-tabs"
            v-model="TableRowListActiveTab"
            @tab-click="tabClickRowList"
            :class="(!IsPageTabs() ? 'table-rowlist-tabs tab-pane-hide' : 'table-rowlist-tabs box-card-top-tabs')
                + (diyStore.IsMiniProgram ? ' mini-program' : '')"
        >
            <!-- 之前是使用GetPageTabs()，使用改成了预渲染  -->
            <template v-for="(tab, tabIndex) in SysMenuModel.PageTabs" :key="TypeFieldName + 'page_tabs_' + tab.Id + tabIndex">
                <el-tab-pane v-if="tab.IsVisible" :name="tab.Id" :lazy="true">
                    <template #label>
                       <span
                            :style="{
                                color: TableRowListActiveTab !== tab.Id ? ' var(--el-text-color-regular, #606266) !important' : ''
                            }"
                        >
                            <i
                                :class="DiyCommon.IsNull(tab.Icon) ? 'fas fa-list-ol marginRight5' : tab.Icon + ' marginRight5'"
                                :style="{
                                    color: TableRowListActiveTab !== tab.Id ? ' var(--el-text-color-regular, #606266) !important' : ''
                                }"
                            />
                            {{ tab.Name }}
                        </span>
                    </template>
                    <!--原先<el-row>是放在这里的，后面移出去了-->
                </el-tab-pane>
            </template>
            <!--DIY子表-->
            <el-card :class="'box-card box-card-table-row-list' + ((diyStore.IsPhoneView || TableDisplayMode == 'Card') ? ' mobile-box-card' : '')">


                <!-- 移动端顶部导航（小程序 webview 模式下隐藏，避免与小程序原生导航栏重复） -->
                <div v-if="diyStore.IsPhoneView && !diyStore.IsMiniProgram && ShowAddByRoute" class="mobile-header">
                    <div class="mobile-header-left">
                        <el-icon class="back-icon" @click="$router.back()">
                            <ArrowLeft />
                        </el-icon>
                    </div>
                    <div class="mobile-header-center">
                        <span class="mobile-title">{{ SysMenuModel.Name || $t('Msg.TableList') }}</span>
                    </div>
                    <!-- <div class="mobile-header-right">
                        <el-icon class="search-icon" @click="showMobileSearch = true">
                            <Search />
                        </el-icon>
                    </div> -->
                </div>

                <!--DIY功能按钮区域（新增、导入、导出...） 新版-->
                <!--  把 全选，批量分享，批量删除的条件加上，不然整个当数据都为空时列表上方会出现一个空的大方框-->
                <!--移动端隐藏此工具栏，改用右下角FAB浮动按钮展示-->
                <div class="keyword-search" style="margin-bottom: 5px;">
                    <div class="search-action-group">
                        <!-- 工作流菜单（OpenType=='WorkFlow' && FlowDesignId 存在）：发起申请按钮，替代普通新增 -->
                        <el-button
                            v-if="IsWorkFlowMenu()
                                    && _LimitAdd
                                    && !TableChildField.Readonly
                                    && PropsIsJoinTable !== true
                                    && IsVisibleAdd == true
                                    && (!diyStore.IsPhoneView || _IsTableChild)
                                "
                            :loading="BtnLoading"
                            type="primary"
                            icon="Promotion"
                            @click="StartWorkFlow()"
                        >
                            {{ SysMenuModel && SysMenuModel.AddBtnText
                                ? SysMenuModel.AddBtnText
                                : '发起流程' }}
                        </el-button>
                        <!-- 普通新增按钮（OpenType!=WorkFlow 或未配置 FlowDesignId 时显示） -->
                        <el-button
                            v-if="!IsWorkFlowMenu()
                                    && _LimitAdd
                                    && !TableChildField.Readonly
                                    && PropsIsJoinTable !== true
                                    && IsVisibleAdd == true
                                    && (!diyStore.IsPhoneView || _IsTableChild)
                                "
                            :loading="BtnLoading"
                            type="primary"
                            :icon="BtnLoading ? '' : CirclePlusFilled"
                            @click="OpenDetail(null, 'Add')"
                        >
                            {{ SysMenuModel && SysMenuModel.AddBtnText
                                ? SysMenuModel.AddBtnText
                                : $t("Msg.Add") }}
                        </el-button>
                        <!-- 表内编辑【提交一起保存】模式：批量提交 / 取消按钮 -->
                        <template v-if="IsBatchSubmitMode() && SysMenuModel.InTableEdit">
                            <el-button
                                type="success"
                                :loading="_BatchSaveLoading"
                                :disabled="!HasPendingBatchChanges()"
                                @click="SubmitBatchSave"
                            >
                                <fa-icon icon="far fa-save mr-1" />
                                提交保存<template v-if="HasPendingBatchChanges()">（{{ GetPendingBatchSummary().total }}）</template>
                            </el-button>
                            <el-button
                                v-if="HasPendingBatchChanges()"
                                type="info"
                                plain
                                @click="CancelBatchSave"
                            >
                                取消变更
                            </el-button>
                        </template>
                        <!-- 更多页面按钮 PageBtns -->
                        <template v-if="!IsTrashMode
                                        && (!diyStore.IsPhoneView || _IsTableChild)
                                        && SysMenuModel.PageBtns
                                        && SysMenuModel.PageBtns.length > 0">
                            <template v-for="(btn, btnIndex) in SysMenuModel.PageBtns">
                                <el-button
                                    :key="TypeFieldName + 'more_btn_pagebtns_' + btnIndex"
                                    :type="GetMoreBtnStyle(btn)"
                                    v-if="btn.IsVisible"
                                    :loading="BtnV8Loading"
                                    @click="RunMoreBtn(btn)"
                                >
                                    <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                    {{ btn.Name }}
                                </el-button>
                            </template>
                        </template>
                        <!-- 全选，批量分享，批量删除 -->
                        <!--Fix by Anderson for 小赵：下面这一句不能增加【&& !diyStore.IsPhoneView】判断，移动端也需要批量操作功能！！！-->

                        <template v-if="!IsTrashMode
                                        && (!diyStore.IsPhoneView || _IsTableChild)
                                        && SysMenuModel
                                        && SysMenuModel.BatchSelectMoreBtns
                                        && SysMenuModel.BatchSelectMoreBtns.length > 0">
                            <el-checkbox
                                v-if="TableDisplayMode == 'Card' && CanUseTableSelection()"
                                v-model="cardSelectAll"
                                @change="toggleCardSelectAll"
                                :indeterminate="cardSelection.length > 0 && cardSelection.length < DiyTableRowList.length"
                                class="card-batch-checkbox"
                                border
                                style="margin-right: 10px;margin-left:10px;"
                            >
                                {{ cardSelection.length > 0 ? `${$t('Msg.Selected')} ${cardSelection.length} ${$t('Msg.Items')}` : $t('Msg.SelectAll') }}
                            </el-checkbox>
                            <template v-for="(btn, btnIndex) in SysMenuModel.BatchSelectMoreBtns">
                                <el-button v-if="btn.IsVisible" :key="TypeFieldName + 'more_btn_bs_' + btnIndex" @click="RunMoreBtn(btn)">
                                    <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                    {{ btn.Name }}
                                </el-button>
                            </template>
                        </template>
                        <!--如果子表是只读状态或预览模式，不显示导入导出按钮-->
                        <template v-if="!diyStore.IsPhoneView && (! _IsTableChild || (_IsTableChild && !TableChildField.Readonly))">
                            <el-button v-if="_LimitImport && TableChildFormMode != 'View'" :icon="UploadFilled" @click="$refs.refDiyImportDialog.show()">{{ $t("Msg.Import") }}</el-button>
                            <el-button
                                v-if="_LimitExport && (DiyCommon.IsNull(SysMenuModel.ExportMoreBtns) || SysMenuModel.ExportMoreBtns.length == 0)"
                                :icon="Download"
                                :loading="BtnExportLoading"
                                @click="ExportDiyTableRow()"
                                >{{ $t("Msg.Export") }}</el-button
                            >
                            <!-- @click="ExportDiyTableRow()" -->
                            <!-- split-button -->
                            <el-dropdown
                                v-if="_LimitExport && !DiyCommon.IsNull(SysMenuModel.ExportMoreBtns) && SysMenuModel.ExportMoreBtns.length > 0"
                                trigger="click"
                                style="margin-left: 10px"
                            >
                                <!-- {{ $t('Msg.Export') }} -->
                                <el-button class="mr-10">
                                    {{ $t("Msg.Export") }}
                                    <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                                </el-button>
                                <template #dropdown
                                    ><el-dropdown-menu class="table-more-btn">
                                        <template v-if="!DiyCommon.IsNull(SysMenuModel) && !DiyCommon.IsNull(SysMenuModel.ExportMoreBtns) && SysMenuModel.ExportMoreBtns.length > 0">
                                            <template v-for="(btn, btnIndex) in SysMenuModel.ExportMoreBtns">
                                                <el-dropdown-item v-if="btn.IsVisible" :key="TypeFieldName + 'more_btn_export_' + btnIndex" @click="ExportDiyTableRow(btn)">
                                                    <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                                    {{ btn.Name }}
                                                </el-dropdown-item>
                                            </template>
                                        </template>
                                    </el-dropdown-menu></template
                                >
                            </el-dropdown>
                        </template>
                        <el-button v-if="!DiyCommon.IsNull(SysMenuModel.ImportTemplate)" :icon="Document" @click="DownloadTemplate()">{{ $t("Msg.DownloadTemplate") }}</el-button>
                        <el-button
                            v-if="_EnableTrash && !_IsTableChild && PropsTableType !== 'OpenTable'"
                            :type="IsTrashMode ? 'warning' : 'default'"
                            :icon="RefreshLeft"
                            @click="ToggleTrashMode"
                        >
                            {{ IsTrashMode ? '返回数据表' : '回收站' }}
                        </el-button>
                    </div>
                    <!-- 通用搜索 -->
                    <div class="search-input-group"
                        v-if="IsPermission('NoSearch')
                            && SysMenuModel
                            && SysMenuModel.GeneralSeaarch !== 1"
                        style="display: flex;align-items: center;gap: 10px;justify-content: center;">
                        <el-input class="keyword-input" v-model="Keyword" @input="InputGetDiyTableRow({ _PageIndex: 1 })" :placeholder="$t('Msg.Search')">
                            <template #prepend><el-button :icon="RefreshLeft" @click="InitSearch();GetDiyTableRow({ _PageIndex: 1 });"></el-button></template>
                            <template #append><el-button :icon="Search" @click="GetDiyTableRow({ _PageIndex: 1 })"></el-button></template>
                        </el-input>
                        <div v-if="diyStore.IsPhoneView" class="mobile-search-actions">
                            <div v-if="ShowAddByRoute" class="mobile-icon-btn" @click="showMobileSearch=true">
                                <el-icon :size="20"><Operation /></el-icon>
                            </div>
                            <div class="mobile-icon-btn" :class="{ 'is-active': cardCompactMode }" @click="cardCompactMode = !cardCompactMode">
                                <el-icon :size="20"><Fold v-if="!cardCompactMode" /><Expand v-else /></el-icon>
                            </div>
                        </div>
                    </div>
                    <!-- <template v-if="IsPermission('NoSearch')">
                        <DiySearch
                            v-if="SearchFieldIds.length > 0 && DiyFieldList.length > 0"
                            :ref="'refDiySearch1'"
                            :key="'refDiySearch1'"
                            :CurrentDiyTableModel="CurrentDiyTableModel"
                            :TypeFieldName="TypeFieldName"
                            :SearchFieldIds="SearchFieldIds"
                            :DiyFieldList="DiyFieldList"
                            :SearchType="'Line'"
                            @CallbackGetDiyTableRow="GetDiyTableRow"
                            @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"
                        ></DiySearch>
                    </template> -->
                    <!--清除搜索-->
                    <!-- <div class="search-clear-group" v-if="IsPermission('NoSearch')">
                        <el-button
                            :icon="RefreshLeft"
                            @click="
                                InitSearch();
                                GetDiyTableRow({ _PageIndex: 1 });
                            "
                        >
                            {{ $t("Msg.ClearSearch") }}
                        </el-button>
                    </div> -->

                    <div class="search-more-group" v-if="!diyStore.IsPhoneView && _HasSearchFields && IsPermission('NoSearch')">
                        <!-- 更多搜索 弹出层  【内部】搜索-->
                        <el-popover placement="bottom" width="auto" trigger="click" popper-class="diy-search-popover search-in" v-if="_HasSearchFieldsIn">
                            <DiySearch
                                v-if="SearchFieldIds.length > 0 && DiyFieldList.length > 0"
                                :ref="'refDiySearch2'"
                                :key="'refDiySearch2'"
                                :CurrentDiyTableModel="CurrentDiyTableModel"
                                :SearchFieldIds="SearchFieldIds"
                                :DiyFieldList="DiyFieldList"
                                :SearchType="'In'"
                                @CallbackGetDiyTableRow="(params) => {
                        GetDiyTableRow(params,4);
                    }"
                                @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"
                            ></DiySearch>
                            <template #reference
                                ><el-button :icon="ArrowDown">
                                    {{ $t("Msg.MoreSearch") }}
                                </el-button></template
                            >
                        </el-popover>
                    </div>
                    <el-button v-if="!diyStore.IsPhoneView" type="primary" :icon="List"
                        @click="ShiftTableDisplayMode()">{{
                        $t('Msg.SwitchTableDisplay')
                    }}</el-button>
                    <div class="admin-action-group" v-if="GetCurrentUser._IsAdmin && !diyStore.IsPhoneView">
                        <el-dropdown trigger="click">
                            <el-button type="primary">
                                <el-icon style="margin-right: 4px"><Setting /></el-icon>{{ $t('Msg.DevDesign') }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                            </el-button>
                            <template #dropdown>
                                <el-dropdown-menu>
                                    <el-dropdown-item @click="$router.push(`/diy/diy-design/${TableId}?PageType=${CurrentDiyTableModel.ReportId ? 'Report' : ''}`)">
                                        <el-icon><List /></el-icon>{{ $t('Msg.FormDesign') }}
                                    </el-dropdown-item>
                                    <el-dropdown-item @click="OpenMenuForm()">
                                        <el-icon><QuestionFilled /></el-icon>{{ $t('Msg.ModuleDesign') }}
                                    </el-dropdown-item>
                                    <el-dropdown-item @click="$refs.refDiyPermissionDialog.show()">
                                        <el-icon><CircleCheck /></el-icon>{{ $t('Msg.MenuPermission') }}
                                    </el-dropdown-item>
                                    <el-dropdown-item divided @click="ShowIndexManager = true">
                                        <el-icon><Grid /></el-icon>索引管理
                                    </el-dropdown-item>
                                </el-dropdown-menu>
                            </template>
                        </el-dropdown>
                    </div>
                </div>

                <!-- 统计面板（数据来自 sys_menu.TableReport，卡片模式追加 StatisticsFields） -->
                <div v-if="tableReportItems && tableReportItems.length > 0" class="table-report-panel" :style="{ 'grid-template-columns': tableReportGridCols }">
                    <div
                        v-for="item in tableReportItems"
                        :key="item.Id || item.Label"
                        :class="['table-report-card', item.Source === 'StatisticsFields' ? 'table-report-card--statistics' : '']"
                        :style="{ '--report-color': item.Color || '#409eff' }"
                    >
                        <div class="table-report-icon">
                            <fa-icon :icon="item.Icon || 'fas fa-chart-bar'" />
                        </div>
                        <div class="table-report-body">
                            <div class="table-report-value" :title="String(item.Value ?? '')">{{ FormatTableReportValue(item.Value) }}</div>
                            <div class="table-report-label" :title="item.Label">{{ item.Label }}</div>
                        </div>
                    </div>
                </div>

                <!--DIY移动端浮动操作按钮（FAB）-->
                <div class="mobile-fab-container" v-if="diyStore.IsPhoneView && ShowAddByRoute && !IsTrashMode" :style="GetFabContainerStyle()">
                    <!--遮罩层-->
                    <transition name="fab-overlay">
                        <div class="mobile-fab-overlay" v-if="showMobileFabMenu" @click="showMobileFabMenu = false"></div>
                    </transition>
                    <!--弹出菜单-->
                    <transition name="fab-menu">
                        <div class="mobile-fab-menu" v-if="showMobileFabMenu">
                            <!--工作流-发起申请按钮-->
                            <div class="mobile-fab-menu-item" v-if="IsWorkFlowMenu() && _LimitAdd && !TableChildField.Readonly && PropsIsJoinTable !== true && IsVisibleAdd == true" @click="showMobileFabMenu = false; StartWorkFlow()">
                                <div class="mobile-fab-menu-icon add"><fa-icon icon="far fa-paper-plane" /></div>
                                <span class="mobile-fab-menu-label">{{ SysMenuModel && SysMenuModel.AddBtnText ? SysMenuModel.AddBtnText : '发起流程' }}</span>
                            </div>
                            <!--新增按钮-->
                            <div class="mobile-fab-menu-item" v-if="!IsWorkFlowMenu() && _LimitAdd && !TableChildField.Readonly && PropsIsJoinTable !== true && IsVisibleAdd == true" @click="showMobileFabMenu = false; OpenDetail(null, 'Add')">
                                <div class="mobile-fab-menu-icon add"><el-icon><Plus /></el-icon></div>
                                <span class="mobile-fab-menu-label">{{ SysMenuModel && SysMenuModel.AddBtnText ? SysMenuModel.AddBtnText : $t('Msg.Add') }}</span>
                            </div>
                            <!--V8页面按钮 PageBtns-->
                            <template v-if="!IsTrashMode && SysMenuModel.PageBtns && SysMenuModel.PageBtns.length > 0">
                                <template v-for="(btn, btnIndex) in SysMenuModel.PageBtns" :key="'fab_pagebtn_' + btnIndex">
                                    <div class="mobile-fab-menu-item" v-if="btn.IsVisible" @click="showMobileFabMenu = false; RunMoreBtn(btn)">
                                        <div class="mobile-fab-menu-icon v8"><fa-icon :icon="DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon" /></div>
                                        <span class="mobile-fab-menu-label">{{ btn.Name }}</span>
                                    </div>
                                </template>
                            </template>
                            <!--批量操作按钮-->
                            <template v-if="!IsTrashMode && SysMenuModel && SysMenuModel.BatchSelectMoreBtns && SysMenuModel.BatchSelectMoreBtns.length > 0">
                                <template v-for="(btn, btnIndex) in SysMenuModel.BatchSelectMoreBtns" :key="'fab_batchbtn_' + btnIndex">
                                    <div class="mobile-fab-menu-item" v-if="btn.IsVisible" @click="showMobileFabMenu = false; RunMoreBtn(btn)">
                                        <div class="mobile-fab-menu-icon batch"><fa-icon :icon="DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon" /></div>
                                        <span class="mobile-fab-menu-label">{{ btn.Name }}</span>
                                    </div>
                                </template>
                            </template>
                        </div>
                    </transition>
                    <!--FAB主按钮-->
                    <div class="mobile-fab-btn" :class="{ 'is-open': showMobileFabMenu }"
                        @mousedown="OnFabPointerDown" @touchstart="OnFabPointerDown" @click="OnFabClick">
                        <el-icon class="mobile-fab-icon"><CloseBold v-if="showMobileFabMenu" /><MoreFilled v-else /></el-icon>
                    </div>
                </div>

                <!--DIY移动端顶部搜索-->
                <!-- v-if="diyStore.IsPhoneView" -->
                <div class="keyword-search" v-if="false">
                  <div class="search-box">
                    <div class="search-input-group" style="max-width:240px;"
                      v-if=" IsPermission('NoSearch') && SysMenuModel && SysMenuModel.GeneralSeaarch !== 1" >
                      <el-input class="keyword-input"   v-model="Keyword" @input="InputGetDiyTableRow({ _PageIndex: 1 })"
                        :placeholder="$t('Msg.Search')">
                        <template #append><el-button :icon="Search"
                            @click="GetDiyTableRow({ _PageIndex: 1 })"></el-button></template>
                      </el-input>
                    </div>
                    <div v-if="ShowAddByRoute" class="more-search" @click="showMobileSearch=true">
                      <el-icon><Operation /></el-icon>
                    </div>
                  </div>
                  <!-- <input
                        type="date"
                      /> -->
                  <!-- 筛选下拉列表和清除搜索 -->
                  <div class="search-action-group" style="display: flex;" v-if="SearchFieldIds.length > 0 && DiyFieldList.length > 0 ">
                   <DiyModleSearch :ref="'refDiySearch4'" :key="'refDiySearch4'" :CurrentDiyTableModel="CurrentDiyTableModel"
                    :SearchFieldIds="SearchFieldIds" :DiyFieldList="DiyFieldList" :SearchType="'Out'"
                    @clearSearch="childClearSearch" @CallbackGetDiyTableRow="(params) => {
                        GetDiyTableRow(params,1);
                    }" @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"></DiyModleSearch >
                      <!--清除搜索-->
                         <div class="reset-search" v-if="diyStore.IsPhoneView && ShowAddByRoute" @click="
                                  InitSearch();
                                  GetDiyTableRow({ _PageIndex: 1 });
                              ">
                            {{ $t("重置搜索") }}
                          </div>
                  </div>
                </div>

                <!--DIY搜索  【外部】搜索-->
                <div class="search-outside" v-if="SearchFieldIds.length > 0 && DiyFieldList.length > 0 && !diyStore.IsPhoneView">
                    <DiySearch
                        :ref="'refDiySearch3'"
                        :key="'refDiySearch3'"
                        :CurrentDiyTableModel="CurrentDiyTableModel"
                        :SearchFieldIds="SearchFieldIds"
                        :DiyFieldList="DiyFieldList"
                        :SearchType="'Out'"
                        @CallbackGetDiyTableRow="(params) => {
                        GetDiyTableRow(params,3);
                    }"
                        @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"
                    ></DiySearch>
                </div>
                <!--DIY表格-->
                <div
                    v-if="TableDisplayMode == 'Table'"
                    class="diy-table-batch-drag-host"
                    @mousedown.capture="BatchDragSelectionMouseDown"
                >
                <el-table
                    :id="'diy-table-' + TableId"
                    :ref="'diy-table-' + TableId"
                    v-loading="tableLoading"
                    :data="RenderedTableRowList"
                    style="width: 100%"
                    :show-summary="StatisticsFields != null"
                    :summary-method="StatisticsFieldsMethod"
                    @sort-change="DiyTableRowSortChange"
                    :class="[
                        'clear no-border-outside table-table table-data diy-table-' + CurrentDiyTableModel.Name,
                        SysMenuModel && (SysMenuModel.TableCellWrap === true || SysMenuModel.TableCellWrap === 1 || SysMenuModel.TableCellWrap === '1' || SysMenuModel.TableCellWrap === 'true') ? 'table-cell-wrap' : '',
                        CanBatchDragSelection() ? 'is-batch-drag-enabled' : '',
                        _batchDragSelecting ? 'is-batch-drag-selecting' : ''
                    ]"
                    @row-dblclick="TableRowDblClick"
                    @selection-change="TableRowSelectionChange"
                    :height="GetDiyTableMaxHeight()"
                    stripe
                    border
                    @row-click="DiyTableRowClick"
                    :lazy="CurrentDiyTableModel.TreeLazy === true || CurrentDiyTableModel.TreeLazy === 1"
                    :load="DiyTableLoad"
                    row-key="Id"
                    :tree-props="{ children: '_Child', hasChildren: CurrentDiyTableModel.TreeHasChildren || '_HasChild' }"
                >
                    <el-table-column v-if="IsOpenTableSingleSelect()" label="#" width="45" align="center">
                        <template #default="scope">
                            <el-radio
                                class="open-table-row-radio"
                                :model-value="TableSelectedRow && TableSelectedRow.Id"
                                :label="scope.row.Id"
                                @change="selectOpenTableSingleRow(scope.row)"
                                @click.stop
                            />
                        </template>
                    </el-table-column>
                    <el-table-column v-else-if="CanUseTableSelection()" type="selection" label="#" width="35" class-name="diy-batch-drag-zone"> </el-table-column>
                    <el-table-column
                        type="index"
                        :label="$t('Msg.SerialNo')"
                        width="55"
                        align="center"
                        :index="indexMethod"
                        class-name="diy-batch-drag-zone"
                        v-if="DiyCommon.IsNull(SysMenuModel) || (!DiyCommon.IsNull(SysMenuModel) && !SysMenuModel.HiddenIndex)"
                    >
                    </el-table-column>
                    <template v-for="(field, fieldIndex) in ShowDiyFieldList" :key="TypeFieldName + 'table_column_fieldid_' + field.Id">
                        <el-table-column
                            :prop="DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName"
                            :property="DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName"
                            :label="field.Label"
                            :width="GetColWidth(field, fieldIndex)"
                            :class-name="GetColClassName(field)"
                            :fixed="ColIsFixed(field.Id)"
                            show-overflow-tooltip
                        >
                            <template #header>
                                <div class="col-header-cell" @click.stop="showColHeaderMenu(field, $event)">
                                    <span>{{ field.Label }}</span>
                                    <span class="col-header-sort-indicator" v-if="getColSortState(field)">
                                        <el-icon v-if="getColSortState(field) === 'asc'" :size="12"><SortUp /></el-icon>
                                        <el-icon v-else :size="12"><SortDown /></el-icon>
                                    </span>
                                    <span class="col-header-menu-icon col-header-menu-icon--dots">
                                        <fa-icon icon="fas fa-ellipsis-v" style="font-size:14px;" />
                                    </span>
                                    <el-icon class="col-header-menu-icon col-header-menu-icon--search" :size="14"><Search /></el-icon>
                                </div>
                            </template>
                            <template #default="scope">
                                <!--如果使用了模板引擎-->
                                <template v-if="isMuban(field, scope)">
                                    <div style="line-height: 22px" v-safe-html="scope.row[field.Name + '_TmpEngineResult']"></div>
                                </template>
                                <!--如果需要默认用模板的控件  此类控件不支持表内编辑-->
                                <template v-else-if="NeedDiyTemplateFieldLst.indexOf(field.Component) > -1">
                                    <!--如果是定制开发组件-->
                                    <template v-if="field.Component == 'DevComponent'">
                                        <template v-if="!DiyCommon.IsNull(field.Config.DevComponentName)">
                                            <component
                                                v-if="!DiyCommon.IsNull(DevComponents[field.Config.DevComponentName]) && !DiyCommon.IsNull(DevComponents[field.Config.DevComponentName].Path)"
                                                :is="field.Config.DevComponentName"
                                                :TableRowId="TableRowId"
                                                :row-model="scope.row"
                                                @RefreshDiyTableRowList="RefreshDiyTableRowList"
                                            />
                                            <template v-else>
                                                <el-tag type="info" class="hand">
                                                    <el-icon><InfoFilled /></el-icon>
                                                    {{ $t('Msg.CustomComponent') }}
                                                </el-tag>
                                            </template>
                                        </template>
                                    </template>
                                    <!--如果是子表-->
                                    <template v-else-if="field.Component == 'TableChild'">
                                        <el-tag type="info" class="hand">
                                            <el-icon><Grid /></el-icon>
                                            {{ $t('Msg.ViewData') }}
                                        </el-tag>
                                    </template>
                                    <!--如果是地图-->
                                    <template v-else-if="field.Component == 'Map'">
                                        <el-tag v-if="DiyCommon.IsNull(scope.row[field.Name + '_Lng'])" @click="OpenDetail(scope.row, 'Edit')" type="info" class="hand">
                                            <el-icon><LocationFilled /></el-icon>
                                            {{ $t('Msg.NotMarked') }}
                                        </el-tag>
                                        <el-tag v-else @click="OpenDetail(scope.row, 'View')" type="success" class="hand">
                                            <el-icon><Location /></el-icon>
                                            {{ $t('Msg.ViewMap') }}
                                        </el-tag>
                                    </template>
                                    <template v-else-if="field.Component == 'MapArea'">
                                        <el-tag v-if="DiyCommon.IsNull(scope.row[field.Name])" @click="OpenDetail(scope.row, 'Edit')" type="info" class="hand">
                                            <el-icon><LocationFilled /></el-icon>
                                            {{ $t('Msg.NotDrawn') }}
                                        </el-tag>
                                        <el-tag v-else @click="OpenDetail(scope.row, 'View')" type="success" class="hand">
                                            <el-icon><Location /></el-icon>
                                            {{ $t('Msg.ViewArea') }}
                                        </el-tag>
                                    </template>
                                    <template v-else-if="field.Component == 'FontAwesome'">
                                        <fa-icon :class="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"></fa-icon>
                                    </template>
                                    <template v-else-if="field.Component == 'ImgUpload'">
                                        <div style="display: flex; align-items: center; justify-content: center; height: 25px">
                                            <el-image
                                                v-if="!DiyCommon.IsNull(scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName])"
                                                :src="getFirstImageUrl(scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName])"
                                                :preview-src-list="getImagePreviewList(scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName])"
                                                :preview-teleported="true"
                                                :z-index="50000"
                                                style="width: 25px; height: 25px; border-radius: 2px; cursor: pointer; object-fit: cover"
                                                fit="cover"
                                                lazy
                                                @error="handleImageError"
                                            />
                                            <span v-else style="color: #ccc; font-size: 10px">{{ $t('Msg.NoImage') }}</span>
                                        </div>
                                    </template>
                                </template>
                                <!--如果没有使用模板引擎、也不是默认模板控件-->
                                <template v-else>
                                    <!--如果是表内编辑-->
                                    <div v-if="SysMenuModel.InTableEdit && IsInTableEditField(field.Id)"
                                        @dblclick.prevent.stop>
                                        <component
                                            v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                                            @dblclick.prevent.stop
                                            :TableInEdit="true"
                                            :field="field"
                                            :FormDiyTableModel="scope.row"
                                            :FormMode="TableChildFormMode"
                                            :TableId="TableId"
                                            :TableName="TableName"
                                            :SysMenuModel="SysMenuModel"
                                            :FieldReadonly="GetFieldIsReadOnly(field)"
                                            :DiyTableModel="CurrentDiyTableModel"
                                            :DiyFieldList="DiyFieldList"
                                            :LoadType="'Table'"
                                            @CallbackRunV8Code="
                                                ({ field, thisValue, callback }) => {
                                                    return RunV8Code({ field: field, thisValue: thisValue, row: scope.row, callback: callback });
                                                }
                                            "
                                            @CallbakOnKeyup="
                                                (event, field) => {
                                                    return FieldOnKeyup(event, field, scope);
                                                }
                                            "
                                            @CallbackInTableEditSave="OnInTableEditSave"
                                            :is="'Diy' + field.Component"
                                        />
                                    </div>
                                    <template v-else-if="field.Component == 'Progress' || field.Component == 'Switch'">
                                        <component
                                            :ref="'ref_' + field.Name"
                                            v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                                            :TableInEdit="false"
                                            :field="field"
                                            :FormDiyTableModel="scope.row"
                                            :FormMode="'View'"
                                            :is="'Diy' + field.Component"
                                        />
                                    </template>
                                    <template v-else-if="field.Component == 'Select' || field.Component == 'MultipleSelect'">
                                        {{ ShowSelectLabel(scope, field) }}
                                    </template>
                                    <template v-else-if="field.Component == 'Department'">
                                        <span>{{ GetColValue(scope, field) }}</span>
                                    </template>
                                    <template v-else-if="field.Component == 'Rate'">
                                        <el-rate v-model="scope.row[field.Name]" :disabled="true" />
                                    </template>

                                    <template v-else>
                                        <!-- :title="GetColValue(scope, field)" -->
                                        <span>{{ GetColValue(scope, field) }}</span>
                                    </template>
                                    <!--如果不是表内编辑 END-->
                                </template>
                            </template>
                        </el-table-column>
                    </template>
                    <!-- :sortable="IsSortField('CreateTime') ? 'custom' : false" -->
                    <el-table-column
                        v-if="ColIsDisplay('CreateTime')"
                        :label="$t('Msg.CreateTime')"
                        :prop="'CreateTime'"
                        width="150"
                    >
                        <template #default="scope">
                            <!-- :title="scope.row.CreateTime" -->
                            <span>{{ scope.row.CreateTime }}</span>
                        </template>
                    </el-table-column>
                    <!-- :sortable="IsSortField('UserName') ? 'custom' : false" -->
                    <el-table-column
                        v-if="ColIsDisplay('UserName')"
                        :label="$t('Msg.Creator')"
                        :prop="'UserName'"
                        width="110"
                    >
                        <template #default="scope">
                            <!-- :title="scope.row.UserName" -->
                            <span>{{ scope.row.UserName }}</span>
                        </template>
                    </el-table-column>
                    <!-- :sortable="IsSortField('UpdateTime') ? 'custom' : false" -->
                    <el-table-column
                        v-if="ColIsDisplay('UpdateTime')"
                        :label="$t('Msg.UpdateTime')"
                        :prop="'UpdateTime'"
                        width="150"
                    >
                        <template #default="scope">
                            <!-- :title="scope.row.UpdateTime" -->
                            <span>{{ scope.row.UpdateTime }}</span>
                        </template>
                    </el-table-column>
                    <!--之前是 MaxRowBtnsOut*115 按按钮数量来，现在按文字数量来-->
                    <!-- 性能优化V3：简化DOM结构，移除不必要的包装div -->
                    <el-table-column :fixed="DosCommon.isMobile ? false : 'right'" :label="$t('Msg.Action')" class="row-last-op" :width="GetActionWidth">
                        <template #default="scope">
                            <div style="display: flex;justify-content: right;align-items: center;">
                                <template v-for="(btn, btnIndex) in (scope.row._RowMoreBtnsOut || [])" :key="TypeFieldName + 'more_btn_showrowtrue_' + scope.row.Id + btnIndex">
                                    <el-button
                                        v-if="!IsTrashMode && btn.IsVisible && !TableChildField.Readonly"
                                        :type="GetMoreBtnStyle(btn)"
                                        class="row-more-btns-out"
                                        :loading="BtnV8Loading"
                                        @click.stop="RunMoreBtn(btn, scope.row)"
                                    >
                                        <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                        {{ btn.Name }}
                                    </el-button>
                                </template>
                                <!--工作流-去处理 按钮（OpenType=='WorkFlow' 时显示，放在【详情】之前）-->
                                <el-button
                                    v-if="IsWorkFlowMenu() && scope.row._IsInTableAdd !== true"
                                    type="primary"
                                    :icon="Tickets"
                                    :loading="BtnLoading"
                                    @click.stop="OpenWorkFlowProcess(scope.row)"
                                >
                                    去处理
                                </el-button>
                                <el-button
                                    v-if="IsPermission('NoDetail') && scope.row._IsInTableAdd !== true && scope.row.IsVisibleDetail == true"
                                    :icon="Tickets"
                                    @click="OpenDetail(scope.row, 'View')"
                                >
                                    {{ $t("Msg.Detail") }}
                                </el-button>
                                <el-button
                                    v-if="IsTrashMode && scope.row._IsInTableAdd !== true"
                                    type="success"
                                    :icon="RefreshLeft"
                                    :loading="BtnLoading"
                                    @click.stop="RestoreTrashRow(scope.row)"
                                >
                                    恢复
                                </el-button>
                                <!--如果子表是只读，不显示编辑等按钮 2021-01-30 && TableChild!field.Readonly-->
                                <!-- 性能优化V3：使用原生按钮+全局共享菜单，避免每行实例化popover -->
                                <!-- 流程引擎模式下：隐藏【编辑】项但保留【更多】按钮以提供删除/V8内部按钮 -->
                                <el-button
                                    v-if="!IsTrashMode && (
                                        (!IsWorkFlowMenu() && TableChildFormMode != 'View' &&
                                            !TableChildField.Readonly &&
                                            _LimitEdit &&
                                            scope.row._IsInTableAdd !== true &&
                                            scope.row.IsVisibleEdit == true) ||
                                        (scope.row._RowMoreBtnsIn && scope.row._RowMoreBtnsIn.some(btn => btn.IsVisible)) ||
                                        (_LimitDel && scope.row.IsVisibleDel == true)
                                    )"
                                    class="more-action-btn"
                                    @click.stop="showMoreMenu($event, scope.row)"
                                >
                                    {{ $t("Msg.More") }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                                </el-button>
                            </div>
                        </template>
                    </el-table-column>
                    <template #empty>
                        <div v-if="!TableChildConfig">
                            <img :src="'./static/img/no-data.svg'" style="width: 200px" />
                        </div>
                        <div>{{ tableLoading ? $t('Msg.DataLoading') : $t('Msg.NoData') }}</div>
                    </template>
                </el-table>
                <div
                    v-if="_batchDragSelecting && _batchDragRect"
                    class="batch-drag-selection-rect"
                    :style="BatchDragSelectionRectStyle()"
                ></div>
                </div>

                <el-row
                    v-if="TableDisplayMode == 'Card'"
                    class="table-card-el-row"
                    :gutter="10"
                >
                    <!-- 🔥 骨架屏：PC端loading时都显示，移动端仅首次加载显示 -->
                    <template v-if="tableLoading && (!diyStore.IsPhoneView || DiyTableRowList.length === 0)">
                        <el-col
                            v-for="item in Array.from(
                                { length: DiyTableRowPageSize },
                                (_, index) => index + 1
                            )"
                            :key="'skeleton-' + item"
                            :xs="24"
                            :sm="12"
                            :md="IsCardFiveCol() ? undefined : GetTableCardCol()"
                            :lg="IsCardFiveCol() ? undefined : GetTableCardCol()"
                            :xl="IsCardFiveCol() ? undefined : GetTableCardCol()"
                            :class="[
                                diyStore.IsPhoneView ? 'card-wrapper-mobile' : 'card-wrapper-desktop',
                                IsCardFiveCol() ? 'card-col-five' : ''
                            ]"
                        >
                            <el-card class="box-card card-data-animate no-padding">
                                <el-skeleton style="width: 100%" :loading="true" animated>
                                    <template #template>
                                        <el-skeleton-item
                                            variant="image"
                                            style="width: 100%; height: 100px"
                                        />
                                        <div class="body">
                                            <el-skeleton-item variant="text" style="width: 100%" />
                                        </div>
                                        <div class="item">
                                            <el-skeleton-item variant="text" style="width: 100%" />
                                        </div>
                                        <div class="bottom">
                                            <el-skeleton-item variant="text" style="width: 100%" />
                                        </div>
                                    </template>
                                </el-skeleton>
                            </el-card>
                        </el-col>
                    </template>
                    <!-- 卡片模式-空状态 -->
                    <div v-if="!tableLoading && DiyTableRowList.length === 0" class="card-empty-state">
                        <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" class="card-empty-icon">
                            <g fill="none">
                                <ellipse cx="100" cy="148" rx="80" ry="10" fill="#f0f2f5"/>
                                <rect x="50" y="40" width="100" height="80" rx="8" fill="#e8ecf1" stroke="#d3d9e3" stroke-width="1.5"/>
                                <rect x="60" y="55" width="50" height="6" rx="3" fill="#c4cad4"/>
                                <rect x="60" y="68" width="80" height="4" rx="2" fill="#d8dde6"/>
                                <rect x="60" y="78" width="65" height="4" rx="2" fill="#d8dde6"/>
                                <rect x="60" y="88" width="72" height="4" rx="2" fill="#d8dde6"/>
                                <rect x="60" y="100" width="40" height="8" rx="4" fill="#dce1e8"/>
                                <circle cx="145" cy="45" r="22" fill="#f5f7fa" stroke="#e0e4ea" stroke-width="1.5"/>
                                <path d="M137 45 l6 6 l10-12" stroke="#c4cad4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </g>
                        </svg>
                        <p class="card-empty-text">{{ $t('Msg.NoData') }}</p>
                    </div>
                    <el-col
                        v-for="(item, index) in DiyTableRowList"
                        v-show="!(!diyStore.IsPhoneView && tableLoading)"
                        :key="item.Id"
                            :xs="24"
                            :sm="12"
                            :md="IsCardFiveCol() ? undefined : GetTableCardCol()"
                            :lg="IsCardFiveCol() ? undefined : GetTableCardCol()"
                            :xl="IsCardFiveCol() ? undefined : GetTableCardCol()"
                            :class="[
                                diyStore.IsPhoneView ? 'card-wrapper-mobile' : 'card-wrapper-desktop',
                                IsCardFiveCol() ? 'card-col-five' : ''
                            ]"
                        >
                            <el-card
                                class="box-card card-data-animate no-padding card-redesign"
                                :class="{ 'card-selected': IsCardSelectActive(item) }"
                                @click="CardItemClick(item)"
                            >
                                <div
                                    :class="SysMenuModel.TableCardImgPosition === 'Left' ? 'card-content-horizontal' : 'card-content-vertical'"
                                >
                                    <!-- 卡片图片区域 -->
                                    <img
                                        v-if="SysMenuModel.TableCardImgField"
                                        :src="
                                            item[SysMenuModel.TableCardImgField]
                                                ? GetFileServerUrl(item[SysMenuModel.TableCardImgField])
                                                : bodyBgSvg
                                        "
                                        class="preview"
                                        :style="
                                            SysMenuModel.TableCardImgStyle ||
                                            (SysMenuModel.TableCardImgPosition === 'Left'
                                                ? 'width:120px;height:100%;object-fit:cover;flex-shrink:0;'
                                                : 'height:100px;width:100%;object-fit:cover;')
                                        "
                                    />
                                    <!-- 卡片内容区域 -->
                                    <div class="card-body" style="flex: 1;">
                                        <!-- ====== 第一行：序号 + 标题 + CardTitleTagFields ====== -->
                                        <div class="card-title-row" v-if="CardShowDiyFieldList.length > 0">
                                            <!-- 序号 -->
                                            <span class="card-index-badge">{{ getCardIndex(index) }}</span>
                                            <!-- 批量选择复选框 -->

                                            <!-- 标题内容（第一个字段） -->
                                            <span class="card-title-text">
                                                <template v-if="SysMenuModel.InTableEdit && IsInTableEditField(CardShowDiyFieldList[0].Id) && NeedDiyTemplateFieldLst.indexOf(CardShowDiyFieldList[0].Component) === -1">
                                                    <div class="card-inline-edit-item" @click.stop>
                                                        <div class="card-inline-edit-control">
                                                            <component
                                                                v-model="item[DiyCommon.IsNull(CardShowDiyFieldList[0].AsName) ? CardShowDiyFieldList[0].Name : CardShowDiyFieldList[0].AsName]"
                                                                :TableInEdit="true"
                                                                :field="CardShowDiyFieldList[0]"
                                                                :FormDiyTableModel="item"
                                                                :FormMode="TableChildFormMode"
                                                                :TableId="TableId"
                                                                :TableName="TableName"
                                                                :SysMenuModel="SysMenuModel"
                                                                :FieldReadonly="GetFieldIsReadOnly(CardShowDiyFieldList[0])"
                                                                :DiyTableModel="CurrentDiyTableModel"
                                                                :DiyFieldList="DiyFieldList"
                                                                :LoadType="'Table'"
                                                                @CallbackRunV8Code="({ field, thisValue, callback }) => RunV8Code({ field, thisValue, row: item, callback })"
                                                                @CallbakOnKeyup="(event, field) => FieldOnKeyup(event, field, { $index: index, row: item })"
                                                                @CallbackInTableEditSave="OnInTableEditSave"
                                                                :is="'Diy' + CardShowDiyFieldList[0].Component"
                                                            />
                                                        </div>
                                                    </div>
                                                </template>
                                                <template v-else-if="isMuban(CardShowDiyFieldList[0], { row: item })">
                                                    <span v-safe-html="item[CardShowDiyFieldList[0].Name + '_TmpEngineResult']"></span>
                                                </template>
                                                <template v-else>
                                                    {{ GetColValue({ row: item }, CardShowDiyFieldList[0]) }}
                                                </template>
                                            </span>
                                            <!-- CardTitleTagFields 标签 -->
                                            <div class="card-title-tags" v-if="CardTitleTagFieldList && CardTitleTagFieldList.length > 0">
                                                <template v-for="tagField in CardTitleTagFieldList" :key="'title-tag-' + tagField.Id">
                                                    <template v-if="item[(tagField.AsName || tagField.Name)] != null && item[(tagField.AsName || tagField.Name)] !== ''">
                                                        <span v-if="isMuban(tagField, { row: item })" v-safe-html="item[tagField.Name + '_TmpEngineResult']" class="card-tag-html"></span>
                                                        <el-tag v-else size="small" class="card-title-tag" effect="light">{{ GetColValue({ row: item }, tagField) }}</el-tag>
                                                    </template>
                                                </template>
                                            </div>
                                        </div>
                                        <!-- ====== 中间行：其余字段 ====== -->
                                        <div
                                            v-for="(field, fieldIndex) in CardShowDiyFieldList.slice(1)"
                                            v-show="!cardCompactMode || fieldIndex === 0"
                                            :key="field.Id"
                                            class="card-field-row"
                                        >
                                            <!--如果是表内编辑（卡片模式）-->
                                            <template v-if="SysMenuModel.InTableEdit && IsInTableEditField(field.Id) && NeedDiyTemplateFieldLst.indexOf(field.Component) === -1">
                                                <div class="card-inline-edit-item" @click.stop>
                                                    <span class="card-inline-edit-label">{{ field.Label }}：</span>
                                                    <div class="card-inline-edit-control">
                                                        <component
                                                            v-model="item[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                                                            :TableInEdit="true"
                                                            :field="field"
                                                            :FormDiyTableModel="item"
                                                            :FormMode="TableChildFormMode"
                                                            :TableId="TableId"
                                                            :TableName="TableName"
                                                            :SysMenuModel="SysMenuModel"
                                                            :FieldReadonly="GetFieldIsReadOnly(field)"
                                                            :DiyTableModel="CurrentDiyTableModel"
                                                            :DiyFieldList="DiyFieldList"
                                                            :LoadType="'Table'"
                                                            @CallbackRunV8Code="({ field, thisValue, callback }) => RunV8Code({ field, thisValue, row: item, callback })"
                                                            @CallbakOnKeyup="(event, field) => FieldOnKeyup(event, field, { $index: index, row: item })"
                                                            @CallbackInTableEditSave="OnInTableEditSave"
                                                            :is="'Diy' + field.Component"
                                                        />
                                                    </div>
                                                </div>
                                            </template>
                                            <template v-else-if="field.Component == 'Rate'">
                                                <span class="card-field-label">{{ field.Label }}</span>
                                                <el-rate v-model="item[field.AsName || field.Name]" :disabled="true" />
                                            </template>
                                            <!-- V8TmpEngineTable 模板引擎 -->
                                            <template v-else-if="isMuban(field, { row: item })">
                                                <span class="card-field-label">{{ field.Label }}</span>
                                                <span class="card-field-value" v-safe-html="item[field.Name + '_TmpEngineResult']"></span>
                                            </template>
                                            <!--普通字段-->
                                            <template v-else>
                                                <span class="card-field-label">{{ field.Label }}</span>
                                                <span class="card-field-value">{{ GetColValue({ row: item }, field) }}</span>
                                            </template>
                                        </div>
                                        <!-- ====== 底部行：CardBottomTagFields + 创建时间/更新时间 ====== -->
                                        <div class="card-bottom-row">
                                            <div class="card-bottom-tags">
                                                <template v-if="CardBottomTagFieldList && CardBottomTagFieldList.length > 0">
                                                    <template v-for="tagField in CardBottomTagFieldList" :key="'bottom-tag-' + tagField.Id">
                                                        <template v-if="item[(tagField.AsName || tagField.Name)] != null && item[(tagField.AsName || tagField.Name)] !== ''">
                                                            <span v-if="isMuban(tagField, { row: item })" v-safe-html="item[tagField.Name + '_TmpEngineResult']" class="card-tag-html"></span>
                                                            <el-tag v-else size="small" class="card-bottom-tag" effect="plain" type="info">{{ GetColValue({ row: item }, tagField) }}</el-tag>
                                                        </template>
                                                    </template>
                                                </template>
                                                <template v-else>
                                                    <span class="card-update-time" v-if="item.UpdateTime">更新 {{ formatCardTime(item.UpdateTime) }}</span>
                                                </template>
                                            </div>
                                            <span class="card-create-time" v-if="item.CreateTime">创建 {{ formatCardTime(item.CreateTime) }}</span>
                                        </div>
                                    </div>
                                </div>
                                <!-- ====== 操作按钮区域 ====== -->
                                <div class="card-actions" @click.stop>
                                    <!--Fix by Anderson for 小赵：移动端也需要选中功能以便V8按钮操作，下面不能增加【&&!diyStore.IsPhoneView】-->
                                    <div v-if="IsOpenTableSingleSelect()"
                                        class="card-radio-wrapper"
                                        @click.stop="selectOpenTableSingleRow(item)"
                                        style="flex:1;justify-content:left;">
                                        <el-radio
                                            class="open-table-row-radio"
                                            :model-value="TableSelectedRow && TableSelectedRow.Id"
                                            :label="item.Id"
                                        />
                                    </div>
                                    <div v-else-if="CanUseTableSelection()"
                                        class="card-checkbox-wrapper"
                                        @click.stop="toggleCardSelection(item)"
                                        style="flex:1;justify-content:left;">
                                        <el-checkbox :model-value="isCardSelected(item)" />
                                    </div>
                                    <el-button
                                        v-for="(btn, btnIndex) in item._RowMoreBtnsOut"
                                        :key="TypeFieldName + 'card_btn_out_' + item.Id + btnIndex"
                                        v-show="!IsTrashMode && btn.IsVisible && !TableChildField.Readonly"
                                        :type="GetMoreBtnStyle(btn)"
                                        class="card-action-btn"
                                        :loading="BtnV8Loading"
                                        @click.stop="RunMoreBtn(btn, item)"
                                        size="small"
                                        round
                                    >
                                        <fa-icon :icon="btn.Icon || 'fa-solid fa-file-code'" />
                                        {{ btn.Name }}
                                    </el-button>
                                    <el-button
                                        v-if="!IsWorkFlowMenu() && _LimitEdit && TableChildFormMode != 'View' && !TableChildField.Readonly && item.IsVisibleEdit"
                                        class="card-action-btn"
                                        @click.stop="OpenDetail(item, 'Edit')"
                                        size="small"
                                        round
                                        type="primary"
                                        plain
                                    >
                                        <el-icon><Edit /></el-icon>
                                        {{ $t('Msg.Edit') }}
                                    </el-button>
                                    <el-button
                                        v-if="IsTrashMode"
                                        class="card-action-btn"
                                        @click.stop="RestoreTrashRow(item)"
                                        size="small"
                                        round
                                        type="success"
                                        plain
                                    >
                                        <el-icon><RefreshLeft /></el-icon>
                                        恢复
                                    </el-button>
                                    <!--工作流-去处理 按钮（OpenType=='WorkFlow' 时显示）-->
                                    <el-button
                                        v-if="IsWorkFlowMenu() && item._IsInTableAdd !== true"
                                        class="card-action-btn"
                                        :loading="BtnLoading"
                                        @click.stop="OpenWorkFlowProcess(item)"
                                        size="small"
                                        round
                                        type="primary"
                                    >
                                        <fa-icon icon="far fa-clipboard-check" />
                                        去处理
                                    </el-button>
                                    <template v-if="!IsTrashMode && item._RowMoreBtnsIn && item._RowMoreBtnsIn.length > 0">
                                        <el-button
                                            v-for="(btn, btnIndex) in item._RowMoreBtnsIn"
                                            :key="TypeFieldName + 'card_btn_in_' + item.Id + btnIndex"
                                            v-show="btn.IsVisible && !TableChildField.Readonly"
                                            class="card-action-btn"
                                            @click.stop="RunMoreBtn(btn, item)"
                                            size="small"
                                            round
                                            plain
                                        >
                                            <fa-icon :icon="!btn.Icon ? 'far fa-check-circle' : btn.Icon" class="mr-1" />
                                            {{ btn.Name }}
                                        </el-button>
                                    </template>
                                    <!-- 更多操作（三点菜单） -->
                                    <el-dropdown
                                        v-if="_LimitDel && TableChildFormMode != 'View' && !TableChildField.Readonly && item.IsVisibleDel"
                                        trigger="click"
                                        @click.stop
                                    >
                                        <el-button class="card-action-btn card-action-btn-more" size="small" round plain @click.stop>
                                            <el-icon><MoreFilled /></el-icon>
                                            更多
                                        </el-button>
                                        <template #dropdown>
                                            <el-dropdown-menu>
                                                <el-dropdown-item @click="DelDiyTableRow(item)" style="color: #f56c6c;">
                                                    <el-icon><Delete /></el-icon>
                                                    {{ $t('Msg.Delete') }}
                                                </el-dropdown-item>
                                            </el-dropdown-menu>
                                        </template>
                                    </el-dropdown>
                                </div>
                            </el-card>
                        </el-col>
                </el-row>
                <el-pagination
                    v-if="(!TableChildConfig || (TableChildConfig && !TableChildConfig.DisablePagination)) && !diyStore.IsPhoneView"
                    style="margin-top: 10px; float: left; margin-bottom: 5px; clear: both; margin-left: 10px"
                    background
                    layout="total, sizes, prev, pager, next, jumper"
                    :total="DiyTableRowCount"
                    :page-sizes="DiyCommon.PageSizes"
                    :current-page="DiyTableRowPageIndex"
                    :page-size="DiyTableRowPageSize"
                    @size-change="DiyTableRowSizeChange"
                    @current-change="DiyTableRowCurrentChange"
                />
                <!-- 移动端加载更多提示（支持上拉触发或点击触发，子表场景需点击加载） -->
                <div v-if="diyStore.IsPhoneView && (_mobileTotalLoaded || DiyTableRowList.length) < DiyTableRowCount"
                    class="mobile-load-more"
                    :class="{ 'is-clickable': !mobileLoadingMore }"
                    @click="!mobileLoadingMore && loadMoreMobileData()">
                    <div v-if="mobileLoadingMore" class="loading-text">
                        <el-icon class="is-loading"><Loading /></el-icon>
                        <span>正在加载更多数据... ({{ _mobileTotalLoaded || DiyTableRowList.length }}/{{ DiyTableRowCount }})</span>
                    </div>
                    <div v-else class="load-more-text">
                        <span>上拉或点击加载更多 (已加载 {{ _mobileTotalLoaded || DiyTableRowList.length }}/{{ DiyTableRowCount }})</span>
                    </div>
                </div>
                <div v-if="diyStore.IsPhoneView && (_mobileTotalLoaded || DiyTableRowList.length) >= DiyTableRowCount && DiyTableRowCount > 0" class="mobile-no-more">
                    <span>已加载全部 {{ DiyTableRowCount }} 条数据</span>
                </div>
            </el-card>
        </el-tabs>

        <!-- 性能优化V3：全局共享的更多操作菜单，只实例化一次 -->
        <teleport to="body">
            <div
                v-show="_moreMenuVisible"
                ref="globalMoreMenu"
                class="global-more-menu"
                :style="{ top: _moreMenuPosition.top + 'px', left: _moreMenuPosition.left + 'px' }"
                @click.stop
            >
                <div
                    v-if="!IsWorkFlowMenu() && _LimitEdit && _moreMenuRow && _moreMenuRow._IsInTableAdd !== true && _moreMenuRow.IsVisibleEdit == true"
                    class="global-more-menu-item"
                    @click="handleMoreMenuAction('edit')"
                >
                    <el-icon><Edit /></el-icon>
                    <span>{{ $t("Msg.Edit") }}</span>
                </div>
                <template v-if="!IsTrashMode && _moreMenuRow && _moreMenuRow._RowMoreBtnsIn && _moreMenuRow._RowMoreBtnsIn.length > 0">
                    <template v-for="(btn, btnIndex) in _moreMenuRow._RowMoreBtnsIn" :key="'global_more_btn_' + btnIndex">
                        <div v-if="btn.IsVisible" class="global-more-menu-item" @click="handleMoreMenuAction('custom', btn)">
                            <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                            <span>{{ btn.Name }}</span>
                        </div>
                    </template>
                </template>
                <div
                    v-if="_LimitDel && _moreMenuRow && _moreMenuRow.IsVisibleDel == true"
                    class="global-more-menu-item global-more-menu-item-danger"
                    @click="handleMoreMenuAction('delete')"
                >
                    <el-icon><Delete /></el-icon>
                    <span>{{ $t("Msg.Delete") }}</span>
                </div>
            </div>
        </teleport>

        <!--弹窗/抽屉/全新页面 打开Form（已迁移到 diy-form-full.vue）-->
        <!--抽屉或弹窗打开完整的Form-->

        <!-- 列头右键菜单 -->
        <teleport to="body">
            <div
                v-show="_colMenuVisible"
                ref="globalColMenu"
                class="global-col-header-menu"
                :style="{ top: _colMenuPosition.top + 'px', left: _colMenuPosition.left + 'px', maxHeight: _colMenuPosition.maxHeight ? _colMenuPosition.maxHeight + 'px' : undefined }"
                @click.stop
            >
                <!-- 升序 -->
                <div class="global-col-menu-item" :class="{ 'is-active': _colMenuSortState === 'asc' }" @click="colMenuSort('asc')">
                    <el-icon><SortUp /></el-icon>
                    <span>升序排列</span>
                    <el-icon v-if="_colMenuSortState === 'asc'" class="col-menu-check"><Check /></el-icon>
                </div>
                <!-- 降序 -->
                <div class="global-col-menu-item" :class="{ 'is-active': _colMenuSortState === 'desc' }" @click="colMenuSort('desc')">
                    <el-icon><SortDown /></el-icon>
                    <span>降序排列</span>
                    <el-icon v-if="_colMenuSortState === 'desc'" class="col-menu-check"><Check /></el-icon>
                </div>
                <div class="global-col-menu-divider"></div>
                <!-- 冻结列 -->
                <div class="global-col-menu-item" @click="colMenuToggleFixed()">
                    <el-icon><Lock /></el-icon>
                    <span>{{ _colMenuField && FixedFields.indexOf(_colMenuField.Id) > -1 ? '取消冻结列' : '冻结此列' }}</span>
                    <el-icon v-if="_colMenuField && FixedFields.indexOf(_colMenuField.Id) > -1" class="col-menu-check"><Check /></el-icon>
                </div>
                <!-- 隐藏此列 -->
                <div class="global-col-menu-item" @click="colMenuHideColumn()">
                    <el-icon><Hide /></el-icon>
                    <span>隐藏此列</span>
                </div>
                <!-- 恢复隐藏列（当有隐藏列时显示） -->
                <div v-if="_runtimeHiddenFields.length > 0" class="global-col-menu-item" @click="colMenuRestoreColumns()">
                    <el-icon><View /></el-icon>
                    <span>恢复隐藏列 ({{ _runtimeHiddenFields.length }})</span>
                </div>
                <!-- 保存列宽（仅管理员可见） -->
                <div v-if="GetCurrentUser._IsAdmin" class="global-col-menu-item" @click="colMenuSaveWidth()">
                    <el-icon><Rank /></el-icon>
                    <span>保存列宽</span>
                </div>
                <div class="global-col-menu-divider"></div>
                <!-- 筛选 -->
                <div class="global-col-menu-section-title">
                    <el-icon><Filter /></el-icon>
                    <span>筛选条件</span>
                </div>
                <div class="global-col-menu-filter" @click.stop>
                    <div v-if="_colMenuField" class="col-filter-body">
                        <!-- 操作符选择 -->
                        <el-select v-model="_colFilterOperator" size="small" style="width: 100%; margin-bottom: 8px;" placeholder="条件" :teleported="false">
                            <el-option v-for="op in getColFilterOperators()" :key="op.value" :label="op.label" :value="op.value" />
                        </el-select>
                        <!-- 根据字段类型显示不同输入 -->
                        <el-select
                            v-if="isColFilterOptionField()"
                            v-model="_colFilterValue"
                            size="small"
                            style="width: 100%; margin-bottom: 8px;"
                            :teleported="false"
                            multiple
                            collapse-tags
                            collapse-tags-tooltip
                            clearable
                            filterable
                            placeholder="选择一个或多个值"
                        >
                            <el-option
                                v-for="(opt, optIdx) in getColFilterOptions()"
                                :key="'col_filter_opt_' + optIdx"
                                :label="opt.label"
                                :value="opt.value"
                            />
                        </el-select>
                        <el-input
                            v-else-if="isColFilterTextInput()"
                            v-model="_colFilterValue"
                            size="small"
                            style="width: 100%; margin-bottom: 8px;"
                            clearable
                            placeholder="输入筛选值"
                            @keyup.enter="colMenuApplyAllFilters()"
                        />
                        <!-- 日期时间 -->
                        <el-date-picker
                            v-else-if="_colMenuField.Component === 'DateTime'"
                            v-model="_colFilterValue"
                            :type="getColFilterDateType()"
                            :value-format="getColFilterDateFormat()"
                            :teleported="false"
                            size="small"
                            style="width: 100%; margin-bottom: 8px;"
                            placeholder="选择日期"
                            clearable
                        />
                        <!-- 数字 -->
                        <el-input-number
                            v-else-if="_colMenuField.Type && (_colMenuField.Type.toLowerCase().indexOf('int') > -1 || _colMenuField.Type.toLowerCase().indexOf('decimal') > -1)"
                            v-model="_colFilterValue"
                            size="small"
                            style="width: 100%; margin-bottom: 8px;"
                            controls-position="right"
                            placeholder="输入数值"
                        />
                        <!-- 默认文本输入 -->
                        <el-input
                            v-else
                            v-model="_colFilterValue"
                            size="small"
                            style="width: 100%; margin-bottom: 8px;"
                            clearable
                            placeholder="输入筛选值"
                            @keyup.enter="colMenuApplyAllFilters()"
                        />
                    </div>
                </div>
                <div class="global-col-menu-divider"></div>
                <!-- 当页筛选 -->
                <div class="global-col-menu-section-title">
                    <el-icon><Filter /></el-icon>
                    <span>当页筛选条件</span>
                </div>
                <div class="global-col-menu-filter col-page-filter" @click.stop>
                    <div v-if="_colMenuField" class="col-filter-body">
                        <el-input
                            v-model="_colPageFilterKeyword"
                            size="small"
                            class="col-page-filter-search"
                            clearable
                            placeholder="搜索"
                        >
                            <template #suffix>
                                <el-icon><Search /></el-icon>
                            </template>
                        </el-input>
                        <el-checkbox
                            :model-value="isColPageFilterAllChecked()"
                            :indeterminate="isColPageFilterIndeterminate()"
                            @change="colPageFilterToggleAll"
                        >
                            全选
                        </el-checkbox>
                        <div class="col-page-filter-options" v-if="getColPageFilterOptions().length > 0">
                            <el-checkbox-group v-model="_colPageFilterSelectedValues">
                                <el-checkbox
                                    v-for="opt in getColPageFilterOptions()"
                                    :key="opt.key"
                                    :label="opt.key"
                                    :title="opt.label"
                                    class="col-page-filter-option"
                                >
                                    <span class="col-page-filter-option-label">{{ opt.label }}</span>
                                    <span class="col-page-filter-option-count">({{ opt.count }})</span>
                                </el-checkbox>
                            </el-checkbox-group>
                        </div>
                        <div v-else class="col-page-filter-empty">暂无可筛选值</div>
                        <div class="col-page-filter-selected">已选{{ _colPageFilterSelectedValues.length }}项</div>
                        <div class="col-filter-actions">
                            <el-button size="small" @click="colMenuClearFilter()">清除</el-button>
                            <el-button size="small" type="primary" @click="colMenuApplyAllFilters()">筛选</el-button>
                        </div>
                    </div>
                </div>
            </div>
        </teleport>

        <DiyFormDialog v-if="_shouldRenderDiyFormDialog"
            @CallbackGetDiyTableRow="GetDiyTableRow"
            @ParentFormSet="ParentFormSet"
            :FatherFormModel="FatherFormModel"
            :ParentV8="ParentV8_Data ? ParentV8_Data : ParentV8"
            ref="refDiyTable_DiyFormDialog"></DiyFormDialog>

        <!--导入功能-->
        <DiyImportDialog
            ref="refDiyImportDialog"
            :tableId="TableId"
            :sysMenuModel="SysMenuModel"
            :isAdmin="GetCurrentUser._IsAdmin"
            :tableChildFkFieldName="TableChildFkFieldName"
            :fatherFormModelData="FatherFormModel_Data"
            :primaryTableFieldName="PrimaryTableFieldName"
            :tableChildTableRowId="TableChildTableRowId"
            @import-success="GetDiyTableRow({ _PageIndex: 1 })"
        />
        <!-- :DataAppend="GetDiyCustomDialogDataAppend()" -->
        <!-- :visible="DiyCustomDialogConfig.Visible" -->
        <DiyCustomDialog
            v-if="_shouldRenderDiyCustomDialog"
            :DataAppend="GetDiyCustomDialogDataAppend()"
            :OpenType="DiyCustomDialogConfig.OpenType"
            :title="DiyCustomDialogConfig.Title"
            :TitleIcon="DiyCustomDialogConfig.TitleIcon"
            :width="DiyCustomDialogConfig.Width"
            :ComponentName="DiyCustomDialogConfig.ComponentName"
            :ComponentPath="DiyCustomDialogConfig.ComponentPath"
            ref="refDiyCustomDialog"
        ></DiyCustomDialog>

        <el-dialog
            v-if="ShowAnyTable"
            draggable
            align-center
            :modal="true"
            :width="'80%'"
            :modal-append-to-body="true"
            :append-to-body="true"
            v-model="ShowAnyTable"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :destroy-on-close="true"
            :show-close="false"
            class="dialog-opentable"
        >
            <template #header>
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div class="pull-left" style="color: rgb(0, 0, 0); font-size: 15px">
                        <fa-icon :icon="'fas fa-table'" />
                        {{ $t('Msg.PopupTable') }}{{ OpenAnyTableParam.TableName ? "[" + OpenAnyTableParam.TableName + "]" : "" }}
                    </div>
                    <div class="pull-right">
                        <el-button :loading="BtnLoading" type="primary" :icon="BtnLoading ? undefined : CircleCheck" @click="RunOpenAnyTableSubmitEvent()">
                            {{ $t("Msg.Submit") }}
                        </el-button>
                        <el-button :icon="Close" @click="ShowAnyTable = false">
                            {{ $t("Msg.Close") }}
                        </el-button>
                    </div>
                </div>
            </template>
             <!-- style="background-color: #ebeef5" -->
            <el-row>
                <el-col :span="6" v-if="OpenAnyTableParam.ShowLeftSelectionList || false">
                    <DiyCardSelect :tableSelectRow="OpenAnyTableParam" @getOpenAnyTableParam="getOpenAnyTableParam" />
                </el-col>
                <el-col :span="OpenAnyTableParam.ShowLeftSelectionList || false ? 18 : 24">
                    <el-card class="box-card">
                        <DiyTableChild
                            :TypeFieldName="OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey"
                            :ref="'refOpenAnyTable_' + (OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey)"
                            :key="'refOpenAnyTable_' + (OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey)"
                            :PropsTableType="'OpenTable'"
                            @getOpenAnyTableParam="getOpenAnyTableParam"
                            :PropsSysMenuId="OpenAnyTableParam.SysMenuId"
                            :PropsModuleEngineKey="OpenAnyTableParam.ModuleEngineKey"
                            :PropsTableId="OpenAnyTableParam.TableId"
                            :PropTableMultipleSelection="OpenAnyTableParam.TableIndexDataList || []"
                            :EnableMultipleSelect="OpenAnyTableParam.MultipleSelect"
                            :PropsWhere="OpenAnyTableParam.PropsWhere"
                        />
                    </el-card>
                </el-col>
            </el-row>
        </el-dialog>

        <!-- 菜单权限设置弹窗 -->
        <DiyPermissionDialog
            ref="refDiyPermissionDialog"
            :sysMenuModel="SysMenuModel"
        />

        <!-- 索引管理弹窗 -->
        <DiyIndexManager
            v-if="ShowIndexManager"
            :visible="ShowIndexManager"
            :tableName="CurrentDiyTableModel.Name"
            :diyFieldList="DiyFieldList"
            :sysMenuId="SysMenuModel ? SysMenuModel.Id : ''"
            @close="ShowIndexManager = false"
        />

        <!-- 移动端搜索抽屉 -->
        <el-drawer
            v-model="showMobileSearch"
            direction="btt"
            size="80%"
            :modal="true"
            class="mobile-search-drawer"
            :title="$t('Msg.Search')"
        >
            <!-- 移动端更多搜索 -->
            <!-- zhy将点击选择单个值后弹框自动关闭改为点击遮罩层关闭或上方关闭按钮关闭，不然无法选中多个条件 @keyup.enter，@click，@CallbackGetDiyTableRow处的showMobileSearch = false移除-->
            <div class="mobile-keyword-search" v-if="IsPermission('NoSearch') && SysMenuModel && SysMenuModel.GeneralSeaarch !== 1" style="margin-bottom: 12px;">
                <el-input v-model="Keyword" :placeholder="$t('Msg.Search')" clearable @keyup.enter="GetDiyTableRow({ _PageIndex: 1 })">
                    <template #append><el-button :icon="Search" @click="GetDiyTableRow({ _PageIndex: 1 })"></el-button></template>
                </el-input>
            </div>
            <DiySearch
                v-if="SearchFieldIds.length > 0 && DiyFieldList.length > 0"
                :ref="'refDiySearchMobile'"
                :key="'refDiySearchMobile'"
                :CurrentDiyTableModel="CurrentDiyTableModel"
                :SearchFieldIds="SearchFieldIds"
                :DiyFieldList="DiyFieldList"
                :SearchType="'In'"
                @CallbackGetDiyTableRow="
                    (params) => {
                        GetDiyTableRow(params,2);
                    }
                "
                @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"
            />
        </el-drawer>
    </div>
</template>

<script>
import { computed } from "vue";
import { defineAsyncComponent } from "vue";
import { useDiyStore } from "@/pinia";
import { Base64 } from "js-base64";
import PanThumb from "@/components/PanThumb";
import DiyCardSelect from "@/views/form-engine/diy-card-select.vue";
import { initV8ScanCode } from "@/utils/v8-scan-code.js";
import { initV8Print } from "@/utils/v8-print.js";
import bodyBgSvg from "@/assets/img/body-bg.svg";
// Mixins
import {
    tableUtilsMixin,
    diyCommonMixin,
    diyTableCleanupMixin,
    diyTableUiMixin,
    diyTableActionsMixin,
    diyTableStateMixin,
    diyTableSchemaMixin,
    diyTableDataMixin,
    diyTableSelectionMixin,
    diyTableNavigationMixin,
    diyTableOperationsMixin
} from "./mixins";
// 独立组件
import DiyImportDialog from "@/views/form-engine/diy-components/DiyImportDialog.vue";
import DiyPermissionDialog from "@/views/form-engine/diy-components/DiyPermissionDialog.vue";
import DiyIndexManager from "@/views/form-engine/diy-components/DiyIndexManager.vue";
import DiySearch from "@/views/form-engine/diy-search.vue";
import DiyModleSearch from "@/views/form-engine/diy-mobile-search.vue";
export default {
    name: "DiyTableRowlist",
    directives: {},
    mixins: [
        tableUtilsMixin,
        diyCommonMixin,
        diyTableCleanupMixin,
        diyTableUiMixin,
        diyTableActionsMixin,
        diyTableStateMixin,
        diyTableSchemaMixin,
        diyTableDataMixin,
        diyTableSelectionMixin,
        diyTableNavigationMixin,
        diyTableOperationsMixin
    ],
    components: {
        DiyCardSelect,
        PanThumb,
        DiyImportDialog,
        DiyPermissionDialog,
        DiyIndexManager,
        DiySearch,
        DiyModleSearch,
        // Vue 3: 使用 defineAsyncComponent 包装动态 import
        DiyTableChild: defineAsyncComponent(() => import("@/views/form-engine/diy-table"))
    },
    setup(props) {
        const diyStore = useDiyStore();
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        const SysConfig = computed(() => diyStore.SysConfig);

        // 调试：检查 props 是否正确传递
        console.log('[DiyTableRowlist setup] ContainerClass:', props.ContainerClass);
        console.log('[DiyTableRowlist setup] PropsTableType:', props.PropsTableType);

        return {
            diyStore,
            GetCurrentUser,
            SysConfig,
            bodyBgSvg
        };
    },
    // Vue 3: 使用 beforeUnmount 替代 beforeDestroy（这是最关键的修复！）
    props: {
        TypeFieldName: { type: String, default: "" },
        // OpenTable、JoinTable、TableChild
        PropsTableType: { type: String, default: "" }, // 追加全能搜索条件：[{FieldName:'xxx',Value:'xx',Type:'='}]   Type可以的值：Equal、Like、In
        PropTableMultipleSelection: {
            type: Array,
            default() {
                return [];
            }
        },
        PropsWhere: { type: Array, default: () => [] },
        PropsIsJoinTable: { type: Boolean, default: false },
        ContainerClass: { type: String, default: "" },
        // 子表Field对象
        TableChildField: { type: Object, default: () => ({}) },
        JoinTableField: { type: Object, default: () => ({}) },
        PropsTableId: { type: String, default: "" },
        // 子表的DiyTableId
        TableChildTableId: { type: String, default: "" },
        // 子表模块配置Id
        TableChildSysMenuId: { type: String, default: "" },
        PropsSysMenuId: { type: String, default: "" },
        PropsModuleEngineKey: { type: String, default: "" },
        TableChildConfig: { type: Object, default: () => null },
        //
        TableChildFkFieldName: { type: String, default: "" },
        PrimaryTableFieldName: { type: String, default: "Id" },
        //
        TableChildCallbackField: { type: String, default: "" },
        // TableChildFkValue:{
        //     type: String,
        //     default: ''
        // },
        TableChildTableRowId: { type: String, default: "" },
        // 父表的model
        FatherFormModel: { type: Object, default: () => ({}) },
        ParentV8: { type: Object, default: () => ({}) },
        TableChildFormMode: { type: String, default: "" },
        // 子表数据，由DiyForm传进来，会直接赋值到Table表格
        TableChildData: { type: Array, default: () => [] },
        // 追加搜索条件.{'FieldName' : value, 'FieldName': value}
        SearchAppend: { type: Object, default: () => ({}) },
        // //设置搜索条件.{'FieldName' : value, 'FieldName': value}
        // SearchSet:{
        //     type: Object,
        //     default: () => ({})
        // },
        // 父级的所有字段对象
        PropsParentFieldList: { type: Object, default: () => ({}) },
        EnableMultipleSelect: { type: Boolean, default: false },
        // {FieldName1:value , FieldName2:value}
        FormDefaultValues: { type: Object, default: () => ({}) },
        DataAppend: { type: Object, default: () => ({}) },
        ParentFormLoadFinish: { type: Boolean, default: null },
        /**
         * 加载模式：可能是Design（表单设计）
         */
        LoadMode: { type: String, default: "" }
    },
    // 🔥 activated 钩子：组件被 keep-alive 激活时触发
    // 🔥 deactivated 钩子：组件被 keep-alive 停用时触发
    async created() {
        var self = this;
    },
    methods: {
      // ========== 移动端FAB拖拽 ==========
              //可传入外键Id值 、父表model
        GetConfiguredPageSizes() {
            var self = this;
            var pageSizes = [];
            if (self.SysConfig && self.SysConfig.PageSizes) {
                try {
                    var configPageSizes = typeof self.SysConfig.PageSizes === "string" ? JSON.parse(self.SysConfig.PageSizes) : self.SysConfig.PageSizes;
                    if (Array.isArray(configPageSizes)) {
                        pageSizes = configPageSizes;
                    }
                } catch (error) {
                    pageSizes = [];
                }
            }
            if ((!pageSizes || pageSizes.length == 0) && self.DiyCommon && Array.isArray(self.DiyCommon.PageSizes)) {
                pageSizes = self.DiyCommon.PageSizes;
            }
            return pageSizes.map(Number).filter((size) => size > 0).sort((a, b) => a - b);
        },
        GetDefaultTablePageSize(options = {}) {
            var self = this;
            var pageSizes = self.GetConfiguredPageSizes();
            var menuDefault = Number(options.menuDefault || (self.SysMenuModel && self.SysMenuModel.DefaultPageSize));
            if (menuDefault > 0 && (pageSizes.length == 0 || pageSizes.includes(menuDefault))) {
                return menuDefault;
            }
            var sysDefault = Number(self.DiyCommon && self.DiyCommon.DefaultPageSize);
            if (sysDefault > 0 && (pageSizes.length == 0 || pageSizes.includes(sysDefault))) {
                return sysDefault;
            }
            return pageSizes.length > 0 ? pageSizes[0] : 15;
        },
        NormalizeTablePageSize(size, options = {}) {
            var self = this;
            var pageSizes = self.GetConfiguredPageSizes();
            var pageSize = Number(size);
            if (pageSize > 0 && (pageSizes.length == 0 || pageSizes.includes(pageSize))) {
                return pageSize;
            }
            return self.GetDefaultTablePageSize(options);
        },
        async Init(parentFormModel, v8) {
            var self = this;

            if (self._IsTableChild) {
            }
            var queryKeyword = self.$route.query.Keyword;
            if (self._IsTableChild) {
                queryKeyword = "";
            }

            if (!self.DiyCommon.IsNull(queryKeyword)) {
                self.Keyword = queryKeyword;
            }
            if (self.EnableMultipleSelect === true) {
                self.TableEnableBatch = true;
            }
            //这是传过来的父级formModel，用于子表关联数据，里面也包含了FkId，就是parentFormModel.Id
            if (parentFormModel) {
                self.FatherFormModel_Data = parentFormModel;
                // self.FatherFormModel = parentFormModel;
            }
            if (v8) {
                // self.ParentV8 = v8;
                self.ParentV8_Data = v8;
            }
            self.DiyTableRowList = [];
            //如果是子表
            if (!self.DiyCommon.IsNull(self.TableChildTableId)) {
                self.TableId = self.TableChildTableId;
            } else if (!self.DiyCommon.IsNull(self.PropsTableId)) {
                self.TableId = self.PropsTableId;
            } else {
                self.TableId = self.$route.meta.DiyTableId;
            }
            if (!self.DiyCommon.IsNull(self.TableChildSysMenuId)) {
                self.SysMenuId = self.TableChildSysMenuId;
            } else if (!self.DiyCommon.IsNull(self.PropsSysMenuId)) {
                self.SysMenuId = self.PropsSysMenuId;
            } else {
                self.SysMenuId = self.$route.meta.Id;
            }
            //根据PropsModuleEngineKey查询出SysMenuId+TableId
            // 2025-10-29 liucheng 修复：在OpenTable模式下，如果已经通过PropsSysMenuId设置了SysMenuId，则不使用PropsModuleEngineKey覆盖
            if (self.PropsModuleEngineKey && (!self.PropsSysMenuId || self.PropsTableType !== "OpenTable")) {
                var sysMenuResult = await self.DiyCommon.PostAsync("/api/FormEngine/GetSysMenuModel", {
                    ModuleEngineKey: self.PropsModuleEngineKey
                });
                if (sysMenuResult.Code != 1) {
                    self.DiyCommon.Tips(sysMenuResult.Msg);
                    return;
                }
                self.SysMenuId = sysMenuResult.Data.Id;
                self.TableId = sysMenuResult.Data.DiyTableId;
            }
            if (!self.SysMenuId) {
                self.DiyCommon.Tips("未获取到模块引擎Id！");
                return;
            }

            if (!self.TableId) {
                var sysMenuResult = await self.DiyCommon.PostAsync("/api/FormEngine/GetSysMenuModel", {
                    ModuleEngineKey: self.SysMenuId
                });
                if (sysMenuResult.Code != 1) {
                    self.DiyCommon.Tips(sysMenuResult.Msg);
                    return;
                }
                self.TableId = sysMenuResult.Data.DiyTableId;
            }

            if (
                (!self.DiyCommon.IsNull(self.TableChildTableRowId) && !self.DiyCommon.IsNull(self.TableChildFkFieldName)) ||
                !self.DiyCommon.IsNull(self.FatherFormModel_Data)
                // || !self.DiyCommon.IsNull(self.FatherFormModel)
            ) {
                if (self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    // if (self.DiyCommon.IsNull(self.FatherFormModel.Id)) {
                    self.SetFieldFormDefaultValues(self.TableChildTableRowId);
                } else {
                    //2022-07-23新增也可能不跟主表的Id进行关联
                    if (self.PrimaryTableFieldName) {
                        self.SetFieldFormDefaultValues(self.FatherFormModel_Data[self.PrimaryTableFieldName]);
                    } else {
                        self.SetFieldFormDefaultValues(self.FatherFormModel_Data.Id);
                    }
                    // self.SetFieldFormDefaultValues(self.FatherFormModel.Id);
                }
            } else {
                //2022-02-17 有可能二次开发传过来的FormDefaultValues
                self.FieldFormDefaultValues = { ...self.FormDefaultValues };
            }
            // 取缓存中的 DiyTableRowPageSize
            // this.DiyCommon.DefaultPageSize || this.DefaultPageSize
            try {
                var cacheDiyTableRowPageSize = self.$localStorageManager ? self.$localStorageManager.getTableConfig(self.TableId) : localStorage.getItem("Microi.DiyTableRowPageSize_" + self.TableId);
                self.DiyTableRowPageSize = self.NormalizeTablePageSize(cacheDiyTableRowPageSize);
            } catch (error) {
                self.DiyTableRowPageSize = self.GetDefaultTablePageSize();
            }
            //这里修改，应该是先取SysMenuModel，再取DiyTableRow数据，因为SysMenuModel可能包含Tabs设置的条件
            self.GetAllData({ IsInit: true });

            self.$nextTick(function () {
                self.SetDiyTableMaxHeight();
            });
        },
        async FieldOnKeyup(event, field, scope) {
            var self = this;
            var keyCode = event.keyCode;
            // 判断需要执行的V8
            if (!self.DiyCommon.IsNull(field.KeyupV8Code)) {
                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                V8.KeyCode = keyCode;
                V8.EventName = "FieldOnKeyup";
                V8.RowIndex = scope.$index;
                V8.Field = field;
                V8.Form = scope.row;
                V8.Row = scope.row;
                V8.EventName = "TableFieldOnKeyup";
                V8.Rows = self.DiyTableRowList;
                V8.SetCurrentRow = self.DiyTableSetCurrentRow;
                self.SetV8DefaultValue(V8);

                try {
                    // eval(field.KeyupV8Code)
                    await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + field.KeyupV8Code + " \n})()");
                } catch (error) {
                    self.DiyCommon.Tips("执行按键事件V8引擎代码出现错误：" + error.message, false);
                } finally {

                }
            }
        },
        async DiyTableRowClick(row, column, event) {
            var self = this;
            // 🔥 性能优化：用纯 DOM 方式高亮当前行，替代 Element Plus 的 highlight-current-row。
            // highlight-current-row 会在每次点击时改变表格 store 的 currentRow，导致整个表体重新渲染、
            // 重跑所有单元格函数（isMuban/ShowSelectLabel/GetColValue 等），100~200 行时点击/双击会明显卡顿。
            self.ApplyCurrentRowHighlight(event);
            // 🔥 性能优化：先做 fast-path 判断，避免每次点击都同步初始化 V8 引擎（耗时 50-200ms）
            var hasInFormV8 = self._IsTableChild
                && self.TableSelectedRow.Id
                && self.TableSelectedRow.Id != self.TableSelectedRowLast.Id
                && !self.DiyCommon.IsNull(self.CurrentDiyTableModel.InFormV8);
            var hasRowClickV8 = !self.DiyCommon.IsNull(self.TableChildField)
                && !self.DiyCommon.IsNull(self.TableChildField.Config)
                && !self.DiyCommon.IsNull(self.TableChildField.Config.TableChildRowClickV8);

            // 没有任何 V8 要执行时：仅更新选中状态，立即返回（消除点击行卡顿）
            if (!hasInFormV8 && !hasRowClickV8) {
                // 浅拷贝避免暴露原始行的响应代理（行已 markRaw，但 spread 仍便宜）
                self.CurrentSelectedRowModel = { ...row };
                self.DiyTableCurrentChange(row);
                return;
            }

            var form = { ...row };
            // self.CurrentSelectedRowModel = self.DeleteFormProperty(form);
            self.CurrentSelectedRowModel = form;
            //执行表单进入V8事件
            //2021-01-19 新增：只有是子表的时候，才执行进入表单事件
            if (hasInFormV8) {
                // 判断需要执行的V8
                self.TableSelectedRowLast = { ...self.TableSelectedRow };
                if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.InFormV8)) {
                    var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                    // V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
                    V8.Form = form; // 当前Form表单所有字段值
                    // V8.Form = row;
                    V8.FormSet = (fieldName, value) => {
                        var result = self.FormSet(fieldName, value, row);
                        if (fieldName) {
                            var targetField = Array.isArray(self.DiyFieldList)
                                ? self.DiyFieldList.find(function (item) {
                                    return item && (item.Name == fieldName || item.AsName == fieldName);
                                })
                                : null;
                            var targetFieldName = targetField && !self.DiyCommon.IsNull(targetField.AsName) ? targetField.AsName : fieldName;
                            form[fieldName] = value;
                            form[targetFieldName] = value;
                        }
                        return result;
                    }; // 给Form表单其它字段赋值
                    V8.EventName = "FormIn";
                    self.SetV8DefaultValue(V8);

                    try {
                        // eval(self.DiyTableModel.InFormV8)
                        await eval(
                            //"//" + field.Name + "(" + field.Label + ")" +
                            "(async () => {\n " + self.CurrentDiyTableModel.InFormV8 + " \n})()"
                        );
                    } catch (error) {
                        self.DiyCommon.Tips(`执行前端V8引擎代码出现错误[${self.CurrentDiyTableModel.Name}-InFormV8]：` + error.message, false);
                        console.log(`执行前端V8引擎代码出现错误[${self.CurrentDiyTableModel.Name}-InFormV8]：`, error, self.CurrentDiyTableModel, Base64);
                    } finally {

                    }
                }
            }

            //把这列对应的fieldModel查询出来，其实就是TableChildField，props传过来的
            // var V8 = v8 ? v8 : {};
            // 🔥 性能优化：只有真的有 TableChildRowClickV8 才初始化 V8
            //把这列对应的fieldModel查询出来，其实就是TableChildField，props传过来的
            // var V8 = v8 ? v8 : {};
            // 🔥 性能优化：只有真的有 TableChildRowClickV8 才初始化 V8
            if (hasRowClickV8) {
                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                try {
                    V8.Row = row;
                    var form2 = { ...row };
                    V8.Form = form2; // 当前Form表单所有字段值
                    if (!V8.FormSet) {
                        V8.FormSet = (fieldName, value) => {
                            return self.FormSet(fieldName, value, row);
                        }; // 给Form表单其它字段赋值
                    }
                    V8.EventName = "TableRowClick";
                    self.SetV8DefaultValue(V8);

                    V8.RefreshChildTable = (field, parentFormModel) => {
                        return self.RefreshChildTable(field, parentFormModel, V8);
                    };
                    await eval("(async () => {\n " + self.TableChildField.Config.TableChildRowClickV8 + " \n})()");
                } catch (error) {
                    self.DiyCommon.Tips("执行前端V8引擎代码出现错误[" + self.TableChildField.Name + "," + self.TableChildField.Label + "]：" + error.message, false);
                }
            }
            // 为了卡片而实现，因为<el-table>有 @current-change="DiyTableCurrentChange"
            self.DiyTableCurrentChange(row);
        },
        async RunV8Code({ field, thisValue, row, callback }) {
            var self = this;
            var V8 = await self.DiyCommon.InitV8Code({}, self.$router);;
            try {
                if (field
                    && (field.V8Code || (field.Config && field.Config.V8Code))) {
                    var fieldModelName = self.DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName;
                    var hasNewValue = thisValue && typeof thisValue == "object" && Object.prototype.hasOwnProperty.call(thisValue, "New");
                    var currentValue = hasNewValue ? thisValue.New : undefined;
                    if (row && currentValue !== undefined && field.Name) {
                        row[field.Name] = currentValue;
                        row[fieldModelName] = currentValue;
                    }
                    var form = { ...row };
                    if (currentValue !== undefined && field.Name) {
                        form[field.Name] = currentValue;
                        form[fieldModelName] = currentValue;
                    }
                    // V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
                    V8.Form = form; // 当前Form表单所有字段值
                    V8.OldForm = self.OldDiyTableRowList.find((item) => item.Id == row.Id);
                    // V8.Form = row;
                    V8.ThisValue = thisValue;
                    V8.FormSet = (fieldName, value) => {
                        var result = self.FormSet(fieldName, value, row);
                        if (fieldName) {
                            var targetField = Array.isArray(self.DiyFieldList)
                                ? self.DiyFieldList.find(function (item) {
                                    return item && (item.Name == fieldName || item.AsName == fieldName);
                                })
                                : null;
                            var targetFieldName = targetField && !self.DiyCommon.IsNull(targetField.AsName) ? targetField.AsName : fieldName;
                            form[fieldName] = value;
                            form[targetFieldName] = value;
                        }
                        return result;
                    };
                    V8.RefreshChildTable = self.RefreshChildTable;
                    V8.EventName = "FieldValueChange";
                    self.SetV8DefaultValue(V8, field);
                    V8.RefreshTable = (param) => {
                        var refreshParam = param || {};
                        self._PendingFieldValueChangeRefreshParam = refreshParam;
                        setTimeout(function () {
                            if (self._PendingFieldValueChangeRefreshParam === refreshParam) {
                                self._PendingFieldValueChangeRefreshParam = null;
                                self.GetDiyTableRow(refreshParam);
                            }
                        }, 3000);
                        return true;
                    };

                    // eval(btn.V8Code)
                    var V8Result = await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + (field.V8Code || (field.Config && field.Config.V8Code)) + " \n})()");
                    if (V8Result !== undefined) {
                        callback && callback(V8.Result || V8Result);
                        return V8Result;
                    }
                    callback && callback(V8.Result);
                    return null;
                } else {
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误[" + field.Name + "," + field.Label + "]：" + error.message, false);
                callback && callback(null);
                return null;
            } finally {

            }
        },
        SetV8DefaultValue(V8, field) {
            var self = this;
            if(!V8.Form){
                V8.Form = self.CurrentSelectedRowModel;
                V8.FormSet = (fieldName, value) => {
                    return self.FormSet(fieldName, value, self.CurrentSelectedRowModel);
                };
            }
            if (!V8.CurrentUser) {
                V8.CurrentUser = self.GetCurrentUser;
            }
            V8.SearchParam = {
                //2025-08-20新增v8可访问搜索参数
                Keyword: self.Keyword,
                Where: self.Where
            };
            V8.OpenAnyForm = self.OpenAnyForm;
            V8.OpenAnyTable = self.OpenAnyTable;
            V8.OpenDialog = self.OpenDialog;
            self.FormWF = self.GetFormWF();
            V8.FormWF = self.FormWF;
            V8.TableId = self.TableId;
            V8.TableName = self.CurrentDiyTableModel.Name;
            V8.TableModel = self.CurrentDiyTableModel;
            V8.DataAppend = self.DataAppend;
            V8.HideFormBtn = self.CallbackHideFormBtn;
            V8.TableRowSelected = self.TableMultipleSelection;
            V8.SelectedData = self.TableMultipleSelection;
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
            V8.SearchSet = self.SearchSetFunc;
            V8.SetV8SearchModel = self.SetV8SearchModel;
            //2011-11-22注释
            // V8.Field = self.PropsParentFieldList;
            // 内存优化：缓存 diyFieldList，避免每次都重新创建
            if (!self._cachedDiyFieldList || self._cachedDiyFieldListVersion !== self.DiyFieldList.length) {
                self._cachedDiyFieldList = {};
                self.DiyFieldList.forEach((element) => {
                    self._cachedDiyFieldList[element.Name] = element;
                });
                self._cachedDiyFieldListVersion = self.DiyFieldList.length;
            }
            V8.Field = self._cachedDiyFieldList;
            V8.ShowTableChildHideField = self.ShowTableChildHideField;

            V8.FieldSet = self.FieldSet;
            V8.CurrentTableData = self.DiyTableRowList;
            // V8.GetChildTableData = '';
            V8.FormClose = self.CallbackFormClose;
            // 注册 V8.Method.ScanCode 扫码功能
            initV8ScanCode(V8);
            // 注册 V8.Print 蓝牙打印功能
            initV8Print(V8);
            return V8;
        },
        async tabClickRowList(tab) {
            var self = this;
            // // 切换了tab后，需要重载控件拖动
            // self.$nextTick(function () {
            //     self.$emit('CallbackLoadDragula', tab.index)
            // })
            // if (tab.name == 'MapHourse') {
            //     self.$router.push('/aiju-map/find-by-map');
            // }else if (tab.name == 'SchoolHourse') {
            //     self.$router.push('/aiju-map/find-by-map');
            // }
            self.InitSearch();

            // var tabModel = self.GetPageTabs()[parseInt(tab.index)];
            var tabModel = self.SysMenuModel.PageTabs.filter((item) => item.IsVisible)[parseInt(tab.index)];
            self.CurrentTableRowListActiveTab = tabModel;
            //执行V8
            //注意：这里要设置搜索条件.V8.SetV8SearchModel({FieldName : value , FieldName2 : value});
            if (!self.DiyCommon.IsNull(tabModel.V8Code)) {
                await self.RunPageTabV8Code(tabModel.V8Code);
            }
            //2020-10-22新增，选择tab，重新查询数据
            self.GetDiyTableRow({ _PageIndex: 1 });
        },
        async RunPageTabV8Code(v8code) {
            var self = this;
            var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
            var V8 = {
                EventName: "PageTab"
            };
            self.SetV8DefaultValue(V8);

            try {
                // eval(tabModel.V8Code)
                // eval(v8code)
                await eval("(async () => {\n " + v8code + " \n})()");
            } catch (error) {
                self.DiyCommon.Tips("执行多Tab页签V8引擎代码出现错误：" + error.message, false);
            } finally {

            }
        },
        RunFieldTemplateEngine(field, row) {
            var self = this;
            var V8 = self.DiyCommon.InitV8CodeSync({}, self.$router);
            V8.Result = undefined;
            V8.Field = field;
            V8.EventName = "TableTemplateEngine";
            // 关键修复：先调用SetV8DefaultValue设置全局属性，再设置V8.Form=row避免被覆盖
            self.SetV8DefaultValue(V8);
            V8.Form = row;
            V8.Row = row;

            var result = null;
            var returnValue = null;
            try {
                // 执行V8代码，同时捕获return返回值（同步版本）
                returnValue = eval("(function() {\n " + field.V8TmpEngineTable + " \n})()");

                // 优先使用V8.Result，当V8.Result为undefined或null时使用return返回值
                if (V8.Result !== undefined && V8.Result !== null) {
                    result = V8.Result;
                } else if (returnValue !== undefined && returnValue !== null) {
                    result = returnValue;
                } else {
                    result = self.GetColValue({ row: row }, field);
                }
            } catch (error) {
                self.DiyCommon.Tips("执行V8模板引擎代码出现错误[" + field.Name + "," + field.Label + "]：" + error.message, false);
                result = self.GetColValue({ row: row }, field);
            } finally {


            }
            return result;
        },
        //tableRowModel:行数据/表单数据
        //isDefaultOpen：是否默认打开，默认打开不会跳走到定制界面
        //formMode:表单打开方式 Add/View/Edit
        //isOpenWorkFlowForm
        //wfParam：{WorkType:'StartWork(发起流程)/ViewWork(查看流程)',FlowDesignId:''}
        async OpenDetail(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam) {
            var self = this;
            if (self.IsTrashMode) {
                formMode = "View";
            }

            self.BtnLoading = true;
            self.FormMode = formMode;

            self.ShowUpdateBtn = true;
            self.ShowDeleteBtn = true;
            self.ShowSaveBtn = true;
            //根据代码判断详情页编辑按钮是否显示2025-5-1刘诚
            if (self.SysMenuModel && self.SysMenuModel.EditCodeShowV8) {
                self.ShowUpdateBtn = await self.LimitMoreBtn1(self.SysMenuModel.EditCodeShowV8, tableRowModel, "EditCodeSowV8");
            }

            self.TableRowId = self.DiyCommon.IsNull(tableRowModel) ? "" : tableRowModel.Id;
            if (self.FormMode == "Add" || self.FormMode == "Insert") {
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
            } else {
                self.$nextTick(function () {
                    self.OpenDetailHandler(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam);
                });
            }
        },
        async OpenDetailHandler(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam) {
            var self = this;
            if (formMode == "Add" && !self.DiyCommon.IsNull(self.SysMenuModel.AddPageV8)) {
                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                V8.Form = tableRowModel;
                V8.FormSet = (fieldName, value) => {
                    return self.FormSet(fieldName, value, row);
                }; // 给Form表单其它字段赋值
                V8.GetDiyTableRow = self.GetDiyTableRow;
                V8.EventName = "BtnFormDetailRun";
                self.SetV8DefaultValue(V8);

                try {
                    await eval("(async () => {\n " + self.SysMenuModel.AddPageV8 + " \n})()");
                } catch (error) {
                    self.DiyCommon.Tips("执行新增按钮V8代码出现错误：" + error.message, false);
                } finally {

                }
                self.BtnLoading = false;
                return;
            } else if (formMode == "View" && !self.DiyCommon.IsNull(self.SysMenuModel.DetailPageV8)) {
                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                V8.Form = tableRowModel;
                V8.FormSet = (fieldName, value) => {
                    return self.FormSet(fieldName, value, row);
                }; // 给Form表单其它字段赋值
                V8.GetDiyTableRow = self.GetDiyTableRow;
                V8.EventName = "BtnFormDetailRun";
                self.SetV8DefaultValue(V8);

                if (!self.DiyCommon.IsNull(self.TableRowId)) {
                    V8.Form.Id = self.TableRowId;
                    //liucheng升级左右导航结构页面赋值 2025-7-15
                    if (self.ParentV8) {
                        V8.ParentV8 = self.ParentV8;
                    }
                }
                try {
                    // eval(self.SysMenuModel.DetailPageV8);
                    await eval("(async () => {\n " + self.SysMenuModel.DetailPageV8 + " \n})()");
                } catch (error) {
                    self.DiyCommon.Tips("执行详情按钮V8代码出现错误：" + error.message, false);
                } finally {

                }
                self.BtnLoading = false;
                return;
            } else {
                self.FieldFormSelectFields = [];
                self.FieldFormFixedTabs = [];
            }

            // 移动端模式下，也使用抽屉模式打开表单（而非路由跳转）
            // diy-form-full.vue 中已通过 pushState + popstate 拦截手势返回关闭抽屉
            // 这样可以保留列表滚动位置
            // 2026-02-08 Anderson：如果是在弹窗中打开了表格，此时不应该跳走！
            var isOpenPage = false;
            if(self.$route.path.startsWith('/diy/form-page/')){
                isOpenPage = false;
            }
            // 工作流模式不支持Page路由跳转（路由无法传递工作流参数），强制使用抽屉模式
            if (isOpenWorkFlowForm) {
                isOpenPage = false;
            }

            if (isOpenPage) {
                var url = `/diy/form-page/${self.TableId}`;
                if (!self.DiyCommon.IsNull(tableRowModel)) {
                    url += `/${tableRowModel.Id}`;
                }
                url += `?FormMode=${self.FormMode}&SysMenuId=${self.SysMenuId}&time=${new Date().getTime()}`;
                self.BtnLoading = false;
                self.$router.push(url);
                return;
            }
            if (self.CurrentDiyTableModel.FormOpenType == "Dialog" || self.CurrentDiyTableModel.FormOpenType == "Drawer" || self.DiyCommon.IsNull(self.CurrentDiyTableModel.FormOpenType)) {
                //2021-10-29新增，如果是行内新增
                if (self.SysMenuModel && self.SysMenuModel.AddBtnType == "InTable" && formMode == "Add") {
                    //2022-02-13 提前将Id赋值好，以便删除
                    var newIdResult = await self.DiyCommon.PostAsync("/api/FormEngine/NewGuid", {});
                    //加入回写默认值  2021-12-06
                    var defaultModel = { ...self.FieldFormDefaultValues };
                    defaultModel.Id = newIdResult.Data;
                    defaultModel._IsInTableAdd = true;
                    defaultModel._RowMoreBtnsOut = [];
                    defaultModel._RowMoreBtnsIn = [];
                    self.DiyTableRowList.push(defaultModel);
                    self.BtnLoading = false;
                } else {
                    // 已迁移至 diy-form-full.vue，通过 refDiyTable_DiyFormDialog 统一打开
                    var dialogType = self.CurrentDiyTableModel.FormOpenType || "Drawer";
                    var openFormDialogToken = (self._openFormDialogToken || 0) + 1;
                    self._openFormDialogToken = openFormDialogToken;
                    if (self._openFormDialogTimer) {
                        try { clearTimeout(self._openFormDialogTimer); } catch (e) {}
                        self._openFormDialogTimer = null;
                    }
                    // 延迟渲染：首次调用时才渲染组件
                    const initFormDialog = () => {
                        if (self._isDestroyed || openFormDialogToken !== self._openFormDialogToken) {
                            return false;
                        }
                        var formDialog = self.$refs.refDiyTable_DiyFormDialog;
                        if (Array.isArray(formDialog)) {
                            formDialog = formDialog[0];
                        }
                        if (!formDialog || typeof formDialog.Init !== 'function') {
                            return false;
                        }
                        formDialog.Init({
                            TableId: self.TableId,
                            TableName: self.CurrentDiyTableModel.Name,
                            SysMenuId: self.SysMenuId,
                            Id: self.TableRowId,
                            FormMode: self.FormMode,
                            DialogType: dialogType,
                            SelectFields: self.FieldFormSelectFields,
                            DefaultValues: self.FieldFormDefaultValues,
                            FixedTabs: self.FieldFormFixedTabs,
                            HideFields: self.FieldFormHideFields,
                            ApiReplace: self.ApiReplace,
                            EventReplace: self.EventReplace,
                            DataAppend: self.DataAppend,
                            Width: self.CurrentDiyTableModel.FormOpenWidth || undefined,
                            IsDefaultOpen: isDefaultOpen,
                            IsOpenWorkFlowForm: isOpenWorkFlowForm,
                            WFParam: wfParam
                        });
                        self.BtnLoading = false;
                        self._openFormDialogTimer = null;
                        return true;
                    };

                    if (!self._shouldRenderDiyFormDialog) {
                        self._shouldRenderDiyFormDialog = true;
                    }
                    if (initFormDialog()) {
                        return;
                    } else {
                        var retryCount = 0;
                        var maxRetries = 100;
                        var tryInitFormDialog = function() {
                            if (self._isDestroyed || openFormDialogToken !== self._openFormDialogToken) {
                                return;
                            }
                            if (initFormDialog()) {
                                return;
                            } else if (retryCount < maxRetries) {
                                retryCount++;
                                self._openFormDialogTimer = setTimeout(tryInitFormDialog, 50);
                            } else {
                                console.error('[OpenFormDialog] refDiyTable_DiyFormDialog 始终未挂载，已重试' + maxRetries + '次');
                                self.BtnLoading = false;
                                self._openFormDialogTimer = null;
                            }
                        };
                        self.$nextTick(tryInitFormDialog);
                    }
                }
            } else {
                var url = `/diy/form-page/${self.TableId}`;
                if (!self.DiyCommon.IsNull(tableRowModel)) {
                    url += `/${tableRowModel.Id}`;
                }
                url += `?FormMode=${self.FormMode}&SysMenuId=${self.SysMenuId}`;
                self.BtnLoading = false;
                self.$router.push(url);
            }
        },
        //2025-03-23编辑、删除按钮显示条件
        async LimitMoreBtn1(btn, row, EventName) {
            var self = this;
            var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
            //注释以下代码，v8 条件的显隐，即使是 admin，也应该根据 v8 条件结果走 --by anderson 2025-08-12
            // if (self.GetCurrentUser._IsAdmin === true) {
            //   return true;
            // }
            var result = false;
            try {
                // V8.Form = self.DeleteFormProperty(row); // 当前Form表单所有字段值
                V8.Form = row; // 当前Form表单所有字段值
                V8.EventName = EventName;
                self.SetV8DefaultValue(V8);
                await eval("(async () => {\n " + btn + " \n})()");
                result = V8.Result;
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
                result = false;
            } finally {
                // 内存优化：清理V8对象引用

            }
            return result;
        },

        // 同步版本：避免异步V8引擎带来的渲染阻塞
        LimitMoreBtn1Sync(btn, row, EventName) {
            var self = this;
            var V8 = self.DiyCommon.InitV8CodeSync({}, self.$router);
            var result = false;
            try {
                V8.Form = row;
                V8.EventName = EventName;
                self.SetV8DefaultValue(V8);
                eval("(function () {\n " + btn + " \n})()");
                result = V8.Result;
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误：" + error.message, false);
                result = false;
            } finally {

            }
            return result;
        },

        async FormSubmitAction(actionType, tableRowId, rowModel) {
            var self = this;
            if (self.DiyCommon.IsNull(self.CurrentDiyTableModel.Id)) {
                return;
            }
            // 判断需要执行的V8
            if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.SubmitFormV8)) {
                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                V8.Form = rowModel; // 当前Form表单所有字段值
                V8.FormSet = (fieldName, value) => {
                    return self.FormSet(fieldName, value, rowModel);
                }; // 给Form表单其它字段赋值
                V8.FormSubmitAction = actionType;
                V8.GetDiyTableRow = self.GetDiyTableRow;
                V8.EventName = "FormSubmitBefore";
                self.SetV8DefaultValue(V8);

                if (!self.DiyCommon.IsNull(tableRowId)) {
                    V8.Form.Id = tableRowId;
                }
                try {
                    // eval(self.CurrentDiyTableModel.SubmitFormV8)
                    await eval("(async () => {\n " + self.CurrentDiyTableModel.SubmitFormV8 + " \n})()");
                    return V8.Result;
                } catch (error) {
                    self.DiyCommon.Tips("执行表单提交前V8引擎代码出现错误：" + error.message, false);
                    return false;
                } finally {

                }
            }
            return;
        },
        //离开表单动作
        async FormOutAction(actionType, submitAfterType, tableRowId, V8Callback, rowModel) {
            var self = this;
            if (self.DiyCommon.IsNull(self.CurrentDiyTableModel.Id)) {
                return;
            }
            // 判断需要执行的V8
            if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.OutFormV8)) {
                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                V8.Form = rowModel; // 当前Form表单所有字段值
                V8.FormSet = (fieldName, value) => {
                    return self.FormSet(fieldName, value, rowModel);
                }; // 给Form表单其它字段赋值
                V8.FormOutAction = actionType;
                V8.FormOutAfterAction = submitAfterType;
                V8.V8Callback = V8Callback;
                V8.EventName = "FormOut";
                self.SetV8DefaultValue(V8);

                V8.Form.Id = rowModel.Id;
                try {
                    // eval(self.CurrentDiyTableModel.OutFormV8);
                    await eval("(async () => {\n " + self.CurrentDiyTableModel.OutFormV8 + " \n})()");
                } catch (error) {
                    self.DiyCommon.Tips("执行表单离开V8引擎代码出现错误：" + error.message, false);
                } finally {

                }
            }
        },
}
};
</script>

<style lang="scss" scoped src="./styles/diy-table-rowlist.scss"></style>
