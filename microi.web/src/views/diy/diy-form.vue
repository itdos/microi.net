<template>
  <div
    :class="
      'itdos-diy-' +
      Version +
      ' itdos-diy-form diy-form ' +
      (DiyCommon.IsNull(TableId) ? '' : ' itdos-diy-form-' + TableId) +
      (DiyCommon.IsNull(TableName) ? '' : ' itdos-diy-form-' + TableName) +
      ' ' +
      (DiyCommon.IsNull(DiyTableModel.InputBorderStyle)
        ? 'Border'
        : DiyTableModel.InputBorderStyle)
    "
  >
    <el-tabs
      id="field-form-tabs"
      v-model="FieldActiveTab"
      :tab-position="
        DiyCommon.IsNull(DiyTableModel.TabsPosition)
          ? 'top'
          : DiyTableModel.TabsPosition
      "
      :class="
        FormTabs.length == 1 &&
        (FormTabs[0].Name == 'none' || FormTabs[0].Name == 'info')
          ? 'field-form-tabs tab-pane-hide'
          : 'field-form-tabs tab-pane-show'
      "
      @tab-click="tabClickField"
    >
      <!-- :label="tab.Name"
            :lazy="LoadMode != 'Design'"
        -->
      <template v-for="(tab, tabIndex) in FormTabs">
        <el-tab-pane
          :key="'tab_name_' + tab.Name"
          :name="tab.Name"
          v-if="tab.Display !== false"
        >
          <span slot="label"
            ><i
              v-if="!DiyCommon.IsNull(tab.Icon)"
              :class="tab.Icon + ' marginRight5'"
            />{{ tab.Name }}</span
          >
          <div
            :id="'field-form-' + tabIndex"
            :data-tab="FieldActiveTab"
            :class="
              DiyTableModel.Name +
              ' field-form ' +
              (DiyTableModel.FieldBorder == 'Border' ? 'field-border' : '')
            "
          >
            <el-form
              v-if="tab.Name == FieldActiveTab"
              :rules="FormRules"
              :class="DiyTableModel.Name"
              ref="FormDiyTableModel"
              status-icon
              size="mini"
              :model="FormDiyTableModel"
              label-width="120px"
              :label-position="GetLabelPosition()"
            >
              <el-row :gutter="20">
                <!--开始循环组件-->
                <el-col
                  v-for="(field, index) in DiyFieldListGroupFunc(tab, tabIndex)"
                  v-show="GetFieldIsShow(field)"
                  :class="
                    'field_' +
                    field.Name +
                    (CurrentDiyFieldModel.Id == field.Id
                      ? ' active-field'
                      : '') +
                    ' ' +
                    'field_' +
                    field.Component
                  "
                  :key="'el_col_fieldid_' + field.Id"
                  :span="GetDiyTableColumnSpan(field)"
                  :xs="24"
                  @click.native="SelectField(field)"
                >
                  <div class="container-form-item">
                    <!--图片上传、文件上传，即使是设置了表单模板引擎，在编辑的时候也仍然需要显示上传控件-->
                    <template
                      v-if="
                        !DiyCommon.IsNull(field.V8TmpEngineForm) &&
                        field.Component != 'ImgUpload' &&
                        field.Component != 'FileUpload'
                      "
                    >
                      <!-- :label="field.Label" -->
                      <el-form-item
                        v-show="GetFieldIsShow(field)"
                        class="form-item"
                        size="mini"
                      >
                        <span
                          slot="label"
                          :title="GetFormItemLabel(field)"
                          :style="{ color: !field.Visible ? '#ccc' : '#000' }"
                        >
                          <el-tooltip
                            v-if="!DiyCommon.IsNull(field.Description)"
                            class="item"
                            effect="dark"
                            :content="field.Description"
                            placement="left"
                          >
                            <i class="el-icon-info"></i>
                          </el-tooltip>
                          {{ GetFormItemLabel(field) }}
                        </span>
                        <!-- <span v-html="RunFieldTemplateEngine(field, FormDiyTableModel)"></span> -->
                        <span
                          v-html="
                            FormDiyTableModel[field.Name + '_TmpEngineResult']
                          "
                        ></span>
                      </el-form-item>
                    </template>

                    <!--渲染定制开发的组件-->
                    <template
                      v-else-if="
                        !DiyCommon.IsNull(field.Config.DevComponentName)
                      "
                    >
                      <!-- :label="field.Label" -->
                      <el-form-item
                        v-show="GetFieldIsShow(field)"
                        class="form-item"
                        size="mini"
                      >
                        <span
                          slot="label"
                          :title="GetFormItemLabel(field)"
                          :style="{ color: !field.Visible ? '#ccc' : '#000' }"
                        >
                          <el-tooltip
                            v-if="!DiyCommon.IsNull(field.Description)"
                            class="item"
                            effect="dark"
                            :content="field.Description"
                            placement="left"
                          >
                            <i class="el-icon-info"></i>
                          </el-tooltip>
                          {{ GetFormItemLabel(field) }}
                        </span>
                        <component
                        v-if="!DiyCommon.IsNull(DevComponents[field.Config.DevComponentName])
                        &&
                        !DiyCommon.IsNull(DevComponents[field.Config.DevComponentName].Path)"
                        :is="field.Config.DevComponentName"
                        :table-row-id="TableRowId"
                        :data-append="GetDataAppend(field)" @FormSet="FormSet"
                        pageLifetimes: pageLifetimes />
                      </el-form-item>
                    </template>
                    <!--END - 渲染定制开发的组件-->

                    <!--渲染子表
                                        && !DiyCommon.IsNull(TableRowId)
                                    -->
                    <template
                      v-else-if="
                        field.Component == 'TableChild' &&
                        !DiyCommon.IsNull(field.Config.TableChildTableId) &&
                        !DiyCommon.IsNull(field.Config.TableChildSysMenuId) &&
                        !DiyCommon.IsNull(TableRowId)
                      "
                    >
                      <!-- :table-child-fk-value="FormDiyTableModel[field.Config.TableChildFkFieldName]" -->
                      <!-- :table-child-fk-value="TableRowId"
                                            TableChildCallbackField:主表哪些字段要回写到子表的哪些字段:[{ "Father" : "FielName1", "Child" : "FielName2" }, { "Father" : "FielName3", "Child" : "FielName4" }]
                                            :parant-form="FormDiyTableModel"

                                            这里ParentForm绑定了Form设置是因为子表回调ParentFormSet其实就是主表单的FormSet
                                            @ParentFormSet="FormSet"
                                        -->
                      <!--
                                                这是2021-11-22注释，感觉有问题
                                                :props-parent-field-list="GetDiyFieldListObjectFunc(field)"
                                            v-show="GetFieldIsShow(field)"
                                                 -->
                      <DiyTable
                        v-if="GetFieldIsShow(field)"
                        :type-field-name="'refTableChild_' + field.Name"
                        :ref="'refTableChild_' + field.Name"
                        :key="'refTableChild_' + field.Id"
                        :load-mode="LoadMode"
                        :props-table-type="'TableChild'"
                        :table-child-table-row-id="
                          field.Config.TableChild.PrimaryTableFieldName
                            ? FormDiyTableModel[
                                field.Config.TableChild.PrimaryTableFieldName
                              ]
                            : TableRowId
                        "
                        :container-class="'table-child'"
                        :table-child-config="field.Config.TableChild"
                        :table-child-field="field"
                        :table-child-field-label="field.Label"
                        :table-child-table-id="field.Config.TableChildTableId"
                        :table-child-sys-menu-id="
                          field.Config.TableChildSysMenuId
                        "
                        :table-child-fk-field-name="
                          field.Config.TableChildFkFieldName
                        "
                        :table-child-primary-table-field-name="
                          field.Config.TableChild.PrimaryTableFieldName
                        "
                        :table-child-callback-field="
                          field.Config.TableChildCallbackField
                        "
                        :table-child-form-mode="FormMode"
                        :father-form-model="FormDiyTableModelListen(field)"
                        :parent-v8="GetV8(field)"
                        :table-child-data="field.Config.TableChild.Data"
                        :search-append="field.Config.TableChild.SearchAppend"
                        :parent-form-load-finish="GetDiyTableRowModelFinish"
                        @ParentFormSet="FormSet"
                        @CallbackParentFormSubmit="CallbackParentFormSubmit"
                        @CallbakRefreshChildTable="CallbakRefreshChildTable"
                        @CallbackShowTableChildHideField="
                          ShowTableChildHideField
                        "
                      />
                    </template>
                    <!--END - 渲染子表-->

                    <!-- 关联表格 START -->
                    <template
                      v-else-if="
                        field.Component == 'JoinTable' &&
                        field.Config.JoinTable.TableId
                      "
                    >
                      <DiyTable
                        v-if="GetFieldIsShow(field)"
                        :type-field-name="'refJoinTable_' + field.Name"
                        :ref="'refJoinTable_' + field.Name"
                        :key="'refJoinTable_' + field.Id"
                        :load-mode="LoadMode"
                        :props-table-type="'JoinTable'"
                        :props-is-join-table="true"
                        :join-table-field="field"
                        :props-table-id="field.Config.JoinTable.TableId"
                        :props-sys-menu-id="field.Config.JoinTable.ModuleId"
                        :container-class="'table-child'"
                        :props-where="GetPropsSearch(field)"
                        :parent-form-load-finish="GetDiyTableRowModelFinish"
                        @CallbakRefreshChildTable="CallbakRefreshChildTable"
                      />
                    </template>
                    <!-- 关联表格 END -->

                    <!--
                                        渲染关联表单
                                        && !DiyCommon.IsNull(TableRowId)
                                    -->
                    <template
                      v-else-if="
                        field.Component == 'JoinForm' &&
                        ((!DiyCommon.IsNull(field.Config.JoinForm.TableId) &&
                          TableId != field.Config.JoinForm.TableId) ||
                          (!DiyCommon.IsNull(field.Config.JoinForm.TableName) &&
                            TableName != field.Config.JoinForm.TableName)) &&
                        (!DiyCommon.IsNull(field.Config.JoinForm.Id) ||
                          field.Config.JoinForm._SearchEqual != {})
                      "
                    >
                      <DiyForm
                        v-if="GetFieldIsShow(field)"
                        :ref="'refJoinForm_' + field.Name"
                        :key="'refJoinForm_' + field.Id"
                        :form-mode="
                          DiyCommon.IsNull(field.Config.JoinForm.FormMode)
                            ? FormMode
                            : field.Config.JoinForm.FormMode
                        "
                        :table-id="field.Config.JoinForm.TableId"
                        :table-name="field.Config.JoinForm.TableName"
                        :table-row-id="field.Config.JoinForm.Id"
                      />
                    </template>
                    <!--END - 渲染关联表单-->

                    <template v-else>
                      <el-divider
                        v-if="
                          field.Component == 'Divider' && GetFieldIsShow(field)
                        "
                        :content-position="
                          DiyCommon.IsNull(field.Config.DividerPosition)
                            ? 'left'
                            : field.Config.DividerPosition
                        "
                      >
                        <template v-if="field.Config.Divider.Tag">
                          <el-tag size="small" :type="field.Config.Divider.Tag">
                            <i
                              :class="
                                field.Config.Divider.Icon
                                  ? field.Config.Divider.Icon
                                  : ''
                              "
                            ></i>
                            <span v-html="field.Label"></span>
                          </el-tag>
                        </template>
                        <template v-else>
                          <i
                            :class="
                              field.Config.Divider.Icon
                                ? field.Config.Divider.Icon
                                : ''
                            "
                          ></i>
                          <span v-html="field.Label"></span>
                        </template>
                      </el-divider>
                      <!-- GetFieldLabel(field)
                                            :inline-message="true"
                                            :label="GetFormItemLabel(field)"
                                        -->
                      <el-form-item
                        v-else
                        v-show="GetFieldIsShow(field)"
                        :prop="field.Name"
                        :class="
                          'form-item' +
                          (field.NotEmpty && FormMode != 'View'
                            ? ' is-required '
                            : '')
                        "
                        size="mini"
                      >
                        <span
                          slot="label"
                          :title="GetFormItemLabel(field)"
                          :style="{ color: !field.Visible ? '#ccc' : '#000' }"
                        >
                          <el-tooltip
                            v-if="!DiyCommon.IsNull(field.Description)"
                            class="item"
                            effect="dark"
                            :content="field.Description"
                            placement="left"
                          >
                            <i class="el-icon-info"></i>
                          </el-tooltip>
                          {{ GetFormItemLabel(field) }}
                        </span>

                        <!--输入框 单行文本-->
                        <DiyInput
                          v-if="
                            field.Component == 'Text' ||
                            field.Component == 'Guid'
                          "
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-id="TableId"
                          :table-name="TableName"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                          @CallbakOnKeyup="FieldOnKeyup"
                        />
                        <DiyAutocomplete
                          v-else-if="field.Component == 'Autocomplete'"
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-id="TableId"
                          :table-name="TableName"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                          @CallbakOnKeyup="FieldOnKeyup"
                        />
                        <!-- :ref="'diyCodeEditor_' + field.Id"
                                                :key="'diyCodeEditor_' + field.Id" -->
                        <DiyCodeEditor
                          v-else-if="field.Component == 'CodeEditor'"
                          :ref="'ref_' + field.Name"
                          :field="field"
                          :key="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :height="
                            (field.Config.CodeEditor.Height || 500) + 'px'
                          "
                          :form-mode="FormMode"
                          :field-readonly="GetFieldReadOnly(field)"
                          :readonly-fields="ReadonlyFields"
                          @CallbackFormValueChange="CallbackFormValueChange"
                        >
                        </DiyCodeEditor>
                        <DiyCascader
                          v-else-if="field.Component == 'Cascader'"
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-id="TableId"
                          :table-name="TableName"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                          @CallbakOnKeyup="FieldOnKeyup"
                        />
                        <DiyAddress
                          v-else-if="field.Component == 'Address'"
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-id="TableId"
                          :table-name="TableName"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                          @CallbakOnKeyup="FieldOnKeyup"
                        />
                        <DiySelectTree
                          v-else-if="field.Component == 'SelectTree'"
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-id="TableId"
                          :table-name="TableName"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                          @CallbakOnKeyup="FieldOnKeyup"
                        />
                        <DiyDepartment
                          v-else-if="field.Component == 'Department'"
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-id="TableId"
                          :table-name="TableName"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                          @CallbakOnKeyup="FieldOnKeyup"
                        />
                        <!--数字-->
                        <el-input-number
                          v-else-if="field.Component == 'NumberText'"
                          v-model="FormDiyTableModel[field.Name]"
                          :disabled="GetFieldReadOnly(field)"
                          :step="
                            DiyCommon.IsNull(field.Config.NumberTextStep)
                              ? 1
                              : field.Config.NumberTextStep
                          "
                          :precision="
                            DiyCommon.IsNull(field.Config.NumberTextPrecision)
                              ? 0
                              : field.Config.NumberTextPrecision
                          "
                          :controls-position="
                            DiyCommon.IsNull(field.Config.NumberTextBtnPosition)
                              ? 'right'
                              : field.Config.NumberTextBtnPosition
                          "
                          :controls="
                            DiyCommon.IsNull(field.Config.NumberTextBtn)
                              ? true
                              : field.Config.NumberTextBtn
                          "
                          label=""
                          :placeholder="GetFieldPlaceholder(field)"
                          @change="
                            (currentValue, oldValue) => {
                              return NumberTextChange(
                                currentValue,
                                oldValue,
                                field
                              );
                            }
                          "
                          @blur="
                            (currentValue, oldValue) => {
                              return NumberTextChange(
                                currentValue,
                                oldValue,
                                field
                              );
                            }
                          "
                          @focus="SelectField(field)"
                          @keyup.native="FieldOnKeyup($event, field)"
                        >
                          <!-- <template slot="prepend">Http://</template> -->
                        </el-input-number>

                        <!--单选框-->
                        <DiyRadio
                          v-else-if="field.Component == 'Radio'"
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-in-edit="false"
                          :table-id="TableId"
                          :table-name="TableName"
                          :api-replace="ApiReplace"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                        />
                        <!--复选框-->
                        <!--
                                                当初为什么在v-else-if中加入这个条件 ？
                                                && DiyCommon.IsArray(FormDiyTableModel[field.Name])-->
                        <el-checkbox-group
                          v-else-if="field.Component == 'Checkbox'"
                          v-model="FormDiyTableModel[field.Name]"
                          :disabled="GetFieldReadOnly(field)"
                          @change="
                            (item) => {
                              return CommonV8CodeChange(item, field);
                            }
                          "
                          @focus="SelectField(field)"
                        >
                          <el-checkbox
                            v-for="(cbItem, index2) in field.Data"
                            :key="'chk_' + field.Name + '_' + index2"
                            :label="
                              DiyCommon.IsNull(field.Config.SelectSaveField)
                                ? cbItem
                                : cbItem[field.Config.SelectSaveField]
                            "
                          >
                            {{
                              DiyCommon.IsNull(field.Config.SelectLabel)
                                ? cbItem
                                : cbItem[field.Config.SelectLabel]
                            }}
                          </el-checkbox>
                        </el-checkbox-group>

                        <!--下拉框-->
                        <DiySelect
                          v-else-if="
                            field.Component == 'Select' ||
                            field.Component == 'MultipleSelect'
                          "
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-in-edit="false"
                          :table-id="TableId"
                          :table-name="TableName"
                          :api-replace="ApiReplace"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                        />
                        <!--日期-->
                        <DiyDateTime
                          v-if="field.Component == 'DateTime'"
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-id="TableId"
                          :table-name="TableName"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                          @CallbakOnKeyup="FieldOnKeyup"
                        >
                        </DiyDateTime>
                        <!--多行文本-->
                        <DiyTextarea
                          v-else-if="field.Component == 'Textarea'"
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :default-rows="field.Config.Textarea.DefaultRows"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-id="TableId"
                          :table-name="TableName"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                          @CallbakOnKeyup="FieldOnKeyup"
                        />
                        <!--自动编号-->
                        <el-input
                          v-if="field.Component == 'AutoNumber'"
                          v-model="FormDiyTableModel[field.Name]"
                          :disabled="true"
                          :placeholder="
                            field.Config.AutoNumberFixed +
                            DiyCommon.Add0(1, field.Config.AutoNumberLength)
                          "
                          @focus="SelectField(field)"
                        >
                          <i
                            v-if="
                              !DiyCommon.IsNull(field.Config.TextIcon) &&
                              field.Config.TextIconPosition == 'right'
                            "
                            slot="suffix"
                            :class="field.Config.TextIcon"
                          />
                          <i
                            v-if="
                              !DiyCommon.IsNull(field.Config.TextIcon) &&
                              field.Config.TextIconPosition == 'left'
                            "
                            slot="prefix"
                            :class="field.Config.TextIcon"
                          />

                          <template
                            v-if="
                              !DiyCommon.IsNull(field.Config.TextApend) &&
                              field.Config.TextApendPosition == 'left'
                            "
                            slot="prepend"
                            >{{ field.Config.TextApend }}</template
                          >
                          <template
                            v-if="
                              !DiyCommon.IsNull(field.Config.TextApend) &&
                              field.Config.TextApendPosition == 'right'
                            "
                            slot="append"
                            >{{ field.Config.TextApend }}</template
                          >
                        </el-input>
                        <!--开关  这里的上面，如果是预览模式，就只显示文字 ，不用显示控件-->
                        <DiySwitch
                          v-else-if="field.Component == 'Switch'"
                          :ref="'ref_' + field.Name"
                          v-model="FormDiyTableModel[field.Name]"
                          :field="field"
                          :form-diy-table-model="FormDiyTableModel"
                          :form-mode="FormMode"
                          :table-id="TableId"
                          :table-name="TableName"
                          :readonly-fields="ReadonlyFields"
                          :field-readonly="GetFieldReadOnly(field)"
                          @CallbackRunV8Code="RunV8Code"
                          @CallbackFormValueChange="CallbackFormValueChange"
                          @CallbakOnKeyup="FieldOnKeyup"
                        >
                        </DiySwitch>
                        <!--评分-->
                        <el-rate
                          v-else-if="field.Component == 'Rate'"
                          v-model="FormDiyTableModel[field.Name]"
                          :disabled="GetFieldReadOnly(field)"
                          class="marginTop5"
                          @change="
                            (item) => {
                              return CommonV8CodeChange(item, field);
                            }
                          "
                          @focus="SelectField(field)"
                        />

                        <!--颜色-->
                        <!-- :value="'ff6c04'" -->
                        <el-color-picker
                          v-else-if="field.Component == 'ColorPicker'"
                          v-model="FormDiyTableModel[field.Name]"
                          :disabled="GetFieldReadOnly(field)"
                          @change="
                            (item) => {
                              return CommonV8CodeChange(item, field);
                            }
                          "
                          @focus="SelectField(field)"
                        />

                        <!--文件上传-->
                        <template v-else-if="field.Component == 'FileUpload'">
                          <el-upload
                            v-if="
                              FormMode != 'View' && !GetFieldReadOnly(field)
                            "
                            :disabled="GetFieldReadOnly(field)"
                            :ref="field.Component + '_' + field.Name"
                            :show-file-list="false"
                            class="upload-drag-style"
                            :action="DiyApi.Upload()"
                            :data="{
                              Path: '/file',
                              Limit: field.Config.FileUpload.Limit,
                              Preview: false,
                            }"
                            :headers="{
                              authorization:
                                'Bearer ' + DiyCommon.Authorization(),
                            }"
                            drag
                            :multiple="field.Config.FileUpload.Multiple"
                            :limit="
                              field.Config.FileUpload.Multiple == true
                                ? field.Config.FileUpload.MaxCount
                                : 1
                            "
                            :before-upload="
                              (file) => {
                                return BeforeFileUpload(file, field);
                              }
                            "
                            :on-success="
                              (result, file, fileList) => {
                                return FileUploadSuccess(
                                  result,
                                  file,
                                  fileList,
                                  field
                                );
                              }
                            "
                            :on-remove="
                              (file, fileList) => {
                                return FileUploadRemove(file, fileList, field);
                              }
                            "
                          >
                            <i class="el-icon-upload" />
                            <div class="el-upload__text">
                              将文件拖到此处，或<em>点击上传</em>
                            </div>
                            <div slot="tip" class="el-upload__tip">
                              {{ field.Config.FileUpload.Tips }}
                            </div>
                          </el-upload>
                          <!--如果是单文件，并且不等于空，则直接显示下载路径-->
                          <div
                            v-if="
                              !field.Config.FileUpload.Multiple &&
                              !DiyCommon.IsNull(FormDiyTableModel[field.Name])
                            "
                            style=""
                          >
                            {{ GetUploadPath(field) }}
                            <i
                              :class="
                                FormDiyTableModel[field.Name] == '正在上传中...'
                                  ? 'el-icon-loading mr-1'
                                  : 'el-icon-document mr-1'
                              "
                            ></i>
                            <a
                              class="mr-2"
                              :href="
                                FormDiyTableModel[
                                  field.Name + '_' + field.Name + '_RealPath'
                                ]
                              "
                              target="_blank"
                            >
                              {{ FormDiyTableModel[field.Name] }}
                            </a>
                            <el-button
                              type="text"
                              v-if="
                                FormMode != 'View' && !GetFieldReadOnly(field)
                              "
                              icon="el-icon-delete"
                              @click="DelSingleUpload(field)"
                            >
                            </el-button>
                          </div>
                          <!--如果是多文件，并且不等于空，则显示列表-->
                          <template
                            v-else-if="
                              field.Config.FileUpload.Multiple &&
                              !DiyCommon.IsNull(
                                FormDiyTableModel[field.Name]
                              ) &&
                              FormDiyTableModel[field.Name].length > 0
                            "
                          >
                            <el-table
                              :data="GetFileUpladFils(field)"
                              :show-header="false"
                            >
                              <el-table-column type="index" width="15">
                              </el-table-column>
                              <el-table-column width="15">
                                <template slot-scope="scope">
                                  <i
                                    :class="
                                      scope.row.State == 0
                                        ? 'el-icon-loading'
                                        : 'el-icon-document'
                                    "
                                  ></i>
                                </template>
                              </el-table-column>
                              <el-table-column>
                                <template slot-scope="scope">
                                  <!-- 系统设置加了判断，如果是在线访问文档，则打开界面引擎2025-5-4刘诚 -->
                                  <!-- <a
                                    class="fileupload-a"
                                    :href="
                                      FormDiyTableModel[
                                        field.Name +
                                          '_' +
                                          scope.row.Id +
                                          '_RealPath'
                                      ]
                                    "
                                    target="_blank"
                                  > -->
                                  <span
                                    class="fileupload-a"
                                    @click="
                                      GoUrl(
                                        FormDiyTableModel[
                                          field.Name +
                                            '_' +
                                            scope.row.Id +
                                            '_RealPath'
                                        ]
                                      )
                                    "
                                    >{{ GetUploadPath(field, scope.row) }}
                                    {{ scope.row.Name }}</span
                                  >
                                  <!-- </a> -->
                                </template>
                              </el-table-column>
                              <el-table-column width="70" prop="Size">
                                <template slot-scope="scope">
                                  {{ DiyCommon.GetFileSize(scope.row.Size) }}
                                </template>
                              </el-table-column>
                              <el-table-column
                                v-if="
                                  FormMode != 'View' && !GetFieldReadOnly(field)
                                "
                                width="32"
                              >
                                <template slot-scope="scope">
                                  <el-button
                                    type="text"
                                    icon="el-icon-delete"
                                    @click="DelUploadFiles(scope.row, field)"
                                  >
                                  </el-button>
                                </template>
                              </el-table-column>
                            </el-table>
                            <!-- <div v-for="(file, index) in FormDiyTableModel[field.Name]"
                                                        :key="file.Id + index"
                                                        class="fileupload-file-item"
                                                        style=""
                                                    >
                                                        {{GetUploadPath(field, file.Path, field.Config.FileUpload.Limit, file.Id)}}
                                                        <a class="fileupload-a"
                                                            :href="FormDiyTableModel[field.Name + '_' + file.Id + '_RealPath']" target="_blank">
                                                            {{file.Name}}
                                                        </a>
                                                    </div> -->
                          </template>
                        </template>

                        <!--图片上传-->
                        <template v-else-if="field.Component == 'ImgUpload'">
                          <el-upload
                            v-if="
                              FormMode != 'View' && !GetFieldReadOnly(field)
                            "
                            :disabled="GetFieldReadOnly(field)"
                            :ref="field.Component + '_' + field.Name"
                            :show-file-list="false"
                            class="upload-drag-style"
                            drag
                            :action="DiyApi.Upload()"
                            :data="{
                              Path: '/img',
                              Limit: field.Config.ImgUpload.Limit,
                              Preview: field.Config.ImgUpload.Preview,
                            }"
                            :headers="{
                              authorization:
                                'Bearer ' + DiyCommon.Authorization(),
                            }"
                            :multiple="field.Config.ImgUpload.Multiple"
                            :limit="
                              field.Config.ImgUpload.Multiple == true
                                ? field.Config.ImgUpload.MaxCount
                                : 1
                            "
                            :before-upload="
                              (file) => {
                                return UploadImgBefore(file, field);
                              }
                            "
                            :on-success="
                              (result, file, fileList) => {
                                return ImgUploadSuccess(
                                  result,
                                  file,
                                  fileList,
                                  field
                                );
                              }
                            "
                            :on-remove="
                              (file, fileList) => {
                                return ImgUploadRemove(file, fileList, field);
                              }
                            "
                          >
                            <i class="el-icon-upload" />
                            <div class="el-upload__text">
                              将图片拖到此处，或<em>点击上传</em>
                            </div>
                            <div slot="tip" class="el-upload__tip">
                              {{ field.Config.ImgUpload.Tips }}
                            </div>
                          </el-upload>
                          <template
                            v-if="
                              !field.Config.ImgUpload.Multiple &&
                              !DiyCommon.IsNull(FormDiyTableModel[field.Name])
                            "
                          >
                            <el-image
                              :src="
                                FormDiyTableModel[
                                  field.Name + '_' + field.Name + '_RealPath'
                                ]
                              "
                              :preview-src-list="[
                                FormDiyTableModel[
                                  field.Name + '_' + field.Name + '_RealPath'
                                ],
                              ]"
                              :fit="'cover'"
                              style="height: 175px; width: 175px"
                            >
                              {{ GetUploadPath(field) }}
                            </el-image>
                            <el-button
                              type="text"
                              class="button"
                              v-if="
                                FormMode != 'View' && !GetFieldReadOnly(field)
                              "
                              icon="el-icon-delete"
                              style="font-size: 20px"
                              @click="DelSingleUpload(field)"
                            ></el-button>
                          </template>
                          <template v-else>
                            <!-- <el-card v-for="(danyuan, i) in DanYuanList"
                                                        :key="'dy_' + i"
                                                        class="box-card float-left"
                                                        style="margin-right:10px;margin-bottom:10px;width: auto;"
                                                        shadow="hover">
                                                    </el-card> -->
                            <!-- class="board-column-content" -->
                            <draggable
                              v-if="
                                Array.isArray(FormDiyTableModel[field.Name])
                              "
                              :list="FormDiyTableModel[field.Name]"
                              v-bind="$attrs"
                              :set-data="DraggableSetData"
                              :options="{
                                disabled: FormMode == 'Edit' ? false : true,
                              }"
                            >
                              <el-card
                                v-for="(img, index) in FormDiyTableModel[
                                  field.Name
                                ]"
                                :key="img.Id + '_index_' + index"
                                class="imgupload-imgs float-left"
                                style="
                                  margin-right: 10px;
                                  margin-bottom: 10px;
                                  width: 175px;
                                "
                                :body-style="{ padding: '0px' }"
                              >
                                {{ GetUploadPath(field, img) }}
                                <el-image
                                  :src="
                                    FormDiyTableModel[
                                      field.Name + '_' + img.Id + '_RealPath'
                                    ]
                                  "
                                  :preview-src-list="GetImgUploadImgs(field)"
                                  :fit="'cover'"
                                  class="image"
                                  style="height: 175px; width: 175px"
                                >
                                </el-image>
                                <div style="padding: 14px">
                                  <div :title="img.Name" class="no-br overhide">
                                    <span v-if="FormMode != 'Edit'">{{
                                      img.Name
                                    }}</span>
                                    <el-input
                                      v-if="FormMode == 'Edit'"
                                      v-model="img.Name"
                                      style="width: 100%"
                                    ></el-input>
                                  </div>
                                  <div class="bottom clearfix">
                                    <time class="time">{{
                                      img.CreateTime
                                    }}</time>
                                    <el-button
                                      type="text"
                                      class="button"
                                      v-if="
                                        FormMode != 'View' &&
                                        !GetFieldReadOnly(field)
                                      "
                                      icon="el-icon-delete"
                                      @click="DelUploadFiles(img, field)"
                                    ></el-button>
                                  </div>
                                </div>
                              </el-card>
                            </draggable>
                            <!-- <el-image v-for="(img, index) in FormDiyTableModel[field.Name]"
                                                        :key="img.Id + index"
                                                        :src="FormDiyTableModel[field.Name + '_' + img.Id + '_RealPath']"
                                                        :preview-src-list="[GetImgUploadImgs(FormDiyTableModel[field.Name])]"
                                                        :fit="'cover'"
                                                        class="mr-2 mt-2 mb-2"
                                                        style="height:100px;width:100px;">
                                                        {{GetUploadPath(field, img.Path, field.Config.ImgUpload.Limit, img.Id)}}
                                                    </el-image> -->
                          </template>
                        </template>

                        <!--富文本-->
                        <!-- :destroy="!(field.Component == 'RichText'
                                                                && FormDiyTableModel[field.Name] != undefined
                                                                && FormMode != 'View')" -->
                        <template
                          v-else-if="
                            field.Component == 'RichText' &&
                            FormDiyTableModel[field.Name] != undefined
                          "
                        >
                          <div
                            v-if="
                              FormMode != 'View' &&
                              FormDiyTableModel[field.Name] != undefined
                            "
                          >
                            <div
                              v-if="
                                field.Config.RichText &&
                                field.Config.RichText.EditorProduct == 'UEditor'
                              "
                            >
                              <vue-neditor-wrap
                                v-model="FormDiyTableModel[field.Name]"
                                :disabled="GetFieldReadOnly(field)"
                                :config="ueditorConfig"
                                :destroy="
                                  !(
                                    field.Component == 'RichText' &&
                                    FormDiyTableModel[field.Name] !=
                                      undefined &&
                                    FormMode != 'View'
                                  )
                                "
                                @focus="SelectField(field)"
                              />
                            </div>

                            <div v-else style="border: 1px solid #ccc">
                              <Toolbar
                                :editor="editorRef"
                                :defaultConfig="toolbarConfig"
                                :mode="mode"
                                style="border-bottom: 1px solid #ccc"
                              />
                              <Editor
                                :defaultConfig="editorConfig"
                                :mode="mode"
                                v-model="FormDiyTableModel[field.Name]"
                                style="height: 400px; overflow-y: hidden"
                                @onCreated="handleCreated"
                                @onChange="handleChange"
                                @onDestroyed="handleDestroyed"
                                @onFocus="handleFocus"
                                @onBlur="handleBlur"
                                @customAlert="customAlert"
                                @customPaste="customPaste"
                              />
                            </div>
                          </div>
                          <div v-else>
                            <!--v-else vue-neditor-wrap-->
                            <div v-html="FormDiyTableModel[field.Name]"></div>
                          </div>
                        </template>

                        <!--按钮-->
                        <el-button
                          v-else-if="field.Component == 'Button'"
                          :type="GetFieldConfigButtonType(field)"
                          :disabled="GetFieldReadOnly(field)"
                          :loading="field.Config.Button.Loading"
                          :icon="field.Config.Button.Icon"
                          :size="field.Config.Button.Size"
                          @click="ComponentButtonClick(field)"
                        >
                          <!-- <i v-if="!DiyCommon.IsNull(field.Config.Button.Icon)" :class="field.Config.Button.Icon"></i>  -->
                          {{ field.Label }}
                        </el-button>

                        <!--高德地图-->
                        <div
                          v-else-if="
                            field.Component == 'Map' &&
                            field.Config.MapCompany == 'AMap'
                          "
                          class="form-amap"
                        >
                          <div class="map-container">
                            <!-- <div class="tip">
                                                        <input class="custom-componet-input" id="custom-componet-input"
                                                            placeholder="输入关键词搜索" />
                                                    </div> -->
                            <el-amap-search-box
                              :default="field.AmapConfig.SearchBoxDefault"
                              class="search-box"
                              :search-option="searchOption"
                              :on-search-result="
                                (pois) => {
                                  return field.AmapConfig.OnSearchResult(
                                    pois,
                                    field
                                  );
                                }
                              "
                            />
                            <el-amap
                              :vid="'amap_' + field.Name"
                              :zoom="field.AmapConfig.Zoom"
                              :itdos-data="field"
                              :plugin="field.AmapConfig.AmapPlugin"
                              :events="field.AmapConfig.Events"
                              :center="field.AmapConfig.Center"
                            >
                              <!-- <customMapSearchbox
                                                            @select="SelectSearch"
                                                            input="custom-componet-input" ></customMapSearchbox> -->

                              <!-- :search-option="searchOption"  -->

                              <el-amap-marker
                                v-if="field.AmapConfig.SelectMarker"
                                :position="
                                  field.AmapConfig.SelectMarker.position
                                "
                                :label="field.AmapConfig.SelectMarker.label"
                              />
                            </el-amap>
                          </div>
                        </div>

                        <!--百度地图-->
                        <div
                          v-else-if="
                            (field.Component == 'Map' ||
                              field.Component == 'MapArea') &&
                            (field.Config.MapCompany == 'Baidu' ||
                              DiyCommon.IsNull(field.Config.MapCompany))
                          "
                          class="form-amap"
                        >
                          <div class="map-container">
                            <!-- <div class="tip">
                                                        <input class="custom-componet-input" id="custom-componet-input"
                                                            placeholder="输入关键词搜索" />
                                                    </div> -->
                            <!-- <el-amap-search-box
                                                        :default="field.AmapConfig.SearchBoxDefault"
                                                        class="search-box"
                                                        :search-option="searchOption"
                                                        :on-search-result="(pois) => { return field.AmapConfig.OnSearchResult(pois, field)}" />
                                                    <el-amap
                                                        :vid="'amap_' + field.Name"
                                                        :zoom="field.AmapConfig.Zoom"
                                                        :itdos-data="field"
                                                        :plugin="field.AmapConfig.AmapPlugin"
                                                        :events="field.AmapConfig.Events"
                                                        :center="field.AmapConfig.Center"
                                                        @zoomend="syncCenterAndZoom" //地图更改缩放级别结束时触发触发此事件
                                                        >

                                                        <el-amap-marker
                                                            v-if="field.AmapConfig.SelectMarker"
                                                            :position="field.AmapConfig.SelectMarker.position"
                                                            :label="field.AmapConfig.SelectMarker.label" />
                                                    </el-amap>
                                                    -->
                            <baidu-map
                              v-if="LoadMap"
                              :id="'map_id_' + field.Name"
                              ak="Eq3opqeD03kLwdeyBf308xiSCz6a7FIV"
                              :class="'map bm-view '"
                              :map-click="false"
                              :zoom="GetFieldZoom(field)"
                              :center="GetFieldCenter(field)"
                              :scroll-wheel-zoom="
                                field.BaiduMapConfig.ScrollWheelZoom
                              "
                              @mousemove="
                                (e) => {
                                  return syncPolyline(e, field);
                                }
                              "
                              @click="
                                (e) => {
                                  return paintPolyline(e, field);
                                }
                              "
                              @rightclick="
                                (e) => {
                                  return newPolyline(e, field);
                                }
                              "
                              @zoomend="
                                (e) => {
                                  return syncCenterAndZoom(e, field);
                                }
                              "
                              @ready="
                                ({ BMap, map }) => {
                                  return BaiduMapReady({ BMap, map }, field);
                                }
                              "
                            >
                              <!-- <bm-view class="map"></bm-view> -->
                              <!--缩放控件-->
                              <bm-navigation
                                anchor="BMAP_ANCHOR_TOP_RIGHT"
                              ></bm-navigation>
                              <!--定位-->
                              <bm-geolocation
                                anchor="BMAP_ANCHOR_BOTTOM_RIGHT"
                                :showAddressBar="true"
                                :autoLocation="true"
                              ></bm-geolocation>
                              <!--版权信息 BmCopyRight-->
                              <bm-copyright
                                anchor="BMAP_ANCHOR_TOP_RIGHT"
                                :copyright="[
                                  { id: 1, content: 'Copyright Microi.net' },
                                ]"
                              >
                              </bm-copyright>

                              <bm-control>
                                <button
                                  v-if="field.Component == 'MapArea'"
                                  type="button"
                                  style="margin: 6px 8px"
                                  :class="
                                    field.BaiduMapConfig.Polyline.Editing
                                      ? 'btn btn-danger btn-sm'
                                      : 'btn btn-primary btn-sm'
                                  "
                                  @click="toggle(field)"
                                >
                                  {{
                                    field.BaiduMapConfig.Polyline.Editing
                                      ? "停止绘制"
                                      : "开始绘制"
                                  }}
                                </button>
                                <button
                                  v-if="field.Component == 'MapArea'"
                                  type="button"
                                  style="margin: 6px 8px"
                                  class="btn btn-warning btn-sm"
                                  @click="ClearPolyline(field)"
                                >
                                  {{ "清除绘制" }}
                                </button>

                                <!-- v-if="field.Component == 'MapArea'" -->
                                <button
                                  type="button"
                                  style="margin: 6px 8px"
                                  class="btn btn-success btn-sm"
                                  @click="FullScreenMap(field)"
                                >
                                  <span :id="'map_id_fullscreen_' + field.Name"
                                    >全屏</span
                                  >
                                </button>
                                <!-- <button @click="openDistanceTool">开启测距</button> -->
                                <!-- <bm-auto-complete :sugStyle="{zIndex: 1}"> -->
                                <!-- <search-field placeholder="请输入地名关键字">
                                                                </search-field> -->
                                <!-- <el-input  placeholder="请输入地名关键字"></el-input> -->
                                <!-- <SearchField placeholder="请输入地名关键字"></SearchField> -->
                                <!-- </bm-auto-complete> -->

                                <!-- v-model="FormDiyTableModel[(field.Name)]" -->
                                <el-autocomplete
                                  v-if="
                                    FormMode !== 'View' &&
                                    !DiyCommon.IsNull(
                                      FormDiyTableModel[field.Name]
                                    )
                                  "
                                  v-model="
                                    FormDiyTableModel[field.Name].Address
                                  "
                                  size="mini"
                                  :fetch-suggestions="
                                    (queryString, cb) => {
                                      return BaiduMapQuerySearch(
                                        queryString,
                                        cb,
                                        field
                                      );
                                    }
                                  "
                                  placeholder="搜索地址"
                                  class="baidu-map-search"
                                  :trigger-on-focus="false"
                                  @select="
                                    (item) => {
                                      return BaiduMapHandleSelect(item, field);
                                    }
                                  "
                                />
                              </bm-control>

                              <template v-if="field.Component == 'MapArea'">
                                <bm-polyline
                                  :path="path"
                                  v-for="(path, pathIndex) of field
                                    .BaiduMapConfig.Polyline.Paths"
                                  :key="
                                    'map_path_' + field.Name + '_' + pathIndex
                                  "
                                >
                                </bm-polyline>
                              </template>

                              <!-- :labelStyle="{color: 'blue', fontSize : '24px'}"  -->
                              <bm-marker
                                v-if="
                                  field.Component == 'Map' &&
                                  !DiyCommon.IsNull(
                                    FormDiyTableModel[field.Name]
                                  ) &&
                                  !DiyCommon.IsNull(
                                    FormDiyTableModel[field.Name + '_Lng']
                                  )
                                "
                                :position="{
                                  lng:
                                    FormDiyTableModel[field.Name + '_Lng'] || 0,
                                  lat:
                                    FormDiyTableModel[field.Name + '_Lat'] || 0,
                                }"
                                :dragging="true"
                                @dragend="
                                  ({ type, target, pixel, point }) => {
                                    return BaiduMapMarkerDragend(
                                      { type, target, pixel, point },
                                      field
                                    );
                                  }
                                "
                                animation="BMAP_ANIMATION_BOUNCE"
                              >
                                <bm-label
                                  :content="
                                    DiyCommon.IsNull(
                                      FormDiyTableModel[field.Name].Address
                                    )
                                      ? '您选择了这里'
                                      : FormDiyTableModel[field.Name].Address
                                  "
                                  :offset="{ width: -35, height: 30 }"
                                />
                              </bm-marker>
                            </baidu-map>
                          </div>
                        </div>
                        <!-- style="height:100px;background-color:rgba(255,106,0,0.1);line-height:100px;text-align:center;" -->
                        <div v-else-if="field.Component == 'TableChild'">
                          <!--
                                                    {{'子表组件'}}
                                                    v-show="GetFieldIsShow(field)"
                                                -->
                          <DiyTable
                            v-if="GetFieldIsShow(field)"
                            :type-field-name="'refTableChild2_' + field.Name"
                            :ref="'refTableChild2_' + field.Name"
                            :key="'refTableChild2_' + field.Id"
                            :load-mode="LoadMode"
                            :table-child-table-row-id="TableRowId"
                            :props-table-type="'TableChild'"
                            :container-class="'table-child'"
                            :table-child-config="field.Config.TableChild"
                            :table-child-field="field"
                            :table-child-field-label="field.Label"
                            :table-child-table-id="
                              field.Config.TableChildTableId
                            "
                            :table-child-sys-menu-id="
                              field.Config.TableChildSysMenuId
                            "
                            :table-child-fk-field-name="
                              field.Config.TableChildFkFieldName
                            "
                            :table-child-primary-table-field-name="
                              field.Config.TableChild.PrimaryTableFieldName
                            "
                            :table-child-callback-field="
                              field.Config.TableChildCallbackField
                            "
                            :table-child-form-mode="FormMode"
                            :father-form-model="FormDiyTableModelListen(field)"
                            :parent-v8="GetV8(field)"
                            :table-child-data="field.Config.TableChild.Data"
                            :search-append="
                              field.Config.TableChild.SearchAppend
                            "
                            :parent-form-load-finish="GetDiyTableRowModelFinish"
                            @ParentFormSet="FormSet"
                            @CallbackParentFormSubmit="CallbackParentFormSubmit"
                            @CallbakRefreshChildTable="CallbakRefreshChildTable"
                            @CallbackShowTableChildHideField="
                              ShowTableChildHideField
                            "
                          />
                        </div>
                        <div
                          v-else-if="field.Component == 'JoinForm'"
                          style="
                            height: 100px;
                            background-color: rgba(255, 106, 0, 0.1);
                            line-height: 100px;
                            text-align: center;
                          "
                        >
                          {{ "关联表单" }}
                        </div>
                        <!--弹出表格-->
                        <template
                          v-else-if="
                            field.Component == 'OpenTable' &&
                            FormDiyTableModel[field.Name] != undefined
                          "
                        >
                          <div>
                            <el-button
                              :disabled="GetFieldReadOnly(field)"
                              @click="OpenTableEvent(field)"
                            >
                              {{
                                DiyCommon.IsNull(field.Config.OpenTable.BtnName)
                                  ? "弹出表格"
                                  : field.Config.OpenTable.BtnName
                              }}
                            </el-button>
                            <!-- :modal="!IsTableChild()" -->
                            <!-- :width="GetOpenFormWidth()" -->
                            <!-- :modal-append-to-body="false" -->
                            <el-dialog
                              v-if="field.Config.OpenTable.ShowDialog"
                              v-el-drag-dialog
                              :modal="true"
                              :width="'80%'"
                              :modal-append-to-body="true"
                              :append-to-body="true"
                              :visible.sync="field.Config.OpenTable.ShowDialog"
                              :close-on-click-modal="false"
                              :close-on-press-escape="false"
                              :destroy-on-close="true"
                              :show-close="false"
                              class="dialog-opentable"
                            >
                              <div slot="title">
                                <div
                                  class="pull-left"
                                  style="color: rgb(0, 0, 0); font-size: 15px"
                                >
                                  <i :class="'fas fa-table'" />
                                  {{
                                    DiyCommon.IsNull(
                                      field.Config.OpenTable.BtnName
                                    )
                                      ? "弹出表格"
                                      : field.Config.OpenTable.BtnName
                                  }}
                                </div>
                                <div class="pull-right">
                                  <el-button
                                    :loading="BtnLoading"
                                    type="primary"
                                    size="mini"
                                    icon="far fa-check-circle"
                                    @click="RunOpenTableSubmitV8(field)"
                                  >
                                    {{ $t("Msg.Submit") }}
                                  </el-button>
                                  <el-button
                                    size="mini"
                                    icon="el-icon-close"
                                    @click="
                                      field.Config.OpenTable.ShowDialog = false
                                    "
                                  >
                                    {{ $t("Msg.Close") }}
                                  </el-button>
                                </div>
                                <div class="clear"></div>
                              </div>
                              <div class="clear">
                                <DiyTable
                                  :type-field-name="
                                    'refOpenTable_' + field.Name
                                  "
                                  :ref="'refOpenTable_' + field.Name"
                                  :key="'refOpenTable_' + field.Id"
                                  :load-mode="LoadMode"
                                  :props-table-type="'OpenTable'"
                                  :props-table-id="
                                    field.Config.OpenTable.TableId
                                  "
                                  :props-table-name="
                                    field.Config.OpenTable.TableName
                                  "
                                  :props-sys-menu-id="
                                    field.Config.OpenTable.SysMenuId
                                  "
                                  :enable-multiple-select="
                                    field.Config.OpenTable.MultipleSelect
                                  "
                                  :search-append="
                                    field.Config.OpenTable.SearchAppend
                                  "
                                  :props-where="
                                    field.Config.OpenTable.PropsWhere
                                  "
                                />
                              </div>
                            </el-dialog>
                          </div>
                        </template>

                        <div
                          v-else-if="field.Component == 'DevComponent'"
                          style="
                            height: 100px;
                            background-color: rgba(255, 106, 0, 0.1);
                            line-height: 100px;
                            text-align: center;
                          "
                        >
                          {{ "定制开发组件" }}
                        </div>
                        <div v-else-if="field.Component == 'FontAwesome'">
                          <DiyFontawesome
                            v-model="FormDiyTableModel[field.Name]"
                            :field="field"
                            :form-diy-table-model="FormDiyTableModel"
                            :form-mode="FormMode"
                            :table-id="TableId"
                            :table-name="TableName"
                            :readonly-fields="ReadonlyFields"
                            :field-readonly="GetFieldReadOnly(field)"
                            @CallbackRunV8Code="RunV8Code"
                            @CallbackFormValueChange="CallbackFormValueChange"
                            @CallbakOnKeyup="FieldOnKeyup"
                          >
                          </DiyFontawesome>
                        </div>
                        <!-- 2025-2-10，Ye---新增二维码生成的组件，用于集团 -->
                        <div v-else-if="field.Component == 'Qrcode'">
                          <div>
                            <QrCodeGenerator
                              :dataAppend="field.DataAppend"
                              :FormMode="FormMode"
                              :field="field"
                              v-model="FormDiyTableModel[field.Name]"
                              @handleGenerate="
                                ComponentQrcodeButtonClick(field, 'generate')
                              "
                              @handleDownload="
                                ComponentQrcodeButtonClick(field, 'download')
                              "
                              @send-data="handleQrCodeImageBase64"
                              v-if="GetFieldIsShow(field)"
                              ref="qrCodeGenerator"
                            />
                          </div>
                        </div>
                        <!-- <div
                                                v-else>
                                                {{GetColValue(FormDiyTableModel, field)}}
                                            </div> -->
                      </el-form-item>
                    </template>
                  </div>
                </el-col>
              </el-row>
            </el-form>
          </div>
        </el-tab-pane>
        <div
          v-if="
            DiyFieldList.length == 0 &&
            LoadDiyFieldList &&
            tab.Display !== false
          "
          :key="'div_' + tab.Name"
          class="not-field"
        >
          <div style="margin-top: -40px">
            <img :src="'./static/img/no-data.svg'" style="width: 200px" />
          </div>
          <div style="height: 32px; margin-top: -30px">
            请从左侧拖入控件，开始设计表单！
          </div>
        </div>
      </template>
    </el-tabs>
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
    <!--抽屉或弹窗打开完整的Form-->
    <DiyFormDialog
      ref="refDiyTable_DiyFormDialog"
      :parent-v8="GetV8()"
    ></DiyFormDialog>
  </div>
