import { computed } from "vue";

const cascaderData = computed(() => ({
  "r-cascader-header-height": "96rpx",
  "r-cascader-header-padding": `0 ${"var(--r-padding-md)"}`,
  "r-cascader-title-font-size": "var(--r-font-size-lg)",
  "r-cascader-title-line-height": "40rpx",
  "r-cascader-close-icon-size": "44rpx",
  "r-cascader-close-icon-color": "var(--r-gray-5)",
  "r-cascader-selected-icon-size": "36rpx",
  "r-cascader-tabs-height": "96rpx",
  "r-cascader-active-color": "var(--r-primary-color)",
  "r-cascader-options-height": "768rpx",
  "r-cascader-option-disabled-color": "var(--r-text-color-3)",
  "r-cascader-tab-color": "var(--r-text-color)",
  "r-cascader-unselected-tab-color": "var(--r-text-color-2)",
}));

export default cascaderData;
