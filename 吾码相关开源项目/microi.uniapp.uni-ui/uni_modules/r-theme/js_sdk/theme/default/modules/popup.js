import { computed } from "vue";

const popupData = computed(() => ({
  "r-loading-text-color": "var(--r-text-color-2)",
  "r-loading-text-font-size": "var(--r-font-size-md)",
  "r-loading-spinner-color": "var(--r-gray-5)",

  "r-popup-background": "var(--r-background-2)",
  "r-popup-transition": `transform ${"var(--r-duration-base)"}`,
  "r-popup-round-radius": "32rpx",
  "r-popup-close-icon-size": "44rpx",
  "r-popup-close-icon-color": "var(--r-gray-5)",
  "r-popup-close-icon-margin": "32rpx",
  "r-popup-close-icon-z-index": 1,
}));

export default popupData;
