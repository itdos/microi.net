<template>
    <nav v-if="visibleActions.length" class="mci-action-grid" aria-label="快捷操作">
        <button
            v-for="action in visibleActions"
            :key="action.Key"
            type="button"
            class="mci-action-grid__item"
            :class="toneClass(action.Tone)"
            @click="$emit('action', action)"
        >
            <span class="mci-action-grid__icon">
                <fa-icon :icon="action.Icon || 'fas fa-bolt'" />
            </span>
            <span class="mci-action-grid__label">{{ action.Label }}</span>
        </button>
    </nav>
</template>

<script>
import { isActionVisible } from "./view-schema-runtime";

export default {
    name: "ActionGrid",
    emits: ["action"],
    props: {
        actions: { type: Array, default: () => [] },
        form: { type: Object, default: () => ({}) }
    },
    computed: {
        visibleActions() {
            return this.actions.filter((action) => isActionVisible(action, this.form));
        }
    },
    methods: {
        toneClass(value) {
            const tone = String(value || "primary").toLowerCase();
            return `is-${["primary", "success", "warning", "danger", "info"].includes(tone) ? tone : "primary"}`;
        }
    }
};
</script>

<style scoped>
.mci-action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(124px, 1fr));
    gap: 10px;
    margin: 0 18px 12px;
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter, #e5e9f0);
    border-radius: 8px;
    background: var(--el-bg-color, #fff);
}

.mci-action-grid__item {
    display: flex;
    min-width: 0;
    min-height: 64px;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--el-border-color-extra-light, #eef1f5);
    border-radius: 6px;
    color: var(--el-text-color-primary, #1f2937);
    background: var(--el-bg-color, #fff);
    cursor: pointer;
}

.mci-action-grid__item:hover {
    border-color: var(--el-color-primary-light-7, #a0cfff);
    background: var(--el-fill-color-light, #f5f7fa);
    transform: translateY(-1px);
}

.mci-action-grid__icon {
    display: grid;
    place-items: center;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    color: var(--el-color-primary, #1677ff);
    background: var(--el-color-primary-light-9, #ecf5ff);
}

.mci-action-grid__item.is-success .mci-action-grid__icon {
    color: var(--el-color-success, #67c23a);
    background: var(--el-color-success-light-9, #f0f9eb);
}

.mci-action-grid__item.is-warning .mci-action-grid__icon {
    color: var(--el-color-warning, #e6a23c);
    background: var(--el-color-warning-light-9, #fdf6ec);
}

.mci-action-grid__item.is-danger .mci-action-grid__icon {
    color: var(--el-color-danger, #f56c6c);
    background: var(--el-color-danger-light-9, #fef0f0);
}

.mci-action-grid__item.is-info .mci-action-grid__icon {
    color: var(--el-color-info, #909399);
    background: var(--el-color-info-light-9, #f4f4f5);
}

.mci-action-grid__label {
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
