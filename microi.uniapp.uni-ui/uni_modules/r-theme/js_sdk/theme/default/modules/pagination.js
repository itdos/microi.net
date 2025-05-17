import { computed } from "vue";

const paginationData = computed(() => ({
  "r-pagination-height": "80rpx",
  "r-pagination-font-size": "var(--r-font-size-md)",
  "r-pagination-item-width": "72rpx",
  "r-pagination-item-default-color": "var(--r-primary-color)",
  "r-pagination-item-disabled-color": "var(--r-gray-7)",
  "r-pagination-item-disabled-background": "var(--r-background)",
  "r-pagination-background": "var(--r-background-2)",
  "r-pagination-desc-color": "var(--r-gray-7)",
  "r-pagination-disabled-opacity": "var(--r-disabled-opacity)",
}));

export default paginationData;
