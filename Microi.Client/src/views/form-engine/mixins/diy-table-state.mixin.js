import _u from "underscore";

export default {
        computed: {
        // 判断是否在diy-table列表---仅在 diy-table 列表路由显示新增按钮
        ShowAddByRoute() {
          const route = this.$route || {};
          const path = route.path || '';
          // 方案 A：排除表单页面（当路由包含 /diy/form-page 时隐藏新增）
          if (path.includes('/diy/form-page')) return false;
          // 方案 B：只在特定列表路由显示（可按需修改）
          // return path.startsWith('/diy/table') || path.startsWith('/diy/list');
          return true;
        },
        // 统计面板数据（来自 SysMenuModel.TableReport JSON；卡片模式追加 StatisticsFields）
        tableReportItems() {
            var self = this;
            var reportItems = [];
            var statisticItems = self.TableDisplayMode === 'Card' ? self.statisticsReportItems : [];
            if (!self.SysMenuModel || self.DiyCommon.IsNull(self.SysMenuModel.TableReport)) return statisticItems;
            try {
                var items = typeof self.SysMenuModel.TableReport === 'string'
                    ? JSON.parse(self.SysMenuModel.TableReport)
                    : self.SysMenuModel.TableReport;
                reportItems = Array.isArray(items) ? items : [];
            } catch (e) {
                reportItems = [];
            }
            return reportItems.concat(statisticItems);
        },
        // 卡片模式统计列数据（来自接口返回 DataAppend.StatisticsFields）
        statisticsReportItems() {
            var self = this;
            if (!self.StatisticsFields) return [];

            var statisticKeys = Object.keys(self.StatisticsFields).filter(function (fieldName) {
                return !self.DiyCommon.IsNull(fieldName) && !self.DiyCommon.IsNull(self.StatisticsFields[fieldName]);
            });
            if (statisticKeys.length === 0) return [];

            var statisticColors = ['#2f7cf6', '#13a8a8', '#67c23a', '#e6a23c', '#8b5cf6', '#f56c6c'];
            var fieldList = [].concat(self.DiyFieldList || [], self._allFieldList || [], self.ShowDiyFieldList || [], (self.SysMenuModel && self.SysMenuModel.SelectFields) || []);

            return statisticKeys.map(function (fieldName, index) {
                var fieldModel = fieldList.find(function (field) {
                    return field && (field.Name === fieldName || field.AsName === fieldName);
                }) || {};
                var rawValue = self.StatisticsFields[fieldName];
                var numericValue = Number(rawValue);
                var value = rawValue;
                if (rawValue !== '' && rawValue !== null && rawValue !== undefined && !isNaN(numericValue)) {
                    value = numericValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
                }

                return {
                    Id: 'StatisticsFields_' + fieldName,
                    Label: (fieldModel.Label || fieldName) + '合计',
                    Value: value,
                    Icon: 'fas fa-calculator',
                    Color: statisticColors[index % statisticColors.length],
                    Source: 'StatisticsFields'
                };
            });
        },
        // 自适应列数
        tableReportGridCols() {
            var n = this.tableReportItems.length;
            if (n <= 0) return '';
            if (n <= 2) return 'repeat(' + n + ', minmax(180px, 1fr))';
            if (n <= 4) return 'repeat(' + n + ', minmax(160px, 1fr))';
            return 'repeat(auto-fit, minmax(180px, 1fr))';
        },
        // 列头菜单当前排序状态
        _colMenuSortState() {
            var self = this;
            if (!self._colMenuField) return '';
            var fieldName = self.DiyCommon.IsNull(self._colMenuField.AsName) ? self._colMenuField.Name : self._colMenuField.AsName;
            if (self._OrderBys && self._OrderBys[fieldName]) return String(self._OrderBys[fieldName]).toLowerCase();
            if (self._OrderBy === fieldName && self._OrderByType) return self._OrderByType.toLowerCase() || '';
            return '';
        },
        // 性能优化：将频繁调用的方法转换为计算属性
        _IsTableChild() {
            return !this.DiyCommon.IsNull(this.TableChildTableId);
        },
        // 🔥 性能优化：表格懒渲染窗口
        // 大分页(如每页200条)时首屏只渲染前 _lazyRenderInitial 行，
        // 用户滚动到底部前 _lazyRenderBottomGap 像素时再追加 _lazyRenderStep 行。
        // 不影响：服务端分页、服务端排序、服务端统计(StatisticsFields)、行Id唯一性。
        // 跳过：移动端(已有自身的双向滚动)、卡片模式、树形模式、子表/嵌入表。
        RenderedTableRowList() {
            // 已取消滚动懒渲染：用户选择多少条数据就一次性全量渲染，避免滚动时频繁追加渲染导致卡顿。
            var self = this;
            return self.DiyTableRowList || [];
        },
        // 卡片模式显示的字段列表：优先使用MobileListFields（移动端显示列），否则回退到ShowDiyFieldList前4个
        CardShowDiyFieldList() {
            var self = this;
            if (self.MobileListFields && self.MobileListFields.length > 0 && self.DiyFieldList && self.DiyFieldList.length > 0) {
                var result = [];
                self.MobileListFields.forEach(function (element) {
                    var found = self.DiyFieldList.find(function (item) {
                        return item.Id === element || item.Id === (element && element.Id) || (!self.DiyCommon.IsNull(element && element.Name) && item.Name === element.Name);
                    });
                    if (found && !self.DiyCommon.IsNull(found.Id)) {
                        // 保留别名
                        if (element && element.AsName) {
                            found = Object.assign({}, found, { AsName: element.AsName });
                        }
                        result.push(found);
                    }
                });
                if (result.length > 0) return result;
            }
            // 回退：使用ShowDiyFieldList前4个字段
            return self.ShowDiyFieldList ? self.ShowDiyFieldList.slice(0, 4) : [];
        },
        // 卡片标题右侧Tag字段列表
        CardTitleTagFieldList() {
            var self = this;
            var tagFields = self.SysMenuModel.CardTitleTagFields;
            if (!tagFields || !Array.isArray(tagFields) || tagFields.length === 0 || !self.DiyFieldList || self.DiyFieldList.length === 0) return [];
            var result = [];
            tagFields.forEach(function (element) {
                var found = self.DiyFieldList.find(function (item) {
                    return item.Id === element || item.Id === (element && element.Id) || (!self.DiyCommon.IsNull(element && element.Name) && item.Name === element.Name);
                });
                if (found && !self.DiyCommon.IsNull(found.Id)) {
                    if (element && element.AsName) {
                        found = Object.assign({}, found, { AsName: element.AsName });
                    }
                    result.push(found);
                }
            });
            return result;
        },
        // 卡片底部左侧Tag字段列表
        CardBottomTagFieldList() {
            var self = this;
            var tagFields = self.SysMenuModel.CardBottomTagFields;
            if (!tagFields || !Array.isArray(tagFields) || tagFields.length === 0 || !self.DiyFieldList || self.DiyFieldList.length === 0) return [];
            var result = [];
            tagFields.forEach(function (element) {
                var found = self.DiyFieldList.find(function (item) {
                    return item.Id === element || item.Id === (element && element.Id) || (!self.DiyCommon.IsNull(element && element.Name) && item.Name === element.Name);
                });
                if (found && !self.DiyCommon.IsNull(found.Id)) {
                    if (element && element.AsName) {
                        found = Object.assign({}, found, { AsName: element.AsName });
                    }
                    result.push(found);
                }
            });
            return result;
        },
        // 卡片全选状态
        cardSelectAll: {
            get() {
                return this.cardSelection.length > 0 && this.cardSelection.length === this.DiyTableRowList.length;
            },
            set(val) {
                // setter由toggleCardSelectAll处理
            }
        },
        _RoleLimitModel() {
            var self = this;
            if (!self.GetCurrentUser || !self.GetCurrentUser._RoleLimits) return [];
            return self.GetCurrentUser._RoleLimits.filter(item => item.FkId === self.SysMenuId);
        },
        _EnableTrash() {
            return !!(this.CurrentDiyTableModel && this.CurrentDiyTableModel.EnableTrash);
        },
        _LimitAdd() {
            var self = this;
            if (self.IsTrashMode) return false;
            if (self.GetCurrentUser._IsAdmin) return true;
            if (self._RoleLimitModel.length > 0) {//self.TableChildFormMode != "View" &&
                return self._RoleLimitModel.some((el) => el.Permission.indexOf("Add") > -1 || el.Permission.indexOf("Insert") > -1);
            }
            return false;
        },
        _LimitImport() {
            var self = this;
            if (self.IsTrashMode) return false;
            if (self.GetCurrentUser._IsAdmin) return true;
            if (self._RoleLimitModel.length > 0) {//self.TableChildFormMode != "View" &&
                return self._RoleLimitModel.some((el) => el.Permission.indexOf("Import") > -1);
            }
            return false;
        },
        _LimitExport() {
            var self = this;
            if (self.IsTrashMode) return false;
            if (self.GetCurrentUser._IsAdmin) return true;
            if (self._RoleLimitModel.length > 0) {
                return self._RoleLimitModel.some((el) => el.Permission.indexOf("Export") > -1);
            }
            return false;
        },
        _LimitEdit() {
            var self = this;
            if (self.IsTrashMode) return false;
            if (self.GetCurrentUser._IsAdmin) return true;
            if (self._RoleLimitModel.length > 0) {//self.TableChildFormMode != "View" &&
                return self._RoleLimitModel.some((el) => el.Permission.indexOf("Edit") > -1);
            }
            return false;
        },
        _LimitDel() {
            var self = this;
            if (self.IsTrashMode) return false;
            if (self.GetCurrentUser._IsAdmin) return true;
            if (self._RoleLimitModel.length > 0) {//self.TableChildFormMode != "View" &&
                return self._RoleLimitModel.some((el) => el.Permission.indexOf("Del") > -1);
            }
            return false;
        },
        // 预计算搜索字段列表，避免模板中重复计算
        _SearchFieldListAll() {
            var self = this;
            if (!self.SearchFieldIds || self.SearchFieldIds.length === 0) return [];
            if (!self.DiyFieldList || self.DiyFieldList.length === 0) return [];

            var result = [];
            self.SearchFieldIds.forEach((id) => {
                if (!id) return;
                self.DiyFieldList.forEach((field) => {
                    if (!field) return;
                    if ((field.Id === id || field.Id === id.Id) && id.Hide !== true) {
                        // 初始化 SearchNumber
                        if (field.Type && (field.Type === "int" || field.Type.indexOf("decimal") > -1) && self.DiyCommon.IsNull(self.SearchNumber[field.Name])) {
                            self.SearchNumber[field.Name] = { Min: "", Max: "" };
                        }
                        result.push({ field, id });
                    }
                });
            });
            return result;
        },
        _SearchFieldListCheckboxIn() {
            var self = this;
            if (!self._SearchFieldListAll || self._SearchFieldListAll.length === 0) return [];
            return self._SearchFieldListAll
                .filter(({ field, id }) => {
                    if (!field || !id) return false;
                    if (id.DisplayType && id.DisplayType !== "In") return false;
                    return field.Data && Array.isArray(field.Data) && field.Data.length > 0 && field.Config && field.Config.DataSourceSqlRemote !== true;
                })
                .map(({ field }) => {
                    if (self.DiyCommon.IsNull(self.SearchCheckbox[field.Name])) {
                        self.SearchCheckbox[field.Name] = [];
                    }
                    return field;
                });
        },
        _SearchFieldListTextIn() {
            var self = this;
            if (!self._SearchFieldListAll || self._SearchFieldListAll.length === 0) return [];
            return self._SearchFieldListAll
                .filter(({ field, id }) => {
                    if (!field || !id) return false;
                    if (id.DisplayType && id.DisplayType !== "In") return false;
                    return !field.Data || !Array.isArray(field.Data) || field.Data.length === 0 || (field.Config && field.Config.DataSourceSqlRemote === true);
                })
                .map(({ field }) => field);
        },
        _HasSearchFieldsIn() {
            return this._SearchFieldListCheckboxIn.length > 0 || this._SearchFieldListTextIn.length > 0;
        },
        _HasSearchFields() {
            return this._SearchFieldListAll.length > 0;
        },
        GetActionWidth: function () {
            var self = this;
            if (self.SysMenuModel.TableActionFixedWidth) {
                return self.SysMenuModel.TableActionFixedWidth;
            }
            var baseWidth = 0;//30;
            var isWF = self.IsWorkFlowMenu();
            // 工作流-去处理 按钮
            if (isWF) {
                baseWidth += 100;
            }
            // 详情按钮
            if (self.IsPermission('NoDetail')) {
                baseWidth += 80;
            }
            if (self.IsTrashMode) {
                baseWidth += 90;
            }
            // 更多按钮（编辑/删除/内部自定义按钮）
            // WF 模式下仅考虑删除与内部自定义按钮（编辑项被隐藏）；非WF模式下考虑编辑+删除+内部按钮
            var canEdit = !isWF && self.TableChildFormMode != 'View' && self._LimitEdit;
            if (canEdit || self._LimitDel || self.HasVisibleMoreBtnsIn) {
                baseWidth += 100;
            }
            return baseWidth + self.MaxRowBtnsOut;
        },
        ShowSelectLabel: function () {
            var self = this;
            return (scope, field) => {
                return self.GetColValue(scope, field);
            };
        },
        GetSearchFieldList: function () {
            var self = this;
            return (type, InOrOut) => {
                if (self.SearchFieldIds.length == 0) {
                    return [];
                }
                var result = [];
                //注意：SearchFieldIds有可能是List<Guid>，也可能是List<{Id,Name,Label,AsName,TableId,TableName,TableDescription,DisplayType:'In/Out'}>
                self.SearchFieldIds.forEach((id) => {
                    self.DiyFieldList.forEach((field) => {
                        if (typeof id != "string" && !self.DiyCommon.IsNull(InOrOut)) {
                            if (id.DisplayType != InOrOut) {
                                return;
                            }
                        }
                        if ((field.Id == id || field.Id == id.Id) && id.Hide !== true) {
                            //初始化SearchNumber
                            if (field.Type && field.Type && (field.Type == "int" || field.Type.indexOf("decimal") > -1) && self.DiyCommon.IsNull(self.SearchNumber[field.Name])) {
                                self.SearchNumber[field.Name] = { Min: "", Max: "" };
                                self.SearchNumber[field.Name] = { Min: "", Max: "" };
                            }

                            //如果是多选框搜索。但如果勾选了【下拉】，这时候就不能返回了
                            if (type == "Checkbox" && Array.isArray(field.Data) && field.Data.length > 0 && field.Config.DataSourceSqlRemote !== true) {
                                if (self.DiyCommon.IsNull(self.SearchCheckbox[field.Name])) {
                                    // self.SearchModel[field.Name] = [];
                                    self.SearchCheckbox[field.Name] = [];
                                }
                                result.push(field);
                            }
                            //如果是文本框like模糊搜索
                            else if (type == "Text" && (!Array.isArray(field.Data) || field.Data.length == 0 || field.Config.DataSourceSqlRemote === true)) {
                                result.push(field);
                            }
                            //如果type没有传
                            else if (self.DiyCommon.IsNull(type)) {
                                result.push(field);
                            }
                            //如果是时间搜索？
                            //如果是 true/false 搜索
                            //  result.push(field)
                        }
                    });
                });
                return result;
            };
        }
    },
    watch: {
        PropsWhere(newVal, oldVal) {
            if (!_u.isEqual(newVal, oldVal)) this.Init();
        },
        ParentFormLoadFinish(newVal) {
            if (newVal === true) this.Init();
        },
        TableChildSysMenuId() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },
        TableChildFkFieldName() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },
        PrimaryTableFieldName() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },
        // 2025-10-29 liucheng新增：监听PropsSysMenuId和PropsTableId的变化，确保OpenTable模式下正确初始化
        PropsSysMenuId() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },
        PropsTableId() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },
        PropsModuleEngineKey() {
            if (this.ParentFormLoadFinish !== false) this.Init();
        },

        // TableChildFkValue: function (newVal, oldVal) {
        //     var self = this;
        //     if (!self.DiyCommon.IsNull(newVal)) {
        //         var value = {};
        //         value[self.TableChildFkFieldName] = newVal;
        //         self.FieldFormDefaultValues=[value];
        //     }else{
        //         self.FieldFormDefaultValues=[];
        //     }
        //     self.Init()
        // },
        //当此控件为子表时，父form关闭弹层时，这个值会变成'空值，也会再一次执行这里的watch
        TableChildTableRowId: function (newVal, oldVal) {
            var self = this;
            if (!self.DiyCommon.IsNull(newVal)) {
                // self.SetFieldFormDefaultValues(newVal);
                if (self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    self.SetFieldFormDefaultValues(newVal);
                } else {
                    //2022-07-23新增也可能不跟主表的Id进行关联
                    if (self.PrimaryTableFieldName) {
                        self.SetFieldFormDefaultValues(self.FatherFormModel_Data[self.PrimaryTableFieldName]);
                    } else {
                        self.SetFieldFormDefaultValues(self.FatherFormModel_Data.Id);
                    }
                }
                //2022-07-13新增
                // if(self.ParentFormLoadFinish !== false){
                //     //如果主表重新打开了其它的rowModel，Field-Form的TableChildTableRowId会变，这里监控到需要重新加载数据
                //     self.Init();
                // }
            } else {
                //2022-02-17 有可能二次开发传过来的FormDefaultValues
                self.FieldFormDefaultValues = { ...self.FormDefaultValues };
            }
            //2022-07-13注释
            if (self.ParentFormLoadFinish !== false) {
                //如果主表重新打开了其它的rowModel，Field-Form的TableChildTableRowId会变，这里监控到需要重新加载数据
                self.Init();
            }
        },
        FatherFormModel: function (newVal, oldVal) {
            var self = this;
            if (!self.DiyCommon.IsNull(newVal)) {
                // self.SetFieldFormDefaultValues(self.TableChildTableRowId);
                if (self.DiyCommon.IsNull(self.FatherFormModel_Data)) {
                    self.SetFieldFormDefaultValues(self.TableChildTableRowId);
                } else {
                    //2022-07-23新增也可能不跟主表的Id进行关联
                    if (self.PrimaryTableFieldName) {
                        self.SetFieldFormDefaultValues(self.FatherFormModel_Data[self.PrimaryTableFieldName]);
                    } else {
                        self.SetFieldFormDefaultValues(self.FatherFormModel_Data.Id);
                    }
                }
            } else {
                //2022-02-17 有可能二次开发传过来的FormDefaultValues
                self.FieldFormDefaultValues = { ...self.FormDefaultValues };
            }
        },
        TableChildField: function (newVal, oldVal) {
            var self = this;
        }
    },
    data() {
        return {
            hbParam1: [], //zhy合并移动端更多搜索和移动端下拉菜单diy-mobile-search组件的搜索参数
            hbParam2: [], //zhy合并移动端更多搜索和移动端下拉菜单diy-mobile-search组件的搜索参数
            hbParam3: [], //zhy合并PC端更多搜索和Pc端外部搜索diy-search组件的搜索参数
            hbParam4: [], //zhy合并PC端更多搜索和Pc端外部搜索diy-search组件的搜索参数
            TableDisplayMode: "", //Table、Card
            ShowDiyModule: false,
            // ========== 定时器ID存储（用于防止内存泄漏） ==========
            _importStepTimer: null,
            _debounceTimer: null,
            // ========== V8引擎字段缓存 ==========
            _cachedDiyFieldList: null,
            _cachedDiyFieldListVersion: 0,
            // ========== 延迟渲染控制标志 ==========
            _shouldRenderDiyCustomDialog: false,
            _shouldRenderDiyFormDialog: false,

            ShowAnyTable: false,
            OpenAnyTableParam: {},
            Where: [],
            PageType: "", //=Report时为报表
            DiyCustomDialogConfig: {},
            // regionData:regionData,
            BtnExportLoading: false,
            NotSaveField: [],
            CurrentTableRowListActiveTab: {},
            //查询列
            TableDiyFieldIds: [],
            Canboda: false,
            CanbodaYinhao: "",
            DevComponents: {},
            TempLoading: {},
            Shangquan_Data: [],
            TableMultipleSelection: [],
            // BtnLoading:false,
            TableSelectedRow: {},
            TableSelectedRowLast: {},
            TableEnableBatch: false,
            //卡片模式批量选择
            cardSelection: [],
            // 性能优化V3：全局共享菜单状态
            _moreMenuVisible: false,
            _moreMenuRow: null,
            _moreMenuPosition: { top: 0, left: 0 },
            // 列头菜单状态
            _colMenuVisible: false,
            _colMenuField: null,
            _colMenuPosition: { top: 0, left: 0 },
            _colFilterOperator: 'Like',
            _colFilterValue: '',
            _colFilters: {}, // { fieldName: { operator, value } }
            _colPageFilterKeyword: '',
            _colPageFilterSelectedValues: [],
            _colPageFilters: {}, // { fieldName: { values } }
            _batchDragPending: false,
            _batchDragSelecting: false,
            _batchDragSelectionMode: true,
            _batchDragSelectionVisited: null,
            _batchDragApplied: null,
            _batchDragStartPoint: null,
            _batchDragStartRow: null,
            _batchDragStartTarget: null,
            _batchDragRect: null,
            _batchDragSuppressClick: false,
            _batchDragBodyUserSelect: null,
            _runtimeHiddenFields: [], // 运行时用户隐藏的列（fieldId数组）
            // 移动端搜索弹窗状态
            showMobileSearch: false,
            cardCompactMode: false,
            // 移动端FAB菜单状态
            showMobileFabMenu: false,
            // 移动端FAB拖拽位置
            fabPosition: null,
            // 索引管理弹窗
            ShowIndexManager: false,
            // BtnLoading:false,
            BtnV8Loading: false,
            ShowAllSearch: false,
            IsTrashMode: false,
            TableRowListActiveTab: "", //TableRowList
            FormMode: "View",
            NeedDiyTemplateFieldLst: ["DevComponent", "TableChild", "Map", "MapArea", "FontAwesome", "ImgUpload"], //'Switch',
            FixedNotShowField: ["Divider", "CollapseGroup", "Tabs", "Alert", "StaticText", "Html", "HTML"], //, 'ImgUpload', 'FileUpload'
            FieldFormDefaultValues: {},
            StatisticsFields: null,
            BtnLoading: false,
            tableLoading: true,
            SearchModel: {},
            SearchEqual: {},
            V8SearchModel: {},
            SearchCheckbox: {},
            SearchDateTime: {},
            SearchNumber: {},
            Keyword: "",
            DiyTableRowList: [],
            OldDiyTableRowList: [],
            DiyTableRowCount: 0,
            CurrentDiyTableModel: {},
            DiyFieldList: [],
            TableId: "",
            TableName: "",
            TableRowId: "",
            CurrentRowModel: {},
            DiyTableRowPageSize: 15,
            DiyTableRowPageIndex: 1,
            ShowDiyFieldList: null,
            // 🔥 性能优化：分批渲染表格列
            _renderedColumnCount: 10, // 首批渲染10列
            _allFieldList: null, // 存储完整字段列表
            // 🔥 性能优化：分批渲染表格行（PC端虚拟滚动），解决大分页(如200条/页)首屏卡顿+内存暴涨
            _lazyRenderInitial: 30,    // 首批渲染行数
            _lazyRenderStep: 50,       // 每次滚动追加渲染行数（大批量更平滑）
            _lazyRenderThreshold: 50,  // 启用懒渲染的阈值（当前页 > 此值时启用）
            _lazyRenderBottomGap: 600, // 距底部多少像素时触发追加渲染（拉大预加载窗口）
            _lazyRenderedCount: 30,    // 当前已渲染的行数
            _lazyScrollHandler: null,  // 滚动事件处理器（缓存，便于解绑）
            _lazyScrollWrapper: null,  // 当前绑定的滚动容器
            _lazyScrollTicking: false, // requestAnimationFrame 节流标记
            _OrderBy: "",
            _OrderByType: "",
            _OrderBys: {},
            SearchFieldIds: [], // SearchFieldIds
            SortFieldIds: [],
            NotShowFields: [],
            FixedFields: [],
            MobileListFields: [],
            SysMenuModel: {},
            SysMenuId: "",
            FieldFormSelectFields: [],
            FieldFormFixedTabs: [],
            FieldFormHideFields: [],
            // SysMenuNeedConvertField: [
            //     "TableDiyFieldIds",
            //     "NotShowFields",
            //     "SearchFieldIds",
            //     "SortFieldIds",
            //     "StatisticsFields",
            //     'MoreBtns',
            // ],
            TempBtnIsVisible: [],
            MaxRowBtnsOut: 0,
            HasVisibleMoreBtnsIn: false,
            ShowUpdateBtn: true,
            ShowDeleteBtn: true,
            ShowSaveBtn: true,
            ShowHideFieldsList: [],
            FatherFormModel_Data: null,
            ParentV8_Data: null,
            LastOrderBy: "",
            FormWF: {},
            CurrentSelectedRowModel: {},
            SearchWhere: [],
            IsVisibleAdd: false, //是否允许新增按钮显示,2025-5-1刘诚（某些条件下不允许新增，代码控制）
            // ========== 内存优化相关 ==========
            _isDestroyed: false, // 组件销毁标志
            _paginationVersion: 0, // 分页版本号，用于取消旧请求的异步操作
            _currentAbortController: null, // 用于取消正在进行的HTTP请求
            _openFormDialogToken: 0, // 打开表单弹窗的异步 token，切菜单/重复点击时取消旧初始化
            _openFormDialogTimer: null,
            // ========== 移动端无限滚动相关 ==========
            mobileLoadingMore: false, // 移动端加载更多数据中
            mobileScrollHandler: null, // 滚动事件处理函数引用
            _mobileMaxRenderCount: 100, // 移动端最大渲染数量（30太少会频繁触发移除，100是平衡点）
            _mobileRemovedCount: 0, // 移动端已移除的数据条数（用于正确显示"已加载xx条"）
            _mobileWindowStart: 0, // 双向滚动：当前窗口起始位置
            _mobileTotalLoaded: 0, // 双向滚动：已加载总数
            _lastLoadTime: 0, // 上次加载完成的时间戳（用于防抖，避免连续触发）
            _savedScrollTop: undefined, // 保存的滚动位置（用于返回时恢复）
            // ========== 表内编辑【提交一起保存】模式 ==========
            // SysMenuModel.SaveType = 'Auto'(默认 值变更实时存) | 'Submit'(提交一起保存)
            // _PendingSaveChanges 仅在 Submit 模式下使用，记录待提交变更
            //   updates: { [rowId]: { __row: rowRef, __dataLog: [...], __snapshot: 完整_FormData } }
            //   adds:    [ rowRef, ... ]
            _PendingSaveChanges: { adds: [], updates: {} },
            _BatchSaveLoading: false
        };
    },
    mounted() {
        var self = this;

        // 🔥 添加明显的日志，确认组件挂载
        console.log('%c[DiyTableRowlist] ========== mounted 被触发 ==========', 'color: blue; font-size: 16px; font-weight: bold');
        console.log('[DiyTableRowlist] 当前路由:', self.$route.fullPath);
        console.log('[DiyTableRowlist] ContainerClass prop 值:', self.ContainerClass);
        console.log('[DiyTableRowlist] PropsTableType 值:', self.PropsTableType);
        console.log('[DiyTableRowlist] 所有 props:', {
            ContainerClass: self.ContainerClass,
            PropsTableType: self.PropsTableType,
            TableChildTableId: self.TableChildTableId,
            TableChildSysMenuId: self.TableChildSysMenuId
        });

        // 记录当前加载的路由，用于 activated 时判断
        self._lastLoadedRoute = self.$route.fullPath;

        self.PageType = self.$route.query.PageType;
        if (self.ParentFormLoadFinish !== false) {
            self.Init();
        }

        // 🔥 监听全局刷新事件
        self._handlePageRefresh = (event) => {
            // 使用 SysMenuId 精确匹配，避免同一个组件的不同实例都被刷新
            if (event.detail && event.detail.sysMenuId && event.detail.sysMenuId === self.SysMenuId) {
                console.log('[DiyTableRowlist] 收到刷新事件，SysMenuId 匹配，重新加载数据');
                // console.log('[DiyTableRowlist] 事件 SysMenuId:', event.detail.sysMenuId, '当前 SysMenuId:', self.SysMenuId);
                self.InitSearch();
                self.Init();
            } else {
                console.log('[DiyTableRowlist] 收到刷新事件，但 SysMenuId 不匹配，忽略');
                // console.log('[DiyTableRowlist] 事件 SysMenuId:', event.detail?.sysMenuId, '当前 SysMenuId:', self.SysMenuId);
            }
        };
        window.addEventListener('page-refresh', self._handlePageRefresh);

        // zhy监听子表格刷新事件，处理审核按钮点击后页面不刷新的问题
        self._handleTableRefresh = (event) => {
            // 使用 SysMenuId 精确匹配，避免同一个组件的不同实例都被刷新
            if (event.detail && event.detail.sysMenuId && event.detail.sysMenuId === self.SysMenuId) {
                // 子表收到刷新事件，SysMenuId 匹配，使用 RefreshDiyTableRowList 重新获取子表数据
                try {
                    // 使用统一的子表刷新方法，保留 param 以便上层传递分页或其它信息
                    var param = event.detail && event.detail.param ? event.detail.param : { _PageIndex: 1 };
                    self.RefreshDiyTableRowList(param);
                } catch (err) {
                    // console.error('调用 RefreshDiyTableRowList 失败，回退到 GetDiyTableRow:', err);
                }
            } else {
                // console.log('子表收到刷新事件，但 SysMenuId 不匹配，忽略');
            }
        };
        window.addEventListener('table-refresh', self._handleTableRefresh);

        // 移动端无限滚动监听
        if (self.diyStore.IsPhoneView) {
            self.initMobileScroll();
        }

        // 加载FAB拖拽位置
        self.LoadFabPosition();
    },
    activated() {
        var self = this;
        // console.log('%c[DiyTableRowlist] ========== activated 被触发 ==========', 'color: green; font-size: 16px; font-weight: bold');
        // console.log('[DiyTableRowlist] 当前路由:', self.$route.fullPath);
        // console.log('[DiyTableRowlist] 上次加载的路由:', self._lastLoadedRoute);
        // console.log('[DiyTableRowlist] 是否移动端模式:', self.diyStore.IsPhoneView);

        // 🔥 移动端特殊处理：从详情页返回列表页时不刷新数据
        // 移动端使用路由跳转方式打开详情页，返回时应保持列表页状态
        // PC端使用 TagsView，需要检查路由变化以支持多标签切换
        // 注意：滚动位置由路由的 scrollBehavior 自动处理（使用 savedPosition）
        if (self.diyStore.IsPhoneView) {
            // zhy当移动端时，默认刷新列表以确保从新增/编辑页面返回时能看到新数据（片区管理板块），主要改动就是新增了！mobileKeep的情况。
            // 如果你希望保留原先不刷新的行为，可在菜单配置中设置：SysMenuModel.MobileKeepState = true
            var mobileKeep = !!(self.SysMenuModel && self.SysMenuModel.MobileKeepState === true);
            if (mobileKeep) {
                // console.log('%c[DiyTableRowlist] 移动端模式，配置要求保持页面状态不刷新', 'color: blue; font-size: 14px');
                // 仍需重新添加滚动监听
                self.initMobileScroll();
                // 恢复滚动位置（如果有）
                if (self._savedScrollTop !== undefined) {
                    self.$nextTick(() => {
                        setTimeout(() => {
                            window.scrollTo(0, self._savedScrollTop);
                            console.log('[DiyTableRowlist] 恢复滚动位置:', self._savedScrollTop);
                        }, 100);
                    });
                }
                return;
            }

            // 重新添加滚动监听
            self.initMobileScroll();
            // 执行刷新（重建搜索并初始化）
            try {
                self.InitSearch();
                self.Init();
            } catch (err) {
                console.warn('[DiyTableRowlist] 移动端刷新失败：', err);
            }
            // 恢复滚动位置（若存在），在下一次 DOM 更新后执行
            if (self._savedScrollTop !== undefined) {
                self.$nextTick(() => {
                    setTimeout(() => {
                        window.scrollTo(0, self._savedScrollTop);
                        console.log('[DiyTableRowlist] 恢复滚动位置:', self._savedScrollTop);
                    }, 150);
                });
            }
            return;
        }

        // PC端：检查路由是否发生变化（这种情况发生在标签数超过 max 时，组件被销毁后又被重用）
        if (self._lastLoadedRoute && self._lastLoadedRoute !== self.$route.fullPath) {
            console.log('%c[DiyTableRowlist] 检测到路由变化，重新初始化', 'color: orange; font-size: 13px; font-weight: bold');
            // 更新记录的路由
            self._lastLoadedRoute = self.$route.fullPath;
            // 重新初始化
            self.InitSearch();
            self.Init();
        }
    },
    deactivated() {
        var self = this;
        console.log('%c[DiyTableRowlist] ========== deactivated 被触发 ==========', 'color: orange; font-size: 13px; font-weight: bold');

        // 保存当前滚动位置（移动端）
        if (self.diyStore.IsPhoneView) {
            self._savedScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            console.log('[DiyTableRowlist] 保存滚动位置:', self._savedScrollTop);
        }

        // 移除滚动监听
        if (self.mobileScrollHandler) {
            window.removeEventListener('scroll', self.mobileScrollHandler);
        }
    },
};
