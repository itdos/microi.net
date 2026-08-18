<template>
    <section class="mci-form-view">
        <EntityHero
            :title="heroTitle"
            :meta="heroMeta"
            :status="heroStatus"
            :image="heroImage"
            :icon="hero.Icon"
            :background="heroBackground"
            :metrics="metrics"
        />

        <div class="mci-form-view__content">
            <ActionGrid
                v-if="actions.length"
                :actions="actions"
                :form="form"
                @action="$emit('action', $event)"
            />
            <ResponsiveSection
                v-for="section in sections"
                :key="section.Key"
                :section="section"
                :expanded="Boolean(expanded[section.Key])"
                @toggle="toggle(section.Key)"
            >
                <template #default="{ field }">
                    <div v-if="field.Kind === 'rich'" v-safe-html="field.Html" class="mci-form-view__rich"></div>
                    <div v-else-if="field.Kind === 'images'" class="mci-form-view__images">
                        <el-image
                            v-for="image in field.Images"
                            :key="image"
                            :src="image"
                            :preview-src-list="field.Images"
                            fit="cover"
                        >
                            <template #error>
                                <div class="mci-form-view__image-error">
                                    <fa-icon icon="far fa-image" />
                                </div>
                            </template>
                        </el-image>
                    </div>
                    <div v-else-if="field.Kind === 'files'" class="mci-form-view__files">
                        <a
                            v-for="file in field.Files"
                            :key="file.Url"
                            :href="file.Url"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {{ file.Name }}
                        </a>
                    </div>
                    <span v-else>{{ field.Value }}</span>
                </template>
            </ResponsiveSection>
            <section v-for="block in metricBlocks" :key="block.Key" class="mci-form-view__metric-block">
                <h3 v-if="block.Title">{{ block.Title }}</h3>
                <MetricStrip :items="block.Items" />
            </section>
            <ActionGrid
                v-for="block in actionBlocks"
                :key="block.Key"
                :actions="block.Actions"
                :form="form"
                @action="$emit('action', $event)"
            />
        </div>
    </section>
</template>

<script>
import { selectModuleView } from "./view-schema-runtime";
import ActionGrid from "./action-grid.vue";
import EntityHero from "./entity-hero.vue";
import MetricStrip from "./metric-strip.vue";
import ResponsiveSection from "./responsive-section.vue";

const SYSTEM_FIELDS = new Set([
    "Id", "OsClient", "IsDeleted", "CreateUserId", "UpdateUserId", "ParentId", "ParentIds"
]);
const LAYOUT_COMPONENTS = new Set([
    "Divider", "CollapseGroup", "Tabs", "Alert", "StaticText", "Button", "DevComponent", "TableChild"
]);

function parseValue(value) {
    if (typeof value !== "string") return value;
    const text = value.trim();
    if (!text || !["[", "{"].includes(text[0])) return value;
    try {
        return JSON.parse(text);
    } catch (error) {
        return value;
    }
}

function firstText(value) {
    const parsed = parseValue(value);
    if (Array.isArray(parsed)) return parsed.map(firstText).filter(Boolean).join(" ");
    if (parsed && typeof parsed === "object") {
        return parsed.Label || parsed.Value || parsed.Name || parsed.Text || parsed.Path || parsed.Url || "";
    }
    return parsed === undefined || parsed === null || parsed === "" ? "-" : String(parsed);
}

function fileItems(value) {
    const parsed = parseValue(value);
    const values = Array.isArray(parsed) ? parsed : [parsed];
    return values.map((item) => {
        if (typeof item === "string") return { Name: item.split("/").pop() || "附件", Path: item };
        if (!item || typeof item !== "object") return null;
        const path = item.Path || item.Url || item.FilePath || item.FilePathName || "";
        return path ? { Name: item.Name || item.FileName || path.split("/").pop() || "附件", Path: path } : null;
    }).filter(Boolean);
}

