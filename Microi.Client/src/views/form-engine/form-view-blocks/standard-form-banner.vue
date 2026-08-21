<template>
    <section
        v-if="visible"
        class="diy-standard-form-banner"
        :class="{
            'has-background-image': Boolean(resolvedBackgroundImage),
            'has-custom-background': Boolean(resolvedBackgroundImage || resolvedBackgroundCss),
            'has-metrics': metrics.length > 0
        }"
        :style="backgroundStyle"
        data-testid="standard-form-banner"
    >
        <div class="diy-standard-form-banner__content">
            <header class="diy-standard-form-banner__header">
                <div class="diy-standard-form-banner__identity">
                    <div class="diy-standard-form-banner__avatar" aria-hidden="true">
                        <img v-if="resolvedImage && !imageFailed" :src="resolvedImage" alt="" @error="imageFailed = true" />
                        <fa-icon v-else-if="banner.Icon" :icon="banner.Icon" />
                        <span v-else>{{ titleInitial }}</span>
                    </div>
                    <div class="diy-standard-form-banner__copy">
                        <h2 :title="title">{{ title }}</h2>
                        <p v-if="subtitle" :title="subtitle">{{ subtitle }}</p>
                    </div>
                </div>

                <div v-if="tags.length" class="diy-standard-form-banner__tags" aria-label="记录标签">
                    <span
                        v-for="tag in tags"
                        :key="tag.Key"
                        class="diy-standard-form-banner__tag"
                        :class="tag.Tone ? `is-${tag.Tone}` : ''"
                        :title="tag.Label ? `${tag.Label}：${tag.Value}` : tag.Value"
                    >
                        <fa-icon v-if="tag.Icon" :icon="tag.Icon" />
                        <b v-if="tag.ShowLabel">{{ tag.Label }}</b>
                        {{ tag.Value }}
                    </span>
                </div>
            </header>

            <div v-if="metrics.length" class="diy-standard-form-banner__metrics" aria-label="记录统计">
                <div v-for="metric in metrics" :key="metric.Key" class="diy-standard-form-banner__metric">
                    <span v-if="metric.Icon" class="diy-standard-form-banner__metric-icon" aria-hidden="true">
                        <fa-icon :icon="metric.Icon" />
                    </span>
                    <div class="diy-standard-form-banner__metric-copy">
                        <strong :title="String(metric.Value)">
                            <span v-if="metric.Prefix" class="diy-standard-form-banner__metric-affix">{{ metric.Prefix }}</span>
                            {{ metric.Value }}
                            <span v-if="metric.Suffix" class="diy-standard-form-banner__metric-affix">{{ metric.Suffix }}</span>
                        </strong>
                        <small :title="metric.SourceLabel ? `${metric.Label}（${metric.SourceLabel}）` : metric.Label">{{ metric.Label }}</small>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<script>
import { getFormFieldDisplayValue, hasFormBannerConfig } from "../field-display-value.js";
import {
    getFormBannerChildRelationFields,
    collectFormBannerMetricApiGroups,
    firstBannerFilePath,
    getBannerValueByPath,
    getFormBannerMetricRefreshSeconds,
    isPrivateBannerUploadField,
    normalizeFormBannerConfig,
    resolveFormBannerMetricValue
} from "../form-banner-runtime.js";

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function safeCssBackground(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|(?:linear|radial)-gradient\([^;{}]*\))$/iu.test(text)
        ? text
        : "";
}

function resultUrl(value) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    if (typeof value.Data === "string") return value.Data;
    return value.Url || value.Path || "";
}

