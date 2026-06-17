export default {
beforeUnmount() {
        var self = this;
        self._isDestroyed = true;
        try { self._cancelFieldFormOpen && self._cancelFieldFormOpen(); } catch (e) {}
        try { self.ShowFieldForm = false; self.ShowFieldFormDrawer = false; } catch (e) {}

        // 1. 解除全局 popstate 监听（即使关闭逻辑没走到 onDialogClosed/onDrawerClosed 也兜底清理）
        try { self._cleanupDialogPopstate && self._cleanupDialogPopstate(); } catch (e) {}
        try { self._cleanupDrawerPopstate && self._cleanupDrawerPopstate(); } catch (e) {}

        // 2. 清理实例上挂的全局栈引用（避免与其他实例错配）
        try {
            if (window.__microi_dialog_stack && window.__microi_dialog_stack.length === 0) {
                window.__microi_dialog_stack = null;
            }
            if (window.__microi_drawer_stack && window.__microi_drawer_stack.length === 0) {
                window.__microi_drawer_stack = null;
            }
            if ((!window.__microi_dialog_stack || window.__microi_dialog_stack.length === 0)
                && (!window.__microi_drawer_stack || window.__microi_drawer_stack.length === 0)) {
                if (typeof window.__microi_protected_count === 'number') window.__microi_protected_count = 0;
                if (typeof window.__microi_ignore_pop === 'boolean') window.__microi_ignore_pop = false;
            }
        } catch (e) {}

        // 3. 清理大对象/数组引用（这些都是响应式的，断开能让 GC 立即回收）
        try {
            if (Array.isArray(self.DataLogList)) self.DataLogList.length = 0;
            self.DataLogList = [];
            if (Array.isArray(self.DataCommentList)) self.DataCommentList.length = 0;
            self.DataCommentList = [];
            if (Array.isArray(self.DataVersionList)) self.DataVersionList.length = 0;
            self.DataVersionList = [];
            if (Array.isArray(self.DraftList)) self.DraftList.length = 0;
            self.DraftList = [];
            self.CurrentDraftId = "";
            self.ShowDraftDialog = false;
            if (Array.isArray(self.DiyTableRowList)) self.DiyTableRowList.length = 0;
            self.DiyTableRowList = [];
        } catch (e) {}

        // 4. 清理 V8/工作流相关的闭包引用
        self.ParentV8_Data = null;
        self.FormWF = null;
        self.DataAppend = null;
        self.CurrentRowModel = null;
        self.SysMenuModel = null;
        self.OpenDiyFormWorkFlowType = null;

        // 5. 主动调用子表单组件的 Clear（释放其内部 V8/字段缓存）
        try {
            var fieldForm = self.$refs && self.$refs.fieldForm;
            if (fieldForm) {
                if (Array.isArray(fieldForm)) {
                    fieldForm.forEach(function (c) { if (c && typeof c.Clear === 'function') { try { c.Clear(); } catch (e) {} } });
                } else if (typeof fieldForm.Clear === 'function') {
                    try { fieldForm.Clear(); } catch (e) {}
                }
            }
        } catch (e) {}

        // 6. 清理实例上的本地堆栈记录
        self._dialogStack = null;
        self._dialogHandlers = null;
        self._drawerStack = null;
        self._drawerHandlers = null;
        self._currentDialogInstanceIds = null;
        self._currentDrawerInstanceIds = null;
        self._dialogGlobalHandler = null;
        self._drawerGlobalHandler = null;
        self._pendingDrawerContext = null;
    },

};
