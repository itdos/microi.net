import {
    filterStandaloneListFields,
    getModuleViewFieldNames,
    selectModuleView
} from "../form-view-blocks/view-schema-runtime";
import {
    collectBadgeApiGroups,
    formatBadgeValue,
    getButtonKey,
    normalizeButtonBadge,
    resolveListPresentationHeader,
    resolveButtonBadgeValue,
    resolveMetricValue
} from "../form-view-blocks/module-presentation-runtime";

function uniqueFields(fields) {
    const seen = new Set();
    return (fields || []).filter((field) => {
        const key = field && (field.AsName || field.Name || field.Id);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function withoutUsedFields(fields, usedFields) {
    const used = new Set(uniqueFields(usedFields).map((field) => field.AsName || field.Name || field.Id));
    return uniqueFields(fields).filter((field) => !used.has(field.AsName || field.Name || field.Id));
}

export default {
    data() {
        return {
            ModuleMetricValues: {},
            ModuleMetricLoading: false,
            ButtonBadgeValues: {},
            _presentationRequestGeneration: 0,
            _moduleMetricRefreshTimer: null,
            _modulePresentationLastQuery: {},
            _modulePresentationLastRows: []
        };
    },
    unmounted() {
        if (this._moduleMetricRefreshTimer) window.clearTimeout(this._moduleMetricRefreshTimer);
    },
    computed: {
        ModuleListView() {
            return selectModuleView(this.SysMenuModel, {
                scene: "List",
                device: this.diyStore.IsPhoneView ? "Mobile" : "PC",
                user: this.GetCurrentUser
            });
        },
        ModuleCardView() {
            const device = this.diyStore.IsPhoneView ? "Mobile" : "PC";
            const preferred = selectModuleView(this.SysMenuModel, {
                scene: "Card",
                device,
                user: this.GetCurrentUser
            });
            if (preferred) return preferred;

            // 卡片字段编排本身是跨端协议。当前设计器只生成“移动端卡片”，
            // 当桌面模块直接采用卡片模式时应复用该配置，不能退回已被去重隐藏的旧字段列表。
            return selectModuleView(this.SysMenuModel, {
                scene: "Card",
                device: device === "PC" ? "Mobile" : "PC",
                user: this.GetCurrentUser
            });
        },
        ActiveModulePresentationView() {
            return this.TableDisplayMode === "Card"
                ? (this.ModuleCardView || this.ModuleListView)
                : this.ModuleListView;
        },
        ModulePresentationHeader() {
            return resolveListPresentationHeader({
                menu: this.SysMenuModel,
                table: this.CurrentDiyTableModel,
                view: this.ActiveModulePresentationView,
                isPhoneView: this.diyStore.IsPhoneView,
                embedded: this.PropsEmbedded,
                isTableChild: this._IsTableChild,
                isJoinTable: this.PropsIsJoinTable === true
            });
        },
        ModuleHero() {
            return this.ModulePresentationHeader;
        },
        HasModuleHero() {
            return Boolean(this.ModulePresentationHeader.Visible);
        },
        IsDefaultModuleHero() {
            return Boolean(this.ModulePresentationHeader.IsDefault);
        },
        ModuleMetricItems() {
            const statistics = this.StatisticsFields || {};
            return (this.ModuleHero.Metrics || []).map((metric, index) => {
                let value = this.ModuleMetricValues[metric.Key];
                if (value === undefined && metric.Field) value = statistics[metric.Field];
                if (value === undefined && metric.Source === "DataCount") value = this.DiyTableRowCount;
                if (value === undefined && metric.Source === "PageCount") {
                    value = Array.isArray(this.DiyTableRowList)
                        ? this.DiyTableRowList.length
                        : (this._modulePresentationLastRows || []).length;
                }
                if (value === undefined) value = metric.DefaultValue;
                return {
                    Id: `ViewMetric_${metric.Key || index}`,
                    Key: metric.Key,
                    Label: metric.Label,
                    Value: value,
                    Prefix: metric.Prefix,
                    Suffix: metric.Suffix,
                    Icon: metric.Icon,
                    Color: metric.Color,
                    Tone: metric.Tone,
                    Format: metric.Format,
                    Source: "ViewSchema",
                    Loading: Boolean(metric.ApiEngineKey) && this.ModuleMetricLoading && value === undefined
                };
            });
        },
        PresentationListColumns() {
            return this.ModuleListView?.Layout?.List?.Columns || [];
        },
        PresentationListFieldList() {
            const result = [];
            this.PresentationListColumns.forEach((column) => {
                [column.Field, ...(column.Lines || []), ...(column.TrailingFields || [])]
                    .forEach((field) => {
                        const resolved = this.ResolvePresentationField(field);
                        if (resolved) result.push(resolved);
                    });
            });
            return uniqueFields(result);
        },
        PresentationTableFieldList() {
            return filterStandaloneListFields(this.ShowDiyFieldList || [], this.ModuleListView);
        },
        PresentationCardConfig() {
            return this.ModuleCardView?.Layout?.Card || null;
        },
        CardPrimaryField() {
            return this.ResolvePresentationField(this.PresentationCardConfig?.TitleField)
                || (this.CardShowDiyFieldList || [])[0]
                || null;
        },
        CardAvatarField() {
            const card = this.PresentationCardConfig;
            return this.ResolvePresentationField(card?.AvatarField || card?.AvatarTextField);
        },
        CardSubtitleFieldList() {
            return this.ResolvePresentationFields(this.PresentationCardConfig?.SubtitleFields);
        },
        CardTopFieldList() {
            const configured = this.ResolvePresentationFields([
                ...(this.PresentationCardConfig?.StatusFields || []),
                ...(this.PresentationCardConfig?.TopFields || [])
            ]);
            return configured.length ? configured : (this.CardTitleTagFieldList || []);
        },
        CardRightFieldList() {
            return this.ResolvePresentationFields(this.PresentationCardConfig?.RightFields);
        },
        CardContentFieldList() {
            const configured = this.ResolvePresentationFields(this.PresentationCardConfig?.Fields);
            const source = configured.length ? configured : (this.CardShowDiyFieldList || []);
            return withoutUsedFields(source, [
                this.CardPrimaryField,
                this.CardAvatarField,
                ...this.CardSubtitleFieldList,
                ...this.CardTopFieldList,
                ...this.CardRightFieldList
            ]);
        },
        CardMetaFieldList() {
            return withoutUsedFields(
                this.ResolvePresentationFields(this.PresentationCardConfig?.MetaFields),
                [
                    this.CardPrimaryField,
                    this.CardAvatarField,
                    ...this.CardSubtitleFieldList,
                    ...this.CardTopFieldList,
                    ...this.CardRightFieldList,
                    ...this.CardContentFieldList
                ]
            );
        },
        CardBottomFieldList() {
            const configured = this.ResolvePresentationFields(this.PresentationCardConfig?.BottomFields);
            const source = configured.length ? configured : (this.CardBottomTagFieldList || []);
            return withoutUsedFields(source, [
                this.CardPrimaryField,
                this.CardAvatarField,
                ...this.CardSubtitleFieldList,
                ...this.CardTopFieldList,
                ...this.CardRightFieldList,
                ...this.CardContentFieldList,
                ...this.CardMetaFieldList
            ]);
        },
        PresentationCardFieldList() {
            return uniqueFields([
                this.CardPrimaryField,
                this.CardAvatarField,
                ...this.CardSubtitleFieldList,
                ...this.CardTopFieldList,
                ...this.CardRightFieldList,
                ...this.CardContentFieldList,
                ...this.CardMetaFieldList,
                ...this.CardBottomFieldList
            ]);
        },
        PresentationRequiredFieldNames() {
            return uniqueFields([
                ...getModuleViewFieldNames(this.ModuleListView).map((Name) => ({ Name })),
                ...getModuleViewFieldNames(this.ModuleCardView).map((Name) => ({ Name }))
            ]).map((field) => field.Name);
        }
    },
    methods: {
        ResolvePresentationField(reference) {
            const source = typeof reference === "string" ? { Name: reference } : (reference || {});
            const name = source.Name || source.Field;
            if (!name) return null;
            const field = (this.DiyFieldList || []).find((item) => item.Name === name || item.Id === name)
                || (this.ShowDiyFieldList || []).find((item) => item.Name === name || item.Id === name);
            return field ? Object.assign({}, field, source, { Name: field.Name }) : null;
        },
        ResolvePresentationFields(references) {
            return uniqueFields((Array.isArray(references) ? references : [])
                .map((reference) => this.ResolvePresentationField(reference))
                .filter(Boolean));
        },
        GetListColumnConfig(field) {
            if (!field) return null;
            return this.PresentationListColumns.find((column) => column.Field === field.Name || column.Field === field.AsName) || null;
        },
        GetListColumnLines(field) {
            const config = this.GetListColumnConfig(field);
            return this.ResolvePresentationFields(config?.Lines);
        },
        GetListColumnTrailingFields(field) {
            const config = this.GetListColumnConfig(field);
            return this.ResolvePresentationFields(config?.TrailingFields);
        },
        GetPresentationFieldValue(row, field) {
            if (!field) return "";
            return this.GetColValue({ row }, field);
        },
        HasPresentationFieldValue(row, field) {
            if (!field || !row) return false;
            const value = row[field.AsName || field.Name];
            const hasRawValue = value !== undefined && value !== null && value !== "";
            if (this.isMuban && this.isMuban(field, { row })) {
                const templateValue = row[field.Name + "_TmpEngineResult"];
                // 模板通常会把空值格式化为“—”。跨端卡片应隐藏空区域，
                // 不能因为占位模板存在就在标题区渲染一个没有业务含义的标签。
                return hasRawValue
                    && templateValue !== undefined
                    && templateValue !== null
                    && templateValue !== "";
            }
            return hasRawValue;
        },
        HasAnyPresentationFieldValue(row, fields) {
            return (Array.isArray(fields) ? fields : [])
                .some((field) => this.HasPresentationFieldValue(row, field));
        },
        GetVisibleCardContentFields(row) {
            return (this.CardContentFieldList || []).filter((field) => {
                const canInlineEdit = this.SysMenuModel?.InTableEdit && this.IsInTableEditField(field.Id);
                return canInlineEdit || this.HasPresentationFieldValue(row, field);
            });
        },
        GetPresentationDecoratedFieldValue(row, field) {
            if (!this.HasPresentationFieldValue(row, field)) return "";
            const value = String(this.GetPresentationFieldValue(row, field) ?? "");
            const valueTrimmed = value.trim();
            let prefix = String(field?.Prefix || "");
            let suffix = String(field?.Suffix || "");
            if (prefix.trim() && valueTrimmed.startsWith(prefix.trim())) prefix = "";
            if (suffix.trim() && valueTrimmed.endsWith(suffix.trim())) suffix = "";
            return `${prefix}${value}${suffix}`;
        },
        GetCardAvatarText(row) {
            const field = this.CardAvatarField || this.CardPrimaryField;
            const value = field ? String(this.GetPresentationFieldValue(row, field) || "") : "";
            return value.trim().slice(0, 1).toUpperCase() || "#";
        },
        GetPresentationTone(field) {
            const tone = String(field?.Tone || "").toLowerCase();
            return ["primary", "success", "warning", "danger", "info", "neutral"].includes(tone) ? tone : "neutral";
        },
        GetPresentationFieldStyle(field) {
            const style = {};
            if (field?.Color) style.color = field.Color;
            if (field?.FontWeight) style.fontWeight = field.FontWeight;
            return Object.keys(style).length ? style : undefined;
        },
        _presentationContext(queryParam = {}, extra = {}) {
            const filterKeys = ["_Keyword", "_Where", "_Search", "_SearchEqual", "_SearchDateTime", "_SearchNumber"];
            const filters = {};
            filterKeys.forEach((key) => {
                if (queryParam[key] !== undefined) filters[key] = queryParam[key];
            });
            return {
                _SysMenuId: this.SysMenuId || this.SysMenuModel?.Id,
                SysMenuId: this.SysMenuId || this.SysMenuModel?.Id,
                ModuleEngineKey: this.SysMenuModel?.ModuleEngineKey,
                DiyTableId: this.TableId,
                TableName: this.CurrentDiyTableModel?.Name,
                OsClient: this.DiyCommon.GetOsClient(),
                Filters: filters,
                ...extra
            };
        },
        async RefreshModuleMetrics(queryParam = {}, generation = ++this._presentationRequestGeneration) {
            const metrics = this.ModuleHero.Metrics || [];
            const apiMetrics = metrics.filter((metric) => metric.ApiEngineKey);
            if (!apiMetrics.length) {
                this.ModuleMetricValues = {};
                this.ModuleMetricLoading = false;
                return;
            }
            this.ModuleMetricLoading = true;
            const groups = new Map();
            apiMetrics.forEach((metric) => {
                if (!groups.has(metric.ApiEngineKey)) groups.set(metric.ApiEngineKey, []);
                groups.get(metric.ApiEngineKey).push(metric);
            });
            const nextValues = {};
            await Promise.all([...groups.entries()].map(async ([apiEngineKey, groupMetrics]) => {
                const params = groupMetrics.reduce((result, metric) => Object.assign(result, metric.ParamMap || {}), {});
                try {
                    const response = await this.DiyCommon.ApiEngine.Run(apiEngineKey, {
                        ...params,
                        ...this._presentationContext(queryParam, { MetricKeys: groupMetrics.map((metric) => metric.Key) })
                    });
                    if (response && typeof response === "object" && Object.prototype.hasOwnProperty.call(response, "Code") && Number(response.Code) !== 1) {
                        throw new Error(response.Msg || "模块指标接口返回失败");
                    }
                    groupMetrics.forEach((metric) => {
                        nextValues[metric.Key] = resolveMetricValue(response, metric);
                    });
                } catch (error) {
                    groupMetrics.forEach((metric) => { nextValues[metric.Key] = metric.DefaultValue; });
                }
            }));
            if (generation !== this._presentationRequestGeneration || this._isDestroyed) return;
            this.ModuleMetricValues = nextValues;
            this.ModuleMetricLoading = false;
        },
        async RefreshButtonBadges(rows = [], queryParam = {}, generation = this._presentationRequestGeneration) {
            const menu = this.SysMenuModel || {};
            const collections = [menu.PageTabs, menu.MoreBtns, menu.PageBtns, menu.BatchSelectMoreBtns, menu.ExportMoreBtns, menu.FormBtns];
            const groups = collectBadgeApiGroups(collections);
            if (!groups.size) {
                this.ButtonBadgeValues = {};
                return;
            }
            const rowIds = (rows || []).map((row) => row?.Id).filter(Boolean);
            const nextValues = {};
            await Promise.all([...groups.entries()].map(async ([apiEngineKey, descriptors]) => {
                const uniqueDescriptors = [...new Map(descriptors.map((descriptor) => [descriptor.buttonKey, descriptor])).values()];
                try {
                    const response = await this.DiyCommon.ApiEngine.Run(apiEngineKey, this._presentationContext(queryParam, {
                        Ids: rowIds,
                        ButtonKeys: uniqueDescriptors.map((descriptor) => descriptor.buttonKey)
                    }));
                    if (response && typeof response === "object" && Object.prototype.hasOwnProperty.call(response, "Code") && Number(response.Code) !== 1) {
                        throw new Error(response.Msg || "按钮统计接口返回失败");
                    }
                    uniqueDescriptors.forEach(({ badge, buttonKey }) => {
                        nextValues[`page|${buttonKey}`] = resolveButtonBadgeValue(response, badge, buttonKey);
                        rowIds.forEach((rowId) => {
                            nextValues[`${rowId}|${buttonKey}`] = resolveButtonBadgeValue(response, badge, buttonKey, rowId);
                        });
                    });
                } catch (error) {
                    // 统计失败不阻断列表和按钮本身。
                }
            }));
            if (generation !== this._presentationRequestGeneration || this._isDestroyed) return;
            this.ButtonBadgeValues = nextValues;
        },
        RefreshModulePresentation(queryParam = {}, rows = []) {
            this._modulePresentationLastQuery = queryParam || {};
            this._modulePresentationLastRows = rows || [];
            const generation = ++this._presentationRequestGeneration;
            this.RefreshModuleMetrics(queryParam, generation);
            this.RefreshButtonBadges(rows, queryParam, generation);
            this.ScheduleModulePresentationRefresh();
        },
        ScheduleModulePresentationRefresh() {
            if (this._moduleMetricRefreshTimer) window.clearTimeout(this._moduleMetricRefreshTimer);
            const metricSeconds = (this.ModuleHero.Metrics || [])
                .map((metric) => Number(metric.RefreshSeconds || 0))
                .filter((value) => value > 0);
            const menu = this.SysMenuModel || {};
            const badgeSeconds = [menu.PageTabs, menu.MoreBtns, menu.PageBtns, menu.BatchSelectMoreBtns, menu.ExportMoreBtns, menu.FormBtns]
                .flatMap((buttons) => Array.isArray(buttons) ? buttons : [])
                .map((button) => normalizeButtonBadge(button))
                .filter((badge) => badge.Enabled && badge.ApiEngineKey && badge.RefreshSeconds > 0)
                .map((badge) => badge.RefreshSeconds);
            const seconds = metricSeconds.concat(badgeSeconds)
                .sort((left, right) => left - right)[0];
            if (!seconds || this._isDestroyed) return;
            this._moduleMetricRefreshTimer = window.setTimeout(() => {
                this.RefreshModulePresentation(this._modulePresentationLastQuery, this._modulePresentationLastRows);
            }, seconds * 1000);
        },
        GetButtonBadge(btn, row) {
            const badge = normalizeButtonBadge(btn);
            if (!badge.Enabled) return null;
            const buttonKey = getButtonKey(btn);
            const rawValue = badge.Field
                ? (row ? row[badge.Field] : this.StatisticsFields?.[badge.Field])
                : (this.ButtonBadgeValues[`${row?.Id || "page"}|${buttonKey}`]
                    ?? this.ButtonBadgeValues[`page|${buttonKey}`]);
            return formatBadgeValue(rawValue, badge);
        },
        GetButtonBadgeStyle(btn) {
            const badge = normalizeButtonBadge(btn);
            return badge.Color ? { backgroundColor: badge.Color } : undefined;
        },
        GetButtonBadgeTone(btn) {
            return normalizeButtonBadge(btn).Tone;
        }
    }
};
