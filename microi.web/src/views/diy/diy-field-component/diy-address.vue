<template>
  <el-cascader
    v-if="field.Component == 'Address'"
    v-model="ModelValue"
    :clearable="true"
    :disabled="GetFieldReadOnly(field)"
    :options="regionData"
    @change="CommonV8CodeChange"
    :collapse-tags="LoadType == 'Table' ? true : false"
    :props="props"
  >
  </el-cascader>
</template>

<script>
import { regionDataPlus } from "element-china-area-data";
import _ from "underscore";
export default {
  name: "diy-autocomplete",
  data() {
    return {
      ModelValue: [],
      LastModelValue: [],
      regionData: regionDataPlus,
      props: {
        value: "label"
      }
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
      if (newVal != oldVal) {
        self.ModelValue = self.ModelProps;
      }
    }
  },

  components: {},

  computed: {},

  mounted() {
    var self = this;
    self.Init();
    var a = self.regionData;
  },

  methods: {
    Init() {
      var self = this;
      var modelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
      if (typeof modelValue == "string" && !self.DiyCommon.IsNull(modelValue)) {
        modelValue = JSON.parse(modelValue);
      }
      self.ModelValue = modelValue;

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
    CommonV8CodeChange(item, field) {
      var self = this;

      //2022-09-28发现bug：此控件外部赋值后，并不会触发watch --> ModelProps，所以在这里额外处理下
      self.ModelValue = item;

      self.ModelChangeMethods(item);
      if (!self.DiyCommon.IsNull(self.field.Config) && !self.DiyCommon.IsNull(self.field.Config.V8Code)) {
        self.$emit("CallbackRunV8Code", self.field, item);
      }
      self.$emit("CallbackFormValueChange", self.field, item);
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
    SelectField(field) {
      var self = this;
      self.$emit("CallbackSelectField", field);
    }
  }
};
</script>

<style lang="scss" scoped></style>
