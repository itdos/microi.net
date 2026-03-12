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
                                        :class="'field-drag-handle design-mode-field ' + (CurrentDiyFieldModel.Id == field.Id ? field._activeClass + ' selected-field' : field._class)"
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
                                                :ParentFieldList="DiyFieldList"
                                                :CodeEditorMini="CodeEditorMini"
                                                @CallbackRunV8Code="RunV8Code"
                                                @CallbackFormValueChange="CallbackFormValueChange"
                                                @CallbakOnKeyup="FieldOnKeyup"
                                                @OpenTableEventByInput="OpenTableEventByInput"
                                                @ParentFormSet="FormSet"
                                                @CallbackParentFormSubmit="CallbackParentFormSubmit"
                                                @CallbakRefreshChildTable="CallbakRefreshChildTable"
                                                @CallbackShowTableChildHideField="ShowTableChildHideField"
                                            />
                                        </el-form-item>
                                    </div>
                                    </el-col>
                                </template>
                            </draggable>
                            
                            <!-- 普通模式：使用原生 el-row 以获得最佳性能 -->
                            <el-row v-else :gutter="10" @click="handleFieldClick">
                                <el-col
                                    v-for="field in DiyFieldListGrouped[tab.Id || tab.Name] || []"
                                    v-show="field._isShow"
                                    :class="CurrentDiyFieldModel.Id == field.Id ? field._activeClass : field._class"
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
                                            <component
                                                :is="GetFieldComponent(field)"
                                                :ref="'ref_' + field.Name"
                                                v-model="FormDiyTableModel[field.Name]"
                                                :TableInEdit="false"
                                                :field="field"
                                                :FormDiyTableModel="FormDiyTableModel"
                                                :FormData="FormDiyTableModel"
                                                :FormMode="FormMode"
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
                                                :ParentFieldList="DiyFieldList"
                                                :CodeEditorMini="CodeEditorMini"
                                                @CallbackRunV8Code="RunV8Code"
                                                @CallbackFormValueChange="CallbackFormValueChange"
                                                @CallbakOnKeyup="FieldOnKeyup"
                                                @OpenTableEventByInput="OpenTableEventByInput"
                                                @ParentFormSet="FormSet"
                                                @CallbackParentFormSubmit="CallbackParentFormSubmit"
                                                @CallbakRefreshChildTable="CallbakRefreshChildTable"
                                                @CallbackShowTableChildHideField="ShowTableChildHideField"
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
        <DiyFormDialog v-if="_shouldRenderDiyFormDialog" ref="refDiyTable_DiyFormDialog" :ParentV8="GetV8()"></DiyFormDialog>
    </div>
</template>

<script>
import draggable from "vuedraggable";
import { defineAsyncComponent, computed, shallowRef, markRaw } from "vue";
import _ from "underscore";
import { useDiyStore } from "@/pinia";

// 使用共享的组件缓存池，避免重复创建导致的内存泄漏
import DynamicComponentCache from "@/utils/dynamicComponentCache.js";
import { initV8ScanCode } from "@/utils/v8-scan-code.js";
import { initV8Print } from "@/utils/v8-print.js";

// Mixins
import { diyCommonMixin, formUtilsMixin } from "./mixins";

