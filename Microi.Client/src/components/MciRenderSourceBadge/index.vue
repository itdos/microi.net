<template>
    <template v-if="visible">
        <span
            class="mci-render-source-badge"
            :class="[
                `mci-render-source-badge--${sourceType}`,
                `mci-render-source-badge--${placement}`,
                { 'is-dismissible': dismissible }
            ]"
            :data-render-source="sourceType"
            role="status"
        >
            <button
                class="mci-render-source-badge__trigger"
                type="button"
                data-render-source-trigger
                :aria-label="openDetailsLabel"
                :title="openDetailsLabel"
                @click="detailsVisible = true"
            >
                <span class="mci-render-source-badge__icon" aria-hidden="true">
                    <svg v-if="sourceType === 'microservice'" viewBox="0 0 18 18" fill="none">
                        <rect x="2.2" y="2.2" width="5.2" height="5.2" rx="1.3" />
                        <rect x="10.6" y="2.2" width="5.2" height="5.2" rx="1.3" />
                        <rect x="6.4" y="10.6" width="5.2" height="5.2" rx="1.3" />
                        <path d="M4.8 7.4v1.2h8.4V7.4M9 8.6v2" />
                    </svg>
                    <svg v-else viewBox="0 0 18 18" fill="none">
                        <path d="M6.8 4.2 2.8 9l4 4.8M11.2 4.2l4 4.8-4 4.8M10.4 2.8 7.6 15.2" />
                    </svg>
                </span>
                <span class="mci-render-source-badge__label">{{ label }}</span>
            </button>
            <button
                v-if="dismissible"
                class="mci-render-source-badge__dismiss"
                type="button"
                data-render-source-dismiss
                :aria-label="dismissLabel"
                :title="dismissLabel"
                @click.stop="dismiss"
            >
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="m4.5 4.5 7 7m0-7-7 7" />
                </svg>
            </button>
        </span>

        <el-dialog
            v-model="detailsVisible"
            class="mci-render-source-dialog"
            modal-class="mci-render-source-dialog-overlay"
            width="min(760px, calc(100vw - 32px))"
            append-to-body
            align-center
            draggable
            :close-on-click-modal="false"
            :close-on-press-escape="true"
            :show-close="true"
        >
            <template #header>
                <div class="mci-render-source-dialog__header">
                    <span class="mci-render-source-dialog__header-icon" aria-hidden="true">
                        <svg v-if="sourceType === 'microservice'" viewBox="0 0 20 20" fill="none">
                            <rect x="2.5" y="2.5" width="5.6" height="5.6" rx="1.4" />
                            <rect x="11.9" y="2.5" width="5.6" height="5.6" rx="1.4" />
                            <rect x="7.2" y="11.9" width="5.6" height="5.6" rx="1.4" />
                            <path d="M5.3 8.1v1.4h9.4V8.1M10 9.5v2.4" />
                        </svg>
                        <svg v-else viewBox="0 0 20 20" fill="none">
                            <path d="M7.4 4.7 3 10l4.4 5.3M12.6 4.7 17 10l-4.4 5.3M11.6 3.2 8.4 16.8" />
                        </svg>
                    </span>
                    <span>
                        <span class="mci-render-source-dialog__eyebrow">{{ label }}</span>
                        <strong>{{ $t("Msg.RenderSourceDetailsTitle") }}</strong>
                    </span>
                </div>
            </template>

            <div class="mci-render-source-dialog__content" data-render-source-details>
                <section class="mci-render-source-dialog__hero">
                    <div>
                        <span class="mci-render-source-dialog__hero-caption">{{ $t("Msg.RenderSourceDetailsSubtitle") }}</span>
                        <h3>{{ displayName }}</h3>
                        <p>{{ sourceDescription }}</p>
                    </div>
                    <span class="mci-render-source-dialog__type-pill">{{ label }}</span>
                </section>

                <section class="mci-render-source-dialog__details" :aria-label="$t('Msg.RenderSourceDetailsTitle')">
                    <article
                        v-for="item in detailItems"
                        :key="item.key"
                        class="mci-render-source-dialog__detail"
                        :class="{ 'is-wide': item.wide }"
                    >
                        <span>{{ item.label }}</span>
                        <code v-if="item.code">{{ item.value }}</code>
                        <strong v-else>{{ item.value }}</strong>
                    </article>
                </section>

                <section class="mci-render-source-dialog__ai-guide">
                    <div class="mci-render-source-dialog__ai-guide-heading">
                        <span class="mci-render-source-dialog__spark" aria-hidden="true">✦</span>
                        <div>
                            <strong>{{ $t("Msg.AiModificationGuide") }}</strong>
                            <p>{{ $t("Msg.AiModificationGuideDesc") }}</p>
                        </div>
                    </div>
                    <pre>{{ aiModifyPrompt }}</pre>
                </section>
            </div>

            <template #footer>
                <div class="mci-render-source-dialog__footer">
                    <el-button @click="detailsVisible = false">{{ $t("Msg.Close") }}</el-button>
                    <el-button type="primary" @click="copyAiPrompt">
                        {{ $t("Msg.CopyAiModifyPrompt") }}
                    </el-button>
                </div>
            </template>
        </el-dialog>
    </template>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { normalizeRenderSourceType } from "@/utils/framework-presentation.js";

