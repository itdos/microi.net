<template>
  <!--输入框-->
  <!--
    FormDiyTableModel[field.Name]
-->
  <el-autocomplete
    v-if="field.Component == 'Autocomplete'"
    v-model="ModelValue"
    :clearable="TableInEdit ? false : true"
    :disabled="GetFieldReadOnly(field)"
    :placeholder="GetFieldPlaceholder(field)"
    :value-key="field.Config.SelectLabel"
    @focus="SelectField(field)"
    @change="
      (item) => {
        return CommonV8CodeChange(item, field);
      }
    "
    @blur="
      (item) => {
        return InputOnBlur(item, field);
      }
    "
    @input="
      (item) => {
        return InputInputEvent(item, field);
      }
    "
    @keyup.native="FieldOnKeyup($event, field)"
    :fetch-suggestions="
      (queryString, cb) => {
        return querySearchAsync(queryString, cb, field);
      }
    "
    @select="
      (item) => {
        return handleSelect(item, field);
      }
    "
  >
    <i v-if="!DiyCommon.IsNull(field.Config.TextIcon) && field.Config.TextIconPosition == 'right'" slot="suffix" :class="field.Config.TextIcon" />
    <i v-if="!DiyCommon.IsNull(field.Config.TextIcon) && field.Config.TextIconPosition == 'left'" slot="prefix" :class="field.Config.TextIcon" />

    <template v-if="!DiyCommon.IsNull(field.Config.TextApend) && field.Config.TextApendPosition == 'left'" slot="prepend">{{ field.Config.TextApend }}</template>
    <template v-if="!DiyCommon.IsNull(field.Config.TextApend) && field.Config.TextApendPosition == 'right'" slot="append">{{ field.Config.TextApend }}</template>
  </el-autocomplete>
</template>

<script>
import _ from "underscore";
export default {
  name: "diy-autocomplete",
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
        self.ModelValue = self.ModelProps;
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
      self.ModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
      self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
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
        // if(!self.DiyCommon.IsNull(self.ApiReplace && self.ApiReplace.GetDiyFieldSqlData)){
        //     apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
        // }
        if (field.Config.DataSource == "Sql") {
          var apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
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
        }

        if (field.Config.DataSource == "DataSource") {
          const apiDataSourceUrl = self.DiyApi.GetDataSourceEngine;
          self.DiyCommon.Post(
            apiDataSourceUrl,
            {
              _FieldId: field.Id,
              _SqlParamValue: JSON.stringify({}),
              _Keyword: queryString,
              DataSourceKey: field.Config.DataSourceId
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
        }
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
        //如果是表内编辑，失去因为已经失去焦点了，点击后才会执行下面这段
        if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
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
      }
    },
    InputInputEvent(item, field) {
      var self = this;
      self.ModelChangeMethods(item);
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
      //如果是表内编辑，失去焦点要自动保存。
      //2021-12-07后来发现：这里不能自动保存，因为选择的时候就已经失去焦点了，但值还没有赋值。
      // if(self.TableInEdit
      //     && self.LastModelValue != self.ModelValue
      //     && (self.FormDiyTableModel._IsInTableAdd !== true)
      //     ){
      //     var param = {
      //         TableId : self.TableId,
      //         _TableRowId : self.FormDiyTableModel.Id,
      //         _FormData : {},
      //     };
      //     param._FormData[self.field.Name] = self.ModelValue;
      //     self.DiyCommon.UptDiyTableRow(param, function(result){
      //         if(self.DiyCommon.Result(result)){
      //             self.LastModelValue = self.ModelValue;
      //             self.DiyCommon.Tips(self.$t('Msg.Success'));
      //         }
      //     });
      // }
    },
    CommonV8CodeChange(item, field) {
      var self = this;
      if (!self.DiyCommon.IsNull(field.Config) && !self.DiyCommon.IsNull(field.Config.V8Code)) {
        // self.RunV8Code(field, item)
        self.$emit("CallbackRunV8Code", { field : field, thisValue : self.ModelValue }); //item
      }
      self.$emit("CallbackFormValueChange", self.field, self.ModelValue); //item
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
