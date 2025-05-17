import { computed } from "vue";

const pickerData = computed(() => ({
  "r-picker-background": "var(--r-background-2)",
  "r-picker-toolbar-height": "44px",
  "r-picker-title-font-size": "var(--r-font-size-lg)",
  "r-picker-title-line-height": "var(--r-line-height-md)",
  "r-picker-action-padding": `0 ${"var(--r-padding-md)"}`,
  "r-picker-action-font-size": "var(--r-font-size-md)",
  "r-picker-confirm-action-color": "var(--r-primary-color)",
  "r-picker-cancel-action-color": "var(--r-text-color-2)",
  "r-picker-option-font-size": "var(--r-font-size-lg)",
  "r-picker-option-padding": `0 ${"var(--r-padding-base)"}`,
  "r-picker-option-text-color": "var(--r-text-color)",
  "r-picker-option-disabled-opacity": "0.3",
  "r-picker-loading-icon-color": "var(--r-primary-color)",
  "r-picker-loading-mask-color": `rgba(255, 255, 255, 0.9)`,
  "r-picker-mask-color": `linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.9),
      rgba(255, 255, 255, 0.4)
    ),
    linear-gradient(0deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.4))`,
}));

export default pickerData;
