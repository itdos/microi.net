import { computed } from "vue";

const buttonData = computed(() => ({
  "r-button-mini-height": "48rpx",
  "r-button-mini-padding": `0 ${"var(--r-padding-base)"}`,
  "r-button-mini-font-size": "var(--r-font-size-xs)",
  "r-button-small-height": "64rpx",
  "r-button-small-padding": `0 ${"var(--r-padding-xs)"}`,
  "r-button-small-font-size": "var(--r-font-size-sm)",
  "r-button-normal-padding": "0 30rpx",
  "r-button-normal-font-size": "var(--r-font-size-md)",
  "r-button-large-height": "100rpx",
  "r-button-default-height": "88rpx",
  "r-button-default-line-height": 1.2,
  "r-button-default-font-size": "var(--r-font-size-lg)",

  "r-button-default-color": "var(--r-text-color)",
  "r-button-default-background": "var(--r-background-2)",
  "r-button-default-border-color": "var(--r-gray-4)",
  "r-button-primary-color": "var(--r-white)",
  "r-button-primary-background": "var(--r-primary-color)",
  "r-button-primary-border-color": "var(--r-primary-color)",
  "r-button-success-color": "var(--r-white)",
  "r-button-success-background": "var(--r-success-color)",
  "r-button-success-border-color": "var(--r-success-color)",
  "r-button-danger-color": "var(--r-white)",
  "r-button-danger-background": "var(--r-danger-color)",
  "r-button-danger-border-color": "var(--r-danger-color)",

  "r-button-warning-color": "var(--r-white)",
  "r-button-warning-background": "var(--r-warning-color)",
  "r-button-warning-border-color": "var(--r-warning-color)",
  "r-button-border-width": "var(--r-border-width)",
  "r-button-radius": "var(--r-radius-md)",
  "r-button-round-radius": "var(--r-radius-max)",
  "r-button-plain-background": "var(--r-white)",
  "r-button-disabled-opacity": "var(--r-disabled-opacity)",
  "r-button-icon-size": "1.2em",
  "r-button-loading-icon-size": "40rpx",
}));

export default buttonData;
