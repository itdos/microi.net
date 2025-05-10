<template>
  <!--输入框-->
  <!--
    FormDiyTableModel[field.Name]
    @blur="(currentValue, oldValue) => {return InputOnBlur(currentValue, oldValue, field)}"
-->
  <!-- @change="(item) => {return CommonV8CodeChange(item, field)}" -->
  <!-- @change="(currentValue, oldValue) => {return InputOnBlur(currentValue, oldValue, field)}" -->

  <!--  -->
  <div>
    <el-time-picker
      v-if="
        field.Config &&
        (field.Config.DateTimeType == 'HH:mm' ||
          field.Config.DateTimeType == 'HH:mm:ss')
      "
      v-model="ModelValue"
      :clearable="TableInEdit ? false : true"
      :disabled="GetFieldReadOnly(field)"
      :value-format="GetDateTimeFormat(field)"
      :format="GetDateTimeFormat(field)"
      splaceholder="GetFieldPlaceholder(field)"
      @change="
        (item) => {
          return CommonV8CodeChange(item, field);
        }
      "
      @focus="SelectField(field)"
    >
    </el-time-picker>

    <el-date-picker
      v-else
      v-model="ModelValue"
      :clearable="TableInEdit ? false : true"
      :disabled="GetFieldReadOnly(field)"
      :type="GetDateTimeType(field)"
      :value-format="GetDateTimeFormat(field)"
      :format="GetDateTimeFormat(field)"
      :placeholder="GetFieldPlaceholder(field)"
      @change="
        (item) => {
          return CommonV8CodeChange(item, field);
        }
      "
      @focus="SelectField(field)"
    />
  </div>
</template>

<script>
import _ from "underscore";
export default {
  name: "diy-input-number",
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
    DiyTableModel: {
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
      self.LastModelValue = self.GetFieldValue(
        self.field,
        self.FormDiyTableModel
      );
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
    NumberTextChange(currentValue, oldValue, field) {
      var self = this;
      self.ModelChangeMethods(currentValue);
      if (
        field.Component == "NumberText" &&
        !self.DiyCommon.IsNull(field.Config.V8Code)
      ) {
        // self.RunV8Code(field, {
        //     New: currentValue,
        //     Old: oldValue
        // })
        self.$emit("CallbackRunV8Code", field, {
          New: currentValue,
          Old: oldValue
        });
      }
    },
    InputInputEvent(item, field) {
      var self = this;
      self.ModelChangeMethods(item);
      self.CommonV8CodeChange(item, field);
    },
    InputOnBlur(currentValue, oldValue, field) {
      var self = this;
      self.NumberTextChange(currentValue, oldValue, field);
      //如果是表内编辑，失去焦点要自动保存
      if (
        self.TableInEdit &&
        self.LastModelValue != self.ModelValue &&
        self.FormDiyTableModel._IsInTableAdd !== true
      ) {
        var param = {
          TableId: self.TableId,
          // _TableRowId : self.FormDiyTableModel.Id,
          Id: self.FormDiyTableModel.Id,
          _FormData: {}
        };
        param._FormData[self.field.Name] = self.ModelValue;

        var apiUrl = self.DiyApi.UptDiyTableRow;
        if (
          self.DiyTableModel &&
          self.DiyTableModel.ApiReplace &&
          self.DiyTableModel.ApiReplace.Update
        ) {
          apiUrl = self.DiyTableModel.ApiReplace.Update;
        }

        // self.DiyCommon.UptDiyTableRow(param, function(result){
        self.DiyCommon.Post(apiUrl, param, function (result) {
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
      if (
        !self.DiyCommon.IsNull(field.Config) &&
        !self.DiyCommon.IsNull(field.Config.V8Code)
      ) {
        // self.RunV8Code(field, item)
        self.$emit("CallbackRunV8Code", field, item);
      }
      //如果是表内编辑，失去焦点要自动保存
      if (
        self.TableInEdit &&
        self.LastModelValue != self.ModelValue &&
        self.FormDiyTableModel._IsInTableAdd !== true
      ) {
        var param = {
          TableId: self.TableId,
          // _TableRowId : self.FormDiyTableModel.Id,
          Id: self.FormDiyTableModel.Id,
          _FormData: {}
        };
        param._FormData[self.field.Name] = self.ModelValue;

        var apiUrl = self.DiyApi.UptDiyTableRow;
        if (
          self.DiyTableModel &&
          self.DiyTableModel.ApiReplace &&
          self.DiyTableModel.ApiReplace.Update
        ) {
          apiUrl = self.DiyTableModel.ApiReplace.Update;
        }

        // self.DiyCommon.UptDiyTableRow(param, function(result){
        self.DiyCommon.Post(apiUrl, param, function (result) {
          if (self.DiyCommon.Result(result)) {
            self.LastModelValue = self.ModelValue;
            self.DiyCommon.Tips(self.$t("Msg.Success"));
          }
        });
      }
      self.$emit("CallbackFormValueChange", self.field, item);
    },
    GetFieldReadOnly(field) {
      var self = this;
      if (self.FieldReadonly == true) {
        return true;
      }
      //如果按钮设置了预览可点击
      //并且按钮Readonly属性不为true，
      //并且ReadonlyFields不包含此字段
      //则返回false(不禁用)
      // if(field.Component == 'DateTime'
      //     // && field.Config.Button.PreviewCanClick === true
      //     && !field.Readonly
      //     && !(self.ReadonlyFields.indexOf(field.Name) > -1)){
      //     return false;
      // }

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
    GetDateTimeType(field) {
      var self = this;
      if (
        field.Config.DateTimeType == "HH:mm" ||
        field.Config.DateTimeType == "HH:mm:ss"
      ) {
        return "";
      }
      // DiyCommon.IsNull(field.Config.DateTimeType) ? 'date' : field.Config.DateTimeType
      if (!field.Config.DateTimeType) {
        return "date";
      }
      if (
        field.Config.DateTimeType == "datetime_HHmm" ||
        field.Config.DateTimeType == "datetime_HH"
      ) {
        return "datetime";
      }
      return field.Config.DateTimeType;
    },
    GetDateTimeFormat(field) {
      var self = this;
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
    }
  }
};
</script>

<style lang="scss" scoped></style>