const props = defineProps({
    type: { type: String, default: "" },
    placement: { type: String, default: "inline" },
    instanceKey: { type: [String, Number], default: "" },
    dismissible: { type: Boolean, default: false },
    sourceInfo: { type: Object, default: () => ({}) }
});

const emit = defineEmits(["dismiss"]);
const { t } = useI18n();
const dismissed = ref(false);
const detailsVisible = ref(false);

const sourceType = computed(() => normalizeRenderSourceType(props.type));
const visible = computed(() => Boolean(sourceType.value) && !dismissed.value);
const label = computed(() => sourceType.value === "microservice" ? t("Msg.MicroService") : t("Msg.CustomComponent"));
const openDetailsLabel = computed(() => `${t("Msg.OpenRenderSourceDetails")} · ${label.value}`);
const dismissLabel = computed(() => `${t("Msg.DismissRenderSourceBadge")} · ${label.value}`);
const displayName = computed(() => cleanValue(
    props.sourceInfo?.appName
    || props.sourceInfo?.componentName
    || props.sourceInfo?.title
    || props.sourceInfo?.appKey
    || label.value
));
const sourceDescription = computed(() => sourceType.value === "microservice"
    ? t("Msg.MicroServiceSourceDescription")
    : t("Msg.CustomComponentSourceDescription"));

function cleanValue(value) {
    const normalized = value == null ? "" : String(value).trim();
    return /^(?:undefined|null)$/i.test(normalized) ? "" : normalized;
}

function firstValue(...values) {
    for (const value of values) {
        const normalized = cleanValue(value);
        if (normalized) return normalized;
    }
    return "";
}

function joinSourcePath() {
    const explicit = firstValue(props.sourceInfo?.sourcePath, props.sourceInfo?.workspaceSourcePath);
    if (explicit) return explicit;
    const appKey = cleanValue(props.sourceInfo?.appKey);
    const sourceFile = cleanValue(props.sourceInfo?.sourceFile).replace(/^\/+/, "");
    const componentPath = cleanValue(props.sourceInfo?.componentPath).replace(/^\/+/, "");
    if (sourceType.value === "microservice" && appKey) {
        return ["AI应用", appKey, sourceFile].filter(Boolean).join("/");
    }
    return componentPath || sourceFile;
}

