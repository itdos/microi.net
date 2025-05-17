import { computed } from "vue";

const uploaderData = computed(() => ({
  "r-uploader-size": "160rpx",
  "r-uploader-icon-size": "48rpx",
  "r-uploader-icon-color": "var(--r-gray-4)",
  "r-uploader-text-color": "var(--r-text-color-2)",
  "r-uploader-text-font-size": "var(--r-font-size-sm)",
  "r-uploader-upload-background": "var(--r-gray-1)",
  "r-uploader-upload-active-color": "var(--r-active-color)",
  "r-uploader-delete-color": "var(--r-white)",
  "r-uploader-delete-icon-size": "28rpx",
  "r-uploader-delete-background": "rgba(0, 0, 0, 0.7)",
  "r-uploader-file-background": "var(--r-background)",
  "r-uploader-file-icon-size": "40rpx",
  "r-uploader-file-icon-color": "var(--r-gray-7)",
  "r-uploader-file-name-padding": `0 ${"var(--r-padding-base)"}`,
  "r-uploader-file-name-margin-top": "var(--r-padding-xs)",
  "r-uploader-file-name-font-size": "var(--r-font-size-sm)",
  "r-uploader-file-name-text-color": "var(--r-background)",
  "r-uploader-mask-text-color": "var(--r-white)",
  "r-uploader-mask-background": "rgba(50, 50, 51, 0.88)",
  "r-uploader-mask-icon-size": "44rpx",
  "r-uploader-mask-message-font-size": "var(--r-font-size-sm)",
  "r-uploader-mask-message-line-height": "var(--r-line-height-xs)",
  "r-uploader-loading-icon-size": "44rpx",
  "r-uploader-loading-icon-color": "var(--r-white)",
  "r-uploader-disabled-opacity": "var(--r-disabled-opacity)",
  "r-uploader-border-radius": "0rpx",
}));

export default uploaderData;
