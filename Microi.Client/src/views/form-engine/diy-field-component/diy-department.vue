<template>
    <!-- PC端: el-cascader -->
    <el-cascader
        v-if="field.Component == 'Department' && !isMobile"
        clearable
        v-model="ModelValue"
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
    <!-- 移动端: el-tree-select 替代 el-cascader，避免级联面板向右展开超出屏幕 -->
    <el-tree-select
        v-if="field.Component == 'Department' && isMobile"
        clearable
        :filterable="field.Config.Department.Filterable === true"
        :disabled="GetFieldReadOnly(field)"
        v-model="TreeInnerValue"
        :data="field.Data"
        :props="{ value: 'Id', label: 'Name', children: '_Child' }"
        node-key="Id"
        :multiple="field.Config.Department.Multiple === true"
        :show-checkbox="field.Config.Department.Multiple === true"
        :check-strictly="true"
        :filter-node-method="filterMobileTreeNode"
        @update:modelValue="handleMobileTreeChange"
    />

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="组织机构配置"
        width="500px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="120px" label-position="top" size="small">
            <el-form-item label="是否多选">
                <el-switch v-model="configForm.Department.Multiple" active-color="#ff6c04" inactive-color="#ccc" />
                <div class="form-item-tip">开启后可选择多个组织机构</div>
            </el-form-item>
            
            <el-form-item label="可搜索">
                <el-switch v-model="configForm.Department.Filterable" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
            
            <el-form-item label="保存所有级数组">
                <el-switch v-model="configForm.Department.EmitPath" active-color="#ff6c04" inactive-color="#ccc" />
                <div class="form-item-tip">开启后保存完整的层级数组，关闭则只保存最后一级的值</div>
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script>
// import DiyStore from '../store/diy.store'
import _ from "underscore";
export default {
    name: "diy-department",
    inheritAttrs: false,
    emits: ['ModelChange', 'CallbackRunV8Code', 'CallbackFormValueChange', 'update:modelValue'],
    data() {
        return {
            ModelValue: "",
            LastModelValue: "",
            // 移动端 el-tree-select 的内部值
            TreeInnerValue: null,
            // 配置弹窗相关
            configDialogVisible: false,
            configForm: {
                Department: {
                    Multiple: false,
                    Filterable: false,
                    EmitPath: true
                }
            }
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
        },
        SysMenuModel: {
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
                self.$nextTick(function () {
                    self.ApplyIncomingValue(newVal);
                });
            }
        },
        ModelProps: function (newVal, oldVal) {
            var self = this;
            if (newVal != oldVal) {
                self.$nextTick(function () {
                    self.ApplyIncomingValue(newVal);
                });
            }
        },
        "field.Data": function () {
            var self = this;
            self.$nextTick(function () {
                self.ApplyIncomingValue(self.GetFieldValue(self.field, self.FormDiyTableModel));
            });
        },
        FormDiyTableModel: {
            deep: false,
            handler() {
                var self = this;
                self.$nextTick(function () {
                    self.ApplyIncomingValue(self.GetFieldValue(self.field, self.FormDiyTableModel));
                });
            }
        }
    },

    components: {},

    computed: {
        isMobile() {
            return !!(this.DosCommon && this.DosCommon.isMobile);
        }
    },

    //注意：表单打开一次后，再次打开，这个不会第二次执行，导致值不会变
    mounted() {
        var self = this;
        self.Init();
    },

    methods: {
        Init() {
            var self = this;
            var modelValue = self.GetFieldValue(self.field, self.FormDiyTableModel);
            self.ApplyIncomingValue(modelValue);
            self.LastModelValue = self.ModelValue;
        },
        ApplyIncomingValue(value) {
            var self = this;
            var normalizedValue = self.NormalizeDepartmentValue(value);
            self.ModelValue = normalizedValue;
            if (self.isMobile) {
                self.TreeInnerValue = self.cascaderValueToTreeValue(normalizedValue);
            }
        },
        ParseDepartmentValue(value) {
            var self = this;
            if (typeof value !== "string") return value;
            if (self.DiyCommon.IsNull(value)) return value;
            var text = value.trim();
            if (text.indexOf("[") !== 0 && text.indexOf("{") !== 0) return value;
            try {
                return JSON.parse(text);
            } catch (e) {
                return value;
            }
        },
        GetDepartmentNodeValue(value) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                return value.Id || value.id || value.Value || value.value || value.Key || value.key || "";
            }
            return value;
        },
        GetDepartmentLeafValue(value) {
            var self = this;
            if (Array.isArray(value)) {
                if (value.length === 0) return "";
                return self.GetDepartmentLeafValue(value[value.length - 1]);
            }
            return self.GetDepartmentNodeValue(value);
        },
        NormalizeSingleDepartmentPath(value) {
            var self = this;
            if (Array.isArray(value)) {
                if (value.length === 0) return [];
                if (Array.isArray(value[0])) {
                    return self.NormalizeSingleDepartmentPath(value[0]);
                }
                if (value.length === 1) {
                    var singleLeaf = self.GetDepartmentLeafValue(value[0]);
                    return self.buildPathToNode(singleLeaf) || [singleLeaf];
                }
                return value.map(function (item) {
                    return self.GetDepartmentNodeValue(item);
                }).filter(function (item) {
                    return !self.DiyCommon.IsNull(item);
                });
            }
            var leaf = self.GetDepartmentLeafValue(value);
            if (self.DiyCommon.IsNull(leaf)) return [];
            return self.buildPathToNode(leaf) || [leaf];
        },
        NormalizeDepartmentPathValue(value, isMultiple) {
            var self = this;
            if (isMultiple) {
                if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
                    return value.map(function (item) {
                        return self.NormalizeSingleDepartmentPath(item);
                    }).filter(function (item) {
                        return Array.isArray(item) && item.length > 0;
                    });
                }
                if (Array.isArray(value)) {
                    return value.map(function (item) {
                        return self.NormalizeSingleDepartmentPath(item);
                    }).filter(function (item) {
                        return Array.isArray(item) && item.length > 0;
                    });
                }
                var singlePath = self.NormalizeSingleDepartmentPath(value);
                return singlePath.length > 0 ? [singlePath] : [];
            }
            return self.NormalizeSingleDepartmentPath(value);
        },
        NormalizeDepartmentLeafValue(value, isMultiple) {
            var self = this;
            if (isMultiple) {
                if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
                    return value.map(function (item) {
                        return self.GetDepartmentLeafValue(item);
                    }).filter(function (item) {
                        return !self.DiyCommon.IsNull(item);
                    });
                }
                if (Array.isArray(value)) {
                    return value.map(function (item) {
                        return self.GetDepartmentLeafValue(item);
                    }).filter(function (item) {
                        return !self.DiyCommon.IsNull(item);
                    });
                }
                var singleLeaf = self.GetDepartmentLeafValue(value);
                return self.DiyCommon.IsNull(singleLeaf) ? [] : [singleLeaf];
            }
            if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
                return self.GetDepartmentLeafValue(value[0]);
            }
            return self.GetDepartmentLeafValue(value);
        },
        NormalizeDepartmentValue(value) {
            var self = this;
            var isMultiple = self.field.Config.Department.Multiple === true;
            var isEmitPath = self.field.Config.Department.EmitPath !== false;
            var parsedValue = self.ParseDepartmentValue(value);
            if (self.DiyCommon.IsNull(parsedValue) || (Array.isArray(parsedValue) && parsedValue.length === 0)) {
                if (isMultiple) return [];
                return isEmitPath ? [] : null;
            }
            return isEmitPath ? self.NormalizeDepartmentPathValue(parsedValue, isMultiple) : self.NormalizeDepartmentLeafValue(parsedValue, isMultiple);
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
            if (field.V8Code || field.Config.V8Code) {
                self.$emit("CallbackRunV8Code", { field: field, thisValue: value });
            }
            self.$emit("CallbackFormValueChange", self.field, value);
        },
        // ==================== 移动端 tree-select 相关方法 ====================
        filterMobileTreeNode(value, data) {
            if (!value) return true;
            return String(data['Name'] || '').toLowerCase().indexOf(String(value).toLowerCase()) !== -1;
        },
        // 将 cascader 的值格式转换为 tree-select 的值格式
        cascaderValueToTreeValue(modelValue) {
            var self = this;
            var isMultiple = self.field.Config.Department.Multiple === true;
            var isEmitPath = self.field.Config.Department.EmitPath !== false;
            if (self.DiyCommon.IsNull(modelValue)) {
                return isMultiple ? [] : null;
            }
            if (isEmitPath) {
                if (isMultiple) {
                    // cascader: [["p1","c1","d1"],["p2","c2","d2"]] → tree: ["d1","d2"]
                    if (!Array.isArray(modelValue)) return [];
                    return modelValue.map(function (path) {
                        return Array.isArray(path) ? path[path.length - 1] : path;
                    });
                } else {
                    // cascader: ["p1","c1","d1"] → tree: "d1"
                    if (Array.isArray(modelValue) && modelValue.length > 0) {
                        return modelValue[modelValue.length - 1];
                    }
                    return modelValue;
                }
            } else {
                return modelValue;
            }
        },
        // 在树形数据中查找从根到目标节点的路径
        buildPathToNode(key) {
            var self = this;
            var findPath = function (nodes, target, currentPath) {
                if (!Array.isArray(nodes)) return null;
                for (var i = 0; i < nodes.length; i++) {
                    var node = nodes[i];
                    var newPath = currentPath.concat([node['Id']]);
                    if (node['Id'] == target) return newPath;
                    if (node['_Child'] && node['_Child'].length) {
                        var result = findPath(node['_Child'], target, newPath);
                        if (result) return result;
                    }
                }
                return null;
            };
            return findPath(self.field.Data || [], key, []);
        },
        // 移动端 tree-select 值变化处理
        handleMobileTreeChange(value) {
            var self = this;
            var isMultiple = self.field.Config.Department.Multiple === true;
            var isEmitPath = self.field.Config.Department.EmitPath !== false;

            var cascaderValue;
            if (isEmitPath) {
                if (isMultiple) {
                    var keys = Array.isArray(value) ? value : [];
                    cascaderValue = keys.map(function (k) {
                        return self.buildPathToNode(k) || [k];
                    });
                } else {
                    if (self.DiyCommon.IsNull(value)) {
                        cascaderValue = null;
                    } else {
                        cascaderValue = self.buildPathToNode(value) || [value];
                    }
                }
            } else {
                cascaderValue = value;
            }
            self.DeptChange(cascaderValue, self.field);
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
            if (self.isMobile) {
                self.TreeInnerValue = self.cascaderValueToTreeValue(item);
            }
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
        InputOnBlur(item, field) {
            var self = this;
            self.CommonV8CodeChange(item, field);
            //如果是表内编辑，失去焦点要自动保存
            if (self.TableInEdit && self.LastModelValue != self.ModelValue) {
                // 让父组件（diy-table）中央接管：实现 SysMenuModel.SaveType 的 Auto(全行保存) / Submit(批量提交)
                var __interceptPayload = { row: self.FormDiyTableModel, field: self.field, oldValue: self.LastModelValue, newValue: self.ModelValue, handled: false };
                self.$emit("CallbackInTableEditSave", __interceptPayload);
                if (__interceptPayload.handled === true) { self.LastModelValue = self.ModelValue; return; }
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
                if (self.SysMenuModel && self.SysMenuModel.AddBtnType == "InTable" && self.SysMenuModel.SaveType == "提交一起保存") {
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
            if (!self.field.Config.Department) {
                self.field.Config.Department = {};
            }
            self.configForm = {
                Department: {
                    Multiple: self.field.Config.Department.Multiple || false,
                    Filterable: self.field.Config.Department.Filterable || false,
                    EmitPath: self.field.Config.Department.EmitPath !== false
                }
            };
            self.configDialogVisible = true;
        },
        saveConfig() {
            var self = this;
            // 保存配置到 field.Config
            if (!self.field.Config.Department) {
                self.field.Config.Department = {};
            }
            self.field.Config.Department.Multiple = self.configForm.Department.Multiple;
            self.field.Config.Department.Filterable = self.configForm.Department.Filterable;
            self.field.Config.Department.EmitPath = self.configForm.Department.EmitPath;
            
            self.configDialogVisible = false;
            self.DiyCommon.Tips('配置已保存', true);
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