</template>

<script>
import draggable from "vuedraggable";
import Vue from "vue";

import _ from "underscore";
import { mapState, mapGetters } from "vuex";

import VueAMap from "vue-amap";
Vue.use(VueAMap);

import {
  BaiduMap,
  BmControl,
  BmPolyline,
  BmNavigation,
  BmGeolocation,
  BmCopyright,
  // , BmView
  BmAutoComplete,
  // ,SearchField
  BmMarker,
  BmLabel,
} from "vue-baidu-map";
// import SearchField from '@/views/itdos/diy/components/TextField'
// Vue.use(BaiduMap, {
//   // ak 是在百度地图开发者平台申请的密钥 详见 http://lbsyun.baidu.com/apiconsole/key */
//   ak: 'Eq3opqeD03kLwdeyBf308xiSCz6a7FIV'
// })
// import {createCustomComponent} from 'vue-amap'
import DiyInput from "./diy-field-component/diy-input";
import DiyAutocomplete from "./diy-field-component/diy-autocomplete";
import DiyCascader from "./diy-field-component/diy-cascader";
// import DiyAddress from './diy-field-component/diy-address'
import DiySelectTree from "./diy-field-component/diy-select-tree";
import DiyDepartment from "./diy-field-component/diy-department";
import DiyFontawesome from "./diy-field-component/diy-fontawesome";
import DiySwitch from "./diy-field-component/diy-switch";
import elDragDialog from "@/directive/el-drag-dialog";
import DiySelect from "./diy-field-component/diy-select";
import DiyRadio from "./diy-field-component/diy-radio";
import DiyDateTime from "./diy-field-component/diy-datetime";
import DiyTextarea from "./diy-field-component/diy-textarea";
import DiyFormDialog from "./diy-form-dialog";
import DiyCustomDialog from "./diy-custom-dialog";

