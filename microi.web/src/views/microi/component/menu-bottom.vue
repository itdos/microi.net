<template>
  <div class="menu-bottom-bg" v-if="ShowMenuBottom()">
    <div class="container">
      <div class="row">
        <!-- <div class="col-md-4">
                <i class="fas fa-heartbeat icon"></i>
            </div>
            <div class="col-md-4">
                <i class="fas fa-heartbeat icon"></i>
            </div>
            <div class="col-md-4">
                <i class="fas fa-heartbeat icon"></i>
            </div>
            <div class="col-md-4">
                <i class="fas fa-heartbeat icon"></i>
            </div> -->
        <!-- <el-divider content-position="center" style="color:#ccc;">{{$root.OsVersion}}</el-divider> -->
        <!-- <div class="col-md-12 item">
                    {{ $root.OsVersion }}
                </div>
                <div class="col-md-12 item">
                    <a title="www.itdos.com" href="javascript:;">Copyright © 2021</a>
                </div> -->
        <!-- <div v-html="htmlStrToDom(SysConfig.MenuBottomContent)">

                </div> -->
        <div id="MenuBottomContent"></div>
      </div>
    </div>
  </div>
</template>
<script>
import { mapState } from "vuex";
// import Vue from 'vue';
import Vue from "vue/dist/vue.esm.js";
export default {
  name: "SidebarLogo",
  props: {
    // collapse: {
    //     type: Boolean,
    //     required: true,
    // },
  },
  computed: {
    ...mapState({
      OsClient: (state) => state.DiyStore.OsClient,
      SysConfig: (state) => state.DiyStore.SysConfig,
    }),
  },
  data() {
    return {};
  },
  mounted() {
    var self = this;
    if (self.ShowMenuBottom()) {
      var html = self.SysConfig.MenuBottomContent;
      if (!html) {
        html = `<div class="col-md-12 item">
                            {{ OsVersion}}
                        </div>
                        <div class="col-md-12 item">
                            <a title="www.itdos.com" href="javascript:;">Copyright © 2021</a>
                        </div>`;
      }
      // 创建构造器
      var Profile = Vue.extend({
        template: `<div style="width:100%">` + html + `</div>`,
        data: function () {
          return {
            OsVersion: self.$root.OsVersion,
          };
        },
        created() {
          // this.getData()
        },
        methods: {
          // 模拟请求-获取数据源
          // getData() {
          //     setTimeout(()=> {
          //         this.title = '测试标题'
          //     },2000)
          // }
        },
      });
      // 创建 Profile 实例，并挂载到一个元素上。
      new Profile().$mount("#MenuBottomContent");
    }
  },

  methods: {
    ShowMenuBottom() {
      var self = this;
      if (!self.SysConfig.MenuBottomContent) {
        return false;
      }
      return true;
    },
  },
};
</script>
<style lang="scss">
.menu-bottom-bg {
  opacity: 0.95;
  height: 120px;
  background-image: url(../img/menu-bottom-bg.svg);
  background-size: cover;
  padding-top: 44px;
  width: 100%;
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 1;
  .icon {
    width: 22px;
    height: 22px;
  }
  a {
    color: #ccc;
  }
  .item {
    text-align: center;
    height: 30px;
    line-height: 30px;
    color: #ccc;
  }
}
</style>
