<template>
  <div :class="{ 'has-logo': showLogo, 'sidebar-js-bg': ShowStar() }">
    <logo v-if="showLogo" :collapse="isCollapse" />
    <el-scrollbar wrap-class="scrollbar-wrapper-microi">
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :background-color="variables.menuBg"
        :text-color="variables.menuText"
        :unique-opened="false"
        :active-text-color="variables.menuActiveText"
        :collapse-transition="false"
        mode="vertical"
      >
        <template v-for="(route, index) in permission_routes">
          <sidebar-item
            v-if="route.Display"
            :key="route.path"
            :item="route"
            :base-path="route.path"
          />
        </template>
      </el-menu>
      <div style="height: 120px; width: 100%"></div>
    </el-scrollbar>
    <MenuBottom v-show="!isCollapse"></MenuBottom>
    <canvas
      v-if="ShowStar()"
      id="canv"
      width="240"
      style="
        width: 240px;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        z-index: -1;
      "
    ></canvas>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import Logo from "./Logo";
import SidebarItem from "./SidebarItem";
import variables from "@/styles/variables.scss";
import MenuBottom from "@/views/microi/component/menu-bottom.vue";
import { AnimateStar } from "@/views/microi/js/animate-star";

export default {
  components: { SidebarItem, Logo, MenuBottom },
  computed: {
    ...mapState({
      OsClient: (state) => state.DiyStore.OsClient,
      SysConfig: (state) => state.DiyStore.SysConfig
    }),
    ...mapGetters(["permission_routes", "sidebar"]),
    activeMenu() {
      const route = this.$route;
      const { meta, path } = route;
      // if set path, the sidebar will highlight the path you set
      if (meta.activeMenu) {
        return meta.activeMenu;
      }
      return path;
    },
    showLogo() {
      return this.$store.state.settings.sidebarLogo;
    },
    variables() {
      return variables;
    },
    isCollapse() {
      return !this.sidebar.opened;
    }
  },
  created() {
    var self = this;
    self.$nextTick(function () {
      // require("@/views/microi/js/animate-star");
      // AnimateStar.run();
      if (self.ShowStar()) {
        new AnimateStar().run();
      }
    });
  },
  mounted() {
    var self = this;
    self.$nextTick(function () {
      // require("@/views/microi/js/animate-star");
      // AnimateStar.run();
      if (self.ShowStar()) {
        new AnimateStar().run();
      }
    });
  },
  methods: {
    ShowStar() {
      var self = this;
      if (
        self.DiyCommon.IsNull(self.SysConfig.MenuBg) ||
        self.SysConfig.MenuBg == "Style1"
      ) {
        return true;
      }
      return false;
    }
  }
};
</script>
<style scoped lang="scss">
.sidebar-js-bg {
  // #000d4d  #000105 原先           //#242B49  #5473E8 小罗
  //左边的颜色是中间，右边的颜色是两边
  background-image: -webkit-radial-gradient(
    ellipse farthest-corner at center top,
    #242b49 0%,
    #171717 100%
  );
  background-image: radial-gradient(
    ellipse farthest-corner at center top,
    #242b49 0%,
    #171717 100%
  );
}
</style>