const detailItems = computed(() => {
    const info = props.sourceInfo || {};
    const tenant = [cleanValue(info.osClient), cleanValue(info.apiBase)].filter(Boolean).join(" · ");
    return [
        { key: "appKey", label: t("Msg.ApplicationKey"), value: firstValue(info.appKey, info.componentName), code: true },
        { key: "pageKey", label: t("Msg.PageKey"), value: cleanValue(info.pageKey), code: true },
        { key: "version", label: t("Msg.Version"), value: cleanValue(info.version), code: true },
        { key: "routePath", label: t("Msg.RoutePath"), value: cleanValue(info.routePath), code: true },
        { key: "componentPath", label: t("Msg.ComponentPath"), value: cleanValue(info.componentPath), code: true, wide: true },
        { key: "frameworkRoute", label: t("Msg.FrameworkRoute"), value: cleanValue(info.frameworkRoute), code: true, wide: true },
        { key: "sourcePath", label: t("Msg.SourcePath"), value: joinSourcePath(), code: true, wide: true },
        { key: "privateSourcePath", label: t("Msg.PrivateSourcePath"), value: cleanValue(info.privateSourcePath), code: true, wide: true },
        { key: "entryUrl", label: t("Msg.RuntimeEntry"), value: cleanValue(info.entryUrl), code: true, wide: true },
        { key: "publishStatus", label: t("Msg.PublishStatus"), value: cleanValue(info.publishStatus) },
        { key: "assetSource", label: t("Msg.AssetSource"), value: cleanValue(info.assetSource) },
        { key: "mountState", label: t("Msg.MountState"), value: cleanValue(info.mountState) },
        { key: "tenant", label: t("Msg.TenantCoordinate"), value: tenant, code: true, wide: true }
    ].filter(item => item.value);
});

const aiModifyPrompt = computed(() => {
    const info = props.sourceInfo || {};
    const appKey = firstValue(info.appKey, info.componentName, displayName.value);
    const routePath = firstValue(info.routePath, info.frameworkRoute, "/");
    const sourcePath = joinSourcePath();
    if (sourceType.value === "microservice") {
        const prompt = t("Msg.MicroServiceAiModifyPrompt", {
            appKey,
            routePath,
            sourcePath: sourcePath || t("Msg.UnknownSourcePath")
        });
        const coordinates = [
            [t("Msg.TenantCoordinate"), [cleanValue(info.osClient), cleanValue(info.apiBase)].filter(Boolean).join(" · ")],
            [t("Msg.ComponentPath"), cleanValue(info.componentPath)],
            [t("Msg.Version"), cleanValue(info.version)]
        ].filter(([, value]) => value).map(([name, value]) => `${name}：${value}`);
        return [prompt, ...coordinates].join("\n");
    }
    return t("Msg.CustomComponentAiModifyPrompt", {
        componentName: appKey,
        sourcePath: sourcePath || t("Msg.UnknownSourcePath")
    });
});

function dismiss() {
    dismissed.value = true;
    detailsVisible.value = false;
    emit("dismiss");
}

async function copyText(value) {
    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy failed");
}

async function copyAiPrompt() {
    try {
        await copyText(aiModifyPrompt.value);
        ElMessage.success(t("Msg.CopiedToClipboard"));
    } catch (error) {
        ElMessage.error(t("Msg.CopyFailed"));
    }
}

watch(
    () => [props.instanceKey, props.type],
    () => {
        dismissed.value = false;
        detailsVisible.value = false;
    }
);
</script>

<style lang="scss" scoped>
.mci-render-source-badge {
    --source-accent: var(--mci-color-primary, var(--el-color-primary));
    --source-soft: color-mix(in srgb, var(--source-accent) 12%, var(--el-bg-color));
    position: relative;
    display: inline-flex;
    height: 30px;
    align-items: stretch;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--source-accent) 30%, transparent);
    border-radius: 999px;
    color: var(--source-accent);
    background: color-mix(in srgb, var(--source-soft) 90%, transparent);
    box-shadow: 0 8px 22px color-mix(in srgb, var(--source-accent) 14%, transparent);
    font-size: 12px;
    font-weight: 650;
    line-height: 1;
    letter-spacing: .02em;
    white-space: nowrap;
    backdrop-filter: blur(12px);
    pointer-events: auto;
}

