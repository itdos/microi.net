<template>
<!--输入框-->
<!--
    FormDiyTableModel[field.Name]
-->
<el-input
    v-if="field.Component == 'Text' || field.Component == 'Guid'"
    v-model="ModelValue"
    :clearable="TableInEdit ? false : true"
    :disabled="GetFieldReadOnly(field)"
    :placeholder="GetFieldPlaceholder(field)"
    :show-password="DiyCommon.IsNull(field.Config.TextShowPassword) ? false : field.Config.TextShowPassword"
    @focus="SelectField(field)"
    @change="(item) => {return CommonV8CodeChange(item, field)}"
    @blur="(item) => {return InputOnBlur(item, field)}"
    @input="(item) => {return InputInputEvent(item, field)}"
    @keyup.native="FieldOnKeyup($event, field)"
    >
    <i v-if="!DiyCommon.IsNull(field.Config.TextIcon) && field.Config.TextIconPosition == 'right'" slot="suffix" :class="field.Config.TextIcon" />
    <i v-if="!DiyCommon.IsNull(field.Config.TextIcon) && field.Config.TextIconPosition == 'left'" slot="prefix" :class="field.Config.TextIcon" />

    <template v-if="!DiyCommon.IsNull(field.Config.TextApend) && field.Config.TextApendPosition == 'left'" slot="prepend">{{ field.Config.TextApend }}</template>
    <template v-if="!DiyCommon.IsNull(field.Config.TextApend) && field.Config.TextApendPosition == 'right'" slot="append">{{ field.Config.TextApend }}</template>
</el-input>
</template>

<script>
import _ from 'underscore'
export default {
    name: 'diy-input',
    data() {
        return {
            ModelValue : '',
            LastModelValue : '',
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
        FormDiyTableModel : {
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
            self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
        },
        GetFieldValue(field, form){
            var self= this;
            if(!self.DiyCommon.IsNull(field.AsName)){
                return form[field.AsName];
            }
            return form[field.Name];
        },
        ModelChangeMethods(item){
            var self = this;
            self.ModelValue = item;
            self.$emit("ModelChange", self.ModelValue);
        },
        InputInputEvent(item, field){
            var self = this;
            self.ModelChangeMethods(item);
            self.CommonV8CodeChange(item, field);
        },
        FieldOnKeyup(event, field){
            var self = this;
            var keyCode = event.keyCode;
            // 判断需要执行的V8
            if (!self.DiyCommon.IsNull(field.KeyupV8Code)) {
                self.$emit('CallbakOnKeyup', event, field);
            }
        },
        /**
         * 注意item是一个事件，并不是值
         * @param {*} item 
         * @param {*} field 
         */
        InputOnBlur(item, field){
            var self = this;
            self.CommonV8CodeChange(self.ModelValue, field, 'V8CodeBlur');//item
            //如果是表内编辑，失去焦点要自动保存
            //2021-11-02  但如果是行内新增的行，不需要自动保存，最后提交的时候再新增
            if(self.TableInEdit
                && self.LastModelValue != self.ModelValue
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
                        self.LastModelValue = self.ModelValue;
                        self.DiyCommon.Tips(self.$t('Msg.Success'));
                    }
                });
            }
        },
        /**
         * 注意onblur传过来的item不是值，是一个事件
         */
        CommonV8CodeChange(value, field, v8codeKey) {
            var self = this
            if (!self.DiyCommon.IsNull(field.Config) 
                && (!self.DiyCommon.IsNull(field.Config.V8Code) 
                    || (v8codeKey && !self.DiyCommon.IsNull(field.Config[v8codeKey]))
                    )
                ) {
                // self.RunV8Code(field, item)
                self.$emit('CallbackRunV8Code', field, value, v8codeKey)//item
            }
            self.$emit('CallbackFormValueChange', self.field, value)//item
        },
        GetFieldReadOnly(field) {
            var self = this
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
            if (self.FormMode == 'View') {
                return true;
            }
            if (self.ReadonlyFields.indexOf(field.Name) > -1) {
                return true
            }
            return field.Readonly ? true : false;
        },
        GetFieldPlaceholder(field) {
            var self = this;
            var result = '';
            if (!self.DiyCommon.IsNull(field.Placeholder)) {
                result = field.Placeholder;
            }
            if (!self.DiyCommon.IsNull(field.Code)) {
                if (!self.DiyCommon.IsNull(field.Placeholder)) {
                    result += '(' + field.Code + ')';
                } else {
                    result = field.Code;
                }
            }
            return result;
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
