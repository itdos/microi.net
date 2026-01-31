<template>
    <div class="diy-json-table">
        <!-- 工具栏 -->
        <div class="json-table-toolbar" v-if="!GetFieldReadOnly(field)">
            <el-input
                v-model="searchKeyword"
                :placeholder="$t('Msg.Search') || '搜索'"
                clearable
                style="width: 200px; margin-right: 10px"
                @input="handleSearch"
            >
                <template #prefix>
                    <el-icon><Search /></el-icon>
                </template>
            </el-input>
            <el-button type="primary" :icon="Plus" @click="handleAdd">
                {{ $t('Msg.Add') || '新增' }}
            </el-button>
        </div>

        <!-- 表格 -->
        <el-table
            ref="jsonTableRef"
            :data="filteredTableData"
            border
            stripe
            style="width: 100%"
            row-key="_rowKey"
            class="json-table-content"
        >
            <!-- 序号列 -->
            <el-table-column type="index" label="序号" width="60" align="center" />

            <!-- 拖拽排序列 -->
            <el-table-column v-if="!GetFieldReadOnly(field)" width="50" align="center">
                <template #header>
                    <el-icon><Rank /></el-icon>
                </template>
                <template #default>
                    <el-icon class="drag-handle" style="cursor: move"><Rank /></el-icon>
                </template>
            </el-table-column>

            <!-- 动态列 -->
            <el-table-column
                v-for="col in columnConfig"
                :key="col.Key"
                :prop="col.Key"
                :label="col.Label"
                :width="col.Width"
                :min-width="col.MinWidth || 120"
            >
                <template #default="scope">
                    <!-- 表内编辑模式 -->
                    <component
                        v-if="!GetFieldReadOnly(field)"
                        :is="GetColumnComponent(col)"
                        v-model="scope.row[col.Key]"
                        :TableInEdit="true"
                        :field="GetColumnField(col)"
                        :FormDiyTableModel="scope.row"
                        :FormMode="'Edit'"
                        :ReadonlyFields="[]"
                        :FieldReadonly="false"
                        @change="handleCellChange(scope.row, col.Key)"
                    />
                    <!-- 只读模式显示文本 -->
                    <span v-else>{{ GetDisplayValue(scope.row, col) }}</span>
                </template>
            </el-table-column>

            <!-- 操作列 -->
            <el-table-column v-if="!GetFieldReadOnly(field)" :label="$t('Msg.Operation') || '操作'" width="120" align="center" fixed="right">
                <template #default="scope">
                    <el-button link type="primary" :icon="Edit" @click="handleEdit(scope.row, scope.$index)">
                        {{ $t('Msg.Edit') || '编辑' }}
                    </el-button>
                    <el-button link type="danger" :icon="Delete" @click="handleDelete(scope.$index)">
                        {{ $t('Msg.Delete') || '删除' }}
                    </el-button>
                </template>
            </el-table-column>
        </el-table>

        <!-- 新增/编辑弹窗 -->
        <el-dialog
            v-model="dialogVisible"
            :title="dialogMode === 'add' ? ($t('Msg.Add') || '新增') : ($t('Msg.Edit') || '编辑')"
            width="600px"
            :close-on-click-modal="false"
            destroy-on-close
        >
            <el-form :model="formModel" label-width="100px" ref="dialogFormRef">
                <el-form-item
                    v-for="col in columnConfig"
                    :key="'form_' + col.Key"
                    :label="col.Label"
                    :prop="col.Key"
                    :rules="col.Required ? [{ required: true, message: `请输入${col.Label}`, trigger: 'blur' }] : []"
                >
                    <component
                        :is="GetColumnComponent(col)"
                        v-model="formModel[col.Key]"
                        :TableInEdit="false"
                        :field="GetColumnField(col)"
                        :FormDiyTableModel="formModel"
                        :FormMode="dialogMode === 'add' ? 'Add' : 'Edit'"
                        :ReadonlyFields="[]"
                        :FieldReadonly="false"
                    />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="dialogVisible = false">{{ $t('Msg.Cancel') || '取消' }}</el-button>
                <el-button type="primary" @click="handleDialogConfirm">{{ $t('Msg.Confirm') || '确定' }}</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import { ref, reactive, computed, watch, onMounted, getCurrentInstance, nextTick } from 'vue';
import { Search, Plus, Edit, Delete, Rank } from '@element-plus/icons-vue';
import Sortable from 'sortablejs';

