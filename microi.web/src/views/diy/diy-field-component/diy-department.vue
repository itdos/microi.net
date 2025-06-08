<template>
  <el-cascader
    v-if="field.Component == 'Department'"
    clearable
    :value="ModelValue"
    :options="field.Data"
    :props="GetDepartmentProps(field)"
    :disabled="GetFieldReadOnly(field)"
    :filterable="field.Config.Department.Filterable === true"
    @change="
      (item) => {
        return DeptChange(item, field);
      }
    "
    :collapse-tags="LoadType == 'Table' ? true : false"
  >
  </el-cascader>
</template>

<script>
// import DiyStore from '../store/diy.store'
import _ from "underscore";
export default {
  name: "diy-department",
  data() {
    return {
      ModelValue: "",
      LastModelValue: ""
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
    /**
     * 加载模式：表格、表单
     */
    LoadType: {
      type: String,
      default: "" //Form、Table
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
      if (typeof newVal == "string" && newVal != oldVal) {
        self.$nextTick(function () {
          self.ModelValue = JSON.parse(newVal);
        });
      }
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
      if (typeof modelValue == "string" && !self.DiyCommon.IsNull(modelValue) && self.field.Config.Department.EmitPath !== false) {
        try {
          modelValue = JSON.parse(modelValue);
        } catch (e) {
          console.error("Failed to parse modelValue as JSON:", e);
          modelValue = ""; // 或者其他默认值
        }
      }
      self.ModelValue = modelValue;
      self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
    },
    DeptChange(value, field) {
      var self = this;
      self.ModelChangeMethods(value);

      //2023-05-11全部注释：
      // // self.CurrentSysUserModel.DeptName = '';
      // if (!self.DiyCommon.IsNull(value) && value.length > 0) {
      //     var tObj = self.DiyCommon.ArrayDeepSearch(field.Data, '_Child', 'Id', value[value.length - 1]);
      //     if (!self.DiyCommon.IsNull(tObj)) {
      //         // self.CurrentSysUserModel.DeptName = tObj.Name;
      //         // self.CurrentSysUserModel.DeptCode = tObj.Code;
      //         if (!self.DiyCommon.IsNull(field.Config.V8Code)) {
      //             // self.RunV8Code(field, tObj)
      //             self.$emit('CallbackRunV8Code', field, value)
      //         }
      //     }
      // }
      //----end
      if (!self.DiyCommon.IsNull(field.Config.V8Code)) {
        self.$emit("CallbackRunV8Code", field, value);
      }
      self.$emit("CallbackFormValueChange", self.field, value);
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
        result.multiple = true;
      }
      if (field.Config.Department.EmitPath === false) {
        result.emitPath = false;
      }
      return result;
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
        result.multiple = true;
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
        // if(!self.DiyCommon.IsNull(self.ApiReplace.GetDiyFieldSqlData)){
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
        self.$emit("CallbackRunV8Code", self.field, item);
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
    }
  }
};
</script>

<style lang="scss" scoped></style>
