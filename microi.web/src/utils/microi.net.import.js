//-------核心源码开发引用（仅此核心不开源） START
//-------未开源
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
import DiyAddress from "@/views/diy/diy-field-component/diy-address";
//-------核心源码开发引用（仅此核心不开源） END
import Fontawesome from "@/views/dos.fontawesome/Fontawesome.vue";
//-------END
export {
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
  DiyAddress,
  Fontawesome
};
