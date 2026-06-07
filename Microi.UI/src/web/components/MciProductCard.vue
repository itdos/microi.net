<template>
  <article class="mci-web-product-card mci-card mci-pressable" :class="{ 'is-disabled': disabled }" @click="handleClick">
    <div class="mci-web-product-card__media">
      <img v-if="image" :src="image" :alt="title" />
      <span v-else class="mci-skeleton mci-web-product-card__placeholder" />
      <em v-if="badge" class="mci-web-product-card__badge">{{ badge }}</em>
    </div>
    <div class="mci-web-product-card__body">
      <h3>{{ title }}</h3>
      <p v-if="meta">{{ meta }}</p>
      <div class="mci-web-product-card__bottom">
        <strong>{{ priceText }}</strong>
        <span v-if="tag">{{ tag }}</span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';

defineOptions({ name: 'MciProductCard' });

const props = defineProps({
  title: { type: String, default: '' },
  image: { type: String, default: '' },
  price: { type: [String, Number], default: '' },
  meta: { type: String, default: '' },
  badge: { type: String, default: '' },
  tag: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['click']);

const priceText = computed(() => {
  if (props.price === '' || props.price === null || props.price === undefined) return '';
  if (typeof props.price === 'number') return `¥${props.price.toFixed(2)}`;
  return props.price;
});

function handleClick(event) {
  if (props.disabled) return;
  emit('click', event);
}
</script>

<style scoped>
.mci-web-product-card {
  overflow: hidden;
  cursor: pointer;
}

.mci-web-product-card.is-disabled {
  cursor: not-allowed;
  opacity: .58;
}

.mci-web-product-card__media {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: var(--mci-bg-muted);
}

.mci-web-product-card__media img,
.mci-web-product-card__placeholder {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.mci-web-product-card__badge {
  position: absolute;
  top: 10px;
  left: 10px;
  max-width: calc(100% - 20px);
  padding: 5px 9px;
  border-radius: var(--mci-radius-pill);
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  font-size: var(--mci-text-xs);
  font-style: normal;
  font-weight: 800;
  box-shadow: var(--mci-shadow-button);
}

.mci-web-product-card__body {
  padding: var(--mci-space-3);
}

.mci-web-product-card__body h3 {
  margin: 0;
  color: var(--mci-text-primary);
  font-size: var(--mci-text-base);
  line-height: 1.35;
  font-weight: 850;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mci-web-product-card__body p {
  margin: 6px 0 0;
  color: var(--mci-text-tertiary);
  font-size: var(--mci-text-sm);
}

.mci-web-product-card__bottom {
  min-height: 30px;
  margin-top: var(--mci-space-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mci-space-2);
}

.mci-web-product-card__bottom strong {
  color: var(--mci-color-primary);
  font-size: var(--mci-text-lg);
  line-height: 1;
  font-weight: 900;
}

.mci-web-product-card__bottom span {
  min-width: 0;
  padding: 4px 8px;
  border-radius: var(--mci-radius-pill);
  background: var(--mci-bg-soft);
  color: var(--mci-color-primary);
  font-size: var(--mci-text-xs);
  font-weight: 750;
  white-space: nowrap;
}
</style>
