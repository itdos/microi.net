<template>
  <article class="mci-web-metric" :class="[`mci-web-metric--${tone}`, { 'is-interactive': interactive }]">
    <div class="mci-web-metric__header">
      <span v-if="label" class="mci-web-metric__label">{{ label }}</span>
      <slot name="extra" />
    </div>
    <div class="mci-web-metric__value">
      <slot>{{ value }}</slot>
      <small v-if="suffix">{{ suffix }}</small>
    </div>
    <div v-if="trend || $slots.footer" class="mci-web-metric__footer">
      <slot name="footer">{{ trend }}</slot>
    </div>
  </article>
</template>

<script setup>
defineOptions({ name: 'MciMetricCard' });
defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  suffix: { type: String, default: '' },
  trend: { type: String, default: '' },
  tone: { type: String, default: 'primary' },
  interactive: { type: Boolean, default: false }
});
</script>

<style scoped>
.mci-web-metric {
  position: relative;
  overflow: hidden;
  min-height: 132px;
  padding: var(--mci-space-5);
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-card);
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-shadow-card);
}

.mci-web-metric::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(255,255,255,.22), transparent 34%),
    linear-gradient(90deg, transparent, rgba(255,255,255,.16), transparent);
  background-size: 100% 100%, 220% 100%;
  opacity: .9;
  animation: mciMetricSweep 5.2s ease-in-out infinite;
  pointer-events: none;
}

.mci-web-metric > * {
  position: relative;
  z-index: 1;
}

.mci-web-metric--gold {
  background: var(--mci-gradient-gold);
  color: var(--mci-text-on-gold);
}

.mci-web-metric--cool {
  background: var(--mci-gradient-cool);
}

.mci-web-metric__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mci-space-3);
}

.mci-web-metric__label {
  font-size: var(--mci-text-sm);
  font-weight: 750;
  opacity: .88;
}

.mci-web-metric__value {
  margin-top: var(--mci-space-3);
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: clamp(30px, 5vw, 46px);
  line-height: var(--mci-line-tight);
  font-weight: 900;
  letter-spacing: 0;
}

.mci-web-metric__value small {
  font-size: var(--mci-text-base);
  font-weight: 800;
}

.mci-web-metric__footer {
  margin-top: var(--mci-space-3);
  font-size: var(--mci-text-sm);
  opacity: .86;
}

.mci-web-metric.is-interactive {
  cursor: pointer;
  transition: transform var(--mci-duration-base) var(--mci-ease-out), box-shadow var(--mci-duration-base) var(--mci-ease-out);
}

@media (hover: hover) {
  .mci-web-metric.is-interactive:hover {
    transform: translateY(var(--mci-hover-y));
    box-shadow: var(--mci-shadow-card-hover);
  }
}

@keyframes mciMetricSweep {
  0%, 48% { background-position: 0 0, -140% 0; }
  100% { background-position: 0 0, 140% 0; }
}
</style>
