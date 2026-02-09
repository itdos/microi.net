import { computed } from "vue";

const dialogData = computed(() => ({
  "r-dialog-width": "640rpx",
  "r-dialog-small-screen-width": "90%",
  "r-dialog-font-size": "var(--r-font-size-lg)",
  "r-dialog-transition": "var(--r-duration-base)",
  "r-dialog-radius": "32rpx",
  "r-dialog-background": "var(--r-background-2)",
  "r-dialog-header-font-weight": "var(--r-font-bold)",
  "r-dialog-header-line-height": "48rpx",
  "r-dialog-header-padding-top": "32rpx",
  "r-dialog-header-isolated-padding": `${"var(--r-padding-lg)"} 0`,
  "r-dialog-message-padding": "var(--r-padding-lg)",
  "r-dialog-message-font-size": "var(--r-font-size-md)",
  "r-dialog-message-line-height": "var(--r-line-height-md)",
  "r-dialog-message-max-height": "60vh",
  "r-dialog-has-title-message-text-color": "var(--r-gray-7)",
  "r-dialog-has-title-message-padding-top": "var(--r-padding-xs)",
  "r-dialog-button-height": "96rpx",
  "r-dialog-round-button-height": "72rpx",
  "r-dialog-confirm-button-text-color": "var(--r-primary-color)",
}));
export default dialogData;
