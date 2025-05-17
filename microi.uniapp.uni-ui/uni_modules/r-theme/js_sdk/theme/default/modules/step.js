import { computed } from "vue";

const stepData = computed(() => ({
  "r-step-text-color": "var(--r-text-color-2)",
  "r-step-active-color": "var(--r-primary-color)",
  "r-step-process-text-color": "var(--r-text-color)",
  "r-step-font-size": "var(--r-font-size-md)",
  "r-step-line-color": "var(--r-border-color)",
  "r-step-finish-line-color": "var(--r-primary-color)",
  "r-step-finish-text-color": "var(--r-text-color)",
  "r-step-icon-size": "12px",
  "r-step-circle-size": "5px",
  "r-step-circle-color": "var(--r-gray-6)",
  "r-step-horizontal-title-font-size": "var(--r-font-size-sm)",
}));
export default stepData;
