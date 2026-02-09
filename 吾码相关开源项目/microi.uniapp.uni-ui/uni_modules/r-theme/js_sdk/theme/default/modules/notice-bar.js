import { computed } from "vue";

const noticeBarData = computed(() => ({
  "r-notice-bar-height": "80rpx",
  "r-notice-bar-padding": `0 ${"var(--r-padding-md)"}`,
  "r-notice-bar-wrapable-padding": `${"var(--r-padding-xs)"} ${"var(--r-padding-md)"}`,
  "r-notice-bar-text-color": "var(--r-orange-dark)",
  "r-notice-bar-font-size": "var(--r-font-size-md)",
  "r-notice-bar-line-height": "48rpx",
  "r-notice-bar-background": "var(--r-orange-light)",
  "r-notice-bar-icon-size": "32rpx",
  "r-notice-bar-icon-min-width": "48rpx",
}));

export default noticeBarData;
