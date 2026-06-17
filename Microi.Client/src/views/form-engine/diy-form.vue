<template>
    <div :class="rootClass">
        <el-tabs
            id="field-form-tabs"
            v-model="FieldActiveTab"
            :tab-position="GetTabsPosition()"
            :class="tabsClass"
            @tab-click="tabClickField"
        >
            <template v-for="(tab, tabIndex) in FormTabs">
                <el-tab-pane :key="'tab_name_' + tab.Name" :name="tab.Id || tab.Name" v-if="tab.Display !== false">
                    <template #label
                        ><span><fa-icon v-if="!DiyCommon.IsNull(tab.Icon)" :class="tab.Icon + ' marginRight5'" />{{ tab.Name }}</span></template
                    >
                    <!-- 骨架屏：表单数据加载中 -->
                    <div v-if="!GetDiyTableRowModelFinish && (!renderedTabs.has(tab.Id || tab.Name) || !DiyTableModel || !DiyTableModel.Id)" class="form-skeleton-container">
                        <el-skeleton animated :rows="0" :loading="true">
                            <template #template>
                                <div class="form-skeleton">
                                    <div v-for="row in 4" :key="'skeleton-row-' + row" class="skeleton-row">
                                        <div v-for="col in 2" :key="'skeleton-col-' + col" class="skeleton-field">
                                            <el-skeleton-item variant="text" style="width: 80px; height: 14px; margin-bottom: 8px;" />
                                            <el-skeleton-item variant="rect" style="width: 100%; height: 32px;" />
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </el-skeleton>
                    </div>
                    <!-- 性能优化：只渲染已访问过的 tab，实现懒加载 -->
                    <!-- 数据就绪检查：确保 DiyTableModel 和 DiyFieldList 都已加载 -->
                    <div v-if="renderedTabs.has(tab.Id || tab.Name) && DiyTableModel && DiyTableModel.Id"
                        :id="'field-form-' + tabIndex"
                        :data-tab="FieldActiveTab"
                        :class="formContainerClass">
                        <el-form
                            :rules="FormRules"
                            :class="DiyTableModel.Name"
                            ref="FormDiyTableModel"
                            status-icon
                            :model="FormDiyTableModel"
                            label-width="135px"
                            :label-position="GetLabelPosition()"
                        >
                            <!-- 设计模式：使用 draggable 支持拖拽排序和从设计器拖入 -->
                            <draggable
                                v-if="LoadMode === 'Design'"
                                :list="DiyFieldListGrouped[tab.Id || tab.Name] || []"
                                group="field-components"
                                item-key="Id"
                                class="el-row draggable-with-gutter"
                                :style="{ display: 'flex', flexWrap: 'wrap'}"
                                @click="handleFieldClick"
                                @add="onFieldAdd"
                                @end="onFieldDragEnd"
                                tag="div"
                                handle=".field-drag-handle"
                                :animation="150"
                            >
                                <template #item="{ element: field }">
                                    <el-col
                                        v-show="field._isShow"
                                        :class="[
                                            'field-drag-handle',
                                            'design-mode-field',
                                            CurrentDiyFieldModel.Id == field.Id ? field._activeClass + ' selected-field' : field._class,
                                            field._collapseClass
                                        ]"
                                        :key="'el_col_fieldid_' + field.Id"
                                        :span="field._span"
                                        :xs="24"
                                        :data-field-id="field.Id"
                                        @mouseenter="showFieldToolbar(field, $event)"
                                        @mouseleave="hideFieldToolbar"
                                        @dblclick.stop="openComponentConfig(field)"
                                        :title="hasComponentConfig(field) ? '双击打开组件配置，单击选中字段' : '单击选中字段'"
                                    >
                                        <!-- 字段操作工具栏 -->
                                        <div v-if="CurrentDiyFieldModel.Id == field.Id" class="field-toolbar">
                                            <el-tooltip v-if="hasComponentConfig(field)" content="组件配置" placement="top">
                                                <el-button size="small" :icon="Setting" circle @click.stop="openComponentConfig(field)" />
                                            </el-tooltip>
                                            <el-tooltip :content="$t('Msg.CopyField')" placement="top">
                                                <el-button size="small" :icon="DocumentCopy" circle @click.stop="duplicateField(field)" />
                                            </el-tooltip>
                                            <el-tooltip :content="$t('Msg.DeleteField')" placement="top">
                                                <el-button size="small" :icon="Delete" type="danger" circle @click.stop="deleteField(field)" />
                                            </el-tooltip>
                                            <el-tooltip :content="$t('Msg.FieldWidth') + ': ' + field._span + '/24'" placement="top">
                                                <div class="width-control">
                                                    <el-button size="small" :icon="Minus" circle @click.stop="adjustFieldWidth(field, -1)" :disabled="field._span <= 1" />
                                                    <span class="width-display">{{ field._span }}</span>
                                                    <el-button size="small" :icon="Plus" circle @click.stop="adjustFieldWidth(field, 1)" :disabled="field._span >= 24" />
                                                </div>
                                            </el-tooltip>
                                        </div>
                                        <!-- 拖拽手柄 -->
                                        <div class="drag-handle" :title="$t('Msg.DragSort') + ': ' + field.Label">
                                            <el-icon><Rank /></el-icon>
                                        </div>
                                        <!-- 宽度调整手柄 -->
                                        <div
                                            class="width-resize-handle"
                                            :class="{ resizing: resizingField && resizingField.Id === field.Id }"
                                            :title="$t('Msg.DragResizeWidth') + ': ' + field._span + '/24'"
                                            @mousedown="startResizeWidth(field, $event)"
                                        ></div>
                                        <div class="container-form-item">
                                        <el-form-item
                                            v-show="GetFieldIsShow(field)"
                                            :label-position="GetLabelPosition(field)"
                                            :prop="field.Name"
                                            :class="'form-item' + (field.NotEmpty && FormMode != 'View' ? ' is-required ' : '')
                                                    + (shouldShowLabel(field) ? '' : ' hide-label ')"
                                        >
                                            <template #label>
                                                <span :title="GetFormItemLabel(field)" :style="getFieldLabelStyle(field)">
                                                    <el-tooltip v-if="!DiyCommon.IsNull(field.Description)" class="item" effect="dark" :content="field.Description" placement="left">
                                                        <template #default>
                                                            <el-icon><InfoFilled /></el-icon>
                                                        </template>
                                                    </el-tooltip>
                                                    {{ GetFormItemLabel(field) }}
                                                </span>
                                            </template>
                                            <!--通用组件渲染-->
                                            <component
                                                :is="GetFieldComponent(field)"
                                                :ref="'ref_' + field.Name"
                                                v-model="FormDiyTableModel[field.Name]"
                                                :TableInEdit="false"
                                                :field="field"
                                                :FormDiyTableModel="FormDiyTableModel"
                                                :FormData="FormDiyTableModel"
                                                :FormMode="FormMode"
                                                :SysConfig="SysConfig"
                                                :LoadMode="LoadMode"
                                                :TableId="TableId"
                                                :TableName="TableName"
                                                :TableRowId="TableRowId"
                                                :ReadonlyFields="ReadonlyFields"
                                                :FieldReadonly="GetFieldReadOnly(field)"
                                                :ApiReplace="ApiReplace"
                                                :DevComponents="DevComponents"
                                                :pageLifetimes="pageLifetimes"
                                                :ParentV8="GetV8(field)"
                                                :ParentFormLoadFinish="GetDiyTableRowModelFinish"
                                                :DiyFieldList="DiyFieldList"
                                                :ParentFieldList="DiyFieldListGrouped[tab.Id || tab.Name] || []"
                                                :CodeEditorMini="CodeEditorMini"
                                                @CallbackRunV8Code="RunV8Code"
                                                @CallbackGoUrl="GoUrl"
                                                @CallbackFormValueChange="CallbackFormValueChange"
                                                @CallbakOnKeyup="FieldOnKeyup"
                                                @OpenTableEventByInput="OpenTableEventByInput"
                                                @ParentFormSet="FormSet"
                                                @CallbackParentFormSubmit="CallbackParentFormSubmit"
                                                @CallbakRefreshChildTable="CallbakRefreshChildTable"
                                                @CallbackShowTableChildHideField="ShowTableChildHideField"
                                                @CallbackGroupCollapseChange="handleGroupCollapseChange"
                                                @CallbackFieldTabsChange="handleFieldTabsChange"
                                            />
                                        </el-form-item>
                                    </div>
                                    </el-col>
                                </template>
                            </draggable>

                            <!-- 普通模式：使用原生 el-row 以获得最佳性能。 
                                    如果这里设置:gutter="10"会导致折叠组件标题和内容对不齐，
                                    但如果不设置又会导致表单字段与字段直接挨在一起了-->
                            <el-row v-else :gutter="10" @click="handleFieldClick">
                                <el-col
                                    v-for="field in DiyFieldListGrouped[tab.Id || tab.Name] || []"
                                    v-show="field._isShow"
                                    :class="[CurrentDiyFieldModel.Id == field.Id ? field._activeClass : field._class, field._collapseClass]"
                                    :key="'el_col_fieldid_' + field.Id"
                                    :span="field._span"
                                    :xs="24"
                                    :data-field-id="field.Id"
                                >
                                    <div class="container-form-item">
                                        <el-form-item
                                            v-show="GetFieldIsShow(field)"
                                            :label-position="GetLabelPosition(field)"
                                            :prop="field.Name"
                                            :class="'form-item'
                                                    + (field.NotEmpty && FormMode != 'View' ? ' is-required ' : '')
                                                    + (shouldShowLabel(field) ? '' : ' hide-label ')"
                                        >
                                            <!-- v-if="shouldShowLabel(field)" -->
                                            <template #label>
                                                <span :title="GetFormItemLabel(field)" :style="getFieldLabelStyle(field)">
                                                    <el-tooltip v-if="!DiyCommon.IsNull(field.Description)" class="item" effect="dark" :content="field.Description" placement="left">
                                                        <template #default>
                                                            <el-icon><InfoFilled /></el-icon>
                                                        </template>
                                                    </el-tooltip>
                                                    {{ GetFormItemLabel(field) }}
                                                </span>
                                            </template>
                                            <!--通用组件渲染-->
                                           <!-- {{field.Component}} -->
                                            <component
                                                :is="GetFieldComponent(field)"
                                                :ref="'ref_' + field.Name"
                                                v-model="FormDiyTableModel[field.Name]"
                                                :TableInEdit="false"
                                                :field="field"
                                                :FormDiyTableModel="FormDiyTableModel"
                                                :FormData="FormDiyTableModel"
                                                :FormMode="FormMode"
                                                :SysConfig="SysConfig"
                                                :LoadMode="LoadMode"
                                                :TableId="TableId"
                                                :TableName="TableName"
                                                :TableRowId="TableRowId"
                                                :ReadonlyFields="ReadonlyFields"
                                                :FieldReadonly="GetFieldReadOnly(field)"
                                                :ApiReplace="ApiReplace"
                                                :DevComponents="DevComponents"
                                                :pageLifetimes="pageLifetimes"
                                                :ParentV8="GetV8(field)"
                                                :ParentFormLoadFinish="GetDiyTableRowModelFinish"
                                                :DiyFieldList="DiyFieldList"
                                                :ParentFieldList="DiyFieldListGrouped[tab.Id || tab.Name] || []"
                                                :CodeEditorMini="CodeEditorMini"
                                                @CallbackRunV8Code="RunV8Code"
                                                @CallbackGoUrl="GoUrl"
                                                @CallbackFormValueChange="CallbackFormValueChange"
                                                @CallbakOnKeyup="FieldOnKeyup"
                                                @OpenTableEventByInput="OpenTableEventByInput"
                                                @ParentFormSet="FormSet"
                                                @CallbackParentFormSubmit="CallbackParentFormSubmit"
                                                @CallbakRefreshChildTable="CallbakRefreshChildTable"
                                                @CallbackShowTableChildHideField="ShowTableChildHideField"
                                                @CallbackGroupCollapseChange="handleGroupCollapseChange"
                                                @CallbackFieldTabsChange="handleFieldTabsChange"
                                            />
                                        </el-form-item>
                                    </div>
                                </el-col>
                            </el-row>
                        </el-form>
                    </div>
                </el-tab-pane>
                <div v-if="DiyFieldList.length == 0 && LoadDiyFieldList && tab.Display !== false"
                    :key="'div_' + tab.Name"
                    class="not-field">
                    <div style="margin-top: -40px">
                        <img :src="'./static/img/no-data.svg'" style="width: 200px" />
                    </div>
                    <div style="height: 32px; margin-top: -30px">请从左侧拖入控件，开始设计表单！</div>
                </div>
            </template>
        </el-tabs>
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
        <!--抽屉或弹窗打开完整的Form（延迟渲染，防止 Page 模式下无限嵌套）-->
        <DiyFormDialog v-if="_shouldRenderDiyFormDialog" ref="refDiyTable_DiyFormDialog" :ParentV8="GetV8()" @ParentFormSet="ParentFormSet"></DiyFormDialog>
    </div>
