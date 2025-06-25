<template>
  <!-- class="all-search" style="padding-top:10px;" -->
  <section>
    <!--DIY搜索 【默认】搜索 -->
    <template v-for="(field, index) in GetSearchFieldList('Checkbox', SearchType)">
      <div :key="'search_line_' + field.Id" v-if="Array.isArray(field.Data) && field.Data.length > 0" :class="SearchType == 'Line' ? 'pull-left' : 'clear'" style="height: 38px">
        <div class="search-label pull-left" style="margin-right: 10px">
          <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{ field.Label }}</el-tag>
        </div>
        <el-checkbox-group class="pull-left" v-model="SearchCheckbox[field.AsName || field.Name]" @change="GetDiyTableRow({ _PageIndex: 1 })" style="margin-left: 0px; padding-top: 3px">
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
    <!--更多DIY搜索  【默认】搜索-->
    <template v-if="GetSearchFieldList('Text', SearchType).length > 0" class="more-search">
      <div v-if="SearchType !== 'Line'" :class="'clear'" style="height: 0px"></div>
      <div
        v-for="(field, index) in GetSearchFieldList('Text', SearchType)"
        :class="SearchType == 'Line' ? 'pull-left more-search-item-line' : 'pull-left more-search-item'"
        :key="'search_line_2' + field.Id"
      >
        <div v-if="field.Component == 'DateTime'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{ field.Label }}</el-tag>
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
          >
          </el-date-picker>
        </div>
        <div v-else-if="field.Component == 'Department'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{ field.Label }}</el-tag>
          </div>
          <el-cascader
            clearable
            v-model="SearchModel[field.AsName || field.Name]"
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
        <!--  -->
        <div v-else-if="field.Component == 'Select' || field.Component == 'MultipleSelect'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{ field.Label }}</el-tag>
          </div>
          <!-- <el-cascader
                    clearable
                    v-model="SearchModel[field.AsName || field.Name]"
                    :options="field.Data"
                    :props="GetDepartmentProps(field)"
                    :filterable="field.Config.Department.Filterable === true"
                    @change="(item) => {return DeptChange(item, field)}"
                    :collapse-tags="true"
                    >
                </el-cascader> -->
          <el-select
            v-model="SearchSelect[field.AsName || field.Name]"
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
              :label="DiyCommon.IsNull(field.Config.SelectLabel) ? fieldData : fieldData[field.Config.SelectLabel]"
              :value="fieldData"
            />
          </el-select>
        </div>

        <div v-else-if="field.Component == 'Cascader'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{ field.Label }}</el-tag>
          </div>
          <el-cascader
            v-model="SearchModel[field.AsName || field.Name]"
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
        <div v-else-if="field.Component == 'SelectTree'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{ field.Label }}</el-tag>
          </div>
          <el-select
            clearable
            class="main-select-tree"
            ref="selectTree"
            v-model="SearchModel[field.AsName || field.Name]"
            :value-key="GetSelectValueKey(field)"
            @change="
              (item) => {
                return SelectChange(item, field);
              }
            "
          >
            <el-option v-for="item in formatData(field.Data, field)" :key="'item_' + item[field.Config.SelectSaveField]" :label="item[GetLabel(field)]" :value="item" style="display: none" />
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
        <div v-else-if="field.Type && (field.Type == 'int' || field.Type.indexOf('decimal') > -1)" class="block">
          <!-- style="margin-right: 15px;" -->
          <div class="pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{ field.Label }}</el-tag>
          </div>
          <div class="pull-left">
            <el-input-number style="width: 120px" v-model="SearchNumber[field.Name].Min" @keyup.enter.native="GetDiyTableRow({ _PageIndex: 1 })" controls-position="right"></el-input-number>
          </div>
          <div class="line pull-left" style="width: 20px; text-align: center; line-height: 28px">-</div>
          <div class="pull-left">
            <el-input-number style="width: 120px" v-model="SearchNumber[field.Name].Min" @keyup.enter.native="GetDiyTableRow({ _PageIndex: 1 })" controls-position="right"></el-input-number>
          </div>
        </div>
        <div v-else-if="field.Component == 'Switch'" class="block">
          <div class="search-line-label pull-left" style="margin-right: 10px">
            <el-tag type="info" size="medium"><i class="el-icon-search"></i> {{ field.Label }}</el-tag>
          </div>
          <el-select clearable v-model="SearchModel[field.AsName || field.Name]" @change="GetDiyTableRow({ _PageIndex: 1 })">
            <el-option label="打开" value="1" />
            <el-option label="关闭" value="0" />
          </el-select>
        </div>
        <el-input v-else v-model="SearchModel[field.AsName || field.Name]" placeholder="" clearable @input="GetDiyTableRow({ _PageIndex: 1 })" style="min-width: 150px">
          <template slot="prepend"><i class="el-icon-search"></i> {{ field.Label }}</template>
        </el-input>
      </div>
    </template>
  </section>
