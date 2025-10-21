<template>
  <div class="diy-design-container">
    <el-form size="mini" inline @submit.native.prevent class="keyword-search">
      <el-form-item size="mini">
        <el-button :loading="SaveAllDiyFieldLoding" type="primary" icon="el-icon-circle-check" @click="SaveAllDiyField">{{ $t("Msg.SaveAll") }}</el-button>
        <el-button :loading="SaveAllDiyFieldLoding" icon="el-icon-check" type="primary" @click.native="UptDiyTable">{{ $t("Msg.Save") }}{{ $t("Msg.Form") }}</el-button>
      </el-form-item>
      <el-form-item v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)" size="mini">
        <el-select v-model="CurrentDiyFieldModel" @change="SelectFieldChange" :filter-method="SelectFieldFilterMethod" clearable filterable value-key="Id" style="width: 250px" placeholder="搜索字段">
          <el-option v-for="item in DiyFieldListClone" :key="'CurrentDiyFieldModel_' + item.Id" :label="item.Label" :value="item">
            <span style="float: left">{{ item.Label }}</span>
            <span style="float: right; color: #8492a6; font-size: 13px">{{ item.Name }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item size="mini">
        <el-button v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Id)" :loading="SaveAllDiyFieldLoding" icon="el-icon-check" type="primary" @click.native="UptDiyField">
          {{ $t("Msg.Save") }}{{ $t("Msg.Field") }}
          <!-- ({{CurrentDiyFieldModel.Label}}) -->
        </el-button>
        <el-button v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Id)" :loading="SaveAllDiyFieldLoding" type="danger" icon="el-icon-delete" @click.native="DelDiyField">
          {{ $t("Msg.Del") }}{{ $t("Msg.Field") }}
          <!-- ({{CurrentDiyFieldModel.Label}}) -->
        </el-button>
      </el-form-item>
      <el-form-item size="mini" v-if="PageType != 'Report'">
        <el-select v-model="CurrentErrorFieldModel" @change="SelectErrorFieldChange" clearable filterable value-key="Name" style="width: 250px" placeholder="异常字段">
          <el-option v-for="(item, index) in ExceptionFieldList" :key="'ExceptionFieldList_' + index" :label="item.Name" :value="item">
            <span style="float: left">{{ (item.Label || item.Name) + `(${item.Name})` }}</span>
            <span style="float: right; color: #8492a6; font-size: 13px">{{ item.ErrorType == "DbField" ? "Diy缺少" : "数据库缺少" }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item size="mini">
        <el-button v-if="!DiyCommon.IsNull(CurrentErrorFieldModel.Name)" :loading="SaveAllDiyFieldLoding" icon="el-icon-check" type="primary" @click.native="RepairField">
          {{ "修复" }}
        </el-button>
      </el-form-item>
      <el-form-item size="mini" v-if="PageType != 'Report'">
        <el-select v-model="CurrentDeletedFieldModel" clearable filterable value-key="Name" style="width: 250px" placeholder="字段回收站">
          <el-option v-for="(item, index) in DeletedDiyField" :key="'DeletedDiyField_' + index" :label="item.Name" :value="item">
            <span style="float: left">{{ item.Label + `(${item.Name})` }}</span>
            <span style="float: right; color: #8492a6; font-size: 13px">{{ "已删除" }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item size="mini">
        <el-button v-if="!DiyCommon.IsNull(CurrentDeletedFieldModel.Name)" :loading="SaveAllDiyFieldLoding" icon="el-icon-check" type="primary" @click.native="RecoverDiyField">
          {{ "恢复" }}
        </el-button>
        <!-- <el-button
                v-if="!DiyCommon.IsNull(CurrentDeletedFieldModel.Name)"
                :loading="SaveAllDiyFieldLoding"
                icon="el-icon-check"
                type="primary"
                @click.native="RepairField">
                    {{ '彻底删除' }}
                </el-button> -->
      </el-form-item>
    </el-form>
    <el-container class="field-container">
      <el-aside class="aside aside-left" width="250px">
        <el-row id="row-field" :gutter="10" class="row-field">
          <el-col :span="24">
            <el-divider content-position="center">基础控件</el-divider>
          </el-col>
          <el-col v-for="component in DiyComponentListBaseListen" :key="component.Control" :data-field="component.Control" class="field-drag" :span="12">
            <el-tag><i :class="'icon ' + component.Icon" />{{ component.Name }}</el-tag>
          </el-col>

          <el-col :span="24">
            <el-divider content-position="center">高级控件</el-divider>
          </el-col>

          <el-col v-for="component in DiyComponentListAdvancedListen" :key="component.Control" :data-field="component.Control" class="field-drag" :span="12">
            <el-tag><i :class="'icon ' + component.Icon" />{{ component.Name }}</el-tag>
          </el-col>
        </el-row>
      </el-aside>
      <!-- <el-container> -->
      <!-- <el-header
                height="50px"
                style="box-shadow: 0 0 8px 0 rgba(0,0,0,.15);">

            </el-header> -->
      <el-main class="center-main">
        <el-tabs v-model="FormClient" @tab-click="SwitchFormClient">
          <el-tab-pane label="PC" name="PC">
            <span slot="label"><i class="el-icon-monitor"></i> PC端预览</span>
          </el-tab-pane>
          <el-tab-pane label="Mobile" name="Mobile">
            <span slot="label"><i class="el-icon-mobile-phone"></i> 移动端预览</span>
          </el-tab-pane>
        </el-tabs>
        <div :style="{ width: FormClient == 'Mobile' ? '375px' : 'auto' }">
          <DiyForm
            ref="fieldForm"
            :load-mode="'Design'"
            :table-id="TableId"
            :table-row-id="TableRowId"
            :col-span="FormClient == 'Mobile' ? 24 : 0"
            @CallbackSelectField="CallbackSelectField"
            @CallbackSetDiyTableModel="CallbackSetDiyTableModel"
            @CallbackLoadDragula="CallbackLoadDragula"
            @CallbackGetDiyField="CallbackGetDiyField"
          />
        </div>
        <el-dialog v-el-drag-dialog width="550px" :modal-append-to-body="false" :visible.sync="ShowDiyTableEditor" append-to-body :title="''">
          <span slot="footer" class="dialog-footer">
            <el-button type="primary" size="mini" icon="el-icon-close">{{ $t("Msg.Close") }}({{ $t("Msg.AutoSave") }})</el-button>
          </span>
        </el-dialog>
      </el-main>
      <el-aside width="320px" class="aside aside-right">
        <el-container>
          <el-main class="right-main">
            <el-tabs v-model="AsideRightActiveTab" :stretch="true" @tab-click="tabCLickAsideRight">
              <el-tab-pane name="Field">
                <span slot="label"><i class="fas fa-columns marginRight5" />字段属性</span>
                <div class="div-scroll" style="height: calc(100vh - 245px)">
                  <!-- label-width="80px" -->
                  <el-divider content-position="left"><i class="el-icon-s-tools"></i> 基本设置</el-divider>
                  <el-form class="form-setting" size="mini" :model="CurrentDiyFieldModel" label-width="85px" label-position="left">
                    <el-form-item label="显示名称" size="mini">
                      <el-input v-model="CurrentDiyFieldModel.Label" @input="DiyFieldLabelChange" />
                    </el-form-item>
                    <el-form-item label="说明" size="mini">
                      <el-input type="textarea" :rows="2" v-model="CurrentDiyFieldModel.Description" />
                    </el-form-item>
                    <el-form-item label="字段名" size="mini">
                      <el-input v-model="CurrentDiyFieldModel.Name" :disabled="CurrentDiyFieldModel.IsLockField ? true : false" :readonly="CurrentDiyFieldModel.IsLockField ? true : false" />
                    </el-form-item>
                    <el-form-item label="字段类型" size="mini">
                      <!-- <el-input v-model="CurrentDiyFieldModel.Type"></el-input> -->
                      <el-autocomplete
                        :disabled="CurrentDiyFieldModel.IsLockField ? true : false"
                        :readonly="CurrentDiyFieldModel.IsLockField ? true : false"
                        v-model="CurrentDiyFieldModel.Type"
                        :fetch-suggestions="SearchCDFMType"
                        placeholder=""
                      />
                    </el-form-item>
                    <el-form-item label="控件类型" v-if="CanUptComponent()" key="design-102" size="mini">
                      <!-- <el-input v-model="CurrentDiyFieldModel.Type"></el-input> -->
                      <el-select v-model="CurrentDiyFieldModel.Component" clearable filterable placeholder="">
                        <el-option v-for="item in DiyComponentList" :key="item.Control" :label="item.Name" :value="item.Control" />
                      </el-select>
                    </el-form-item>

                    <el-form-item :label="$t('Msg.Sort')" size="mini">
                      <el-input v-model="CurrentDiyFieldModel.Sort" type="number" />
                    </el-form-item>

                    <el-form-item :label="'占位文字'" size="mini">
                      <el-input v-model="CurrentDiyFieldModel.Placeholder" type="text" />
                    </el-form-item>

                    <el-form-item label="分组" size="mini">
                      <!-- <el-autocomplete
                                        class="inline-input"
                                        v-model="CurrentDiyFieldModel.Tab"
                                        :fetch-suggestions="searchFieldTab"
                                        placeholder=""
                                    ></el-autocomplete> -->
                      <el-select v-model="CurrentDiyFieldModel.Tab" clearable placeholder="">
                        <el-option v-for="item in CurrentDiyTableModel.Tabs" :key="item.Id || item.Name" :label="item.Name" :value="item.Id || item.Name" />
                      </el-select>
                    </el-form-item>
                    <el-form-item :label="'字段Id'" size="mini">
                      <el-input v-model="CurrentDiyFieldModel.Id" disabled readonly type="text" />
                    </el-form-item>
                  </el-form>
                  <el-divider content-position="left"><i class="el-icon-s-tools"></i> 组件设置</el-divider>
                  <el-form class="form-setting" size="mini" :model="CurrentDiyFieldModel" label-width="85px" label-position="left">
                    <!--级联选择器-->
                    <!-- <el-form-item
                                        v-if="CurrentDiyFieldModel.Component == 'Cascader'"
                                        class="form-item-top"
                                        size="mini">
                                        <div class="form-item-label-slot">
                                            存储字段（必填）
                                        </div>
                                        <el-input
                                            v-model="CurrentDiyFieldModel.Config.Cascader.Value"
                                            type="text" />
                                    </el-form-item>
                                    <el-form-item
                                        v-if="CurrentDiyFieldModel.Component == 'Cascader'"
                                        class="form-item-top"
                                        size="mini">
                                        <div class="form-item-label-slot">
                                            显示字段（可选）
                                        </div>
                                        <el-input
                                            v-model="CurrentDiyFieldModel.Config.Cascader.Label"
                                            type="text" />
                                    </el-form-item> -->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" size="mini" class="form-item-top" key="design-101">
                      <div class="form-item-label-slot">存储字段（必填）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectSaveField" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'RichText'" label="编辑器" size="mini" key="design-100">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.RichText.EditorProduct">
                        <el-radio :label="'UEditor'">UEditor</el-radio>
                        <el-radio :label="'WangEditor'">WangEditor</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" size="mini" class="form-item-top" key="design-99">
                      <div class="form-item-label-slot">显示字段（可选）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectLabel" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" size="mini" key="design-98">
                      <div class="form-item-label-slot">子级字段（可选，默认_Child）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.Cascader.Children" type="text" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" size="mini" key="design-97">
                      <div class="form-item-label-slot">父级字段（一般指ParentId，必填）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.Cascader.ParentField" placeholder="" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" size="mini" key="design-96">
                      <div class="form-item-label-slot">完整父级字段（一般指FullPath/ParentIds，如：parentid1,parentid2,parentid3,【以英文逗号结尾】，必填）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.Cascader.ParentFields" placeholder="" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" label="动态加载" size="mini" key="design-95">
                      <el-switch v-model="CurrentDiyFieldModel.Config.Cascader.Lazy" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" label="可搜索" size="mini" key="design-94">
                      <el-switch v-model="CurrentDiyFieldModel.Config.Cascader.Filterable" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" label="是否多选" size="mini" key="design-93">
                      <el-switch v-model="CurrentDiyFieldModel.Config.Cascader.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" size="mini" key="design-92">
                      <div class="form-item-label-slot">判断是否禁用的字段（可选）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.Cascader.Disabled" type="text" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" size="mini" key="design-91">
                      <div class="form-item-label-slot">判断是否有子级的字段（可选）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.Cascader.Leaf" type="text" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Cascader'" class="form-item-top" label="保存所有级数组" size="mini" key="design-90">
                      <el-switch v-model="CurrentDiyFieldModel.Config.Cascader.EmitPath" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <!-- 级联 END -->

                    <!-- 下拉树 START -->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" size="mini" class="form-item-top" key="design-89">
                      <div class="form-item-label-slot">存储字段（必填）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectSaveField" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" size="mini" class="form-item-top" key="design-88">
                      <div class="form-item-label-slot">显示字段（可选）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectLabel" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" size="mini" key="design-87">
                      <div class="form-item-label-slot">子级字段（可选，默认_Child）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectTree.Children" type="text" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" size="mini" key="design-86">
                      <div class="form-item-label-slot">父级字段（一般指ParentId，必填）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectTree.ParentField" placeholder="" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" size="mini" key="design-85">
                      <div class="form-item-label-slot">完整父级字段（一般指FullPath/ParentIds，如：parentid1,parentid2,parentid3,【以英文逗号结尾】，必填）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectTree.ParentFields" placeholder="" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" label="动态加载" size="mini" key="design-84">
                      <el-switch v-model="CurrentDiyFieldModel.Config.SelectTree.Lazy" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" label="可搜索" size="mini" key="design-83">
                      <el-switch v-model="CurrentDiyFieldModel.Config.SelectTree.Filterable" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" label="是否多选" size="mini" key="design-82">
                      <el-switch v-model="CurrentDiyFieldModel.Config.SelectTree.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" size="mini" key="design-81">
                      <div class="form-item-label-slot">判断是否禁用的字段（可选）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectTree.Disabled" type="text" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'SelectTree'" class="form-item-top" size="mini" key="design-80">
                      <div class="form-item-label-slot">判断是否有子级的字段（可选）</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectTree.Leaf" type="text" />
                    </el-form-item>

                    <!-- 组织机构 START-->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Department'" label="是否多选" size="mini" key="design-79">
                      <el-switch v-model="CurrentDiyFieldModel.Config.Department.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Department'" label="可搜索" size="mini" key="design-78">
                      <el-switch v-model="CurrentDiyFieldModel.Config.Department.Filterable" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Department'" class="form-item-top" label="保存所有级数组" size="mini" key="design-77">
                      <el-switch v-model="CurrentDiyFieldModel.Config.Department.EmitPath" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <!-- 组织机构 END -->
                    <!--按钮-->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Button'" label="按钮样式" size="mini" key="design-76">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.Button.Type">
                        <el-radio :label="''">默认按钮</el-radio>
                        <el-radio :label="'primary'">主要按钮</el-radio>
                        <el-radio :label="'success'">成功按钮</el-radio>
                        <el-radio :label="'info'">信息按钮</el-radio>
                        <el-radio :label="'warning'">警告按钮</el-radio>
                        <el-radio :label="'danger'">危险按钮</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Button'" label="预览可点击" size="mini" key="design-75">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.Button.PreviewCanClick">
                        <el-radio :label="true">是</el-radio>
                        <el-radio :label="false">否</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Button'" label="图标" size="mini" key="design-74">
                      <span class="hand" style="display: inline-block; padding: 5px; cursor: pointer" @click="$refs.refButtonIcon.show()">
                        <i :class="DiyCommon.IsNull(CurrentDiyFieldModel.Config.Button.Icon) ? 'far fa-smile-wink' : CurrentDiyFieldModel.Config.Button.Icon" />
                      </span>
                      <Fontawesome ref="refButtonIcon" :model.sync="CurrentDiyFieldModel.Config.Button.Icon" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Map' || CurrentDiyFieldModel.Component == 'MapArea'" label="地图公司" size="mini" key="design-73">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.MapCompany">
                        <el-radio :label="'Baidu'">百度</el-radio>
                        <el-radio :label="'AMap'">高德</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <!-- <el-form-item
                                        v-if="CurrentDiyFieldModel.Component == 'Map'
                                            || CurrentDiyFieldModel.Component == 'MapArea'"
                                        label="地图key"
                                        size="mini"
                                        key="design-72">

                                        <el-input v-model="CurrentDiyFieldModel.Config.MapKey" />

                                    </el-form-item>
                                    <el-form-item
                                        v-if="CurrentDiyFieldModel.Component == 'Map'
                                            || CurrentDiyFieldModel.Component == 'MapArea'"
                                        label="地图secret"
                                        size="mini"
                                        key="design-71">

                                        <el-input v-model="CurrentDiyFieldModel.Config.MapSecret" />

                                    </el-form-item> -->

                    <!--子表         START-->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" label="关联模块" size="mini" key="design-70">
                      <el-popover placement="bottom" trigger="click" style="width: 100%">
                        <el-tree :data="SysMenuList" node-key="Id" :props="sysMenuTreeProps" @node-click="sysMenuTreeClick" />
                        <el-button slot="reference" style="width: 100%; padding: 10px 20px">
                          <!-- {{DiyCommon.IsNull(CurrentSysMenuModel.ParentName) ? '顶级' : CurrentSysMenuModel.ParentName}} -->
                          {{ DiyCommon.IsNull(CurrentDiyFieldModel.Config.TableChildSysMenuName) ? "请选择" : CurrentDiyFieldModel.Config.TableChildSysMenuName }}
                        </el-button>
                      </el-popover>
                    </el-form-item>
                    <el-form-item class="form-item-top" v-if="CurrentDiyFieldModel.Component == 'TableChild'" label="关联主表列名（默认Id）" key="design-69" size="mini">
                      <el-input v-model="CurrentDiyFieldModel.Config.TableChild.PrimaryTableFieldName" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" class="form-item-top" label="关联子表列名" key="design-68" size="mini">
                      <el-input v-model="CurrentDiyFieldModel.Config.TableChildFkFieldName" />
                    </el-form-item>

                    <!--
                                        TableChildCallbackField格式：
                                        [{Father:'AAAA', Child:'BBBB'}, {Father:'CCCCC', Child:'DDDDD'}]
                                    -->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" label="回写子表列" key="design-67" size="mini">
                      <!-- <el-input type="textarea" rows="5"
                                            placeholder='[{ "Father" : "FielName1", "Child" : "FielName2" }, { "Father" : "FielName3", "Child" : "FielName4" }]'
                                            v-model="CurrentDiyFieldModel.Config.TableChildCallbackField" /> -->
                      <DiyChildTableCallback
                        ref="diyWritebackChild"
                        v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                        :fields="$refs.fieldForm.DiyFieldList"
                        :childTableId="CurrentDiyFieldModel.Config.TableChildTableId"
                        :model.sync="CurrentDiyFieldModel.Config.TableChildCallbackField"
                      >
                      </DiyChildTableCallback>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" label="上级模块（选填，用于嵌套子表显示在表单外部）" class="form-item-top" size="mini" key="design-66">
                      <el-popover placement="bottom" trigger="click" style="width: 100%">
                        <el-tree :data="SysMenuList" node-key="Id" :props="sysMenuTreeProps" @node-click="sysMenuTreeClickLast" />
                        <el-button slot="reference" style="width: 100%; padding: 10px 20px">
                          <!-- {{DiyCommon.IsNull(CurrentSysMenuModel.ParentName) ? '顶级' : CurrentSysMenuModel.ParentName}} -->
                          {{ DiyCommon.IsNull(CurrentDiyFieldModel.Config.TableChild.LastSysMenuName) ? "请选择" : CurrentDiyFieldModel.Config.TableChild.LastSysMenuName }}
                        </el-button>
                      </el-popover>
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" size="mini" class="form-item-top" key="design-65">
                      <span style="float: none; margin-bottom: 10px; cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyFieldModel.Config.TableChildRowClickV8')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        行点击事件V8引擎代码<span style="color: red">(JavaScript)</span>
                      </span>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyFieldModel.Config.TableChildRowClickV8"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          ref="refTableChildRowClickV8"
                          :key="'refTableChildRowClickV8_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyFieldModel.Config.TableChildRowClickV8"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'TableChild'" label="关闭分页" size="mini" key="design-64">
                      <el-switch v-model="CurrentDiyFieldModel.Config.TableChild.DisablePagination" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <!-- <el-form-item
                                        v-if="CurrentDiyFieldModel.Component == 'TableChild'"
                                        label="无默认高度"
                                        size="mini">
                                        <el-switch
                                            v-model="CurrentDiyFieldModel.Config.TableChild.NoneDefaultHeight"
                                            active-color="#ff6c04"
                                            inactive-color="#ccc" />
                                    </el-form-item> -->
                    <!--子表      END-->

                    <!-- 关联表格 START -->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'JoinTable'" label="关联模块" size="mini" key="design-63">
                      <el-popover placement="bottom" trigger="click" style="width: 100%">
                        <el-tree :data="SysMenuList" node-key="Id" :props="sysMenuTreeProps" @node-click="JoinTableSelectModule" />
                        <el-button slot="reference" style="width: 100%; padding: 10px 20px">
                          {{ CurrentDiyFieldModel.Config.JoinTable.ModuleName ? CurrentDiyFieldModel.Config.JoinTable.ModuleName : "请选择" }}
                        </el-button>
                      </el-popover>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'JoinTable'" label="搜索条件" class="form-item-top" size="mini" key="design-62">
                      <el-input v-model="CurrentDiyFieldModel.Config.JoinTable.Where" :type="'textarea'" rows="5" />
                    </el-form-item>
                    <!-- 关联表格 END -->

                    <!--弹出表格配置    START-->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'OpenTable'" label="关联模块" size="mini" key="design-61">
                      <el-popover placement="bottom" trigger="click" style="width: 100%">
                        <el-tree :data="SysMenuList" node-key="Id" :props="sysMenuTreeProps" @node-click="OpenTableSysMenuClick" />
                        <el-button slot="reference" style="width: 100%; padding: 10px 20px">
                          <!-- {{DiyCommon.IsNull(CurrentSysMenuModel.ParentName) ? '顶级' : CurrentSysMenuModel.ParentName}} -->
                          {{ DiyCommon.IsNull(CurrentDiyFieldModel.Config.OpenTable.SysMenuName) ? "请选择" : CurrentDiyFieldModel.Config.OpenTable.SysMenuName }}
                        </el-button>
                      </el-popover>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'OpenTable'" label="按钮名称" size="mini" key="design-60">
                      <el-input v-model="CurrentDiyFieldModel.Config.OpenTable.BtnName" placeholder="弹出表格" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'OpenTable'" label="是否多选" size="mini" key="design-59">
                      <el-switch v-model="CurrentDiyFieldModel.Config.OpenTable.MultipleSelect" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'OpenTable'" size="mini" class="form-item-top" key="design-58">
                      <!-- OpenV8CodeEditor('BeforeOpenV8', 'Field', 'Config.OpenTable') -->
                      <span style="float: none; margin-bottom: 10px; cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyFieldModel.Config.OpenTable.BeforeOpenV8')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        弹出前V8引擎代码<span style="color: red">(JavaScript)</span>
                      </span>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyFieldModel.Config.OpenTable.BeforeOpenV8"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          ref="refBeforeOpenV8"
                          :key="'refBeforeOpenV8_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyFieldModel.Config.OpenTable.BeforeOpenV8"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'OpenTable'" size="mini" class="form-item-top" key="design-57">
                      <!-- OpenV8CodeEditor('SubmitV8', 'Field', 'Config.OpenTable') -->
                      <span style="float: none; margin-bottom: 10px; cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyFieldModel.Config.OpenTable.SubmitV8')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        提交事件V8引擎代码<span style="color: red">(JavaScript)</span>
                      </span>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyFieldModel.Config.OpenTable.SubmitV8"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          ref="refConfigOpenTableSubmitV8"
                          :key="'refConfigOpenTableSubmitV8_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyFieldModel.Config.OpenTable.SubmitV8"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>
                    <!--弹出表格配置   END-->

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'DevComponent'" label="组件名称" size="mini" key="design-56">
                      <el-input v-model="CurrentDiyFieldModel.Config.DevComponentName" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'DevComponent'" class="form-item-top" size="mini" key="design-55">
                      <div class="form-item-label-slot">组件路径</div>
                      <el-input
                        type="textarea"
                        :rows="3"
                        v-model="CurrentDiyFieldModel.Config.DevComponentPath"
                        placeholder="以'/views'开头， 也可以不以'/views'开头，但定制组件必需放到/views/下任意地方"
                      />
                    </el-form-item>

                    <el-form-item
                      v-if="CurrentDiyFieldModel.Component == 'FileUpload' || CurrentDiyFieldModel.Component == 'ImgUpload'"
                      class="form-item-top"
                      label="上传前V8事件"
                      size="mini"
                      key="design-54"
                    >
                      <!-- <el-switch
                                            v-model="CurrentDiyFieldModel.Config.Upload.BeforeUploadV8"
                                            active-color="#ff6c04"
                                            inactive-color="#ccc" /> -->
                      <DiyV8Design
                        ref="refConfigOpenTableSubmitV8"
                        :key="'refConfigUploadBeforeUploadV8_' + CurrentDiyFieldModel.Id"
                        v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                        :fields="$refs.fieldForm.DiyFieldList"
                        :model.sync="CurrentDiyFieldModel.Config.Upload.BeforeUploadV8"
                      ></DiyV8Design>
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'FileUpload'" class="form-item-top" label="禁止匿名访问" size="mini" key="design-53">
                      <el-switch v-model="CurrentDiyFieldModel.Config.FileUpload.Limit" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'FileUpload'" label="多文件上传" size="mini" key="design-52">
                      <el-switch v-model="CurrentDiyFieldModel.Config.FileUpload.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'FileUpload' && CurrentDiyFieldModel.Config.FileUpload.Multiple == true" label="最大允许上传个数" size="mini" key="design-51">
                      <el-input-number v-model="CurrentDiyFieldModel.Config.FileUpload.MaxCount" :min="1" label="" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'FileUpload'" label="上传说明" size="mini" key="design-50">
                      <el-input v-model="CurrentDiyFieldModel.Config.FileUpload.Tips" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'FileUpload'" label="最大体积" size="mini" key="design-49">
                      <el-input v-model="CurrentDiyFieldModel.Config.FileUpload.MaxSize" placeholder="支持小数点">
                        <template slot="append">M</template>
                      </el-input>
                    </el-form-item>

                    <el-form-item class="form-item-top" v-if="CurrentDiyFieldModel.Component == 'ImgUpload'" label="禁止匿名访问" size="mini" key="design-48">
                      <el-switch v-model="CurrentDiyFieldModel.Config.ImgUpload.Limit" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'ImgUpload'" label="多图片上传" size="mini" key="design-47">
                      <el-switch v-model="CurrentDiyFieldModel.Config.ImgUpload.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'ImgUpload' && CurrentDiyFieldModel.Config.ImgUpload.Multiple == true" label="最大允许上传个数" size="mini" key="design-46">
                      <el-input-number v-model="CurrentDiyFieldModel.Config.ImgUpload.MaxCount" :min="1" label="" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'ImgUpload'" label="上传说明" size="mini" key="design-45">
                      <el-input v-model="CurrentDiyFieldModel.Config.ImgUpload.Tips" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'ImgUpload'" label="是否压缩" size="mini" key="design-44">
                      <el-switch v-model="CurrentDiyFieldModel.Config.ImgUpload.Preview" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'ImgUpload'" label="最大体积" size="mini" key="design-43">
                      <el-input v-model="CurrentDiyFieldModel.Config.ImgUpload.MaxSize" placeholder="支持小数点">
                        <template slot="append">M</template>
                      </el-input>
                    </el-form-item>

                    <!-- <el-form-item
                                        label="生成方式"
                                        size="mini"
                                        v-if="CurrentDiyFieldModel.Component == 'DateTime'
                                            ">
                                        <el-radio-group v-model="CurrentDiyFieldModel.Config.DateTimeType">
                                            <el-radio :label="'date'">日期时间</el-radio>
                                            <el-radio :label="'datetime'">日期时间</el-radio>
                                        </el-radio-group>
                                    </el-form-item> -->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'AutoNumber'" label="固定前缀" size="mini" key="design-42">
                      <el-input v-model="CurrentDiyFieldModel.Config.AutoNumberFixed" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'AutoNumber'" label="默认位数" size="mini" key="design-41">
                      <el-input-number v-model="CurrentDiyFieldModel.Config.AutoNumberLength" :min="1" label="" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'AutoNumber'" label="关联列" size="mini" key="design-40">
                      <!-- <el-input v-model="CurrentDiyFieldModel.Config.AutoNumberFields" /> -->
                      <el-select v-model="CurrentDiyFieldModel.Config.AutoNumberFields" filterable multiple clearable placeholder="">
                        <el-option v-for="item in $refs.fieldForm.DiyFieldList" :key="item.Id" :label="item.Label + ' - ' + item.Name" :value="item.Id" />
                      </el-select>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'AutoNumber'" label="数据规则" size="mini" key="design-39">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.AutoNumber.DataRule">
                        <el-radio :label="''">含已删除</el-radio>
                        <el-radio :label="'NoDeleted'">不含已删除</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'AutoNumber'" label="生成规则" size="mini" key="design-38">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.AutoNumber.CreateRule">
                        <el-radio :label="''">数据总数+1</el-radio>
                        <el-radio :label="'MaxValueAdd1'">最大值+1</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'DateTime'" label="显示格式" size="mini" key="design-37">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.DateTimeType">
                        <el-radio :label="'date'">年月日</el-radio>
                        <el-radio :label="'datetime'">年月日 时分秒</el-radio>
                        <el-radio :label="'datetime_HHmm'">年月日 时分</el-radio>
                        <el-radio :label="'HH:mm'">时分</el-radio>
                        <el-radio :label="'HH:mm:ss'">时分秒</el-radio>
                        <!-- <el-radio :label="'datetime_HH'">年月日 时</el-radio> -->
                        <el-radio :label="'month'">年月</el-radio>
                        <el-radio :label="'week'">年周</el-radio>
                        <el-radio :label="'year'">年</el-radio>
                        <el-radio :label="'dates'">多选天</el-radio>
                        <el-radio :label="'months'">多选月</el-radio>
                        <el-radio :label="'years'">多选年</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="密码输入" size="mini" key="design-36">
                      <el-switch v-model="CurrentDiyFieldModel.Config.TextShowPassword" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text' || CurrentDiyFieldModel.Component == 'AutoNumber'" label="Icon图标" size="mini" key="design-35">
                      <!-- <el-input v-model="CurrentDiyFieldModel.Config.TextIcon"></el-input> -->
                      <span class="hand" style="display: inline-block; padding: 5px; cursor: pointer" @click="$refs.fasTextIcon.show()">
                        <i :class="DiyCommon.IsNull(CurrentDiyFieldModel.Config.TextIcon) ? 'far fa-smile-wink' : CurrentDiyFieldModel.Config.TextIcon" />
                      </span>
                      <Fontawesome ref="fasTextIcon" :model.sync="CurrentDiyFieldModel.Config.TextIcon" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="显示图标" size="mini" key="design-200">
                      <el-switch v-model="CurrentDiyFieldModel.Config.ShowIcon" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="图标位置" size="mini" key="design-34">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.TextIconPosition">
                        <el-radio :label="'left'">左边</el-radio>
                        <el-radio :label="'right'">右边</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="复合文字" size="mini" key="design-33">
                      <el-input v-model="CurrentDiyFieldModel.Config.TextApend" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="文字位置" size="mini" key="design-32">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.TextApendPosition">
                        <el-radio :label="'left'">左边</el-radio>
                        <el-radio :label="'right'">右边</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="插槽按钮" size="mini" key="design-201">
                      <el-switch v-model="CurrentDiyFieldModel.Config.ShowButton" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="插槽只读" size="mini" key="design-202">
                      <el-switch v-model="CurrentDiyFieldModel.Config.ReadOnlyButton" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Text'" label="弹出表格Id" size="mini" key="design-203">
                      <el-input v-model="CurrentDiyFieldModel.Config.OpenTableId" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Divider'" class="form-item-top" label="文字位置" size="mini" key="design-31">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.DividerPosition">
                        <el-radio :label="'left'">左边</el-radio>
                        <el-radio :label="'center'">中间</el-radio>
                        <el-radio :label="'right'">右边</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Divider'" label="图标" size="mini" key="design-30">
                      <span class="hand" style="display: inline-block; padding: 5px; cursor: pointer" @click="$refs.refDividerIcon.show()">
                        <i :class="DiyCommon.IsNull(CurrentDiyFieldModel.Config.Divider.Icon) ? 'far fa-smile-wink' : CurrentDiyFieldModel.Config.Divider.Icon" />
                      </span>
                      <Fontawesome ref="refDividerIcon" :model.sync="CurrentDiyFieldModel.Config.Divider.Icon" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Divider'" class="form-item-top" label="标签样式" size="mini" key="design-29">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.Divider.Tag">
                        <el-radio :label="''">无</el-radio>
                        <el-radio :label="'primary'">默认样式</el-radio>
                        <el-radio :label="'success'">成功样式</el-radio>
                        <el-radio :label="'info'">信息样式</el-radio>
                        <el-radio :label="'warning'">警告样式</el-radio>
                        <el-radio :label="'danger'">危险样式</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'CodeEditor'" label="默认高度" size="mini" key="design-28">
                      <el-input v-model="CurrentDiyFieldModel.Config.CodeEditor.Height">
                        <template slot="append">px</template>
                      </el-input>
                    </el-form-item>

                    <!-- <el-form-item
                                        label="计算公式"
                                        size="mini"

                                        v-if="CurrentDiyFieldModel.Component == 'NumberText'
                                            ">
                                        <div class="clear">
                                            <el-input
                                                type="textarea"
                                                v-model="CurrentDiyFieldModel.Config.NumberTextMath">
                                            </el-input>
                                        </div>
                                    </el-form-item> -->

                    <!-- v-if="
                                            CurrentDiyFieldModel.Component == 'NumberText'
                                            || CurrentDiyFieldModel.Component == 'Select'
                                            " -->
                    <el-form-item v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config)" size="mini" class="form-item-top" key="design-27">
                      <!-- slot="label" -->
                      <!-- OpenV8CodeEditor('V8Code', 'Field', 'Config') -->
                      <div style="float: none; margin-bottom: 10px; cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyFieldModel.Config.V8Code')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        值变更事件V8引擎代码<span style="color: red">(JavaScript)</span>
                      </div>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyFieldModel.Config.V8Code"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <!--外部显示一个Timeline时间线,上面一个编辑按钮，点击后打开V8设计器，//Tips://[{Namr:'回写数据',Description:'描述'},{....}]-->
                        <DiyV8Design
                          ref="refConfigV8Code"
                          :key="'refConfigV8Code_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyFieldModel.Config.V8Code"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>
                    <!--多行文本、单行文本-->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Textarea' || CurrentDiyFieldModel.Component == 'Text'" size="mini" class="form-item-top" key="design-26">
                      <!-- OpenV8CodeEditor('V8CodeBlur', 'Field', 'Config') -->
                      <div style="float: none; margin-bottom: 10px; cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyFieldModel.Config.V8CodeBlur')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        失去焦点V8引擎代码<span style="color: red">(JavaScript)</span>
                      </div>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyFieldModel.Config.V8CodeBlur"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          ref="refConfigV8CodeBlur"
                          :key="'refConfigV8CodeBlur_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyFieldModel.Config.V8CodeBlur"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>
                    <el-form-item
                      v-if="CurrentDiyFieldModel.Component == 'NumberText' || CurrentDiyFieldModel.Component == 'Textarea' || CurrentDiyFieldModel.Component == 'Text'"
                      size="mini"
                      class="form-item-top"
                      key="design-25"
                    >
                      <!-- OpenV8CodeEditor('KeyupV8Code', 'Field') -->
                      <div style="float: none; margin-bottom: 10px; cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyFieldModel.KeyupV8Code')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        键盘事件V8引擎代码<span style="color: red">(JavaScript)</span>
                      </div>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyFieldModel.KeyupV8Code"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          ref="refKeyupV8Code"
                          :key="'refKeyupV8Code_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyFieldModel.KeyupV8Code"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Textarea'" label="默认行数" size="mini" key="design-24">
                      <el-input-number v-model="CurrentDiyFieldModel.Config.Textarea.DefaultRows" :min="1" label="" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'NumberText'" label="显示按钮" size="mini" key="design-23">
                      <el-switch v-model="CurrentDiyFieldModel.Config.NumberTextBtn" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'NumberText' && CurrentDiyFieldModel.Config.NumberTextBtn == true" key="design-22" label="按钮位置" size="mini">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.NumberTextBtnPosition">
                        <el-radio :label="''">左右两边</el-radio>
                        <el-radio :label="'right'">右边</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <!-- && CurrentDiyFieldModel.Config.NumberTextBtn ==  true -->
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'NumberText'" label="步数" size="mini" key="design-21">
                      <el-input-number v-model="CurrentDiyFieldModel.Config.NumberTextStep" :min="0" label="" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'NumberText'" label="小数点" size="mini" key="design-20">
                      <el-input-number v-model="CurrentDiyFieldModel.Config.NumberTextPrecision" :min="0" :max="6" label="" />
                    </el-form-item>

                    <el-form-item
                      v-if="
                        CurrentDiyFieldModel.Component == 'Select' ||
                        CurrentDiyFieldModel.Component == 'MultipleSelect' ||
                        CurrentDiyFieldModel.Component == 'Radio' ||
                        CurrentDiyFieldModel.Component == 'Checkbox' ||
                        CurrentDiyFieldModel.Component == 'Autocomplete'
                      "
                      size="mini"
                      key="design-17"
                      class="form-item-top"
                    >
                      <div class="form-item-label-slot">显示对应字段</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectLabel" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Select' || CurrentDiyFieldModel.Component == 'Radio'" key="design-18" size="mini" class="form-item-top">
                      <div class="form-item-label-slot">
                        <el-popover placement="left" width="400" trigger="hover">
                          <div>
                            说明：
                            <br />
                            Json：会将每个选项的所有字段值存入数据库，且[存储对应字段]设置无效。
                            <br />
                            字段：只会将[存储对应字段]的值存入数据库。
                          </div>
                          <el-button slot="reference" type="text" size="mini" style="padding: 0; margin-right: 5px">
                            <i class="fas fa-info-circle" />
                          </el-button>
                        </el-popover>

                        存储形式
                      </div>
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.SelectSaveFormat">
                        <el-radio :label="'Text'">字段</el-radio>
                        <el-radio :label="'Json'">Json</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <el-form-item
                      v-if="
                        CurrentDiyFieldModel.Component == 'Select' ||
                        CurrentDiyFieldModel.Component == 'MultipleSelect' ||
                        CurrentDiyFieldModel.Component == 'Radio' ||
                        CurrentDiyFieldModel.Component == 'Checkbox'
                      "
                      size="mini"
                      key="design-19"
                      class="form-item-top"
                    >
                      <div class="form-item-label-slot">存储对应字段</div>
                      <el-input v-model="CurrentDiyFieldModel.Config.SelectSaveField" />
                    </el-form-item>

                    <el-form-item v-if="CurrentDiyFieldModel.Component == 'Select' || CurrentDiyFieldModel.Component == 'MultipleSelect'" label="开启搜索" size="mini">
                      <el-switch v-model="CurrentDiyFieldModel.Config.EnableSearch" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item
                      v-if="
                        CurrentDiyFieldModel.Component == 'Select' ||
                        CurrentDiyFieldModel.Component == 'MultipleSelect' ||
                        CurrentDiyFieldModel.Component == 'Radio' ||
                        CurrentDiyFieldModel.Component == 'Checkbox' ||
                        (CurrentDiyFieldModel.Component == 'Text' && CurrentDiyFieldModel.Config.TextAutocomplete) ||
                        CurrentDiyFieldModel.Component == 'Autocomplete' ||
                        CurrentDiyFieldModel.Component == 'Cascader' ||
                        CurrentDiyFieldModel.Component == 'SelectTree'
                      "
                      key="design-7"
                      class="form-item-top"
                      size="mini"
                    >
                      <!-- <el-select
                                            v-model="CurrentDiyFieldModel.Config.DataSource"
                                            clearable
                                            placeholder="">
                                            <el-option
                                                label="普通数据"
                                                :value="'Data'" />
                                            <el-option
                                                label="Sql数据源"
                                                :value="'Sql'" />
                                        </el-select> -->
                      <div class="form-item-label-slot">数据源</div>
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.DataSource">
                        <el-radio :label="'Data'">普通数据</el-radio>
                        <el-radio :label="'Sql'">Sql数据源</el-radio>
                        <!-- <el-radio :label="'Api'">Api数据源</el-radio> -->
                        <el-radio :label="'DataSource'">数据源引擎</el-radio>
                        <el-radio :label="'ApiEngine'">接口引擎</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <!--数据源引擎-->
                    <!-- “毛总，这里是重复代码” --20205-03-30注释  --by Anderson-->
                    <!-- <el-form-item
                                        v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config)
                                                && CurrentDiyFieldModel.Config.DataSource == 'DataSource'"
                                        size="mini"
                                        key="design-8"
                                        class="form-item-top"
                                        >
                                        <div class="form-item-label-slot" slot="label">
                                            远程搜索（需打开）
                                        </div>
                                        <el-switch
                                            v-model="CurrentDiyFieldModel.Config.DataSourceSqlRemote"
                                            active-color="#ff6c04"
                                            inactive-color="#ccc" />
                                    </el-form-item> -->
                    <el-form-item v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config) && CurrentDiyFieldModel.Config.DataSource == 'DataSource'" size="mini" key="design-6" class="form-item-top">
                      <div class="form-item-label-slot" slot="label">请选择数据源</div>
                      <el-select v-model="CurrentDiyFieldModel.Config.DataSourceId" clearable filterable value-key="Id" placeholder="搜索字段">
                        <el-option v-for="item in SysDataSourceList" :key="item.Id" :label="item.DataSourceName" :value="item.Id">
                          <span style="float: left">{{ item.DataSourceName }}</span>
                          <span style="float: right; color: #8492a6; font-size: 13px">{{ item.DataSourceKey }}</span>
                        </el-option>
                      </el-select>
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Config && CurrentDiyFieldModel.Config.DataSource == 'ApiEngine'" size="mini" key="design-6" class="form-item-top">
                      <div class="form-item-label-slot" slot="label">请选择接口引擎</div>
                      <el-select v-model="CurrentDiyFieldModel.Config.DataSourceApiEngineKey" clearable filterable value-key="Id" placeholder="搜索字段">
                        <el-option v-for="item in ApiEngineList" :key="item.ApiEngineKey" :label="item.ApiName" :value="item.ApiEngineKey">
                          <span style="float: left">{{ item.ApiName }}</span>
                          <span style="float: right; color: #8492a6; font-size: 13px">{{ item.ApiEngineKey }}</span>
                        </el-option>
                      </el-select>
                    </el-form-item>
                    <!-- (
                                            CurrentDiyFieldModel.Component == 'Select'
                                            || CurrentDiyFieldModel.Component == 'MultipleSelect'
                                            || CurrentDiyFieldModel.Component == 'Radio'
                                            || CurrentDiyFieldModel.Component == 'Checkbox'
                                            || (CurrentDiyFieldModel.Component == 'Text' && CurrentDiyFieldModel.Config.TextAutocomplete)
                                            )
                                            &&  -->
                    <el-form-item
                      v-if="
                        !DiyCommon.IsNull(CurrentDiyFieldModel.Config) &&
                        (CurrentDiyFieldModel.Config.DataSource == 'Sql' || CurrentDiyFieldModel.Config.DataSource == 'DataSource' || CurrentDiyFieldModel.Config.DataSource == 'ApiEngine')
                      "
                      size="mini"
                      key="design-8"
                      class="form-item-top"
                    >
                      <!--  -->
                      <div class="form-item-label-slot" slot="label">
                        <el-popover placement="left" width="400" trigger="hover">
                          <div>
                            注意：
                            <br />
                            当Sql数据源数据量较大时、或是持续增长的数据，需要开启远程搜索，以提高加载速度，并且需要在sql数据源中配置Keyword参数、limit前多少条。如：select Id,Name from Table where Name
                            like '%$Keyword$%' limit 0,10
                          </div>
                          <el-button slot="reference" type="text" size="mini" style="padding: 0; margin-right: 5px">
                            <i class="fas fa-info-circle" />
                          </el-button>
                        </el-popover>
                        远程搜索
                      </div>
                      <el-switch v-model="CurrentDiyFieldModel.Config.DataSourceSqlRemote" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <!-- CurrentDiyFieldModel.Component == 'Radio'
                                    || CurrentDiyFieldModel.Component == 'Checkbox'
                                    ||
                                        (
                                            (
                                            CurrentDiyFieldModel.Component == 'Select'
                                            || CurrentDiyFieldModel.Component == 'MultipleSelect'
                                            )
                                            && CurrentDiyFieldModel.Config.DataSource == 'Data'
                                        ) -->
                    <el-form-item v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config) && CurrentDiyFieldModel.Config.DataSource == 'Data'" key="design-1" class="form-item-top" size="mini">
                      <div class="form-item-label-slot">普通数据</div>
                      <!-- <el-tag
                                            v-for="(item, i) in CurrentDiyFieldModel.Data"
                                            :key="item"
                                            closable
                                            :disable-transitions="false"
                                            @close="CurrentDiyFieldModel.Data.splice(i, 1)"
                                            style="margin-right:5px;">
                                            {{ item }}
                                        </el-tag> -->
                      <el-input v-for="(item, i) in CurrentDiyFieldModel.Data" :key="CurrentDiyFieldModel.Name + 'dic' + i" v-model="CurrentDiyFieldModel.Data[i]" style="margin-bottom: 2px">
                        <el-button slot="prepend" icon="el-icon-rank"></el-button>
                        <el-button slot="append" @click="CurrentDiyFieldModel.Data.splice(i, 1)" icon="el-icon-delete"></el-button>
                      </el-input>

                      <!-- <el-input
                                            v-if="CurrentDiyFieldModel.Config.KeysAddVisible"
                                            v-model="CurrentDiyFieldModel.Config.KeysAddVModel"
                                            class="input-new-tag"
                                            size="mini"
                                            @keyup.enter.native="AddKeys"
                                            @blur="AddKeys" /> -->

                      <el-input v-model="CurrentDiyFieldModel.Config.KeysAddVModel">
                        <el-button disabled style="color: #ccc" slot="prepend" icon="el-icon-rank"></el-button>
                        <el-button slot="append" @click="AddKeys" icon="el-icon-plus"></el-button>
                      </el-input>
                      <!-- <el-button
                                            v-else
                                            class="button-new-tag"
                                            icon="el-icon-plus"
                                            size="mini"
                                            @click="CurrentDiyFieldModel.Config.KeysAddVisible = true">New</el-button> -->

                      <el-button
                        v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Data) && CurrentDiyFieldModel.Data.length > 0"
                        key="design-2"
                        class="button-new-tag"
                        icon="el-icon-delete"
                        size="mini"
                        @click="ClearCurrentDiyFieldModelData"
                        >清空</el-button
                      >
                    </el-form-item>

                    <!-- (CurrentDiyFieldModel.Component == 'Select'
                                            || CurrentDiyFieldModel.Component == 'MultipleSelect')
                                            &&  -->
                    <el-form-item v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config) && CurrentDiyFieldModel.Config.DataSource == 'Sql'" key="design-3" class="form-item-top" size="mini">
                      <div class="form-item-label-slot">
                        <el-popover placement="left" width="400" trigger="hover">
                          <div>
                            注意：
                            <br />
                            当Sql数据源数据量较大时、或是持续增长的数据，需要开启远程搜索，以提高加载速度，并且需要在sql数据源中配置Keyword参数、limit前多少条。如：select Id,Name from Table where Name
                            like '%$Keyword$%' limit 0,10
                          </div>
                          <el-button slot="reference" type="text" size="mini" style="padding: 0; margin-right: 5px">
                            <i class="fas fa-info-circle" />
                          </el-button>
                        </el-popover>
                        Sql数据源
                      </div>
                      <el-input rows="5" v-model="CurrentDiyFieldModel.Config.Sql" type="textarea" />
                    </el-form-item>

                    <el-form-item v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config) && CurrentDiyFieldModel.Config.DataSource == 'Api'" key="design-4" class="form-item-top" size="mini">
                      <div class="form-item-label-slot">
                        <el-popover placement="left" width="400" trigger="hover">
                          <div>
                            注意：
                            <br />
                            支持$CurrentUser.Id$等参数
                          </div>
                          <el-button slot="reference" type="text" size="mini" style="padding: 0; margin-right: 5px">
                            <i class="fas fa-info-circle" />
                          </el-button>
                        </el-popover>
                        Api数据源
                      </div>
                      <el-input rows="5" placeholder="https://" v-model="CurrentDiyFieldModel.Config.Api" type="textarea" />
                    </el-form-item>
                  </el-form>
                  <el-divider content-position="left"><i class="el-icon-s-tools"></i> 其它设置</el-divider>
                  <el-form class="form-setting" size="mini" :model="CurrentDiyFieldModel" label-width="85px" label-position="left">
                    <el-form-item label="代码标记" size="mini">
                      <el-input v-model="CurrentDiyFieldModel.Code" />
                    </el-form-item>
                    <!-- <el-form-item
                                    label="类型"
                                    size="mini">
                                    <el-autocomplete
                                        v-model="CurrentDiyFieldModel.Type"
                                        :fetch-suggestions="querySearch"
                                    ></el-autocomplete>
                                </el-form-item> -->
                    <el-form-item label="必填" size="mini">
                      <el-switch v-model="CurrentDiyFieldModel.NotEmpty" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item label="默认值" size="mini">
                      <el-input v-model="CurrentDiyFieldModel.DefaultValue" placeholder="特殊组件默认值也可填写json字符串" />
                    </el-form-item>
                    <el-form-item label="可见" size="mini">
                      <el-switch v-model="CurrentDiyFieldModel.Visible" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item label="移动端可见" size="mini">
                      <el-switch v-model="CurrentDiyFieldModel.AppVisible" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item label="只读" size="mini">
                      <el-switch v-model="CurrentDiyFieldModel.Readonly" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item label="唯一" size="mini">
                      <el-switch v-model="CurrentDiyFieldModel.Unique" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyFieldModel.Unique && CurrentDiyFieldModel.Config && CurrentDiyFieldModel.Config.Unique" key="design-5" label="唯一方式" size="mini">
                      <el-radio-group v-model="CurrentDiyFieldModel.Config.Unique.Type">
                        <el-radio :label="'Alone'">单独唯一</el-radio>
                        <el-radio :label="'All'">同时唯一</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <el-form-item class="form-item-top" size="mini">
                      <div class="form-item-label-slot">绑定角色</div>
                      <el-select v-model="CurrentDiyFieldModel.BindRole" clearable multiple placeholder="">
                        <el-option v-for="item in SysRoleList" :key="item.Id" :label="item.Name" :value="item.Id" />
                      </el-select>
                    </el-form-item>

                    <el-form-item size="mini" class="form-item-top">
                      <div class="form-item-label-slot">表单占宽</div>
                      <div class="clear">
                        <el-radio-group v-model="CurrentDiyFieldModel.FormWidth">
                          <el-radio :label="24">100%</el-radio>
                          <el-radio :label="12">50%</el-radio>
                          <el-radio :label="8">33%</el-radio>
                          <el-radio :label="''">跟随表单设置</el-radio>
                        </el-radio-group>
                      </div>
                    </el-form-item>
                    <el-form-item size="mini" class="form-item-top">
                      <!-- OpenV8CodeEditor('V8TmpEngineForm', 'Field') -->
                      <span style="float: none; margin-bottom: 10px; cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyFieldModel.V8TmpEngineForm')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        表单V8模板引擎<span style="color: red">(JavaScript)</span>
                      </span>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyFieldModel.V8TmpEngineForm"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          ref="refFormV8Temp"
                          :key="'refFormV8Temp_' + CurrentDiyFieldModel.Id"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyFieldModel.V8TmpEngineForm"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>

                    <el-form-item label="表格占宽" size="mini">
                      <el-input-number v-model="CurrentDiyFieldModel.TableWidth" :min="50" :max="500" label="单位px" />
                    </el-form-item>
                    <el-form-item size="mini" class="form-item-top">
                      <!-- OpenV8CodeEditor('V8TmpEngineTable', 'Field') -->
                      <span style="float: none; margin-bottom: 10px; cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyFieldModel.V8TmpEngineTable')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        表格V8模板引擎<span style="color: red">(JavaScript)</span>
                      </span>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyFieldModel.V8TmpEngineTable"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          ref="refTableV8Temp"
                          :key="'refTableV8Temp_' + CurrentDiyFieldModel.Id"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyFieldModel.V8TmpEngineTable"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>

                    <!-- <el-form-item
                                    v-if="CurrentDiyFieldModel.Component == 'DateTime'
                                            "
                                    label=""
                                    type="datetime"
                                    :value-format="'yyyy-MM-dd HH:mm:ss'"
                                    size="mini">
                                    <el-input
                                        type="textarea"
                                        v-model="CurrentDiyFieldModel.Config.Sql"></el-input>
                                </el-form-item> -->
                  </el-form>
                </div>
              </el-tab-pane>

              <el-tab-pane name="Form">
                <span slot="label"><i class="fab fa-wpforms marginRight5" />表单属性</span>

                <div class="div-scroll diy-design-right-form" style="height: calc(100vh - 120px)">
                  <!-- label-width="80px" -->
                  <el-form class="form-setting" size="mini" :model="CurrentDiyTableModel" label-position="left">
                    <el-form-item label="表名、说明" size="mini">
                      <el-input
                        :value="CurrentDiyTableModel.Name + ' (' + CurrentDiyTableModel.Description + ')' + ' (' + CurrentDiyTableModel.Id + ')'"
                        disabled
                        type="textarea"
                        rows="3"
                        placeholder=""
                      />
                    </el-form-item>
                    <el-form-item label="访问权限（前端）" size="mini">
                      <el-select v-model="CurrentDiyTableModel.BindRole" clearable multiple placeholder="请选择">
                        <el-option v-for="item in SysRoleList" :key="item.Id" :label="item.Name" :value="item.Id" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="电脑端布局" size="mini">
                      <el-radio-group v-model="CurrentDiyTableModel.Column">
                        <el-radio :label="1">单列</el-radio>
                        <el-radio :label="2">双列</el-radio>
                        <el-radio :label="3">三列</el-radio>
                        <el-radio :label="4">四列</el-radio>
                        <el-radio :label="6">六列</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <el-form-item label="表单分组" size="mini">
                      <div class="clear">
                        <el-table :data="CurrentDiyTableModel.Tabs" style="width: 100%">
                          <el-table-column :label="$t('Msg.Sort')" width="85">
                            <template slot-scope="scope">
                              <el-input-number v-model="scope.row.Sort" :width="62"  controls-position="right"  style="width: 62px" placeholder="" />
                            </template>
                          </el-table-column>

                          <el-table-column :label="$t('Msg.Name')">
                            <template slot-scope="scope">
                              <el-input v-model="scope.row.Name" placeholder="" />
                            </template>
                          </el-table-column>

                          <el-table-column width="80" :label="$t('Msg.Action')">
                            <template slot-scope="scope">
                              <!-- <el-button
                                                                @click="AddDiyTableTab(scope.row)"
                                                                type="primary"
                                                                size="mini">保存</el-button> -->
                              <span class="hand" style="display: inline-block; padding: 5px; cursor: pointer" @click="$refs['fasTabsIcon_' + scope.$index].show()">
                                <i :class="DiyCommon.IsNull(scope.row.Icon) ? 'far fa-smile-wink' : scope.row.Icon" />
                              </span>
                              <Fontawesome :ref="'fasTabsIcon_' + scope.$index" :model.sync="scope.row.Icon" />
                              <el-button type="text" icon="el-icon-delete" size="mini" @click="DelDiyTableTab(scope.row)" style="margin-left: 5px">
                                <!-- {{ $t('Msg.Delete') }} -->
                              </el-button>
                            </template>
                          </el-table-column>
                        </el-table>
                      </div>
                      <div class="clear marginTop10">
                        <el-form :inline="true" :model="CurrentDiyTableTabModel" class="demo-form-inline">
                          <el-form-item label="">
                            <el-input-number v-model="CurrentDiyTableTabModel.Sort" :width="62" style="width: 62px"  controls-position="right" :placeholder="$t('Msg.Sort')" />
                          </el-form-item>
                          <el-form-item label="">
                            <el-input v-model="CurrentDiyTableTabModel.Name" style="width: 100px" :placeholder="$t('Msg.Name')" />
                          </el-form-item>
                          <el-form-item label="">
                            <!-- <el-input
                                                        style="width:60px;"
                                                        v-model="CurrentDiyTableTabModel.Icon"
                                                        :placeholder="$t('Msg.Icon')">
                                                    </el-input> -->
                            <span class="hand" style="display: inline-block; padding: 5px; cursor: pointer" @click="$refs.fasCDTTMIcon.show()">
                              <i :class="DiyCommon.IsNull(CurrentDiyTableTabModel.Icon) ? 'far fa-smile-wink' : CurrentDiyTableTabModel.Icon" />
                            </span>
                            <Fontawesome ref="fasCDTTMIcon" :model.sync="CurrentDiyTableTabModel.Icon" />
                          </el-form-item>
                          <el-form-item>
                            <el-button style="width: 45px" icon="el-icon-plus" type="text" @click="AddDiyTableTab">{{ $t("Msg.Add") }}</el-button>
                          </el-form-item>
                        </el-form>
                      </div>
                    </el-form-item>

                    <el-form-item label="分组标签位置" size="mini">
                      <el-radio-group v-model="CurrentDiyTableModel.TabsPosition">
                        <el-radio :label="'left'">左则</el-radio>
                        <el-radio :label="'top'">上边</el-radio>
                        <el-radio :label="'bottom'">下边</el-radio>
                        <el-radio :label="'right'">右侧</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <el-form-item label="Tab分栏" size="mini">
                      <el-switch v-model="CurrentDiyTableModel.TabsTop" :active-value="1" :inactive-value="0" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                    <!-- <el-form-item
                                    label="表格底部文案"
                                    size="mini">
                                    <el-button
                                        type="primary"
                                        icon="el-icon-setting"
                                        @click="OpenDiyTableRow()">{{$t('Msg.Setting')}}</el-button>
                                </el-form-item> -->

                    <el-form-item label="表单打开方式" size="mini">
                      <div class="clear">
                        <el-radio-group v-model="CurrentDiyTableModel.FormOpenType">
                          <el-radio :label="'Dialog'">弹窗</el-radio>
                          <el-radio :label="'Drawer'">抽屉</el-radio>
                          <el-radio :label="'Page'">新页面</el-radio>
                        </el-radio-group>
                      </div>
                    </el-form-item>
                    <el-form-item label="弹窗/抽屉宽度" size="mini">
                      <div class="clear">
                        <el-input v-model="CurrentDiyTableModel.FormOpenWidth" type="text" placeholder="768px/70%" rows="5" />
                      </div>
                    </el-form-item>

                    <el-form-item label="标签对齐方式" size="mini">
                      <div class="clear">
                        <el-radio-group v-model="CurrentDiyTableModel.FormLabelPosition">
                          <el-radio :label="'left'">左对齐</el-radio>
                          <el-radio :label="'right'">右对齐</el-radio>
                          <el-radio :label="'top'">顶部对齐</el-radio>
                        </el-radio-group>
                      </div>
                    </el-form-item>

                    <el-form-item label="输入框样式" size="mini">
                      <div class="clear">
                        <el-radio-group v-model="CurrentDiyTableModel.InputBorderStyle">
                          <el-radio :label="'Line'">线条</el-radio>
                          <el-radio :label="'Border'">边框</el-radio>
                        </el-radio-group>
                      </div>
                    </el-form-item>

                    <!-- <el-form-item
                                        label="字段边框样式"
                                        size="mini">
                                        <div class="clear">
                                            <el-radio-group v-model="CurrentDiyTableModel.FieldBorder">
                                                <el-radio :label="'Line'">线</el-radio>
                                                <el-radio :label="'Border'">边框</el-radio>
                                            </el-radio-group>
                                        </div>
                                    </el-form-item> -->

                    <el-form-item label="表内编辑" size="mini">
                      <el-switch v-model="CurrentDiyTableModel.TableInEdit" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item v-if="DiyCommon.IsArray(CurrentDiyTableModel.RowAction)" label="行操作" key="design-9" size="mini">
                      <div style="clear: both">
                        <el-checkbox-group v-model="CurrentDiyTableModel.RowAction">
                          <!-- true-label="Detail" -->
                          <el-checkbox :label="$t('Msg.Detail')" />
                          <el-checkbox :label="$t('Msg.Edit')" />
                          <el-checkbox :label="$t('Msg.Del')" />
                        </el-checkbox-group>
                      </div>
                    </el-form-item>
                    <!--树形结构-->
                    <el-form-item label="树形结构" size="mini">
                      <!-- :disabled="true" -->
                      <el-switch v-model="CurrentDiyTableModel.IsTree" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyTableModel.IsTree" label="树形结构父级字段（一般指ParentId，必填）" key="design-10" size="mini">
                      <el-input v-model="CurrentDiyTableModel.TreeParentField" placeholder="" />
                    </el-form-item>
                    <el-form-item
                      v-if="CurrentDiyTableModel.IsTree"
                      key="design-11"
                      label="树形结构完整父级字段（一般指FullPath/ParentIds，如：parentid1,parentid2,parentid3,【以英文逗号结尾】，必填）"
                      size="mini"
                    >
                      <el-input v-model="CurrentDiyTableModel.TreeParentFields" placeholder="" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyTableModel.IsTree" key="design-12" label="懒加载" size="mini">
                      <el-switch v-model="CurrentDiyTableModel.TreeLazy" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="CurrentDiyTableModel.IsTree" label="判断是否有子级的字段（可选，懒加载用到）" key="design-13" size="mini">
                      <el-input v-model="CurrentDiyTableModel.TreeHasChildren" placeholder="" />
                    </el-form-item>
                    <!--树形结构   END-->

                    <el-form-item label="启用缓存(建议数据量较少的表开启缓存)" size="mini">
                      <el-switch v-model="CurrentDiyTableModel.EnableCache" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item v-if="!DiyCommon.IsNull($refs.fieldForm) && CurrentDiyTableModel.EnableCache" label="分级缓存（以某字段值做为缓存key）" key="design-14" size="mini">
                      <el-select v-model="CurrentDiyTableModel.CacheParentKey" filterable clearable placeholder="">
                        <el-option v-for="(item, index) in $refs.fieldForm.DiyFieldList" :key="'fjhc_' + item.Id + index" :label="item.Label + ' - ' + item.Name" :value="item.Name" />
                      </el-select>
                    </el-form-item>

                    <el-form-item label="数据加密传输" size="mini">
                      <el-switch v-model="CurrentDiyTableModel.DataEncryptTransfer" :disabled="true" :active-value="1" :inactive-value="0" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item label="数据加密存储" size="mini">
                      <el-switch v-model="CurrentDiyTableModel.DataEncryptSave" :disabled="true" :active-value="1" :inactive-value="0" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>

                    <el-form-item size="mini" class="form-item-top">
                      <!-- slot="label" -->
                      <!-- OpenV8CodeEditor('InFormV8', 'Table') -->
                      <span style="float: none; margin-bottom: 10px; cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyTableModel.InFormV8')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        前端进入表单V8事件
                      </span>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyTableModel.InFormV8"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          ref="refDiyV8Design_InFormV8"
                          :key="'refDiyV8Design_InFormV8_' + CurrentDiyFieldModel.Id"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyTableModel.InFormV8"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>

                    <el-form-item size="mini" class="form-item-top">
                      <!-- slot="label" -->
                      <!-- OpenV8CodeEditor('SubmitFormV8', 'Table') -->
                      <span style="float: none; margin-bottom: 10px; cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyTableModel.SubmitFormV8')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        前端提交表单前V8事件
                      </span>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyTableModel.SubmitFormV8"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          ref="refSubmitFormV8"
                          :key="'refSubmitFormV8_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyTableModel.SubmitFormV8"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>

                    <el-form-item size="mini" class="form-item-top">
                      <!-- slot="label" -->
                      <!-- OpenV8CodeEditor('OutFormV8', 'Table') -->
                      <!-- class="form-item-label-slot" -->
                      <span style="cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyTableModel.OutFormV8')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        前端离开表单后V8事件
                      </span>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyTableModel.OutFormV8"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          ref="refOutFormV8"
                          :key="'refOutFormV8_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyTableModel.OutFormV8"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>
                    <el-form-item size="mini">
                      <!-- slot="label" -->
                      <!-- OpenV8CodeEditor('OutFormV8', 'Table') -->
                      <!-- class="form-item-label-slot" -->
                      <span style="cursor: pointer" @click="OpenV8CodeEditor('CurrentDiyTableModel.ServerDataV8')">
                        <i class="fas fa-code hand" style="margin-right: 3px" />
                        服务器端数据处理V8事件
                      </span>
                      <div class="clear">
                        <!-- <el-input
                                                v-model="CurrentDiyTableModel.ServerDataV8"
                                                type="textarea"
                                                placeholder=""
                                                rows="5" /> -->
                        <DiyV8Design
                          ref="refServerDataV8"
                          :key="'refServerDataV8_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyTableModel.ServerDataV8"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>

                    <el-form-item size="mini" class="form-item-top">
                      <!-- class="form-item-label-slot" -->
                      <span>
                        <i class="fas fa-code hand" />
                        服务器端表单提交前V8事件
                      </span>
                      <div class="clear">
                        <DiyV8Design
                          ref="refSubmitBeforeServerV8"
                          :key="'refSubmitBeforeServerV8_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyTableModel.SubmitBeforeServerV8"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>
                    <el-form-item size="mini" class="form-item-top">
                      <!-- class="form-item-label-slot" -->
                      <span>
                        <i class="fas fa-code hand" />
                        服务器端表单提交后V8事件
                      </span>
                      <div class="clear">
                        <DiyV8Design
                          ref="refSubmitAfterServerV8"
                          :key="'refSubmitAfterServerV8_' + CurrentDiyFieldModel.Id"
                          v-if="!DiyCommon.IsNull($refs.fieldForm) && !DiyCommon.IsNull($refs.fieldForm.DiyFieldList)"
                          :fields="$refs.fieldForm.DiyFieldList"
                          :model.sync="CurrentDiyTableModel.SubmitAfterServerV8"
                        ></DiyV8Design>
                      </div>
                    </el-form-item>

                    <div v-if="!DiyCommon.IsNull(CurrentDiyTableModel.ApiReplace)" key="design-16">
                      <el-form-item size="mini">
                        <el-tooltip class="item" effect="dark" placement="right">
                          <div slot="content">
                            <p>支持$ApiBase$、$OsClient$变量</p>
                          </div>
                            <span style="float: none; margin-bottom: 10px; cursor: pointer">
                            <i class="el-icon-info" style="margin-right: 3px" />
                            查询接口替换
                          </span>
                        </el-tooltip>
                        <div class="clear">
                          <el-input v-model="CurrentDiyTableModel.ApiReplace.Select" type="textarea" placeholder="" rows="2" />
                        </div>
                      </el-form-item>
                      <el-form-item size="mini">
                        <el-tooltip class="item" effect="dark" placement="right">
                          <div slot="content">
                            <p>支持$ApiBase$、$OsClient$变量</p>
                          </div>
                            <span style="float: none; margin-bottom: 10px; cursor: pointer">
                            <i class="el-icon-info" style="margin-right: 3px" />
                            新增接口替换
                          </span>
                        </el-tooltip>
                        <div class="clear">
                          <el-input v-model="CurrentDiyTableModel.ApiReplace.Insert" type="textarea" placeholder="" rows="2" />
                        </div>
                      </el-form-item>
                      <el-form-item size="mini">
                        <el-tooltip class="item" effect="dark" placement="right">
                          <div slot="content">
                            <p>支持$ApiBase$、$OsClient$变量</p>
                          </div>
                            <span style="float: none; margin-bottom: 10px; cursor: pointer">
                            <i class="el-icon-info" style="margin-right: 3px" />
                            修改接口替换
                          </span>
                        </el-tooltip>
                        <div class="clear">
                          <el-input v-model="CurrentDiyTableModel.ApiReplace.Update" type="textarea" placeholder="" rows="2" />
                        </div>
                      </el-form-item>
                      <el-form-item size="mini">
                        <el-tooltip class="item" effect="dark" placement="right">
                          <div slot="content">
                            <p>支持$ApiBase$、$OsClient$变量</p>
                          </div>
                            <span style="float: none; margin-bottom: 10px; cursor: pointer">
                            <i class="el-icon-info" style="margin-right: 3px" />
                            删除接口替换
                          </span>
                        </el-tooltip>
                        <div class="clear">
                          <el-input v-model="CurrentDiyTableModel.ApiReplace.Delete" type="textarea" placeholder="" rows="2" />
                        </div>
                      </el-form-item>
                    </div>
                    <el-form-item label="允许匿名读取" size="mini">
                      <el-switch v-model="CurrentDiyTableModel.IsAnonymousRead" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item label="允许匿名新增" size="mini">
                      <el-switch v-model="CurrentDiyTableModel.IsAnonymousAdd" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <!-- 刘诚新增,2024-11-12 -->
                    <el-form-item label="启用数据日志" size="mini">
                      <el-switch v-model="CurrentDiyTableModel.EnableDataLog" active-color="#ff6c04" :active-value="1" :inactive-value="0" inactive-color="#ccc" />
                    </el-form-item>
                    <el-form-item label="日志访问权限(已选中可访问)" size="mini">
                      <el-select v-model="CurrentDiyTableModel.DataLogRole" clearable multiple placeholder="请选择">
                        <el-option v-for="item in SysRoleList" :key="item.Id" :label="item.Name" :value="item.Id" />
                      </el-select>
                    </el-form-item>
                    <el-form-item size="mini">
                      <span style="float: none; margin-bottom: 10px; cursor: pointer">
                        <i class="el-icon-delete" style="margin-right: 3px" @click="CurrentDiyTableModel.AddCallbakApi = ''" />
                        新增数据成功后调用接口
                      </span>
                      <div class="clear">
                        <el-input v-model="CurrentDiyTableModel.AddCallbakApi" type="textarea" placeholder="" readonly disabled rows="2" />
                      </div>
                    </el-form-item>
                    <el-form-item size="mini">
                      <span style="float: none; margin-bottom: 10px; cursor: pointer">
                        <i class="el-icon-delete" style="margin-right: 3px" @click="CurrentDiyTableModel.UptCallbakApi = ''" />
                        修改数据成功后调用接口
                      </span>
                      <div class="clear">
                        <el-input v-model="CurrentDiyTableModel.UptCallbakApi" type="textarea" placeholder="" readonly disabled rows="2" />
                      </div>
                    </el-form-item>
                    <el-form-item size="mini">
                      <span style="float: none; margin-bottom: 10px; cursor: pointer">
                        <i class="el-icon-delete" style="margin-right: 3px" @click="CurrentDiyTableModel.DelCallbakApi = ''" />
                        删除数据成功后调用接口
                      </span>
                      <div class="clear">
                        <el-input v-model="CurrentDiyTableModel.DelCallbakApi" type="textarea" placeholder="" readonly disabled rows="2" />
                      </div>
                    </el-form-item>
                  </el-form>
                </div>
              </el-tab-pane>
            </el-tabs>

            <!-- v-if="!DiyCommon.IsNull(CurrentDiyFieldModel.Config)" -->
            <!-- <el-dialog
                        v-el-drag-dialog
                        width="70vw"
                        class="dialog-v8-wrapper"
                        custom-class="dialog-v8"
                        :modal-append-to-body="false"
                        append-to-body
                        :visible.sync="ShowV8CodeEditor"
                        :close-on-click-modal="false"
                        :modal="true">
                        <el-tabs v-model="DialogV8Code">
                            <el-tab-pane
                                label="V8代码"
                                name="Code">
                                <div class="code-example">
                                    <div class="codemirror">
                                        <codemirror
                                            ref="cmObj"
                                            v-model="CurrentV8Code"
                                            :options="cmOptions" />
                                    </div>
                                </div>
                            </el-tab-pane>
                            <el-tab-pane
                                label="V8说明"
                                name="Explain">
                                <C_V8Explain></C_V8Explain>
                            </el-tab-pane>
                        </el-tabs>

                        <span slot="footer" class="dialog-footer">
                            <el-button
                                type="primary"
                                size="mini"
                                icon="el-icon-close"
                                @click="CloseV8CodeEditor">
                                {{ $t('Msg.Close') }}
                                </el-button>
                        </span>
                    </el-dialog> -->
          </el-main>
          <!-- <el-footer
                    class="right-footer"
                    height="50px"
                    style="text-align:right;line-height:50px;">
                    <el-button
                        type="primary"
                        @click="UptDiyTable">{{$t('Msg.Save')}}</el-button>
                    <el-button type="">{{$t('Msg.Back')}}</el-button>
                </el-footer> -->
        </el-container>
      </el-aside>
      <!-- </el-container> -->
    </el-container>
  </div>
