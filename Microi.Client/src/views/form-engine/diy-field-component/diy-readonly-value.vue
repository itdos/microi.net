<template>
    <div
        class="diy-readonly-value"
        :class="{ 'is-empty': !value || value === '—' }"
        :data-component="field.Component || ''"
        data-testid="diy-readonly-value"
        :title="value"
    >
        <a v-if="link" :href="link" :target="field.Component === 'Url' ? '_blank' : undefined" rel="noopener noreferrer">{{ value }}</a>
        <span v-else>{{ value }}</span>
    </div>
</template>

<script>
export default {
    name: "DiyReadonlyValue",
    props: {
        value: { type: String, default: "—" },
        field: { type: Object, default: () => ({}) }
    },
    computed: {
        link() {
            if (!this.value || this.value === "—") return "";
            if (this.field.Component === "Phone") return `tel:${this.value}`;
            if (this.field.Component === "Email") return `mailto:${this.value}`;
            if (this.field.Component === "Url" && /^(https?:)?\/\//i.test(this.value)) return this.value;
            return "";
        }
    }
};
</script>

<style scoped>
.diy-readonly-value {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 34px;
    align-items: center;
    box-sizing: border-box;
    padding: 3px 2px;
    overflow: hidden;
    color: var(--el-text-color-primary, #172033);
    font-size: 14px;
    font-weight: 550;
    line-height: 1.65;
    overflow-wrap: anywhere;
    white-space: normal;
}

.diy-readonly-value.is-empty { color: color-mix(in srgb, var(--el-text-color-placeholder, #a8abb2) 50%, transparent); font-weight: 450; }
.diy-readonly-value a { color: var(--el-color-primary, #3478f6); text-decoration: none; }
.diy-readonly-value a:hover { text-decoration: underline; }
</style>
