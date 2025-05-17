import { computed } from "vue";

const signatureData = computed(() => ({
  "r-signature-padding": "var(--r-padding-xs)",
  "r-signature-content-height": "200px",
  "r-signature-content-background": "var(--r-background-2)",
  "r-signature-content-border": `1px dotted #dadada`,
}));

export default signatureData;
