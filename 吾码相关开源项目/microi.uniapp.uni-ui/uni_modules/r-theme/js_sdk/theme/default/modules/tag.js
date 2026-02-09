import { computed } from "vue";

const tagData = computed(() => ({
  "r-tag-padding": `0 ${"var(--r-padding-base)"}`,
  "r-tag-text-color": "var(--r-white)",
  "r-tag-font-size": "var(--r-font-size-sm)",
  "r-tag-radius": "4rpx",
  "r-tag-line-height": "32rpx",
  "r-tag-medium-padding": "4rpx 12rpx",
  "r-tag-large-padding": `${"var(--r-padding-base)"} ${"var(--r-padding-xs)"}`,
  "r-tag-large-radius": "var(--r-radius-md)",
  "r-tag-large-font-size": "var(--r-font-size-md)",
  "r-tag-round-radius": "var(--r-radius-max)",
  "r-tag-danger-color": "var(--r-danger-color)",
  "r-tag-primary-color": "var(--r-primary-color)",
  "r-tag-success-color": "var(--r-success-color)",
  "r-tag-warning-color": "var(--r-warning-color)",
  "r-tag-default-color": "var(--r-gray-6)",
  "r-tag-plain-background": "var(--r-background-2)",
}));

export default tagData;
