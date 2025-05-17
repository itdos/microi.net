import { computed } from "vue";

const cellGroupData = computed(() => ({
  "r-cell-group-background": "var(--r-background-2)",
  "r-cell-group-title-color": "var(--r-text-color-2)",
  "r-cell-group-title-padding": `${"var(--r-padding-md)"} ${"var(--r-padding-md)"}`,
  "r-cell-group-title-font-size": "var(--r-font-size-md)",
  "r-cell-group-title-line-height": "32rpx",
  "r-cell-group-inset-padding": `0 ${"var(--r-padding-md)"}`,
  "r-cell-group-inset-radius": "var(--r-radius-lg)",
  "r-cell-group-inset-title-padding": `${"var(--r-padding-md)"} ${"var(--r-padding-md)"}`,
}));

export default cellGroupData;
