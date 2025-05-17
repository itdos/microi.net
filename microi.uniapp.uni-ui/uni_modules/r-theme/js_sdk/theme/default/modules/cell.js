import { computed } from "vue";

const cellData = computed(() => ({
  "r-cell-font-size": "var(--r-font-size-md)",
  "r-cell-line-height": "48rpx",
  "r-cell-vertical-padding": "20rpx",
  "r-cell-horizontal-padding": "var(--r-padding-md)",

  "r-cell-text-color": "var(--r-text-color)",
  "r-cell-background": "var(--r-background-2)",
  "r-cell-border-color": "var(--r-border-color)",
  "r-cell-active-color": "var(--r-active-color)",
  "r-cell-required-color": "var(--r-danger-color)",
  "r-cell-label-color": "var(--r-text-color-2)",
  "r-cell-label-font-size": "var(--r-font-size-sm)",
  "r-cell-label-line-height": "var(--r-line-height-sm)",
  "r-cell-label-margin-top": "var(--r-padding-base)",
  "r-cell-value-color": "var(--r-text-color-2)",
  "r-cell-icon-size": "32rpx",
  "r-cell-right-icon-color": "var(--r-gray-6)",
  "r-cell-large-vertical-padding": "var(--r-padding-sm)",
  "r-cell-large-title-font-size": "var(--r-font-size-lg)",
  "r-cell-large-label-font-size": "var(--r-font-size-md)",
}));

export default cellData;
