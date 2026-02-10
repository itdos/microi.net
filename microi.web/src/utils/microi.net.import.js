//-------开发引用 - 异步加载优化版本
import { defineAsyncComponent } from "vue";

// ==================== 核心工具函数（同步加载，体积小且全局需要）====================
import { DosCommon } from "@/utils/dos.common";
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/utils/api.itdos";
import { CodeToText, TextToCode } from "element-china-area-data";

// ==================== 异步加载的组件定义 ====================
// 核心视图组件（登录后才需要）
const DiyTable = defineAsyncComponent(() => import("@/views/form-engine/diy-table"));
const DiyForm = defineAsyncComponent(() => import("@/views/form-engine/diy-form"));
const DiyFormDialog = defineAsyncComponent(() => import("@/views/form-engine/diy-form-full"));
const DiyDesign = defineAsyncComponent(() => import("@/views/form-engine/diy-design"));
const DiyFormPage = defineAsyncComponent(() => import("@/views/form-engine/diy-form-full"));
const DiyDesignList = defineAsyncComponent(() => import("@/views/form-engine/diy-table"));
const DiyCustomDialog = defineAsyncComponent(() => import("@/views/form-engine/diy-custom-dialog"));
const DiySearch = defineAsyncComponent(() => import("@/views/form-engine/diy-search"));

// 聊天模块
const DiyChat = defineAsyncComponent(() => import("@/views/chat/index"));

// 工作流模块
const DiyFlowDesign = defineAsyncComponent(() => import("@/views/workflow/flow-design"));
const WFWorkHandler = defineAsyncComponent(() => import("@/views/workflow/wf-work-handler"));
const WFHistory = defineAsyncComponent(() => import("@/views/workflow/component/workflow-history"));
const WFDesignPreview = defineAsyncComponent(() => import("@/views/workflow/component/designer-preview"));
const DiyMyWork = defineAsyncComponent(() => import("@/views/workflow/my-work"));
const DiyFlowIndex = defineAsyncComponent(() => import("@/views/workflow/index"));
const DiyFormWF = defineAsyncComponent(() => import("@/views/workflow/diy-form-wf"));
const CustomFormWF = defineAsyncComponent(() => import("@/views/workflow/custom-form-wf"));
const nodeColConfig = defineAsyncComponent(() => import("@/views/workflow/component/node-col-config.vue"));

// ==================== 表单字段组件（使用时才加载）====================
const DiyInput = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-input"));
const DiyText = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-input.vue"));
const DiyGuid = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-input.vue"));
const DiyAutocomplete = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-autocomplete"));
const DiyCascader = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-cascader"));
const DiyAddress = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-address.vue"));
const DiySelectTree = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-select-tree"));
const DiyDepartment = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-department"));
const DiyFontawesome = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-fontawesome"));
const DiyFontAwesome = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-fontawesome.vue"));
const DiySwitch = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-switch"));
const DiySelect = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-select"));
const DiyMultipleSelect = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-select"));
const DiyRadio = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-radio"));
const DiyProgress = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-progress.vue"));
const DiyCheckbox = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-checkbox.vue"));
const DiyInputNumber = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-input-number"));
const DiyNumberText = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-input-number"));
const DiyDateTime = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-datetime"));
const DiyTextarea = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-textarea"));
const DiyRate = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-rate.vue"));
const DiyColorPicker = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-colorpicker.vue"));
const DiyAutoNumber = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-autonumber.vue"));
const DiyButton = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-button.vue"));
const DiyFileUpload = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-fileupload.vue"));
const DiyImgUpload = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-imgupload.vue"));
const DiyDivider = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-divider.vue"));
const DiyHtml = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-html.vue"));
const DiyRichText = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-richtext.vue"));
const DiyOpenTable = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-opentable.vue"));
const DiyMap = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-map.vue"));
const DiyQrcode = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-qrcode.vue"));
const DiyDevComponent = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-devcomponent.vue"));
const DiyTableChild = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-tablechild.vue"));
const DiyJoinTable = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-jointable.vue"));
const DiyJoinForm = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-joinform.vue"));
const DiyV8TmpEngine = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-v8tmpengine.vue"));
const DiyJsonTable = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-jsontable.vue"));
const DiyTreeCheckbox = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-treecheckbox.vue"));
const Fontawesome = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/dos.fontawesome/Fontawesome.vue"));
const DiyCodeEditor = defineAsyncComponent(() => import("@/views/form-engine/diy-field-component/diy-code-editor.vue"));

// ==================== DIY组件（diy-components）====================
const DiyLoadNonDiyTable = defineAsyncComponent(() => import("@/views/form-engine/diy-components/DiyLoadNonDiyTable.vue"));

// ==================== 富文本编辑器（延迟加载，体积较大）====================
// wangeditor CSS 单独导入（可考虑在需要时才导入）
const loadWangEditorStyles = () => import("@wangeditor/editor/dist/css/style.css");
const Editor = defineAsyncComponent(async () => {
    await loadWangEditorStyles();
    const module = await import("@wangeditor/editor-for-vue");
    return module.Editor;
});
const Toolbar = defineAsyncComponent(async () => {
    await loadWangEditorStyles();
    const module = await import("@wangeditor/editor-for-vue");
    return module.Toolbar;
});

// ==================== 定制组件 ====================
const LoudongTestComponent = defineAsyncComponent(() => import("@/views/custom/test/loudong"));

