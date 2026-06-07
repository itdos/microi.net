<template>
  <article class="mci-web-order-card">
    <div class="mci-web-order-card__header">
      <span>{{ orderNo }}</span>
      <em :class="`is-${statusType}`">{{ status }}</em>
    </div>
    <div class="mci-web-order-card__body">
      <slot name="media">
        <div class="mci-web-order-card__media" />
      </slot>
      <div class="mci-web-order-card__content">
        <strong>{{ title }}</strong>
        <p v-if="description">{{ description }}</p>
        <slot />
      </div>
      <div class="mci-web-order-card__amount">{{ amount }}</div>
    </div>
    <div v-if="time || $slots.actions" class="mci-web-order-card__footer">
      <span>{{ time }}</span>
      <div v-if="$slots.actions" class="mci-web-order-card__actions">
        <slot name="actions" />
      </div>
    </div>
  </article>
</template>

<script setup>
defineOptions({ name: 'MciOrderCard' });
defineProps({
  orderNo: { type: String, default: '订单号' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  amount: { type: String, default: '' },
  status: { type: String, default: '进行中' },
  statusType: { type: String, default: 'primary' },
  time: { type: String, default: '' }
});
</script>

<style scoped>
.mci-web-order-card {
  overflow: hidden;
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-card);
  background: var(--mci-bg-surface);
  box-shadow: var(--mci-shadow-card);
}

.mci-web-order-card__header,
.mci-web-order-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mci-space-3);
  padding: var(--mci-space-3) var(--mci-space-4);
  color: var(--mci-text-tertiary);
  font-size: var(--mci-text-sm);
}

.mci-web-order-card__header {
  border-bottom: 1px solid var(--mci-border);
}

.mci-web-order-card__header em {
  padding: 5px 10px;
  border-radius: var(--mci-radius-pill);
  background: rgba(181,18,32,.10);
  color: var(--mci-color-primary);
  font-style: normal;
  font-weight: 850;
}

.mci-web-order-card__header em.is-success {
  background: rgba(15,159,110,.12);
  color: var(--mci-color-success);
}

.mci-web-order-card__header em.is-warning {
  background: rgba(183,121,31,.14);
  color: var(--mci-color-warning);
}

.mci-web-order-card__body {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: var(--mci-space-3);
  padding: var(--mci-space-4);
}

.mci-web-order-card__media {
  width: 72px;
  height: 72px;
  border-radius: var(--mci-shape-panel);
  background: linear-gradient(135deg, rgba(181,18,32,.14), rgba(37,99,235,.12));
}

.mci-web-order-card__content {
  min-width: 0;
}

.mci-web-order-card__content strong {
  display: block;
  color: var(--mci-text-primary);
  font-size: var(--mci-text-base);
  font-weight: 900;
}

.mci-web-order-card__content p {
  margin: 6px 0 0;
  color: var(--mci-text-secondary);
  font-size: var(--mci-text-sm);
  line-height: 1.55;
}

.mci-web-order-card__amount {
  color: var(--mci-color-primary);
  font-size: var(--mci-text-lg);
  font-weight: 950;
  white-space: nowrap;
}

.mci-web-order-card__footer {
  border-top: 1px solid var(--mci-border);
}

.mci-web-order-card__actions {
  display: flex;
  gap: var(--mci-space-2);
}
</style>
