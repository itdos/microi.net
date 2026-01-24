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
                        <el-checkbox v-for="(fieldData, fieldDatIndex) in field.Data" :key="'fieldData_' + field.Name + fieldDatIndex" :label="GetSearchItemCheckKey(fieldData, field)">
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
                <div v-if="field.Component == 'DateTime'" class="search-input-block">
                    <div class="search-input-label">
                        <el-tag type="info">
                            <el-icon><Search /></el-icon> {{ field.Label }}
                        </el-tag>
                    </div>
                    <el-date-picker
                        v-model="SearchDateTime[field.AsName || field.Name]"
                        type="datetimerange"
                        :value-format="GetDateTimeFormat(field)"
                        range-separator="至"
                        start-placeholder="开始日期"
                        end-placeholder="结束日期"
                        :picker-options="pickerOptions"
                        @change="GetDiyTableRow({ _PageIndex: 1 })"
                    />
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
                            :label="DiyCommon.IsNull(field.Config.SelectLabel) ? fieldData : fieldData[field.Config.SelectLabel]"
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
            return function (type, InOrOut) {
                const self = this;

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

                            // 临时解决方案：强制将下拉框变为文本框
                            if (id.TextBox) {
                                field.Component = "Text";
                            }

                            // 复选框类型搜索
                            if (
                                type === "Checkbox" &&
                                Array.isArray(field.Data) &&
                                field.Data.length > 0 &&
                                field.Config.DataSourceSqlRemote !== true &&
                                id.DisplaySelect !== true &&
                                ((field.Component === "Select" && field.Config.DataSource === "Data") ||
                                    (field.Component === "MultipleSelect" && field.Config.DataSource === "Data") ||
                                    field.Component === "Checkbox" ||
                                    field.Component === "Radio")
                            ) {
                                if (self.DiyCommon.IsNull(self.SearchCheckbox[field.Name])) {
                                    self.SearchCheckbox[field.Name] = [];
                                }
                                result.push(field);
                            }
                            // 文本类型搜索
                            else if (
                                type === "Text" &&
                                (!Array.isArray(field.Data) ||
                                    field.Data.length === 0 ||
                                    field.Config.DataSourceSqlRemote === true ||
                                    id.DisplaySelect === true ||
                                    field.Component === "Department" ||
                                    field.Component === "Cascader" ||
                                    field.Component === "SelectTree" ||
                                    (field.Component === "Select" && id.DisplaySelect === true) ||
                                    (field.Component === "MultipleSelect" && id.DisplaySelect === true))
                            ) {
                                if ((field.Component === "Select" || field.Component === "MultipleSelect") && self.DiyCommon.IsNull(self.SearchSelect[field.Name])) {
                                    self.SearchSelect[field.Name] = [];
                                }
                                result.push(field);
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

            // 清空URL参数
            if (this.$route.query._SearchDateTime) {
                this.$route.query._SearchDateTime = "";
            }
        },

        /**
         * 获取日期时间格式
         */
        GetDateTimeFormat(field) {
            if (!field || !field.Config || !field.Config.DateTimeType) {
                return "yyyy-MM-dd";
            }

            const formatMap = {
                datetime: "yyyy-MM-dd HH:mm:ss",
                date: "yyyy-MM-dd",
                week: "yyyy 第 WW 周",
                month: "yyyy-MM",
                year: "yyyy",
                datetime_HHmm: "yyyy-MM-dd HH:mm",
                datetime_HH: "yyyy-MM-dd HH",
                "HH:mm": "HH:mm",
                "HH:mm:ss": "HH:mm:ss"
            };

            return formatMap[field.Config.DateTimeType] || "yyyy-MM-dd";
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

                    var tableName = self.GetTableName(fieldModel);

                    const searchValue = arr.map((item) => {
                        if (typeof item === "string") {
                            return item;
                        } else {
                            return item[fieldModel.Config.SelectSaveField || fieldModel.Config.SelectLabel];
                        }
                    });

                    // 过滤空值
                    const filteredValues = searchValue.filter((val) => val != null && val !== "");

                    if (filteredValues.length === 0) continue;

                    let searchType = "In";

                    // JSON格式或多选框使用Like查询
                    if (fieldModel.Config.SelectSaveFormat === "Json" || fieldModel.Component === "MultipleSelect") {
                        searchType = "Like";
                        filteredValues.forEach((item, index) => {
                            // const tempWhere = {};
                            // if (filteredValues.length > 1 && index === 0) {
                            //   tempWhere.GroupStart = true;
                            // }
                            // tempWhere.Name = fieldModel.Name;
                            // tempWhere.Value = item;
                            // tempWhere.Type = searchType;
                            // if (filteredValues.length > 1 && index <= filteredValues.length - 1 && index !== 0) {
                            //   tempWhere.AndOr = "OR";
                            // }
                            // if (index === filteredValues.length - 1 && filteredValues.length > 1) {
                            //   tempWhere.GroupEnd = true;
                            // }

                            const tempWhere = [];
                            if (filteredValues.length > 1 && index <= filteredValues.length - 1 && index !== 0) {
                                tempWhere.push("OR");
                            }
                            if (filteredValues.length > 1 && index === 0) {
                                tempWhere.push("(");
                            }
                            tempWhere.push(tableName + fieldModel.Name);
                            tempWhere.push(searchType);
                            tempWhere.push(item);

                            if (index === filteredValues.length - 1 && filteredValues.length > 1) {
                                tempWhere.push(")");
                            }
                            self.SearchWhere.push(tempWhere);
                        });
                    } else {
                        // self.SearchWhere.push({
                        //   Name: fieldModel.Name,
                        //   Value: JSON.stringify(filteredValues),
                        //   Type: searchType,
                        //   FormEngineKey: fieldModel.TableId
                        // });

                        //2025-10-27 In查询比OR查询性能更高  ----by anderson
                        self.SearchWhere.push([tableName + fieldModel.Name, searchType, JSON.stringify(filteredValues)]); //, FormEngineKey: fieldModel.TableId
                        // var tempIndex = 0;
                        // filteredValues.forEach(item => {
                        //   var tempWhere = [];
                        //   if(tempIndex == 0){
                        //     tempWhere.push('(');
                        //   }else{
                        //     tempWhere.push('OR');
                        //   }
                        //   tempWhere.push(fieldModel.Name);
                        //   tempWhere.push('=');
                        //   tempWhere.push(item);
                        //   if(tempIndex == filteredValues.length - 1){
                        //     tempWhere.push(')');
                        //   }
                        //   tempIndex++;
                        //   self.SearchWhere.push(tempWhere);
                        // })
                    }
                }
            } else {
                param.SearchCheckbox = {};
            }

            // 设置最终的 Where 条件
            param._Where = self.SearchWhere.length > 0 ? self.SearchWhere : [];

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
                        var tableName = self.GetTableName(fieldModel);
                        param._Where.push([tableName + key, "In", JSON.stringify(self.SearchCheckbox[key])]);
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
            } else if (typeof fieldData === "object") {
                if (!this.DiyCommon.IsNull(field.Config.SelectLabel)) {
                    return fieldData[field.Config.SelectLabel];
                }
            }
            return fieldData;
        },

        /**
         * 获取复选框选项值
         */
        GetSearchItemCheckKey(fieldData, field) {
            if (typeof fieldData === "string") {
                return fieldData;
            } else if (typeof fieldData === "object") {
                if (!this.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                    return fieldData[field.Config.SelectSaveField];
                } else if (!this.DiyCommon.IsNull(field.Config.SelectLabel)) {
                    return fieldData[field.Config.SelectLabel];
                }
            }
            return fieldData;
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
            return field.Config.SelectSaveField || field.Config.SelectLabel || "";
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
            const value = field.Config.SelectSaveField ? fieldData[field.Config.SelectSaveField] : field.Config.SelectLabel ? fieldData[field.Config.SelectLabel] : fieldData;

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
                    _SqlParamValue: JSON.stringify({}),
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

<style lang="scss" scoped>
.diy-search-container {
    width: 100%;
}

// 复选框搜索区域
.search-checkbox-wrapper {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 10px;
}

.search-checkbox-item {
    display: flex;
    align-items: flex-start;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    min-height: 38px;

    .search-label {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        // height: 32px;
    }

    .checkbox-group {
        flex: 1;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 15px;
        padding-top: 3px;

        :deep(.el-checkbox) {
            margin-right: 0;
        }
    }
}

// 搜索字段区域
.search-fields-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: flex-start;
}

