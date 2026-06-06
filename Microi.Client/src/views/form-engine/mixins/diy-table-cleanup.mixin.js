export default {
beforeUnmount() {
        var self = this;

        // 🔥 添加明显的日志，确认被调用
        // console.log('%c[DiyTableRowlist] ========== beforeUnmount 被触发 ==========', 'color: red; font-size: 16px; font-weight: bold');
        // console.log('[DiyTableRowlist] 当前路由:', self.$route.fullPath);
        // console.log('[DiyTableRowlist] SysMenuId:', self.SysMenuId);
        // console.log('[DiyTableRowlist] TableId:', self.TableId);

        // 标记组件已销毁
        self._isDestroyed = true;

        // 🔥 移除全局刷新事件监听
        if (self._handlePageRefresh) {
            window.removeEventListener('page-refresh', self._handlePageRefresh);
            self._handlePageRefresh = null;
        }
        //zhy移除全局子表格刷新事件监听
        if (self._handleTableRefresh) {
            window.removeEventListener('table-refresh', self._handleTableRefresh);
            self._handleTableRefresh = null;
        }

        // 🔥 解绑表格懒渲染滚动监听
        try { self.UnbindLazyScroll && self.UnbindLazyScroll(); } catch (e) {}
        try { self.BatchDragSelectionStop && self.BatchDragSelectionStop(); } catch (e) {}
        try { document.removeEventListener('click', self.BatchDragSelectionClick, true); } catch (e) {}
        // 🔥 解绑移动端无限滚动监听（避免 keep-alive 之外的卸载场景泄漏）
        try {
            if (self.mobileScrollHandler) {
                window.removeEventListener('scroll', self.mobileScrollHandler);
                self.mobileScrollHandler = null;
            }
        } catch (e) {}
        // 清理全局更多菜单的文档点击监听器（如果存在）
        if (self._moreMenuDocClick) {
            try { document.removeEventListener('click', self._moreMenuDocClick, true); } catch (e) {}
            self._moreMenuDocClick = null;
        }

        // ========== 1. 清理定时器 ==========
        if (self._importStepTimer) {
            clearTimeout(self._importStepTimer);
            self._importStepTimer = null;
        }
        if (self._debounceTimer) {
            clearTimeout(self._debounceTimer);
            self._debounceTimer = null;
        }
        if (self._openFormDialogTimer) {
            try { clearTimeout(self._openFormDialogTimer); } catch (e) {}
            self._openFormDialogTimer = null;
        }
        self._openFormDialogToken = (self._openFormDialogToken || 0) + 1;

        // ========== 2. 关闭所有弹窗和抽屉 ==========
        self.ShowImport = false;
        self.ShowAnyTable = false;
        self.ShowMockPermissionDialog = false;
        self.ShowDiyModule = false; // 关闭模块组件

        // ========== 3. 清理子组件引用 ==========
        // 表格数据 - 需要先清理内部的对象引用
        if (self.DiyTableRowList && self.DiyTableRowList.length > 0) {
            self.DiyTableRowList.forEach(row => {
                if (row) {
                    // 清理按钮数组
                    if (row._RowMoreBtnsOut) {
                        row._RowMoreBtnsOut.length = 0;
                        row._RowMoreBtnsOut = null;
                    }
                    if (row._RowMoreBtnsIn) {
                        row._RowMoreBtnsIn.length = 0;
                        row._RowMoreBtnsIn = null;
                    }
                    // 清理模板引擎结果
                    Object.keys(row).forEach(key => {
                        if (key.endsWith('_TmpEngineResult')) {
                            row[key] = null;
                        }
                    });
                }
            });
            self.DiyTableRowList.length = 0;
        }
        self.DiyTableRowList = [];

        if (self.OldDiyTableRowList && self.OldDiyTableRowList.length > 0) {
            self.OldDiyTableRowList.forEach(row => {
                if (row) {
                    if (row._RowMoreBtnsOut) {
                        row._RowMoreBtnsOut.length = 0;
                        row._RowMoreBtnsOut = null;
                    }
                    if (row._RowMoreBtnsIn) {
                        row._RowMoreBtnsIn.length = 0;
                        row._RowMoreBtnsIn = null;
                    }
                }
            });
            self.OldDiyTableRowList.length = 0;
        }
        self.OldDiyTableRowList = [];

        // 清理字段列表中的配置
        if (self.DiyFieldList && self.DiyFieldList.length > 0) {
            self.DiyFieldList.forEach(field => {
                if (field) {
                    if (field.Data) {
                        if (Array.isArray(field.Data)) field.Data.length = 0;
                        field.Data = null;
                    }
                    if (field.Config) {
                        field.Config = null;
                    }
                }
            });
            self.DiyFieldList.length = 0;
        }
        self.DiyFieldList = [];
        self.ShowDiyFieldList = null;
        self._allFieldList = null; // 🔥 清理完整字段列表缓存

        // 搜索相关
        self.SearchFieldIds = [];
        self.SortFieldIds = [];
        self.NotShowFields = [];
        self.FixedFields = [];
        self.MobileListFields = [];
        self.SearchModel = {};
        self.SearchEqual = {};
        self.V8SearchModel = {};
        self.SearchCheckbox = {};
        self.SearchDateTime = {};
        self.SearchNumber = {};
        self.SearchWhere = [];
        self.Where = [];
        self._colFilters = {};
        self._colPageFilterKeyword = "";
        self._colPageFilterSelectedValues = [];
        self._colPageFilters = {};
        self._OrderBys = {};
        self._OrderBy = "";
        self._OrderByType = "";
        self.LastOrderBy = "";

        // 选择状态
        self.TableMultipleSelection = [];
        self.TableSelectedRow = {};
        self.TableSelectedRowLast = {};

        // 当前行数据
        self.CurrentRowModel = {};
        self.CurrentSelectedRowModel = {};
        self.FieldFormDefaultValues = {};

        // 父级数据引用
        self.FatherFormModel_Data = null;
        self.ParentV8_Data = null;

        // 导入进度
        self.ImportStepList = [];

        // 表单相关
        self.FieldFormSelectFields = [];
        self.FieldFormFixedTabs = [];
        self.FieldFormHideFields = [];
        self.TempBtnIsVisible = [];
        self.ShowHideFieldsList = [];

        // ========== 5. 清理模块配置 ==========
        if (self.SysMenuModel) {
            self.SysMenuModel.MoreBtns = [];
            self.SysMenuModel.PageBtns = [];
            self.SysMenuModel.FormBtns = [];
            self.SysMenuModel.PageTabs = [];
            self.SysMenuModel.BatchSelectMoreBtns = [];
            self.SysMenuModel.ExportMoreBtns = [];
            self.SysMenuModel = {};
        }

        // ========== 6. 清理动态组件 ==========
        self.DevComponents = {};

        // ========== 7. 清理表模型 ==========
        self.CurrentDiyTableModel = {};
        self.CurrentTableRowListActiveTab = {};

        // ========== 8. 清理弹窗配置 ==========
        self.DiyCustomDialogConfig = {};
        self.OpenAnyTableParam = {};
        self.FormWF = {};

        // ========== 9. 清理权限模拟数据 ==========
        self.MockPermissionRoleList = [];
        self.MockPermissionBtnList = [];

        // ========== 10. 清理全局菜单事件监听器 ==========
        document.removeEventListener('click', self.hideMoreMenu);
        document.removeEventListener('click', self.hideColHeaderMenu);
        self._moreMenuVisible = false;
        self._moreMenuRow = null;
        self._colMenuVisible = false;
        self._colMenuField = null;

        // console.log('%c[DiyTableRowlist] ========== beforeUnmount 完成 ==========', 'color: green; font-size: 16px; font-weight: bold');
    },

};
