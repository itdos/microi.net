import { computed } from "vue";

const loadingData = computed(() => ({
  "r-loading-text-color": "var(--r-text-color-2)",
  "r-loading-text-font-size": "var(--r-font-size-md)",
  "r-loading-spinner-color": "var(--r-gray-5)",
}));

export default loadingData;