.search-field-item {
    flex: 0 0 auto;
    min-width: 200px;
    max-width: 100%;
    display: flex;
    align-items: center;
    .el-icon {
        margin-right: 2px;
    }
}

// 搜索输入块
.search-input-block {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;

    .search-input-label {
        flex-shrink: 0;
        display: flex;
        align-items: center;
    }

    .el-select,
    .el-cascader,
    .el-date-picker {
        flex: 1;
        min-width: 150px;
    }
}

// 数字范围输入
.number-range-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;

    .number-input {
        width: 120px;
    }

    .range-separator {
        flex-shrink: 0;
        color: #606266;
        font-weight: 500;
    }
}

// 默认文本输入框
.text-input {
    width: 100%;
    min-width: 150px;
}

// 树形选择器
.main-select-tree {
    width: 100%;
    min-width: 150px;

    :deep(.el-select__wrapper) {
        max-height: 200px;
        overflow-y: auto;
    }
}

.main-select-el-tree {
    max-height: 300px;
    overflow-y: auto;
}

// 响应式适配
@media (max-width: 768px) {
    .search-fields-wrapper {
        flex-direction: column;
    }

    .search-field-item {
        width: 100%;
        min-width: 100%;
    }

    .search-input-block {
        flex-direction: column;
        align-items: flex-start;

        .search-input-label {
            width: 100%;
        }

        .el-select,
        .el-cascader,
        .el-date-picker {
            width: 100%;
        }
    }

    .number-range-wrapper {
        width: 100%;
        flex-direction: row;

        .number-input {
            flex: 1;
            width: auto;
        }
    }
}
</style>
