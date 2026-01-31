<template>
    <div class="diy-json-table">
        <!-- 工具栏 -->
        <div class="json-table-toolbar" v-if="!GetFieldReadOnly(field)">
            <el-button type="primary" :icon="Plus" @click="handleAdd" style="margin-right: 10px">
                {{ $t('Msg.Add') || '新增' }}
            </el-button>
            <el-input
                v-model="searchKeyword"
                :placeholder="$t('Msg.Search') || '搜索'"
                clearable
                style="width: 200px; margin-right: 10px;"
                @input="handleSearch"
            >
                <template #prefix>
                    <el-icon><Search /></el-icon>
                </template>
            </el-input>
            <!-- 数据源批量导入 -->
            <template v-if="hasDataSource">
                <el-select
                    v-model="dataSourceSelected"
                    multiple
                    filterable
                    remote
                    :remote-method="loadDataSourceOptions"
                    :loading="dataSourceLoading"
                    placeholder="从数据源选择"
                    style="width: 300px; margin-right: 10px;"
                    :reserve-keyword="true"
                    collapse-tags
                    collapse-tags-tooltip
                    value-key="_dataSourceKey"
                >
                    <el-option
                        v-for="item in dataSourceOptions"
                        :key="item._dataSourceKey"
                        :label="getDataSourceLabel(item)"
                        :value="item"
                    />
                </el-select>
                <el-button type="success" :icon="Download" @click="handleBatchAdd" v-if="!dataSourceSelected || dataSourceSelected.length === 0">
                    批量添加
                </el-button>
            </template>
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
                    <!-- 复杂组件显示编辑按钮 -->
                    <template v-if="isComplexComponent(col.Component)">
                        <el-button 
                            v-if="!GetFieldReadOnly(field)"
                            link 
                            type="primary" 
                            :icon="Edit" 
                            @click="openComplexEditor(scope.row, col)"
                        >
                            编辑{{ getCodeLength(scope.row[col.Key]) }}
                        </el-button>
                        <span v-else class="complex-preview">{{ getComplexPreview(scope.row[col.Key], col) }}</span>
                    </template>
                    <!-- 普通组件表内编辑 -->
                    <template v-else>
                        <component
                            v-if="!GetFieldReadOnly(field)"
                            :is="GetColumnComponent(col)"
                            v-model="scope.row[col.Key]"
                            :TableInEdit="false"
                            :field="GetColumnField(col)"
                            :FormDiyTableModel="scope.row"
                            :FormMode="'Edit'"
                            :ReadonlyFields="[]"
                            :FieldReadonly="false"
                            @change="handleCellChange(scope.row, col.Key)"
                        />
                        <span v-else>{{ GetDisplayValue(scope.row, col) }}</span>
                    </template>
                </template>
            </el-table-column>

            <!-- 操作列 -->
            <el-table-column v-if="!GetFieldReadOnly(field)" :label="$t('Msg.Operation') || '操作'" width="80" align="center" fixed="right">
                <template #default="scope">
                    <el-popconfirm
                        title="确定要删除这条数据吗？"
                        confirm-button-text="确定"
                        cancel-button-text="取消"
                        @confirm="handleDelete(scope.$index)"
                    >
                        <template #reference>
                            <el-button link type="danger" :icon="Delete">
                                {{ $t('Msg.Delete') || '删除' }}
                            </el-button>
                        </template>
                    </el-popconfirm>
                </template>
            </el-table-column>
        </el-table>

        <!-- JSON表格列配置弹窗 -->
        <el-dialog
            v-model="configDialogVisible"
            title="JSON表格列配置"
            width="900px"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
        >
            <div class="json-table-config">
                <el-table :data="configColumns" border stripe style="width: 100%" size="small" max-height="400">
                    <el-table-column type="index" label="序号" width="55" align="center" />
                    <el-table-column label="列名称" min-width="100">
                        <template #default="scope">
                            <el-input v-model="scope.row.Label" placeholder="列名称" size="small" />
                        </template>
                    </el-table-column>
                    <el-table-column label="字段Key" min-width="100">
                        <template #default="scope">
                            <el-input v-model="scope.row.Key" placeholder="字段Key" size="small" />
                        </template>
                    </el-table-column>
                    <el-table-column label="组件类型" width="140">
                        <template #default="scope">
                            <el-select v-model="scope.row.Component" placeholder="组件" size="small" filterable>
                                <el-option-group label="基础输入">
                                    <el-option label="文本输入" value="Text" />
                                    <el-option label="数字输入" value="Number" />
                                    <el-option label="多行文本" value="Textarea" />
                                    <el-option label="密码输入" value="Password" />
                                </el-option-group>
                                <el-option-group label="选择类">
                                    <el-option label="下拉选择" value="Select" />
                                    <el-option label="多选下拉" value="MultipleSelect" />
                                    <el-option label="单选框" value="Radio" />
                                    <el-option label="复选框" value="Checkbox" />
                                    <el-option label="开关" value="Switch" />
                                    <el-option label="级联选择" value="Cascader" />
                                    <el-option label="树形选择" value="SelectTree" />
                                </el-option-group>
                                <el-option-group label="日期时间">
                                    <el-option label="日期时间" value="DateTime" />
                                </el-option-group>
                                <el-option-group label="特殊输入">
                                    <el-option label="评分" value="Rate" />
                                    <el-option label="颜色选择" value="ColorPicker" />
                                    <el-option label="进度条" value="Progress" />
                                    <el-option label="自动编号" value="AutoNumber" />
                                    <el-option label="自动完成" value="Autocomplete" />
                                </el-option-group>
                                <el-option-group label="地址相关">
                                    <el-option label="地址选择" value="Address" />
                                    <el-option label="部门选择" value="Department" />
                                    <el-option label="地图选点" value="Map" />
                                </el-option-group>
                                <el-option-group label="文件相关">
                                    <el-option label="图片上传" value="ImgUpload" />
                                    <el-option label="文件上传" value="FileUpload" />
                                </el-option-group>
                                <el-option-group label="复杂组件(弹窗编辑)">
                                    <el-option label="富文本编辑" value="RichText" />
                                    <el-option label="代码编辑器" value="CodeEditor" />
                                    <el-option label="HTML展示" value="Html" />
                                </el-option-group>
                                <el-option-group label="展示类">
                                    <el-option label="图标选择" value="Fontawesome" />
                                    <el-option label="二维码" value="Qrcode" />
                                    <el-option label="分割线" value="Divider" />
                                    <el-option label="按钮" value="Button" />
                                </el-option-group>
                            </el-select>
                        </template>
                    </el-table-column>
                    <el-table-column label="列宽度" width="85">
                        <template #default="scope">
                            <el-input-number v-model="scope.row.MinWidth" :min="60" :max="500" :step="10" size="small" controls-position="right" style="width: 100%" />
                        </template>
                    </el-table-column>
                    <el-table-column label="必填" width="50" align="center">
                        <template #default="scope">
                            <el-checkbox v-model="scope.row.Required" />
                        </template>
                    </el-table-column>
                    <el-table-column label="操作" width="60" align="center">
                        <template #default="scope">
                            <el-button :icon="Delete" type="danger" link @click="deleteConfigColumn(scope.$index)" />
                        </template>
                    </el-table-column>
                </el-table>
                <div style="margin-top: 10px">
                    <el-button :icon="Plus" type="primary" @click="addConfigColumn">添加列</el-button>
                </div>
                
                <!-- 批量导入数据源配置 -->
                <el-divider content-position="left"><el-icon><Download /></el-icon> 批量导入数据源配置</el-divider>
                <el-form :inline="false" size="small" label-width="100px">
                    <el-form-item label="数据源类型">
                        <el-radio-group v-model="configDataSource.type">
                            <el-radio value="">不使用</el-radio>
                            <el-radio value="Sql">Sql数据源</el-radio>
                            <el-radio value="DataSource">数据源引擎</el-radio>
                            <el-radio value="ApiEngine">接口引擎</el-radio>
                        </el-radio-group>
                    </el-form-item>
                    <el-form-item v-if="configDataSource.type === 'Sql'" label="SQL语句">
                        <el-input 
                            v-model="configDataSource.sql" 
                            type="textarea" 
                            :rows="3" 
                            placeholder="SELECT Id, Name FROM TableName WHERE Name LIKE '%$Keyword$%' LIMIT 0,20"
                        />
                    </el-form-item>
                    <el-form-item v-if="configDataSource.type === 'DataSource'" label="数据源引擎">
                        <el-input v-model="configDataSource.dataSourceId" placeholder="请输入数据源ID" />
                    </el-form-item>
                    <el-form-item v-if="configDataSource.type === 'ApiEngine'" label="接口引擎Key">
                        <el-input v-model="configDataSource.apiEngineKey" placeholder="请输入接口引擎Key" />
                    </el-form-item>
                    <el-form-item v-if="configDataSource.type" label="显示字段">
                        <el-input v-model="configDataSource.labelField" placeholder="如: Name" style="width: 150px" />
                    </el-form-item>
                </el-form>

                <!-- Select/MultipleSelect 数据源配置 -->
                <template v-for="(col, colIndex) in configColumns.filter(c => c.Component === 'Select' || c.Component === 'MultipleSelect' || c.Component === 'Radio' || c.Component === 'Checkbox')" :key="'select_config_' + colIndex">
                    <el-divider content-position="left">【{{ col.Label || col.Key }}】下拉数据源配置</el-divider>
                    <el-form :inline="true" size="small">
                        <el-form-item label="显示字段">
                            <el-input v-model="col.Config.SelectLabel" placeholder="如: label" style="width: 120px" />
                        </el-form-item>
                        <el-form-item label="存储字段">
                            <el-input v-model="col.Config.SelectSaveField" placeholder="如: value" style="width: 120px" />
                        </el-form-item>
                    </el-form>
                    <el-input 
                        v-model="col.DataString" 
                        type="textarea" 
                        :rows="2" 
                        placeholder='数据源JSON，如：[{"label":"选项1","value":"1"},{"label":"选项2","value":"2"}]'
                        @blur="parseConfigColData(col)"
                    />
                </template>
            </div>
            <template #footer>
                <el-button @click="configDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="saveConfig">确定</el-button>
            </template>
        </el-dialog>

        <!-- 复杂组件编辑弹窗 -->
        <el-dialog
            v-model="complexEditorVisible"
            :title="'编辑 - ' + (complexEditorCol?.Label || '')"
            width="80%"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
            class="complex-editor-dialog ltr-dialog"
        >
            <div class="complex-editor-content ltr-content">
                <component
                    v-if="complexEditorVisible && complexEditorCol"
                    :is="GetColumnComponent(complexEditorCol)"
                    v-model="complexEditorValue"
                    :TableInEdit="false"
                    :field="GetColumnField(complexEditorCol)"
                    :FormDiyTableModel="{}"
                    :FormMode="'Edit'"
                    :ReadonlyFields="[]"
                    :FieldReadonly="false"
                />
            </div>
            <template #footer>
                <el-button @click="complexEditorVisible = false">取消</el-button>
                <el-button type="primary" @click="saveComplexEditor">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import { ref, computed, watch, onMounted, getCurrentInstance, nextTick } from 'vue';
