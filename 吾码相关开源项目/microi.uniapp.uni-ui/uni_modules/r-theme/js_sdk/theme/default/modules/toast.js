import { computed, ref } from "vue";

const toastData = computed(() => ({
  "r-toast-max-width": "70vw",
  "r-toast-font-size": "var(--r-font-size-md)",
  "r-toast-text-color": "var(--r-white)",
  "r-toast-loading-icon-color": "var(--r-white)",
  "r-toast-line-height": "var(--r-line-height-md)",
  "r-toast-radius": "var(--r-radius-lg)",
  "r-toast-background": "rgba(0, 0, 0, 0.7)",
  "r-toast-icon-size": "72rpx",
  "r-toast-text-min-width": "192rpx",
  "r-toast-text-padding": `${"var(--r-padding-xs)"} ${"var(--r-padding-sm)"}`,
  "r-toast-default-padding": "var(--r-padding-md)",
  "r-toast-default-width": "176rpx",
  "r-toast-default-min-height": "176rpx",
  "r-toast-position-top-distance": "20vh",
  "r-toast-position-bottom-distance": "20vh",
}));

export default toastData;