// ==================== 注册组件函数 ====================
// 参数 app 是 Vue 3 的应用实例（createApp 返回值）
function RegMicroiComponents(app) {
    // 全局属性（替代 Vue.prototype）
    app.config.globalProperties.DosCommon = DosCommon;
    app.config.globalProperties.DiyCommon = DiyCommon;
    app.config.globalProperties.DiyApi = DiyApi;
    app.config.globalProperties.CodeToText = CodeToText;
    app.config.globalProperties.TextToCode = TextToCode;

    // 注册全局组件（全部使用异步组件）
    // 核心视图组件
    app.component("DiyDesign", DiyDesign);
    app.component("DiyTable", DiyTable);
    app.component("DiyForm", DiyForm);
    app.component("DiyFormDialog", DiyFormDialog);
    app.component("DiyFormPage", DiyFormPage);
    app.component("DiyDesignList", DiyDesignList);
    app.component("DiyCustomDialog", DiyCustomDialog);
    app.component("DiySearch", DiySearch);

    // 聊天模块
    app.component("DiyChat", DiyChat);

    // 工作流模块
    app.component("DiyFlowDesign", DiyFlowDesign);
    app.component("DiyMyWork", DiyMyWork);
    app.component("DiyFlowIndex", DiyFlowIndex);
    app.component("DiyFormWF", DiyFormWF);
    app.component("CustomFormWF", CustomFormWF);
    app.component("WFWorkHandler", WFWorkHandler);
    app.component("WFHistory", WFHistory);
    app.component("WFDesignPreview", WFDesignPreview);
    app.component("NodeColConfig", nodeColConfig);

    // 表单字段组件
    app.component("DiyInput", DiyInput);
    app.component("DiyText", DiyText);
    app.component("DiyGuid", DiyGuid);
    app.component("DiyAutocomplete", DiyAutocomplete);
    app.component("DiyCascader", DiyCascader);
    app.component("DiyAddress", DiyAddress);
    app.component("DiySelectTree", DiySelectTree);
    app.component("DiyDepartment", DiyDepartment);
    app.component("DiyFontawesome", DiyFontawesome);
    app.component("DiyFontAwesome", DiyFontAwesome);
    app.component("DiySwitch", DiySwitch);
    app.component("DiySelect", DiySelect);
    app.component("DiyMultipleSelect", DiyMultipleSelect);
    app.component("DiyRadio", DiyRadio);
    app.component("DiyProgress", DiyProgress);
    app.component("DiyCheckbox", DiyCheckbox);
    app.component("DiyInputNumber", DiyInputNumber);
    app.component("DiyNumberText", DiyNumberText);
    app.component("DiyDateTime", DiyDateTime);
    app.component("DiyTextarea", DiyTextarea);
    app.component("DiyRate", DiyRate);
    app.component("DiyColorPicker", DiyColorPicker);
    app.component("DiyAutoNumber", DiyAutoNumber);
    app.component("DiyButton", DiyButton);
    app.component("DiyFileUpload", DiyFileUpload);
    app.component("DiyImgUpload", DiyImgUpload);
    app.component('DiyDivider', DiyDivider);
    app.component('DiyHtml', DiyHtml);
    app.component('DiyRichText', DiyRichText);
    app.component('DiyOpenTable', DiyOpenTable);
    app.component('DiyMap', DiyMap);
    app.component('DiyQrcode', DiyQrcode);
    app.component('DiyDevComponent', DiyDevComponent);
    app.component('DiyTableChild', DiyTableChild);
    app.component('DiyJoinTable', DiyJoinTable);
    app.component('DiyJoinForm', DiyJoinForm);
    app.component('DiyV8TmpEngine', DiyV8TmpEngine);
    app.component('DiyJsonTable', DiyJsonTable);
    app.component('DiyTreeCheckbox', DiyTreeCheckbox);
    app.component("Fontawesome", Fontawesome);
    app.component("DiyCodeEditor", DiyCodeEditor);

    // DIY组件
    app.component("DiyLoadNonDiyTable", DiyLoadNonDiyTable);

    // 富文本编辑器
    app.component("Editor", Editor);
    app.component("Toolbar", Toolbar);

    // 定制组件
    app.component("LoudongTestComponent", LoudongTestComponent);
}

// ==================== 导出 ====================
export {
    RegMicroiComponents,
    // 工具函数（同步导出）
    DosCommon,
    DiyCommon,
    DiyApi,
    // 异步组件（需要时再 resolve）
    DiyDesign,
    DiyTable,
    DiyForm,
    DiyFormDialog,
    DiyFormPage,
    DiyChat,
    DiyFlowDesign,
    DiyMyWork,
    DiyFlowIndex,
    DiyDesignList,
    DiyFormWF,
    CustomFormWF,
    WFWorkHandler,
    WFHistory,
    WFDesignPreview,
    DiyInput,
    DiyText,
    DiyGuid,
    DiyAutocomplete,
    DiyCascader,
    DiyAddress,
    DiySelectTree,
    DiyDepartment,
    DiyFontawesome,
    DiySwitch,
    DiySelect,
    DiyMultipleSelect,
    DiyRadio,
    DiyProgress,
    DiyCheckbox,
    DiyInputNumber,
    DiyNumberText,
    DiyDateTime,
    DiyTextarea,
    DiyCustomDialog,
    Fontawesome,
    DiyCodeEditor,
    DiyLoadNonDiyTable
};
