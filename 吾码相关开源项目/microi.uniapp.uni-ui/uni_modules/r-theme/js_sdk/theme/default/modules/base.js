import { computed, ref } from "vue";

const data = ref({
  /* // Color Palette */
  "r-black": "#000",
  "r-white": "#fff",
  "r-gray-1": "#f7f8fa",
  "r-gray-2": "#f2f3f5",
  "r-gray-3": "#ebedf0",
  "r-gray-4": "#dcdee0",
  "r-gray-5": "#c8c9cc",
  "r-gray-6": "#969799",
  "r-gray-7": "#646566",
  "r-gray-8": "#323233",
  "r-red": "#ee0a24",
  "r-blue": "#1989fa",
  "r-orange": "#ff976a",
  "r-orange-dark": "#ed6a0c",
  "r-orange-light": "#fffbe8",
  "r-green": "#07c160",

  /* // Gradient Colors */
  "r-gradient-red": "linear-gradient(to right, #ff6034, #ee0a24)",
  "r-gradient-orange": "linear-gradient(to right, #ffd01e, #ff8917)",

  /* // Component Colors */
  "r-active-opacity": 0.6,
  "r-disabled-opacity": 0.5,

  /* // Padding */
  "r-padding-base": "8rpx",
  "r-padding-xs": "16rpx",
  "r-padding-sm": "24rpx",
  "r-padding-md": "32rpx",
  "r-padding-lg": "48rpx",
  "r-padding-xl": "64rpx",

  /* // Font */
  "r-font-size-xs": "20rpx",
  "r-font-size-sm": "24rpx",
  "r-font-size-md": "28rpx",
  "r-font-size-lg": "32rpx",
  "r-font-bold": 600,
  "r-line-height-xs": "28rpx",
  "r-line-height-sm": "36rpx",
  "r-line-height-md": "40rpx",
  "r-line-height-lg": "44rpx",
  "r-base-font": `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica,
	        Segoe UI, Arial, Roboto, 'PingFang SC', 'miui', 'Hiragino Sans GB', 'Microsoft Yahei',
	        sans-serif`,
  "r-price-font":
    "Avenir-Heavy, PingFang SC, Helvetica Neue, Arial, sans-serif",

  /* // Animation */
  "r-duration-base": "0.3s",
  "r-duration-fast": "0.2s",
  "r-ease-out": "ease-out",
  "r-ease-in": "ease-in",

  /* // Border */

  "r-border-width": "2rpx",
  "r-radius-sm": "4rpx",
  "r-radius-md": "8rpx",
  "r-radius-lg": "16rpx",
  "r-radius-max": "1998rpx",
});

const quoteData = computed(() => ({
  "r-primary-color": "var(--r-blue)",
  "r-success-color": "var(--r-green)",
  "r-danger-color": "var(--r-red)",
  "r-warning-color": "var(--r-orange)",
  "r-text-color": "var(--r-gray-8)",
  "r-text-color-2": "var(--r-gray-6)",
  "r-text-color-3": "var(--r-gray-5)",
  "r-active-color": "var(--r-gray-2)",

  "r-background": "var(--r-gray-1)",
  "r-background-2": "var(--r-white)",

  "r-border-color": "var(--r-gray-3)",
}));

const baseData = computed(() => ({
  ...data.value,
  ...quoteData.value,
}));

export default baseData;
