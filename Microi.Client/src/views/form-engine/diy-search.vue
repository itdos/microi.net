<template>
    <section class="diy-search-container">
        <!-- DIY搜索 - 复选框类型 -->
        <div class="search-checkbox-wrapper" v-if="GetSearchFieldList('Checkbox', SearchType).length > 0">
            <template v-for="(field, index) in GetSearchFieldList('Checkbox', SearchType)">
                <div :key="'search_line_' + field.Id + '_' + index" v-if="Array.isArray(field.Data) && field.Data.length > 0" class="search-checkbox-item">
                    <div class="search-label">
                        <el-tag type="info">
                            <el-icon><Search /></el-icon> {{ field.Label }}
                        </el-tag>
                    </div>
                    <el-checkbox-group v-model="SearchCheckbox[field.AsName || field.Name]" @change="GetDiyTableRow({ _PageIndex: 1 })" class="checkbox-group">
                        <el-checkbox v-for="(fieldData, fieldDatIndex) in field.Data" :key="'fieldData_' + field.Name + fieldDatIndex" :value="GetSearchItemCheckKey(fieldData, field)">
                            {{ GetSearchItemCheckLabel(fieldData, field) }}
                        </el-checkbox>
                    </el-checkbox-group>
                </div>
            </template>
        </div>

        <!-- DIY搜索 - 文本及其他类型 -->
        <div v-if="GetSearchFieldList('Text', SearchType).length > 0" class="search-fields-wrapper">
            <div v-for="(field, index) in GetSearchFieldList('Text', SearchType)" :key="'search_line_2' + field.Id + '_' + index" class="search-field-item">
                <!-- 日期时间选择器 -->
                <div v-if="field.Component == 'DateTime'" class="search-dateTime-block">
                    <div class="search-input-label">
                        <el-tag type="info">
                            <el-icon><Search /></el-icon> {{ field.Label }}
                        </el-tag>
                    </div>
                    <!-- <el-date-picker
                        v-model="SearchDateTime[field.AsName || field.Name]"
                        :type="GetDatePickerType(field)"
                        :value-format="GetDateTimeFormat(field)"
                        :editable="false"
                        range-separator="至"
                        start-placeholder="开始日期"
                        end-placeholder="结束日期"
                        :picker-options="pickerOptions"
                        @change="GetDiyTableRow({ _PageIndex: 1 })"
                    /> -->
                    <div class="date-timer">
                      <el-date-picker
                          id="input-picker"
                          v-model="SearchStartDateTime[field.AsName || field.Name]"
                          type="datetime"
                          :value-format="GetDateTimeFormat(field)"
                          :editable="false"
                          :teleported="false"
                          placeholder="开始日期"
                          :picker-options="pickerOptions"
                          @change="(val) => DateTimeChange(val, field,1)"
                          @clear="() => DateTimeChange('', field,2)"
                      />
                      <span>至</span>
                      <el-date-picker
                          v-model="SearchEndDateTime[field.AsName || field.Name]"
                          type="datetime"
                          :value-format="GetDateTimeFormat(field)"
                          :editable="false"
                          :teleported="false"
                          placeholder="结束日期"
                          :picker-options="pickerOptions"
                          @change="(val) => DateTimeChange(val, field,1)"
                          @clear="() => DateTimeChange('', field,2)"
                      />
                    </div>
                </div>

                <!-- 部门选择器 -->
                <div v-else-if="field.Component == 'Department'" class="search-input-block">
                    <div class="search-input-label">
                        <el-tag type="info">
                            <el-icon><Search /></el-icon> {{ field.Label }}
                        </el-tag>
                    </div>
                    <el-cascader
                        clearable
                        v-model="SearchModel[field.AsName || field.Name]"
                        :options="field.Data"
                        :props="GetDepartmentProps(field)"
                        :filterable="field.Config.Department.Filterable === true"
                        @change="(item) => DeptChange(item, field)"
                        @clear="() => DeptChange('', field)"
                        :collapse-tags="true"
                    />
                </div>

                <!-- 下拉选择器 -->
                <div v-else-if="field.Component == 'Select' || field.Component == 'MultipleSelect'" class="search-input-block">
                    <div class="search-input-label">
                        <el-tag type="info">
                            <el-icon><Search /></el-icon> {{ field.Label }}
                        </el-tag>
                    </div>
                    <el-select
                        v-model="SearchSelect[field.AsName || field.Name]"
                        collapse-tags
                        :multiple="true"
                        :filterable="true"
                        :loading="field.Config.DataSourceSqlRemoteLoading"
                        clearable
                        :remote="field.Config.DataSourceSqlRemote == true"
                        :remote-method="(query) => SelectRemoteMethod(query, field)"
                        :placeholder="GetFieldPlaceholder(field)"
                        :value-key="GetSelectValueKey(field)"
                        @change="(item) => SearchSelectChange(item, field)"
                        @clear="() => SearchSelectChange([], field)"
                    >
                        <el-option
                            v-for="(fieldData, index2) in field.Data"
                            :key="getSelectOptionKey(field, fieldData, index2)"
                            :label="GetSearchItemCheckLabel(fieldData, field)"
                            :value="fieldData"
                        />
                    </el-select>
                </div>

                <!-- 级联选择器 -->
                <div v-else-if="field.Component == 'Cascader'" class="search-input-block">
                    <div class="search-input-label">
                        <el-tag type="info">
                            <el-icon><Search /></el-icon> {{ field.Label }}
                        </el-tag>
                    </div>
                    <el-cascader
                        v-model="SearchModel[field.AsName || field.Name]"
                        :clearable="true"
                        :props="GetCascaderProps(field)"
                        :options="field.Data"
                        :filterable="field.Config.Cascader.Filterable == true"
                        @change="(item) => CascaderChange(item, field)"
                        @clear="() => CascaderChange('', field)"
                        :collapse-tags="true"
                    />
                </div>

                <!-- 树形选择器 -->
                <div v-else-if="field.Component == 'SelectTree'" class="search-input-block">
                    <div class="search-input-label">
                        <el-tag type="info">
                            <el-icon><Search /></el-icon> {{ field.Label }}
                        </el-tag>
                    </div>
                    <el-select
                        clearable
                        class="main-select-tree"
                        ref="selectTree"
                        v-model="SearchModel[field.AsName || field.Name]"
                        :value-key="GetSelectValueKey(field)"
                        @change="(item) => SelectChange(item, field)"
                        @clear="() => SelectChange('', field)"
                        v-if="!forceRerender"
                    >
                        <el-option
                            v-for="item in formatData(field.Data, field)"
                            :key="'item_' + item[field.Config.SelectSaveField]"
                            :label="item[GetLabel(field)]"
                            :value="item[GetSelectValueKey(field)]"
                            style="display: none"
                        />

                        <el-tree
                            class="main-select-el-tree"
                            ref="selecteltree"
                            :data="field.Data"
                            node-key="Id"
                            highlight-current
                            :props="GetSelectTreeProps(field)"
                            @node-click="(item) => handleNodeClick(item, field)"
                            :expand-on-click-node="true"
                            default-expand-all
                        />
                    </el-select>
                </div>

                <!-- 数字范围输入 -->
                <div v-else-if="field.Type && (field.Type.toLowerCase() == 'int' || field.Type.toLowerCase().indexOf('decimal') > -1)" class="search-input-block">
                    <div class="search-input-label">
                        <el-tag type="info">
                            <el-icon><Search /></el-icon> {{ field.Label }}
                        </el-tag>
                    </div>
                    <div class="number-range-wrapper">
                        <el-input-number
                            v-if="SearchNumber[field.Name]"
                            v-model="SearchNumber[field.Name].Min"
                            @blur="GetDiyTableRow({ _PageIndex: 1 })"
                            @keyup.enter="GetDiyTableRow({ _PageIndex: 1 })"
                            controls-position="right"
                            class="number-input"
                        />
                        <span class="range-separator">-</span>
                        <el-input-number
                            v-if="SearchNumber[field.Name]"
                            v-model="SearchNumber[field.Name].Max"
                            @blur="GetDiyTableRow({ _PageIndex: 1 })"
                            @keyup.enter="GetDiyTableRow({ _PageIndex: 1 })"
                            controls-position="right"
                            class="number-input"
                        />
                    </div>
                </div>

                <!-- 开关选择器 -->
                <div v-else-if="field.Component == 'Switch'" class="search-input-block">
                    <div class="search-input-label">
                        <el-tag type="info">
                            <el-icon><Search /></el-icon> {{ field.Label }}
                        </el-tag>
                    </div>
                    <el-select clearable v-model="SearchModel[field.AsName || field.Name]" @change="GetDiyTableRow({ _PageIndex: 1 })" @clear="GetDiyTableRow({ _PageIndex: 1 })">
                        <el-option label="打开" value="1" />
                        <el-option label="关闭" value="0" />
                    </el-select>
                </div>

                <!-- 默认文本输入框 -->
                <el-input v-else v-model="SearchModel[field.AsName || field.Name]" placeholder="" clearable @input="GetDiyTableRow({ _PageIndex: 1 })" class="text-input">
                    <template #prepend>
                        <el-icon><Search /></el-icon> {{ field.Label }}
                    </template>
                </el-input>
            </div>
        </div>
    </section>
