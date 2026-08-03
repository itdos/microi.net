<template>
    <DiyTableChildComponent
        v-if="shouldRender"
        :ref="childTableRef => tableChildInstance = childTableRef"
        :TypeFieldName="'refTableChild_' + field.Name"
        :key="'refTableChild_' + field.Id"
        :LoadMode="LoadMode"
        :PropsTableType="'TableChild'"
        :TableChildTableRowId="getTableChildTableRowId()"
        :ContainerClass="'table-child'"
        :TableChildConfig="field.Config.TableChild"
        :TableChildField="field"
        :TableChildTableId="field.Config.TableChildTableId"
        :TableChildSysMenuId="field.Config.TableChildSysMenuId"
        :TableChildFkFieldName="field.Config.TableChildFkFieldName"
        :PrimaryTableFieldName="field.Config.TableChild.PrimaryTableFieldName"
        :TableChildFormMode="FormMode"
        :FatherFormModel="fatherFormModelSnapshot"
        :ParentV8="ParentV8"
        :TableChildData="field.Config.TableChild.Data"
        :SearchAppend="field.Config.TableChild.SearchAppend"
        :ParentFormLoadFinish="ParentFormLoadFinish"
        :TableChildAuth="childAuthorizationContext"
        @ParentFormSet="handleParentFormSet"
        @CallbackParentFormSubmit="handleCallbackParentFormSubmit"
        @CallbakRefreshChildTable="handleCallbakRefreshChildTable"
        @CallbackShowTableChildHideField="handleCallbackShowTableChildHideField"
    />
    
    <!-- 配置弹窗 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="子表配置"
        draggable
        align-center
        width="70%"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="180px" label-position="left" size="small" :inline="true">
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
                            {{ configForm.TableChildSysMenuName || '请选择模块' }}
                        </el-button>
                    </template>
                </el-popover>
            </el-form-item>
            
            <el-form-item label="关联主表列名（默认Id）">
                <el-input v-model="configForm.PrimaryTableFieldName" placeholder="Id" />
            </el-form-item>
            
            <el-form-item label="关联子表列名">
                <el-input v-model="configForm.TableChildFkFieldName" placeholder="请输入子表外键列名" />
            </el-form-item>

            <el-form-item label="导入自动补齐外键">
                <el-switch v-model="configForm.ImportAutoFillFk" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
            
            
            
            <el-form-item label="上级模块（选填）">
                <el-popover placement="bottom" trigger="click" :width="400">
                    <el-tree 
                        :data="SysMenuList" 
                        node-key="Id" 
                        :props="{ label: 'Name', children: '_Child' }" 
                        @node-click="handleLastModuleSelect" 
                    />
                    <template #reference>
                        <el-button style="width: 100%">
                            {{ configForm.LastSysMenuName || '请选择（用于嵌套子表）' }}
                        </el-button>
                    </template>
                </el-popover>
            </el-form-item>
            
            <el-form-item label="关闭分页">
                <el-switch v-model="configForm.DisablePagination" active-color="#ff6c04" inactive-color="#ccc" />
            </el-form-item>
            <el-form-item label="主子表字段关系" :label-position="'top'"  style="display: block;">
                <DiyCodeEditor
                        v-model="configForm.FieldRelations"
                        :field="{ Id: 'TableChildFieldRelations', Name: 'TableChildFieldRelations' }"
                        :height="'300px'"
                    />
                <div class="form-item-tip">格式：[["Code","XiangmuBM",true],["Name","XiangmuMC"]]。每项依次为“主表列、子表列、是否参与导入匹配”；只有用于反查父表的关系才在第三位填写 true，全部关系都会用于新增回写和导入回填。</div>
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
import {
    getTableChildFieldRelations,
    normalizeTableChildFieldRelations,
    toCompactTableChildRelations
} from "@/utils/table-child-relations.js";

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
    TableRowId: {
        type: String,
        default: ""
    },
    TableId: {
        type: String,
        default: ""
    },
    SysMenuId: {
        type: String,
        default: ""
    },
    TableChildAuth: {
        type: Object,
        default: null
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    },
    ParentV8: {
        type: Object,
        default: () => ({})
    },
    ParentFormLoadFinish: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    "update:modelValue",
    "ParentFormSet",
    "CallbackParentFormSubmit",
    "CallbakRefreshChildTable",
    "CallbackShowTableChildHideField"
]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

// 模拟老版本 FormDiyTableModelListen：返回浅拷贝以触发子组件 FatherFormModel watcher
const fatherFormModelSnapshot = computed(() => {
    // 支持自定义父级 model（如点击A子表一行数据，更新B子表数据）
    if (!DiyCommon.IsNull(props.field._ParentFormModel)) {
        return Object.assign({}, { ...props.field._ParentFormModel });
    }
    return Object.assign({}, { ...props.FormDiyTableModel });
});