</template>

<script>
import draggable from "vuedraggable";
import { computed } from "vue";
import _ from "underscore";
import { useDiyStore } from "@/pinia";

// 使用共享的组件缓存池，避免重复创建导致的内存泄漏
import DynamicComponentCache from "@/utils/dynamicComponentCache.js";
import { initV8ScanCode } from "@/utils/v8-scan-code.js";
import { initV8Print } from "@/utils/v8-print.js";
import { formTrace } from "@/utils/form-engine-trace.js";

// Mixins
import {
    diyCommonMixin,
    formUtilsMixin,
    diyFormCleanupMixin,
    diyFormDesignerMixin,
    diyFormStateMixin,
    diyFormDataMixin,
    diyFormSchemaMixin,
    diyFormChildTableMixin,
    diyFormNavigationMixin
} from "./mixins";

export default {
    // name: "DiyForm",
    directives: {},
    mixins: [
        diyCommonMixin,
        formUtilsMixin,
        diyFormCleanupMixin,
        diyFormDesignerMixin,
        diyFormStateMixin,
        diyFormDataMixin,
        diyFormSchemaMixin,
        diyFormChildTableMixin,
        diyFormNavigationMixin
    ],
    components: {
        draggable,
    },
    setup() {
        const diyStore = useDiyStore();
        const SysConfig = computed(() => diyStore.SysConfig);
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        return { diyStore, SysConfig, GetCurrentUser, DynamicComponentCache };
    },
    props: {
        CodeEditorMini: {
            type: Boolean,
            default: false
        },
        AutoInit: {
            type: Boolean,
            default: true
        },
        ShowHideField: {
            type: Boolean,
            default: false
        },
        TableId: {
            type: String,
            default: ""
        },
        TableName: {
            type: String,
            default: ""
        },
        TableRowId: {
            type: String,
            default: ""
        },
        //表单模式Add、Edit、View
        FormMode: {
            type: String,
            default: "" //View
        },
        TableChildFormMode: {
            type: String,
            default: "" //View
        },
        //还需要一个OpenType？ 弹窗、抽屉、页面

        //加载模式：Design
        LoadMode: {
            type: String,
            default: ""
        },
        // ['FieldName1','FieldName2']
        ReadonlyFields: {
            type: Array,
            default: () => []
        },
        // {FieldName1:value , FieldName2:value}
        DefaultValues: {
            type: Object,
            default() {
                return {};
            }
        },
        FormData: {
            type: Object,
            default() {
                return {};
            }
        },
        BatchHourseAllPath: {
            default: "",
            type: String
        },
        //这里是指向数据库查询的哪些字段名称
        //['fieldName','fieldName']
        SelectFields: {
            type: Array,
            default: () => []
        },
        //这里是指Form表单要显示的哪些字段
        //['fieldName','fieldName']
        ShowFields: {
            type: Array,
            default: () => []
        },
        //这里是指Form表单要隐藏的哪些字段
        //['fieldName','fieldName']
        HideFields: {
            type: Array,
            default: () => []
        },
        //固定只显示哪些Tabs，优先级大于表单引擎-->表单属性配置的Tabs分组。
        FixedTabs: {
            type: Array,
            default: () => []
        },
        CustomComponent: {
            type: Object,
            default() {
                return {};
            }
        },
        //{GetDiyTableModel:'',GetDiyField:'',}
        ApiReplace: {
            type: Object,
            default() {
                return {};
            }
        },
        ParentForm: {
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
        ColSpan: {
            type: Number,
            default: 0
        },
        LabelPosition: {
            type: String,
            default: "" //left,top,bottom,right
        },
        CurrentTableData: {
            type: Array,
            default: () => []
        },
        ActiveDiyTableTab: {
            type: Object,
            default() {
                return {};
            }
        },
        FormWf: {
            type: Object,
            default() {
                return {};
            }
        },
        /**
         * 事件替换，传入 { Insert/Update/Deleted或Submit : function }
         */
        EventReplace: {
            type: Object,
            default() {
                return {};
            }
        },
        DataAppend: {
            type: Object,
            default() {
                return {};
            }
        }
    },
    // Vue 3: 使用 unmounted 替代 destroyed
    // Vue 3: 使用 beforeUnmount 替代 beforeDestroy（这是最关键的修复！）
    methods: {
                /**
         * 安全获取组件 ref 实例（兼容 Vue 2/3）
         * @param {string} fieldName - 字段名称
         * @returns {Object|null} - 组件实例或 null
         */
                /**
         * 安全的 setTimeout 包装器，组件销毁时自动清理
         * @param {Function} fn - 要执行的函数
         * @param {number} delay - 延迟时间（毫秒）
         * @returns {number} - 定时器ID
         */
                /**
         * 事件委托：处理字段点击事件
         * 通过事件冒泡机制，在父元素上统一处理所有字段的点击，减少事件监听器数量
         */
                Init(param, callback) {
            var self = this;
            formTrace("diy-form:init-start", {
                tableId: self.TableId,
                tableName: self.TableName,
                formMode: self.FormMode,
                loadMode: self.LoadMode,
                tableRowId: self.TableRowId
            });
            self.GetDiyTableRowModelFinish = false;
            self.IsFirstLoadForm = true;
            self.DiyImgUploadRealPath = [];
            self.DiyFileUploadRealPath = [];
            self.FormRules = {};
            // 2026-01-26 Anderson：取消这个判断， vue3不像vue2那样弱，vue2当初是必须要在这里清除一下
            if (self.FormMode == 'Add' || self.FormMode == 'Insert')
            {
                // self.CurrentDiyTableRowModel = {};//2020-07-09：暂时注释
                //注意：这一句并不能将所有属性值全部清除掉，要使用$delete
                // self.FormDiyTableModel = {};
                Object.keys(self.FormDiyTableModel).forEach((item) => {
                    delete self.FormDiyTableModel[item];
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
        async RunFieldTemplateEngine(field, row) {
            var self = this;
            var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
            V8.Result = "";
            V8.Field = field;
            V8.Form = row;
            V8.Row = row;
            V8.EventName = "FormTemplateEngine";
            self.SetV8DefaultValue(V8);

            var result = null;
            try {
                // eval(field.V8TmpEngineForm);
                await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + field.V8TmpEngineForm + " \n})()");
                if (self.DiyCommon.IsNull(V8.Result) && V8.Result != "") {
                    //注意有时候确实是在v8中设置返回了空字符串
                    result = self.GetColValue({ row: row }, field);
                } else {
                    result = V8.Result;
                }
            } catch (error) {
                // return error.message;
                self.DiyCommon.Tips("执行V8模板引擎代码出现错误[" + field.Name + "," + field.Label + "]：" + error.message, false);
            } finally {


            }
            return result;
        },
        GetV8(field) {
            var self = this;
            var v8 = self.DiyCommon.InitV8CodeSync({}, self.$router);
            self.SetV8DefaultValue(v8);
            //2021-12-10新增，有可能用户自定义父级model，如点击A子表一行数据，更新B子表数据
            if (field && !self.DiyCommon.IsNull(field._ParentFormModel)) {
                v8.Form = Object.assign(
                    {},
                    {
                        ...field._ParentFormModel
                    }
                );
                v8.ParentForm = self.FormDiyTableModel;
            }
            return v8;
        },
        async OpenTableEventByInput(fieldName) {
            var self = this;
            if (fieldName) {
                self.OpenTableEvent(self.DiyFieldList.find((field) => field.Name == fieldName));
            }
        },
        async OpenTableEvent(field) {
            var self = this;
            //弹出前V8
            var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
            V8.EventName = "OpenTableBefore";
            try {
                if (!self.DiyCommon.IsNull(field.Config) && !self.DiyCommon.IsNull(field.Config.OpenTable) && !self.DiyCommon.IsNull(field.Config.OpenTable.BeforeOpenV8)) {
                    V8.AppendSearchChildTable = self.AppendSearchChildTable;
                    V8.OpenTableSetWhere = self.OpenTableSetWhere;
                    self.SetV8DefaultValue(V8);

                    await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + field.Config.OpenTable.BeforeOpenV8 + " \n})()");
                }
            } catch (error) {
                self.DiyCommon.Tips("执行弹出表格弹出前V8引擎代码出现错误[" + field.Name + "," + field.Label + "]：" + error.message, false);
            } finally {


            }
            self.$nextTick(function () {
                field.Config.OpenTable.ShowDialog = true;
            });
        },
        //刷新子表，可以传入新的外键值，传入子表的FieldName、外键Id
        CallbakRefreshChildTable(fieldModel, parentFormModel, v8) {
            var self = this;
            //2021-12-10:这里传入的父级v8对象，有可能是子表行点击传过来的
            var refComponent = self.getRefComponent(fieldModel.Name);
            if (refComponent && typeof refComponent.Init === 'function') {
                if (v8) {
                    refComponent.Init(parentFormModel, v8);
                } else {
                    refComponent.Init(parentFormModel, self.GetV8());
                }
            }
        },
        ReloadJoinForm(fieldModelOrParams) {
            var self = this;
            // 支持两种调用方式：
            // 1. ReloadJoinForm(fieldModel) - 传入字段对象
            // 2. ReloadJoinForm({ FieldName, TableId, TableName, Id, FormMode }) - 传入配置对象
            let fieldModel;

            if (fieldModelOrParams.Name && fieldModelOrParams.Config) {
                // 方式1：传入的是字段对象
                fieldModel = fieldModelOrParams;
            } else if (fieldModelOrParams.FieldName) {
                // 方式2：传入的是配置对象
                const params = fieldModelOrParams;
                fieldModel = self.DiyFieldList.find(item => item.Name === params.FieldName);

                if (!fieldModel) {
                    console.error(`ReloadJoinForm: 字段 ${params.FieldName} 不存在`);
                    return;
                }

                // 更新字段配置
                if (!fieldModel.Config) {
                    fieldModel.Config = {};
                }
                if (!fieldModel.Config.JoinForm) {
                    fieldModel.Config.JoinForm = {};
                }

                fieldModel.Config.JoinForm.TableId = params.TableId || '';
                fieldModel.Config.JoinForm.TableName = params.TableName || '';
                fieldModel.Config.JoinForm.Id = params.Id;
                fieldModel.Config.JoinForm.FormMode = params.FormMode;

                // 触发 FieldSet 确保响应式更新
                self.FieldSet(params.FieldName, 'Config', fieldModel.Config);
            } else {
                console.error('ReloadJoinForm: 参数错误', fieldModelOrParams);
                return;
            }

            console.log(`ReloadJoinForm 被调用: ${fieldModel.Name}`, {
                fieldConfig: fieldModel.Config?.JoinForm,
                currentTime: new Date().toISOString()
            });

            self.$nextTick(function () {
                // 延迟时间改为 500ms，给组件更多时间初始化
                setTimeout(async () => {
                    var refComponent = self.getRefComponent(fieldModel.Name);
                    if (!refComponent) {
                        console.error(`ReloadJoinForm: 组件 ${fieldModel.Name} 的 ref 未找到`);
                        return;
                    }

                    // 调试信息：检查组件状态
                    var componentState = {
                        hasInit: typeof refComponent.Init === 'function',
                        shouldRender: refComponent._shouldRender,
                        hasInstance: !!refComponent._joinFormInstance,
                        instanceMethods: refComponent._joinFormInstance ? Object.keys(refComponent._joinFormInstance).filter(k => typeof refComponent._joinFormInstance[k] === 'function') : []
                    };

                    console.log(`ReloadJoinForm: 组件 ${fieldModel.Name}`, componentState);

                    // 如果组件未渲染，尝试更新配置触发渲染
                    if (!componentState.shouldRender) {
                        console.warn(`ReloadJoinForm: 组件 ${fieldModel.Name} 未满足渲染条件`);
                        return;
                    }

                    // 调用 Init 方法（内部已经有等待逻辑）
                    if (typeof refComponent.Init === 'function') {
                        console.log(`ReloadJoinForm: 正在执行 ${fieldModel.Name}.Init()`);
                        try {
                            await refComponent.Init(true);
                            console.log(`ReloadJoinForm: ${fieldModel.Name}.Init() 执行完成`);
                        } catch (error) {
                            console.error(`ReloadJoinForm: 执行 ${fieldModel.Name}.Init() 失败`, error);
                        }
                    } else {
                        console.error(`ReloadJoinForm: 组件 ${fieldModel.Name} 的 Init 方法不存在`, {
                            componentKeys: Object.keys(refComponent || {}),
                            fieldConfig: fieldModel.Config?.JoinForm,
                            componentState
                        });
                    }
                }, 500);
            });
        },
        async FieldOnKeyup(event, field) {
            var self = this;
            var keyCode = event.keyCode;
            // 判断需要执行的V8
            if (!self.DiyCommon.IsNull(field.KeyupV8Code)) {
                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                V8.KeyCode = keyCode;
                V8.EventName = "FieldOnKeyup";
                self.SetV8DefaultValue(V8);

                try {
                    // eval(field.KeyupV8Code)
                    await eval("(async () => {\n " + field.KeyupV8Code + " \n})()");
                } catch (error) {
                    self.DiyCommon.Tips("执行按键事件V8引擎代码出现错误：" + error.message, false);
                } finally {


                }
            }
        },
        ComponentButtonClick(field) {
            var self = this;
            self.RunV8Code({ field: field });
        },
        //离开表单动作
        async FormOutAction(actionType, submitAfterType, tableRowId, V8Callback) {
            var self = this;
            if (self.DiyCommon.IsNull(self.DiyTableModel.Id)) {
                return {};
            }
            // 判断需要执行的V8
            if (!self.DiyCommon.IsNull(self.DiyTableModel.OutFormV8)) {
                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                V8.FormOutAction = actionType;
                V8.FormOutAfterAction = submitAfterType;
                V8.V8Callback = V8Callback;
                V8.EventName = "FormOut";
                self.SetV8DefaultValue(V8);

                if (!self.DiyCommon.IsNull(tableRowId)) {
                    V8.Form.Id = tableRowId;
                }
                var result = {};
                try {
                    // eval(self.DiyTableModel.OutFormV8);
                    await eval("(async () => {\n " + self.DiyTableModel.OutFormV8 + " \n})()");
                    // 保存需要返回的值
                    result = { ...V8 };
                } catch (error) {
                    self.DiyCommon.Tips("执行表单离开V8引擎代码出现错误：" + error.message, false);
                } finally {


                }
                return result;
            }
            return {};
        },
        SetV8DefaultValue(V8, field) {
            var self = this;

            // 首次创建基础实例：初始化所有通用函数（只执行一次）
            if (!self._V8BaseInstance) {
                self._V8BaseInstance = {
                    // 系统级对象（全局共享，标记为不可清理）
                    DiyCommon: self.DiyCommon,
                    CurrentUser: self.GetCurrentUser,
                    // 通用方法（不依赖具体表单数据的函数）
                    OsClient: self.DiyCommon.GetOsClient(),
                    ClientType: self.DiyCommon.GetClientType(),
                    OpenAnyForm: self.OpenAnyForm,
                    OpenDialog: self.OpenDialog,
                    ReloadForm: (row, type) => self.$emit("CallbackReloadForm", row, type),
                    HideFormBtn: self.HideFormBtn,
                    FormSet: self.FormSet,
                    FieldSet: self.FieldSet,
                    TableSearchAppend: self.SearchAppend,
                    TableSearchSet: self.SearchSet,
                    TableRefresh: self.TableRefresh,
                    TableSetData: self.TableSetData,
                    FormSubmit: self.V8FormSubmit,
                    FormSubmitInside: self.FormSubmit,
                    RefreshTable: self.CallbackRefreshTable,
                    ParentFormSet: self.ParentFormSet,
                    CallbackForm: self.CallbackForm,
                    ShowTableChildHideField: self.ShowTableChildHideField,
                    GetChildTableData: self.GetChildTableData,
                    HideFormTab: self.HideFormTab,
                    ShowFormTab: self.ShowFormTab,
                    ClickFormTab: self.ClickFormTab,
                    GetFormTabs: self.GetShowTabs,
                    ActiveDiyTableTab: self.ActiveDiyTableTab,
                    ReloadJoinForm: self.ReloadJoinForm,
                    FormClose: self.FormClose
                };
            }

            // 【修复】从基础实例显式复制所有通用函数引用（不使用原型链，避免 eval 中访问失败）
            // if (!V8.DiyCommon) {
                // 复制所有通用函数到当前 V8 对象
                Object.assign(V8, self._V8BaseInstance);
            // }

            // 注册 V8.Method.ScanCode 扫码功能（闭包绑定当前 V8 实例）
            initV8ScanCode(V8);
            // 注册 V8.Print 蓝牙打印功能（闭包绑定当前 V8 实例）
            initV8Print(V8);

            // 设置动态属性（每次调用都可能变化的数据）
            V8.DataAppend = self.DataAppend;
            V8.FormWF = self.FormWf;

            //2022-04-09修改V8.Form.Id
            if (!self.DiyCommon.IsNull(self.TableRowId) && self.DiyCommon.IsNull(self.FormDiyTableModel.Id)) {
                self.FormDiyTableModel["Id"] = self.TableRowId;
            }

            // 动态数据（依赖当前表单状态）
            V8.Form = self.FormDiyTableModel;
            V8.OldForm = self.OldForm;
            V8.Field = self.GetDiyFieldListObject;
            V8.TableRowId = self.TableRowId;
            V8.ApiReplace = self.ApiReplace;
            V8.ParentForm = self.ParentForm;
            V8.ParentV8 = self.ParentV8;
            V8.FormMode = self.FormMode;
            V8.LoadMode = self.LoadMode;
            V8.TableId = self.TableId;
            V8.TableName = self.TableName;
            V8.TableModel = self.DiyTableModel;
            V8.CurrentTableData = self.CurrentTableData;

            return V8;
        },
        async FormSubmitAction(actionType, tableRowId) {
            var self = this;
            if (self.DiyCommon.IsNull(self.DiyTableModel.Id)) {
                return;
            }
            // 判断需要执行的V8
            if (!self.DiyCommon.IsNull(self.DiyTableModel.SubmitFormV8)) {
                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                V8.FormSubmitAction = actionType;
                V8.EventName = "FormSubmitBefore";
                self.SetV8DefaultValue(V8);

                if (!self.DiyCommon.IsNull(tableRowId)) {
                    V8.Form.Id = tableRowId;
                }
                var result = undefined;
                try {
                    // eval(self.DiyTableModel.SubmitFormV8)
                    var V8Result = await eval(
                        "//" + self.DiyTableModel.Description + "(" + self.DiyTableModel.Name + ")表单提交前V8" + "\n(async () => {\n " + self.DiyTableModel.SubmitFormV8 + " \n})()"
                    );
                    if (V8Result !== undefined) {
                        result = V8.Result || V8Result;
                    } else {
                        result = V8.Result;
                    }
                } catch (error) {
                    self.DiyCommon.Tips("执行表单提交前V8引擎代码出现错误：" + error.message, false);
                    result = false;
                } finally {


                }
                return result;
            }
            return;
        },
        GetAllData(param, callback) {
            var self = this;
            formTrace("diy-form:get-all-data-start", {
                tableId: self.TableId,
                tableName: self.TableName,
                formMode: self.FormMode,
                loadMode: self.LoadMode,
                tableRowId: self.TableRowId
            });
            self.GetDiyTableRowModelFinish = false;
            var apiGetDiyTableModel = self.DiyApi.GetDiyTableModel;
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
                        FormEngineKey: "Diy_Table"
                    }
                });
            } else if (self.TableName) {
                param.push({
                    Url: apiGetDiyTableModel,
                    Param: {
                        Name: self.TableName,
                        FormEngineKey: "Diy_Table"
                    }
                });
            }
            //2024-04-24：修改为通过表单引擎查询diy_field列表，待实现【_SelectFields】功能

            if (self.PageType == "Report") {
                var getFieldListParam = {
                    FormEngineKey: "diy_field"
                };
                if (self.TableId) {
                    // getFieldListParam._Where = [{ Name: "TableId", Value: self.TableId, Type: "=" }];
                    getFieldListParam._Where = [["TableId", "=", self.TableId]];
                }
                // if(self.TableName){
                //     getFieldListParam._Where = [{ Name : 'TableId', Value : self.TableName, Type : '=' }]
                // }
                param.push({
                    Url: "/api/FormEngine/GetTableData-diyfield", //apiGetDiyField,
                    Param: getFieldListParam
                });
            } else {
                param.push({
                    Url: apiGetDiyField,
                    Param: {
                        TableId: self.TableId,
                        TableName: self.TableName,
                        // OsClient: self.OsClient,
                        _SelectFields: self.SelectFields
                    }
                });
            }
            var loadingObj = self.$loading({
                target: ".itdos-diy-form-" + (self.DiyCommon.IsNull(self.TableId) ? self.TableName : self.TableId),
                text: "加载DIY表单..."
            });

            self.DiyCommon.PostAll(param, async function (results) {
                loadingObj.close();
                formTrace("diy-form:postall-return", {
                    tableId: self.TableId,
                    tableName: self.TableName,
                    result0: results && results[0] && results[0].Code,
                    result1: results && results[1] && results[1].Code
                });
                if (self.DiyCommon.Result(results[0]) && self.DiyCommon.Result(results[1])) {
                    // GetDiyTableModel
                    var result1 = results[0];
                    _.sortBy(result1.Data.Tabs, "Sort");
                    self.DiyCommon.DiyTableStrToJson(result1.Data);

                    self.DiyCommon.Base64DecodeDiyTable(result1.Data);

                    self.DiyTableModel = result1.Data;
                    formTrace("diy-form:table-model-ready", {
                        table: self.DiyTableModel && self.DiyTableModel.Name,
                        tableId: self.DiyTableModel && self.DiyTableModel.Id,
                        tabs: self.DiyTableModel && self.DiyTableModel.Tabs ? self.DiyTableModel.Tabs.length : 0
                    });

                    if (self.FixedTabs.length > 0) {
                        self.FormTabs = self.FixedTabs;
                    } else {
                        self.FormTabs = self.DiyTableModel.Tabs;
                        if (self.DiyTableModel.TabsTop) {
                            self.FieldActiveTab = self.FormTabs[self.currentTabIndex + 1]?.Id || self.FormTabs[self.currentTabIndex + 1]?.Name;
                        } else {
                            self.FieldActiveTab = self.FormTabs[self.currentTabIndex]?.Id || self.FormTabs[self.currentTabIndex]?.Name;
                        }
                    }

                    self.CollapseGroupState = {};
                    self.FieldTabsState = {};

                    // 性能优化：初始化第一个 tab 为已渲染（懒加载优化）
                    self.renderedTabs.clear(); // 清空之前的记录
                    if (self.FormTabs && self.FormTabs.length > 0) {
                        // Bug修复：标记第一个tab和当前激活的tab都为已渲染
                        const firstTab = self.FormTabs[0];
                        const firstTabKey = firstTab.Id || firstTab.Name;
                        self.renderedTabs.add(firstTabKey);

                        // 如果当前激活的不是第一个tab，也要标记为已渲染
                        if (self.FieldActiveTab && self.FieldActiveTab !== firstTabKey) {
                            self.renderedTabs.add(self.FieldActiveTab);
                        }
                    }

                    var resultGetDiyField = results[1];
                    formTrace("diy-form:fields-ready", {
                        table: self.DiyTableModel && self.DiyTableModel.Name,
                        fieldCount: resultGetDiyField && resultGetDiyField.Data ? resultGetDiyField.Data.length : 0,
                        collapseCount: resultGetDiyField && resultGetDiyField.Data ? resultGetDiyField.Data.filter((field) => field && field.Component === "CollapseGroup").length : 0,
                        tabsCount: resultGetDiyField && resultGetDiyField.Data ? resultGetDiyField.Data.filter((field) => field && field.Component === "Tabs").length : 0
                    });
                    var formData = {};

                    //2021-09-06修改：要先获取了DiyTableModel实体后才能再去获取 DiyTableRowModel,因为有可能配置了查询接口替换
                    //这里这个判断和 IF20210906 要保持一样
                    var needGetDiyTableRowModel = self.FormMode != "Add" && self.FormMode != "Insert" && !self.DiyCommon.IsNull(self.TableRowId);
                    if (needGetDiyTableRowModel) {
                        //!self.DiyCommon.IsNull(self.TableRowId)
                        var getDiyTableRowModelUrl = self.DiyApi.GetDiyTableRowModel;
                        if (self.DiyTableModel.Name) {
                            // getDiyTableRowModelUrl += '.' + self.DiyTableModel.Name;
                            // getDiyTableRowModelUrl = '/api/FormEngine/GetFormData.' + param.FormEngineKey;
                            getDiyTableRowModelUrl = "/api/FormEngine/GetFormData-" + self.DiyTableModel.Name.replace(/\_/g, "-").toLowerCase();
                        }
                        if (!self.DiyCommon.IsNull(self.DiyTableModel.ApiReplace.Select)) {
                            getDiyTableRowModelUrl = self.DiyCommon.RepalceUrlKey(self.DiyTableModel.ApiReplace.Select);
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
                            Id: self.TableRowId
                        };
                        // if(!param.TableName){
                        //     param.TableId = self.TableId;
                        // }
                        if (!param.FormEngineKey) {
                            param.FormEngineKey = self.TableId;
                        }
                        var roeModelResult = await self.DiyCommon.PostAsync(getDiyTableRowModelUrl, param);
                        if (self.DiyCommon.Result(roeModelResult)) {
                            if (!roeModelResult.Data.Id && (roeModelResult.Data.id || roeModelResult.Data.ID)) {
                                roeModelResult.Data.Id = roeModelResult.Data.id || roeModelResult.Data.ID;
                            }
                            // GetDiyTableRowModel、GetDiyField
                            // var formData = self.FormMode != 'Add' ? results[2].Data : {} // 之前默认的是null，后来改成了{}  //!self.DiyCommon.IsNull(self.TableRowId)
                            // var formData = !self.DiyCommon.IsNull(results[2]) ? results[2].Data : {} // 之前默认的是null，后来改成了{}  //!self.DiyCommon.IsNull(self.TableRowId)
                            formData = roeModelResult.Data; // 之前默认的是null，后来改成了{}  //!self.DiyCommon.IsNull(self.TableRowId)
                            if (roeModelResult.DataAppend && roeModelResult.DataAppend.NotSaveField) {
                                self.NotSaveField = roeModelResult.DataAppend.NotSaveField;
                            }
                        } else {
                        }
                    }
                    // 2020-07-16新增：DefaultValues 父组件传过来的默认值。 取数据值优先还是DefaultValues优先？
                    // 以取到的数据优先
                    for (const key in self.DefaultValues) {
                        if (self.DiyCommon.IsNull(formData[key])) { //以取到的数据优先
                            formData[key] = self.DefaultValues[key];
                        }
                    }
                    // 2026-02-05 Anderson：如果根据【2020-07-16】的说明：【以取到的数据优先】，会有一个问题：
                    // 用户明明是想以传过来的数据为优先时无法满足，因为新增一个 FormData 属性，优先级更高、
                    for (const key in self.FormData) {
                        formData[key] = self.FormData[key];
                    }

                    formTrace("diy-form:get-all-data-after-before", {
                        table: self.DiyTableModel && self.DiyTableModel.Name
                    });
                    await self.GetAllDataAfter(resultGetDiyField, formData, function (callbackObj) {
                        self.$emit("CallbackSetFormData", callbackObj.CurrentRowModel);
                    });
                    formTrace("diy-form:get-all-data-after-end", {
                        table: self.DiyTableModel && self.DiyTableModel.Name,
                        formKeys: formData ? Object.keys(formData).length : 0
                    });

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
                            (self.DiyCommon.IsNull(self.FieldActiveTab) || self.FieldActiveTab == "0" || self.FieldActiveTab == "none" || self.FieldActiveTab == "info" || !self.FieldActiveTab)
                        ) {
                            self.FieldActiveTab = self.GetShowTabs()[0].Id || self.GetShowTabs()[0].Name;
                        }
                    });
                    // console.log('准备传入表数据 - GetAllData:', self.DiyTableModel );

                    self.$emit("CallbackSetDiyTableModel", self.DiyTableModel);

                    //赋值前，重载地图控件,非常重要
                    if (self.DiyFieldList.length > 0) {
                        self.LoadMap = false;
                    }
                    self.$nextTick(function () {
                        //赋值前，重载地图控件,非常重要
                        self.LoadMap = true;
                        self.DiyFieldList = resultGetDiyField.Data;

                        // 字段数据源新位置
                        self.DiyCommon.SetFieldsData(self.DiyFieldList, formData);

                        // 初始化每个字段的属性（从计算属性移到这里，避免副作用）
                        self.DiyFieldList.forEach((field) => {
                            if (field) {
                                self.DiyCommon.EnsureFieldProperties(field, self.FormDiyTableModel, null);
                            }
                        });

                        self.RefreshDiyFieldRuntimeState();
                        formTrace("diy-form:runtime-refresh-after-fields", {
                            table: self.DiyTableModel && self.DiyTableModel.Name,
                            loadMode: self.LoadMode
                        });

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
                                    if (field.DefaultValue[0] == "{" || field.DefaultValue[0] == "[") {
                                        self.FormSet(field.Name, JSON.parse(field.DefaultValue));
                                    } else {
                                        self.FormSet(field.Name, field.DefaultValue);
                                    }
                                }
                            });
                            // 判断需要执行的V8
                            if (!self.DiyCommon.IsNull(self.DiyTableModel.InFormV8)) {
                                formTrace("diy-form:inform-v8-before", {
                                    table: self.DiyTableModel && self.DiyTableModel.Name,
                                    codeLength: self.DiyTableModel.InFormV8 ? self.DiyTableModel.InFormV8.length : 0
                                });
                                // 优化：创建独立的 V8 实例，避免污染基础对象
                                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                                V8.V8From = "DiyForm";
                                V8.EventName = "FormIn";

                                // 设置通用函数和动态属性
                                self.SetV8DefaultValue(V8);



                                try {
                                    // 执行用户的 InFormV8 代码
                                    await eval("(async () => {\n " + self.DiyTableModel.InFormV8 + " \n})();");
                                    formTrace("diy-form:inform-v8-end", {
                                        table: self.DiyTableModel && self.DiyTableModel.Name
                                    });
                                } catch (error) {
                                    formTrace("diy-form:inform-v8-error", {
                                        table: self.DiyTableModel && self.DiyTableModel.Name,
                                        message: error && error.message
                                    });
                                    self.DiyCommon.Tips(`执行前端V8引擎代码出现错误[${self.DiyTableModel.Name}-InFormV8]：` + error.message, false);
                                }
                                // 注意：不清理 window.V8，让用户的异步函数能持续访问
                            }
                            self.IsFirstLoadForm = false;
                        });

                        //     // clearInterval(timer1)
                        // // }, 300)

                        // 设置了tab后，等待 DOM 渲染完成
                        self.$nextTick(async function () {
                            //如果没有查询DiyTableRowModel，也要执行这个回调
                            //这里这个判断和 IF20210906 要保持一样
                            // if (!needGetDiyTableRowModel) {
                            if (callback) {
                                // var V8 = {};
                                var V8 = await self.DiyCommon.InitV8Code({});
                                self.SetV8DefaultValue(V8);
                                callback({
                                    CurrentRowModel: formData,
                                    V8: V8
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
            // 字段数据源移动位置
            // self.DiyCommon.SetFieldsData(resultGetDiyField.Data, formData);

            await resultGetDiyField.Data.forEach(async (field) => {
                self.DiyFieldStrToJson(field, formData, null); //, isPostSql

                //如果是代码编辑器，需要解密

                //处理表单模板引擎
                if (!self.DiyCommon.IsNull(field.V8TmpEngineForm)) {
                    var tmpResult = await self.RunFieldTemplateEngine(field, self.FormDiyTableModel);
                    self.FormDiyTableModel[field.Name + "_TmpEngineResult"] = tmpResult;
                }
                if (!self.DiyCommon.IsNull(field.Config.DevComponentName) && !self.DiyCommon.IsNull(field.Config.DevComponentPath)) {
                    //渲染定制组件
                    try {
                        //2022-06-22新增
                        field.Config.DevComponentPath = field.Config.DevComponentPath.replace("/views", "");

                        // removed debug log
                        //注意：'@/views' 会被编译，不能由服务器传过来
                        // ==================== 使用组件缓存池替代全局注册 ====================
                        var componentName = field.Config.DevComponentName;
                        var componentPath = field.Config.DevComponentPath;

                        // 从缓存池获取或创建组件
                        var cachedComponent;
                        if (!self.DiyCommon.IsNull(self.CustomComponent[componentName])) {
                            // 使用传入的自定义组件
                            cachedComponent = DynamicComponentCache.getOrCreate(componentName, componentPath, self.CustomComponent[componentName]);
                        } else {
                            // 动态加载组件
                            cachedComponent = DynamicComponentCache.getOrCreate(componentName, componentPath);
                        }

                        // 仍然需要全局注册以便在模板中使用 :is 动态组件
                        // 但现在组件实例是缓存的，不会重复创建
                        const app = window.__VUE_APP__;
                        if (app && !app._context.components[componentName]) {
                            app.component(componentName, cachedComponent);
                        }

                        // 记录到本地 DevComponents 用于模板条件判断
                        if (self.DiyCommon.IsNull(self.DevComponents[componentName])) {
                            self.DevComponents[componentName] = {
                                Name: "",
                                Path: ""
                            };
                        }
                        self.DevComponents[componentName].Name = componentName;
                        self.DevComponents[componentName].Path = componentPath;
                        // removed debug log
                    } catch (error) {
                        // removed debug log
                    }
                }
            });
            //注意：这里要把Id、CreateTime等默认字段也赋值
            if (formData) {
                self.DiyCommon.DefaultFieldNames.forEach((defaultF) => {
                    if (!self.DiyCommon.IsNull(formData[defaultF])) {
                        self.FormDiyTableModel[defaultF] = formData[defaultF];
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
        CommonV8CodeChange(item, field, v8codeKey) {
            var self = this;
            if (field.Config
                && (field.V8Code
                    ||field.Config.V8Code
                    || (v8codeKey && field.Config[v8codeKey])
                    )
                ) {
                self.RunV8Code({ field: field, thisValue: item, v8codeKey: v8codeKey });
            }
        },
        SelectChange(item, field) {
            var self = this;
            if ((field.Component == "Select"
                    || field.Component == "SelectTree"
                    || field.Component == "MultipleSelect")
                && (field.V8Code || field.Config.V8Code)) {
                self.RunV8Code({ field: field, thisValue: item });
            }
        },
        DeptChange(value, field) {
            var self = this;
            // self.CurrentSysUserModel.DeptName = '';
            if (!self.DiyCommon.IsNull(value) && value.length > 0) {
                var tObj = self.DiyCommon.ArrayDeepSearch(field.Data, "_Child", "Id", value[value.length - 1]);
                if (!self.DiyCommon.IsNull(tObj)) {
                    // self.CurrentSysUserModel.DeptName = tObj.Name;
                    // self.CurrentSysUserModel.DeptCode = tObj.Code;
                    if (field.V8Code || field.Config.V8Code) {
                        self.RunV8Code({ field: field, thisValue: tObj });
                    }
                }
            }
        },
        async RunV8Code({ field, thisValue, v8codeKey, _v8Code, callback }) {
            var self = this;
            if (!v8codeKey) {
                v8codeKey = "V8Code";
            }
            var v8Code = v8codeKey == 'V8Code' ? (field.V8Code || field.Config.V8Code) : field.Config[v8codeKey];

            if (_v8Code) {
                v8Code = _v8Code;
            }

            if (!self.DiyCommon.IsNull(v8Code) && !self.IsFirstLoadForm) {
                formTrace("diy-form:field-v8-before", {
                    table: self.DiyTableModel && self.DiyTableModel.Name,
                    field: field && field.Name,
                    component: field && field.Component,
                    v8codeKey: v8codeKey,
                    codeLength: v8Code ? v8Code.length : 0
                });
                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                V8.ThisValue = self.DiyCommon.IsNull(thisValue) ? "" : thisValue; // 这个是Select控制选择后的回调对象
                V8.EventName = "FieldValueChange";
                self.SetV8DefaultValue(V8, field);

                var result = null;
                try {
                    //eval(field.Config.V8Code)
                    var V8Result = await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + v8Code + " \n})()");
                    if (V8Result !== undefined) {
                        result = V8Result;
                        callback && callback(V8.Result || V8Result);
                    } else {
                        callback && callback(V8.Result);
                    }
                    formTrace("diy-form:field-v8-end", {
                        table: self.DiyTableModel && self.DiyTableModel.Name,
                        field: field && field.Name
                    });
                } catch (error) {
                    formTrace("diy-form:field-v8-error", {
                        table: self.DiyTableModel && self.DiyTableModel.Name,
                        field: field && field.Name,
                        message: error && error.message
                    });
                    self.DiyCommon.Tips("执行前端V8引擎代码出现错误[" + field.Name + "," + field.Label + "]：" + error.message, false);
                    callback && callback(null);
                } finally {


                }
                return result;
            }
        },
        //提交Form。{CloseForm:true, SavedType:'Insert/Update/View'}
        V8FormSubmit(param) {
            var self = this;
            try {
                self.$emit("CallbackFormSubmit", param);
            } catch (error) {
                // removed debug log
            }
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
        //             // removed debug log
        //         }
        //     })
        // },
        FieldSet(fieldName, attrName, value) {
            var self = this;
            var needRefreshRuntime = false;
            // 先查找出Field对象
            self.DiyFieldList.forEach((element) => {
                //2022-07-25：像JoinTable.TableId 这种赋值， attrName需要传入 'Config.JoinTable.TableId'
                if (element.Name == fieldName) {
                    if (attrName.indexOf("Config.") > -1) {
                        needRefreshRuntime = true;
                        var oldConfig = element.Config;
                        var attrArray = attrName.split(".");
                        if (attrArray.length == 2) {
                            oldConfig[attrArray[1]] = value;
                        } else if (attrArray.length == 3) {
                            oldConfig[attrArray[1]][attrArray[2]] = value;
                        } else if (attrArray.length == 4) {
                            oldConfig[attrArray[1]][attrArray[2]][attrArray[3]] = value;
                        } else if (tempArr.length == 5) {
                            oldConfig[attrArray[1]][attrArray[2]][attrArray[3]][attrArray[4]] = value;
                        }
                        element["Config"] = oldConfig;
                    } else {
                        element[attrName] = value;
                        if(attrName == 'Visible'
                            || attrName == 'AppVisible'
                            || attrName == 'Display'
                            || attrName == 'AppDisplay'
                        ){
                            needRefreshRuntime = true;
                            element['Visible'] = value;
                            element['AppVisible'] = value;
                            element['Display'] = value;
                            element['AppDisplay'] = value;
                        }
                    }
                }
            });
            if (needRefreshRuntime && typeof self.RefreshDiyFieldRuntimeState === 'function') {
                self.RefreshDiyFieldRuntimeState();
            }
        },
        NumberTextChange(currentValue, oldValue, field) {
            var self = this;
            if (field.Component == "NumberText" && (field.V8Code || field.Config.V8Code)) {
                self.RunV8Code({
                    field: field,
                    thisValue: {
                        New: currentValue,
                        Old: oldValue
                    }
                });
            }
        },
        ApplyVersionData(rowData) {
            var self = this;
            if (!rowData) {
                return;
            }
            var data = JSON.parse(JSON.stringify(rowData));
            if (data.Id) {
                self.FormDiyTableModel.Id = self.TableRowId || data.Id;
            }
            (self.DiyFieldList || []).forEach(function (field) {
                if (!field || !field.Name) return;
                if (Object.prototype.hasOwnProperty.call(data, field.Name)) {
                    self.FormDiyTableModel[field.Name] = data[field.Name];
                }
            });
            self.$emit("CallbackSetFormData", self.FormDiyTableModel);
        },
        GetDraftData() {
            var self = this;
            var data = {};
            if (self.TableRowId || self.FormDiyTableModel.Id) {
                data.Id = self.TableRowId || self.FormDiyTableModel.Id;
            }
            (self.DiyFieldList || []).forEach(function (field) {
                if (!field || !field.Name) return;
                if (Object.prototype.hasOwnProperty.call(self.FormDiyTableModel, field.Name)) {
                    data[field.Name] = self.FormDiyTableModel[field.Name];
                }
            });
            return JSON.parse(JSON.stringify(data));
        },
        FormSet(fieldName, value, field) {
            var self = this;
            formTrace("diy-form:form-set", {
                table: self.DiyTableModel && self.DiyTableModel.Name,
                field: fieldName,
                component: field && field.Component,
                valueType: Array.isArray(value) ? "array" : typeof value
            });
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
                            self.$refs["ref_" + fieldName][0].CommonV8CodeChange(value, field);
                        } catch (error) {}
                    }
                    //2022-08-18：如果是给下拉单选框赋值了，并且下拉Data中不包含这条数据，那么这里就push一下
                    if (field.Component == "Select" && field.Config.SelectSaveField && field.Config.SelectLabel && value && value[field.Config.SelectSaveField]) {
                        var findModel = _.find(field.Data, function (item) {
                            return item[field.Config.SelectSaveField] == value[field.Config.SelectSaveField];
                        });
                        if (!findModel) {
                            field.Data.push(value);
                        } else {
                            //2022-09-02修复Bug：在网络较快时，field.Data赋值比FormSet先执行，
                            //然后用户又只赋值一个Id，并不给SelectLabel赋值，这时候仍然以field.Data为准。
                            //但若用户赋值了SelectLabel，则以用户赋值的为准，而不是field.Data数据源
                            if (!findModel[field.Config.SelectLabel] && value[field.Config.SelectLabel]) {
                                findModel[field.Config.SelectLabel] = value[field.Config.SelectLabel];
                            }
                        }
                    }
                }
            } catch (error) {}
            self.$nextTick(async function () {
                //处理表单模板引擎   2022-07-15新增
                //2023-04-01：如果在模板引擎中写V8.FormSet，这会导致死循环
                if (field && field.V8TmpEngineForm && !(field.V8TmpEngineForm.indexOf("V8.FormSet") > -1)) {
                    var tmpResult = await self.RunFieldTemplateEngine(field, self.FormDiyTableModel);
                    self.FormDiyTableModel[field.Name + "_TmpEngineResult"] = tmpResult;
                }
            });
            if (self.ModifiedFields && !(self.ModifiedFields.indexOf(fieldName) > -1)) {
                self.ModifiedFields.push(fieldName);
            }
        },
        //注意：这里是触发子表的ParentFormSet（现在是以子表单的身份），但最终还是最回调到此页面的FormSet
        ParentFormSet(fieldName, value) {
            var self = this;
            // self.$set(self.FormDiyTableModel, fieldName, value) // 0
            self.$emit("ParentFormSet", fieldName, value);
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

            const isLtMax = file.size / 1024 / 1024 < (!self.DiyCommon.IsNull(field.Config.ImgUpload.MaxSize) ? field.Config.ImgUpload.MaxSize : self.DiyCommon.UploadImgMaxSize);
            if (!isJPG) {
                self.DiyCommon.Tips(self.$t("Msg.FormatError") + file.type, false);
                return false;
            }
            if (!isLtMax) {
                self.DiyCommon.Tips(
                    self.$t("Msg.MaxSize") + (!self.DiyCommon.IsNull(field.Config.ImgUpload.MaxSize) ? field.Config.ImgUpload.MaxSize : self.DiyCommon.UploadImgMaxSize) + "MB!",
                    false
                );
                return false;
            }

            //新增文件、图片上传前V8事件  --2023-03-24
            if (field.Config && field.Config.Upload && field.Config.Upload.BeforeUploadV8) {
                // var v8 = self.RunV8CodeSync(field, file, "", field.Config.Upload.BeforeUploadV8);
                // if (v8.Result === false) {
                //     return false;
                // }
            }

            self.DiyCommon.Tips(self.$t("Msg.Uploading"));
            var result = isJPG && isLtMax;
            if (result) {
                // field.Config.ImgUpload.ShowFileList = true;
                //如果是单图片
                if (!self.getMultipleFlag(field, "ImgUpload")) {
                    // removed debug log
                    // self.FormDiyTableModel[field.Name] = './static/img/loading.gif';//注意此值不能随意修改，有很多地方直接用此值做判断
                    self.FormDiyTableModel[field.Name] = "./static/img/loading.gif";
                } else if (self.getMultipleFlag(field, "ImgUpload")) {
                    // removed debug log
                    //name,size
                    if (!Array.isArray(self.FormDiyTableModel[field.Name])) {
                        if (self.FormDiyTableModel[field.Name + "_UploadLock"]) {
                            // removed debug logs
                        } else {
                            // removed debug logs
                            // self.FormDiyTableModel[field.Name] = [];
                            self.FormDiyTableModel[field.Name] = [];
                        }
                    }
                    self.FormDiyTableModel[field.Name].push({
                        Id: file.uid,
                        State: 0, //等待上传
                        Name: file.name,
                        // Size : self.DosCommon.GetFileSize(file.size),
                        Size: file.size,
                        Path: "./static/img/loading.gif" //注意此值不能随意修改，有很多地方直接用此值做判断
                    });
                    // 同步设置 per-file RealPath 占位，避免模板在渲染时读取到 undefined
                    try {
                        self.FormDiyTableModel[field.Name + "_" + file.uid + "_RealPath"] = "./static/img/loading.gif";
                    } catch (e) {}
                } else {
                    // removed debug log
                    self.FormDiyTableModel[field.Name] = "./static/img/loading.gif";
                    self.FormDiyTableModel[field.Name].push({
                        Id: file.uid,
                        State: 0, //等待上传
                        Name: file.name,
                        // Size : self.DosCommon.GetFileSize(file.size),
                        Size: file.size,
                        Path: "./static/img/loading.gif" //注意此值不能随意修改，有很多地方直接用此值做判断
                    });
                }
            }
            return result;
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
                    await self.DiyCommon.PostAsync("/api/FormEngine/NewGuid", {}, function (result) {
                        if (self.DiyCommon.Result(result)) {
                            formParam.TableRowId = result.Data;
                            self.$nextTick(async function () {
                                await self.FormSubmitFuncton(formParam, callback);
                            });
                        } else {
                            self.SaveLoading = false;
                        }
                    });
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
                await self.DiyCommon.PostAsync("/api/FormEngine/NewGuid", {}, function (result) {
                    if (self.DiyCommon.Result(result)) {
                        formParam.TableRowId = result.Data;
                        self.$nextTick(async function () {
                            await self.FormSubmitFuncton(formParam, callback);
                        });
                    } else {
                        callback({ Code: 0, Msg: result.Msg });
                    }
                });
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
            } else if (formParam.FormMode == "Add" || formParam.FormMode == "Insert") {
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

                if (self.DiyTableModel.ApiReplace && self.DiyTableModel.ApiReplace.Insert) {
                    url = self.DiyCommon.RepalceUrlKey(self.DiyTableModel.ApiReplace.Insert);
                }
                if (self.ApiReplace && self.ApiReplace.AddDiyTableRow) {
                    url = self.DiyCommon.RepalceUrlKey(self.ApiReplace.AddDiyTableRow);
                }
                //这里改为这个判断 ，是因为新增数据，也可能会提前生成TableRowId，以方便新增主表时可以操作子表的增加
                if (formParam.FormMode == "Edit" || formParam.FormMode == "View") {
                    //!self.DiyCommon.IsNull(self.TableRowId)
                    url = self.DiyApi.UptDiyTableRow;
                    // param._TableRowId = self.TableRowId
                    if (!self.DiyCommon.IsNull(self.DiyTableModel.ApiReplace.Update)) {
                        url = self.DiyCommon.RepalceUrlKey(self.DiyTableModel.ApiReplace.Update);
                    }
                    if (!self.DiyCommon.IsNull(self.ApiReplace.UptDiyTableRow)) {
                        url = self.DiyCommon.RepalceUrlKey(self.ApiReplace.UptDiyTableRow);
                    }
                    if (self.ApiReplace && self.ApiReplace.Update) {
                        url = self.DiyCommon.RepalceUrlKey(self.ApiReplace.Update);
                    }
                }

                if (self.ApiReplace && self.ApiReplace.Submit) {
                    url = self.DiyCommon.RepalceUrlKey(self.ApiReplace.Submit);
                }

                if (!self.DiyCommon.IsNull(formParam.SubmitUrl)) {
                    url = self.DiyCommon.RepalceUrlKey(formParam.SubmitUrl);
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
                    var v8Result = await self.FormSubmitAction(actionType, formParam.TableRowId);
                    if (v8Result === false || (v8Result && (v8Result.Code === 0 || (v8Result.Code && v8Result.Code != 1)))) {
                        formParam.SaveLoading = false;
                        if (v8Result && v8Result.Msg) {
                            self.DiyCommon.Tips(v8Result.Msg, false);
                        }
                        callback(false);
                        return;
                    }

                    var formDiyTableModel = formData;

                    self.DiyCommon.ForRowModelHandler(formDiyTableModel, self.DiyFieldList);

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
                            if (param._FormData[key] != self.OldFormData[key] && !key.endsWith("_RealPath") && !key.endsWith("_TmpEngineResult")) {
                                if (param._FormData[key] != undefined && self.OldFormData[key] != undefined) {
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
                                        NVal: param._FormData[key] || "" //新值
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
                                // if (param.FormMode == "Edit" && !self.DiyCommon.IsNull(self.DiyTableModel.UptCallbakApi)) {
                                //   //!self.DiyCommon.IsNull(self.TableRowId)
                                //   param.Id = param._TableRowId;
                                //   self.DiyCommon.Post(self.DiyTableModel.UptCallbakApi, param, function (apiResult) {
                                //     if (self.DiyCommon.Result(apiResult)) {
                                //     }
                                //   });
                                // }
                                // else if ((param.FormMode == "Add" || param.FormMode == "Insert") && !self.DiyCommon.IsNull(self.DiyTableModel.AddCallbakApi)) {
                                //   //self.DiyCommon.IsNull(self.TableRowId)
                                //   param.Id = result.Data.Id;
                                //   self.DiyCommon.Post(self.DiyTableModel.AddCallbakApi, param, function (apiResult) {
                                //     if (self.DiyCommon.Result(apiResult)) {
                                //     }
                                //   });
                                // }
                            } catch (error) {
                                // removed debug logs
                            }

                            //--------------end

                            self.DiyCommon.Tips(self.$t("Msg.Success"));
                            //2021-02-27新增，在下面的事件之前执行表单离开事件，否则取到的数据可能被修改掉，如Id
                            var outFormV8Result = await self.FormOutAction(actionType, formParam.SavedType, formParam.TableRowId, formParam.V8Callback);

                            // if (self.FormMode == 'Edit') {//!self.DiyCommon.IsNull(self.TableRowId)
                            //     self.CloseFieldForm(null, 'Update', self.TableRowId);
                            // }else{
                            //     self.CloseFieldForm(null, 'Insert',self.TableRowId);
                            // }
                            // if (param.IsClose === true) {
                            //     // self.ShowFieldForm = false
                            //     // self.ShowFieldFormDrawer = false
                            // }else{
                            if (formParam.SavedType == "Insert" || formParam.SavedType == "Add") {
                                formParam.TableRowId = "";
                                formParam.FormMode = "Add";
                                self.DiyCommon.Post("/api/FormEngine/NewGuid", {}, async function (result) {
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
                                });
                            } else {
                                //这里要重新加载Field-Form
                                //不但要修改Field-Form绑定的那些值
                                //还要把自身的Prop值也修改了？
                                if (!self.DiyCommon.IsNull(result.Data) && !self.DiyCommon.IsNull(result.Data.Id)) {
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
                                // 2026-01-26 Anderson：这个bug存在好几年了，关闭的时候不重新初始化表单
                                if(formParam.SavedType != 'Close'){
                                    self.$nextTick(function () {
                                        self.Init(true);
                                    });
                                }

                            }
                        } else {
                            callback(false);
                        }
                    }
                    if (self.EventReplace && self.EventReplace.Submit) {
                        var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                        V8.EventName = "FormSubmitBefore";
                        self.SetV8DefaultValue(V8);

                        //传入V8、Param、callback,  必须执行SubmitCallback(DosResult)
                        let result = self.EventReplace.Submit(V8, param, SubmitCallback);
                    } else if (typeof formParam._AlternateSubmit === "function") {
                        // 事务合并钩子：把已构建好的 url/param 交给外部（如工作流合并端点），由其完成HTTP并回传 DosResult
                        try {
                            formParam._AlternateSubmit(url, param, async function (result) {
                                SubmitCallback(result);
                            });
                        } catch (e) {
                            formParam.SaveLoading = false;
                            callback(false);
                        }
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
                return;
            } catch (error) {
                formParam.SaveLoading = false;
                // removed debug log
            }
        },
        CallbackFormValueChange(field, thisValue) {
            var self = this;
            if (self.ModifiedFields && !(self.ModifiedFields.indexOf(field.Name) > -1)) {
                self.ModifiedFields.push(field.Name);
            }
            self.$emit("CallbackFormValueChange", field, thisValue);
            // zhy修复单选按钮第一次点击了值却仍然弹出提示的问题（如果该字段存在校验规则，则主动触发 el-form 的 validateField）
            try {
                if (field && field.Name && self.FormRules && self.FormRules[field.Name]) {
                    var formRef = self.$refs.FormDiyTableModel;
                    if (Array.isArray(formRef)) {
                        formRef.forEach(function (f) {
                            try {
                                if (f && typeof f.validateField === 'function') f.validateField(field.Name);
                            } catch (e) {}
                        });
                    } else if (formRef && typeof formRef.validateField === 'function') {
                        formRef.validateField(field.Name);
                    }
                }
            } catch (e) {
                // ignore
            }
        },
        async ComponentQrcodeButtonClick(field, action) {
            await this.$nextTick(); // 等待 `handleQrCodeImageBase64` 赋值完成
            field.DataAppend.qrCodeImageBase64 = this.qrCodeImageBase64;
            this.RunV8Code({ field: field });
        }
    }
};
</script>
<style lang="scss" scoped src="./styles/diy-form.scss"></style>
