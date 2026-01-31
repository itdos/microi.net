<template>
    <div>
        <el-button :disabled="FieldReadonly" @click="handleOpenTable">
            {{ DiyCommon.IsNull(field.Config.OpenTable.BtnName) ? "弹出表格" : field.Config.OpenTable.BtnName }}
        </el-button>
        <el-dialog
            v-if="showDialog"
            draggable
            :modal="true"
            :width="'80%'"
            :modal-append-to-body="true"
            :append-to-body="true"
            v-model="showDialog"
            :close-on-click-modal="false"
            :close-on-press-escape="false"
            :destroy-on-close="true"
            :show-close="false"
            class="dialog-opentable"
        >
            <template #header>
                <div style="display: flex;">
                    <div class="pull-left" style="color: rgb(0, 0, 0); font-size: 15px">
                        <fa-icon :icon="'fas fa-table'" />
                        {{ DiyCommon.IsNull(field.Config.OpenTable.BtnName) ? "弹出表格" : field.Config.OpenTable.BtnName }}
                    </div>
                    <div>
                        <el-button :loading="btnLoading" type="primary" :icon="CircleCheck" @click="handleSubmit">
                            {{ t("Msg.Submit") }}
                        </el-button>
                        <el-button :icon="Close" @click="showDialog = false">
                            {{ t("Msg.Close") }}
                        </el-button>
                    </div>
                </div>
            </template>
            <DiyTableChild
                :TypeFieldName="'refOpenTable_' + field.Name"
                :ref="'refOpenTable_' + field.Name"
                :key="'refOpenTable_' + field.Id"
                :LoadMode="LoadMode"
                :PropsTableType="'OpenTable'"
                :PropsTableId="field.Config.OpenTable.TableId"
                :props-table-name="field.Config.OpenTable.TableName"
                :PropsSysMenuId="field.Config.OpenTable.SysMenuId"
                :EnableMultipleSelect="field.Config.OpenTable.MultipleSelect"
                :SearchAppend="field.Config.OpenTable.SearchAppend"
                :PropsWhere="field.Config.OpenTable.PropsWhere"
            />
        </el-dialog>

        <!-- 配置弹窗 - 设计模式下可用 -->
        <el-dialog
            v-if="configDialogVisible"
            v-model="configDialogVisible"
            title="弹出表格配置"
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
                                {{ configForm.SysMenuName || '请选择模块' }}
                            </el-button>
                        </template>
                    </el-popover>
                    <div class="form-item-tip">选择要弹出的表格所属模块</div>
                </el-form-item>
                
                <el-form-item label="按钮名称">
                    <el-input v-model="configForm.BtnName" placeholder="弹出表格" />
                </el-form-item>
                
                <el-form-item label="是否多选">
                    <el-switch v-model="configForm.MultipleSelect" active-color="#ff6c04" inactive-color="#ccc" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="configDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="saveConfig">确定</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
