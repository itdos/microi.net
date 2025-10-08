<template>
  <section v-if="field.Component == 'FontAwesome'">
    <div @click="IconClick()" style="height: 25px; width: 25px; background: #f5f5f5; cursor: pointer; text-align: center; border-radius: 5px">
      <i :class="DiyCommon.IsNull(ModelValue) ? 'fas fa-icons hand' : 'hand ' + ModelValue" />
    </div>
    <Fontawesome :ref="'control_' + field.Name" :model.sync="ModelValue"> </Fontawesome>
  </section>
</template>

<script>
import Fontawesome from "@/views/dos.fontawesome/Fontawesome.vue";
export default {
  name: "diy-input",
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
    },
    DiyConfig: {
      type: Object,
      default() {
        return {};
      }
    }
  },

  watch: {
    ModelProps: function (newVal, oldVal) {
      var self = this;
      if (newVal != oldVal) {
        self.ModelValue = self.ModelProps;
        self.CommonV8CodeChange(self.ModelValue, self.field);
      }
    },
    ModelValue: function (newVal, oldVal) {
      var self = this;
      if (newVal != oldVal) {
        self.ModelChangeMethods();
        self.CommonV8CodeChange(self.ModelValue, self.field);
      }
    }
  },

  components: {
    Fontawesome
  },

  computed: {},

  //注意：表单打开一次后，再次打开，这个不会第二次执行，导致值不会变
  mounted() {
    var self = this;
    self.Init();
  },

  methods: {
    //必须
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
    //必须
    ModelChangeMethods() {
      var self = this;
      self.$emit("ModelChange", self.ModelValue);
    },
    IconClick() {
      var self = this;
      self.SelectField(self.field);
      if (self.GetFieldReadOnly(self.field) || self.FormMode == "View") {
        return;
      }
      self.$refs["control_" + self.field.Name].show();
    },
    CommonV8CodeChange(item, field) {
      var self = this;
      if (!self.DiyCommon.IsNull(field.Config) && !self.DiyCommon.IsNull(field.Config.V8Code)) {
        // self.RunV8Code(field, item)
        self.$emit("CallbackRunV8Code", { field : field, thisValue : item });
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
      // if(field.Component == 'Button'
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
    SelectField(field) {
      var self = this;
      self.$emit("CallbackSelectField", field);
    }
  }
};
</script>

<style lang="scss" scoped></style>
