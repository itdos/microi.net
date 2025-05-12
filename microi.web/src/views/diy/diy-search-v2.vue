<template>
  <section class="more-search">
    <!--DIY搜索【默认】搜索 -->
    <template v-for="(field, index) in SearchFieldList">
      <div
        v-if="
          field._SearchComponent == 'Checkbox' &&
          field._SeachDisplayType == SearchType
        "
        :key="'search_' + field.Id + SearchType"
        :class="
          field._SeachDisplayType == 'Line'
            ? 'pull-left more-search-item-line'
            : 'pull-left more-search-item'
        "
        style="display: flex"
      >
        <div class="search-label pull-left" style="margin-right: 10px">
          <el-tag type="info" size="medium"
            ><i class="el-icon-search"></i>
            {{ field.Label + field.Data.length }}
          </el-tag>
        </div>
        <el-checkbox-group
          v-if="Array.isArray(field.Data) && field.Data.length > 0"
          class="pull-left"
          v-model="AllWhere[field.AsName || field.Name]"
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
      <div
        v-else-if="
          field.Component == 'DateTime' && field._SeachDisplayType == SearchType
        "
        :key="'search2_' + field.Id + SearchType"
        :class="
          field._SeachDisplayType == 'Line'
            ? 'pull-left more-search-item-line'
            : 'pull-left more-search-item'
        "
        style="display: flex"
      >
        <div class="search-line-label pull-left" style="margin-right: 10px">
          <el-tag type="info" size="medium"
            ><i class="el-icon-search"></i> {{ field.Label }}</el-tag
          >
        </div>
        <el-date-picker
          v-model="AllWhere[field.AsName || field.Name]"
          type="daterange"
          :value-format="'yyyy-MM-dd'"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          @change="GetDiyTableRow({ _PageIndex: 1 })"
        >
        </el-date-picker>
      </div>
      <div
        v-else-if="
          field.Component == 'Department' &&
          field._SeachDisplayType == SearchType
        "
        :key="'search3_' + field.Id + SearchType"
        :class="
          field._SeachDisplayType == 'Line'
            ? 'pull-left more-search-item-line'
            : 'pull-left more-search-item'
        "
        style="display: flex"
      >
        <div class="search-line-label pull-left" style="margin-right: 10px">
          <el-tag type="info" size="medium"
            ><i class="el-icon-search"></i> {{ field.Label }}</el-tag
          >
        </div>
        <el-cascader
          clearable
          v-model="AllWhere[field.AsName || field.Name]"
          :options="field.Data"
          :props="GetDepartmentProps(field)"
          :filterable="field.Config.Department.Filterable === true"
          @change="
            (item) => {
              return DeptChange(item, field);
            }
          "
          :collapse-tags="true"
        >
        </el-cascader>
      </div>
      <div
        v-else-if="
          field._SearchComponent == 'Select' &&
          field._SeachDisplayType == SearchType
        "
        :key="'search4_' + field.Id + SearchType"
        :class="
          field._SeachDisplayType == 'Line'
            ? 'pull-left more-search-item-line'
            : 'pull-left more-search-item'
        "
        style="display: flex"
      >
        <div class="search-line-label pull-left" style="margin-right: 10px">
          <el-tag type="info" size="medium"
            ><i class="el-icon-search"></i> {{ field.Label }}</el-tag
          >
        </div>
        <el-select
          v-model="AllWhere[field.AsName || field.Name]"
          collapse-tags
          :multiple="true"
          :filterable="true"
          :loading="field.Config.DataSourceSqlRemoteLoading"
          clearable
          :remote="field.Config.DataSourceSqlRemote == true"
          :remote-method="
            (query) => {
              return SelectRemoteMethod(query, field);
            }
          "
          :placeholder="GetFieldPlaceholder(field)"
          :value-key="GetSelectValueKey(field)"
          @change="
            (item) => {
              return SearchSelectChange(item, field);
            }
          "
          style="min-width: 170px"
        >
          <!--注意：field.Data数据是在变的，
                    这里面之前设置的key【'slt_opt_key' + field.Name + '_' + index2】一定会重复，
                    因为field.Name是固定不变的，
                    已解决-->
          <el-option
            v-for="(fieldData, index2) in field.Data"
            :key="
              'slt_opt_key' +
              field.Name +
              '_' +
              (DiyCommon.IsNull(field.Config.SelectSaveField)
                ? DiyCommon.IsNull(field.Config.SelectLabel)
                  ? fieldData
                  : fieldData[field.Config.SelectLabel]
                : fieldData[field.Config.SelectSaveField]) +
              index2
            "
            :label="
              DiyCommon.IsNull(field.Config.SelectLabel)
                ? fieldData
                : fieldData[field.Config.SelectLabel]
            "
            :value="fieldData"
          />
        </el-select>
      </div>
      <div
        v-else-if="
          field.Component == 'Cascader' && field._SeachDisplayType == SearchType
        "
        :key="'search5_' + field.Id + SearchType"
        :class="
          field._SeachDisplayType == 'Line'
            ? 'pull-left more-search-item-line'
            : 'pull-left more-search-item'
        "
        style="display: flex"
      >
        <div class="search-line-label pull-left" style="margin-right: 10px">
          <el-tag type="info" size="medium"
            ><i class="el-icon-search"></i> {{ field.Label }}</el-tag
          >
        </div>
        <el-cascader
          v-model="AllWhere[field.AsName || field.Name]"
          :clearable="true"
          :props="GetCascaderProps(field)"
          :options="field.Data"
          :filterable="field.Config.Cascader.Filterable == true"
          @change="
            (item) => {
              return CascaderChange(item, field);
            }
          "
          :collapse-tags="true"
        >
        </el-cascader>
      </div>
      <div
        v-else-if="
          field.Component == 'SelectTree' &&
          field._SeachDisplayType == SearchType
        "
        :key="'search6_' + field.Id + SearchType"
        :class="
          field._SeachDisplayType == 'Line'
            ? 'pull-left more-search-item-line'
            : 'pull-left more-search-item'
        "
        style="display: flex"
      >
        <div class="search-line-label pull-left" style="margin-right: 10px">
          <el-tag type="info" size="medium"
            ><i class="el-icon-search"></i> {{ field.Label }}</el-tag
          >
        </div>
        <el-select
          clearable
          class="main-select-tree"
          ref="selectTree"
          v-model="AllWhere[field.AsName || field.Name]"
          :value-key="GetSelectValueKey(field)"
          @change="
            (item) => {
              return SelectChange(item, field);
            }
          "
        >
          <el-option
            v-for="item in formatData(field.Data, field)"
            :key="'item_' + item[field.Config.SelectSaveField]"
            :label="item[GetLabel(field)]"
            :value="item"
            style="display: none"
          />
          <el-tree
            class="main-select-el-tree"
            ref="selecteltree"
            :data="field.Data"
            node-key="Id"
            highlight-current
            :props="GetSelectTreeProps(field)"
            @node-click="
              (item) => {
                return handleNodeClick(item, field);
              }
            "
            :expand-on-click-node="true"
            default-expand-all
          />
        </el-select>
      </div>
      <div
        v-else-if="
          field._SearchComponent == 'NumberText' &&
          field._SeachDisplayType == SearchType
        "
        :key="'search7_' + field.Id + SearchType"
        :class="
          field._SeachDisplayType == 'Line'
            ? 'pull-left more-search-item-line'
            : 'pull-left more-search-item'
        "
        style="display: flex"
      >
        <div class="pull-left" style="margin-right: 10px">
          <el-tag type="info" size="medium"
            ><i class="el-icon-search"></i> {{ field.Label }}</el-tag
          >
        </div>
        <div class="pull-left">
          <el-input-number
            size="mini"
            v-model="AllWhere[field.Name].Min"
            @keyup.enter="GetDiyTableRow({ _PageIndex: 1 })"
            controls-position="right"
          ></el-input-number>
        </div>
        <div
          class="line pull-left"
          style="width: 20px; text-align: center; line-height: 28px"
        >
          -
        </div>
        <div class="pull-left">
          <el-input-number
            size="mini"
            v-model="AllWhere[field.Name].Min"
            @keyup.enter="GetDiyTableRow({ _PageIndex: 1 })"
            controls-position="right"
          ></el-input-number>
        </div>
      </div>
      <div
        v-else-if="
          field.Component == 'Switch' && field._SeachDisplayType == SearchType
        "
        :key="'search8_' + field.Id + SearchType"
        :class="
          field._SeachDisplayType == 'Line'
            ? 'pull-left more-search-item-line'
            : 'pull-left more-search-item'
        "
        style="display: flex"
      >
        <div class="search-line-label pull-left" style="margin-right: 10px">
          <el-tag type="info" size="medium"
            ><i class="el-icon-search"></i> {{ field.Label }}</el-tag
          >
        </div>
        <el-select
          clearable
          v-model="AllWhere[field.AsName || field.Name]"
          @change="GetDiyTableRow({ _PageIndex: 1 })"
          style="min-width: 100px"
        >
          <el-option label="是" value="1" />
          <el-option label="否" value="0" />
        </el-select>
      </div>
      <div
        v-else-if="field._SeachDisplayType == SearchType"
        :class="
          field._SeachDisplayType == 'Line'
            ? 'pull-left more-search-item-line'
            : 'pull-left more-search-item'
        "
        :key="'search10_' + (field.Id || index) + SearchType"
      >
        <el-input
          :key="'search9_' + field.Id + SearchType"
          v-model="AllWhere[field.AsName || field.Name]"
          placeholder=""
          clearable
          size="mini"
          @input="GetDiyTableRow({ _PageIndex: 1 })"
        >
          <template #prepend
            ><i class="el-icon-search"></i> {{ field.Label }}</template
          >
        </el-input>
      </div>
    </template>
  </section>