import { ref, computed, getCurrentInstance, defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";
import { CircleCheck, Close } from "@element-plus/icons-vue";

// 异步导入 DiyTableChild 组件
const DiyTableChild = defineAsyncComponent(() => import("@/views/diy/diy-table-rowlist"));

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
    FieldReadonly: {
        type: Boolean,
        default: false
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(["update:modelValue"]);

const { t } = useI18n();
const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

// 本地状态
const showDialog = ref(false);
const btnLoading = ref(false);

// 配置弹窗相关
const configDialogVisible = ref(false);
const SysMenuList = ref([]);
const configForm = ref({
    SysMenuId: '',
    SysMenuName: '',
    TableId: '',
    TableName: '',
    BtnName: '',
    MultipleSelect: false
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
        configForm.value.SysMenuId = data.Id;
        configForm.value.SysMenuName = data.Name;
        configForm.value.TableId = data.DiyTableId;
        configForm.value.TableName = data.TableName || '';
    }
};

// 初始化 field.Config.OpenTable.ShowDialog（如果不存在）
if (!props.field.Config.OpenTable) {
    props.field.Config.OpenTable = {};
}
if (props.field.Config.OpenTable.ShowDialog === undefined) {
    props.field.Config.OpenTable.ShowDialog = false;
}

// 监听 field.Config.OpenTable.ShowDialog 的变化
const unwatchShowDialog = proxy.$watch(
    () => props.field.Config.OpenTable.ShowDialog,
    (newVal) => {
        showDialog.value = newVal;
    },
    { immediate: true }
);

// 监听本地状态，同步到 field.Config
proxy.$watch(
    () => showDialog.value,
    (newVal) => {
        if (props.field.Config.OpenTable) {
            props.field.Config.OpenTable.ShowDialog = newVal;
        }
    }
);

// 辅助函数：设置 V8 默认值
const setV8DefaultValue = (V8) => {
    // 基础信息
    V8.Form = props.FormDiyTableModel;
    V8.Field = props.field;
    V8.FormMode = props.FormMode;
    
    // 常用工具方法
    V8.DiyCommon = DiyCommon;
    V8.Tips = DiyCommon.Tips;
    V8.GetApiBase = DiyCommon.GetApiBase;
    V8.Post = DiyCommon.Post;
    V8.Get = DiyCommon.Get;
    
    return V8;
};

// 辅助函数：设置 OpenTable 的 Where 条件
const openTableSetWhere = (fieldModel, where) => {
    if (fieldModel.Config && fieldModel.Config.OpenTable) {
        fieldModel.Config.OpenTable.PropsWhere = where;
    }
};

// 辅助函数：追加搜索条件
const appendSearchChildTable = (fieldModel, appendSearch) => {
    if (fieldModel.Config && fieldModel.Config.OpenTable) {
        fieldModel.Config.OpenTable.SearchAppend = appendSearch;
    }
};

// 打开表格对话框
const handleOpenTable = async () => {
    const field = props.field;
    
    // 执行弹出前 V8 代码
    const V8 = await DiyCommon.InitV8Code({}, proxy.$router);
    V8.EventName = "OpenTableBefore";
    
    try {
        if (
            !DiyCommon.IsNull(field.Config) &&
            !DiyCommon.IsNull(field.Config.OpenTable) &&
            !DiyCommon.IsNull(field.Config.OpenTable.BeforeOpenV8)
        ) {
            V8.AppendSearchChildTable = appendSearchChildTable;
            V8.OpenTableSetWhere = openTableSetWhere;
            setV8DefaultValue(V8);
            
            await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + field.Config.OpenTable.BeforeOpenV8 + " \n})()");
        }
    } catch (error) {
        DiyCommon.Tips("执行弹出表格弹出前V8引擎代码出现错误[" + field.Name + "," + field.Label + "]：" + error.message, false);
    } finally {
    }
    
    // 打开对话框
    proxy.$nextTick(() => {
        showDialog.value = true;
    });
};

// 提交弹出表格
const handleSubmit = async () => {
    const field = props.field;
    btnLoading.value = true;
    
    const V8 = await DiyCommon.InitV8Code({}, proxy.$router);
    V8.EventName = "OpenTableSubmit";
    
    try {
        if (
            !DiyCommon.IsNull(field.Config) &&
            !DiyCommon.IsNull(field.Config.OpenTable) &&
            !DiyCommon.IsNull(field.Config.OpenTable.SubmitV8)
        ) {
            // 从弹出的表格中获取已经选中的数据
            const refName = "refOpenTable_" + field.Name;
            const tableChildRef = proxy.$refs[refName];
            
            if (tableChildRef) {
                if (field.Config.OpenTable.MultipleSelect === false) {
                    V8.TableRowSelected = tableChildRef.TableSelectedRow;
                } else {
                    V8.TableRowSelected = tableChildRef.TableMultipleSelection;
                }
            }
            
            setV8DefaultValue(V8);
            
            await eval("//" + field.Name + "(" + field.Label + ")" + "\n(async () => {\n " + field.Config.OpenTable.SubmitV8 + " \n})()");
            
            if (V8.Result !== false) {
                showDialog.value = false;
            }
        }
        btnLoading.value = false;
    } catch (error) {
        DiyCommon.Tips("执行弹出表格提交事件V8引擎代码出现错误[" + field.Name + "," + field.Label + "]：" + error.message, false);
        btnLoading.value = false;
    } finally {
    }
};

// 组件卸载时清理
import { onBeforeUnmount } from "vue";
onBeforeUnmount(() => {
    // 清理 watcher
    if (unwatchShowDialog) {
        unwatchShowDialog();
    }
    
    // 清理对话框状态
    showDialog.value = false;
    if (props.field.Config && props.field.Config.OpenTable) {
        props.field.Config.OpenTable.ShowDialog = false;
    }
});

// ==================== 配置弹窗相关方法 ====================
const openConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.OpenTable) {
        props.field.Config.OpenTable = {};
    }
    configForm.value = {
        SysMenuId: props.field.Config.OpenTable.SysMenuId || '',
        SysMenuName: props.field.Config.OpenTable.SysMenuName || '',
        TableId: props.field.Config.OpenTable.TableId || '',
        TableName: props.field.Config.OpenTable.TableName || '',
        BtnName: props.field.Config.OpenTable.BtnName || '',
        MultipleSelect: props.field.Config.OpenTable.MultipleSelect || false
    };
    // 加载系统菜单列表
    if (SysMenuList.value.length === 0) {
        GetSysMenuList();
    }
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!props.field.Config.OpenTable) {
        props.field.Config.OpenTable = {};
    }
    props.field.Config.OpenTable.SysMenuId = configForm.value.SysMenuId;
    props.field.Config.OpenTable.SysMenuName = configForm.value.SysMenuName;
    props.field.Config.OpenTable.TableId = configForm.value.TableId;
    props.field.Config.OpenTable.TableName = configForm.value.TableName;
    props.field.Config.OpenTable.BtnName = configForm.value.BtnName;
    props.field.Config.OpenTable.MultipleSelect = configForm.value.MultipleSelect;
    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
};

// 暴露方法供父组件调用
defineExpose({
    openConfig
});
</script>

<style lang="scss" scoped>
.clear {
    clear: both;
}
.pull-left {
    float: left;
}
.pull-right {
    float: right;
}
.dialog-opentable {
    // z-index:3100 !important;
    :deep(.el-dialog__header,
    .el-dialog__body) {
        padding: 10px;
    }
    :deep(.el-dialog__header) {
        padding-top: 10px;
        padding-bottom: 0px;
    }
    :deep(.el-card__body){
        padding: 0;
    }
    :deep(.el-dialog__body) {
        padding-top: 0px !important;
    }
    .keyword-search,
    .search-outside {
        padding-left: 0px !important;
    }
}
</style>