</template>

<script>
import _ from "underscore";
import "dragula/dist/dragula.css";
import dragula from "dragula/dragula";
import elDragDialog from "@/directive/el-drag-dialog"; // base on element-ui
import { mapState } from "vuex";
import C_V8Explain from "@/views/diy/v8-explain";
import DiyChildTableCallback from "./diy-components/diy-writebackChild.vue";
import DiyV8Design from "./diy-components/diy-v8design";
import lodash from "lodash";

//以下是之前一直使用的，现改为默认的
// // 以下是vue-codemirror
// import {
//     codemirror
// } from 'vue-codemirror'
// // import language js
// import 'codemirror/mode/javascript/javascript.js'
// // import base style
// import 'codemirror/lib/codemirror.css'
// // import theme style
// import 'codemirror/theme/base16-dark.css'

// 以下是官方原生codemirror
// import "codemirror/theme/ambiance.css";
// import "codemirror/lib/codemirror.css";
// import "codemirror/addon/hint/show-hint.css";
// let CodeMirror = require("codemirror/lib/codemirror");
// require("codemirror/addon/edit/matchbrackets");
// require("codemirror/addon/selection/active-line");
// require("codemirror/mode/sql/sql");
// require("codemirror/addon/hint/show-hint");
// require("codemirror/addon/hint/sql-hint");