</template>

<script>
import { toRaw } from "vue";
import _ from "underscore";
export default {
  name: "App",
  props: {
    TypeFieldName: {
      type: String,
      default: ""
    },
    // field:{
    //     type: Object,
    //     default() {
    //         return {}
    //     }
    // },
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
    }
  },
  computed: {},
  data() {
    return {
      AllWhere: {},
      DefaultAllWhere: {},
      SearchWhere: [],
      SearchCheckbox: {},
      SearchSelect: {},
      SearchModel: {},
      SearchNumber: {},
      SearchDateTime: {},
      // 四级菜单
      formatData(data, field) {
        var self = this;
        var allData = [];
        data.forEach((item, key) => {
          allData.push(item);
          self.diguiData(item, allData, field);
        });
        return allData;
      },
      SearchFieldList: []
    };
  },
  mounted() {
    console.log("search v2 mounted");
    var self = this;
    self.$nextTick(function () {
      //2022-07-26新增 url 参数 _SearchDateTime 搜索条件
      var _searchDateTime = self.$route.query._SearchDateTime;
      if (_searchDateTime) {
        var _searchDateTimeArr = _searchDateTime.split("|");
        if (_searchDateTimeArr.length == 3) {
          self.SearchDateTime[_searchDateTimeArr[0]] = [
            _searchDateTimeArr[1],
            _searchDateTimeArr[2]
          ];
        }
      }
      //2024-10-14：预处理可搜索组，不再使用低性能的 computed --> GetSearchFieldList()
      if (self.SearchFieldIds.length > 0 && self.DiyFieldList.length > 0) {
        var result = [];
        //注意：SearchFieldIds有可能是List<Guid>，也可能是List<{Id,Name,Label,AsName,TableId,TableName,TableDescription,DisplayType:'In/Out',DisplaySelect}>
        //2024-10-14：现在只考虑List<object>这种模式了
        self.SearchFieldIds.forEach((searchField) => {
          //self.DiyFieldList并不包含 【SysDefaultField】
          //2024-10-14：V4版本开始，DiyFieldList包含【SysDefaultField】
          if (searchField.Hide !== true) {
            var newSearchField = {
              ...self.DiyFieldList.find((item) => item.Id == searchField.Id)
            };
            newSearchField._SeachEqual = searchField.Equal;
            newSearchField._SeachDisplayLine = searchField.DisplayLine; //整行显示
            newSearchField._SeachDisplayType = searchField.DisplayType; //Line（默认）、In（内部）、Out（外部）
            if (newSearchField) {
              //如果是数字类型（哪怕是文本框）
              if (
                newSearchField.Type &&
                (newSearchField.Type == "int" ||
                  newSearchField.Type.indexOf("decimal") > -1)
              ) {
                newSearchField._SearchComponent = "NumberText";
                self.AllWhere[newSearchField.Name] = { Min: 0, Max: 0 };
                self.DefaultAllWhere[newSearchField.Name] = { Max: 0, Min: 0 };
              }
              //如果是下拉框
              else if (
                newSearchField.Component == "Select" ||
                newSearchField.Component == "MultipleSelect"
              ) {
                newSearchField._SearchComponent = "Select";
                self.AllWhere[newSearchField.Name] = {};
                self.DefaultAllWhere[newSearchField.Name] = {};
              }
              //如果是单选或多选
              else if (
                newSearchField.Component == "Checkbox" ||
                newSearchField.Component == "Radio"
              ) {
                //如果勾选了【下拉】
                if (searchField.DisplaySelect) {
                  newSearchField._SearchComponent = "Select";
                } else {
                  newSearchField._SearchComponent = "Checkbox";
                }
                self.AllWhere[newSearchField.Name] = "";
                self.DefaultAllWhere[newSearchField.Name] = "";
              }
              result.push(newSearchField);
            }
          }
        });
        self.SearchFieldList = result;
        self.$emit("CallbackSetDiyTableMaxHeight");
      }
    });
  },
  methods: {
    InitSearch() {
      var self = this;
      self.AllWhere = { ...self.DefaultAllWhere };
      self.SearchWhere = [];
      //2022-07-26 也要将url的参数清空
      self.$route.query._SearchDateTime = "";
    },
    GetDiyTableRow(obj) {
      var self = this;
      self.SearchWhere = [];
      var param = {
        _PageIndex: obj._PageIndex
      };
      for (let key in self.AllWhere) {
        if (
          self.AllWhere[key] &&
          JSON.stringify(self.AllWhere[key]) != "{}" &&
          JSON.stringify(self.AllWhere[key]) != "[]" &&
          JSON.stringify(self.AllWhere[key]) != '{"Min":0,"Max":0}'
        ) {
          //需要考虑到不同表、相同字段  2023-05-25
          var fieldModel = self.SearchFieldList.find(
            (item) => item.AsName == key
          );
          if (!fieldModel) {
            fieldModel = self.SearchFieldList.find(
              (item) => item.Name == key && !item.AsName
            );
          }
          if (!fieldModel) {
            fieldModel = self.SearchFieldList.find((item) => item.Name == key);
          }
          if (fieldModel._SearchComponent == "Checkbox") {
            var arr = self.AllWhere[key];
            var searchValue = [];

            arr.forEach((item) => {
              if (typeof item == "string") {
                searchValue.push(item);
              } else {
                searchValue.push(
                  item[
                    fieldModel.Config.SelectSaveField ||
                      fieldModel.Config.SelectLabel
                  ]
                );
              }
            });
            var searchType = "In";
            //如果存的是json，需要是like
            if (fieldModel.Config.SelectSaveFormat == "Json") {
              if (searchValue.length > 0) {
                param.SearchCheckbox[key] = searchValue;
              } else {
                param.SearchCheckbox[key] = "";
              }
            }
            //如果存的是字段，直接in即可
            else {
              if (searchValue.length > 0) {
                self.SearchWhere.push({
                  Name: fieldModel.Name,
                  Value: JSON.stringify(searchValue),
                  Type: searchType,
                  FormEngineKey: fieldModel.TableId
                });
              }
            }
          } else {
            self.SearchWhere.push({
              Name: fieldModel.Name,
              Value: self.AllWhere[key],
              Type: "Like",
              FormEngineKey: fieldModel.TableId
            });
          }
        }
      }
      param._IsAppendSearchWhere = true;
      self.$emit("CallbackGetDiyTableRow", param);
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
    GetDepartmentProps(field) {
      var self = this;
      var result = {
        value: "Id",
        label: "Name",
        children: "_Child",
        checkStrictly: true
      };
      if (field.Config.Department.Multiple === true) {
        // result.multiple = true;
      }
      return result;
    },
    DeptChange(item, field) {
      var self = this;
      if (item) {
        self.SearchModel[field.Name] = item[item.length - 1];
      } else {
        self.SearchModel[field.Name] = "";
      }
      self.GetDiyTableRow({ _PageIndex: 1 });
    },
    CascaderChange(item, field) {
      var self = this;
      if (item) {
        self.SearchModel[field.Name] = item[item.length - 1];
      } else {
        self.SearchModel[field.Name] = "";
      }
      self.GetDiyTableRow({ _PageIndex: 1 });
    },
    GetCascaderProps(field) {
      var self = this;
      if (self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
        //|| DiyCommon.IsNull(field.Config.Cascader.Children)
        Microi.Tips(
          field.Label + field.Name + " 存在必填属性[存储字段]未填写！",
          false
        ); //, 子级字段
      }
      //checkStrictly:是否严格的遵守父子节点不互相关联，
      var result = {
        value: field.Config.SelectSaveField,
        label: !self.DiyCommon.IsNull(field.Config.SelectLabel)
          ? field.Config.SelectLabel
          : field.Config.SelectSaveField,
        children: self.DiyCommon.IsNull(field.Config.Cascader.Children)
          ? "_Child"
          : field.Config.Cascader.Children,
        checkStrictly: true
      };
      if (field.Config.Cascader.Multiple === true) {
        // result.multiple = true;
      }
      if (field.Config.Cascader.Lazy === true) {
        result.lazy = true;
        result.lazyLoad = function (node, resolve) {
          const { level } = node;
        };
      }
      if (!self.DiyCommon.IsNull(field.Config.Cascader.Disabled)) {
        result.disabled = field.Config.Cascader.Disabled;
      }
      if (!self.DiyCommon.IsNull(field.Config.Cascader.Leaf)) {
        result.leaf = field.Config.Cascader.Leaf;
      } else {
        result.leaf = "_Leaf";
      }
      return result;
    },
    GetSelectValueKey(field) {
      var self = this;
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
    handleNodeClick(node, field) {
      var self = this;
      self.SearchModel[field.Name] = node;
      self.$refs.selectTree[0].blur();
      self.SelectChange(node, field);
    },
    GetLabel(field) {
      var self = this;
      return !self.DiyCommon.IsNull(field.Config.SelectLabel)
        ? field.Config.SelectLabel
        : field.Config.SelectSaveField;
    },
    GetSelectTreeProps(field) {
      var self = this;
      if (self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
        //|| DiyCommon.IsNull(field.Config.SelectTree.Children)
        Microi.Tips(
          field.Label + field.Name + " 存在必填属性[存储字段]未填写！",
          false
        ); //, 子级字段
      }
      //checkStrictly:是否严格的遵守父子节点不互相关联，
      var result = {
        value: field.Config.SelectSaveField,
        label: self.GetLabel(field),
        children: self.GetChildrenName(field),
        checkStrictly: true
      };
      if (field.Config.SelectTree.Multiple === true) {
        // result.multiple = true;
      }
      if (field.Config.SelectTree.Lazy === true) {
        result.lazy = true;
        result.lazyLoad = function (node, resolve) {
          const { level } = node;
        };
      }
      if (!self.DiyCommon.IsNull(field.Config.SelectTree.Disabled)) {
        result.disabled = field.Config.SelectTree.Disabled;
      }
      if (!self.DiyCommon.IsNull(field.Config.SelectTree.Leaf)) {
        result.leaf = field.Config.SelectTree.Leaf;
      } else {
        result.leaf = "_Leaf";
      }
      return result;
    },
    SelectChange(item, field) {
      var self = this;
      if (item) {
        self.SearchModel[field.Name] = item[self.GetSelectValueKey(field)];
      } else {
        self.SearchModel[field.Name] = "";
      }
      self.GetDiyTableRow({ _PageIndex: 1 });
    },
    SearchSelectChange(item, field) {
      var self = this;
      self.GetDiyTableRow({ _PageIndex: 1 });
    },
    diguiData(item, allData, field) {
      var self = this;
      if (item[self.GetChildrenName(field)]) {
        item[self.GetChildrenName(field)].forEach((childItem, keys) => {
          allData.push(childItem);
          self.diguiData(childItem, allData, field);
        });
      }
    },
    GetChildrenName(field) {
      var self = this;
      return self.DiyCommon.IsNull(field.Config.SelectTree.Children)
        ? "_Child"
        : field.Config.SelectTree.Children;
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
    SelectRemoteMethod(query, field) {
      var self = this;
      if (field.Config.DataSourceSqlRemote == true) {
        //query !== ''
        field.Config.DataSourceSqlRemoteLoading = true;
        var apiGetDiyFieldSqlData = Microi.Api.GetDiyFieldSqlData;
        if (!self.DiyCommon.IsNull(self.ApiReplace.GetDiyFieldSqlData)) {
          apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
        }
        Microi.Post(
          apiGetDiyFieldSqlData,
          {
            _FieldId: field.Id,
            // OsClient: self.OsClient,
            _SqlParamValue: JSON.stringify({}),
            _Keyword: query
          },
          function (result) {
            //2020-12-30，这里不能直接赋值，因为要考虑到选择的数据是第N页的，这时候可能又只取了第一页
            //这里要把设置的默认值加进入，不然开启了limit远程搜索后，不显示值或者错误
            //注意这里的逻辑和DiyCommon的SetFieldData逻辑类似 ，如果这里修改，那边需要同步
            if (Microi.CheckResult(result)) {
              field.Data = result.Data;
            }
            field.Config.DataSourceSqlRemoteLoading = false;
          },
          function (error) {
            field.Config.DataSourceSqlRemoteLoading = false;
          }
        );
      }
    }
  }
};
</script>

<style lang="scss" scoped></style>