</template>

<script>
import _ from "underscore";
import { debounce } from "lodash";

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
    },
    ApiReplace: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  computed: {
    GetSearchFieldList: function () {
      return function (type, InOrOut) {
        var self = this;
        // console.log('GetSearchFieldList function');
        if (self.SearchFieldIds.length == 0) {
          return [];
        }

        var result = [];
        // console.log('_____GetSearchFieldList_____');
        //注意：SearchFieldIds有可能是List<Guid>，也可能是List<{Id,Name,Label,AsName,TableId,TableName,TableDescription,DisplayType:'In/Out',DisplaySelect}>
        self.SearchFieldIds.forEach((id) => {
          //self.DiyFieldList并不包含 【SysDefaultField】
          self.DiyFieldList.forEach((field) => {
            if (typeof id != "string" && !self.DiyCommon.IsNull(InOrOut)) {
              if (id.DisplayType != InOrOut) {
                return;
              }
            }

            if ((field.Id == id || field.Id == id.Id) && id.Hide !== true) {
              //初始化SearchNumber
              if (field.Type && (field.Type == "int" || field.Type.indexOf("decimal") > -1) && self.DiyCommon.IsNull(self.SearchNumber[field.Name])) {
                self.SearchNumber[field.Name] = { Min: "", Max: "" };
                self.$set(self.SearchNumber, field.Name, { Min: "", Max: "" });
              }
              //2023-03-20 新增如果是下拉单选或多选
              // if (type == 'Select'
              //         &&
              //             (
              //                 field.Component == 'Select'
              //                 || field.Component == 'MultipleSelect'
              //             )
              //         ) {
              //     // if (self.DiyCommon.IsNull(self.SearchCheckbox[field.Name])) {
              //     //     // self.SearchModel[field.Name] = [];
              //     //     self.$set(self.SearchCheckbox, field.Name, []);
              //     // }
              //     result.push(field)
              // }
              //2025-6-8刘诚加，为了解决接口替换或者用代码传下拉或者数据隔离等，搜索下拉不显示或者显示不对的临时解决方案，强制吧下拉变为文本框，至少能让业务实用
              if (id.TextBox) {
                field.Component = "Text";
              }
              //如果是多选框搜索。但如果勾选了【下拉】，这时候就不能返回了
              //实际上也只有单选框、复选框、下拉选择才会可能是Checkbox模式搜索？
              if (
                type == "Checkbox" &&
                Array.isArray(field.Data) &&
                field.Data.length > 0 &&
                field.Config.DataSourceSqlRemote !== true &&
                id.DisplaySelect !== true &&
                ((field.Component == "Select" && field.Config.DataSource == "Data") ||
                  (field.Component == "MultipleSelect" && field.Config.DataSource == "Data") ||
                  field.Component == "Checkbox" ||
                  field.Component == "Radio")
              ) {
                if (self.DiyCommon.IsNull(self.SearchCheckbox[field.Name])) {
                  // self.SearchModel[field.Name] = [];
                  self.$set(self.SearchCheckbox, field.Name, []);
                }
                result.push(field);
              }
              //如果是文本框like模糊搜索
              else if (
                type == "Text" &&
                (!Array.isArray(field.Data) ||
                  field.Data.length == 0 ||
                  field.Config.DataSourceSqlRemote === true ||
                  id.DisplaySelect === true ||
                  field.Component === "Department" ||
                  field.Component === "Cascader" ||
                  field.Component === "SelectTree" ||
                  (field.Component == "Select" && id.DisplaySelect === true) || //2023-03-20新增
                  (field.Component == "MultipleSelect" && id.DisplaySelect === true)) //2023-03-20新增
              ) {
                if ((field.Component == "Select" || field.Component == "MultipleSelect") && self.DiyCommon.IsNull(self.SearchSelect[field.Name])) {
                  // self.SearchModel[field.Name] = [];
                  self.$set(self.SearchSelect, field.Name, []);
                }
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

          //2022-07-20新增可能是 【 SysDefaultField 】
          var defaultField = _.find(self.DiyCommon.SysDefaultField, function (item) {
            return item.Id == id || item.Id == id.Id;
          });
          if (defaultField && id.DisplayType == InOrOut) {
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
          // {
          //   text: "昨天",
          //   onClick(picker) {
          //     const end = new Date();
          //     const start = new Date();
          //     start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
          //     picker.$emit("pick", [start, end]);
          //   }
          // },
          // {
          //   text: "今天",
          //   onClick(picker) {
          //     const end = new Date();
          //     const start = new Date();
          //     start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
          //     picker.$emit("pick", [start, end]);
          //   }
          // },
          // {
          //   text: "本周",
          //   onClick(picker) {
          //     const end = new Date();
          //     const start = new Date();
          //     start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
          //     picker.$emit("pick", [start, end]);
          //   }
          // },
          // {
          //   text: "本月",
          //   onClick(picker) {
          //     const end = new Date();
          //     const start = new Date();
          //     start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
          //     picker.$emit("pick", [start, end]);
          //   }
          // },
          // {
          //   text: "上月",
          //   onClick(picker) {
          //     const end = new Date();
          //     const start = new Date();
          //     start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
          //     picker.$emit("pick", [start, end]);
          //   }
          // },
          // {
          //   text: "今年",
          //   onClick(picker) {
          //     const end = new Date();
          //     const start = new Date();
          //     start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
          //     picker.$emit("pick", [start, end]);
          //   }
          // },
        ]
      }
    };
  },
  mounted() {
    var self = this;
    //2022-07-26新增 url 参数 _SearchDateTime 搜索条件
    var _searchDateTime = self.$route.query._SearchDateTime;
    if (_searchDateTime) {
      var _searchDateTimeArr = _searchDateTime.split("|");
      if (_searchDateTimeArr.length == 3) {
        self.SearchDateTime[_searchDateTimeArr[0]] = [_searchDateTimeArr[1], _searchDateTimeArr[2]];
      }
    }
    //2023-05-25：预处理可搜索组，不再使用低性能的 computed --> GetSearchFieldList()
    self.$nextTick(function () {
      if (self.SearchFieldIds.length > 0) {
        //
      }
      //
    });
  },
  methods: {
    InitSearch() {
      var self = this;
      self.SearchWhere = [];
      self.Keyword = "";
      self.SearchModel = {};
      self.SearchCheckbox = {};
      self.SearchDateTime = {};
      self.SearchNumber = {};
      self.SearchSelect = {};
      //2022-07-26 也要将url的参数清空
      self.$route.query._SearchDateTime = "";
    },
    GetDateTimeFormat(field) {
      var self = this;
      if (!field || !field.Config || !field.Config.DateTimeType) {
        return "yyyy-MM-dd";
      }
      if (field.Config.DateTimeType == "datetime") {
        return "yyyy-MM-dd HH:mm:ss";
      } else if (field.Config.DateTimeType == "date") {
        return "yyyy-MM-dd";
      } else if (field.Config.DateTimeType == "week") {
        return "yyyy 第 WW 周";
      } else if (field.Config.DateTimeType == "month") {
        return "yyyy-MM";
      } else if (field.Config.DateTimeType == "year") {
        return "yyyy";
      } else if (field.Config.DateTimeType == "datetime_HHmm") {
        return "yyyy-MM-dd HH:mm";
      } else if (field.Config.DateTimeType == "datetime_HH") {
        return "yyyy-MM-dd HH";
      } else if (field.Config.DateTimeType == "HH:mm") {
        return "HH:mm";
      } else if (field.Config.DateTimeType == "HH:mm:ss") {
        return "HH:mm:ss";
      }
      return "yyyy-MM-dd";
    },
    GetDiyTableRow(obj) {
      this._GetDiyTableRow(obj, this);
    },
    _GetDiyTableRow: debounce((obj, self) => {
      console.log("触发了变更查询", self.DiyFieldList);

      //var self = this;
      self.SearchWhere = [];
      var param = {
        SearchCheckbox: self.SearchCheckbox,
        // SearchModel : self.SearchModel,
        SearchNumber: self.SearchNumber,
        // SearchDateTime : self.SearchDateTime,
        _PageIndex: obj._PageIndex
      };
      for (let key in self.SearchModel) {
        //需要考虑到不同表、相同字段  2023-05-25
        var fieldModel = _.find(self.DiyFieldList, function (item) {
          return item.AsName == key;
        });
        if (!fieldModel) {
          fieldModel = _.find(self.DiyFieldList, function (item) {
            return item.Name == key && !item.AsName;
          });
        }
        if (!fieldModel) {
          fieldModel = _.find(self.DiyFieldList, function (item) {
            return item.Name == key;
          });
        }
        var searchType = "Like";
        var searchFieldModel = self.SearchFieldIds.find((d) => {
          return d.Id == fieldModel.Id;
        });
        if (searchFieldModel && searchFieldModel.Equal) {
          searchType = "=";
        }

        self.SearchWhere.push({
          Name: fieldModel.Name,
          Value: self.SearchModel[key],
          Type: searchType,
          FormEngineKey: fieldModel.TableId
        });
      }
      //2023-03-20处理 SearchSelect
      if (self.SearchSelect) {
        //需要考虑到不同表、相同字段
        for (let key in self.SearchSelect) {
          var fieldModel = _.find(self.DiyFieldList, function (item) {
            return item.AsName == key;
          });
          if (!fieldModel) {
            fieldModel = _.find(self.DiyFieldList, function (item) {
              return item.Name == key && !item.AsName;
            });
          }
          if (!fieldModel) {
            fieldModel = _.find(self.DiyFieldList, function (item) {
              return item.Name == key;
            });
          }

          var arr = self.SearchSelect[key];
          var searchValue = [];

          arr.forEach((item) => {
            if (typeof item == "string") {
              searchValue.push(item);
            } else {
              searchValue.push(item[fieldModel.Config.SelectSaveField || fieldModel.Config.SelectLabel]);
            }
          });

          var searchType = "In";

          //如果存的是json（或者是多选框），需要是like
          if (fieldModel.Config.SelectSaveFormat == "Json" || fieldModel.Component == "MultipleSelect") {
            searchType = "Like";
            if (searchValue.length > 0) {
              // param.SearchCheckbox[key] = searchValue;
              searchValue.forEach((item, index) => {
                var tempWhere = {};
                if (searchValue.length > 1 && index == 0) {
                  tempWhere.GroupStart = true;
                }
                tempWhere.Name = fieldModel.Name;
                tempWhere.Value = item;
                tempWhere.Type = searchType;
                if (searchValue.length > 1 && index <= searchValue.length - 1 && index != 0) {
                  tempWhere.AndOr = "OR";
                }
                if (index == searchValue.length - 1 && searchValue.length > 1) {
                  tempWhere.GroupEnd = true;
                }
                self.SearchWhere.push(tempWhere);
              });
            } else {
              // param.SearchCheckbox[key] = "";
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
        }
      } else {
        param.SearchCheckbox = {};
      }
      if (self.SearchWhere.length > 0) {
        param._Where = self.SearchWhere;
      } else {
        param._Where = [];
      }
      //2025-04-12 处理时间搜索 SearchDateTime
      if (self.SearchDateTime) {
        for (let key in self.SearchDateTime) {
          if (Array.isArray(self.SearchDateTime[key])) {
            param._Where.push({
              Name: key,
              Value: self.SearchDateTime[key][0],
              Type: ">="
            });
            param._Where.push({
              Name: key,
              Value: self.SearchDateTime[key][1],
              Type: "<="
            });
          }
        }
      }
      //2025-04-12 处理多选框搜索 SearchCheckbox
      if (param.SearchCheckbox) {
        for (let key in self.SearchCheckbox) {
          if (Array.isArray(self.SearchCheckbox[key]) && self.SearchCheckbox[key].length > 0) {
            param._Where.push({
              Name: key,
              Value: JSON.stringify(self.SearchCheckbox[key]),
              Type: "In"
            });
          } else {
            param._Where.push({
              Name: key,
              Value: "",
              Type: "In"
            });
          }
        }
        delete param.SearchCheckbox;
      }

      //李赛赛 2025-06-25 以session缓存方式记录组合筛选条件的状态（代码段开始）
      let search_where = window.location.pathname + window.location.search + window.location.hash + "search_where";
      const existingCache = sessionStorage.getItem(search_where);
      if (existingCache) {
        try {
          let cachedWhere = JSON.parse(existingCache);
          //移除该控件历史搜索记录
          cachedWhere.some((item, index) => {
            if (item.Name === param._Where[0].Name) {
              cachedWhere.splice(index, 1);
              return true;
            }
            return false;
          });
          //如果该控件值不为空，则推入筛选条件数组，顺便更新该表单的筛选条件session
          if (param._Where && param._Where[0].Value) {
            cachedWhere.push(param._Where[0]);
          }
          sessionStorage.setItem(search_where, JSON.stringify(cachedWhere));
          param._Where = cachedWhere; //赋值
        } catch (e) {
          console.log("报错了", e);
        }
      } else {
        if (param._Where && param._Where[0].Value) {
          sessionStorage.setItem(search_where, JSON.stringify(param._Where));
        }
      }
      //李赛赛 2025-06-25 以session缓存方式记录组合筛选条件的状态（代码段结束）

      self.$emit("CallbackGetDiyTableRow", param);
    }, 1000),
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
        //|| self.DiyCommon.IsNull(field.Config.Cascader.Children)
        self.DiyCommon.Tips(field.Label + field.Name + " 存在必填属性[存储字段]未填写！", false); //, 子级字段
      }
      //checkStrictly:是否严格的遵守父子节点不互相关联，
      var result = {
        value: field.Config.SelectSaveField,
        label: !self.DiyCommon.IsNull(field.Config.SelectLabel) ? field.Config.SelectLabel : field.Config.SelectSaveField,
        children: self.DiyCommon.IsNull(field.Config.Cascader.Children) ? "_Child" : field.Config.Cascader.Children,
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
      if (self.DiyCommon.IsNull(field.Config.SelectLabel) && self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
        return "";
      }
      //如果是存储字段
      else {
        return self.DiyCommon.IsNull(field.Config.SelectSaveField) ? field.Config.SelectLabel : field.Config.SelectSaveField;
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
      return !self.DiyCommon.IsNull(field.Config.SelectLabel) ? field.Config.SelectLabel : field.Config.SelectSaveField;
    },
    GetSelectTreeProps(field) {
      var self = this;
      if (self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
        //|| self.DiyCommon.IsNull(field.Config.SelectTree.Children)
        self.DiyCommon.Tips(field.Label + field.Name + " 存在必填属性[存储字段]未填写！", false); //, 子级字段
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
      return self.DiyCommon.IsNull(field.Config.SelectTree.Children) ? "_Child" : field.Config.SelectTree.Children;
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
        var apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
        if (!self.DiyCommon.IsNull(self.ApiReplace.GetDiyFieldSqlData)) {
          apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
        }
        self.DiyCommon.Post(
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
            if (self.DiyCommon.Result(result)) {
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
