<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script>
import { DiyCommon, DiyApi } from 'microi.net'
export default {
  name: 'App',
  created() {
    console.log('执行次数记录！！！ created');
  },
  mounted() {
      var self = this;
      self.PageInit();
        console.log('执行次数记录！！！ mounted');
  },
  data() {
        return {
            DiyCommon : DiyCommon,
            DiyApi : DiyApi,
        }
    },
  methods:{
        PageInit() {
            var self = this
            self.GetCurrentUserApp()
            window.setInterval(self.GetCurrentUserApp, 1000 * 60 * 3)
        },
        GetCurrentUserApp() {
            var self = this
            self.DiyCommon.Get(self.DiyApi.GetCurrentUser(), {}, function (result) {
                if (self.DiyCommon.Result(result)) {
                    self.$store.commit('DiyStore/SetCurrentUser', result.Data)
                }
            })
        },
    },
}
</script>