export default {
    name: "StandardFormBanner",
    props: {
        config: { type: Object, default: () => ({}) },
        form: { type: Object, default: () => ({}) },
        fields: { type: Array, default: () => [] },
        table: { type: Object, default: () => ({}) },
        tableRowId: { type: String, default: "" },
        sysMenuId: { type: String, default: "" },
        getServerPath: { type: Function, default: null },
        getPrivateFileUrl: { type: Function, default: null },
        runApiEngine: { type: Function, default: null },
        loadRelatedMetrics: { type: Function, default: null }
    },
    data() {
        return {
            resolvedImage: "",
            resolvedBackgroundImage: "",
            resolvedBackgroundCss: "",
            imageFailed: false,
            metricRuntimeValues: Object.create(null),
            relatedMetricRuntimeItems: [],
            metricsLoading: false,
            mediaGeneration: 0,
            metricGeneration: 0,
            metricRefreshTimer: null
        };
    },
    computed: {
        fieldMap() {
            return new Map((this.fields || []).map((field) => [String(field?.Name || "").toLowerCase(), field]));
        },
        banner() {
            return normalizeFormBannerConfig(this.config, this.fields, this.table);
        },
        visible() {
            return hasFormBannerConfig(this.banner) && this.banner.Enabled !== false;
        },
        title() {
            return this.fieldText(this.banner.TitleField)
                || String(this.banner.Title || this.table?.Description || this.table?.Name || "记录详情");
        },
        subtitle() {
            return this.fieldText(this.banner.SubtitleField)
                || String(this.banner.Subtitle || this.banner.Meta || "");
        },
        titleInitial() {
            return [...String(this.title || "详")][0] || "详";
        },
        tags() {
            return (Array.isArray(this.banner.Tags) ? this.banner.Tags : []).map((tag, index) => {
                const field = this.findField(tag.Field);
                const value = tag.Field
                    ? getFormFieldDisplayValue(this.form, field || { Name: tag.Field }, { emptyText: "" })
                    : String(tag.Value ?? "");
                if (!value) return null;
                return {
                    ...tag,
                    Key: tag.Key || tag.Field || `tag-${index}`,
                    Label: tag.Label || field?.Label || "",
                    Value: `${tag.Prefix || ""}${value}${tag.Suffix || ""}`,
                    ShowLabel: tag.ShowLabel === true
                };
            }).filter(Boolean);
        },
        autoRelatedFields() {
            return this.banner._MetricsInferred ? getFormBannerChildRelationFields(this.fields) : [];
        },
        metrics() {
            const configuredItems = (Array.isArray(this.banner.Metrics) ? this.banner.Metrics : []).map((metric, index) => {
                const key = metric.Key || metric.Field || `metric-${index}`;
                const field = this.findField(metric.Field);
                let value;
                if (metric.ApiEngineKey) {
                    value = Object.prototype.hasOwnProperty.call(this.metricRuntimeValues, key)
                        ? this.metricRuntimeValues[key]
                        : (metric.DefaultValue ?? (this.metricsLoading ? "…" : undefined));
                } else if (metric.Field) {
                    const rawValue = this.rawFieldValue(metric.Field);
                    if (rawValue === undefined || rawValue === null || rawValue === "") return null;
                    value = getFormFieldDisplayValue(this.form, field || { Name: metric.Field }, { emptyText: "" });
                } else {
                    value = metric.Value ?? metric.DefaultValue;
                }
                if (value === undefined || value === null || value === "") return null;
                return {
                    ...metric,
                    Key: key,
                    Label: metric.Label || field?.Label || key,
                    Value: this.formatMetricValue(value, metric)
                };
            }).filter(Boolean);
            const relatedItems = (Array.isArray(this.relatedMetricRuntimeItems) ? this.relatedMetricRuntimeItems : [])
                .map((metric) => ({ ...metric, Value: this.formatMetricValue(metric.Value, metric) }));
            const combined = this.banner._MetricsInferred
                ? relatedItems.concat(configuredItems)
                : configuredItems;
            return this.banner._MetricsInferred ? combined.slice(0, 3) : combined;
        },
        backgroundStyle() {
            if (this.resolvedBackgroundImage) {
                const escaped = String(this.resolvedBackgroundImage).replace(/["\\\n\r]/g, (value) => encodeURIComponent(value));
                return { backgroundImage: `url("${escaped}")` };
            }
            return this.resolvedBackgroundCss ? { background: this.resolvedBackgroundCss } : {};
        },
        mediaSignature() {
            return JSON.stringify({
                id: this.form?.Id || this.tableRowId,
                imageField: this.banner.ImageField,
                image: this.rawFieldValue(this.banner.ImageField),
                backgroundField: this.banner.BackgroundField,
                background: this.banner.BackgroundField
                    ? this.rawFieldValue(this.banner.BackgroundField)
                    : this.banner.Background
            });
        },
        metricSignature() {
            return JSON.stringify({
                id: this.form?.Id || this.tableRowId,
                metrics: (this.banner.Metrics || []).map((metric) => ({
                    Key: metric.Key,
                    Field: metric.Field,
                    ApiEngineKey: metric.ApiEngineKey,
                    ValuePath: metric.ValuePath,
                    DefaultValue: metric.DefaultValue,
                    RefreshSeconds: metric.RefreshSeconds,
                    value: metric.Field ? this.rawFieldValue(metric.Field) : undefined
                })),
                related: this.autoRelatedFields.map((field) => {
                    const config = this.tableChildConfig(field);
                    const primaryField = config.TableChild?.PrimaryTableFieldName || "";
                    return {
                        Id: field.Id,
                        TableId: config.TableChildTableId,
                        SysMenuId: config.TableChildSysMenuId,
                        Fk: config.TableChildFkFieldName,
                        ParentValue: primaryField ? this.rawFieldValue(primaryField) : (this.form?.Id || this.tableRowId)
                    };
                })
            });
        }
    },
    watch: {
        mediaSignature: {
            immediate: true,
            handler() { this.resolveBannerMedia(); }
        },
        metricSignature: {
            immediate: true,
            handler() { this.refreshBannerMetrics(); }
        }
    },
    beforeUnmount() {
        this.metricGeneration += 1;
        this.mediaGeneration += 1;
        if (this.metricRefreshTimer) clearTimeout(this.metricRefreshTimer);
    },
    methods: {
        findField(name) {
            return name ? this.fieldMap.get(String(name).toLowerCase()) : null;
        },
        rawFieldValue(name) {
            if (!name) return undefined;
            const field = this.findField(name);
            const actualName = field?.AsName || field?.Name || name;
            return this.form?.[actualName] !== undefined ? this.form[actualName] : this.form?.[name];
        },
        tableChildConfig(field) {
            const value = field && field.Config;
            if (value && typeof value === "object" && !Array.isArray(value)) return value;
            try {
                const parsed = JSON.parse(value || "{}");
                return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
            } catch (_error) {
                return {};
            }
        },
        formatMetricValue(value, metric) {
            if (typeof value !== "number" || !Number.isFinite(value)) return value;
            const maximumFractionDigits = Number.isInteger(value)
                ? 0
                : Math.min(4, Math.max(0, Number(metric?.Decimals ?? 2)));
            return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
        },
        fieldText(name) {
            const raw = this.rawFieldValue(name);
            if (!name || raw === undefined || raw === null || raw === "") return "";
            return getFormFieldDisplayValue(this.form, this.findField(name) || { Name: name }, { emptyText: "" });
        },
        async resolveMediaValue(value, field) {
            const path = firstBannerFilePath(value);
            if (!path) return "";
            if (isPrivateBannerUploadField(field) && this.getPrivateFileUrl) {
                const privateValue = await this.getPrivateFileUrl(path, {
                    FormEngineKey: this.table?.Name || this.table?.Id,
                    FormDataId: this.form?.Id || this.tableRowId,
                    FieldId: field?.Id || field?.Name,
                    SysMenuId: this.sysMenuId
                });
                return resultUrl(privateValue);
            }
            return this.getServerPath ? resultUrl(this.getServerPath(path, false)) : path;
        },
        async resolveBannerMedia() {
            const generation = ++this.mediaGeneration;
            this.imageFailed = false;
            const imageField = this.findField(this.banner.ImageField);
            const backgroundField = this.findField(this.banner.BackgroundField);
            const backgroundValue = this.banner.BackgroundField
                ? this.rawFieldValue(this.banner.BackgroundField)
                : this.banner.Background;
            const backgroundCss = safeCssBackground(backgroundValue);
            try {
                const [image, backgroundImage] = await Promise.all([
                    this.resolveMediaValue(this.rawFieldValue(this.banner.ImageField), imageField),
                    backgroundCss ? Promise.resolve("") : this.resolveMediaValue(backgroundValue, backgroundField)
                ]);
                if (generation !== this.mediaGeneration) return;
                this.resolvedImage = image || "";
                this.resolvedBackgroundImage = backgroundImage || "";
                this.resolvedBackgroundCss = backgroundCss;
            } catch (_error) {
                if (generation !== this.mediaGeneration) return;
                this.resolvedImage = "";
                this.resolvedBackgroundImage = "";
                this.resolvedBackgroundCss = backgroundCss;
            }
        },
        buildMetricParams(descriptors) {
            const params = {
                TableId: this.table?.Id,
                TableName: this.table?.Name,
                RecordId: this.form?.Id || this.tableRowId,
                SysMenuId: this.sysMenuId,
                Form: this.form,
                MetricKeys: descriptors.map((item) => item.key),
                Metrics: descriptors.map((item) => ({
                    Key: item.key,
                    Field: item.metric.Field,
                    ValuePath: item.metric.ValuePath
                }))
            };
            descriptors.forEach(({ metric }) => {
                const map = metric && metric.ParamMap;
                if (!map || typeof map !== "object" || Array.isArray(map)) return;
                Object.entries(map).forEach(([target, source]) => {
                    if (!target || FORBIDDEN_KEYS.has(target)) return;
                    if (typeof source === "string" && /^(Form|Table|Context)\./u.test(source)) {
                        params[target] = getBannerValueByPath({ Form: this.form, Table: this.table, Context: params }, source);
                    } else {
                        params[target] = source;
                    }
                });
            });
            return params;
        },
        async refreshBannerMetrics() {
            if (this.metricRefreshTimer) {
                clearTimeout(this.metricRefreshTimer);
                this.metricRefreshTimer = null;
            }
            const groups = collectFormBannerMetricApiGroups(this.banner.Metrics);
            const relatedFields = this.autoRelatedFields;
            const generation = ++this.metricGeneration;
            const canLoadApiMetrics = groups.size > 0 && Boolean(this.runApiEngine);
            const canLoadRelatedMetrics = relatedFields.length > 0 && Boolean(this.loadRelatedMetrics)
                && Boolean(this.form?.Id || this.tableRowId);
            if (!canLoadApiMetrics && !canLoadRelatedMetrics) {
                this.metricRuntimeValues = Object.create(null);
                this.relatedMetricRuntimeItems = [];
                this.metricsLoading = false;
                return;
            }
            this.metricsLoading = true;
            const values = Object.create(null);
            const requests = canLoadApiMetrics ? [...groups.entries()].map(async ([apiEngineKey, descriptors]) => {
                try {
                    const response = await this.runApiEngine(apiEngineKey, this.buildMetricParams(descriptors));
                    if (response && typeof response === "object"
                        && Object.prototype.hasOwnProperty.call(response, "Code")
                        && Number(response.Code) !== 1) {
                        throw new Error(response.Msg || "Banner 统计接口返回失败");
                    }
                    descriptors.forEach((descriptor) => {
                        const value = resolveFormBannerMetricValue(response, descriptor);
                        if (value !== undefined && !FORBIDDEN_KEYS.has(descriptor.key)) values[descriptor.key] = value;
                    });
                } catch (_error) {
                    descriptors.forEach((descriptor) => {
                        const fallback = descriptor.metric.DefaultValue;
                        if (fallback !== undefined && !FORBIDDEN_KEYS.has(descriptor.key)) values[descriptor.key] = fallback;
                    });
                }
            }) : [];
            let relatedItems = [];
            if (canLoadRelatedMetrics) {
                requests.push((async () => {
                    try {
                        const result = await this.loadRelatedMetrics(relatedFields, {
                            RecordId: this.form?.Id || this.tableRowId,
                            Form: this.form,
                            Table: this.table,
                            SysMenuId: this.sysMenuId
                        });
                        relatedItems = Array.isArray(result) ? result : [];
                    } catch (_error) {
                        relatedItems = [];
                    }
                })());
            }
            await Promise.all(requests);
            if (generation !== this.metricGeneration) return;
            this.metricRuntimeValues = values;
            this.relatedMetricRuntimeItems = relatedItems;
            this.metricsLoading = false;
            const refreshSeconds = getFormBannerMetricRefreshSeconds(this.banner.Metrics);
            if (refreshSeconds) {
                this.metricRefreshTimer = setTimeout(() => {
                    this.metricRefreshTimer = null;
                    this.refreshBannerMetrics();
                }, refreshSeconds * 1000);
            }
        }
    }
};
</script>

<style lang="scss" scoped>
.diy-standard-form-banner {
    --banner-accent: var(--mci-color-primary, var(--el-color-primary));
    --banner-accent-strong: var(--mci-color-primary-strong, var(--mci-color-primary-dark, var(--el-color-primary-dark-2)));
    --banner-accent-rgb: var(--mci-color-primary-rgb, var(--el-color-primary-rgb, 64, 158, 255));
    --banner-text: #fff;
    --banner-muted: rgba(255, 255, 255, .76);
    --banner-card: rgba(255, 255, 255, .11);
    --banner-radial-alpha: .34;
    --banner-theme-start-alpha: .56;
    --banner-theme-mid-alpha: .38;
    --banner-theme-end-alpha: .28;
    position: relative;
    isolation: isolate;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    // min-height: 82px;
    margin-bottom: 9px;
    overflow: hidden;
    border: 0;
    border-radius: var(--mci-radius-xl, 18px);
    color: var(--banner-text);
    background:
        radial-gradient(circle at 88% -12%, rgba(var(--banner-accent-rgb), var(--banner-radial-alpha)) 0%, transparent 44%),
        linear-gradient(124deg,
            rgba(var(--banner-accent-rgb), var(--banner-theme-start-alpha)) 0%,
            rgba(var(--banner-accent-rgb), var(--banner-theme-mid-alpha)) 58%,
            rgba(var(--banner-accent-rgb), var(--banner-theme-end-alpha)) 100%),
        linear-gradient(135deg, #142238 0%, #263a55 100%);
    box-shadow:
        0 12px 30px color-mix(in srgb, var(--banner-accent) 14%, rgba(10, 24, 48, .22)),
        inset 0 1px 0 rgba(255, 255, 255, .14);
    background-position: center;
    background-size: cover;

    &::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        background:
            linear-gradient(112deg, rgba(255, 255, 255, .13) 0%, transparent 28%, transparent 68%, rgba(255, 255, 255, .055) 100%),
            radial-gradient(circle at 8% 120%, rgba(255, 255, 255, .10), transparent 36%);
    }

    &.has-custom-background {
        --banner-card: rgba(8, 25, 46, .34);
        text-shadow: 0 1px 8px rgba(0, 0, 0, .22);

        &::before {
            background:
                linear-gradient(100deg, rgba(7, 20, 40, .76) 0%, rgba(7, 20, 40, .54) 58%, rgba(7, 20, 40, .30) 100%),
                linear-gradient(112deg, rgba(255, 255, 255, .08), transparent 34%);
        }
    }

    &__content {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 9px;
        padding: 12px 14px;
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-width: 0;
    }

    &__identity {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }

    &__avatar {
        flex: 0 0 42px;
        width: 42px;
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 0;
        border-radius: 12px;
        color: #fff;
        background: rgba(255, 255, 255, .15);
        font-size: 18px;
        font-weight: 760;
        box-shadow: 0 8px 18px rgba(7, 18, 36, .16), inset 0 1px 0 rgba(255, 255, 255, .22);
        backdrop-filter: blur(10px);

        img { width: 100%; height: 100%; object-fit: cover; }
    }

    &__copy {
        min-width: 0;

        h2 {
            margin: 0;
            overflow: hidden;
            color: var(--banner-text);
            font-size: 17px;
            font-weight: 760;
            line-height: 24px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        p {
            max-width: min(620px, 56vw);
            margin: 2px 0 0;
            overflow: hidden;
            color: var(--banner-muted);
            font-size: 12px;
            line-height: 18px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    &__tags {
        flex: 0 1 auto;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 5px;
        min-width: 0;
        flex-wrap: wrap;
    }

    &__tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        max-width: 180px;
        min-height: 25px;
        box-sizing: border-box;
        padding: 3px 8px;
        overflow: hidden;
        border: 0;
        border-radius: 999px;
        color: #fff;
        background: rgba(255, 255, 255, .13);
        font-size: 11px;
        line-height: 16px;
        text-overflow: ellipsis;
        white-space: nowrap;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .13);
        backdrop-filter: blur(8px);

        b { font-weight: 650; opacity: .74; }
        &.is-success { background: color-mix(in srgb, var(--el-color-success) 34%, rgba(7, 20, 40, .22)); }
        &.is-warning { background: color-mix(in srgb, var(--el-color-warning) 36%, rgba(7, 20, 40, .22)); }
        &.is-danger { background: color-mix(in srgb, var(--el-color-danger) 34%, rgba(7, 20, 40, .22)); }
    }

    &__metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
        gap: 6px;
    }

    &__metric {
        min-width: 0;
        min-height: 44px;
        display: flex;
        align-items: center;
        gap: 8px;
        box-sizing: border-box;
        padding: 7px 9px;
        border: 0;
        border-radius: 12px;
        background: var(--banner-card);
        box-shadow: 0 7px 18px rgba(7, 18, 36, .14), inset 0 1px 0 rgba(255, 255, 255, .12);
        backdrop-filter: blur(10px);
    }

    &__metric-icon {
        flex: 0 0 28px;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 9px;
        color: #fff;
        background: rgba(255, 255, 255, .13);
    }

    &__metric-copy {
        min-width: 0;
        display: grid;

        strong {
            overflow: hidden;
            color: var(--banner-text);
            font-size: 14px;
            font-weight: 740;
            line-height: 18px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        small {
            margin-top: 1px;
            overflow: hidden;
            color: var(--banner-muted);
            font-size: 10px;
            line-height: 15px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    &__metric-affix { font-size: .76em; font-weight: 620; opacity: .78; }
}

// 暗色界面以中性的深色表面为主体，只保留轻量主题光晕。主题色若仍以
// 50% 左右强度叠加，会让 Banner 与其它暗色卡片割裂。
:global(html.dark .diy-standard-form-banner),
:global(html[data-theme="dark"] .diy-standard-form-banner) {
    --banner-radial-alpha: .15;
    --banner-theme-start-alpha: .18;
    --banner-theme-mid-alpha: .12;
    --banner-theme-end-alpha: .08;
    --banner-card: rgba(255, 255, 255, .075);
    background-color: #151e2d;
    box-shadow:
        0 12px 30px rgba(3, 8, 18, .28),
        inset 0 1px 0 rgba(255, 255, 255, .09);
}

@media (min-width: 980px) {
    .diy-standard-form-banner.has-metrics .diy-standard-form-banner__content {
        grid-template-columns: minmax(280px, 1.05fr) minmax(340px, .95fr);
        align-items: center;
    }
}

@media (max-width: 720px) {
    .diy-standard-form-banner {
        display: none !important;
    }
}
</style>