// The browser supplies only relationship hints. The server reloads the field,
// both menus and both tables, checks the parent row scope, and then forces the
// child foreign-key filter. Parent preserves the chain for nested TableChild.
const childAuthorizationContext = computed(() => ({
    ParentSysMenuId: props.SysMenuId || "",
    ParentTableId: props.TableId || "",
    ParentFieldId: props.field && props.field.Id ? props.field.Id : "",
    ParentRowId: props.FormDiyTableModel && props.FormDiyTableModel.Id
        ? props.FormDiyTableModel.Id
        : props.TableRowId || "",
    ParentValue: getTableChildTableRowId() || "",
    ParentFormMode: props.FormMode || "",
    Parent: props.TableChildAuth || null
}));

// 子表组件实例引用
const tableChildInstance = ref(null);

// 配置弹窗相关
const configDialogVisible = ref(false);
const SysMenuList = ref([]);
const configForm = ref({
    TableChildSysMenuId: '',
    TableChildSysMenuName: '',
    TableChildTableId: '',
    PrimaryTableFieldName: '',
    TableChildFkFieldName: '',
    ImportAutoFillFk: true,
    FieldRelations: '[]',
    LastSysMenuId: '',
    LastSysMenuName: '',
    LastTableId: '',
    DisablePagination: false
});