import QrCodeGenerator from "@/views/diy/workflow/component/diy-qrcode.vue";

export default {
  name: "DiyForm",
  directives: {
    elDragDialog,
  },
  components: {
    draggable,
    BaiduMap,
    BmControl,
    BmPolyline,
    BmNavigation,
    BmGeolocation,
    BmCopyright,
    BmAutoComplete,
    BmMarker,
    BmLabel,
    // SearchField,
    // BmView,
    VueAMap,
    // customMapSearchbox,
    // 'TableChild': () => import('@/components/diy-table-rowlist')
    // 'TableChild': (resolve) => require(['./diy-table-rowlist'], resolve)
    DiyTable: (resolve) => require(["./diy-table-rowlist"], resolve),
    // ----定制end
    DiyForm: (resolve) => require(["./diy-form"], resolve),
    DiyCodeEditor: (resolve) =>
      require(["./diy-components/diy-code-editor"], resolve),
    DiyInput,
    DiyAutocomplete,
    DiyCascader,
    // DiyAddress,
    DiySelectTree,
    DiyFontawesome,
    DiySwitch,
    DiySelect,
    DiyRadio,
    DiyDateTime,
    DiyTextarea,
    DiyDepartment,
    DiyFormDialog,
    DiyCustomDialog,
    QrCodeGenerator,
  },
  computed: {
    ...mapState({
      // OsClient: state => state.DiyStore.OsClient
      SysConfig: (state) => state.DiyStore.SysConfig,
    }),
    GetCurrentUser: function () {
      return this.$store.getters["DiyStore/GetCurrentUser"];
    },
    ...mapGetters({
      //GetCurrentUser: DiyStore.getters['GetCurrentUser']
    }),

    // FormDiyTableModelListen: {
    //     get(field) {
    //         var self = this;
    //         //2021-10-25新增，有可能用户自定义父级model，如点击A子表一行数据，更新B子表数据
    //         if (!self.DiyCommon.IsNull(field._ParentFormModel)) {
    //             return Object.assign({}, {
    //                 ...field._ParentFormModel
    //             });
    //         }

    //         //注意：这句Object.assign 非常非常非常非常 重要，不能直接 return this.Form.DiyTableModel
    //         //直接会怎么样？2021-2-07，自己都忘了:(
    //         return Object.assign({}, {
    //             ...this.FormDiyTableModel
    //         });
    //         // return this.FormDiyTableModel;
    //     }
    // },
    GetDiyFieldListObject: {
      get() {
        var self = this;
        var result = {};
        self.DiyFieldList.forEach((element) => {
          result[element.Name] = element;
        });
        return result;
      },
    },
  },
  props: {
    TableId: {
      type: String,
      default: "",
    },
    TableName: {
      type: String,
      default: "",
    },
    TableRowId: {
      type: String,
      default: "",
    },
    //表单模式Add、Edit、View
    FormMode: {
      type: String,
      default: "", //View
    },
    TableChildFormMode: {
      type: String,
      default: "", //View
    },
    //还需要一个OpenType？ 弹窗、抽屉、页面

    //加载模式：Design
    LoadMode: {
      type: String,
      default: "",
    },
    // ['FieldName1','FieldName2']
    ReadonlyFields: {
      type: Array,
      default: () => [],
    },
    // {FieldName1:value , FieldName2:value}
    DefaultValues: {
      type: Object,
      default() {
        return {};
      },
    },
    BatchHourseAllPath: {
      default: "",
      type: String,
    },
    //这里是指向数据库查询的哪些字段名称
    //['fieldName','fieldName']
    SelectFields: {
      type: Array,
      default: () => [],
    },
    //这里是指Form表单要显示的哪些字段
    //['fieldName','fieldName']
    ShowFields: {
      type: Array,
      default: () => [],
    },
    //这里是指Form表单要隐藏的哪些字段
    //['fieldName','fieldName']
    HideFields: {
      type: Array,
      default: () => [],
    },
    //固定只显示哪些Tabs，优先级大于表单引擎-->表单属性配置的Tabs分组。
    FixedTabs: {
      type: Array,
      default: () => [],
    },
    CustomComponent: {
      type: Object,
      default() {
        return {};
      },
    },
    //{GetDiyTableModel:'',GetDiyField:'',}
    ApiReplace: {
      type: Object,
      default() {
        return {};
      },
    },
    ParentForm: {
      type: Object,
      default() {
        return {};
      },
    },
    ParentV8: {
      type: Object,
      default() {
        return {};
      },
    },
    ColSpan: {
      type: Number,
      default: 0,
    },
    LabelPosition: {
      type: String,
      default: "", //left,top,bottom,right
    },
    CurrentTableData: {
      type: Array,
      default: () => [],
    },
    ActiveDiyTableTab: {
      type: Object,
      default() {
        return {};
      },
    },
    FormWf: {
      type: Object,
      default() {
        return {};
      },
    },
    /**
     * 事件替换，传入 { Insert/Update/Deleted或Submit : function }
     */
    EventReplace: {
      type: Object,
      default() {
        return {};
      },
    },
    DataAppend: {
      type: Object,
      default() {
        return {};
      },
    },
  },
  data() {
    const self = this;
    return {
      currentTabIndex: 0,
      editorRef: null,
      toolbarConfig: {},
      mode: "default",
      editorConfig: {
        placeholder: "请输入内容...",
        MENU_CONF: {
          uploadImage: {
            server: self.DiyCommon.GetApiBase() + "/apiengine/hdfs/upload",
            // 自定义插入图片
            // customInsert : function(res, insertFn) {
            //     // res 即服务端的返回结果
            //     // 从 res 中找到 url alt href ，然后插入图片
            //     // insertFn(url, alt, href)
            // },
            // 单个文件的最大体积限制，默认为 2M
            maxFileSize: 20 * 1024 * 1024, // 20M
            meta: {
              Path: "editor",
            },
            headers: {
              authorization: "Bearer " + self.DiyCommon.getToken(),
            },
            timeout: 60 * 1000,
          },
        },
      },
      PageType: "", //可以是Report
      FormTabs: [],
      BtnLoading: false,
      GetDiyTableRowModelFinish: false,
      DiyCustomDialogConfig: {},
      NotSaveField: [],
      DiyImgUploadRealPath: [],
      DiyFileUploadRealPath: [],

      Version: "20210110",
      LoadMap: true,
      pageLifetimes: {
        show: function (e) {},
      },
      DevComponents: {},
      IsFirstLoadForm: true,
      searchOption: {
        // city: '宁波', //默认全国
        // citylimit: true //默认false
      },
      AmapDefaultCenter: [121.547481, 29.809263],
      BaiduMapDefaultCenter: {
        lng: 121.547481,
        lat: 29.809263,
      },

      ueditorConfig: {
        // 如果需要上传功能,找后端小伙伴要服务器接口地址
        serverUrl: this.DiyCommon.GetApiBase() + "/UEditor/Upload",
        // 你的UEditor资源存放的路径,相对于打包后的index.html
        UEDITOR_HOME_URL: "./static/js/neditor/",
        // 编辑器不自动被内容撑高
        autoHeightEnabled: false,
        // 初始容器高度
        initialFrameHeight: 500,
        // initialFrameHeight: '100%',
        // 初始容器宽度
        initialFrameWidth: "100%",
        // 关闭自动保存
        enableAutoSave: true,
        imageUrlPrefix: this.DiyCommon.GetFileServer(), // "https://static-ali-img.itdos.com/", // by itdos.com
        scrawlUrlPrefix: this.DiyCommon.GetFileServer(), //"https://static-ali-img.itdos.com/",
        videoUrlPrefix: this.DiyCommon.GetFileServer(), //"https://static-ali-img.itdos.com/",
        fileUrlPrefix: this.DiyCommon.GetFileServer(), //"https://static-ali-img.itdos.com/",
      },
      FieldActiveTab: "",
      // 这是最终表单填写后的值. 这里命令可能有点问题，应该是取名CurrentDiyTableRowModel？
      //2020-07-28 这里临时注释 ，采用computed去实现，
      FormDiyTableModel: {},
      OldForm: {},
      OldFormData: {},
      DiyTableModel: {
        Tabs: [],
      },
      DiyFieldList: [],
      LoadDiyFieldList: false,
      CurrentDiyFieldModel: {},
      // CurrentDiyTableRowModel:{},//2020-07-09：这个存在的意义是什么？暂时注释
      FormRules: {},
      ModifiedFields: [],
    };
  },
  beforeCreate() {
    var self = this;
  },
  beforeUpdate() {},
  beforeEnter: (to, from, next) => {},
  destroyed() {},
  beforeDestroy() {
    var self = this;
    //如果是切换成编辑呢？
    // self.GetDiyTableRowModelFinish  = false;
  },
  beforeRouteLeave(to, from, next) {
    // ...
  },
  mounted() {
    var self = this;
    self.PageType = self.$route.query.PageType;

    VueAMap.initAMapApiLoader({
      key: self.SysConfig.AMapKey || "99b272c930081b69507b218d660be3dc",
      plugin: [
        "Scale",
        "OverView",
        "ToolBar",
        "MapType",
        "Geocoder",
        "PlaceSearch",
        "Autocomplete",
        "AMap.Autocomplete", //输入提示插件
        "AMap.PlaceSearch", //POI搜索插件
        "AMap.Scale", //右下角缩略图插件 比例尺
        "AMap.OverView", //地图鹰眼插件
        "AMap.ToolBar", //地图工具条
        "AMap.MapType", //类别切换控件，实现默认图层与卫星图、实施交通图层之间切换的控制
        "AMap.PolyEditor", //编辑 折线多，边形
        "AMap.CircleEditor", //圆形编辑器插件
        "AMap.Geolocation", //定位控件，用来获取和展示用户主机所在的经纬度位置
      ],
      v: "1.4.4",
      uiVersion: "1.0",
    });
    // 申请的Web端（JS API）的需要写上下面这段话
    window._AMapSecurityConfig = {
      securityJsCode:
        self.SysConfig.AMapSecret || "0624622804551e8f0209117bb8de8f82", // 高德Web端安全密钥
    };

    self.$nextTick(function () {
      // console.log('DiyForm mounted DefaultValues:' , self.DefaultValues);
    });
  },
  methods: {
    Init(param, callback) {
      var self = this;
      self.GetDiyTableRowModelFinish = false;
      self.IsFirstLoadForm = true;
      self.DiyImgUploadRealPath = [];
      self.DiyFileUploadRealPath = [];
      self.FormRules = {};
      // if (self.FormMode == 'Add' || self.FormMode == 'Insert')
      {
        // self.CurrentDiyTableRowModel = {};//2020-07-09：这个存在的意义是什么？暂时注释
        //注意：这一句并不能将所有属性值全部清除掉，要使用$delete
        // self.FormDiyTableModel = {};
        Object.keys(self.FormDiyTableModel).forEach((item) => {
          self.$delete(self.FormDiyTableModel, item);
        });
      }
      self.GetAllData(param, callback);
      self.$nextTick(function () {
        if (self.$refs.FormDiyTableModel) {
          if (Array.isArray(self.$refs.FormDiyTableModel)) {
            self.$refs.FormDiyTableModel.forEach((item) => {
              item.clearValidate();
            });
          } else {
            self.$refs.FormDiyTableModel.clearValidate();
          }
        }
      });
    },
    handleCreated(editor) {
      // console.log('created', editor);
      // this.editorRef = editor; // 记录 editor 实例，重要！
      this.editorRef = Object.seal(editor); // 一定要用 Object.seal() ，否则会报错
    },
    handleChange(editor) {
      // console.log('change:', editor.getHtml());
    },
    handleDestroyed(editor) {
      // console.log('destroyed', editor);
    },
    handleFocus(editor) {
      // console.log('focus', editor);
    },
    handleBlur(editor) {
      // console.log('blur', editor);
    },
    customAlert(info, type) {
      // alert(`【自定义提示】${type} - ${info}`);
    },
    customPaste(editor, event, callback) {
      // console.log('ClipboardEvent 粘贴事件对象', event);
      // 自定义插入内容
      // editor.insertText('xxx');
      // 返回值（注意，vue 事件的返回值，不能用 return）
      // callback(false); // 返回 false ，阻止默认粘贴行为
      callback(true); // 返回 true ，继续默认的粘贴行为
    },
    GetPropsSearch(field) {
      var self = this;
      if (field.Config.JoinTable.Where) {
        try {
          return JSON.parse(field.Config.JoinTable.Where);
        } catch (error) {
          return [];
        }
      }
      return [];
    },
    SetDiyTableRowModelFinish(value) {
      var self = this;
      self.GetDiyTableRowModelFinish = value;
    },
    GetDiyCustomDialogDataAppend() {
      var self = this;
      var result = {
        V8: {},
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
      //以下1句会导致死循环，why?
      // V8.FormWF = self.FormWF;

      // V8.OpenDialog = self.OpenDialog;
      //2022-04-09修改V8.Form.Id
      if (
        !self.DiyCommon.IsNull(self.TableRowId) &&
        self.DiyCommon.IsNull(self.FormDiyTableModel.Id)
      ) {
        self.$set(self.FormDiyTableModel, "Id", self.TableRowId);
      }
      (V8.ReloadForm = (row, type) => {
        return self.$emit("CallbackReloadForm", row, type);
      }),
        (V8.CurrentUser = self.GetCurrentUser);
      V8.HideFormBtn = self.HideFormBtn;
      V8.Form = self.FormDiyTableModel;
      V8.OldForm = self.OldForm;
      V8.FormSet = self.FormSet;
      V8.Field = self.GetDiyFieldListObject;
      V8.FieldSet = self.FieldSet;
      V8.TableRowId = self.TableRowId;
      V8.TableSearchAppend = self.SearchAppend;
      V8.TableSearchSet = self.SearchSet;
      V8.TableRefresh = self.TableRefresh;
      V8.TableSetData = self.TableSetData;
      V8.ApiReplace = self.ApiReplace;
      V8.FormSubmit = self.V8FormSubmit;
      V8.FormSubmitInside = self.FormSubmit;
      V8.RefreshTable = self.CallbackRefreshTable;
      V8.ParentForm = self.ParentForm;
      V8.ParentV8 = self.ParentV8;
      V8.ParentFormSet = self.ParentFormSet;
      V8.FormMode = self.FormMode;
      V8.LoadMode = self.LoadMode;
      V8.TableId = self.TableId;
      V8.TableName = self.TableName;
      V8.TableModel = self.DiyTableModel;
      V8.CallbackForm = self.CallbackForm;
      V8.ShowTableChildHideField = self.ShowTableChildHideField;
      V8.GetChildTableData = self.GetChildTableData;
      V8.CurrentTableData = self.CurrentTableData;
      V8.HideFormTab = self.HideFormTab;
      V8.ShowFormTab = self.ShowFormTab;
      V8.ClickFormTab = self.ClickFormTab;
      V8.GetFormTabs = self.GetShowTabs;
      V8.ActiveDiyTableTab = self.ActiveDiyTableTab;
      V8.ReloadJoinForm = self.ReloadJoinForm;
      V8.FormClose = self.FormClose;
      return V8;
    },
    DraggableSetData(dataTransfer) {
      var self = this;
      // dataTransfer.setData('Text', '')
    },
    GetDataAppend(field) {
      var self = this;
      if (self.DiyCommon.IsNull(field.DataAppend)) {
        return {};
      }
      if (typeof field.DataAppend == "string") {
        return JSON.parse(field.DataAppend);
      }
      return field.DataAppend;
      // DiyCommon.IsNull(field.DataAppend) ? {} : field.DataAppend
    },
    async RunFieldTemplateEngine(field, row) {
      var self = this;
      var V8 = {
        Result: "",
        Field: field,
        Form: row,
        Row: row,
        EventName: "FormTemplateEngine",
      };
      self.SetV8DefaultValue(V8);
      await self.DiyCommon.InitV8Code(V8, self.$router);
      try {
        // eval(field.V8TmpEngineForm);
        await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + field.V8TmpEngineForm + " \n})()");
        if (self.DiyCommon.IsNull(V8.Result) && V8.Result != "") {
          //注意有时候确实是在v8中设置返回了空字符串
          return self.GetColValue({ row: row }, field);
        }
        return V8.Result;
      } catch (error) {
        // return error.message;
        self.DiyCommon.Tips(
          "执行V8模板引擎代码出现错误[" +
            field.Name +
            "," +
            field.Label +
            "]：" +
            error.message,
          false
        );
      }
    },
    GetColValue(row, field) {
      var self = this;
      var fuheWZ = "";
      var result = "";
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
            var tObj = JSON.parse(row[field.Name]);
            if (Array.isArray(tObj)) {
              //if (field.Component == 'MultipleSelect')
              tObj.forEach((element, index) => {
                result += self.DiyCommon.IsNull(
                  element[field.Config.SelectLabel]
                )
                  ? ""
                  : element[field.Config.SelectLabel];
                if (index !== tObj.length - 1) {
                  result += ",";
                }
              });
              return result + fuheWZ;
            }
            //2021-01-02发现问题，这里如果存的是一串数字 ，JSON.parse()不会报错
            else if (typeof tObj == "number") {
              result = self.DiyCommon.IsNull(row[field.Name])
                ? ""
                : row[field.Name];
              return result + fuheWZ;
            } else {
              result = self.DiyCommon.IsNull(tObj[field.Config.SelectLabel])
                ? ""
                : tObj[field.Config.SelectLabel];
              return result + fuheWZ;
            }
          } catch (error) {
            // console.log('Error：GetColValue(scope, field)')
            // console.log(error)
          }
        }
      }

      var displayValue = self.DiyCommon.IsNull(row[field.Name])
        ? ""
        : row[field.Name];
      //如果是富文本，需要去掉html标签
      if (field.Component == "RichText") {
        displayValue = self.DiyCommon.RemoveHtml(displayValue);
      }
      result = displayValue; //self.DiyCommon.IsNull(scope.row[field.Name]) ? '' : scope.row[field.Name];
      return result + fuheWZ;
    },
    GetDepartmentProps(field) {
      var self = this;
      var result = {
        value: "Id",
        label: "Name",
        children: "_Child",
        checkStrictly: true,
      };
      if (field.Config.Department.Multiple === true) {
        result.multiple = true;
      }
      return result;
    },
    GetV8(field) {
      var self = this;
      var v8 = {};

      //2021-12-10新增，有可能用户自定义父级model，如点击A子表一行数据，更新B子表数据
      if (field && !self.DiyCommon.IsNull(field._ParentFormModel)) {
        return Object.assign(
          {},
          {
            ...field._ParentFormModel,
          }
        );
      }

      self.SetV8DefaultValue(v8);
      return v8;
    },
    //获取需要保存的行数据，返回格式：{TableName:'', Rows:[]}
    GetNeedSaveRowList() {
      var self = this;
      //先获取所有子表字段
      var result = [];
      self.DiyFieldList.forEach((field) => {
        if (field.Component == "TableChild") {
          if (
            self.$refs["refTableChild_" + field.Name] &&
            self.$refs["refTableChild_" + field.Name].length > 0
          ) {
            var arr =
              self.$refs["refTableChild_" + field.Name][0].GetNeedSaveRowList();
            //这里除了写主表关联值，其实还要写子表回写列的值  2021-11-02  todo
            //2021-12-07注释：是因为DiyTable在新增的时候，已经将外键关联、回写值全部处理好了
            // arr.forEach(formData => {
            //     formData[field.Config.TableChildFkFieldName] = self.FormDiyTableModel.Id;
            // });
            result.push({
              FieldName: field.Name,
              TableId: field.Config.TableChildTableId,
              Rows: arr,
            });
          }
        }
      });
      return result;
    },
    ClearNeedSaveRowList() {
      var self = this;
      //先获取所有子表字段
      self.DiyFieldList.forEach((field) => {
        if (field.Component == "TableChild") {
          if (
            self.$refs["refTableChild_" + field.Name] &&
            self.$refs["refTableChild_" + field.Name].length > 0
          ) {
            var arr =
              self.$refs[
                "refTableChild_" + field.Name
              ][0].ClearNeedSaveRowList();
          }
        }
      });
    },
    GetNeedSaveJoinFormList() {
      var self = this;
      //先获取所有子表字段
      var result = [];
      self.DiyFieldList.forEach((field) => {
        if (field.Component == "JoinForm") {
          if (self.$refs["refJoinForm_" + field.Name]) {
            // var arr = self.$refs['refJoinForm_' + field.Name][0].GetNeedSaveRowList();
            // result.push({
            //     FieldName : field.Name,
            //     TableId : field.Config.TableChildTableId,
            //     Rows : arr
            // });
            if (
              self.$refs["refJoinForm_" + field.Name] &&
              self.$refs["refJoinForm_" + field.Name].length > 0
            ) {
              self.$refs["refJoinForm_" + field.Name][0].FormSubmit(
                {
                  FormMode: field.Config.JoinForm.FormMode, //self.FormMode, 2022-07-14修复这个bug，不应该跟随主表的模式，切换关联表的时候，主表是编辑，但关联表是新增。
                  //这里获取关联表单的Id
                  TableRowId: field.Config.JoinForm.Id,
                  // SaveLoading: self.SaveDiyTableLoding,
                  //这里获取当前表单是保存并关闭还是什么状态
                  SavedType: self.SavedType,
                  V8Callback: function (formData) {
                    // self.GetHourseDetail(self.GetOther);
                  },
                },
                function (success, formData) {
                  if (success == true) {
                    // self.GetDiyTableRow(true)
                    // self.ShowEditModel = false;
                    self.$nextTick(function () {
                      // self.SaveDiyTableLoding = false;
                    });
                  } else {
                    // self.SaveDiyTableLoding = false;
                  }
                }
              );
            }
          }
        }
      });
      return result;
    },
    async RunOpenTableSubmitV8(field) {
      var self = this;
      self.BtnLoading = true;
      //把这列对应的fieldModel查询出来，其实就是TableChildField，props传过来的
      // var V8 = v8 ? v8 : {};
      var V8 = {
        EventName: "OpenTableSubmit",
      };
      try {
        if (
          !self.DiyCommon.IsNull(field.Config) &&
          !self.DiyCommon.IsNull(field.Config.OpenTable) &&
          !self.DiyCommon.IsNull(field.Config.OpenTable.SubmitV8)
        ) {
          //从弹出的表格中获取已经选中的数据，如果是单选，返回Object
          if (field.Config.OpenTable.MultipleSelect === false) {
            V8.TableRowSelected =
              self.$refs["refOpenTable_" + field.Name][0].TableSelectedRow;
          } else {
            V8.TableRowSelected =
              self.$refs[
                "refOpenTable_" + field.Name
              ][0].TableMultipleSelection;
          }
          self.SetV8DefaultValue(V8);
          await self.DiyCommon.InitV8Code(V8, self.$router);
          await eval(
            "//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + field.Config.OpenTable.SubmitV8 + " \n})()"
          );
          if (V8.Result !== false) {
            field.Config.OpenTable.ShowDialog = false;
          }
        }
        self.BtnLoading = false;
      } catch (error) {
        self.DiyCommon.Tips(
          "执行弹出表格提交事件V8引擎代码出现错误[" +
            field.Name +
            "," +
            field.Label +
            "]：" +
            error.message,
          false
        );
        self.BtnLoading = false;
      }
    },
    async OpenTableEvent(field) {
      var self = this;
      //弹出前V8
      var V8 = {
        EventName: "OpenTableBefore",
      };
      try {
        if (
          !self.DiyCommon.IsNull(field.Config) &&
          !self.DiyCommon.IsNull(field.Config.OpenTable) &&
          !self.DiyCommon.IsNull(field.Config.OpenTable.BeforeOpenV8)
        ) {
          V8.AppendSearchChildTable = self.AppendSearchChildTable;
          V8.OpenTableSetWhere = self.OpenTableSetWhere;
          self.SetV8DefaultValue(V8);
          await self.DiyCommon.InitV8Code(V8, self.$router);
          await eval(
            "//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " +
              field.Config.OpenTable.BeforeOpenV8 +
              " \n})()"
          );
        }
      } catch (error) {
        self.DiyCommon.Tips(
          "执行弹出表格弹出前V8引擎代码出现错误[" +
            field.Name +
            "," +
            field.Label +
            "]：" +
            error.message,
          false
        );
      }
      self.$nextTick(function () {
        field.Config.OpenTable.ShowDialog = true;
      });
    },
    OpenTableSetWhere(fieldModel, where) {
      fieldModel.Config.OpenTable.PropsWhere = where;
    },
    AppendSearchChildTable(fieldModel, appendSearch) {
      var self = this;
      fieldModel.Config.OpenTable.SearchAppend = appendSearch;
    },
    //刷新子表，可以传入新的外键值，传入子表的FieldName、外键Id
    CallbakRefreshChildTable(fieldModel, parentFormModel, v8) {
      var self = this;
      //2021-12-10:这里传入的父级v8对象，有可能是子表行点击传过来的
      if (v8) {
        self.$refs["refTableChild_" + fieldModel.Name][0].Init(
          parentFormModel,
          v8
        );
      } else {
        self.$refs["refTableChild_" + fieldModel.Name][0].Init(
          parentFormModel,
          self.GetV8()
        );
      }
    },
    ReloadJoinForm(fieldModel) {
      var self = this;
      self.$nextTick(function () {
        if (self.$refs["refJoinForm_" + fieldModel.Name]) {
          self.$refs["refJoinForm_" + fieldModel.Name][0].Init(true);
        }
      });
    },
    FormDiyTableModelListen(field) {
      var self = this;
      //2021-10-25新增，有可能用户自定义父级model，如点击A子表一行数据，更新B子表数据
      if (!self.DiyCommon.IsNull(field._ParentFormModel)) {
        return Object.assign(
          {},
          {
            ...field._ParentFormModel,
          }
        );
      }

      //注意：这句Object.assign 非常非常非常非常 重要，不能直接 return this.Form.DiyTableModel
      //直接会怎么样？2021-2-07，自己都忘了:(
      return Object.assign(
        {},
        {
          ...this.FormDiyTableModel,
        }
      );
      // return this.FormDiyTableModel;
    },
    async GetDiyFieldListObjectFunc(field) {
      var self = this;
      var result = {};
      if (
        field &&
        !self.DiyCommon.IsNull(field.Config.TableChild.LastSysMenuId)
      ) {
        //这里需要获取该字段上级关联模块的所有字段列表
        // {
        //     Url : DiyApi.GetDiyFieldByDiyTables,
        //     Param: {
        //         TableIds: [self.TableId],
        //         SysMenuId : self.SysMenuId
        //     }
        // }
        var fieldListResult = await self.DiyCommon.PostAsync(
          self.DiyApi.GetDiyFieldByDiyTables,
          {
            TableIds: [field.Config.TableChild.LastTableId],
            SysMenuId: field.Config.TableChild.LastSysMenuId,
          }
        );
        if (fieldListResult.Code == 1) {
          fieldListResult.Data.forEach((element) => {
            result[element.Name] = element;
          });
        }
      }
      return result;
    },
    GetLabelPosition() {
      var self = this;
      if (!self.DiyCommon.IsNull(self.LabelPosition)) {
        return self.LabelPosition;
      }
      return self.DiyCommon.IsNull(self.DiyTableModel.FormLabelPosition)
        ? "right"
        : self.DiyTableModel.FormLabelPosition;
    },
    GetFieldConfigButtonType(field) {
      var self = this;
      if (field.Config && field.Config.Button && field.Config.Button.Type) {
        return field.Config.Button.Type;
      }
      return "";
    },
    async FieldOnKeyup(event, field) {
      var self = this;
      var keyCode = event.keyCode;
      // 判断需要执行的V8
      if (!self.DiyCommon.IsNull(field.KeyupV8Code)) {
        var V8 = {
          KeyCode: keyCode,
          EventName: "FieldOnKeyup",
        };
        self.SetV8DefaultValue(V8);
        await self.DiyCommon.InitV8Code(V8, self.$router);
        try {
          // eval(field.KeyupV8Code)
          await eval("(async () => {\n " + field.KeyupV8Code + " \n})()");
        } catch (error) {
          self.DiyCommon.Tips(
            "执行按键事件V8引擎代码出现错误：" + error.message,
            false
          );
        }
      }
    },
    Clear() {
      var self = this;
      //注意：这一句并不能将所有属性值全部清除掉，要使用$delete
      // self.FormDiyTableModel = {};

      Object.keys(self.FormDiyTableModel).forEach((item) => {
        self.$delete(self.FormDiyTableModel, item);
      });
    },
    DelUploadFiles(file, field) {
      var self = this;
      var index = 0;
      self.FormDiyTableModel[field.Name].forEach((fileObj) => {
        if (fileObj.Id == file.Id) {
          self.FormDiyTableModel[field.Name].splice(index, 1);
        }
        index++;
      });
    },
    DelSingleUpload(field) {
      var self = this;
      // self.FormDiyTableModel[field.Name] = '';
      self.$set(self.FormDiyTableModel, field.Name, "");
      self.$set(
        self.FormDiyTableModel,
        field.Name + "_" + field.Name + "_RealPath",
        ""
      );
      self.$refs[field.Component + "_" + field.Name][0].clearFiles();
    },
    GetFileUpladFils(field) {
      var self = this;
      var files = self.FormDiyTableModel[field.Name];
      //处理私有权限文件
      files.forEach((file) => {
        if (field.Config.FileUpload.Limit === true) {
        }
      });
      return files;
    },
    GetImgUploadImgs(field) {
      var self = this;
      var arr = self.FormDiyTableModel[field.Name];
      var result = [];
      arr.forEach((file) => {
        var path =
          self.FormDiyTableModel[field.Name + "_" + file.Id + "_RealPath"];
        if (
          !self.DiyCommon.IsNull(path) &&
          path != "./static/img/loading.gif"
        ) {
          result.push(path);
        }
        // //这里要判断Limit?
        // if (field.Config[field.Component].Limit === true) {
        //     result.push(self.FormDiyTableModel[file.Path + '_' + file.Id + '_RealPath']);
        // }
        // result.push(file.Path + '_' + file.Id + '_RealPath');
      });
      return result;
    },
    //获取单文件上传后的下载地址
    GetUploadPath(field, file) {
      var self = this;
      var filePathName = self.DiyCommon.IsNull(file)
        ? self.FormDiyTableModel[field.Name]
        : file.Path;
      if (self.DiyCommon.IsNull(filePathName) || Array.isArray(filePathName)) {
        return;
      }
      var limit = field.Config[field.Component].Limit;
      var fileId = self.DiyCommon.IsNull(file) ? field.Name : file.Id;
      // return new Promise((resolve, reject) => {
      //如果是公共oss，直接返回url
      if (limit !== true) {
        self.$set(
          self.FormDiyTableModel,
          field.Name + "_" + fileId + "_RealPath",
          self.DiyCommon.GetServerPath(filePathName)
        );
      } else {
        var nowPath =
          self.FormDiyTableModel[field.Name + "_" + fileId + "_RealPath"];
        //如果为空或者是loading，需要重新获取。但如果是fail.jpg就不用重新获取了，修复死循环 --2023-06-12
        if (
          self.DiyCommon.IsNull(nowPath) ||
          nowPath == "./static/img/loading.gif"
        ) {
          self.$set(
            self.FormDiyTableModel,
            field.Name + "_" + fileId + "_RealPath",
            "./static/img/loading.gif"
          );
          if (
            filePathName != "./static/img/loading.gif" &&
            filePathName != "正在上传中..."
          ) {
            var result = "";
            //如果是私有oss，需要先请求获取临时url
            // self.DiyCommon.Post('/api/Aliyun/GetOssDownloadUrl',{
            self.DiyCommon.Post(
              "/api/HDFS/GetPrivateFileUrl",
              {
                FilePathName: filePathName, //self.FormDiyTableModel[field.Name]
                HDFS: self.SysConfig.HDFS || "Aliyun",
                FormEngineKey: self.DiyTableModel.Name || self.TableId,
                FormDataId: self.TableRowId,
                FieldId: field.Id,
              },
              function (result) {
                if (self.DiyCommon.Result(result)) {
                  result = result.Data;
                } else {
                  result = "./static/img/img-load-fail.jpg"; //2023-06-12新增
                }
                self.$set(
                  self.FormDiyTableModel,
                  field.Name + "_" + fileId + "_RealPath",
                  result
                );
                // resolve(result);
              },
              function (error) {
                result = "./static/img/img-load-fail.jpg";
                self.$set(
                  self.FormDiyTableModel,
                  field.Name + "_" + fileId + "_RealPath",
                  result
                );
              }
            );
          }
        }
      }

      // });
    },
    GetFieldZoom(field) {
      var self = this;
      if (
        !self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name]) &&
        !self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name].Zoom)
      ) {
        return self.FormDiyTableModel[field.Name].Zoom;
      }
      return field.BaiduMapConfig.Zoom;
    },
    GetFieldCenter(field) {
      var self = this;

      if (
        field.Component == "Map" &&
        !self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name + "_Lng"])
      ) {
        return {
          lng: self.FormDiyTableModel[field.Name + "_Lng"] || 0,
          lat: self.FormDiyTableModel[field.Name + "_Lat"] || 0,
        };
      }

      if (
        !self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name]) &&
        !self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name].Center)
      ) {
        return self.FormDiyTableModel[field.Name].Center;
      }

      return field.BaiduMapConfig.Center;
    },
    GetFormItemLabel(field) {
      var self = this;
      if (field.Component == "Button") {
        return "";
      } else {
        if (field.Label) {
          return field.Label;
        } else if (self.LoadMode == "Design") {
          return field.Name;
        }
        return "";
      }
    },
    ComponentButtonClick(field) {
      var self = this;
      self.RunV8Code(field);
    },
    GetFormData() {
      var self = this;
      return { ...self.FormDiyTableModel };
    },
    GetOldFormData() {
      var self = this;
      return self.OldForm;
    },
    SetFormData(formData) {
      var self = this;
      for (const key in formData) {
        if (formData[key]) {
          self.$set(self.FormDiyTableModel, key, formData[key]);
        }
      }
      return self.FormDiyTableModel;
    },
    GetFormDataAndCheck(callback) {
      var self = this;
      self.$refs.FormDiyTableModel[0].validate((valid, fieldsObj) => {
        if (!valid) {
          var msg = "";
          try {
            if (fieldsObj && typeof fieldsObj == "object") {
              for (const key in fieldsObj) {
                if (
                  fieldsObj[key] &&
                  Array.isArray(fieldsObj[key]) &&
                  fieldsObj[key].length > 0
                ) {
                  msg += fieldsObj[key][0].message + "！<br>";
                }
              }
            }
          } catch (error) {
            msg = "";
          }

          if (self.DiyCommon.IsNull(msg)) {
            msg = "请检查输入项！";
          }
          self.DiyCommon.Tips(msg, false);
          callback();
          // return null;
        } else {
          var checkForm = true;
          var checkFailField = {};
          self.DiyFieldList.forEach((field) => {
            //再手动判断一下必填等验证
            if (
              !self.DiyCommon.IsNull(field.NotEmpty) &&
              field.NotEmpty &&
              field.Visible &&
              (self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name]) ||
                (typeof self.FormDiyTableModel[field.Name] == "object" &&
                  (JSON.stringify(self.FormDiyTableModel[field.Name]) == "{}" ||
                    JSON.stringify(self.FormDiyTableModel[field.Name]) ==
                      "[]"))) &&
              (self.ShowFields.length == 0 ||
                (self.ShowFields.length > 0 &&
                  self.ShowFields.indexOf(field.Name) > -1)) && // _.where(self.ShowFields, { Id: field.Id}).length > 0
              self.HideFields.indexOf(field.Name) == -1 &&
              field.Component !== "DevComponent" &&
              field.Component !== "TableChild" &&
              field.Component !== "Button" &&
              field.Component !== "Button"
              // && !self.DiyCommon.IsNull(field.FieldType)
            ) {
              checkFailField = field;
              checkForm = false;
            }
          });
          if (!checkForm) {
            debugger;
            self.DiyCommon.Tips(
              "请检查必填项：[" + checkFailField.Label + "]！",
              false
            );
            callback();
          } else {
            //2023-09-08：这里需返回引用类型，否则执行的FormSubmitAction函数里面的表单提交前V8事件中对self.FormDiyTableModel赋值并不会影响这里返回的formData
            // callback({
            //     ...self.FormDiyTableModel
            // });
            callback(self.FormDiyTableModel);
          }

          // return {...self.FormDiyTableModel};
        }
      });
    },
    HideFormBtn(btn) {
      var self = this;
      self.$emit("CallbackHideFormBtn", btn);
    },
    //离开表单动作
    async FormOutAction(actionType, submitAfterType, tableRowId, V8Callback) {
      var self = this;
      if (self.DiyCommon.IsNull(self.DiyTableModel.Id)) {
        return {};
      }
      // 判断需要执行的V8
      if (!self.DiyCommon.IsNull(self.DiyTableModel.OutFormV8)) {
        var V8 = {
          FormOutAction: actionType,
          FormOutAfterAction: submitAfterType,
          V8Callback: V8Callback,
          EventName: "FormOut",
        };
        self.SetV8DefaultValue(V8);
        await self.DiyCommon.InitV8Code(V8, self.$router);
        if (!self.DiyCommon.IsNull(tableRowId)) {
          V8.Form.Id = tableRowId;
        }
        try {
          // eval(self.DiyTableModel.OutFormV8);
          await eval(
            "(async () => {\n " + self.DiyTableModel.OutFormV8 + " \n})()"
          );
          return V8;
        } catch (error) {
          self.DiyCommon.Tips(
            "执行表单离开V8引擎代码出现错误：" + error.message,
            false
          );
        }
      }
      return {};
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
    OpenAnyForm(param, callback) {
      var self = this;
      self.$refs.refDiyTable_DiyFormDialog.Init(param, callback);
    },
    SetV8DefaultValue(V8, field) {
      var self = this;
      V8.ClientType = "PC"; //PC、IOS、Android、H5、WeChat
      V8.DataAppend = self.DataAppend;
      V8.OpenAnyForm = self.OpenAnyForm;
      V8.OpenDialog = self.OpenDialog;
      V8.FormWF = self.FormWf;
      //2022-04-09修改V8.Form.Id
      if (
        !self.DiyCommon.IsNull(self.TableRowId) &&
        self.DiyCommon.IsNull(self.FormDiyTableModel.Id)
      ) {
        self.$set(self.FormDiyTableModel, "Id", self.TableRowId);
      }
      (V8.ReloadForm = (row, type) => {
        return self.$emit("CallbackReloadForm", row, type);
      }),
        (V8.CurrentUser = self.GetCurrentUser);
      V8.HideFormBtn = self.HideFormBtn;
      V8.Form = self.FormDiyTableModel;
      V8.OldForm = self.OldForm;
      // V8.FormSet = (fieldName, value) => { self.FormSet(fieldName, value, field)};
      V8.FormSet = self.FormSet;
      V8.Field = self.GetDiyFieldListObject;
      V8.FieldSet = self.FieldSet;
      V8.TableRowId = self.TableRowId;
      V8.TableSearchAppend = self.SearchAppend;
      V8.TableSearchSet = self.SearchSet;
      //刷新子表
      V8.TableRefresh = self.TableRefresh;
      V8.TableSetData = self.TableSetData;
      V8.ApiReplace = self.ApiReplace;
      V8.FormSubmit = self.V8FormSubmit;
      V8.FormSubmitInside = self.FormSubmit;
      V8.RefreshTable = self.CallbackRefreshTable;
      V8.ParentForm = self.ParentForm;
      V8.ParentV8 = self.ParentV8;
      V8.ParentFormSet = self.ParentFormSet;
      V8.FormMode = self.FormMode;
      V8.LoadMode = self.LoadMode;
      V8.TableId = self.TableId;
      V8.TableName = self.TableName;
      V8.TableModel = self.DiyTableModel;
      V8.CallbackForm = self.CallbackForm;
      V8.ShowTableChildHideField = self.ShowTableChildHideField;

      V8.GetChildTableData = self.GetChildTableData;
      V8.CurrentTableData = self.CurrentTableData;

      V8.HideFormTab = self.HideFormTab;
      V8.ShowFormTab = self.ShowFormTab;
      V8.ClickFormTab = self.ClickFormTab;
      V8.GetFormTabs = self.GetShowTabs;

      V8.ActiveDiyTableTab = self.ActiveDiyTableTab;
      V8.ReloadJoinForm = self.ReloadJoinForm;
      V8.FormClose = self.FormClose;
      return V8;
    },
    FormClose() {
      var self = this;
      self.$emit("CallbackFormClose");
    },
    GetChildTableData(fieldName) {
      var self = this;
      if (
        self.$refs["refTableChild_" + fieldName] &&
        self.$refs["refTableChild_" + fieldName].length > 0
      ) {
        return self.$refs["refTableChild_" + fieldName][0].DiyTableRowList;
      }
      return [];
    },
    ShowTableChildHideField(fieldName, fields) {
      var self = this;
      if (
        self.$refs["refTableChild_" + fieldName] &&
        self.$refs["refTableChild_" + fieldName].length > 0
      ) {
        self.$refs["refTableChild_" + fieldName][0].ShowHideFields(fields);
      }
    },
    CallbackForm() {
      var self = this;
      self.$emit("CallbackForm", { ...self.FormDiyTableModel });
    },
    async FormSubmitAction(actionType, tableRowId) {
      var self = this;
      if (self.DiyCommon.IsNull(self.DiyTableModel.Id)) {
        return;
      }
      // 判断需要执行的V8
      if (!self.DiyCommon.IsNull(self.DiyTableModel.SubmitFormV8)) {
        var V8 = {
          FormSubmitAction: actionType,
          EventName: "FormSubmitBefore",
        };
        self.SetV8DefaultValue(V8);
        await self.DiyCommon.InitV8Code(V8, self.$router);
        if (!self.DiyCommon.IsNull(tableRowId)) {
          V8.Form.Id = tableRowId;
        }
        try {
          // eval(self.DiyTableModel.SubmitFormV8)
          await eval(
            "(async () => {\n " + self.DiyTableModel.SubmitFormV8 + " \n})()"
          );
          return V8.Result;
        } catch (error) {
          self.DiyCommon.Tips(
            "执行表单提交前V8引擎代码出现错误：" + error.message,
            false
          );
          return false;
        }
      }
    },
    BaiduMapReady({ BMap, map }, field) {
      var self = this;
      field.BaiduMapConfig._BMap = BMap;
      field.BaiduMapConfig._map = map;
      //TODO
      //如果是地图点，设置中心点、缩放、显示名称
      if (
        field.Component == "Map" &&
        !self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name + "_Lng"])
      ) {
        self.BaiduMapMakerCenter(
          {
            lng: self.FormDiyTableModel[field.Name + "_Lng"] || 0,
            lat: self.FormDiyTableModel[field.Name + "_Lat"] || 0,
          },
          field
        );
      }
      //如果是区域，设置中心点、缩放
    },
    BaiduMapQuerySearch(queryString, cb, field) {
      var self = this;
      var myGeo = new field.BaiduMapConfig._BMap.Geocoder();
      myGeo.getPoint(
        queryString,
        function (point) {
          if (point) {
            // self.mapLocation.coordinate = point
            self.BaiduMapMakerCenter(point, field);
          } else {
            // self.mapLocation.coordinate = null
          }
        },
        "宁波市"
      );
      var options = {
        onSearchComplete: function (results) {
          if (local.getStatus() === 0) {
            // 判断状态是否正确
            var s = [];
            for (var i = 0; i < results.getCurrentNumPois(); i++) {
              var x = results.getPoi(i);
              var item = {
                value: x.address + x.title,
                point: x.point,
              };
              s.push(item); //
              cb(s); //返回查询出来的地址列表
            }
          } else {
            cb();
          }
        },
      };
      var local = new field.BaiduMapConfig._BMap.LocalSearch(
        field.BaiduMapConfig._map,
        options
      );
      local.search(queryString);
    },
    BaiduMapHandleSelect(item, field) {
      var self = this;

      var { point } = item;
      // this.mapLocation.coordinate = point

      this.BaiduMapMakerCenter(point, field);
    },
    BaiduMapMakerCenter(point, field, gotoCenter) {
      var self = this;
      if (field.BaiduMapConfig._map) {
        if (field.Component == "MapArea") {
          field.BaiduMapConfig._map.clearOverlays();

          // var myLabel = new field.BaiduMapConfig._BMap.Label("您选择了这里！",     //为lable填写内容
          //                                 {offset:new BMap.Size(-60,-60),                  //label的偏移量，为了让label的中心显示在点上
          //                                 position:point});                                //label的位置
          // maker.label = myLabel;
          // maker.animation = "BMAP_ANIMATION_BOUNCE";

          var maker = new field.BaiduMapConfig._BMap.Marker(point);
          field.BaiduMapConfig._map.addOverlay(maker);
        } else {
          self.FormDiyTableModel[field.Name + "_Lng"] = point.lng || 0;
          self.FormDiyTableModel[field.Name + "_Lat"] = point.lat || 0;

          self.$set(
            self.FormDiyTableModel,
            field.Name + "_Lng",
            point.lng || 0
          );
          self.$set(
            self.FormDiyTableModel,
            field.Name + "_Lat",
            point.lat || 0
          );
        }

        if (gotoCenter !== false || field.BaiduMapConfig.Zoom != 15) {
          field.BaiduMapConfig.Center = {
            lng: point.lng,
            lat: point.lat,
          };
        }
        field.BaiduMapConfig.Zoom = 15;

        field.BaiduMapConfig.Lng = point.lng;
        field.BaiduMapConfig.Lat = point.lat;
      }
    },
    BaiduMapMarkerDragend({ type, target, pixel, point }, field) {
      var self = this;
      self.FormDiyTableModel[field.Name + "_Lng"] = point.lng;
      self.FormDiyTableModel[field.Name + "_Lat"] = point.lat;

      self.$set(self.FormDiyTableModel, field.Name + "_Lng", point.lng || 0);
      self.$set(self.FormDiyTableModel, field.Name + "_Lat", point.lat || 0);
    },
    // GetDateTimeFormat(field) {
    //     var self = this;
    //     if (field.Config.DateTimeType == 'datetime') {
    //         return 'yyyy-MM-dd HH:mm:ss';
    //     } else if (field.Config.DateTimeType == 'date') {
    //         return 'yyyy-MM-dd';
    //     } else if (field.Config.DateTimeType == 'week') {
    //         return 'yyyy 第 WW 周';
    //     } else if (field.Config.DateTimeType == 'month') {
    //         return 'yyyy-MM';
    //     }else if (field.Config.DateTimeType == 'year') {
    //         return 'yyyy';
    //     }
    //     return 'yyyy-MM-dd';
    // },
    FullScreenMap(field) {
      var self = this;
      var jObj = $("#map_id_" + field.Name);
      var jFullScreenObj = $("#map_id_fullscreen_" + field.Name);
      if (jObj.hasClass("fullscreen-map")) {
        jObj.removeClass("fullscreen-map");
        jFullScreenObj.html("全屏");
        field.BaiduMapConfig.ScrollWheelZoom = false;
      } else {
        jObj.addClass("fullscreen-map");
        jFullScreenObj.html("退出全屏");
        field.BaiduMapConfig.ScrollWheelZoom = true;
      }
    },
    toggle(field) {
      field.BaiduMapConfig.Polyline.Editing =
        !field.BaiduMapConfig.Polyline.Editing;
    },
    ClearPolyline(field) {
      field.BaiduMapConfig.Polyline.Paths = [];
    },
    syncPolyline(e, field) {
      if (!field.BaiduMapConfig.Polyline.Editing) {
        return;
      }
      const { Paths } = field.BaiduMapConfig.Polyline;
      if (!Paths.length) {
        return;
      }
      const path = Paths[Paths.length - 1];
      if (!path.length) {
        return;
      }
      if (path.length === 1) {
        path.push(e.point);
      }
      this.$set(path, path.length - 1, e.point);
    },
    newPolyline(e, field) {
      var self = this;
      if (!field.BaiduMapConfig.Polyline.Editing) {
        return;
      }
      const { Paths } = field.BaiduMapConfig.Polyline;
      if (!Paths.length) {
        Paths.push([]);
      }
      const path = Paths[Paths.length - 1];
      path.pop();
      if (path.length) {
        Paths.push([]);
      }

      //给字段赋值
      // self.FormDiyTableModel[field.Name].Paths = JSON.stringify(Paths);
      self.FormDiyTableModel[field.Name].Paths = Paths;
    },
    //地图更改缩放级别结束时触发触发此事件
    syncCenterAndZoom(e, field) {
      var self = this;
      const { lng, lat } = e.target.getCenter();
      if (!self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name])) {
        //保存Zoom和Center
        self.FormDiyTableModel[field.Name].Zoom = e.target.getZoom();
        self.FormDiyTableModel[field.Name].Center = {
          lng: lng,
          lat: lat,
        };
      }
    },
    paintPolyline(e, field) {
      var self = this;
      //如果是地图点
      //如果不是编辑模式
      if (!field.BaiduMapConfig.Polyline.Editing) {
        return;
      }
      if (field.Component == "Map") {
        self.BaiduMapMakerCenter(e.point, field, false);
      } else {
        const { Paths } = field.BaiduMapConfig.Polyline;
        !Paths.length && Paths.push([]);
        Paths[Paths.length - 1].push(e.point);
      }
    },
    SelectRemoteMethod(query, field) {
      var self = this;
      if (field.Config.DataSourceSqlRemote == true) {
        //query !== ''
        field.Config.DataSourceSqlRemoteLoading = true;
        var apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
        if (!self.DiyCommon.IsNull(self.ApiReplace.GetDiyFieldSqlData)) {
          apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
        }
        self.DiyCommon.Post(
          apiGetDiyFieldSqlData,
          {
            _FieldId: field.Id,
            // OsClient: self.OsClient,
            _SqlParamValue: {}, //JSON.stringify({}),
            _Keyword: query,
          },
          function (result) {
            //2020-12-30，这里不能直接赋值，因为要考虑到选择的数据是第N页的，这时候可能又只取了第一页
            //这里要把设置的默认值加进入，不然开启了limit远程搜索后，不显示值或者错误
            //注意这里的逻辑和DiyCommon的SetFieldData逻辑类似 ，如果这里修改，那边需要同步
            if (self.DiyCommon.Result(result)) {
              // try {
              //     if (self.DiyCommon.IsNull(result.Data)) {
              //         result.Data = [];
              //     }
              //     //这里要把设置的默认值、已选择的值加进去，不然开启了limit远程搜索后，不显示值
              //     //注意这里的逻辑和DiyForm的SelectRemoteMethod逻辑类似 ，如果这里修改，那边需要同步
              //     //2020-12-30发现问题： field.Data.length == 1只考虑到了单选，没有考虑到多选。
              //     var havedData = self.FormDiyTableModel[field.Name];
              //     if(!self.DiyCommon.IsNull(havedData)
              //         && Array.isArray(havedData)
              //         && havedData.length > 0){
              //         var fieldDataKey = !self.DiyCommon.IsNull(field.Config.SelectSaveField)
              //                             ? field.Config.SelectSaveField
              //                             :  field.Config.SelectLabel;
              //         havedData.forEach(element => {
              //             var isHave = false;
              //             var fieldDataKeyValue = element[fieldDataKey];
              //             if(!self.DiyCommon.IsNull(fieldDataKey) && !self.DiyCommon.IsNull(fieldDataKeyValue)){
              //                 result.Data.forEach(resultDataRow => {
              //                     if(resultDataRow[fieldDataKey] == fieldDataKeyValue){
              //                         isHave = true;
              //                     }
              //                 });
              //             }
              //             if(!isHave){
              //                 result.Data.push(element);
              //             }
              //         });
              //     }
              // } catch (error) {

              // }
              field.Data = result.Data;
            }
            field.Config.DataSourceSqlRemoteLoading = false;
          },
          function (error) {
            field.Config.DataSourceSqlRemoteLoading = false;
          }
        );
      }
    },
    GetFieldPlaceholder(field) {
      var self = this;
      var result = "";
      if (!self.DiyCommon.IsNull(field.Placeholder)) {
        result = field.Placeholder;
      }
      if (!self.DiyCommon.IsNull(field.Code)) {
        if (!self.DiyCommon.IsNull(field.Placeholder)) {
          result += "(" + field.Code + ")";
        } else {
          result = field.Code;
        }
      }
      return result;
    },
    GetSelectValueKey(field) {
      var self = this;
      // console.log('GetSelectValueKey:'+field.Name);
      //如果设置了存储形式为json，则SelectSaveField设置无效
      //但是，存储形式为Json，也需要设置value-key
      // if (field.Config.SelectSaveFormat == 'Json' || self.DiyCommon.IsNull(field.Config.SelectSaveFormat)) {
      //     return '';
      // }
      if (
        self.DiyCommon.IsNull(field.Config.SelectLabel) &&
        self.DiyCommon.IsNull(field.Config.SelectSaveField)
      ) {
        return "";
      }
      //如果是存储字段
      else {
        return self.DiyCommon.IsNull(field.Config.SelectSaveField)
          ? field.Config.SelectLabel
          : field.Config.SelectSaveField;
      }
    },
    GetShowTabs() {
      var self = this;
      if (self.FixedTabs.length > 0) {
        return self.FixedTabs;
      }
      return self.DiyTableModel.Tabs;
    },
    HideFormTab(tabName) {
      var self = this;
      self.DiyTableModel.Tabs.forEach((tab) => {
        if (tab.Name == tabName) {
          tab.Display = false;
        }
      });
    },
    ShowFormTab(tabName) {
      var self = this;
      self.DiyTableModel.Tabs.forEach((tab) => {
        if (tab.Name == tabName) {
          tab.Display = true;
        }
      });
    },
    ClickFormTab(tabName) {
      var self = this;
      self.FieldActiveTab = tabName;
    },
    GetFieldIsShow(field) {
      var self = this;
      // self.LoadMode == 'Design' ? 'true' : (self.DiyCommon.IsNull(field.Visible) ? true : field.Visible)
      if (self.LoadMode == "Design") {
        return true;
      }
      // 判断权限 GetCurrentUser
      if (!self.DiyCommon.IsNull(field.BindRole) && field.BindRole.length > 0) {
        // 如果不是超级管理员才判断，是超级管理员则直接执行最下面的判断
        if (self.GetCurrentUser._IsAdmin != true) {
          var haveLimit = false;
          if (!self.DiyCommon.IsNull(self.GetCurrentUser._Roles)) {
            field.BindRole.forEach((bindRole) => {
              self.GetCurrentUser._Roles.forEach((role) => {
                if (role.Id.toLowerCase() == bindRole.toLowerCase()) {
                  haveLimit = true;
                }
              });
            });
            // 如果没有权限 ，直接返回不可见。 但如果有权限 ，执行最下面的判断
            if (!haveLimit) {
              //2023-08-09将字段也同步置为不可见，防止无权限查看但仍然判断必填
              field.Visible = false;
              return false;
            }
          } else {
            // 如果当前用户角色没获取到，直接不可见，因为该字段绑定了角色
            //2023-08-09将字段也同步置为不可见，防止无权限查看但仍然判断必填
            field.Visible = false;
            return false;
          }
        }
      }
      return self.DiyCommon.IsNull(field.Visible) ? true : field.Visible;
    },
    GetAllData(param, callback) {
      var self = this;
      self.GetDiyTableRowModelFinish = false;
      // var apiGetDiyTableModel = DiyApi.GetDiyTableModel;
      var apiGetDiyTableModel =
        self.DiyApi.FormEngine.GetFormData + "-diytable";
      if (!self.DiyCommon.IsNull(self.ApiReplace.GetDiyTableModel)) {
        apiGetDiyTableModel = self.ApiReplace.GetDiyTableModel;
      }
      var apiGetDiyField = self.DiyApi.GetDiyField;
      if (!self.DiyCommon.IsNull(self.ApiReplace.GetDiyField)) {
        apiGetDiyField = self.ApiReplace.GetDiyField;
      }

      var param = [];
      if (self.TableId) {
        //注意：也可能不是取表单属性，而是取报表配置
        param.push({
          Url: apiGetDiyTableModel,
          Param: {
            Id: self.TableId,
            // TableName: self.TableName,
            // OsClient: self.OsClient
            FormEngineKey: "Diy_Table",
          },
        });
      } else if (self.TableName) {
        param.push({
          Url: apiGetDiyTableModel,
          Param: {
            FormEngineKey: "Diy_Table",
            _SearchEqual: {
              Name: self.TableName,
            },
          },
        });
      }
      //2024-04-24：修改为通过表单引擎查询diy_field列表，待实现【_SelectFields】功能

      if (self.PageType == "Report") {
        var getFieldListParam = {
          FormEngineKey: "diy_field",
        };
        if (self.TableId) {
          getFieldListParam._Where = [
            { Name: "TableId", Value: self.TableId, Type: "=" },
          ];
        }
        // if(self.TableName){
        //     getFieldListParam._Where = [{ Name : 'TableId', Value : self.TableName, Type : '=' }]
        // }
        param.push({
          Url: "/api/FormEngine/getTableData-diyfield", //apiGetDiyField,
          Param: getFieldListParam,
        });
      } else {
        param.push({
          Url: apiGetDiyField,
          Param: {
            TableId: self.TableId,
            TableName: self.TableName,
            // OsClient: self.OsClient,
            _SelectFields: self.SelectFields,
          },
        });
      }
      var loadingObj = self.$loading({
        target:
          ".itdos-diy-form-" +
          (self.DiyCommon.IsNull(self.TableId) ? self.TableName : self.TableId),
        text: "加载DIY表单...",
      });

      self.DiyCommon.PostAll(param, async function (results) {
        loadingObj.close();
        if (
          self.DiyCommon.Result(results[0]) &&
          self.DiyCommon.Result(results[1])
        ) {
          // GetDiyTableModel
          var result1 = results[0];
          _.sortBy(result1.Data.Tabs, "Sort");
          self.DiyCommon.DiyTableStrToJson(result1.Data);
          self.DiyCommon.Base64DecodeDiyTable(result1.Data);

          self.DiyTableModel = result1.Data;

          if (self.FixedTabs.length > 0) {
            self.FormTabs = self.FixedTabs;
          } else {
            self.FormTabs = self.DiyTableModel.Tabs;

            self.FieldActiveTab = self.FormTabs[self.currentTabIndex].Name;
          }

          var resultGetDiyField = results[1];
          var formData = {};

          //2021-09-06修改：要先获取了DiyTableModel实体后才能再去获取 DiyTableRowModel,因为有可能配置了查询接口替换
          //这里这个判断和 IF20210906 要保持一样
          var needGetDiyTableRowModel =
            self.FormMode != "Add" &&
            self.FormMode != "Insert" &&
            !self.DiyCommon.IsNull(self.TableRowId);
          if (needGetDiyTableRowModel) {
            //!self.DiyCommon.IsNull(self.TableRowId)
            var getDiyTableRowModelUrl = self.DiyApi.GetDiyTableRowModel;
            if (self.DiyTableModel.Name) {
              // getDiyTableRowModelUrl += '.' + self.DiyTableModel.Name;
              // getDiyTableRowModelUrl = '/api/FormEngine/getFormData.' + param.FormEngineKey;
              getDiyTableRowModelUrl =
                "/api/FormEngine/getFormData-" +
                self.DiyTableModel.Name.replace(/\_/g, "-").toLowerCase();
            }
            if (!self.DiyCommon.IsNull(self.DiyTableModel.ApiReplace.Select)) {
              getDiyTableRowModelUrl = self.DiyTableModel.ApiReplace.Select;
            }
            // param.push({
            //     Url: getDiyTableRowModelUrl,
            //     Param: {
            //         TableId: self.TableId,
            //         _TableRowId: self.TableRowId,
            //         // OsClient: self.OsClient
            //     }
            // })
            var param = {
              // TableId: self.TableId,
              // TableName: self.TableName,
              // TableName: self.DiyTableModel.Name,
              FormEngineKey: self.DiyTableModel.Name,
              // _TableRowId: self.TableRowId,
              Id: self.TableRowId,
            };
            // if(!param.TableName){
            //     param.TableId = self.TableId;
            // }
            if (!param.FormEngineKey) {
              param.FormEngineKey = self.TableId;
            }
            var roeModelResult = await self.DiyCommon.PostAsync(
              getDiyTableRowModelUrl,
              param
            );
            if (self.DiyCommon.Result(roeModelResult)) {
              if (
                !roeModelResult.Data.Id &&
                (roeModelResult.Data.id || roeModelResult.Data.ID)
              ) {
                roeModelResult.Data.Id =
                  roeModelResult.Data.id || roeModelResult.Data.ID;
              }
              // GetDiyTableRowModel、GetDiyField
              // var formData = self.FormMode != 'Add' ? results[2].Data : {} // 之前默认的是null，后来改成了{}  //!self.DiyCommon.IsNull(self.TableRowId)
              // var formData = !self.DiyCommon.IsNull(results[2]) ? results[2].Data : {} // 之前默认的是null，后来改成了{}  //!self.DiyCommon.IsNull(self.TableRowId)
              formData = roeModelResult.Data; // 之前默认的是null，后来改成了{}  //!self.DiyCommon.IsNull(self.TableRowId)
              if (
                roeModelResult.DataAppend &&
                roeModelResult.DataAppend.NotSaveField
              ) {
                self.NotSaveField = roeModelResult.DataAppend.NotSaveField;
              }
            } else {
            }
          }
          // 2020-07-16新增：DefaultValues 父组件传过来的默认值。 取数据值优先还是DefaultValues优先？
          // 以取到的数据优先
          for (const key in self.DefaultValues) {
            if (self.DiyCommon.IsNull(formData[key])) {
              formData[key] = self.DefaultValues[key];
            }
          }

          await self.GetAllDataAfter(
            resultGetDiyField,
            formData,
            function (callbackObj) {
              self.$emit("CallbackSetFormData", callbackObj.CurrentRowModel);
            }
          );

          // // if (self.FormMode != 'Add' && !self.DiyCommon.IsNull(self.TableRowId)) {//!self.DiyCommon.IsNull(self.TableRowId)
          // if (!self.DiyCommon.IsNull(results[2])) {//!self.DiyCommon.IsNull(self.TableRowId)
          //     if (!self.DiyCommon.Result(results[2])) {
          //         return
          //     }
          // }

          //GetShowTabs
          // self.$nextTick(function () {
          //     if (self.DiyTableModel.Tabs.length > 0 &&
          //         (self.DiyCommon.IsNull(self.FieldActiveTab) || self.FieldActiveTab == '0' || self.FieldActiveTab == 'none' || self.FieldActiveTab == 'info')) {
          //         self.FieldActiveTab = self.DiyTableModel.Tabs[0].Name
          //     }
          // })
          self.$nextTick(function () {
            if (
              self.GetShowTabs().length > 0 &&
              (self.DiyCommon.IsNull(self.FieldActiveTab) ||
                self.FieldActiveTab == "0" ||
                self.FieldActiveTab == "none" ||
                self.FieldActiveTab == "info")
            ) {
              self.FieldActiveTab = self.GetShowTabs()[0].Name;
            }
          });

          self.$emit("CallbackSetDiyTableModel", self.DiyTableModel);

          //赋值前，重载地图控件,非常重要
          if (self.DiyFieldList.length > 0) {
            self.LoadMap = false;
          }
          self.$nextTick(function () {
            //赋值前，重载地图控件,非常重要
            self.LoadMap = true;
            self.DiyFieldList = resultGetDiyField.Data;
            self.LoadDiyFieldList = true;
            self.$emit("CallbackGetDiyField", self.DiyFieldList);
            //注意：2020-11-02发现，当初为什么这里要0.3秒后执行？
            //原因是：有些函数在进入表单时就要执行，但此时可能DiyFieldList还没有渲染完毕。
            //还有个问题：以查看/编辑模式进入表单时，每个字段的V8也会执行一遍，实际上不应该执行，
            //增加一个全局变量IsFirstLoadForm=false控制刚进来不执行V8，但进入表单的函数是一定要执行的？（不对，进入表单也应该判断 V8.IIsFirstLoadForm才执行V8的函数？）
            // // var timer1 = setInterval(function () {
            //     if (self.DiyCommon.IsNull(self.DiyTableModel.Id)) {
            //         return
            //     }
            self.$nextTick(async function () {
              //处理字段默认值
              self.DiyFieldList.forEach((field) => {
                if (field.DefaultValue && self.FormMode == "Add") {
                  if (
                    field.DefaultValue[0] == "{" ||
                    field.DefaultValue[0] == "["
                  ) {
                    self.FormSet(field.Name, JSON.parse(field.DefaultValue));
                  } else {
                    self.FormSet(field.Name, field.DefaultValue);
                  }
                }
              });
              // 判断需要执行的V8
              if (!self.DiyCommon.IsNull(self.DiyTableModel.InFormV8)) {
                var V8 = {
                  V8From: "DiyForm",
                  EventName: "FormIn",
                };
                self.SetV8DefaultValue(V8);
                await self.DiyCommon.InitV8Code(V8, self.$router);
                try {
                  // eval(self.DiyTableModel.InFormV8)
                  await eval(
                    "(async () => {\n " +
                      self.DiyTableModel.InFormV8 +
                      " \n})()"
                  );
                } catch (error) {
                  self.DiyCommon.Tips(
                    `执行V8引擎代码出现错误[${self.DiyTableModel.Name}-InFormV8]：` +
                      error.message,
                    false
                  );
                }
              }
              self.IsFirstLoadForm = false;
            });

            //     // clearInterval(timer1)
            // // }, 300)

            // 设置了tab后，先加载第一个tab的控件拖动
            self.$nextTick(function () {
              self.$emit("CallbackLoadDragula", 0);
              //如果没有查询DiyTableRowModel，也要执行这个回调
              //这里这个判断和 IF20210906 要保持一样
              // if (!needGetDiyTableRowModel) {
              if (callback) {
                var V8 = {};
                self.SetV8DefaultValue(V8);
                callback({
                  CurrentRowModel: formData,
                  V8: V8,
                });
              }
              // }
            });
          });
        }
      });
    },
    async GetAllDataAfter(resultGetDiyField, formData, callback) {
      var self = this;
      resultGetDiyField.Data.forEach((field) => {
        self.DiyCommon.DiyFieldConfigStrToJson(field);
        self.DiyCommon.Base64DecodeDiyField(field);
      });
      self.DiyCommon.SetFieldsData(resultGetDiyField.Data);

      await resultGetDiyField.Data.forEach(async (field) => {
        self.DiyFieldStrToJson(field, formData, null); //, isPostSql

        //如果是代码编辑器，需要解密

        //处理表单模板引擎
        if (!self.DiyCommon.IsNull(field.V8TmpEngineForm)) {
          var tmpResult = await self.RunFieldTemplateEngine(
            field,
            self.FormDiyTableModel
          );
          self.$set(
            self.FormDiyTableModel,
            field.Name + "_TmpEngineResult",
            tmpResult
          );
        }
        if (
          !self.DiyCommon.IsNull(field.Config.DevComponentName) &&
          !self.DiyCommon.IsNull(field.Config.DevComponentPath)
        ) {
          //渲染定制组件
          try {
            //2022-06-22新增
            field.Config.DevComponentPath =
              field.Config.DevComponentPath.replace("/views", "");

            // console.log('渲染定制组件：', field.Config.DevComponentName, field.Config.DevComponentPath);
            //注意：'@/views' 会被编译，不能由服务器传过来
            if (
              !self.DiyCommon.IsNull(
                self.CustomComponent[field.Config.DevComponentName]
              )
            ) {
              console.log("外部传入组件");
              Vue.component(
                field.Config.DevComponentName,
                self.CustomComponent[field.Config.DevComponentName]
              );
            } else {
              console.log("内部读取组件");
              var component = (resolve) =>
                require(["@/views" + field.Config.DevComponentPath], resolve);
              Vue.component(field.Config.DevComponentName, component);
            }
            if (
              self.DiyCommon.IsNull(
                self.DevComponents[field.Config.DevComponentName]
              )
            ) {
              self.DevComponents[field.Config.DevComponentName] = {
                Name: "",
                Path: "",
              };
            }
            self.DevComponents[field.Config.DevComponentName].Name =
              field.Config.DevComponentName;
            self.DevComponents[field.Config.DevComponentName].Path =
              field.Config.DevComponentPath;
            console.log("渲染定制组件成功");
          } catch (error) {
            console.log("渲染定制组件出现错误：" + error.message);
          }
        }
      });
      //注意：这里要把Id、CreateTime等默认字段也赋值
      var defaultFields = [
        "Id",
        "ParentId",
        "CreateTime",
        "UpdateTime",
        "UserId",
        "UserName",
        "IsDeleted",
      ];
      if (formData) {
        defaultFields.forEach((defaultF) => {
          if (!self.DiyCommon.IsNull(formData[defaultF])) {
            self.$set(self.FormDiyTableModel, defaultF, formData[defaultF]);
          }
        });
        self.OldForm = { ...self.FormDiyTableModel };
        self.OldFormData = { ...formData };
        self.$nextTick(function () {
          if (callback) {
            // if (!self.DiyCommon.IsNull(results[2]) && results[2].Code == 1) {//!self.DiyCommon.IsNull(self.TableRowId)
            //     callback({CurrentRowModel: results[2].Data});
            // }
            callback({ CurrentRowModel: formData });
          }
        });
      }
      self.GetDiyTableRowModelFinish = true;
    },
    DiyFieldListGroupFunc(tab, tabIndex) {
      var self = this;
      var result = [];
      self.DiyFieldList.forEach((field) => {
        if (
          (self.ShowFields.length == 0 ||
            (self.ShowFields.length > 0 &&
              self.ShowFields.indexOf(field.Name) > -1)) && // _.where(self.ShowFields, { Id: field.Id}).length > 0
          self.HideFields.indexOf(field.Name) == -1
        ) {
          // if (self.ShowTabs == false) {
          //     result.push(field)
          // }
          // 也要取出该item.Tab不存在Tabs中的数据
          //tabIndex == 0 && (self.DiyCommon.IsNull(field.Tab) || tab.Name == self.DiyTableModel.Tabs[0].Name)
          if (field.Tab == tab.Name) {
            result.push(field);
          }
          //如果是第1个tab，并且 字段的Tab为空或者字段的Tab不在Tabs中
          else if (tabIndex == 0) {
            if (self.DiyCommon.IsNull(field.Tab)) {
              result.push(field);
            } else {
              var isHave = false;
              // self.DiyTableModel.Tabs.forEach(tabModel => {
              //     if (tabModel.Name == field.Tab) {
              //         isHave = true;
              //     }
              // });
              self.GetShowTabs().forEach((tabModel) => {
                if (tabModel.Name == field.Tab) {
                  isHave = true;
                }
              });
              if (!isHave) {
                result.push(field);
              }
            }
          }
        }
      });
      // 处理后的result是引用类型，要的就是这种效果
      return result;
    },
    GetFileList(field) {
      var self = this;
      try {
        if (self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name])) {
          return [];
        }
        if (typeof self.FormDiyTableModel[field.Name] === "object") {
          if (Array.isArray(self.FormDiyTableModel[field.Name])) {
            return self.JsonToFileList(self.FormDiyTableModel[field.Name]);
          }
          return [];
        }
        if (field.Config.FileUpload.Multiple != true) {
          var fileUrl = self.FormDiyTableModel[field.Name];
          // 还要判断是否允许匿名访问
          if (field.Config.FileUpload.Limit == false) {
            return [
              {
                name: "",
                url: self.DiyCommon.GetFileServer() + fileUrl,
              },
            ];
          }
          return [
            {
              name: "",
              url: fileUrl,
            },
          ];
        }
        // 如果是多文件上传
        try {
          var arr = JSON.parse(self.FormDiyTableModel[field.Name]);
          return self.JsonToFileList(arr);
        } catch (error) {
          return [];
        }
      } catch (error) {
        return [];
      }
    },
    GetFileListImg(field) {
      var self = this;
      try {
        if (self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name])) {
          return [];
        }
        if (typeof self.FormDiyTableModel[field.Name] === "object") {
          if (Array.isArray(self.FormDiyTableModel[field.Name])) {
            return self.JsonToFileList(self.FormDiyTableModel[field.Name]);
          }
          return [];
        }

        // 如果不是多文件上传
        if (field.Config.ImgUpload.Multiple != true) {
          var fileUrl = self.FormDiyTableModel[field.Name];
          // 还要判断是否允许匿名访问
          if (field.Config.ImgUpload.Limit == false) {
            return [
              {
                name: "",
                url: self.DiyCommon.GetFileServer() + fileUrl,
              },
            ];
          }
          return [
            {
              name: "",
              url: self.DiyCommon.GetServerPath("/static/img/noImg.jpg"),
            },
          ];
        }
        // 如果是多文件上传
        try {
          var arr = JSON.parse(self.FormDiyTableModel[field.Name]);
          return self.JsonToFileList(arr);
        } catch (error) {
          return [];
        }
      } catch (error) {
        return [];
      }
    },
    JsonToFileList(arr) {
      var self = this;
      var result = [];
      arr.forEach((element) => {
        result.push({
          name: element.Name,
          url: element.Path,
          Id: element.Id,
        });
      });
      return result;
    },
    GetLimitFile(colName) {
      var self = this;
      if (self.DiyCommon.IsNull(self.Attachments_[colName])) {
        return self.DiyCommon.GetFileServer() + "/static/img/loading1.gif"; // 权限验证中...
      }
      var imgFormat = "";
      var path = self.Attachments_[colName];
      if (!self.DiyCommon.IsNull(path)) {
        imgFormat = path
          .substring(path.lastIndexOf("."), path.length)
          .toLowerCase();
      }
      var _did = self.DiyCommon.GetDid();
      var _token = localStorage.getItem("token");

      var src =
        self.DiyCommon.GetApiBase() +
        "/api/Tdx/TdxCustomer/GetCustomerCertImg" +
        // + imgFormat
        "?Id=" +
        self.CurrentTdxCustomerModel.Id +
        "&AttachmentName=" +
        colName +
        "&_did=" +
        _did +
        "&_token=" +
        _token +
        "&r=" +
        self.CurrentTdxCustomerModel.UpdateTime;
      // fetch方式加载图片
      fetch(src, {
        headers: {
          authorization: "Bearer " + DiyCommon.getToken(),
        },
      })
        .then((res) => res.blob())
        .then((blob) => {
          var img = $("#img" + colName);
          img.load(function (e) {
            window.URL.revokeObjectURL(img.attr("src"));
          });
          img.attr("src", window.URL.createObjectURL(blob));
        });
      return self.DiyCommon.GetFileServer() + "/static/img/loading1.gif";
    },

    EventMarker(name, detail, lng, lat, field) {
      var self = this;
      field.AmapConfig.SelectMarker = {
        label: {
          content: `<div>
                            <div>${name}</div>
                            <div>${detail}</div>
                            </div>`,
          offset: [20, 20],
        },
        position: [lng, lat],
      };
      field.AmapConfig.Center = [lng, lat];

      self.$set(field.AmapConfig, "SelectMarker", {
        label: {
          content: `<div>
                            <div>${name}</div>
                            <div>${detail}</div>
                            </div>`,
          offset: [20, 20],
        },
        position: [lng, lat],
      });
      self.$set(field.AmapConfig, "Center", [lng, lat]);

      self.FormDiyTableModel[field.Name + "_Lng"] = lng || 0;
      self.FormDiyTableModel[field.Name + "_Lat"] = lat || 0;

      // 这里通过高德 SDK 完成。
      var geocoder = new AMap.Geocoder({
        radius: 1000,
        extensions: "all",
      });
      geocoder.getAddress(field.AmapConfig.Center, function (status, result) {
        if (status === "complete" && result.info === "OK") {
          if (result && result.regeocode) {
            field.AmapConfig.Address = result.regeocode.formattedAddress;
            if (field.AmapConfig.Center && field.AmapConfig.Center != "{}") {
              field.AmapConfig.SelectMarker = {
                label: {
                  content: `<div>
                                            <div>${result.regeocode.formattedAddress}</div>
                                            </div>`,
                  offset: [20, 20],
                },
                position: field.AmapConfig.Center,
              };
            }
            self.$nextTick();
          }
        }
      });
    },
    onSearchResult(pois, field) {
      var self = this;
      if (pois.length > 0) {
        const { lng, lat, name, district, address } = pois[0];
        // self.InitMap(field);
        self.EventMarker(name, address, lng, lat, field);
      }
    },
    SelectSearch(poi) {
      var self = this;
      console.log(poi);
      const { location, name, adcode, district, address } = poi;
      const center = [location.lng, location.lat];
      self.EventMarker(name, district, location.lng, location.lat);
    },
    tabClickField(tab) {
      var self = this;
      console.log("tab", tab);
      this.FieldActiveTab = tab.name; //切换索引
      this.currentTabIndex = tab.index; //当前索引lisaisai
      // 切换了tab后，需要重载控件拖动
      self.$nextTick(function () {
        self.$emit("CallbackLoadDragula", tab.index);
      });
    },
    CommonV8CodeChange(item, field, v8codeKey) {
      var self = this;
      if (
        !self.DiyCommon.IsNull(field.Config) &&
        (!self.DiyCommon.IsNull(field.Config.V8Code) ||
          (v8codeKey && !self.DiyCommon.IsNull(field.Config[v8codeKey])))
      ) {
        self.RunV8Code(field, item, v8codeKey);
      }
    },
    SelectChange(item, field) {
      var self = this;
      if (
        (field.Component == "Select" ||
          field.Component == "SelectTree" ||
          field.Component == "MultipleSelect") &&
        !self.DiyCommon.IsNull(field.Config.V8Code)
      ) {
        self.RunV8Code(field, item);
      }
    },
    DeptChange(value, field) {
      var self = this;
      // self.CurrentSysUserModel.DeptName = '';
      if (!self.DiyCommon.IsNull(value) && value.length > 0) {
        var tObj = self.DiyCommon.ArrayDeepSearch(
          field.Data,
          "_Child",
          "Id",
          value[value.length - 1]
        );
        if (!self.DiyCommon.IsNull(tObj)) {
          // self.CurrentSysUserModel.DeptName = tObj.Name;
          // self.CurrentSysUserModel.DeptCode = tObj.Code;
          if (!self.DiyCommon.IsNull(field.Config.V8Code)) {
            self.RunV8Code(field, tObj);
          }
        }
      }
    },
    async RunV8Code(field, thisValue, v8codeKey, _v8Code) {
      var self = this;
      if (!v8codeKey) {
        v8codeKey = "V8Code";
      }

      var v8Code = field.Config[v8codeKey];

      if (_v8Code) {
        v8Code = _v8Code;
      }

      if (!self.DiyCommon.IsNull(v8Code) && !self.IsFirstLoadForm) {
        var V8 = {
          ThisValue: self.DiyCommon.IsNull(thisValue) ? "" : thisValue, // 这个是Select控制选择后的回调对象
          EventName: "FieldValueChange",
        };
        self.SetV8DefaultValue(V8, field);
        await self.DiyCommon.InitV8Code(V8, self.$router);
        try {
          //eval(field.Config.V8Code)
          await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + v8Code + " \n})()");
          return V8;
        } catch (error) {
          self.DiyCommon.Tips(
            "执行V8引擎代码出现错误[" +
              field.Name +
              "," +
              field.Label +
              "]：" +
              error.message,
            false
          );
        }
      }
    },
    RunV8CodeSync(field, thisValue, v8codeKey, _v8Code) {
      var self = this;
      if (!v8codeKey) {
        v8codeKey = "V8Code";
      }

      var v8Code = field.Config[v8codeKey];

      if (_v8Code) {
        v8Code = _v8Code;
      }

      if (!self.DiyCommon.IsNull(v8Code) && !self.IsFirstLoadForm) {
        var V8 = {
          ThisValue: self.DiyCommon.IsNull(thisValue) ? "" : thisValue, // 这个是Select控制选择后的回调对象
          EventName: "FieldValueChange",
        };
        self.SetV8DefaultValue(V8, field);
        self.DiyCommon.InitV8CodeSync(V8, self.$router);
        try {
          eval(v8Code);
          // await eval("(async () => {\n " + v8Code + " \n})()")
          return V8;
        } catch (error) {
          self.DiyCommon.Tips(
            "执行V8引擎代码出现错误[" +
              field.Name +
              "," +
              field.Label +
              "]：" +
              error.message,
            false
          );
        }
      }
    },
    //param: { _PageIndex : 1 }
    //_PageIndex从1开始计数，传入-1表示跳到最后一页。
    TableRefresh(field, param) {
      var self = this;
      try {
        self.$refs["refTableChild_" + field.Name][0].RefreshDiyTableRowList(
          param
        );
      } catch (error) {
        console.log("TableRefresh error:" + error.message);
      }
    },
    //刷新所有子表
    RefreshAllChildTable(field, param) {
      var self = this;
      // self.DiyFieldList.forEach(field => {
      //     if (field.Component == 'TableChild') {
      //         if (self.$refs['refTableChild_' + field.Name]) {
      //             var arr = self.$refs['refTableChild_' + field.Name][0].GetNeedSaveRowList();
      var allChildTable = _.where(self.DiyFieldList, {
        Component: "TableChild",
      });
      allChildTable.forEach((field) => {
        try {
          self.$refs["refTableChild_" + field.Name][0].RefreshDiyTableRowList(
            param
          );
        } catch (error) {
          console.log("TableRefresh error:" + error.message);
        }
      });
    },
    //提交Form。{CloseForm:true, SavedType:'Insert/Update/View'}
    V8FormSubmit(param) {
      var self = this;
      try {
        self.$emit("CallbackFormSubmit", param);
      } catch (error) {
        console.log("V8FormSubmit error:" + error.message);
      }
    },

    CallbackRefreshTable(param) {
      var self = this;
      try {
        self.$emit("CallbackRefreshTable", param);
      } catch (error) {
        console.log("CallbackRefreshTable error:" + error.message);
      }
    },
    TableSetData(field) {
      var self = this;
      try {
        self.$refs["refTableChild_" + field.Name][0].TableSetData();
      } catch (error) {
        console.log("TableSetData error:" + error.message);
      }
    },
    //值：{FieldName:value}
    SearchAppend(field, val) {
      var self = this;
      for (const key in val) {
        field.Config.TableChild.SearchAppend[key] = val[key];
      }
    },
    //值：{FieldName:value}
    SearchSet(field, val) {
      var self = this;

      field.Config.TableChild.SearchAppend = val;
    },

    //2021-02-15注释  放到DiyCommon中去
    //param：必传TableId，可选CacheParentKey
    // GetDiyTableRow(param, callback) {
    //     var self = this
    //     // 查询数据库
    //     self.DiyCommon.Post(DiyApi.GetDiyTableRow, param, function (result) {
    //         if (self.DiyCommon.Result(result)) {
    //             callback(result.Data)
    //         } else {
    //             callback(null)
    //             console.log(result)
    //         }
    //     })
    // },
    FieldSet(fieldName, attrName, value) {
      var self = this;
      // 先查找出Field对象
      self.DiyFieldList.forEach((element) => {
        //2022-07-25：像JoinTable.TableId 这种赋值， attrName需要传入 'Config.JoinTable.TableId'
        if (element.Name == fieldName) {
          if (attrName.indexOf("Config.") > -1) {
            var oldConfig = element.Config;
            var attrArray = attrName.split(".");
            if (attrArray.length == 2) {
              oldConfig[attrArray[1]] = value;
            } else if (attrArray.length == 3) {
              oldConfig[attrArray[1]][attrArray[2]] = value;
            } else if (attrArray.length == 4) {
              oldConfig[attrArray[1]][attrArray[2]][attrArray[3]] = value;
            } else if (tempArr.length == 5) {
              oldConfig[attrArray[1]][attrArray[2]][attrArray[3]][
                attrArray[4]
              ] = value;
            }
            self.$set(element, "Config", oldConfig);
          } else {
            self.$set(element, attrName, value);
          }
        }
      });
    },
    NumberTextChange(currentValue, oldValue, field) {
      var self = this;
      if (
        field.Component == "NumberText" &&
        !self.DiyCommon.IsNull(field.Config.V8Code)
      ) {
        self.RunV8Code(field, {
          New: currentValue,
          Old: oldValue,
        });
      }
    },
    FormSet(fieldName, value, field) {
      var self = this;
      self.$set(self.FormDiyTableModel, fieldName, value);
      self.FormDiyTableModel[fieldName] = value;
      try {
        // self.$refs['ref_' + fieldName].trigger('change');
        // self.$refs['ref_' + fieldName].dispatchEvent(new MouseEvent('change'));
        if (!field) {
          field = _.find(self.DiyFieldList, function (item2) {
            return item2.Name == fieldName;
          });
        }
        if (field) {
          if (self.$refs["ref_" + fieldName]) {
            try {
              self.$refs["ref_" + fieldName][0].CommonV8CodeChange(
                value,
                field
              );
            } catch (error) {}
          }
          //2022-08-18：如果是给下拉单选框赋值了，并且下拉Data中不包含这条数据，那么这里就push一下
          if (
            field.Component == "Select" &&
            field.Config.SelectSaveField &&
            field.Config.SelectLabel &&
            value &&
            value[field.Config.SelectSaveField]
          ) {
            var findModel = _.find(field.Data, function (item) {
              return (
                item[field.Config.SelectSaveField] ==
                value[field.Config.SelectSaveField]
              );
            });
            if (!findModel) {
              field.Data.push(value);
            } else {
              //2022-09-02修复Bug：在网络较快时，field.Data赋值比FormSet先执行，
              //然后用户又只赋值一个Id，并不给SelectLabel赋值，这时候仍然以field.Data为准。
              //但若用户赋值了SelectLabel，则以用户赋值的为准，而不是field.Data数据源
              if (
                !findModel[field.Config.SelectLabel] &&
                value[field.Config.SelectLabel]
              ) {
                findModel[field.Config.SelectLabel] =
                  value[field.Config.SelectLabel];
              }
            }
          }
        }
      } catch (error) {}
      self.$nextTick(async function () {
        //处理表单模板引擎   2022-07-15新增
        //2023-04-01：如果在模板引擎中写V8.FormSet，这会导致死循环
        if (
          field &&
          field.V8TmpEngineForm &&
          !(field.V8TmpEngineForm.indexOf("V8.FormSet") > -1)
        ) {
          var tmpResult = await self.RunFieldTemplateEngine(
            field,
            self.FormDiyTableModel
          );
          self.$set(
            self.FormDiyTableModel,
            field.Name + "_TmpEngineResult",
            tmpResult
          );
        }
      });
      self.UpdateModifiedFields(fieldName);
    },
    //注意：这里是触发子表的ParentFormSet（现在是以子表单的身份），但最终还是最回调到此页面的FormSet
    ParentFormSet(fieldName, value) {
      var self = this;
      // self.$set(self.FormDiyTableModel, fieldName, value) // 0
      self.$emit("ParentFormSet", fieldName, value);
    },
    SelectField(field) {
      var self = this;
      self.CurrentDiyFieldModel = field;
      // if (field.Component == 'Checkbox'
      //     || field.Component == 'MultipleSelect'
      //     ) {
      //     self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = [];//self.CurrentDiyFieldModel.Data
      // }else{
      //     self.FormDiyTableModel[self.CurrentDiyFieldModel.Name] = '';
      // }
      // self.AsideRightActiveTab = 'Field';
      self.$emit("CallbackSelectField", field);
    },
    GetDiyTableRowModel() {
      // // _TableRowId : self.TableRowId  , LIMIT 1
      // var self = this
      // self.DiyCommon.Post(DiyApi.GetDiyTableRowModel, {
      //     TableId: self.TableId,
      //     _TableRowId: self.TableRowId,
      //     OsClient: self.OsClient
      // }, function (result) {
      //     if (self.DiyCommon.Result(result)) {
      //         // self.CurrentDiyTableRowModel = result.Data;//2020-07-09：这个存在的意义是什么？暂时注释
      //         // self.FormDiyTableModel = result.Data;//注意：这里暂时不要赋值，因为后面DiyFieldStrToJson会去赋值，处理数据转换
      //         // 2020-07-02：不用每次都从数据库取
      //         if (self.DiyFieldList.length == 0) {
      //             self.GetDiyField(result.Data)
      //         } else {
      //             self.DiyFieldList.forEach(element => {
      //                 self.DiyFieldStrToJson(element, result.Data, null)
      //             })
      //         }
      //     }
      // })
    },

    SetDiyTableModel(data) {
      var self = this;
      self.DiyCommon.DiyTableStrToJson(data);
      self.DiyCommon.Base64DecodeDiyTable(data);
      self.DiyTableModel = data;
      self.$emit("CallbackSetDiyTableModel", self.DiyTableModel);
    },
    GetDiyTableModel() {
      // var self = this
      // self.DiyCommon.Post(DiyApi.GetDiyTableModel, {
      //     Id: self.TableId,
      //     OsClient: self.OsClient
      // }, function (result) {
      //     if (self.DiyCommon.Result(result)) {
      //         self.DiyTableStrToJson(result.Data)
      //         self.DiyTableModel = result.Data
      //         self.$nextTick(function () {
      //             if (self.DiyTableModel.Tabs.length > 0 &&
      //                 (self.DiyCommon.IsNull(self.FieldActiveTab) || self.FieldActiveTab == '0' || self.FieldActiveTab == 'none' || self.FieldActiveTab == 'info')) {
      //                 self.FieldActiveTab = self.DiyTableModel.Tabs[0].Name
      //             }
      //         })
      //         self.$emit('CallbackSetDiyTableModel', self.DiyTableModel)
      //     }
      // })
    },
    GetDiyTableColumnSpan(field) {
      var self = this;
      if (!self.DiyCommon.IsNull(self.ColSpan) && self.ColSpan != 0) {
        return self.ColSpan;
      }
      if (!self.DiyCommon.IsNull(field.FormWidth) && field.FormWidth != 0) {
        return field.FormWidth;
      } else if (self.DiyTableModel.Column == 1) {
        return 24;
      } else if (self.DiyTableModel.Column == 2) {
        return 12;
      } else if (self.DiyTableModel.Column == 3) {
        return 8;
      } else if (self.DiyTableModel.Column == 4) {
        return 6;
      } else if (self.DiyTableModel.Column == 6) {
        return 4;
      } else {
        return 24;
      }
    },
    SingleFieldRunSql() {
      var self = this;
    },
    //加载高德地图
    InitMap(field) {
      var self = this;
      if (self.DiyCommon.IsNull(field.AmapConfig)) {
        field.AmapConfig = {
          SearchBoxDefault: "",
          SelectMarker: null,
          Zoom: 12,
          Center: self.AmapDefaultCenter, // [0,0]
          Lng: 0,
          Lat: 0,
          Loaded: false,
          Address: "",
          Events: {
            click(e) {
              const { lng, lat } = e.lnglat;
              field.AmapConfig.Lng = lng;
              field.AmapConfig.Lat = lat;
              self.EventMarker("您选择了这里", "", lng, lat, field);
            },
          },
          AmapPlugin: [
            {
              pName: "ToolBar",
              events: {
                init(instance) {
                  console.log(instance);
                },
              },
            },
            // ,{
            //     pName: 'Geolocation',
            //     events: {
            //         init(o) {
            //             // o 是高德地图定位插件实例
            //             o.getCurrentPosition((status, result) => {
            //                 if (result && result.position) {
            //                     self.AmapConfig.Lng = result.position.lng;
            //                     self.AmapConfig.Lat = result.position.lat;
            //                     self.AmapConfig.Center = [self.AmapConfig.Lng, self.AmapConfig.Lat];
            //                     self.AmapConfig.Loaded = true;
            //                     self.$nextTick();
            //                 }
            //             });
            //         }
            //     }
            // }
          ],
          OnSearchResult: function (pois, field) {
            if (pois.length > 0) {
              const { lng, lat, name, district, address } = pois[0];
              self.InitMap(field);
              self.EventMarker(name, address, lng, lat, field);
            }
          },
        };
      }
    },
    //加载百度地图
    InitBaiduMap(field) {
      var self = this;
      if (self.DiyCommon.IsNull(field.BaiduMapConfig)) {
        field.BaiduMapConfig = {
          Polyline: {
            Editing: false,
            Paths: [],
          },
          ScrollWheelZoom: false,
          SearchBoxDefault: "",
          SelectMarker: null,
          Zoom: 12,
          Center: self.BaiduMapDefaultCenter,
          Lng: 0,
          Lat: 0,
          Loaded: false,
          Address: "",
          Events: {
            click(e) {
              const { lng, lat } = e.lnglat;
              field.BaiduMapConfig.Lng = lng;
              field.BaiduMapConfig.Lat = lat;
              self.EventMarker("您选择了这里", "", lng, lat, field);
            },
          },
          OnSearchResult: function (pois, field) {
            if (pois.length > 0) {
              const { lng, lat, name, district, address } = pois[0];
              self.InitBaiduMap(field);
              self.EventMarker(name, address, lng, lat, field);
            }
          },
        };
      } else {
      }
    },
    GetPleaseInputText(field) {
      if (
        field.Component == "SelectTree" ||
        field.Component == "FontAwesome" ||
        field.Component == "Department" ||
        field.Component == "Cascader" ||
        field.Component == "MapArea" ||
        field.Component == "Map" ||
        field.Component == "ColorPicker" ||
        field.Component == "Rate" ||
        field.Component == "DateTime" ||
        field.Component == "MultipleSelect" ||
        field.Component == "Select" ||
        field.Component == "Checkbox" ||
        field.Component == "Radio" ||
        field.Component == "Switch"
      ) {
        return "请选择";
      }
      if (field.Component == "FileUpload" || field.Component == "ImgUpload") {
        return "请上传";
      }
      return "请输入";
    },
    /**
     *
     */
    // isPostSql：是否发起sql post请求
    DiyFieldStrToJson(field, formData, isPostSql) {
      var self = this;
      //验证
      if (self.FormMode != "View" && field.NotEmpty && field.Visible) {
        var trigger = "change";
        //2022-08-17注释：只使用change事件验证体现更好，blur验证用户体验不好
        // if (field.Component == 'Text' ||
        //     field.Component == 'Textarea') {
        //     trigger = 'blur';
        // }
        if (!self.FormRules[field.Name]) {
          self.FormRules[field.Name] = [
            {
              required: true,
              message: self.GetPleaseInputText(field) + "[" + field.Label + "]",
              trigger: trigger,
            },
          ];
        }
      } else if (self.FormMode == "View") {
        self.FormRules = {};
      }
      //config转换
      // 这3句放到外部执行了
      //2022-09-14发现：放到外部执行后，有些调用DiyFieldStrToJson时并没有执行这3句，导致出错
      // self.DiyCommon.DiyFieldConfigStrToJson(field);
      // self.DiyCommon.Base64DecodeDiyField(field);
      // self.DiyCommon.SetFieldData(field, isPostSql, self.ApiReplace, formData);

      // 这时候也要给FormDiyTableModel赋值，否则预览区不会显示出来
      if (
        field.Component == "Checkbox" ||
        field.Component == "MultipleSelect"
      ) {
        if (!self.DiyCommon.IsNull(field.Config.Sql) && isPostSql !== false) {
          // // 查询数据库
          // self.DiyCommon.Post(DiyApi.GetDiyFieldSqlData, {
          //     _FieldId: field.Id,
          //     OsClient: self.OsClient
          // }, function (result) {
          //     if (self.DiyCommon.Result(result)) {
          //         field.Data = result.Data
          //     }
          // })
        }
        //注意：Checkbox\MultipleSelect，默认应该是数组
        try {
          self.$set(
            self.FormDiyTableModel,
            field.Name,
            self.GetFormDataJsonValue(field, formData, true)
          ); // ''

          // 像目的港（值：'{name:'日本'}'）是没有数据源的，从数据库中取出来过后，要显示出来 ---2020-12-30
          if (
            !self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name]) &&
            Array.isArray(self.FormDiyTableModel[field.Name]) &&
            self.FormDiyTableModel[field.Name].length > 0 &&
            (self.DiyCommon.IsNull(field.Data) ||
              field.Data == "[]" ||
              field.Data.toString() == "" ||
              JSON.stringify(field.Data) == "[{}]")
          ) {
            var fieldData = field.Data;
            if (self.DiyCommon.IsNull(fieldData)) {
              fieldData = [];
            }
            var fieldDataKey = !self.DiyCommon.IsNull(
              field.Config.SelectSaveField
            )
              ? field.Config.SelectSaveField
              : field.Config.SelectLabel;
            self.FormDiyTableModel[field.Name].forEach((formValue) => {
              var isHave = false;
              fieldData.forEach((fieldValue) => {
                if (fieldValue[fieldDataKey] == formValue[fieldDataKey]) {
                  isHave = true;
                }
              });
              if (!isHave && !self.DiyCommon.IsNull(formValue[fieldDataKey])) {
                fieldData.push(formValue);
              }
            });
            self.$set(field, "Data", fieldData);
          }
        } catch (error) {
          console.log(error);
          self.$set(self.FormDiyTableModel, field.Name, []); // ''
        }

        //注意：Checkbox\MultipleSelect，默认应该是数组
        // if (!self.DiyCommon.IsNull(field.Config.SelectLabel)
        //     || !self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
        //     try {
        //         self.$set(self.FormDiyTableModel, field.Name, self.GetFormDataJsonValue(field, formData, true)) // ''
        //     } catch (error) {
        //         console.log(error)
        //         self.$set(self.FormDiyTableModel, field.Name, []) // ''
        //     }
        // } else {
        //     self.$set(self.FormDiyTableModel, field.Name,
        //         (self.DiyCommon.IsNull(formData) || self.DiyCommon.IsNull(formData[field.Name])) ?
        //         '' : formData[field.Name]) // ''
        // }

        //这是以前的  2020-10-30
        // self.$set(self.FormDiyTableModel, field.Name, self.GetFormDataJsonValue(field, formData, true))
      } else if (field.Component == "ImgUpload") {
        if (field.Config.ImgUpload.Multiple) {
          self.$set(
            self.FormDiyTableModel,
            field.Name,
            self.GetFormDataJsonValue(field, formData, true)
          );
        } else {
          self.$set(
            self.FormDiyTableModel,
            field.Name,
            self.DiyCommon.IsNull(formData) ||
              self.DiyCommon.IsNull(formData[field.Name])
              ? ""
              : formData[field.Name]
          );
        }
      } else if (field.Component == "FileUpload") {
        if (field.Config.FileUpload.Multiple) {
          self.$set(
            self.FormDiyTableModel,
            field.Name,
            self.GetFormDataJsonValue(field, formData, true)
          );
        } else {
          self.$set(
            self.FormDiyTableModel,
            field.Name,
            self.DiyCommon.IsNull(formData) ||
              self.DiyCommon.IsNull(formData[field.Name])
              ? ""
              : formData[field.Name]
          );
        }
      } else if (field.Component == "Select") {
        // 如果有sql数据源
        if (!self.DiyCommon.IsNull(field.Config.Sql) && isPostSql !== false) {
          // // 查询数据库
          // // 需要将参数值传回服务器
          // // 取参数
          // // var sqlParams = field.Config.Sql
          // self.DiyCommon.Post(DiyApi.GetDiyFieldSqlData, {
          //     _FieldId: field.Id,
          //     OsClient: self.OsClient,
          //     _SqlParamValue: JSON.stringify({})
          // }, function (result) {
          //     if (self.DiyCommon.Result(result)) {
          //         field.Data = result.Data
          //     }
          // })
        }
        // 如果是设置了SelectLabel、或者SelectSaveField， 说明绑定的数据不是string，而是object
        if (
          !self.DiyCommon.IsNull(field.Config.SelectLabel) ||
          !self.DiyCommon.IsNull(field.Config.SelectSaveField)
        ) {
          try {
            self.$set(
              self.FormDiyTableModel,
              field.Name,
              self.GetFormDataJsonValue(field, formData, false)
            ); // ''

            // 像目的港（值：'{name:'日本'}'）是没有数据源的，从数据库中取出来过后，要显示出来 ---2020-06-02
            //2020-12-30发现bug，self.FormDiyTableModel[field.Name]没有值的情况下，也赋值了一个空值到field.Data中去，已解决
            if (
              !self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name]) &&
              typeof self.FormDiyTableModel[field.Name] !== "string" &&
              JSON.stringify(self.FormDiyTableModel[field.Name]) !== "{}" &&
              (self.DiyCommon.IsNull(field.Data) ||
                field.Data == "[]" ||
                field.Data.toString() == "" ||
                JSON.stringify(field.Data) == "[{}]")
            ) {
              //这里其实不对，应该是push
              self.$set(field, "Data", [self.FormDiyTableModel[field.Name]]);
            }
          } catch (error) {
            console.log(error);
            self.$set(self.FormDiyTableModel, field.Name, {}); // ''
          }
        } else {
          self.$set(
            self.FormDiyTableModel,
            field.Name,
            self.DiyCommon.IsNull(formData) ||
              self.DiyCommon.IsNull(formData[field.Name])
              ? ""
              : formData[field.Name]
          ); // ''
        }
      } else if (field.Component == "SelectTree") {
        // 如果有sql数据源
        if (!self.DiyCommon.IsNull(field.Config.Sql) && isPostSql !== false) {
        }
        // 如果是设置了SelectLabel、或者SelectSaveField， 说明绑定的数据不是string，而是object
        if (
          !self.DiyCommon.IsNull(field.Config.SelectLabel) ||
          !self.DiyCommon.IsNull(field.Config.SelectSaveField)
        ) {
          try {
            self.$set(
              self.FormDiyTableModel,
              field.Name,
              self.GetFormDataJsonValue(field, formData, false)
            ); // ''

            // 像目的港（值：'{name:'日本'}'）是没有数据源的，从数据库中取出来过后，要显示出来 ---2020-06-02
            //2020-12-30发现bug，self.FormDiyTableModel[field.Name]没有值的情况下，也赋值了一个空值到field.Data中去，已解决
            if (
              !self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name]) &&
              typeof self.FormDiyTableModel[field.Name] !== "string" &&
              JSON.stringify(self.FormDiyTableModel[field.Name]) !== "{}" &&
              (self.DiyCommon.IsNull(field.Data) ||
                field.Data == "[]" ||
                field.Data.toString() == "" ||
                JSON.stringify(field.Data) == "[{}]")
            ) {
              //这里其实不对，应该是push
              // self.$set(field, 'Data', [self.FormDiyTableModel[field.Name]])
            }
          } catch (error) {
            console.log(error);
            self.$set(self.FormDiyTableModel, field.Name, {}); // ''
          }
        } else {
          self.$set(
            self.FormDiyTableModel,
            field.Name,
            self.DiyCommon.IsNull(formData) ||
              self.DiyCommon.IsNull(formData[field.Name])
              ? ""
              : formData[field.Name]
          ); // ''
        }
      } else if (
        field.Component == "Department" ||
        field.Component == "Cascader" ||
        field.Component == "Address"
      ) {
        if (
          (field.Component == "Department" &&
            field.Config.Department.EmitPath === false) ||
          (field.Component == "Cascader" &&
            field.Config.Cascader.EmitPath === false)
        ) {
          self.$set(
            self.FormDiyTableModel,
            field.Name,
            !formData || !formData[field.Name] ? "" : formData[field.Name]
          );
        } else {
          self.$set(
            self.FormDiyTableModel,
            field.Name,
            self.GetFormDataJsonValue(field, formData, true)
          );
        }
        // try {
        //     self.$set(self.FormDiyTableModel, field.Name,
        //         (self.DiyCommon.IsNull(formData) || self.DiyCommon.IsNull(formData[field.Name])) ?
        //         [] : JSON.parse(formData[field.Name]))
        // } catch (error) {
        //     self.$set(self.FormDiyTableModel, field.Name,[]);
        // }
      } else if (field.Component == "Radio") {
        // 如果有sql数据源
        if (!self.DiyCommon.IsNull(field.Config.Sql) && isPostSql !== false) {
          // // 查询数据库
          // // 需要将参数值传回服务器
          // // 取参数
          // // var sqlParams = field.Config.Sql
          // self.DiyCommon.Post(DiyApi.GetDiyFieldSqlData, {
          //     _FieldId: field.Id,
          //     OsClient: self.OsClient,
          //     _SqlParamValue: JSON.stringify({})
          // }, function (result) {
          //     if (self.DiyCommon.Result(result)) {
          //         field.Data = result.Data
          //     }
          // })
        }
        self.$set(
          self.FormDiyTableModel,
          field.Name,
          self.DiyCommon.IsNull(formData) ||
            self.DiyCommon.IsNull(formData[field.Name])
            ? ""
            : formData[field.Name]
        ); // ''
      } else if (field.Component == "NumberText" || field.Component == "Rate") {
        self.$set(
          self.FormDiyTableModel,
          field.Name,
          self.DiyCommon.IsNull(formData) ||
            self.DiyCommon.IsNull(formData[field.Name])
            ? 0
            : formData[field.Name]
        ); // 0
      } else if (field.Component == "Switch") {
        self.$set(
          self.FormDiyTableModel,
          field.Name,
          self.DiyCommon.IsNull(formData) ||
            self.DiyCommon.IsNull(formData[field.Name])
            ? false
            : formData[field.Name] == 1
        ); // false
      } else if (field.Component == "Divider") {
      } else if (field.Component == "Button") {
      } else if (field.Component == "Map" || field.Component == "MapArea") {
        // 初始化地图参数
        if (
          self.DiyCommon.IsNull(field.Config.MapCompany) ||
          field.Config.MapCompany == "Baidu"
        ) {
          self.InitBaiduMap(field);
        } else {
          self.InitMap(field);
        }

        if (field.Config.MapCompany == "AMap") {
          // self.VueAMap.initAMapApiLoader({
          //     key: field.Config.MapKey || self.SysConfig.AMapKey || '99b272c930081b69507b218d660be3dc',
          //     plugin: [
          //         'Scale', 'OverView', 'ToolBar', 'MapType', 'Geocoder', 'PlaceSearch', 'Autocomplete',
          //         "AMap.Autocomplete", //输入提示插件
          //         "AMap.PlaceSearch", //POI搜索插件
          //         "AMap.Scale", //右下角缩略图插件 比例尺
          //         "AMap.OverView", //地图鹰眼插件
          //         "AMap.ToolBar", //地图工具条
          //         "AMap.MapType", //类别切换控件，实现默认图层与卫星图、实施交通图层之间切换的控制
          //         "AMap.PolyEditor", //编辑 折线多，边形
          //         "AMap.CircleEditor", //圆形编辑器插件
          //         "AMap.Geolocation" //定位控件，用来获取和展示用户主机所在的经纬度位置
          //     ],
          //     v: '1.4.4',
          //     uiVersion: "1.0"
          // })
          // // 申请的Web端（JS API）的需要写上下面这段话
          // window._AMapSecurityConfig = {
          //   securityJsCode: field.Config.MapSecret || self.SysConfig.AMapSecret || '0624622804551e8f0209117bb8de8f82',
          // }
        }
        //2020-12-25新增，地图点、地图区域 字段将存储JSON（包含名称、缩放、中心点等）
        self.$set(
          self.FormDiyTableModel,
          field.Name,
          self.GetFormDataJsonValue(field, formData, false)
        ); // ''

        self.$nextTick(function () {
          if (
            self.DiyCommon.IsNull(field.Config.MapCompany) ||
            field.Config.MapCompany == "Baidu"
          ) {
            if (field.Component == "MapArea") {
              //如果有区域数据
              if (
                !self.DiyCommon.IsNull(formData) &&
                !self.DiyCommon.IsNull(formData[field.Name])
              ) {
                try {
                  // field.BaiduMapConfig.Polyline.Paths = JSON.parse(formData[field.Name].Paths);
                  field.BaiduMapConfig.Polyline.Paths =
                    self.FormDiyTableModel[field.Name].Paths;
                } catch (error) {
                  console.log(error);
                }
              }
            } else if (field.Component == "Map") {
              //如果有点数据
              if (
                !self.DiyCommon.IsNull(formData) &&
                !self.DiyCommon.IsNull(formData[field.Name + "_Lng"])
              ) {
                self.$set(
                  self.FormDiyTableModel,
                  field.Name + "_Lng",
                  formData[field.Name + "_Lng"]
                );
                self.$set(
                  self.FormDiyTableModel,
                  field.Name + "_Lat",
                  formData[field.Name + "_Lat"]
                );
                // self.EventMarker('您选择了这里', '', formData[field.Name + '_Lng'], formData[field.Name + '_Lat'], field)
                self.BaiduMapMakerCenter(
                  {
                    lng: formData[field.Name + "_Lng"] || 0,
                    lat: formData[field.Name + "_Lat"] || 0,
                  },
                  field
                );
              } else {
                field.BaiduMapConfig.SelectMarker = null;
                field.BaiduMapConfig.Center = self.BaiduMapDefaultCenter;
              }
            }
          } else {
            if (
              !self.DiyCommon.IsNull(formData) &&
              !self.DiyCommon.IsNull(formData[field.Name + "_Lng"])
            ) {
              self.EventMarker(
                "您选择了这里",
                "",
                formData[field.Name + "_Lng"] || 0,
                formData[field.Name + "_Lat"] || 0,
                field
              );
            } else {
              field.AmapConfig.SelectMarker = null;
              field.AmapConfig.Center = self.AmapDefaultCenter;
            }
          }
        });
      } else {
        self.$set(
          self.FormDiyTableModel,
          field.Name,
          self.DiyCommon.IsNull(formData) ||
            self.DiyCommon.IsNull(formData[field.Name])
            ? ""
            : formData[field.Name]
        ); // ''
      }
    },
    GetFormDataJsonValue(field, formData, isArray) {
      var self = this;
      if (
        self.DiyCommon.IsNull(formData) ||
        self.DiyCommon.IsNull(formData[field.Name])
      ) {
        if (isArray) {
          return [];
        }
        return {};
      } else {
        //2022-08-18修改判断
        // if (typeof (formData[field.Name]) === 'string') {
        if (typeof formData[field.Name] != "object") {
          //2020-11-05 现在不再判断 SelectSaveField 了，因为存储的数据一般都是正确的
          //2020-11-09 存在的数据不一定是正确的，因为Seelct有可能只存字段
          try {
            //2021-01-02发现问题，这里如果存的是一串数字 ，JSON.parse()不会报错
            //2022-08-18发现问题，这里如果存的是一串数字型的字符串 ，JSON.parse()也不会报错
            var result = JSON.parse(formData[field.Name]);
            if (isArray) {
              if (Array.isArray(result)) {
                if (field.Component == "Checkbox") {
                  //因为Checkbox里面只可能存string值，所以这里把垃圾数据删除掉
                  var tempResult = [];
                  result.forEach((element) => {
                    if (typeof element == "string") {
                      tempResult.push(element);
                    }
                  });
                  return tempResult;
                } else {
                  return result;
                }
              }
              return [];
            } else {
              //不是数组
              //2021-01-02发现问题，这里如果存的是一串数字 ，JSON.parse()不会报错
              if (typeof result == "object" && !Array.isArray(result)) {
                return result;
              } else if (typeof result == "number") {
                if (
                  field.Component == "Select" ||
                  (field.Component == "SelectTree" && //2022-07-01
                    (!self.DiyCommon.IsNull(field.Config.SelectSaveField) ||
                      !self.DiyCommon.IsNull(field.Config.SelectLabel)))
                ) {
                  var resultObj = {};
                  //2022-05-20：显示字段同、存储字段都需要这个值
                  if (!self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                    resultObj[field.Config.SelectSaveField] =
                      formData[field.Name];
                  }
                  if (!self.DiyCommon.IsNull(field.Config.SelectLabel)) {
                    resultObj[field.Config.SelectLabel] = formData[field.Name];
                  }
                  // resultObj[!self.DiyCommon.IsNull(field.Config.SelectSaveField) ? field.Config.SelectSaveField : field.Config.SelectLabel] = formData[field.Name];
                  return resultObj;
                } else {
                  if (isArray) {
                    return [];
                  } else {
                    return {};
                  }
                }
              }
              return {};
            }
          } catch (error) {
            //如果JSON.parse报错，那么说明这个字段存的并不是json
            //2020-11-09 存在的数据不一定是正确的，因为Select有可能只存字段
            if (
              field.Component == "Select" ||
              (field.Component == "SelectTree" && //2022-07-01
                !isArray &&
                (!self.DiyCommon.IsNull(field.Config.SelectSaveField) ||
                  !self.DiyCommon.IsNull(field.Config.SelectLabel)))
            ) {
              var resultObj = {};
              //2022-05-20：显示字段同、存储字段都需要这个值
              if (!self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                resultObj[field.Config.SelectSaveField] = formData[field.Name];
              }
              if (!self.DiyCommon.IsNull(field.Config.SelectLabel)) {
                resultObj[field.Config.SelectLabel] = formData[field.Name];
              }
              // resultObj[!self.DiyCommon.IsNull(field.Config.SelectSaveField) ? field.Config.SelectSaveField : field.Config.SelectLabel] = formData[field.Name];
              return resultObj;
            } else {
              if (isArray) {
                return [];
              } else {
                return {};
              }
            }
          }
          //这里转换有可能会出错，比如修改了控件类型，所以要加try
          // try {
          //     //注意：2020-10-30 如果指定了SelectSaveField，这里需要返回{}
          //     //注意：上面逻辑可能是错的，这里要返回{}还是[]，以isArray为准
          //     if (!self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
          //         if(isArray){
          //             var resultObj = {};
          //             resultObj[field.Config.SelectSaveField] = formData[field.Name];
          //             //类似这样的注释 ，后期需要处理，修改了字段控件类型，需要保留以前存的值
          //             // return [resultObj];
          //             return [];
          //         }else{
          //             if(typeof(resultObj) != 'object'){
          //                 return {};
          //             }
          //             return resultObj;
          //         }
          //     }else{
          //         var result = JSON.parse(formData[field.Name])
          //         if(isArray){
          //             if(Array.isArray(result)){
          //                 return result;
          //             }
          //             // return [result];
          //             return [];
          //         }else{
          //             if(typeof(result) != 'object'){
          //                 return {};
          //             }
          //             return result;
          //         }
          //     }
          // } catch (error) {
          //     var result = formData[field.Name]
          //     if(isArray){
          //         if(Array.isArray(result)){
          //             return result;
          //         }
          //         // return [result];
          //         return [];
          //     }else{
          //         if(typeof(result) != 'object'){
          //             return {};
          //         }
          //         return result;
          //     }
          // }
        } else {
          var result = formData[field.Name];
          if (isArray) {
            if (Array.isArray(result)) {
              return result;
            }
            // return [result];
            return [];
          } else {
            if (typeof result != "object" || Array.isArray(result)) {
              return {};
            }
            return result;
          }
        }
      }
    },

    AddDiyFieldArr(field) {
      var self = this;
      self.DiyFieldList.push(field);
    },
    UptDiyFieldArr(field) {
      var self = this;
      self.DiyFieldList.forEach((element) => {
        if (element.Id == field.Id) {
          element = field;
        }
      });
    },
    DelDiyFieldArr(field) {
      var self = this;
      var index = 0;
      self.DiyFieldList.forEach((element) => {
        if (element.Id == field.Id) {
          self.DiyFieldList.splice(index, 1);
        }
        index++;
      });
    },
    BeforeFileUpload(file, field) {
      var self = this;
      //新增文件、图片上传前V8事件  --2023-03-24
      if (
        field.Config &&
        field.Config.Upload &&
        field.Config.Upload.BeforeUploadV8
      ) {
        var v8 = self.RunV8CodeSync(
          field,
          file,
          "",
          field.Config.Upload.BeforeUploadV8
        );
        if (v8.Result === false) {
          return false;
        }
      }

      //如果是单文件上传
      if (field.Config.FileUpload.Multiple !== true) {
        // self.FormDiyTableModel[field.Name] = '正在上传中...';//注意此值不能随意修改，有很多地方直接用此值做判断
        self.$set(self.FormDiyTableModel, field.Name, "正在上传中...");
      } else {
        //name,size
        if (!Array.isArray(self.FormDiyTableModel[field.Name])) {
          // self.FormDiyTableModel[field.Name] = [];
          self.$set(self.FormDiyTableModel, field.Name, []);
        }
        self.FormDiyTableModel[field.Name].push({
          Id: file.uid,
          State: 0, //等待上传
          Name: file.name,
          // Size : self.DosCommon.GetFileSize(file.size)
          Size: file.size,
        });
      }
    },
    FileUploadRemove(file, fileList, field) {
      var self = this;
      //如果是单文件，需要修改值
      if (field.Config.FileUpload.Multiple !== true) {
        // self.FormDiyTableModel[field.Name] = '';
        self.$set(self.FormDiyTableModel, field.Name, "");
      }
      if (Array.isArray(self.FormDiyTableModel[field.Name])) {
        self.FormDiyTableModel[field.Name].forEach((element, index) => {
          if (element.Id == file.response.Data.Id) {
            self.FormDiyTableModel[field.Name].splice(index, 1);
          }
        });
      }
    },
    FileUploadSuccess(result, file, fileList, field) {
      var self = this;
      if (self.DiyCommon.Result(result)) {
        //注意：多文件上传，也是按单个文件上传成功触发此事件
        if (field.Config.FileUpload.Multiple == true) {
          var filesJson = self.FormDiyTableModel[field.Name];
          if (self.DiyCommon.IsNull(filesJson)) {
            filesJson = [];
          }
          //注意，这里不能直接push，需要判断是否已存在FileId
          var isHave = false;
          filesJson.forEach((element) => {
            if (element.Id == file.uid) {
              element.Size = file.response.Data.Size;
              element.CreateTime = file.response.Data.CreateTime;
              element.Path = file.response.Data.Path;
              element.State = 1;
              isHave = true;
            }
          });
          if (!isHave) {
            filesJson.push(file.response.Data);
          }
          self.$set(self.FormDiyTableModel, field.Name, filesJson);
        } else {
          self.$set(self.FormDiyTableModel, field.Name, result.Data.Path);
          //注意：这里顺便把 如果带权限的oss设置下？
          self.GetUploadPath(field);
        }
        self.DiyCommon.Tips(self.$t("Msg.UploadSuccess"));
        //如果文件全部上传成功了，就清空掉
        if (
          _.where(fileList, { status: "success" }).length == fileList.length
        ) {
          self.$refs[field.Component + "_" + field.Name][0].clearFiles();
        }
        //文件、图片上传成功后新增V8代码触发  --2022-12-15
        self.RunV8Code(field);
      }
    },
    ImgUploadRemove(file, fileList, field) {
      var self = this;
      //如果是单文件，需要修改值
      if (field.Config.ImgUpload.Multiple !== true) {
        // self.FormDiyTableModel[field.Name] = '';
        self.$set(self.FormDiyTableModel, field.Name, "");
      }
      if (Array.isArray(self.FormDiyTableModel[field.Name])) {
        self.FormDiyTableModel[field.Name].forEach((element, index) => {
          if (element.Id == file.response.Data.Id) {
            self.FormDiyTableModel[field.Name].splice(index, 1);
          }
        });
      }
    },
    UploadImgBefore(file, field) {
      var self = this;

      const isJPG =
        file.type === "image/jpeg" ||
        file.type === "image/png" ||
        file.type === "image/bmp" ||
        file.type === "image/svg" ||
        file.type.toLowerCase().indexOf("icon") > -1 ||
        file.type.toLowerCase().indexOf("ico") > -1 ||
        file.type === "image/gif";

      const isLtMax =
        file.size / 1024 / 1024 <
        (!self.DiyCommon.IsNull(field.Config.ImgUpload.MaxSize)
          ? field.Config.ImgUpload.MaxSize
          : self.DiyCommon.UploadImgMaxSize);
      if (!isJPG) {
        self.DiyCommon.Tips(self.$t("Msg.FormatError") + file.type, false);
        return false;
      }
      if (!isLtMax) {
        self.DiyCommon.Tips(
          self.$t("Msg.MaxSize") +
            (!self.DiyCommon.IsNull(field.Config.ImgUpload.MaxSize)
              ? field.Config.ImgUpload.MaxSize
              : self.DiyCommon.UploadImgMaxSize) +
            "MB!",
          false
        );
        return false;
      }

      //新增文件、图片上传前V8事件  --2023-03-24
      if (
        field.Config &&
        field.Config.Upload &&
        field.Config.Upload.BeforeUploadV8
      ) {
        var v8 = self.RunV8CodeSync(
          field,
          file,
          "",
          field.Config.Upload.BeforeUploadV8
        );
        if (v8.Result === false) {
          return false;
        }
      }

      self.DiyCommon.Tips(self.$t("Msg.Uploading"));
      var result = isJPG && isLtMax;
      if (result) {
        // field.Config.ImgUpload.ShowFileList = true;
        //如果是单图片
        if (field.Config.ImgUpload.Multiple !== true) {
          // self.FormDiyTableModel[field.Name] = './static/img/loading.gif';//注意此值不能随意修改，有很多地方直接用此值做判断
          self.$set(
            self.FormDiyTableModel,
            field.Name,
            "./static/img/loading.gif"
          );
        } else {
          //name,size
          if (!Array.isArray(self.FormDiyTableModel[field.Name])) {
            // self.FormDiyTableModel[field.Name] = [];
            self.$set(self.FormDiyTableModel, field.Name, []);
          }
          self.FormDiyTableModel[field.Name].push({
            Id: file.uid,
            State: 0, //等待上传
            Name: file.name,
            // Size : self.DosCommon.GetFileSize(file.size),
            Size: file.size,
            Path: "./static/img/loading.gif", //注意此值不能随意修改，有很多地方直接用此值做判断
          });
        }
      }
      return result;
    },
    ImgUploadSuccess(result, file, fileList, field) {
      var self = this;
      if (self.DiyCommon.Result(result)) {
        if (field.Config.ImgUpload.Multiple == true) {
          var filesJson = self.FormDiyTableModel[field.Name];
          if (self.DiyCommon.IsNull(filesJson)) {
            filesJson = [];
          }
          //注意，这里不能直接push，需要判断是否已存在FileId
          var isHave = false;
          filesJson.forEach((element) => {
            if (element.Id == file.uid) {
              element.Size = file.response.Data.Size;
              element.CreateTime = file.response.Data.CreateTime;
              element.Path = file.response.Data.Path;
              element.State = 1;
              isHave = true;
            }
          });
          if (!isHave) {
            filesJson.push(file.response.Data);
          }
          self.$set(self.FormDiyTableModel, field.Name, filesJson);
        } else {
          self.$set(self.FormDiyTableModel, field.Name, result.Data.Path);
        }
        self.DiyCommon.Tips(self.$t("Msg.UploadSuccess"));
        //如果文件全部上传成功了，就清空掉
        if (
          _.where(fileList, { status: "success" }).length == fileList.length
        ) {
          self.$refs[field.Component + "_" + field.Name][0].clearFiles();
        }
        //文件、图片上传新增触发V8事件  --2022-12-15
        self.RunV8Code(field);
      }
    },
    GetFieldLabel(field) {
      var self = this;
      if (field.Component == "DevComponent") {
        return "";
      }
      return field.Label;
    },
    GetFieldReadOnly(field) {
      var self = this;
      //如果按钮设置了预览可点击
      //并且按钮Readonly属性不为true，
      //并且ReadonlyFields不包含此字段
      //则返回false(不禁用)
      if (
        field.Component == "Button" &&
        field.Config.Button &&
        field.Config.Button.PreviewCanClick === true &&
        !field.Readonly &&
        !(self.ReadonlyFields.indexOf(field.Name) > -1)
      ) {
        return false;
      }

      if (self.FormMode == "View") {
        return true;
      }
      if (self.ReadonlyFields.indexOf(field.Name) > -1) {
        return true;
      }
      if (self.NotSaveField) {
        for (let index = 0; index < self.NotSaveField.length; index++) {
          const element = self.NotSaveField[index];
          if (element.toLowerCase() == field.Name.toLowerCase()) {
            return true;
          }
        }
      }
      // return field.Readonly ? true : false;
      return field.Readonly ? true : false;
    },

    /*
            必传4个参数：
            FormMode:Add、Edit
            TableRowId://2020-10-15改成可以为空
            SaveLoading:按钮loading中， //可选参数
            注意：上面3个值需要在调用者回调函数处，重新为调用者变量赋值，操作成功后才会执行callback

            SavedType：保存后的操作：Insert、Update、View //可选参数
        */
    async FormSubmit(formParam, callback) {
      //param
      var self = this;
      formParam.SaveLoading = true;

      //2022-03-18 二次开发也可以不用传入FormMode，这时候直接取当前的全局变量FormMode
      if (self.DiyCommon.IsNull(formParam.FormMode)) {
        formParam.FormMode = self.FormMode;
      }

      if (self.DiyCommon.IsNull(formParam.TableRowId)) {
        if (self.DiyCommon.IsNull(self.TableRowId)) {
          if (formParam.FormMode == "Edit" || formParam.FormMode == "View") {
            self.DiyCommon.Tips("编辑模式下未获取到Id，无法提交！");
            if (callback) {
              callback(false);
            }
            return;
          }
          await self.DiyCommon.PostAsync(
            "/api/diytable/NewGuid",
            {},
            function (result) {
              if (self.DiyCommon.Result(result)) {
                formParam.TableRowId = result.Data;
                self.$nextTick(async function () {
                  await self.FormSubmitFuncton(formParam, callback);
                });
              } else {
                self.SaveLoading = false;
              }
            }
          );
        } else {
          formParam.TableRowId = self.TableRowId;
          await self.FormSubmitFuncton(formParam, callback);
        }
      } else {
        await self.FormSubmitFuncton(formParam, callback);
      }
    },
    //FormSubmit的v2版本
    async SaveForm(callback) {
      var self = this;
      //如果Id为空，要处理编辑模式和新增模式的特殊情况
      if (self.DiyCommon.IsNull(self.TableRowId)) {
        //如果是编辑模式
        if (self.FormMode == "Edit") {
          self.DiyCommon.Tips("编辑模式下未获取到Id，无法提交！");
          if (callback) {
            callback({ Code: 0, Msg: "编辑模式下未获取到Id，无法提交！" });
          }
          return;
        }
        //如果是新增模式，按理说外部要传入NewGuid，但是为了外部使用方便，这里自动生成，问题来了，你又不能在子组件里面修改props的值？
        await self.DiyCommon.PostAsync(
          "/api/diytable/NewGuid",
          {},
          function (result) {
            if (self.DiyCommon.Result(result)) {
              formParam.TableRowId = result.Data;
              self.$nextTick(async function () {
                await self.FormSubmitFuncton(formParam, callback);
              });
            } else {
              callback({ Code: 0, Msg: result.Msg });
            }
          }
        );
      } else {
        formParam.TableRowId = self.TableRowId;
        await self.FormSubmitFuncton(formParam, callback);
      }
    },
    async FormSubmitFuncton(formParam, callback) {
      var self = this;
      var actionType = "";
      if (formParam.FormMode == "Edit" || formParam.FormMode == "View") {
        actionType = "Update";
      } else if (
        formParam.FormMode == "Add" ||
        formParam.FormMode == "Insert"
      ) {
        actionType = "Insert";
      }

      //2023-08-08改到表单必填验证之后执行
      // var v8Result = await self.FormSubmitAction(actionType, formParam.TableRowId);
      // if (v8Result === false) {
      //     formParam.SaveLoading = false
      //     callback(false);
      //     return;
      // }

      try {
        var param = {};
        var url = self.DiyApi.AddDiyTableRow;

        if (!self.DiyCommon.IsNull(self.DiyTableModel.ApiReplace.Insert)) {
          url = self.DiyTableModel.ApiReplace.Insert;
        }
        if (!self.DiyCommon.IsNull(self.ApiReplace.AddDiyTableRow)) {
          url = self.ApiReplace.AddDiyTableRow;
        }
        //这里改为这个判断 ，是因为新增数据，也可能会提前生成TableRowId，以方便新增主表时可以操作子表的增加
        if (formParam.FormMode == "Edit" || formParam.FormMode == "View") {
          //!self.DiyCommon.IsNull(self.TableRowId)
          url = self.DiyApi.UptDiyTableRow;
          // param._TableRowId = self.TableRowId
          if (!self.DiyCommon.IsNull(self.DiyTableModel.ApiReplace.Update)) {
            url = self.DiyTableModel.ApiReplace.Update;
          }
          if (!self.DiyCommon.IsNull(self.ApiReplace.UptDiyTableRow)) {
            url = self.ApiReplace.UptDiyTableRow;
          }
          if (self.ApiReplace && self.ApiReplace.Update) {
            url = self.ApiReplace.Update;
          }
        }

        if (self.ApiReplace && self.ApiReplace.Submit) {
          url = self.ApiReplace.Submit;
        }

        if (!self.DiyCommon.IsNull(formParam.SubmitUrl)) {
          url = formParam.SubmitUrl;
        }

        //这里拿出来赋值 ，是因为新增数据，也可能会提前生成TableRowId，以方便新增主表时可以操作子表的增加
        // param._TableRowId = self.TableRowId;
        param.Id = self.TableRowId;
        // if (self.DiyCommon.IsNull(param._TableRowId)) {
        if (self.DiyCommon.IsNull(param.Id)) {
          // param._TableRowId = formParam.TableRowId;
          param.Id = formParam.TableRowId;
        }

        //2022-04-09 改为表名和Id都传
        //2023-05-19 改为不要都传，不好看
        // param.TableId = self.TableId
        // param.TableName = self.TableName
        // param.TableName = self.DiyTableModel.Name;
        param.FormEngineKey = self.DiyTableModel.Name;

        // param.OsClient = self.OsClient
        // param._FormData = JSON.stringify(self.$refs.fieldForm.FormDiyTableModel);

        // 2020-06-15：注意：如果Select是绑定的object，这里不能全部object传上去，只传入Id和SelectLbel即可
        // var formDiyTableModel = {
        //     ...self.$refs.fieldForm.FormDiyTableModel
        // }
        self.GetFormDataAndCheck(async function (formData) {
          if (self.DiyCommon.IsNull(formData)) {
            formParam.SaveLoading = false;
            callback(false);
            return;
          }
          var v8Result = await self.FormSubmitAction(
            actionType,
            formParam.TableRowId
          );
          if (v8Result === false) {
            formParam.SaveLoading = false;
            callback(false);
            return;
          }

          var formDiyTableModel = formData;

          self.DiyCommon.ForRowModelHandler(
            formDiyTableModel,
            self.DiyFieldList
          );

          //DIY架构修改，_RowModel不再传入string，而是{}
          // param._FormData = JSON.stringify(formDiyTableModel)
          param._FormData = self.DiyCommon.ConvertRowModel(formDiyTableModel);

          for (let key in param._FormData) {
            if (key.endsWith("_RealPath") || key.endsWith("_TmpEngineResult")) {
              delete param._FormData[key];
            }
          }

          //2023-10-18数据日志
          if (self.DiyTableModel.EnableDataLog) {
            var dataLog = [];
            for (let key in param._FormData) {
              if (
                param._FormData[key] != self.OldFormData[key] &&
                !key.endsWith("_RealPath") &&
                !key.endsWith("_TmpEngineResult")
              ) {
                if (
                  param._FormData[key] != undefined &&
                  self.OldFormData[key] != undefined
                ) {
                  var fieldModel = _.find(self.DiyFieldList, function (item2) {
                    return item2.Name == key;
                  });
                  var label = "";
                  if (!fieldModel) {
                    fieldModel = {};
                  }
                  dataLog.push({
                    Name: key,
                    Label: fieldModel.Label || key,
                    Component: fieldModel.Component,
                    OVal: self.OldFormData[key] || "", //老值
                    NVal: param._FormData[key] || "", //新值
                  });
                }
              }
            }
            param._DataLog = JSON.stringify(dataLog);
          }

          if (self.NotSaveField && self.NotSaveField.length > 0) {
            param._NotSaveField = self.NotSaveField;
          }
          //2022-02-12新增：主表提交前，验证下子表有没有必填
          var checkChildTable = await self.CheckChildTable(formParam);
          if (checkChildTable === false) {
            callback(false);
            return;
          }
          //---------
          //2022-09-01 提前定义表单提交执行完后的事件，可能会在事件替换后执行
          async function SubmitCallback(result) {
            formParam.SaveLoading = false;
            if (self.DiyCommon.Result(result)) {
              if (result.Data && result.Data.Id) {
                formData.Id = result.Data.Id;
              }
              //--如果是子表Form提交。并且主表Form是新增状态，那么主表Form需要保存并修改
              //2021-09-06取消新增数据时添加子表数据会自动提交主表
              // self.$emit('CallbackParentFormSubmit', {});
              //请求接口--------start
              try {
                // var rowModelJson = param._FormData;
                var rowModelJson = formDiyTableModel;
                for (const rmFieldName in rowModelJson) {
                  param[rmFieldName] = formDiyTableModel[rmFieldName];
                }
                if (
                  param.FormMode == "Edit" &&
                  !self.DiyCommon.IsNull(self.DiyTableModel.UptCallbakApi)
                ) {
                  //!self.DiyCommon.IsNull(self.TableRowId)
                  param.Id = param._TableRowId;
                  self.DiyCommon.Post(
                    self.DiyTableModel.UptCallbakApi,
                    param,
                    function (apiResult) {
                      if (self.DiyCommon.Result(apiResult)) {
                      }
                    }
                  );
                } else if (
                  (param.FormMode == "Add" || param.FormMode == "Insert") &&
                  !self.DiyCommon.IsNull(self.DiyTableModel.AddCallbakApi)
                ) {
                  //self.DiyCommon.IsNull(self.TableRowId)
                  param.Id = result.Data.Id;
                  self.DiyCommon.Post(
                    self.DiyTableModel.AddCallbakApi,
                    param,
                    function (apiResult) {
                      if (self.DiyCommon.Result(apiResult)) {
                      }
                    }
                  );
                }
              } catch (error) {
                console.log("请求接口 error：");
                console.log(error);
              }

              //--------------end

              self.DiyCommon.Tips(self.$t("Msg.Success"));
              //2021-02-27新增，在下面的事件之前执行表单离开事件，否则取到的数据可能被修改掉，如Id
              var outFormV8Result = await self.FormOutAction(
                actionType,
                formParam.SavedType,
                formParam.TableRowId,
                formParam.V8Callback
              );

              // if (self.FormMode == 'Edit') {//!self.DiyCommon.IsNull(self.TableRowId)
              //     self.CloseFieldForm(null, 'Update', self.TableRowId);
              // }else{
              //     self.CloseFieldForm(null, 'Insert',self.TableRowId);
              // }
              // if (param.IsClose === true) {
              //     // self.ShowFieldForm = false
              //     // self.ShowFieldFormDrawer = false
              // }else{
              if (
                formParam.SavedType == "Insert" ||
                formParam.SavedType == "Add"
              ) {
                formParam.TableRowId = "";
                formParam.FormMode = "Add";
                self.DiyCommon.Post(
                  "/api/diytable/NewGuid",
                  {},
                  async function (result) {
                    if (self.DiyCommon.Result(result)) {
                      formParam.TableRowId = result.Data;
                      // self.FormOutAction(formParam.SavedType, formParam.TableRowId, formParam.V8Callback);
                      //不能在这里执行，应该是在保存并新增之类的之前执行
                      // self.FormOutAction(actionType, formParam.TableRowId, formParam.V8Callback);
                      //提交子表，子表提交
                      await self.SubmitChildTable(formParam);
                      callback(true, formData, outFormV8Result);
                      self.$nextTick(function () {
                        // self.OpenDetailHandler(tableRowModel, formMode);
                        self.Init(true);
                      });
                    }
                  }
                );
              } else {
                //这里要重新加载Field-Form
                //不但要修改Field-Form绑定的那些值
                //还要把自身的Prop值也修改了？
                if (
                  !self.DiyCommon.IsNull(result.Data) &&
                  !self.DiyCommon.IsNull(result.Data.Id)
                ) {
                  formParam.TableRowId = result.Data.Id;
                  if (formParam.SavedType == "View") {
                    formParam.FormMode = "View";
                  } else {
                    formParam.FormMode = "Edit";
                  }
                }
                if (formParam.SavedType == "View") {
                  formParam.FormMode = "View";
                }
                // self.FormOutAction(formParam.SavedType, formParam.TableRowId, formParam.V8Callback);
                //不能在这里执行，应该是在保存并新增之类的之前执行
                // self.FormOutAction(actionType, formParam.TableRowId, formParam.V8Callback);
                //提交子表，子表提交
                await self.SubmitChildTable(formParam);
                callback(true, formData, outFormV8Result);
                self.$nextTick(function () {
                  self.Init(true);
                });
              }
              // }
              // self.GetDiyTableRow()
            } else {
              callback(false);
            }
          }
          if (self.EventReplace && self.EventReplace.Submit) {
            let V8 = {
              EventName: "FormSubmitBefore",
            };
            self.SetV8DefaultValue(V8);
            await self.DiyCommon.InitV8Code(V8, self.$router);
            //传入V8、Param、callback,  必须执行SubmitCallback(DosResult)
            let result = self.EventReplace.Submit(V8, param, SubmitCallback);
          } else {
            self.DiyCommon.Post(
              url,
              param,
              async function (result) {
                SubmitCallback(result);
              },
              function (error) {
                formParam.SaveLoading = false;
                callback(false);
              }
            );
          }
        });
      } catch (error) {
        formParam.SaveLoading = false;
        console.log(error);
      }
    },
    //2022-04-09 虽然这是提交子表，但是提交关联表单的逻辑也写到这里面
    async SubmitChildTable(formParam) {
      var self = this;
      try {
        var needSaveRowLis = [];
        //判断是否有子表待提交。 2021-01-06注意：要主表通过验证了，再提交子表的，否则子表会重复，也就是应该先提交主表，再提交子表
        // needSaveRowLis = self.$refs.fieldForm.GetNeedSaveRowList();
        needSaveRowLis = self.GetNeedSaveRowList();
        if (needSaveRowLis && needSaveRowLis.length > 0) {
          //needSaveRowLis.Rows && needSaveRowLis.Rows.length > 0
          var batchAddParams = [];
          var needSubmit = false;
          needSaveRowLis.forEach((element) => {
            if (element.Rows.length == 0) {
              return;
            }
            element.Rows.forEach((row) => {
              //这里要调用这2个函数处理下，比如下拉框是只存储字段
              var rowModel = { ...row };
              if (
                self.$refs["refTableChild_" + element.FieldName] &&
                self.$refs["refTableChild_" + element.FieldName].length > 0
              ) {
                //注意：这里是传子表的DiyFieldList，而不是主表的
                var diyFieldList =
                  self.$refs["refTableChild_" + element.FieldName][0]
                    .DiyFieldList;
                self.DiyCommon.ForRowModelHandler(rowModel, diyFieldList);
                rowModel = self.DiyCommon.ConvertRowModel(rowModel);
                batchAddParams.push({
                  TableId: element.TableId,
                  TableName: element.TableName,
                  _FormData: rowModel,
                });
              }
            });
          });
          if (batchAddParams.length > 0) {
            var result = await self.DiyCommon.PostAsync(
              self.DiyApi.AddDiyTableRowBatch,
              { _List: batchAddParams }
            );
            if (!self.DiyCommon.Result(result)) {
              // self.BtnLoading = false;
              formParam.SaveLoading = false;
              return;
            } else {
              //2022-04-11 表内编辑提交后，需要将_IsInTableAdd置空
              self.ClearNeedSaveRowList();
            }
          }
        }
        //关联表单提交
        self.GetNeedSaveJoinFormList();
      } catch (error) {
        // self.BtnLoading = false;
        formParam.SaveLoading = false;
        throw error;
        return;
      }
    },
    async CheckChildTable(formParam) {
      var self = this;
      try {
        var checkResult = true;
        var needSaveRowLis = [];
        //判断是否有子表待提交。 2021-01-06注意：要主表通过验证了，再提交子表的，否则子表会重复，也就是应该先提交主表，再提交子表
        // needSaveRowLis = self.$refs.fieldForm.GetNeedSaveRowList();
        needSaveRowLis = self.GetNeedSaveRowList();
        if (needSaveRowLis && needSaveRowLis.length > 0) {
          //needSaveRowLis.Rows && needSaveRowLis.Rows.length > 0
          var batchAddParams = [];
          var needSubmit = false;
          needSaveRowLis.forEach((element) => {
            if (element.Rows.length == 0) {
              return;
            }
            element.Rows.forEach((row) => {
              //这里要调用这2个函数处理下，比如下拉框是只存储字段
              var rowModel = { ...row };
              if (
                self.$refs["refTableChild_" + element.FieldName] &&
                self.$refs["refTableChild_" + element.FieldName].length > 0
              ) {
                //注意：这里是传子表的DiyFieldList，而不是主表的
                var diyFieldList =
                  self.$refs["refTableChild_" + element.FieldName][0]
                    .DiyFieldList;

                //只取当前这个子表的所有字段。--2025-02-18 --by Anderson
                var childTableId =
                  self.$refs["refTableChild_" + element.FieldName][0].TableId;
                if (childTableId) {
                  diyFieldList = diyFieldList.filter(
                    (item) => item.TableId == childTableId
                  );
                }

                //---check
                var checkForm = true;
                var checkFailField = {};
                diyFieldList.forEach((field) => {
                  //再手动判断一下必填等验证
                  if (
                    !self.DiyCommon.IsNull(field.NotEmpty) &&
                    field.NotEmpty &&
                    field.Visible &&
                    (self.DiyCommon.IsNull(rowModel[field.Name]) ||
                      (typeof rowModel[field.Name] == "object" &&
                        (JSON.stringify(rowModel[field.Name]) == "{}" ||
                          JSON.stringify(rowModel[field.Name]) == "[]"))) &&
                    // && (
                    //         self.ShowFields.length == 0
                    //         || (self.ShowFields.length > 0 && self.ShowFields.indexOf(field.Name) > -1)  // _.where(self.ShowFields, { Id: field.Id}).length > 0
                    //     )
                    // && self.HideFields.indexOf(field.Name) == -1
                    field.Component !== "DevComponent" &&
                    field.Component !== "TableChild" &&
                    field.Component !== "Button" &&
                    field.Component !== "Button"
                    // && !self.DiyCommon.IsNull(field.FieldType)
                  ) {
                    checkFailField = field;
                    checkForm = false;
                  }
                });
                if (!checkForm) {
                  debugger;
                  self.DiyCommon.Tips(
                    "请检查必填项：[" + checkFailField.Label + "]！",
                    false
                  );
                  checkResult = false;
                  // callback();
                }
                //---check  end

                self.DiyCommon.ForRowModelHandler(rowModel, diyFieldList);
                rowModel = self.DiyCommon.ConvertRowModel(rowModel);
                batchAddParams.push({
                  TableId: element.TableId,
                  TableName: element.TableName,
                  _FormData: rowModel,
                });
              }
            });
          });
          // if(batchAddParams.length > 0){
          //     var result = await self.DiyCommon.PostAsync(DiyApi.AddDiyTableRowBatch, { _List : batchAddParams });
          //     if (!self.DiyCommon.Result(result)) {
          //         // self.BtnLoading = false;
          //         formParam.SaveLoading = false;
          //         return;
          //     }
          // }
        }
        if (!checkResult) {
          return false;
        }
        return true;
      } catch (error) {
        // self.BtnLoading = false;
        formParam.SaveLoading = false;
        throw error;
        return false;
      }
    },
    CallbackParentFormSubmit(param) {
      var self = this;
      if (self.FormMode == "Add" || self.FormMode == "Insert") {
        //CloseForm:true, SavedType:'Insert/Update/View'
        self.V8FormSubmit({
          CloseForm: false,
          SavedType: "Update",
        });
      }
    },
    UpdateModifiedFields(fieldName) {
      var self = this;
      if (!(self.ModifiedFields.indexOf() > -1)) {
        self.ModifiedFields.push(fieldName);
      }
    },
    CallbackFormValueChange(field, thisValue) {
      var self = this;
      self.UpdateModifiedFields(field.Name);
      self.$emit("CallbackFormValueChange", field, thisValue);
    },
    //系统设置加了判断，如果是在线访问文档，则打开界面引擎2025-5-4刘诚
    GoUrl(url) {
      var self = this;
      if (self.SysConfig && self.SysConfig.Is_online_office === 1) {
        console.log("filePath", url);
        console.log("filePath", encodeURIComponent(url));
        self.$router.push(`/online-office?filePath=` + encodeURIComponent(url));
        self.$emit("CallbackFormClose");
      } else {
        window.open(url, "_blank");
      }
    },

    //2025-02-12
    async handleQrCodeImageBase64(data) {
      this.qrCodeImageBase64 = data;
      await this.$nextTick(); // 确保 Vue 响应式数据更新
    },
    async ComponentQrcodeButtonClick(field, action) {
      await this.$nextTick(); // 等待 `handleQrCodeImageBase64` 赋值完成
      field.DataAppend.qrCodeImageBase64 = this.qrCodeImageBase64;
      this.RunV8Code(field);
    },
  },
};
</script>

