<template>
    <!--下拉框-->
    <!-- :filter-method="
            (query) => {
                return FilterMethod(query, field);
            }
        " -->
    <!--
    FormDiyTableModel[field.Name]

    reserve-keyword:多选且可搜索时，是否在选中一个选项后保留当前的搜索关键词，默认false
    automatic-dropdown:对于不可搜索的 Select，是否在输入框获得焦点后自动弹出选项菜单.【这个有bug，第一次点击会闪一下收进去】
    :reserve-keyword="field.Component == 'MultipleSelect' &&
                    (field.Config.EnableSearch == true || field.Config.DataSourceSqlRemote == true)"
-->
    <!--注意：field.Data数据是在变的，
    这里面之前设置的key【'slt_opt_key' + field.Name + '_' + index2】一定会重复，
    因为field.Name是固定不变的，
    已解决-->
    <el-select
        v-model="ModelValue"
        :disabled="GetFieldReadOnly(field)"
        :multiple="field.Component == 'MultipleSelect'"
        :filterable="field.Config.EnableSearch == true || field.Config.DataSourceSqlRemote == true"
        :loading="field.Config.DataSourceSqlRemoteLoading"
        :clearable="TableInEdit ? false : true"
        :remote="field.Config.DataSourceSqlRemote == true"
        :remote-method="
            (query) => {
                return SelectRemoteMethod(query, field);
            }
        "
        :suffix-icon="field.Config.DataSourceSqlRemote == true ? _ArrowDownIcon : undefined"
        :placeholder="GetFieldPlaceholder(field)"
        :value-key="GetSelectValueKey(field)"
        @change="
            (item) => {
                return SelectChange(item, field);
            }
        "
        @focus="SelectField(field)"
        @visible-change="
            (visible) => {
                return VisibleChange(visible, field);
            }
        "
    >
        <!--注意：field.Data数据是在变的，
            这里面之前设置的key【'slt_opt_key' + field.Name + '_' + index2】一定会重复，
            因为field.Name是固定不变的，
            已解决-->
        <el-option
            v-for="(fieldData, index2) in SelectOptionList"
            :key="'slt_opt_' + field.Name + '_' + index2"
            :label="GetOptionLabel(fieldData)"
            :value="GetOptionValue(fieldData)"
        />
    </el-select>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="下拉框配置"
        draggable
        align-center
        width="70%"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <DiyDataSourceConfig
                v-model:config="configForm"
                v-model:dataList="configDataList"
                v-model:keyValueList="configKeyValueList"
                :showSaveFormat="field.Component == 'Select' || field.Component == 'Radio'"
                :showEnableSearch="field.Component == 'Select' || field.Component == 'MultipleSelect'"
                :showKeyValue="true"
            />
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script>
import _ from "underscore";
import { ArrowDown } from "@element-plus/icons-vue";
import { markRaw } from "vue";
import DiyDataSourceConfig from "./shared/DiyDataSourceConfig.vue";

