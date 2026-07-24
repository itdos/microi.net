<template>
    <div v-if="items.length" class="mci-metric-strip">
        <div
            v-for="item in items"
            :key="item.Key"
            class="mci-metric-strip__item"
        >
            <fa-icon
                v-if="item.Icon"
                class="mci-metric-strip__icon"
                :icon="item.Icon"
                :style="item.Color ? { color: item.Color } : null"
            />
            <div class="mci-metric-strip__copy">
                <div class="mci-metric-strip__value">
                    {{ item.Value }}<small v-if="item.Suffix">{{ item.Suffix }}</small>
                </div>
                <div class="mci-metric-strip__label">{{ item.Label }}</div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "MetricStrip",
    props: {
        items: { type: Array, default: () => [] }
    }
};
</script>

<style scoped>
.mci-metric-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
    border: 1px solid rgba(255, 255, 255, .18);
    border-radius: 8px;
    background: rgba(0, 33, 48, .3);
    backdrop-filter: blur(4px);
}

.mci-metric-strip__item {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 11px 16px;
    text-align: center;
}

.mci-metric-strip__item + .mci-metric-strip__item {
    border-left: 1px solid rgba(255, 255, 255, .16);
}

.mci-metric-strip__icon {
    flex: none;
    color: rgba(255, 255, 255, .82);
    font-size: 18px;
}

.mci-metric-strip__copy {
    min-width: 0;
}

.mci-metric-strip__value {
    overflow: hidden;
    font-size: 20px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mci-metric-strip__value small {
    margin-left: 3px;
    color: rgba(255, 255, 255, .72);
    font-size: 12px;
    font-weight: 500;
}

.mci-metric-strip__label {
    margin-top: 2px;
    color: rgba(255, 255, 255, .72);
    font-size: 13px;
}

@media (max-width: 720px) {
    .mci-metric-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .mci-metric-strip__item:nth-child(odd) {
        border-left: 0;
    }
}
</style>
