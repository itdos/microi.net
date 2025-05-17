import { computed, ref } from "vue";

const rateData = computed(() => ({
  "r-rate-icon-size": "40rpx",
  "r-rate-icon-gutter": "var(--r-padding-base)",
  "r-rate-icon-void-color": "var(--r-gray-5)",
  "r-rate-icon-full-color": "var(--r-danger-color)",
  "r-rate-icon-disabled-color": "var(--r-gray-5)",
}));

export default rateData;
