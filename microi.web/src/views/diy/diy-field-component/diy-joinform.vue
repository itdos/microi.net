<template>
    <div class="diy-joinform-wrapper">
        <!-- 友好的未渲染提示 -->
        <div v-if="!shouldRender" class="joinform-not-ready">
            <el-empty description="关联表单未初始化">
                <template #image>
                    <el-icon :size="60" color="#909399">
                        <InfoFilled />
                    </el-icon>
                </template>
                <div class="joinform-tips">
                    <p>该关联表单组件暂未加载</p>
                    <p class="tips-detail">原因可能是：</p>
                    <ul class="tips-list">
                        <li v-if="!field.Config?.JoinForm">未配置关联表单信息</li>
                        <li v-else-if="!isTableDifferent">关联表与当前表相同</li>
                        <li v-else-if="!hasIdOrSearch">缺少关联记录ID或查询条件</li>
                        <li v-else-if="!field.Visible">字段被隐藏</li>
                    </ul>
                    <el-button v-if="showDebugInfo" type="info" size="small" @click="toggleDebugPanel">
                        {{ debugPanelVisible ? '隐藏' : '查看' }}调试信息
                    </el-button>
                    <div v-if="debugPanelVisible" class="debug-panel">
                        <pre>{{ debugInfo }}</pre>
                    </div>
                </div>
            </el-empty>
        </div>
        
        <!-- 实际的关联表单组件 -->
        <DiyFormChildComponent
            v-else
            :ref="joinFormRef => joinFormInstance = joinFormRef"
            :key="renderKey"
            :FormMode="getJoinFormMode()"
            :TableId="(internalConfig || field.Config.JoinForm).TableId"
            :TableName="(internalConfig || field.Config.JoinForm).TableName"
            :TableRowId="(internalConfig || field.Config.JoinForm).Id"
        />
    </div>
    
    <!-- 配置弹窗 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="关联表单配置"
        width="600px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-divider content-position="left">基础配置</el-divider>
            
            <el-form-item label="关联表格">
                <el-select 
                    v-model="configForm.TableId" 
                    placeholder="请选择关联表格"
                    filterable
                    style="width: 100%"
                >
                    <el-option
                        v-for="table in DiyTableList"
                        :key="table.Id"
                        :label="table.Description || table.Name"
                        :value="table.Id"
                    >
                        <span>{{ table.Description || table.Name }}</span>
                        <span style="color: #8492a6; font-size: 13px; margin-left: 8px">{{ table.Name }}</span>
                    </el-option>
                </el-select>
                <div class="form-item-tip">选择要关联的DIY表格</div>
            </el-form-item>
            
            <el-form-item label="关联字段">
                <el-select 
                    v-model="configForm.JoinFieldName" 
                    placeholder="请选择主表字段"
                    filterable
                    style="width: 100%"
                >
                    <el-option
                        v-for="field in ParentFieldList"
                        :key="field.Name"
                        :label="field.Label || field.Name"
                        :value="field.Name"
                    >
                        <span>{{ field.Label || field.Name }}</span>
                        <span style="color: #8492a6; font-size: 13px; margin-left: 8px">{{ field.Name }}</span>
                    </el-option>
                </el-select>
                <div class="form-item-tip">选择主表中用于关联的字段，该字段的值将与关联表的Id进行匹配</div>
            </el-form-item>
            
            <el-form-item label="表单模式">
                <el-radio-group v-model="configForm.FormMode">
                    <el-radio value="Add">新增</el-radio>
                    <el-radio value="Edit">编辑</el-radio>
                    <el-radio value="View">查看</el-radio>
                    <el-radio value="">跟随主表</el-radio>
                </el-radio-group>
                <div class="form-item-tip">选择"跟随主表"将与主表单模式保持一致</div>
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { ref, computed, defineAsyncComponent, getCurrentInstance, watch, nextTick } from "vue";
import { InfoFilled } from '@element-plus/icons-vue';

