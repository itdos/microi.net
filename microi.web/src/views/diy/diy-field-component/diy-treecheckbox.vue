<template>
    <div class="diy-tree-checkbox">
        <!-- 搜索框 -->
        <div class="tree-checkbox-toolbar" v-if="showSearch">
            <el-input
                v-model="searchKeyword"
                :placeholder="$t('Msg.Search') || '搜索'"
                clearable
                style="width: 200px; margin-bottom: 10px"
                @input="handleSearch"
            >
                <template #prefix>
                    <el-icon><Search /></el-icon>
                </template>
            </el-input>
        </div>

        <!-- 树形表格 -->
        <el-table
            ref="treeTableRef"
            v-loading="loading"
            :data="filteredTreeData"
            row-key="Id"
            :tree-props="{ children: '_Child' }"
            :class="tableClass"
            style="width: 100%"
            stripe
            border
            :default-expand-all="defaultExpandAll"
        >
            <!-- 名称列 -->
            <el-table-column :label="nameColumnLabel" :width="nameColumnWidth">
                <template #default="scope">
                    <span
                        :style="{
                            marginLeft: getNameMarginLeft(scope.row)
                        }"
                    >
                        <el-checkbox
                            v-model="scope.row._Check"
                            :disabled="GetFieldReadOnly(field)"
                            @change="(val) => handleNameChange(val, scope.row)"
                        >
                            <i v-if="showIcon && scope.row[iconField]" :class="'icon mr-2 ' + scope.row[iconField]"></i>
                            <i v-else-if="showIcon" class="icon mr-2"></i>
                            {{ getDisplayName(scope.row) }}
                        </el-checkbox>
                    </span>
                </template>
            </el-table-column>

            <!-- 权限列 -->
            <el-table-column :label="permissionColumnLabel">
                <template #default="scope">
                    <el-checkbox-group v-model="scope.row.Permission" :disabled="GetFieldReadOnly(field)">
                        <!-- 默认权限按钮 -->
                        <template v-for="(perm, permIndex) in defaultPermissions" :key="'perm_' + permIndex">
                            <el-checkbox
                                :label="perm.value"
                                @change="(val) => handleBtnChange(val, scope.row, perm.value)"
                            >{{ perm.label }}</el-checkbox>
                        </template>

                        <!-- 自定义按钮权限 -->
                        <template v-for="btnGroup in customBtnGroups" :key="'btnGroup_' + btnGroup">
                            <el-checkbox
                                v-for="(btn, btnI) in scope.row[btnGroup]"
                                :key="'btn_' + btnGroup + '_' + btnI + '_' + btn.Id"
                                :value="btn.Id"
                            >{{ btn.Name }}</el-checkbox>
                        </template>
                    </el-checkbox-group>
                </template>
            </el-table-column>
        </el-table>
    </div>
</template>

<script>
import { ref, reactive, computed, watch, onMounted, getCurrentInstance, nextTick } from 'vue';
import { Search } from '@element-plus/icons-vue';
import _ from 'underscore';

