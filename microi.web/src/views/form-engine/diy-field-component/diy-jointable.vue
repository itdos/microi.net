<template>
    <DiyTableChildComponent
        v-if="shouldRender"
        :TypeFieldName="'refJoinTable_' + field.Name"
        :ref="'refJoinTable_' + field.Name"
        :key="'refJoinTable_' + field.Id"
        :LoadMode="LoadMode"
        :PropsTableType="'JoinTable'"
        :props-is-join-table="true"
        :join-table-field="field"
        :PropsTableId="field.Config.JoinTable.TableId"
        :PropsSysMenuId="field.Config.JoinTable.ModuleId"
        :ContainerClass="'table-child'"
        :PropsWhere="GetPropsSearch(field)"
        :ParentFormLoadFinish="ParentFormLoadFinish"
        @CallbakRefreshChildTable="handleCallbakRefreshChildTable"
    />
    
    <!-- 配置弹窗 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="关联表格配置"
        width="600px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-form-item label="关联模块">
                <el-popover placement="bottom" trigger="click" :width="400">
                    <el-tree 
                        :data="SysMenuList" 
                        node-key="Id" 
                        :props="{ label: 'Name', children: '_Child' }" 
                        @node-click="handleModuleSelect" 
                    />
                    <template #reference>
                        <el-button style="width: 100%">
                            {{ configForm.ModuleName || '请选择模块' }}
                        </el-button>
                    </template>
                </el-popover>
            </el-form-item>
            
            <el-form-item label="搜索条件">
                <el-input 
                    type="textarea" 
                    :rows="5"
                    v-model="configForm.Where" 
                    placeholder='[{ "FieldName": "Status", "ConditionType": "Equal", "FieldValue": "1" }]'
                />
                <div class="form-item-tip">JSON格式的搜索条件数组</div>
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { ref, computed, defineAsyncComponent, getCurrentInstance } from "vue";

const DiyTableChildComponent = defineAsyncComponent(() => import("@/views/form-engine/diy-table"));

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
    LoadMode: {
        type: String,
        default: ""
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    },
    ParentFormLoadFinish: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(["update:modelValue", "CallbakRefreshChildTable"]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

// 配置弹窗相关
const configDialogVisible = ref(false);
const SysMenuList = ref([]);
const configForm = ref({
    TableId: '',
    ModuleId: '',
    ModuleName: '',
    Where: ''
});

// 获取系统菜单列表
const GetSysMenuList = () => {
    DiyCommon.Post(
        proxy.DiyApi.GetSysMenuStep(),
        {
            TableName: "Sys_Menu",
            _OrderBy: "Sort",
            _OrderByType: "ASC"
        },
        (result) => {
            if (DiyCommon.Result(result)) {
                SysMenuList.value = result.Data;
            }
        }
    );
};

// 模块选择处理
const handleModuleSelect = (data) => {
    if (data.OpenType == "Diy" && !DiyCommon.IsNull(data.DiyTableId)) {
        configForm.value.TableId = data.DiyTableId;
        configForm.value.ModuleId = data.Id;
        configForm.value.ModuleName = data.Name;
    }
};

// 检查是否应该渲染关联表格
const shouldRender = computed(() => {
    return (
        props.field.Component == "JoinTable" &&
        props.field.Config &&
        props.field.Config.JoinTable &&
        props.field.Config.JoinTable.TableId &&
        GetFieldIsShow(props.field)
    );
});

const GetFieldIsShow = (field) => {
    return DiyCommon.IsNull(field.Visible) ? true : field.Visible;
};

const GetPropsSearch = (field) => {
    if (field.Config.JoinTable.Where) {
        try {
            return JSON.parse(field.Config.JoinTable.Where);
        } catch (error) {
            return [];
        }
    }
    return [];
};

// 事件转发
const handleCallbakRefreshChildTable = (...args) => {
    emit("CallbakRefreshChildTable", ...args);
};

// ==================== 配置弹窗相关方法 ====================
const openConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.JoinTable) {
        props.field.Config.JoinTable = {};
    }
    configForm.value = {
        TableId: props.field.Config.JoinTable.TableId || '',
        ModuleId: props.field.Config.JoinTable.ModuleId || '',
        ModuleName: props.field.Config.JoinTable.ModuleName || '',
        Where: props.field.Config.JoinTable.Where || ''
    };
    // 加载系统菜单列表
    if (SysMenuList.value.length === 0) {
        GetSysMenuList();
    }
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!props.field.Config.JoinTable) {
        props.field.Config.JoinTable = {};
    }
    props.field.Config.JoinTable.TableId = configForm.value.TableId;
    props.field.Config.JoinTable.ModuleId = configForm.value.ModuleId;
    props.field.Config.JoinTable.ModuleName = configForm.value.ModuleName;
    props.field.Config.JoinTable.Where = configForm.value.Where;
    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
};

// 暴露方法供父组件调用
defineExpose({
    openConfig
});
</script>
