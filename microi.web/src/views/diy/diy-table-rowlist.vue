<template>
  <div
    id="diy-table"
    :class="'diy-table pluginPage ' + ContainerClass + (IsTableChild() ? ` diy-child-table diy-child-table-${TableChildTableId}` : '')"
    :style="{ padding: IsTableChild() ? '0px' : '0px' }"
  >
    <!-- type="border-card" -->
    <el-tabs id="table-rowlist-tabs" v-model="TableRowListActiveTab" @tab-click="tabClickRowList" :class="!IsPageTabs() ? 'table-rowlist-tabs tab-pane-hide' : 'table-rowlist-tabs box-card-top-tabs'">
      <!-- 之前是使用GetPageTabs()，使用改成了预渲染  -->
      <template v-for="(tab, tabIndex) in SysMenuModel.PageTabs">
        <el-tab-pane v-if="tab.IsVisible" :key="TypeFieldName + 'page_tabs_' + tab.Id + tabIndex" :name="tab.Id" :lazy="true">
          <span
            slot="label"
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
            <!-- <el-badge :value="3" class="DaiyanZFY_Badge">
                        {{ tab.Name }}
                    </el-badge> -->
            <template>
              {{ tab.Name }}
            </template>
          </span>
          <!--原先<el-row>是放在这里的，后面移出去了-->
        </el-tab-pane>
      </template>
      <el-row>
        <el-col :span="24">
          <!--DIY子表-->
          <el-card class="box-card box-card-table-row-list">
            <div v-if="IsTableChild() && TableChildField.Label" slot="header" class="clearfix">
              <span style="font-weight: bold"> <i class="mr-2 fas fa-table"></i>{{ TableChildField.Label }}</span>
            </div>
            <div v-if="PropsIsJoinTable && JoinTableField.Label" slot="header" class="clearfix">
              <span style="font-weight: bold"> <i class="mr-2 fas fa-table"></i>{{ JoinTableField.Label }}</span>
            </div>
            <!--DIY功能按钮 新版-->
            <div class="keyword-search">
              <div class="pull-left item-in" style="margin-right: 0px">
                <el-button
                  v-if="LimitAdd() && TableChildFormMode != 'View' && !TableChildField.Readonly && PropsIsJoinTable !== true && IsVisibleAdd == true"
                  :loading="BtnLoading"
                  type="primary"
                  icon="el-icon-circle-plus-outline"
                  @click="OpenDetail(null, 'Add')"
                >
                  {{ !DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.DiyConfig.AddBtnText) ? SysMenuModel.DiyConfig.AddBtnText : $t("Msg.Add") }}
                </el-button>
                <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.PageBtns) && SysMenuModel.PageBtns.length > 0">
                  <!-- HandlerBtns(SysMenuModel.PageBtns) -->
                  <template v-for="(btn, btnIndex) in SysMenuModel.PageBtns">
                    <el-button :key="TypeFieldName + 'more_btn_pagebtns_' + btnIndex" :type="GetMoreBtnStyle(btn)" v-if="btn.IsVisible" :loading="BtnV8Loading" @click.native="RunMoreBtn(btn)">
                      <i :class="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)"></i>
                      {{ btn.Name }}
                    </el-button>
                  </template>
                </template>
                <!-- <el-button
                                v-if="!TableEnableBatch && !DiyCommon.IsNull(SysMenuModel.BatchSelectMoreBtns) && SysMenuModel.BatchSelectMoreBtns.length > 0"
                                icon="el-icon-s-operation"
                                @click="SwitchTableBatch()">
                                {{ $t('Msg.BatchOperation') }}
                            </el-button> -->
                <!-- <el-dropdown
                                v-if="TableEnableBatch
                                        && !DiyCommon.IsNull(SysMenuModel.BatchSelectMoreBtns)
                                    && SysMenuModel.BatchSelectMoreBtns.length > 0"
                                    split-button
                                style="margin-left:10px;margin-right:10px;"
                                trigger="click"
                                @click="SwitchTableBatch()">
                                <i class="el-icon-close" /> {{$t('Msg.Exit')}}{{ $t('Msg.BatchOperation') }}
                                <el-dropdown-menu
                                    slot="dropdown"
                                    class="table-more-btn">

                                    <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig)
                                            && !DiyCommon.IsNull(SysMenuModel.BatchSelectMoreBtns)
                                            && SysMenuModel.BatchSelectMoreBtns.length > 0">
                                        <template v-for="(btn, btnIndex) in SysMenuModel.BatchSelectMoreBtns"
                                            >
                                            <el-dropdown-item
                                                v-if="btn.IsVisible"
                                                :key="'more_btn_bs_' + btnIndex"
                                                @click.native="RunMoreBtn(btn)">
                                                <i :class="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)"></i> {{ btn.Name }}
                                            </el-dropdown-item>
                                        </template>

                                    </template>
                                </el-dropdown-menu>
                            </el-dropdown> -->
                <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.BatchSelectMoreBtns) && SysMenuModel.BatchSelectMoreBtns.length > 0">
                  <template v-for="(btn, btnIndex) in SysMenuModel.BatchSelectMoreBtns">
                    <el-button v-if="btn.IsVisible" :key="TypeFieldName + 'more_btn_bs_' + btnIndex" @click="RunMoreBtn(btn)">
                      <i :class="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)"></i>
                      {{ btn.Name }}
                    </el-button>
                  </template>
                </template>
                <!--如果子表是只读状态或预览模式，不显示新增、导入导出按钮-->
                <template v-if="!IsTableChild() || (IsTableChild() && !TableChildField.Readonly)">
                  <el-button v-if="LimitImport() && TableChildFormMode != 'View'" icon="el-icon-upload2" @click="ImportDiyTableRow()">{{ $t("Msg.Import") }}</el-button>
                  <el-button
                    v-if="LimitExport() && (DiyCommon.IsNull(SysMenuModel.ExportMoreBtns) || SysMenuModel.ExportMoreBtns.length == 0)"
                    icon="el-icon-download"
                    :loading="BtnExportLoading"
                    @click="ExportDiyTableRow()"
                    >{{ $t("Msg.Export") }}</el-button
                  >
                  <!-- @click="ExportDiyTableRow()" -->
                  <!-- split-button -->
                  <el-dropdown v-if="LimitExport() && !DiyCommon.IsNull(SysMenuModel.ExportMoreBtns) && SysMenuModel.ExportMoreBtns.length > 0" size="mini" trigger="click" style="margin-left: 10px">
                    <!-- {{ $t('Msg.Export') }} -->
                    <el-button class="mr-10">
                      {{ $t("Msg.Export") }}
                      <i class="el-icon-arrow-down el-icon--right" />
                    </el-button>
                    <el-dropdown-menu slot="dropdown" class="table-more-btn">
                      <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.ExportMoreBtns) && SysMenuModel.ExportMoreBtns.length > 0">
                        <template v-for="(btn, btnIndex) in SysMenuModel.ExportMoreBtns">
                          <el-dropdown-item v-if="btn.IsVisible" :key="TypeFieldName + 'more_btn_export_' + btnIndex" @click.native="ExportDiyTableRow(btn)">
                            <i :class="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)"></i>
                            {{ btn.Name }}
                          </el-dropdown-item>
                        </template>
                      </template>
                    </el-dropdown-menu>
                  </el-dropdown>
                </template>
                <el-button v-if="!DiyCommon.IsNull(SysMenuModel.ImportTemplate)" icon="el-icon-document" @click="DownloadTemplate()">{{ $t("Msg.DownloadTemplate") }}</el-button>
              </div>

              <div class="pull-left item-in" v-if="IsPermission('NoSearch')">
                <!-- @keyup.enter.native="GetDiyTableRow({_PageIndex : 1})" -->
                <el-input class="input-left-borderbg" style="margin: 0px 5px 0 10px" v-model="Keyword" @input="GetDiyTableRow({ _PageIndex: 1 })" :placeholder="$t('Msg.Search')">
                  <el-button slot="append" icon="el-icon-search" @click="GetDiyTableRow({ _PageIndex: 1 })"></el-button>
                </el-input>
              </div>

              <template v-if="IsPermission('NoSearch')">
                <DiySearch
                  v-if="SearchFieldIds.length > 0 && DiyFieldList.length > 0"
                  :ref="'refDiySearch1'"
                  :key="'refDiySearch1'"
                  :type-field-name="TypeFieldName"
                  :search-field-ids="SearchFieldIds"
                  :diy-field-list="DiyFieldList"
                  :search-type="'Line'"
                  @CallbackGetDiyTableRow="GetDiyTableRow"
                  @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"
                ></DiySearch>
              </template>
              <!--清除搜索-->
              <div class="pull-left item-in" v-if="IsPermission('NoSearch')">
                <el-button
                  style="margin-left: 5px"
                  icon="el-icon-refresh-left"
                  @click="
                    InitSearch();
                    GetDiyTableRow({ _PageIndex: 1 });
                  "
                >
                  {{ $t("Msg.ClearSearch") }}
                </el-button>
              </div>

              <div class="pull-left item-in search-in" v-if="GetSearchFieldList().length > 0 && IsPermission('NoSearch')">
                <!-- 更多搜索 弹出层  【内部】搜索-->
                <el-popover
                  placement="bottom"
                  width="auto"
                  trigger="click"
                  popper-class="diy-search-popover search-in"
                  v-if="GetSearchFieldList('Checkbox', 'In').length > 0 || GetSearchFieldList('Text', 'In').length > 0"
                >
                  <DiySearch
                    v-if="SearchFieldIds.length > 0 && DiyFieldList.length > 0"
                    :ref="'refDiySearch2'"
                    :key="'refDiySearch2'"
                    :search-field-ids="SearchFieldIds"
                    :diy-field-list="DiyFieldList"
                    :search-type="'In'"
                    @CallbackGetDiyTableRow="GetDiyTableRow"
                    @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"
                  ></DiySearch>
                  <!-- <el-row class="all-search">
                                    <template
                                        v-for="(field, index) in GetSearchFieldList('Checkbox', 'In')"
                                        >
                                        <div
                                            :key="'search_line_' + field.Name"
                                            v-if="Array.isArray(field.Data) && field.Data.length > 0"
                                            class="clear"
                                            style="height:35px;"
                                            >
                                            <div class="search-label pull-left">
                                                <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{field.Label}}</el-tag>
                                            </div>
                                            <el-checkbox-group
                                                class="pull-left"
                                                v-model="SearchCheckbox[field.Name]"
                                                @change="GetDiyTableRow({_PageIndex : 1})"
                                                >
                                                <el-checkbox
                                                    v-for="(fieldData, fieldDatIndex) in field.Data"
                                                    :key="'fieldData' + field.Name + fieldDatIndex"
                                                    :label="GetSearchItemCheckKey(fieldData, field)"
                                                    style="width:auto;margin-right:15px;"
                                                    >
                                                    {{GetSearchItemCheckLabel(fieldData, field)}}
                                                    </el-checkbox>
                                            </el-checkbox-group>
                                        </div>

                                    </template>
                                    <el-col
                                        v-if="GetSearchFieldList('Text', 'In').length > 0"
                                        class="more-search"
                                        :span="24"
                                        >
                                        <el-row
                                            style="height:auto;">
                                            <span class="pull-left" style="display: block;">
                                                <div v-for="(field, index) in GetSearchFieldList('Text', 'In')"
                                                    style="float:left;margin-right: 15px;margin-bottom: 10px;height: 28px;"
                                                    :key="'search_line_2' + field.Name">
                                                    <div
                                                        v-if="field.Component == 'DateTime'"
                                                        class="block">
                                                        <div class="search-line-label pull-left">
                                                            <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{field.Label}}</el-tag>
                                                        </div>
                                                        <el-date-picker
                                                        v-model="SearchDateTime[field.Name]"
                                                        type="daterange"
                                                        :value-format="'yyyy-MM-dd'"
                                                        range-separator="至"
                                                        start-placeholder="开始日期"
                                                        end-placeholder="结束日期"
                                                        @change="GetDiyTableRow({_PageIndex : 1})">
                                                        </el-date-picker>
                                                    </div>
                                                    <div
                                                        v-else-if="field.Type == 'int' || field.Type.indexOf('decimal') > -1"
                                                        class="block">
                                                        <div class="pull-left">
                                                            <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{field.Label}}</el-tag>
                                                        </div>
                                                        <div class="pull-left">
                                                            <el-input-number
                                                                style="width:120px;"
                                                                v-model="SearchNumber[field.Name].Min"
                                                                @keyup.enter.native="GetDiyTableRow({_PageIndex : 1})"
                                                                controls-position="right"></el-input-number>
                                                        </div>
                                                        <div class="line pull-left" style="width:20px;text-align:center;line-height: 28px;">-</div>
                                                        <div class="pull-left">
                                                            <el-input-number
                                                                style="width:120px;"
                                                                v-model="SearchNumber[field.Name].Min"
                                                                @keyup.enter.native="GetDiyTableRow({_PageIndex : 1})"
                                                                controls-position="right"></el-input-number>
                                                        </div>
                                                    </div>
                                                    <el-input
                                                        v-else
                                                        v-model="SearchModel[field.Name]"
                                                        placeholder=""
                                                        clearable
                                                        @input="GetDiyTableRow({_PageIndex : 1})"
                                                        style="width:200px;"
                                                        >
                                                        <template slot="prepend"><i class="el-icon-search"></i> {{field.Label}}</template>
                                                    </el-input>
                                                </div>
                                            </span>
                                        </el-row>
                                    </el-col>
                                </el-row> -->
                  <el-button slot="reference" :icon="'el-icon-arrow-down'">
                    {{ $t("Msg.MoreSearch") }}
                  </el-button>
                </el-popover>
              </div>
              <div class="pull-left item-in" v-if="GetCurrentUser._IsAdmin">
                <el-button type="primary" size="mini" class="" icon="el-icon-s-help" @click="$router.push(`/diy/diy-design/${TableId}?PageType=${CurrentDiyTableModel.ReportId ? 'Report' : ''}`)">{{
                  "表单设计"
                }}</el-button>
              </div>
              <div class="pull-left item-in" v-if="GetCurrentUser._IsAdmin">
                <el-button :loading="BtnLoading" type="primary" size="mini" class="" icon="el-icon-s-help" @click="OpenMenuForm()">{{ "模块设计" }}</el-button>
              </div>
            </div>

            <div class="search-outside" style="padding: 10px">
              <!--DIY搜索  【外部】搜索-->
              <DiySearch
                v-if="SearchFieldIds.length > 0 && DiyFieldList.length > 0"
                :ref="'refDiySearch3'"
                :key="'refDiySearch3'"
                :search-field-ids="SearchFieldIds"
                :diy-field-list="DiyFieldList"
                :search-type="'Out'"
                @CallbackGetDiyTableRow="GetDiyTableRow"
                @CallbackSetDiyTableMaxHeight="SetDiyTableMaxHeight"
              ></DiySearch>
            </div>
            <!--DIY表格-->
            <el-table
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
              :lazy="CurrentDiyTableModel.TreeLazy ? true : false"
              :load="DiyTableLoad"
              row-key="Id"
              :tree-props="{ children: '_Child', hasChildren: '_HasChildren' }"
            >
              <el-table-column v-if="TableEnableBatch" type="selection" label="#" width="55"> </el-table-column>
              <!-- <el-table-column
                            type="index"
                            label="序号"
                            width="50" /> -->
              <el-table-column type="index" label="序号" width="50" :index="indexMethod" v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !SysMenuModel.DiyConfig.HiddenIndex"> </el-table-column>
              <template>
                <template v-for="(field, fieldIndex) in ShowDiyFieldList">
                  <el-table-column
                    :key="TypeFieldName + 'table_column_fieldid_' + field.Id"
                    :prop="DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName"
                    :property="DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName"
                    :label="field.Label"
                    :width="DiyCommon.IsNull(field.TableWidth) || fieldIndex == ShowDiyFieldList.length - 1 ? '' : field.TableWidth"
                    :sortable="SortFieldIds.indexOf(field.Id) > -1 ? 'custom' : false"
                    :class-name="'column-' + field.Name"
                    show-overflow-tooltip
                  >
                    <template slot-scope="scope">
                      <!--如果使用了模板引擎-->
                      <template v-if="!DiyCommon.IsNull(field.V8TmpEngineTable) && scope.row[field.Name + '_TmpEngineResult'] !== undefined">
                        <!-- <span v-html="RunFieldTemplateEngine(field, scope.row)"></span> -->
                        <!--liucheng优化模版引擎换行行距太大-->
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
                              :table-row-id="TableRowId"
                              :row-model="scope.row"
                              @RefreshDiyTableRowList="RefreshDiyTableRowList"
                            />
                            <template v-else>
                              <el-tag type="info" class="hand">
                                <i class="fas fa-info-circle"></i>
                                {{ "定制组件" }}
                              </el-tag>
                            </template>
                          </template>
                        </template>
                        <!--如果是子表-->
                        <template v-else-if="field.Component == 'TableChild'">
                          <el-tag type="info" class="hand">
                            <i class="el-icon-s-grid"></i>
                            {{ "查看数据" }}
                          </el-tag>
                        </template>
                        <!--如果是地图-->
                        <template v-else-if="field.Component == 'Map'">
                          <el-tag v-if="DiyCommon.IsNull(scope.row[field.Name + '_Lng'])" @click="OpenDetail(scope.row, 'Edit')" type="info" class="hand">
                            <i class="el-icon-location-outline"></i>
                            {{ "未标注点" }}
                          </el-tag>
                          <el-tag v-else @click="OpenDetail(scope.row, 'View')" type="success" class="hand">
                            <i class="el-icon-location"></i>
                            {{ "查看地图" }}
                          </el-tag>
                        </template>
                        <template v-else-if="field.Component == 'MapArea'">
                          <el-tag v-if="DiyCommon.IsNull(scope.row[field.Name])" @click="OpenDetail(scope.row, 'Edit')" type="info" class="hand">
                            <i class="el-icon-location-outline"></i>
                            {{ "未画区域" }}
                          </el-tag>
                          <el-tag v-else @click="OpenDetail(scope.row, 'View')" type="success" class="hand">
                            <i class="el-icon-location"></i>
                            {{ "查看区域" }}
                          </el-tag>
                        </template>
                        <!--如果是开关  2022-05-18 开关纳入到表内编辑，不再在NeedDiyTemplateFieldLst数据内-->
                        <!-- <template v-else-if="field.Component == 'Switch'">
                                                <el-switch
                                                    :value="scope.row[(DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName)] == true
                                                            || scope.row[(DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName)] == 1 ? true : false"
                                                    :disabled="true"
                                                    active-color="#13ce66"
                                                    inactive-color="#ccc"
                                                    />
                                            </template> -->
                        <template v-else-if="field.Component == 'FontAwesome'">
                          <i :class="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"></i>
                        </template>
                        <template v-else-if="field.Component == 'ImgUpload'">
                          <template>
                            <i
                              class="far fa-images hand"
                              :style="{
                                color: !DiyCommon.IsNull(scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]) ? '#ff6c04' : '#ccc'
                              }"
                            ></i>
                          </template>
                        </template>
                        <!-- <template v-else>
                                                <el-tag
                                                    type="info"
                                                    >
                                                    <i class="fas fa-info-circle"></i>
                                                    {{ '内置组件' }}
                                                </el-tag>
                                            </template> -->
                      </template>
                      <!--如果没有使用模板引擎、也不是默认模板控件-->
                      <template v-else>
                        <!--如果是表内编辑-->
                        <template v-if="SysMenuModel.InTableEdit && SysMenuModel.InTableEditFields.indexOf(field.Id) > -1">
                          <template v-if="field.Component == 'Text'">
                            <DiyInput
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :table-id="TableId"
                              :diy-table-model="CurrentDiyTableModel"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                              @CallbakOnKeyup="
                                (event, field) => {
                                  return FieldOnKeyup(event, field, scope);
                                }
                              "
                            />
                          </template>
                          <template v-else-if="field.Component == 'Textarea'">
                            <DiyTextarea
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :table-id="TableId"
                              :diy-table-model="CurrentDiyTableModel"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                              @CallbakOnKeyup="
                                (event, field) => {
                                  return FieldOnKeyup(event, field, scope);
                                }
                              "
                            />
                          </template>
                          <template v-else-if="field.Component == 'NumberText'">
                            <!-- :readonly-fields="ReadonlyFields" -->
                            <!-- :model.sync="scope.row[field.Name]" -->
                            <DiyInputNumber
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :table-id="TableId"
                              :diy-table-model="CurrentDiyTableModel"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                            />
                          </template>
                          <template v-else-if="field.Component == 'Select' || field.Component == 'MultipleSelect'">
                            <DiySelect
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :table-id="TableId"
                              :diy-field-list="DiyFieldList"
                              :diy-table-model="CurrentDiyTableModel"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                            />
                          </template>
                          <template v-else-if="field.Component == 'Radio'">
                            <DiyRadio
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :table-id="TableId"
                              :diy-field-list="DiyFieldList"
                              :diy-table-model="CurrentDiyTableModel"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                            />
                          </template>
                          <template v-else-if="field.Component == 'Autocomplete'">
                            <DiyAutocomplete
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :table-id="TableId"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                            />
                          </template>
                          <template v-else-if="field.Component == 'Switch'">
                            <DiySwitch
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :table-id="TableId"
                              :diy-table-model="CurrentDiyTableModel"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                            ></DiySwitch>
                          </template>
                          <template v-else-if="field.Component == 'Cascader'">
                            <DiyCascader
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :load-type="'Table'"
                              :table-id="TableId"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                            />
                          </template>
                          <template v-else-if="field.Component == 'SelectTree'">
                            <DiySelectTree
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :table-id="TableId"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                            />
                          </template>
                          <template v-else-if="field.Component == 'Department'">
                            <DiyDepartment
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :load-type="'Table'"
                              :table-id="TableId"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                            />
                          </template>
                          <template v-else-if="field.Component == 'DateTime'">
                            <!-- :readonly-fields="ReadonlyFields" -->
                            <!-- @CallbakOnKeyup="FieldOnKeyup" -->
                            <DiyDateTime
                              v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                              :field="field"
                              :form-diy-table-model="scope.row"
                              :form-mode="TableChildFormMode"
                              :field-readonly="GetFieldIsReadOnly(field)"
                              :table-in-edit="true"
                              :table-id="TableId"
                              :diy-table-model="CurrentDiyTableModel"
                              @CallbackRunV8Code="
                                (field, thisValue) => {
                                  return RunV8Code(field, thisValue, scope.row);
                                }
                              "
                            ></DiyDateTime>
                          </template>
                          <template v-else>
                            <!-- :title="GetColValue(scope, field)" -->
                            <span>{{ GetColValue(scope, field) }}</span>
                          </template>
                        </template>
                        <!--如果不是表内编辑-->
                        <template v-else-if="field.Component == 'Switch'">
                          <el-switch
                            :value="
                              scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName] == true || scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName] == 1 ? true : false
                            "
                            :disabled="true"
                            active-color="#13ce66"
                            inactive-color="#ccc"
                          />
                        </template>
                        <template v-else-if="field.Component == 'Department'">
                          <DiyDepartment
                            v-model="scope.row[DiyCommon.IsNull(field.AsName) ? field.Name : field.AsName]"
                            :field="field"
                            :form-diy-table-model="scope.row"
                            :form-mode="TableChildFormMode"
                            :field-readonly="true"
                            :load-type="'Table'"
                            :table-id="TableId"
                            @CallbackRunV8Code="
                              (field, thisValue) => {
                                return RunV8Code(field, thisValue, scope.row);
                              }
                            "
                          />
                        </template>
                        <template v-else-if="field.Component == 'Rate'">
                          <el-rate v-model="scope.row[field.Name]" :disabled="true" class="marginTop5" />
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
              </template>

              <el-table-column v-if="ColIsDisplay('CreateTime')" :label="$t('Msg.CreateTime')" :sortable="SortFieldIds.indexOf('CreateTime') > -1 ? 'custom' : false" :prop="'CreateTime'" width="150">
                <template slot-scope="scope">
                  <!-- :title="scope.row.CreateTime" -->
                  <span>{{ scope.row.CreateTime }}</span>
                </template>
              </el-table-column>
              <el-table-column v-if="ColIsDisplay('UserName')" :label="$t('Msg.Creator')" :sortable="SortFieldIds.indexOf('UserName') > -1 ? 'custom' : false" :prop="'UserName'" width="110">
                <template slot-scope="scope">
                  <!-- :title="scope.row.UserName" -->
                  <span>{{ scope.row.UserName }}</span>
                </template>
              </el-table-column>
              <el-table-column v-if="ColIsDisplay('UpdateTime')" :label="$t('Msg.UpdateTime')" :sortable="SortFieldIds.indexOf('UpdateTime') > -1 ? 'custom' : false" :prop="'UpdateTime'" width="150">
                <template slot-scope="scope">
                  <!-- :title="scope.row.UpdateTime" -->
                  <span>{{ scope.row.UpdateTime }}</span>
                </template>
              </el-table-column>
              <!--之前是 MaxRowBtnsOut*115 按按钮数量来，现在按文字数量来-->
              <el-table-column :fixed="DosCommon.isMobile ? false : 'right'" :label="$t('Msg.Action')" class="row-last-op" :width="150 + MaxRowBtnsOut">
                <template slot-scope="scope">
                  <!-- <template v-if="scope.row && scope.row._IsInTableAdd == true">
                                    <el-button
                                        size="mini"
                                        icon="el-icon-tickets"
                                        class="marginRight10"
                                        @click="OpenDetail(scope.row, 'View')">
                                        {{ $t('Msg.Save') }}
                                    </el-button>
                                    <el-button
                                        size="mini"
                                        icon="el-icon-close"
                                        @click="CloseIntableAdd(scope.row)">
                                        {{ $t('Msg.Close') }}
                                    </el-button>
                                </template> -->
                  <template>
                    <!-- v-for="(btn, btnIndex) in GetMoreBtnsGroup(true, scope.row)"> -->
                    <template v-for="(btn, btnIndex) in scope.row._RowMoreBtnsOut">
                      <!-- <el-dropdown-item
                                            v-if="LimitMoreBtn(btn, scope.row)"
                                            :key="'more_btn_' + scope.row.Id + btnIndex"
                                            @click.native="RunMoreBtn(btn, scope.row)">
                                            <i :class="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)"></i> {{ btn.Name }}
                                        </el-dropdown-item> -->
                      <!--如果子表是只读，不显示自定义按钮 2021-01-30 TableChild!field.Readonly-->
                      <!-- LimitMoreBtn(btn, scope.row) -->
                      <el-button
                        v-if="btn.IsVisible && !TableChildField.Readonly"
                        :type="GetMoreBtnStyle(btn)"
                        :key="TypeFieldName + 'more_btn_showrowtrue_' + scope.row.Id + btnIndex"
                        size="mini"
                        class="row-more-btns-out"
                        :loading="BtnV8Loading"
                        @click.stop="RunMoreBtn(btn, scope.row)"
                      >
                        <!--修复点击会出现多次图标的bug 2024-11-22 刘诚-->
                        <i :class="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)"></i>{{ btn.Name }}
                      </el-button>
                    </template>
                    <el-button v-if="IsPermission('NoDetail') && scope.row._IsInTableAdd !== true" size="mini" icon="el-icon-tickets" class="marginRight5" @click="OpenDetail(scope.row, 'View')">
                      {{ $t("Msg.Detail") }}
                    </el-button>
                    <!--如果子表是只读，不显示编辑等按钮 2021-01-30 && TableChild!field.Readonly-->
                    <el-dropdown
                      v-if="
                        (TableChildFormMode != 'View' &&
                          !TableChildField.Readonly &&
                          LimitEdit() &&
                          TableChildFormMode != 'View' &&
                          scope.row._IsInTableAdd !== true &&
                          scope.row.IsVisibleEdit == true) ||
                        scope.row._RowMoreBtnsIn.length > 0 ||
                        (LimitDel() && TableChildFormMode != 'View' && scope.row.IsVisibleDel == true)
                      "
                      trigger="click"
                    >
                      <el-button> {{ $t("Msg.More") }}<i class="el-icon-arrow-down el-icon--right" /> </el-button>
                      <!--编辑按钮的显示条件，不同状态下是否可见 2025-3-23刘诚-->
                      <el-dropdown-menu slot="dropdown" class="table-more-btn">
                        <el-dropdown-item
                          v-if="LimitEdit() && TableChildFormMode != 'View' && scope.row._IsInTableAdd !== true && scope.row.IsVisibleEdit == true"
                          icon="el-icon-edit"
                          @click.native="OpenDetail(scope.row, 'Edit')"
                        >
                          {{ $t("Msg.Edit") }}
                        </el-dropdown-item>

                        <!--
                                                !DiyCommon.IsNull(SysMenuModel.DiyConfig)
                                                    && !DiyCommon.IsNull(SysMenuModel.MoreBtns)
                                                    &&
                                                GetMoreBtnsGroup(false, scope.row).length > 0 -->
                        <template v-if="scope.row._RowMoreBtnsIn.length > 0">
                          <template v-for="(btn, btnIndex) in scope.row._RowMoreBtnsIn">
                            <el-dropdown-item v-if="btn.IsVisible" :key="TypeFieldName + 'more_btn_' + scope.row.Id + btnIndex" @click.native="RunMoreBtn(btn, scope.row)">
                              <i :class="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)"></i>
                              {{ btn.Name }}
                            </el-dropdown-item>
                          </template>
                        </template>
                        <!--增加删除等按钮的显示条件，不同状态下是否可见 2025-3-23刘诚-->
                        <el-dropdown-item v-if="LimitDel() && TableChildFormMode != 'View' && scope.row.IsVisibleDel == true" icon="el-icon-delete" divided @click.native="DelDiyTableRow(scope.row)">
                          {{ $t("Msg.Delete") }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </el-dropdown>
                  </template>
                </template>
              </el-table-column>
              <template slot="empty">
                <!-- style="margin-top:-40px;" -->
                <!-- <img :src="require('./img/no-data.svg')" style="width:200px;" /> -->
                <div v-if="!TableChildConfig">
                  <img :src="'./static/img/no-data.svg'" style="width: 200px" />
                </div>
                <!-- style="height:32px;"margin-top:-50px; -->
                <div>{{ tableLoading ? "数据加载中..." : "暂无数据" }}</div>
                <!-- <div style="height:32px;" v-if="!tableLoading">
                                <el-button type="default" @click="GetDiyTableRow">重新加载</el-button>
                            </div> -->
              </template>
            </el-table>

            <el-pagination
              v-if="!TableChildConfig || (TableChildConfig && !TableChildConfig.DisablePagination)"
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
          </el-card>
        </el-col>
      </el-row>
    </el-tabs>

    <!--以弹窗形式打开Form-->
    <el-dialog
      v-if="ShowFieldForm"
      class="diy-form-container"
      v-el-drag-dialog
      :width="GetOpenFormWidth()"
      :modal="true"
      :modal-append-to-body="true"
      :visible.sync="ShowFieldForm"
      :close-on-click-modal="CloseFormNeedConfirm == false"
      :close-on-press-escape="CloseFormNeedConfirm == false"
      :show-close="false"
      :append-to-body="true"
    >
      <div slot="title">
        <div class="pull-left">
          <i :class="GetOpenTitleIcon()" />
          {{ GetOpenTitle() }}
        </div>
        <div class="pull-right">
          <el-dropdown
            v-if="FormMode != 'View' && OpenDiyFormWorkFlowType.WorkType != 'StartWork' && ShowSaveBtn"
            split-button
            type="primary"
            trigger="click"
            class="mr-3"
            @click="SaveDiyTableCommon(true, 'Close')"
          >
            <i :class="BtnLoading ? 'el-icon-loading' : 'el-icon-s-help'"></i>
            <!-- AddClose   UptClose -->
            {{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.Save") : $t("Msg.Save") }}
            <el-dropdown-menu slot="dropdown" class="form-submit-btns">
              <el-dropdown-item
                v-if="ShowFormBottomBtns.SaveAdd"
                :icon="BtnLoading ? 'el-icon-loading' : 'el-icon-s-help'"
                :disabled="BtnLoading"
                @click.native="SaveDiyTableCommon(false, 'Insert')"
                >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddAdd") : $t("Msg.UptAdd") }}</el-dropdown-item
              >
              <el-dropdown-item
                v-if="ShowFormBottomBtns.SaveUpdate"
                :icon="BtnLoading ? 'el-icon-loading' : 'el-icon-s-help'"
                :disabled="BtnLoading"
                @click.native="SaveDiyTableCommon(false, 'Update')"
                >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddUpdate") : $t("Msg.UptUpdate") }}</el-dropdown-item
              >
              <el-dropdown-item v-if="ShowFormBottomBtns.SaveView" :icon="BtnLoading ? 'el-icon-loading' : 'el-icon-s-help'" :disabled="BtnLoading" @click.native="SaveDiyTableCommon(false, 'View')">{{
                FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddView") : $t("Msg.UptView")
              }}</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
          <el-button
            v-if="FormMode == 'View' && LimitEdit() && TableChildFormMode !== 'View' && !TableChildField.Readonly && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
            :loading="BtnLoading"
            size="mini"
            icon="el-icon-edit"
            @click="OpenDetail({ Id: TableRowId }, 'Edit', true)"
            >{{ $t("Msg.Edit") }}</el-button
          >
          <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
            <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns">
              <el-button
                :key="TypeFieldName + 'more_btn_formbtns_' + btnIndex"
                v-if="btn.IsVisible"
                :type="GetMoreBtnStyle(btn)"
                size="mini"
                :loading="BtnLoading"
                @click.native="RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)"
              >
                <i :class="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)"></i>
                {{ btn.Name }}
              </el-button>
            </template>
          </template>
          <!-- 项目同事普遍反应，view里面有这个删除按钮不友好，有时候还容易点错，先隐藏。可在列表删除 2025-05-01刘诚 -->
          <!-- <el-button
            v-if="
              LimitDel() &&
              TableChildFormMode !== 'View' &&
              FormMode != 'Add' &&
              !TableChildField.Readonly &&
              ShowDeleteBtn &&
              OpenDiyFormWorkFlowType.WorkType != 'StartWork'
            "
            :loading="BtnLoading"
            type="danger"
            size="mini"
            icon="el-icon-delete"
            @click="DelDiyTableRow(CurrentRowModel, 'ShowFieldForm')"
            >{{ $t("Msg.Delete") }}</el-button
          > -->
          <el-button size="mini" icon="el-icon-close" @click="CloseFieldForm('ShowFieldForm', 'Close', TableRowId)">{{ $t("Msg.Close") }}</el-button>
        </div>
      </div>
      <div class="clear">
        <div :class="ShowFormRight() ? 'pull-left' : ''" :style="{ width: ShowFormRight() ? 'calc(100% - 280px)' : '100%' }">
          <DiyForm
            ref="fieldForm"
            :form-wf="FormWF"
            :load-mode="''"
            :form-mode="FormMode"
            :table-child-form-mode="TableChildFormMode"
            :table-id="TableId"
            :table-name="CurrentDiyTableModel.Name"
            :table-row-id="TableRowId"
            :default-values="FieldFormDefaultValues"
            :select-fields="FieldFormSelectFields"
            :fixed-tabs="FieldFormFixedTabs"
            :hide-fields="FieldFormHideFields"
            :parent-form="FatherFormModel"
            :parent-v8="ParentV8_Data ? ParentV8_Data : ParentV8"
            :current-table-data="DiyTableRowList"
            :active-diy-table-tab="CurrentTableRowListActiveTab"
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
        <div v-if="ShowFormRight()" class="pull-right" style="width: 260px; background-color: #f5f7fa; height: 100%; padding-left: 15px; padding-right: 15px">
          <el-tabs v-model="FormRightType">
            <el-tab-pane v-if="OpenDiyFormWorkFlow" label="流程信息" name="WorkFlow">
              <WFHistory v-if="OpenDiyFormWorkFlowType.WorkType == 'ViewWork'" ref="refWFHistory"></WFHistory>
              <WFWorkHandler v-if="OpenDiyFormWorkFlowType.WorkType == 'StartWork'" ref="refWfWorkHandler_2" @CallbackStartWork="CallbackStartWork"></WFWorkHandler>
            </el-tab-pane>
            <el-tab-pane v-if="CurrentDiyTableModel.EnableDataLog && isCheckDataLog" label="数据日志" name="DataLog">
              <div class="datalog-timeline">
                <el-timeline style="padding-left: 5px">
                  <el-timeline-item
                    v-for="(item, index) in DataLogList"
                    :key="item.Id"
                    :icon="item.Type == 'Update' ? 'el-icon-edit' : 'el-icon-delete'"
                    :type="'primary'"
                    :color="''"
                    :size="'large'"
                    :timestamp="item.CreateTime"
                  >
                    <div slot="dot">
                      <el-avatar :size="'small'" :src="item.Avatar"></el-avatar>
                    </div>
                    <div>{{ item.Title }}</div>
                    <div v-for="(log, i2) in item.Content" :key="'datalog_content_' + log.Name" style="background-color: #e8f4ff; margin-bottom: 5px; margin-top: 5px">
                      <!-- <el-tag> -->
                      <span style="color: red">{{ log.Label }}</span
                      >： 由 <span style="color: red">{{ log.OVal }}</span> 修改为
                      <span style="color: red">{{ log.NVal }}</span>
                      <!-- </el-tag>     -->
                    </div>
                  </el-timeline-item>
                </el-timeline>
                <div v-if="DataLogListLoading || (!DataLogListLoading && DataLogList.length == 0)" style="height: 50px; line-hegiht: 50px">
                  {{ DataLogListLoading ? "数据加载中..." : "暂无数据" }}
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <!-- <span slot="footer" class="dialog-footer">

        </span> -->
    </el-dialog>

    <!--以抽屉形式打开Form-->
    <el-drawer
      v-if="ShowFieldFormDrawer"
      class="diy-form-container"
      :modal="false"
      :size="GetOpenFormWidth()"
      :modal-append-to-body="true"
      :visible.sync="ShowFieldFormDrawer"
      :close-on-press-escape="CloseFormNeedConfirm == false"
      :wrapperClosable="CloseFormNeedConfirm == false"
      :show-close="false"
      :append-to-body="true"
    >
      <div slot="title">
        <div class="pull-left" style="color: #000; font-size: 15px">
          <i :class="GetOpenTitleIcon()" />
          {{ GetOpenTitle() }}
        </div>
        <div class="pull-right">
          <el-dropdown
            v-if="FormMode != 'View' && OpenDiyFormWorkFlowType.WorkType != 'StartWork' && ShowSaveBtn"
            split-button
            type="primary"
            trigger="click"
            class="mr-3"
            @click="SaveDiyTableCommon(true, 'Close')"
          >
            <i :class="BtnLoading ? 'el-icon-loading' : 'el-icon-s-help'"></i>
            <!-- AddClose   UptClose -->
            {{
              (FormMode == "Add" || FormMode == "Insert" || FormMode == "Insert") && !DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.DiyConfig.SaveBtnText)
                ? SysMenuModel.DiyConfig.SaveBtnText
                : $t("Msg.Save")
            }}
            <!--{{ ((FormMode == 'Add' || FormMode == 'Insert') || FormMode == 'Insert') ? $t('Msg.Save') : $t('Msg.Save') }}-->
            <el-dropdown-menu slot="dropdown" class="form-submit-btns">
              <el-dropdown-item
                v-if="ShowFormBottomBtns.SaveAdd"
                :icon="BtnLoading ? 'el-icon-loading' : 'el-icon-s-help'"
                :disabled="BtnLoading"
                @click.native="SaveDiyTableCommon(false, 'Insert')"
                >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddAdd") : $t("Msg.UptAdd") }}</el-dropdown-item
              >
              <el-dropdown-item
                v-if="ShowFormBottomBtns.SaveUpdate"
                :icon="BtnLoading ? 'el-icon-loading' : 'el-icon-s-help'"
                :disabled="BtnLoading"
                @click.native="SaveDiyTableCommon(false, 'Update')"
                >{{ FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddUpdate") : $t("Msg.UptUpdate") }}</el-dropdown-item
              >
              <el-dropdown-item v-if="ShowFormBottomBtns.SaveView" :icon="BtnLoading ? 'el-icon-loading' : 'el-icon-s-help'" :disabled="BtnLoading" @click.native="SaveDiyTableCommon(false, 'View')">{{
                FormMode == "Add" || FormMode == "Insert" ? $t("Msg.AddView") : $t("Msg.UptView")
              }}</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
          <el-button
            v-if="FormMode == 'View' && LimitEdit() && TableChildFormMode !== 'View' && ShowUpdateBtn && OpenDiyFormWorkFlowType.WorkType != 'StartWork'"
            :loading="BtnLoading"
            size="mini"
            icon="el-icon-edit"
            @click="OpenDetail({ Id: TableRowId }, 'Edit', true)"
            >{{ $t("Msg.Edit") }}</el-button
          >
          <template v-if="!DiyCommon.IsNull(SysMenuModel.DiyConfig) && !DiyCommon.IsNull(SysMenuModel.FormBtns) && SysMenuModel.FormBtns.length > 0">
            <template v-for="(btn, btnIndex) in SysMenuModel.FormBtns">
              <el-button
                :key="TypeFieldName + 'more_btn_formbtns_' + btnIndex"
                v-if="btn.IsVisible"
                :type="GetMoreBtnStyle(btn)"
                size="mini"
                :loading="BtnLoading"
                @click.native="RunMoreBtn(btn, CurrentRowModel, CurrentRowModel._V8)"
              >
                <i :class="'more-btn mr-1 ' + (DiyCommon.IsNull(btn.Icon) ? 'far fa-check-circle' : btn.Icon)"></i>
                {{ btn.Name }}
              </el-button>
            </template>
          </template>
          <!-- 项目同事普遍反应，view里面有这个删除按钮不友好，有时候还容易点错，先隐藏。可在列表删除 2025-05-01刘诚 -->
          <!-- <el-button
            v-if="
              LimitDel() &&
              TableChildFormMode !== 'View' &&
              FormMode != 'Add' &&
              ShowDeleteBtn &&
              OpenDiyFormWorkFlowType.WorkType != 'StartWork'
            "
            :loading="BtnLoading"
            type="danger"
            size="mini"
            icon="el-icon-delete"
            @click="DelDiyTableRow(CurrentRowModel, 'ShowFieldFormDrawer')"
            >{{ $t("Msg.Delete") }}</el-button
          > -->
          <el-button size="mini" icon="el-icon-close" @click="CloseFieldForm('ShowFieldFormDrawer', 'Close', TableRowId)">{{ $t("Msg.Close") }}</el-button>
          <!-- <i class="fas fa-arrows-alt-h pull-right" style="font-size:14px;width:50px;"></i> -->
        </div>
      </div>

      <div class="clear">
        <div :class="ShowFormRight() ? 'pull-left' : ''" :style="{ width: ShowFormRight() ? 'calc(100% - 280px)' : '100%' }">
          <DiyForm
            ref="fieldForm"
            :form-wf="FormWF"
            :load-mode="''"
            :form-mode="FormMode"
            :table-child-form-mode="TableChildFormMode"
            :table-id="TableId"
            :table-name="CurrentDiyTableModel.Name"
            :table-row-id="TableRowId"
            :default-values="FieldFormDefaultValues"
            :select-fields="FieldFormSelectFields"
            :fixed-tabs="FieldFormFixedTabs"
            :hide-fields="FieldFormHideFields"
            :parent-form="FatherFormModel"
            :parent-v8="ParentV8_Data ? ParentV8_Data : ParentV8"
            :current-table-data="DiyTableRowList"
            :active-diy-table-tab="CurrentTableRowListActiveTab"
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
        <div v-if="ShowFormRight()" class="pull-right" style="width: 260px; background-color: #f5f7fa; height: 100%; padding-left: 15px; padding-right: 15px">
          <el-tabs v-model="FormRightType">
            <el-tab-pane v-if="OpenDiyFormWorkFlow" label="流程信息" name="WorkFlow">
              <WFHistory v-if="OpenDiyFormWorkFlowType.WorkType == 'ViewWork'" ref="refWFHistory"></WFHistory>
              <WFWorkHandler v-if="OpenDiyFormWorkFlowType.WorkType == 'StartWork'" ref="refWfWorkHandler_2" @CallbackStartWork="CallbackStartWork"></WFWorkHandler>
            </el-tab-pane>
            <el-tab-pane v-if="CurrentDiyTableModel.EnableDataLog && isCheckDataLog" label="数据日志" name="DataLog">
              <div class="datalog-timeline">
                <el-timeline style="padding-left: 5px">
                  <el-timeline-item
                    v-for="(item, index) in DataLogList"
                    :key="item.Id"
                    :icon="item.Type == 'Update' ? 'el-icon-edit' : 'el-icon-delete'"
                    :type="'primary'"
                    :color="''"
                    :size="'large'"
                    :timestamp="item.CreateTime"
                  >
                    <div slot="dot">
                      <el-avatar :size="'small'" :src="item.Avatar"></el-avatar>
                    </div>
                    <div>{{ item.Title }}</div>
                    <div v-for="(log, i2) in item.Content" :key="'datalog_content_' + log.Name" style="background-color: #e8f4ff; margin-bottom: 5px; margin-top: 5px">
                      <!-- <el-tag> -->
                      <span style="color: red">{{ log.Label }}</span
                      >： 由 <span style="color: red">{{ log.OVal }}</span> 修改为
                      <span style="color: red">{{ log.NVal }}</span>
                      <!-- </el-tag>     -->
                    </div>
                  </el-timeline-item>
                </el-timeline>
                <div v-if="DataLogListLoading" style="height: 50px; line-hegiht: 50px"><i class="el-icon-loading"></i> {{ $t("Msg.Loading") }}</div>
                <div v-if="!DataLogListLoading && DataLogList.length == 0" style="height: 50px; line-hegiht: 50px">
                  {{ $t("Msg.NoMoreData") }}
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
      <!-- <span class="demo-drawer__footer">

        </span> -->
    </el-drawer>

    <!--抽屉或弹窗打开完整的Form-->
    <DiyFormDialog ref="refDiyTable_DiyFormDialog"></DiyFormDialog>

    <!--导入功能-->
    <el-dialog v-el-drag-dialog width="768px" :modal-append-to-body="true" :visible.sync="ShowImport" :close-on-click-modal="true" :modal="false" append-to-body>
      <span slot="title">
        <i :class="DiyCommon.IsNull(CurrentRowModel) || DiyCommon.IsNull(CurrentRowModel.Id) ? 'fas fa-plus' : 'far fa-edit'" />
        {{ $t("Msg.Import") }}
      </span>

      <!--2023-03-08新增：如果是子表导入，自动写入主表Id值-->
      <el-upload
        class="upload-drag-style"
        :action="GetImportApi()"
        :data="GetUploadData()"
        :headers="{ authorization: 'Bearer ' + DiyCommon.Authorization() }"
        :show-file-list="false"
        :on-success="
          (result, file, fileList) => {
            return ImportUploadSuccess(result, file, fileList);
          }
        "
        :before-upload="ImportDiyTableRowBefore"
        drag
      >
        <i class="el-icon-upload" />
        <div class="el-upload__text">{{ $t("Msg.UploadDesc") }}</div>
        <div slot="tip" class="el-upload__tip">只能上传.xls/.xlsx文件</div>
      </el-upload>

      <div class="marginTop10 marginBottom10">
        <el-button icon="el-icon-refresh-right" @click="GetImportDiyTableRowStep"> 查看进度（可多次点击查看） </el-button>
        <el-tooltip v-if="GetCurrentUser._IsAdmin" class="item" effect="dark" content="清除后可强制重新开始导入，此功能谨慎使用，只适合在长时间进度卡住不动的情况下使用。" placement="top">
          <el-button icon="el-icon-warning" @click="DelImportDiyTableRowStep"> 清除导入进度缓存 </el-button>
        </el-tooltip>
      </div>
      <div class="">
        <div v-for="(m, index) in ImportStepList" :key="TypeFieldName + 'importStep_' + index" style="color: red">
          {{ m }}
        </div>
        <div v-if="ImportStepList.length == 0" style="color: red">暂无进度</div>
      </div>

      <span slot="footer" class="dialog-footer">
        <!-- <el-button
                type="primary"
                size="mini"
                icon="el-icon-s-help"
                @click="SaveDiyTableCommon">{{$t('Msg.Import')}}</el-button> -->
        <el-button size="mini" icon="el-icon-close" @click="ShowImport = false">{{ $t("Msg.Close") }}</el-button>
      </span>
    </el-dialog>
    <DiyModule :modal="!IsTableChild()" ref="refDiyModule"></DiyModule>
    <!-- :data-append="GetDiyCustomDialogDataAppend()" -->
    <!-- :visible="DiyCustomDialogConfig.Visible" -->
    <DiyCustomDialog
      :data-append="GetDiyCustomDialogDataAppend()"
      :open-type="DiyCustomDialogConfig.OpenType"
      :title="DiyCustomDialogConfig.Title"
      :title-icon="DiyCustomDialogConfig.TitleIcon"
      :width="DiyCustomDialogConfig.Width"
      :component-name="DiyCustomDialogConfig.ComponentName"
      :component-path="DiyCustomDialogConfig.ComponentPath"
      ref="refDiyCustomDialog"
    ></DiyCustomDialog>

    <el-dialog
      v-if="ShowAnyTable"
      v-el-drag-dialog
      :modal="true"
      :width="'80%'"
      :modal-append-to-body="true"
      :append-to-body="true"
      :visible.sync="ShowAnyTable"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :destroy-on-close="true"
      :show-close="false"
      class="dialog-opentable"
    >
      <div slot="title">
        <div class="pull-left" style="color: rgb(0, 0, 0); font-size: 15px">
          <i :class="'fas fa-table'" />
          弹出表格
        </div>
        <div class="pull-right">
          <el-button :loading="BtnLoading" type="primary" size="mini" icon="far fa-check-circle" @click="RunOpenAnyTableSubmitEvent()">
            {{ $t("Msg.Submit") }}
          </el-button>
          <el-button size="mini" icon="el-icon-close" @click="ShowAnyTable = false">
            {{ $t("Msg.Close") }}
          </el-button>
        </div>
        <div class="clear"></div>
      </div>
      <!--
        :props-table-id="OpenAnyTableParam.TableId"
        :props-table-name="OpenAnyTableParam.TableName"
         -->
      <div class="clear">
        <DiyTable
          :type-field-name="OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey"
          :ref="'refOpenAnyTable_' + (OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey)"
          :key="'refOpenAnyTable_' + (OpenAnyTableParam.SysMenuId || OpenAnyTableParam.ModuleEngineKey)"
          :props-table-type="'OpenTable'"
          :props-sys-menu-id="OpenAnyTableParam.SysMenuId"
          :props-module-engine-key="OpenAnyTableParam.ModuleEngineKey"
          :enable-multiple-select="OpenAnyTableParam.MultipleSelect"
          :props-where="OpenAnyTableParam.PropsWhere"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import Vue from "vue";
import elDragDialog from "@/directive/el-drag-dialog";
import _ from "underscore";
import { mapState, mapMutations, mapGetters } from "vuex";
import { Base64 } from "js-base64";
import PanThumb from "@/components/PanThumb";
import DiyInput from "./diy-field-component/diy-input";
import DiySelect from "./diy-field-component/diy-select";
import DiyRadio from "./diy-field-component/diy-radio";
import DiyInputNumber from "./diy-field-component/diy-input-number";
import DiySwitch from "@/views/diy/diy-field-component/diy-switch";
import DiyAutocomplete from "@/views/diy/diy-field-component/diy-autocomplete";
import DiyCascader from "@/views/diy/diy-field-component/diy-cascader";
import DiySelectTree from "@/views/diy/diy-field-component/diy-select-tree";
import DiyDepartment from "@/views/diy/diy-field-component/diy-department";
import DiyDateTime from "@/views/diy/diy-field-component/diy-datetime";
import DiyTextarea from "@/views/diy/diy-field-component/diy-textarea";
import DiyModule from "@/views/diy/diy-module";
import DiyFormDialog from "@/views/diy/diy-form-dialog";
import DiyCustomDialog from "@/views/diy/diy-custom-dialog";
import DiySearch from "@/views/diy/diy-search";
// import DiySearch from "@/views/diy/diy-search-v2";
// import { forEach } from 'jszip/lib/object'
export default {
  // name: 'diy-table-rowlist',
  directives: {
    elDragDialog
  },
  components: {
    PanThumb,
    //注意：如果这里是require('@/views/diy/field-form.vue')， 就访问不到DiyForm的ref
    // DiyForm: () => import('@/views/diy/field-form.vue'),
    //注意：这种require就可以访问到DiyForm的ref
    DiyForm: (resolve) => require(["@/views/diy/diy-form"], resolve),
    DiyTable: (resolve) => require(["./diy-table-rowlist"], resolve),
    DiyInput,
    DiySelect,
    DiyRadio,
    DiyInputNumber,
    DiySwitch,
    DiyAutocomplete,
    DiyCascader,
    DiySelectTree,
    DiyDepartment,
    DiyDateTime,
    DiyTextarea,
    DiyModule,
    DiyFormDialog,
    DiyCustomDialog,
    DiySearch
  },
  // beforeDestroy() {
  //   // ...
  //   this.ShowFieldFormDrawer = false;
  //   this.ShowFieldForm = false;
  // },
  computed: {
    GetCurrentUser: function () {
      return this.$store.getters["DiyStore/GetCurrentUser"];
    },
    ...mapGetters({}),
    ...mapState({
      SysConfig: (state) => state.DiyStore.SysConfig
    }),
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
                self.$set(self.SearchNumber, field.Name, { Min: "", Max: "" });
              }

              //如果是多选框搜索。但如果勾选了【下拉】，这时候就不能返回了
              if (type == "Checkbox" && Array.isArray(field.Data) && field.Data.length > 0 && field.Config.DataSourceSqlRemote !== true && id.DisplaySelect !== true) {
                if (self.DiyCommon.IsNull(self.SearchCheckbox[field.Name])) {
                  // self.SearchModel[field.Name] = [];
                  self.$set(self.SearchCheckbox, field.Name, []);
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
    TypeFieldName: {
      type: String,
      default: ""
    },
    //OpenTable、JoinTable、TableChild
    PropsTableType: {
      type: String,
      default: ""
    },
    //追加全能搜索条件：[{FieldName:'xxx',Value:'xx',Type:'='}]   Type可以的值：Equal、Like、In
    PropsWhere: {
      type: Array,
      default() {
        return [];
      }
    },
    PropsIsJoinTable: {
      type: Boolean,
      default: false
    },
    ContainerClass: {
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
    JoinTableField: {
      type: Object,
      default() {
        return {};
      }
    },
    PropsTableId: {
      type: String,
      default: ""
    },
    //子表的DiyTableId
    TableChildTableId: {
      type: String,
      default: ""
    },
    //子表模块配置Id
    TableChildSysMenuId: {
      type: String,
      default: ""
    },
    PropsSysMenuId: {
      type: String,
      default: ""
    },
    PropsModuleEngineKey: {
      type: String,
      default: ""
    },
    TableChildConfig: {
      type: Object,
      default() {
        return null;
      }
    },
    //
    TableChildFkFieldName: {
      type: String,
      default: ""
    },
    PrimaryTableFieldName: {
      type: String,
      default: "Id"
    },
    //
    TableChildCallbackField: {
      type: String,
      default: ""
    },
    // TableChildFkValue:{
    //     type: String,
    //     default: ''
    // },
    TableChildTableRowId: {
      type: String,
      default: ""
    },
    //父表的model
    FatherFormModel: {
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
    TableChildFormMode: {
      type: String,
      default: ""
    },
    //子表数据，由DiyForm传进来，会直接赋值到Table表格
    TableChildData: {
      type: Array,
      default() {
        return [];
      }
    },
    //追加搜索条件.{'FieldName' : value, 'FieldName': value}
    SearchAppend: {
      type: Object,
      default() {
        return {};
      }
    },
    // //设置搜索条件.{'FieldName' : value, 'FieldName': value}
    // SearchSet:{
    //     type: Object,
    //     default() {
    //         return {}
    //     }
    // },
    //父级的所有字段对象
    PropsParentFieldList: {
      type: Object,
      default() {
        return {};
      }
    },
    EnableMultipleSelect: {
      type: Boolean,
      default() {
        return false;
      }
    },
    // {FieldName1:value , FieldName2:value}
    FormDefaultValues: {
      type: Object,
      default() {
        return {};
      }
    },
    ParentFormLoadFinish: {
      type: Boolean,
      default() {
        return null;
      }
    },
    /**
     * 加载模式：可能是Design（表单设计）
     */
    LoadMode: {
      type: String,
      default: ""
    }
  },
  watch: {
    PropsWhere: function (newVal, oldVal) {
      var self = this;
      if (!_.isEqual(newVal, oldVal)) {
        self.Init();
      }
    },
    ParentFormLoadFinish: function (newVal, oldVal) {
      var self = this;
      if (newVal === true) {
        self.Init();
      }
    },
    TableChildSysMenuId: function (newVal, oldVal) {
      var self = this;
      if (self.ParentFormLoadFinish !== false) {
        //如果在设计的时候切换了模块，也要重新加载
        self.Init();
      }
    },
    TableChildFkFieldName: function (newVal, oldVal) {
      var self = this;
      if (self.ParentFormLoadFinish !== false) {
        self.Init();
      }
    },
    PrimaryTableFieldName: function (newVal, oldVal) {
      var self = this;
      if (self.ParentFormLoadFinish !== false) {
        self.Init();
      }
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
    //当此控件为子表时，父form关闭弹层时，这个值会变成'‘空值，也会再一次执行这里的watch
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
      ShowAnyTable: false,
      OpenAnyTableParam: {},
      Where: [],
      PageType: "", //=Report时为报表
      DataLogListLoading: true,
      DataLogList: [],
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
      _OrderBy: "",
      _OrderByType: "",
      SearchFieldIds: [], // SearchFieldIds
      SortFieldIds: [],
      NotShowFields: [],
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
      IsVisibleAdd: true //是否允许新增按钮显示,2025-5-1刘诚（某些条件下不允许新增，代码控制）
    };
  },
  mounted() {
    var self = this;
    self.PageType = self.$route.query.PageType;
    if (self.ParentFormLoadFinish !== false) {
      self.Init();
    }
  },
  async created() {
    var self = this;
  },
  methods: {
    indexMethod(index) {
      var self = this;
      if (self.SysMenuModel.TableIndexAdditive) {
        return (self.DiyTableRowPageIndex - 1) * self.DiyTableRowPageSize + index + 1;
      }
      return index + 1;
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
      return false;
    },
    //可传入外键Id值 、父表model
    async Init(parentFormModel, v8) {
      var self = this;

      if (self.IsTableChild()) {
      }
      var queryKeyword = self.$route.query.Keyword;

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
      if (self.PropsModuleEngineKey) {
        var sysMenuResult = await self.DiyCommon.FormEngine.GetFormData({
          FormEngineKey: "sys_menu",
          _Where: [
            {
              Name: "ModuleEngineKey",
              Value: self.PropsModuleEngineKey,
              Type: "="
            }
          ]
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
        var sysMenuResult = await self.DiyCommon.FormEngine.GetFormData({
          FormEngineKey: "sys_menu",
          Id: self.SysMenuId
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
        var cacheDiyTableRowPageSize = localStorage.getItem("DiyTableRowPageSize_" + self.TableId);
        if (!self.DiyCommon.IsNull(cacheDiyTableRowPageSize)) {
          self.DiyTableRowPageSize = Number(cacheDiyTableRowPageSize);
        }
      } catch (error) {
        self.DiyTableRowPageSize = 10;
      }
      //这里修改，应该是先取SysMenuModel，再取DiyTableRow数据，因为SysMenuModel可能包含Tabs设置的条件
      self.GetAllData();

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
        var V8 = {
          KeyCode: keyCode,
          EventName: "FieldOnKeyup",
          RowIndex: scope.$index,
          Field: field,
          Form: scope.row,
          Row: scope.row,
          EventName: "TableFieldOnKeyup",
          Rows: self.DiyTableRowList,
          SetCurrentRow: self.DiyTableSetCurrentRow
        };
        self.SetV8DefaultValue(V8);
        await self.DiyCommon.InitV8Code(V8, self.$router);
        try {
          // eval(field.KeyupV8Code)
          await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + field.KeyupV8Code + " \n})()");
        } catch (error) {
          self.DiyCommon.Tips("执行按键事件V8引擎代码出现错误：" + error.message, false);
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
        result["_RowModel"] = {};
        if (!self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
          if (self.PrimaryTableFieldName) {
            result["_RowModel"][self.TableChildFkFieldName] = self.FatherFormModel_Data[self.PrimaryTableFieldName];
          } else {
            result["_RowModel"][self.TableChildFkFieldName] = self.FatherFormModel_Data.Id;
          }
        } else {
          result["_RowModel"][self.TableChildFkFieldName] = self.TableChildTableRowId;
        }
        //由于此upload组件不支持给_RowModel传入object，所以临时使用_FieldId字段
        // result['_RowModel'] = JSON.stringify(result['_RowModel']);
        result["_FieldId"] = JSON.stringify(result["_RowModel"]);
        delete result["_RowModel"];
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
      result.V8 = self.GetCommonV8();
      result.V8["CloseThisDialog"] = self.CloseThisDialog;
      return result;
    },
    CloseThisDialog() {
      var self = this;
      self.$refs.refDiyCustomDialog.Close();
    },
    GetCommonV8() {
      var self = this;
      var V8 = {};
      //以下2句会导致死循环，why?
      // self.FormWF = self.GetFormWF();
      // V8.FormWF = self.FormWF;

      V8.Form = self.CurrentSelectedRowModel;
      (V8.FormSet = (fieldName, value) => {
        return self.FormSet(fieldName, value, self.CurrentSelectedRowModel);
      }), // 给Form表单其它字段赋值
        (V8.TableId = self.TableId);
      V8.TableName = self.CurrentDiyTableModel.Name;
      V8.TableModel = self.CurrentDiyTableModel;
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
      V8.SearchSet = self.SearchSetFunc;
      V8.SetV8SearchModel = self.SetV8SearchModel;
      var diyFieldList = {};
      self.DiyFieldList.forEach((element) => {
        diyFieldList[element.Name] = element;
      });
      V8.Field = diyFieldList;
      V8.ShowTableChildHideField = self.ShowTableChildHideField;
      V8.FieldSet = self.FieldSet;
      V8.CurrentTableData = self.DiyTableRowList;
      return V8;
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

      resolve(data);
    },
    OpenMenuForm() {
      var self = this;
      if (self.SysMenuModel.Id) {
        self.BtnLoading = true;
        try {
          self.$refs.refDiyModule.Init(self.SysMenuModel.Id, function () {
            self.BtnLoading = false;
          });
        } catch (error) {
          self.BtnLoading = false;
        }
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
      return true;
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
      if (self.IsTableChild() && self.TableSelectedRow.Id && self.TableSelectedRow.Id != self.TableSelectedRowLast.Id) {
        // 判断需要执行的V8
        self.TableSelectedRowLast = { ...self.TableSelectedRow };
        if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.InFormV8)) {
          var V8 = {};
          V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
          // V8.Form = row;
          V8.FormSet = (fieldName, value) => {
            return self.FormSet(fieldName, value, row);
          }; // 给Form表单其它字段赋值
          V8.EventName = "FormIn";
          self.SetV8DefaultValue(V8);
          await self.DiyCommon.InitV8Code(V8, self.$router);
          try {
            // eval(self.DiyTableModel.InFormV8)
            await eval(
              //"//" + field.Name + "(" + field.Label + ")" +
              "(async () => {\n " + self.CurrentDiyTableModel.InFormV8 + " \n})()"
            );
          } catch (error) {
            self.DiyCommon.Tips(`执行V8引擎代码出现错误[${self.CurrentDiyTableModel.Name}-InFormV8]：` + error.message, false);
            console.log(`执行V8引擎代码出现错误[${self.CurrentDiyTableModel.Name}-InFormV8]：`, error, self.CurrentDiyTableModel, Base64);
          }
        }
      }

      //把这列对应的fieldModel查询出来，其实就是TableChildField，props传过来的
      // var V8 = v8 ? v8 : {};
      var V8 = {};
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
          await self.DiyCommon.InitV8Code(V8, self.$router);
          V8.RefreshChildTable = (field, parentFormModel) => {
            return self.RefreshChildTable(field, parentFormModel, V8);
          };
          // eval(btn.V8Code)
          await eval("(async () => {\n " + self.TableChildField.Config.TableChildRowClickV8 + " \n})()");
        } else {
          //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
        }
      } catch (error) {
        self.DiyCommon.Tips("执行V8引擎代码出现错误[" + self.TableChildField.Name + "," + self.TableChildField.Label + "]：" + error.message, false);
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
    GetAllData() {
      var self = this;
      var params = [
        {
          // Url: self.DiyApi.GetSysMenuModel,
          Url: self.DiyApi.FormEngine.GetFormData + "-sysmenu",
          Param: {
            FormEngineKey: "Sys_Menu",
            Id: self.SysMenuId
          }
        },
        {
          // Url: DiyApi.GetDiyTableModel,
          Url: self.DiyApi.FormEngine.GetFormData + "-diytable",
          Param: {
            Id: self.TableId,
            FormEngineKey: "Diy_Table"
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
          self.GetDiyTableRow({ _PageIndex: 1 });
        }
      });
      // self.GetSysMenuModel();
      // self.GetDiyTableModel()
      // self.GetDiyField()
    },
    GetDiyTableMaxHeight() {
      var self = this;
      if (self.IsTableChild() || self.PropsIsJoinTable === true || self.PropsTableType == "OpenTable") {
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
      if (!self.IsTableChild()) {
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
      var result = self.DiyCommon.IsNull(self.CurrentDiyTableModel.FormOpenWidth) ? "768px" : self.CurrentDiyTableModel.FormOpenWidth;
      return result;
    },
    async RunV8Code(field, thisValue, row) {
      var self = this;
      var V8 = {};
      try {
        if (!self.DiyCommon.IsNull(field) && !self.DiyCommon.IsNull(field.Config) && !self.DiyCommon.IsNull(field.Config.V8Code)) {
          var form = { ...row };
          V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
          // V8.Form = row;
          V8.ThisValue = thisValue;
          V8.FormSet = (fieldName, value) => {
            return self.FormSet(fieldName, value, row);
          }; // 给Form表单其它字段赋值
          V8.RefreshChildTable = self.RefreshChildTable;
          V8.EventName = "FieldValueChange";
          self.SetV8DefaultValue(V8, field);
          await self.DiyCommon.InitV8Code(V8, self.$router);
          // eval(btn.V8Code)
          await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + field.Config.V8Code + " \n})()");
        } else {
          //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
        }
      } catch (error) {
        self.DiyCommon.Tips("执行V8引擎代码出现错误[" + field.Name + "," + field.Label + "]：" + error.message, false);
      }
    },
    //showRow:是否行外显示按钮，而不是更多里面
    //2021-09-02修改：提前计算出按钮分组，别临时计算
    // GetMoreBtnsGroup(showRow, row){
    //     var self = this;
    //     var arr = _.where(self.SysMenuModel.MoreBtns, { ShowRow : showRow});
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
      var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, {
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
      var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, {
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
      var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, {
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
      var roleLimitModel = _.where(self.GetCurrentUser._RoleLimits, {
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
    //这里之所以需要一个HandlerBtns，是因为v-if不支持async LimitMoreBtn，需要提前将结果计算出来放到属性中去
    async HandlerBtns(btns, row, v8) {
      var self = this;
      if (btns) {
        if (self.DiyCommon.IsNull(row)) {
          row = {};
        }
        //2022-07-11暂时注释，换成for处理
        // // btns.forEach(async (btn) => {
        // await btns.forEach(async (btn) => {
        //     //这里需要暂存一下参数，相同的参数，没必要多次执行，否则会请求几百次接口
        //     //但需要在
        //     // if (!(self.TempBtnIsVisible.indexOf(btn.Id + row.Id) > -1)) {
        //     //     self.TempBtnIsVisible.push(btn.Id + row.Id);
        //         // var isVisible = await self.LimitMoreBtn(btn, row);
        //         var isVisible = await self.LimitMoreBtn(btn, row, v8);
        //         btn.IsVisible = isVisible;
        //         // self.$set(btn, 'IsVisible', isVisible);
        //     // }
        // });
        for (let index = 0; index < btns.length; index++) {
          var btn = btns[index];
          var isVisible = await self.LimitMoreBtn(btn, row, v8);
          btn.IsVisible = isVisible;
        }
      }
    },
    DeleteFormProperty(form) {
      Reflect.deleteProperty(form, "_RowMoreBtnsOut");
      Reflect.deleteProperty(form, "_RowMoreBtnsIn");
      return form;
    },
    //LimitMoreBtn取消了async await支持，跟每行数据的模板引擎一样，禁止使用await
    async LimitMoreBtn(btn, row, v8) {
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
            var form = { ...row };
            V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
            // V8.Form = row; // 当前Form表单所有字段值
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
          V8.EventName = "V8BtnLimit";
          self.SetV8DefaultValue(V8);
          await self.DiyCommon.InitV8Code(V8, self.$router);
          // eval(btn.V8CodeShow)
          await eval("//" + btn.Name + "(按钮显示条件)" + "\n(async () => {\n " + btn.V8CodeShow + " \n})()");
        } else {
          //self.DiyCommon.Tips('请配置按钮V8引擎代码！', false);
        }
      } catch (error) {
        self.DiyCommon.Tips("执行V8引擎代码出现错误[" + (btn.Name ? btn.Name : "") + "(显示条件)]：" + error.message, false);
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
      return false; //2022-07-11 这里应该默认是true？为什么后面发现是false？
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
          V8.EventName = "V8BtnRun";
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
        self.DiyCommon.Tips("执行V8引擎代码出现错误：" + error.message, false);
        self.BtnV8Loading = false;
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
    OpenAnyTable(param) {
      var self = this;
      if (!param.SysMenuId && !param.ModuleEngineKey) {
        self.DiyCommon.Tips("SysMenuId或ModuleEngineKey必传！", false);
        return;
      }
      self.OpenAnyTableParam = param;
      self.ShowAnyTable = true;
    },
    RunOpenAnyTableSubmitEvent() {
      var self = this;
      //传入已选择的数据
      var selectData = self.$refs["refOpenAnyTable_" + (self.OpenAnyTableParam.SysMenuId || self.OpenAnyTableParam.ModuleEngineKey)].TableMultipleSelection;
      self.OpenAnyTableParam.SubmitEvent(selectData, function () {
        self.ShowAnyTable = false;
      });
    },
    SetV8DefaultValue(V8, field) {
      var self = this;
      V8.ClientType = "PC"; //PC、IOS、Android、H5、WeChat
      V8.OpenAnyForm = self.OpenAnyForm;
      V8.OpenAnyTable = self.OpenAnyTable;
      V8.OpenDialog = self.OpenDialog;
      self.FormWF = self.GetFormWF();
      V8.FormWF = self.FormWF;
      V8.TableId = self.TableId;
      V8.TableName = self.CurrentDiyTableModel.Name;
      V8.TableModel = self.CurrentDiyTableModel;
      V8.CurrentUser = self.GetCurrentUser;
      V8.HideFormBtn = self.CallbackHideFormBtn;
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
      V8.SearchSet = self.SearchSetFunc;
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
      self.$set(row, fieldName, value); // 0
    },
    FieldSet(fieldName, attrName, value) {
      var self = this;
      // 先查找出Field对象
      self.DiyFieldList.forEach((element) => {
        if (element.Name == fieldName) {
          self.$set(element, attrName, value);
        }
      });
    },
    GetImportApi() {
      var self = this;
      if (!self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig) && !self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig.ImportApi)) {
        return self.SysMenuModel.DiyConfig.ImportApi;
      }
      return self.DiyCommon.GetApiBase() + "/api/diytable/ImportDiyTableRow";
    },
    GetImportProgressApi() {
      var self = this;
      if (!self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig) && !self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig.ImportProgressApi)) {
        return self.SysMenuModel.DiyConfig.ImportProgressApi;
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
      console.log("detail", detail);
      if (!detail) {
        return;
      }
      if (!self.SysMenuModel.InTableEdit) {
        self.OpenDetail(row, "View");
      }
    },
    TableRowSelectionChange(val) {
      var self = this;
      self.TableMultipleSelection = val;
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
      var tabModel = self.SysMenuModel.PageTabs[parseInt(tab.index)];
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
      var V8 = {
        // Form: rowModel, // 当前Form表单所有字段值
        // FormSet: self.FormSet, // 给Form表单其它字段赋值
        // FormSet: (fieldName, value) => { return self.FormSet(fieldName, value, row)}, // 给Form表单其它字段赋值
        // ThisValue : self.DiyCommon.IsNull(thisValue) ? '' : thisValue,//这个是Select控制选择后的回调对象
        // Field : field,
        // FieldSet: self.FieldSet,
        // FormSubmitAction: actionType,
        GetDiyTableRow: self.GetDiyTableRow,
        EventName: "PageTab"
      };
      self.SetV8DefaultValue(V8);
      var v8Result = await self.DiyCommon.InitV8Code(V8, self.$router);
      // if (!self.DiyCommon.IsNull(self.TableRowId)) {
      //     V8.Form.Id = self.TableRowId;
      // }
      try {
        // eval(tabModel.V8Code)
        // eval(v8code)
        await eval("(async () => {\n " + v8code + " \n})()");
      } catch (error) {
        self.DiyCommon.Tips("执行多Tab页签V8引擎代码出现错误：" + error.message, false);
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
        self.V8SearchModel = val;
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
    async RunFieldTemplateEngine(field, row) {
      var self = this;
      var V8 = {
        Result: "",
        Field: field,
        Form: row,
        Row: row,
        EventName: "TableTemplateEngine"
      };
      self.SetV8DefaultValue(V8);
      await self.DiyCommon.InitV8Code(V8, self.$router);
      try {
        // eval(field.V8TmpEngineTable);
        await eval("(async () => {\n " + field.V8TmpEngineTable + " \n})()");
        if (self.DiyCommon.IsNull(V8.Result) && V8.Result != "") {
          //注意有时候确实是在v8中设置返回了空字符串
          return self.GetColValue({ row: row }, field);
        }
        return V8.Result;
        // return self.RunFieldTemplateEnginePromise(V8, field.V8TmpEngineTable);
      } catch (error) {
        // return error.message;
        self.DiyCommon.Tips("执行V8模板引擎代码出现错误[" + field.Name + "," + field.Label + "]：" + error.message, false);
      }
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
          var search2 = _.where(self.SysMenuModel.SelectFields, {
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

            // console.log('渲染定制组件：' + field.Config.DevComponentName + '[' + field.Config.DevComponentPath + ']');
            //注意：'@/views' 会被编译，不能由服务器传过来
            var component = (resolve) => require(["@/views" + field.Config.DevComponentPath], resolve);
            Vue.component(field.Config.DevComponentName, component);
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
    GetDiyTableModel() {
      var self = this;
      var param = {
        FormEngineKey: "Diy_Table",
        Id: self.TableId
        // OsClient: self.OsClient
      };
      // self.DiyCommon.Post(DiyApi.GetDiyTableModel, param, function (result) {
      self.DiyCommon.Post(self.DiyApi.FormEngine.GetFormData + "-diytable", param, function (result) {
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
    ImportDiyTableRowBefore(file) {
      var self = this;
      self.DiyCommon.Tips("正在导入！请点击查看进度按钮！");
      setTimeout(self.GetImportDiyTableRowStep, 1000);
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
      localStorage.setItem("DiyTableRowPageSize_" + self.TableId, val);
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
      var url = self.DiyCommon.GetApiBase() + "/api/diytable/ExportDiyTableRow";
      var paramType = '';
      if (!self.DiyCommon.IsNull(self.SysMenuModel.DiyConfig.ExportApi)) {
        url = self.SysMenuModel.DiyConfig.ExportApi;
        paramType = 'json';
      }

      if (!self.DiyCommon.IsNull(btn) && !self.DiyCommon.IsNull(btn.Url)) {
        url = btn.Url;
      }
      var param = {
        TableId: self.TableId,
        //2020-12-07-注意：目前只有导出接口不支持token验证，所以导出接口需要加入[AllowAnonymous]特性，并且手动指定OsClient或_CurrentSysUser
        OsClient: self.$store.state.DiyStore.OsClient, //self.OsClient,
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
      param._TableRowSelected = self.TableRowSelected;

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
        self.SysMenuModel.Name, paramType
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
          debugger;

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
      }
    },
    async OpenDetailHandler(tableRowModel, formMode, isDefaultOpen, isOpenWorkFlowForm, wfParam) {
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
        self.FieldFormSelectFields = [];
        self.FieldFormFixedTabs = [];
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
          self.$nextTick(function () {
            //2023-08-07新增200延时，否则可能会获取不到fieldForm对象。
            setTimeout(function () {
              self.CloseFormNeedConfirm = false;
              if (self.$refs.fieldForm) {
                self.$refs.fieldForm.Init(true, async function (callbackValue) {
                  if (callbackValue && callbackValue.CurrentRowModel) {
                    self.CurrentRowModel = callbackValue.CurrentRowModel;
                    var V8 = callbackValue.V8;
                    await self.HandlerBtns(self.SysMenuModel.FormBtns, self.CurrentRowModel, V8);
                  }
                  self.BtnLoading = false;
                });
              } else {
                self.BtnLoading = false;
              }
              if (isOpenWorkFlowForm == true) {
                if (self.DiyCommon.IsNull(wfParam)) {
                  wfParam = { WorkType: "ViewWork" };
                }
                wfParam.FormMode = formMode;
                self.InitWorkFlow(wfParam);
              }
            }, 200);
          });
        } else {
          self.ShowFieldFormDrawer = true;
          // 0.2s后再加载，否则低配客户端滑动时可能会卡顿
          self.$nextTick(function () {
            setTimeout(function () {
              if (self.$refs.fieldForm) {
                self.CloseFormNeedConfirm = false;
                self.$refs.fieldForm.Init(true, async function (callbackValue) {
                  if (callbackValue && callbackValue.CurrentRowModel) {
                    self.CurrentRowModel = callbackValue.CurrentRowModel;
                    var V8 = callbackValue.V8;
                    await self.HandlerBtns(self.SysMenuModel.FormBtns, self.CurrentRowModel, V8);
                  }
                  self.BtnLoading = false;
                });
              } else {
                self.BtnLoading = false;
              }
              if (isOpenWorkFlowForm == true) {
                if (self.DiyCommon.IsNull(wfParam)) {
                  wfParam = { WorkType: "ViewWork" };
                }
                wfParam.FormMode = formMode;
                self.InitWorkFlow(wfParam);
              }
            }, 200);
          });
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
      await self.HandlerBtns(result.Data.PageBtns);
      //注意：表单按钮，一定要先打开表单后再进行判断IsVisible
      // self.HandlerBtns(result.Data.FormBtns);
      await self.HandlerBtns(result.Data.PageTabs);
      await self.HandlerBtns(result.Data.BatchSelectMoreBtns);
      if (result.Data.BatchSelectMoreBtns.length > 0) {
        self.TableEnableBatch = true;
      }
      await self.HandlerBtns(result.Data.ExportMoreBtns);
      // result.Data.PageBtns.forEach(element => {
      // });

      //-------GetPageTabs()提前预生成
      if (!self.DiyCommon.IsNull(result.Data.DiyConfig) && !self.DiyCommon.IsNull(result.Data.PageTabs) && result.Data.PageTabs.length > 0) {
        //url带上tab参数，  2022-06-01
        var queryTab = self.$route.query.Tab;
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

        //TableRowListActiveTab 虽然给的默认是空'',但实际上是‘0’，为啥 ？
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
      console.log("formParam", formParam);
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
      if (self.TableDiyFieldIds != null) {
        if (self.TableDiyFieldIds.length > 0 && self.DiyFieldList.length > 0) {
          var tempArr = [];
          var index = 0;
          self.TableDiyFieldIds.forEach((element) => {
            var search1 = _.where(self.DiyFieldList, {
              Id: element
            });

            //注意：!(self.FixedNotShowField.indexOf(element.Component) > -1)  这条判断没用，因为element就是Id，取不到element.Component
            //2021-10-26 新增排序 ShowHideFieldsList
            if (
              search1.length > 0 &&
              !(self.FixedNotShowField.indexOf(element.Component) > -1) &&
              (!(self.NotShowFields.indexOf(element) > -1 || self.NotShowFields.indexOf(element.Name) > -1 || self.NotShowFields.indexOf(element.Id) > -1) ||
                self.ShowHideFieldsList.indexOf(search1[0].Name) > -1) &&
              !self.DiyCommon.IsNull(search1[0].Id)
            ) {
              search1[0]["AsName"] = "";
              //这里要根据 SelectFields 赋值别名
              if (self.SysMenuModel.SelectFields && Array.isArray(self.SysMenuModel.SelectFields)) {
                var search2 = _.where(self.SysMenuModel.SelectFields, {
                  Id: element
                });
                if (search2.length > 0 && !self.DiyCommon.IsNull(search2[0].AsName)) {
                  search1[0]["AsName"] = search2[0].AsName;
                }
              }
              //------end
              tempArr.push(search1[0]);
              index++;
            }
          });
          // tempArr.push(_.where(self.DiyFieldList, {Name : 'CreateTime'})[0]);
          //调整ShowHideFieldsList排序
          self.SortShowHideFieldsList(tempArr);
          self.ShowDiyFieldList = [];
          //这里一定要这样，否则DOM不刷新
          //但这个就导致这个GetShowDiyFieldList函数执行完毕后，还拿不到真正的ShowDiyFieldList值    --2022-03-23
          //现在临时解决方案是返回tempArr
          self.$nextTick(function () {
            self.ShowDiyFieldList = tempArr;
          });
          return tempArr;
        } else if (self.DiyFieldList.length > 0) {
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
                var search2 = _.where(self.SysMenuModel.SelectFields, {
                  Id: element
                });
                if (search2.length > 0 && !self.DiyCommon.IsNull(search2[0].AsName)) {
                  element["AsName"] = search2[0].AsName;
                }
              }
              //------end
              tempArr.push(element);
              index++;
            }
          });
          //调整ShowHideFieldsList排序
          self.SortShowHideFieldsList(tempArr);
          self.ShowDiyFieldList = [];
          //这里一定要这样，否则DOM不刷新
          //但这个就导致这个GetShowDiyFieldList函数执行完毕后，还拿不到真正的ShowDiyFieldList值  --2022-03-23
          //现在临时解决方案是返回tempArr
          self.$nextTick(function () {
            self.ShowDiyFieldList = tempArr;
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
          var firstIndex = _.findIndex(tempArr, {
            Name: self.ShowHideFieldsList[index - 1]
          });
          if (firstIndex != -1) {
            //如果下一个位置的值和现在这个不相等
            if (tempArr[firstIndex + 1] && self.ShowHideFieldsList[index] != tempArr[firstIndex + 1].Name) {
              //获取老位置
              var currentIndex = _.findIndex(tempArr, {
                Name: self.ShowHideFieldsList[index]
              });
              if (currentIndex != -1) {
                //缓存用于替换的值
                var currentModel = { ...tempArr[currentIndex] };
                //删除老位置
                tempArr.splice(currentIndex, 1);
                //重新获取老位置
                firstIndex = _.findIndex(tempArr, {
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
      var self = this;
      self.tableLoading = true;
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
          const index = param._Where.findIndex((d) => d.Name == item.Name);
          if (index === -1) {
            param._Where.push(item);
          } else {
            param._Where[index] = { ...param._Where[index], ...item };
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
      if (_searchDateTime) {
        var _searchDateTimeArr = _searchDateTime.split("|");
        if (_searchDateTimeArr.length == 3) {
          self.SearchDateTime[_searchDateTimeArr[0]] = [_searchDateTimeArr[1], _searchDateTimeArr[2]];
        }
      }
      if (self.SearchModel && !_.isEqual(self.SearchModel, {})) {
        param._Search = self.SearchModel;
      }
      if (self.SearchEqual && !_.isEqual(self.SearchEqual, {})) {
        param._SearchEqual = self.SearchEqual;
      }
      if (self.SearchCheckbox && !_.isEqual(self.SearchCheckbox, {})) {
        param._SearchCheckbox = self.SearchCheckbox;
      }
      if (self.SearchDateTime && !_.isEqual(self.SearchDateTime, {})) {
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
      var paramType = '';
      if (self.CurrentDiyTableModel.IsTree) {
        url = self.DiyApi.GetDiyTableRowTree;
      } else {
        url = "/api/FormEngine/getTableData-" + (param.ModuleEngineKey || param.FormEngineKey).replace(/\_/g, "-").toLowerCase();
        paramType = 'json';
      }
      // url = '/api/diytable/getDiyTableRowTree';
      if (self.SysMenuModel.DiyConfig && self.SysMenuModel.DiyConfig.SelectApi) {
        url = self.SysMenuModel.DiyConfig.SelectApi;
      }
      //2024-04-24：如果是报表引擎，通过数据源引擎获取数据
      if (self.CurrentDiyTableModel.ReportId && self.CurrentDiyTableModel.DataSourceId) {
        url = "/api/DataSourceEngine/Run";
        param.DataSourceKey = self.CurrentDiyTableModel.DataSourceId;
      }
      self.DiyCommon.Post(url, param, async function (result) {
        self.tableLoading = false;
        if (self.DiyCommon.Result(result)) {
          //统计列的值，后来应该改成单独接口
          if (result.DataAppend && !self.DiyCommon.IsNull(result.DataAppend.StatisticsFields)) {
            self.StatisticsFields = result.DataAppend.StatisticsFields;
          } else {
            self.StatisticsFields = null;
          }

          //---------处理需要真实显示的字段
          //注意：执行此句的时候，一定要保证 GetDiyField 已经执行完毕，所以在GetDiyField的时候，也需要调用一下这个方法？
          var tempShowDiyFieldList = self.GetShowDiyFieldList();
          //--------

          //2021-08-30 新增：获取到数据后，提前处理好表格模板引擎
          //后来没这样干了，因为规定表格模板引擎不允许使用await，所以暂时还是在表格中每行渲染，其实后面还是应该提前渲染
          //并且后来发现如果这里要提前处理，那么后面使用V8.Form.字段取到的值是模板渲染后的值？这时候其实要赋值另外一个属性，如FieldName_TmpEngineResult
          //在2022-03-23重新开启这个功能，提前处理好模板引擎，不在表格中循环处理
          // self.ShowDiyFieldList.forEach(field => {
          await Promise.all(
            tempShowDiyFieldList.map(async (field) => {
              if (!self.DiyCommon.IsNull(field.V8TmpEngineTable)) {
                await Promise.all(
                  result.Data.map(async (row) => {
                    var tmpResult = await self.RunFieldTemplateEngine(field, row);
                    if (tmpResult !== false) {
                      row[field.Name + "_TmpEngineResult"] = tmpResult;
                    }
                  })
                );
              }
            })
          );

          // 2025-03-23编辑、删除按钮显示条件 刘诚
          if (!self.DiyCommon.IsNull(self.SysMenuModel.AddCodeShowV8)) {
            var btn = self.SysMenuModel.AddCodeShowV8;
            var v8Result = await self.LimitMoreBtn1(btn, "", "AddCodeShowV8");
            if (v8Result === false) {
              self.IsVisibleAdd = v8Result;
            }
          }
          for (var i = 0; i < result.Data.length; i++) {
            if (!self.DiyCommon.IsNull(self.SysMenuModel.EditCodeShowV8)) {
              var btn = self.SysMenuModel.EditCodeShowV8;
              var row = result.Data[i];
              result.Data[i].IsVisibleEdit = await self.LimitMoreBtn1(btn, row, "EditCodeShowV8");
            } else {
              result.Data[i].IsVisibleEdit = true;
            }
            if (!self.DiyCommon.IsNull(self.SysMenuModel.DelCodeShowV8)) {
              var btn = self.SysMenuModel.DelCodeShowV8;
              var row = result.Data[i];
              result.Data[i].IsVisibleDel = await self.LimitMoreBtn1(btn, row, "DelCodeShowV8");
            } else {
              result.Data[i].IsVisibleDel = true;
            }
          }

          //之前是每行在 GetMoreBtnsGroup 函数处理
          //提前计算出行外、行更多内按钮分组，以及IsVisible，同时也要计算出当前所有行数据最大的行外按钮数量，以设置表格操作列的宽度
          self.MaxRowBtnsOut = 0;

          // self.DiyTableRowList = [];

          //2022-07-02 处理可能为树形的结构。
          await self.DiguiDiyTableRowDataList(result.Data);
          self.DiyTableRowList = result.Data;
          self.DiyTableRowCount = result.DataCount;

          if (result.DataAppend && result.DataAppend.NotSaveField) {
            self.NotSaveField = result.DataAppend.NotSaveField;
          }
        }
      }, null, null, paramType);
    },

    //2025-03-23编辑、删除按钮显示条件
    async LimitMoreBtn1(btn, row, EventName) {
      var self = this;
      var V8 = {};
      if (self.GetCurrentUser._IsAdmin === true) {
        return true;
      }

      try {
        if (!V8.Form) {
          var form = { ...row };
          V8.Form = self.DeleteFormProperty(form); // 当前Form表单所有字段值
        }
        V8.EventName = EventName;
        self.SetV8DefaultValue(V8);
        await self.DiyCommon.InitV8Code(V8, self.$router);
        await eval("(async () => {\n " + btn + " \n})()");
        return V8.Result;
      } catch (error) {
        self.DiyCommon.Tips("执行V8引擎代码出现错误：" + error.message, false);
        return false;
      }
    },

    async DiguiDiyTableRowDataList(firsrtData) {
      var self = this;

      //注意：这个result.Data可能是树形，  --2022-07-02
      for (let index = 0; index < firsrtData.length; index++) {
        //result.Data
        let row = firsrtData[index]; //result.Data
        if (!row.Id && (row.id || row.ID)) {
          row.Id = row.id || row.ID;
        }
        let _rowMoreBtnsOut = _.where(self.SysMenuModel.MoreBtns, {
          ShowRow: true
        });

        let _rowMoreBtnsOutCopy = [];
        _rowMoreBtnsOut.forEach((element) => {
          _rowMoreBtnsOutCopy.push({ ...element });
        });

        await self.HandlerBtns(_rowMoreBtnsOutCopy, row);
        row._RowMoreBtnsOut = _rowMoreBtnsOutCopy;

        //取列表数据中可能存在的最多按钮数量
        // var maxLength = _.where(_rowMoreBtnsOutCopy, {IsVisible : true}).length;
        var allOutBtn = _.where(_rowMoreBtnsOutCopy, { IsVisible: true });
        var allOutBtnLength = 0;
        allOutBtn.forEach((element) => {
          allOutBtnLength += element.Name.length;
        });
        //之前是 MaxRowBtnsOut*115 按按钮数量来，现在按文字数量来 2022-07-24
        //定在一个字：15   一个按钮  30  还有2个按钮的空隙 15
        var newWidth = allOutBtnLength * 14 + allOutBtn.length * 40;
        // if (self.MaxRowBtnsOut < maxLength) {
        if (self.MaxRowBtnsOut < newWidth) {
          // self.MaxRowBtnsOut = maxLength;
          self.MaxRowBtnsOut = newWidth;
        }

        let _rowMoreBtnsIn = _.where(self.SysMenuModel.MoreBtns, {
          ShowRow: false
        });

        let _rowMoreBtnsInCopy = [];
        _rowMoreBtnsIn.forEach((element) => {
          _rowMoreBtnsInCopy.push({ ...element });
        });

        await self.HandlerBtns(_rowMoreBtnsInCopy, row);
        row._RowMoreBtnsIn = _rowMoreBtnsInCopy;

        if (self.CurrentDiyTableModel.IsTree && row["_Child"] && row["_Child"].length > 0) {
          await self.DiguiDiyTableRowDataList(row["_Child"]);
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
        if (v8Result === false) {
          return;
        }
        var param = {
          TableId: self.TableId,
          Id: rowModel.Id
        };

        var url = self.DiyApi.DelDiyTableRow;
        if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.ApiReplace.Delete)) {
          url = self.CurrentDiyTableModel.ApiReplace.Delete;
        }
        self.DiyCommon.Post(url, param, async function (result) {
          if (self.DiyCommon.Result(result)) {
            //执行表单提交后V8
            await self.FormOutAction("Delete", "Delete", rowModel.Id, null, rowModel);

            //请求接口--------start
            try {
              if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.DelCallbakApi)) {
                param.Id = param._TableRowId;
                self.DiyCommon.Post(self.CurrentDiyTableModel.DelCallbakApi, param, function (apiResult) {});
              }
            } catch (error) {
              console.log("请求接口 error：", error);
            }

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
        var V8 = {
          Form: rowModel,
          FormSet: (fieldName, value) => {
            return self.FormSet(fieldName, value, rowModel);
          }, // 给Form表单其它字段赋值
          FormSubmitAction: actionType,
          GetDiyTableRow: self.GetDiyTableRow,
          EventName: "FormSubmitBefore"
        };
        self.SetV8DefaultValue(V8);
        await self.DiyCommon.InitV8Code(V8, self.$router);
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
        }
      }
    },
    //离开表单动作
    async FormOutAction(actionType, submitAfterType, tableRowId, V8Callback, rowModel) {
      var self = this;
      if (self.DiyCommon.IsNull(self.CurrentDiyTableModel.Id)) {
        return;
      }
      // 判断需要执行的V8
      if (!self.DiyCommon.IsNull(self.CurrentDiyTableModel.OutFormV8)) {
        var V8 = {
          Form: rowModel, // 当前Form表单所有字段值
          FormSet: (fieldName, value) => {
            return self.FormSet(fieldName, value, rowModel);
          }, // 给Form表单其它字段赋值
          FormOutAction: actionType,
          FormOutAfterAction: submitAfterType,
          V8Callback: V8Callback,
          EventName: "FormOut"
        };
        self.SetV8DefaultValue(V8);
        await self.DiyCommon.InitV8Code(V8, self.$router);
        V8.Form.Id = rowModel.Id;
        try {
          // eval(self.CurrentDiyTableModel.OutFormV8);
          await eval("(async () => {\n " + self.CurrentDiyTableModel.OutFormV8 + " \n})()");
        } catch (error) {
          self.DiyCommon.Tips("执行表单离开V8引擎代码出现错误：" + error.message, false);
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
    }
  }
};
</script>

<style lang="scss">
.row-more-btns-out {
  // max-width: 105px;
  overflow: hidden;
}
//liucheng2025-4-4优化客户提出按钮paddding太宽，小屏幕查看不方便
// .row-more-btns-out.el-button--mini {
//   padding-left: 7px !important;
//   padding-right: 7px !important;
// }
.el-button [class*="el-icon-"] + span {
  margin-left: 0px;
}
.datalog-timeline .el-timeline-item__wrapper {
  padding-left: 45px;
}
</style>