<style lang="scss">
.not-field {
  text-align: center;
  position: absolute;
  top: 50%;
  left: calc(50% - 100px);
}

.itdos-diy-form {
  .el-form-item__label {
    // margin-bottom: 9px;
    margin-bottom: 5px;
  }

  // .field_Text
  // ,.field_NumberText
  // ,.field_DateTime
  // ,.field_Select
  // ,.field_Guid
  // ,.field_Button
  // ,.field_AutoNumber
  .container-form-item {
    .el-form-item--mini .el-form-item__content,
    .el-form-item--mini .el-form-item__label {
      height: 28px;
    }
  }

  //之所以所有的控件设置了固定的高度是防止排版错位，但是有些控制又要高度自动
  .field_Textarea,
  .field_Department,
  .field_ImgUpload,
  .field_FileUpload,
  .field_RichText,
  .field_TableChild,
  .field_CodeEditor,
  .field_Map,
  .field_DevComponent,
  ,
  .field_JoinForm,
  .field_Checkbox,
  .field_MapArea,
  .field_Qrcode {
    .el-form-item--mini .el-form-item__content,
    .el-form-item--mini .el-form-item__label {
      height: auto;
    }
  }

  .el-input__inner,
  .el-textarea__inner {
    font-size: 13px !important;
  }

  .el-textarea__inner {
    padding-top: 4px !important;
  }

  .el-form.el-form--label-top {
    .el-form-item__label {
      padding-bottom: 0px;
      margin-bottom: 0px;
    }
  }

  .field-form.field-border {
    //输入框全部默认边框
    .el-input__inner,
    .el-form .el-input__inner,
    .el-form .el-textarea__inner,
    .form-control {
      border: 1px solid #dcdfe6 !important;
      // border-bottom: unset !important;
      border-bottom: 1px solid #dcdfe6 !important;
      border-radius: 4px !important;
      padding-left: unset !important;
      background-color: #fff;
      box-shadow: none;
      font-size: 13px;
    }

    .el-input__inner:focus,
    .el-form .el-input__inner:focus,
    .el-form .el-textarea__inner:focus {
      // border-bottom: unset !important;
      border-bottom: 1px solid #dcdfe6 !important;
    }

    .el-input.el-date-editor {
      .el-input__inner {
        padding-left: 28px !important;
      }

      .el-input__prefix {
        left: 0px;

        .el-input__icon {
          text-align: left;
        }
      }
    }
  }
}

