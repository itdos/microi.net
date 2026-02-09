<template>
    <!--输入框-->
    <!--
    FormDiyTableModel[field.Name]
    @change="(item) => {return CommonV8CodeChange(item, field)}"
-->
    <el-cascader
        v-if="field.Component == 'Cascader'"
        v-model="ModelValue"
        :clearable="TableInEdit ? false : true"
        :disabled="GetFieldReadOnly(field)"
        :props="GetCascaderProps(field)"
        :options="field.Data"
        :filterable="field.Config.Cascader.Filterable == true"
        @change="CommonV8CodeChange"
        :collapse-tags="LoadType == 'Table' ? true : false"
    >
    </el-cascader>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="级联选择器配置"
        width="700px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="120px" label-position="top" size="small">
            <el-divider content-position="left">字段配置</el-divider>
            
            <el-form-item label="存储字段（必填）">
                <el-input v-model="configForm.SelectSaveField" placeholder="如：Id、value" />
                <div class="form-item-tip">数据源中用于存储到数据库的字段名</div>
            </el-form-item>
            
            <el-form-item label="显示字段（可选）">
                <el-input v-model="configForm.SelectLabel" placeholder="如：Name、label" />
                <div class="form-item-tip">数据源中用于显示的字段名，不填则使用存储字段</div>
            </el-form-item>
            
            <el-form-item label="子级字段（可选，默认_Child）">
                <el-input v-model="configForm.Cascader.Children" placeholder="_Child" />
            </el-form-item>
            
            <el-form-item label="父级字段（一般指ParentId，必填）">
                <el-input v-model="configForm.Cascader.ParentField" placeholder="ParentId" />
            </el-form-item>
            
            <el-form-item label="完整父级字段（一般指FullPath/ParentIds）">
                <el-input v-model="configForm.Cascader.ParentFields" placeholder="如：parentid1,parentid2,parentid3,（以英文逗号结尾）" />
                <div class="form-item-tip">完整父级路径字段，格式如：parentid1,parentid2,parentid3,</div>
            </el-form-item>
            
            <el-form-item label="判断是否禁用的字段（可选）">
                <el-input v-model="configForm.Cascader.Disabled" placeholder="如：Disabled" />
            </el-form-item>
            
            <el-form-item label="判断是否有子级的字段（可选）">
                <el-input v-model="configForm.Cascader.Leaf" placeholder="如：_Leaf" />
            </el-form-item>

            <el-divider content-position="left">功能配置</el-divider>
            
            <el-form-item label="动态加载">
                <el-switch v-model="configForm.Cascader.Lazy" active-color="#ff6c04" inactive-color="#ccc" />
                <div class="form-item-tip">开启后数据将按需加载</div>
            </el-form-item>
            
            <el-form-item label="可搜索">
                <el-switch v-model="configForm.Cascader.Filterable" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
            
            <el-form-item label="是否多选">
                <el-switch v-model="configForm.Cascader.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
            
            <el-form-item label="保存所有级数组">
                <el-switch v-model="configForm.Cascader.EmitPath" active-color="#ff6c04" inactive-color="#ccc" />
                <div class="form-item-tip">开启后保存完整的层级数组，关闭则只保存最后一级的值</div>
            </el-form-item>

            <el-divider content-position="left">数据源</el-divider>
            
            <el-form-item label="数据源类型">
                <el-radio-group v-model="configForm.DataSource">
                    <el-radio value="Data">普通数据</el-radio>
                    <el-radio value="Sql">Sql数据源</el-radio>
                    <el-radio value="DataSource">数据源引擎</el-radio>
                    <el-radio value="ApiEngine">接口引擎</el-radio>
                </el-radio-group>
            </el-form-item>

            <!-- SQL数据源 -->
            <el-form-item v-if="configForm.DataSource == 'Sql'" label="SQL数据源">
                <el-input type="textarea" :rows="4" v-model="configForm.Sql" placeholder="select Id,Name,ParentId from TableName" />
                <div class="form-item-tip">支持$CurrentUser.Id$等系统参数</div>
            </el-form-item>

            <!-- 数据源引擎 -->
            <el-form-item v-if="configForm.DataSource == 'DataSource'" label="请选择数据源">
                <el-select v-model="configForm.DataSourceId" clearable filterable value-key="Id" placeholder="搜索数据源" style="width: 100%">
                    <el-option v-for="item in SysDataSourceList" :key="item.Id" :label="item.DataSourceName" :value="item.Id">
                        <span style="float: left">{{ item.DataSourceName }}</span>
                        <span style="float: right; color: #8492a6; font-size: 13px">{{ item.DataSourceKey }}</span>
                    </el-option>
                </el-select>
            </el-form-item>

            <!-- 接口引擎 -->
            <el-form-item v-if="configForm.DataSource == 'ApiEngine'" label="请选择接口引擎">
                <el-select v-model="configForm.DataSourceApiEngineKey" clearable filterable value-key="ApiEngineKey" placeholder="搜索接口引擎" style="width: 100%">
                    <el-option v-for="item in ApiEngineList" :key="item.ApiEngineKey" :label="item.ApiName" :value="item.ApiEngineKey">
                        <span style="float: left">{{ item.ApiName }}</span>
                        <span style="float: right; color: #8492a6; font-size: 13px">{{ item.ApiEngineKey }}</span>
                    </el-option>
                </el-select>
            </el-form-item>

            <!-- 远程搜索 -->
            <el-form-item v-if="configForm.DataSource == 'Sql' || configForm.DataSource == 'DataSource' || configForm.DataSource == 'ApiEngine'" label="远程搜索">
                <el-switch v-model="configForm.DataSourceSqlRemote" active-color="#ff6c04" inactive-color="#ccc" />
                <div class="form-item-tip">当数据量较大时开启，需在SQL中配置$Keyword$参数</div>
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script>
import _ from "underscore";
export default {
    name: "diy-autocomplete",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbakOnKeyup', 'CallbackFormValueChange', 'update:modelValue'],
    data() {
        return {
            // 修复：根据是否多选决定默认值类型
            ModelValue: (this.field?.Config?.Cascader?.Multiple) ? [] : '',
            LastModelValue: (this.field?.Config?.Cascader?.Multiple) ? [] : '',
            // 配置弹窗相关
            configDialogVisible: false,
            configForm: {
                SelectSaveField: '',
                SelectLabel: '',
                DataSource: 'Data',
                Sql: '',
                DataSourceId: '',
                DataSourceApiEngineKey: '',
                DataSourceSqlRemote: false,
                Cascader: {
                    Children: '',
                    ParentField: '',
                    ParentFields: '',
                    Lazy: false,
                    Filterable: false,
                    Multiple: false,
                    Disabled: '',
                    Leaf: '',
                    EmitPath: true
                }
            },
            SysDataSourceList: [],
            ApiEngineList: []
        };
    },
    model: {
        prop: "ModelProps",
        event: "ModelChange"
    },
    props: {
        modelValue: {
            // 修复：允许接收多种类型，级联选择器可能是字符串或数组
            type: [String, Number, Array, Object],
            default: ''
        },
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
        },
        DiyConfig: {
            type: Object,
            default() {
                return {};
            }
        }
    },

    watch: {
        modelValue: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.ModelValue = newVal;
            }
        },
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
            var modelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
            if (typeof modelValue == "string" && !self.DiyCommon.IsNull(modelValue) && self.field.Config.Cascader.EmitPath !== false) {
                modelValue = JSON.parse(modelValue);
            }
            self.ModelValue = modelValue;

            self.LastModelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
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
            self.$emit("update:modelValue", self.ModelValue);
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
                        _FormData: {},
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
            if (field.V8Code || field.Config.V8Code) {
                self.$emit("CallbackRunV8Code", { field: field, thisValue: item });
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
                //liucheng2025-10-8 可配置，表内编辑保存一起提交，值变更不会实时更新子表数据。
                if (self.DiyConfig && self.DiyConfig.AddBtnType == "InTable" && self.DiyConfig.SaveType == "提交一起保存") {
                    if (!self.FormDiyTableModel._DataStatus) {
                        // 如果是新增的行，设置为Add状态，否则设置为Edit状态
                        if (self.FormDiyTableModel._IsInTableAdd === true) {
                            self.FormDiyTableModel["_DataStatus"] = "Add";
                        } else {
                            self.FormDiyTableModel["_DataStatus"] = "Edit";
                        }
                    }
                    return;
                }
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
            if (self.field.V8Code || self.field.Config.V8Code) {
                // self.RunV8Code(field, item)
                self.$emit("CallbackRunV8Code", { field: self.field, thisValue: item });
            }
            self.$emit("CallbackFormValueChange", self.field, item);
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
        // ==================== 配置弹窗相关方法 ====================
        openConfig() {
            var self = this;
            // 初始化配置表单
            if (!self.field.Config) {
                self.field.Config = {};
            }
            if (!self.field.Config.Cascader) {
                self.field.Config.Cascader = {};
            }
            self.configForm = {
                SelectSaveField: self.field.Config.SelectSaveField || '',
                SelectLabel: self.field.Config.SelectLabel || '',
                DataSource: self.field.Config.DataSource || 'Data',
                Sql: self.field.Config.Sql || '',
                DataSourceId: self.field.Config.DataSourceId || '',
                DataSourceApiEngineKey: self.field.Config.DataSourceApiEngineKey || '',
                DataSourceSqlRemote: self.field.Config.DataSourceSqlRemote || false,
                Cascader: {
                    Children: self.field.Config.Cascader.Children || '',
                    ParentField: self.field.Config.Cascader.ParentField || '',
                    ParentFields: self.field.Config.Cascader.ParentFields || '',
                    Lazy: self.field.Config.Cascader.Lazy || false,
                    Filterable: self.field.Config.Cascader.Filterable || false,
                    Multiple: self.field.Config.Cascader.Multiple || false,
                    Disabled: self.field.Config.Cascader.Disabled || '',
                    Leaf: self.field.Config.Cascader.Leaf || '',
                    EmitPath: self.field.Config.Cascader.EmitPath !== false
                }
            };
            // 加载数据源列表和接口引擎列表
            self.loadSysDataSourceList();
            self.loadApiEngineList();
            self.configDialogVisible = true;
        },
        saveConfig() {
            var self = this;
            // 保存配置到 field.Config
            self.field.Config.SelectSaveField = self.configForm.SelectSaveField;
            self.field.Config.SelectLabel = self.configForm.SelectLabel;
            self.field.Config.DataSource = self.configForm.DataSource;
            self.field.Config.Sql = self.configForm.Sql;
            self.field.Config.DataSourceId = self.configForm.DataSourceId;
            self.field.Config.DataSourceApiEngineKey = self.configForm.DataSourceApiEngineKey;
            self.field.Config.DataSourceSqlRemote = self.configForm.DataSourceSqlRemote;
            
            // 保存级联配置
            if (!self.field.Config.Cascader) {
                self.field.Config.Cascader = {};
            }
            self.field.Config.Cascader.Children = self.configForm.Cascader.Children;
            self.field.Config.Cascader.ParentField = self.configForm.Cascader.ParentField;
            self.field.Config.Cascader.ParentFields = self.configForm.Cascader.ParentFields;
            self.field.Config.Cascader.Lazy = self.configForm.Cascader.Lazy;
            self.field.Config.Cascader.Filterable = self.configForm.Cascader.Filterable;
            self.field.Config.Cascader.Multiple = self.configForm.Cascader.Multiple;
            self.field.Config.Cascader.Disabled = self.configForm.Cascader.Disabled;
            self.field.Config.Cascader.Leaf = self.configForm.Cascader.Leaf;
            self.field.Config.Cascader.EmitPath = self.configForm.Cascader.EmitPath;
            
            self.configDialogVisible = false;
            self.DiyCommon.Tips('配置已保存', true);
        },
        loadSysDataSourceList() {
            var self = this;
            if (!self.SysDataSourceList || self.SysDataSourceList.length > 0) return;
            self.DiyCommon.GetDiyTableRow(
                { TableName: "Sys_DataSource" },
                function (data) {
                    if (data && data.Data) {
                        self.SysDataSourceList = data.Data;
                    }
                }
            );
        },
        loadApiEngineList() {
            var self = this;
            if (!self.ApiEngineList || self.ApiEngineList.length > 0) return;
            self.DiyCommon.GetDiyTableRow(
                {
                    TableName: "sys_apiengine",
                    _SelectFields: ["Id", "ApiName", "ApiEngineKey", "ApiAddress", "IsEnable"]
                },
                function (data) {
                    if (data && data.Data) {
                        self.ApiEngineList = data.Data;
                    }
                }
            );
        }
    }
};
</script>

<style lang="scss" scoped>
.form-item-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}
</style>
