import { computed } from "vue";

const stepperData = computed(() => ({
  "r-stepper-background": "var(--r-active-color)",
  "r-stepper-button-icon-color": "var(--r-text-color)",
  "r-stepper-button-disabled-color": "var(--r-background)",
  "r-stepper-button-disabled-icon-color": "var(--r-gray-5)",
  "r-stepper-button-round-theme-color": "var(--r-primary-color)",
  "r-stepper-input-width": "64rpx",
  "r-stepper-input-height": "56rpx",
  "r-stepper-input-font-size": "var(--r-font-size-md)",
  "r-stepper-input-line-height": "normal",
  "r-stepper-input-text-color": "var(--r-text-color)",
  "r-stepper-input-disabled-text-color": "var(--r-text-color-3)",
  "r-stepper-input-disabled-background": "var(--r-active-color)",
  "r-stepper-radius": "var(--r-radius-md)",
}));

export default stepperData;
