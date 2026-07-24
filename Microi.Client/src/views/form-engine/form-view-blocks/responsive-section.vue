<template>
    <section class="mci-responsive-section" :class="{ 'is-expanded': expanded }">
        <button type="button" class="mci-responsive-section__head" @click="$emit('toggle')">
            <span class="mci-responsive-section__mark"></span>
            <fa-icon v-if="section.Icon" :icon="section.Icon" />
            <strong>{{ section.Title }}</strong>
            <small>{{ section.Fields.length }} 项</small>
            <el-icon class="mci-responsive-section__chevron" :class="{ 'is-expanded': expanded }">
                <ArrowRight />
            </el-icon>
        </button>
        <div
            v-show="expanded"
            class="mci-responsive-section__grid"
            :class="`columns-${columnCount}`"
        >
            <div
                v-for="field in section.Fields"
                :key="field.Name"
                class="mci-responsive-section__field"
                :class="{ 'is-wide': Number(field.Width || 0) >= 24 }"
            >
                <div class="mci-responsive-section__label">{{ field.Label }}</div>
                <div class="mci-responsive-section__value">
                    <slot :field="field">{{ field.Value }}</slot>
                </div>
            </div>
        </div>
    </section>
</template>

<script>
export default {
    name: "ResponsiveSection",
    emits: ["toggle"],
    props: {
        section: { type: Object, required: true },
        expanded: { type: Boolean, default: false }
    },
    computed: {
        columnCount() {
            return Math.min(4, Math.max(1, Number(this.section.Columns || 2)));
        }
    }
};
</script>

<style scoped>
.mci-responsive-section {
    margin: 0 18px 12px;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter, #e5e9f0);
    border-radius: 8px;
    background: var(--el-bg-color, #fff);
    box-shadow: 0 3px 12px rgba(31, 45, 61, .035);
}

.mci-responsive-section__head {
    display: flex;
    width: 100%;
    min-height: 52px;
    align-items: center;
    gap: 9px;
    padding: 0 18px;
    border: 0;
    border-bottom: 1px solid var(--el-border-color-lighter, #ebeef5);
    color: inherit;
    background: transparent;
    cursor: pointer;
    text-align: left;
}

.mci-responsive-section__head strong {
    font-size: 15px;
    letter-spacing: 0;
}

.mci-responsive-section__head small {
    color: var(--el-text-color-secondary, #909399);
}

.mci-responsive-section__mark {
    width: 3px;
    height: 18px;
    border-radius: 2px;
    background: var(--el-color-primary, #1677ff);
}

.mci-responsive-section__chevron {
    margin-left: auto;
    transition: transform .18s ease;
}

.mci-responsive-section__chevron.is-expanded {
    transform: rotate(90deg);
}

.mci-responsive-section__grid {
    display: grid;
    gap: 0 22px;
    padding: 2px 18px 14px;
}

.mci-responsive-section__grid.columns-1 { grid-template-columns: minmax(0, 1fr); }
.mci-responsive-section__grid.columns-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.mci-responsive-section__grid.columns-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.mci-responsive-section__grid.columns-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

.mci-responsive-section__field {
    display: flex;
    min-width: 0;
    min-height: 56px;
    flex-direction: column;
    gap: 6px;
    justify-content: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--el-border-color-extra-light, #f2f4f7);
}

.mci-responsive-section__field.is-wide {
    grid-column: 1 / -1;
}

.mci-responsive-section__label {
    overflow: hidden;
    color: var(--el-text-color-secondary, #7a8595);
    font-size: 12px;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mci-responsive-section__value {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--el-text-color-primary, #1f2937);
    font-size: 14px;
    font-weight: 500;
    line-height: 1.55;
}

@media (max-width: 1440px) {
    .mci-responsive-section__grid.columns-4 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (max-width: 1100px) {
    .mci-responsive-section__grid.columns-3,
    .mci-responsive-section__grid.columns-4 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .mci-responsive-section__grid.columns-1,
    .mci-responsive-section__grid.columns-2,
    .mci-responsive-section__grid.columns-3,
    .mci-responsive-section__grid.columns-4 {
        grid-template-columns: 1fr;
        padding-inline: 18px;
    }

    .mci-responsive-section__field {
        gap: 6px;
    }
}
</style>