export default {
    name: "diy-select",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbackFormValueChange', 'update:modelValue'],
    components: {
        DiyDataSourceConfig
    },
    data() {
        return {
            // 修复：根据是否多选决定默认值类型
            ModelValue: this.field?.Component === 'MultipleSelect' ? [] : '',
            LastModelValue: this.field?.Component === 'MultipleSelect' ? [] : '',
            FieldAllData: [],
            NeedResetDataSourse: true,
            _selectDestroyed: false,
            _ArrowDownIcon: markRaw(ArrowDown),
            // 配置弹窗相关
            configDialogVisible: false,
            configForm: {
                SelectLabel: '',
                SelectSaveFormat: 'Text',
                SelectSaveField: '',
                EnableSearch: false,
                DataSource: 'Data',
                Sql: '',
                DataSourceId: '',
                DataSourceApiEngineKey: '',
                DataSourceSqlRemote: false
            },
            configDataList: [],
            configKeyValueList: []
        };
    },
    model: {
        prop: "ModelProps",
        event: "ModelChange"
    },
    props: {
        modelValue: {
            // 修复：允许接收多种类型，在组件内部标准化
            type: [String, Number, Object, Array],
            default: ''
        },
        ModelProps: {},
        field: { type: Object, default: () => {} },
        DiyTableModel: { type: Object, default: () => {} },
        ApiReplace: { type: Object, default: () => {} },
        FormDiyTableModel: { type: Object, default: () => {} },
        //表单模式Add、Edit、View
        FormMode: { type: String, default: "" },
        // ['FieldName1','FieldName2']
        ReadonlyFields: { type: Array, default: () => [] },
        FieldReadonly: { type: Boolean, default: null },
        TableInEdit: { type: Boolean, default: false },
        TableId: { type: String, default: "" },
        DiyFieldList: { type: Array, default: () => [] },
        DiyConfig: {
            type: Object,
            default() {
                return {};
            }
        }
    },

    watch: {
        modelValue: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                // 先标准化值
                const normalizedVal = self.normalizeSelectValue(newVal);
                if (self._isEmptySelectValue(normalizedVal)) {
                    self.ModelValue = self._getEmptyModelValue();
                    return;
                }

                // 普通数据源 Data，值就是字符串
                if (self._isPlainDataSource()) {
                    if (self._isMultipleSelect()) {
                        self.ModelValue = self._normalizePlainDataSourceValue(normalizedVal);
                        return;
                    }
                    var resolved = self._resolveDataSourceValue(normalizedVal);
                    // 优先从 field.Data 中取同引用，避免同值不触发重选
                    if (!self.DiyCommon.IsNull(resolved) && Array.isArray(self.field.Data)) {
                        var hit = self.field.Data.find(function (it) { return it == resolved || String(it) === String(resolved); });
                        if (hit !== undefined) resolved = hit;
                    }
                    var changed = self.ModelValue !== resolved;
                    self.ModelValue = resolved;
                    if (!changed) self._forceReSelectModelValue();
                    return;
                }
                if (self._isMultipleSelectSaveFieldObjectDataSource()) {
                    self.ModelValue = self._normalizeMultipleSaveFieldValue(normalizedVal);
                    self._ensureSelectOption(self.ModelValue);
                    return;
                }
                // KeyValue 数据源：存储的是 Key，但 ModelValue 需要是对象才能正确显示 Value
                if (self.field && self.field.Config && self.field.Config.DataSource === "KeyValue") {
                    self.ModelValue = self._normalizeKeyValueValue(normalizedVal);
                    return;
                }
                // SQL/DataSource/ApiEngine 数据源：单选 + 存储形式为"字段"时，值是字符串，需转为对象
                self.ModelValue = self._resolveTextFormatValue(normalizedVal);
            }
        },
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                // 先标准化值
                const normalizedVal = self.normalizeSelectValue(newVal);
                if (self._isEmptySelectValue(normalizedVal)) {
                    self.ModelValue = self._getEmptyModelValue();
                    return;
                }

                // 普通数据源 Data，值就是字符串
                if (self._isPlainDataSource()) {
                    if (self._isMultipleSelect()) {
                        self.ModelValue = self._normalizePlainDataSourceValue(normalizedVal);
                        return;
                    }
                    var resolved = self._resolveDataSourceValue(normalizedVal);
                    if (!self.DiyCommon.IsNull(resolved) && Array.isArray(self.field.Data)) {
                        var hit = self.field.Data.find(function (it) { return it == resolved || String(it) === String(resolved); });
                        if (hit !== undefined) resolved = hit;
                    }
                    var changed = self.ModelValue !== resolved;
                    self.ModelValue = resolved;
                    if (!changed) self._forceReSelectModelValue();
                    return;
                }
                if (self._isMultipleSelectSaveFieldObjectDataSource()) {
                    self.ModelValue = self._normalizeMultipleSaveFieldValue(normalizedVal);
                    self._ensureSelectOption(self.ModelValue);
                    return;
                }
                // KeyValue 数据源：存储的是 Key，但 ModelValue 需要是对象才能正确显示 Value
                if (self.field && self.field.Config && self.field.Config.DataSource === "KeyValue") {
                    self.ModelValue = self._normalizeKeyValueValue(normalizedVal);
                    return;
                }
                // SQL/DataSource/ApiEngine 数据源：单选 + 存储形式为"字段"时，值是字符串，需转为对象
                self.ModelValue = self._resolveTextFormatValue(normalizedVal);
            }
        },
        "field.Data": function (newVal, oldVal) {
            var self = this;
            // if (newVal.length > 0 && self.FieldAllData.length == 0) {//2023-10-27注释
            //2023-10-27新增：有可能下拉框组件的数据源是动态赋值的，FieldAllData也要跟着变
            // 首次数据加载时（FieldAllData为空），即使NeedResetDataSourse=false也要匹配
            // 解决远程搜索SQL数据源在表内编辑时初始不显示值的问题
            var dataList = Array.isArray(newVal) ? newVal : [];
            var isFirstLoad = self.FieldAllData.length === 0 && dataList.length > 0;
            if (self.NeedResetDataSourse || isFirstLoad) {
                self.FieldAllData = [...dataList];
                if (self._isEmptySelectValue(self.ModelValue)) {
                    self.ModelValue = self._getEmptyModelValue();
                    self.NeedResetDataSourse = true;
                    return;
                }

                // 只有在需要重置数据源时才同步 ModelValue
                // 如果是普通数据源Data或KeyValue，处理方式不同
                if (self._isPlainDataSource()) {
                    if (self._isMultipleSelect()) {
                        self.ModelValue = self._normalizePlainDataSourceValue(self.ModelValue);
                        self.NeedResetDataSourse = true;
                        return;
                    }
                    // 普通数据源：ModelValue 可能是字符串、数字、对象（历史遗留），统一规整
                    var normalizedCurrent = self._resolveDataSourceValue(self.ModelValue);
                    var delData = self.field.Data.find((item) => {
                        // 用宽松比较以兼容数字/字符串（普通数据源选项均为字符串）
                        return item == normalizedCurrent || String(item) === String(normalizedCurrent);
                    });
                    if (delData !== undefined) {
                        var sameRef = self.ModelValue === delData;
                        self.ModelValue = delData;
                        if (sameRef) self._forceReSelectModelValue();
                    } else if (normalizedCurrent !== self.ModelValue) {
                        // 没匹配到但当前值已规整过，更新本地 ModelValue
                        self.ModelValue = normalizedCurrent;
                    }
                } else if (self.field.Config.DataSource === "KeyValue") {
                    self.ModelValue = self._normalizeKeyValueValue(self.ModelValue);
                } else {
                    // 其他数据源（Sql/DataSource/ApiEngine），item是对象
                    var saveField = self.field.Config.SelectSaveField || self.field.Config.SelectLabel;
                    if (saveField) {
                        if (self._isMultipleSelectSaveFieldObjectDataSource()) {
                            self.ModelValue = self._normalizeMultipleSaveFieldValue(self.ModelValue);
                            self._ensureSelectOption(self.ModelValue);
                            self.FieldAllData = [...self.field.Data];
                            self.NeedResetDataSourse = true;
                            return;
                        }
                        // ModelValue 可能已被 mounted() 转换为对象，需要提取原始值进行比较
                        var compareVal = (typeof self.ModelValue === 'object' && self.ModelValue !== null && !Array.isArray(self.ModelValue))
                            ? self.ModelValue[saveField] : self.ModelValue;
                        var delData = self.field.Data.find((item) => {
                            return item[saveField] == compareVal;
                        });
                        if (delData) {
                            self.ModelValue = delData;
                        } else if (!self.DiyCommon.IsNull(compareVal) && typeof self.ModelValue === 'object' && self.ModelValue !== null) {
                            // 当前值不在数据源结果中（远程搜索有LIMIT时常见），
                            // 将当前值对象插入field.Data，确保el-select能显示
                            self.field.Data.push(self.ModelValue);
                            self.FieldAllData = [...self.field.Data];
                        }
                    }
                }
            }
            self.NeedResetDataSourse = true;
        }
    },

    computed: {
        SelectOptionList() {
            var self = this;
            var data = self.field && Array.isArray(self.field.Data) ? self.field.Data : [];
            return data.filter(function (item) {
                return !self._isEmptyOptionItem(item);
            });
        }
    },

    beforeUnmount() {
        var self = this;
        self._selectDestroyed = true;
        if (self.field) {
            self.field._SelectRemoteRequestId = (self.field._SelectRemoteRequestId || 0) + 1;
            if (self.field.Config) {
                self.field.Config.DataSourceSqlRemoteLoading = false;
            }
        }
    },

    mounted() {
        var self = this;
        // 标准化KeyValue数据源的数据格式（将旧的小写key/value转换为大驼峰Key/Value）
        if (self.field && self.field.Config && self.field.Config.DataSource === "KeyValue" && self.field.Data && Array.isArray(self.field.Data)) {
            self.field.Data = self.field.Data.map(item => {
                if (typeof item === 'object' && item !== null) {
                    return {
                        Key: item.Key || item.key || '',
                        Value: item.Value || item.value || ''
                    };
                }
                return item;
            });
        }

        var modelValue = self.normalizeSelectValue(self.GetFieldValue(self.field, self.FormDiyTableModel));
        // 普通数据源 Data 时，值就是字符串，不需要转换
        if (self._isPlainDataSource()) {
            // 普通数据源：兼容历史遗留数据（对象/数组/数字），统一规整为字符串
            // 并尽量从 field.Data 中找到完全相等的引用，确保 el-select 能匹配上
            self.ModelValue = self._isMultipleSelect()
                ? self._normalizePlainDataSourceValue(modelValue)
                : self._resolveDataSourceValue(modelValue);
            if (!self._isMultipleSelect() && !self.DiyCommon.IsNull(self.ModelValue) && self.field.Data && self.field.Data.length > 0) {
                var matchedItem = self.field.Data.find(function (item) {
                    return item == self.ModelValue || String(item) === String(self.ModelValue);
                });
                if (matchedItem !== undefined) {
                    self.ModelValue = matchedItem;
                }
            }
        } else if (self.field && self.field.Config && self.field.Config.DataSource === "KeyValue") {
            // KeyValue 数据源，存储的是对象或Key字符串
            self.ModelValue = self._normalizeKeyValueValue(modelValue);
        } else if (typeof modelValue == "string") {
            if (modelValue.startsWith("{") || modelValue.startsWith("[")) {
                try {
                    modelValue = JSON.parse(modelValue);
                } catch (error) {}
            } else if (self.field && self.field.Config && self.field.Config.SelectSaveFormat == "Text" &&
                (!self.DiyCommon.IsNull(self.field.Config.SelectLabel) || !self.DiyCommon.IsNull(self.field.Config.SelectSaveField))) {
                var newModelValue = {};
                if (!self.DiyCommon.IsNull(self.field.Config.SelectSaveField)) {
                    newModelValue[self.field.Config.SelectSaveField] = modelValue;
                }
                if (!self.DiyCommon.IsNull(self.field.Config.SelectLabel)) {
                    newModelValue[self.field.Config.SelectLabel] = modelValue;
                }
                modelValue = newModelValue;
            }
            self.ModelValue = modelValue;
        } else {
            self.ModelValue = modelValue;
        }

        self.ModelValue = self.normalizeSelectValue(self.ModelValue);

        // 对于 SQL/DataSource/ApiEngine 数据源，如果 field.Data 已经加载，
        // 需要从 field.Data 中查找匹配的完整选项对象，否则 el-select 的 value-key 无法匹配
        if (self.field && self.field.Config &&
            (self.field.Config.DataSource === "Sql" ||
             self.field.Config.DataSource === "DataSource" ||
             self.field.Config.DataSource === "ApiEngine") &&
            self.field.Data && self.field.Data.length > 0 &&
            !self.DiyCommon.IsNull(self.ModelValue)) {
            var saveField = self.field.Config.SelectSaveField || self.field.Config.SelectLabel;
            if (saveField) {
                if (self._isMultipleSelectSaveFieldObjectDataSource()) {
                    self.ModelValue = self._normalizeMultipleSaveFieldValue(self.ModelValue);
                } else {
                    var compareVal = (typeof self.ModelValue === 'object' && self.ModelValue !== null && !Array.isArray(self.ModelValue))
                        ? self.ModelValue[saveField] : self.ModelValue;
                    var found = self.field.Data.find(function(item) { return item[saveField] == compareVal; });
                    if (found) {
                        self.ModelValue = found;
                    }
                }
            }
        }

        // 确保当前值的选项存在于field.Data中（表内编辑时，数据源可能因LIMIT不包含当前值）
        self._ensureSelectOption(self.ModelValue);

        self.LastModelValue = self.ModelValue;
        self.$nextTick(function () {
            //如果是普通数据源或KeyValue
            if (self.field && (self._isPlainDataSource() || self.field.Config.DataSource == "KeyValue")) {
                self.FieldAllData = [...self.field.Data];
            }
            // SQL/DataSource/ApiEngine数据源处理
            if (self.field && self.field.Config &&
                (self.field.Config.DataSource === "Sql" ||
                 self.field.Config.DataSource === "DataSource" ||
                 self.field.Config.DataSource === "ApiEngine")) {
                // 如果数据已加载，初始化FieldAllData
                if (self.field.Data && self.field.Data.length > 0) {
                    self.FieldAllData = [...self.field.Data];
                }
                // 远程搜索模式下，主动加载一次数据，确保表内编辑时能立即显示当前值
                // SetFieldsData批量API不传_Keyword，含$Keyword$的SQL可能返回空
                var selectedCount = Array.isArray(self.ModelValue)
                    ? self.ModelValue.filter(function (item) { return !self._isEmptySelectValue(item); }).length
                    : (self._isEmptySelectValue(self.ModelValue) ? 0 : 1);
                if (self.field.Config.DataSourceSqlRemote &&
                    selectedCount > 0 &&
                    (!self.field.Data || self.field.Data.length === 0 || self.field.Data.length <= selectedCount)) {
                    self.SelectRemoteMethod("", self.field);
                }
            }

            self.Initing = false;
        });
    },

    methods: {
        // ============ 模板渲染辅助 ============
        // el-option 的 :label —— 严格按数据源类型分流，不会因 SelectLabel 误配置导致 undefined
        GetOptionLabel(fieldData) {
            var self = this;
            var cfg = (self.field && self.field.Config) || {};
            // KeyValue：固定显示 Value
            if (cfg.DataSource === "KeyValue") {
                if (fieldData && typeof fieldData === "object") {
                    return fieldData.Value !== undefined ? fieldData.Value : (fieldData.value !== undefined ? fieldData.value : "");
                }
                return fieldData == null ? "" : fieldData;
            }
            // 普通数据源 Data（含老字段空 DataSource + 字符串数组）：直接显示 fieldData 本身
            if (self._isPlainDataSource()) {
                return fieldData == null ? "" : (typeof fieldData === "object" ? "" : fieldData);
            }
            // 字符串/数字/布尔（理论上不该出现在对象数据源里，兜底）
            if (typeof fieldData === "string" || typeof fieldData === "number" || typeof fieldData === "boolean") {
                return fieldData;
            }
            // Sql / DataSource / ApiEngine：fieldData 是对象
            if (fieldData && typeof fieldData === "object") {
                if (!self.DiyCommon.IsNull(cfg.SelectLabel) && fieldData[cfg.SelectLabel] != null) {
                    return fieldData[cfg.SelectLabel];
                }
                if (!self.DiyCommon.IsNull(cfg.SelectSaveField) && fieldData[cfg.SelectSaveField] != null) {
                    return fieldData[cfg.SelectSaveField];
                }
                // 兜底：常见命名
                var fb = ["Name", "name", "Label", "label", "Text", "text", "Value", "value"];
                for (var i = 0; i < fb.length; i++) {
                    if (fieldData[fb[i]] != null) return fieldData[fb[i]];
                }
            }
            return "";
        },
        // el-option 的 :value —— 必须与 ModelValue 类型严格一致才能命中选中
        GetOptionValue(fieldData) {
            var self = this;
            var cfg = (self.field && self.field.Config) || {};
            // KeyValue：value 是整个对象（el-select 用 value-key="Key" 比较）
            if (cfg.DataSource === "KeyValue") {
                if (fieldData && typeof fieldData === "object") {
                    return {
                        Key: fieldData.Key !== undefined ? fieldData.Key : (fieldData.key !== undefined ? fieldData.key : ""),
                        Value: fieldData.Value !== undefined ? fieldData.Value : (fieldData.value !== undefined ? fieldData.value : "")
                    };
                }
                return fieldData;
            }
            // 普通数据源 Data：value 是字符串本身（绝不能是对象，否则与 ModelValue (字符串) 无法匹配）
            if (self._isPlainDataSource()) {
                if (fieldData == null) return "";
                return typeof fieldData === "object" ? "" : (typeof fieldData === "string" ? fieldData : String(fieldData));
            }
            // 多选 + 对象数据源 + 保存字段：v-model 保存字段值数组，option value 必须是保存字段值
            if (self._isMultipleSelectSaveFieldObjectDataSource()) {
                return self._getOptionFieldValue(fieldData, cfg.SelectSaveField);
            }
            // Sql / DataSource / ApiEngine：value 是整个对象
            return fieldData;
        },
        // 判断是否为“普通数据源 Data”：宽容老字段（DataSource 可能为空/未设置，但 field.Data 是字符串数组）
        _isPlainDataSource() {
            var self = this;
            var ds = self.field && self.field.Config ? self.field.Config.DataSource : "";
            if (ds === "Data") return true;
            // 未设置数据源但 field.Data 是字符串数组 → 视为普通数据源
            if (!ds || ds === "") {
                if (Array.isArray(self.field.Data) && self.field.Data.length > 0 && typeof self.field.Data[0] === "string") {
                    return true;
                }
            }
            return false;
        },
        _isObjectDataSource() {
            var self = this;
            var ds = self.field && self.field.Config ? self.field.Config.DataSource : "";
            return ds === "Sql" || ds === "DataSource" || ds === "ApiEngine";
        },
        _isMultipleSelect() {
            return this.field && this.field.Component === "MultipleSelect";
        },
        _isMultipleSelectSaveFieldObjectDataSource() {
            var cfg = (this.field && this.field.Config) || {};
            return this._isMultipleSelect()
                && this._isObjectDataSource()
                && !this.DiyCommon.IsNull(cfg.SelectSaveField);
        },
        _getOptionFieldValue(item, fieldName) {
            var self = this;
            if (self._isEmptySelectValue(item)) return "";
            if (item && typeof item === "object" && !Array.isArray(item)) {
                if (!self.DiyCommon.IsNull(fieldName) && !self.DiyCommon.IsNull(item[fieldName])) return item[fieldName];
                var cfg = (self.field && self.field.Config) || {};
                var keys = [cfg.SelectSaveField, cfg.SelectLabel, "Id", "Value", "value", "Key", "key", "Name", "name"];
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    if (key && !self.DiyCommon.IsNull(item[key])) return item[key];
                }
                return "";
            }
            return item;
        },
        _isSameOptionList(oldList, newList) {
            oldList = Array.isArray(oldList) ? oldList : [];
            newList = Array.isArray(newList) ? newList : [];
            if (oldList.length !== newList.length) return false;
            try {
                return JSON.stringify(oldList) === JSON.stringify(newList);
            } catch (error) {
                return oldList === newList;
            }
        },
        _normalizeMultipleSaveFieldValue(value) {
            var self = this;
            var cfg = (self.field && self.field.Config) || {};
            var arr = Array.isArray(value) ? value : self.normalizeSelectValue(value);
            if (!Array.isArray(arr)) arr = self._isEmptySelectValue(arr) ? [] : [arr];
            return arr.map(function (item) {
                return self._getOptionFieldValue(item, cfg.SelectSaveField);
            }).filter(function (item) {
                return !self._isEmptySelectValue(item);
            });
        },
        _normalizePlainDataSourceValue(value) {
            var self = this;
            if (!self._isMultipleSelect()) {
                return self._resolveDataSourceValue(value);
            }
            if (self._isEmptySelectValue(value)) return [];
            var arr = Array.isArray(value) ? value : self.normalizeSelectValue(value);
            if (!Array.isArray(arr)) arr = self._isEmptySelectValue(arr) ? [] : [arr];
            return arr.map(function (item) {
                return self._resolveDataSourceValue(item);
            }).filter(function (item) {
                return !self.DiyCommon.IsNull(item);
            });
        },
        _normalizeKeyValueItem(item) {
            var self = this;
            if (self._isEmptySelectValue(item)) return null;
            if (item && typeof item === "object" && !Array.isArray(item)) {
                var key = item.Key !== undefined ? item.Key : item.key;
                var value = item.Value !== undefined ? item.Value : item.value;
                return {
                    Key: key !== undefined ? key : "",
                    Value: value !== undefined ? value : (key !== undefined ? key : "")
                };
            }
            if (self.field && Array.isArray(self.field.Data)) {
                var found = self.field.Data.find(function (dataItem) {
                    if (!dataItem || typeof dataItem !== "object") return false;
                    var dataKey = dataItem.Key !== undefined ? dataItem.Key : dataItem.key;
                    return dataKey == item;
                });
                if (found) {
                    return {
                        Key: found.Key !== undefined ? found.Key : (found.key !== undefined ? found.key : ""),
                        Value: found.Value !== undefined ? found.Value : (found.value !== undefined ? found.value : item)
                    };
                }
            }
            return {
                Key: item,
                Value: item
            };
        },
        _normalizeKeyValueValue(value) {
            var self = this;
            var isMultiple = self._isMultipleSelect();
            if (self._isEmptySelectValue(value)) return isMultiple ? [] : "";
            if (isMultiple) {
                var arr = Array.isArray(value) ? value : self.normalizeSelectValue(value);
                if (!Array.isArray(arr)) arr = self._isEmptySelectValue(arr) ? [] : [arr];
                return arr.map(function (item) {
                    return self._normalizeKeyValueItem(item);
                }).filter(function (item) {
                    return item && !self._isEmptySelectValue(item);
                });
            }
            var singleValue = Array.isArray(value)
                ? value.find(function (item) { return !self._isEmptySelectValue(item); })
                : value;
            return self._normalizeKeyValueItem(singleValue) || "";
        },
        _getEmptyModelValue() {
            return this.field && this.field.Component === "MultipleSelect" ? [] : "";
        },
        _isEmptySelectValue(value) {
            var self = this;
            if (value === null || value === undefined || value === "" || value === "undefined" || value === "null") return true;
            if (Array.isArray(value)) {
                return value.length === 0 || value.every(function (item) { return self._isEmptySelectValue(item); });
            }
            if (typeof value === "object") {
                var cfg = (self.field && self.field.Config) || {};
                if (cfg.DataSource === "KeyValue") {
                    var key = value.Key !== undefined ? value.Key : value.key;
                    return self.DiyCommon.IsNull(key);
                }
                if (cfg.DataSource === "Sql" || cfg.DataSource === "DataSource" || cfg.DataSource === "ApiEngine") {
                    var saveField = cfg.SelectSaveField || cfg.SelectLabel;
                    if (!self.DiyCommon.IsNull(saveField) && self.DiyCommon.IsNull(value[saveField])) return true;
                }
                var keys = Object.keys(value);
                if (keys.length === 0) return true;
                return keys.every(function (key) { return self.DiyCommon.IsNull(value[key]); });
            }
            return false;
        },
        _isEmptyOptionItem(item) {
            var self = this;
            var cfg = (self.field && self.field.Config) || {};
            if (self._isEmptySelectValue(item)) return true;
            if (cfg.DataSource === "KeyValue" && item && typeof item === "object") {
                var key = item.Key !== undefined ? item.Key : item.key;
                return self.DiyCommon.IsNull(key);
            }
            if (self._isPlainDataSource()) {
                return typeof item === "object" || self.DiyCommon.IsNull(item);
            }
            if ((cfg.DataSource === "Sql" || cfg.DataSource === "DataSource" || cfg.DataSource === "ApiEngine") && item && typeof item === "object") {
                var saveField = cfg.SelectSaveField || cfg.SelectLabel;
                return !self.DiyCommon.IsNull(saveField) && self.DiyCommon.IsNull(item[saveField]);
            }
            return false;
        },
        // 强制刷新 el-select 选中状态（处理同字符串赋值不触发反应性的场景）
        _forceReSelectModelValue() {
            var self = this;
            var keep = self.ModelValue;
            if (self.DiyCommon.IsNull(keep)) return;
            self.$nextTick(function () {
                // 先清空再赋值，才能让基本类型相同值也触发变更
                var isMulti = self.field && self.field.Component === "MultipleSelect";
                self.ModelValue = isMulti ? [] : "";
                self.$nextTick(function () {
                    self.ModelValue = keep;
                });
            });
        },
        // 修复：普通数据源(Data) 单选时，把任意形态的值（字符串/数字/对象/数组）规整为字符串。
        // 解决 bug：旧记录可能将值保存成 {Name:"选项1"} / ["选项1"] / 数字 等，导致 el-select 无法匹配 el-option 的 :value（字符串）而显示为空。
        _resolveDataSourceValue(val) {
            var self = this;
            if (self.DiyCommon.IsNull(val)) return "";
            // 字符串：先尝试 JSON 解析（兼容历史脏数据 '"齐套"' / '["齐套"]' / '{"Name":"齐套"}'）
            if (typeof val === "string") {
                var trimmed = val.trim();
                if ((trimmed.length > 1) && (
                    (trimmed.charAt(0) === "[" && trimmed.charAt(trimmed.length - 1) === "]") ||
                    (trimmed.charAt(0) === "{" && trimmed.charAt(trimmed.length - 1) === "}") ||
                    (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')
                )) {
                    try {
                        var parsed = JSON.parse(trimmed);
                        return self._resolveDataSourceValue(parsed);
                    } catch (e) { /* 解析失败按原始字符串处理 */ }
                }
                return val;
            }
            if (typeof val === "number" || typeof val === "boolean") return String(val);
            // 数组（历史误存）：取第一个元素
            if (Array.isArray(val)) {
                return val.length > 0 ? self._resolveDataSourceValue(val[0]) : "";
            }
            // 对象（历史误存或 SelectLabel/SelectSaveField 配置遗留）：尝试按配置字段提取
            if (typeof val === "object") {
                var cfg = (self.field && self.field.Config) || {};
                var keys = [cfg.SelectSaveField, cfg.SelectLabel, "Value", "value", "Name", "name", "Label", "label", "Text", "text", "Key", "key"];
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    if (k && !self.DiyCommon.IsNull(val[k])) {
                        return typeof val[k] === "string" ? val[k] : String(val[k]);
                    }
                }
                // 兜底：取对象第一个非空字符串属性
                for (var p in val) {
                    if (Object.prototype.hasOwnProperty.call(val, p) && !self.DiyCommon.IsNull(val[p])) {
                        return typeof val[p] === "string" ? val[p] : String(val[p]);
                    }
                }
                return "";
            }
            return val;
        },
        // 修复：SQL/DataSource/ApiEngine数据源 + 存储形式"字段"时，将字符串值转换为el-select需要的对象
        _resolveTextFormatValue(val) {
            var self = this;
            if (self._isEmptySelectValue(val)) return "";
            // 如果已经是对象，确保它存在于field.Data中
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                self._ensureSelectOption(val);
                return val;
            }
            // 只处理 SQL/DataSource/ApiEngine 数据源 + 单选 + 存储形式"字段"(Text)
            if (self.field && self.field.Config &&
                self.field.Config.SelectSaveFormat === "Text" &&
                (self.field.Config.DataSource === "Sql" ||
                 self.field.Config.DataSource === "DataSource" ||
                 self.field.Config.DataSource === "ApiEngine") &&
                (!self.DiyCommon.IsNull(self.field.Config.SelectLabel) || !self.DiyCommon.IsNull(self.field.Config.SelectSaveField)) &&
                typeof val === 'string' && val !== '') {
                var saveField = self.field.Config.SelectSaveField || self.field.Config.SelectLabel;
                // 先从 field.Data 中查找完整对象
                if (self.field.Data && self.field.Data.length > 0) {
                    var found = self.field.Data.find(function(item) { return item[saveField] == val; });
                    if (found) {
                        return found;
                    }
                }
                // 未找到，构造合成对象让 el-select 能通过 value-key 匹配
                var newObj = {};
                if (!self.DiyCommon.IsNull(self.field.Config.SelectSaveField)) {
                    newObj[self.field.Config.SelectSaveField] = val;
                }
                if (!self.DiyCommon.IsNull(self.field.Config.SelectLabel)) {
                    newObj[self.field.Config.SelectLabel] = val;
                }
                // 将合成对象插入field.Data，确保el-option能渲染
                self._ensureSelectOption(newObj);
                return newObj;
            }
            return val;
        },
        // 确保当前值对应的选项存在于field.Data中（数据源有LIMIT时，已加载数据可能不包含当前值）
        _ensureSelectOption(valObj) {
            var self = this;
            if (!self.field || !self.field.Config) return;
            var ds = self.field.Config.DataSource;
            if (ds !== 'Sql' && ds !== 'DataSource' && ds !== 'ApiEngine') return;
            var saveField = self.field.Config.SelectSaveField || self.field.Config.SelectLabel;
            if (!saveField) return;
            if (!self.field.Data) self.field.Data = [];
            var labelField = self.field.Config.SelectLabel || saveField;
            var values = Array.isArray(valObj) ? valObj : [valObj];
            values.forEach(function(item) {
                if (self._isEmptySelectValue(item)) return;
                var option = item;
                if (!(option && typeof option === 'object' && !Array.isArray(option))) {
                    option = {};
                    option[saveField] = item;
                    option[labelField] = item;
                }
                if (self.DiyCommon.IsNull(option[saveField])) return;
                var exists = self.field.Data.some(function(dataItem) { return dataItem && dataItem[saveField] == option[saveField]; });
                if (!exists) {
                    self.field.Data.push(option);
                }
            });
        },
        // 修复：标准化选择框的值，根据单选/多选返回正确类型
        normalizeSelectValue(value) {
            const isMultiple = this.field?.Component === 'MultipleSelect';

            if (this._isEmptySelectValue(value)) {
                return isMultiple ? [] : '';
            }

            // 多选模式
            if (isMultiple) {
                // 已经是数组
                if (Array.isArray(value)) {
                    return value.filter(item => !this._isEmptySelectValue(item));
                }
                // 字符串尝试 JSON 解析
                if (typeof value === 'string') {
                    try {
                        const parsed = JSON.parse(value);
                        if (Array.isArray(parsed)) {
                            return parsed;
                        }
                    } catch (e) {
                        // 解析失败，可能是逗号分隔
                        if (value.includes(',')) {
                            return value.split(',').map(v => v.trim()).filter(v => v);
                        }
                    }
                }
                // 单个值包装成数组
                return [value];
            }

            // 单选模式
            // 数组取第一个元素
            if (Array.isArray(value)) {
                var firstValue = value.find(item => !this._isEmptySelectValue(item));
                return firstValue === undefined ? '' : firstValue;
            }
            // 直接返回
            return value;
        },
        Init() {
            var self = this;
            const fieldValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
            self.ModelValue = self.normalizeSelectValue(fieldValue);
            self.LastModelValue = self.normalizeSelectValue(fieldValue);
        },
        VisibleChange(visible, field) {
            var self = this;
            if (field.Config.DataSourceSqlRemote) {
                if (visible && (!Array.isArray(field.Data) || field.Data.length === 0)) {
                    self.SelectRemoteMethod("", field);
                }
                return;
            }
            if (!visible) {
                self.FilterMethod("", field);
            }
        },
        GetFieldValue(field, form) {
            var self = this;
            if (!self.DiyCommon.IsNull(field.AsName)) {
                return form[field.AsName];
            }
            return form[field.Name];
        },
        ModelChangeMethods(item) {
            var self = this;
            self.ModelValue = item;
            // 修复：直接更新 FormDiyTableModel，确保数据同步
            var fieldName = self.DiyCommon.IsNull(self.field.AsName) ? self.field.Name : self.field.AsName;
            self.FormDiyTableModel[fieldName] = item;
            self.$emit("ModelChange", self.ModelValue);
            self.$emit("update:modelValue", self.ModelValue);
        },
        CommonV8CodeChange(item, field) {
            var self = this;
            if ((field.V8Code || (field.Config && field.Config.V8Code))) {
                // self.RunV8Code({ field: field, thisValue: item });
                self.$emit("CallbackRunV8Code", { field: field, thisValue: item });
            }
        },
        GetFieldReadOnly(field) {
            var self = this;
            if (self.FieldReadonly == true) {
                return true;
            }
            if (self.FormMode == "View") {
                return true;
            }
            if (self.ReadonlyFields.indexOf(field.Name) > -1) {
                return true;
            }
            return field.Readonly ? true : false;
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
            return result || "请选择";
        },
        SelectField(field) {
            var self = this;
            self.$emit("CallbackSelectField", field);
        },
        beforeSelectChange(value, field) {
            let self = this;
            return new Promise((resolve, reject) => {
                // 判断需要执行的V8
                if ((field.Component == "Select" || field.Component == "MultipleSelect") && (field.V8Code || (field.Config && field.Config.V8Code))) {
                    self.$emit("CallbackRunV8Code", {
                        field: field,
                        thisValue: value,
                        callback: (res) => {
                            resolve(res);
                        }
                    });
                } else {
                    resolve(true);
                }
            });
        },
        async SelectChange(item, field) {
            var self = this;
            // KeyValue 数据源特殊处理：ModelValue 和 FormDiyTableModel 都保持完整对象
            var saveItem = item;
            if (field.Config.DataSource === "KeyValue") {
                saveItem = self._normalizeKeyValueValue(item);
                // ModelValue 和 FormDiyTableModel 都保存标准化后的对象/对象数组
                self.ModelValue = saveItem;
                var fieldName = self.DiyCommon.IsNull(self.field.AsName) ? self.field.Name : self.field.AsName;
                self.FormDiyTableModel[fieldName] = saveItem;
                // emit 也发送标准化后的对象/对象数组
                self.$emit("ModelChange", saveItem);
                self.$emit("update:modelValue", saveItem);
            } else {
                self.ModelChangeMethods(saveItem);
            }
            let res = await self.beforeSelectChange(self.ModelValue, field);
            if (res === false) return;
            //如果是表内编辑，失去焦点要自动保存
            if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
                // 让父组件（diy-table）中央接管：可实现 SysMenuModel.SaveType 的 Auto(全行保存) / Submit(批量提交)
                var __interceptPayload = { row: self.FormDiyTableModel, field: self.field, oldValue: self.LastModelValue, newValue: self.ModelValue, handled: false };
                self.$emit("CallbackInTableEditSave", __interceptPayload);
                if (__interceptPayload.handled === true) {
                    self.LastModelValue = self.ModelValue;
                    self.$emit("CallbackFormValueChange", self.field, saveItem);
                    return;
                }
                var param = {
                    TableId: self.TableId,
                    Id: self.FormDiyTableModel.Id,
                    _FormData: {}
                };
                param._FormData[self.field.Name] = self.ModelValue;
                let dataLog = [
                    {
                        Name: field.Name,
                        Label: field.Label || field.Name,
                        Component: field.Component,
                        OVal: self.LastModelValue || "",
                        NVal: self.ModelValue || ""
                    }
                ];
                param._DataLog = JSON.stringify(dataLog);
                self.DiyCommon.ForRowModelHandler(param._FormData, self.DiyFieldList);
                param._FormData = self.DiyCommon.ConvertRowModel(param._FormData);

                var apiUrl = self.DiyApi.UptDiyTableRow;
                if (self.DiyTableModel && self.DiyTableModel.ApiReplace && self.DiyTableModel.ApiReplace.Update) {
                    apiUrl = self.DiyCommon.RepalceUrlKey(self.DiyTableModel.ApiReplace.Update);
                }
                if (self.DiyConfig && self.DiyConfig.AddBtnType == "InTable" && self.DiyConfig.SaveType == "提交一起保存") {
                    if (!self.FormDiyTableModel._DataStatus) {
                        if (self.FormDiyTableModel._IsInTableAdd === true) {
                            self.FormDiyTableModel["_DataStatus"] = "Add";
                        } else {
                            self.FormDiyTableModel["_DataStatus"] = "Edit";
                        }
                    }
                    return;
                }
                self.DiyCommon.Post(apiUrl, param, function (result) {
                    if (self.DiyCommon.Result(result)) {
                        self.LastModelValue = self.ModelValue;
                        self.DiyCommon.Tips(self.$t("Msg.Success"));
                    }
                });
            }

            self.$emit("CallbackFormValueChange", self.field, saveItem);
        },
        GetSelectValueKey(field) {
            var self = this;
            //如果是普通数据源Data（含老字段：DataSource为空但field.Data为字符串数组），直接返回undefined，
            //因为值本身就是字符串，不需要 value-key（设了 value-key 会让 el-select 用对象比较，导致字符串无法选中）
            if (self._isPlainDataSource && self._isPlainDataSource()) {
                return undefined;
            }
            if (field.Config.DataSource === "Data") {
                return undefined;
            }
            // KeyValue 数据源，使用 Key 作为 value-key
            if (field.Config.DataSource === "KeyValue") {
                return "Key";
            }
            if (field.Component === "MultipleSelect" && !self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                return undefined;
            }
            if (self.DiyCommon.IsNull(field.Config.SelectLabel) && self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                return "";
            } else {
                return self.DiyCommon.IsNull(field.Config.SelectSaveField) ? field.Config.SelectLabel : field.Config.SelectSaveField;
            }
        },
        FilterMethod(query, field) {
            var self = this;
            if (query) {
                self.NeedResetDataSourse = false;
                field.Data = _.filter([...self.FieldAllData], function (item) {
                    if (field.Config.DataSource == "Data") {
                        return item.indexOf(query) > -1;
                    }
                    if (field.Config.DataSource == "KeyValue") {
                        return (item.Value && item.Value.indexOf(query) > -1) || (item.Key && item.Key.indexOf(query) > -1);
                    }
                    return item[field.Config.SelectLabel].indexOf(query) > -1;
                });
            } else {
                self.NeedResetDataSourse = false;
                if (self.field && (self.field.Config.DataSource == "Data" || self.field.Config.DataSource == "KeyValue")) {
                    field.Data = [...self.FieldAllData];
                }
            }
        },
        SelectRemoteMethod(query, field) {
            var self = this;
            if (self._selectDestroyed || !field || !field.Config) return;
            query = query == null ? "" : String(query);
            if (field.Config.DataSourceSqlRemote == true)
            {
                if (field.Config.DataSourceSqlRemoteLoading === true && field._SelectRemoteLastQuery === query) {
                    return;
                }
                if (field._SelectRemoteLoadedQuery === query) {
                    return;
                }
                field._SelectRemoteLastQuery = query;
                field._SelectRemoteRequestId = (field._SelectRemoteRequestId || 0) + 1;
                var requestId = field._SelectRemoteRequestId;
                field.Config.DataSourceSqlRemoteLoading = true;
                var apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
                var postData = {
                    _FieldId: field.Id,
                    _FormData: this.FormDiyTableModel,
                    _Keyword: query
                };
                if (field.Config.DataSource == "Sql") {
                    apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
                } else if (field.Config.DataSource == "DataSource") {
                    apiGetDiyFieldSqlData = self.DiyApi.GetDataSourceEngine;
                    postData = {
                        ...postData,
                        DataSourceKey: field.Config.DataSourceId
                    };
                } else if (field.Config.DataSource == "ApiEngine") {
                    apiGetDiyFieldSqlData = self.DiyApi.ApiEngineRun;
                    postData = {
                        ...postData,
                        ApiEngineKey: field.Config.DataSourceApiEngineKey
                    };
                }

                if (!self.DiyCommon.IsNull(self.ApiReplace && self.ApiReplace.GetDiyFieldSqlData)) {
                    apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
                }
                // 安全兜底：无论请求成功/失败/异常/空结果，都必须重置 loading 为 false，
                // 并把 field.Data 规整为数组，避免 el-select 在 remote 模式下卡在"加载中"
                var finishLoading = function (data, markLoaded) {
                    if (self._selectDestroyed) return;
                    if (requestId !== field._SelectRemoteRequestId) return;
                    try {
                        self.NeedResetDataSourse = false;
                        var nextData = Array.isArray(data) ? data : [];
                        if (!self._isSameOptionList(field.Data, nextData)) {
                            field.Data = nextData;
                        }
                        if (markLoaded !== false) {
                            field._SelectRemoteLoadedQuery = query;
                        }
                    } finally {
                        field.Config.DataSourceSqlRemoteLoading = false;
                    }
                };
                try {
                    self.DiyCommon.Post(
                        apiGetDiyFieldSqlData,
                        postData,
                        function (result) {
                            if (result && result.Code == 1) {
                                finishLoading(result.Data);
                            } else {
                                // 接口返回失败：保留原数据但必须关闭 loading
                                finishLoading(field.Data, false);
                            }
                        },
                        function (error) {
                            finishLoading(field.Data, false);
                        }
                    );
                } catch (e) {
                    finishLoading(field.Data, false);
                }
            }
        },
        // ==================== 配置弹窗相关方法 ====================
        openConfig() {
            var self = this;
            // 初始化配置表单
            if (!self.field.Config) {
                self.field.Config = {};
            }
            self.configForm = {
                SelectLabel: self.field.Config.SelectLabel || '',
                SelectSaveFormat: self.field.Config.SelectSaveFormat || 'Text',
                SelectSaveField: self.field.Config.SelectSaveField || '',
                EnableSearch: self.field.Config.EnableSearch || false,
                DataSource: self.field.Config.DataSource || 'Data',
                Sql: self.field.Config.Sql || '',
                DataSourceId: self.field.Config.DataSourceId || '',
                DataSourceApiEngineKey: self.field.Config.DataSourceApiEngineKey || '',
                DataSourceSqlRemote: self.field.Config.DataSourceSqlRemote || false
            };
            // 初始化普通数据列表
            if (self.field.Data && Array.isArray(self.field.Data)) {
                if (self.configForm.DataSource === 'KeyValue') {
                    self.configKeyValueList = self.field.Data.map(item => {
                        if (typeof item === 'object' && item !== null) {
                            // 兼容旧数据的小写key/value，但优先使用大驼峰Key/Value
                            return { Key: item.Key || item.key || '', Value: item.Value || item.value || '' };
                        }
                        return { Key: String(item), Value: String(item) };
                    });
                    self.configDataList = [];
                } else if (self.configForm.DataSource === 'Data') {
                    self.configDataList = [...self.field.Data];
                    self.configKeyValueList = [];
                } else {
                    self.configDataList = [];
                    self.configKeyValueList = [];
                }
            } else {
                self.configDataList = [];
                self.configKeyValueList = [];
            }
            self.configDialogVisible = true;
        },
        saveConfig() {
            var self = this;
            // 保存配置到 field.Config
            self.field.Config.SelectSaveFormat = self.configForm.SelectSaveFormat;
            self.field.Config.EnableSearch = self.configForm.EnableSearch;
            self.field.Config.DataSource = self.configForm.DataSource;
            self.field.Config.Sql = self.configForm.Sql;
            self.field.Config.DataSourceId = self.configForm.DataSourceId;
            self.field.Config.DataSourceApiEngineKey = self.configForm.DataSourceApiEngineKey;
            self.field.Config.DataSourceSqlRemote = self.configForm.DataSourceSqlRemote;

            // 关键：按数据源严格设置 SelectLabel / SelectSaveField，避免残留导致选中显示异常
            if (self.configForm.DataSource === 'Data') {
                // 普通数据源：值就是字符串本身，不需要 SelectLabel/SelectSaveField
                self.field.Config.SelectLabel = '';
                self.field.Config.SelectSaveField = '';
                self.field.Data = [...self.configDataList];
            } else if (self.configForm.DataSource === 'KeyValue') {
                // KeyValue 格式：固定显示 Value，存储 Key
                self.field.Config.SelectLabel = 'Value';
                self.field.Config.SelectSaveField = 'Key';
                self.field.Data = self.configKeyValueList.map(item => ({
                    Key: item.Key,
                    Value: item.Value
                }));
            } else {
                // Sql / DataSource / ApiEngine：使用用户配置的 SelectLabel / SelectSaveField
                self.field.Config.SelectLabel = self.configForm.SelectLabel;
                self.field.Config.SelectSaveField = self.configForm.SelectSaveField;
            }

            self.configDialogVisible = false;
            self.DiyCommon.Tips('配置已保存', true);
        }
    }
};
</script>

<style lang="scss" scoped>
.form-item-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}

.data-list {
    width: 100%;
}

.keyvalue-list {
    width: 100%;

    .keyvalue-item {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
    }
}
</style>
