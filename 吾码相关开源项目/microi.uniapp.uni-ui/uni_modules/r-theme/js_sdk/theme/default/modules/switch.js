import { computed } from "vue";

const switchData = computed(() => ({
  "r-switch-size": "52rpx",
  "r-switch-width": "calc(1.8em + 8rpx)",
  "r-switch-height": "calc(1em + 8rpx)",
  "r-switch-node-size": "1em",
  "r-switch-node-background": "var(--r-white)",
  "r-switch-node-shadow": "0 6rpx 2rpx 0 rgba(0, 0, 0, 0.05)",
  "r-switch-background": "rgba(120, 120, 128, 0.16)",
  "r-switch-on-background": "var(--r-primary-color)",
  "r-switch-duration": "var(--r-duration-base)",
  "r-switch-disabled-opacity": "var(--r-disabled-opacity)",
}));
export default switchData;