import { Search, Plus, Delete, Rank, Edit, Setting, Download } from '@element-plus/icons-vue';
import Sortable from 'sortablejs';

export default {
    name: 'diy-jsontable',
    inheritAttrs: false,
    components: {
        Search,
        Plus,
        Delete,
        Rank,
        Edit,
        Setting,
        Download
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
        const DiyApi = proxy.DiyApi;

        // ==================== 响应式数据 ====================
        const jsonTableRef = ref(null);
        const searchKeyword = ref('');
        
        // 表格数据
        const tableData = ref([]);

        // 配置弹窗相关
        const configDialogVisible = ref(false);
        const configColumns = ref([]);
        // 批量导入数据源配置
        const configDataSource = ref({
            type: '',
            sql: '',
            dataSourceId: '',
            apiEngineKey: '',
            labelField: ''
        });

        // 复杂组件编辑弹窗相关
        const complexEditorVisible = ref(false);
        const complexEditorRow = ref(null);
        const complexEditorCol = ref(null);
        const complexEditorValue = ref('');

        // 复杂组件列表（需要弹窗编辑的）
        const complexComponents = ['RichText', 'CodeEditor', 'Html'];

        // 数据源批量导入相关
        const dataSourceSelected = ref([]);
        const dataSourceOptions = ref([]);
        const dataSourceLoading = ref(false);

        // ==================== 计算属性 ====================
        
        // 判断是否有数据源配置（从 JsonTable 配置中读取）
        const hasDataSource = computed(() => {
            const jsonTableConfig = props.field?.Config?.JsonTable;
            if (!jsonTableConfig) return false;
            // 检查是否配置了数据源类型
            return jsonTableConfig.DataSource === 'Sql' || 
                   jsonTableConfig.DataSource === 'DataSource' || 
                   jsonTableConfig.DataSource === 'ApiEngine';
        });

        // 获取数据源显示字段
        const getDataSourceLabelField = () => {
            return props.field?.Config?.JsonTable?.SelectLabel || 'label';
        };

        // 获取数据源显示文本
        const getDataSourceLabel = (item) => {
            const labelField = getDataSourceLabelField();
            return item[labelField] || JSON.stringify(item);
        };

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

        // 判断是否是复杂组件
        const isComplexComponent = (component) => {
            return complexComponents.includes(component);
        };

        // 获取代码长度显示文本
        const getCodeLength = (value) => {
            if (!value) return '';
            const len = String(value).length;
            return len > 0 ? `(${len})` : '';
        };

        // 获取复杂组件预览文本
        const getComplexPreview = (value, col) => {
            if (!value) return '(空)';
            const str = String(value);
            if (str.length > 30) {
                return str.substring(0, 30) + '...';
            }
            return str;
        };

        // 根据列配置获取组件名称
        const GetColumnComponent = (col) => {
            const componentMap = {
                'Text': 'DiyInput',
                'Input': 'DiyInput',
                'Guid': 'DiyInput',
                'Password': 'DiyInput',
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
                'ColorPicker': 'DiyColorPicker',
                'Progress': 'DiyProgress',
                'AutoNumber': 'DiyAutoNumber',
                'Autocomplete': 'DiyAutocomplete',
                'Cascader': 'DiyCascader',
                'SelectTree': 'DiySelectTree',
                'Address': 'DiyAddress',
                'Department': 'DiyDepartment',
                'Map': 'DiyMap',
                'ImgUpload': 'DiyImgUpload',
                'FileUpload': 'DiyFileUpload',
                'RichText': 'DiyRichText',
                'CodeEditor': 'DiyCodeEditor',
                'Html': 'DiyHtml',
                'Fontawesome': 'DiyFontawesome',
                'Qrcode': 'DiyQrcode',
                'Divider': 'DiyDivider',
                'Button': 'DiyButton'
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

        // 新增 - 直接在表内添加新行
        const handleAdd = () => {
            const newRow = {
                _rowKey: `row_${Date.now()}_${tableData.value.length}`
            };
            // 初始化默认值
            columnConfig.value.forEach(col => {
                newRow[col.Key] = col.DefaultValue !== undefined ? col.DefaultValue : '';
            });
            tableData.value.push(newRow);
            syncToParent();
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

        // ==================== 数据源批量导入 ====================
        
        // 加载数据源选项 - 根据数据源类型调用对应的 API
        const loadDataSourceOptions = async (keyword) => {
            const jsonTableConfig = props.field?.Config?.JsonTable;
            if (!jsonTableConfig || !jsonTableConfig.DataSource) return;
            
            dataSourceLoading.value = true;
            try {
                let apiUrl = '';
                // 确保 formData 是一个有效的对象
                const formData = props.FormDiyTableModel || {};
                let postData = {
                    _FieldId: props.field?.Id || '',
                    _SqlParamValue: formData,
                    _FormData: formData,
                    _Keyword: keyword || ''
                };
                
                if (jsonTableConfig.DataSource === 'Sql') {
                    // SQL 数据源 - 使用 GetDiyFieldSqlData 接口，传入 _FieldId
                    // 后端会根据字段ID读取 Config.Sql 并执行
                    if (!props.field?.Id) {
                        console.warn('JSON表格字段缺少Id，无法加载SQL数据源');
                        dataSourceLoading.value = false;
                        return;
                    }
                    apiUrl = DiyApi.GetDiyFieldSqlData;
                } else if (jsonTableConfig.DataSource === 'DataSource' && jsonTableConfig.DataSourceId) {
                    // 数据源引擎
                    apiUrl = DiyApi.GetDataSourceEngine;
                    postData.DataSourceKey = jsonTableConfig.DataSourceId;
                } else if (jsonTableConfig.DataSource === 'ApiEngine' && jsonTableConfig.ApiEngineKey) {
                    // 接口引擎
                    apiUrl = DiyApi.ApiEngineRun;
                    postData.ApiEngineKey = jsonTableConfig.ApiEngineKey;
                } else {
                    dataSourceLoading.value = false;
                    return;
                }
                
                console.log('loadDataSourceOptions postData:', postData, 'apiUrl:', apiUrl);
                
                const res = await DiyCommon.PostAsync(apiUrl, postData);
                
                if (res && DiyCommon.Result(res, false)) {
                    const resultData = res.Data || [];
                    // 为每条数据添加唯一标识
                    dataSourceOptions.value = resultData.map((item, index) => ({
                        ...item,
                        _dataSourceKey: `ds_${Date.now()}_${index}`
                    }));
                } else {
                    dataSourceOptions.value = [];
                    if (res && res.Code !== 1) {
                        console.warn('加载数据源失败:', res.Msg);
                    }
                }
            } catch (e) {
                console.error('加载数据源失败:', e);
                DiyCommon.Tips('加载数据源失败', false);
                dataSourceOptions.value = [];
            } finally {
                dataSourceLoading.value = false;
            }
        };

        // 批量添加数据
        const handleBatchAdd = () => {
            if (!dataSourceSelected.value || dataSourceSelected.value.length === 0) {
                DiyCommon.Tips('请先选择要添加的数据', false);
                return;
            }
            
            // 获取当前列配置的Key列表
            const columnKeys = columnConfig.value.map(col => col.Key);
            
            // 遍历选中的数据，添加到表格
            dataSourceSelected.value.forEach(item => {
                const newRow = {
                    _rowKey: `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
                // 只添加列配置中存在的字段
                columnKeys.forEach(key => {
                    if (item.hasOwnProperty(key)) {
                        newRow[key] = item[key];
                    } else {
                        // 使用默认值
                        const col = columnConfig.value.find(c => c.Key === key);
                        newRow[key] = col?.DefaultValue !== undefined ? col.DefaultValue : '';
                    }
                });
                tableData.value.push(newRow);
            });
            
            syncToParent();
            dataSourceSelected.value = [];
            DiyCommon.Tips('已添加 ' + dataSourceSelected.value.length + ' 条数据', true);
        };

        // ==================== 复杂组件编辑 ====================
        
        // 打开复杂组件编辑弹窗
        const openComplexEditor = (row, col) => {
            complexEditorRow.value = row;
            complexEditorCol.value = col;
            complexEditorValue.value = row[col.Key] || '';
            complexEditorVisible.value = true;
        };

        // 保存复杂组件编辑
        const saveComplexEditor = () => {
            if (complexEditorRow.value && complexEditorCol.value) {
                complexEditorRow.value[complexEditorCol.value.Key] = complexEditorValue.value;
                syncToParent();
            }
            complexEditorVisible.value = false;
        };

        // ==================== 配置弹窗相关方法 ====================
        
        // 打开配置弹窗
        const openConfig = () => {
            // 初始化配置
            if (!props.field.Config) {
                props.field.Config = {};
            }
            if (!props.field.Config.JsonTable) {
                props.field.Config.JsonTable = { Columns: [] };
            }
            if (!props.field.Config.JsonTable.Columns) {
                props.field.Config.JsonTable.Columns = [];
            }
            // 深拷贝列配置到临时数组
            configColumns.value = JSON.parse(JSON.stringify(props.field.Config.JsonTable.Columns));
            // 确保每列都有Config和DataString
            configColumns.value.forEach(col => {
                if (!col.Config) col.Config = {};
                if (!col.DataString && col.Data && col.Data.length > 0) {
                    col.DataString = JSON.stringify(col.Data);
                }
            });
            // 加载数据源配置
            const jsonTable = props.field.Config.JsonTable;
            configDataSource.value = {
                type: jsonTable.DataSource || '',
                sql: jsonTable.Sql || '',
                dataSourceId: jsonTable.DataSourceId || '',
                apiEngineKey: jsonTable.ApiEngineKey || '',
                labelField: jsonTable.SelectLabel || ''
            };
            configDialogVisible.value = true;
        };

        // 添加配置列
        const addConfigColumn = () => {
            configColumns.value.push({
                Sort: configColumns.value.length + 1,
                Label: '',
                Key: '',
                Component: 'Text',
                Width: '',
                MinWidth: 120,
                Required: false,
                DefaultValue: '',
                Placeholder: '',
                Readonly: false,
                Config: {},
                Data: [],
                DataString: ''
            });
        };

        // 删除配置列
        const deleteConfigColumn = (index) => {
            configColumns.value.splice(index, 1);
        };

        // 解析配置列数据源
        const parseConfigColData = (col) => {
            if (col.DataString) {
                try {
                    col.Data = JSON.parse(col.DataString);
                } catch (e) {
                    DiyCommon.Tips('数据源JSON格式错误', false);
                }
            } else {
                col.Data = [];
            }
        };

        // 保存配置
        const saveConfig = () => {
            // 验证必填项
            for (var i = 0; i < configColumns.value.length; i++) {
                var col = configColumns.value[i];
                if (!col.Label) {
                    DiyCommon.Tips('请输入第' + (i + 1) + '列的列名称', false);
                    return;
                }
                if (!col.Key) {
                    DiyCommon.Tips('请输入第' + (i + 1) + '列的字段Key', false);
                    return;
                }
                // 解析数据源
                if (col.DataString) {
                    try {
                        col.Data = JSON.parse(col.DataString);
                    } catch (e) {
                        DiyCommon.Tips('第' + (i + 1) + '列的数据源JSON格式错误', false);
                        return;
                    }
                }
            }
            // 保存到字段配置
            props.field.Config.JsonTable.Columns = JSON.parse(JSON.stringify(configColumns.value));
            // 保存数据源配置到 JsonTable
            props.field.Config.JsonTable.DataSource = configDataSource.value.type;
            props.field.Config.JsonTable.Sql = configDataSource.value.sql;
            props.field.Config.JsonTable.DataSourceId = configDataSource.value.dataSourceId;
            props.field.Config.JsonTable.ApiEngineKey = configDataSource.value.apiEngineKey;
            props.field.Config.JsonTable.SelectLabel = configDataSource.value.labelField;
            
            // 同时同步数据源配置到 Config 根级别，以便后端 GetDiyFieldSqlData 接口能读取
            // 这样 SQL 类型的数据源也能通过 _FieldId 来查询
            props.field.Config.DataSource = configDataSource.value.type;
            props.field.Config.Sql = configDataSource.value.sql;
            props.field.Config.DataSourceId = configDataSource.value.dataSourceId;
            props.field.Config.DataSourceApiEngineKey = configDataSource.value.apiEngineKey;
            props.field.Config.SelectLabel = configDataSource.value.labelField;
            
            configDialogVisible.value = false;
            DiyCommon.Tips('JSON表格配置已保存', true);
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
            // data
            searchKeyword,
            tableData,
            // 配置弹窗
            configDialogVisible,
            configColumns,
            // 复杂组件编辑
            complexEditorVisible,
            complexEditorRow,
            complexEditorCol,
            complexEditorValue,
            // 数据源批量导入
            dataSourceSelected,
            dataSourceOptions,
            dataSourceLoading,
            // computed
            columnConfig,
            filteredTableData,
            hasDataSource,
            // methods
            GetFieldReadOnly,
            GetColumnComponent,
            GetColumnField,
            GetDisplayValue,
            getDataSourceLabel,
            handleSearch,
            handleAdd,
            handleDelete,
            handleCellChange,
            loadDataSourceOptions,
            handleBatchAdd,
            // 复杂组件
            isComplexComponent,
            getComplexPreview,
            getCodeLength,
            openComplexEditor,
            saveComplexEditor,
            // 配置弹窗
            configDialogVisible,
            configColumns,
            configDataSource,
            openConfig,
            addConfigColumn,
            deleteConfigColumn,
            parseConfigColData,
            saveConfig,
            // icons
            Search,
            Plus,
            Delete,
            Rank,
            Edit,
            Setting,
            Download
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

    .complex-preview {
        color: #909399;
        font-size: 12px;
    }
}

.json-table-config {
    max-height: 70vh;
    overflow-y: auto;
}

.complex-editor-content {
    min-height: 300px;
}

/* LTR 内容强制从左到右显示 */
.ltr-content {
    direction: ltr !important;
    text-align: left !important;
    unicode-bidi: normal !important;
}
</style>

/* 非 scoped 样式，用于修复弹窗内的代码编辑器方向问题 */
<style lang="scss">
.ltr-dialog {
    direction: ltr !important;
    
    .el-dialog__body {
        direction: ltr !important;
        text-align: left !important;
    }
    
    /* Monaco Editor 容器 - 强制 LTR */
    .monaco-container,
    .monaco-editor,
    .monaco-editor * {
        direction: ltr !important;
        text-align: left !important;
        unicode-bidi: embed !important;
    }
    
    /* Monaco Editor 核心输入区域 */
    .monaco-editor .inputarea {
        direction: ltr !important;
        unicode-bidi: embed !important;
        ime-mode: active !important;
    }
    
    /* Monaco Editor 代码行显示 */
    .monaco-editor .view-lines,
    .monaco-editor .lines-content,
    .monaco-editor .view-line,
    .monaco-editor .margin,
    .monaco-editor .line-numbers {
        direction: ltr !important;
        unicode-bidi: embed !important;
    }
    
    /* Monaco Editor 光标定位 */
    .monaco-editor .cursor,
    .monaco-editor .cursor-layer {
        direction: ltr !important;
    }
    
    /* Monaco Editor 滚动条 */
    .monaco-editor .overflow-guard,
    .monaco-editor .scrollbar {
        direction: ltr !important;
    }
}
</style>
