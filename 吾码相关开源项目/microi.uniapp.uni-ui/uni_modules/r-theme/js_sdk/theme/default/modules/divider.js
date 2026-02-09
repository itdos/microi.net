import { computed } from "vue";

const dividerData = computed(() => ({
  "r-divider-margin": `${"var(--r-padding-md)"} 0`,
  "r-divider-vertical-margin": `${"var(--r-padding-xs)"} 0`,
  "r-divider-text-color": "var(--r-text-color-2)",
  "r-divider-font-size": "var(--r-font-size-md)",
  "r-divider-line-height": "48rpx",
  "r-divider-border-color": "var(--r-border-color)",
  "r-divider-content-padding": "var(--r-padding-md)",
  "r-divider-content-left-width": "10%",
  "r-divider-content-right-width": "10%",
}));
export default dividerData;
