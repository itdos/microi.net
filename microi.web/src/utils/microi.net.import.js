//-------开发引用
import { defineAsyncComponent } from "vue";
import DiyTable from "@/views/diy/diy-table-rowlist";
import DiyForm from "@/views/diy/diy-form";
import DiyFormDialog from "@/views/diy/diy-form-dialog";
import DiyChat from "@/views/diy/microi.chat/index";
import DiyFlowDesign from "@/views/diy/workflow/flow-design";
import DiyDesign from "@/views/diy/diy-design";
import WFWorkHandler from "@/views/diy/workflow/wf-work-handler";
import WFHistory from "@/views/diy/workflow/component/workflow-history";
import WFDesignPreview from "@/views/diy/workflow/component/designer-preview";
import { DosCommon } from "@/utils/dos.common";
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/utils/api.itdos";
import DiyModule from "@/views/diy/diy-module";
import DiyFormPage from "@/views/diy/diy-form-page";
import DiyMyWork from "@/views/diy/workflow/my-work";
import DiyFlowIndex from "@/views/diy/workflow/index";
import DiyDocument from "@/views/diy/diy-document";
import DiyDesignList from "@/views/diy/diy-table";
import DiyFormWF from "@/views/diy/workflow/diy-form-wf";
import CustomFormWF from "@/views/diy/workflow/custom-form-wf";
import DiyInput from "@/views/diy/diy-field-component/diy-input";
import DiyText from "@/views/diy/diy-field-component/diy-input.vue";
import DiyGuid from "@/views/diy/diy-field-component/diy-input.vue";
import DiyAutocomplete from "@/views/diy/diy-field-component/diy-autocomplete";
import DiyCascader from "@/views/diy/diy-field-component/diy-cascader";
import DiyAddress from "@/views/diy/diy-field-component/diy-address.vue";
import DiySelectTree from "@/views/diy/diy-field-component/diy-select-tree";
import DiyDepartment from "@/views/diy/diy-field-component/diy-department";
import DiyFontawesome from "@/views/diy/diy-field-component/diy-fontawesome";
import DiyFontAwesome from "@/views/diy/diy-field-component/diy-fontawesome.vue";
import DiySwitch from "@/views/diy/diy-field-component/diy-switch";
import DiySelect from "@/views/diy/diy-field-component/diy-select";
import DiyMultipleSelect from "@/views/diy/diy-field-component/diy-select";
import DiyRadio from "@/views/diy/diy-field-component/diy-radio";
import DiyProgress from "@/views/diy/diy-field-component/diy-progress.vue";
import DiyCheckbox from "@/views/diy/diy-field-component/diy-checkbox.vue";
import DiyInputNumber from "@/views/diy/diy-field-component/diy-input-number";
import DiyNumberText from "@/views/diy/diy-field-component/diy-input-number";
import DiyDateTime from "@/views/diy/diy-field-component/diy-datetime";
import DiyTextarea from "@/views/diy/diy-field-component/diy-textarea";
import DiyRate from "@/views/diy/diy-field-component/diy-rate.vue";
import DiyColorPicker from "@/views/diy/diy-field-component/diy-colorpicker.vue";
import DiyAutoNumber from "@/views/diy/diy-field-component/diy-autonumber.vue";
import DiyButton from "@/views/diy/diy-field-component/diy-button.vue";
import DiyFileUpload from "@/views/diy/diy-field-component/diy-fileupload.vue";
import DiyImgUpload from "@/views/diy/diy-field-component/diy-imgupload.vue";
import DiyDivider from '@/views/diy/diy-field-component/diy-divider.vue';
import DiyHtml from '@/views/diy/diy-field-component/diy-html.vue';
import DiyRichText from '@/views/diy/diy-field-component/diy-richtext.vue';
import DiyCustomDialog from "@/views/diy/diy-custom-dialog";
import DiySearch from "@/views/diy/diy-search";
import Fontawesome from "@/views/dos.fontawesome/Fontawesome.vue";

// Vue 3: 使用 defineAsyncComponent 包装动态 import
var nodeColConfig = defineAsyncComponent(() => import("@/views/diy/workflow/component/node-col-config.vue"));
// vue-neditor-wrap 不支持 Vue 3，使用 @wangeditor/editor-for-vue 替代
import "@wangeditor/editor/dist/css/style.css";
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import { CodeToText, TextToCode } from "element-china-area-data";

//定制组件
// Vue 3: 使用 defineAsyncComponent 包装动态 import
var LoudongTestComponent = defineAsyncComponent(() => import("@/views/test/loudong"));
// 通用--打开iframe制组件
var OpenIframe = defineAsyncComponent(() => import("@/views/page-engine/dialogiframe.vue"));

// 注册工具函数 - Vue 3 版本
// 参数 app 是 Vue 3 的应用实例（createApp 返回值）
function RegMicroiComponents(app) {
    // 全局属性（替代 Vue.prototype）
    app.config.globalProperties.DosCommon = DosCommon;
    app.config.globalProperties.DiyCommon = DiyCommon;
    app.config.globalProperties.DiyApi = DiyApi;
    app.config.globalProperties.CodeToText = CodeToText;
    app.config.globalProperties.TextToCode = TextToCode;

    // 注册全局组件
    app.component("DiyDesign", DiyDesign);
    app.component("DiyTable", DiyTable);
    app.component("DiyForm", DiyForm);
    app.component("DiyFormDialog", DiyFormDialog);
    app.component("DiyModule", DiyModule);
    app.component("DiyFormPage", DiyFormPage);
    app.component("DiyChat", DiyChat);
    app.component("DiyFlowDesign", DiyFlowDesign);
    app.component("DiyMyWork", DiyMyWork);
    app.component("DiyDesignList", DiyDesignList);
    app.component("DiyDocument", DiyDocument);
    app.component("DiyFormWF", DiyFormWF);
    app.component("CustomFormWF", CustomFormWF);
    app.component("DiyFlowIndex", DiyFlowIndex);
    app.component("WFWorkHandler", WFWorkHandler);
    app.component("WFHistory", WFHistory);
    app.component("WFDesignPreview", WFDesignPreview);
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
    app.component("DiyCustomDialog", DiyCustomDialog);
    app.component("NodeColConfig", nodeColConfig);
    app.component("DiySearch", DiySearch);

    app.component("Fontawesome", Fontawesome);

    // Vue 3: wangeditor 需要使用 @wangeditor/editor-for-vue 的 Vue 3 版本
    app.component("Editor", Editor);
    app.component("Toolbar", Toolbar);

    app.component("LoudongTestComponent", LoudongTestComponent);
    app.component("OpenIframe", OpenIframe);
}
export {
    RegMicroiComponents,
    DosCommon,
    DiyCommon,
    DiyApi,
    DiyDesign,
    DiyTable,
    DiyForm,
    DiyFormDialog,
    DiyModule,
    DiyFormPage,
    DiyChat,
    DiyFlowDesign,
    DiyMyWork,
    DiyFlowIndex,
    DiyDesignList,
    DiyDocument,
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
    Fontawesome
};