export default {
    name: 'diy-treecheckbox',
    components: {
        Search
    },
    props: {
        // v-model 绑定值，格式：[{Id: 'xxx', Permission: '["Add","Edit"]'}]
        modelValue: {
            type: [String, Array],
            default: () => []
        },
        // 字段配置
        field: {
            type: Object,
            default: () => ({})
        },
        // 表单数据模型
        FormDiyTableModel: {
            type: Object,
            default: () => ({})
        },
        // 表单模式 Add、Edit、View
        FormMode: {
            type: String,
            default: ''
        },
        // 只读字段列表
        ReadonlyFields: {
            type: Array,
            default: () => []
        },
        // 字段只读
        FieldReadonly: {
            type: Boolean,
            default: null
        },
        // 是否表内编辑模式
        TableInEdit: {
            type: Boolean,
            default: false
        },
        // 表ID
        TableId: {
            type: String,
            default: ''
        },
        // DiyConfig 配置
        DiyConfig: {
            type: Object,
            default: () => ({})
        }
    },
    emits: ['update:modelValue', 'ModelChange', 'CallbackFormValueChange'],
    setup(props, { emit }) {
        const { proxy } = getCurrentInstance();
        const DiyCommon = proxy.DiyCommon;
        const DiyApi = proxy.DiyApi;

        // ==================== 响应式数据 ====================
        const treeTableRef = ref(null);
        const searchKeyword = ref('');
        const loading = ref(false);
        const treeData = ref([]);

        // ==================== 配置项（从 field.Config.TreeCheckbox 读取）====================
        const config = computed(() => {
            return props.field?.Config?.TreeCheckbox || {};
        });

        // 数据源配置
        const dataSourceType = computed(() => config.value.DataSourceType || 'SysMenu'); // SysMenu, Api, Static
        const dataSourceApi = computed(() => config.value.DataSourceApi || '');
        const dataSourceStatic = computed(() => config.value.DataSourceStatic || []);

        // 显示配置
        const showSearch = computed(() => config.value.ShowSearch !== false);
        const showIcon = computed(() => config.value.ShowIcon !== false);
        const defaultExpandAll = computed(() => config.value.DefaultExpandAll !== false);
        const nameColumnLabel = computed(() => config.value.NameColumnLabel || '名称');
        const nameColumnWidth = computed(() => config.value.NameColumnWidth || 250);
        const permissionColumnLabel = computed(() => config.value.PermissionColumnLabel || '权限');
        const tableClass = computed(() => config.value.TableClass || 'diy-table table-sysmenu table-sysmenu-roles cell-br');

        // 字段映射配置
        const idField = computed(() => config.value.IdField || 'Id');
        const nameField = computed(() => config.value.NameField || 'Name');
        const enNameField = computed(() => config.value.EnNameField || 'EnName');
        const iconField = computed(() => config.value.IconField || 'IconClass');
        const parentIdField = computed(() => config.value.ParentIdField || 'ParentId');
        const childrenField = computed(() => config.value.ChildrenField || '_Child');

        // 默认权限按钮配置
        const defaultPermissions = computed(() => {
            if (config.value.DefaultPermissions && config.value.DefaultPermissions.length > 0) {
                return config.value.DefaultPermissions;
            }
            // 默认权限
            return [
                { value: 'Add', label: proxy.$t?.('Msg.Add') || '新增' },
                { value: 'Edit', label: proxy.$t?.('Msg.Edit') || '编辑' },
                { value: 'Del', label: proxy.$t?.('Msg.Del') || '删除' },
                { value: 'Import', label: proxy.$t?.('Msg.Import') || '导入' },
                { value: 'Export', label: proxy.$t?.('Msg.Export') || '导出' },
                { value: 'NoDetail', label: '无' + (proxy.$t?.('Msg.Detail') || '详情') },
                { value: 'NoSearch', label: '无' + (proxy.$t?.('Msg.Search') || '搜索') }
            ];
        });

        // 自定义按钮分组
        const customBtnGroups = computed(() => {
            if (config.value.CustomBtnGroups && config.value.CustomBtnGroups.length > 0) {
                return config.value.CustomBtnGroups;
            }
            return ['MoreBtns', 'ExportMoreBtns', 'BatchSelectMoreBtns', 'PageBtns', 'PageTabs', 'FormBtns'];
        });

        // 默认权限类型列表
        const defaultRoleTypes = computed(() => {
            return defaultPermissions.value.map(p => p.value);
        });

        // ==================== 计算属性 ====================

        // 过滤后的树数据
        const filteredTreeData = computed(() => {
            if (!searchKeyword.value) {
                return treeData.value;
            }
            const keyword = searchKeyword.value.toLowerCase();
            return filterTreeData(treeData.value, keyword);
        });

        // ==================== 方法 ====================

        // 判断字段是否只读
        const GetFieldReadOnly = (field) => {
            if (props.FieldReadonly === true) {
                return true;
            }
            if (props.FormMode === 'View') {
                return true;
            }
            if (props.ReadonlyFields.indexOf(field?.Name) > -1) {
                return true;
            }
            return field?.Readonly ? true : false;
        };

        // 获取名称列的左边距
        const getNameMarginLeft = (row) => {
            const children = row[childrenField.value];
            const hasNoChildren = DiyCommon.IsNull(children) || children.length === 0;
            const isTopLevel = row[parentIdField.value] === DiyCommon.GuidEmpty;
            return (hasNoChildren && isTopLevel) ? '23px' : '0px';
        };

        // 获取显示名称
        const getDisplayName = (row) => {
            const name = row[nameField.value];
            const enName = row[enNameField.value];
            return DiyCommon.IsNull(name) ? enName : name;
        };

        // 过滤树数据（搜索）
        const filterTreeData = (data, keyword) => {
            const result = [];
            data.forEach(item => {
                const name = getDisplayName(item)?.toLowerCase() || '';
                const children = item[childrenField.value];
                
                if (name.includes(keyword)) {
                    result.push(item);
                } else if (children && children.length > 0) {
                    const filteredChildren = filterTreeData(children, keyword);
                    if (filteredChildren.length > 0) {
                        result.push({
                            ...item,
                            [childrenField.value]: filteredChildren
                        });
                    }
                }
            });
            return result;
        };

        // 处理名称复选框变化
        const handleNameChange = (val, row) => {
            forNameChange(val, row);
            syncToParent();
        };

        // 递归处理名称选择
        const forNameChange = (val, row) => {
            const moreBtns = customBtnGroups.value;
            if (val) {
                // 1. 默认权限
                const newPermission = [...defaultRoleTypes.value.filter(t => !t.startsWith('No'))];
                // 2. 当前节点自定义按钮
                moreBtns.forEach((btnKey) => {
                    if (row[btnKey] && Array.isArray(row[btnKey])) {
                        row[btnKey].forEach((btnModel) => {
                            if (btnModel && btnModel.Id && newPermission.indexOf(btnModel.Id) === -1) {
                                newPermission.push(btnModel.Id);
                            }
                        });
                    }
                });
                row.Permission = newPermission;
                // 3. 递归处理所有子节点
                const children = row[childrenField.value];
                if (children) {
                    children.forEach((childRow) => {
                        childRow._Check = true;
                        forNameChange(val, childRow);
                    });
                }
            } else {
                row.Permission = [];
                const children = row[childrenField.value];
                if (children) {
                    children.forEach((childRow) => {
                        childRow._Check = false;
                        forNameChange(val, childRow);
                    });
                }
            }
        };

        // 处理权限按钮变化
        const handleBtnChange = (val, row, type) => {
            forBtnChange(val, row, type);
            syncToParent();
        };

        // 递归处理权限按钮选择
        const forBtnChange = (val, row, type) => {
            if (val) {
                row._Check = true;
                // 递归选中子级的此权限
                const children = row[childrenField.value];
                if (children) {
                    children.forEach((childRow) => {
                        childRow._Check = true;
                        if (!(childRow.Permission.indexOf(type) > -1)) {
                            childRow.Permission.push(type);
                        }
                        forBtnChange(val, childRow, type);
                    });
                }
                // 递归选中上级的主菜单
                treeData.value.forEach((parentRow) => {
                    const parentChildren = parentRow[childrenField.value];
                    if (parentChildren && parentChildren.length > 0) {
                        if (_.where(parentChildren, { [idField.value]: row[idField.value] }).length > 0) {
                            parentRow._Check = true;
                            return;
                        }
                        forBtnParentChange(parentChildren, row, [parentRow]);
                    }
                });
            } else {
                // 递归取消子级的此权限
                const children = row[childrenField.value];
                if (children) {
                    children.forEach((childRow) => {
                        if (childRow.Permission.indexOf(type) > -1) {
                            const idx = childRow.Permission.indexOf(type);
                            if (idx > -1) {
                                childRow.Permission.splice(idx, 1);
                            }
                        }
                        forBtnChange(val, childRow, type);
                    });
                }
            }
        };

        // 递归选中上级
        const forBtnParentChange = (allList, row, parentRowArr) => {
            allList.forEach((parentRow) => {
                const parentChildren = parentRow[childrenField.value];
                if (parentChildren && parentChildren.length > 0) {
                    if (_.where(parentChildren, { [idField.value]: row[idField.value] }).length > 0) {
                        parentRow._Check = true;
                        parentRowArr.forEach((tmpParentRow) => {
                            tmpParentRow._Check = true;
                        });
                        return;
                    }
                    parentRowArr.push(parentRow);
                    forBtnParentChange(parentChildren, row, parentRowArr);
                }
            });
        };

        // 初始化树数据状态
        const initTreeDataState = (dataList) => {
            dataList.forEach((element) => {
                if (element._Check === undefined) {
                    element._Check = false;
                }
                if (element.Permission === undefined) {
                    element.Permission = [];
                }
                const children = element[childrenField.value];
                if (!DiyCommon.IsNull(children) && children.length > 0) {
                    initTreeDataState(children);
                }
            });
        };

        // 设置选中状态（从 modelValue 恢复）
        const setCheckedState = (dataList, limitsMap) => {
            for (let i = 0; i < dataList.length; i++) {
                const element = dataList[i];
                const limitData = limitsMap ? limitsMap.get(element[idField.value]) : null;

                if (limitData) {
                    element._Check = true;
                    if (!DiyCommon.IsNull(limitData.Permission)) {
                        try {
                            element.Permission = typeof limitData.Permission === 'string' 
                                ? JSON.parse(limitData.Permission) 
                                : limitData.Permission;
                        } catch (e) {
                            element.Permission = [];
                        }
                    } else {
                        element.Permission = [];
                    }
                } else {
                    element._Check = false;
                    element.Permission = [];
                }

                const children = element[childrenField.value];
                if (!DiyCommon.IsNull(children) && children.length > 0) {
                    setCheckedState(children, limitsMap);
                }
            }
        };

        // 获取选中的数据
        const getCheckedData = (dataList) => {
            const result = [];
            const allBtns = customBtnGroups.value;

            for (let i = 0; i < dataList.length; i++) {
                const item = dataList[i];
                if (item._Check === true) {
                    const _permission = [];
                    item.Permission.forEach((btnId) => {
                        if (defaultRoleTypes.value.indexOf(btnId) > -1) {
                            _permission.push(btnId);
                        }
                        allBtns.forEach((btnClass) => {
                            const findModel = _.where(item[btnClass], { Id: btnId });
                            if (findModel.length > 0 && !(_permission.indexOf(findModel[0].Name) > -1)) {
                                _permission.push(findModel[0].Id);
                                _permission.push(findModel[0].Name);
                            }
                        });
                    });
                    result.push({
                        Id: item[idField.value],
                        Permission: JSON.stringify(_permission)
                    });
                }

                const children = item[childrenField.value];
                if (!DiyCommon.IsNull(children) && children.length > 0) {
                    const childResult = getCheckedData(children);
                    childResult.forEach((child) => {
                        result.push(child);
                    });
                }
            }
            return result;
        };

        // 同步数据到父组件
        const syncToParent = () => {
            const checkedData = getCheckedData(treeData.value);
            const serialized = JSON.stringify(checkedData);
            emit('update:modelValue', serialized);
            emit('ModelChange', serialized);
            emit('CallbackFormValueChange', props.field, serialized);
        };

        // 加载数据
        const loadData = async () => {
            loading.value = true;
            try {
                if (dataSourceType.value === 'SysMenu') {
                    // 从系统菜单加载
                    await loadSysMenuData();
                } else if (dataSourceType.value === 'Api' && dataSourceApi.value) {
                    // 从自定义API加载
                    await loadApiData();
                } else if (dataSourceType.value === 'Static') {
                    // 使用静态数据
                    treeData.value = JSON.parse(JSON.stringify(dataSourceStatic.value));
                    initTreeDataState(treeData.value);
                }
                // 恢复选中状态
                restoreCheckedState();
            } finally {
                loading.value = false;
            }
        };

        // 加载系统菜单数据
        const loadSysMenuData = () => {
            return new Promise((resolve) => {
                DiyCommon.Post(
                    DiyApi.GetDiyTableRowTree,
                    {
                        _SelectFields: ['Id', 'Name', 'IconClass', 'ParentId', 'Sort', 'MoreBtns', 'FormBtns', 'ExportMoreBtns', 'BatchSelectMoreBtns', 'PageBtns', 'PageTabs'],
                        TableName: 'Sys_Menu',
                        _OrderBy: 'Sort',
                        _OrderByType: 'ASC',
                        _All: true,
                        _TreeLazy: 0
                    },
                    function (result) {
                        if (DiyCommon.Result(result)) {
                            result.Data.forEach((element) => {
                                DiyCommon.ForConvertSysMenu(element);
                            });
                            treeData.value = result.Data;
                            initTreeDataState(treeData.value);
                        }
                        resolve();
                    }
                );
            });
        };

        // 加载自定义API数据
        const loadApiData = () => {
            return new Promise((resolve) => {
                DiyCommon.Post(dataSourceApi.value, {}, function (result) {
                    if (DiyCommon.Result(result)) {
                        treeData.value = result.Data || [];
                        initTreeDataState(treeData.value);
                    }
                    resolve();
                });
            });
        };

        // 解析 modelValue
        const parseModelValue = (value) => {
            if (!value) return [];
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    return [];
                }
            }
            return [];
        };

        // 恢复选中状态
        const restoreCheckedState = () => {
            const limits = parseModelValue(props.modelValue);
            if (limits.length > 0) {
                const limitsMap = new Map();
                limits.forEach((limit) => {
                    limitsMap.set(limit.Id, limit);
                });
                setCheckedState(treeData.value, limitsMap);
            }
        };

        // 搜索处理
        const handleSearch = () => {
            // 搜索是实时的，通过 computed 实现
        };

        // 公开方法：获取选中的数据
        const getChecked = () => {
            return getCheckedData(treeData.value);
        };

        // 公开方法：设置选中状态
        const setChecked = (limits) => {
            const limitsMap = new Map();
            limits.forEach((limit) => {
                limitsMap.set(limit.Id, limit);
            });
            setCheckedState(treeData.value, limitsMap);
        };

        // 公开方法：清除所有选中
        const clearChecked = () => {
            setCheckedState(treeData.value, null);
        };

        // 公开方法：刷新数据
        const refresh = () => {
            loadData();
        };

        // ==================== 生命周期 ====================

        // 监听 modelValue 变化
        watch(
            () => props.modelValue,
            (newVal) => {
                if (treeData.value.length > 0) {
                    restoreCheckedState();
                }
            },
            { deep: true }
        );

        // 监听 FormDiyTableModel 中对应字段的变化
        watch(
            () => props.FormDiyTableModel?.[props.field?.Name],
            (newVal) => {
                if (newVal !== undefined && treeData.value.length > 0) {
                    const limits = parseModelValue(newVal);
                    if (limits.length > 0) {
                        const limitsMap = new Map();
                        limits.forEach((limit) => {
                            limitsMap.set(limit.Id, limit);
                        });
                        setCheckedState(treeData.value, limitsMap);
                    }
                }
            },
            { deep: true }
        );

        onMounted(() => {
            loadData();
        });

        return {
            // refs
            treeTableRef,
            // data
            searchKeyword,
            loading,
            treeData,
            // config
            showSearch,
            showIcon,
            defaultExpandAll,
            nameColumnLabel,
            nameColumnWidth,
            permissionColumnLabel,
            tableClass,
            iconField,
            defaultPermissions,
            customBtnGroups,
            // computed
            filteredTreeData,
            // methods
            GetFieldReadOnly,
            getNameMarginLeft,
            getDisplayName,
            handleSearch,
            handleNameChange,
            handleBtnChange,
            // 公开方法
            getChecked,
            setChecked,
            clearChecked,
            refresh,
            // icons
            Search
        };
    }
};
</script>

<style lang="scss" scoped>
.diy-tree-checkbox {
    width: 100%;
    
    .tree-checkbox-toolbar {
        margin-bottom: 10px;
    }
}
</style>

<style lang="scss">
// 非 scoped 样式，确保表格样式正确
.diy-tree-checkbox {
    .el-table.table-sysmenu-roles {
        .cell {
            white-space: normal;
        }
    }
}
</style>