.mci-render-source-badge--custom {
    --source-accent: var(--el-color-warning-dark-2, #b56b00);
}

.mci-render-source-badge__trigger,
.mci-render-source-badge__dismiss {
    appearance: none;
    display: inline-flex;
    border: 0;
    color: inherit;
    background: transparent;
    font: inherit;
    cursor: pointer;
}

.mci-render-source-badge__trigger {
    align-items: center;
    gap: 6px;
    padding: 0 11px 0 9px;
}

.mci-render-source-badge__trigger:hover,
.mci-render-source-badge__trigger:focus-visible {
    background: color-mix(in srgb, var(--source-accent) 9%, transparent);
}

.mci-render-source-badge__dismiss {
    width: 28px;
    align-items: center;
    justify-content: center;
    border-left: 1px solid color-mix(in srgb, var(--source-accent) 20%, transparent);
    opacity: .72;
}

.mci-render-source-badge__dismiss:hover,
.mci-render-source-badge__dismiss:focus-visible {
    opacity: 1;
    background: color-mix(in srgb, var(--source-accent) 10%, transparent);
}

.mci-render-source-badge__dismiss svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
}

.mci-render-source-badge__icon {
    display: inline-flex;
    flex: 0 0 16px;
    width: 16px;
    height: 16px;
    align-items: center;
    justify-content: center;
}

.mci-render-source-badge__icon svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.mci-render-source-badge--edge {
    position: absolute;
    top: 14px;
    right: 16px;
    z-index: 36;
}

.mci-render-source-badge button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--source-accent) 48%, transparent);
    outline-offset: -2px;
}

@media (max-width: 640px) {
    .mci-render-source-badge--edge {
        top: 10px;
        right: 10px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .mci-render-source-badge,
    .mci-render-source-badge * {
        transition: none !important;
    }
}
</style>

<style lang="scss">
.mci-render-source-dialog-overlay {
    background: color-mix(in srgb, #0f172a 46%, transparent) !important;
    backdrop-filter: blur(8px) saturate(110%);
}

.mci-render-source-dialog.el-dialog {
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--el-color-primary) 14%, var(--el-border-color-light));
    border-radius: 24px;
    background: var(--mci-bg-elevated, var(--el-bg-color-overlay));
    box-shadow: 0 28px 80px color-mix(in srgb, #0f172a 25%, transparent);
}

.mci-render-source-dialog .el-dialog__header {
    margin: 0;
    padding: 22px 56px 18px 24px;
    border-bottom: 1px solid var(--mci-border-color, var(--el-border-color-lighter));
}

.mci-render-source-dialog .el-dialog__headerbtn {
    top: 17px;
    right: 17px;
    width: 36px;
    height: 36px;
    border-radius: 12px;
}

.mci-render-source-dialog .el-dialog__headerbtn:hover {
    background: var(--el-fill-color-light);
}

.mci-render-source-dialog .el-dialog__body {
    padding: 0;
}

.mci-render-source-dialog .el-dialog__footer {
    padding: 16px 24px 20px;
    border-top: 1px solid var(--mci-border-color, var(--el-border-color-lighter));
}

.mci-render-source-dialog__header {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--mci-text-primary, var(--el-text-color-primary));
}

.mci-render-source-dialog__header > span:last-child {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.mci-render-source-dialog__header strong {
    font-size: 18px;
    line-height: 1.3;
}

.mci-render-source-dialog__eyebrow {
    color: var(--el-color-primary);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
}

.mci-render-source-dialog__header-icon {
    display: grid;
    flex: 0 0 42px;
    width: 42px;
    height: 42px;
    place-items: center;
    border-radius: 14px;
    color: var(--el-color-primary);
    background: color-mix(in srgb, var(--el-color-primary) 11%, var(--el-bg-color));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el-color-primary) 16%, transparent);
}

.mci-render-source-dialog__header-icon svg {
    width: 21px;
    height: 21px;
    stroke: currentColor;
    stroke-width: 1.55;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.mci-render-source-dialog__content {
    display: flex;
    max-height: min(68vh, 680px);
    flex-direction: column;
    gap: 18px;
    overflow-y: auto;
    padding: 22px 24px 24px;
}

.mci-render-source-dialog__hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 20px;
    border: 1px solid color-mix(in srgb, var(--el-color-primary) 14%, var(--el-border-color-lighter));
    border-radius: 18px;
    background:
        radial-gradient(circle at 92% 8%, color-mix(in srgb, var(--el-color-primary) 15%, transparent), transparent 40%),
        color-mix(in srgb, var(--el-color-primary) 4%, var(--el-bg-color));
}

