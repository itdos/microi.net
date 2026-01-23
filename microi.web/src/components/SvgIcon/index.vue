<template>
    <div v-if="isExternal" :style="styleExternalIcon" class="svg-external-icon svg-icon" v-bind="$attrs" />
    <svg v-else :class="svgClass" aria-hidden="true" v-bind="$attrs">
        <use :xlink:href="iconName" :fill="themeColor" />
    </svg>
</template>

<script>
import { isExternal } from "@/utils/validate";
import { computed } from "vue";
import { useDiyStore } from "@/stores";

export default {
    name: "SvgIcon",
    setup() {
        const diyStore = useDiyStore();
        const themeColor = computed(() => diyStore.themeColor);
        return { themeColor };
    },
    props: {
        iconClass: {
            type: String,
            required: true
        },
        className: {
            type: String,
            default: ""
        }
    },
    computed: {
        isExternal() {
            return isExternal(this.iconClass);
        },
        iconName() {
            return `#icon-${this.iconClass}`;
        },
        svgClass() {
            if (this.className) {
                return "svg-icon " + this.className;
            } else {
                return "svg-icon";
            }
        },
        styleExternalIcon() {
            return {
                mask: `url(${this.iconClass}) no-repeat 50% 50%`,
                "-webkit-mask": `url(${this.iconClass}) no-repeat 50% 50%`
            };
        }
    }
};
</script>

<style scoped>
.svg-icon {
    width: 1em;
    height: 1em;
    vertical-align: -0.15em;
    fill: currentColor;
    overflow: hidden;
}

.svg-external-icon {
    background-color: currentColor;
    mask-size: cover !important;
    display: inline-block;
}
</style>
