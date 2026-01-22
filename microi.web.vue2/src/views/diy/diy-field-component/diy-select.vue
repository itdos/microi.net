<template>
    <!--下拉框-->
    <!-- :filter-method="
            (query) => {
                return FilterMethod(query, field);
            }
        " -->
    <!--
    FormDiyTableModel[field.Name]

    reserve-keyword:多选且可搜索时，是否在选中一个选项后保留当前的搜索关键词，默认false
    automatic-dropdown:对于不可搜索的 Select，是否在输入框获得焦点后自动弹出选项菜单.【这个有bug，第一次点击会闪一下收进去】
    :reserve-keyword="field.Component == 'MultipleSelect' &&
                    (field.Config.EnableSearch == true || field.Config.DataSourceSqlRemote == true)"
-->
    <!--注意：field.Data数据是在变的，
    这里面之前设置的key【'slt_opt_key' + field.Name + '_' + index2】一定会重复，
    因为field.Name是固定不变的，
    已解决-->
    <el-select
        v-model="ModelValue"
        :disabled="GetFieldReadOnly(field)"
        :multiple="field.Component == 'MultipleSelect'"
        :filterable="field.Config.EnableSearch == true || field.Config.DataSourceSqlRemote == true"
        :loading="field.Config.DataSourceSqlRemoteLoading"
        :clearable="TableInEdit ? false : true"
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
                return SelectChange(item, field);
            }
        "
        @focus="SelectField(field)"
        @visible-change="
            (visible) => {
                return VisibleChange(visible, field);
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
</template>

<script>
import _ from "underscore";
export default {
    name: "diy-select",
    data() {
        return {
            ModelValue: "",
            LastModelValue: "",
            FieldAllData: [],
            NeedResetDataSourse: true
        };
    },
    model: {
        prop: "ModelProps",
        event: "ModelChange"
    },
    props: {
        ModelProps: {},
        field: { type: Object, default: () => {} },
        DiyTableModel: { type: Object, default: () => {} },
        ApiReplace: { type: Object, default: () => {} },
        FormDiyTableModel: { type: Object, default: () => {} },
        //表单模式Add、Edit、View
        FormMode: { type: String, default: "" },
        // ['FieldName1','FieldName2']
        ReadonlyFields: { type: Array, default: () => [] },
        FieldReadonly: { type: Boolean, default: null },
        TableInEdit: { type: Boolean, default: false },
        TableId: { type: String, default: "" },
        DiyFieldList: { type: Array, default: () => [] },
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
                // 修复：如果是普通数据源 Data，ModelValue 应该保持为字符串
                if (self.field && self.field.Config && self.field.Config.DataSource === "Data") {
                    // 如果 newVal 是对象，不要覆盖已经正确设置的字符串值
                    if (typeof newVal === "object" && newVal !== null) {
                        return;
                    }
                }
                self.ModelValue = self.ModelProps;
            }
        },
        "field.Data": function (newVal, oldVal) {
            var self = this;
            // if (newVal.length > 0 && self.FieldAllData.length == 0) {//2023-10-27注释
            //2023-10-27新增：有可能下拉框组件的数据源是动态赋值的，FieldAllData也要跟着变
            if (self.NeedResetDataSourse) {
                self.FieldAllData = [...newVal];

                // 只有在需要重置数据源时才同步 ModelValue
                // 如果是普通数据源Data，item是字符串，直接比较
                if (self.field.Config.DataSource === "Data") {
                    var delData = self.field.Data.find((item) => {
                        return item == self.ModelValue;
                    });
                    if (delData) self.ModelValue = delData;
                } else {
                    // 其他数据源，item是对象
                    var saveField = self.field.Config.SelectSaveField;
                    var delData = self.field.Data.find((item) => {
                        return item[saveField] == self.ModelValue;
                    });
                    if (delData) self.ModelValue = delData;
                }
            }
            self.NeedResetDataSourse = true;
        }
    },

    components: {},

    computed: {},

    mounted() {
        var self = this;
        var modelValue = self.FormDiyTableModel[self.field.Name];
        // 普通数据源 Data 时，值就是字符串，不需要转换
        if (self.field && self.field.Config && self.field.Config.DataSource === "Data") {
            // 普通数据源，值直接是字符串，不做任何转换
            self.ModelValue = modelValue || "";
        } else if (typeof modelValue == "string") {
            if (modelValue.startsWith("{") || modelValue.startsWith("[")) {
                try {
                    modelValue = JSON.parse(modelValue);
                } catch (error) {}
            } else if (self.field && self.field.Config && self.field.Config.SelectSaveFormat == "Text" && self.field.Config.SelectLabel) {
                var newModelValue = {};
                newModelValue[self.field.Config.SelectSaveField || self.field.Config.SelectLabel] = modelValue;
                newModelValue[self.field.Config.SelectLabel] = modelValue;
                modelValue = newModelValue;
            }
            self.ModelValue = modelValue;
        } else {
            self.ModelValue = modelValue;
        }
        self.LastModelValue = self.ModelValue;
        self.$nextTick(function () {
            //如果是普通数据源
            if (self.field && self.field.Config.DataSource == "Data") {
                self.FieldAllData = [...self.field.Data];
            }
            self.Initing = false;
        });
    },

    methods: {
        Init() {
            var self = this;
            self.ModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
            self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
        },
        VisibleChange(visible, field) {
            var self = this;
            if (!visible) {
                if (field.Config.DataSourceSqlRemote) {
                    self.SelectRemoteMethod("", field);
                } else {
                    self.FilterMethod("", field);
                }
            }
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
            // 修复：直接更新 FormDiyTableModel，确保数据同步
            var fieldName = self.DiyCommon.IsNull(self.field.AsName) ? self.field.Name : self.field.AsName;
            self.$set(self.FormDiyTableModel, fieldName, item);
            self.$emit("ModelChange", self.ModelValue);
        },
        CommonV8CodeChange(item, field) {
            var self = this;
            if (!self.DiyCommon.IsNull(field.Config) && !self.DiyCommon.IsNull(field.Config.V8Code)) {
                self.RunV8Code({ field: field, thisValue: item });
            }
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
            // if((field.Component == 'MultipleSelect'  || field.Component == 'Select' )
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
        beforeSelectChange(value, field) {
            let self = this;
            return new Promise((resolve, reject) => {
                // 判断需要执行的V8
                if ((field.Component == "Select" || field.Component == "MultipleSelect") && !self.DiyCommon.IsNull(field.Config.V8Code)) {
                    // self.RunV8Code(field, item)
                    self.$emit("CallbackRunV8Code", {
                        field: field,
                        thisValue: value,
                        callback: (res) => {
                            resolve(res);
                        }
                    });
                } else {
                    resolve(true);
                }
            });
        },
        async SelectChange(item, field) {
            var self = this;
            self.ModelChangeMethods(item);
            let res = await self.beforeSelectChange(self.ModelValue, field);
            if (res === false) return;
            //如果是表内编辑，失去焦点要自动保存
            //2021-11-28注意：下拉框 ，保存的时候不是保存整个值 ，整个值可能是个json，是只保存设置的存储字段
            if (self.TableInEdit && self.LastModelValue != self.ModelValue && self.FormDiyTableModel._IsInTableAdd !== true) {
                var param = {
                    TableId: self.TableId,
                    Id: self.FormDiyTableModel.Id,
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
                //2021-12-06新增这一句，之前少了，在diy-form.vue中一直有这个调用，会处理Select控制最终存字段的配置
                self.DiyCommon.ForRowModelHandler(param._FormData, self.DiyFieldList);
                param._FormData = self.DiyCommon.ConvertRowModel(param._FormData);

                var apiUrl = self.DiyApi.UptDiyTableRow;
                if (self.DiyTableModel && self.DiyTableModel.ApiReplace && self.DiyTableModel.ApiReplace.Update) {
                    apiUrl = self.DiyCommon.RepalceUrlKey(self.DiyTableModel.ApiReplace.Update);
                }
                //liucheng2025-10-8 可配置，表内编辑保存一起提交，值变更不会实时更新子表数据。
                if (self.DiyConfig && self.DiyConfig.AddBtnType == "InTable" && self.DiyConfig.SaveType == "提交一起保存") {
                    // 给当前所在的表单对象添加_DataStatus字段记录操作状态
                    if (!self.FormDiyTableModel._DataStatus) {
                        // 如果是新增的行，设置为Add状态，否则设置为Edit状态
                        if (self.FormDiyTableModel._IsInTableAdd === true) {
                            self.$set(self.FormDiyTableModel, "_DataStatus", "Add");
                        } else {
                            self.$set(self.FormDiyTableModel, "_DataStatus", "Edit");
                        }
                    }
                    return;
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
        GetSelectValueKey(field) {
            var self = this;
            // console.log('GetSelectValueKey:'+field.Name);
            //如果是普通数据源Data，直接返回undefined，因为值本身就是字符串，不需要value-key
            if (field.Config.DataSource === "Data") {
                return undefined;
            }
            //如果设置了存储形式为json，则SelectSaveField设置无效
            //但是，存储形式为Json，也需要设置value-key
            // if (field.Config.SelectSaveFormat == 'Json' || self.DiyCommon.IsNull(field.Config.SelectSaveFormat)) {
            //     return '';
            // }
            if (self.DiyCommon.IsNull(field.Config.SelectLabel) && self.DiyCommon.IsNull(field.Config.SelectSaveField)) {
                return "";
            }
            //如果是存储字段
            else {
                return self.DiyCommon.IsNull(field.Config.SelectSaveField) ? field.Config.SelectLabel : field.Config.SelectSaveField;
            }
        },
        FilterMethod(query, field) {
            var self = this;
            if (query) {
                //2023-10-27：搜索后对数据源进行了重新赋值，但要保留之前的FieldAllData，因此定义一个：NeedResetDataSourse = false
                self.NeedResetDataSourse = false;
                field.Data = _.filter([...self.FieldAllData], function (item) {
                    //如果是普通数据源
                    if (field.Config.DataSource == "Data") {
                        return item.indexOf(query) > -1;
                    }
                    return item[field.Config.SelectLabel].indexOf(query) > -1; //item.indexOf(query) > -1 ||  || item[field.Config.SelectLabel].indexOf(query) > -1
                });
            } else {
                //当将搜索关键词清空后，需要还原到之前的数据源
                //2023-10-27 要考虑到下拉框数据源是动态赋值
                //修复：普通数据源时也需要设置 NeedResetDataSourse = false，避免触发 watch 时覆盖已选择的值
                self.NeedResetDataSourse = false;
                if (self.field && self.field.Config.DataSource == "Data") {
                    field.Data = [...self.FieldAllData];
                }
            }
        },
        SelectRemoteMethod(query, field) {
            var self = this;
            if (field.Config.DataSourceSqlRemote == true) {
                //query !== ''
                field.Config.DataSourceSqlRemoteLoading = true;
                var apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
                var postData = {
                    _FieldId: field.Id,
                    _SqlParamValue: this.FormDiyTableModel, //JSON.stringify(this.FormDiyTableModel),
                    _Keyword: query
                };
                if (field.Config.DataSource == "Sql") {
                    apiGetDiyFieldSqlData = self.DiyApi.GetDiyFieldSqlData;
                } else if (field.Config.DataSource == "DataSource") {
                    apiGetDiyFieldSqlData = self.DiyApi.GetDataSourceEngine;
                    postData = {
                        ...postData,
                        DataSourceKey: field.Config.DataSourceId
                    };
                } else if (field.Config.DataSource == "ApiEngine") {
                    apiGetDiyFieldSqlData = self.DiyApi.ApiEngineRun;
                    postData = {
                        ...postData,
                        ApiEngineKey: field.Config.DataSourceApiEngineKey
                    };
                }

                if (!self.DiyCommon.IsNull(self.ApiReplace && self.ApiReplace.GetDiyFieldSqlData)) {
                    apiGetDiyFieldSqlData = self.ApiReplace.GetDiyFieldSqlData;
                }
                self.DiyCommon.Post(
                    apiGetDiyFieldSqlData,
                    postData,
                    function (result) {
                        //2020-12-30，这里不能直接赋值，因为要考虑到选择的数据是第N页的，这时候可能又只取了第一页
                        //这里要把设置的默认值加进入，不然开启了limit远程搜索后，不显示值或者错误
                        //注意这里的逻辑和DiyCommon的SetFieldData逻辑类似 ，如果这里修改，那边需要同步
                        if (self.DiyCommon.Result(result)) {
                            //2023-10-27：搜索后对数据源进行了重新赋值，但要保留之前的FieldAllData，因此定义一个：NeedResetDataSourse = false
                            self.NeedResetDataSourse = false;
                            field.Data = result.Data;
                        }
                        field.Config.DataSourceSqlRemoteLoading = false;
                    },
                    function (error) {
                        field.Config.DataSourceSqlRemoteLoading = false;
                    }
                );

                // self.DiyCommon.Post(
                //   apiGetDiyFieldSqlData,
                //   {
                //     _FieldId: field.Id,
                //     // OsClient: self.OsClient,
                //     _SqlParamValue: JSON.stringify({}),
                //     _Keyword: query,
                //   },
                //   function (result) {
                //     //2020-12-30，这里不能直接赋值，因为要考虑到选择的数据是第N页的，这时候可能又只取了第一页
                //     //这里要把设置的默认值加进入，不然开启了limit远程搜索后，不显示值或者错误
                //     //注意这里的逻辑和DiyCommon的SetFieldData逻辑类似 ，如果这里修改，那边需要同步
                //     if (self.DiyCommon.Result(result)) {
                //       //2023-10-27：搜索后对数据源进行了重新赋值，但要保留之前的FieldAllData，因此定义一个：NeedResetDataSourse = false
                //       self.NeedResetDataSourse = false;
                //       field.Data = result.Data;
                //     }
                //     field.Config.DataSourceSqlRemoteLoading = false;
                //   },
                //   function (error) {
                //     field.Config.DataSourceSqlRemoteLoading = false;
                //   }
                // );
            }
        }
    }
};
</script>

<style lang="scss" scoped></style>
