import { computed } from "vue";

import skeletonParagraphData from "./skeleton-paragraph.js";
const skeletonTitleData = computed(() => ({
  ...skeletonParagraphData.value,
  "r-skeleton-title-width": "40%",
}));

export default skeletonTitleData;