export default {
    name: 'diy-jsontable',
    components: {
        Search,
        Plus,
        Edit,
        Delete,
        Rank
    },
    props: {
        // v-model 绑定值，JSON字符串或数组
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

        // ==================== 响应式数据 ====================
        const jsonTableRef = ref(null);
        const dialogFormRef = ref(null);
        const searchKeyword = ref('');
        const dialogVisible = ref(false);
        const dialogMode = ref('add'); // 'add' 或 'edit'
        const editingIndex = ref(-1);
        const formModel = reactive({});
        
        // 表格数据
        const tableData = ref([]);

        // ==================== 计算属性 ====================
        
        // 获取列配置 - 从 field.Config.JsonTable 或 DiyConfig.JsonTable 读取
        const columnConfig = computed(() => {
            // 优先从字段配置获取
            if (props.field?.Config?.JsonTable?.Columns && props.field.Config.JsonTable.Columns.length > 0) {
                return props.field.Config.JsonTable.Columns;
            }
            // 其次从 DiyConfig 获取
            if (props.DiyConfig?.JsonTable?.Columns && props.DiyConfig.JsonTable.Columns.length > 0) {
                return props.DiyConfig.JsonTable.Columns;
            }
            // 默认返回空数组
            return [];
        });

        // 过滤后的表格数据
        const filteredTableData = computed(() => {
            if (!searchKeyword.value) {
                return tableData.value;
            }
            const keyword = searchKeyword.value.toLowerCase();
            return tableData.value.filter(row => {
                return columnConfig.value.some(col => {
                    const value = row[col.Key];
                    if (value === null || value === undefined) return false;
                    return String(value).toLowerCase().includes(keyword);
                });
            });
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

        // 根据列配置获取组件名称
        const GetColumnComponent = (col) => {
            const componentMap = {
                'Text': 'DiyInput',
                'Input': 'DiyInput',
                'Guid': 'DiyInput',
                'Number': 'DiyInputNumber',
                'InputNumber': 'DiyInputNumber',
                'NumberText': 'DiyInputNumber',
                'Select': 'DiySelect',
                'MultipleSelect': 'DiyMultipleSelect',
                'DateTime': 'DiyDateTime',
                'Date': 'DiyDateTime',
                'Time': 'DiyDateTime',
                'Switch': 'DiySwitch',
                'Checkbox': 'DiyCheckbox',
                'Radio': 'DiyRadio',
                'Textarea': 'DiyTextarea',
                'Rate': 'DiyRate',
                'ColorPicker': 'DiyColorPicker'
            };
            return componentMap[col.Component] || 'DiyInput';
        };

        // 根据列配置生成字段对象，供子组件使用
        const GetColumnField = (col) => {
            return {
                Id: col.Key,
                Name: col.Key,
                Label: col.Label,
                Component: col.Component || 'Text',
                Readonly: col.Readonly || false,
                Placeholder: col.Placeholder || '',
                Config: col.Config || {},
                Data: col.Data || []
            };
        };

        // 获取显示值
        const GetDisplayValue = (row, col) => {
            const value = row[col.Key];
            if (value === null || value === undefined) return '';
            // 如果有数据源，尝试找到对应的显示值
            if (col.Data && col.Data.length > 0 && col.Config?.SelectLabel) {
                const found = col.Data.find(item => item[col.Config.SelectSaveField || 'value'] === value);
                if (found) {
                    return found[col.Config.SelectLabel];
                }
            }
            return String(value);
        };

        // 解析数据
        const parseData = (value) => {
            if (!value) return [];
            if (Array.isArray(value)) {
                return value.map((item, index) => ({
                    ...item,
                    _rowKey: item._rowKey || `row_${Date.now()}_${index}`
                }));
            }
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        return parsed.map((item, index) => ({
                            ...item,
                            _rowKey: item._rowKey || `row_${Date.now()}_${index}`
                        }));
                    }
                } catch (e) {
                    console.warn('JSON解析失败:', e);
                }
            }
            return [];
        };

        // 序列化数据
        const serializeData = (data) => {
            // 移除内部使用的 _rowKey 字段
            const cleanData = data.map(item => {
                const { _rowKey, ...rest } = item;
                return rest;
            });
            return JSON.stringify(cleanData);
        };

        // 同步数据到父组件
        const syncToParent = () => {
            const serialized = serializeData(tableData.value);
            emit('update:modelValue', serialized);
            emit('ModelChange', serialized);
            emit('CallbackFormValueChange', props.field, serialized);
        };

        // 搜索处理
        const handleSearch = () => {
            // 搜索是实时的，通过 computed 实现
        };

        // 新增
        const handleAdd = () => {
            dialogMode.value = 'add';
            editingIndex.value = -1;
            // 清空表单
            Object.keys(formModel).forEach(key => delete formModel[key]);
            // 初始化默认值
            columnConfig.value.forEach(col => {
                formModel[col.Key] = col.DefaultValue !== undefined ? col.DefaultValue : '';
            });
            dialogVisible.value = true;
        };

        // 编辑
        const handleEdit = (row, index) => {
            dialogMode.value = 'edit';
            // 找到在原始数据中的索引
            const originalIndex = tableData.value.findIndex(item => item._rowKey === row._rowKey);
            editingIndex.value = originalIndex;
            // 复制数据到表单
            Object.keys(formModel).forEach(key => delete formModel[key]);
            Object.keys(row).forEach(key => {
                if (key !== '_rowKey') {
                    formModel[key] = row[key];
                }
            });
            dialogVisible.value = true;
        };

        // 删除
        const handleDelete = (index) => {
            const row = filteredTableData.value[index];
            const originalIndex = tableData.value.findIndex(item => item._rowKey === row._rowKey);
            if (originalIndex > -1) {
                tableData.value.splice(originalIndex, 1);
                syncToParent();
            }
        };

        // 单元格值变化
        const handleCellChange = (row, key) => {
            syncToParent();
        };

        // 弹窗确认
        const handleDialogConfirm = async () => {
            // 表单验证
            if (dialogFormRef.value) {
                try {
                    await dialogFormRef.value.validate();
                } catch (e) {
                    return;
                }
            }

            if (dialogMode.value === 'add') {
                // 新增
                const newRow = {
                    ...formModel,
                    _rowKey: `row_${Date.now()}_${tableData.value.length}`
                };
                tableData.value.push(newRow);
            } else {
                // 编辑
                if (editingIndex.value > -1) {
                    const oldRowKey = tableData.value[editingIndex.value]._rowKey;
                    tableData.value[editingIndex.value] = {
                        ...formModel,
                        _rowKey: oldRowKey
                    };
                }
            }

            dialogVisible.value = false;
            syncToParent();
        };

        // 初始化拖拽排序
        const initSortable = () => {
            nextTick(() => {
                const el = jsonTableRef.value?.$el?.querySelector('.el-table__body-wrapper tbody');
                if (el) {
                    Sortable.create(el, {
                        handle: '.drag-handle',
                        animation: 150,
                        onEnd: (evt) => {
                            const { oldIndex, newIndex } = evt;
                            if (oldIndex !== newIndex) {
                                // 注意：这里操作的是过滤后的数据对应的原始索引
                                const filteredData = filteredTableData.value;
                                const movedItem = filteredData[oldIndex];
                                const targetItem = filteredData[newIndex];
                                
                                // 找到在原始数据中的索引
                                const oldOriginalIndex = tableData.value.findIndex(item => item._rowKey === movedItem._rowKey);
                                const newOriginalIndex = tableData.value.findIndex(item => item._rowKey === targetItem._rowKey);
                                
                                if (oldOriginalIndex > -1 && newOriginalIndex > -1) {
                                    const [removed] = tableData.value.splice(oldOriginalIndex, 1);
                                    tableData.value.splice(newOriginalIndex, 0, removed);
                                    syncToParent();
                                }
                            }
                        }
                    });
                }
            });
        };

        // ==================== 生命周期 ====================

        // 监听 modelValue 变化
        watch(
            () => props.modelValue,
            (newVal) => {
                tableData.value = parseData(newVal);
            },
            { immediate: true, deep: true }
        );

        // 监听 FormDiyTableModel 中对应字段的变化
        watch(
            () => props.FormDiyTableModel?.[props.field?.Name],
            (newVal) => {
                if (newVal !== undefined) {
                    tableData.value = parseData(newVal);
                }
            },
            { deep: true }
        );

        onMounted(() => {
            // 初始化数据
            const initialValue = props.modelValue || props.FormDiyTableModel?.[props.field?.Name];
            if (initialValue) {
                tableData.value = parseData(initialValue);
            }
            // 初始化拖拽
            if (!GetFieldReadOnly(props.field)) {
                initSortable();
            }
        });

        return {
            // refs
            jsonTableRef,
            dialogFormRef,
            // data
            searchKeyword,
            tableData,
            dialogVisible,
            dialogMode,
            formModel,
            // computed
            columnConfig,
            filteredTableData,
            // methods
            GetFieldReadOnly,
            GetColumnComponent,
            GetColumnField,
            GetDisplayValue,
            handleSearch,
            handleAdd,
            handleEdit,
            handleDelete,
            handleCellChange,
            handleDialogConfirm,
            // icons
            Search,
            Plus,
            Edit,
            Delete,
            Rank
        };
    }
};
</script>

<style lang="scss" scoped>
.diy-json-table {
    width: 100%;
    
    .json-table-toolbar {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
    }
    
    .json-table-content {
        .drag-handle {
            cursor: move;
            color: #909399;
            
            &:hover {
                color: #409eff;
            }
        }
    }
}
</style>
