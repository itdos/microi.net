import { computed } from "vue";

const collapseItemData = computed(() => ({
  "r-collapse-item-duration": "var(--r-duration-base)",
  "r-collapse-item-content-padding": `${"var(--r-padding-sm)"} ${"var(--r-padding-md)"}`,

  "r-collapse-item-content-font-size": "var(--r-font-size-md)",
  "r-collapse-item-content-line-height": 1.5,
  "r-collapse-item-content-text-color": "var(--r-text-color-2)",
  "r-collapse-item-content-background": "var(--r-background-2)",
  "r-collapse-item-title-disabled-color": "var(--r-text-color-3)",
}));

export default collapseItemData;
