<template>
    <section class="mci-micro-app-error" data-mci-ui-root role="alert" aria-live="polite">
        <div class="mci-micro-app-error__icon" aria-hidden="true">!</div>
        <div class="mci-micro-app-error__body">
            <h2 class="mci-micro-app-error__title">微服务暂时无法加载</h2>
            <p class="mci-micro-app-error__message">{{ message || "运行入口不可用，请稍后重试。" }}</p>
            <dl class="mci-micro-app-error__details">
                <template v-for="item in visibleDetails" :key="item.label">
                    <dt>{{ item.label }}</dt>
                    <dd :title="item.value">{{ item.value }}</dd>
                </template>
            </dl>
            <div class="mci-micro-app-error__actions">
                <el-button type="primary" @click="$emit('retry')">重新加载</el-button>
                <el-button @click="$emit('back')">返回上一页</el-button>
                <el-button text @click="$emit('copy')">复制诊断信息</el-button>
            </div>
        </div>
    </section>
</template>

<script>
export default {
    name: "MicroAppRuntimeError",
    props: {
        message: { type: String, default: "" },
        details: { type: Object, default: () => ({}) }
    },
    emits: ["retry", "back", "copy"],
    computed: {
        visibleDetails() {
            const labels = {
                appKey: "应用标识",
                pageKey: "页面标识",
                routePath: "页面路由",
                version: "运行版本",
                entryUrl: "入口地址",
                httpStatus: "HTTP 状态",
                publishStatus: "发布状态",
                assetSource: "资产来源",
                mountState: "挂载状态",
                cacheMode: "缓存模式",
                cacheState: "缓存状态",
                cacheInstance: "实例标识",
                reasonCode: "诊断代码"
            };
            return Object.keys(labels)
                .map((key) => ({ label: labels[key], value: String(this.details?.[key] ?? "").trim() }))
                .filter((item) => item.value);
        }
    }
};
</script>

<style lang="scss" scoped>
.mci-micro-app-error {
    display: flex;
    gap: var(--mci-space-4, 16px);
    width: min(760px, calc(100% - 32px));
    margin: var(--mci-space-8, 32px) auto;
    padding: var(--mci-space-6, 24px);
    color: var(--mci-text-primary, var(--el-text-color-primary));
    background: var(--mci-bg-card, var(--el-bg-color));
    border: 1px solid var(--mci-border-color, var(--el-border-color-light));
    border-radius: var(--mci-shape-panel, var(--mci-radius-lg, 16px));
    box-shadow: var(--mci-shadow-card, var(--el-box-shadow-light));
}

.mci-micro-app-error__icon {
    display: inline-flex;
    flex: 0 0 44px;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    color: var(--el-color-danger);
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    background: var(--el-color-danger-light-9);
    border-radius: 50%;
}

.mci-micro-app-error__body { min-width: 0; flex: 1; }
.mci-micro-app-error__title { margin: 0; font-size: 18px; line-height: 1.45; }
.mci-micro-app-error__message { margin: 8px 0 16px; color: var(--mci-text-secondary, var(--el-text-color-regular)); line-height: 1.7; }

.mci-micro-app-error__details {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    margin: 0;
    padding: 12px 16px;
    background: var(--mci-bg-surface, var(--el-fill-color-light));
    border-radius: var(--mci-shape-input, var(--mci-radius-md, 12px));
}

.mci-micro-app-error__details dt,
.mci-micro-app-error__details dd { margin: 0; padding: 5px 0; font-size: 13px; line-height: 1.5; }
.mci-micro-app-error__details dt { color: var(--mci-text-secondary, var(--el-text-color-secondary)); }
.mci-micro-app-error__details dd { overflow: hidden; color: var(--mci-text-primary, var(--el-text-color-primary)); text-overflow: ellipsis; white-space: nowrap; }
.mci-micro-app-error__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.mci-micro-app-error__actions :deep(.el-button + .el-button) { margin-left: 0; }

@media (max-width: 640px) {
    .mci-micro-app-error { width: calc(100% - 24px); margin: 12px; padding: 16px; }
    .mci-micro-app-error__details { grid-template-columns: 1fr; }
    .mci-micro-app-error__details dt { padding-bottom: 0; }
    .mci-micro-app-error__details dd { padding-top: 2px; white-space: normal; overflow-wrap: anywhere; }
}
</style>
