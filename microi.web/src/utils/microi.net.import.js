//-------开发引用
import DiyTable from "@/views/diy/diy-table-rowlist";
// var DiyTable = (resolve) => require(["@/views/diy/diy-table-rowlist"], resolve);
import DiyForm from "@/views/diy/diy-form";
// var DiyForm = (resolve) => require(["@/views/diy/diy-form"], resolve);
import DiyFormDialog from "@/views/diy/diy-form-dialog";
import DiyChat from "@/views/diy/microi.chat/index";
import DiyFlowDesign from "@/views/diy/workflow/flow-design";
import DiyDesign from "@/views/diy/diy-design";
import WFWorkHandler from "@/views/diy/workflow/wf-work-handler";
import WFHistory from "@/views/diy/workflow/component/workflow-history";
import WFDesignPreview from "@/views/diy/workflow/component/designer-preview";
import { DosCommon } from "@/utils/dos.common";
import { DiyCommon } from "@/utils/diy.common";
import { DiyApi } from "@/api/api.itdos";
var tValue = require("@/store/modules/diy.store");
var DiyStore = tValue.default;
//模块引擎，即将开源
import DiyModule from "@/views/diy/diy-module";
//新开表单详情页，此页面已开源
import DiyFormPage from "@/views/diy/diy-form-page";
//我的工作页，此页面已开源
import DiyMyWork from "@/views/diy/workflow/my-work";
//流程列表页，此页面已开源
import DiyFlowIndex from "@/views/diy/workflow/index";
//平台文档，此页面已开源
import DiyDocument from "@/views/diy/diy-document";
//表单引擎数据列表，已开源
import DiyDesignList from "@/views/diy/diy-table";
//工作处理详情页，已开源
import DiyFormWF from "@/views/diy/workflow/diy-form-wf";
//自定义定制表单工作处理详情页，已开源
import CustomFormWF from "@/views/diy/workflow/custom-form-wf";
//-------核心源码开发引用（仅此核心不开源） END
import Fontawesome from "@/views/dos.fontawesome/Fontawesome.vue";

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
import DiyCustomDialog from "@/views/diy/diy-custom-dialog";
import DiySearch from "@/views/diy/diy-search";

import QrCodeGenerator from "@/views/diy/workflow/component/diy-qrcode.vue";
var nodeColConfig = (resolve) => require(["@/views/diy/workflow/component/node-col-config.vue"], resolve);
import VueNeditorWrap from "vue-neditor-wrap";
import "@wangeditor/editor/dist/css/style.css";
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import { CodeToText, TextToCode } from "element-china-area-data";

//定制组件
var LoudongTestComponent = (resolve) => require(["@/views/test/loudong"], resolve);
// 仁合吃喝玩乐--注入会员提现金额组件
var MerchantWithdrawal = (resolve) => require(["@/views/custom/renhelife/MerchantWithdrawal.vue"], resolve);
//pengrui 注册
// import DiyTree from '@/views/custom/longyuangk/diyTree/index.vue'
// Vue.component('DiyTree', DiyTree);
// 迈巴赫物性--产品信息-列表配置定制组件
var ProductInfoSetting = (resolve) => require(["@/views/custom/mbhwx/ProductInfoSetting.vue"], resolve);
// 新纪源--服务记录表定制组件
var ServiceRecordCustom = (resolve) => require(["@/views/custom/xjy/ServiceRecord.vue"], resolve);
// 通用--打开iframe制组件
var OpenIframe = (resolve) => require(["@/views/page-engine/dialogiframe.vue"], resolve);
// var component = (resolve) => require(['@/views/test/loudong.vue'], resolve)
// Vue.component('LoudongTestComponent', component);

// 注册工具函数
function RegMicroiComponents(Vue) {
    Vue.prototype.DosCommon = DosCommon;
    Vue.prototype.DiyCommon = DiyCommon;
    Vue.prototype.DiyApi = DiyApi;
    Vue.component("DiyDesign", DiyDesign);
    Vue.component("DiyTable", DiyTable);
    Vue.component("DiyForm", DiyForm);
    Vue.component("DiyFormDialog", DiyFormDialog);
    Vue.component("DiyModule", DiyModule);
    Vue.component("DiyFormPage", DiyFormPage);
    Vue.component("DiyChat", DiyChat);
    Vue.component("DiyFlowDesign", DiyFlowDesign);
    Vue.component("DiyMyWork", DiyMyWork);
    Vue.component("DiyDesignList", DiyDesignList);
    Vue.component("DiyDocument", DiyDocument);
    Vue.component("DiyFormWF", DiyFormWF);
    Vue.component("CustomFormWF", CustomFormWF);
    Vue.component("DiyFlowIndex", DiyFlowIndex);
    Vue.component("WFWorkHandler", WFWorkHandler);
    Vue.component("WFHistory", WFHistory);
    Vue.component("WFDesignPreview", WFDesignPreview);
    Vue.component("Fontawesome", Fontawesome);
    Vue.component("DiyInput", DiyInput);
    Vue.component("DiyText", DiyText);
    Vue.component("DiyGuid", DiyGuid);
    Vue.component("DiyAutocomplete", DiyAutocomplete);
    Vue.component("DiyCascader", DiyCascader);
    Vue.component("DiyAddress", DiyAddress);
    Vue.component("DiySelectTree", DiySelectTree);
    Vue.component("DiyDepartment", DiyDepartment);
    Vue.component("DiyFontawesome", DiyFontawesome);
    Vue.component("DiyFontAwesome", DiyFontAwesome);
    Vue.component("DiySwitch", DiySwitch);
    Vue.component("DiySelect", DiySelect);
    Vue.component("DiyMultipleSelect", DiyMultipleSelect);
    Vue.component("DiyRadio", DiyRadio);
    Vue.component("DiyProgress", DiyProgress);
    Vue.component("DiyCheckbox", DiyCheckbox);
    Vue.component("DiyInputNumber", DiyInputNumber);
    Vue.component("DiyNumberText", DiyNumberText);
    Vue.component("DiyDateTime", DiyDateTime);
    Vue.component("DiyTextarea", DiyTextarea);
    Vue.component("DiyRate", DiyRate);
    Vue.component("DiyColorPicker", DiyColorPicker);
    Vue.component("DiyAutoNumber", DiyAutoNumber);
    Vue.component("DiyCustomDialog", DiyCustomDialog);
    Vue.component("QrCodeGenerator", QrCodeGenerator);
    Vue.component("NodeColConfig", nodeColConfig);
    Vue.component("DiySearch", DiySearch);

    Vue.component("VueNeditorWrap", VueNeditorWrap);
    Vue.component("Editor", Editor);
    Vue.component("Toolbar", Toolbar);
    Vue.prototype.CodeToText = CodeToText;
    Vue.prototype.TextToCode = TextToCode;

    Vue.component("LoudongTestComponent", LoudongTestComponent);
    Vue.component("MerchantWithdrawal", MerchantWithdrawal);
    Vue.component("ProductInfoSetting", ProductInfoSetting);
    Vue.component("ServiceRecordCustom", ServiceRecordCustom);
    Vue.component("OpenIframe", OpenIframe);
}
export {
    RegMicroiComponents,
    DosCommon,
    DiyCommon,
    DiyApi,
    DiyStore,
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
    Fontawesome,
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
    QrCodeGenerator
};
