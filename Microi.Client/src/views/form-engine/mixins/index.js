/**
 * DIY 模块 Mixins 索引文件
 * 
 * 用于统一导出所有 mixins
 */

// 通用 mixins (diy-form.vue 和 diy-table-rowlist.vue 都可以使用)
export { default as diyCommonMixin } from './diy-common.mixin.js';

// diy-table-rowlist.vue 专用 mixins
export { default as tableUtilsMixin } from './table-utils.mixin.js';

// diy-form.vue 专用 mixins
export { default as formUtilsMixin } from './form-utils.mixin.js';

// diy-table-rowlist.vue split mixins
export { default as diyTableCleanupMixin } from './diy-table-cleanup.mixin.js';
export { default as diyTableUiMixin } from './diy-table-ui.mixin.js';
export { default as diyTableActionsMixin } from './diy-table-actions.mixin.js';
export { default as diyTableStateMixin } from './diy-table-state.mixin.js';
export { default as diyTableSchemaMixin } from './diy-table-schema.mixin.js';
export { default as diyTableDataMixin } from './diy-table-data.mixin.js';
export { default as diyTableSelectionMixin } from './diy-table-selection.mixin.js';
export { default as diyTableNavigationMixin } from './diy-table-navigation.mixin.js';
export { default as diyTableOperationsMixin } from './diy-table-operations.mixin.js';

// diy-form.vue split mixins
export { default as diyFormCleanupMixin } from './diy-form-cleanup.mixin.js';
export { default as diyFormDesignerMixin } from './diy-form-designer.mixin.js';
export { default as diyFormStateMixin } from './diy-form-state.mixin.js';
export { default as diyFormDataMixin } from './diy-form-data.mixin.js';
export { default as diyFormSchemaMixin } from './diy-form-schema.mixin.js';
export { default as diyFormChildTableMixin } from './diy-form-child-table.mixin.js';
export { default as diyFormNavigationMixin } from './diy-form-navigation.mixin.js';

// diy-form-full.vue split mixins
export { default as diyFormFullCleanupMixin } from './diy-form-full-cleanup.mixin.js';
export { default as diyFormFullMobileMixin } from './diy-form-full-mobile.mixin.js';
export { default as diyFormFullStateMixin } from './diy-form-full-state.mixin.js';
export { default as diyFormFullDialogMixin } from './diy-form-full-dialog.mixin.js';
export { default as diyFormFullDataMixin } from './diy-form-full-data.mixin.js';
export { default as diyFormFullWorkflowMixin } from './diy-form-full-workflow.mixin.js';
export { default as diyFormFullPermissionMixin } from './diy-form-full-permission.mixin.js';