const DiyFormChildComponent = defineAsyncComponent(() => import("@/views/diy/diy-form"));

// 禁用属性继承
defineOptions({
    inheritAttrs: false
});

const props = defineProps({
    modelValue: {},
    field: {
        type: Object,
        required: true
    },
    FormMode: {
        type: String,
        default: ""
    },
    TableId: {
        type: String,
        default: ""
    },
    TableName: {
        type: String,
        default: ""
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(["update:modelValue"]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;
// GetFieldIsShow 是 mixin 方法，通过 proxy 调用

// 关联表单组件实例引用
const joinFormInstance = ref(null);

// 调试面板状态
const debugPanelVisible = ref(false);
const showDebugInfo = ref(process.env.NODE_ENV === 'development');

// 渲染键，用于强制重新渲染
const renderKey = ref('refJoinForm_' + props.field.Id);

// 组件初始化完成标志
const isInstanceReady = ref(false);

// 待执行的 Init 标志
const pendingInit = ref(false);

// 内部配置覆盖（优先级高于 props.field.Config.JoinForm）
const internalConfig = ref(null);

// 配置弹窗相关
const configDialogVisible = ref(false);
const DiyTableList = ref([]);
const ParentFieldList = ref([]);
const configForm = ref({
    TableId: '',
    JoinFieldName: '',
    FormMode: ''
});

// 日志辅助函数
const log = (message, data) => {
    console.log(`[JoinForm ${props.field.Name}] ${message}`, data || '');
};

const warn = (message, data) => {
    console.warn(`[JoinForm ${props.field.Name}] ${message}`, data || '');
};

// 检查表是否不同
const isTableDifferent = computed(() => {
    // 优先使用内部配置
    const config = internalConfig.value || props.field.Config?.JoinForm;
    if (!config) return false;
    
    // 检查是否配置了非空的表ID或表名
    const hasTableId = !DiyCommon.IsNull(config.TableId) && config.TableId !== '';
    const hasTableName = !DiyCommon.IsNull(config.TableName) && config.TableName !== '';
    
    if (!hasTableId && !hasTableName) {
        // 没有配置表信息，可能是通过 ID 直接关联
        return false;
    }
    
    // 检查配置的表是否与当前表不同
    return (hasTableId && props.TableId && config.TableId !== props.TableId) ||
           (hasTableName && props.TableName && config.TableName !== props.TableName);
});

// 检查是否有ID或搜索条件
const hasIdOrSearch = computed(() => {
    // 优先使用内部配置
    const config = internalConfig.value || props.field.Config?.JoinForm;
    if (!config) return false;
    
    return !DiyCommon.IsNull(config.Id) || (config._SearchEqual && Object.keys(config._SearchEqual).length > 0);
});

// 检查是否应该渲染关联表单
const shouldRender = computed(() => {
    if (props.field.Component != "JoinForm") {
        return false;
    }

    if (!props.field.Config || !props.field.Config.JoinForm) {
        // 如果没有原始配置，检查是否有内部配置
        if (!internalConfig.value) {
            return false;
        }
    }

    // 优先使用内部配置
    const config = internalConfig.value || props.field.Config.JoinForm;
    
    // 优先检查：如果有 ID，就应该渲染（无论 TableId/TableName 是否配置）
    if (!DiyCommon.IsNull(config.Id)) {
        // 有 ID 就渲染，表字段可能在后续动态设置
        return proxy.GetFieldIsShow ? proxy.GetFieldIsShow(props.field) : (DiyCommon.IsNull(props.field.Visible) ? true : props.field.Visible);
    }
    
    // 如果没有 ID，需要检查是否有搜索条件和表配置
    const hasSearchCondition = config._SearchEqual && Object.keys(config._SearchEqual).length > 0;
    
    if (hasSearchCondition && isTableDifferent.value) {
        return proxy.GetFieldIsShow ? proxy.GetFieldIsShow(props.field) : (DiyCommon.IsNull(props.field.Visible) ? true : props.field.Visible);
    }

    return false;
});

// 调试信息
const debugInfo = computed(() => {
    const config = internalConfig.value || props.field.Config?.JoinForm;
    return {
        fieldName: props.field.Name,
        fieldComponent: props.field.Component,
        fieldVisible: props.field.Visible,
        currentTableId: props.TableId,
        currentTableName: props.TableName,
        joinFormConfig: config,
        hasInternalConfig: !!internalConfig.value,
        hasId: !DiyCommon.IsNull(config?.Id),
        hasTableId: !DiyCommon.IsNull(config?.TableId) && config?.TableId !== '',
        hasTableName: !DiyCommon.IsNull(config?.TableName) && config?.TableName !== '',
        isTableDifferent: isTableDifferent.value,
        hasIdOrSearch: hasIdOrSearch.value,
        shouldRender: shouldRender.value,
        renderKey: renderKey.value
    };
});

// 监听关键配置变化，强制重新渲染
watch(
    [
        () => props.field.Config?.JoinForm?.Id,
        () => props.field.Config?.JoinForm?.TableId,
        () => props.field.Config?.JoinForm?.TableName,
        () => internalConfig.value
    ],
    async ([newId, newTableId, newTableName, newInternalConfig], [oldId, oldTableId, oldTableName, oldInternalConfig]) => {
        // 检查是否有实质性的变化
        const idChanged = newId && newId !== oldId;
        const tableIdChanged = newTableId && newTableId !== oldTableId;
        const tableNameChanged = newTableName && newTableName !== oldTableName;
        const internalConfigChanged = newInternalConfig !== oldInternalConfig;
        
        if (idChanged || tableIdChanged || tableNameChanged || internalConfigChanged) {
            log('配置已更新', { 
                id: { old: oldId, new: newId },
                tableId: { old: oldTableId, new: newTableId },
                tableName: { old: oldTableName, new: newTableName },
                internalConfigChanged
            });
            
            // 标记组件未就绪
            isInstanceReady.value = false;
            
            // 更新渲染键强制重新渲染
            renderKey.value = 'refJoinForm_' + props.field.Id + '_' + Date.now();
            
            // 标记需要在新实例加载后执行 Init
            pendingInit.value = true;
            
            // 等待新实例渲染完成后自动初始化
            await nextTick();
            setTimeout(() => {
                if (joinFormInstance.value && typeof joinFormInstance.value.Init === 'function') {
                    log('新实例已准备，自动执行 Init');
                    isInstanceReady.value = true;
                    pendingInit.value = false;
                    joinFormInstance.value.Init(true);
                } else {
                    warn('新实例尚未准备好，等待外部调用');
                }
            }, 300);
        }
    },
    { immediate: false }
);

const getJoinFormMode = () => {
    // 优先使用内部配置
    const config = internalConfig.value || props.field.Config?.JoinForm;
    if (config) {
        return DiyCommon.IsNull(config.FormMode) ? props.FormMode : config.FormMode;
    }
    return props.FormMode;
};

const toggleDebugPanel = () => {
    debugPanelVisible.value = !debugPanelVisible.value;
};

/**
 * 加载关联表单（内置方法）
 * 使用方式：V8.Field.字段名.LoadJoinForm({ TableId, TableName, Id, FormMode })
 * @param {Object} options - 配置对象
 * @param {string} options.TableId - 表ID（36位UUID）
 * @param {string} options.TableName - 表名（非UUID字符串）
 * @param {string} options.Id - 关联记录的ID
 * @param {string} options.FormMode - 表单模式：'Add' | 'Edit' | 'View'
 */
const LoadJoinForm = async (options) => {
    if (!options || typeof options !== 'object') {
        warn('LoadJoinForm 参数错误：需要配置对象', options);
        DiyCommon.Tips('关联表单参数错误！', false);
        return;
    }
    
    const { TableId, TableName, Id, FormMode } = options;
    
    if (!Id || !FormMode) {
        warn('LoadJoinForm 缺少必要参数', { TableId, TableName, Id, FormMode });
        DiyCommon.Tips('关联表单参数错误：缺少 Id 或 FormMode！', false);
        return;
    }
    
    if (!TableId && !TableName) {
        warn('LoadJoinForm 缺少表标识', { TableId, TableName });
        DiyCommon.Tips('关联表单参数错误：需要 TableId 或 TableName！', false);
        return;
    }
    
    log('LoadJoinForm 被调用', { TableId, TableName, Id, FormMode });
    
    // 创建新配置
    const newConfig = {
        TableName: TableName || '',
        TableId: TableId || '',
        Id: Id,
        FormMode: FormMode,
        _SearchEqual: props.field.Config?.JoinForm?._SearchEqual || {}
    };
    
    // 更新内部配置（触发响应式）
    internalConfig.value = newConfig;
    
    log('内部配置已更新', newConfig);
    
    // 等待响应式更新
    await nextTick();
    
    // 如果组件已渲染，重新初始化
    if (shouldRender.value && joinFormInstance.value && typeof joinFormInstance.value.Init === 'function') {
        log('组件已渲染，执行 Init');
        await joinFormInstance.value.Init(true);
    } else {
        log('等待组件渲染...', { shouldRender: shouldRender.value, hasInstance: !!joinFormInstance.value });
    }
};

// 监听实例变化，标记就绪状态
watch(
    () => joinFormInstance.value,
    (newInstance) => {
        if (newInstance && typeof newInstance.Init === 'function') {
            // 延迟标记为就绪，确保实例完全初始化
            setTimeout(() => {
                isInstanceReady.value = true;
                log('实例已就绪');
            }, 100);
        } else {
            isInstanceReady.value = false;
        }
    },
    { immediate: true }
);

// 获取DIY表格列表
const GetDiyTableList = () => {
    debugger;
    DiyCommon.Post(
        proxy.DiyApi.GetTableData,
        {
            FormEngineKey : 'diy_table'
        },
        (result) => {
            if (DiyCommon.Result(result)) {
                DiyTableList.value = result.Data || [];
            }
        }
    );
};

// 获取父表字段列表（从当前表单的字段列表中获取）
const GetParentFieldList = () => {
    // 从 proxy 获取父表的字段列表
    // 通过 props 可以访问到父表的字段信息
    if (proxy.$parent && proxy.$parent.DiyFieldList) {
        ParentFieldList.value = proxy.$parent.DiyFieldList.filter(field => 
            field.Component !== 'JoinForm' && 
            field.Component !== 'JoinTable' && 
            field.Component !== 'TableChild'
        );
    }
};

// ==================== 配置弹窗相关方法 ====================
const openConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.JoinForm) {
        props.field.Config.JoinForm = {};
    }
    
    configForm.value = {
        TableId: props.field.Config.JoinForm.TableId || '',
        JoinFieldName: props.field.Config.JoinForm.JoinFieldName || '',
        FormMode: props.field.Config.JoinForm.FormMode || ''
    };
    
    // 加载DIY表格列表
    if (DiyTableList.value.length === 0) {
        GetDiyTableList();
    }
    
    // 获取父表字段列表
    GetParentFieldList();
    
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!configForm.value.TableId) {
        DiyCommon.Tips('请选择关联表格！', false);
        return;
    }
    
    if (!configForm.value.JoinFieldName) {
        DiyCommon.Tips('请选择关联字段！', false);
        return;
    }
    
    if (!props.field.Config.JoinForm) {
        props.field.Config.JoinForm = {};
    }
    
    props.field.Config.JoinForm.TableId = configForm.value.TableId;
    props.field.Config.JoinForm.TableName = '';  // 使用TableId时清空TableName
    props.field.Config.JoinForm.JoinFieldName = configForm.value.JoinFieldName;
    props.field.Config.JoinForm.FormMode = configForm.value.FormMode;
    
    // 注意：Id 字段在运行时会从 V8.Form[JoinFieldName] 动态获取
    // 这里不需要保存固定的 Id 值
    
    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
    
    log('配置已保存', props.field.Config.JoinForm);
};

// 暴露方法供父组件调用（转发到内部表单组件）
defineExpose({
    // 配置弹窗方法（供设计模式使用）
    openConfig,
    
    // 加载关联表单的主方法（供 V8.Field 使用）
    LoadJoinForm,
    
    // 转发所有需要的方法到内部组件
    Init: async (...args) => {
        // 如果实例未就绪，等待一段时间
        if (!isInstanceReady.value && shouldRender.value) {
            log('实例未就绪，等待初始化...');
            // 等待最多 2 秒
            let waitCount = 0;
            while (!isInstanceReady.value && waitCount < 20) {
                await new Promise(resolve => setTimeout(resolve, 100));
                waitCount++;
            }
        }
        
        if (joinFormInstance.value && typeof joinFormInstance.value.Init === 'function') {
            log('执行 Init');
            return joinFormInstance.value.Init(...args);
        } else {
            warn('Init 方法不可用，组件可能未渲染', {
                shouldRender: shouldRender.value,
                hasInstance: !!joinFormInstance.value,
                isReady: isInstanceReady.value
            });
            return Promise.resolve();
        }
    },
    FormSubmit: (...args) => {
        if (joinFormInstance.value && typeof joinFormInstance.value.FormSubmit === 'function') {
            return joinFormInstance.value.FormSubmit(...args);
        } else {
            console.warn('JoinForm: FormSubmit 方法不可用，组件可能未渲染');
        }
    },
    Clear: (...args) => {
        if (joinFormInstance.value && typeof joinFormInstance.value.Clear === 'function') {
            return joinFormInstance.value.Clear(...args);
        }
    },
    GetFormData: (...args) => {
        if (joinFormInstance.value && typeof joinFormInstance.value.GetFormData === 'function') {
            return joinFormInstance.value.GetFormData(...args);
        }
        return {};
    },
    SetFormData: (...args) => {
        if (joinFormInstance.value && typeof joinFormInstance.value.SetFormData === 'function') {
            return joinFormInstance.value.SetFormData(...args);
        }
    },
    // 暴露属性访问器
    get FormDiyTableModel() {
        return joinFormInstance.value?.FormDiyTableModel || {};
    },
    // 暴露组件实例供调试
    get _joinFormInstance() {
        return joinFormInstance.value;
    },
    get _shouldRender() {
        return shouldRender.value;
    }
});
</script>

<style scoped>
.diy-joinform-wrapper {
    width: 100%;
    min-height: 200px;
}

.joinform-not-ready {
    padding: 0px;
    background: #f5f7fa;
    border: 1px dashed #dcdfe6;
    border-radius: 4px;
    text-align: center;
}

.joinform-tips {
    margin-top: 20px;
}

.joinform-tips p {
    margin: 10px 0;
    color: #606266;
    font-size: 14px;
}

.tips-detail {
    font-size: 12px;
    color: #909399;
    margin-top: 15px;
}

.tips-list {
    list-style: none;
    padding: 0;
    margin: 10px 0;
    text-align: left;
    display: inline-block;
}

.tips-list li {
    padding: 5px 0;
    color: #f56c6c;
    font-size: 13px;
}

.tips-list li:before {
    content: "• ";
    margin-right: 5px;
}

.debug-panel {
    margin-top: 15px;
    padding: 15px;
    background: #fff;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    text-align: left;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
}

.debug-panel pre {
    margin: 0;
    font-size: 12px;
    color: #303133;
    white-space: pre-wrap;
    word-wrap: break-word;
}
</style>
