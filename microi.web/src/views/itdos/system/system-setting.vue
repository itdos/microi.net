<template>
  <div
    id="divOsSystemSetting"
    class="microi-desktop-secmenu"
    style="height: 100%; display: none"
  >
    <div class="pluginPage-aero" />
    <div class="container-fluid">
      <div class="row">
        <div
          class="col-md-12 marginTop20"
          style="text-align: center; font-size: 18px"
        >
          {{ DiyCommon.GetLangValue(sysMenu, "Name") }}
        </div>
        <div
          class="col-md-offset-4 col-md-4 col-sm-offset-3 col-sm-6 col-xs-offset-2 col-xs-8 marginTop20"
          style="text-align: center"
        >
          <div class="input-group">
            <input
              type="text"
              class="form-control"
              placeholder="查找功能模块"
            />
            <div
              class="input-group-addon"
              style="background-color: var(--theme-color)"
            >
              <i class="fas fa-search" style="color: var(--bg-color)" />
            </div>
          </div>
        </div>
      </div>
      <div class="row items">
        <div
          v-for="(m, i) in SecondMenuList"
          :key="m.Id"
          class="col-lg-3 col-md-4 col-sm-6 col-xs-12"
        >
          <div class="item" @click.stop="OpenDesktopItem(m)">
            <div class="float-left" style="width: 40px">
              <!-- fas fa-laptop -->
              <i
                :class="
                  DiyCommon.IsNull(m.IconClass) ? 'fas fa-bars' : m.IconClass
                "
              />
            </div>
            <div class="rightContent">
              <div class="title">{{ DiyCommon.GetLangValue(m, "Name") }}</div>
              <div class="child">
                {{ DiyCommon.GetLangValue(m, "Description") }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapMutations, mapGetters, mapActions } from "vuex";
export default {
  props: {
    sysMenu: Object
  },
  computed: {
    ...mapGetters([]),
    ...mapState({
      DesktopBg: (state) => state.DiyStore.DesktopBg,
      CurrentTime: (state) => state.DiyStore.CurrentTime,
      LoginCover: (state) => state.DiyStore.LoginCover,
      OsClient: (state) => state.DiyStore.OsClient,
      Lang: (state) => state.DiyStore.Lang
    })
  },
  mounted() {
    var self = this;
    if (
      !self.DiyCommon.IsNull(self.sysMenu) &&
      !self.DiyCommon.IsNull(self.sysMenu._Child)
    ) {
      self.SecondMenuList = self.sysMenu._Child;
    }
    self.$nextTick(function () {
      //self.FastClick.attach(document.querySelector('.layx-window'))
    });
  },
  data() {
    return {
      SecondMenuList: []
    };
  },
  methods: {
    OpenDesktopItem(sysMenu) {
      var self = this;
      self.$parent.OpenDesktopItem(sysMenu);

      // layx.updateZIndex(sysMenu.Id);
    }
  }
};
</script>

<style></style>
