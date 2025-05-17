import { computed } from "vue";

const progressData = computed(() => ({
  "r-progress-height": "4px",
  "r-progress-color": "var(--r-primary-color)",
  "r-progress-inactive-color": "var(--r-gray-5)",
  "r-progress-background": "var(--r-gray-3)",
  "r-progress-pivot-padding": "0 5px",
  "r-progress-pivot-text-color": "var(--r-white)",
  "r-progress-pivot-font-size": "var(--r-font-size-xs)",
  "r-progress-pivot-line-height": "1.6",
  "r-progress-pivot-background": "var(--r-primary-color)",
}));

export default progressData;
