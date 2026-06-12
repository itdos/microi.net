<template>
  <nav class="mci-mobile-bottom-nav mci-web-bottom-nav" aria-label="Bottom navigation">
    <button
      v-for="item in items"
      :key="item.value || item.label"
      class="mci-mobile-bottom-nav__item mci-web-bottom-nav__item mci-pressable"
      :class="{
        'is-active': item.value === modelValue,
        'is-center': item.center || item.value === centerValue
      }"
      type="button"
      @click="selectItem(item)"
    >
      <span class="mci-mobile-bottom-nav__icon">
        <slot name="icon" :item="item">{{ item.icon }}</slot>
      </span>
      <span class="mci-web-bottom-nav__label">{{ item.label }}</span>
      <span v-if="item.badge" class="mci-web-bottom-nav__badge">{{ item.badge }}</span>
    </button>
  </nav>
</template>

<script setup>
defineOptions({ name: 'MciBottomNav' });
const emit = defineEmits(['update:modelValue', 'change']);
defineProps({
  modelValue: { type: [String, Number], default: '' },
  centerValue: { type: [String, Number], default: '' },
  items: {
    type: Array,
    default: () => []
  }
});

function selectItem(item) {
  emit('update:modelValue', item.value);
  emit('change', item);
}
</script>

<style scoped>
.mci-web-bottom-nav {
  background: var(--mci-mobile-tabbar-bg);
}

.mci-web-bottom-nav__item {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.mci-web-bottom-nav__label {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mci-web-bottom-nav__badge {
  position: absolute;
  top: 6px;
  right: 20%;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--mci-color-danger);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
}
</style>