// import 'codemirror/lib/codemirror.css'
// import { codemirror } from 'vue-codemirror'
// require("codemirror/mode/javascript/javascript.js")

export default {
  name: "DiyDesign",
  directives: {
    elDragDialog
  },
  components: {
    // codemirror,
    C_V8Explain,
    DiyV8Design,
    DiyChildTableCallback
  },
  computed: {
    ...mapState({
      // OsClient: state => state.DiyStore.OsClient
      SysConfig: (state) => state.DiyStore.SysConfig
    }),
    DiyComponentListBaseListen: {
      get() {
        return _.where(this.DiyComponentList, {
          Type: "Base"
        });
      }
    },
    DiyComponentListAdvancedListen: {
      get() {
        return _.where(this.DiyComponentList, {
          Type: "Advanced"
        });
      }
    }
    // TabListListen : {
    //     get(){
    //         var self = this;
    //         var fieldList = self.$refs.fieldForm.DiyFieldList;
    //         var tabList = [];
    //         fieldList.forEach(element => {
    //             if (!self.DiyCommon.IsNull(element.Tab) && _.where(tabList, {value : element.Tab}).length == 0) {
    //                 tabList.push({value : element.Tab});
    //             }
    //         });
    //         return tabList;
    //     }
    // }
  },
  data() {
    return {
      PageType: "", //可以是Report
      DiyFieldListClone: [],
      DiyFieldList: [],
      CurrentErrorFieldModel: {},
      CurrentDeletedFieldModel: {},
      FormClient: "PC",
      sysMenuTreeProps: {
        children: "_Child",
        label: "Name", // this.Lang == 'cn' ? 'Name' : 'EnName'
        Enlabel: "EnName"
      },
      SysMenuList: [],
      CurrentV8Sign: "",
      CurrentV8Code: "",
      SaveAllDiyFieldLoding: false,
      DialogV8Code: "Code", // Explain
      cmOptions: {
        // 所有参数配置见：https://codemirror.net/doc/manual.html#config
        tabSize: 4,
        styleActiveLine: true,
        lineNumbers: true,
        line: true,
        foldGutter: true,
        styleSelectedText: true,
        mode: "text/javascript",
        // keyMap: "sublime",
        matchBrackets: true,
        showCursorWhenSelecting: true,
        // theme: 'base16-dark',
        extraKeys: {
          Ctrl: "autocomplete"
        },
        hintOptions: {
          completeSingle: false
        },
        lineWrapping: true // 自动换行
      },
      // ShowV8CodeEditor: false,
      ShowDiyTableEditor: false,
      CurrentDiyTableTabModel: {},
      CurrentDiyFieldModel: {},
      CurrentDiyTableModel: {},
      FormDiyTableModel: {},
      AsideRightActiveTab: "Form",
      FieldActiveTab: "none",
      DiyComponentList: [],
      TableId: "",
      TableRowId: "",
      DragulaObj: null,

      LastLoadDragulaIndex: -1,
      SysRoleList: [],
      // SysMenuNeedConvertField: ['TableDiyFieldIds', 'SearchFieldIds', 'SortFieldIds', 'DiyConfig', 'StatisticsFields'],
      //'ImgUpload', 'FileUpload','Map',
      CantUptComponentList: [], //'DevComponent', 'TableChild', 'Divider'
      SysDataSourceList: [],
      ApiEngineList: [],
      ExceptionFieldList: [],
      DeletedDiyField: [],

      FieldTypeList: [
        {
          value: "varchar(25)",
          Description: "字符串，常用于存储短文字"
        },
        {
          value: "varchar(50)",
          Description: "字符串，常用于存储短文字"
        },
        {
          value: "varchar(255)",
          Description: "字符串，常用于存储几百字以内文字"
        },
        {
          value: "varchar(36)",
          Description: "GUID/UUID"
        },
        {
          value: "mediumtext",
          Description: "文本，用于存储几千、上万、无限文字"
        },
        {
          value: "bit",
          Description: "布尔类型，是或否"
        },
        {
          value: "int",
          Description: "数字，不含小数"
        },
        {
          value: "decimal(18, 2)",
          Description: "数字，2位小数点"
        }
      ],

      FieldTypeListOracle: [
        {
          value: "NVARCHAR2(25)",
          Description: "字符串，常用于存储短文字"
        },
        {
          value: "NVARCHAR2(50)",
          Description: "字符串，常用于存储短文字"
        },
        {
          value: "NVARCHAR2(255)",
          Description: "字符串，常用于存储几百字以内文字"
        },
        {
          value: "NVARCHAR2(36)",
          Description: "GUID/UUID"
        },
        {
          value: "NCLOB",
          Description: "文本，用于存储几千、上万、无限文字"
        },
        {
          value: "NUMBER(1)",
          Description: "布尔类型，是或否"
        },
        {
          value: "NUMBER(11)",
          Description: "数字，不含小数"
        },
        {
          value: "NUMBER(18, 2)",
          Description: "数字，2位小数点"
        }
      ]
    };
  },
  mounted() {
    var self = this;
    self.PageType = self.$route.query.PageType;
    self.TableId = self.$route.params.Id;
    // self.GetDiyTableModel();
    // self.GetDiyField();
    self.$nextTick(function () {
      self.$refs.fieldForm.Init(false);
    });

    self.GetDiyComponent();
    self.GetSysRole();
    self.GetSysMenu();
    self.GetSysDataSourceList();
    self.GetApiEngineList();
    self.GetExceptionFieldList();
    self.GetDeletedDiyField();
    self.$nextTick(function () {
      // self.LoadDragula();
    });
  },
  methods: {
    RecoverDiyField() {
      var self = this;
      self.DiyCommon.Post(
        "/api/diyfield/RecoverDiyField",
        {
          Id: self.CurrentDeletedFieldModel.Id,
          TableId: self.CurrentDeletedFieldModel.TableId
        },
        function (result) {
          if (self.DiyCommon.Result(result)) {
            self.DiyCommon.Tips("恢复成功！");
            self.GetExceptionFieldList();
            self.GetDeletedDiyField();
          }
        }
      );
    },
    RepairField() {
      var self = this;
      //数据库中有的字段，但DiyField中没有
      if (self.CurrentErrorFieldModel.ErrorType == "DbField") {
        self.DiyCommon.Post(
          "/api/diyfield/addDiyField",
          {
            TableId: self.TableId,
            _NotAddDbField: true,
            Name: self.CurrentErrorFieldModel.Name,
            Type: self.CurrentErrorFieldModel.Type
          },
          function (result) {
            if (self.DiyCommon.Result(result)) {
              self.DiyCommon.Tips("修复成功！");
              self.GetExceptionFieldList();
            }
          }
        );
      }
      //数据库中没有的字段，但DiyField中有
      else if (self.CurrentErrorFieldModel.ErrorType == "DiyField") {
        self.DiyCommon.Post(
          "/api/diyfield/addDbField",
          {
            TableId: self.TableId,
            Name: self.CurrentErrorFieldModel.Name,
            Type: self.CurrentErrorFieldModel.Type
          },
          function (result) {
            if (self.DiyCommon.Result(result)) {
              self.DiyCommon.Tips("修复成功！");
              self.GetExceptionFieldList();
            }
          }
        );
      } else {
        self.DiyCommon.Tips("未知错误！", false);
      }
    },
    GetDeletedDiyField() {
      var self = this;
      self.DiyCommon.Post(
        "/api/diyfield/getDeletedDiyField",
        {
          TableId: self.TableId
        },
        function (result) {
          if (self.DiyCommon.Result(result)) {
            self.DeletedDiyField = result.Data;
          }
        }
      );
    },
    GetExceptionFieldList() {
      var self = this;
      self.DiyCommon.Post(
        "/api/diyfield/getExceptionFieldList",
        {
          TableId: self.TableId
        },
        function (result) {
          if (result.Code == 1) {
            self.CurrentErrorFieldModel = {};
            self.ExceptionFieldList = result.Data;
          }
        }
      );
    },
    GetSysDataSourceList() {
      var self = this;
      self.DiyCommon.GetDiyTableRow(
        {
          TableName: "Sys_DataSource"
        },
        function (data) {
          if (data && data.Data) {
            self.SysDataSourceList = data.Data;
          }
        }
      );
    },
    GetApiEngineList() {
      var self = this;
      self.DiyCommon.GetDiyTableRow(
        {
          TableName: "sys_apiengine",
          _SelectFields: [
            "Id",
            "ApiName",
            "ApiEngineKey",
            "ApiAddress",
            "IsEnable",
          ],
        },
        function (data) {
          if (data && data.Data) {
            self.ApiEngineList = data.Data;
          }
        }
      );
    },
    GetDiyComponent() {
      var self = this;
      self.DiyCommon.GetDiyTableRow(
        {
          TableName: "Diy_Component",
          _OrderBy: "Sort",
          _OrderByType: "Asc"
        },
        function (data) {
          if (!self.DiyCommon.IsNull(data)) {
            self.DiyComponentList = data.Data;
          }
        }
      );
    },
    SwitchFormClient(tab) {
      var self = this;
      self.FormClient = tab.name;
    },
    ClearCurrentDiyFieldModelData() {
      var self = this;
      self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + "【" + self.CurrentDiyFieldModel.Label + "】清空所有字典数据？", function () {
        self.CurrentDiyFieldModel.Data = [];
      });
    },
    SelectFieldChange(val) {
      var self = this;
      if (self.DiyCommon.IsNull(val)) {
        self.CurrentDiyFieldModel = {};
        // self.DiyFieldList = self.$refs.fieldForm.DiyFieldList;
      } else {
        self.$refs.fieldForm.SelectField(val);
      }
    },
    SelectFieldFilterMethod(value) {
      var self = this;
      self.DiyFieldListClone = self.$refs.fieldForm.DiyFieldList.filter(
        (item) => (item.Label && item.Label.toLowerCase().indexOf(value.toLowerCase()) > -1) || (item.Name && item.Name.toLowerCase().indexOf(value.toLowerCase()) > -1)
      );
    },
    SelectErrorFieldChange(val) {
      var self = this;
    },
    CanUptComponent() {
      var self = this;
      var result = true;
      self.CantUptComponentList.forEach((componentName) => {
        if (componentName == self.CurrentDiyFieldModel.Component) {
          result = false;
        }
      });
      return result;
    },
    sysMenuTreeClick(data) {
      var self = this;
      if (data.OpenType == "Diy" && !self.DiyCommon.IsNull(data.DiyTableId)) {
        self.$set(self.CurrentDiyFieldModel.Config, "TableChildTableId", data.DiyTableId);
        self.$set(self.CurrentDiyFieldModel.Config, "TableChildSysMenuId", data.Id);
        self.$set(self.CurrentDiyFieldModel.Config, "TableChildSysMenuName", data.Name);
      }
    },

    JoinTableSelectModule(data) {
      var self = this;
      if (data.OpenType == "Diy" && !self.DiyCommon.IsNull(data.DiyTableId)) {
        self.$set(self.CurrentDiyFieldModel.Config.JoinTable, "TableId", data.DiyTableId);
        self.$set(self.CurrentDiyFieldModel.Config.JoinTable, "ModuleId", data.Id);
        self.$set(self.CurrentDiyFieldModel.Config.JoinTable, "ModuleName", data.Name);
      }
    },

    OpenTableSysMenuClick(data) {
      var self = this;
      if (data.OpenType == "Diy" && !self.DiyCommon.IsNull(data.DiyTableId)) {
        self.$set(self.CurrentDiyFieldModel.Config.OpenTable, "TableId", data.DiyTableId);
        self.$set(self.CurrentDiyFieldModel.Config.OpenTable, "SysMenuId", data.Id);
        self.$set(self.CurrentDiyFieldModel.Config.OpenTable, "SysMenuName", data.Name);
      }
    },
    sysMenuTreeClickLast(data) {
      var self = this;
      if (data.OpenType == "Diy" && !self.DiyCommon.IsNull(data.DiyTableId)) {
        self.$set(self.CurrentDiyFieldModel.Config.TableChild, "LastTableId", data.DiyTableId);
        self.$set(self.CurrentDiyFieldModel.Config.TableChild, "LastSysMenuId", data.Id);
        self.$set(self.CurrentDiyFieldModel.Config.TableChild, "LastSysMenuName", data.Name);
      }
    },
    GetSysMenu() {
      var self = this;
      self.DiyCommon.Post(
        self.DiyApi.GetSysMenuStep(),
        {
          // self.DiyCommon.Post(self.DiyApi.GetDiyTableRowTree, {
          TableName: "Sys_Menu",
          _OrderBy: "Sort",
          _OrderByType: "ASC"
          // OsClient: self.OsClient
        },
        function (result) {
          if (self.DiyCommon.Result(result)) {
            // result.Data.forEach(data => {
            //     self.SysMenuNeedConvertField.forEach(convertField => {
            //         if (self.DiyCommon.IsNull(data[convertField])) {
            //             data[convertField] = []
            //         } else {
            //             if (convertField == 'StatisticsFields') {
            //                 var tempResult = []
            //                 var tempArr = JSON.parse(data[convertField])
            //                 tempArr.forEach(calcIdType => {
            //                     tempResult.push(calcIdType.Id)
            //                 })
            //                 data[convertField] = tempResult
            //             } else {
            //                 data[convertField] = JSON.parse(data[convertField])
            //             }
            //         }
            //     })
            //     var dataChildList = data._Child
            //     if (!self.DiyCommon.IsNull(dataChildList) && dataChildList.length > 0) {
            //         dataChildList.forEach(childData => {
            //             self.SysMenuNeedConvertField.forEach(convertField2 => {
            //                 if (self.DiyCommon.IsNull(childData[convertField2])) {
            //                     childData[convertField2] = []
            //                 } else {
            //                     if (convertField2 == 'StatisticsFields') {
            //                         var tempResult = []
            //                         var tempArr = JSON.parse(childData[convertField2])
            //                         tempArr.forEach(calcIdType => {
            //                             tempResult.push(calcIdType.Id)
            //                         })
            //                         childData[convertField2] = tempResult
            //                     } else {
            //                         childData[convertField2] = JSON.parse(childData[convertField2])
            //                     }
            //                 }
            //             })
            //         })
            //     }
            // })
            // self.DiyCommon.ForConvertSysMenu(result.Data);
            self.SysMenuList = result.Data;
          }
        }
      );
    },
    GetSysRole() {
      var self = this;
      self.DiyCommon.Post(self.DiyApi.GetSysRole(), {}, function (result) {
        if (self.DiyCommon.Result(result)) {
          self.SysRoleList = result.Data;
        }
      });
    },
    OpenV8CodeEditor(type, fieldOrTable, nextName, nextName2) {
      var self = this;
      self.CurrentV8Sign = type;
      self.CurrentV8Type = fieldOrTable;
      // if (type == 'Field') {
      //     self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyFieldModel.Config.V8Code) ? '' : self.CurrentDiyFieldModel.Config.V8Code
      // } else if (type == 'FieldForm') {
      //     self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyFieldModel.V8TmpEngineForm) ?
      //         '' : self.CurrentDiyFieldModel.V8TmpEngineForm
      // } else if (type == 'FieldTable') {
      //     self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyFieldModel.V8TmpEngineTable) ?
      //         '' : self.CurrentDiyFieldModel.V8TmpEngineTable
      // } else if (type == 'InFormV8') {
      //     self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyTableModel.InFormV8) ? '' : self.CurrentDiyTableModel.InFormV8
      // }
      // else if (type == 'SubmitFormV8') {
      //     self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyTableModel.SubmitFormV8) ? '' : self.CurrentDiyTableModel.SubmitFormV8
      // } else {
      //     self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyTableModel.OutFormV8) ? '' : self.CurrentDiyTableModel.OutFormV8
      // }
      eval("self.CurrentV8Code = self." + type);
      //现在不使用我开发的V8编辑器了，用欣欣的
      // self.ShowV8CodeEditor = true
      return;
      // if (self.CurrentV8Type == 'Field') {
      //     if(!self.DiyCommon.IsNull(nextName2))
      //     {
      //         self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyFieldModel[nextName][nextName2][type])
      //                                 ? '' : self.CurrentDiyFieldModel[nextName][nextName2][type];
      //     }
      //     else if(!self.DiyCommon.IsNull(nextName))
      //     {
      //         self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyFieldModel[nextName][type])
      //                                 ? '' : self.CurrentDiyFieldModel[nextName][type];
      //     }else{
      //         self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyFieldModel[type])
      //                                 ? '' : self.CurrentDiyFieldModel[type];
      //     }

      // }else{
      //     self.CurrentV8Code = self.DiyCommon.IsNull(self.CurrentDiyTableModel[type]) ? '' : self.CurrentDiyTableModel[type]
      // }
      // self.ShowV8CodeEditor = true
    },
    CloseV8CodeEditor() {
      var self = this;
      // if (self.CurrentV8Sign == 'Field') {
      //     self.CurrentDiyFieldModel.Config.V8Code = self.CurrentV8Code
      // } else if (self.CurrentV8Sign == 'FieldForm') {
      //     self.CurrentDiyFieldModel.V8TmpEngineForm = self.CurrentV8Code
      // } else if (self.CurrentV8Sign == 'FieldTable') {
      //     self.CurrentDiyFieldModel.V8TmpEngineTable = self.CurrentV8Code
      // } else if (self.CurrentV8Sign == 'InFormV8') {
      //     self.CurrentDiyTableModel.InFormV8 = self.CurrentV8Code
      // }else if (self.CurrentV8Sign == 'SubmitFormV8') {
      //     self.CurrentDiyTableModel.SubmitFormV8 = self.CurrentV8Code
      // } else {
      //     self.CurrentDiyTableModel.OutFormV8 = self.CurrentV8Code
      // }
      eval("self." + self.CurrentV8Sign + " = self.CurrentV8Code");
      self.ShowV8CodeEditor = false;
      return;
      // if(self.CurrentV8Type == 'Field'){
      //     if(self.CurrentV8Sign == 'V8Code' || self.CurrentV8Sign == 'V8CodeBlur'){
      //         self.CurrentDiyFieldModel.Config[self.CurrentV8Sign] = self.CurrentV8Code;
      //     }else{
      //         self.CurrentDiyFieldModel[self.CurrentV8Sign] = self.CurrentV8Code
      //     }
      // }else{
      //     self.CurrentDiyTableModel[self.CurrentV8Sign] = self.CurrentV8Code
      // }
      // self.ShowV8CodeEditor = false
    },

    // 中文转拼音
    DiyFieldLabelChange(label) {
      var self = this;
      if (!self.CurrentDiyFieldModel.NameConfirm) {
        if (!self.DiyCommon.IsNull(label)) {
          try {
            self.CurrentDiyFieldModel.Name = self.DiyCommon.ChineseToPinyin(label);
          } catch (error) {
            self.CurrentDiyFieldModel.Name = "";
            console.log(error);
          }
        } else {
          self.CurrentDiyFieldModel.Name = "";
        }
      }
    },
    SearchCDFMType(queryString, cb) {
      var self = this;
      var restaurants = [];
      if (self.SysConfig.DatabaseType == "Oracle") {
        restaurants = this.FieldTypeListOracle;
      } else {
        restaurants = this.FieldTypeList;
      }
      var results = queryString ? restaurants.filter(this.createFilter(queryString)) : restaurants;
      // 调用 callback 返回建议列表的数据
      cb(results);
    },
    createFilter(queryString) {
      return (restaurant) => {
        return restaurant.value.toLowerCase().indexOf(queryString.toLowerCase()) === 0;
      };
    },
    CallbackLoadDragula(idIndex) {
      var self = this;
      self.LoadDragula(idIndex);
    },
    CallbackGetDiyField(diyFieldList) {
      var self = this;
      self.DiyFieldList = diyFieldList;
      self.DiyFieldListClone = lodash.cloneDeep(self.DiyFieldList);
    },
    LoadDragula(idIndex) {
      var self = this;
      if (document.getElementById("field-form-" + idIndex) != null) {
        if (self.LastLoadDragulaIndex == idIndex) {
          return;
        }
        self.LastLoadDragulaIndex = idIndex;
        if (self.DragulaObj != null) {
          try {
            self.DragulaObj.destroy();
          } catch (error) {}
        }
        // console.log('idIndex:' + idIndex)
        self.DragulaObj = dragula([document.getElementById("row-field"), document.getElementById("field-form-" + idIndex)], {
          // copy:true,
          copy: function (el, source) {
            // 只有左侧控件才能复制
            return source === document.getElementById("row-field");
          },
          accepts: function (el, target, source, sibling) {
            // 只有中间区域才能接受
            return target === document.getElementById("field-form-" + idIndex);
          },
          moves: function (el, container, handle) {
            return (
              // 只有左侧控件才能拖，[基础控件][高级控件]文字禁止拖动
              handle.className.indexOf("el-tag") > -1 || handle.className.indexOf("icon") > -1
            );
          }
        }).on("dragend", (el) => {
          // var obj = $(el).context.parentElement
          //升级jquery3.5.1后
          var obj = el.parentElement;

          if (!self.DiyCommon.IsNull(obj) && obj.id == "field-form-" + idIndex) {
            // 添加字段
            // var fieldControl = $(el).context.attributes['data-field'].value
            //升级jquery3.5.1后
            var fieldControl = el.getAttribute("data-field");
            var componentModel = _.where(self.DiyComponentList, {
              Control: fieldControl
            })[0];
            // var tab = $(obj).attr('data-tab')
            //升级jquery3.5.1后
            var tab = obj.getAttribute("data-tab");
            if (tab == "none" || tab == "info" || !tab) {
              tab = "";
            }
            self.AddDiyField({
              Name: "", // componentModel.Control + '_' + new Date().Format('yyyyMMddHHmmss'),
              Label: componentModel.Name,
              Type: componentModel.FieldType,
              Component: componentModel.Control,
              Visible: 1,
              AppVisible: 1,
              Tab: tab,
              TableWidth: 120,
              NameConfirm: 0,
              // Readonly : self.DiyCommon.IsNull(componentModel.Readonly) ? false : componentModel.Readonly
              Readonly: componentModel.Readonly ? 1 : 0
            });
            // $(el).remove()
            //升级jquery3.5.1后
            el.remove();
          }
        });
        // .on("cloned", (clone, original, type) => {

        // })
      }
    },
    tabClickField() {},
    tabCLickAsideRight() {},
    AddDiyTableTab() {
      var self = this;
      self.CurrentDiyTableTabModel.Id = self.DiyCommon.NewGuid();
      self.CurrentDiyTableModel.Tabs.push(self.CurrentDiyTableTabModel);
      self.CurrentDiyTableTabModel = {};
    },
    DelDiyTableTab(tabModel) {
      var self = this;
      self.DiyCommon.OsConfirm(self.$t("Msg.ConfirmDelTo") + "【" + tabModel.Name + "】？", function () {
        var index = 0;
        for (let index = 0; index < self.CurrentDiyTableModel.Tabs.length; index++) {
          if (self.CurrentDiyTableModel.Tabs[index].Name == tabModel.Name) {
            self.CurrentDiyTableModel.Tabs.splice(index, 1);
            break;
          }
        }
      });
    },
    CallbackSelectField(field) {
      var self = this;
      //console.log('CallbackSelectField:', field);
      //2024-10-31:无意义的代码，注释。 --by anderson
      // if (!self.DiyCommon.IsNull(field.Config) && self.DiyCommon.IsNull(field.Config)) {
      //     field.Config = ''
      // }
      //是否需要解密？？
      self.CurrentDiyFieldModel = field;
      if (field.Component == "Checkbox" || field.Component == "MultipleSelect") {
        self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = []; // self.CurrentDiyFieldModel.Data
      } else {
        self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = "";
      }
      self.AsideRightActiveTab = "Field";
      self.$nextTick(function () {
        // if (!self.DiyCommon.IsNull(self.$refs.cmObj)) {
        //     self.$refs.cmObj.refresh()
        // }
      });
    },
    AddKeys() {
      var self = this;
      if (!self.DiyCommon.IsNull(self.CurrentDiyFieldModel.Config.KeysAddVModel)) {
        self.CurrentDiyFieldModel.Data.push(self.CurrentDiyFieldModel.Config.KeysAddVModel);
        self.CurrentDiyFieldModel.Config.KeysAddVModel = "";
        self.CurrentDiyFieldModel.Config.KeysAddVisible = false;
        // 注意：这里也需要给FormDiyTableModel对应的属性设置array类型，否则会报错
        self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = []; // self.CurrentDiyFieldModel.Data
      }
    },
    GetDiyTableColumnSpan(field) {
      var self = this;
      if (!self.DiyCommon.IsNull(field.FormWidth) && field.FormWidth != 0) {
        return field.FormWidth;
      } else if (self.CurrentDiyTableModel.Column == 1) {
        return 24;
      } else if (self.CurrentDiyTableModel.Column == 2) {
        return 12;
      } else if (self.CurrentDiyTableModel.Column == 3) {
        return 8;
      } else if (self.CurrentDiyTableModel.Column == 4) {
        return 6;
      } else if (self.CurrentDiyTableModel.Column == 6) {
        return 4;
      } else {
        return 24;
      }
    },
    UptDiyTable() {
      var self = this;
      // var param = {
      //     ...self.CurrentDiyTableModel
      // }
      var param = lodash.cloneDeep(self.CurrentDiyTableModel);
      //Sql、V8代码全部转为Base64
      self.DiyCommon.Base64EncodeDiyTable(param);
      // param.OsClient = self.OsClient
      self.DiyTableJsonToStr(param);
      param.FormEngineKey = "Diy_Table";
      // self.DiyCommon.Post(DiyApi.UptDiyTable, param, function (result) {
      self.DiyCommon.Post(self.DiyApi.FormEngine.UptFormData, param, function (result) {
        if (self.DiyCommon.Result(result)) {
          self.DiyCommon.Tips(self.$t("Msg.Success"));
          // self.$refs.fieldForm.SetDiyTableModel(result.Data)
        }
      });
    },
    SaveAllDiyField() {
      var self = this;
      self.SaveAllDiyFieldLoding = true;
      try {
        // 先保存DiyTable
        // var param = {
        //     ...self.CurrentDiyTableModel
        // }
        var param = lodash.cloneDeep(self.CurrentDiyTableModel);
        //Sql、V8代码全部转为Base64
        self.DiyCommon.Base64EncodeDiyTable(param);

        // param.OsClient = self.OsClient
        self.DiyTableJsonToStr(param);
        param.FormEngineKey = "Diy_Table";
        // self.DiyCommon.Post(DiyApi.UptDiyTable, param, function (result) {
        self.DiyCommon.Post(self.DiyApi.FormEngine.UptFormData, param, function (result) {
          if (self.DiyCommon.Result(result)) {
            // self.$refs.fieldForm.SetDiyTableModel(result.Data)
          }
        });
        // 这里copy过来被引用了
        // var fieldList = [...self.$refs.fieldForm.DiyFieldList];
        // 这种方式就不会出问题
        // var fieldList = [];//JSON.parse(JSON.stringify(self.$refs.fieldForm.DiyFieldList))
        // self.$refs.fieldForm.DiyFieldList.forEach(field => {
        //     var copyField = {...field};
        //     copyField.BaiduMapConfig = {};
        //     fieldList.push(copyField);
        // });
        //2022-07-13这种方式copy，不会引用
        var fieldList = lodash.cloneDeep(self.$refs.fieldForm.DiyFieldList);

        // 这里copy过来被引用了
        // var fieldList = Array.from(self.$refs.fieldForm.DiyFieldList);

        // 再保存DiyField
        // if (self.DiyFieldList.length > 0) {
        if (fieldList.length > 0) {
          // var fieldList = [...self.DiyFieldList];
          fieldList.forEach((element) => {
            self.DiyCommon.Base64EncodeDiyField(element);
            self.DiyFieldJsonToStr(element);
            element.OsClient = "";
          });
          self.DiyCommon.Post(
            self.DiyApi.UptDiyFieldList,
            {
              // OsClient: self.OsClient,
              _FieldList: JSON.stringify(fieldList),
              // _FieldList: fieldList,
              TableId: self.$route.params.Id
            },
            function (result) {
              self.SaveAllDiyFieldLoding = false;
              if (self.DiyCommon.Result(result)) {
                self.DiyCommon.Tips(self.$t("Msg.Success"));

                // 全部保存是可以重新查询的
                // self.GetDiyField()
                self.FieldForm_GetAllData();

                if (!self.DiyCommon.IsNull(self.CurrentDiyFieldModel.Id)) {
                  self.GetDiyFieldModel(self.CurrentDiyFieldModel.Id);
                }
              }
            },
            function () {
              self.SaveAllDiyFieldLoding = false;
            }
          );
        } else {
          self.SaveAllDiyFieldLoding = false;
        }
      } catch (error) {
        self.SaveAllDiyFieldLoding = false;
        console.log(error);
      }
    },
    UptDiyField() {
      var self = this;
      self.SaveAllDiyFieldLoding = true;
      try {
        // var param = {
        //     ...self.CurrentDiyFieldModel
        // }
        var param = lodash.cloneDeep(self.CurrentDiyFieldModel);
        // param.OsClient = self.OsClient
        // param.BaiduMapConfig = {};  放到DiyFieldJsonToStr里面
        self.DiyCommon.Base64EncodeDiyField(param);
        self.DiyFieldJsonToStr(param);
        //2024-04-24：如果是报表引擎
        var uptApiUrl = self.DiyApi.UptDiyField;
        if (self.PageType == "Report") {
          uptApiUrl = self.DiyApi.FormEngine.UptFormData;
          param.BaiduMapConfig = JSON.stringify(param.BaiduMapConfig);
          param = {
            FormEngineKey: "diy_field",
            Id: param.Id,
            _RowModel: {
              ...param
            }
          };
        }
        param.OsClient = "";
        if(!param.Name){
          self.DiyCommon.Tips('字段名不能为空！', false);
          return;
        }
        self.DiyCommon.Post(
          uptApiUrl,
          param,
          function (result) {
            self.SaveAllDiyFieldLoding = false;
            if (self.DiyCommon.Result(result)) {
              self.DiyCommon.Tips(self.$t("Msg.Success"));
              self.DiyCommon.DiyFieldConfigStrToJson(result.Data);
              self.$refs.fieldForm.DiyFieldStrToJson(result.Data);
              self.DiyCommon.Base64DecodeDiyField(result.Data);
              //这里Current是修改成功了，但是DiyForm内部的数组并未修改成功
              // self.CurrentDiyFieldModel = result.Data
              self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = self.CurrentDiyFieldModel.Data;

              // self.GetDiyField();
              self.$refs.fieldForm.UptDiyFieldArr(result.Data);
            }
          },
          function () {
            self.SaveAllDiyFieldLoding = false;
          }
        );
      } catch (error) {
        self.SaveAllDiyFieldLoding = false;
      }
    },
    DelDiyField() {
      var self = this;
      try {
        self.DiyCommon.OsConfirm(
          self.$t("Msg.ConfirmDelTo") + "【" + self.CurrentDiyFieldModel.Name + "】？",
          function () {
            self.SaveAllDiyFieldLoding = true;
            self.DiyCommon.Post(
              self.DiyApi.DelDiyField,
              {
                Id: self.CurrentDiyFieldModel.Id
                // OsClient: self.OsClient
              },
              function (result) {
                self.SaveAllDiyFieldLoding = false;
                if (self.DiyCommon.Result(result)) {
                  self.DiyCommon.Tips(self.$t("Msg.Success"));
                  // self.DiyFieldList.push(result.Data);
                  // self.GetDiyField();
                  self.$refs.fieldForm.DelDiyFieldArr(result.Data);
                  self.CurrentDiyFieldModel = {};
                }
              },
              function () {
                self.SaveAllDiyFieldLoding = false;
              }
            );
          },
          function () {}
        );
      } catch (error) {
        self.SaveAllDiyFieldLoding = false;
        console.log(error);
      }
    },
    AddDiyField(param) {
      var self = this;
      param.TableId = self.$route.params.Id;
      // param.OsClient = self.OsClient
      var width100 = ["Textarea", "RichText", "ImgUpload", "FileUpload", "Divider", "Map", "MapArea", "DataTable", "TableChild", "Address", "DevComponent"];
      if (width100.indexOf(param.Component) > -1) {
        param.FormWidth = 24;
      }
      // param.Sort = 100;
      //2024-04-29:如果是报表设计，直接走formengine，不创建物理字段
      var apiUrl = self.DiyApi.AddDiyField;
      if (self.PageType == "Report") {
        apiUrl = self.DiyApi.FormEngine.AddFormData;
        param = {
          FormEngineKey: "diy_field",
          _RowModel: { ...param }
        };
      }
      self.DiyCommon.Post(apiUrl, param, function (result) {
        if (self.DiyCommon.Result(result)) {
          self.DiyCommon.Tips(self.$t("Msg.Success"));
          // self.DiyFieldList.push(result.Data);
          self.DiyCommon.DiyFieldConfigStrToJson(result.Data);
          self.$refs.fieldForm.DiyFieldStrToJson(result.Data);
          self.DiyCommon.Base64DecodeDiyField(result.Data);
          self.CurrentDiyFieldModel = result.Data;
          self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = self.CurrentDiyFieldModel.Data;
          self.AsideRightActiveTab = "Field";

          // self.GetDiyField();
          self.$refs.fieldForm.AddDiyFieldArr(result.Data);
        }
      });
    },
    // GetDiyField() {
    //     var self = this
    //     self.$refs.fieldForm.GetDiyField(null, false)
    // },
    FieldForm_GetAllData() {
      var self = this;
      self.$refs.fieldForm.GetAllData();
    },
    CallbackSetDiyTableModel(model) {
      var self = this;

      model.DataEncryptSave = model.DataEncryptSave ? 1 : 0;
      model.DataEncryptTransfer = model.DataEncryptTransfer ? 1 : 0;
      model.EnableCache = model.EnableCache ? 1 : 0;
      model.IsAnonymousAdd = model.IsAnonymousAdd ? 1 : 0;
      model.IsAnonymousRead = model.IsAnonymousRead ? 1 : 0;
      model.IsTree = model.IsTree ? 1 : 0;
      model.TableInEdit = model.TableInEdit ? 1 : 0;
      model.TreeLazy = model.TreeLazy ? 1 : 0;

      self.CurrentDiyTableModel = model;
      self.$emit("CallbackSetDiyTableModel", model);
      // self.DiyCommon.ChangePageTabName('diy_field', self.$t('Msg.Design') + ' ' + model.Name.replace('Diy_', ''))
    },
    DiyTableJsonToStr(data) {
      var self = this;
      if (self.DiyCommon.IsNull(data.RowAction)) {
        data.RowAction = "[]";
      } else {
        data.RowAction = JSON.stringify(data.RowAction);
      }

      if (self.DiyCommon.IsNull(data.Tabs)) {
        data.Tabs = "[]";
      } else {
        data.Tabs = JSON.stringify(data.Tabs);
      }

      if (self.DiyCommon.IsNull(data.BindRole)) {
        data.BindRole = "[]";
      } else {
        data.BindRole = JSON.stringify(data.BindRole);
      }

      //刘诚2025-03-18增（修改日志分角色访问）
      if (self.DiyCommon.IsNull(data.DataLogRole)) {
        data.DataLogRole = "[]";
      } else {
        data.DataLogRole = JSON.stringify(data.DataLogRole);
      }

      if (self.DiyCommon.IsNull(data.TableTabs)) {
        data.TableTabs = "[]";
      } else {
        data.TableTabs = JSON.stringify(data.TableTabs);
      }

      if (!self.DiyCommon.IsNull(data.ApiReplace)) {
        data.ApiReplace = JSON.stringify(data.ApiReplace);
      }
    },
    DiyFieldJsonToStr(data) {
      var self = this;
      var needBool2Int = ["NameConfirm", "NotEmpty", "Visible", "Readonly", "Unique", "InTableEdit", "IsLockField", "Encrypt"];
      needBool2Int.forEach((item) => {
        if (data[item] === true || data[item] === false) {
          data[item] = data[item] === true ? 1 : 0;
        }
      });

      //2023-08-11注释 oracle可能是使用NUMBER(11)，所以不需要这个判断
      // if (
      //     !self.DiyCommon.IsNull(data.Config) &&
      //     data.Component == 'NumberText' &&
      //     !self.DiyCommon.IsNull(data.Config.NumberTextPrecision)
      // ) {
      //     if (data.Config.NumberTextPrecision != 0) {
      //         data.Type = 'decimal(18, ' + data.Config.NumberTextPrecision + ')'
      //     } else {
      //         data.Type = 'int'
      //     }
      // }

      // 如果Data数据项不为空
      if (!self.DiyCommon.IsNull(data.Data)) {
        // 如果是object（数组、对象）
        if (typeof data.Data === "object") {
          data.Data = JSON.stringify(data.Data);
        }
      }

      //2022-07-15新增：BaiduMapConfig属性中由于加载了地图，会多一些不需要存储的数据
      data.BaiduMapConfig = {};

      // 如果Config不为空
      if (!self.DiyCommon.IsNull(data.Config)) {
        // 如果是object（数组、对象）
        if (typeof data.Config === "object") {
          //是否需要判断数据源为Sql时，清空data.Data？
          if (data.Config.DataSource !== "Data") {
            data.Data = "[]";
          }
          //2022-07-14新增：像field.Config.JoinForm.TableId/Id这类值，要清空掉
          if (data.Config.JoinForm) {
            data.Config.JoinForm.TableId = "";
            data.Config.JoinForm.TableName = "";
            data.Config.JoinForm.Id = "";
            data.Config.JoinForm.FormMode = "";
            data.Config.JoinForm._SearchEqual = {};
          }
          //2024-12-16：处理将脏数据保存到了Config中
          if (data.Config.OpenTable) {
            data.Config.OpenTable.SearchAppend = {};
            data.Config.OpenTable.PropsWhere = [];
          }

          //这里会存入带Enter的↵符号，导致后面JSON.parse报错
          data.Config = JSON.stringify(data.Config);
        }
      }
      // 如果BindRole不为空
      if (!self.DiyCommon.IsNull(data.BindRole)) {
        // 如果是object（数组、对象）
        if (typeof data.BindRole === "object") {
          data.BindRole = JSON.stringify(data.BindRole);
        }
      }
      // 如果dataappend不为空
      if (!self.DiyCommon.IsNull(data.DataAppend)) {
        // 如果是object（数组、对象）
        if (typeof data.DataAppend === "object") {
          data.DataAppend = JSON.stringify(data.DataAppend);
        }
      }
    },
    GetDiyFieldModel(fieldId) {
      var self = this;
      self.DiyCommon.Post(
        self.DiyApi.GetDiyFieldModel,
        {
          Id: fieldId
          // OsClient: self.OsClient
        },
        function (result) {
          if (self.DiyCommon.Result(result)) {
            self.DiyCommon.DiyFieldConfigStrToJson(result.Data);
            self.$refs.fieldForm.DiyFieldStrToJson(result.Data);
            self.DiyCommon.Base64DecodeDiyField(result.Data);
            self.CurrentDiyFieldModel = result.Data;
            self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = self.CurrentDiyFieldModel.Data;
          }
        }
      );
    }
  }
};
</script>