.el-image-viewer__wrapper {
  z-index: 2500 !important;

  .el-image-viewer__close {
    .el-icon-circle-close {
      color: #fff;
    }
  }
}

.itdos-diy-form {
  height: 100%;
  min-height: 200px;

  .imgupload-imgs {
    .time {
      font-size: 13px;
      color: #999;
    }

    .bottom {
      margin-top: 13px;
      line-height: 15px;
    }

    .button {
      padding: 0;
      float: right;
    }

    .image {
      width: 100%;
      display: block;
    }

    .clearfix:before,
    .clearfix:after {
      display: table;
      content: "";
    }

    .clearfix:after {
      clear: both;
    }
  }

  .fileupload-file-item {
    line-height: 20px;

    .fileupload-a {
      font-size: 12px;
    }
  }

  .fileupload-a {
    font-size: 12px;
    color: #008cd8;
    cursor: pointer;
  }

  .baidu-map-search {
    width: 400px !important;
    background-color: #fff;
    margin: 6px 8px;
    border-radius: 4px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    padding: 0.05rem 0.75rem;

    .el-input__inner {
      border-bottom: none !important;
    }
  }

  .fullscreen-map {
    position: fixed;
    width: 100vw !important;
    height: 100vh !important;
    left: 0;
    top: 0;
    z-index: 1010;
  }

  .bm-view {
    width: 100%;
    height: 300px;
  }

  .map-container {
    position: relative;

    // .tip{
    //     box-shadow: 2px 2px 10px 0px #ccc;
    //     position: absolute;
    //     top: 10px;
    //     right: 10px;
    //     z-index: 99;
    // }
    .search-box {
      position: absolute;
      top: 25px;
      right: 20px;
      z-index: 100;
    }
  }

  .form-amap {
    .map-container {
      width: 100%;
      height: 300px;
    }
  }

  #field-form-tabs {
    // height: 100%;
    // min-height: 100px;
  }

  .field-form-tabs.none {
    .el-tabs__header {
      display: none;
    }
  }

  // .container-form-item {

  //     .el-select.el-select--mini,
  //     .el-date-editor,
  //     .el-autocomplete
  //     ,.el-input-number
  //     ,.el-input-number--mini
  //     ,.el-cascader--mini
  //      {
  //         width: 100%;
  //     }
  //     .el-radio-group{
  //         margin-top:2px;
  //         .el-radio__input{
  //             margin-top: -2px;
  //         }
  //     }
  // }

  .panel-group {
    margin-bottom: 0px;
  }

  .field-form {
    min-height: 300px;

    .el-divider__text {
      font-weight: bold;
    }

    .el-radio {
      line-height: 16px;
    }
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

  @media (max-width: 1024px) {
    .chart-wrapper {
      padding: 8px;
    }
  }
}
</style>
