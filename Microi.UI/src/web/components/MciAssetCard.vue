<template>
  <article class="mci-web-asset-card" :class="[`mci-web-asset-card--${tone}`, { 'is-interactive': interactive }]">
    <div class="mci-web-asset-card__header">
      <span>{{ label }}</span>
      <slot name="extra" />
    </div>
    <div class="mci-web-asset-card__value">
      <slot>{{ value }}</slot>
      <small v-if="suffix">{{ suffix }}</small>
    </div>
    <p v-if="description || trend || $slots.footer" class="mci-web-asset-card__footer">
      <slot name="footer">{{ trend || description }}</slot>
    </p>
  </article>
</template>

<script setup>
defineOptions({ name: 'MciAssetCard' });
defineProps({
  label: { type: String, default: '资产' },
  value: { type: [String, Number], default: '' },
  suffix: { type: String, default: '' },
  trend: { type: String, default: '' },
  description: { type: String, default: '' },
  tone: { type: String, default: 'primary' },
  interactive: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-web-asset-card {
  position: relative;
  overflow: hidden;
  padding: var(--mci-space-5);
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-card);
  background:
    linear-gradient(115deg, rgba(181,18,32,.10), transparent 38%),
    var(--mci-gradient-surface, var(--mci-bg-surface));
  box-shadow: var(--mci-shadow-card);
  transition: transform var(--mci-duration-base) var(--mci-ease-out), box-shadow var(--mci-duration-base) var(--mci-ease-out);
}

.mci-web-asset-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: var(--mci-gradient-primary);
}

.mci-web-asset-card--gold::before { background: var(--mci-gradient-gold); }
.mci-web-asset-card--cool::before { background: var(--mci-gradient-cool); }

.mci-web-asset-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mci-space-3);
  color: var(--mci-text-secondary);
  font-size: var(--mci-text-sm);
  font-weight: 800;
}

.mci-web-asset-card__value {
  margin-top: var(--mci-space-3);
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--mci-text-primary);
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.1;
  font-weight: 950;
}

.mci-web-asset-card__value small {
  color: var(--mci-text-secondary);
  font-size: var(--mci-text-base);
  font-weight: 850;
}

.mci-web-asset-card__footer {
  margin: var(--mci-space-3) 0 0;
  color: var(--mci-text-tertiary);
  font-size: var(--mci-text-sm);
}

.mci-web-asset-card.is-interactive {
  cursor: pointer;
}

@media (hover: hover) {
  .mci-web-asset-card.is-interactive:hover {
    transform: translateY(var(--mci-hover-y));
    box-shadow: var(--mci-shadow-card-hover);
  }
}
</style>