export default {
    name: "FormViewRenderer",
    components: { ActionGrid, EntityHero, MetricStrip, ResponsiveSection },
    emits: ["action"],
    props: {
        menu: { type: Object, default: () => ({}) },
        form: { type: Object, default: () => ({}) },
        fields: { type: Array, default: () => [] },
        table: { type: Object, default: () => ({}) },
        user: { type: Object, default: () => ({}) },
        getServerPath: { type: Function, default: null }
    },
    data() {
        return { expanded: {} };
    },
    computed: {
        view() {
            return selectModuleView(this.menu, { scene: "Detail", device: "PC", user: this.user });
        },
        hero() {
            return this.view?.Layout?.Hero || {};
        },
        fieldMap() {
            const map = new Map();
            this.fields.forEach((field) => map.set(String(field.Name || "").toLowerCase(), field));
            return map;
        },
        heroTitle() {
            return firstText(this.form[this.hero.TitleField] || this.form[this.hero.FallbackTitleField] ||
                this.hero.Title || this.menu.Name || this.table.Description || "详情");
        },
        heroMeta() {
            const value = this.form[this.hero.MetaField] || this.form.TenantName || this.form.CreateTime || "";
            return value === "" || value === null || value === undefined ? "" : firstText(value);
        },
        heroStatus() {
            const value = this.hero.StatusField ? this.form[this.hero.StatusField] : "";
            return value === "" || value === null || value === undefined ? "" : firstText(value);
        },
        heroImage() {
            const fieldNames = [
                this.hero.ImageField,
                "Image", "Img", "Logo", "Avatar", "Touxiang", "KehuTP", "ShebeiTP"
            ].filter(Boolean);
            for (const name of fieldNames) {
                const items = fileItems(this.form[name]);
                if (items.length) return this.resolvePath(items[0].Path);
            }
            return "";
        },
        heroBackground() {
            const background = String(this.hero.Background || "").trim();
            if (!background || /^(#|rgb|linear-gradient|radial-gradient)/i.test(background)) return background;
            return this.resolvePath(background);
        },
        metrics() {
            return this.resolveMetrics(this.hero.Metrics || []);
        },
        actions() {
            return this.view?.Layout?.Actions || [];
        },
        metricBlocks() {
            return (this.view?.Layout?.Blocks || [])
                .filter((block) => block.Type === "MetricStrip" && block.Metrics.length)
                .map((block) => ({ ...block, Items: this.resolveMetrics(block.Metrics) }));
        },
        actionBlocks() {
            return (this.view?.Layout?.Blocks || [])
                .filter((block) => block.Type === "ActionGrid" && block.Actions.length);
        },
        sections() {
            const used = new Set(
                (this.hero.Metrics || [])
                    .filter((metric) => metric.Source === "Field" && metric.Field)
                    .map((metric) => String(metric.Field).toLowerCase())
            );
            const result = [];
            const append = (source, fallbackKey) => {
                const fields = (source.Fields || []).map((config) => {
                    const definition = this.fieldMap.get(String(config.Name || "").toLowerCase());
                    const item = this.toDisplayField(config.Name, definition, config);
                    if (!item || used.has(item.Name.toLowerCase())) return null;
                    used.add(item.Name.toLowerCase());
                    return item;
                }).filter(Boolean);
                if (!fields.length) return;
                result.push({
                    Key: source.Key || fallbackKey,
                    Title: source.Title || "详细信息",
                    Icon: source.Icon || "",
                    Columns: source.Columns || 2,
                    DefaultExpanded: source.DefaultExpanded !== false,
                    Fields: fields
                });
            };
            (this.view?.Layout?.Blocks || [])
                .filter((block) => ["ResponsiveSection", "Section", "FieldSection"].includes(block.Type))
                .forEach((block, index) => append(block, `configured:${index}`));

            const remaining = this.fields.filter((field) => {
                const name = String(field.Name || "");
                return this.isDisplayField(field) && !used.has(name.toLowerCase());
            });
            const groups = new Map();
            remaining.forEach((field) => {
                const title = this.tabTitle(field.Tab) || "更多信息";
                if (!groups.has(title)) groups.set(title, []);
                groups.get(title).push({ Name: field.Name, Label: field.Label });
            });
            groups.forEach((fields, title) => append({
                Key: `fallback:${title}`,
                Title: title,
                Columns: 2,
                DefaultExpanded: result.length === 0,
                Fields: fields
            }, `fallback:${title}`));
            return result;
        }
    },
    watch: {
        sections: {
            immediate: true,
            handler(value) {
                const next = {};
                (value || []).forEach((section, index) => {
                    next[section.Key] = this.expanded[section.Key] ?? section.DefaultExpanded ?? index === 0;
                });
                this.expanded = next;
            }
        }
    },
    methods: {
        resolvePath(path) {
            if (!path) return "";
            return this.getServerPath ? this.getServerPath(path) : path;
        },
        tabTitle(tabId) {
            const tabs = parseValue(this.table?.Tabs);
            if (!Array.isArray(tabs)) return "";
            const tab = tabs.find((item) => String(item.Id || item.Name) === String(tabId || ""));
            return tab ? (tab.Name || tab.Label || "") : "";
        },
        isDisplayField(field) {
            const name = String(field?.Name || "");
            if (!name || SYSTEM_FIELDS.has(name) || LAYOUT_COMPONENTS.has(field.Component)) return false;
            if (Number(field.Visible) === 0) return false;
            return Object.prototype.hasOwnProperty.call(this.form, name);
        },
        toDisplayField(name, definition, config = {}) {
            const field = definition || { Name: name, Label: config.Label || name };
            if (!this.isDisplayField(field)) return null;
            const raw = this.form[name];
            const component = String(field.Component || "");
            const item = {
                Name: name,
                Label: config.Label || field.Label || name,
                Width: config.Width || field.FormWidth,
                Kind: "text",
                Value: this.formatValue(raw, field, config.Format)
            };
            if (["RichText", "Html"].includes(component) || /<[^>]+>/.test(String(raw || ""))) {
                item.Kind = "rich";
                item.Html = String(raw || "");
            } else if (component === "ImgUpload") {
                item.Kind = "images";
                item.Images = fileItems(raw).map((file) => this.resolvePath(file.Path));
            } else if (component === "FileUpload") {
                item.Kind = "files";
                item.Files = fileItems(raw).map((file) => ({
                    Name: file.Name,
                    Url: this.resolvePath(file.Path)
                }));
            }
            return item;
        },
        formatValue(value, field, format) {
            if (value === undefined || value === null || value === "") return "—";
            const parsed = parseValue(value);
            if (Array.isArray(parsed)) return parsed.map(firstText).filter(Boolean).join(" / ") || "—";
            if (parsed && typeof parsed === "object") return firstText(parsed) || "—";
            const component = String(field?.Component || "");
            const rule = String(format || "").toLowerCase();
            if (rule === "money" || /金额|价格|费用|余额/.test(String(field?.Label || ""))) {
                const number = Number(parsed);
                return Number.isFinite(number) ? `¥${number.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}` : firstText(parsed);
            }
            if (component === "Switch") return Number(parsed) === 1 ? "是" : "否";
            return firstText(parsed);
        },
        resolveMetrics(metrics) {
            return metrics.filter((metric) => metric.Source === "Field").map((metric) => ({
                ...metric,
                Value: this.metricValue(this.form[metric.Field], metric.Format),
                Suffix: metric.Suffix || ""
            }));
        },
        metricValue(value, format) {
            if (value === undefined || value === null || value === "" || value === "—" || value === "-") {
                return "0";
            }
            return this.formatValue(value, null, format);
        },
        toggle(key) {
            this.expanded = { ...this.expanded, [key]: !this.expanded[key] };
        }
    }
};
</script>

<style scoped>
.mci-form-view {
    width: 100%;
    max-width: 1480px;
    margin: 0 auto;
    overflow: hidden;
    color: var(--el-text-color-primary, #1f2937);
    background: var(--el-bg-color-page, #f5f7fa);
    border-radius: 8px;
    box-shadow: 0 14px 34px rgba(31, 45, 61, .07);
}
.mci-form-view__content {
    padding: 16px 0 8px;
}
.mci-form-view__metric-block {
    margin: 0 18px 12px;
    padding: 16px 18px;
    border-radius: 8px;
    color: #fff;
    background: #075b78;
}
.mci-form-view__metric-block h3 {
    margin: 0 0 10px;
    font-size: 16px;
}
.mci-form-view__images {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.mci-form-view__images :deep(.el-image) {
    width: 84px;
    height: 84px;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter, #e5e9f0);
    border-radius: 6px;
}
.mci-form-view__image-error {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    color: var(--el-text-color-placeholder, #a8abb2);
    background: var(--el-fill-color-light, #f5f7fa);
    font-size: 22px;
}
.mci-form-view__files {
    display: grid;
    gap: 6px;
}
.mci-form-view__files a {
    color: var(--el-color-primary, #1677ff);
    text-decoration: none;
}
.mci-form-view__rich {
    color: var(--el-text-color-regular, #4b5563);
    line-height: 1.75;
}
.mci-form-view__rich :deep(p:first-child) {
    margin-top: 0;
}
.mci-form-view__rich :deep(p:last-child) {
    margin-bottom: 0;
}
.mci-form-view__rich :deep(img) {
    max-width: 100%;
}
</style>
