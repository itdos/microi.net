<template>
  <section>
    <!-- DIY搜索 【默认】搜索 - 复选框类型 -->
    <template v-for="(field, index) in GetSearchFieldList('Checkbox', SearchType)">
      <div 
        :key="'search_line_' + field.Id + '_' + index" 
        v-if="Array.isArray(field.Data) && field.Data.length > 0" 
        :class="SearchType == 'Line' ? 'pull-left' : 'clear'" 
        style="height: 38px"
      >
        <div class="search-label pull-left" style="margin-right: 10px">
          <el-tag type="info" size="medium">
            <i class="el-icon-search"></i> {{ field.Label }}
          </el-tag>
        </div>
        <el-checkbox-group 
          class="pull-left" 
          v-model="SearchCheckbox[field.AsName || field.Name]" 
          @change="GetDiyTableRow({ _PageIndex: 1 })" 
          style="margin-left: 0px; padding-top: 3px"
        >
          <el-checkbox
            v-for="(fieldData, fieldDatIndex) in field.Data"
            :key="'fieldData_' + field.Name + fieldDatIndex"
            :label="GetSearchItemCheckKey(fieldData, field)"
            style="width: auto; margin-right: 15px"
          >
            {{ GetSearchItemCheckLabel(fieldData, field) }}
          </el-checkbox>
        </el-checkbox-group>
      </div>
    </template>

    <!-- 更多DIY搜索 【默认】搜索 - 文本及其他类型 -->
    <template v-if="GetSearchFieldList('Text', SearchType).length > 0" class="more-search">
      <div v-if="SearchType !== 'Line'" class="clear" style="height: 0px"></div>
      
      <div
        v-for="(field, index) in GetSearchFieldList('Text', SearchType)"
        :class="SearchType == 'Line' ? 'pull-left more-search-item-line' : 'pull-left more-search-item'"
        :key="'search_line_2' + field.Id + '_' + index"
      >
        <!-- 日期时间选择器 -->
        <div v-if="field.Component == 'DateTime'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium">
              <i class="el-icon-search"></i> {{ field.Label }}
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
        <div v-else-if="field.Component == 'Department'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium">
              <i class="el-icon-search"></i> {{ field.Label }}
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
        <div v-else-if="field.Component == 'Select' || field.Component == 'MultipleSelect'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium">
              <i class="el-icon-search"></i> {{ field.Label }}
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
        <div v-else-if="field.Component == 'Cascader'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium">
              <i class="el-icon-search"></i> {{ field.Label }}
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
        <div v-else-if="field.Component == 'SelectTree'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium">
              <i class="el-icon-search"></i> {{ field.Label }}
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
        <div v-else-if="field.Type && (field.Type.toLowerCase() == 'int' || field.Type.toLowerCase().indexOf('decimal') > -1)" class="block">
          <div class="pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium">
              <i class="el-icon-search"></i> {{ field.Label }}
            </el-tag>
          </div>
          <div class="pull-left">
            <el-input-number 
              style="width: 120px" 
              v-model="SearchNumber[field.Name].Min" 
              @blur="GetDiyTableRow({ _PageIndex: 1 })" 
              @keyup.enter.native="GetDiyTableRow({ _PageIndex: 1 })" 
              controls-position="right"
            />
          </div>
          <div class="line pull-left" style="width: 20px; text-align: center; line-height: 28px">-</div>
          <div class="pull-left">
            <el-input-number 
              style="width: 120px" 
              v-model="SearchNumber[field.Name].Max" 
              @blur="GetDiyTableRow({ _PageIndex: 1 })" 
              @keyup.enter.native="GetDiyTableRow({ _PageIndex: 1 })" 
              controls-position="right"
            />
          </div>
        </div>

        <!-- 开关选择器 -->
        <div v-else-if="field.Component == 'Switch'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium">
              <i class="el-icon-search"></i> {{ field.Label }}
            </el-tag>
          </div>
          <el-select 
            clearable 
            v-model="SearchModel[field.AsName || field.Name]" 
            @change="GetDiyTableRow({ _PageIndex: 1 })" 
            @clear="GetDiyTableRow({ _PageIndex: 1 })"
          >
            <el-option label="打开" value="1" />
            <el-option label="关闭" value="0" />
          </el-select>
        </div>

        <!-- 默认文本输入框 -->
        <el-input 
          v-else 
          v-model="SearchModel[field.AsName || field.Name]" 
          placeholder="" 
          clearable 
          @input="GetDiyTableRow({ _PageIndex: 1 })" 
          style="min-width: 150px"
        >
          <template slot="prepend">
            <i class="el-icon-search"></i> {{ field.Label }}
          </template>
        </el-input>
      </div>
    </template>
  </section>
