import { computed } from "vue";

const tabbarItemData = computed(() => ({
  "r-tabbar-item-font-size": "var(--r-font-size-sm)",
  "r-tabbar-item-text-color": "var(--r-text-color)",
  "r-tabbar-item-active-color": "var(--r-primary-color)",
  "r-tabbar-item-active-background": "var(--r-background-2)",
  "r-tabbar-item-line-height": 1,
  "r-tabbar-item-icon-size": "44rpx",
  "r-tabbar-item-icon-margin-bottom": "var(--r-padding-base)",
}));

export default tabbarItemData;
