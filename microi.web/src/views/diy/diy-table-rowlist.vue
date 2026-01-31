<template>
    <div
        id="diy-table"
        :class="'diy-table pluginPage ' + ContainerClass + (_IsTableChild ? ` diy-child-table diy-child-table-${TableChildTableId}` : '')"
        :style="{ 
            padding: _IsTableChild ? '0px' : '0px', 
            paddingTop : (_IsTableChild || diyStore.IsPhoneView) ? '0px' : '10px' }"
    >
        <!-- type="border-card" -->
        <el-tabs
            id="table-rowlist-tabs"
            v-model="TableRowListActiveTab"
            @tab-click="tabClickRowList"
            :class="!IsPageTabs() ? 'table-rowlist-tabs tab-pane-hide' : 'table-rowlist-tabs box-card-top-tabs'"
        >
            <!-- 之前是使用GetPageTabs()，使用改成了预渲染  -->
            <template v-for="(tab, tabIndex) in SysMenuModel.PageTabs" :key="TypeFieldName + 'page_tabs_' + tab.Id + tabIndex">
                <el-tab-pane v-if="tab.IsVisible" :name="tab.Id" :lazy="true">
                    <template #label>
                        <span
                            :style="{
                                color: TableRowListActiveTab !== tab.Id ? ' #171717 !important' : ''
                            }"
                        >
                            <i
                                :class="DiyCommon.IsNull(tab.Icon) ? 'fas fa-list-ol marginRight5' : tab.Icon + ' marginRight5'"
                                :style="{
                                    color: TableRowListActiveTab !== tab.Id ? ' #171717 !important' : ''
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
                <!-- <template v-if="(_IsTableChild && TableChildField.Label) || (PropsIsJoinTable && JoinTableField.Label)" #header>
                    <div class="clearfix">
                        <span style="font-weight: bold">
                            <el-icon class="mr-2"><Grid /></el-icon>
                            {{ PropsIsJoinTable && JoinTableField.Label ? JoinTableField.Label : TableChildField.Label }}
                        </span>
                    </div>
                </template> -->
                
                <!-- 移动端顶部导航 -->
                <div v-if="diyStore.IsPhoneView" class="mobile-header">
                    <div class="mobile-header-left">
                        <el-icon class="back-icon" @click="$router.back()">
                            <ArrowLeft />
                        </el-icon>
                    </div>
                    <div class="mobile-header-center">
                        <span class="mobile-title">{{ SysMenuModel.Name || $t('Msg.TableList') }}</span>
                    </div>
                    <div class="mobile-header-right">
                        <el-icon class="search-icon" @click="showMobileSearch = true">
                            <Search />
                        </el-icon>
                    </div>
                </div>
                
                <!--DIY功能按钮 新版-->
                <div class="keyword-search" v-if="!diyStore.IsPhoneView">
                    <div class="search-action-group">
                        <el-button
                            v-if="_LimitAdd && TableChildFormMode != 'View' && !TableChildField.Readonly && PropsIsJoinTable !== true && IsVisibleAdd == true"
                            :loading="BtnLoading"
                            type="primary"
                            :icon="BtnLoading ? '' : CirclePlusFilled"
                            @click="OpenDetail(null, 'Add')"
                        >
                            {{ !DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.DiyConfig.AddBtnText) ? SysMenuModel.DiyConfig.AddBtnText : $t("Msg.Add") }}
                        </el-button>
                        <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.PageBtns) && SysMenuModel.PageBtns.length > 0">
                            <!-- HandlerBtns(SysMenuModel.PageBtns) -->
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
                        <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.BatchSelectMoreBtns) && SysMenuModel.BatchSelectMoreBtns.length > 0">
                            <template v-for="(btn, btnIndex) in SysMenuModel.BatchSelectMoreBtns">
                                <el-button v-if="btn.IsVisible" :key="TypeFieldName + 'more_btn_bs_' + btnIndex" @click="RunMoreBtn(btn)">
                                    <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                    {{ btn.Name }}
                                </el-button>
                            </template>
                        </template>
                        <!--如果子表是只读状态或预览模式，不显示新增、导入导出按钮-->
                        <template v-if="!_IsTableChild || (_IsTableChild && !TableChildField.Readonly)">
                            <el-button v-if="_LimitImport && TableChildFormMode != 'View'" :icon="UploadFilled" @click="ImportDiyTableRow()">{{ $t("Msg.Import") }}</el-button>
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
                                        <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.ExportMoreBtns) && SysMenuModel.ExportMoreBtns.length > 0">
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
                    </div>

                    <div class="search-input-group" v-if="IsPermission('NoSearch') && SysMenuModel.DiyConfig && SysMenuModel.DiyConfig.GeneralSeaarch !== 1">
                        <el-input class="keyword-input" v-model="Keyword" @input="InputGetDiyTableRow({ _PageIndex: 1 })" :placeholder="$t('Msg.Search')">
                            <template #append><el-button :icon="Search" @click="GetDiyTableRow({ _PageIndex: 1 })"></el-button></template>
                        </el-input>
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
                    <div class="search-clear-group" v-if="IsPermission('NoSearch')">
                        <el-button
                            :icon="RefreshLeft"
                            @click="
                                InitSearch();
                                GetDiyTableRow({ _PageIndex: 1 });
                            "
                        >
                            {{ $t("Msg.ClearSearch") }}
                        </el-button>
                    </div>

                    <div class="search-more-group" v-if="_HasSearchFields && IsPermission('NoSearch')">
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
                                @CallbackGetDiyTableRow="GetDiyTableRow"
                                @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"
                            ></DiySearch>
                            <template #reference
                                ><el-button :icon="ArrowDown">
                                    {{ $t("Msg.MoreSearch") }}
                                </el-button></template
                            >
                        </el-popover>
                    </div>
                    <el-button type="primary" :icon="List" 
                        @click="ShiftTableDisplayMode()">{{  
                        $t('Msg.SwitchTableDisplay')
                    }}</el-button>
                    <div class="admin-action-group" v-if="GetCurrentUser._IsAdmin">
                        <el-button type="primary" :icon="List" @click="$router.push(`/diy/diy-design/${TableId}?PageType=${CurrentDiyTableModel.ReportId ? 'Report' : ''}`)">{{  
                            $t('Msg.FormDesign')
                        }}</el-button>
                        <el-button :loading="BtnLoading" type="primary" :icon="BtnLoading ? undefined : QuestionFilled" @click="OpenMenuForm()">{{ $t('Msg.ModuleDesign') }}</el-button>
                        <el-button type="primary" :icon="CircleCheck" @click="OpenMockPermissionDialog">{{ $t('Msg.FormPermission') }}</el-button>
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
                        @CallbackGetDiyTableRow="GetDiyTableRow"
                        @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"
                    ></DiySearch>
                </div>
                <!--DIY表格-->
                <el-table
                    v-if="
                        (!diyStore.IsPhoneView &&
                        SysMenuModel.Id &&
                        (SysMenuModel.ComponentName == '搜索+表格' || !SysMenuModel.ComponentName))
                        && TableDisplayMode != 'Card'
                    "
                    :id="'diy-table-' + TableId"
                    :ref="'diy-table-' + TableId"
                    v-loading="tableLoading"
                    :data="DiyTableRowList"
                    style="width: 100%"
                    :show-summary="StatisticsFields != null"
                    :summary-method="StatisticsFieldsMethod"
                    @sort-change="DiyTableRowSortChange"
                    :class="'clear no-border-outside table-table table-data diy-table-' + CurrentDiyTableModel.Name"
                    @row-dblclick="TableRowDblClick"
                    @selection-change="TableRowSelectionChange"
                    :height="GetDiyTableMaxHeight()"
                    stripe
                    border
                    @row-click="DiyTableRowClick"
                    highlight-current-row
                    @current-change="DiyTableCurrentChange"
                    :lazy="true"
                    :load="DiyTableLoad"
                    row-key="Id"
                    :tree-props="{ children: '_Child', hasChildren: CurrentDiyTableModel.TreeHasChildren || '_HasChild' }"
                >
                    <el-table-column v-if="TableEnableBatch" type="selection" label="#" width="35"> </el-table-column>
                    <el-table-column
                        type="index"
                        :label="$t('Msg.SerialNo')"
                        width="55"
                        align="center"
                        :index="indexMethod"
                        v-if="DiyCommon.IsNull(SysMenuModel.DiyConfig) || (!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !SysMenuModel.DiyConfig.HiddenIndex)"
                    >
                    </el-table-column>
                    <template v-for="(field, fieldIndex) in ShowDiyFieldList" :key="TypeFieldName + 'table_column_fieldid_' + field.Id">
                        <el-table-column
                            :prop="DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName"
                            :property="DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName"
                            :label="field.Label"
                            :width="GetColWidth(field, fieldIndex)"
                            :sortable="SortFieldIds.indexOf(field.Id) > -1 ? 'custom' : false"
                            :class-name="GetColClassName(field)"
                            :fixed="ColIsFixed(field.Id)"
                            show-overflow-tooltip
                        >
                            <!-- Bug6新增：列头搜索功能 - 为可搜索列添加搜索图标 -->
                            <template #header>
                                <span>{{ field.Label }}</span>
                                <el-icon 
                                    v-if="SearchFieldIds.indexOf(field.Id) > -1"
                                    class="column-search-icon" 
                                    @click.stop="showColumnSearch(field, $event)"
                                    style="margin-left: 4px; cursor: pointer; color: #409EFF; vertical-align: middle;"
                                    :title="$t('Msg.SearchField') + field.Label"
                                >
                                    <Search />
                                </el-icon>
                            </template>
                            <template #default="scope">
                                <!--如果使用了模板引擎-->
                                <template v-if="isMuban(field, scope)">
                                    <div style="line-height: 22px" v-html="scope.row[field.Name + '_TmpEngineResult']"></div>
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
                                    <template v-if="SysMenuModel.InTableEdit && SysMenuModel.InTableEditFields.indexOf(field.Id) > -1">
                                        <component
                                            v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                                            :TableInEdit="true"
                                            :field="field"
                                            :FormDiyTableModel="scope.row"
                                            :FormMode="TableChildFormMode"
                                            :TableId="TableId"
                                            :TableName="TableName"
                                            :DiyConfig="SysMenuModel.DiyConfig"
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
                                            :is="'Diy' + field.Component"
                                        />
                                    </template>
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
                                        <DiyDepartment
                                            v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                                            :field="field"
                                            :FormDiyTableModel="scope.row"
                                            :FormMode="TableChildFormMode"
                                            :FieldReadonly="true"
                                            :LoadType="'Table'"
                                            :TableId="TableId"
                                            @CallbackRunV8Code="
                                                ({ field, thisValue }) => {
                                                    return RunV8Code({ field: field, thisValue: thisValue, row: scope.row });
                                                }
                                            "
                                        />
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

                    <el-table-column
                        v-if="ColIsDisplay('CreateTime')"
                        :label="$t('Msg.CreateTime')"
                        :sortable="SortFieldIds.indexOf('CreateTime') > -1 ? 'custom' : false"
                        :prop="'CreateTime'"
                        width="150"
                    >
                        <template #default="scope">
                            <!-- :title="scope.row.CreateTime" -->
                            <span>{{ scope.row.CreateTime }}</span>
                        </template>
                    </el-table-column>
                    <el-table-column
                        v-if="ColIsDisplay('UserName')"
                        :label="$t('Msg.Creator')"
                        :sortable="SortFieldIds.indexOf('UserName') > -1 ? 'custom' : false"
                        :prop="'UserName'"
                        width="110"
                    >
                        <template #default="scope">
                            <!-- :title="scope.row.UserName" -->
                            <span>{{ scope.row.UserName }}</span>
                        </template>
                    </el-table-column>
                    <el-table-column
                        v-if="ColIsDisplay('UpdateTime')"
                        :label="$t('Msg.UpdateTime')"
                        :sortable="SortFieldIds.indexOf('UpdateTime') > -1 ? 'custom' : false"
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
                                        v-if="btn.IsVisible && !TableChildField.Readonly"
                                        :type="GetMoreBtnStyle(btn)"
                                        class="row-more-btns-out"
                                        :loading="BtnV8Loading"
                                        @click.stop="RunMoreBtn(btn, scope.row)"
                                    >
                                        <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                                        {{ btn.Name }}
                                    </el-button>
                                </template>
                                <el-button
                                    v-if="IsPermission('NoDetail') && scope.row._IsInTableAdd !== true && scope.row.IsVisibleDetail == true"
                                    :icon="Tickets"
                                    @click="OpenDetail(scope.row, 'View')"
                                >
                                    {{ $t("Msg.Detail") }}
                                </el-button>
                                <!--如果子表是只读，不显示编辑等按钮 2021-01-30 && TableChild!field.Readonly-->
                                <!-- 性能优化V3：使用原生按钮+全局共享菜单，避免每行实例化popover -->
                                <el-button
                                    v-if="
                                        (TableChildFormMode != 'View' &&
                                            !TableChildField.Readonly &&
                                            _LimitEdit &&
                                            scope.row._IsInTableAdd !== true &&
                                            scope.row.IsVisibleEdit == true) ||
                                        (scope.row._RowMoreBtnsIn && scope.row._RowMoreBtnsIn.length > 0) ||
                                        (_LimitDel && TableChildFormMode != 'View' && scope.row.IsVisibleDel == true)
                                    "
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

                <el-row
                    v-else-if="diyStore.IsPhoneView ||
                        (SysMenuModel.Id && SysMenuModel.ComponentName == '搜索+卡片')
                        || TableDisplayMode == 'Card'
                    "
                    class="table-card-el-row"
                    :gutter="20"
                >
                    <el-skeleton style="width: 100%" :loading="tableLoading" animated>
                        <template #template>
                            <div
                                v-for="item in Array.from(
                                    { length: DiyTableRowPageSize },
                                    (_, index) => index + 1
                                )"
                                :key="item"
                                :class="diyStore.IsPhoneView ? 'card-wrapper-mobile' : 'card-wrapper-desktop'"
                            >
                                <el-card class="box-card card-data-animate no-padding">
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
                                </el-card>
                            </div>
                        </template>
                        <el-col
                            v-for="(model, index) in DiyTableRowList"
                            :key="model.Id"
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
                                class="box-card card-data-animate no-padding"
                                :style="{
                                    borderTop: SysMenuModel.TableCardImgField
                                        ? ''
                                        : '5px solid var(--color-primary) !important',
                                }"
                            >
                                <div 
                                    :class="SysMenuModel.TableCardImgPosition === 'Left' ? 'card-content-horizontal' : 'card-content-vertical'"
                                >
                                    <img
                                        v-if="SysMenuModel.TableCardImgField"
                                        :src="
                                            model[SysMenuModel.TableCardImgField]
                                                ? GetFileServerUrl(
                                                    model[SysMenuModel.TableCardImgField]
                                                )
                                                : '/static/img/body-bg.svg'
                                        "
                                        class="preview"
                                        :style="
                                            SysMenuModel.TableCardImgStyle ||
                                            (SysMenuModel.TableCardImgPosition === 'Left' 
                                                ? 'width:120px;height:100%;object-fit:cover;flex-shrink:0;'
                                                : 'height:100px;width:100%;object-fit:cover;')
                                        "
                                    />
                                    <div class="body" style="padding-top: 10px; flex: 1;">
                                        <div
                                            v-for="(field, fieldIndex) in ShowDiyFieldList.slice(0, 7)"
                                            :key="field.Id"
                                            class="item no-br over-hide"
                                            :style="{ fontWeight: fieldIndex == 0 ? 'bold' : 'normal' }"
                                            style="padding: 5px 10px; font-size: 14px"
                                        >
                                            {{ field.Label }}：{{ model[field.Name] }}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    class="bottom"
                                    style="
                                        text-align: right;
                                        padding: 10px;
                                        display: flex;
                                        flex-wrap: wrap;
                                        text-align: right;
                                        justify-content: flex-end;
                                        align-content: flex-end;
                                        gap: 5px;
                                    "
                                >
                                    <el-button
                                        v-for="(btn, btnIndex) in model._RowMoreBtnsOut"
                                        :key="
                                            TypeFieldName +
                                            'more_btn_showrowtrue_' +
                                            model.Id +
                                            btnIndex
                                        "
                                        v-show="btn.IsVisible && !TableChildField.Readonly"
                                        :type="GetMoreBtnStyle(btn)"
                                        class="row-more-btns-out"
                                        :loading="BtnV8Loading"
                                        @click.stop="RunMoreBtn(btn, model)"
                                        style=""
                                        size="small"
                                    >
                                        <fa-icon
                                            :icon="btn.Icon || 'fa-solid fa-file-code'"
                                        />
                                        {{ btn.Name }}
                                    </el-button>
                                    <!-- </view> -->
                                    <el-button
                                        v-if="IsPermission('NoDetail')"
                                        link
                                        icon="Tickets"
                                        class="marginRight10"
                                        @click="OpenDetail(model, 'View')"
                                        size="small"
                                    >
                                        {{ $t('Msg.Detail') }}
                                    </el-button>
                                    <!--如果子表是只读，不显示编辑等按钮 2021-01-30 && TableChild!field.Readonly-->
                                    <el-dropdown
                                        class="table-row-more-btn"
                                        v-if="
                                            TableChildFormMode != 'View' &&
                                            !TableChildField.Readonly
                                        "
                                        trigger="click"
                                        size="small"
                                    >
                                        <el-button link size="small">
                                            {{ $t('Msg.More')
                                            }}<el-icon class="el-icon--right"
                                                ><arrow-down
                                            /></el-icon>
                                        </el-button>
                                        <template #dropdown>
                                            <el-dropdown-menu class="table-more-btn">
                                                <el-dropdown-item
                                                    v-if="
                                                        LimitEdit() && TableChildFormMode != 'View'
                                                    "
                                                    icon="Edit"
                                                    @click="OpenDetail(model, 'Edit')"
                                                >
                                                    {{ $t('Msg.Edit') }}
                                                </el-dropdown-item>
                                                <template v-if="model._RowMoreBtnsIn.length > 0">
                                                    <template
                                                        v-for="(
                                                            btn, btnIndex
                                                        ) in model._RowMoreBtnsIn"
                                                    >
                                                        <el-dropdown-item
                                                            v-if="btn.IsVisible"
                                                            :key="
                                                                TypeFieldName +
                                                                'more_btn_' +
                                                                model.Id +
                                                                btnIndex
                                                            "
                                                            @click="RunMoreBtn(btn, model)"
                                                        >
                                                            <fa-icon
                                                                :icon="
                                                                    !btn.Icon
                                                                        ? 'far fa-check-circle'
                                                                        : btn.Icon
                                                                "
                                                                :class="'more-btn mr-1'"
                                                            />
                                                            {{ btn.Name }}
                                                        </el-dropdown-item>
                                                    </template>
                                                </template>

                                                <el-dropdown-item
                                                    v-if="
                                                        LimitDel() && TableChildFormMode != 'View'
                                                    "
                                                    icon="Delete"
                                                    divided
                                                    @click="DelDiyTableRow(model)"
                                                >
                                                    {{ $t('Msg.Delete') }}
                                                </el-dropdown-item>
                                            </el-dropdown-menu>
                                        </template>
                                    </el-dropdown>
                                </div>
                            </el-card>
                        </el-col>
                    </el-skeleton>
                </el-row>
                <el-pagination
                    v-if="(!TableChildConfig || (TableChildConfig && !TableChildConfig.DisablePagination)) && !diyStore.IsPhoneView"
                    style="margin-top: 10px; float: left; margin-bottom: 10px; clear: both; margin-left: 10px"
                    background
                    layout="total, sizes, prev, pager, next, jumper"
                    :total="DiyTableRowCount"
                    :page-sizes="DiyCommon.PageSizes"
                    :current-page="DiyTableRowPageIndex"
                    :page-size="DiyTableRowPageSize"
                    @size-change="DiyTableRowSizeChange"
                    @current-change="DiyTableRowCurrentChange"
                />
                <!-- 移动端加载更多提示 -->
                <div v-if="diyStore.IsPhoneView && DiyTableRowList.length < DiyTableRowCount" class="mobile-load-more">
                    <div v-if="mobileLoadingMore" class="loading-text">
                        <el-icon class="is-loading"><Loading /></el-icon>
                        <span>加载中...</span>
                    </div>
                    <div v-else class="load-more-text">
                        <span>上拉加载更多</span>
                    </div>
                </div>
                <div v-if="diyStore.IsPhoneView && DiyTableRowList.length >= DiyTableRowCount && DiyTableRowCount > 0" class="mobile-no-more">
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
                    v-if="_LimitEdit && TableChildFormMode != 'View' && _moreMenuRow && _moreMenuRow._IsInTableAdd !== true && _moreMenuRow.IsVisibleEdit == true"
                    class="global-more-menu-item"
                    @click="handleMoreMenuAction('edit')"
                >
                    <el-icon><Edit /></el-icon>
                    <span>{{ $t("Msg.Edit") }}</span>
                </div>
                <template v-if="_moreMenuRow && _moreMenuRow._RowMoreBtnsIn && _moreMenuRow._RowMoreBtnsIn.length > 0">
                    <template v-for="(btn, btnIndex) in _moreMenuRow._RowMoreBtnsIn" :key="'global_more_btn_' + btnIndex">
                        <div v-if="btn.IsVisible" class="global-more-menu-item" @click="handleMoreMenuAction('custom', btn)">
                            <fa-icon :icon="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)" />
                            <span>{{ btn.Name }}</span>
                        </div>
                    </template>
                </template>
                <div
                    v-if="_LimitDel && TableChildFormMode != 'View' && _moreMenuRow && _moreMenuRow.IsVisibleDel == true"
                    class="global-more-menu-item global-more-menu-item-danger"
                    @click="handleMoreMenuAction('delete')"
                >
                    <el-icon><Delete /></el-icon>
                    <span>{{ $t("Msg.Delete") }}</span>
                </div>
            </div>
        </teleport>

        <!--以弹窗形式打开Form-->
        <el-dialog
            v-if="ShowFieldForm"
            class="diy-form-container"
            draggable
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
                <div class="pull-right"  style="display: flex;gap: 10px;align-items: center;justify-content: center;">
                    <el-dropdown
                        v-if="FormMode != 'View' && OpenDiyFormWorkFlowType.WorkType != 'StartWork' && ShowSaveBtn"
                        split-button
                        type="primary"
                        trigger="click"
                        @click="SaveDiyTableCommon(true, 'Close')"
                    >
                        <dynamic-icon :name="BtnLoading ? 'loading' : 's-help'" />
                        <!-- AddClose   UptClose -->
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
                    <!-- OpenDetail({ Id: TableRowId }, 'Edit', true) -->
                    <el-button
                        v-if="FormMode == 'View' && _LimitEdit && TableChildFormMode !== 'View' && !TableChildField.Readonly && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
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
                                :key="TypeFieldName + 'more_btn_formbtns_' + btnIndex"
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
                                        _LimitDel &&
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
                    <DiyFormChild
                        ref="fieldForm"
                        :FormWF="FormWF"
                        :LoadMode="''"
                        :FormMode="FormMode"
                        :TableChildFormMode="TableChildFormMode"
                        :TableId="TableId"
                        :TableName="CurrentDiyTableModel.Name"
                        :TableRowId="TableRowId"
                        :DefaultValues="FieldFormDefaultValues"
                        :SelectFields="FieldFormSelectFields"
                        :FixedTabs="FieldFormFixedTabs"
                        :HideFields="FieldFormHideFields"
                        :ParentForm="FatherFormModel"
                        :ParentV8="ParentV8_Data ? ParentV8_Data : ParentV8"
                        :CurrentTableData="DiyTableRowList"
                        :ActiveDiyTableTab="CurrentTableRowListActiveTab"
                        :ShowHideField="ShowHideField"
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
                            <!--提交-->
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

            <!-- <template #footer class="dialog-footer">

        </span> -->
        </el-dialog>

        <!--以抽屉形式打开Form-->
        <!-- 注意：使用 v-if 控制抽屉的创建/销毁，而不是依赖 destroy-on-close -->
        <!-- 这样可以确保组件在关闭时被完全销毁，避免内存泄漏 -->
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
                        <!-- AddClose   UptClose -->
                        {{
                            (FormMode == "Add" || FormMode == "Insert" || FormMode == "Insert") && !DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.DiyConfig.SaveBtnText)
                                ? SysMenuModel.DiyConfig.SaveBtnText
                                : $t("Msg.Save")
                        }}
                        <!--{{ ((FormMode == 'Add' || FormMode == 'Insert') || FormMode == 'Insert') ? $t('Msg.Save') : $t('Msg.Save') }}-->
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
                    <!-- OpenDetail({ Id: TableRowId }, 'Edit', true) -->
                    <el-button
                        v-if="FormMode == 'View' && _LimitEdit && TableChildFormMode !== 'View' && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
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
                                :key="TypeFieldName + 'more_btn_formbtns_' + btnIndex"
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
                                        _LimitDel &&
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
                <!-- :class="ShowFormRight() ? 'pull-left' : ''"
            :style="{ width: ShowFormRight() ? 'calc(100% - 280px)' : '100%' }" -->
                <el-col :span="ShowFormRight() ? 20 : 24" :xs="24">
                    <DiyFormChild
                        ref="fieldForm"
                        :FormWF="FormWF"
                        :LoadMode="''"
                        :FormMode="FormMode"
                        :TableChildFormMode="TableChildFormMode"
                        :TableId="TableId"
                        :TableName="CurrentDiyTableModel.Name"
                        :TableRowId="TableRowId"
                        :DefaultValues="FieldFormDefaultValues"
                        :SelectFields="FieldFormSelectFields"
                        :FixedTabs="FieldFormFixedTabs"
                        :HideFields="FieldFormHideFields"
                        :ParentForm="FatherFormModel"
                        :ParentV8="ParentV8_Data ? ParentV8_Data : ParentV8"
                        :CurrentTableData="DiyTableRowList"
                        :ActiveDiyTableTab="CurrentTableRowListActiveTab"
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
                <!-- class="pull-right" style="width: 260px; background-color: #f5f7fa; height: 100%; padding-left: 15px; padding-right: 15px" -->
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
                                            <!-- <el-tag> -->
                                            <span style="color: red">{{ log.Label }}</span
                                            >： {{ $t('Msg.ModifiedFrom') }} <span style="color: red">{{ log.OVal || $t('Msg.EmptyValue') }}</span> {{ $t('Msg.ModifiedTo') }}
                                            <span style="color: red">{{ log.NVal }}</span>
                                            <!-- </el-tag>     -->
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
                            <!--提交-->
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
                                        <!-- v-for="log in item.Content" :key="'datalog_content_' + log.Name"  -->
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
            <!-- <span class="demo-drawer__footer">

        </span> -->
        </el-drawer>

        <!--抽屉或弹窗打开完整的Form-->
        <DiyFormDialog @CallbackGetDiyTableRow="GetDiyTableRow" ref="refDiyTable_DiyFormDialog"></DiyFormDialog>

        <!--导入功能-->
        <el-dialog draggable width="768px" :modal-append-to-body="true" v-model="ShowImport" :close-on-click-modal="true" :modal="false" append-to-body :destroy-on-close="true">
            <template #header>
                <fa-icon :icon="DiyCommon.IsNull(CurrentRowModel) || DiyCommon.IsNull(CurrentRowModel.Id) ? 'fas fa-plus' : 'far fa-edit'" />
                {{ $t("Msg.Import") }}
            </template>

            <!--2023-03-08新增：如果是子表导入，自动写入主表Id值-->
            <el-upload
                class="upload-drag-style"
                :action="GetImportApi()"
                :data="GetUploadData()"
                :headers="{ authorization: authorization() }"
                :show-file-list="false"
                :on-success="
                    (result, file, fileList) => {
                        return ImportUploadSuccess(result, file, fileList);
                    }
                "
                :before-upload="ImportDiyTableRowBefore"
                drag
            >
                <el-icon><Upload /></el-icon>
                <div class="el-upload__text">{{ $t("Msg.UploadDesc") }}</div>
                <template #tip>
                    <div class="el-upload__tip">{{ $t('Msg.OnlyXlsFile') }}</div>
                </template>
            </el-upload>

            <div class="marginTop10 marginBottom10">
                <el-button :icon="RefreshRight" @click="GetImportDiyTableRowStep">{{ $t('Msg.ViewProgress') }}</el-button>
                <el-tooltip v-if="GetCurrentUser._IsAdmin" class="item" effect="dark" :content="$t('Msg.Tips')" placement="top">
                    <el-button :icon="Warning" @click="DelImportDiyTableRowStep">{{ $t('Msg.ClearImportCache') }}</el-button>
                </el-tooltip>
            </div>
            <div class="">
                <div v-for="(m, index) in ImportStepList" :key="TypeFieldName + 'importStep_' + index" style="color: red">
                    {{ m }}
                </div>
                <div v-if="ImportStepList.length == 0" style="color: red">{{ $t('Msg.NoProgress') }}</div>
            </div>

            <template #footer>
                <!-- <el-button
                type="primary"
               
                :icon="QuestionFilled"
                @click="SaveDiyTableCommon">{{$t('Msg.Import')}}</el-button> -->
                <el-button :icon="Close" @click="ShowImport = false">{{ $t("Msg.Close") }}</el-button>
            </template>
        </el-dialog>
        <DiyModule v-if="ShowDiyModule" :modal="!_IsTableChild" ref="refDiyModule"></DiyModule>
        <!-- :DataAppend="GetDiyCustomDialogDataAppend()" -->
        <!-- :visible="DiyCustomDialogConfig.Visible" -->
        <DiyCustomDialog
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

        <!-- 表单权限设置弹窗（mock数据） -->
        <el-dialog :title="$t('Msg.PermissionSetting')" v-model="ShowMockPermissionDialog" width="80vw" :close-on-click-modal="false" :modal="false" class="mock-permission-dialog" :destroy-on-close="true">
            <div style="max-height: 70vh; overflow-y: auto">
                <el-table :data="MockPermissionRoleList" border>
                    <el-table-column :label="$t('Msg.RoleColumn')" width="180">
                        <template #default="scope">
                            <el-checkbox :checked="isRoleAllChecked(scope.row)" @change="toggleRoleAll(scope.row, $event)" :indeterminate="isRoleIndeterminate(scope.row)" style="margin-right: 4px" />
                            {{ scope.row.RoleName }}
                        </template>
                    </el-table-column>
                    <el-table-column :label="$t('Msg.PermissionColumn')">
                        <template #default="scope">
                            <div class="permission-checkbox-group-wrap-fixed">
                                <el-checkbox-group v-model="scope.row.Permission">
                                    <div class="checkbox-item" v-for="btn in MockPermissionBtnList" :key="btn.Id">
                                        <el-checkbox :value="btn.Id">{{ btn.Name }}</el-checkbox>
                                    </div>
                                </el-checkbox-group>
                            </div>
                        </template>
                    </el-table-column>
                </el-table>
            </div>
            <template #footer>
                <el-button @click="ShowMockPermissionDialog = false">{{ $t('Msg.Cancel') }}</el-button>
                <el-button type="primary" @click="SaveMockPermissionConfig">{{ $t('Msg.Save') }}</el-button>
            </template>
        </el-dialog>

        <!-- 移动端搜索抽屉 -->
        <el-drawer
            v-model="showMobileSearch"
            direction="btt"
            size="80%"
            :modal="true"
            class="mobile-search-drawer"
            :title="$t('Msg.Search')"
        >
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
                        GetDiyTableRow(params);
                        showMobileSearch = false;
                    }
                "
                @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"
            />
        </el-drawer>
    </div>
