<template>
    <el-tree-select
        clearable
        :filterable="(field.Config.SelectTree && field.Config.SelectTree.Filterable) || field.Config.Filterable"
        :disabled="GetFieldReadOnly(field)"
        :placeholder="GetFieldPlaceholder(field)"
        class="main-select-tree"
        ref="selectTree"
        v-model="InnerValue"
        :data="field.Data"
        :props="TreeSelectProps"
        :node-key="TreeValueKey"
        :filter-node-method="filterNode"
        :multiple="IsTreeMultiple"
        :show-checkbox="IsTreeMultiple"
        :check-strictly="TreeCheckStrictly"
        :lazy="field.Config.SelectTree && field.Config.SelectTree.Lazy === true"
        :load="loadTreeNode"
        @update:modelValue="
            (value) => {
                return handleTreeSelectChange(value, field);
            }
        "
    />

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="下拉树配置"
        width="700px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="120px" label-position="top" size="small">
            <el-divider content-position="left">字段配置</el-divider>
            
            <el-form-item label="存储字段（可选）">
                <el-input v-model="configForm.SelectSaveField" placeholder="如：Id、value" />
                <div class="form-item-tip">数据源中用于存储到数据库的字段名</div>
            </el-form-item>
            
            <el-form-item label="显示字段（可选）">
                <el-input v-model="configForm.SelectLabel" placeholder="如：Name、label" />
                <div class="form-item-tip">数据源中用于显示的字段名，不填则使用存储字段</div>
            </el-form-item>
            
            <el-form-item label="子级字段（可选，默认_Child）">
                <el-input v-model="configForm.SelectTree.Children" placeholder="_Child" />
            </el-form-item>
            
            <el-form-item label="父级字段（一般指ParentId，必填）">
                <el-input v-model="configForm.SelectTree.ParentField" placeholder="ParentId" />
            </el-form-item>
            
            <el-form-item label="完整父级字段（一般指FullPath/ParentIds）">
                <el-input v-model="configForm.SelectTree.ParentFields" placeholder="如：parentid1,parentid2,parentid3,（以英文逗号结尾）" />
                <div class="form-item-tip">完整父级路径字段</div>
            </el-form-item>
            
            <el-form-item label="判断是否禁用的字段（可选）">
                <el-input v-model="configForm.SelectTree.Disabled" placeholder="如：Disabled" />
            </el-form-item>
            
            <el-form-item label="判断是否有子级的字段（可选）">
                <el-input v-model="configForm.SelectTree.Leaf" placeholder="如：_Leaf" />
            </el-form-item>

            <el-divider content-position="left">功能配置</el-divider>
            
            <el-form-item label="动态加载">
                <el-switch v-model="configForm.SelectTree.Lazy" active-color="#ff6c04" inactive-color="#ccc" />
                <div class="form-item-tip">开启后数据将按需加载</div>
            </el-form-item>
            
            <el-form-item label="可搜索">
                <el-switch v-model="configForm.SelectTree.Filterable" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
            
            <el-form-item label="是否多选">
                <el-switch v-model="configForm.SelectTree.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>

            <el-form-item v-if="configForm.SelectTree.Multiple" label="父子联动（选中父节点同时选中子节点）">
                <el-switch v-model="configForm.SelectTree.ParentChildLinkage" active-color="#ff6c04" inactive-color="#ccc" />
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
                <div class="form-item-tip">当数据量较大时开启</div>
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
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackSelectField', 'CallbackFormValueChange', 'update:modelValue'],
    data() {
        return {
            ModelValue: "",
            LastModelValue: "",
            InnerValue: null,
            expandOnClickNode: true,
            options: [],
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
                SelectTree: {
                    Children: '',
                    ParentField: 'ParentId',
                    ParentFields: 'ParentIds',
                    Lazy: false,
                    Filterable: false,
                    Multiple: false,
                    ParentChildLinkage: false,
                    Disabled: '',
                    Leaf: ''
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
        modelValue: {},
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

    components: {},

    computed: {
        IsTreeMultiple() {
            var cfg = this.field && this.field.Config && this.field.Config.SelectTree ? this.field.Config.SelectTree : {};
            return cfg.Multiple === true || cfg.Multiple === "true" || cfg.Multiple === 1;
        },
        TreeCheckStrictly() {
            var cfg = this.field && this.field.Config && this.field.Config.SelectTree ? this.field.Config.SelectTree : {};
            if (this.IsTreeMultiple) {
                var linkage = cfg.ParentChildLinkage === true || cfg.ParentChildLinkage === "true" || cfg.ParentChildLinkage === 1;
                return linkage ? false : true;
            }
            return true;
        },
        TreeValueKey() {
            return this.GetTreeValueKey(this.field);
        },
        TreeSelectProps() {
            return this.GetTreeSelectProps(this.field);
        }
    },

    //注意：表单打开一次后，再次打开，这个不会第二次执行，导致值不会变
    mounted() {
        var self = this;
        self.Init();
    },
    
    watch: {
        modelValue: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.syncFromExternalValue(newVal);
            }
        },
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.syncFromExternalValue(newVal);
            }
        },
        // 监听field.Data的变化，当数据加载完成后重新初始化
        'field.Data': {
            handler(newData, oldData) {
                var self = this;
                // 当数据从空变为有数据时，或数据发生变化时，重新初始化
                if (newData && newData.length > 0) {
                    self.$nextTick(() => {
                        self.Init();
                    });
                }
            },
            deep: true,
            immediate: false
        }
    },

    methods: {
        Init() {
            var self = this;
            var modelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
            // 如果数据还未加载，触发数据加载
            if (!self.field.Data || self.field.Data.length === 0) {
                self.DiyCommon.SetFieldData(self.field);
                return; // 等待watch触发后再次初始化
            }
            self.syncFromExternalValue(modelValue);
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
            self.ModelValue = node;
            self.SelectChange(node, self.field);
        },

        GetTreeValueKey(field) {
            var self = this;
            if (!field || !field.Config) return "Id";
            return self.DiyCommon.IsNull(field.Config.SelectSaveField) ? "Id" : field.Config.SelectSaveField;
        },

        GetTreeSelectProps(field) {
            var self = this;
            var result = {
                value: self.GetTreeValueKey(field),
                label: self.GetLabel(field),
                children: self.GetChildrenName(field)
            };
            if (field && field.Config && field.Config.SelectTree) {
                if (!self.DiyCommon.IsNull(field.Config.SelectTree.Disabled)) {
                    result.disabled = field.Config.SelectTree.Disabled;
                }
                if (!self.DiyCommon.IsNull(field.Config.SelectTree.Leaf)) {
                    result.isLeaf = field.Config.SelectTree.Leaf;
                }
            }
            return result;
        },

        loadTreeNode(node, resolve) {
            var self = this;
            if (self.field && self.field.Config && self.field.Config.SelectTree && typeof self.field.Config.SelectTree.LazyLoad === "function") {
                return self.field.Config.SelectTree.LazyLoad(node, resolve, self.field, self.FormDiyTableModel);
            }
            resolve([]);
        },

        syncFromExternalValue(rawValue) {
            var self = this;
            var value = rawValue;

            if (typeof value === "string" && !self.DiyCommon.IsNull(value)) {
                try {
                    value = JSON.parse(value);
                } catch (error) {
                    // 保持字符串Id
                }
            }

            var keyField = self.GetTreeValueKey(self.field);
            var isMultiple = self.IsTreeMultiple === true;

            if (isMultiple) {
                var arr = Array.isArray(value) ? value : (self.DiyCommon.IsNull(value) ? [] : [value]);
                var keys = [];
                var nodes = [];
                arr.forEach((item) => {
                    if (item && typeof item === "object") {
                        var k = item[keyField] !== undefined ? item[keyField] : (item.Id !== undefined ? item.Id : item.id);
                        keys.push(k);
                        nodes.push(self.findNodeByKey(k) || item);
                    } else {
                        keys.push(item);
                        nodes.push(self.findNodeByKey(item) || { [keyField]: item });
                    }
                });
                self.InnerValue = keys;
                self.ModelValue = nodes;
                return;
            }

            if (value && typeof value === "object") {
                var key = value[keyField] !== undefined ? value[keyField] : (value.Id !== undefined ? value.Id : value.id);
                self.InnerValue = key;
                self.ModelValue = self.findNodeByKey(key) || value;
                return;
            }

            if (!self.DiyCommon.IsNull(value)) {
                self.InnerValue = value;
                self.ModelValue = self.findNodeByKey(value) || { [keyField]: value };
                return;
            }

            self.InnerValue = isMultiple ? [] : null;
            self.ModelValue = value;
        },

        findNodeByKey(key) {
            var self = this;
            if (self.DiyCommon.IsNull(key)) return null;
            var childrenKey = self.GetChildrenName(self.field);
            var keyField = self.GetTreeValueKey(self.field);

            var dfs = (list) => {
                if (!Array.isArray(list)) return null;
                for (let i = 0; i < list.length; i++) {
                    var node = list[i];
                    if (node && node[keyField] == key) {
                        return node;
                    }
                    var found = dfs(node[childrenKey]);
                    if (found) return found;
                }
                return null;
            };

            return dfs(self.field.Data);
        },

        handleTreeSelectChange(value, field) {
            var self = this;
            var keyField = self.GetTreeValueKey(field);
            var isMultiple = self.IsTreeMultiple === true;

            if (isMultiple) {
                var keys = Array.isArray(value) ? value : (self.DiyCommon.IsNull(value) ? [] : [value]);
                var nodes = keys.map((k) => self.findNodeByKey(k) || { [keyField]: k });
                self.SelectChange(nodes, field);
                return;
            }

            if (self.DiyCommon.IsNull(value)) {
                self.SelectChange(null, field);
                return;
            }

            var node = self.findNodeByKey(value) || { [keyField]: value };
            self.SelectChange(node, field);
        },

        filterNode(value, data) {
            var self = this;
            if (!value) return true;
            var labelField = self.GetLabel(self.field);
            var saveField = self.field.Config.SelectSaveField;
            var labelValue = data[labelField];
            if (labelValue === undefined && saveField) {
                labelValue = data[saveField];
            }
            return String(labelValue || "").toLowerCase().indexOf(String(value).toLowerCase()) !== -1;
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
            if (field.Component == "Autocomplete" && (field.V8Code || (field.Config && field.Config.V8Code))) {
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
            if (field.V8Code || (field.Config && field.Config.V8Code)) {
                // self.RunV8Code(field, item)
                self.$emit("CallbackRunV8Code", { field: self.field, thisValue: item });
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

            if (field.V8Code || (field.Config && field.Config.V8Code)) {
                // self.RunV8Code(field, item)
                self.$emit("CallbackRunV8Code", { field: field, thisValue: item });
            }
            self.$emit("CallbackFormValueChange", self.field, item);
        },
        // ==================== 配置弹窗相关方法 ====================
        openConfig() {
            var self = this;
            // 初始化配置表单
            if (!self.field.Config) {
                self.field.Config = {};
            }
            if (!self.field.Config.SelectTree) {
                self.field.Config.SelectTree = {};
            }
            self.configForm = {
                SelectSaveField: self.field.Config.SelectSaveField || '',
                SelectLabel: self.field.Config.SelectLabel || '',
                DataSource: self.field.Config.DataSource || 'Data',
                Sql: self.field.Config.Sql || '',
                DataSourceId: self.field.Config.DataSourceId || '',
                DataSourceApiEngineKey: self.field.Config.DataSourceApiEngineKey || '',
                DataSourceSqlRemote: self.field.Config.DataSourceSqlRemote || false,
                SelectTree: {
                    Children: self.field.Config.SelectTree.Children || '',
                    ParentField: self.field.Config.SelectTree.ParentField || '',
                    ParentFields: self.field.Config.SelectTree.ParentFields || '',
                    Lazy: self.field.Config.SelectTree.Lazy || false,
                    Filterable: self.field.Config.SelectTree.Filterable || false,
                    Multiple: self.field.Config.SelectTree.Multiple || false,
                    ParentChildLinkage: self.field.Config.SelectTree.ParentChildLinkage || false,
                    Disabled: self.field.Config.SelectTree.Disabled || '',
                    Leaf: self.field.Config.SelectTree.Leaf || ''
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
            
            // 保存下拉树配置
            if (!self.field.Config.SelectTree) {
                self.field.Config.SelectTree = {};
            }
            self.field.Config.SelectTree.Children = self.configForm.SelectTree.Children;
            self.field.Config.SelectTree.ParentField = self.configForm.SelectTree.ParentField;
            self.field.Config.SelectTree.ParentFields = self.configForm.SelectTree.ParentFields;
            self.field.Config.SelectTree.Lazy = self.configForm.SelectTree.Lazy;
            self.field.Config.SelectTree.Filterable = self.configForm.SelectTree.Filterable;
            self.field.Config.SelectTree.Multiple = self.configForm.SelectTree.Multiple;
            self.field.Config.SelectTree.ParentChildLinkage = self.configForm.SelectTree.ParentChildLinkage;
            self.field.Config.SelectTree.Disabled = self.configForm.SelectTree.Disabled;
            self.field.Config.SelectTree.Leaf = self.configForm.SelectTree.Leaf;
            
            // 先显示提示，再关闭对话框，避免组件销毁时的更新错误
            self.DiyCommon.Tips('配置已保存', true);
            self.$nextTick(() => {
                self.configDialogVisible = false;
            });
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
