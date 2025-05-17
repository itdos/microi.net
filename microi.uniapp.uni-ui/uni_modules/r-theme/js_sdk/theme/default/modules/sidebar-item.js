import { computed } from "vue";

const sidebarItemData = computed(() => ({
  "r-sidebar-font-size": "var(--r-font-size-md)",
  "r-sidebar-line-height": "var(--r-line-height-md)",
  "r-sidebar-text-color": "var(--r-text-color)",
  "r-sidebar-disabled-text-color": "var(--r-text-color-3)",
  "r-sidebar-padding": `40rpx ${"var(--r-padding-sm)"}`,
  "r-sidebar-active-color": "var(--r-active-color)",
  "r-sidebar-background": "var(--r-background)",
  "r-sidebar-selected-font-weight": "var(--r-font-bold)",
  "r-sidebar-selected-text-color": "var(--r-text-color)",
  "r-sidebar-selected-border-width": "8rpx",
  "r-sidebar-selected-border-height": "32rpx",
  "r-sidebar-selected-border-color": "var(--r-primary-color)",
  "r-sidebar-selected-background": "var(--r-background-2)",
}));

export default sidebarItemData;