export default {
    // name: "DiyForm",
    directives: {},
    mixins: [diyCommonMixin, formUtilsMixin],
    components: {
        draggable,
    },
    setup() {
        const diyStore = useDiyStore();
        const SysConfig = computed(() => diyStore.SysConfig);
        const GetCurrentUser = computed(() => diyStore.GetCurrentUser);
        return { diyStore, SysConfig, GetCurrentUser, DynamicComponentCache };
    },
    computed: {
        // ==================== 性能优化：预计算根元素 class ====================
        rootClass() {
            var self = this;
            var classes = [
                'itdos-diy-form',
                'diy-form'
            ];
            if (!self.DiyCommon.IsNull(self.TableId)) {
                classes.push('itdos-diy-form-' + self.TableId);
            }
            if (!self.DiyCommon.IsNull(self.TableName)) {
                classes.push('itdos-diy-form-' + self.TableName);
            }
            classes.push(self.DiyCommon.IsNull(self.DiyTableModel.InputBorderStyle) ? 'Border' : self.DiyTableModel.InputBorderStyle);
            return classes.join(' ');
        },
        // ==================== 性能优化：预计算 tabs class ====================
        tabsClass() {
            var self = this;
            if (self.FormTabs.length == 1 && 
                (self.FormTabs[0].Name == 'none' || self.FormTabs[0].Name == 'info' || !self.FormTabs[0].Name)) {
                return 'field-form-tabs tab-pane-hide';
            }
            return 'field-form-tabs tab-pane-show';
        },
        // ==================== 性能优化：预计算表单容器 class ====================
        formContainerClass() {
            var self = this;
            var classes = [self.DiyTableModel.Name || '', 'field-form'];
            if (self.DiyTableModel.FieldBorder === 'Border') {
                classes.push('field-border');
            }
            return classes.join(' ');
        },
        GetDiyFieldListObject: {
            get() {
                var self = this;
                var result = {};
                self.DiyFieldList.forEach((element) => {
                    result[element.Name] = element;
                });
                return result;
            }
        },
        // 性能优化：预先按 tab 分组字段，避免在 v-for 中每次渲染都重新计算
        // 同时预计算每个字段的显示状态、span、class 等，减少模板中的方法调用
        // 🔥 新增：支持分批渲染，首次只渲染部分字段，后续按需加载
        // ⚠️ 内存优化：避免在计算属性中创建闭包，使用纯计算逻辑
        DiyFieldListGrouped() {
            var self = this;
            var grouped = {};

            // 边界检查：确保数据已初始化
            if (!self.DiyFieldList || self.DiyFieldList.length === 0) {
                return grouped;
            }

            // 使用 FormTabs 而非 GetShowTabs()，确保与模板中的 v-for 一致
            var showTabs = self.FormTabs;
            if (!showTabs || showTabs.length === 0) {
                return grouped;
            }

            // 触发依赖收集：确保这些属性变化时重新计算
            // ⚠️ 内存优化：不要在这里创建数组，只读取值
            var _deps = [
                self.ColSpan,
                self.DiyTableModel.ColSpan,
                self.ShowFields.length,
                self.HideFields.length,
                self.DiyTableModel.DisplayDefaultField
            ];
            // 🔥 渲染字段数量变化时重新计算（使用 JSON.stringify 避免对象引用）
            var _renderedCountsKey = JSON.stringify(self.renderedFieldCounts);

            var tabNameSet = new Set();

            // 收集所有有效的 tab 标识
            showTabs.forEach((tabModel) => {
                if (tabModel) {
                    tabNameSet.add(tabModel.Name);
                    tabNameSet.add(tabModel.Id);
                }
            });

            // 初始化每个 tab 的数组
            showTabs.forEach((tab) => {
                if (tab) {
                    var key = tab.Id || tab.Name;
                    if (key) {
                        grouped[key] = [];
                    }
                }
            });

            // 预计算常用值，避免循环中重复计算
            var isDesignMode = self.LoadMode === "Design";
            
            // 防御性检查：确保所有必要的数据都已准备好
            if (!self.DiyTableModel || typeof self.DiyTableModel !== 'object' || self.DiyTableModel instanceof Promise) {
                return grouped;
            }
            if (!self.DiyCommon || !self.GetCurrentUser) {
                return grouped;
            }
            
            var displayDefaultField = self.DiyTableModel.DisplayDefaultField;
            var defaultFieldNames = self.DiyCommon.DefaultFieldNames || [];
            var isAdmin = self.GetCurrentUser._IsAdmin === true;
            var userRoles = self.GetCurrentUser._Roles || [];
            var defaultColSpan = self.DiyTableModel.ColSpan || 12;
            var propsColSpan = self.ColSpan;

            // 遍历字段，分配到对应的 tab，并预计算属性
            self.DiyFieldList.forEach((field) => {
                // 🔥 添加字段有效性检查
                if (!field || typeof field !== 'object') {
                    console.warn('[diy-form] DiyFieldListGrouped: 跳过无效字段', field);
                    return;
                }

                // 判断字段是否应该显示（在 ShowFields/HideFields 中）
                var shouldShow = self.ShowHideField === true || 
                    ((self.ShowFields.length === 0 || self.ShowFields.indexOf(field.Name) > -1) && 
                     self.HideFields.indexOf(field.Name) === -1);

                if (!shouldShow) return;

                // ==================== 预计算 _isShow ====================
                var isShow = true;
                // 检查是否是默认审计字段
                if (defaultFieldNames.indexOf(field.Name) > -1 && !displayDefaultField) {
                    isShow = false;
                } else if (isDesignMode) {
                    isShow = true;
                } else if (!self.DiyCommon.IsNull(field.BindRole) && field.BindRole.length > 0) {
                    // 检查角色权限
                    if (!isAdmin) {
                        var haveLimit = false;
                        if (userRoles.length > 0) {
                            for (var i = 0; i < field.BindRole.length; i++) {
                                for (var j = 0; j < userRoles.length; j++) {
                                    if (userRoles[j].Id && userRoles[j].Id.toLowerCase() === field.BindRole[i].toLowerCase()) {
                                        haveLimit = true;
                                        break;
                                    }
                                }
                                if (haveLimit) break;
                            }
                        }
                        if (!haveLimit) {
                            isShow = false;
                        }
                    }
                }
                // 最终检查 Visible 属性
                if (isShow && !isDesignMode) {
                    isShow = self.DiyCommon.IsNull(field.Visible) ? true : field.Visible;
                }
                field._isShow = isShow;

                // ==================== 预计算 _span ====================
                field._span = self.GetDiyTableColumnSpan(field);

                // ==================== 预计算 _class ====================
                var fieldClass = 'field-item field_' + field.Name + ' field_' + field.Component;
                field._class = fieldClass;
                field._activeClass = fieldClass + ' active-field';

                // 找到字段所属的 tab
                var assigned = false;
                showTabs.forEach((tab) => {
                    if (!tab) return;
                    var key = tab.Id || tab.Name;
                    if (key && grouped[key] && (field.Tab === tab.Name || field.Tab === tab.Id)) {
                        grouped[key].push(field);
                        assigned = true;
                    }
                });

                // 如果没有分配到任何 tab，放到第一个 tab
                if (!assigned && showTabs.length > 0) {
                    var firstTab = showTabs[0];
                    if (firstTab) {
                        var firstKey = firstTab.Id || firstTab.Name;
                        // 未分配的字段都放到第一个 tab
                        if (firstKey && grouped[firstKey]) {
                            grouped[firstKey].push(field);
                        }
                    }
                }
            });

            // 🔥 关键修复：分组后按 Sort 值排序，确保拖动后顺序正确持久化
            showTabs.forEach((tab) => {
                var key = tab.Id || tab.Name;
                if (key && grouped[key]) {
                    grouped[key].sort((a, b) => (a.Sort || 0) - (b.Sort || 0));
                }
            });

            // 🔥 性能优化：分批渲染 - 只返回已渲染的字段
            // 对每个 tab 的字段列表进行截取，实现渐进式渲染
            var limitedGrouped = {};
            showTabs.forEach((tab) => {
                var key = tab.Id || tab.Name;
                if (key && grouped[key]) {
                    var allFields = grouped[key];
                    var renderedCount = self.renderedFieldCounts[key] || self.BATCH_SIZE_FIRST;
                    // 限制返回的字段数量
                    limitedGrouped[key] = allFields.slice(0, renderedCount);
                    
                    // 如果还有未渲染的字段，安排下一批渲染
                    if (renderedCount < allFields.length && !self._isDestroyed) {
                        self.safeTimeout(() => {
                            if (self._isDestroyed) return;
                            self.renderedFieldCounts[key] = Math.min(
                                renderedCount + self.BATCH_SIZE_NEXT,
                                allFields.length
                            );
                        }, 100); // 100ms 后渲染下一批
                    }
                }
            });

            return limitedGrouped;
        },
    },
    props: {
        CodeEditorMini: {
            type: Boolean,
            default: false
        },
        // AutoInit: {
        //     type: Boolean,
        //     default: true
        // },
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
    data() {
        const self = this;
        return {
            // 宽度调整相关
            resizingField: null,
            resizeStartX: 0,
            resizeStartWidth: 0,
            
            currentTabIndex: 0,
            PageType: "", //可以是Report
            FormTabs: [],
            // 性能优化：跟踪已渲染的标签页，实现懒加载
            // Set 结构存储已渲染的 tab id/name，首次只渲染第一个 tab
            renderedTabs: new Set(),
            // 性能优化：渐进式渲染字段
            // 每个 tab 已渲染的字段数量（tab key -> number）
            renderedFieldCounts: {},
            // 每批渲染的字段数量（首批20个，后续每批10个）
            BATCH_SIZE_FIRST: 20,
            BATCH_SIZE_NEXT: 10,
            BtnLoading: false,
            GetDiyTableRowModelFinish: false,
            DiyCustomDialogConfig: {},
            NotSaveField: [],
            DiyImgUploadRealPath: [],
            DiyFileUploadRealPath: [],
            LoadMap: true,
            pageLifetimes: {
                show: function (e) {}
            },
            DevComponents: {},
            IsFirstLoadForm: true,
            // V8 基础对象实例（存储通用函数，避免每次重新创建）
            _V8BaseInstance: null,
            searchOption: {
                // city: '宁波', //默认全国
                // citylimit: true //默认false
            },
            AmapDefaultCenter: [121.547481, 29.809263],
            BaiduMapDefaultCenter: {
                lng: 121.547481,
                lat: 29.809263
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
                imageUrlPrefix: this.DiyCommon.GetFileServer(), // "https://static.itdos.com/", // by itdos.com
                scrawlUrlPrefix: this.DiyCommon.GetFileServer(), //"https://static.itdos.com/",
                videoUrlPrefix: this.DiyCommon.GetFileServer(), //"https://static.itdos.com/",
                fileUrlPrefix: this.DiyCommon.GetFileServer() //"https://static.itdos.com/",
            },
            FieldActiveTab: "",
            // 这是最终表单填写后的值. 这里命令可能有点问题，应该是取名CurrentDiyTableRowModel？
            //2020-07-28 这里临时注释 ，采用computed去实现，
            FormDiyTableModel: {},
            OldForm: {},
            OldFormData: {},
            DiyTableModel: {
                Tabs: []
            },
            DiyFieldList: [],
            LoadDiyFieldList: false,
            CurrentDiyFieldModel: {},
            // CurrentDiyTableRowModel:{},//2020-07-09：这个存在的意义是什么？暂时注释
            FormRules: {},
            ModifiedFields: [],
            // 用于存储需要清理的定时器
            _pendingTimers: [],
            // 用于标记组件是否已销毁
            _isDestroyed: false,
            // 用于存储需要清理的 watcher 取消函数
            _unwatchCallbacks: [],
            // 字段操作工具栏状态
            fieldToolbarVisible: false,
            fieldToolbarPosition: { top: 0, left: 0 },
            selectedFieldForToolbar: null,
            // 宽度调整
            isResizingWidth: false,
            resizeStartX: 0,
            resizeStartWidth: 0,
            
            // 延迟渲染 DiyFormDialog，防止 Page 模式下无限嵌套
            _shouldRenderDiyFormDialog: false
        };
    },
    beforeCreate() {
        var self = this;
    },
    beforeUpdate() {},
    beforeEnter: (to, from, next) => {},
    // Vue 3: 使用 unmounted 替代 destroyed
    unmounted() {},
    // Vue 3: 使用 beforeUnmount 替代 beforeDestroy（这是最关键的修复！）
    beforeUnmount() {
        var self = this;
        // 标记组件已销毁
        self._isDestroyed = true;
        
        // ========== 0. 清理所有待执行的定时器 ==========
        if (self.DiyFieldList && self.DiyFieldList.length > 0) {
            self.DiyFieldList.forEach((field) => {
                try {
                    // 清理百度地图
                    if (field.BaiduMapConfig) {
                        if (field.BaiduMapConfig._map) {
                            field.BaiduMapConfig._map = null;
                        }
                        if (field.BaiduMapConfig._BMap) {
                            field.BaiduMapConfig._BMap = null;
                        }
                        field.BaiduMapConfig = null;
                    }
                    // 清理高德地图
                    if (field.AmapConfig) {
                        field.AmapConfig = null;
                    }
                    // 清理字段的其他大对象引用
                    if (field.Data && Array.isArray(field.Data)) {
                        field.Data.length = 0;
                        field.Data = null;
                    }
                    // 清理字段配置中的大对象
                    if (field.Config) {
                        // 清理子表配置
                        if (field.Config.TableChild) {
                            field.Config.TableChild.Data = null;
                            field.Config.TableChild = null;
                        }
                        // 清理关联表配置
                        if (field.Config.JoinTable) {
                            field.Config.JoinTable = null;
                        }
                        // 清理弹出表格配置
                        if (field.Config.OpenTable) {
                            field.Config.OpenTable.PropsWhere = null;
                            field.Config.OpenTable = null;
                        }
                        field.Config = null;
                    }
                    // 清理父级引用
                    field._ParentFormModel = null;
                } catch (e) {
                    /* ignore */
                }
            });
            // 清空数组
            self.DiyFieldList.length = 0;
        }

        // ========== 3. 清理表单数据 ==========
        // 清理 FormDiyTableModel 中的所有属性
        if (self.FormDiyTableModel) {
            Object.keys(self.FormDiyTableModel).forEach((key) => {
                try {
                    delete self.FormDiyTableModel[key];
                } catch (e) {
                    self.FormDiyTableModel[key] = null;
                }
            });
            self.FormDiyTableModel = {};
        }

        // ========== 4. 清理字段列表 ==========
        self.DiyFieldList = [];
        self.FormTabs = [];
        self.FormRules = {};
        self.ModifiedFields = [];

        // ========== 5. 清理表模型 ==========
        if (self.DiyTableModel) {
            self.DiyTableModel.Tabs = [];
            self.DiyTableModel = { Tabs: [] };
        }

        // ========== 6. 清理历史数据 ==========
        self.OldForm = {};
        self.OldFormData = {};

        // ========== 7. 清理动态组件引用 ==========
        // 注意：全局注册的组件无法卸载，但清理本地引用可减少内存占用
        if (self.DevComponents) {
            Object.keys(self.DevComponents).forEach((key) => {
                try {
                    delete self.DevComponents[key];
                } catch (e) { /* ignore */ }
            });
        }
        self.DevComponents = {};

        // ========== 8. 清理上传相关 ==========
        self.DiyImgUploadRealPath = [];
        self.DiyFileUploadRealPath = [];

        // ========== 9. 清理自定义对话框配置 ==========
        self.DiyCustomDialogConfig = {};

        // ========== 10. 清理当前字段模型 ==========
        self.CurrentDiyFieldModel = {};
        
        // ========== 10.5 🔥 真正的内存泄漏修复：清理全局事件监听器 ==========
        // 清理全局点击事件（如果有绑定的话）
        if (self._globalClickHandler) {
            document.removeEventListener('click', self._globalClickHandler);
            self._globalClickHandler = null;
        }
        
        // ========== 10.6 清理 V8 基础实例（但不清理 V8 对象本身） ==========
        // 注意：_V8BaseInstance 是组件级别的缓存，需要清理
        // 但不清理用户代码中的 V8 对象（那些会自动GC）
        if (self._V8BaseInstance) {
            // 只清理闭包引用，不清理对象本身
            Object.keys(self._V8BaseInstance).forEach((key) => {
                try {
                    // 只清理函数引用（这些持有 self 的闭包）
                    if (typeof self._V8BaseInstance[key] === 'function') {
                        self._V8BaseInstance[key] = null;
                    }
                } catch (e) {
                    /* ignore */
                }
            });
            self._V8BaseInstance = null;
        }
        
        // ========== 11. 清理已渲染标签页记录 ==========
        if (self.renderedTabs) {
            self.renderedTabs.clear();
        }
        // 🔥 新增：清理渲染字段计数
        self.renderedFieldCounts = {};

        // ========== 12. 清理子组件引用 ==========
        // 清理通过 $refs 持有的子组件引用，并主动调用子组件的清理方法
        // 注意：Vue 3 中 $refs 是只读的，不能设置为 null
        if (self.$refs) {
            Object.keys(self.$refs).forEach((key) => {
                try {
                    // 检查是否是字段组件的 ref (统一使用 ref_ 前缀)
                    if (key.startsWith('ref_')) {
                        var refComponent = self.$refs[key];
                        // Vue 3 中 ref 可能是数组
                        if (Array.isArray(refComponent)) {
                            refComponent.forEach(comp => {
                                if (comp && typeof comp.Clear === 'function') {
                                    try { comp.Clear(); } catch(e) {}
                                }
                            });
                            // 清空数组内容（不是设置为 null）
                            refComponent.length = 0;
                        } else if (refComponent && typeof refComponent.Clear === 'function') {
                            try { refComponent.Clear(); } catch(e) {}
                        }
                        // Vue 3 中不能设置 $refs[key] = null，会报错
                    }
                } catch (e) { /* ignore */ }
            });
        }

        // ========== 12. Vue 3 不需要恢复 $set 方法 ==========
        // Vue 3 的响应式系统不再需要 $set
        console.log("Microi：[DiyForm] 组件已销毁，相关资源已清理");
    },
    beforeRouteLeave(to, from, next) {
        // ...
    },
    mounted() {
        var self = this;
        self.PageType = self.$route.query.PageType;
        self.$nextTick(function () {
            // removed debug log
        });
        // Vue 3 不再需要 $set，此调试代码已跳过
        // 在 Vue 3 中，响应式系统可以自动追踪属性的添加和删除
        // 2026-02-05 Anderson：没必要让外部每次去调用 Init()，组件实现自动初始化
        if(!self.TableName || !self.TableId){
            self.Init();
        }
    },
    methods: {
        /**
         * 安全获取组件 ref 实例（兼容 Vue 2/3）
         * @param {string} fieldName - 字段名称
         * @returns {Object|null} - 组件实例或 null
         */
        getRefComponent(fieldName) {
            var self = this;
            var refKey = 'ref_' + fieldName;
            var refValue = self.$refs[refKey];
            
            if (!refValue) {
                return null;
            }
            
            // Vue 3 中可能是数组或直接是组件实例
            if (Array.isArray(refValue)) {
                return refValue.length > 0 ? refValue[0] : null;
            }
            
            return refValue;
        },
        /**
         * 安全的 setTimeout 包装器，组件销毁时自动清理
         * @param {Function} fn - 要执行的函数
         * @param {number} delay - 延迟时间（毫秒）
         * @returns {number} - 定时器ID
         */
        safeTimeout(fn, delay) {
            var self = this;
            var timerId = setTimeout(function() {
                if (self._isDestroyed) return;
                fn();
            }, delay);
            if (self._pendingTimers) {
                self._pendingTimers.push(timerId);
            }
            return timerId;
        },
        /**
         * 事件委托：处理字段点击事件
         * 通过事件冒泡机制，在父元素上统一处理所有字段的点击，减少事件监听器数量
         */
        handleFieldClick(event) {
            var self = this;
            // 只在设计模式下处理字段选择
            if (self.LoadMode !== 'Design') return;
            
            // 向上查找带有 data-field-id 属性的元素
            var target = event.target;
            var fieldId = null;
            while (target && target !== event.currentTarget) {
                if (target.dataset && target.dataset.fieldId) {
                    fieldId = target.dataset.fieldId;
                    break;
                }
                target = target.parentElement;
            }
            
            if (fieldId) {
                // 根据 fieldId 查找字段并选中
                var field = self.DiyFieldList.find(f => f && f.Id === fieldId);
                if (field) {
                    self.SelectField(field);
                }
            }
        },
        Init(param, callback) {
            var self = this;
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
        handleCreated(editor) {
            // removed debug log
            // this.editorRef = editor; // 记录 editor 实例，重要！
            this.editorRef = Object.seal(editor); // 一定要用 Object.seal() ，否则会报错
        },
        handleChange(editor) {
            // removed debug log
        },
        handleDestroyed(editor) {
            // removed debug log
        },
        handleFocus(editor) {
            // removed debug log
        },
        handleBlur(editor) {
            // removed debug log
        },
        customAlert(info, type) {
            // alert(`【自定义提示】${type} - ${info}`);
        },
        customPaste(editor, event, callback) {
            // removed debug log
            // 自定义插入内容
            // editor.insertText('xxx');
            // 返回值（注意，vue 事件的返回值，不能用 return）
            // callback(false); // 返回 false ，阻止默认粘贴行为
            callback(true); // 返回 true ，继续默认的粘贴行为
        },
        /**
         * vuedraggable onAdd 回调：当从设计器拖入字段时触发
         * 注意：实际添加字段的逻辑在 diy-design.vue 的 onComponentAdd 中处理
         * @param {Object} evt - 拖拽事件对象
         */
        onFieldAdd(evt) {
            var self = this;
            // 从设计器拖入时，由 diy-design.vue 处理添加逻辑
            // 这里只是一个占位符，确保事件能正确触发
            self.$emit('CallbackFieldAdd', evt);
        },
        /**
         * vuedraggable onEnd 回调：拖拽结束时触发
         * @param {Object} evt - 拖拽事件对象
         */
        onFieldDragEnd(evt) {
            var self = this;
            // 只处理同列表内的排序（不处理跨列表的添加）
            if (evt.from !== evt.to) return;
            // 位置没变化不处理
            if (evt.oldIndex === evt.newIndex) return;
            // 非设计模式不处理
            if (self.LoadMode !== 'Design') return;
            
            // 获取当前 tab 标识
            var currentTab = self.FieldActiveTab;
            
            // 从 DiyFieldListGrouped 获取当前 tab 的字段列表（这是 computed 属性的副本）
            var tabFieldsFromGrouped = self.DiyFieldListGrouped[currentTab] || [];
            if (tabFieldsFromGrouped.length === 0) return;
            
            // 由于 :list 绑定，draggable 已经修改了 tabFieldsFromGrouped 的顺序
            // 我们需要按新顺序更新每个字段的 Sort 值
            tabFieldsFromGrouped.forEach((field, index) => {
                // 找到原始 DiyFieldList 中的对应字段并更新 Sort
                var originalField = self.DiyFieldList.find(f => f.Id === field.Id);
                if (originalField) {
                    originalField.Sort = (index + 1) * 100;
                }
            });
            
            // 强制触发 Vue 响应式更新
            // 通过创建新数组引用来触发 computed 重新计算
            self.DiyFieldList = [...self.DiyFieldList];
            
            console.log('字段顺序已改变:', { oldIndex: evt.oldIndex, newIndex: evt.newIndex });
            
            // 通知父组件字段顺序已改变
            self.$emit('CallbackFieldOrderChanged', {
                oldIndex: evt.oldIndex,
                newIndex: evt.newIndex
            });
            
            // 通知父组件更新字段列表
            self.$emit('CallbackGetDiyField', self.DiyFieldList);
        },
        /**
         * vuedraggable @update 回调：数组更新时触发（使用 v-model 时）
         * 由于使用了 v-model 绑定，draggable 会自动更新数组顺序
         * 这里只需要同步更新 Sort 值和 DiyFieldList
         */
        onFieldDragUpdate(evt) {
            var self = this;
            // 非设计模式不处理
            if (self.LoadMode !== 'Design') return;
            // 位置没变化不处理
            if (evt.oldIndex === evt.newIndex) return;
            
            // 获取当前 tab 标识
            var currentTab = self.FieldActiveTab;
            
            // 获取 v-model 绑定的数组（已经被 draggable 更新了顺序）
            var tabFields = self.DiyFieldListGrouped[currentTab] || [];
            
            if (tabFields.length === 0) return;
            
            // 重新计算该 tab 下所有字段的 Sort 值
            tabFields.forEach((field, index) => {
                field.Sort = (index + 1) * 100;
            });
            
            // 强制触发 Vue 响应式更新
            self.DiyFieldList = [...self.DiyFieldList];
            
            // 通知父组件字段顺序已改变
            self.$emit('CallbackFieldOrderChanged', {
                oldIndex: evt.oldIndex,
                newIndex: evt.newIndex
            });
            
            // 通知父组件更新字段列表
            self.$emit('CallbackGetDiyField', self.DiyFieldList);
        },
        updateFieldOrder(oldIndex, newIndex) {
            var self = this;
            // 获取当前 tab 的字段列表
            var currentTab = self.FieldActiveTab;
            var tabFields = self.DiyFieldListGrouped[currentTab] || [];
            
            if (tabFields.length === 0) return;
            
            // 在 DiyFieldList 中找到这些字段并更新顺序
            var movedField = tabFields[oldIndex];
            if (!movedField) return;
            
            // 移除原位置的字段
            var fieldIndex = self.DiyFieldList.findIndex(f => f.Id === movedField.Id);
            if (fieldIndex === -1) return;
            
            self.DiyFieldList.splice(fieldIndex, 1);
            
            // 计算新位置
            var targetField = tabFields[newIndex];
            var targetIndex = targetField ? self.DiyFieldList.findIndex(f => f.Id === targetField.Id) : self.DiyFieldList.length;
            
            // 插入到新位置
            if (oldIndex < newIndex) {
                // 向后移动，插入到目标位置之后
                self.DiyFieldList.splice(targetIndex, 0, movedField);
            } else {
                // 向前移动，插入到目标位置
                self.DiyFieldList.splice(targetIndex, 0, movedField);
            }
            
            // 重新分配 Sort 值（100递增）
            self.DiyFieldList.forEach((field, index) => {
                field.Sort = (index + 1) * 100;
            });
            
            // 通知父组件更新字段列表
            self.$emit('CallbackGetDiyField', self.DiyFieldList);
        },
        /**
         * 显示字段操作工具栏
         */
        showFieldToolbar(field, event) {
            var self = this;
            if (self.LoadMode !== 'Design') return;
            
            self.selectedFieldForToolbar = field;
        },
        /**
         * 隐藏字段操作工具栏
         */
        hideFieldToolbar() {
            var self = this;
            // 延迟隐藏，以便点击工具栏按钮
            setTimeout(() => {
                if (!self.isResizingWidth) {
                    self.fieldToolbarVisible = false;
                }
            }, 200);
        },
        /**
         * 判断组件是否有独立配置
         * 支持配置的组件类型：JsonTable, Select等
         */
        hasComponentConfig(field) {
            var self = this;
            return true;
            // 定义支持独立配置的组件类型
            var configComponents = ['JsonTable', 'Select'];
            return configComponents.includes(field.Component);
        },
        /**
         * 打开组件配置弹窗
         * 通过ref调用子组件的openConfig方法
         */
        openComponentConfig(field) {
            var self = this;
            var refComponent = self.getRefComponent(field.Name);
            if (refComponent && typeof refComponent.openConfig === 'function') {
                refComponent.openConfig();
            } else {
                self.DiyCommon.Tips('该组件不支持配置', false);
            }
        },
        /**
         * 复制字段
         */
        duplicateField(field) {
            var self = this;
            self.$emit('CallbackDuplicateField', field);
        },
        /**
         * 删除字段
         */
        deleteField(field) {
            var self = this;
            self.$emit('CallbackDeleteField', field);
        },
        /**
         * 调整字段宽度
         */
        adjustFieldWidth(field, delta) {
            var self = this;
            var newWidth = field.FormWidth || field._span;
            newWidth = Math.max(1, Math.min(24, newWidth + delta));
            
            // 更新字段宽度
            field.FormWidth = newWidth;
            field._span = newWidth;
            
            // 通知父组件字段已更新
            self.$emit('CallbackFieldWidthChanged', {
                field: field,
                width: newWidth
            });
        },
        /**
         * 开始拖动调整宽度
         */
        startResizeWidth(field, event) {
            var self = this;
            if (self.LoadMode !== 'Design') return;
            
            self.resizingField = field;
            self.resizeStartX = event.clientX;
            self.resizeStartWidth = field.FormWidth || field._span;
            self.isResizingWidth = true;
            
            // 添加全局事件监听
            document.addEventListener('mousemove', self.onResizeWidthMove);
            document.addEventListener('mouseup', self.stopResizeWidth);
            
            // 阻止默认行为
            event.preventDefault();
            event.stopPropagation();
        },
        /**
         * 拖动中调整宽度
         */
        onResizeWidthMove(event) {
            var self = this;
            if (!self.resizingField) return;
            
            // 计算鼠标移动距离（像素）
            var deltaX = event.clientX - self.resizeStartX;
            
            // 每50像素增加1个栅格
            var deltaSpan = Math.round(deltaX / 50);
            
            // 计算新宽度
            var newWidth = Math.max(1, Math.min(24, self.resizeStartWidth + deltaSpan));
            
            // 更新字段宽度
            self.resizingField.FormWidth = newWidth;
            self.resizingField._span = newWidth;
        },
        /**
         * 停止拖动调整宽度
         */
        stopResizeWidth(event) {
            var self = this;
            if (!self.resizingField) return;
            
            // 通知父组件字段已更新
            self.$emit('CallbackFieldWidthChanged', {
                field: self.resizingField,
                width: self.resizingField.FormWidth || self.resizingField._span
            });
            
            // 移除全局事件监听
            document.removeEventListener('mousemove', self.onResizeWidthMove);
            document.removeEventListener('mouseup', self.stopResizeWidth);
            
            // 重置状态
            self.resizingField = null;
            self.isResizingWidth = false;
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
                                result += self.DiyCommon.IsNull(element[field.Config.SelectLabel]) ? "" : element[field.Config.SelectLabel];
                                if (index !== tObj.length - 1) {
                                    result += ",";
                                }
                            });
                            return result + fuheWZ;
                        }
                        //2021-01-02发现问题，这里如果存的是一串数字 ，JSON.parse()不会报错
                        else if (typeof tObj == "number") {
                            result = self.DiyCommon.IsNull(row[field.Name]) ? "" : row[field.Name];
                            return result + fuheWZ;
                        } else {
                            result = self.DiyCommon.IsNull(tObj[field.Config.SelectLabel]) ? "" : tObj[field.Config.SelectLabel];
                            return result + fuheWZ;
                        }
                    } catch (error) {
                        // removed debug logs
                    }
                }
            }

            var displayValue = self.DiyCommon.IsNull(row[field.Name]) ? "" : row[field.Name];
            //如果是富文本，需要去掉html标签
            if (field.Component == "RichText") {
                displayValue = self.DiyCommon.RemoveHtml(displayValue);
            }
            result = displayValue; //self.DiyCommon.IsNull(scope.row[field.Name]) ? '' : scope.row[field.Name];
            return result + fuheWZ;
        },
        GetV8(field) {
            var self = this;
            var v8 = self.DiyCommon.InitV8CodeSync({}, self.$router);

            //2021-12-10新增，有可能用户自定义父级model，如点击A子表一行数据，更新B子表数据
            if (field && !self.DiyCommon.IsNull(field._ParentFormModel)) {
                return Object.assign(
                    {},
                    {
                        ...field._ParentFormModel
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
                    var refComponent = self.getRefComponent(field.Name);
                    if (refComponent && typeof refComponent.GetNeedSaveRowList === 'function') {
                        var arr = refComponent.GetNeedSaveRowList();
                        //这里除了写主表关联值，其实还要写子表回写列的值  2021-11-02  todo
                        //2021-12-07注释：是因为DiyTable在新增的时候，已经将外键关联、回写值全部处理好了
                        // arr.forEach(formData => {
                        //     formData[field.Config.TableChildFkFieldName] = self.FormDiyTableModel.Id;
                        // });
                        result.push({
                            FieldName: field.Name,
                            TableId: field.Config.TableChildTableId,
                            Rows: arr
                        });

                        //2025-10-8liucheng读取所有子表格已编辑数据
                        var refComponent2 = self.getRefComponent(field.Name);
                        var refArray = Array.isArray(self.$refs["ref_" + field.Name]) ? self.$refs["ref_" + field.Name] : (refComponent2 ? [refComponent2] : []);
                        for (var item of refArray) {
                            var list = [];
                            item.DiyTableRowList.forEach((ite) => {
                                if (ite._DataStatus == "Edit") {
                                    list.push(ite);
                                }
                            });
                            result.push({
                                FieldName: field.Name,
                                TableId: field.Config.TableChildTableId,
                                Rows: list
                            });
                        }
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
                    var refComponent = self.getRefComponent(field.Name);
                    if (refComponent && typeof refComponent.ClearNeedSaveRowList === 'function') {
                        var arr = refComponent.ClearNeedSaveRowList();
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
                    var refComponent = self.getRefComponent(field.Name);
                    if (refComponent && typeof refComponent.GetFormData === 'function') {
                        var joinFormData = refComponent.GetFormData();
                        var formMode = self.FormMode;//field.Config.JoinForm.FormMode
                        if(formMode == "Add" || formMode == "Insert")
                        {
                            self.DiyCommon.FormEngine.AddFormData(field.Config.JoinForm.TableId 
                                || field.Config.JoinForm.TableName, {
                                ...joinFormData
                            });
                        }
                        else if(formMode == "Edit" 
                                || formMode == "Update"
                                || formMode == "Upt"
                            )
                        {
                            self.DiyCommon.FormEngine.UptFormData(field.Config.JoinForm.TableId 
                                || field.Config.JoinForm.TableName, {
                                ...joinFormData
                            });
                        }

                        // 这里不再调用FormSubmit，因为它是异步
                        // refComponent.FormSubmit(
                        //     {
                        //         FormMode: field.Config.JoinForm.FormMode, //self.FormMode, 2022-07-14修复这个bug，不应该跟随主表的模式，切换关联表的时候，主表是编辑，但关联表是新增。
                        //         //这里获取关联表单的Id
                        //         TableRowId: field.Config.JoinForm.Id 
                        //             || (field.Config.JoinForm.JoinFieldName 
                        //                 && self.FormDiyTableModel[field.Config.JoinForm.JoinFieldName]),
                        //         // SaveLoading: self.SaveDiyTableLoding,
                        //         //这里获取当前表单是保存并关闭还是什么状态
                        //         SavedType: self.SavedType,
                        //         V8Callback: function (formData) {
                        //             // self.GetHourseDetail(self.GetOther);
                        //         }
                        //     },
                        //     function (success, formData) {
                        //         if (success == true) {
                        //             // self.GetDiyTableRow(true)
                        //             // self.ShowEditModel = false;
                        //             self.$nextTick(function () {
                        //                 // self.SaveDiyTableLoding = false;
                        //             });
                        //         } else {
                        //             // self.SaveDiyTableLoding = false;
                        //         }
                        //     }
                        // );
                    }
                }
            });
            return result;
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
        FormDiyTableModelListen(field) {
            var self = this;
            //2021-10-25新增，有可能用户自定义父级model，如点击A子表一行数据，更新B子表数据
            if (!self.DiyCommon.IsNull(field._ParentFormModel)) {
                return Object.assign(
                    {},
                    {
                        ...field._ParentFormModel
                    }
                );
            }

            //注意：这句Object.assign 非常非常非常非常 重要，不能直接 return this.Form.DiyTableModel
            //直接会怎么样？2021-2-07，自己都忘了:(
            return Object.assign(
                {},
                {
                    ...this.FormDiyTableModel
                }
            );
            // return this.FormDiyTableModel;
        },
        async GetDiyFieldListObjectFunc(field) {
            var self = this;
            var result = {};
            if (field && !self.DiyCommon.IsNull(field.Config.TableChild.LastSysMenuId)) {
                //这里需要获取该字段上级关联模块的所有字段列表
                // {
                //     Url : DiyApi.GetDiyFieldByDiyTables,
                //     Param: {
                //         TableIds: [self.TableId],
                //         SysMenuId : self.SysMenuId
                //     }
                // }
                var fieldListResult = await self.DiyCommon.PostAsync(self.DiyApi.GetDiyFieldByDiyTables, {
                    TableIds: [field.Config.TableChild.LastTableId],
                    SysMenuId: field.Config.TableChild.LastSysMenuId
                });
                if (fieldListResult.Code == 1) {
                    fieldListResult.Data.forEach((element) => {
                        result[element.Name] = element;
                    });
                }
            }
            return result;
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
        Clear() {
            var self = this;
            //注意：这一句并不能将所有属性值全部清除掉，要使用$delete
            // self.FormDiyTableModel = {};

            // ========== 1. 清理子表组件引用 ==========
            // 遍历所有 refs，找到子表组件并调用其 Clear 方法
            if (self.$refs) {
                Object.keys(self.$refs).forEach((key) => {
                    try {
                        // 检查是否是字段组件的 ref (统一使用 ref_ 前缀)
                        if (key.startsWith('ref_')) {
                            var refComponent = self.$refs[key];
                            // Vue 3 中 ref 可能是数组
                            if (Array.isArray(refComponent)) {
                                refComponent.forEach(comp => {
                                    if (comp && typeof comp.Clear === 'function') {
                                        try { comp.Clear(); } catch(e) {}
                                    }
                                });
                            } else if (refComponent && typeof refComponent.Clear === 'function') {
                                try { refComponent.Clear(); } catch(e) {}
                            }
                        }
                    } catch (e) { /* ignore */ }
                });
            }

            // ========== 2. 清理表单数据 ==========
            Object.keys(self.FormDiyTableModel).forEach((item) => {
                delete self.FormDiyTableModel[item];
            });

            // ========== 3. 清理历史数据 ==========
            self.OldForm = {};
            self.OldFormData = {};

            // ========== 4. 清理修改字段列表 ==========
            self.ModifiedFields = [];

            // ========== 5. 重置加载状态 ==========
            self.GetDiyTableRowModelFinish = false;
            self.IsFirstLoadForm = true;
        },
        ComponentButtonClick(field) {
            var self = this;
            self.RunV8Code({ field: field });
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
                //2026-02-06 Anderon：注释这个判断 ，否则会导致重新赋空值不会成功
                // if (formData[key]) {
                    self.FormDiyTableModel[key] = formData[key];
                // }
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
                                if (fieldsObj[key] && Array.isArray(fieldsObj[key]) && fieldsObj[key].length > 0) {
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
                    
                    // 【调试】检查FileUpload和ImgUpload字段的存储格式
                    self.DiyFieldList.forEach((field) => {
                        if (field.Component === 'FileUpload' || field.Component === 'ImgUpload') {
                            const fieldValue = self.FormDiyTableModel[field.Name];
                            console.log(`【提交前检查】${field.Component} - ${field.Name}:`, fieldValue);
                            console.log(`【提交前检查】${field.Name} 类型:`, typeof fieldValue);
                            if (typeof fieldValue === 'string' && fieldValue.startsWith('{')) {
                                console.log(`✅ ${field.Name} 是JSON字符串，格式正确！`);
                            } else if (Array.isArray(fieldValue)) {
                                console.log(`✅ ${field.Name} 是数组（多文件）`);
                            } else {
                                console.warn(`⚠️ ${field.Name} 格式不正确！应该是JSON字符串或数组`);
                            }
                        }
                    });
                    
                    self.DiyFieldList.forEach((field) => {
                        //再手动判断一下必填等验证
                        if (
                            !self.DiyCommon.IsNull(field.NotEmpty) &&
                            field.NotEmpty &&
                            field.Visible &&
                            (self.DiyCommon.IsNull(self.FormDiyTableModel[field.Name]) ||
                                (typeof self.FormDiyTableModel[field.Name] == "object" &&
                                    (JSON.stringify(self.FormDiyTableModel[field.Name]) == "{}" || JSON.stringify(self.FormDiyTableModel[field.Name]) == "[]"))) &&
                            (self.ShowFields.length == 0 || (self.ShowFields.length > 0 && self.ShowFields.indexOf(field.Name) > -1)) && // _.where(self.ShowFields, { Id: field.Id}).length > 0
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
                        self.DiyCommon.Tips("请检查必填项：[" + checkFailField.Label + "]！", false);
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
            console.warn('[OpenAnyForm] 被调用, param=', param);
            console.warn('[OpenAnyForm] _shouldRenderDiyFormDialog=', self._shouldRenderDiyFormDialog, ' | ref存在=', !!self.$refs.refDiyTable_DiyFormDialog);
            // 首次调用时才渲染 DiyFormDialog 组件，防止 Page 模式下无限嵌套
            if (!self._shouldRenderDiyFormDialog) {
                console.warn('[OpenAnyForm] 首次调用，设置 _shouldRenderDiyFormDialog = true');
                self._shouldRenderDiyFormDialog = true;
            }
            // 异步组件挂载需要时间，使用重试机制等待 ref 就绪
            if (self.$refs.refDiyTable_DiyFormDialog) {
                console.warn('[OpenAnyForm] ref 已就绪，直接调用 Init');
                self.$refs.refDiyTable_DiyFormDialog.Init(param, callback);
            } else {
                console.warn('[OpenAnyForm] ref 未就绪，进入重试轮询...');
                var retryCount = 0;
                var maxRetries = 40;
                var tryInit = function() {
                    console.warn('[OpenAnyForm] tryInit 第' + retryCount + '次, ref存在=', !!self.$refs.refDiyTable_DiyFormDialog, ' | _shouldRender=', self._shouldRenderDiyFormDialog);
                    if (self.$refs.refDiyTable_DiyFormDialog) {
                        console.warn('[OpenAnyForm] ref 就绪，调用 Init (第' + retryCount + '次重试后)');
                        self.$refs.refDiyTable_DiyFormDialog.Init(param, callback);
                    } else if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(tryInit, 50);
                    } else {
                        console.error('[OpenAnyForm] 超时：refDiyTable_DiyFormDialog 始终未挂载，已重试' + maxRetries + '次');
                    }
                };
                self.$nextTick(tryInit);
            }
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
        FormClose() {
            var self = this;
            self.$emit("CallbackFormClose");
            // 移除 DOM 清理调用，让 Element Plus 自然管理组件生命周期
            // 之前的 cleanupHiddenElements 会破坏 Vue 组件实例
        },
        GetChildTableData(fieldName) {
            var self = this;
            var refComponent = self.getRefComponent(fieldName);
            if (refComponent && refComponent.DiyTableRowList) {
                return refComponent.DiyTableRowList;
            }
            return [];
        },
        ShowTableChildHideField(fieldName, fields) {
            var self = this;
            var refComponent = self.getRefComponent(fieldName);
            if (refComponent && typeof refComponent.ShowHideFields === 'function') {
                refComponent.ShowHideFields(fields);
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
                if (tab.Name == tabName || tab.Id == tabName) {
                    tab.Display = false;
                }
            });
            self.FormTabs.forEach((tab) => {
                if (tab.Name == tabName || tab.Id == tabName) {
                    tab.Display = false;
                }
            });
        },
        ShowFormTab(tabName) {
            var self = this;
            self.DiyTableModel.Tabs.forEach((tab) => {
                if (tab.Name == tabName || tab.Id == tabName) {
                    tab.Display = true;
                }
            });
        },
        ClickFormTab(tabName) {
            var self = this;
            self.DiyTableModel.Tabs.forEach((tab) => {
                if (tab.Name == tabName || tab.Id == tabName) {
                    self.FieldActiveTab = tab.Id || tab.Name;
                }
            });
        },
        GetAllData(param, callback) {
            var self = this;
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
                if (self.DiyCommon.Result(results[0]) && self.DiyCommon.Result(results[1])) {
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
                        if (self.DiyTableModel.TabsTop) {
                            self.FieldActiveTab = self.FormTabs[self.currentTabIndex + 1]?.Id || self.FormTabs[self.currentTabIndex + 1]?.Name;
                        } else {
                            self.FieldActiveTab = self.FormTabs[self.currentTabIndex]?.Id || self.FormTabs[self.currentTabIndex]?.Name;
                        }
                    }
                    
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

                    await self.GetAllDataAfter(resultGetDiyField, formData, function (callbackObj) {
                        self.$emit("CallbackSetFormData", callbackObj.CurrentRowModel);
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
                    console.log('准备传入表数据 - GetAllData:', self.DiyTableModel );

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
                                // 优化：创建独立的 V8 实例，避免污染基础对象
                                var V8 = await self.DiyCommon.InitV8Code({}, self.$router);
                                V8.V8From = "DiyForm";
                                V8.EventName = "FormIn";
                                
                                // 设置通用函数和动态属性
                                self.SetV8DefaultValue(V8);

                                
                                
                                try {
                                    // 执行用户的 InFormV8 代码
                                    await eval("(async () => {\n " + self.DiyTableModel.InFormV8 + " \n})();");
                                } catch (error) {
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
        tabClickField(tab) {
            var self = this;
            // 修复：Element Plus el-tabs 的 tab 对象结构为 { props: { name, label }, index, ... }
            var tabKey = tab.props?.name || tab.name || tab.Id;
            this.FieldActiveTab = tabKey; //切换索引
            this.currentTabIndex = tab.index; //当前索引lisaisai
            
            // 标记该 tab 已渲染（懒加载）
            if (!self.renderedTabs.has(tabKey)) {
                self.renderedTabs.add(tabKey);
                // 🔥 新增：初始化该 tab 的渲染字段计数
                self.renderedFieldCounts[tabKey] = self.BATCH_SIZE_FIRST;
            }
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
                } catch (error) {
                    self.DiyCommon.Tips("执行前端V8引擎代码出现错误[" + field.Name + "," + field.Label + "]：" + error.message, false);
                    callback && callback(null);
                } finally {
                    
                    
                }
                return result;
            }
        },
        //param: { _PageIndex : 1 }
        //_PageIndex从1开始计数，传入-1表示跳到最后一页。
        TableRefresh(field, param) {
            var self = this;
            try {
                var refComponent = self.getRefComponent(field.Name);
                if (refComponent && typeof refComponent.RefreshDiyTableRowList === 'function') {
                    refComponent.RefreshDiyTableRowList(param);
                }
            } catch (error) {
                // removed debug log
            }
        },
        //刷新所有子表
        RefreshAllChildTable(field, param) {
            var self = this;
            var allChildTable = _.where(self.DiyFieldList, {
                Component: "TableChild"
            });
            allChildTable.forEach((field) => {
                try {
                    var refComponent = self.getRefComponent(field.Name);
                    if (refComponent && typeof refComponent.RefreshDiyTableRowList === 'function') {
                        refComponent.RefreshDiyTableRowList(param);
                    }
                } catch (error) {
                    // removed debug log
                }
            });
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
        CallbackRefreshTable(param) {
            var self = this;
            try {
                self.$emit("CallbackRefreshTable", param);
            } catch (error) {
                // removed debug log
            }
        },
        TableSetData(field) {
            var self = this;
            try {
                var refComponent = self.getRefComponent(field.Name);
                if (refComponent && typeof refComponent.TableSetData === 'function') {
                    refComponent.TableSetData();
                }
            } catch (error) {
                // removed debug log
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
        //             // removed debug log
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
                            oldConfig[attrArray[1]][attrArray[2]][attrArray[3]][attrArray[4]] = value;
                        }
                        element["Config"] = oldConfig;
                    } else {
                        element[attrName] = value;
                    }
                }
            });
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
        FormSet(fieldName, value, field) {
            var self = this;
            self.FormDiyTableModel[fieldName] = value;
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
            console.log('准备传入表数据 - SetDiyTableModel:', self.DiyTableModel );
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
        SingleFieldRunSql() {
            var self = this;
        },
        /**
         * 字段数据转换 - 使用配置驱动的处理器系统
         * isPostSql：是否发起sql post请求
         */
        DiyFieldStrToJson(field, formData, isPostSql) {
            var self = this;
            
            // 1. 归一化 Multiple 配置：支持字符串或布尔，统一为布尔值
            try {
                if (field && field.Config) {
                    if (field.Config.ImgUpload && field.Config.ImgUpload.Multiple !== undefined) {
                        var m = field.Config.ImgUpload.Multiple;
                        field.Config.ImgUpload.Multiple = m === true || m === "true" || m === 1 || m === "1";
                    }
                    if (field.Config.FileUpload && field.Config.FileUpload.Multiple !== undefined) {
                        var fm = field.Config.FileUpload.Multiple;
                        field.Config.FileUpload.Multiple = fm === true || fm === "true" || fm === 1 || fm === "1";
                    }
                }
            } catch (e) {}
            
            // 2. 设置表单验证规则
            if (self.FormMode != "View" && field.NotEmpty && field.Visible) {
                if (!self.FormRules[field.Name]) {
                    self.FormRules[field.Name] = [
                        {
                            required: true,
                            message: self.GetPleaseInputText(field) + "[" + field.Label + "]",
                            trigger: "change"
                        }
                    ];
                }
            } else if (self.FormMode == "View") {
                self.FormRules = {};
            }
            
            // 3. 使用配置驱动的处理器系统处理字段值
            var ctx = {
                formMode: self.FormMode,
                // 加载私有文件的回调（用于 ImgUpload）
                loadPrivateFiles: function(field, arr, configKey) {
                    self._loadPrivateFilesForField(field, arr, configKey);
                },
                // 获取 JSON 值的方法（兼容旧代码）
                getJsonValue: function(field, formData, isArray) {
                    return self.GetFormDataJsonValue(field, formData, isArray);
                }
            };
            
            // 检查是否有注册的处理器
            var handler = self.DiyCommon.FieldValueHandlers[field.Component];
            
            if (handler) {
                try {
                    // 使用处理器处理值
                    var value = self.DiyCommon.ProcessFieldValue(field, formData, ctx);
                    
                    // 对于不需要值的组件（如 Divider、Button），跳过赋值
                    if (handler.valueType !== "none") {
                        self.FormDiyTableModel[field.Name] = value;
                    }
                    
                    // 特殊处理：ImgUpload 多图需要加载私有文件
                    if (field.Component === "ImgUpload" && self.getMultipleFlag(field, "ImgUpload")) {
                        self._loadPrivateFilesForField(field, value, "ImgUpload");
                    }
                    
                    return;
                } catch (error) {
                    console.warn("FieldValueHandler error for:", field.Name, error);
                    // 如果处理器出错，使用默认值
                    self.FormDiyTableModel[field.Name] = self.DiyCommon.GetFieldDefaultValue(field);
                    return;
                }
            }
            
            // 4. 如果没有注册处理器，使用默认处理（文本类）
            self.FormDiyTableModel[field.Name] = self.DiyCommon.IsNull(formData) || self.DiyCommon.IsNull(formData[field.Name]) 
                ? "" : formData[field.Name];
        },
        
        /**
         * 加载多图/多文件的私有文件 URL
         */
        _loadPrivateFilesForField(field, arr, configKey) {
            var self = this;
            if (!Array.isArray(arr)) return;
            
            var limitCfg = (field.Config && field.Config[configKey] && field.Config[configKey].Limit) || false;
            
            arr.forEach(function(fileObj) {
                try {
                    if (!fileObj) return;
                    var fileId = fileObj.Id || fileObj.id || fileObj.uid;
                    if (!fileId) return;
                    var filePath = fileObj.Path || fileObj.path || fileObj.Url || fileObj.url || fileObj.PathName;
                    var realKey = field.Name + "_" + fileId + "_RealPath";
                    
                    // 如果已经有值则跳过
                    if (!self.DiyCommon.IsNull(self.FormDiyTableModel[realKey])) return;
                    
                    if (!filePath) {
                        self.FormDiyTableModel[realKey] = "./static/img/img-load-fail.jpg";
                    } else if (limitCfg !== true) {
                        self.FormDiyTableModel[realKey] = self.DiyCommon.GetServerPath(filePath);
                    } else {
                        self.FormDiyTableModel[realKey] = "./static/img/loading.gif";
                        // 异步获取私有文件临时 URL
                        self.DiyCommon.Post(
                            "/api/HDFS/GetPrivateFileUrl",
                            {
                                FilePathName: filePath,
                                HDFS: self.SysConfig.HDFS || "Aliyun",
                                FormEngineKey: self.DiyTableModel.Name || self.TableId,
                                FormDataId: self.TableRowId,
                                FieldId: field.Id
                            },
                            function(privateResult) {
                                try {
                                    var finalPath = self.DiyCommon.Result(privateResult) ? privateResult.Data : "./static/img/img-load-fail.jpg";
                                    self.FormDiyTableModel[realKey] = finalPath;
                                } catch (e) {}
                            },
                            function(err) {
                                try {
                                    self.FormDiyTableModel[realKey] = "./static/img/img-load-fail.jpg";
                                } catch (e) {}
                            }
                        );
                    }
                } catch (e) {}
            });
        },
        
        GetFormDataJsonValue(field, formData, isArray) {
            var self = this;
            if (self.DiyCommon.IsNull(formData) || self.DiyCommon.IsNull(formData[field.Name])) {
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
                                        (!self.DiyCommon.IsNull(field.Config.SelectSaveField) || !self.DiyCommon.IsNull(field.Config.SelectLabel)))
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
                            return {};
                        }
                    } catch (error) {
                        //如果JSON.parse报错，那么说明这个字段存的并不是json
                        //2020-11-09 存在的数据不一定是正确的，因为Select有可能只存字段
                        if (
                            field.Component == "Select" ||
                            (field.Component == "SelectTree" && //2022-07-01
                                !isArray &&
                                (!self.DiyCommon.IsNull(field.Config.SelectSaveField) || !self.DiyCommon.IsNull(field.Config.SelectLabel)))
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
        AddDiyFieldArr(field, insertIndex) {
            var self = this;
            console.log('[diy-form] ========== AddDiyFieldArr 开始 ==========');
            console.log('[diy-form] 字段数据:', field);
            console.log('[diy-form] insertIndex:', insertIndex);
            console.log('[diy-form] 当前DiyFieldList长度:', self.DiyFieldList.length);
            console.log('[diy-form] 添加前的DiyFieldList:', JSON.parse(JSON.stringify(self.DiyFieldList)));
            console.log('[diy-form] 当前活动Tab:', self.FieldActiveTab);
            console.log('[diy-form] 新字段的Tab:', field.Tab);
            
            // 如果有指定位置，就插入到该位置；否则添加到末尾
            if (typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= self.DiyFieldList.length) {
                console.log('[diy-form] 插入到位置:', insertIndex);
                self.DiyFieldList.splice(insertIndex, 0, field);
            } else {
                console.log('[diy-form] 添加到末尾');
                self.DiyFieldList.push(field);
            }
            
            console.log('[diy-form] 添加后的DiyFieldList长度:', self.DiyFieldList.length);
            console.log('[diy-form] 添加后的DiyFieldList:', JSON.parse(JSON.stringify(self.DiyFieldList)));
            
            // 🔥 强制触发computed重新计算：修改renderedFieldCounts
            console.log('[diy-form] 触发computed重新计算...');
            self.$nextTick(() => {
                // 修改renderedFieldCounts以触发DiyFieldListGrouped重新计算
                if (!self.renderedFieldCounts) {
                    self.renderedFieldCounts = {};
                }
                var currentTab = field.Tab || '';
                self.renderedFieldCounts[currentTab] = (self.renderedFieldCounts[currentTab] || 0) + 1;
                console.log('[diy-form] 更新renderedFieldCounts:', JSON.parse(JSON.stringify(self.renderedFieldCounts)));
                console.log('[diy-form] DiyFieldListGrouped已重新计算');
            });
            
            console.log('[diy-form] ========== AddDiyFieldArr 结束 ==========');
        },
        // 外部可能需要更新内部的字段对象
        UptDiyFieldArr(field) {
            var self = this;
            self.DiyFieldList.forEach((element) => {
                if (element.Id == field.Id) {
                    element = field;
                }
            });
        },
        UptDiyFieldDataSource(fieldName, dataSource) {
            var self = this;
            self.DiyFieldList.forEach((element) => {
                if (element.Name == fieldName) {
                    element.Data = dataSource;
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
        ImgUploadRemove(file, fileList, field) {
            var self = this;
            //如果是单文件，需要修改值
            if (field.Config.ImgUpload.Multiple !== true) {
                // self.FormDiyTableModel[field.Name] = '';
                self.FormDiyTableModel[field.Name] = "";
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
        GetFieldReadOnly(field) {
            var self = this;
            //如果按钮设置了预览可点击
            //并且按钮Readonly属性不为true，
            //并且ReadonlyFields不包含此字段
            //则返回false(不禁用)
            if (field.Component == "Button" && field.Config.Button && field.Config.Button.PreviewCanClick === true && !field.Readonly && !(self.ReadonlyFields.indexOf(field.Name) > -1)) {
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
                    await self.DiyCommon.PostAsync("/api/DiyTable/NewGuid", {}, function (result) {
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
                await self.DiyCommon.PostAsync("/api/DiyTable/NewGuid", {}, function (result) {
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
                                self.DiyCommon.Post("/api/DiyTable/NewGuid", {}, async function (result) {
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
                    var batchEditParams = [];
                    var needSubmit = false;
                    needSaveRowLis.forEach((element) => {
                        if (!element.Rows || element.Rows.length == 0) {
                            return;
                        }
                        element.Rows.forEach((row) => {
                            //这里要调用这2个函数处理下，比如下拉框是只存储字段
                            var rowModel = { ...row };
                            if (self.$refs["ref_" + element.FieldName] && self.$refs["ref_" + element.FieldName].length > 0) {
                                //注意：这里是传子表的DiyFieldList，而不是主表的
                                var diyFieldList = self.$refs["ref_" + element.FieldName][0].DiyFieldList;
                                self.DiyCommon.ForRowModelHandler(rowModel, diyFieldList);
                                rowModel = self.DiyCommon.ConvertRowModel(rowModel);
                                if (rowModel._DataStatus && rowModel._DataStatus == "Edit") {
                                    batchEditParams.push({
                                        FormEngineKey: element.TableId,
                                        Id: rowModel.Id,
                                        _RowModel: rowModel
                                    });
                                } else {
                                    batchAddParams.push({
                                        FormEngineKey: element.TableId, //rowModel.TableId ||
                                        _TableName: element.TableName,
                                        _FormData: rowModel
                                    });
                                }
                            }
                        });
                    });
                    if (batchAddParams.length > 0) {
                        var result = await self.DiyCommon.PostAsync(self.DiyApi.AddFormDataBatch, batchAddParams, null, null, "json");
                        if (batchEditParams.length === 0) {
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
                    if (batchEditParams.length > 0) {
                        var result = await self.DiyCommon.PostAsync(self.DiyApi.UptFormDataBatch, batchEditParams, null, null, "json");
                        if (!self.DiyCommon.Result(result)) {
                            formParam.SaveLoading = false;
                            return;
                        } else {
                            self.ClearNeedSaveRowList();
                        }
                    }
                }
                //关联表单提交
                self.GetNeedSaveJoinFormList();
                return;
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
                        if (!element.Rows || element.Rows.length == 0) {
                            return;
                        }
                        element.Rows.forEach((row) => {
                            //这里要调用这2个函数处理下，比如下拉框是只存储字段
                            var rowModel = { ...row };
                            if (self.$refs["ref_" + element.FieldName] && self.$refs["ref_" + element.FieldName].length > 0) {
                                //注意：这里是传子表的DiyFieldList，而不是主表的
                                var diyFieldList = self.$refs["ref_" + element.FieldName][0].DiyFieldList;

                                //只取当前这个子表的所有字段。--2025-02-18 --by Anderson
                                var childTableId = self.$refs["ref_" + element.FieldName][0].TableId;
                                if (childTableId) {
                                    diyFieldList = diyFieldList.filter((item) => item.TableId == childTableId);
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
                                            (typeof rowModel[field.Name] == "object" && (JSON.stringify(rowModel[field.Name]) == "{}" || JSON.stringify(rowModel[field.Name]) == "[]"))) &&
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
                                    self.DiyCommon.Tips("请检查必填项：[" + checkFailField.Label + "]！", false);
                                    checkResult = false;
                                    // callback();
                                }
                                //---check  end

                                self.DiyCommon.ForRowModelHandler(rowModel, diyFieldList);
                                rowModel = self.DiyCommon.ConvertRowModel(rowModel);
                                batchAddParams.push({
                                    TableId: element.TableId,
                                    TableName: element.TableName,
                                    _FormData: rowModel
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
                    SavedType: "Update"
                });
            }
        },
        CallbackFormValueChange(field, thisValue) {
            var self = this;
            if (self.ModifiedFields && !(self.ModifiedFields.indexOf(field.Name) > -1)) {
                self.ModifiedFields.push(field.Name);
            }
            self.$emit("CallbackFormValueChange", field, thisValue);
        },
        //系统设置加了判断，如果是在线访问文档，则打开界面引擎2025-5-4刘诚
        GoUrl(url) {
            var self = this;
            if (
                self.SysConfig &&
                (self.SysConfig.Is_online_office || self.SysConfig.OnlyOfficeApiBase) &&
                (url.indexOf(".doc") != -1 || url.indexOf(".docx") != -1 || url.indexOf(".xls") != -1 || url.indexOf(".xlsx") != -1 || url.indexOf(".ppt") != -1 || url.indexOf(".pptx") != -1)
            ) {
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
            this.RunV8Code({ field: field });
        }
    }
};
</script>
<style lang="scss" scoped>
@import "@/styles/diy-form.scss";

/* ==================== 骨架屏样式 ==================== */
.form-skeleton-container {
    padding: 20px;
}

.form-skeleton {
    .skeleton-row {
        display: flex;
        gap: 20px;
        margin-bottom: 24px;
        
        .skeleton-field {
            flex: 1;
            min-width: 0;
        }
    }
}

/* ==================== 设计器样式 ==================== */

/* 设计模式下的字段样式 */
.design-mode-field {
    position: relative;
    padding: 0px;
    margin-bottom: 0px;
    transition: all 0.3s ease;
    cursor: pointer;
    
    &:hover {
        background-color: #f5f7fa;
        
        .drag-handle {
            opacity: 1;
        }
        
        .width-resize-handle {
            opacity: 1;
        }
    }
}

/* draggable 容器添加间距 */
.draggable-with-gutter {
    min-height: 50px;
    :deep(.el-col) {
        padding-left: 0px;
        padding-right: 0px;
        margin-bottom: 0px;
    }
}


/* 选中状态的字段 */
.selected-field {
    outline: 2px solid #409EFF !important;
    // outline-offset: 2px;
    background-color: #ecf5ff !important;
    border-radius: 4px;
}

/* 字段操作工具栏 */
.field-toolbar {
    position: absolute;
    top: -45px;
    right: 5px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: white;
    padding: 8px 12px;
    border-radius: 6px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    
    :deep(.el-button) {
        padding: 6px;
        height: 28px;
        width: 28px;
        
        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
    }
    
    .width-control {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        background-color: #f5f7fa;
        border-radius: 4px;
        
        .width-display {
            font-weight: bold;
            min-width: 30px;
            text-align: center;
            color: #409EFF;
            font-size: 14px;
        }
        
        :deep(.el-button) {
            padding: 4px;
            min-height: 24px;
        }
    }
}

/* 拖拽手柄 */
.drag-handle {
    position: absolute;
    // left: -5px;
    top: 50%;
    transform: translateY(-50%);
    cursor: move;
    color: #409EFF;
    font-size: 20px;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 10;
    
    :deep(.el-icon) {
        display: block;
        width: 24px;
        height: 24px;
        line-height: 24px;
        text-align: center;
        background: white;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        
        &:hover {
            color: #66b1ff;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
    }
}

/* 宽度调整手柄 */
.width-resize-handle {
    position: absolute;
    right: -3px;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: ew-resize;
    background: linear-gradient(to right, transparent, #409EFF);
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 10;
    
    &:hover {
        background: #409EFF;
    }
    
    &.resizing {
        opacity: 1 !important;
        background: #66b1ff;
    }
}

/* vuedraggable 拖拽状态样式 */
:deep(.sortable-ghost) {
    opacity: 0.4;
    background-color: #c8ebfb !important;
    border: 2px dashed #409EFF;
}

:deep(.sortable-drag) {
    opacity: 0.8;
    background-color: white;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    transform: rotate(2deg);
}

/* 拖拽时的占位符 */
:deep(.sortable-chosen) {
    cursor: move;
}
</style>
