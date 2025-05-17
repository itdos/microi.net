import { computed } from "vue";
import skeletonParagraphData from "./skeleton-paragraph.js";
const skeletonData = computed(() => ({
  ...skeletonParagraphData.value,
  "r-skeleton-duration": "1.2s",
}));
export default skeletonData;
