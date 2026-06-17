import { formTrace, isAdvancedFieldLayoutRuntimeEnabled } from "@/utils/form-engine-trace.js";

export default {
    watch: {
        ShowHideField() {
            this.ScheduleRefreshDiyFieldRuntimeState();
        },
        ShowFields: {
            deep: true,
            handler() {
                this.ScheduleRefreshDiyFieldRuntimeState();
            }
        },
        HideFields: {
            deep: true,
            handler() {
                this.ScheduleRefreshDiyFieldRuntimeState();
            }
        }
    },
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
        // 注意：computed 必须保持纯计算，不能写 field._xxx，否则会触发 ElRow 递归更新。
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

            // 初始化每个 tab 的数组
            showTabs.forEach((tab) => {
                if (tab) {
                    var key = tab.Id || tab.Name;
                    if (key) {
                        grouped[key] = [];
                    }
                }
            });

            // 防御性检查：确保所有必要的数据都已准备好
            if (!self.DiyTableModel || typeof self.DiyTableModel !== 'object' || self.DiyTableModel instanceof Promise) {
                return grouped;
            }
            if (!self.DiyCommon || !self.GetCurrentUser) {
                return grouped;
            }

            // 遍历字段，分配到对应的 tab。这里不能写字段运行态属性。
            self.DiyFieldList.forEach((field) => {
                // 🔥 添加字段有效性检查
                if (!field || typeof field !== 'object') {
                    console.warn('[diy-form] DiyFieldListGrouped: 跳过无效字段', field);
                    return;
                }

                // 判断字段是否应该显示（在 ShowFields/HideFields 中）
                var shouldShow = self.CanShowHiddenFields() ||
                    ((self.ShowFields.length === 0 || self.ShowFields.indexOf(field.Name) > -1) &&
                     self.HideFields.indexOf(field.Name) === -1);

                if (!shouldShow) return;

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
                }
            });
            return grouped;
        },
    },
    methods: {
        CanShowHiddenFields() {
            var self = this;
            var currentUser = self.GetCurrentUser || {};
            var isAdmin = currentUser._IsAdmin === true || currentUser._IsAdmin === 1 || currentUser._IsAdmin === "1" || currentUser._IsAdmin === "true";
            return self.ShowHideField === true && isAdmin;
        },
        ScheduleRefreshDiyFieldRuntimeState() {
            var self = this;
            if (typeof self.RefreshDiyFieldRuntimeState !== "function") {
                return;
            }
            if (self._runtimeRefreshScheduled) {
                formTrace("runtime:schedule-skip", {
                    table: self.DiyTableModel && self.DiyTableModel.Name,
                    loadMode: self.LoadMode
                });
                return;
            }
            self._runtimeRefreshScheduled = true;
            formTrace("runtime:schedule", {
                table: self.DiyTableModel && self.DiyTableModel.Name,
                loadMode: self.LoadMode
            });
            self.$nextTick(function () {
                self._runtimeRefreshScheduled = false;
                if (self._isDestroyed) {
                    formTrace("runtime:schedule-cancel-destroyed", {
                        table: self.DiyTableModel && self.DiyTableModel.Name
                    });
                    return;
                }
                self.RefreshDiyFieldRuntimeState();
            });
        },
        IsSameFieldRuntimeValue(key, oldValue, newValue) {
            if (oldValue === newValue) return true;
            if (key === "_fieldTabsPanes" && Array.isArray(oldValue) && Array.isArray(newValue)) {
                if (oldValue.length !== newValue.length) return false;
                try {
                    return JSON.stringify(oldValue) === JSON.stringify(newValue);
                } catch (e) {
                    return false;
                }
            }
            return false;
        },
        SetFieldRuntimeValue(field, key, value) {
            if (field && !this.IsSameFieldRuntimeValue(key, field[key], value)) {
                field[key] = value;
            }
        },
        SetFieldRuntimeValueOnce(field, key, value) {
            if (!field) return;
            if (field[key] === undefined || field[key] === null || field[key] === "") {
                this.SetFieldRuntimeValue(field, key, value);
            }
        },
        GetBaseFieldIsShow(field) {
            var self = this;
            if (!field) return false;

            if (self.CanShowHiddenFields()) {
                return true;
            }

            if ((self.DiyCommon.DefaultFieldNames || []).indexOf(field.Name) > -1 && !self.DiyTableModel.DisplayDefaultField) {
                return false;
            }

            if (self.LoadMode === "Design") {
                return true;
            }

            if (!self.DiyCommon.IsNull(field.BindRole) && field.BindRole.length > 0 && self.GetCurrentUser._IsAdmin !== true) {
                var userRoles = self.GetCurrentUser._Roles || [];
                var haveLimit = false;
                for (var i = 0; i < field.BindRole.length; i++) {
                    for (var j = 0; j < userRoles.length; j++) {
                        if (userRoles[j].Id && userRoles[j].Id.toLowerCase() === field.BindRole[i].toLowerCase()) {
                            haveLimit = true;
                            break;
                        }
                    }
                    if (haveLimit) break;
                }
                if (!haveLimit) return false;
            }

            return self.FieldIsVisible(field);
        },
        ApplyBaseFieldRuntimeState(field) {
            var self = this;
            if (!field || typeof field !== "object") return;
            var isShow = self.GetBaseFieldIsShow(field);
            var fieldClass = 'field-item field_' + field.Name + ' field_' + field.Component;
            self.SetFieldRuntimeValue(field, '_isShow', isShow);
            self.SetFieldRuntimeValue(field, '_baseIsShow', isShow);
            self.SetFieldRuntimeValue(field, '_span', self.GetDiyTableColumnSpan(field));
            self.SetFieldRuntimeValue(field, '_class', fieldClass);
            self.SetFieldRuntimeValue(field, '_activeClass', fieldClass + ' active-field');
        },
        ShouldUseAdvancedFieldLayoutRuntime() {
            var enabled = isAdvancedFieldLayoutRuntimeEnabled();
            if (!enabled && !this._advancedFieldLayoutRuntimeDisabledLogged) {
                this._advancedFieldLayoutRuntimeDisabledLogged = true;
                formTrace("runtime:advanced-layout-disabled", {
                    table: this.DiyTableModel && this.DiyTableModel.Name,
                    tableId: this.DiyTableModel && this.DiyTableModel.Id,
                    loadMode: this.LoadMode
                });
            }
            if (enabled) {
                formTrace("runtime:advanced-layout-enabled", {
                    table: this.DiyTableModel && this.DiyTableModel.Name,
                    loadMode: this.LoadMode
                });
            }
            return enabled;
        },
        ResetAdvancedFieldLayoutRuntime(fields) {
            var self = this;
            if (!Array.isArray(fields)) return;
            formTrace("runtime:reset-advanced-layout", {
                table: self.DiyTableModel && self.DiyTableModel.Name,
                loadMode: self.LoadMode,
                fieldCount: fields.length,
                collapseCount: fields.filter((field) => field && field.Component === "CollapseGroup").length,
                tabsCount: fields.filter((field) => field && field.Component === "Tabs").length
            });
            fields.forEach((field) => {
                if (!field || typeof field !== "object") return;
                self.SetFieldRuntimeValue(field, "_collapseHidden", false);
                self.SetFieldRuntimeValue(field, "_collapsedByFieldId", "");
                self.SetFieldRuntimeValue(field, "_collapseChildCount", 0);
                self.SetFieldRuntimeValue(field, "_collapseCollapsed", false);
                self.SetFieldRuntimeValue(field, "_collapseGroupTheme", "");
                self.SetFieldRuntimeValue(field, "_collapseGroupIndex", -1);
                self.SetFieldRuntimeValue(field, "_collapseGroupChildIndex", -1);
                self.SetFieldRuntimeValue(field, "_collapseStateKey", "");
                self.SetFieldRuntimeValue(field, "_collapseClass", "");
                self.SetFieldRuntimeValue(field, "_fieldTabsHidden", false);
                self.SetFieldRuntimeValue(field, "_fieldTabsStateKey", "");
                self.SetFieldRuntimeValue(field, "_fieldTabsActiveKey", "");
                self.SetFieldRuntimeValue(field, "_fieldTabsPaneKey", "");
                self.SetFieldRuntimeValue(field, "_fieldTabsPaneTitle", "");
                self.SetFieldRuntimeValue(field, "_fieldTabsPaneIndex", -1);
                self.SetFieldRuntimeValue(field, "_fieldTabsChildCount", 0);
                self.SetFieldRuntimeValue(field, "_fieldTabsPanes", []);
                self.SetFieldRuntimeValue(field, "_isShow", field._baseIsShow !== false);
            });
        },
        RefreshDiyFieldRuntimeState(tabKey) {
            var self = this;
            if (self._runtimeRefreshing) {
                formTrace("runtime:refresh-skip-reentry", {
                    table: self.DiyTableModel && self.DiyTableModel.Name,
                    tabKey: tabKey
                });
                return;
            }
            if (!Array.isArray(self.DiyFieldList) || self.DiyFieldList.length === 0) {
                formTrace("runtime:refresh-skip-empty", {
                    table: self.DiyTableModel && self.DiyTableModel.Name,
                    tabKey: tabKey
                });
                return;
            }

            self._runtimeRefreshing = true;
            try {
                formTrace("runtime:refresh-start", {
                    table: self.DiyTableModel && self.DiyTableModel.Name,
                    tableId: self.DiyTableModel && self.DiyTableModel.Id,
                    loadMode: self.LoadMode,
                    tabKey: tabKey,
                    fieldCount: self.DiyFieldList.length
                });
                self.DiyFieldList.forEach((field) => {
                    self.ApplyBaseFieldRuntimeState(field);
                });

                var grouped = self.DiyFieldListGrouped || {};
                Object.keys(grouped).forEach((key) => {
                    if (tabKey && key !== tabKey) return;
                    if (self.ShouldUseAdvancedFieldLayoutRuntime()) {
                        self.ApplyCollapseGroupState(grouped[key], key);
                        self.ApplyFieldTabsState(grouped[key], key);
                    } else {
                        self.ResetAdvancedFieldLayoutRuntime(grouped[key]);
                    }
                });
                formTrace("runtime:refresh-end", {
                    table: self.DiyTableModel && self.DiyTableModel.Name,
                    tabKey: tabKey
                });
            } finally {
                self._runtimeRefreshing = false;
            }
        },
        GetCollapseStateKey(field, tabKey, index) {
            return field.Id || field.Name || (tabKey + "_" + index);
        },
        GetCollapseGroupConfig(field) {
            return (field && field.Config && field.Config.CollapseGroup) ? field.Config.CollapseGroup : {};
        },
        ApplyCollapseGroupState(fields, tabKey) {
            var self = this;
            if (!Array.isArray(fields) || fields.length === 0) {
                return fields;
            }
            formTrace("runtime:collapse-start", {
                table: self.DiyTableModel && self.DiyTableModel.Name,
                tabKey: tabKey,
                fieldCount: fields.length
            });

            var metaMap = new Map();
            fields.forEach((field) => {
                if (!field || typeof field !== "object") return;
                metaMap.set(field, {
                    _collapseHidden: false,
                    _collapsedByFieldId: "",
                    _collapseChildCount: 0,
                    _collapseCollapsed: false,
                    _collapseGroupTheme: "",
                    _collapseGroupIndex: -1,
                    _collapseGroupChildIndex: -1,
                    _collapseStateKey: "",
                    _collapseClass: "",
                    _isShow: field._baseIsShow !== false
                });
            });

            fields.forEach((field, index) => {
                if (!field || field.Component !== "CollapseGroup") return;

                var groupConfig = self.GetCollapseGroupConfig(field);
                var stateKey = self.GetCollapseStateKey(field, tabKey, index);
                var hasState = self.CollapseGroupState && Object.prototype.hasOwnProperty.call(self.CollapseGroupState, stateKey);
                var defaultCollapsed = groupConfig.DefaultCollapsed === true || groupConfig.DefaultCollapsed === 1 || groupConfig.DefaultCollapsed === "true";
                var collapsed = hasState ? self.CollapseGroupState[stateKey] : defaultCollapsed;
                self.ApplyCollapseGroupVisualState(fields, index, tabKey, collapsed, metaMap);
            });

            fields.forEach((field) => {
                var meta = metaMap.get(field);
                if (!meta) return;
                Object.keys(meta).forEach((key) => {
                    self.SetFieldRuntimeValue(field, key, meta[key]);
                });
            });

            formTrace("runtime:collapse-end", {
                table: self.DiyTableModel && self.DiyTableModel.Name,
                tabKey: tabKey
            });

            return fields;
        },
        ApplyCollapseGroupVisualState(fields, groupIndex, tabKey, collapsed, metaMap) {
            var self = this;
            var field = fields[groupIndex];
            if (!field || field.Component !== "CollapseGroup") return;
            if (!metaMap) {
                metaMap = new Map();
                fields.forEach((item) => {
                    if (!item) return;
                    metaMap.set(item, {
                        _collapseHidden: false,
                        _collapsedByFieldId: "",
                        _collapseChildCount: 0,
                        _collapseCollapsed: false,
                        _collapseGroupTheme: "",
                        _collapseGroupIndex: -1,
                        _collapseGroupChildIndex: -1,
                        _collapseStateKey: "",
                        _collapseClass: "",
                        _isShow: item._baseIsShow !== false
                    });
                });
            }

            var groupConfig = self.GetCollapseGroupConfig(field);
            var stateKey = self.GetCollapseStateKey(field, tabKey, groupIndex);
            var scopeMode = groupConfig.ScopeMode || "UntilNextGroup";
            var theme = groupConfig.Theme || "default";
            var fieldCount = parseInt(groupConfig.FieldCount, 10);
            if (!fieldCount || fieldCount < 1) {
                fieldCount = 10;
            }

            var groupMeta = metaMap.get(field);
            if (groupMeta) {
                groupMeta._collapseStateKey = stateKey;
                groupMeta._collapseCollapsed = collapsed;
                groupMeta._collapseGroupTheme = theme;
                groupMeta._collapseClass = "collapse-group-header collapse-group-theme-" + theme + (collapsed ? " collapse-group-collapsed" : " collapse-group-expanded");
            }

            var childFields = [];
            for (var childIndex = groupIndex + 1; childIndex < fields.length; childIndex++) {
                var childField = fields[childIndex];
                if (!childField) continue;
                if (childField.Component === "CollapseGroup" || childField.Component === "Tabs") {
                    break;
                }

                childFields.push(childField);
                if (scopeMode === "FieldCount" && childFields.length >= fieldCount) {
                    break;
                }
            }

            var visibleChildFields = [];
            childFields.forEach((childField, childFieldIndex) => {
                var baseVisible = childField._baseIsShow !== false;
                var childMeta = metaMap.get(childField);
                if (childMeta) {
                    childMeta._collapseGroupTheme = theme;
                    childMeta._collapseGroupIndex = groupIndex;
                    childMeta._collapseGroupChildIndex = childFieldIndex;
                    childMeta._collapseHidden = collapsed;
                    childMeta._collapsedByFieldId = collapsed ? stateKey : "";
                    childMeta._isShow = baseVisible && !collapsed;
                    childMeta._collapseClass = "collapse-group-item collapse-group-theme-" + theme + (baseVisible ? "" : " collapse-group-origin-hidden");
                }
                if (baseVisible) {
                    visibleChildFields.push(childField);
                }
            });

            if (groupMeta) {
                groupMeta._collapseChildCount = visibleChildFields.length;
            }
            self.ApplyCollapseGroupRowClasses(visibleChildFields, metaMap);
        },
        ApplyCollapseGroupRowClasses(visibleChildFields, metaMap) {
            if (!Array.isArray(visibleChildFields) || visibleChildFields.length === 0) return;

            var rows = [];
            var currentRow = [];
            var currentSpan = 0;
            var pushCurrentRow = function () {
                if (currentRow.length > 0) {
                    rows.push(currentRow);
                    currentRow = [];
                    currentSpan = 0;
                }
            };

            visibleChildFields.forEach((childField) => {
                var span = parseInt(childField._span || childField.FormWidth || 24, 10);
                if (!span || span < 1) span = 24;
                if (span > 24) span = 24;

                if (currentRow.length > 0 && currentSpan + span > 24) {
                    pushCurrentRow();
                }
                currentRow.push(childField);
                currentSpan += span;
                if (currentSpan >= 24) {
                    pushCurrentRow();
                }
            });
            pushCurrentRow();

            var firstMeta = metaMap.get(visibleChildFields[0]);
            var lastMeta = metaMap.get(visibleChildFields[visibleChildFields.length - 1]);
            if (firstMeta) firstMeta._collapseClass += " collapse-group-visible-first";
            if (lastMeta) lastMeta._collapseClass += " collapse-group-visible-last";

            rows.forEach((row, rowIndex) => {
                var rowSpan = row.reduce(function (total, childField) {
                    var span = parseInt(childField._span || childField.FormWidth || 24, 10);
                    if (!span || span < 1) span = 24;
                    if (span > 24) span = 24;
                    return total + span;
                }, 0);
                var rowRemain = Math.max(0, 24 - rowSpan);
                row.forEach((childField, colIndex) => {
                    var childMeta = metaMap.get(childField);
                    if (!childMeta) return;
                    var childSpan = parseInt(childField._span || childField.FormWidth || 24, 10);
                    if (!childSpan || childSpan < 1) childSpan = 24;
                    if (childSpan > 24) childSpan = 24;
                    childMeta._collapseClass += " collapse-group-row collapse-group-row-" + rowIndex;
                    if (rowIndex === 0) childMeta._collapseClass += " collapse-group-row-first";
                    if (rowIndex === rows.length - 1) childMeta._collapseClass += " collapse-group-row-last";
                    if (colIndex === 0) childMeta._collapseClass += " collapse-group-row-start";
                    if (colIndex === row.length - 1) childMeta._collapseClass += " collapse-group-row-end";
                    if (colIndex === row.length - 1 && rowRemain > 0) {
                        childMeta._collapseClass += " collapse-group-row-open-end collapse-group-last-span-" + childSpan + " collapse-group-row-remain-" + rowRemain;
                    }
                });
            });
        },
        GetFieldTabsStateKey(field, tabKey, index) {
            return field.Id || field.Name || (tabKey + "_tabs_" + index);
        },
        GetFieldTabsConfig(field) {
            return (field && field.Config && field.Config.FieldTabs) ? field.Config.FieldTabs : {};
        },
        NormalizeFieldTabsPanes(config) {
            var defaultPanes = [
                { Key: "tab1", Title: "基础信息", Icon: "fas fa-id-card", FieldCount: 4, Disabled: false },
                { Key: "tab2", Title: "扩展信息", Icon: "fas fa-layer-group", FieldCount: 4, Disabled: false }
            ];
            var source = config && Array.isArray(config.Tabs) && config.Tabs.length > 0 ? config.Tabs : defaultPanes;
            var usedKeys = {};
            return source.map((pane, index) => {
                var rawKey = pane && pane.Key ? String(pane.Key).trim() : "";
                var key = rawKey || ("tab" + (index + 1));
                if (usedKeys[key]) {
                    key = key + "_" + (index + 1);
                }
                usedKeys[key] = true;
                var fieldCount = parseInt(pane && pane.FieldCount, 10);
                if (!fieldCount || fieldCount < 1) fieldCount = 1;
                return {
                    Key: key,
                    Title: (pane && (pane.Title || pane.Name || pane.Label)) || ("页签" + (index + 1)),
                    Icon: (pane && pane.Icon) || "",
                    FieldCount: fieldCount,
                    FieldKeys: Array.isArray(pane && pane.FieldKeys) ? pane.FieldKeys.map((item) => String(item)) : [],
                    FieldNames: Array.isArray(pane && pane.FieldNames) ? pane.FieldNames.map((item) => String(item)) : [],
                    Disabled: pane && (pane.Disabled === true || pane.Disabled === 1 || pane.Disabled === "1" || pane.Disabled === "true")
                };
            });
        },
        GetFieldTabsChildKey(field) {
            return field ? String(field.Id || field.Name || "") : "";
        },
        ResolveFieldTabsActiveKey(config, panes, stateKey) {
            var self = this;
            if (!Array.isArray(panes) || panes.length === 0) return "";
            var configuredKey = self.FieldTabsState && Object.prototype.hasOwnProperty.call(self.FieldTabsState, stateKey)
                ? self.FieldTabsState[stateKey]
                : (config.DefaultActiveKey || "");
            var activePane = panes.find((pane) => pane.Key === configuredKey && pane.Disabled !== true);
            if (activePane) return activePane.Key;
            var firstEnabled = panes.find((pane) => pane.Disabled !== true);
            return (firstEnabled || panes[0]).Key;
        },
        AppendFieldRuntimeClass(field, className) {
            var self = this;
            if (!field || !className) return;
            var current = field._collapseClass || "";
            self.SetFieldRuntimeValue(field, "_collapseClass", (current + " " + className).trim());
        },
        ApplyFieldTabsState(fields, tabKey) {
            var self = this;
            if (!Array.isArray(fields) || fields.length === 0) {
                return fields;
            }
            formTrace("runtime:tabs-start", {
                table: self.DiyTableModel && self.DiyTableModel.Name,
                tabKey: tabKey,
                fieldCount: fields.length
            });

            fields.forEach((field) => {
                if (!field || typeof field !== "object") return;
                self.SetFieldRuntimeValue(field, "_fieldTabsHidden", false);
                self.SetFieldRuntimeValue(field, "_fieldTabsPaneKey", "");
                self.SetFieldRuntimeValue(field, "_fieldTabsPaneTitle", "");
                self.SetFieldRuntimeValue(field, "_fieldTabsPaneIndex", -1);
                if (field.Component !== "Tabs") {
                    self.SetFieldRuntimeValue(field, "_fieldTabsStateKey", "");
                    self.SetFieldRuntimeValue(field, "_fieldTabsActiveKey", "");
                    self.SetFieldRuntimeValue(field, "_fieldTabsChildCount", 0);
                    self.SetFieldRuntimeValue(field, "_fieldTabsPanes", []);
                }
            });

            fields.forEach((field, index) => {
                if (!field || field.Component !== "Tabs") return;
                self.ApplyFieldTabsVisualState(fields, index, tabKey);
            });

            formTrace("runtime:tabs-end", {
                table: self.DiyTableModel && self.DiyTableModel.Name,
                tabKey: tabKey
            });

            return fields;
        },
        ApplyFieldTabsVisualState(fields, tabsIndex, tabKey) {
            var self = this;
            var field = fields[tabsIndex];
            if (!field || field.Component !== "Tabs") return;

            var tabsConfig = self.GetFieldTabsConfig(field);
            var panes = self.NormalizeFieldTabsPanes(tabsConfig);
            var stateKey = self.GetFieldTabsStateKey(field, tabKey, tabsIndex);
            var activeKey = self.ResolveFieldTabsActiveKey(tabsConfig, panes, stateKey);
            var captureRest = tabsConfig.CaptureRest !== false;
            var scopeMode = tabsConfig.ScopeMode || "FieldCount";
            var theme = tabsConfig.Theme || "default";
            var totalFieldCount = parseInt(tabsConfig.TotalFieldCount, 10);
            if (!totalFieldCount || totalFieldCount < 0) {
                totalFieldCount = 0;
            }

            var stopIndex = fields.length;
            for (var scanIndex = tabsIndex + 1; scanIndex < fields.length; scanIndex++) {
                var scanField = fields[scanIndex];
                if (scanField && scanField.Component === "Tabs") {
                    stopIndex = scanIndex;
                    break;
                }
            }

            var availableFields = fields.slice(tabsIndex + 1, stopIndex);
            if (totalFieldCount > 0) {
                availableFields = availableFields.slice(0, totalFieldCount);
            }
            var cursor = 0;
            var runtimePanes = [];
            var totalChildCount = 0;
            var manualUsedKeys = {};

            panes.forEach((pane, paneIndex) => {
                var paneFields = [];
                if (scopeMode === "Manual") {
                    var fieldKeys = Array.isArray(pane.FieldKeys) ? pane.FieldKeys.map((item) => String(item)) : [];
                    var fieldNames = Array.isArray(pane.FieldNames) ? pane.FieldNames.map((item) => String(item)) : [];
                    paneFields = availableFields.filter((childField) => {
                        var childKey = self.GetFieldTabsChildKey(childField);
                        if (!childKey || manualUsedKeys[childKey]) return false;
                        var matched = fieldKeys.indexOf(childKey) > -1 || fieldNames.indexOf(childField.Name || "") > -1;
                        if (matched) {
                            manualUsedKeys[childKey] = true;
                        }
                        return matched;
                    });
                } else {
                    var remaining = Math.max(availableFields.length - cursor, 0);
                    var paneFieldCount = pane.FieldCount;
                    if (captureRest && paneIndex === panes.length - 1) {
                        paneFieldCount = remaining;
                    }
                    paneFieldCount = Math.max(0, Math.min(paneFieldCount, remaining));
                    paneFields = availableFields.slice(cursor, cursor + paneFieldCount);
                    cursor += paneFieldCount;
                }

                var visibleCount = paneFields.filter((childField) => childField && childField._baseIsShow !== false).length;
                totalChildCount += visibleCount;
                runtimePanes.push({
                    ...pane,
                    _fieldCount: visibleCount
                });

                var visiblePaneFields = [];
                paneFields.forEach((childField, childIndex) => {
                    if (!childField) return;
                    var visibleBeforeTabs = childField._isShow !== false;
                    var isActivePane = pane.Key === activeKey;
                    var shouldShow = visibleBeforeTabs && (isActivePane || self.LoadMode === "Design");
                    self.SetFieldRuntimeValue(childField, "_fieldTabsHidden", !isActivePane && self.LoadMode !== "Design");
                    self.SetFieldRuntimeValue(childField, "_fieldTabsStateKey", stateKey);
                    self.SetFieldRuntimeValue(childField, "_fieldTabsActiveKey", activeKey);
                    self.SetFieldRuntimeValue(childField, "_fieldTabsPaneKey", pane.Key);
                    self.SetFieldRuntimeValue(childField, "_fieldTabsPaneTitle", pane.Title);
                    self.SetFieldRuntimeValue(childField, "_fieldTabsPaneIndex", paneIndex);
                    self.SetFieldRuntimeValue(childField, "_isShow", shouldShow);
                    self.AppendFieldRuntimeClass(
                        childField,
                        "field-tabs-item field-tabs-theme-" + theme +
                        " field-tabs-pane-" + paneIndex +
                        " field-tabs-child-" + childIndex +
                        (isActivePane ? " field-tabs-active-pane" : " field-tabs-inactive-pane")
                    );
                    if (shouldShow) {
                        visiblePaneFields.push(childField);
                    }
                });

                self.ApplyFieldTabsRowClasses(visiblePaneFields);
            });

            self.SetFieldRuntimeValue(field, "_fieldTabsHidden", false);
            self.SetFieldRuntimeValue(field, "_fieldTabsStateKey", stateKey);
            self.SetFieldRuntimeValue(field, "_fieldTabsActiveKey", activeKey);
            self.SetFieldRuntimeValue(field, "_fieldTabsChildCount", totalChildCount);
            self.SetFieldRuntimeValue(field, "_fieldTabsPanes", runtimePanes);
            self.AppendFieldRuntimeClass(field, "field-tabs-header field-tabs-theme-" + theme);
        },
        ApplyFieldTabsRowClasses(visibleChildFields) {
            var self = this;
            if (!Array.isArray(visibleChildFields) || visibleChildFields.length === 0) return;

            var rows = [];
            var currentRow = [];
            var currentSpan = 0;
            var pushCurrentRow = function () {
                if (currentRow.length > 0) {
                    rows.push(currentRow);
                    currentRow = [];
                    currentSpan = 0;
                }
            };

            visibleChildFields.forEach((childField) => {
                var span = parseInt(childField._span || childField.FormWidth || 24, 10);
                if (!span || span < 1) span = 24;
                if (span > 24) span = 24;

                if (currentRow.length > 0 && currentSpan + span > 24) {
                    pushCurrentRow();
                }
                currentRow.push(childField);
                currentSpan += span;
                if (currentSpan >= 24) {
                    pushCurrentRow();
                }
            });
            pushCurrentRow();

            self.AppendFieldRuntimeClass(visibleChildFields[0], "field-tabs-visible-first");
            self.AppendFieldRuntimeClass(visibleChildFields[visibleChildFields.length - 1], "field-tabs-visible-last");

            rows.forEach((row, rowIndex) => {
                var rowSpan = row.reduce(function (total, childField) {
                    var span = parseInt(childField._span || childField.FormWidth || 24, 10);
                    if (!span || span < 1) span = 24;
                    if (span > 24) span = 24;
                    return total + span;
                }, 0);
                var rowRemain = Math.max(0, 24 - rowSpan);
                row.forEach((childField, colIndex) => {
                    var childSpan = parseInt(childField._span || childField.FormWidth || 24, 10);
                    if (!childSpan || childSpan < 1) childSpan = 24;
                    if (childSpan > 24) childSpan = 24;
                    self.AppendFieldRuntimeClass(
                        childField,
                        "field-tabs-row field-tabs-row-" + rowIndex +
                        (rowIndex === 0 ? " field-tabs-row-first" : "") +
                        (rowIndex === rows.length - 1 ? " field-tabs-row-last" : "") +
                        (colIndex === 0 ? " field-tabs-row-start" : "") +
                        (colIndex === row.length - 1 ? " field-tabs-row-end" : "") +
                        (colIndex === row.length - 1 && rowRemain > 0 ? " field-tabs-row-open-end field-tabs-last-span-" + childSpan + " field-tabs-row-remain-" + rowRemain : "")
                    );
                });
            });
        },
        handleGroupCollapseChange(field, collapsed, options) {
            var self = this;
            if (!self.ShouldUseAdvancedFieldLayoutRuntime()) {
                return;
            }
            if (!field) return;
            var stateKey = field._collapseStateKey || field.Id || field.Name;
            if (!stateKey) return;
            if (self.CollapseGroupState && self.CollapseGroupState[stateKey] === collapsed && !(options && options.force === true)) {
                return;
            }
            self.CollapseGroupState = Object.assign({}, self.CollapseGroupState, {
                [stateKey]: collapsed
            });
            self.RefreshDiyFieldRuntimeState();
        },
        handleFieldTabsChange(field, activeKey, options) {
            var self = this;
            if (!self.ShouldUseAdvancedFieldLayoutRuntime()) {
                return;
            }
            if (!field) return;
            var stateKey = field._fieldTabsStateKey || field.Id || field.Name;
            if (!stateKey) return;
            if (self.FieldTabsState && self.FieldTabsState[stateKey] === activeKey && !(options && options.force === true)) {
                return;
            }
            self.FieldTabsState = Object.assign({}, self.FieldTabsState, {
                [stateKey]: activeKey
            });
            self.RefreshDiyFieldRuntimeState();
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
            FieldTabsState: {},
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
            _runtimeRefreshScheduled: false,
            _runtimeRefreshing: false,
            _advancedFieldLayoutRuntimeDisabledLogged: false,
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
