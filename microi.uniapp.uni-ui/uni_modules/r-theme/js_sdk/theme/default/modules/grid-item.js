import { computed } from "vue";

const gridItemData = computed(() => ({
  "r-grid-item-content-padding": `${"var(--r-padding-md)"} ${"var(--r-padding-xs)"}`,
  "r-grid-item-content-background": "var(--r-background-2)",
  "r-grid-item-content-active-color": "var(--r-active-color)",
  "r-grid-item-icon-size": "56rpx",
  "r-grid-item-text-color": "var(--r-text-color)",
  "r-grid-item-text-font-size": "var(--r-font-size-sm)",
}));

export default gridItemData;
