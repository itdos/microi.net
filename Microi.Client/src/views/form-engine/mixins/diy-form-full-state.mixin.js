export default {
    watch: {
        // 监听路由变化，在页面模式下重新初始化表单
        $route: {
            handler(newRoute, oldRoute) {
                var self = this;

                // 检查是否为表单页面路由
                var isFormPageRoute = newRoute && newRoute.params && newRoute.params.TableId && newRoute.path.indexOf('/diy/form-page') > -1;

                // 只在直接页面模式下处理路由变化
                if (!self._isDirectPageMode || !isFormPageRoute) return;

                // keep-alive 停用状态下不处理路由变化，防止缓存实例干扰新实例
                if (self._isDeactivated) return;

                // 确保已经 mounted 过
                if (!self._isMounted) return;

                // 路由确实发生了变化（比较 fullPath 以包含 query 参数的变化）
                if (oldRoute && newRoute.fullPath !== oldRoute.fullPath) {
                    self.reinitPageForm();
                }
            },
            immediate: false
        }
    },
    computed: {
        // 判断是否为页面模式（通过路由参数判断 + 必须是直接访问，非嵌套子表 + 未被 keep-alive 停用）
        IsPageMode() {
            var self = this;
            // 被 keep-alive 停用的实例不应该渲染页面模式内容，防止缓存实例因路由变化重新挂载 DiyForm 导致重复请求
            if (self._isDeactivated) return false;
            // 必须同时满足：1. 路由是 form-page 路径  2. 是直接页面访问（非弹窗内的子表）
            var isFormPageRoute = self.$route && self.$route.params && self.$route.params.TableId && self.$route.path.indexOf('/diy/form-page') > -1;
            return isFormPageRoute && self._isDirectPageMode;
        },
        // 判断移动端是否有可用操作
        HasMobileActions() {
            var self = this;
            if (self.FormMode != 'View') return true;
            if (self.FormMode == 'View' && self.ShowUpdateBtn) return true;
            if (!self.DiyCommon.IsNull(self.SysMenuModel) && !self.DiyCommon.IsNull(self.SysMenuModel.FormBtns) && self.SysMenuModel.FormBtns.length > 0) {
                return self.SysMenuModel.FormBtns.some(btn => btn.IsVisible);
            }
            return false;
        },
        // 工作流：是否在表单顶部/底部显示醒目的【发起流程/处理工作】按钮（替代右侧不醒目的小按钮）
        ShowWfTopSubmitBtn() {
            var self = this;
            var wt = self.OpenDiyFormWorkFlowType && self.OpenDiyFormWorkFlowType.WorkType;
            if (wt !== 'StartWork' && wt !== 'DoWork') return false;
            return self.FormMode == 'Add' || self.FormMode == 'Edit';
        },
        WfTopSubmitBtnText() {
            var self = this;
            var wt = self.OpenDiyFormWorkFlowType && self.OpenDiyFormWorkFlowType.WorkType;
            return wt === 'StartWork' ? '发起流程' : '处理工作';
        },
        // 判断当前表单FormBtns是否有可见按钮（用于FAB菜单是否显示）
        HasVisibleFormBtns() {
            var self = this;
            if (self.DiyCommon.IsNull(self.SysMenuModel) || self.DiyCommon.IsNull(self.SysMenuModel.FormBtns) || self.SysMenuModel.FormBtns.length == 0) return false;
            return self.SysMenuModel.FormBtns.some(btn => btn.IsVisible);
        },
        // Page模式：FAB菜单是否有内容（取消编辑 / 表单更多按钮）
        HasFabMenuItemsPage() {
            var self = this;
            if (self.FormMode == 'Edit') return true;
            if (self.FormMode != 'View') return true;
            if (self.HasVisibleFormBtns) return true;
            if (!self.DiyCommon.IsNull(self.TableId) || !self.DiyCommon.IsNull(self.CurrentDiyTableModel && self.CurrentDiyTableModel.Id)) return true;
            return false;
        },
        // Dialog模式：FAB菜单是否有内容（取消编辑 / FormBtns / 删除）
        HasFabMenuItemsDialog() {
            var self = this;
            if (self.FormMode == 'Edit' && self.OpenDiyFormWorkFlowType.WorkType != 'StartWork') return true;
            if (self.FormMode != 'View') return true;
            if (self.HasVisibleFormBtns) return true;
            if (self.LimitDel && typeof self.LimitDel == 'function' && self.LimitDel()
                && self.FormMode != 'Add' && self.ShowDeleteBtn
                && self.OpenDiyFormWorkFlowType.WorkType != 'StartWork') return true;
            if (!self.DiyCommon.IsNull(self.TableId) || !self.DiyCommon.IsNull(self.CurrentDiyTableModel && self.CurrentDiyTableModel.Id)) return true;
            return false;
        },
        // Drawer模式：与Dialog相同
        HasFabMenuItemsDrawer() {
            return this.HasFabMenuItemsDialog;
        }
    },
    data() {
        return {
            // ========== 打开模式 ==========
            DialogType: "", //Dialog、Drawer、Page
            Width: "",

            // ========== 表相关 ==========
            TableId: "",
            TableName: "",
            SysMenuId: "",
            SysMenuModel: {},
            TableRowId: "",
            CurrentDiyTableModel: {},

            // ========== 弹窗/抽屉控制 ==========
            ShowFieldForm: false,
            ShowFieldFormDrawer: false,
            ShowHideField: false,

            // ========== 表单状态 ==========
            CurrentRowModel: {},
            ShowDiyFieldList: null,
            DiyFieldList: [],
            FormMode: "View",
            BtnLoading: false,
            BtnV8Loading: false,
            ShowFormBottomBtns: {
                SaveClose: true,
                SaveAdd: true,
                SaveUpdate: true,
                SaveView: true
            },
            ShowUpdateBtn: true,
            ShowDeleteBtn: true,
            ShowSaveBtn: true,
            FieldFormHideFields: [],
            FieldFormFixedTabs: [],
            FieldFormSelectFields: [],
            FieldFormDefaultValues: {},
            ParentV8_Data: null,
            CurrentTableRowListActiveTab: {},
            DiyTableRowList: [],
            CloseFormNeedConfirm: false,
            ApiReplace: {},
            EventReplace: {},
            DataAppend: {},

            // ========== 工作流相关 ==========
            OpenDiyFormWorkFlow: false,
            OpenDiyFormWorkFlowType: {},
            FormWF: {},
            WfFormData: {},
            StartWorkSubmited: false,
            // 表单顶部/底部【发起流程/处理工作】CTA 按钮防重入状态
            WfSubmitting: false,
            FormRightType: "WorkFlow",

            // ========== 数据日志相关 ==========
            isCheckDataLog: true,
            DataLogListLoading: false,
            DataLogList: [],
            DataCommentListLoading: false,
            DataCommentList: [],
            DataVersionListLoading: false,
            DataVersionList: [],
            CommentContent: "",
            ReplyComment: null,
            ShowDataVersionPreviewDialog: false,
            PreviewDataVersionItem: null,
            PreviewDataVersionData: {},
            PreviewDataVersionKey: 0,
            DraftListLoading: false,
            DraftList: [],
            ShowDraftDialog: false,
            CurrentDraftId: "",
            // 防止重复请求 + 标记是否已加载（用于切换 Tab 时懒加载）
            _DataLogLoadToken: 0,
            _DataCommentLoadToken: 0,
            _DataVersionLoadToken: 0,
            _DraftLoadToken: 0,

            // ========== 全新页面模式相关 ==========
            SaveDiyTableCommonLoding: false,
            CallbackSetFormDataFinish: false,
            CallbackSetDiyTableModelFinish: false,
            _isReloadingForm: false, // 防止 ReloadForm 死循环
            _isMounted: false, // 防止 mounted 重复执行
            _isDestroyed: false, // 组件销毁标记，用于取消异步初始化
            _isDirectPageMode: false, // 标识是否为直接通过路由访问的页面模式（非嵌套的子表弹窗）
            _isDeactivated: false, // keep-alive 停用标记，防止缓存实例响应路由变化导致重复请求

            // ========== 抽屉打开上下文 ==========
            _pendingDrawerContext: null,
            _fieldFormOpenToken: 0,
            _fieldFormInitTimer: null,

            // ========== 移动端历史管理（按实例） ==========
            // 抽屉组件相关数据
            _drawerStack: [], // 存储抽屉组件实例的栈结构
            _drawerHandlers: {}, // 存储抽屉组件的处理函数映射

            // 对话框组件相关数据
            _dialogStack: [], // 存储对话框组件实例的栈结构
            _dialogHandlers: {}, // 存储对话框组件的处理函数映射

            // 全局处理函数
            _drawerGlobalHandler: null, // 抽屉组件的全局处理函数
            _dialogGlobalHandler: null, // 对话框组件的全局处理函数

            // ========== 移动端FAB ==========
            showMobileFabMenu: false,
            showMobileRightDrawer: false,
            // FAB拖拽位置（相对视口右下角的偏移，单位 px），null 表示使用默认位置
            fabPosition: null
        };
    },
    activated() {
        this._isDeactivated = false;
        // Page模式下，如果之前已保存/关闭过表单（Go_1被调用），重新激活时需要完全初始化
        if (this._isDirectPageMode && this._needsReinit) {
            this._needsReinit = false;
            this.reinitPageForm();
        }
    },
    deactivated() {
        this._isDeactivated = true;
    },
        async mounted() {
        var self = this;
        // 防止 mounted 被重复执行（可能由响应式数据变化触发的重新渲染导致）
        if (self._isMounted) {
            console.warn('[diy-form-full] mounted: 已经执行过，跳过重复执行');
            return;
        }
        self._isMounted = true;

        // 判断是否为直接通过路由访问的页面模式
        var isFormPageRoute = self.$route && self.$route.params && self.$route.params.TableId && self.$route.path.indexOf('/diy/form-page') > -1;
        if (isFormPageRoute) {
            // 标记为直接页面访问模式
            self._isDirectPageMode = true;

            self.TableId = self.$route.params.TableId;
            self.TableRowId = self.$route.params.TableRowId;
            if (!self.TableRowId) {
                var guidResult = await self.DiyCommon.PostAsync("/api/FormEngine/NewGuid");
                if (guidResult.Code == 1) {
                    self.TableRowId = guidResult.Data;
                }
            }
            self.FormMode = self.$route.query.FormMode;
            self.SysMenuId = self.$route.query.SysMenuId || self.$route.query.Id || (self.$route.meta ? (self.$route.meta.Id || self.$route.meta.SysMenuId) : "");
            if (!self.TableId || !self.FormMode) {
                self.DiyCommon.Tips("缺少参数！格式：/FormMode/TableId/TableRowId", false);
                return;
            }
            await self.EnsureSysMenuModel();
            // Page 模式下 DiyForm 组件通过 props 自动初始化，无需手动调用 Init()
            // 手动调用会导致与 CallbackReloadFormPage 形成死循环
        }

        // 加载FAB拖拽位置
        self.LoadFabPosition();
    },
};
