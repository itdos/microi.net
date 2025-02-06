<template>
<el-switch
    v-if="field.Component == 'Switch'"
    v-model="ModelValue"
    :disabled="GetFieldReadOnly(field)"
    active-color="#13ce66"
    inactive-color="#ccc"
    @change="(item) => {return CommonV8CodeChange(item, field)}"
    @focus="SelectField(field)" />
</template>

<script>
export default {
    name: 'diy-input',
    data() {
        return {
            ModelValue : '',
        };
    },
    model: {
        prop: "ModelProps",
        event: "ModelChange",
    },
    props: {
        ModelProps:{

        },
        field : {
            type: Object,
            default() {
                return {}
            }
        },
        DiyTableModel : {
            type: Object,
            default() {
                return {}
            }
        },
        FormDiyTableModel : {
            type: Object,
            default() {
                return {}
            }
        },
        //表单模式Add、Edit、View
        FormMode: {
            type: String,
            default: '' //View
        },
        // ['FieldName1','FieldName2']
        ReadonlyFields: {
            type: Array,
            default: () => []
        },
        FieldReadonly:{
            type : Boolean,
            default: null
        },
        TableInEdit:{
            type : Boolean,
            default: false
        },
        TableId: {
            type: String,
            default: '' //View
        },
    },

    watch: {
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelValue = self.ModelProps;
            }
        },
    },

    components: {},

    computed: {},

    //注意：表单打开一次后，再次打开，这个不会第二次执行，导致值不会变
    mounted() {
        var self = this;
        self.Init();
    },

    methods: {
        Init(){
            var self = this;
            self.ModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
        },
        GetFieldValue(field, form){
            var self= this;
            if(!self.DiyCommon.IsNull(field.AsName)){
                if(form[field.AsName] == 1){
                    return true;
                }else if(form[field.AsName] == 0){
                    return false;
                }
                return form[field.AsName];
            }
            if(form[field.Name] == 1){
                return true;
            }else if(form[field.Name] == 0){
                return false;
            }
            return form[field.Name];
        },
        //必须
        ModelChangeMethods(item){
            var self = this;
            self.ModelValue = item;
            self.$emit("ModelChange", self.ModelValue);
        },
        CommonV8CodeChange(item, field) {
            var self = this
            self.ModelChangeMethods(item);
            if (!self.DiyCommon.IsNull(field.Config) && !self.DiyCommon.IsNull(field.Config.V8Code)) {
                // self.RunV8Code(field, item)
                self.$emit('CallbackRunV8Code', field, item)
            }

            //如果是表内编辑，要自动保存
            if(self.TableInEdit
                && (self.FormDiyTableModel._IsInTableAdd !== true)
                ){
                var param = {
                    TableId : self.TableId,
                    // _TableRowId : self.FormDiyTableModel.Id,
                    Id : self.FormDiyTableModel.Id,
                    _FormData : {},
                };
                param._FormData[self.field.Name] = self.ModelValue;

                var apiUrl = self.DiyApi.UptDiyTableRow;
                if(self.DiyTableModel && self.DiyTableModel.ApiReplace && self.DiyTableModel.ApiReplace.Update){
                    apiUrl = self.DiyTableModel.ApiReplace.Update;
                }

                // self.DiyCommon.UptDiyTableRow(param, function(result){
                self.DiyCommon.Post(apiUrl, param, function(result){
                    if(self.DiyCommon.Result(result)){
                        self.DiyCommon.Tips(self.$t('Msg.Success'));
                    }
                });
            }
            self.$emit('CallbackFormValueChange', self.field, item)
        },
        GetFieldReadOnly(field) {
            var self = this
            if (self.FieldReadonly == true) {
                return true;
            }
            //如果按钮设置了预览可点击
            //并且按钮Readonly属性不为true，
            //并且ReadonlyFields不包含此字段
            //则返回false(不禁用)
            // if(field.Component == 'Switch' 
            //     && field.Config.Button.PreviewCanClick === true
            //     && !field.Readonly 
            //     && !(self.ReadonlyFields.indexOf(field.Name) > -1)){
            //     return false;
            // }

            if (self.FormMode == 'View') {
                return true;
            }
            if (self.ReadonlyFields.indexOf(field.Name) > -1) {
                return true
            }
            return field.Readonly ? true : false;
        },
        SelectField(field) {
            var self = this
            self.$emit('CallbackSelectField', field)
        },
    }
}
</script>

<style lang='scss' scoped>
</style>