</template>

<script>
import { computed, markRaw, shallowRef } from "vue";
import { defineAsyncComponent } from "vue";
import _u from "underscore";
import { useDiyStore } from "@/pinia";
import { Base64 } from "js-base64";
import PanThumb from "@/components/PanThumb";
import { debounce, cloneDeep } from "lodash";
import DiyCardSelect from "@/views/diy/diy-card-select.vue";
import DynamicComponentCache from "@/utils/dynamicComponentCache.js";
export default {
    directives: {},
    components: {
        DiyCardSelect,
        PanThumb,
        // Vue 3: 使用 defineAsyncComponent 包装动态 import
        DiyFormChild: defineAsyncComponent(() => import("@/views/diy/diy-form")),
        DiyTableChild: defineAsyncComponent(() => import("@/views/diy/diy-table-rowlist"))
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
            SysConfig
        };
    },
    // Vue 3: 使用 beforeUnmount 替代 beforeDestroy（这是最关键的修复！）
    beforeUnmount() {
        var self = this;
        
        // 🔥 添加明显的日志，确认被调用
        console.log('%c[DiyTableRowlist] ========== beforeUnmount 被触发 ==========', 'color: red; font-size: 16px; font-weight: bold');
        console.log('[DiyTableRowlist] 当前路由:', self.$route.fullPath);
        console.log('[DiyTableRowlist] SysMenuId:', self.SysMenuId);
        console.log('[DiyTableRowlist] TableId:', self.TableId);
        
        // 标记组件已销毁
        self._isDestroyed = true;
        
        // 🔥 移除全局刷新事件监听
        if (self._handlePageRefresh) {
            window.removeEventListener('page-refresh', self._handlePageRefresh);
            self._handlePageRefresh = null;
        }
        
        // ========== 1. 清理定时器 ==========
        if (self._importStepTimer) {
            clearTimeout(self._importStepTimer);
            self._importStepTimer = null;
        }
        if (self._debounceTimer) {
            clearTimeout(self._debounceTimer);
            self._debounceTimer = null;
        }

        // ========== 2. 关闭所有弹窗和抽屉 ==========
        self.ShowFieldFormDrawer = false;
        self.ShowFieldForm = false;
        self.ShowImport = false;
        self.ShowAnyTable = false;
        self.ShowMockPermissionDialog = false;
        self.ShowDiyModule = false; // 关闭模块组件

        // ========== 3. 清理子组件引用 ==========
        // 先清理表单子组件
        if (self.$refs.fieldForm) {
            try {
                if (typeof self.$refs.fieldForm.Clear === "function") {
                    self.$refs.fieldForm.Clear();
                }
            } catch (e) {
                /* ignore */
            }
        }

        // ========== 4. 清理大数组和对象（包含内部引用） ==========
        // 表格数据 - 需要先清理内部的对象引用
        if (self.DiyTableRowList && self.DiyTableRowList.length > 0) {
            self.DiyTableRowList.forEach(row => {
                if (row) {
                    // 清理按钮数组
                    if (row._RowMoreBtnsOut) {
                        row._RowMoreBtnsOut.length = 0;
                        row._RowMoreBtnsOut = null;
                    }
                    if (row._RowMoreBtnsIn) {
                        row._RowMoreBtnsIn.length = 0;
                        row._RowMoreBtnsIn = null;
                    }
                    // 清理模板引擎结果
                    Object.keys(row).forEach(key => {
                        if (key.endsWith('_TmpEngineResult')) {
                            row[key] = null;
                        }
                    });
                }
            });
            self.DiyTableRowList.length = 0;
        }
        self.DiyTableRowList = [];
        
        if (self.OldDiyTableRowList && self.OldDiyTableRowList.length > 0) {
            self.OldDiyTableRowList.forEach(row => {
                if (row) {
                    if (row._RowMoreBtnsOut) {
                        row._RowMoreBtnsOut.length = 0;
                        row._RowMoreBtnsOut = null;
                    }
                    if (row._RowMoreBtnsIn) {
                        row._RowMoreBtnsIn.length = 0;
                        row._RowMoreBtnsIn = null;
                    }
                }
            });
            self.OldDiyTableRowList.length = 0;
        }
        self.OldDiyTableRowList = [];
        
        // 清理字段列表中的配置
        if (self.DiyFieldList && self.DiyFieldList.length > 0) {
            self.DiyFieldList.forEach(field => {
                if (field) {
                    if (field.Data) {
                        if (Array.isArray(field.Data)) field.Data.length = 0;
                        field.Data = null;
                    }
                    if (field.Config) {
                        field.Config = null;
                    }
                }
            });
            self.DiyFieldList.length = 0;
        }
        self.DiyFieldList = [];
        self.ShowDiyFieldList = null;
        self._allFieldList = null; // 🔥 清理完整字段列表缓存

        // 搜索相关
        self.SearchFieldIds = [];
        self.SortFieldIds = [];
        self.NotShowFields = [];
        self.FixedFields = [];
        self.MoileListFields = [];
        self.SearchModel = {};
        self.SearchEqual = {};
        self.V8SearchModel = {};
        self.SearchCheckbox = {};
        self.SearchDateTime = {};
        self.SearchNumber = {};
        self.SearchWhere = [];
        self.Where = [];

        // 选择状态
        self.TableMultipleSelection = [];
        self.TableSelectedRow = {};
        self.TableSelectedRowLast = {};

        // 当前行数据
        self.CurrentRowModel = {};
        self.CurrentSelectedRowModel = {};
        self.FieldFormDefaultValues = {};

        // 父级数据引用
        self.FatherFormModel_Data = null;
        self.ParentV8_Data = null;

        // 日志和评论
        self.DataLogList = [];
        self.DataCommentList = [];

        // 导入进度
        self.ImportStepList = [];

        // 表单相关
        self.FieldFormSelectFields = [];
        self.FieldFormFixedTabs = [];
        self.FieldFormHideFields = [];
        self.TempBtnIsVisible = [];
        self.ShowHideFieldsList = [];

        // ========== 5. 清理模块配置 ==========
        if (self.SysMenuModel) {
            self.SysMenuModel.MoreBtns = [];
            self.SysMenuModel.PageBtns = [];
            self.SysMenuModel.FormBtns = [];
            self.SysMenuModel.PageTabs = [];
            self.SysMenuModel.BatchSelectMoreBtns = [];
            self.SysMenuModel.ExportMoreBtns = [];
            self.SysMenuModel = {};
        }

        // ========== 6. 清理动态组件 ==========
        self.DevComponents = {};

        // ========== 7. 清理表模型 ==========
        self.CurrentDiyTableModel = {};
        self.CurrentTableRowListActiveTab = {};

        // ========== 8. 清理弹窗配置 ==========
        self.DiyCustomDialogConfig = {};
        self.OpenAnyTableParam = {};
        self.OpenDiyFormWorkFlowType = {};
        self.FormWF = {};

        // ========== 9. 清理权限模拟数据 ==========
        self.MockPermissionRoleList = [];
        self.MockPermissionBtnList = [];
        
        // ========== 10. 清理全局菜单事件监听器 ==========
        document.removeEventListener('click', self.hideMoreMenu);
        self._moreMenuVisible = false;
        self._moreMenuRow = null;

        console.log('%c[DiyTableRowlist] ========== beforeUnmount 完成 ==========', 'color: green; font-size: 16px; font-weight: bold');
    },
    computed: {
        // 性能优化：将频繁调用的方法转换为计算属性
        _IsTableChild() {
            return !this.DiyCommon.IsNull(this.TableChildTableId);
        },
        _RoleLimitModel() {
            var self = this;
            if (!self.GetCurrentUser || !self.GetCurrentUser._RoleLimits) return [];
            return _u.where(self.GetCurrentUser._RoleLimits, { FkId: self.SysMenuId });
        },
        _LimitAdd() {
            var self = this;
            if (self.GetCurrentUser._IsAdmin) return true;
            if (self.TableChildFormMode != "View" && self._RoleLimitModel.length > 0) {
                return self._RoleLimitModel.some((el) => el.Permission.indexOf("Add") > -1 || el.Permission.indexOf("Insert") > -1);
            }
            return false;
        },
        _LimitImport() {
            var self = this;
            if (self.GetCurrentUser._IsAdmin) return true;
            if (self.TableChildFormMode != "View" && self._RoleLimitModel.length > 0) {
                return self._RoleLimitModel.some((el) => el.Permission.indexOf("Import") > -1);
            }
            return false;
        },
        _LimitExport() {
            var self = this;
            if (self.GetCurrentUser._IsAdmin) return true;
            if (self._RoleLimitModel.length > 0) {
                return self._RoleLimitModel.some((el) => el.Permission.indexOf("Export") > -1);
            }
            return false;
        },
        _LimitEdit() {
            var self = this;
            if (self.GetCurrentUser._IsAdmin) return true;
            if (self.TableChildFormMode != "View" && self._RoleLimitModel.length > 0) {
                return self._RoleLimitModel.some((el) => el.Permission.indexOf("Edit") > -1);
            }
            return false;
        },
        _LimitDel() {
            var self = this;
            if (self.GetCurrentUser._IsAdmin) return true;
            if (self.TableChildFormMode != "View" && self._RoleLimitModel.length > 0) {
                return self._RoleLimitModel.some((el) => el.Permission.indexOf("Del") > -1);
            }
            return false;
        },
        // 预计算搜索字段列表，避免模板中重复计算
        _SearchFieldListAll() {
            var self = this;
            if (!self.SearchFieldIds || self.SearchFieldIds.length === 0) return [];
            if (!self.DiyFieldList || self.DiyFieldList.length === 0) return [];

            var result = [];
            self.SearchFieldIds.forEach((id) => {
                if (!id) return;
                self.DiyFieldList.forEach((field) => {
                    if (!field) return;
                    if ((field.Id === id || field.Id === id.Id) && id.Hide !== true) {
                        // 初始化 SearchNumber
                        if (field.Type && (field.Type === "int" || field.Type.indexOf("decimal") > -1) && self.DiyCommon.IsNull(self.SearchNumber[field.Name])) {
                            self.SearchNumber[field.Name] = { Min: "", Max: "" };
                        }
                        result.push({ field, id });
                    }
                });
            });
            return result;
        },
        _SearchFieldListCheckboxIn() {
            var self = this;
            if (!self._SearchFieldListAll || self._SearchFieldListAll.length === 0) return [];
            return self._SearchFieldListAll
                .filter(({ field, id }) => {
                    if (!field || !id) return false;
                    if (id.DisplayType && id.DisplayType !== "In") return false;
                    return field.Data && Array.isArray(field.Data) && field.Data.length > 0 && field.Config && field.Config.DataSourceSqlRemote !== true && id.DisplaySelect !== true;
                })
                .map(({ field }) => {
                    if (self.DiyCommon.IsNull(self.SearchCheckbox[field.Name])) {
                        self.SearchCheckbox[field.Name] = [];
                    }
                    return field;
                });
        },
        _SearchFieldListTextIn() {
            var self = this;
            if (!self._SearchFieldListAll || self._SearchFieldListAll.length === 0) return [];
            return self._SearchFieldListAll
                .filter(({ field, id }) => {
                    if (!field || !id) return false;
                    if (id.DisplayType && id.DisplayType !== "In") return false;
                    return !field.Data || !Array.isArray(field.Data) || field.Data.length === 0 || (field.Config && field.Config.DataSourceSqlRemote === true) || id.DisplaySelect === true;
                })
                .map(({ field }) => field);
        },
        _HasSearchFieldsIn() {
            return this._SearchFieldListCheckboxIn.length > 0 || this._SearchFieldListTextIn.length > 0;
        },
        _HasSearchFields() {
            return this._SearchFieldListAll.length > 0;
        },
        GetActionWidth: function () {
            var self = this;
            if (self.SysMenuModel.TableActionFixedWidth) {
                return self.SysMenuModel.TableActionFixedWidth;
            }
            return 210 + self.MaxRowBtnsOut;
        },
        ShowSelectLabel: function () {
            return function (scope, field) {
                let labelName = this.GetColValue(scope, field);
                let obj = field.Data?.find((item) => item[field.Config.SelectSaveField] == labelName);
                if (obj) labelName = obj[field.Config.SelectLabel];
                return labelName;
            };
        },
        GetSearchFieldList: function () {
            return function (type, InOrOut) {
                var self = this;
                if (self.SearchFieldIds.length == 0) {
                    return [];
                }
                var result = [];
                //注意：SearchFieldIds有可能是List<Guid>，也可能是List<{Id,Name,Label,AsName,TableId,TableName,TableDescription,DisplayType:'In/Out',DisplaySelect}>
                self.SearchFieldIds.forEach((id) => {
                    self.DiyFieldList.forEach((field) => {
                        if (typeof id != "string" && !self.DiyCommon.IsNull(InOrOut)) {
                            if (id.DisplayType != InOrOut) {
                                return;
                            }
                        }
                        if ((field.Id == id || field.Id == id.Id) && id.Hide !== true) {
                            //初始化SearchNumber
                            if (field.Type && field.Type && (field.Type == "int" || field.Type.indexOf("decimal") > -1) && self.DiyCommon.IsNull(self.SearchNumber[field.Name])) {
                                self.SearchNumber[field.Name] = { Min: "", Max: "" };
                                self.SearchNumber[field.Name] = { Min: "", Max: "" };
                            }

                            //如果是多选框搜索。但如果勾选了【下拉】，这时候就不能返回了
                            if (type == "Checkbox" && Array.isArray(field.Data) && field.Data.length > 0 && field.Config.DataSourceSqlRemote !== true && id.DisplaySelect !== true) {
                                if (self.DiyCommon.IsNull(self.SearchCheckbox[field.Name])) {
                                    // self.SearchModel[field.Name] = [];
                                    self.SearchCheckbox[field.Name] = [];
                                }
                                result.push(field);
                            }
                            //如果是文本框like模糊搜索
                            else if (type == "Text" && (!Array.isArray(field.Data) || field.Data.length == 0 || field.Config.DataSourceSqlRemote === true || id.DisplaySelect === true)) {
                                result.push(field);
                            }
                            //如果type没有传
                            else if (self.DiyCommon.IsNull(type)) {
                                result.push(field);
                            }
                            //如果是时间搜索？
                            //如果是 true/false 搜索
                            //  result.push(field)
                        }
                    });
                });
                return result;
            };
        }
    },
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
        ParentFormLoadFinish: { type: Boolean, default: null },
        /**
         * 加载模式：可能是Design（表单设计）
         */
        LoadMode: { type: String, default: "" }
    },
    watch: {
        PropsWhere(newVal, oldVal) {
            if (!_u.isEqual(newVal, oldVal)) this.Init();
        },
        ParentFormLoadFinish(newVal) {
            if (newVal === true) this.Init();
        },
        TableChildSysMenuId() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },
        TableChildFkFieldName() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },
        PrimaryTableFieldName() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },
        // 2025-10-29 liucheng新增：监听PropsSysMenuId和PropsTableId的变化，确保OpenTable模式下正确初始化
        PropsSysMenuId() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },
        PropsTableId() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },
        PropsModuleEngineKey() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },

        // TableChildFkValue: function (newVal, oldVal) {
        //     var self = this;
        //     if (!self.DiyCommon.IsNull(newVal)) {
        //         var value = {};
        //         value[self.TableChildFkFieldName] = newVal;
        //         self.FieldFormDefaultValues=[value];
        //     }else{
        //         self.FieldFormDefaultValues=[];
        //     }
        //     self.Init()
        // },
        //当此控件为子表时，父form关闭弹层时，这个值会变成'空值，也会再一次执行这里的watch
        TableChildTableRowId: function (newVal, oldVal) {
            var self = this;
            if (!self.DiyCommon.IsNull(newVal)) {
                // self.SetFieldFormDefaultValues(newVal);
                if (self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    self.SetFieldFormDefaultValues(newVal);
                } else {
                    //2022-07-23新增也可能不跟主表的Id进行关联
                    if (self.PrimaryTableFieldName) {
                        self.SetFieldFormDefaultValues(self.FatherFormModel_Data[self.PrimaryTableFieldName]);
                    } else {
                        self.SetFieldFormDefaultValues(self.FatherFormModel_Data.Id);
                    }
                }
                //2022-07-13新增
                // if(self.ParentFormLoadFinish !== false){
                //     //如果主表重新打开了其它的rowModel，Field-Form的TableChildTableRowId会变，这里监控到需要重新加载数据
                //     self.Init();
                // }
            } else {
                //2022-02-17 有可能二次开发传过来的FormDefaultValues
                self.FieldFormDefaultValues = { ...self.FormDefaultValues };
            }
            //2022-07-13注释
            if (self.ParentFormLoadFinish !== false) {
                //如果主表重新打开了其它的rowModel，Field-Form的TableChildTableRowId会变，这里监控到需要重新加载数据
                self.Init();
            }
        },
        FatherFormModel: function (newVal, oldVal) {
            var self = this;
            if (!self.DiyCommon.IsNull(newVal)) {
                // self.SetFieldFormDefaultValues(self.TableChildTableRowId);
                if (self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    self.SetFieldFormDefaultValues(self.TableChildTableRowId);
                } else {
                    //2022-07-23新增也可能不跟主表的Id进行关联
                    if (self.PrimaryTableFieldName) {
                        self.SetFieldFormDefaultValues(self.FatherFormModel_Data[self.PrimaryTableFieldName]);
                    } else {
                        self.SetFieldFormDefaultValues(self.FatherFormModel_Data.Id);
                    }
                }
            } else {
                //2022-02-17 有可能二次开发传过来的FormDefaultValues
                self.FieldFormDefaultValues = { ...self.FormDefaultValues };
            }
        },
        TableChildField: function (newVal, oldVal) {
            var self = this;
        }
    },
    data() {
        return {
            TableDisplayMode: "", //Table、Card
            ShowDiyModule: false,
            // ========== 定时器ID存储（用于防止内存泄漏） ==========
            _importStepTimer: null,
            _debounceTimer: null,
            // ========== V8引擎字段缓存 ==========
            _cachedDiyFieldList: null,
            _cachedDiyFieldListVersion: 0,

            CommentContent: "",
            ShowHideField: false,
            ShowAnyTable: false,
            OpenAnyTableParam: {},
            Where: [],
            PageType: "", //=Report时为报表
            DataLogListLoading: true,
            DataLogList: [],
            DataCommentListLoading: true,
            DataCommentList: [],
            FormRightType: "WorkFlow",
            EnableDataLog: false,
            DiyCustomDialogConfig: {},
            // regionData:regionData,
            StartWorkSubmited: false,
            //{WorkType:'StartWork(发起流程)/ViewWork(查看流程)',FlowDesignId:'', FormMode:''}
            OpenDiyFormWorkFlowType: {},
            OpenDiyFormWorkFlow: false,
            BtnExportLoading: false,
            NotSaveField: [],
            CurrentTableRowListActiveTab: {},
            //查询列
            TableDiyFieldIds: [],
            Canboda: false,
            CanbodaYinhao: "",
            DevComponents: {},
            TempLoading: {},
            Shangquan_Data: [],
            ShowFormBottomBtns: {
                SaveClose: true,
                SaveAdd: true,
                SaveUpdate: true,
                SaveView: true
            },
            TableMultipleSelection: [],
            TableSelectedRow: {},
            TableSelectedRowLast: {},
            TableEnableBatch: false,
            // 性能优化V3：全局共享菜单状态
            _moreMenuVisible: false,
            _moreMenuRow: null,
            _moreMenuPosition: { top: 0, left: 0 },
            // 移动端搜索弹窗状态
            showMobileSearch: false,
            // BtnLoading:false,
            BtnV8Loading: false,
            ShowAllSearch: false,
            TableRowListActiveTab: "", //TableRowList
            FormMode: "View",
            NeedDiyTemplateFieldLst: ["DevComponent", "TableChild", "Map", "MapArea", "FontAwesome", "ImgUpload"], //'Switch',
            FixedNotShowField: ["Divider"], //, 'ImgUpload', 'FileUpload'
            FieldFormDefaultValues: {},
            StatisticsFields: null,
            BtnLoading: false,
            ShowImport: false,
            ShowFieldFormHide: true,
            ShowFieldForm: false,
            ShowFieldFormDrawer: false,
            tableLoading: true,
            SearchModel: {},
            SearchEqual: {},
            V8SearchModel: {},
            SearchCheckbox: {},
            SearchDateTime: {},
            SearchNumber: {},
            Keyword: "",
            DiyTableRowList: [],
            OldDiyTableRowList: [],
            DiyTableRowCount: 0,
            CurrentDiyTableModel: {},
            DiyFieldList: [],
            TableId: "",
            TableName: "",
            TableRowId: "",
            CurrentRowModel: {},
            DiyTableRowPageSize: 15,
            DiyTableRowPageIndex: 1,
            ImportStepList: [],
            ShowDiyFieldList: null,
            // 🔥 性能优化：分批渲染表格列
            _renderedColumnCount: 10, // 首批渲染10列
            _allFieldList: null, // 存储完整字段列表
            _OrderBy: "",
            _OrderByType: "",
            SearchFieldIds: [], // SearchFieldIds
            SortFieldIds: [],
            NotShowFields: [],
            FixedFields: [],
            MoileListFields: [],
            SysMenuModel: {},
            SysMenuId: "",
            FieldFormSelectFields: [],
            FieldFormFixedTabs: [],
            FieldFormHideFields: [],
            // SysMenuNeedConvertField: [
            //     "TableDiyFieldIds",
            //     "NotShowFields",
            //     "SearchFieldIds",
            //     "SortFieldIds",
            //     "DiyConfig",
            //     "StatisticsFields",
            //     'MoreBtns',
            // ],
            TempBtnIsVisible: [],
            MaxRowBtnsOut: 0,
            ShowUpdateBtn: true,
            ShowDeleteBtn: true,
            ShowSaveBtn: true,
            ShowHideFieldsList: [],
            FatherFormModel_Data: null,
            ParentV8_Data: null,
            LastOrderBy: "",
            FormWF: {},
            CurrentSelectedRowModel: {},
            CloseFormNeedConfirm: false,
            SearchWhere: [],
            isCheckDataLog: false, //角色是否允许访问日志
            IsVisibleAdd: false, //是否允许新增按钮显示,2025-5-1刘诚（某些条件下不允许新增，代码控制）
            ShowMockPermissionDialog: false,
            MockPermissionRoleList: [],
            MockPermissionBtnList: [],
            // ========== 内存优化相关 ==========
            _isDestroyed: false, // 组件销毁标志
            _paginationVersion: 0, // 分页版本号，用于取消旧请求的异步操作
            _currentAbortController: null, // 用于取消正在进行的HTTP请求
            // ========== 移动端无限滚动相关 ==========
            mobileLoadingMore: false, // 移动端加载更多数据中
            mobileScrollHandler: null // 滚动事件处理函数引用
        };
    },
    mounted() {
        var self = this;
        
        // 🔥 添加明显的日志，确认组件挂载
        console.log('%c[DiyTableRowlist] ========== mounted 被触发 ==========', 'color: blue; font-size: 16px; font-weight: bold');
        console.log('[DiyTableRowlist] 当前路由:', self.$route.fullPath);
        console.log('[DiyTableRowlist] ContainerClass prop 值:', self.ContainerClass);
        console.log('[DiyTableRowlist] PropsTableType 值:', self.PropsTableType);
        console.log('[DiyTableRowlist] 所有 props:', { 
            ContainerClass: self.ContainerClass,
            PropsTableType: self.PropsTableType,
            TableChildTableId: self.TableChildTableId,
            TableChildSysMenuId: self.TableChildSysMenuId
        });
        
        // 记录当前加载的路由，用于 activated 时判断
        self._lastLoadedRoute = self.$route.fullPath;
        
        self.PageType = self.$route.query.PageType;
        if (self.ParentFormLoadFinish !== false) {
            self.Init();
        }
        
        // 🔥 监听全局刷新事件
        self._handlePageRefresh = (event) => {
            // 使用 SysMenuId 精确匹配，避免同一个组件的不同实例都被刷新
            if (event.detail && event.detail.sysMenuId && event.detail.sysMenuId === self.SysMenuId) {
                console.log('[DiyTableRowlist] 收到刷新事件，SysMenuId 匹配，重新加载数据');
                // console.log('[DiyTableRowlist] 事件 SysMenuId:', event.detail.sysMenuId, '当前 SysMenuId:', self.SysMenuId);
                self.InitSearch();
                self.Init();
            } else {
                console.log('[DiyTableRowlist] 收到刷新事件，但 SysMenuId 不匹配，忽略');
                // console.log('[DiyTableRowlist] 事件 SysMenuId:', event.detail?.sysMenuId, '当前 SysMenuId:', self.SysMenuId);
            }
        };
        window.addEventListener('page-refresh', self._handlePageRefresh);
        
        // 移动端无限滚动监听
        if (self.diyStore.IsPhoneView) {
            self.initMobileScroll();
        }
    },
    // 🔥 activated 钩子：组件被 keep-alive 激活时触发
    activated() {
        var self = this;
        console.log('%c[DiyTableRowlist] ========== activated 被触发 ==========', 'color: green; font-size: 16px; font-weight: bold');
        console.log('[DiyTableRowlist] 当前路由:', self.$route.fullPath);
        console.log('[DiyTableRowlist] 上次加载的路由:', self._lastLoadedRoute);
        
        // 检查路由是否发生变化（这种情况发生在标签数超过 max 时，组件被销毁后又被重用）
        if (self._lastLoadedRoute && self._lastLoadedRoute !== self.$route.fullPath) {
            console.log('%c[DiyTableRowlist] 检测到路由变化，重新初始化', 'color: orange; font-size: 14px; font-weight: bold');
            // 更新记录的路由
            self._lastLoadedRoute = self.$route.fullPath;
            // 重新初始化
            self.InitSearch();
            self.Init();
        }
    },
    async created() {
        var self = this;
    },
    methods: {
        /**
         * 初始化移动端滚动监听
         */
        initMobileScroll() {
            var self = this;
            
            // 移除旧的监听器
            if (self.mobileScrollHandler) {
                window.removeEventListener('scroll', self.mobileScrollHandler);
            }
            
            // 创建新的监听器（使用 underscore 的 debounce）
            self.mobileScrollHandler = _u.debounce(function() {
                if (self.mobileLoadingMore || self._isDestroyed) return;
                
                // 获取滚动位置
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const windowHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;
                
                // 到达底部前 200px 开始加载
                if (scrollTop + windowHeight >= documentHeight - 200) {
                    // 检查是否还有更多数据
                    if (self.DiyTableRowList.length < self.DiyTableRowCount) {
                        self.loadMoreMobileData();
                    }
                }
            }, 200);
            
            window.addEventListener('scroll', self.mobileScrollHandler);
        },
        
        /**
         * 移动端加载更多数据
         */
        async loadMoreMobileData() {
            var self = this;
            
            if (self.mobileLoadingMore) return;
            
            self.mobileLoadingMore = true;
            
            try {
                // 计算下一页
                self.DiyTableRowPageIndex += 1;
                
                // 获取新数据（不重置 pageIndex）
                await self.GetDiyTableRow({ _append: true });
                
            } catch (error) {
                console.error('加载更多数据失败:', error);
                // 恢复 pageIndex
                self.DiyTableRowPageIndex -= 1;
            } finally {
                self.mobileLoadingMore = false;
            }
        },
        
        ShiftTableDisplayMode(){
            var self = this;
            if(self.TableDisplayMode == "Table"){
                self.TableDisplayMode = "Card";
            }else{
                self.TableDisplayMode = "Table";
            }
        },
        GetFileServerUrl(url) {
            var self = this;
            if (!url) {
                return url;
            }
            if (url.startsWith('http')) {
                return url;
            }
            if(typeof(url) == 'object'){
                return self.SysConfig.FileServer + url.Path;
            }
            if(url.startsWith('{')){
                var urlObj = JSON.parse(url);
                return self.SysConfig.FileServer + urlObj.Path;
            }
            if(url.startsWith('[')){
                var urlArr = JSON.parse(url);
                if(urlArr.length > 0){
                    return self.SysConfig.FileServer + urlArr[0].Path;
                }
            }
            return self.SysConfig.FileServer + url;
        },
        /**
         * 获取表格卡片列数
         * 注意：el-col 的 span 总和必须 <= 24，但 Element Plus 支持小数和自定义 class
         * TableCardCol 配置表示每行显示几个卡片
         * 特殊处理：一行5个时返回特殊值 'five'，通过 CSS 实现
         */
        GetTableCardCol() {
            var self = this;
            if (!self.SysMenuModel || !self.SysMenuModel.TableCardCol) {
                return 4; // 默认每行4个，span=6
            }

            const cardsPerRow = self.SysMenuModel.TableCardCol;
            
            // 特殊处理一行5个的情况
            if (cardsPerRow === 5) {
                return 'five'; // 使用特殊标记，通过 CSS 实现20%宽度
            }
            
            // 直接计算 span：24 / 每行个数，向下取整
            const span = Math.floor(24 / cardsPerRow);
            
            // 确保 span 至少为 1
            return Math.max(span, 1);
        },
        /**
         * 判断是否使用自定义5列布局
         */
        IsCardFiveCol() {
            var self = this;
            if (!self.SysMenuModel || !self.SysMenuModel.TableCardCol) {
                return true;
            }
            return self.SysMenuModel && self.SysMenuModel.TableCardCol === 5;
        },
        // ========== Clear 方法：供父组件调用清理数据 ==========
        Clear() {
            var self = this;
            console.log('[DiyTableRowlist] Clear 被调用');
            
            // 清理表格数据及其内部引用
            if (self.DiyTableRowList && self.DiyTableRowList.length > 0) {
                self.DiyTableRowList.forEach(row => {
                    if (row) {
                        if (row._RowMoreBtnsOut) {
                            row._RowMoreBtnsOut.length = 0;
                            row._RowMoreBtnsOut = null;
                        }
                        if (row._RowMoreBtnsIn) {
                            row._RowMoreBtnsIn.length = 0;
                            row._RowMoreBtnsIn = null;
                        }
                    }
                });
                self.DiyTableRowList.length = 0;
            }
            self.DiyTableRowList = [];
            
            // 清理选择状态
            if (self.TableMultipleSelection) {
                self.TableMultipleSelection.length = 0;
            }
            self.TableMultipleSelection = [];
            self.TableSelectedRow = {};
            
            // 清理搜索状态
            self.SearchModel = {};
            self.SearchEqual = {};
            self.V8SearchModel = {};
            
            // 清理全局菜单状态
            self._moreMenuVisible = false;
            self._moreMenuRow = null;
            
            // 重置分页
            self.PageIndex = 1;
            self.Total = 0;
        },
        
        // ========== 抽屉打开动画完成后初始化表单 ==========
        onDrawerOpened() {
            var self = this;
            // 从临时保存的上下文中恢复参数
            var isOpenWorkFlowForm = self._pendingDrawerContext?.isOpenWorkFlowForm;
            var wfParam = self._pendingDrawerContext?.wfParam;
            var formMode = self._pendingDrawerContext?.formMode;
            
            self.CloseFormNeedConfirm = false;
            
            // 使用重试机制等待 fieldForm ref 准备好
            var retryCount = 0;
            var maxRetries = 20; // 最多重试20次
            var retryInterval = 50; // 每次间隔50ms
            
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
                        console.error('[DiyTableRowlist] Drawer fieldForm ref 在 ' + (maxRetries * retryInterval) + 'ms 后仍不存在');
                    }
                }
            };
            
            tryInitFieldForm();
            
            if (isOpenWorkFlowForm == true) {
                if (self.DiyCommon.IsNull(wfParam)) {
                    wfParam = { WorkType: "ViewWork" };
                }
                wfParam.FormMode = formMode;
                self.InitWorkFlow(wfParam);
            }
            
            // 清理临时上下文
            self._pendingDrawerContext = null;
        },
        
        // ========== 抽屉关闭动画完成后的清理 ==========
        onDrawerClosed() {
            var self = this;
            // 清理当前行数据引用
            self.CurrentRowModel = {};
            self.CloseFormNeedConfirm = false;
            // 清理临时上下文
            self._pendingDrawerContext = null;
            // 强制触发垃圾回收（如果浏览器支持）
            if (window.gc) {
                try { window.gc(); } catch(e) {}
            }
        },
        
        // ========== 弹窗关闭动画完成后的清理 ==========
        onDialogClosed() {
            var self = this;
            console.log('[DiyTableRowlist] 弹窗关闭动画完成，执行额外清理');
            // 清理当前行数据引用
            self.CurrentRowModel = {};
            self.CloseFormNeedConfirm = false;
        },
        
        // ========== 性能优化V3：全局共享菜单方法 ==========
        showMoreMenu(event, row) {
            var self = this;
            event.stopPropagation();
            
            // 计算菜单位置
            const rect = event.target.getBoundingClientRect();
            self._moreMenuPosition = {
                top: rect.bottom + 5,
                left: rect.right - 150 // 菜单宽度约150px，右对齐
            };
            
            // 设置当前行数据并显示菜单
            self._moreMenuRow = row;
            self._moreMenuVisible = true;
            
            // 添加全局点击事件监听，点击其他地方关闭菜单
            setTimeout(() => {
                document.addEventListener('click', self.hideMoreMenu, { once: true });
            }, 0);
        },
        hideMoreMenu() {
            var self = this;
            self._moreMenuVisible = false;
            self._moreMenuRow = null;
            // 确保移除事件监听器（虽然使用了once选项，但手动移除更保险）
            document.removeEventListener('click', self.hideMoreMenu);
        },
        handleMoreMenuAction(action, btn) {
            var self = this;
            const row = self._moreMenuRow;
            self.hideMoreMenu();
            
            if (!row) return;
            
            switch (action) {
                case 'edit':
                    self.OpenDetail(row, 'Edit');
                    break;
                case 'delete':
                    self.DelDiyTableRow(row);
                    break;
                case 'custom':
                    if (btn) {
                        self.RunMoreBtn(btn, row);
                    }
                    break;
            }
        },
        // ========== 性能优化V3 END ==========
        
        GetColWidth(field, fieldIndex) {
            var self = this;
            if (fieldIndex == self.ShowDiyFieldList.length - 1) {
                return "";
            }
            if (!field.TableWidth) {
                return 150;
            }
            return field.TableWidth;
        },
        SubmitComment() {
            var self = this;
            self.DiyCommon.FormEngine.AddFormData(
                "mic_data_comment",
                {
                    Title: "",
                    Content: self.CommentContent,
                    DataId: self.TableRowId,
                    TableId: self.CurrentDiyTableModel.Id,
                    TableName: self.CurrentDiyTableModel.Name,
                    Avatar: self.GetCurrentUser.Avatar,
                    Account: self.GetCurrentUser.Account,
                    AccountUserId: self.GetCurrentUser.Id
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips("评论成功！");
                        self.CommentContent = "";
                        self.GetCommentList();
                    }
                }
            );
        },
        isMuban(field, scope) {
            // 把 !DiyCommon.IsNull(field.V8TmpEngineTable) && scope.row[field.Name + '_TmpEngineResult'] !== undefined 做成计算属性
            return !this.DiyCommon.IsNull(field.V8TmpEngineTable) && scope.row[field.Name + "_TmpEngineResult"] !== undefined;
        },
        authorization() {
            return "Bearer " + this.DiyCommon.Authorization();
        },
        // 处理图片加载失败
        handleImageError(event) {
            event.target.style.display = "none";
        },
        // 预览图片（el-image 组件已内置预览功能，此方法保留以备扩展）
        previewImage(imageUrl) {
            // el-image 组件自带预览功能，无需额外处理
        },
        // 获取第一张图片URL（用于缩略图显示）
        getFirstImageUrl(imageData) {
            if (this.DiyCommon.IsNull(imageData)) {
                return "";
            }

            try {
                // 尝试解析JSON数组
                const imageList = JSON.parse(imageData);
                if (Array.isArray(imageList) && imageList.length > 0) {
                    return this.DiyCommon.GetServerPath(imageList[0].Path);
                }
            } catch (e) {
                // 如果不是JSON格式，直接当作单张图片处理
                return this.DiyCommon.GetServerPath(imageData);
            }

            return this.DiyCommon.GetServerPath(imageData);
        },
        // 获取图片预览列表（用于轮播）
        getImagePreviewList(imageData) {
            if (this.DiyCommon.IsNull(imageData)) {
                return [];
            }

            try {
                // 尝试解析JSON数组
                const imageList = JSON.parse(imageData);
                if (Array.isArray(imageList) && imageList.length > 0) {
                    return imageList.map((item) => this.DiyCommon.GetServerPath(item.Path));
                }
            } catch (e) {
                // 如果不是JSON格式，直接当作单张图片处理
                return [this.DiyCommon.GetServerPath(imageData)];
            }

            return [this.DiyCommon.GetServerPath(imageData)];
        },
        indexMethod(index) {
            var self = this;
            if (self.SysMenuModel.TableIndexAdditive) {
                return (self.DiyTableRowPageIndex - 1) * self.DiyTableRowPageSize + index + 1;
            }
            return index + 1;
        },
        /**
         * Bug6新增：显示列头搜索功能
         * @param {Object} field - 字段对象
         * @param {Event} event - 点击事件
         */
        showColumnSearch(field, event) {
            const self = this;
            
            // 阻止事件冒泡，避免触发排序
            event.stopPropagation();
            
            // 根据不同组件类型显示不同的搜索方式
            const component = field.Component;
            
            // 使用 ElMessageBox 作为快速搜索入口
            if (component === 'Select' || component === 'MultipleSelect') {
                // 下拉选择类字段：显示选项列表供快速筛选
                this.showSelectSearch(field);
            } else if (component === 'DateTime' || component === 'Date' || component === 'Time') {
                // 日期时间类字段：显示日期范围选择
                this.showDateTimeSearch(field);
            } else if (component === 'NumberText' || component === 'Number') {
                // 数字类字段：显示范围输入
                this.showNumberRangeSearch(field);
            } else if (component === 'Switch') {
                // 开关类字段：显示是/否选项
                this.showSwitchSearch(field);
            } else {
                // 其他文本类字段：显示简单输入框
                this.showTextSearch(field);
            }
        },
        /**
         * 文本搜索
         */
        async showTextSearch(field) {
            const self = this;
            const currentValue = self.SearchModel[field.Name] || '';
            
            try {
                const value = await this.$prompt('请输入搜索内容', field.Label, {
                    confirmButtonText: '搜索',
                    cancelButtonText: '清除',
                    inputValue: currentValue,
                    inputPlaceholder: `请输入${field.Label}`
                }).catch(() => null);
                
                if (value === null) {
                    // 点击取消 - 清除搜索
                    delete self.SearchModel[field.Name];
                } else if (value.value) {
                    self.SearchModel[field.Name] = value.value;
                } else {
                    delete self.SearchModel[field.Name];
                }
                
                self.GetDiyTableRow({ _PageIndex: 1 });
            } catch (error) {
                console.log('取消搜索');
            }
        },
        /**
         * 下拉选择搜索
         */
        async showSelectSearch(field) {
            const self = this;
            
            // 创建一个简单的选择界面
            const options = field.Data || [];
            const html = `
                <div style="max-height: 300px; overflow-y: auto;">
                    ${options.map(opt => {
                        const label = typeof opt === 'string' ? opt : (opt[field.Config.SelectLabel || 'Name'] || opt.Name);
                        const value = typeof opt === 'string' ? opt : (opt[field.Config.SelectValue || 'Id'] || opt.Id);
                        return `<div class="search-option-item" data-value="${value}" style="padding: 8px; cursor: pointer; border-bottom: 1px solid #eee;">${label}</div>`;
                    }).join('')}
                </div>
            `;
            
            try {
                await this.$alert(html, field.Label + ' - 选择搜索', {
                    dangerouslyUseHTMLString: true,
                    confirmButtonText: '清除搜索',
                    callback: () => {
                        delete self.SearchEqual[field.Name];
                        self.GetDiyTableRow({ _PageIndex: 1 });
                    }
                });
                
                // 添加点击事件监听
                setTimeout(() => {
                    document.querySelectorAll('.search-option-item').forEach(item => {
                        item.addEventListener('click', function() {
                            self.SearchEqual[field.Name] = this.dataset.value;
                            self.GetDiyTableRow({ _PageIndex: 1 });
                            // 关闭弹窗
                            document.querySelector('.el-message-box__headerbtn').click();
                        });
                    });
                }, 100);
            } catch (error) {
                console.log('取消搜索');
            }
        },
        /**
         * 日期时间搜索
         */
        async showDateTimeSearch(field) {
            const self = this;
            
            // 简化版：使用输入框输入日期范围
            try {
                const result = await this.$prompt('请输入日期范围（格式：2024-01-01 至 2024-12-31）', field.Label, {
                    confirmButtonText: '搜索',
                    cancelButtonText: '清除',
                    inputPlaceholder: 'YYYY-MM-DD 至 YYYY-MM-DD'
                }).catch(() => null);
                
                if (result === null) {
                    delete self.SearchDateTime[field.Name];
                } else if (result.value) {
                    const dates = result.value.split('至').map(d => d.trim());
                    if (dates.length === 2) {
                        self.SearchDateTime[field.Name] = dates;
                    }
                } else {
                    delete self.SearchDateTime[field.Name];
                }
                
                self.GetDiyTableRow({ _PageIndex: 1 });
            } catch (error) {
                console.log('取消搜索');
            }
        },
        /**
         * 数字范围搜索
         */
        async showNumberRangeSearch(field) {
            const self = this;
            
            try {
                const result = await this.$prompt('请输入数字范围（格式：100-500 或 >100 或 <500）', field.Label, {
                    confirmButtonText: '搜索',
                    cancelButtonText: '清除',
                    inputPlaceholder: '例如：100-500'
                }).catch(() => null);
                
                if (result === null) {
                    delete self.SearchNumber[field.Name];
                } else if (result.value) {
                    self.SearchNumber[field.Name] = result.value;
                } else {
                    delete self.SearchNumber[field.Name];
                }
                
                self.GetDiyTableRow({ _PageIndex: 1 });
            } catch (error) {
                console.log('取消搜索');
            }
        },
        /**
         * 开关搜索
         */
        async showSwitchSearch(field) {
            const self = this;
            
            try {
                const result = await this.$confirm(field.Label, '选择状态', {
                    distinguishCancelAndClose: true,
                    confirmButtonText: '是',
                    cancelButtonText: '否',
                    type: 'info'
                }).catch(action => action);
                
                if (result === 'confirm') {
                    self.SearchEqual[field.Name] = true;
                } else if (result === 'cancel') {
                    self.SearchEqual[field.Name] = false;
                } else {
                    delete self.SearchEqual[field.Name];
                }
                
                self.GetDiyTableRow({ _PageIndex: 1 });
            } catch (error) {
                console.log('取消搜索');
            }
        },
        ShowFormRight() {
            var self = this;
            //OpenDiyFormWorkFlow == true || CurrentDiyTableModel.EnableDataLog
            if (self.OpenDiyFormWorkFlow) {
                return true;
            }
            if (!self.OpenDiyFormWorkFlow && self.CurrentDiyTableModel.EnableDataLog && self.isCheckDataLog && self.FormMode != "Add") {
                return true;
            }
            if (!self.OpenDiyFormWorkFlow && self.CurrentDiyTableModel.EnableDataComment && self.FormMode != "Add") {
                return true;
            }
            return false;
        },
        //可传入外键Id值 、父表model
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
                var sysMenuResult = await self.DiyCommon.PostAsync("/api/FormEngine/GetSysMenu", {
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
                var sysMenuResult = await self.DiyCommon.PostAsync("/api/FormEngine/GetSysMenu", {
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
            // 取缓存中的DiyTableRowPageSize
            try {
                var cacheDiyTableRowPageSize = self.$localStorageManager ? self.$localStorageManager.getTableConfig(self.TableId) : localStorage.getItem("Microi.DiyTableRowPageSize_" + self.TableId);
                if (!self.DiyCommon.IsNull(cacheDiyTableRowPageSize)) {
                    self.DiyTableRowPageSize = Number(cacheDiyTableRowPageSize);
                }
            } catch (error) {
                self.DiyTableRowPageSize = 10;
            }
            //这里修改，应该是先取SysMenuModel，再取DiyTableRow数据，因为SysMenuModel可能包含Tabs设置的条件
            self.GetAllData({ IsInit: true });

            self.$nextTick(function () {
                self.SetDiyTableMaxHeight();
            });
        },
        DiyTableSetCurrentRow(row) {
            var self = this;
            self.$refs["diy-table-" + self.TableId].setCurrentRow(row);
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
        GetUploadData() {
            var self = this;
            var result = {
                Limit: true,
                TableId: self.TableId,
                UserId: self.GetCurrentUser.Id
            };
            if (!self.DiyCommon.IsNull(self.TableChildFkFieldName)) {
                result["_FormData"] = {};
                if (!self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    if (self.PrimaryTableFieldName) {
                        result["_FormData"][self.TableChildFkFieldName] = self.FatherFormModel_Data[self.PrimaryTableFieldName];
                    } else {
                        result["_FormData"][self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
                    }
                } else {
                    result["_FormData"][self.TableChildFkFieldName] = self.TableChildTableRowId;
                }
                //由于此upload组件不支持给_RowModel传入object，所以临时使用_FieldId字段
                // result['_FormData'] = JSON.stringify(result['_FormData']);
                result["_FieldId"] = JSON.stringify(result["_FormData"]);
                delete result["_FormData"];
            }
            return result;
        },
        GetMoreBtnStyle(btn) {
            var self = this;
            if (btn.BtnStyle) {
                return btn.BtnStyle;
            }
            return "primary";
        },
        GetDiyCustomDialogDataAppend() {
            var self = this;
            var result = {
                V8: {}
            };
            if (self.DiyCustomDialogConfig.DataAppend) {
                for (const key in self.DiyCustomDialogConfig.DataAppend) {
                    result[key] = self.DiyCustomDialogConfig.DataAppend[key];
                }
            }
            result.V8 = self.SetV8DefaultValue(result.V8);
            result.V8["CloseThisDialog"] = self.CloseThisDialog;
            return result;
        },
        CloseThisDialog() {
            var self = this;
            self.$refs.refDiyCustomDialog.CloseDialog();
        },
        
        /**
         * 发起工作前，提交表单
         * @param {*} param
         * @param {*} callback  回调函数，表单提交完成后、流程发起后，必须调用，它会将提交按钮重置为可点击。
         */
        async CallbackStartWork(param, callback) {
            var self = this;

            try {
                //-------第1步：在表单提交前，先执行节点开始v8。
                //此v8说明：
                //a、可以终止表单和流程的提交（也就是它是在【表单提前交V8事件】之前执行）
                //b、可以修改表单中的值
                //c、获取用户点击的是同意还是拒绝、填写的意见
                //d、获取用户添加了哪些审批人、选择了哪些审批人

                //先获取表单数据
                var formData = self.$refs.fieldForm.GetFormData();
                // 判断需要执行的V8
                var v8Result = await self.$refs.refWfWorkHandler_2.RunNodeStartV8({
                    Form: formData
                });
                if (v8Result.Result === false) {
                    if (callback) {
                        callback();
                    }
                    return;
                }
                if (v8Result.Form) {
                    self.$refs.fieldForm.SetFormData(v8Result.Form);
                } else {
                    v8Result.Form = formData;
                }
                //-------第1步 END
                //第一次表单提交是Add，但第二次提交一定要是Edit（有可能因为没找到审批人，导致表单提交成功，但流程提交失败，这时候重新提交，表单就需要是修改操作，不然生成重复数据）
                var formParam = {
                    FormMode: self.StartWorkSubmited == false && self.OpenDiyFormWorkFlowType.FormMode == "Add" ? "Add" : "Edit", //表单加载模式：新增、编辑
                    SavedType: "Edit" //表单提交后自动刷新后的状态，变成编辑
                };

                //-------第2步：提交表单
                self.$refs.fieldForm.FormSubmit(formParam, async function (success, formData) {
                    if (success == true) {
                        self.StartWorkSubmited = true;
                        //注意：这里一定要回写一下，因为FormSubmit内部无法引用更新这些值
                        self.FormMode = "Edit";
                        self.OpenDiyFormWorkFlowType.FormMode = "Edit";

                        //-------第3步：发起工作
                        self.$refs.refWfWorkHandler_2.StartWork(
                            {
                                FormData: v8Result.Form
                            },
                            function (result) {
                                if (result.Code == 1) {
                                    // self.$emit('CallbackWFSubmit', {Code : 1});
                                    //关闭DiyForm弹层
                                    self.ShowFieldForm = false;
                                    self.ShowFieldFormDrawer = false;
                                    self.ShowYanZhen = false;
                                    self.GetDiyTableRow();
                                } else {
                                    // self.$emit('CallbackWFSubmit', {Code : 0});
                                }
                                //-------第3步 END
                                if (callback) {
                                    callback();
                                }
                            }
                        );
                    } else {
                        if (callback) {
                            callback();
                        }
                    }
                });
            } catch (error) {
                if (callback) {
                    callback();
                }
                throw error;
            }
        },
        DiyTableLoad(tree, treeNode, resolve) {
            var self = this;
            var param = {
                ModuleEngineKey: self.SysMenuModel.ModuleEngineKey,
                // _Where: [{ Name: self.CurrentDiyTableModel.TreeParentField, Value: tree.Id, Type: "=" }]
                _Where: [[self.CurrentDiyTableModel.TreeParentField, "=", tree.Id]]
            };
            if (!param.ModuleEngineKey) {
                param.ModuleEngineKey = self.SysMenuId;
            }
            if (!param.ModuleEngineKey) {
                param.FormEngineKey = self.CurrentDiyTableModel.Name;
            }
            if (!param.ModuleEngineKey && !param.FormEngineKey) {
                param.FormEngineKey = self.TableId;
            }
            self.DiyCommon.Post(
                self.DiyApi.GetTableDataTree,
                param,
                async function (result) {
                    if (self.DiyCommon.Result(result)) {
                        var tempShowDiyFieldList = self.GetShowDiyFieldList();
                        await Promise.all(
                            tempShowDiyFieldList.map(async (field) => {
                                if (field.V8TmpEngineTable) {
                                    await Promise.all(
                                        result.Data.map(async (row) => {
                                            var tmpResult = await self.RunFieldTemplateEngine(field, row);
                                            row[field.Name + "_TmpEngineResult"] = tmpResult;
                                        })
                                    );
                                }
                            })
                        );
                        await self.DiguiDiyTableRowDataList(result.Data);
                        // self.DiyTableRowList = result.Data
                        resolve(result.Data);
                    } else {
                        resolve([]);
                    }
                },
                null,
                null,
                "json"
            );
        },
        OpenMenuForm() {
            var self = this;
            if (self.SysMenuModel.Id) {
                self.BtnLoading = true;
                self.ShowDiyModule = true;
                self.$nextTick(() => {
                    try {
                        self.$refs.refDiyModule.Init(self.SysMenuModel.Id, function () {
                            self.BtnLoading = false;
                        });
                    } catch (error) {
                        self.BtnLoading = false;
                    }
                });
            }
        },
        GetFieldIsReadOnly(field) {
            var self = this;
            if (self.TableChildField.Readonly) {
                return true;
            }
            if (self.NotSaveField && self.TableChildField.Name) {
                for (let index = 0; index < self.NotSaveField.length; index++) {
                    const element = self.NotSaveField[index];
                    if (element.toLowerCase() == self.TableChildField.Name.toLowerCase()) {
                        return true;
                    }
                }
            } else if (self.NotSaveField) {
                // self.DiyCommon.IsNull(field.Readonly) ? false : field.Readonly
                for (let index = 0; index < self.NotSaveField.length; index++) {
                    const element = self.NotSaveField[index];
                    if (element.toLowerCase() == field.Name.toLowerCase()) {
                        return true;
                    }
                }
            }
            return null;
            // TableChildField.Readonly  == true ? true : null
        },
        ColIsDisplay(fieldName) {
            var self = this;
            if (self.NotShowFields.indexOf(fieldName) > -1) {
                return false;
            }
            if (self.TableDiyFieldIds && self.TableDiyFieldIds.find((item) => item == fieldName)) {
                return false;
            }
            if (self.SysMenuModel.SelectFields && self.SysMenuModel.SelectFields.find((item) => item.Name == fieldName)) {
                return false;
            }
            if ((!self.TableDiyFieldIds || self.TableDiyFieldIds.length == 0) && self.DiyFieldList.find((item) => item.Name == fieldName)) {
                return true;
            }
            if (!self.TableDiyFieldIds || self.TableDiyFieldIds.length == 0) {
                return true;
            }
            return true;
        },
        ColIsFixed(fieldId) {
            var self = this;
            if (self.FixedFields.indexOf(fieldId) > -1) {
                return true;
            }
            return false;
        },
        DiyTableCurrentChange(currentRow) {
            var self = this;
            self.TableSelectedRowLast = { ...self.TableSelectedRow };
            self.TableSelectedRow = currentRow;
        },

        async DiyTableRowClick(row, column, event) {
            var self = this;
            var form = { ...row };
            self.CurrentSelectedRowModel = self.DeleteFormProperty(form);
            //执行表单进入V8事件
            //2021-01-19 新增：只有是子表的时候，才执行进入表单事件
            if (self._IsTableChild && self.TableSelectedRow.Id && self.TableSelectedRow.Id != self.TableSelectedRowLast.Id) {
                // 判断需要执行的V8
                self.TableSelectedRowLast = { ...self.TableSelectedRow };
                if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.InFormV8)) {
                    var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                    V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
                    // V8.Form = row;
                    V8.FormSet = (fieldName, value) => {
                        return self.FormSet(fieldName, value, row);
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
            var V8 = await self.DiyCommon.InitV8Code({}, self.$router);;
            try {
                if (!self.DiyCommon.IsNull(self.TableChildField) && !self.DiyCommon.IsNull(self.TableChildField.Config) && !self.DiyCommon.IsNull(self.TableChildField.Config.TableChildRowClickV8)) {
                    V8.Row = row;
                    var form = { ...row };
                    V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
                    // V8.Form = row;
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
                    // eval(btn.V8Code)
                    await eval("(async () => {\n " + self.TableChildField.Config.TableChildRowClickV8 + " \n})()");
                } else {
                    //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误[" + self.TableChildField.Name + "," + self.TableChildField.Label + "]：" + error.message, false);
            } finally {
                
            }
        },
        RefreshChildTable(field, parentFormModel, v8) {
            var self = this;
            self.$emit("CallbakRefreshChildTable", field, parentFormModel, v8);
        },
        //将哪些隐藏的字段显示出来，传入['FieldName', 'FieldName']
        //2021-10-26 新增排序
        ShowHideFields(fields) {
            var self = this;
            // self.ShowDiyFieldList
            self.ShowHideFieldsList = fields;
            self.GetSysMenuModel();
            self.GetDiyField();
        },
        GetAllData(param) {
            var self = this;
            var params = [
                {
                    Url: self.DiyApi.GetSysMenuModel,
                    Param: {
                        Id: self.SysMenuId
                    }
                },
                {
                    Url: self.DiyApi.GetDiyTableModel,
                    Param: {
                        Id: self.TableId
                    }
                },
                //这里注释是因为需要先获取到SysMenu中的JoinTables，再去获取 DiyFields
                // ,{
                //     Url : DiyApi.GetDiyField,
                //     Param: {
                //         TableId: self.TableId,
                //     }
                // }
                //后来还是在后端处理了
                {
                    Url: self.DiyApi.GetDiyFieldByDiyTables,
                    Param: {
                        TableIds: [self.TableId],
                        SysMenuId: self.SysMenuId
                    }
                }
            ];
            //同时获SysMenuModel、DiyTableModel、DiyFieldList（包含了SysMenu中配置的JoinTables）
            self.DiyCommon.PostAll(params, async function (results) {
                if (self.DiyCommon.Result(results[0]) && self.DiyCommon.Result(results[1])) {
                    // && self.DiyCommon.Result(results[2])
                    await self.GetSysMenuModelAfter(results[0]);
                    self.GetDiyTableModelAfter(results[1]);
                    //这里注释是因为需要先获取到SysMenu中的JoinTables，再去获取 DiyFields
                    // self.GetDiyField();
                    //后来还是由后端处理了，这里面要用到SysMenuModel，所以要先处理 GetSysMenuModelAfter。
                    //但是注意一点：GetSysMenuModelAfter 里面的GetDiyTableRow方法下面有句GetShowDiyFieldList这个代码，一定要在GetDiyFieldAfter处理好后执行。
                    self.GetDiyFieldAfter(results[2]);

                    //2022-05-14 新增：全部After处理好了再获取数据
                    var isInit = param && param.IsInit ? true : false;
                    self.GetDiyTableRow({ _PageIndex: 1, IsInit: isInit });
                }
            });
            // self.GetSysMenuModel();
            // self.GetDiyTableModel()
            // self.GetDiyField()
        },
        GetDiyTableMaxHeight() {
            var self = this;
            if (self._IsTableChild || self.PropsIsJoinTable === true || self.PropsTableType == "OpenTable") {
                //如果子表返回 auto，同样也会固定表头，所以直接return。
                return;
            }
            if (!self.DiyCommon.IsNull(self.TableId)) {
                var offset = $("#diy-table-" + self.TableId).offset();
                if (offset) {
                    var top = offset.top;
                    // var height = $('#diy-table-' + self.TableId).height();
                    var result = `calc(100vh - ${top}px - 70px)`;
                    // $('#diy-table-' + self.TableId).height(result);
                    return result;
                }
            }
            return "auto";
        },
        SetDiyTableMaxHeight() {
            var self = this;
            if (!self._IsTableChild) {
                var height = self.GetDiyTableMaxHeight();
                if (height) {
                    $("#diy-table-" + self.TableId).height(height);
                }
            }
        },
        GetOpenFormWidth() {
            var self = this;
            if (self.DiyCommon.GetPageBodyClientWH().Width < 768) {
                return "100%";
            }
            var result = self.DiyCommon.IsNull(self.CurrentDiyTableModel.FormOpenWidth) ? "70%" : self.CurrentDiyTableModel.FormOpenWidth;
            return result;
        },
        async RunV8Code({ field, thisValue, row, callback }) {
            var self = this;
            var V8 = await self.DiyCommon.InitV8Code({}, self.$router);;
            try {
                if (!self.DiyCommon.IsNull(field) && !self.DiyCommon.IsNull(field.Config) && !self.DiyCommon.IsNull(field.Config.V8Code)) {
                    var form = { ...row };
                    V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
                    V8.OldForm = self.OldDiyTableRowList.find((item) => item.Id == row.Id);
                    // V8.Form = row;
                    V8.ThisValue = thisValue;
                    V8.FormSet = (fieldName, value) => {
                        return self.FormSet(fieldName, value, row);
                    }; // 给Form表单其它字段赋值
                    V8.RefreshChildTable = self.RefreshChildTable;
                    V8.EventName = "FieldValueChange";
                    self.SetV8DefaultValue(V8, field);
                    
                    // eval(btn.V8Code)
                    var V8Result = await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + field.Config.V8Code + " \n})()");
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
        //showRow:是否行外显示按钮，而不是更多里面
        //2021-09-02修改：提前计算出按钮分组，别临时计算
        // GetMoreBtnsGroup(showRow, row){
        //     var self = this;
        //     var arr = _u.where(self.SysMenuModel.MoreBtns, { ShowRow : showRow});
        //     //加了这一句报死循环错误 ，后面改成了获取到RowList数据后提前计算出来
        //     self.HandlerBtns(arr, row);
        //     return arr;
        // },
        //是否是多Tabs
        IsPageTabs() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig) && !self.DiyCommon.IsNull(self.SysMenuModel.PageTabs)) {
                if (self.SysMenuModel.PageTabs.length > 1 || (self.SysMenuModel.PageTabs.length == 1 && self.SysMenuModel.PageTabs[0].Id != "none" && self.SysMenuModel.PageTabs[0].Name != "")) {
                    return true;
                }
            }
            return false;
        },
        SwitchTableBatch() {
            var self = this;
            self.TableEnableBatch = !self.TableEnableBatch;
        },
        InitSearch() {
            var self = this;
            let search_where = window.location.pathname + window.location.search + window.location.hash + "search_where";

            sessionStorage.removeItem(search_where); //移除搜索session 李赛赛 2025-06-25
            self.Keyword = "";
            self.SearchModel = {};
            self.SearchCheckbox = {};
            self.SearchDateTime = {};
            self.SearchNumber = {};
            self.SearchWhere = [];
            if (self.$refs.refDiySearch1) {
                self.$refs.refDiySearch1.InitSearch();
            }
            if (self.$refs.refDiySearch2) {
                self.$refs.refDiySearch2.InitSearch();
            }
            if (self.$refs.refDiySearch3) {
                self.$refs.refDiySearch3.InitSearch();
            }
        },
        IsPermission(type) {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = _u.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (roleLimitModel.length > 0) {
                var result = true;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf(type) > -1) {
                        result = false;
                    }
                });
                return result;
            }
            return true;
        },
        LimitAdd() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = _u.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (self.TableChildFormMode != "View" && roleLimitModel.length > 0) {
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf("Add") > -1 || element.Permission.indexOf("Insert") > -1) {
                        result = true;
                    }
                });
                return result;
            }
            return false;
        },
        LimitImport() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = _u.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (self.TableChildFormMode != "View" && roleLimitModel.length > 0) {
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf("Import") > -1) {
                        result = true;
                    }
                });
                return result;
            }
            return false;
        },
        LimitExport() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = _u.where(self.GetCurrentUser._RoleLimits, {
                FkId: self.SysMenuId
            });
            if (
                // self.TableChildFormMode != 'View' && //2024-10-25注释，预览模式也要显示导出
                roleLimitModel.length > 0
            ) {
                var result = false;
                roleLimitModel.forEach((element) => {
                    if (element.Permission.indexOf("Export") > -1) {
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
            var roleLimitModel = _u.where(self.GetCurrentUser._RoleLimits, {
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
        LimitDel() {
            var self = this;
            //超级管理员有所有权限
            if (self.GetCurrentUser._IsAdmin) {
                return true;
            }
            var roleLimitModel = _u.where(self.GetCurrentUser._RoleLimits, {
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
        //这里之所以需要一个HandlerBtns，是因为v-if不支持async LimitMoreBtn，需要提前将结果计算出来放到属性中去
        HandlerBtns(btns, row, v8) {
            var self = this;
            if (btns) {
                if (self.DiyCommon.IsNull(row)) {
                    row = {};
                }
                
                // 性能优化：为同一行的所有按钮复用同一个V8对象，减少InitV8CodeSync调用
                var sharedV8 = v8 || self.DiyCommon.InitV8CodeSync({}, self.$router);
                var isInternalV8 = !v8; // 标记是否是内部创建的V8
                
                // 性能优化：只为外部传入的V8设置一次基础属性
                if (!v8) {
                    // 设置共享的V8属性（只设置一次）
                    if (row) {
                        var form = { ...row };
                        sharedV8.Form = self.DeleteFormProperty(form);
                    }
                    sharedV8.FormSet = (fieldName, value) => self.FormSet(fieldName, value, row);
                    sharedV8.OpenForm = (r, type) => self.OpenDetail(r, type, true);
                    sharedV8.OpenFormWF = (r, type, wfParam) => self.OpenDetail(r, type, true, true, wfParam);
                    sharedV8.EventName = "V8BtnLimit";
                    self.SetV8DefaultValue(sharedV8);
                }
                
                // 初始化按钮统计（如果不存在）
                if (!self._btnPerfStats) {
                    self._btnPerfStats = {};
                }
                
                for (let index = 0; index < btns.length; index++) {
                    var btn = btns[index];
                    var isVisible = self.LimitMoreBtn(btn, row, sharedV8);
                    btn.IsVisible = isVisible;
                }
            }
        },
        DeleteFormProperty(form) {
            Reflect.deleteProperty(form, "_RowMoreBtnsOut");
            Reflect.deleteProperty(form, "_RowMoreBtnsIn");
            return form;
        },
        //LimitMoreBtn：执行按钮显示条件V8代码（同步版本）
        LimitMoreBtn(btn, row, v8) {
            var self = this;
            
            // 性能优化：直接使用传入的V8对象
            var V8 = v8;
            V8.Result = null;
            
            var hasV8Code = !self.DiyCommon.IsNull(btn.V8CodeShow);
            var btnStartTime = performance.now();
            
            try {
                if (hasV8Code) {
                    eval("//" + btn.Name + "(按钮显示条件)\n" + btn.V8CodeShow);
                }
            } catch (error) {
                self.DiyCommon.Tips("执行前端V8引擎代码出现错误[" + (btn.Name ? btn.Name : "") + "(显示条件)]：" + error.message, false);
            }
            
            // 性能监控：记录每个按钮的执行时间
            if (hasV8Code) {
                var btnDuration = performance.now() - btnStartTime;
                
                // 初始化统计对象
                if (!self._btnPerfStats) {
                    self._btnPerfStats = {};
                }
                if (!self._btnPerfStats[btn.Name]) {
                    self._btnPerfStats[btn.Name] = {
                        count: 0,
                        totalTime: 0
                    };
                }
                
                // 更新统计数据
                var stats = self._btnPerfStats[btn.Name];
                stats.count++;
                stats.totalTime += btnDuration;
                
                // 如果单次执行时间超过50ms，警告
                if (btnDuration > 50) {
                    console.warn(`【性能警告】按钮[${btn.Name}]执行耗时: ${btnDuration.toFixed(2)}ms (超过50ms阈值)`);
                }
            }
            
            if (V8.Result === false) {
                return false;
            }

            if (self.GetCurrentUser._IsAdmin === true) {
                return true;
            }
            
            // 性能优化：优先使用缓存的权限数据
            var roleLimitModel = V8._cachedRoleLimit;
            if (!roleLimitModel) {
                roleLimitModel = _u.where(self.GetCurrentUser._RoleLimits, {
                    FkId: self.SysMenuId
                });
            }
            
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
        async RunMoreBtn(btn, row, v8) {
            var self = this;
            self.BtnV8Loading = true;
            var V8 = v8 ? v8 : await self.DiyCommon.InitV8Code({}, self.$router);;
            try {
                if (!self.DiyCommon.IsNull(btn.V8Code)) {
                    if (self.SysConfig.EnableUserClickLog) {
                        self.DiyCommon.AddSysLog({
                            Type: `点击V8按钮`,
                            Title: `用户[${self.GetCurrentUser.Name}]点击了[${self.SysMenuModel.Name}]的V8按钮[${btn.Name}]`,
                            Content: ""
                        });
                    }
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
                    V8.EventName = "V8BtnRun";
                    self.SetV8DefaultValue(V8);
                    
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
            } finally {
                // 只在内部创建V8时清理，外部传入的v8由调用方负责清理
                if (!v8) {
                    
                }
            }
        },
        GetFormWF() {
            var self = this;
            return {
                IsWF: self.OpenDiyFormWorkFlow == true,
                WorkType: self.OpenDiyFormWorkFlowType.WorkType,
                FlowDesignId: self.OpenDiyFormWorkFlowType.FlowDesignId
            };
        },
        OpenAnyForm(param) {
            var self = this;
            self.$refs.refDiyTable_DiyFormDialog.Init(param);
        },
        /**
         * 必传：SysMenuId或ModuleEngineKey、SubmitEvent、可选：MultipleSelect、PropsWhere、
         */
        async OpenAnyTable(param) {
            var self = this;
            if (!param.SysMenuId && !param.ModuleEngineKey) {
                self.DiyCommon.Tips("SysMenuId或ModuleEngineKey必传！", false);
                return;
            }

            // 2025-10-29 liucheng 修复：如果OpenAnyTableParam中没有TableId或TableName，则根据SysMenuId获取
            if ((!param.TableId || !param.TableName) && param.SysMenuId) {
                try {
                    var sysMenuResult = await self.DiyCommon.FormEngine.GetFormData({
                        FormEngineKey: "sys_menu",
                        Id: param.SysMenuId
                    });
                    if (sysMenuResult.Code == 1) {
                        if (!param.TableId) {
                            param.TableId = sysMenuResult.Data.DiyTableId;
                        }
                        if (!param.TableName) {
                            param.TableName = sysMenuResult.Data.Name;
                        }
                    }
                } catch (error) {
                    console.warn("获取TableId或TableName失败:", error);
                }
            }

            self.OpenAnyTableParam = param;
            self.ShowAnyTable = true;
        },
        RunOpenAnyTableSubmitEvent() {
            var self = this;
            //传入已选择的数据
            var selectData =
                self.OpenAnyTableParam.ShowLeftSelectionList || false
                    ? self.OpenAnyTableParam.TableIndexDataList
                    : self.$refs["refOpenAnyTable_" + (self.OpenAnyTableParam.SysMenuId || self.OpenAnyTableParam.ModuleEngineKey)].TableMultipleSelection;
            self.OpenAnyTableParam.SubmitEvent(selectData, function () {
                self.ShowAnyTable = false;
            });
        },
        getOpenAnyTableParam(param) {
            var self = this;
            // 获取取消勾选数据
            const unselectedRows = param.OldTableMultipleSelection.filter((prevRow) => !param.TableMultipleSelection.some((currRow) => currRow.Id === prevRow.Id));
            // 3. 构建新的 TableIndexDataList
            let newTableIndexDataList = [];

            // 如果之前已有数据，先展开
            if (self.OpenAnyTableParam.TableIndexDataList && Array.isArray(self.OpenAnyTableParam.TableIndexDataList)) {
                newTableIndexDataList = [...self.OpenAnyTableParam.TableIndexDataList];
            }

            // 4. 【删除操作】移除取消勾选的行（unselectedRows）
            newTableIndexDataList = newTableIndexDataList.filter((existingRow) => !unselectedRows.some((unselected) => unselected.Id === existingRow.Id));

            // 5. 【新增操作】添加当前选中的行（如果还未存在）
            param.TableMultipleSelection.forEach((currRow) => {
                if (!newTableIndexDataList.some((row) => row.Id === currRow.Id)) {
                    newTableIndexDataList.push(currRow);
                }
            });
            if (param.Type === "N") {
                self.$refs["refOpenAnyTable_" + (self.OpenAnyTableParam.SysMenuId || self.OpenAnyTableParam.ModuleEngineKey)].toggleSelection(unselectedRows, "N");
            }
            // console.log('🔴 取消勾选的行:', unselectedRows);
            self.OpenAnyTableParam = {
                ...self.OpenAnyTableParam,
                ShowDiyFieldList: param.ShowDiyFieldList,
                PageIndex: param.PageIndex,
                TableIndexDataList: newTableIndexDataList
            };
        },
        SetV8DefaultValue(V8, field) {
            var self = this;
            V8.Form = self.CurrentSelectedRowModel;
            V8.FormSet = (fieldName, value) => {
                return self.FormSet(fieldName, value, self.CurrentSelectedRowModel);
            };
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
            return V8;
        },
        CallbackFormClose() {
            var self = this;
            if (self.ShowFieldForm == true) {
                self.CloseFieldForm("ShowFieldForm", "Close", self.TableRowId);
            } else if (self.ShowFieldFormDrawer == true) {
                self.CloseFieldForm("ShowFieldFormDrawer", "Close", self.TableRowId);
            }
        },
        /**
         * 必传：ComponentName
         */
        OpenDialog(param) {
            var self = this;
            if (!param.ComponentName) {
                self.DiyCommon.Tips("ComponentName必传！", false);
                return;
            }
            self.DiyCustomDialogConfig = param;
            // self.DiyCustomDialogConfig.Visible = true;
            self.$refs.refDiyCustomDialog.Show();
        },
        ShowTableChildHideField(fieldName, fields) {
            var self = this;
            // if (self.$refs['refTableChild_' + fieldName]) {
            //     self.$refs['refTableChild_' + fieldName][0].ShowHideFields(fields);
            // }
            self.$emit("CallbackShowTableChildHideField", fieldName, fields);
        },
        FormSet(fieldName, value, row) {
            var self = this;
            row[fieldName] = value; // 0
        },
        FieldSet(fieldName, attrName, value) {
            var self = this;
            // 先查找出Field对象
            self.DiyFieldList.forEach((element) => {
                if (element.Name == fieldName) {
                    element[attrName] = value;
                }
            });
        },
        GetImportApi() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig) && !self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig.ImportApi)) {
                return self.DiyCommon.RepalceUrlKey(self.SysMenuModel.DiyConfig.ImportApi);
            }
            return self.DiyCommon.GetApiBase() + "/api/diytable/ImportDiyTableRow";
        },
        GetImportProgressApi() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig) && !self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig.ImportProgressApi)) {
                return self.DiyCommon.RepalceUrlKey(self.SysMenuModel.DiyConfig.ImportProgressApi);
            }
            return self.DiyApi.GetImportDiyTableRowStep;
        },
        OpenPrivatePhone(model) {
            var self = this;
            if (self.DiyCommon.IsNull(model)) {
                //新增
            } else {
                //修改
            }
        },
        TableRowDblClick(row, column, event) {
            var self = this;
            //liucheng2025-4-4 无详情则双击不能都点开详情
            var detail = self.IsPermission("NoDetail");
            if (!detail) {
                return;
            }
            if (!self.SysMenuModel.InTableEdit) {
                self.OpenDetail(row, "View");
            }
        },
        TableRowSelectionChange(val) {
            var self = this;
            var OldTableMultipleSelection = self.TableMultipleSelection.flat();
            self.TableMultipleSelection = val;
            if (self.PropsTableType && self.PropsTableType === "OpenTable") {
                self.$emit("getOpenAnyTableParam", {
                    OldTableMultipleSelection: OldTableMultipleSelection,
                    TableMultipleSelection: self.TableMultipleSelection,
                    ShowDiyFieldList: self.ShowDiyFieldList,
                    PageIndex: self.DiyTableRowPageIndex,
                    Type: "Y"
                });
            }
        },
        CallbackFormValueChange(field, value) {
            var self = this;
            if (self.FormMode !== "View") {
                self.CloseFormNeedConfirm = true;
            }
        },
        async CloseFieldForm(dialogId, actionType, tableRowId) {
            var self = this;
            if (self.FormMode == "View" || self.CloseFormNeedConfirm == false) {
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
            if (self.$refs.fieldForm) {
                await self.$refs.fieldForm.FormOutAction(actionType, "Close", tableRowId, null);
            }

            //清空表单值
            //2022-07-13：如果在关闭表单弹窗时清空表单值，就会触发上面的watch监控，然后又会请求一次getdiytablerow接口,所以要先标记ParentFormLoadFinish=false
            //TODO 实际上clear还要考虑到把子表数据清空，不然会一闪而过上一条数据的子表数据
            if (self.$refs.fieldForm) {
                self.$refs.fieldForm.SetDiyTableRowModelFinish(false);
            }
            self.$nextTick(function () {
                // 先清理表单数据
                if (self.$refs.fieldForm) {
                    self.$refs.fieldForm.Clear();
                }
                // 再关闭弹窗
                if (!self.DiyCommon.IsNull(dialogId)) {
                    self[dialogId] = false;
                }
                // 清理当前行数据引用，帮助垃圾回收
                self.$nextTick(function () {
                    self.CurrentRowModel = {};
                    self.CloseFormNeedConfirm = false;
                });
            });
        },
        GetSearchItemCheckLabel(fieldData, field) {
            var self = this;
            if (typeof fieldData == "string") {
                return fieldData;
            } else if (typeof fieldData == "object") {
                if (!self.DiyCommon.IsNull(field.Config.SelectLabel)) {
                    return fieldData[field.Config.SelectLabel];
                } else {
                }
            }
        },
        GetSearchItemCheckKey(fieldData, field) {
            var self = this;
            if (typeof fieldData == "string") {
                return fieldData;
            } else if (typeof fieldData == "object") {
                if (!self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                    return fieldData[field.Config.SelectSaveField];
                } else if (!self.DiyCommon.IsNull(field.Config.SelectLabel)) {
                    return fieldData[field.Config.SelectLabel];
                }
            }
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
        ParentFormSet(fieldName, value) {
            var self = this;
            self.$emit("ParentFormSet", fieldName, value);
        },
        SetV8SearchModel(val) {
            var self = this;
            self.V8SearchModel = val;
        },
        //值：{FieldName:value}
        //2024-12-14新增可以传入 _Where：[{...}]
        SearchAppendFunc(val) {
            var self = this;
            if (Array.isArray(val)) {
                if (val.length > 0) {
                    val.forEach((item) => {
                        const index = self.Where.findIndex((d) => d.Name == item.Name);
                        if (index === -1) {
                            self.Where.push(item);
                        } else {
                            self.Where[index] = { ...self.Where[index], ...item };
                        }
                    });
                }
            } else {
                for (const key in val) {
                    self.V8SearchModel[key] = val[key];
                }
            }
        },
        //值：{FieldName:value}
        //2024-12-14新增可以传入 _Where：[{...}]
        SearchSetFunc(val) {
            var self = this;
            if (Array.isArray(val)) {
                self.Where = val;
            } else {
                // 2025-12-04 Anderson：转换为_Where格式
                // self.V8SearchModel = val;
                self.Where = [];
                for (const key in val) {
                    var tempWhere = [];
                    tempWhere.push(key);
                    tempWhere.push("Like");
                    tempWhere.push(val[key]);
                    self.Where.push(tempWhere);
                }
            }
        },
        /**
         * 注意传入的tableRowId并不一定是TableRowId，也可能是PrimaryTableFieldName的值
         */
        SetFieldFormDefaultValues(tableRowId) {
            var self = this;
            var tempDefaultValues = {};

            tempDefaultValues[self.TableChildFkFieldName] = tableRowId;

            //判断有没有主表要回写子表列的
            try {
                //2021-12-14注释，通过FatherFormModel处理，不再通过FatherFormModel_Data
                //后来发现还是需要用这种方法
                var fatherFormModel = self.FatherFormModel;
                if (!self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    fatherFormModel = self.FatherFormModel_Data;
                }
                //---end

                //这句一直不需要
                //var fatherFormModel = self.$refs.fieldForm.FormDiyTableModel;
                if (!self.DiyCommon.IsNull(self.TableChildCallbackField) && !self.DiyCommon.IsNull(fatherFormModel)) {
                    // if (!self.DiyCommon.IsNull(self.TableChildCallbackField) && !self.DiyCommon.IsNull(self.FatherFormModel.Id)) {
                    try {
                        var callBackJson = JSON.parse(self.TableChildCallbackField);
                        callBackJson.forEach((callbackField) => {
                            tempDefaultValues[callbackField.Child] = fatherFormModel[callbackField.Father];
                            // tempDefaultValues[callbackField.Child] = self.FatherFormModel[callbackField.Father];
                        });
                    } catch (error) {
                        self.DiyCommon.Tips("子表回写列配置错误，请检查：" + self.TableChildCallbackField, false);
                        console.log(error);
                    }
                }
            } catch (error) {
                console.log("判断有没有主表要回写子表列的 error：");
                console.log(error);
            }
            //2022-02-17 有可能二次开发传过来的 FormDefaultValues
            for (let key in self.FormDefaultValues) {
                tempDefaultValues[key] = self.FormDefaultValues[key];
            }
            self.FieldFormDefaultValues = tempDefaultValues;
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
        // RunFieldTemplateEnginePromise(V8, code){
        //     var self = this;
        //     return new Promise(resolve => {
        //         eval("(async () => {" + code + " \n})()")
        //         if (self.DiyCommon.IsNull(V8.Result)) {
        //             // return self.GetColValue({row : V8.Row}, V8.Field);
        //             resolve(self.GetColValue({row : V8.Row}, V8.Field));
        //         }
        //         // return V8.Result;
        //         resolve(V8.Result);
        //     });
        // },
        IsTableChild() {
            var self = this;
            if (!self.DiyCommon.IsNull(self.TableChildTableId)) {
                return true;
            }
            return false;
        },
        // OpenFormIsModal(){
        //     var self = this;
        //     if (self.DiyCommon.IsNull(self.TableChildTableId)) {
        //         return true;
        //     }
        //     return false;
        // },
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
                var fieldModel = self.ShowDiyFieldList[0];
                var firstValue = "";
                // if (fieldModel && !self.DiyCommon.IsNull(fieldModel.Config) && !self.DiyCommon.IsNull(fieldModel.Config.SelectLabel)) {
                //     try {
                //         firstValue = JSON.parse(self.CurrentRowModel[fieldModel.Name])[fieldModel.Config.SelectLabel];
                //     } catch (error) {
                //         firstValue = self.CurrentRowModel[fieldModel.Name];
                //     }
                // }else{
                //     if (fieldModel) {
                //         firstValue = self.CurrentRowModel[fieldModel.Name];
                //     }
                // }
                if (fieldModel && (fieldModel.Component == "Text" || fieldModel.Component == "NumberText" || fieldModel.Component == "Textarea" || fieldModel.Component == "AutoNumber")) {
                    firstValue = self.CurrentRowModel[fieldModel.Name];
                }
                title1 = self.$t("Msg." + self.FormMode) + (firstValue ? " [" + firstValue.toString().substring(0, 30) + "]" : "");
            }
            // var title2 = (self.DiyCommon.IsNull(self.CurrentDiyTableModel) || self.DiyCommon.IsNull(self.CurrentDiyTableModel.Name))
            //             ? '' : self.CurrentDiyTableModel.Name.replace('Diy_', '');
            var title2 = "";
            var title3 = self.DiyCommon.IsNull(self.CurrentDiyTableModel) || self.DiyCommon.IsNull(self.CurrentDiyTableModel.Description) ? "" : self.CurrentDiyTableModel.Description;

            //  + ' - ' + title2
            return title1 + (!self.DiyCommon.IsNull(title3) && title3 != title2 ? " - " + title3 : "");
        },
        StatisticsFieldsMethod(param) {
            var self = this;
            const { columns, data } = param;
            const sums = [];
            if (self.StatisticsFields != null) {
                columns.forEach((column, index) => {
                    if (!self.DiyCommon.IsNull(self.StatisticsFields[column.property])) {
                        sums[index] = self.StatisticsFields[column.property];
                    }
                });
            }

            return sums;
        },
        GetDiyField() {
            var self = this;
            var tableIds = [self.TableId];
            if (!self.DiyCommon.IsNull(self.SysMenuModel.JoinTables)) {
                self.SysMenuModel.JoinTables.forEach((element) => {
                    tableIds.push(element.Id);
                });
            }
            self.DiyCommon.Post(
                self.DiyApi.GetDiyFieldByDiyTables,
                {
                    TableIds: tableIds
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.GetDiyFieldAfter(result);
                    }
                }
            );
        },
        GetDiyFieldAfter(result) {
            var self = this;
            //这里需要DiyFieldStrToJson转换，否则取不到配置数据

            result.Data.forEach((field) => {
                self.DiyCommon.DiyFieldConfigStrToJson(field);
                self.DiyCommon.Base64DecodeDiyField(field);
                // 使用公共方法初始化字段属性
                self.DiyCommon.EnsureFieldProperties(field);
            });
            self.DiyCommon.SetFieldsData(result.Data);

            result.Data.forEach((field) => {
                // self.DiyFieldStrToJson(field, formData, isPostSql);

                //放到外面执行了
                // self.DiyCommon.DiyFieldConfigStrToJson(field);
                //放到外面执行了
                // self.DiyCommon.Base64DecodeDiyField(field);

                //处理别名
                if (self.SysMenuModel.SelectFields && Array.isArray(self.SysMenuModel.SelectFields)) {
                    var search2 = _u.where(self.SysMenuModel.SelectFields, {
                        Id: field.Id
                    });
                    if (search2.length > 0 && !self.DiyCommon.IsNull(search2[0].AsName)) {
                        field["AsName"] = search2[0].AsName;
                    }
                }
                // 注意：这里面是有异步赋值的
                // 放到外面执行了
                // self.DiyCommon.SetFieldData(field);

                // if (Array.isArray(field.Data)) {
                //     field.Data.forEach(fieldData => {
                //         if (typeof(fieldData) == 'object') {
                //             fieldData._Checked = false;
                //         }
                //     });
                // }
                // field._SearchChecked = [];
                if (!self.DiyCommon.IsNull(field.Config.DevComponentName) && !self.DiyCommon.IsNull(field.Config.DevComponentPath)) {
                    //渲染定制组件
                    try {
                        //2022-06-22新增
                        field.Config.DevComponentPath = field.Config.DevComponentPath.replace("/views", "");

                        // 使用组件缓存池，避免重复创建导致内存泄漏
                        var componentName = field.Config.DevComponentName;
                        var componentPath = field.Config.DevComponentPath;
                        var component = DynamicComponentCache.getOrCreate(componentName, componentPath);
                        
                        // Vue 3: 使用全局 app 实例注册组件
                        const app = window.__VUE_APP__;
                        if (app && !app._context.components[componentName]) {
                            app.component(componentName, component);
                        }
                        if (self.DiyCommon.IsNull(self.DevComponents[componentName])) {
                            self.DevComponents[componentName] = {
                                Name: "",
                                Path: ""
                            };
                        }
                        self.DevComponents[componentName].Name = componentName;
                        self.DevComponents[componentName].Path = componentPath;
                        // console.log('渲染定制组件成功');
                    } catch (error) {
                        console.log("渲染定制组件出现错误：" + error.message);
                    }
                }
            });

            self.DiyFieldList = result.Data;
            // self.$emit("CallbackGetDiyField", self.DiyFieldList)
        },
        GetDiyTableModel() {
            var self = this;
            var param = {
                Id: self.TableId
            };
            self.DiyCommon.Post(self.DiyApi.GetDiyTableModel, param, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.GetDiyTableModelAfter(result);

                    // self.$nextTick(function () {
                    //     if (self.DiyTableModel.Tabs.length > 0 &&
                    //         (self.DiyCommon.IsNull(self.FieldActiveTab) || self.FieldActiveTab == '0' || self.FieldActiveTab == 'none' || self.FieldActiveTab == 'info')) {
                    //         self.FieldActiveTab = self.DiyTableModel.Tabs[0].Name;
                    //     }
                    // });

                    // self.$emit("CallbackSetDiyTableModel", self.DiyTableModel)
                }
            });
        },
        GetDiyTableModelAfter(result) {
            var self = this;
            self.DiyCommon.DiyTableStrToJson(result.Data);
            self.DiyCommon.Base64DecodeDiyTable(result.Data);
            self.CurrentDiyTableModel = result.Data;
        },
        GetColClassName(field) {
            var self = this;
            if (self._OrderBy == field.Name) {
                return "column-" + field.Name + " " + (self._OrderByType.toLocaleLowerCase() == "asc" ? "ascending" : "descending");
            }
            return "column-" + field.Name;
        },
        DiyTableRowSortChange(sortParam) {
            var self = this;
            if (self.DiyCommon.IsNull(sortParam.order)) {
                self._OrderByType = "";
                self._OrderBy = "";
                self.LastOrderBy = "";
            } else {
                var orderByType = sortParam.order == "ascending" ? "asc" : "desc";
                //-----修复Table组件排序不轮询的bug，永远返回的都是asc
                if (self.LastOrderBy == orderByType + "|" + sortParam.prop) {
                    var forType = ["asc", "desc", ""];
                    var currentType = self.LastOrderBy.split("|")[0];
                    var currentIndex = forType.indexOf(currentType);
                    if (currentIndex + 1 > 2) {
                        currentIndex = 0;
                    } else {
                        currentIndex++;
                    }
                    orderByType = forType[currentIndex];
                }
                //-----end
                self._OrderByType = orderByType;
                self._OrderBy = sortParam.prop;
                self.LastOrderBy = orderByType + "|" + sortParam.prop;
            }
            self.GetDiyTableRow();
        },
        GetColValue(scope, field) {
            var self = this;
            var fuheWZ = "";
            var result = "";
            var displayValue = self.DiyCommon.IsNull(scope.row[self.DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName])
                ? ""
                : scope.row[self.DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName];
            //如果是地址控件
            if (field.Component == "Address" && displayValue) {
                try {
                    var addressValue = [];
                    if (typeof displayValue == "string") {
                        addressValue = JSON.parse(displayValue);
                    }
                    if (addressValue.length > 0) {
                        return addressValue.join("/");
                        // if(self.CodeToText){
                        //     return self.CodeToText[addressValue[0]] + '/'
                        //             + self.CodeToText[addressValue[1]] + '/'
                        //             + self.CodeToText[addressValue[2]];
                        // }else{
                        //     return displayValue;
                        // }
                    }
                    return "";
                } catch (error) {}
            }

            if (!self.DiyCommon.IsNull(field.Config)) {
                if (typeof field.Config === "string") {
                    field.Config = JSON.parse(field.Config);
                }
                if (!self.DiyCommon.IsNull(field.Config.TextApend)) {
                    fuheWZ = " " + field.Config.TextApend;
                }

                if (!self.DiyCommon.IsNull(field.Config.SelectLabel)) {
                    try {
                        //2021-01-02发现问题，这里如果存的是一串数字 ，JSON.parse()不会报错
                        var tObj = JSON.parse(scope.row[self.DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]);
                        if (Array.isArray(tObj)) {
                            //if (field.Component == 'MultipleSelect')
                            tObj.forEach((element, index) => {
                                result += self.DiyCommon.IsNull(element[field.Config.SelectLabel]) ? "" : element[field.Config.SelectLabel];
                                if (index !== tObj.length - 1) {
                                    result += ",";
                                }
                            });
                            return result + fuheWZ;
                        }
                        //2021-01-02发现问题，这里如果存的是一串数字 ，JSON.parse()不会报错
                        else if (typeof tObj == "number") {
                            result = self.DiyCommon.IsNull(scope.row[self.DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName])
                                ? ""
                                : scope.row[self.DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName];
                            return result + fuheWZ;
                        } else {
                            result = self.DiyCommon.IsNull(tObj[field.Config.SelectLabel]) ? "" : tObj[field.Config.SelectLabel];
                            return result + fuheWZ;
                        }
                    } catch (error) {
                        // console.log('Error：GetColValue(scope, field)')
                        // console.log(error)
                    }
                }
            }

            //如果是富文本，需要去掉html标签
            if (field.Component == "RichText") {
                displayValue = self.DiyCommon.RemoveHtml(displayValue);
            }
            result = displayValue; //self.DiyCommon.IsNull(scope.row[field.Name]) ? '' : scope.row[field.Name];
            // return result + fuheWZ;
            result = result + fuheWZ;
            if (result == "[]") {
                return "";
            }
            return result;
        },
        GetImportDiyTableRowStep() {
            var self = this;
            self.DiyCommon.Post(
                self.GetImportProgressApi(),
                {
                    // OsClient: self.OsClient,
                    // UserId : self.GetCurrentUser.Id
                    TableId: self.TableId
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        if (!self.DiyCommon.IsNull(result.Data) && Array.isArray(result.Data)) {
                            self.ImportStepList = result.Data;
                        }
                    }
                }
            );
        },
        DelImportDiyTableRowStep() {
            var self = this;
            self.DiyCommon.Post(
                "/api/diytable/delImportDiyTableRowStep",
                {
                    TableId: self.TableId
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.DiyCommon.Tips("操作成功！");
                        self.GetImportDiyTableRowStep();
                    }
                }
            );
        },
        ImportUploadSuccess(result, file, fileList, colName) {
            var self = this;
            if (self.DiyCommon.Result(result)) {
                // self.DiyCommon.Tips('导入成功！')
                self.GetImportDiyTableRowStep();
                // self.ShowImport = false;
                self.GetDiyTableRow({ _PageIndex: 1 });
            }
        },
        toggleSelection(rows, type) {
            var self = this;
            this.$nextTick(() => {
                if (!self.$refs["diy-table-" + self.TableId] || !self.$refs["diy-table-" + self.TableId].toggleRowSelection) {
                    // console.warn("表格 ref 未找到或 toggleRowSelection 方法不存在");
                } else {
                    // rows.forEach(row => {
                    //   self.$refs['diy-table-' + self.TableId].toggleRowSelection(self.tableData,true);
                    // });
                    // 选中行

                    // 遍历当前表格中显示的每一行数据
                    self.DiyTableRowList.forEach((tableRow) => {
                        // 判断：当前行的 id 是否在历史记录 selectedRows 的 id 中
                        const isSelectedInHistory = rows.some((historyRow) => {
                            // 假定用 id 字段来比对是否是同一条数据
                            return historyRow.Id === tableRow.Id;
                        });
                        if (isSelectedInHistory) {
                            // 如果历史记录中存在，则默认勾选这一行
                            if (type == "Y") {
                                self.$refs["diy-table-" + self.TableId].toggleRowSelection(tableRow, true); // ✅ 传入当前行的对象引用
                                self.TableMultipleSelection.push(tableRow);
                            } else {
                                self.$refs["diy-table-" + self.TableId].toggleRowSelection(tableRow, false);
                                self.TableMultipleSelection = self.TableMultipleSelection.filter((uns) => uns.Id !== tableRow.Id);
                            }
                        }
                    });
                }
            });
        },
        ImportDiyTableRowBefore(file) {
            var self = this;
            self.DiyCommon.Tips("正在导入！请点击查看进度按钮！");
            // 清除之前的定时器，防止内存泄漏
            if (self._importStepTimer) {
                clearTimeout(self._importStepTimer);
            }
            self._importStepTimer = setTimeout(function () {
                if (self && self.GetImportDiyTableRowStep) {
                    self.GetImportDiyTableRowStep();
                }
            }, 1000);
        },
        DiyTableRowCurrentChange(val) {
            var self = this;
            self.DiyTableRowPageIndex = val;
            self.GetDiyTableRow();
            self.$nextTick(function () {
                $(`#diy-table-${self.TableId} .el-table__body-wrapper`).scrollTop(0);
            });
        },
        DiyTableRowSizeChange(val) {
            var self = this;
            self.DiyTableRowPageSize = val;
            // 使用 LocalStorage 管理器，带自动清理
            if (self.$localStorageManager) {
                self.$localStorageManager.setTableConfig(self.TableId, val);
            } else {
                localStorage.setItem("Microi.DiyTableRowPageSize_" + self.TableId, val);
            }
            self.DiyTableRowPageIndex = 1;
            self.GetDiyTableRow({ _PageIndex: 1 });
            self.$nextTick(function () {
                $(`#diy-table-${self.TableId} .el-table__body-wrapper`).scrollTop(0);
            });
        },
        // 导入数据
        ImportDiyTableRow() {
            var self = this;
            self.ShowImport = true;
        },
        // 导出数据
        ExportDiyTableRow(btn) {
            var self = this;
            self.BtnExportLoading = true;
            var url = self.DiyCommon.GetApiBase() + "/api/diytable/ExportDiyTableRowFromBody";
            var paramType = "json";
            if (!self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig.ExportApi)) {
                url = self.DiyCommon.RepalceUrlKey(self.SysMenuModel.DiyConfig.ExportApi);
                paramType = "json";
            }

            if (!self.DiyCommon.IsNull(btn) && !self.DiyCommon.IsNull(btn.Url)) {
                url = btn.Url;
            }
            var param = {
                TableId: self.TableId,
                //2020-12-07-注意：目前只有导出接口不支持token验证，所以导出接口需要加入[AllowAnonymous]特性，并且手动指定OsClient或_CurrentSysUser
                OsClient: self.diyStore.OsClient, //self.OsClient,
                _Keyword: self.Keyword,
                //要导出所有数据，所以不分页
                // _PageIndex: self.DiyTableRowPageIndex,
                // _PageSize: self.DiyTableRowPageSize,
                // _SysMenuId: self.SysMenuId,
                ModuleEngineKey: self.SysMenuModel.ModuleEngineKey,
                _OrderBy: self._OrderBy,
                _OrderByType: self._OrderByType
            };
            if (!param.ModuleEngineKey) {
                param.ModuleEngineKey = self.SysMenuId;
            }
            if (!param.ModuleEngineKey) {
                param.FormEngineKey = self.CurrentDiyTableModel.Name;
            }
            if (!param.ModuleEngineKey && !param.FormEngineKey) {
                param.FormEngineKey = self.TableId;
            }
            //注意：这个是由主表传过来的主表行Id，需要在这里子表加入条件：where 外键Id=TableChildFkFieldName
            if (!self.DiyCommon.IsNull(self.TableChildFkFieldName)) {
                // param[self.TableChildFkFieldName] = self.TableChildFkValue;
                if (!self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    // if (!self.DiyCommon.IsNull(self.FatherFormModel.Id)) {
                    // self.SearchModel[self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
                    // // self.SearchModel[self.TableChildFkFieldName] = self.FatherFormModel.Id;
                    //2022-02-14 关联表修改为等值条件
                    //2022-07-23新增也可能不跟主表的Id进行关联
                    if (self.PrimaryTableFieldName) {
                        self.SearchEqual[self.TableChildFkFieldName] = self.FatherFormModel_Data[self.PrimaryTableFieldName];
                    } else {
                        self.SearchEqual[self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
                    }
                } else {
                    // self.SearchModel[self.TableChildFkFieldName] = self.TableChildTableRowId;
                    //2022-02-14 关联表修改为等值条件
                    self.SearchEqual[self.TableChildFkFieldName] = self.TableChildTableRowId;
                }
            }
            param._Search = self.SearchModel;
            param._SearchEqual = self.SearchEqual;
            param._SearchCheckbox = self.SearchCheckbox;
            param._SearchDateTime = self.SearchDateTime;
            if (self.SearchNumber) {
                for (let key in self.SearchNumber) {
                    if (self.SearchNumber[key].Min || self.SearchNumber[key].Max) {
                        param._SearchNumber = self.SearchNumber;
                        break;
                    }
                }
            }
            // param._TableRowSelected = self.TableRowSelected;

            //临时给刘姣姣用的
            param.UserId = self.GetCurrentUser.Id;

            if (self.SearchWhere.length > 0) {
                param._Where = self.SearchWhere;
            }

            self.DiyCommon.FormExportFileV2(
                url,
                param,
                function () {
                    self.BtnExportLoading = false;
                },
                self.SysMenuModel.Name,
                paramType
            );
        },
        //tableRowModel:行数据/表单数据
        //isDefaultOpen：是否默认打开，默认打开不会跳走到定制界面
        //formMode:表单打开方式 Add/View/Edit
        //isOpenWorkFlowForm
        //wfParam：{WorkType:'StartWork(发起流程)/ViewWork(查看流程)',FlowDesignId:''}
        async OpenDetail(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam) {
            var self = this;
            // self.OpenDiyFormWorkFlow = isOpenWorkFlowForm;
            self.OpenDiyFormWorkFlow = false;
            self.OpenDiyFormWorkFlowType = {};
            self.FormWF = self.GetFormWF();
            if (self.OpenDiyFormWorkFlow || self.CurrentDiyTableModel.EnableDataLog) {
                if (self.CurrentDiyTableModel.EnableDataLog) {
                    self.FormRightType = "DataLog";
                }
            }
            //2020-10-23从数据库重新获取，以防止被修改过页面缓存数据
            // self.DiyCommon.GetDiyTableRowModel();

            self.BtnLoading = true;

            self.FormMode = formMode;
            self.OpenDiyFormWorkFlowType.FormMode = formMode;
            self.StartWorkSubmited = false;

            self.ShowUpdateBtn = true;
            self.ShowDeleteBtn = true;
            self.ShowSaveBtn = true;
            //根据代码判断详情页编辑按钮是否显示2025-5-1刘诚
            if (self.SysMenuModel && self.SysMenuModel.EditCodeShowV8) {
                self.ShowUpdateBtn = await self.LimitMoreBtn1(self.SysMenuModel.EditCodeShowV8, tableRowModel, "EditCodeSowV8");
            }

            self.TableRowId = self.DiyCommon.IsNull(tableRowModel) ? "" : tableRowModel.Id;
            if (self.FormMode == "Add" || self.FormMode == "Insert") {
                //liucheng升级左右导航结构页面判断2025-7-15
                // 检查是否在左右导航结构页面，且未选中分类
                // 注意：在 LeftTreeJoinRightForm.vue 中，选中分类时会更新 clickData 包含 Id
                // if (self.ParentV8 && self.ParentV8.Origin == "BomProject" && self.DiyCommon.IsNull(self.ParentV8.Id)) {
                //   self.DiyCommon.Tips("请先选择分类后在点击新增按钮!", false);
                //   self.BtnLoading = false;
                //   return;
                // }
                self.DiyCommon.Post("/api/diytable/NewGuid", {}, function (result) {
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

                //2023-10-18获取数据日志,角色才可以访问
                if (self.CurrentDiyTableModel && self.CurrentDiyTableModel.DataLogRole && self.CurrentDiyTableModel.DataLogRole.length > 0) {
                    var DataLogRole = self.CurrentDiyTableModel.DataLogRole;
                    DataLogRole.forEach((item) => {
                        if (self.GetCurrentUser.RoleIds.indexOf(item) != -1) {
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

                if (self.CurrentDiyTableModel.EnableDataComment) {
                    self.GetCommentList();
                }
            }
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
                            // if (item.Content) {
                            //   item.Content = JSON.parse(item.Content);
                            // } else {
                            //   item.Content = [];
                            // }
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

            // 移动端模式下，使用路由跳转而非抽屉/弹窗打开表单
            // 因为用户在移动端会使用手机的后退功能返回上一页
            if (self.diyStore.IsPhoneView) {
                var url = `/diy/form-page/${self.TableId}`;
                if (!self.DiyCommon.IsNull(tableRowModel)) {
                    url += `/${tableRowModel.Id}`;
                }
                url += `?FormMode=${self.FormMode}&SysMenuId=${self.SysMenuId}`;
                self.$router.push(url);
                self.BtnLoading = false;
                return;
            }

            if (self.CurrentDiyTableModel.FormOpenType == "Dialog" || self.CurrentDiyTableModel.FormOpenType == "Drawer" || self.DiyCommon.IsNull(self.CurrentDiyTableModel.FormOpenType)) {
                //2022-11-08表单更多按钮默认不显示
                if (self.SysMenuModel.FormBtns && Array.isArray(self.SysMenuModel.FormBtns)) {
                    self.SysMenuModel.FormBtns.forEach((btn) => {
                        btn.IsVisible = false;
                    });
                }

                if (self.DiyCommon.IsNull(tableRowModel)) {
                    self.CurrentRowModel = {};
                }
                // self.CurrentRowModel = self.DiyCommon.IsNull(tableRowModel) ? {} : tableRowModel;
                self.ShowFieldFormHide = false;
                //2021-10-29新增，如果是行内新增
                if (self.SysMenuModel.DiyConfig && self.SysMenuModel.DiyConfig.AddBtnType == "InTable" && formMode == "Add") {
                    //2022-02-13 提前将Id赋值好，以便删除
                    var newIdResult = await self.DiyCommon.PostAsync("/api/diytable/NewGuid", {});
                    //加入回写默认值  2021-12-06
                    var defaultModel = { ...self.FieldFormDefaultValues };
                    defaultModel.Id = newIdResult.Data;
                    defaultModel._IsInTableAdd = true;
                    defaultModel._RowMoreBtnsOut = [];
                    defaultModel._RowMoreBtnsIn = [];
                    self.DiyTableRowList.push(defaultModel);
                    self.BtnLoading = false;
                } else if (self.CurrentDiyTableModel.FormOpenType == "Dialog") {
                    self.ShowFieldForm = true;
                    if (window.history && window.history.pushState) {
                        //TODO：监听浏览器前进后退事件。 后期实现
                        // $(window).on('popstate', function () {
                        //     //do something...
                        // });
                    }
                    // Bug3修复：使用双层$nextTick确保Dialog和ref完全创建
                    self.$nextTick(function () {
                        self.$nextTick(function () {
                            self.CloseFormNeedConfirm = false;
                            if (self.$refs.fieldForm) {
                                self.$refs.fieldForm.Init(true, async function (callbackValue) {
                                    if (callbackValue && callbackValue.CurrentRowModel) {
                                        self.CurrentRowModel = callbackValue.CurrentRowModel;
                                        var V8 = callbackValue.V8;
                                        self.HandlerBtns(self.SysMenuModel.FormBtns, self.CurrentRowModel, V8);
                                    }
                                    self.BtnLoading = false;
                                });
                            } else {
                                self.BtnLoading = false;
                                console.error('[DiyTableRowlist] Dialog fieldForm ref 不存在');
                            }
                            if (isOpenWorkFlowForm == true) {
                                if (self.DiyCommon.IsNull(wfParam)) {
                                    wfParam = { WorkType: "ViewWork" };
                                }
                                wfParam.FormMode = formMode;
                                self.InitWorkFlow(wfParam);
                            }
                        });
                    });
                } else {
                    // 保存打开表单时的上下文参数，在 @opened 事件中使用
                    self._pendingDrawerContext = {
                        isOpenWorkFlowForm: isOpenWorkFlowForm,
                        wfParam: wfParam,
                        formMode: formMode
                    };
                    
                    self.ShowFieldFormDrawer = true;
                    // Bug3修复：使用 @opened 事件确保抽屉完全打开后再初始化
                    // 初始化逻辑移到 onDrawerOpened 方法中
                }
            } else {
                var url = `/diy/form-page/${self.TableId}`;
                if (!self.DiyCommon.IsNull(tableRowModel)) {
                    url += `/${tableRowModel.Id}`;
                }
                url += `?FormMode=${self.FormMode}&SysMenuId=${self.SysMenuId}`;
                self.$router.push(url);
            }
        },
        //wfParam：{WorkType:'StartWork(发起流程)/ViewWork(查看流程)',FlowDesignId:'', FormMode:''}
        InitWorkFlow(wfParam) {
            var self = this;
            self.OpenDiyFormWorkFlowType = wfParam;
            self.FormWF = self.GetFormWF();
            if (wfParam.WorkType == "ViewWork") {
                //获取此数据对应的最后一个流程
                if (self.FormMode != "Add" && self.FormMode != "Insert" && !self.DiyCommon.IsNull(self.TableRowId)) {
                    self.DiyCommon.GetDiyTableRowModel(
                        {
                            // TableName: 'WF_Work',//WF_Flow
                            FormEngineKey: "WF_Work", //WF_Flow
                            _SearchEqual: {
                                TableRowId: self.TableRowId
                            }
                        },
                        function (result) {
                            if (result.Code == 1 && !self.DiyCommon.IsNull(result.Data)) {
                                self.OpenDiyFormWorkFlow = true;
                                self.FormRightType = "WorkFlow";
                                self.FormWF = self.GetFormWF();
                                self.$nextTick(function () {
                                    self.$refs.refWFHistory.Init({
                                        CurrentFlowId: result.Data.FlowId, //result.Data.Id
                                        CurrentFlowDesignId: result.Data.FlowDesignId,
                                        CurrentNodeId: result.Data.NodeId
                                    });
                                });
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
                self.$nextTick(function () {
                    //需要传入：CurrentFlowDesign、CurrentTableId、OpenFormMode
                    var param = {
                        // CurrentFlowDesign:{},
                        CurrentFlowDesignId: wfParam.FlowDesignId,
                        OpenFormMode: wfParam.FormMode,
                        CurrentTableId: self.TableId
                    };
                    self.$refs.refWfWorkHandler_2.InitStartWork(param, function (callbackObj) {
                        // self.CurrentTableRowId = callbackObj.CurrentTableRowId;
                        // self.CurrentShowFields = callbackObj.CurrentShowFields;
                        // self.CurrentReadonlyFields = callbackObj.CurrentReadonlyFields;
                        // self.$refs.diyFormWfWork.Init();
                    });
                });
            }
        },
        GetNeedSaveRowList() {
            var self = this;
            var result = [];
            self.DiyTableRowList.forEach((element) => {
                if (element._IsInTableAdd == true) {
                    result.push(element);
                }
            });
            return result;
        },
        ClearNeedSaveRowList() {
            var self = this;
            var result = [];
            self.DiyTableRowList.forEach((element) => {
                if (element._IsInTableAdd == true) {
                    element._IsInTableAdd = false;
                }
            });
            return result;
        },
        GetSysMenuModel() {
            var self = this;
            self.DiyCommon.Post(
                self.DiyApi.GetSysMenuModel,
                {
                    Id: self.SysMenuId
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.GetSysMenuModelAfter(result);
                    }
                }
            );
        },
        async GetSysMenuModelAfter(result) {
            var self = this;
            self.DiyCommon.ForConvertSysMenu(result.Data);
            //2021-09-02 提前渲染 页面更多按钮(PageBtns)、页面多Tab（PageTabs）、批量选择更多按钮BatchSelectMoreBtns、更多导出按钮(ExportMoreBtns)
            self.HandlerBtns(result.Data.PageBtns);
            //注意：表单按钮，一定要先打开表单后再进行判断IsVisible
            // self.HandlerBtns(result.Data.FormBtns);
            result.Data.PageTabs = result.Data.PageTabs.sort((a, b) => a.Sort - b.Sort);
            self.HandlerBtns(result.Data.PageTabs);
            self.HandlerBtns(result.Data.BatchSelectMoreBtns);
            if (result.Data.BatchSelectMoreBtns.length > 0) {
                self.TableEnableBatch = true;
            }
            self.HandlerBtns(result.Data.ExportMoreBtns);
            // result.Data.PageBtns.forEach(element => {
            // });

            //-------GetPageTabs()提前预生成
            if (!self.DiyCommon.IsNull(result.Data.DiyConfig) && !self.DiyCommon.IsNull(result.Data.PageTabs) && result.Data.PageTabs.length > 0) {
                //url带上tab参数，  2022-06-01
                var queryTab = self.$route.query.Tab;
                if (self.IsTableChild()) {
                    queryTab = "";
                }
                if (!self.DiyCommon.IsNull(queryTab)) {
                    await result.Data.PageTabs.forEach(async (element) => {
                        if (element.Name == queryTab) {
                            self.TableRowListActiveTab = element.Id;
                            self.CurrentTableRowListActiveTab = element;
                            //执行V8
                            //注意：这里要设置搜索条件.V8.SetV8SearchModel([{FieldName : value}, {FieldName2 : value}]);
                            if (!self.DiyCommon.IsNull(element.V8Code)) {
                                await self.RunPageTabV8Code(element.V8Code);
                            }
                        }
                    });
                }

                //TableRowListActiveTab 虽然给的默认是空'',但实际上是'0'，为啥 ？
                if (self.DiyCommon.IsNull(self.TableRowListActiveTab) || self.TableRowListActiveTab == "none" || self.TableRowListActiveTab == "0") {
                    self.TableRowListActiveTab = result.Data.PageTabs[0].Id;
                    var tabModel = result.Data.PageTabs[0];
                    self.CurrentTableRowListActiveTab = tabModel;
                    //执行V8
                    //注意：这里要设置搜索条件.V8.SetV8SearchModel([{FieldName : value}, {FieldName2 : value}]);
                    if (!self.DiyCommon.IsNull(tabModel.V8Code)) {
                        await self.RunPageTabV8Code(tabModel.V8Code);
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
            if(self.diyStore.IsPhoneView || self.SysMenuModel.ComponentName == '搜索+卡片'){
                self.TableDisplayMode = 'Card'
            }else{
                self.TableDisplayMode = 'Table'
            }
            //--------处理模块配置
            // Bug优化：直接使用 SysMenuModel 的属性，避免不必要的数据复制和内存占用
            // 注意：保留这些赋值是为了向后兼容，但建议后续直接使用 self.SysMenuModel.xxx
            self.TableDiyFieldIds = self.SysMenuModel.TableDiyFieldIds || [];
            self.SearchFieldIds = self.SysMenuModel.SearchFieldIds || [];
            self.SortFieldIds = self.SysMenuModel.SortFieldIds || [];
            self.NotShowFields = self.SysMenuModel.NotShowFields || [];
            self.MoileListFields = self.SysMenuModel.MoileListFields || [];
            self.FixedFields = self.SysMenuModel.FixedFields || [];
            //------------------------

            //2022-05-14 这里不再查询数据，全部After处理好了再查询数据
            if (self.DiyCommon.IsNull(self.SysMenuModel.PageTabs) || self.SysMenuModel.PageTabs.length == 0) {
                // self.GetDiyTableRow({_PageIndex : 1});
            }
        },
        CallbackGetDiyField(diyFieldList) {
            var self = this;
            // self.DiyFieldList = diyFieldList
        },
        CallbackFormSubmit(param) {
            var self = this;
            var savedType;
            if (param && typeof param == "object") {
                savedType = param.SavedType;
            }
            self.SaveDiyTableCommon(param, savedType);
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
                SaveLoading: self.BtnLoading,
                Callback: param.Callback
            };
            //必传：FormMode、TableRowId、SavedType、SaveLoading
            self.$refs.fieldForm.FormSubmit(formParam, async function (isSccuess, formData, outFormV8Result) {
                if (isSccuess === true) {
                    //注意：这里一定要回写一下，因为FormSubmit内部无法引用更新这些值
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
                        self.ShowYanZhen = false;
                    } else {
                        //刷新子表
                        self.$refs.fieldForm.RefreshAllChildTable();
                    }
                    //刷新列表
                    self.GetDiyTableRow();

                    self.$nextTick(function () {
                        if (formParam.Callback) {
                            formParam.Callback();
                        }
                    });
                } else {
                    // self.BtnLoading = formParam.SaveLoading;
                    self.BtnLoading = false;
                }
            });
        },
        CallbackSetDiyTableModel(model) {
            var self = this;
            self.CurrentDiyTableModel = model;
        },
        CallbackRefreshTable(param) {
            var self = this;
            self.GetDiyTableRow(param);
        },
        // 其实这里应该改成Axios去同时请求多个接口，然后再渲染，这样性能更高！
        GetShowDiyFieldList: function () {
            var self = this;
            // TableDiyFieldIds 是指模块引擎的查询列
            if (self.TableDiyFieldIds != null) {
                if (self.TableDiyFieldIds.length > 0 && self.DiyFieldList.length > 0) {
                    var tempArr = [];
                    var index = 0;
                    self.TableDiyFieldIds.forEach((element) => {
                        //这里的element就是FieldId
                        // var search1 = _u.where(self.DiyFieldList, {
                        //   Id: element
                        // });
                        var search1 = self.DiyFieldList.find((item) => item.Id === element); // || item.Name === element
                        if (!search1) {
                            search1 = self.DiyCommon.SysDefaultField.find((item) => item.Id === element);
                        }

                        //注意：!(self.FixedNotShowField.indexOf(element.Component) > -1)  这条判断没用，因为element就是Id，取不到element.Component
                        //2021-10-26 新增排序 ShowHideFieldsList
                        if (
                            search1 &&
                            !(self.FixedNotShowField.indexOf(element.Component) > -1) &&
                            (!(self.NotShowFields.indexOf(element) > -1 || self.NotShowFields.indexOf(element.Name) > -1 || self.NotShowFields.indexOf(element.Id) > -1) ||
                                self.ShowHideFieldsList.indexOf(search1.Name) > -1) &&
                            !self.DiyCommon.IsNull(search1.Id)
                        ) {
                            search1["AsName"] = "";
                            //这里要根据 SelectFields 赋值别名
                            if (self.SysMenuModel.SelectFields && Array.isArray(self.SysMenuModel.SelectFields)) {
                                var search2 = _u.where(self.SysMenuModel.SelectFields, {
                                    Id: element
                                });
                                if (search2.length > 0 && !self.DiyCommon.IsNull(search2[0].AsName)) {
                                    search1["AsName"] = search2[0].AsName;
                                }
                            }
                            //------end
                            tempArr.push(search1);
                            index++;
                        }
                    });
                    // tempArr.push(_u.where(self.DiyFieldList, {Name : 'CreateTime'})[0]);
                    //调整ShowHideFieldsList排序
                    self.SortShowHideFieldsList(tempArr);
                    
                    // 🔥 性能优化：分批渲染表格列
                    self._allFieldList = tempArr;
                    self.ShowDiyFieldList = [];
                    
                    // 首批只渲染前10列
                    var initialCount = Math.min(10, tempArr.length);
                    var initialColumns = tempArr.slice(0, initialCount);
                    
                    // 立即渲染首批列
                    self.$nextTick(function () {
                        self.ShowDiyFieldList = initialColumns;
                        
                        // 如果还有剩余列，延迟渲染
                        if (tempArr.length > initialCount) {
                            var renderRemaining = () => {
                                if (self._isDestroyed) return;
                                var current = self.ShowDiyFieldList.length;
                                if (current < tempArr.length) {
                                    // 每次添加5列
                                    var nextBatch = tempArr.slice(current, Math.min(current + 5, tempArr.length));
                                    self.ShowDiyFieldList = self.ShowDiyFieldList.concat(nextBatch);
                                    
                                    // 继续渲染
                                    if (self.ShowDiyFieldList.length < tempArr.length) {
                                        if (window.requestIdleCallback) {
                                            window.requestIdleCallback(renderRemaining);
                                        } else {
                                            setTimeout(renderRemaining, 16);
                                        }
                                    }
                                }
                            };
                            // 50ms后开始渲染剩余列
                            setTimeout(() => {
                                if (window.requestIdleCallback) {
                                    window.requestIdleCallback(renderRemaining);
                                } else {
                                    renderRemaining();
                                }
                            }, 50);
                        }
                    });
                    return tempArr;
                } else if (self.DiyFieldList.length > 0) {
                    //如果没有指定查询列
                    // 注意：如果先返了这个， 后面return tempArr的时候，排序就没用了。
                    var tempArr = [];
                    var index = 0;
                    self.DiyFieldList.forEach((element) => {
                        //2021-10-26 新增排序 ShowHideFieldsList
                        if (
                            !(self.FixedNotShowField.indexOf(element.Component) > -1) &&
                            (!(self.NotShowFields.indexOf(element) > -1 || self.NotShowFields.indexOf(element.Name) > -1 || self.NotShowFields.indexOf(element.Id) > -1) ||
                                self.ShowHideFieldsList.indexOf(element.Name) > -1) &&
                            !self.DiyCommon.IsNull(element.Id)
                        ) {
                            element["AsName"] = "";
                            //这里要根据 SelectFields 赋值别名
                            if (self.SysMenuModel.SelectFields && Array.isArray(self.SysMenuModel.SelectFields)) {
                                var search2 = _u.where(self.SysMenuModel.SelectFields, {
                                    Id: element
                                });
                                if (search2.length > 0 && !self.DiyCommon.IsNull(search2[0].AsName)) {
                                    element["AsName"] = search2[0].AsName;
                                }
                            }
                            //------end
                            //如果没有指定查询列，则不要显示审计字段，因为最后3列会显示审计字段 --2025-10-31 by anderson
                            if (self.DiyCommon.DefaultFieldNames.indexOf(element.Name) < 0) {
                                tempArr.push(element);
                            }
                            index++;
                        }
                    });
                    //调整ShowHideFieldsList排序
                    self.SortShowHideFieldsList(tempArr);
                    
                    // 🔥 性能优化：分批渲染表格列（第二个分支 - 无指定查询列）
                    self._allFieldList = tempArr;
                    self.ShowDiyFieldList = [];
                    
                    // 首批只渲染前10列
                    var initialCount = Math.min(10, tempArr.length);
                    var initialColumns = tempArr.slice(0, initialCount);
                    
                    // 立即渲染首批列
                    self.$nextTick(function () {
                        self.ShowDiyFieldList = initialColumns;
                        
                        // 如果还有剩余列，延迟渲染
                        if (tempArr.length > initialCount) {
                            var renderRemaining = () => {
                                if (self._isDestroyed) return;
                                var current = self.ShowDiyFieldList.length;
                                if (current < tempArr.length) {
                                    // 每次添加5列
                                    var nextBatch = tempArr.slice(current, Math.min(current + 5, tempArr.length));
                                    self.ShowDiyFieldList = self.ShowDiyFieldList.concat(nextBatch);
                                    
                                    // 继续渲染
                                    if (self.ShowDiyFieldList.length < tempArr.length) {
                                        if (window.requestIdleCallback) {
                                            window.requestIdleCallback(renderRemaining);
                                        } else {
                                            setTimeout(renderRemaining, 16);
                                        }
                                    }
                                }
                            };
                            // 50ms后开始渲染剩余列
                            setTimeout(() => {
                                if (window.requestIdleCallback) {
                                    window.requestIdleCallback(renderRemaining);
                                } else {
                                    renderRemaining();
                                }
                            }, 50);
                        }
                    });
                    return tempArr;
                } else {
                    self.ShowDiyFieldList = [];
                }
            } else {
                self.ShowDiyFieldList = [];
            }
            return [];
        },
        SortShowHideFieldsList(tempArr) {
            var self = this;
            if (self.ShowHideFieldsList.length > 0) {
                for (let index = 1; index <= self.ShowHideFieldsList.length; index++) {
                    //先查询到上一个字段所在位置
                    var firstIndex = _u.findIndex(tempArr, {
                        Name: self.ShowHideFieldsList[index - 1]
                    });
                    if (firstIndex != -1) {
                        //如果下一个位置的值和现在这个不相等
                        if (tempArr[firstIndex + 1] && self.ShowHideFieldsList[index] != tempArr[firstIndex + 1].Name) {
                            //获取老位置
                            var currentIndex = _u.findIndex(tempArr, {
                                Name: self.ShowHideFieldsList[index]
                            });
                            if (currentIndex != -1) {
                                //缓存用于替换的值
                                var currentModel = { ...tempArr[currentIndex] };
                                //删除老位置
                                tempArr.splice(currentIndex, 1);
                                //重新获取老位置
                                firstIndex = _u.findIndex(tempArr, {
                                    Name: self.ShowHideFieldsList[index - 1]
                                });
                                //插入新位置
                                tempArr.splice(firstIndex + 1, 0, currentModel);
                            }
                        }
                    }
                }
                //
                //self.ShowHideFieldsList
                // console.log(self.ShowHideFieldsList);
                // console.log(tempArr[6].Name + ',' + tempArr[7].Name+ ',' + tempArr[8].Name+ ',' + tempArr[9].Name+ ',' + tempArr[10].Name+ ',' + tempArr[11].Name);
            }
        },

        GetDiyTableRow(recParam) {
            let self = this;
            
            // ========== 关键：立即递增版本号取消所有旧操作 ==========
            self._paginationVersion++;
            const currentVersion = self._paginationVersion;
            
            // 检查是否是移动端追加模式
            var isAppendMode = recParam && recParam._append === true;
            
            // ========== 关键：取消正在进行的HTTP请求 ==========
            if (self._currentAbortController) {
                self._currentAbortController.abort();
            }
            self._currentAbortController = new AbortController();
            const abortSignal = self._currentAbortController.signal;
            
            self.tableLoading = true;
            
            // ========== 内存优化：不再清空数据，避免二次渲染 ==========
            // 注意：移除了 self.DiyTableRowList = [] 因为这会触发一次无意义的DOM渲染
            self.OldDiyTableRowList = [];
            // ========== 内存优化 END ==========
            
            //2023-06-29：如果是表单设计模式，无需获取数据
            if (self.LoadMode == "Design") {
                //---------处理需要真实显示的字段
                //注意：执行此句的时候，一定要保证 GetDiyField 已经执行完毕，所以在GetDiyField的时候，也需要调用一下这个方法？
                var tempShowDiyFieldList = self.GetShowDiyFieldList();
                //--------
                self.tableLoading = false;
                return;
            }
            if (recParam) {
                if (recParam.SearchCheckbox) {
                    self.SearchCheckbox = recParam.SearchCheckbox;
                }
                if (recParam.SearchModel) {
                    self.SearchModel = recParam.SearchModel;
                }
                if (recParam.SearchNumber) {
                    self.SearchNumber = recParam.SearchNumber;
                }
                if (recParam.SearchDateTime) {
                    self.SearchDateTime = recParam.SearchDateTime;
                }
            }

            self.TempBtnIsVisible = [];

            if (typeof recParam == "boolean" && recParam === true) {
                self.DiyTableRowPageIndex = 1;
            } else if (!self.DiyCommon.IsNull(recParam)) {
                if (!self.DiyCommon.IsNull(recParam._PageIndex)) {
                    if (recParam._PageIndex == -1) {
                        //算出最后一页
                        if (self.DiyTableRowCount != 0) {
                            self.DiyTableRowPageIndex = Math.ceil(self.DiyTableRowCount / self.DiyTableRowPageSize);
                        }
                    } else {
                        self.DiyTableRowPageIndex = recParam._PageIndex;
                    }
                }
            }
            var param = {
                // TableId: self.TableId,
                // TableName : self.CurrentDiyTableModel.Name,
                // FormEngineKey : self.CurrentDiyTableModel.Name,
                // _Keyword: self.Keyword,
                // _PageIndex: self.DiyTableRowPageIndex,
                // _PageSize: self.DiyTableRowPageSize,
                // _SysMenuId: self.SysMenuId,
                ModuleEngineKey: self.SysMenuModel.ModuleEngineKey,
                _OrderBy: self._OrderBy,
                _OrderByType: self._OrderByType
            };
            //2023-06-39：子表可关闭分页
            if (!self.TableChildConfig || (self.TableChildConfig && !self.TableChildConfig.DisablePagination)) {
                param._PageIndex = self.DiyTableRowPageIndex;
                param._PageSize = self.DiyTableRowPageSize;
            }

            if (recParam && recParam._Where && recParam._Where.length > 0) {
                param._Where = recParam._Where;
                self.SearchWhere = param._Where;
            } else if (recParam && recParam._Where && recParam._Where.length == 0) {
                self.SearchWhere = [];
                delete param._Where;
            } else if (self.SearchWhere.length > 0) {
                param._Where = self.SearchWhere;
            } else {
                self.SearchWhere = [];
                delete param._Where;
            }

            if (self.PropsWhere && self.PropsWhere.length > 0) {
                param._Where = self.PropsWhere;
            }

            //2024-12-14新增
            if (self.Where.length > 0) {
                if (!param._Where) {
                    param._Where = [];
                }
                self.Where.forEach((item) => {
                    //2026-01-12 Anderson：支持新版_Where
                    if (Array.isArray(item)) {
                        param._Where.push(item);
                    } else {
                        const index = param._Where.findIndex((d) => d.Name == item.Name);
                        if (index === -1) {
                            param._Where.push(item);
                        } else {
                            param._Where[index] = { ...param._Where[index], ...item };
                        }
                    }
                });
            }

            if (self.Keyword) {
                param._Keyword = self.Keyword;
            }

            // if(!param.TableName){
            //先设置模块引擎Key
            if (!param.ModuleEngineKey) {
                param.ModuleEngineKey = self.SysMenuId;
            }
            //如果仍然不存在模块引擎Key，设置表单引擎Key
            if (!param.ModuleEngineKey) {
                param.FormEngineKey = self.CurrentDiyTableModel.Name;
            }
            if (!param.ModuleEngineKey && !param.FormEngineKey) {
                param.FormEngineKey = self.TableId;
            }

            //注意：这个是由主表传过来的主表行Id，需要在这里子表加入条件：where 外键Id=TableChildFkFieldName
            if (!self.DiyCommon.IsNull(self.TableChildFkFieldName)) {
                // param[self.TableChildFkFieldName] = self.TableChildFkValue;
                //2021-10-25 新增：如果是传过来的父级formModel，以这个为准
                if (!self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    // if (!self.DiyCommon.IsNull(self.FatherFormModel.Id)) {
                    // self.SearchModel[self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
                    // // self.SearchModel[self.TableChildFkFieldName] = self.FatherFormModel.Id;
                    //2022-02-14 关联表修改为等值条件
                    //2022-07-23新增也可能不跟主表的Id进行关联
                    if (self.PrimaryTableFieldName) {
                        self.SearchEqual[self.TableChildFkFieldName] = self.FatherFormModel_Data[self.PrimaryTableFieldName];
                    } else {
                        self.SearchEqual[self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
                    }
                } else {
                    // self.SearchModel[self.TableChildFkFieldName] = self.TableChildTableRowId;
                    //2022-02-14 关联表修改为等值条件
                    self.SearchEqual[self.TableChildFkFieldName] = self.TableChildTableRowId;
                }
            }

            //判断外部传来的新增条件SearchAppend
            if (!self.DiyCommon.IsNull(self.SearchAppend)) {
                for (const key in self.SearchAppend) {
                    self.V8SearchModel[key] = self.SearchAppend[key];
                }
            }

            // //这里需要判断 V8SearchModel
            // if(!self.DiyCommon.IsNull(self.SearchSet)){
            //     self.V8SearchModel = self.SearchSet;
            // }

            //这里需要判断 V8SearchModel
            if (!self.DiyCommon.IsNull(self.V8SearchModel)) {
                for (const key in self.V8SearchModel) {
                    self.SearchModel[key] = self.V8SearchModel[key];
                }
            }

            //2022-07-26新增 url 参数 _SearchDateTime 搜索条件
            var _searchDateTime = self.$route.query._SearchDateTime;
            if (self.IsTableChild()) {
                _searchDateTime = "";
            }
            if (_searchDateTime) {
                var _searchDateTimeArr = _searchDateTime.split("|");
                if (_searchDateTimeArr.length == 3) {
                    self.SearchDateTime[_searchDateTimeArr[0]] = [_searchDateTimeArr[1], _searchDateTimeArr[2]];
                }
            }
            if (self.SearchModel && !_u.isEqual(self.SearchModel, {})) {
                param._Search = self.SearchModel;
            }
            if (self.SearchEqual && !_u.isEqual(self.SearchEqual, {})) {
                param._SearchEqual = self.SearchEqual;
            }
            if (self.SearchCheckbox && !_u.isEqual(self.SearchCheckbox, {})) {
                param._SearchCheckbox = self.SearchCheckbox;
            }
            if (self.SearchDateTime && !_u.isEqual(self.SearchDateTime, {})) {
                param._SearchDateTime = self.SearchDateTime;
            }
            if (self.SearchNumber) {
                for (let key in self.SearchNumber) {
                    if (self.SearchNumber[key].Min || self.SearchNumber[key].Max) {
                        param._SearchNumber = self.SearchNumber;
                        break;
                    }
                }
            }
            //判断模块引擎是否配置了查询接口替换
            var url = self.DiyApi.GetDiyTableRow;
            var paramType = "";
            if (self.CurrentDiyTableModel.IsTree) {
                url = self.DiyApi.GetTableDataTree;
            } else {
                url = "/api/FormEngine/GetTableData-" + (param.ModuleEngineKey || param.FormEngineKey).replace(/\_/g, "-").toLowerCase();
                paramType = "json";
            }
            // url = '/api/diytable/getDiyTableRowTree';
            if (self.SysMenuModel.DiyConfig && self.SysMenuModel.DiyConfig.SelectApi) {
                url = self.DiyCommon.RepalceUrlKey(self.SysMenuModel.DiyConfig.SelectApi);
            }
            //2024-04-24：如果是报表引擎，通过数据源引擎获取数据
            if (self.CurrentDiyTableModel.ReportId && self.CurrentDiyTableModel.DataSourceId) {
                url = "/api/DataSourceEngine/Run";
                param.DataSourceKey = self.CurrentDiyTableModel.DataSourceId;
            }
            self.DiyCommon.Post(
                url,
                param,
                async function (result) {
                    // ========== 内存优化：检查组件是否已销毁或版本号不匹配 ==========
                    if (self._isDestroyed || self._paginationVersion !== currentVersion) {
                        return;
                    }
                    
                    self.tableLoading = false;
                    
                    if (self.DiyCommon.Result(result)) {
                        console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]处理数据列表总耗时`);
                        
                        //---------处理需要真实显示的字段（必须同步执行，否则列不显示）
                        var tempShowDiyFieldList = self.GetShowDiyFieldList();

                        // 性能优化：找出需要模板引擎处理的字段
                        var templateEngineFields = tempShowDiyFieldList.filter((field) => !self.DiyCommon.IsNull(field.V8TmpEngineTable));

                        // 性能优化：先设置基础数据，让用户快速看到列表
                        for (var i = 0; i < result.Data.length; i++) {
                            if (!self.CurrentDiyTableModel.TreeLazy) {
                                result.Data[i][self.CurrentDiyTableModel.TreeHasChildren] = false;
                            }
                            // 默认都显示，后续异步更新
                            result.Data[i].IsVisibleDetail = true;
                            result.Data[i].IsVisibleEdit = true;
                            result.Data[i].IsVisibleDel = true;
                            result.Data[i]._RowMoreBtnsOut = [];
                            result.Data[i]._RowMoreBtnsIn = [];
                        }

                        // 先设置总数（但不设置数据，等V8处理完再一次性显示）
                        // 如果不是追加模式，更新总数
                        if (!isAppendMode) {
                            self.DiyTableRowCount = result.DataCount;
                        }
                        
                        
                        // ========== 同步处理V8按钮和模板引擎 ==========
                        // 版本检查，确保没有新的分页请求
                        if (!self._isDestroyed && self._paginationVersion === currentVersion) {
                            // 处理按钮显示条件
                            self.IsVisibleAdd = true;
                            var moreBtns = self.SysMenuModel.MoreBtns || [];
                            var moreBtnsOutTemplate = _u.where(moreBtns, { ShowRow: true }) || [];
                            var moreBtnsInTemplate = _u.where(moreBtns, { ShowRow: false }) || [];
                            self.MaxRowBtnsOut = 0;
                            
                            console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]按钮V8条件执行总耗时`);
                            
                            // 初始化统计
                            self._btnPerfStats = {};
                            
                            // 预先缓存权限查询结果
                            var cachedRoleLimit = _u.where(self.GetCurrentUser._RoleLimits, {
                                FkId: self.SysMenuId
                            });
                            
                            // 初始化共享V8
                            var sharedV8 = self.DiyCommon.InitV8CodeSync({}, self.$router);
                            sharedV8.EventName = "V8BtnLimit";
                            sharedV8._cachedRoleLimit = cachedRoleLimit;
                            self.SetV8DefaultValue(sharedV8);
                            
                            for (var i = 0; i < result.Data.length; i++) {
                                if (self._paginationVersion !== currentVersion) break;
                                
                                var row = result.Data[i];
                                var rowBtnsOut = moreBtnsOutTemplate.map(btn => ({ ...btn }));
                                var rowBtnsIn = moreBtnsInTemplate.map(btn => ({ ...btn }));
                                
                                // 为每行更新Form属性
                                var form = { ...row };
                                sharedV8.Form = self.DeleteFormProperty(form);
                                sharedV8.FormSet = (fieldName, value) => self.FormSet(fieldName, value, row);
                                sharedV8.OpenForm = (r, type) => self.OpenDetail(r, type, true);
                                sharedV8.OpenFormWF = (r, type, wfParam) => self.OpenDetail(r, type, true, true, wfParam);
                                
                                // 同步执行按钮处理
                                self.HandlerBtns(rowBtnsOut, row, sharedV8);
                                self.HandlerBtns(rowBtnsIn, row, sharedV8);
                                
                                row._RowMoreBtnsOut = rowBtnsOut;
                                row._RowMoreBtnsIn = rowBtnsIn;
                                
                                // 计算操作列宽度
                                var allOutBtn = _u.where(row._RowMoreBtnsOut, { IsVisible: true });
                                var allOutBtnLength = 0;
                                allOutBtn.forEach(el => { allOutBtnLength += el.Name.length; });
                                var newWidth = allOutBtnLength * 15 + allOutBtn.length * 45;
                                if (self.MaxRowBtnsOut < newWidth) self.MaxRowBtnsOut = newWidth;
                            }
                            
                            console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]按钮V8条件执行总耗时`);
                            
                            if (templateEngineFields.length > 0) {
                                console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]模板引擎V8执行总耗时`);
                                
                                for (var i = 0; i < result.Data.length; i++) {
                                    if (self._paginationVersion !== currentVersion) break;
                                    
                                    var row = result.Data[i];
                                    for (var j = 0; j < templateEngineFields.length; j++) {
                                        var field = templateEngineFields[j];
                                        try {
                                            var tmpResult = self.RunFieldTemplateEngine(field, row);
                                            row[field.Name + '_TmpEngineResult'] = tmpResult;
                                        } catch (e) {
                                            console.warn('模板引擎处理错误:', field.Name, e);
                                        }
                                    }
                                }
                                
                                console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]模板引擎V8执行总耗时`);
                            }
                            
                            // 所有V8处理完成后，直接赋值（不需要map，数据已在原数组修改）
                            // 移动端追加模式：将新数据追加到现有列表
                            if (isAppendMode && self.diyStore.IsPhoneView) {
                                self.DiyTableRowList = self.DiyTableRowList.concat(result.Data);
                            } else {
                                self.DiyTableRowList = result.Data;
                            }
                            console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]处理数据列表总耗时`);
                            console.time(`Microi：【性能监控】[${self.SysMenuModel.Name}]渲染数据列表总耗时`);
                            self.$nextTick(() => {
                                console.timeEnd(`Microi：【性能监控】[${self.SysMenuModel.Name}]渲染数据列表总耗时`);
                            });
                        }

                        if (self.PropTableMultipleSelection) {
                            self.TableMultipleSelection = [];
                            self.$nextTick(() => {
                                if (self._paginationVersion === currentVersion) {
                                    self.toggleSelection(self.PropTableMultipleSelection, "Y");
                                }
                            });
                        }
                        // 内存优化：只保存ID
                        self.OldDiyTableRowList = result.Data.map((row) => ({ Id: row.Id }));

                        if (result.DataAppend && result.DataAppend.NotSaveField) {
                            self.NotSaveField = result.DataAppend.NotSaveField;
                        }

                        //2025-08-07 --anderson
                        var formDataId = self.$route.query.FormDataId;
                        if (self.IsTableChild()) {
                            formDataId = "";
                        }
                        if (formDataId && recParam && recParam.IsInit && !self.IsTableChild()) {
                            self.OpenDetail({ Id: formDataId }, "View", true);
                        }
                    }
                },
                null,
                null,
                paramType
            );
        },

        InputGetDiyTableRow(obj) {
            this.DebounceGetDiyTableRow(obj, this);
        },

        DebounceGetDiyTableRow: debounce((obj, self) => {
            self.GetDiyTableRow(obj);
        }, 500),

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
                if (!V8.Form) {
                    var form = { ...row };
                    V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
                }
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

        async DiguiDiyTableRowDataList(firsrtData, paginationVersion) {
            var self = this;
            
            // 内存优化：检查版本号，如果不匹配则中断处理
            if (paginationVersion !== undefined && self._paginationVersion !== paginationVersion) {
                return;
            }
            
            // 内存优化：缓存按钮模板，避免每行都重新查询
            // 注意：每次分页都重新获取，确保模板是最新的
            var moreBtnsOutTemplate = _u.where(self.SysMenuModel.MoreBtns || [], { ShowRow: true }) || [];
            var moreBtnsInTemplate = _u.where(self.SysMenuModel.MoreBtns || [], { ShowRow: false }) || [];

            //注意：这个result.Data可能是树形，  --2022-07-02
            for (let index = 0; index < firsrtData.length; index++) {
                // 内存优化：每行处理前检查版本号
                if (paginationVersion !== undefined && self._paginationVersion !== paginationVersion) {
                    return;
                }
                
                //result.Data
                let row = firsrtData[index]; //result.Data
                if (!row.Id && (row.id || row.ID)) {
                    row.Id = row.id || row.ID;
                }
                
                // 使用模板创建副本
                let _rowMoreBtnsOutCopy = moreBtnsOutTemplate.map(element => ({ ...element }));

                self.HandlerBtns(_rowMoreBtnsOutCopy, row);
                row._RowMoreBtnsOut = _rowMoreBtnsOutCopy;

                //取列表数据中可能存在的最多按钮数量
                // var maxLength = _u.where(_rowMoreBtnsOutCopy, {IsVisible : true}).length;
                var allOutBtn = _u.where(_rowMoreBtnsOutCopy, { IsVisible: true });
                var allOutBtnLength = 0;
                allOutBtn.forEach((element) => {
                    allOutBtnLength += element.Name.length;
                });
                //之前是 MaxRowBtnsOut*115 按按钮数量来，现在按文字数量来 2022-07-24
                //定在一个字：15   一个按钮  30  还有2个按钮的空隙 15
                var newWidth = allOutBtnLength * 20 + allOutBtn.length * 50;
                // if (self.MaxRowBtnsOut < maxLength) {
                if (self.MaxRowBtnsOut < newWidth) {
                    // self.MaxRowBtnsOut = maxLength;
                    self.MaxRowBtnsOut = newWidth;
                }

                // 使用模板创建副本
                let _rowMoreBtnsInCopy = moreBtnsInTemplate.map(element => ({ ...element }));

                self.HandlerBtns(_rowMoreBtnsInCopy, row);
                row._RowMoreBtnsIn = _rowMoreBtnsInCopy;

                //刘诚2025-6-29新增，判断默认的显示和删除按钮是否显示
                // 注意：IsVisibleDetail/Edit/Del 已经在 GetDiyTableRow 的 for 循环中处理过了
                // 只有在树形结构的子节点中才需要处理（因为子节点不在 GetDiyTableRow 的 for 循环中）
                if (self.CurrentDiyTableModel.IsTree && row["_Child"] && row["_Child"].length > 0) {
                    // 内存优化：检查版本号
                    if (paginationVersion !== undefined && self._paginationVersion !== paginationVersion) {
                        return;
                    }
                    // 递归处理子节点时，子节点需要设置 IsVisible 属性
                    for (let childIndex = 0; childIndex < row["_Child"].length; childIndex++) {
                        // 内存优化：每个子节点处理前检查版本号
                        if (paginationVersion !== undefined && self._paginationVersion !== paginationVersion) {
                            return;
                        }
                        let childRow = row["_Child"][childIndex];
                        if (!self.DiyCommon.IsNull(self.SysMenuModel.DetailCodeShowV8)) {
                            let btn = self.SysMenuModel.DetailCodeShowV8;
                            childRow.IsVisibleDetail = await self.LimitMoreBtn1(btn, childRow, "DetailCodeShowV8");
                        } else {
                            childRow.IsVisibleDetail = true;
                        }
                        if (!self.DiyCommon.IsNull(self.SysMenuModel.EditCodeShowV8)) {
                            let btn = self.SysMenuModel.EditCodeShowV8;
                            childRow.IsVisibleEdit = await self.LimitMoreBtn1(btn, childRow, "EditCodeShowV8");
                        } else {
                            childRow.IsVisibleEdit = true;
                        }
                        if (!self.DiyCommon.IsNull(self.SysMenuModel.DelCodeShowV8)) {
                            let btn = self.SysMenuModel.DelCodeShowV8;
                            childRow.IsVisibleDel = await self.LimitMoreBtn1(btn, childRow, "DelCodeShowV8");
                        } else {
                            childRow.IsVisibleDel = true;
                        }
                    }
                    await self.DiguiDiyTableRowDataList(row["_Child"], paginationVersion);
                }

                //2022-06-17 新增：值数据处理，如级联应该处理成json, DiyForm的DiyFieldStrToJson函数有处理，
                //暂时先放到了DiyDepartment、DiyCascader中处理
            }
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
            self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + (title ? `【${title}】？` : "？"), async function () {
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
                    Id: rowModel.Id
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

                        //2023-08-08
                        if ((self.DiyTableRowList.length = 1 && self.DiyTableRowPageIndex > 1)) {
                            self.DiyTableRowPageIndex--;
                        }

                        self.GetDiyTableRow();
                    }
                });
            });
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
        //param: { _PageIndex : 1 }
        RefreshDiyTableRowList(param) {
            var self = this;
            //2021-09-26 同时也重新获取列

            self.GetDiyTableRow(param);
        },
        DownloadTemplate() {
            var self = this;
            //2021修改为取私有oss
            //window.open(self.DiyCommon.GetServerPath(self.SysMenuModel.ImportTemplate));
            // self.DiyCommon.Post('/api/Aliyun/GetOssDownloadUrl',{
            self.DiyCommon.Post(
                "/api/HDFS/GetPrivateFileUrl",
                {
                    FilePathName: self.SysMenuModel.ImportTemplate, //self.FormDiyTableModel[field.Name]
                    HDFS: self.SysConfig.HDFS || "Aliyun"
                },
                function (result) {
                    if (self.DiyCommon.Result(result)) {
                        result = result.Data;
                    } else {
                        result = "";
                    }
                    // self.$set(self.FormDiyTableModel, field.Name + '_' + fileId + '_RealPath', result);
                    // resolve(result);
                    window.open(result);
                }
            );
        },
        //传入{Data:[], DataCount:0, }
        TableSetData(dataObj) {
            var slef = this;
            self.DiyTableRowList = dataObj.Data;
            self.DiyTableRowCount = dataObj.DataCount;
            // //需要将这些数据全部插入数据库
            // dataObj.Data.forEach(element => {
            //     self.DosCommon.Post
            // });
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

        //获取角色列表
        async GetSysRole() {
            var self = this;
            const result = await self.DiyCommon.PostAsync("/api/SysMenu/SysRoleLimitByMenuId", {
                OsClient: self.DiyCommon.GetOsClient(),
                FkId: self.SysMenuId
            });
            // 先赋值按钮集合
            // this.MockPermissionBtnList 已在GetFormBtns处理
            // 处理角色权限数据
            const btnIdSet = new Set(this.MockPermissionBtnList.map((btn) => btn.Id));
            this.MockPermissionRoleList = (result || []).map((role) => {
                let permArr = [];
                try {
                    permArr = JSON.parse(role.Permission);
                } catch (e) {
                    permArr = [];
                }
                // 只保留Id
                permArr = permArr.filter((id) => btnIdSet.has(id));
                return {
                    ...role,
                    Permission: permArr
                };
            });
        },

        //获取表单按钮集合
        async GetFormBtns() {
            var self = this;
            const result = await self.DiyCommon.PostAsync(self.DiyApi.GetSysMenuModel, {
                Id: self.SysMenuId
            });
            if (self.DiyCommon.Result(result)) {
                let allBtns = this.getAllFormBtns(result.Data);
                this.MockPermissionBtnList = allBtns || [];
                // console.log("所有按钮", this.MockPermissionBtnList);

                this.GetSysRole();
            }
        },

        OpenMockPermissionDialog() {
            this.ShowMockPermissionDialog = true;

            this.GetFormBtns();
            // 动态提升本页面弹窗和下拉的z-index，避免影响全局
            this.$nextTick(() => {
                // 提升当前弹窗z-index
                const dialog = document.querySelector(".mock-permission-dialog .el-dialog__wrapper");
                if (dialog) dialog.style.zIndex = 4000;
                // 提升当前下拉的z-index
                const dropdowns = document.querySelectorAll(".mock-permission-dialog .el-select-dropdown, .mock-permission-dialog .el-popper");
                dropdowns.forEach((d) => (d.style.zIndex = 4001));
            });
        },
        async SaveMockPermissionConfig() {
            // 这里只做前端提示，实际保存逻辑等后端接口完成后再接入
            this.$message.success("权限已保存！");
            this.ShowMockPermissionDialog = false;

            var self = this;

            let newAllLimits = this.convertPermissionWithNames(this.MockPermissionRoleList, this.MockPermissionBtnList);
            console.log("newAllLimits", newAllLimits);
            // 可以在这里打印当前权限配置到控制台
            await self.DiyCommon.PostAsync("/api/SysMenu/UpdateSysRoleLimitByMenuId", {
                OsClient: self.DiyCommon.GetOsClient(),
                Type: JSON.stringify(newAllLimits)
            });
        },
        /**
         * 获取表单所有权限按钮（通用+自定义）李赛赛
         * @param {Object} sysMenu 当前表单实体（含6个按钮字段）
         * @returns {Array} 所有按钮对象数组 [{Id, Name, ...}]
         */
        getAllFormBtns(sysMenu) {
            // 1. 通用按钮
            const baseBtns = [
                { Id: "Add", Name: "新增" },
                { Id: "Edit", Name: "编辑" },
                { Id: "Del", Name: "删除" },
                { Id: "Export", Name: "导出" },
                { Id: "Import", Name: "导入" }
            ];
            // 2. 自定义按钮字段
            const btnFields = ["MoreBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs", "FormBtns"];
            let customBtns = [];
            btnFields.forEach((field) => {
                let arr = [];
                if (sysMenu && sysMenu[field]) {
                    try {
                        arr = JSON.parse(sysMenu[field]);
                    } catch (e) {
                        arr = [];
                    }
                    if (Array.isArray(arr)) {
                        // 只保留有Id和Name的按钮
                        arr.forEach((btn) => {
                            if (btn && btn.Id && btn.Name) {
                                customBtns.push({ Id: btn.Id, Name: btn.Name });
                            }
                        });
                    }
                }
            });
            // 3. 合并并去重（以Id为唯一）
            const allBtnsMap = {};
            baseBtns.concat(customBtns).forEach((btn) => {
                if (btn && btn.Id) allBtnsMap[btn.Id] = btn;
            });
            return Object.values(allBtnsMap);
        },
        isRoleAllChecked(row) {
            const allBtnIds = this.MockPermissionBtnList.map((btn) => btn.Id);
            return row.Permission.length === allBtnIds.length;
        },
        isRoleIndeterminate(row) {
            const allBtnIds = this.MockPermissionBtnList.map((btn) => btn.Id);
            return row.Permission.length > 0 && row.Permission.length < allBtnIds.length;
        },
        toggleRoleAll(row, checked) {
            const allBtnIds = this.MockPermissionBtnList.map((btn) => btn.Id);
            if (checked) {
                row["Permission"] = [...allBtnIds];
            } else {
                row["Permission"] = [];
            }
        },
        /**
         * 将 allLimits 的 Permission 数组，匹配 allBtns.Id 后，在其后插入对应 Name
         * @param {Array} allLimits 角色权限数组
         * @param {Array} allBtns 按钮数组
         * @returns {Array} 新的 allLimits（深拷贝，不影响原数据）
         */
        convertPermissionWithNames(allLimits, allBtns) {
            // 1. 通用按钮
            const baseBtns = [
                { Id: "Add", Name: "新增" },
                { Id: "Edit", Name: "编辑" },
                { Id: "Del", Name: "删除" },
                { Id: "Export", Name: "导出" },
                { Id: "Import", Name: "导入" }
            ];
            // 先构建一个 id->name 的映射，方便查找
            const btnMap = {};
            allBtns.forEach((btn) => {
                btnMap[btn.Id] = btn.Name;
            });

            // 返回新的 allLimits，不修改原数据
            return allLimits.map((limit) => {
                // 新的 Permission 数组
                const newPermission = [];
                limit.Permission.forEach((id) => {
                    newPermission.push(id);
                    //排除默认几个通用按钮，自定义按钮需要并排添加id和name
                    if (btnMap[id] && baseBtns.findIndex((i) => i.Id == id) == -1) {
                        newPermission.push(btnMap[id]);
                    }
                });
                // 返回新的对象
                return {
                    ...limit,
                    Permission: newPermission
                };
            });
        }
    }
};
</script>

<style lang="scss" scoped>
@import "@/styles/diy-table-rowlist.scss";
</style>