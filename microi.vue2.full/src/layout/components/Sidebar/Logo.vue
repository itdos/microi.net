<template>
  <div
    v-if="ShowClassicTop != 0"
    class="sidebar-logo-microi-container-microi"
    :class="{ collapse: collapse }"
    :style="{
      background:
        SysConfig.MenuBg == 'Custom' && SysConfig.LogoBgColor
          ? SysConfig.LogoBgColor
          : '#fff',
    }"
  >
    <transition name="sidebarLogoFade">
      <router-link
        v-if="collapse"
        key="collapse"
        class="sidebar-logo-microi-link"
        @click.native="GetSysLogoLink()"
        to=""
      >
        <img
          class="sidebar-logo-microi"
          :style="{ height: GetSysLogoHeight() }"
          :src="GetSysLogo()"
        />
      </router-link>
      <router-link
        v-else
        key="expand"
        class="sidebar-logo-microi-link"
        @click.native="GetSysLogoLink()"
        to=""
      >
        <img
          class="sidebar-logo-microi"
          :style="{ height: GetSysLogoHeight() }"
          :src="GetSysLogo()"
        />
        <h1
          class="sidebar-title-microi"
          v-if="IsDisplayShortTitle()"
          :style="{
            color: SysConfig.SysTitleColor ? SysConfig.SysTitleColor : '#000',
          }"
        >
          {{
            !DiyCommon.IsNull(SysConfig.SysShortTitle)
              ? SysConfig.SysShortTitle
              : DiyCommon.IsNull(ShortTitle)
              ? WebTitle
              : ShortTitle
          }}
        </h1>
      </router-link>
    </transition>
  </div>
</template>

<script>
import { mapState } from "vuex";
export default {
  name: "SidebarLogo",
  props: {
    collapse: {
      type: Boolean,
      required: true,
    },
  },
  computed: {
    ...mapState({
      title: (state) => state.settings.title,
      WebTitle: (state) => state.DiyStore.WebTitle,
      ShortTitle: (state) => state.DiyStore.ShortTitle,
      OsClient: (state) => state.DiyStore.OsClient,
      ThemeClass: (state) => state.DiyStore.ThemeClass,
      SysConfig: (state) => state.DiyStore.SysConfig,
      ShowClassicTop: (state) => state.DiyStore.ShowClassicTop,
    }),
  },
  data() {
    return {
      //   title: '吾码 Microi 低代码平台',
      //   logo: 'https://wpimg.wallstcn.com/69a1c46c-eb1c-4b46-8bd4-e9e686ef5251.png'
    };
  },
  mounted() {},
  methods: {
    GetSysLogo() {
      var self = this;
      if (!self.DiyCommon.IsNull(self.SysConfig.SysLogo)) {
        return self.DiyCommon.GetServerPath(self.SysConfig.SysLogo);
      }
      return self.DiyCommon.GetServerPath("/static/img/logo/itdos.svg");
    },
    GetSysLogoHeight() {
      var self = this;
      if (!self.DiyCommon.IsNull(self.SysConfig.SysLogoHeight)) {
        return self.SysConfig.SysLogoHeight > 45
          ? 45
          : self.SysConfig.SysLogoHeight + "px";
      }
      return "40px";
    },
    IsDisplayShortTitle() {
      var self = this;
      if (!self.DiyCommon.IsNull(self.SysConfig.SysLogoType)) {
        if (self.SysConfig.SysLogoType == "图形") {
          return false;
        }
      }
      return true;
    },
    GetSysLogoLink() {
      var self = this;
      if (!self.DiyCommon.IsNull(self.SysConfig.SysLogoLink)) {
        if (self.SysConfig.SysLogoLink.indexOf("http") > -1) {
          window.open(self.SysConfig.SysLogoLink);
          return;
        }
        self.$router.push(self.SysConfig.SysLogoLink);
        return;
      }
      self.$router.push("/");
    },
  },
};
</script>

<style lang="scss" scoped>
.sidebarLogoFade-enter-active {
  transition: opacity 1.5s;
}

.sidebarLogoFade-enter,
.sidebarLogoFade-leave-to {
  opacity: 0;
}

.sidebar-logo-microi-container-microi {
  position: relative;
  width: 100%;
  height: 55px;
  line-height: 55px;
  // background: #fff;
  text-align: center;
  overflow: hidden;

  & .sidebar-logo-microi-link {
    height: 100%;
    width: 100%;

    & .sidebar-logo-microi {
      width: 32px;
      height: 32px;
      vertical-align: middle;
      margin-right: 12px;
    }

    & .sidebar-title-microi {
      display: inline-block;
      margin: 0;
      // color: #000;
      font-weight: 600;
      line-height: 25px;
      font-size: 25px;
      font-family: Avenir, Helvetica Neue, Arial, Helvetica, sans-serif;
      vertical-align: middle;
    }
  }

  &.collapse {
    .sidebar-logo-microi {
      margin-right: 0px;
    }
  }
}
</style>
