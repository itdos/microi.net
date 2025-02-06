<template>
  <section class="app-main-microi">
    <transition name="fade-transform" mode="out-in">
      <keep-alive :include="cachedViews">
        <router-view :key="key" />
      </keep-alive>
    </transition>
    <section id="MicroiService"></section>
  </section>
</template>

<script>
// import startQiankun from '@/views/microi/microi.service/index'// 注入乾坤基座配置
//2022-04-13注释
import {
  registerMicroApps,
  addGlobalUncaughtErrorHandler,
  start,
} from "qiankun";
export default {
  name: "AppMain",
  computed: {
    cachedViews() {
      return this.$store.state.tagsView.cachedViews;
    },
    key() {
      return this.$route.path;
    },
  },
  async mounted() {
    // console.log('-------> AppMain.vue mounted');
    var self = this;
    self.DiyCommon.Post(
      "/api/FormEngine/getTableDataAnonymous",
      {
        OsClient: self.DiyCommon.GetOsClient(),
        FormEngineKey: "Sys_MicroiService",
      },
      function (result) {
        if (!self.DiyCommon.Result(result)) {
          return;
        }
        var apps = [];
        const ENV = process.env.NODE_ENV || "development";
        var configJson = { development: {}, production: {} };
        result.Data.forEach((element) => {
          configJson.production[element.MsKey] = element.MsUrl;
          configJson.development[element.MsKey] = element.MsDevUrl;
          const config = configJson[ENV];
          apps.push({
            name: element.MsKey, //微应用名称
            entry: configJson[ENV][element.MsKey], //微应用服务地址
            container: "#MicroiService", //基座 id
            activeRule: "#/" + element.MsKey, //访问名称，注意必须和微应用名称相同
          });
        });
        /**
         * 注册子应用
         * 第一个参数 - 子应用的注册信息
         * 第二个参数 - 全局生命周期钩子
         */
        registerMicroApps(apps, {
          // qiankun 生命周期钩子 - 加载前
          beforeLoad: (app) => {
            // console.log('加载子应用前，加载进度条', app.name)
            return Promise.resolve();
          },
          // qiankun 生命周期钩子 - 挂载后
          afterMount: (app) => {
            // console.log('加载子应用前，进度条加载完成', app.name)
            return Promise.resolve();
          },
        });

        /**
         * 添加全局的未捕获异常处理器
         */
        addGlobalUncaughtErrorHandler((event) => {
          console.error(event);
          const { message: msg } = event;
          // 加载失败时提示
          if (msg && msg.includes("died in status LOADING_SOURCE_CODE")) {
            console.log("请检查应用是否可运行，子应用加载未成功");
          }
        });

        self.$nextTick(function () {
          start();
          // startQiankun();
        });
      }
    );
  },
};
</script>

<style lang="scss" scoped>
.app-main-microi {
  /* 50= navbar  50  */
  min-height: calc(100vh - 50px);
  width: 100%;
  position: relative;
  overflow: hidden;
}

.fixed-header-microi + .app-main-microi {
  padding-top: 50px;
}

.hasTagsView {
  .app-main-microi {
    /* 84 = navbar + tags-view = 50 + 34 */
    min-height: calc(100vh - 84px);
  }

  .fixed-header-microi + .app-main-microi {
    padding-top: 84px;
  }
}
</style>

<style lang="scss">
// fix css style bug in open el-dialog
.el-popup-parent--hidden {
  .fixed-header-microi {
    padding-right: 15px;
  }
}
</style>
