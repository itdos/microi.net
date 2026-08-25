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
    resolveModuleOpenFirstRecord,
    resolveListPresentationHeader,
    resolveButtonBadgeValue,
    resolveMetricValue
} from "../form-view-blocks/module-presentation-runtime";
import { resolveFormPresentationConfig } from "../form-presentation-runtime.js";
import { migrateLegacyModuleHeroBanner } from "../form-banner-runtime.js";
import { hasScalarRecordId } from "@/utils/record-id.js";
import { requestMenuBadge } from "@/layout/components/Sidebar/menu-badge-batch.js";

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

const MODULE_METRIC_VISUALS = [
    { Tone: "primary", Icon: "fas fa-chart-line" },
    { Tone: "success", Icon: "fas fa-circle-check" },
    { Tone: "warning", Icon: "fas fa-clock" },
    { Tone: "danger", Icon: "fas fa-triangle-exclamation" },
    { Tone: "info", Icon: "fas fa-layer-group" }
];

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
        ModuleChromeMenu() {
            return this.PageTabHostMenuModel || this.SysMenuModel;
        },
        ModuleChromeView() {
            if (!this.PageTabHostMenuModel) return this.ActiveModulePresentationView;
            const scene = this.TableDisplayMode === "Card" ? "Card" : "List";
            const device = this.diyStore.IsPhoneView ? "Mobile" : "PC";
            return selectModuleView(this.PageTabHostMenuModel, {
                scene,
                device,
                user: this.GetCurrentUser
            }) || selectModuleView(this.PageTabHostMenuModel, {
                scene: "List",
                device,
                user: this.GetCurrentUser
            });
        },
        FormPresentationConfig() {
            const device = this.diyStore.IsPhoneView ? "Mobile" : "PC";
            const legacyFormView = selectModuleView(this.SysMenuModel, {
                scene: "Detail",
                device,
                user: this.GetCurrentUser,
                allowLegacyFormConfig: true
            }) || selectModuleView(this.SysMenuModel, {
                scene: "Edit",
                device,
                user: this.GetCurrentUser,
                allowLegacyFormConfig: true
            });
            const legacyConfig = {
                ...(this.ModuleListView?.Layout?.Form || {})
            };
            const sharedBanner = legacyFormView?.Layout?.Hero || this.ModuleListView?.Layout?.Hero;
            if (sharedBanner) {
                // Detail/Edit 自定义视图不再接管表单运行时；其历史 Hero 会迁移到
                // 标准 DiyForm。这里只复用标题、图片、背景及明确绑定当前记录的
                // 统计，列表总数/分类统计不得混入单条记录 Banner。
                legacyConfig.Banner = migrateLegacyModuleHeroBanner(sharedBanner);
            }
            return resolveFormPresentationConfig(
                this.CurrentDiyTableModel || {},
                legacyConfig,
                ""
            );
        },
        ModuleFormWorkbenchConfig() {
            return this.FormPresentationConfig || {};
        },
        ModuleFormWorkbenchRouteActive() {
            if (this._moduleViewDeactivated === true) return false;
            const routeMenuId = String(this.$route?.meta?.Id || this.$route?.meta?.SysMenuId || "");
            const ownerMenuId = String(this.PageTabHostSysMenuId || this.SysMenuId || this.SysMenuModel?.Id || "");
            return !routeMenuId || !ownerMenuId || routeMenuId === ownerMenuId;
        },
        ModuleFormWorkbenchAvailable() {
            const preset = String(this.ModuleListView?.Layout?.Preset || "").toLowerCase();
            const moduleForm = this.ModuleListView?.Layout?.Form || {};
            const openFirstRecord = resolveModuleOpenFirstRecord(this.SysMenuModel, moduleForm);
            return openFirstRecord
                || preset === "formworkbench"
                || hasScalarRecordId(this.$route?.query?.RecordId);
        },
        ModuleFormWorkbenchEnabled() {
            const requestedMode = String(this.$route?.query?.ViewMode || this.$route?.query?.viewMode || "").toLowerCase();
            return this.ModuleFormWorkbenchRouteActive
                && this.ModuleFormWorkbenchAvailable
                && requestedMode !== "table"
                && !this._IsTableChild
                && this.PropsEmbedded !== true
                && this.PropsIsJoinTable !== true;
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
                menu: this.ModuleChromeMenu,
                table: this.PageTabHostTableModel || this.CurrentDiyTableModel,
                view: this.ModuleChromeView,
                fields: uniqueFields([
                    ...(this.DiyFieldList || []),
                    ...(this._allFieldList || []),
                    ...(this.ShowDiyFieldList || []),
                    ...(this.SysMenuModel?.SelectFields || [])
                ]),
                statistics: this.StatisticsFields,
                rows: this.DiyTableRowList || this._modulePresentationLastRows,
                rowCount: this.DiyTableRowCount,
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
                const visual = MODULE_METRIC_VISUALS[index % MODULE_METRIC_VISUALS.length];
                let value = this.ModuleMetricValues[metric.Key];
                if (value === undefined && metric.Field) value = statistics[metric.Field];
                if (value === undefined && metric.Source === "DataCount") value = this.DiyTableRowCount;
                if (value === undefined && metric.Source === "PageCount") {
                    value = Array.isArray(this.DiyTableRowList)
                        ? this.DiyTableRowList.length
                        : (this._modulePresentationLastRows || []).length;
                }
                if (value === undefined && metric.Value !== undefined) value = metric.Value;
                if (value === undefined) value = metric.DefaultValue;
                return {
                    Id: `ViewMetric_${metric.Key || index}`,
                    Key: metric.Key,
                    Label: metric.Label,
                    Value: value,
                    Prefix: metric.Prefix,
                    Suffix: metric.Suffix,
                    // 旧配置未指定视觉语义时也提供可区分的图标和色调；新配置仍应显式保存。
                    Icon: metric.Icon || visual.Icon,
                    Color: metric.Color,
                    Tone: metric.Tone || visual.Tone,
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
            // 同一字段若已经作为顶部状态展示，不再在副标题重复一次。
            return withoutUsedFields(
                this.ResolvePresentationFields(this.PresentationCardConfig?.SubtitleFields),
                this.CardTopFieldList
            );
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
        HandleModuleWorkbenchOpenForm(row, mode) {
            return this.OpenDetail(row, mode);
        },
        SyncModuleWorkbenchSelection(row) {
            const current = row && row.Id
                ? ((this.DiyTableRowList || []).find((item) => item && item.Id === row.Id) || row)
                : null;
            const selection = current ? [current] : [];
            this.TableMultipleSelection = selection;
            this.cardSelection = selection;
            this.cardSelectAll = false;
            this.TableSelectedRow = current || {};
            this.CurrentSelectedRowModel = current || {};
            return current || {};
        },
        HandleModuleWorkbenchAction(btn, row, scope, selectedRecord) {
            // FormWorkbench 的当前记录就是默认勾选记录，确保批量/页面 V8 中
            // V8.TableRowSelected 与 V8.SelectedData 不会因隐藏了表格复选框而丢失。
            this.SyncModuleWorkbenchSelection(selectedRecord || row);
            const current = row || {};
            return this.RunMoreBtn(btn, current, current._V8);
        },
        HandleModuleWorkbenchFormReady(form) {
            this.SyncModuleWorkbenchSelection(form || {});
            // 内嵌工作台复用 DiyFormFull；表单按钮显隐及 V8 上下文由该完整容器统一处理。
        },
        HandleModuleWorkbenchPage(pageIndex) {
            return this.GetDiyTableRow({ _PageIndex: pageIndex });
        },
        HandleModuleWorkbenchRecordChange(recordId) {
            if (!recordId || !this.ModuleFormWorkbenchRouteActive) return;
            const current = (this.DiyTableRowList || []).find((item) => item && item.Id === recordId) || {};
            this.SyncModuleWorkbenchSelection(current);
            const batchButtons = this.SysMenuModel?.BatchSelectMoreBtns;
            if (Array.isArray(batchButtons) && batchButtons.length > 0) {
                this.HandlerBtns(batchButtons, current);
            }
            if (!this.$router || !this.$route) return;
            const query = { ...(this.$route.query || {}) };
            if (query.RecordId === recordId) return;
            query.RecordId = recordId;
            this.$router.replace({ path: this.$route.path, query }).catch(() => {});
        },
        HandleWorkspaceDialogRecordChange(recordId) {
            // Dialog/Drawer record navigation only changes the dialog record.
            // It must never replace the host table URL or hide the underlying list.
            if (!recordId) return;
            const current = (this.DiyTableRowList || []).find((item) => item && item.Id === recordId) || {};
            this.SyncModuleWorkbenchSelection(current);
            const batchButtons = this.SysMenuModel?.BatchSelectMoreBtns;
            if (Array.isArray(batchButtons) && batchButtons.length > 0) {
                this.HandlerBtns(batchButtons, current);
            }
        },
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
            const avatarField = this.CardAvatarField;
            let value = avatarField ? String(this.GetPresentationFieldValue(row, avatarField) || "") : "";
            // 头像字段为空时回退到标题首字，不能把所有卡片都渲染成没有辨识度的“#”。
            if (!value.trim() && this.CardPrimaryField) {
                value = String(this.GetPresentationFieldValue(row, this.CardPrimaryField) || "");
            }
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
        async RefreshModulePresentationData(rows = [], queryParam = {}, generation = this._presentationRequestGeneration) {
            const apiMetrics = (this.ModuleHero.Metrics || []).filter((metric) => metric.ApiEngineKey);
            const menu = this.SysMenuModel || {};
            const collections = [menu.PageTabs, menu.MoreBtns, menu.PageBtns, menu.BatchSelectMoreBtns, menu.ExportMoreBtns, menu.FormBtns];
            const badgeGroups = collectBadgeApiGroups(collections);
            const metricGroups = new Map();
            apiMetrics.forEach((metric) => {
                if (!metricGroups.has(metric.ApiEngineKey)) metricGroups.set(metric.ApiEngineKey, []);
                metricGroups.get(metric.ApiEngineKey).push(metric);
            });
            const engineKeys = [...new Set([...metricGroups.keys(), ...badgeGroups.keys()])];
            if (!engineKeys.length) {
                this.ModuleMetricValues = {};
                this.ButtonBadgeValues = {};
                this.ModuleMetricLoading = false;
                return;
            }
            this.ModuleMetricLoading = apiMetrics.length > 0;
            const rowIds = (rows || []).map((row) => row?.Id).filter(Boolean);
            const nextMetricValues = {};
            const nextBadgeValues = {};
            await Promise.all(engineKeys.map(async (apiEngineKey) => {
                const groupMetrics = metricGroups.get(apiEngineKey) || [];
                const descriptors = badgeGroups.get(apiEngineKey) || [];
                const uniqueDescriptors = [...new Map(descriptors.map((descriptor) => [descriptor.buttonKey, descriptor])).values()];
                const params = groupMetrics.reduce((result, metric) => Object.assign(result, metric.ParamMap || {}), {});
                try {
                    // One engine may serve both header metrics and button badges. Sending
                    // their keys together avoids two Jint executions and duplicate count
                    // queries for the same module refresh.
                    const extra = {};
                    if (groupMetrics.length) extra.MetricKeys = groupMetrics.map((metric) => metric.Key);
                    if (uniqueDescriptors.length) {
                        extra.Ids = rowIds;
                        extra.ButtonKeys = uniqueDescriptors.map((descriptor) => descriptor.buttonKey);
                    }
                    const response = await requestMenuBadge(this.DiyCommon.ApiEngine.Run, apiEngineKey, {
                        ...params,
                        ...this._presentationContext(queryParam, extra)
                    });
                    if (response && typeof response === "object" && Object.prototype.hasOwnProperty.call(response, "Code") && Number(response.Code) !== 1) {
                        throw new Error(response.Msg || "模块展示统计接口返回失败");
                    }
                    groupMetrics.forEach((metric) => {
                        nextMetricValues[metric.Key] = resolveMetricValue(response, metric);
                    });
                    uniqueDescriptors.forEach(({ badge, buttonKey }) => {
                        nextBadgeValues[`page|${buttonKey}`] = resolveButtonBadgeValue(response, badge, buttonKey);
                        rowIds.forEach((rowId) => {
                            nextBadgeValues[`${rowId}|${buttonKey}`] = resolveButtonBadgeValue(response, badge, buttonKey, rowId);
                        });
                    });
                } catch (error) {
                    groupMetrics.forEach((metric) => { nextMetricValues[metric.Key] = metric.DefaultValue; });
                    // 统计失败不阻断列表、指标占位或按钮本身。
                }
            }));
            if (generation !== this._presentationRequestGeneration || this._isDestroyed) return;
            this.ModuleMetricValues = nextMetricValues;
            this.ButtonBadgeValues = nextBadgeValues;
            this.ModuleMetricLoading = false;
        },
        RefreshModulePresentation(queryParam = {}, rows = []) {
            this._modulePresentationLastQuery = queryParam || {};
            this._modulePresentationLastRows = rows || [];
            const generation = ++this._presentationRequestGeneration;
            this.RefreshModulePresentationData(rows, queryParam, generation);
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