</template>

<script>
import _ from "underscore";
import { debounce } from "lodash";

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
    CurrentDiyTableModel:{
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
              if (field.Type && (field.Type.toLowerCase().indexOf("int") > -1 || field.Type.toLowerCase().indexOf("decimal") > -1) && 
                  self.DiyCommon.IsNull(self.SearchNumber[field.Name])) {
                self.SearchNumber[field.Name] = { Min: null, Max: null };
                self.$set(self.SearchNumber, field.Name, { Min: null, Max: null });
              }

              // 临时解决方案：强制将下拉框变为文本框
              if (id.TextBox) {
                field.Component = "Text";
              }

              // 复选框类型搜索
              if (type === "Checkbox" &&
                  Array.isArray(field.Data) &&
                  field.Data.length > 0 &&
                  field.Config.DataSourceSqlRemote !== true &&
                  id.DisplaySelect !== true &&
                  ((field.Component === "Select" && field.Config.DataSource === "Data") ||
                   (field.Component === "MultipleSelect" && field.Config.DataSource === "Data") ||
                   field.Component === "Checkbox" ||
                   field.Component === "Radio")) {
                if (self.DiyCommon.IsNull(self.SearchCheckbox[field.Name])) {
                  self.$set(self.SearchCheckbox, field.Name, []);
                }
                result.push(field);
              }
              // 文本类型搜索
              else if (type === "Text" &&
                      (!Array.isArray(field.Data) ||
                       field.Data.length === 0 ||
                       field.Config.DataSourceSqlRemote === true ||
                       id.DisplaySelect === true ||
                       field.Component === "Department" ||
                       field.Component === "Cascader" ||
                       field.Component === "SelectTree" ||
                       (field.Component === "Select" && id.DisplaySelect === true) ||
                       (field.Component === "MultipleSelect" && id.DisplaySelect === true))) {
                if ((field.Component === "Select" || field.Component === "MultipleSelect") && 
                    self.DiyCommon.IsNull(self.SearchSelect[field.Name])) {
                  self.$set(self.SearchSelect, field.Name, []);
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
          const defaultField = _.find(self.DiyCommon.SysDefaultField, (item) => 
            item.Id === id || item.Id === id.Id
          );
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
      SearchWhere: [],
      SearchCheckbox: {},
      SearchSelect: {},
      SearchModel: {},
      SearchNumber: {},
      SearchDateTime: {},
      forceRerender: false,
      
      // 递归格式化树形数据
      formatData(data, field) {
        const self = this;
        const allData = [];
        if (data && Array.isArray(data)) {
          data.forEach((item) => {
            allData.push(item);
            self.diguiData(item, allData, field);
          });
        }
        return allData;
      },

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
    const search_where = window.location.pathname + window.location.search + window.location.hash + "search_where";
    sessionStorage.removeItem(search_where);
    
    // 处理URL中的时间搜索参数
    const _searchDateTime = self.$route.query._SearchDateTime;
    if (_searchDateTime) {
      const _searchDateTimeArr = _searchDateTime.split("|");
      if (_searchDateTimeArr.length === 3) {
        self.SearchDateTime[_searchDateTimeArr[0]] = [_searchDateTimeArr[1], _searchDateTimeArr[2]];
      }
    }

    // 预处理可搜索组
    self.$nextTick(() => {
      if (self.SearchFieldIds.length > 0) {
        // 预处理逻辑
      }
    });
  },

  methods: {
    /**
     * 初始化搜索条件
     */
    InitSearch() {
      const self = this;
      const search_where = window.location.pathname + window.location.search + window.location.hash + "search_where";
      sessionStorage.removeItem(search_where);
      
      self.SearchWhere = [];
      self.SearchModel = {};
      self.SearchCheckbox = {};
      self.SearchDateTime = {};
      self.SearchNumber = {};
      self.SearchSelect = {};
      
      // 清空URL参数
      self.$route.query._SearchDateTime = "";
    },

    /**
     * 获取日期时间格式
     */
    GetDateTimeFormat(field) {
      if (!field || !field.Config || !field.Config.DateTimeType) {
        return "yyyy-MM-dd";
      }

      const formatMap = {
        "datetime": "yyyy-MM-dd HH:mm:ss",
        "date": "yyyy-MM-dd",
        "week": "yyyy 第 WW 周",
        "month": "yyyy-MM",
        "year": "yyyy",
        "datetime_HHmm": "yyyy-MM-dd HH:mm",
        "datetime_HH": "yyyy-MM-dd HH",
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
      console.log("查询区域uid", self._uid);

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
        const searchFieldModel = self.SearchFieldIds.find(d => d.Id === fieldModel.Id);
        
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

          const searchValue = arr.map(item => {
            if (typeof item === "string") {
              return item;
            } else {
              return item[fieldModel.Config.SelectSaveField || fieldModel.Config.SelectLabel];
            }
          });

          // 过滤空值
          const filteredValues = searchValue.filter(val => val != null && val !== "");

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
                tempWhere.push('OR');
              }
              if (filteredValues.length > 1 && index === 0) {
                tempWhere.push('(');
              }
              tempWhere.push(tableName + fieldModel.Name);
              tempWhere.push(searchType);
              tempWhere.push(item);
              
              if (index === filteredValues.length - 1 && filteredValues.length > 1) {
                tempWhere.push(')');
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
            self.SearchWhere.push([  tableName + fieldModel.Name, searchType, JSON.stringify(filteredValues)]);//, FormEngineKey: fieldModel.TableId 
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
            param._Where.push(['(', tableName + key, ">=", numberModel.Min]);
            param._Where.push([tableName + key, "<=", numberModel.Max, ')']);
          }else if (numberModel.Min || numberModel.Min === 0) {
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
      const self = this;
      const search_where = window.location.pathname + window.location.search + window.location.hash + "search_where";
      
      try {
        const existingCache = sessionStorage.getItem(search_where);
        let cachedWhere = existingCache ? JSON.parse(existingCache) : [];

        // 更新当前组件的搜索条件
        const currentIndex = cachedWhere.findIndex(item => item.uid === self._uid);
        if (currentIndex !== -1) {
          cachedWhere.splice(currentIndex, 1);
        }
        cachedWhere.push({ uid: self._uid, where: param._Where });

        sessionStorage.setItem(search_where, JSON.stringify(cachedWhere));

        // 合并所有组件的搜索条件
        if (param._Where.length > 0) {
          let allWhere = [];
          cachedWhere.forEach(item => {
            if (Array.isArray(item.where)) {
              allWhere = allWhere.concat(item.where);
            }
          });
          param._Where = Object.values(allWhere);
        } else {
          let allWhere = [];
          cachedWhere.forEach(item => {
            if (Array.isArray(item.where)) {
              allWhere = allWhere.concat(item.where);
            }
          });
          param._Where = allWhere;
        }
      } catch (e) {
        console.error("搜索条件缓存处理错误:", e);
        sessionStorage.setItem(search_where, JSON.stringify([{ uid: self._uid, where: param._Where }]));
      }
    },
    GetTableName(fieldModel){
      var self = this;
      var tableName = self.CurrentDiyTableModel.Id == fieldModel.TableId ? '' : fieldModel.TableName;
      return tableName ? tableName  + '.' : '';
    },

    /**
     * 查找字段模型
     */
    findFieldModel(key) {
      const self = this;
      let fieldModel = _.find(self.DiyFieldList, item => item.AsName === key);
      
      if (!fieldModel) {
        fieldModel = _.find(self.DiyFieldList, item => item.Name === key && !item.AsName);
      }
      
      if (!fieldModel) {
        fieldModel = _.find(self.DiyFieldList, item => item.Name === key);
      }

      if (!fieldModel) {
        fieldModel = _.find(self.DiyCommon.SysDefaultField, item => item.Name === key);
      }

      return fieldModel;
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
      const self = this;
      
      if (self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
        self.DiyCommon.Tips(field.Label + field.Name + " 存在必填属性[存储字段]未填写！", false);
      }

      const result = {
        value: field.Config.SelectSaveField,
        label: !self.DiyCommon.IsNull(field.Config.SelectLabel) ? field.Config.SelectLabel : field.Config.SelectSaveField,
        children: self.DiyCommon.IsNull(field.Config.Cascader.Children) ? "_Child" : field.Config.Cascader.Children,
        checkStrictly: true
      };

      if (field.Config.Cascader.Lazy === true) {
        result.lazy = true;
        result.lazyLoad = function (node, resolve) {
          const { level } = node;
          // 懒加载逻辑
        };
      }

      if (!self.DiyCommon.IsNull(field.Config.Cascader.Disabled)) {
        result.disabled = field.Config.Cascader.Disabled;
      }

      result.leaf = !self.DiyCommon.IsNull(field.Config.Cascader.Leaf) ? field.Config.Cascader.Leaf : "_Leaf";

      return result;
    },

    /**
     * 获取选择器值字段
     */
    GetSelectValueKey(field) {
      if (this.DiyCommon.IsNull(field.Config.SelectLabel) && this.DiyCommon.IsNull(field.Config.SelectSaveField)) {
        return "";
      }
      return this.DiyCommon.IsNull(field.Config.SelectSaveField) ? field.Config.SelectLabel : field.Config.SelectSaveField;
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
      this.$refs.selectTree[0].blur();
      this.GetDiyTableRow({ _PageIndex: 1 });
    },

    /**
     * 获取显示标签字段
     */
    GetLabel(field) {
      return !this.DiyCommon.IsNull(field.Config.SelectLabel) ? field.Config.SelectLabel : field.Config.SelectSaveField;
    },

    /**
     * 获取树形选择器配置
     */
    GetSelectTreeProps(field) {
      const self = this;
      
      if (self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
        self.DiyCommon.Tips(field.Label + field.Name + " 存在必填属性[存储字段]未填写！", false);
      }

      const result = {
        value: field.Config.SelectSaveField,
        label: self.GetLabel(field),
        children: self.GetChildrenName(field),
        checkStrictly: true
      };

      if (field.Config.SelectTree.Lazy === true) {
        result.lazy = true;
        result.lazyLoad = function (node, resolve) {
          const { level } = node;
          // 懒加载逻辑
        };
      }

      if (!self.DiyCommon.IsNull(field.Config.SelectTree.Disabled)) {
        result.disabled = field.Config.SelectTree.Disabled;
      }

      result.leaf = !self.DiyCommon.IsNull(field.Config.SelectTree.Leaf) ? field.Config.SelectTree.Leaf : "_Leaf";

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
      if (field.Component === 'SelectTree' && !item) {
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
     * 递归处理树形数据
     */
    diguiData(item, allData, field) {
      const childrenName = this.GetChildrenName(field);
      if (item[childrenName]) {
        item[childrenName].forEach(childItem => {
          allData.push(childItem);
          this.diguiData(childItem, allData, field);
        });
      }
    },

    /**
     * 获取子级字段名
     */
    GetChildrenName(field) {
      return this.DiyCommon.IsNull(field.Config.SelectTree.Children) ? "_Child" : field.Config.SelectTree.Children;
    },

    /**
     * 获取字段占位符
     */
    GetFieldPlaceholder(field) {
      let result = "";
      if (!this.DiyCommon.IsNull(field.Placeholder)) {
        result = field.Placeholder;
      }
      if (!this.DiyCommon.IsNull(field.Code)) {
        if (!this.DiyCommon.IsNull(field.Placeholder)) {
          result += "(" + field.Code + ")";
        } else {
          result = field.Code;
        }
      }
      return result;
    },

    /**
     * 获取下拉选项的key
     */
    getSelectOptionKey(field, fieldData, index) {
      const value = this.DiyCommon.IsNull(field.Config.SelectSaveField)
        ? this.DiyCommon.IsNull(field.Config.SelectLabel)
          ? fieldData
          : fieldData[field.Config.SelectLabel]
        : fieldData[field.Config.SelectSaveField];
      
      return `slt_opt_key_${field.Name}_${value}_${index}`;
    },

    /**
     * 远程搜索方法
     */
    SelectRemoteMethod(query, field) {
      const self = this;
      if (field.Config.DataSourceSqlRemote !== true) return;

      field.Config.DataSourceSqlRemoteLoading = true;
      
      let apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
      if (!self.DiyCommon.IsNull(self.ApiReplace && self.ApiReplace.GetDiyFieldSqlData)) {
        apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
      }

      self.DiyCommon.Post(
        apiGetDiyFieldSqlData,
        {
          _FieldId: field.Id,
          _SqlParamValue: JSON.stringify({}),
          _Keyword: query
        },
        (result) => {
          if (self.DiyCommon.Result(result)) {
            field.Data = result.Data;
          }
          field.Config.DataSourceSqlRemoteLoading = false;
        },
        (error) => {
          field.Config.DataSourceSqlRemoteLoading = false;
        }
      );
    }
  }
};
</script>

<style lang="scss" scoped>
.more-search-item {
  float: left;
  margin-right: 15px;
  margin-bottom: 10px;
  height: 28px;
  max-width: 100%;
}

.more-search-item-line {
  float: left;
  margin-right: 15px;
  margin-bottom: 10px;
  height: 28px;
}
</style>