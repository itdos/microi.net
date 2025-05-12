<template>
  <component :is="type" v-bind="linkProps(to)">
    <slot />
  </component>
</template>

<script>
import { isExternal } from "@/utils/validate";

export default {
  props: {
    to: {
      type: String,
      required: true
    }
  },
  computed: {
    isExternal() {
      return isExternal(this.to);
    },
    type() {
      if (this.isExternal) {
        return "a";
      }
      return "router-link";
    }
  },
  methods: {
    linkProps(to) {
      var self = this;
      if (this.isExternal) {
        //2023-04-02
        to = to.replace("$V8.CurrentToken$", self.DiyCommon.getToken());
        return {
          href: to,
          target: "_blank",
          rel: "noopener"
        };
      }
      return {
        to: to
      };
    }
  }
};
</script>
