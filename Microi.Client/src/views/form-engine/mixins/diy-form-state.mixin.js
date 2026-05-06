export default {
    computed: {
        // ==================== 性能优化：预计算根元素 class ====================
        rootClass() {
            var self = this;
            var classes = [
                'itdos-diy-form',
                'diy-form'
            ];
            if (!self.DiyCommon.IsNull(self.TableId)) {
                classes.push('itdos-diy-form-' + self.TableId);
            }
            if (!self.DiyCommon.IsNull(self.TableName)) {
                classes.push('itdos-diy-form-' + self.TableName);
            }
            classes.push(self.DiyCommon.IsNull(self.DiyTableModel.InputBorderStyle) ? 'Border' : self.DiyTableModel.InputBorderStyle);
            return classes.join(' ');
        },
        // ==================== 性能优化：预计算 tabs class ====================
        tabsClass() {
            var self = this;
            if (self.FormTabs.length == 1 &&
                (self.FormTabs[0].Name == 'none' || self.FormTabs[0].Name == 'info' || !self.FormTabs[0].Name)) {
                return 'field-form-tabs tab-pane-hide';
            }
            return 'field-form-tabs tab-pane-show';
        },
        // ==================== 性能优化：预计算表单容器 class ====================
        formContainerClass() {
            var self = this;
            var classes = [self.DiyTableModel.Name || '', 'field-form'];
            if (self.DiyTableModel.FieldBorder === 'Border') {
                classes.push('field-border');
            }
            return classes.join(' ');
        },
        GetDiyFieldListObject: {
            get() {
                var self = this;
                var result = {};
                self.DiyFieldList.forEach((element) => {
                    result[element.Name] = element;
                });
                return result;
            }
        },
        // 性能优化：预先按 tab 分组字段，避免在 v-for 中每次渲染都重新计算
        // 同时预计算每个字段的显示状态、span、class 等，减少模板中的方法调用
        // 🔥 新增：支持分批渲染，首次只渲染部分字段，后续按需加载
        // ⚠️ 内存优化：避免在计算属性中创建闭包，使用纯计算逻辑
        DiyFieldListGrouped() {
            var self = this;
            var grouped = {};

            // 边界检查：确保数据已初始化
            if (!self.DiyFieldList || self.DiyFieldList.length === 0) {
                return grouped;
            }

            // 使用 FormTabs 而非 GetShowTabs()，确保与模板中的 v-for 一致
            var showTabs = self.FormTabs;
            if (!showTabs || showTabs.length === 0) {
                return grouped;
            }

            // 触发依赖收集：确保这些属性变化时重新计算
            // ⚠️ 内存优化：不要在这里创建数组，只读取值
            var _deps = [
                self.ColSpan,
                self.DiyTableModel.ColSpan,
                self.ShowFields.length,
                self.HideFields.length,
                self.DiyTableModel.DisplayDefaultField
            ];
            // 🔥 渲染字段数量变化时重新计算（使用 JSON.stringify 避免对象引用）
            var _renderedCountsKey = JSON.stringify(self.renderedFieldCounts);
            var _collapseGroupStateKey = JSON.stringify(self.CollapseGroupState || {});

            var tabNameSet = new Set();

            // 收集所有有效的 tab 标识
            showTabs.forEach((tabModel) => {
                if (tabModel) {
                    tabNameSet.add(tabModel.Name);
                    tabNameSet.add(tabModel.Id);
                }
            });

            // 初始化每个 tab 的数组
            showTabs.forEach((tab) => {
                if (tab) {
                    var key = tab.Id || tab.Name;
                    if (key) {
                        grouped[key] = [];
                    }
                }
            });

            // 预计算常用值，避免循环中重复计算
            var isDesignMode = self.LoadMode === "Design";

            // 防御性检查：确保所有必要的数据都已准备好
            if (!self.DiyTableModel || typeof self.DiyTableModel !== 'object' || self.DiyTableModel instanceof Promise) {
                return grouped;
            }
            if (!self.DiyCommon || !self.GetCurrentUser) {
                return grouped;
            }

            var displayDefaultField = self.DiyTableModel.DisplayDefaultField;
            var defaultFieldNames = self.DiyCommon.DefaultFieldNames || [];
            var isAdmin = self.GetCurrentUser._IsAdmin === true;
            var userRoles = self.GetCurrentUser._Roles || [];
            var defaultColSpan = self.DiyTableModel.ColSpan || 12;
            var propsColSpan = self.ColSpan;

            // 遍历字段，分配到对应的 tab，并预计算属性
            self.DiyFieldList.forEach((field) => {
                // 🔥 添加字段有效性检查
                if (!field || typeof field !== 'object') {
                    console.warn('[diy-form] DiyFieldListGrouped: 跳过无效字段', field);
                    return;
                }

                // 判断字段是否应该显示（在 ShowFields/HideFields 中）
                var shouldShow = self.ShowHideField === true ||
                    ((self.ShowFields.length === 0 || self.ShowFields.indexOf(field.Name) > -1) &&
                     self.HideFields.indexOf(field.Name) === -1);

                if (!shouldShow) return;

                // ==================== 预计算 _isShow ====================
                var isShow = true;
                // 检查是否是默认审计字段
                if (defaultFieldNames.indexOf(field.Name) > -1 && !displayDefaultField) {
                    isShow = false;
                } else if (isDesignMode) {
                    isShow = true;
                } else if (!self.DiyCommon.IsNull(field.BindRole) && field.BindRole.length > 0) {
                    // 检查角色权限
                    if (!isAdmin) {
                        var haveLimit = false;
                        if (userRoles.length > 0) {
                            for (var i = 0; i < field.BindRole.length; i++) {
                                for (var j = 0; j < userRoles.length; j++) {
                                    if (userRoles[j].Id && userRoles[j].Id.toLowerCase() === field.BindRole[i].toLowerCase()) {
                                        haveLimit = true;
                                        break;
                                    }
                                }
                                if (haveLimit) break;
                            }
                        }
                        if (!haveLimit) {
                            isShow = false;
                        }
                    }
                }
                // 最终检查 Visible 属性
                if (isShow && !isDesignMode) {
                    isShow = self.FieldIsVisible(field);//self.DiyCommon.IsNull(field.Visible) ? true : field.Visible;
                }
                field._isShow = isShow;

                // ==================== 预计算 _span ====================
                field._span = self.GetDiyTableColumnSpan(field);

                // ==================== 预计算 _class ====================
                var fieldClass = 'field-item field_' + field.Name + ' field_' + field.Component;
                field._class = fieldClass;
                field._activeClass = fieldClass + ' active-field';

                // 找到字段所属的 tab
                var assigned = false;
                showTabs.forEach((tab) => {
                    if (!tab) return;
                    var key = tab.Id || tab.Name;
                    if (key && grouped[key] && (field.Tab === tab.Name || field.Tab === tab.Id)) {
                        grouped[key].push(field);
                        assigned = true;
                    }
                });

                // 如果没有分配到任何 tab，放到第一个 tab
                if (!assigned && showTabs.length > 0) {
                    var firstTab = showTabs[0];
                    if (firstTab) {
                        var firstKey = firstTab.Id || firstTab.Name;
                        // 未分配的字段都放到第一个 tab
                        if (firstKey && grouped[firstKey]) {
                            grouped[firstKey].push(field);
                        }
                    }
                }
            });

            // 🔥 关键修复：分组后按 Sort 值排序，确保拖动后顺序正确持久化
            showTabs.forEach((tab) => {
                var key = tab.Id || tab.Name;
                if (key && grouped[key]) {
                    grouped[key].sort((a, b) => (a.Sort || 0) - (b.Sort || 0));
                    self.ApplyCollapseGroupState(grouped[key], key);
                }
            });

            // 🔥 性能优化：分批渲染 - 只返回已渲染的字段
            // 对每个 tab 的字段列表进行截取，实现渐进式渲染
            var limitedGrouped = {};
            showTabs.forEach((tab) => {
                var key = tab.Id || tab.Name;
                if (key && grouped[key]) {
                    var allFields = grouped[key];
                    var renderedCount = self.renderedFieldCounts[key] || self.BATCH_SIZE_FIRST;
                    // 限制返回的字段数量
                    limitedGrouped[key] = allFields.slice(0, renderedCount);

                    // 如果还有未渲染的字段，安排下一批渲染
                    if (renderedCount < allFields.length && !self._isDestroyed) {
                        self.safeTimeout(() => {
                            if (self._isDestroyed) return;
                            self.renderedFieldCounts[key] = Math.min(
                                renderedCount + self.BATCH_SIZE_NEXT,
                                allFields.length
                            );
                        }, 100); // 100ms 后渲染下一批
                    }
                }
            });
            console.log('limitedGrouped',limitedGrouped);
            return limitedGrouped;
        },
    },
    methods: {
        ApplyCollapseGroupState(fields, tabKey) {
            var self = this;
            if (!Array.isArray(fields) || fields.length === 0) {
                return fields;
            }

            fields.forEach((field) => {
                if (!field || typeof field !== "object") return;
                field._collapseHidden = false;
                field._collapsedByFieldId = "";
                field._collapseChildCount = 0;
                field._collapseCollapsed = false;
                field._collapseGroupTheme = "";
                field._collapseGroupIndex = -1;
                field._collapseGroupChildIndex = -1;
            });

            fields.forEach((field, index) => {
                if (!field || field.Component !== "CollapseGroup") return;

                var groupConfig = (field.Config && field.Config.CollapseGroup) || {};
                var stateKey = field.Id || field.Name || (tabKey + "_" + index);
                var hasState = self.CollapseGroupState && Object.prototype.hasOwnProperty.call(self.CollapseGroupState, stateKey);
                var defaultCollapsed = groupConfig.DefaultCollapsed === true || groupConfig.DefaultCollapsed === 1 || groupConfig.DefaultCollapsed === "true";
                var collapsed = hasState ? self.CollapseGroupState[stateKey] : defaultCollapsed;
                var scopeMode = groupConfig.ScopeMode || "UntilNextGroup";
                var theme = groupConfig.Theme || "default";
                var fieldCount = parseInt(groupConfig.FieldCount, 10);
                if (!fieldCount || fieldCount < 1) {
                    fieldCount = 10;
                }

                field._collapseCollapsed = collapsed;
                field._collapseGroupTheme = theme;
                field._class += " collapse-group-header collapse-group-theme-" + theme + (collapsed ? " collapse-group-collapsed" : " collapse-group-expanded");
                field._activeClass += " collapse-group-header collapse-group-theme-" + theme + (collapsed ? " collapse-group-collapsed" : " collapse-group-expanded");
                var childCount = 0;
                var childFields = [];

                for (var childIndex = index + 1; childIndex < fields.length; childIndex++) {
                    var childField = fields[childIndex];
                    if (!childField) continue;
                    if (childField.Component === "CollapseGroup") {
                        break;
                    }

                    childCount++;
                    childFields.push(childField);
                    childField._collapseGroupTheme = theme;
                    childField._collapseGroupIndex = index;
                    childField._collapseGroupChildIndex = childCount - 1;
                    childField._class += " collapse-group-item collapse-group-theme-" + theme;
                    childField._activeClass += " collapse-group-item collapse-group-theme-" + theme;

                    if (collapsed) {
                        childField._collapseHidden = true;
                        childField._collapsedByFieldId = stateKey;
                        childField._isShow = false;
                    }

                    if (scopeMode === "FieldCount" && childCount >= fieldCount) {
                        break;
                    }
                }

                field._collapseChildCount = childCount;
                childFields.forEach((childField, childFieldIndex) => {
                    if (childFieldIndex === 0) {
                        childField._class += " collapse-group-first";
                        childField._activeClass += " collapse-group-first";
                    }
                    if (childFieldIndex === childFields.length - 1) {
                        childField._class += " collapse-group-last";
                        childField._activeClass += " collapse-group-last";
                    }
                });
            });

            return fields;
        },
        handleGroupCollapseChange(field, collapsed) {
            var self = this;
            if (!field) return;
            var stateKey = field.Id || field.Name;
            if (!stateKey) return;
            field._collapseCollapsed = collapsed;
            self.CollapseGroupState = {
                ...self.CollapseGroupState,
                [stateKey]: collapsed
            };
        }
    },
    data() {
        const self = this;
        return {
            // 宽度调整相关
            resizingField: null,
            resizeStartX: 0,
            resizeStartWidth: 0,

            currentTabIndex: 0,
            PageType: "", //可以是Report
            FormTabs: [],
            CollapseGroupState: {},
            // 性能优化：跟踪已渲染的标签页，实现懒加载
            // Set 结构存储已渲染的 tab id/name，首次只渲染第一个 tab
            renderedTabs: new Set(),
            // 性能优化：渐进式渲染字段
            // 每个 tab 已渲染的字段数量（tab key -> number）
            renderedFieldCounts: {},
            // 每批渲染的字段数量（首批20个，后续每批10个）
            BATCH_SIZE_FIRST: 20,
            BATCH_SIZE_NEXT: 10,
            BtnLoading: false,
            GetDiyTableRowModelFinish: false,
            DiyCustomDialogConfig: {},
            NotSaveField: [],
            DiyImgUploadRealPath: [],
            DiyFileUploadRealPath: [],
            LoadMap: true,
            pageLifetimes: {
                show: function (e) {}
            },
            DevComponents: {},
            IsFirstLoadForm: true,
            // V8 基础对象实例（存储通用函数，避免每次重新创建）
            _V8BaseInstance: null,
            searchOption: {
                // city: '宁波', //默认全国
                // citylimit: true //默认false
            },
            AmapDefaultCenter: [121.547481, 29.809263],
            BaiduMapDefaultCenter: {
                lng: 121.547481,
                lat: 29.809263
            },

            ueditorConfig: {
                // 如果需要上传功能,找后端小伙伴要服务器接口地址
                serverUrl: this.DiyCommon.GetApiBase() + "/UEditor/Upload",
                // 你的UEditor资源存放的路径,相对于打包后的index.html
                UEDITOR_HOME_URL: "./static/js/neditor/",
                // 编辑器不自动被内容撑高
                autoHeightEnabled: false,
                // 初始容器高度
                initialFrameHeight: 500,
                // initialFrameHeight: '100%',
                // 初始容器宽度
                initialFrameWidth: "100%",
                // 关闭自动保存
                enableAutoSave: true,
                imageUrlPrefix: this.DiyCommon.GetFileServer(), // "https://static.itdos.com/", // by itdos.com
                scrawlUrlPrefix: this.DiyCommon.GetFileServer(), //"https://static.itdos.com/",
                videoUrlPrefix: this.DiyCommon.GetFileServer(), //"https://static.itdos.com/",
                fileUrlPrefix: this.DiyCommon.GetFileServer() //"https://static.itdos.com/",
            },
            FieldActiveTab: "",
            // 这是最终表单填写后的值. 这里命令可能有点问题，应该是取名CurrentDiyTableRowModel？
            //2020-07-28 这里临时注释 ，采用computed去实现，
            FormDiyTableModel: {},
            OldForm: {},
            OldFormData: {},
            DiyTableModel: {
                Tabs: []
            },
            DiyFieldList: [],
            LoadDiyFieldList: false,
            CurrentDiyFieldModel: {},
            // CurrentDiyTableRowModel:{},//2020-07-09：这个存在的意义是什么？暂时注释
            FormRules: {},
            ModifiedFields: [],
            // 用于存储需要清理的定时器
            _pendingTimers: [],
            // 用于标记组件是否已销毁
            _isDestroyed: false,
            // 用于存储需要清理的 watcher 取消函数
            _unwatchCallbacks: [],
            // 字段操作工具栏状态
            fieldToolbarVisible: false,
            fieldToolbarPosition: { top: 0, left: 0 },
            selectedFieldForToolbar: null,
            // 宽度调整
            isResizingWidth: false,
            resizeStartX: 0,
            resizeStartWidth: 0,

            // 延迟渲染 DiyFormDialog，防止 Page 模式下无限嵌套
            _shouldRenderDiyFormDialog: false
        };
    },
    beforeCreate() {
        var self = this;
    },
    beforeUpdate() {},
    beforeEnter: (to, from, next) => {},
    unmounted() {},
        beforeRouteLeave(to, from, next) {
        // ...
    },
    mounted() {
        var self = this;
        // 2026-03-25 修复：只在通过 TableId 加载时使用路由的 PageType
        // 通过 TableName 加载的系统表(diy_field、diy_table)不应进入 Report 模式
        // 避免 diy-design 右侧属性面板的 DiyForm 在 Report 模式下
        // 因无 TableId 过滤条件而加载全部 diy_field 记录，导致死循环
        if (self.TableId) {
            self.PageType = self.$route.query.PageType || '';
        }
        self.$nextTick(function () {
            // removed debug log
        });
        // Vue 3 不再需要 $set，此调试代码已跳过
        // 在 Vue 3 中，响应式系统可以自动追踪属性的添加和删除
        // 2026-02-05 Anderson：没必要让外部每次去调用 Init()，组件实现自动初始化
        // 2026-04-13 Fix：条件改为"有标识时才自动Init"，避免工作流等场景下 TableId 还是空值时
        // 就提前 Init() 导致 GetDiyFieldList 报"参数错误"（工作流中 TableId 由 InitSendWork 延迟设置）
        // 2026-04-17 Fix：通过 AutoInit prop 控制是否自动初始化。
        // 父组件手动调用 Init() 的场景（如 diy-form-full Dialog/Drawer、RightForm、workflow 等）传入 :AutoInit="false"，
        // 其余场景（diy-design 字段/表属性编辑、Page 模式等）默认 AutoInit=true，挂载后自动初始化。
        if((self.TableName || self.TableId) && self.AutoInit){
            self.Init();
        }
    },
};