</template>

<style lang="scss" scoped>
// 搜索容器样式
.diy-search-container {
    padding: 0;
}
.search-dateTime-block{
  display: flex;
  align-items: top;
  // flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0; // 防止溢出
}
.date-timer{
  display: flex;
  align-items: center;
  gap: 10px;
}
@media screen and (max-width: 768px) {
    .date-timer,
    .number-range-wrapper{
        flex-wrap: wrap;
    }
}
:deep(.el-input__wrapper){
    width: 80px !important;
  }
// 复选框搜索区域
.search-checkbox-wrapper {
    margin-bottom: 0;
    // background: linear-gradient(135deg, #fafbfc 0%, #ffffff 100%);
    border-radius: 12px;
    padding: 0;
    // box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transition: box-shadow 0.3s ease;

    &:hover {
        // box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }
}

.search-checkbox-item {
    margin-bottom: 5px;
    display: flex;
    gap: 10px;
    &:last-child {
        margin-bottom: 5px;
    }
}

.search-label {
    margin-bottom: 0px;
    display: flex;
    align-items: center;

    :deep(.el-tag) {
        height: 32px;
        border-radius: 6px;
        padding: 6px 12px;
        // font-weight: 500;
        // background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, #f5f7fa 100%);
        border: 1px solid rgba(64, 158, 255, 0.2);
        color: #666;//var(--color-primary, #409eff);

        .el-icon {
            margin-right: 4px;
        }
    }
}

.checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;

    :deep(.el-checkbox) {
        margin: 0;
        // padding: 10px 18px;
        border-radius: 8px;
        // background: #ffffff;
        // border: 2px solid #e4e7ed;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);

        &:hover {
            // border-color: var(--color-primary, #409eff);
            // background: color-mix(in srgb, var(--color-primary, #409eff) 5%, white);
            transform: translateY(-2px);
            // box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
        }

        &.is-checked {
            // background: linear-gradient(135deg, var(--color-primary, #409eff) 0%, color-mix(in srgb, var(--color-primary, #409eff) 80%, white) 100%);
            border-color: transparent;
            // box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary, #409eff) 30%, transparent);
            transform: translateY(-1px);

            .el-checkbox__label {
                color: #ffffff;
                // font-weight: 500;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            }

            .el-checkbox__inner {
                background-color: var(--color-primary, #409eff);
                border-color: var(--color-primary, #409eff);

                &::after {
                    border-color: #ffffff;
                    border-width: 2px;
                }
            }
        }

        .el-checkbox__input {
            margin-right: 8px;
        }

        .el-checkbox__label {
            padding-left: 0;
            font-size: 12px;
        }
    }
}

// 文本搜索区域
.search-fields-wrapper {
    display: flex;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
    margin-bottom: 0px;//这里要设置0，不然卡片模式会多出空隙
    // align-items: start;
    align-items: center;
    flex-wrap: wrap;
}
:deep(.el-select__selected-item){
    .el-tag{
        height: 24px;
    }
}
.search-field-item {
    display: flex;
    flex-direction: column;
    min-width: 0; // 防止内容溢出
    width: auto;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    .el-icon {
        margin-right: 2px;
    }
    .el-input{
        width: auto;
    }
    :deep(.el-input__wrapper){
        max-width: 400px;
    }
    :deep(.el-select__wrapper){
        min-width: 100px;
    }
}

.search-input-block {
    display: flex;
    // flex-direction: column;
    gap: 8px;
    width: 100%;
    min-width: 0; // 防止溢出
}

.search-input-label {
    :deep(.el-tag) {
        height: 32px;
        border-radius: 6px;
        padding: 6px 12px;
        // font-weight: 500;
        // background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, #f5f7fa 100%);
        border: 1px solid rgba(64, 158, 255, 0.2);
        color: #666;//var(--color-primary, #409eff);

        .el-icon {
            margin-right: 4px;
        }
    }
}

// 输入框增强样式
:deep(.el-input),
:deep(.el-select),
:deep(.el-cascader),
:deep(.el-date-editor) {
    width: 100%;

    .el-input__wrapper {
        border-radius: 8px 0 0 8px;
        box-shadow: 0 0 0 1px #dcdfe6 inset;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

        &:hover {
            box-shadow: 0 0 0 1px #c0c4cc inset;
        }

        &.is-focus {
            box-shadow: 0 0 0 1px var(--color-primary, #409eff) inset,
                        0 0 8px var(--color-primary-15);
        }
    }

    .el-input__inner {
        border-radius: 8px;
    }
}

// 文本输入框特殊样式
.text-input {
    :deep(.el-input-group__prepend) {
        box-shadow: none;
        background: linear-gradient(135deg, var(--color-primary, #409eff) 0%, var(--color-primary-light, #6ba3ff) 100%);
        border: 1px solid rgba(64, 158, 255, 0.2);
        color: var(--color-primary-text, #ffffff);
        border-radius: 8px 0 0 8px;
        border: 1px solid #dcdfe6;
        border-right: none;
        // font-weight: 500;

        .el-icon {
            margin-right: 4px;
            color: var(--color-primary-text, #ffffff);
        }
    }

    :deep(.el-input__wrapper) {
        border-radius: 0 8px 8px 0;
    }
}

// 数字范围选择器
.number-range-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;

    .number-input {
        flex: 1;

        :deep(.el-input__wrapper) {
            border-radius: 8px;
        }
    }

    .range-separator {
        color: #909399;
        // font-weight: 500;
    }
}

// 响应式设计
@media (max-width: 768px) {
    .search-fields-wrapper {
        grid-template-columns: 1fr;
    }

    .checkbox-group {
        :deep(.el-checkbox) {
            flex: 0 0 calc(50% - 6px);
        }
    }
}
</style>

<script>
import _ from "underscore";
import { debounce } from "lodash";
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/utils/api.itdos";

export default {
    name: "DiySearch",
    props: {
        TypeFieldName: {
            type: String,
            default: ""
        },
        SearchType: {
            type: String,
            default: ""
        },
        SearchFieldIds: {
            type: Array,
            default() {
                return [];
            }
        },
        DiyFieldList: {
            type: Array,
            default() {
                return [];
            }
        },
        ApiReplace: {
            type: Object,
            default() {
                return {};
            }
        },
        CurrentDiyTableModel: {
            type: Object,
            default() {
                return {};
            }
        }
    },

    computed: {
        GetSearchFieldList: function () {
            const self = this;
            return (type, InOrOut) => {
                if (self.SearchFieldIds.length === 0) {
                    return [];
                }

                const result = [];
                self.SearchFieldIds.forEach((id) => {
                    // 处理自定义字段列表
                    self.DiyFieldList.forEach((field) => {
                        if (typeof id !== "string" && !self.DiyCommon.IsNull(InOrOut)) {
                            if (id.DisplayType !== InOrOut) {
                                return;
                            }
                        }

                        if ((field.Id === id || field.Id === id.Id) && id.Hide !== true) {
                            // 初始化数字范围搜索
                            if (
                                field.Type &&
                                (field.Type.toLowerCase().indexOf("int") > -1 || field.Type.toLowerCase().indexOf("decimal") > -1) &&
                                self.DiyCommon.IsNull(self.SearchNumber[field.Name])
                            ) {
                                self.SearchNumber[field.Name] = { Min: undefined, Max: undefined };
                                self.SearchNumber[field.Name] = { Min: undefined, Max: undefined };
                            }

                            const forceTextInput = field.Component !== "DateTime" && !self.IsSearchOptionControl(field) && self.IsSearchTextInput(id);
                            const searchField = forceTextInput ? { ...field, Component: "Text" } : field;
                            const searchFieldKey = field.AsName || field.Name;

                            // 复选框类型搜索
                            if (
                                type === "Checkbox" &&
                                !forceTextInput &&
                                Array.isArray(field.Data) &&
                                field.Data.length > 0 &&
                                self.IsSearchCheckboxControl(field)
                            ) {
                                if (self.DiyCommon.IsNull(self.SearchCheckbox[searchFieldKey])) {
                                    self.SearchCheckbox[searchFieldKey] = [];
                                }
                                result.push(searchField);
                            }
                            // 文本类型搜索
                            else if (
                                type === "Text" &&
                                (forceTextInput ||
                                    self.IsSearchSelectControl(field) ||
                                    !Array.isArray(field.Data) ||
                                    field.Data.length === 0 ||
                                    field.Config.DataSourceSqlRemote === true ||
                                    field.Component === "Department" ||
                                    field.Component === "Cascader" ||
                                    field.Component === "SelectTree")
                            ) {
                                if (self.IsSearchSelectControl(field) && self.DiyCommon.IsNull(self.SearchSelect[searchFieldKey])) {
                                    self.SearchSelect[searchFieldKey] = [];
                                }
                                result.push(searchField);
                            }
                            // 无类型限制
                            else if (self.DiyCommon.IsNull(type)) {
                                result.push(field);
                            }
                        }
                    });

                    // 处理系统默认字段
                    const defaultField = _.find(self.DiyCommon.SysDefaultField, (item) => item.Id === id || item.Id === id.Id);
                    if (defaultField && id.DisplayType === InOrOut) {
                        result.push(defaultField);
                    }
                });

                self.$emit("CallbackSetDiyTableMaxHeight");
                return result;
            };
        }
    },

    data() {
        return {
            // 使导入的工具类在模板中可访问
            DiyCommon: DiyCommon,
            DiyApi: DiyApi,

            SearchWhere: [],
            SearchCheckbox: {},
            SearchSelect: {},
            SearchModel: {},
            SearchNumber: {},
            SearchStartDateTime: {},
            SearchEndDateTime: {},
            SearchDateTime: {},
            forceRerender: false,

            pickerOptions: {
                shortcuts: [
                    {
                        text: "最近一周",
                        onClick(picker) {
                            const end = new Date();
                            const start = new Date();
                            start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
                            picker.$emit("pick", [start, end]);
                        }
                    },
                    {
                        text: "最近一个月",
                        onClick(picker) {
                            const end = new Date();
                            const start = new Date();
                            start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
                            picker.$emit("pick", [start, end]);
                        }
                    },
                    {
                        text: "最近三个月",
                        onClick(picker) {
                            const end = new Date();
                            const start = new Date();
                            start.setTime(start.getTime() - 3600 * 1000 * 24 * 90);
                            picker.$emit("pick", [start, end]);
                        }
                    }
                ]
            }
        };
    },

    mounted() {
        const self = this;
        this.clearSearchCache();

        // 处理URL中的时间搜索参数
        const _searchDateTime = self.$route.query._SearchDateTime;
        if (_searchDateTime) {
            const _searchDateTimeArr = _searchDateTime.split("|");
            if (_searchDateTimeArr.length === 3) {
                self.SearchDateTime[_searchDateTimeArr[0]] = [_searchDateTimeArr[1], _searchDateTimeArr[2]];
            }
        }
    },

    methods: {
        IsSearchTextInput(id) {
            if (!id || typeof id === "string") return false;
            if (id.TextBox === true) return true;

            const operator = id.Operator || id.SearchType || id.ConditionType || id.Type;
            if (!this.DiyCommon.IsNull(operator)) {
                const op = String(operator).toLowerCase();
                return op === "like" || op === "contains" || op === "包含";
            }

            return id.Equal === false || id.Equal === "false" || id.Equal === 0 || id.Equal === "0";
        },
        /**
         * 清除搜索缓存
         */
        clearSearchCache() {
            const search_where = this.getSearchCacheKey();
            sessionStorage.removeItem(search_where);
        },

        /**
         * 获取搜索缓存键
         */
        getSearchCacheKey() {
            return window.location.pathname + window.location.search + window.location.hash + "search_where";
        },
        /**
         * 初始化搜索条件
         */
        InitSearch() {
            this.clearSearchCache();

            this.SearchWhere = [];
            this.SearchModel = {};
            this.SearchCheckbox = {};
            this.SearchDateTime = {};
            this.SearchNumber = {};
            this.SearchSelect = {};
            this.SearchStartDateTime = {};
            this.SearchEndDateTime = {};
            // 清空URL参数
            if (this.$route.query._SearchDateTime) {
                this.$route.query._SearchDateTime = "";
            }
        },

        /**
         * 获取日期时间格式
         */
        /**
         * 获取日期选择器类型（range模式）
         */
        GetDatePickerType(field) {
            if (!field || !field.Config || !field.Config.DateTimeType) {
                return "daterange";
            }
            const typeMap = {
                datetime: "datetimerange",
                date: "daterange",
                month: "monthrange",
                year: "daterange",
                datetime_HHmm: "datetimerange",
                datetime_HH: "datetimerange",
            };
            return typeMap[field.Config.DateTimeType] || "daterange";
        },
        GetDateTimeFormat(field) {
            if (!field || !field.Config || !field.Config.DateTimeType) {
                return "YYYY-MM-DD";
            }

            const formatMap = {
                datetime: "YYYY-MM-DD HH:mm:ss",
                date: "YYYY-MM-DD",
                week: "YYYY 第 ww 周",
                month: "YYYY-MM",
                year: "YYYY",
                datetime_HHmm: "YYYY-MM-DD HH:mm",
                datetime_HH: "YYYY-MM-DD HH",
                "HH:mm": "HH:mm",
                "HH:mm:ss": "HH:mm:ss"
            };

            return formatMap[field.Config.DateTimeType] || "YYYY-MM-DD";
        },

        /**
         * 触发表格数据获取
         */
        GetDiyTableRow(obj) {
            this._GetDiyTableRow(obj, this);
        },

        /**
         * 防抖的表格数据获取方法
         */
        _GetDiyTableRow: debounce((obj, self) => {
            // console.log("查询区域uid", self._uid);

            self.SearchWhere = [];
            const param = {
                SearchCheckbox: self.SearchCheckbox,
                SearchNumber: self.SearchNumber,
                _PageIndex: obj._PageIndex
            };

            // 处理 SearchModel 搜索条件（文本框等）
            for (const key in self.SearchModel) {
                const value = self.SearchModel[key];

                // 修复bug：如果搜索值为空字符串，跳过该条件
                if (value === "" || value == null) {
                    continue;
                }

                const fieldModel = self.findFieldModel(key);
                if (!fieldModel) continue;

                let searchType = "Like";
                const searchFieldModel = self.SearchFieldIds.find((d) => d.Id === fieldModel.Id);

                if (searchFieldModel && searchFieldModel.Equal) {
                    searchType = "=";
                }

                // 开关组件使用等值查询
                if (fieldModel.Component === "Switch") {
                    searchType = "=";
                }
                var tableName = self.GetTableName(fieldModel);
                self.SearchWhere.push([tableName + fieldModel.Name, searchType, value]);
            }

            // 处理 SearchSelect 搜索条件
            if (self.SearchSelect) {
                for (const key in self.SearchSelect) {
                    const arr = self.SearchSelect[key];
                    if (!Array.isArray(arr) || arr.length === 0) continue;

                    const fieldModel = self.findFieldModel(key);
                    if (!fieldModel) continue;

                    self.AppendOptionSearchWhere(self.SearchWhere, fieldModel, arr);
                }
            } else {
                param.SearchCheckbox = {};
            }

            // 设置最终的 Where 条件
            param._Where = self.SearchWhere.length > 0 ? self.SearchWhere : [];
            console.log(self.SearchDateTime,self.SearchStartDateTime,self.SearchEndDateTime,'日历SearchDateTime')
            // 处理时间搜索条件
            if (self.SearchDateTime) {
                for (const key in self.SearchDateTime) {
                    const dateRange = self.SearchDateTime[key];
                    if (Array.isArray(dateRange) && dateRange.length === 2 && dateRange[0] && dateRange[1]) {
                        const fieldModel = self.findFieldModel(key);
                        if (!fieldModel) continue;
                        var tableName = self.GetTableName(fieldModel);
                        param._Where.push([tableName + key, ">=", dateRange[0]]);
                        param._Where.push([tableName + key, "<=", dateRange[1]]);
                    }
                }
            }


            // 处理复选框搜索条件
            if (param.SearchCheckbox) {
                for (const key in self.SearchCheckbox) {
                    if (Array.isArray(self.SearchCheckbox[key]) && self.SearchCheckbox[key].length > 0) {
                        const fieldModel = self.findFieldModel(key);
                        if (!fieldModel) continue;
                        self.AppendOptionSearchWhere(param._Where, fieldModel, self.SearchCheckbox[key]);
                    }
                }
                delete param.SearchCheckbox;
            }
            // 处理数字条件
            if (self.SearchNumber) {
                for (const key in self.SearchNumber) {
                    const numberModel = self.SearchNumber[key];
                    const fieldModel = self.findFieldModel(key);
                    if (!fieldModel) continue;
                    var tableName = self.GetTableName(fieldModel);
                    if ((numberModel.Min || numberModel.Min === 0) && (numberModel.Max || numberModel.Max === 0)) {
                        param._Where.push(["(", tableName + key, ">=", numberModel.Min]);
                        param._Where.push([tableName + key, "<=", numberModel.Max, ")"]);
                    } else if (numberModel.Min || numberModel.Min === 0) {
                        param._Where.push([tableName + key, ">=", numberModel.Min]);
                    } else if (numberModel.Max || numberModel.Max === 0) {
                        param._Where.push([tableName + key, "<=", numberModel.Max]);
                    }
                }
                delete param.SearchNumber;
            }

            // 会话缓存搜索条件
            self.handleSearchWhereCache(param);

            self.$emit("CallbackGetDiyTableRow", param);
        }, 500),

        /**
         * 处理搜索条件缓存
         */
        handleSearchWhereCache(param) {
            const search_where = this.getSearchCacheKey();

            try {
                const existingCache = sessionStorage.getItem(search_where);
                let cachedWhere = existingCache ? JSON.parse(existingCache) : [];

                // 更新当前组件的搜索条件
                const currentIndex = cachedWhere.findIndex((item) => item.uid === this._uid);
                if (currentIndex !== -1) {
                    cachedWhere.splice(currentIndex, 1);
                }

                if (param._Where.length > 0) {
                    cachedWhere.push({ uid: this._uid, where: param._Where });
                }

                sessionStorage.setItem(search_where, JSON.stringify(cachedWhere));

                // 合并所有组件的搜索条件
                const allWhere = cachedWhere.flatMap((item) => (Array.isArray(item.where) ? item.where : []));
                param._Where = allWhere;
            } catch (e) {
                console.error("搜索条件缓存处理错误:", e);
                sessionStorage.setItem(search_where, JSON.stringify([{ uid: this._uid, where: param._Where }]));
            }
        },

        /**
         * 获取表名前缀
         */
        GetTableName(fieldModel) {
            const tableName = this.CurrentDiyTableModel.Id === fieldModel.TableId ? "" : fieldModel.TableName;
            return tableName ? tableName + "." : "";
        },

        /**
         * 选项类搜索工具方法
         */
        IsSearchSelectControl(field) {
            return field && (field.Component === "Select" || field.Component === "MultipleSelect");
        },

        IsSearchCheckboxControl(field) {
            return field && (field.Component === "Checkbox" || field.Component === "Radio");
        },

        IsSearchOptionControl(field) {
            return this.IsSearchSelectControl(field) || this.IsSearchCheckboxControl(field);
        },

        IsJsonSaveFormat(field) {
            const saveFormat = field && field.Config ? field.Config.SelectSaveFormat : "";
            return String(saveFormat || "").toLowerCase() === "json";
        },

        IsMultiValueSearchField(field) {
            return field && (field.Component === "MultipleSelect" || field.Component === "Checkbox" || this.IsJsonSaveFormat(field));
        },

        NormalizeSearchOptionValues(values, field) {
            const list = Array.isArray(values) ? values : [values];
            const result = [];
            list.forEach((item) => {
                const value = this.GetSearchOptionValue(item, field);
                if (value === null || value === undefined || value === "") {
                    return;
                }
                if (result.findIndex((oldValue) => String(oldValue) === String(value)) === -1) {
                    result.push(value);
                }
            });
            return result;
        },

        AppendOptionSearchWhere(whereList, fieldModel, values) {
            const filteredValues = this.NormalizeSearchOptionValues(values, fieldModel);
            if (filteredValues.length === 0) {
                return;
            }

            const tableName = this.GetTableName(fieldModel);
            const fieldName = tableName + fieldModel.Name;
            if (!this.IsMultiValueSearchField(fieldModel)) {
                whereList.push([fieldName, "In", filteredValues]);
                return;
            }

            filteredValues.forEach((item, index) => {
                const tempWhere = [];
                if (filteredValues.length > 1 && index === 0) {
                    tempWhere.push("(");
                }
                if (filteredValues.length > 1 && index > 0) {
                    tempWhere.push("OR");
                }
                tempWhere.push(fieldName);
                tempWhere.push("Like");
                tempWhere.push(item);
                if (filteredValues.length > 1 && index === filteredValues.length - 1) {
                    tempWhere.push(")");
                }
                whereList.push(tempWhere);
            });
        },

        /**
         * 查找字段模型
         */
        findFieldModel(key) {
            // 优先匹配 AsName
            let fieldModel = this.DiyFieldList.find((item) => item.AsName === key);

            // 其次匹配 Name（无 AsName 的情况）
            if (!fieldModel) {
                fieldModel = this.DiyFieldList.find((item) => item.Name === key && !item.AsName);
            }

            // 再次匹配 Name（有 AsName 的情况也匹配）
            if (!fieldModel) {
                fieldModel = this.DiyFieldList.find((item) => item.Name === key);
            }

            // 最后从系统默认字段中查找
            if (!fieldModel) {
                fieldModel = this.DiyCommon.SysDefaultField.find((item) => item.Name === key);
            }

            return fieldModel;
        },

        /**
         * 递归格式化树形数据
         */
        formatData(data, field) {
            const allData = [];
            if (Array.isArray(data)) {
                data.forEach((item) => {
                    allData.push(item);
                    this.collectTreeData(item, allData, field);
                });
            }
            return allData;
        },

        /**
         * 递归收集树形数据
         */
        collectTreeData(item, allData, field) {
            const childrenName = this.GetChildrenName(field);
            if (item[childrenName] && Array.isArray(item[childrenName])) {
                item[childrenName].forEach((childItem) => {
                    allData.push(childItem);
                    this.collectTreeData(childItem, allData, field);
                });
            }
        },

        /**
         * 获取复选框选项显示标签
         */
        GetSearchItemCheckLabel(fieldData, field) {
            if (typeof fieldData === "string") {
                return fieldData;
            } else if (typeof fieldData === "number") {
                return String(fieldData);
            } else if (fieldData && typeof fieldData === "object") {
                const config = field.Config || {};
                const labelKeys = [config.SelectLabel, "Value", "value", "Label", "label", "Name", "name", "Text", "text", config.SelectSaveField, "Key", "key", "Id", "id"];
                for (let i = 0; i < labelKeys.length; i++) {
                    const key = labelKeys[i];
                    if (!this.DiyCommon.IsNull(key) && !this.DiyCommon.IsNull(fieldData[key])) {
                        return fieldData[key];
                    }
                }
            }
            return fieldData;
        },

        /**
         * 获取复选框选项值
         */
        GetSearchItemCheckKey(fieldData, field) {
            return this.GetSearchOptionValue(fieldData, field);
        },

        GetSearchOptionValue(fieldData, field) {
            if (fieldData === null || fieldData === undefined) {
                return fieldData;
            }
            if (typeof fieldData !== "object" || Array.isArray(fieldData)) {
                return fieldData;
            }

            const config = field.Config || {};
            if (config.DataSource === "KeyValue") {
                if (!this.DiyCommon.IsNull(fieldData.Key)) return fieldData.Key;
                if (!this.DiyCommon.IsNull(fieldData.key)) return fieldData.key;
            }

            const valueKeys = [config.SelectSaveField, config.SelectLabel, "Key", "key", "Value", "value", "Id", "id", "Name", "name", "Label", "label", "Text", "text"];
            for (let i = 0; i < valueKeys.length; i++) {
                const key = valueKeys[i];
                if (!this.DiyCommon.IsNull(key) && !this.DiyCommon.IsNull(fieldData[key])) {
                    return fieldData[key];
                }
            }

            try {
                return JSON.stringify(fieldData);
            } catch (e) {
                return "";
            }
        },

        /**
         * 获取部门选择器配置
         */
        GetDepartmentProps(field) {
            return {
                value: "Id",
                label: "Name",
                children: "_Child",
                checkStrictly: true
            };
        },

        /**
         * 部门选择变化
         */
        DeptChange(item, field) {
            const fieldName = field.AsName || field.Name;
            this.SearchModel[fieldName] = item ? item[item.length - 1] : "";
            this.GetDiyTableRow({ _PageIndex: 1 });
        },

        /**
         * 级联选择变化
         */
        CascaderChange(item, field) {
            const fieldName = field.AsName || field.Name;
            this.SearchModel[fieldName] = item ? item[item.length - 1] : "";
            this.GetDiyTableRow({ _PageIndex: 1 });
        },

        /**
         * 合并开始/结束日期到 SearchDateTime 并触发查询
         */
        DateTimeChange(value, field,type) {
            const fieldName = field.AsName || field.Name;
            const start = this.SearchStartDateTime[fieldName];
            const end = this.SearchEndDateTime[fieldName];

            if ((start !== undefined && start !== null && start !== "") || (end !== undefined && end !== null && end !== "")) {
                this.SearchDateTime[fieldName] = [start || "", end || ""];
            } else {
                if (this.SearchDateTime[fieldName]) {
                    delete this.SearchDateTime[fieldName];
                }
            }
            if(type == 1 && start !== undefined && start !== null && start !== "" && end !== undefined && end !== null && end !== ""){
              this.GetDiyTableRow({ _PageIndex: 1 });
            }else if(type == 2){
              // 无论是设置还是清除，均触发一次查询以同步 SearchDateTime
              this.GetDiyTableRow({ _PageIndex: 1 });
            }

        },

        /**
         * 获取级联选择器配置
         */
        GetCascaderProps(field) {
            if (this.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                this.DiyCommon.Tips(`${field.Label}${field.Name} 存在必填属性[存储字段]未填写！`, false);
            }

            const result = {
                value: field.Config.SelectSaveField,
                label: field.Config.SelectLabel || field.Config.SelectSaveField,
                children: field.Config.Cascader.Children || "_Child",
                checkStrictly: true,
                leaf: field.Config.Cascader.Leaf || "_Leaf"
            };

            if (field.Config.Cascader.Lazy === true) {
                result.lazy = true;
                result.lazyLoad = function (node, resolve) {
                    // 懒加载逻辑
                };
            }

            if (field.Config.Cascader.Disabled) {
                result.disabled = field.Config.Cascader.Disabled;
            }

            return result;
        },

        /**
         * 获取选择器值字段
         */
        GetSelectValueKey(field) {
            const config = field.Config || {};
            if (config.DataSource === "Data") {
                return undefined;
            }
            if (config.DataSource === "KeyValue") {
                return "Key";
            }
            return config.SelectSaveField || config.SelectLabel || undefined;
        },

        /**
         * 树节点点击事件
         */
        handleNodeClick(node, field) {
            const fieldName = field.AsName || field.Name;
            this.SearchModel[fieldName] = node.Id;

            // 强制重新渲染
            this.forceRerender = true;
            this.$nextTick(() => {
                this.forceRerender = false;
            });

            this.SelectChange(node.Id, field);
            if (this.$refs.selectTree && this.$refs.selectTree[0]) {
                this.$refs.selectTree[0].blur();
            }
            this.GetDiyTableRow({ _PageIndex: 1 });
        },

        /**
         * 获取显示标签字段
         */
        GetLabel(field) {
            return field.Config.SelectLabel || field.Config.SelectSaveField;
        },

        /**
         * 获取树形选择器配置
         */
        GetSelectTreeProps(field) {
            if (this.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                this.DiyCommon.Tips(`${field.Label}${field.Name} 存在必填属性[存储字段]未填写！`, false);
            }

            const result = {
                value: field.Config.SelectSaveField,
                label: this.GetLabel(field),
                children: this.GetChildrenName(field),
                checkStrictly: true,
                leaf: field.Config.SelectTree.Leaf || "_Leaf"
            };

            if (field.Config.SelectTree.Lazy === true) {
                result.lazy = true;
                result.lazyLoad = function (node, resolve) {
                    // 懒加载逻辑
                };
            }

            if (field.Config.SelectTree.Disabled) {
                result.disabled = field.Config.SelectTree.Disabled;
            }

            return result;
        },

        /**
         * 选择器变化事件
         */
        SelectChange(item, field) {
            const fieldName = field.AsName || field.Name;

            if (item && item.Id) {
                item = item.Id;
            }

            this.SearchModel[fieldName] = item || "";

            // SelectTree 组件需要强制重新渲染
            if (field.Component === "SelectTree" && !item) {
                this.forceRerender = true;
                this.$nextTick(() => {
                    this.forceRerender = false;
                });
            }

            this.GetDiyTableRow({ _PageIndex: 1 });
        },

        /**
         * 搜索选择器变化事件
         */
        SearchSelectChange(item, field) {
            const fieldName = field.AsName || field.Name;
            this.SearchSelect[fieldName] = Array.isArray(item) ? item : [];
            this.GetDiyTableRow({ _PageIndex: 1 });
        },

        /**
         * 获取子级字段名
         */
        GetChildrenName(field) {
            return field.Config.SelectTree.Children || "_Child";
        },

        /**
         * 获取字段占位符
         */
        GetFieldPlaceholder(field) {
            let result = field.Placeholder || "";
            if (field.Code) {
                result = result ? `${result}(${field.Code})` : field.Code;
            }
            return result;
        },

        /**
         * 获取下拉选项的key
         */
        getSelectOptionKey(field, fieldData, index) {
            const value = this.GetSearchOptionValue(fieldData, field);

            return `slt_opt_key_${field.Name}_${value}_${index}`;
        },

        /**
         * 远程搜索方法
         */
        SelectRemoteMethod(query, field) {
            if (field.Config.DataSourceSqlRemote !== true) return;

            field.Config.DataSourceSqlRemoteLoading = true;

            const apiGetDiyFieldSqlData = this.ApiReplace?.GetDiyFieldSqlData || this.DiyApi.GetDiyFieldSqlData;

            this.DiyCommon.Post(
                apiGetDiyFieldSqlData,
                {
                    _FieldId: field.Id,
                    _FormData: {},
                    _Keyword: query
                },
                (result) => {
                    if (this.DiyCommon.Result(result)) {
                        field.Data = result.Data;
                    }
                    field.Config.DataSourceSqlRemoteLoading = false;
                },
                () => {
                    field.Config.DataSourceSqlRemoteLoading = false;
                }
            );
        }
    }
};
</script>
