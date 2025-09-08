<template>
  <el-select
    clearable
    :filterable="field.Config.Filterable"
    :disabled="GetFieldReadOnly(field)"
    :placeholder="GetFieldPlaceholder(field)"
    class="main-select-tree"
    ref="selectTree"
    v-model="ModelValue"
    :value-key="GetSelectValueKey(field)"
    @change="
      (item) => {
        return SelectChange(item, field);
      }
    "
  >
    <el-option v-for="item in formatData(field.Data)" :key="item[field.Config.SelectSaveField]" :label="item[GetLabel(field)]" :value="item" style="display: none" />
    <!-- :current-node-key="ModelValue" -->
    <!-- :filter-node-method="filterNode" -->
    <el-tree
      class="main-select-el-tree"
      ref="selecteltree"
      :data="field.Data"
      node-key="Id"
      highlight-current
      :props="GetSelectTreeProps(field)"
      @node-click="handleNodeClick"
      :expand-on-click-node="expandOnClickNode"
      default-expand-all
    />
  </el-select>
</template>

<script>
import _ from "underscore";
export default {
  name: "diy-autocomplete",
  data() {
    return {
      ModelValue: "",
      LastModelValue: "",
      expandOnClickNode: true,
      options: []
    };
  },
  model: {
    prop: "ModelProps",
    event: "ModelChange"
  },
  props: {
    ModelProps: {},
    field: {
      type: Object,
      default() {
        return {};
      }
    },
    FormDiyTableModel: {
      type: Object,
      default() {
        return {};
      }
    },
    //表单模式Add、Edit、View
    FormMode: {
      type: String,
      default: "" //View
    },
    // ['FieldName1','FieldName2']
    ReadonlyFields: {
      type: Array,
      default: () => []
    },
    FieldReadonly: {
      type: Boolean,
      default: null
    },
    TableInEdit: {
      type: Boolean,
      default: false
    },
    TableId: {
      type: String,
      default: "" //View
    }
  },

  watch: {
    ModelProps: function (newVal, oldVal) {
      var self = this;
      if (newVal != oldVal) {
        // self.ModelValue = self.ModelProps;
        // var modelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);;
        var modelValue = self.ModelProps;
        if (typeof modelValue == "string" && !self.DiyCommon.IsNull(modelValue)) {
          try {
            modelValue = JSON.parse(modelValue);
          } catch (error) {
            var newModelValue = {};
            if (self.field.Config.SelectLabel) {
              newModelValue[self.field.Config.SelectLabel] = modelValue;
            }
            if (self.field.Config.SelectSaveField) {
              newModelValue[self.field.Config.SelectSaveField] = modelValue;
            }
            modelValue = newModelValue;
          }
        }
        self.ModelValue = modelValue;
      }
    },
    filterNode(value, data) {
      var self = this;
      if (!value) return true;
      return self.field.Data[self.field.Config.SelectLabel].indexOf(value) !== -1;
    }
  },

  components: {},

  computed: {},

  //注意：表单打开一次后，再次打开，这个不会第二次执行，导致值不会变
  mounted() {
    var self = this;
    self.Init();
  },

  methods: {
    Init() {
      var self = this;
      var modelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
      if (typeof modelValue == "string" && !self.DiyCommon.IsNull(modelValue)) {
        try {
          modelValue = JSON.parse(modelValue);
        } catch (error) {
          var newModelValue = {};
          if (self.field.Config.SelectLabel) {
            newModelValue[self.field.Config.SelectLabel] = modelValue;
          }
          if (self.field.Config.SelectSaveField) {
            newModelValue[self.field.Config.SelectSaveField] = modelValue;
          }
          modelValue = newModelValue;
        }
      }
      self.ModelValue = modelValue;

      self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
    },

    // 四级菜单
    formatData(data) {
      var self = this;
      var allData = [];
      data.forEach((item, key) => {
        // item['label'] = item[self.GetLabel(self.field)];
        // item['value'] = item[self.field.Config.SelectSaveField];
        allData.push(item);
        self.diguiData(item, allData);
      });
      return allData;
    },
    diguiData(item, allData) {
      var self = this;
      if (item[self.GetChildrenName(self.field)]) {
        item[self.GetChildrenName(self.field)].forEach((childItem, keys) => {
          allData.push(childItem);
          self.diguiData(childItem, allData);
        });
      }
    },
    handleNodeClick(node) {
      var self = this;
      // self.ModelValue = node[self.field.Config.SelectSaveField];
      self.ModelValue = node;
      self.$refs.selectTree.blur();
      self.SelectChange(node, self.field);
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
    GetLabel(field) {
      var self = this;
      return !self.DiyCommon.IsNull(field.Config.SelectLabel) ? field.Config.SelectLabel : field.Config.SelectSaveField;
    },
    GetChildrenName(field) {
      var self = this;
      return self.DiyCommon.IsNull(field.Config.SelectTree.Children) ? "_Child" : field.Config.SelectTree.Children;
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
        result.multiple = true;
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
      self.$emit("ModelChange", self.ModelValue);
    },
    querySearchAsync(queryString, cb, field) {
      var self = this;
      //判断是否从远程数据搜索
      if (field.Config.DataSourceSqlRemote === true) {
        field.Config.DataSourceSqlRemoteLoading = true;
        var apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
        // if(!self.DiyCommon.IsNull(self.ApiReplace && self.ApiReplace.GetDiyFieldSqlData)){
        //     apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
        // }
        self.DiyCommon.Post(
          apiGetDiyFieldSqlData,
          {
            _FieldId: field.Id,
            _SqlParamValue: JSON.stringify({}),
            _Keyword: queryString
          },
          function (result) {
            if (self.DiyCommon.Result(result)) {
              field.Data = result.Data;
              cb(result.Data);
            }
            field.Config.DataSourceSqlRemoteLoading = false;
          },
          function (error) {
            field.Config.DataSourceSqlRemoteLoading = false;
          }
        );
      } else {
        var restaurants = field.Data;
        var results = queryString ? restaurants.filter(this.createStateFilter(queryString, field)) : restaurants;
        cb(results);
      }
    },
    createStateFilter(queryString, field) {
      return (state) => {
        return state[field.Config.SelectLabel].toLowerCase().indexOf(queryString.toLowerCase()) === 0;
      };
    },
    handleSelect(item, field) {
      var self = this;
      //执行V8
      if (field.Component == "Autocomplete" && !self.DiyCommon.IsNull(field.Config.V8Code)) {
        self.$emit("CallbackRunV8Code", { field : field, thisValue : item });
      }
    },
    InputInputEvent(item, field) {
      var self = this;
      self.CommonV8CodeChange(item, field);
    },
    FieldOnKeyup(event, field) {
      var self = this;
      var keyCode = event.keyCode;
      // 判断需要执行的V8
      if (!self.DiyCommon.IsNull(field.KeyupV8Code)) {
        self.$emit("CallbakOnKeyup", event, field);
      }
    },
    InputOnBlur(item, field) {
      var self = this;
      self.CommonV8CodeChange(item, field);
      //如果是表内编辑，失去焦点要自动保存
      if (self.TableInEdit && self.LastModelValue != self.ModelValue) {
        var param = {
          TableId: self.TableId,
          _TableRowId: self.FormDiyTableModel.Id,
          _FormData: {}
        };
        param._FormData[self.field.Name] = self.ModelValue;
        let dataLog = [
          {
            Name: field.Name,
            Label: field.Label || key,
            Component: field.Component,
            OVal: self.LastModelValue || "", //老值
            NVal: self.ModelValue || "" //新值
          }
        ];
        param._DataLog = JSON.stringify(dataLog);
        self.DiyCommon.UptDiyTableRow(param, function (result) {
          if (self.DiyCommon.Result(result)) {
            self.LastModelValue = self.ModelValue;
            self.DiyCommon.Tips(self.$t("Msg.Success"));
          }
        });
      }
    },
    CommonV8CodeChange(item, field) {
      var self = this;
      self.ModelChangeMethods(item);
      if (!self.DiyCommon.IsNull(self.field.Config) && !self.DiyCommon.IsNull(self.field.Config.V8Code)) {
        // self.RunV8Code(field, item)
        self.$emit("CallbackRunV8Code", { field : self.field, thisValue : item });
      }
    },
    GetFieldReadOnly(field) {
      var self = this;
      //如果按钮设置了预览可点击
      //并且按钮Readonly属性不为true，
      //并且ReadonlyFields不包含此字段
      //则返回false(不禁用)
      // if(field.Component == 'Button'
      //     && field.Config.Button.PreviewCanClick === true
      //     && !field.Readonly
      //     && !(self.ReadonlyFields.indexOf(field.Name) > -1)){
      //     return false;
      // }
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
      return result;
    },
    SelectField(field) {
      var self = this;
      self.$emit("CallbackSelectField", field);
    },
    SelectChange(item, field) {
      var self = this;
      self.ModelChangeMethods(item);

      //如果是表内编辑，失去焦点要自动保存
      //2021-11-28注意：下拉框 ，保存的时候不是保存整个值 ，整个值可能是个json，是只保存设置的存储字段
      if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
        var param = {
          TableId: self.TableId,
          Id: self.FormDiyTableModel.Id,
          _FormData: {}
        };
        param._FormData[self.field.Name] = self.ModelValue;
        //2021-12-06新增这一句，之前少了，在diy-form.vue中一直有这个调用，会处理Select控制最终存字段的配置
        self.DiyCommon.ForRowModelHandler(param._FormData, self.DiyFieldList);
        param._FormData = self.DiyCommon.ConvertRowModel(param._FormData);

        self.DiyCommon.UptDiyTableRow(param, function (result) {
          if (self.DiyCommon.Result(result)) {
            self.LastModelValue = self.ModelValue;
            self.DiyCommon.Tips(self.$t("Msg.Success"));
          }
        });
      }

      if (!self.DiyCommon.IsNull(field.Config.V8Code)) {
        // self.RunV8Code(field, item)
        self.$emit("CallbackRunV8Code", { field : field, thisValue : item });
      }
      self.$emit("CallbackFormValueChange", self.field, item);
    }
  }
};
</script>

<style lang="scss" scoped></style>