<style lang="scss">
.diy-design-container {
  border-radius: 4px;
  height: calc(100vh - 120px);
  background-color: #fff;
  .keyword-search {
    // border-bottom: solid 1px #ccc;
    padding-left: 20px;
    .el-form-item--mini.el-form-item {
      margin-bottom: 10px;
      margin-top: 10px;
    }
  }
}

.field-container {
  height: calc(100vh - 80px - 50px - 20px - 20px);
  .aside {
    background: transparent;
    padding-left: 20px;
    padding-right: 20px;
    padding-top: 0;
    // height: calc(100vh - 84px);
    margin-bottom: 20px;
  }

  .aside-left {
    border-right: 1px solid #e6ebf5 !important;
    padding-bottom: 0;
  }

  .aside-right {
    border-left: 1px solid #e6ebf5 !important;
    padding-left: 0;
    padding-right: 0;
    padding-bottom: 0;
  }

  .center-main {
    background-color: transparent;
    padding-top: 10px;
    // height: calc(100vh - 84px);
    margin-bottom: 20px;

    .field-form {
      // height: calc(100vh - 158px);
      // border: 1px dashed #ff6c04;
      position: relative;
      padding: 15px;

      .gu-transit.field-drag {
        width: 100%;
        height: 30px;
        border: 1px dashed #ff6c04;

        // background-color: #ff6c04;
        .el-tag {
          display: none;
        }
      }

      .container-form-item {
        border: 1px solid transparent;
        width: 100%;
        // height: 33px;
        // margin-bottom: 18px;
      }

      .container-form-item:hover {
        // border: 1px dashed #ff6c04;
        cursor: pointer;
      }
    }
  }

  .right-main {
    background-color: transparent;
    padding: 0;
    // height: calc(100vh - 120px); // - 50px
    margin-bottom: 0px;
    position: relative;
    overflow: hidden;

    .el-radio {
      margin-bottom: 10px;
      margin-top: 10px;
    }

    .form-setting {
      padding-left: 20px;
      padding-right: 20px;
      // padding-bottom: 85px;
      .form-item-top {
        .el-form-item__content {
          margin-left: 0px !important;
        }
        .el-form-item__label {
          width: 100% !important;
          float: none;
        }
      }
      .el-form-item--mini.el-form-item {
        margin-bottom: 10px;
      }
    }

    .bottom-btns {
      .el-button + .el-button {
        margin-left: 5px;
      }
    }

    .el-divider__text {
      font-weight: bold;
    }

    .el-select.el-select--mini,
    .el-date-editor,
    .el-autocomplete {
      width: 100%;
    }
    .form-item-label-slot {
      float: none;
      margin-bottom: 5px;
      font-weight: 700;
    }
  }

  .right-footer {
    border-top: 1px solid #e6ebf5 !important;
  }

  .row-field {
    .icon {
      width: 20px;
      margin-right: 0px;
      font-size: 14px;
      // color: #ff6c04;
      color: #171717;
    }

    .el-tag {
      width: 100%;
      height: 28px;
      text-align: left;
      line-height: 28px;
      // border-radius: 0;
      color: #171717;
      padding-left: 7px;
      // border: solid 1px rgba(255, 106, 0, 0.1);
      // background-color: rgba(255, 106, 0, 0.1);
      margin-bottom: 5px;
      // border-left: solid 2px #242B49;
      border-radius: 4px;
    }

    .el-tag:hover {
      background-color: rgba(255, 106, 0, 0.2);
      border: 1px dashed #ff6c04;
      // border-left: solid 2px #242B49;
      color: #171717;
      cursor: move;
    }
  }
}
</style>