// 获取系统菜单列表
const GetSysMenuList = () => {
    DiyCommon.Post(
        proxy.DiyApi.GetSysMenuStep(),
        {
            _SelectFields : [ "Id", "Name", "Icon", "IconClass", "Display", "AppDisplay", "IsMicroiService", "OpenType", "ComponentName", "ComponentPath", "PageTemplate", "Url", "DiyTableId", "ParentId", "Sort"],
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
        configForm.value.TableChildSysMenuId = data.Id;
        configForm.value.TableChildSysMenuName = data.Name;
        configForm.value.TableChildTableId = data.DiyTableId;
    }
};

// 上级模块选择处理
const handleLastModuleSelect = (data) => {
    if (data.OpenType == "Diy" && !DiyCommon.IsNull(data.DiyTableId)) {
        configForm.value.LastSysMenuId = data.Id;
        configForm.value.LastSysMenuName = data.Name;
        configForm.value.LastTableId = data.DiyTableId;
    }
};

// 检查是否应该渲染子表
const shouldRender = computed(() => {
    // 设计模式下，只要配置了子表信息就显示（用于预览）
    if (props.LoadMode === 'Design') {
        return (
            props.field.Component == "TableChild" &&
            !DiyCommon.IsNull(props.field.Config.TableChildTableId) &&
            !DiyCommon.IsNull(props.field.Config.TableChildSysMenuId) &&
            GetFieldIsShow(props.field)
        );
    }
    // 正常模式下，需要有 TableRowId 才能显示
    return (
        props.field.Component == "TableChild" &&
        !DiyCommon.IsNull(props.field.Config.TableChildTableId) &&
        !DiyCommon.IsNull(props.field.Config.TableChildSysMenuId) &&
        !DiyCommon.IsNull(props.TableRowId) &&
        GetFieldIsShow(props.field)
    );
});

const GetFieldIsShow = (field) => {
    return DiyCommon.IsNull(field.Visible) ? true : field.Visible;
};

const getTableChildTableRowId = () => {
    // 设计模式下，如果没有真实ID，返回一个模拟ID以便预览
    if (props.LoadMode === 'Design' && DiyCommon.IsNull(props.TableRowId)) {
        return 'design-mode-preview';
    }
    if (props.field.Config.TableChild.PrimaryTableFieldName) {
        return props.FormDiyTableModel[props.field.Config.TableChild.PrimaryTableFieldName];
    }
    return props.TableRowId;
};

const stringifyRelations = (value) => {
    if (typeof value === 'string') {
        return value || '[]';
    }
    try {
        return JSON.stringify(value || [], null, 2);
    } catch (error) {
        return '[]';
    }
};

// 事件转发
const handleParentFormSet = (...args) => {
    emit("ParentFormSet", ...args);
};

const handleCallbackParentFormSubmit = (...args) => {
    emit("CallbackParentFormSubmit", ...args);
};

const handleCallbakRefreshChildTable = (...args) => {
    emit("CallbakRefreshChildTable", ...args);
};

const handleCallbackShowTableChildHideField = (...args) => {
    emit("CallbackShowTableChildHideField", ...args);
};

// ==================== 配置弹窗相关方法 ====================
const openConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.TableChild) {
        props.field.Config.TableChild = {};
    }
    normalizeTableChildFieldRelations(props.field.Config);
    configForm.value = {
        TableChildSysMenuId: props.field.Config.TableChildSysMenuId || '',
        TableChildSysMenuName: props.field.Config.TableChildSysMenuName || '',
        TableChildTableId: props.field.Config.TableChildTableId || '',
        PrimaryTableFieldName: props.field.Config.TableChild.PrimaryTableFieldName || '',
        TableChildFkFieldName: props.field.Config.TableChildFkFieldName || '',
        ImportAutoFillFk: props.field.Config.TableChild.ImportAutoFillFk !== false,
        FieldRelations: stringifyRelations(props.field.Config.TableChild.FieldRelations),
        LastSysMenuId: props.field.Config.TableChild.LastSysMenuId || '',
        LastSysMenuName: props.field.Config.TableChild.LastSysMenuName || '',
        LastTableId: props.field.Config.TableChild.LastTableId || '',
        DisablePagination: props.field.Config.TableChild.DisablePagination || false
    };
    // 加载系统菜单列表
    if (SysMenuList.value.length === 0) {
        GetSysMenuList();
    }
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!props.field.Config.TableChild) {
        props.field.Config.TableChild = {};
    }
    // 保存关联模块信息
    props.field.Config.TableChildSysMenuId = configForm.value.TableChildSysMenuId;
    props.field.Config.TableChildSysMenuName = configForm.value.TableChildSysMenuName;
    props.field.Config.TableChildTableId = configForm.value.TableChildTableId;
    
    // 保存主表列名
    props.field.Config.TableChild.PrimaryTableFieldName = configForm.value.PrimaryTableFieldName;
    
    // 保存子表外键列名
    props.field.Config.TableChildFkFieldName = configForm.value.TableChildFkFieldName;
    
    // 保存导入自动补齐外键配置
    props.field.Config.TableChild.ImportAutoFillFk = configForm.value.ImportAutoFillFk !== false;
    let fieldRelationsValue = configForm.value.FieldRelations;
    try {
        const parsed = DiyCommon.IsNull(fieldRelationsValue) ? [] : JSON.parse(fieldRelationsValue);
        if (!Array.isArray(parsed)) {
            DiyCommon.Tips('主子表字段关系必须是数组格式', false);
            return;
        }
        const relations = getTableChildFieldRelations({ FieldRelations: parsed });
        if (relations.length !== parsed.length) {
            DiyCommon.Tips('主子表字段关系存在空列、无效项或重复项，请检查', false);
            return;
        }
        props.field.Config.TableChild.FieldRelations = toCompactTableChildRelations(relations);
        normalizeTableChildFieldRelations(props.field.Config);
    } catch (error) {
        DiyCommon.Tips('主子表字段关系 JSON 格式错误：' + error.message, false);
        return;
    }
    
    // 保存上级模块信息
    props.field.Config.TableChild.LastSysMenuId = configForm.value.LastSysMenuId;
    props.field.Config.TableChild.LastSysMenuName = configForm.value.LastSysMenuName;
    props.field.Config.TableChild.LastTableId = configForm.value.LastTableId;
    
    // 保存分页设置
    props.field.Config.TableChild.DisablePagination = configForm.value.DisablePagination;
    
    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
};

// 暴露方法供父组件调用（转发到内部子表组件）
defineExpose({
    openConfig,
    // 转发所有需要的方法到内部组件
    RefreshDiyTableRowList: (...args) => tableChildInstance.value?.RefreshDiyTableRowList?.(...args),
    GetNeedSaveRowList: (...args) => tableChildInstance.value?.GetNeedSaveRowList?.(...args),
    ClearNeedSaveRowList: (...args) => tableChildInstance.value?.ClearNeedSaveRowList?.(...args),
    Init: (...args) => tableChildInstance.value?.Init?.(...args),
    Clear: (...args) => tableChildInstance.value?.Clear?.(...args),
    ShowHideFields: (...args) => tableChildInstance.value?.ShowHideFields?.(...args),
    TableSetData: (...args) => tableChildInstance.value?.TableSetData?.(...args),
    // 暴露属性访问器
    get DiyTableRowList() {
        return tableChildInstance.value?.DiyTableRowList || [];
    },
    get DiyFieldList() {
        return tableChildInstance.value?.DiyFieldList || [];
    },
    get TableId() {
        return tableChildInstance.value?.TableId;
    },
    get TableSelectedRow() {
        return tableChildInstance.value?.TableSelectedRow;
    },
    get TableMultipleSelection() {
        return tableChildInstance.value?.TableMultipleSelection || [];
    }
});
</script>