.mci-render-source-dialog__hero-caption {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}

.mci-render-source-dialog__hero h3 {
    margin: 5px 0 7px;
    color: var(--mci-text-primary, var(--el-text-color-primary));
    font-size: 20px;
    line-height: 1.35;
}

.mci-render-source-dialog__hero p,
.mci-render-source-dialog__ai-guide p {
    margin: 0;
    color: var(--mci-text-secondary, var(--el-text-color-regular));
    font-size: 13px;
    line-height: 1.7;
}

.mci-render-source-dialog__type-pill {
    flex: 0 0 auto;
    padding: 7px 11px;
    border-radius: 999px;
    color: var(--el-color-primary);
    background: color-mix(in srgb, var(--el-color-primary) 10%, var(--el-bg-color));
    font-size: 12px;
    font-weight: 700;
}

.mci-render-source-dialog__details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.mci-render-source-dialog__detail {
    display: flex;
    min-width: 0;
    min-height: 68px;
    flex-direction: column;
    gap: 8px;
    justify-content: center;
    padding: 12px 14px;
    box-sizing: border-box;
    border: 1px solid var(--mci-border-color, var(--el-border-color-lighter));
    border-radius: 14px;
    background: var(--mci-bg-subtle, var(--el-fill-color-extra-light));
}

.mci-render-source-dialog__detail.is-wide {
    grid-column: 1 / -1;
}

.mci-render-source-dialog__detail > span {
    color: var(--el-text-color-secondary);
    font-size: 11px;
}

.mci-render-source-dialog__detail strong,
.mci-render-source-dialog__detail code {
    overflow-wrap: anywhere;
    color: var(--mci-text-primary, var(--el-text-color-primary));
    font-size: 13px;
    line-height: 1.55;
}

.mci-render-source-dialog__detail code {
    font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
}

.mci-render-source-dialog__ai-guide {
    padding: 18px;
    border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, var(--el-border-color-light));
    border-radius: 18px;
    background: linear-gradient(145deg,
        color-mix(in srgb, var(--el-color-primary) 8%, var(--el-bg-color)),
        color-mix(in srgb, var(--el-color-success) 5%, var(--el-bg-color)));
}

.mci-render-source-dialog__ai-guide-heading {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.mci-render-source-dialog__ai-guide-heading strong {
    display: block;
    margin-bottom: 4px;
    color: var(--mci-text-primary, var(--el-text-color-primary));
    font-size: 14px;
}

.mci-render-source-dialog__spark {
    display: grid;
    flex: 0 0 30px;
    width: 30px;
    height: 30px;
    place-items: center;
    border-radius: 10px;
    color: var(--el-color-primary);
    background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color));
}

.mci-render-source-dialog__ai-guide pre {
    max-height: 150px;
    margin: 14px 0 0;
    overflow: auto;
    padding: 13px 14px;
    border: 1px solid color-mix(in srgb, var(--el-color-primary) 12%, var(--el-border-color-lighter));
    border-radius: 12px;
    color: var(--mci-text-primary, var(--el-text-color-primary));
    background: color-mix(in srgb, var(--el-bg-color) 84%, transparent);
    font: 12px/1.7 "Cascadia Code", "SFMono-Regular", Consolas, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.mci-render-source-dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

@media (max-width: 640px) {
    .mci-render-source-dialog.el-dialog {
        border-radius: 18px;
    }

    .mci-render-source-dialog__content {
        padding: 16px;
    }

    .mci-render-source-dialog__hero {
        flex-direction: column;
    }

    .mci-render-source-dialog__details {
        grid-template-columns: 1fr;
    }

    .mci-render-source-dialog__detail.is-wide {
        grid-column: auto;
    }
}

@media (prefers-reduced-motion: reduce) {
    .mci-render-source-dialog *,
    .mci-render-source-dialog-overlay {
        transition: none !important;
        animation: none !important;
    }
}
</style>
