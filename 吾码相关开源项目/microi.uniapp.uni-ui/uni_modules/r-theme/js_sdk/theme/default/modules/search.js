import { computed, ref } from "vue";

const searchData = computed(() => ({
  "r-search-padding": `20rpx ${"var(--r-padding-sm)"}`,
  "r-search-background": "var(--r-background-2)",
  "r-search-content-background": "var(--r-background)",
  "r-search-input-height": "68rpx",
  "r-search-label-padding": `0 10rpx`,
  "r-search-label-color": "var(--r-text-color)",
  "r-search-label-font-size": "var(--r-font-size-md)",
  "r-search-left-icon-color": "var(--r-gray-6)",
  "r-search-action-padding": `0 ${"var(--r-padding-xs)"}`,
  "r-search-action-text-color": "var(--r-text-color)",
  "r-search-action-font-size": "var(--r-font-size-md)",
}));

export default searchData;
