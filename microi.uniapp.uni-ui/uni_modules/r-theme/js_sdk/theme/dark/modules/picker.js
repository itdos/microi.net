import { computed } from "vue";
const pickerData = computed(() => ({
  "r-picker-loading-mask-color": `rgba(0, 0, 0, 0.6)`,
  "r-picker-mask-color": `linear-gradient(
        180deg,
        rgba(0, 0, 0, 0.6),
        rgba(0, 0, 0, 0.1)
      ),
      linear-gradient(0deg, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.1))`,
}));

export default pickerData;
