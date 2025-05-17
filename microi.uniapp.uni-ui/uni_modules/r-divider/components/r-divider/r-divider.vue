<template>
  <view
    :class="{
      'r-divider': true,
      'r-divider--dashed': dashed,
      'r-divider--hairline': hairline,
      'r-divider--vertical': vertical,
      ['r-divider--content-' + contentPosition]: $slots.default && !vertical,
    }"
    :style="{
      ...getComponentThemeStyle,
      ...customStyle,
    }"
    @click="onClick"
  >
    <slot v-if="!vertical"></slot>
  </view>
</template>
<script setup>
import { computed, inject } from "vue";
import { getComponentThemeCssVar } from "@/uni_modules/r-theme/js_sdk/index.js";
import { CONFIG_PROVIDER_KEY } from "@/uni_modules/r-utils/js_sdk/index.js";
const emit = defineEmits(["click"]);
const props = defineProps({
  // 是否使用虚线
  dashed: {
    type: Boolean,
    default: false,
  },
  //   是否使用 0.5px 线
  hairline: {
    type: Boolean,
    default: false,
  },
  //   内容位置，可选值为 left right
  contentPosition: {
    type: String,
    default: "center",
  },
  //   是否使用垂直
  vertical: {
    type: Boolean,
    default: false,
  },
  //自定义样式
  customStyle: {
    type: Object,
    default: () => {},
  },
  //   主题名称
  themeName: {
    type: String,
    default: "default",
  },
});

const componentsName = "r-divider";
const themeInject = inject(CONFIG_PROVIDER_KEY, {});

const getComponentThemeStyle = computed(() => {
  let themeName = props.themeName;

  if (themeInject?.value?.themeName) {
    //传递过来的有就用传递了
    themeName = themeInject?.value?.themeName;
  }
  if (props.themeName != "default") {
    //单独设置了组件的 就用单独设置的
    themeName = props.themeName;
  }

  return {
    ...getComponentThemeCssVar(themeName, "r-base"),
    ...getComponentThemeCssVar(themeName, componentsName),
  };
});
const onClick = (e) => emit("click", e);
</script>
<style lang="scss" scoped>
.r-divider {
  display: flex;
  align-items: center;
  margin: var(--r-divider-margin);
  color: var(--r-divider-text-color);
  font-size: var(--r-divider-font-size);
  line-height: var(--r-divider-line-height);
  border-color: var(--r-divider-border-color);
  border-style: solid;
  border-width: 0;

  &::before,
  &::after {
    display: block;
    flex: 1;
    box-sizing: border-box;
    height: 1px;
    border-color: inherit;
    border-style: inherit;
    border-width: var(--r-border-width) 0 0;
  }

  &::before {
    content: "";
  }

  &--hairline {
    &::before,
    &::after {
      transform: scaleY(0.5);
    }
  }

  &--dashed {
    border-style: dashed;
  }

  &--content-center,
  &--content-left,
  &--content-right {
    &::before {
      margin-right: var(--r-divider-content-padding);
    }

    &::after {
      margin-left: var(--r-divider-content-padding);
      content: "";
    }
  }

  &--content-left {
    &::before {
      max-width: var(--r-divider-content-left-width);
    }
  }

  &--content-right {
    &::after {
      max-width: var(--r-divider-content-right-width);
    }
  }

  &--vertical {
    display: inline-block;
    width: var(--r-border-width);
    height: 1em;
    margin: var(--r-divider-vertical-margin);
    vertical-align: middle;

    &::before {
      height: 100%;
      border-width: 0 0 0 var(--r-border-width);
    }

    &::after {
      display: none;
    }

    &.r-divider--hairline {
      &::before {
        transform: scaleX(0.5);
      }
    }
  }
}
</style>
