<template>
  <div class="home">
    <div class="box">
      <div class="title">欢迎使用{{ WebTitle }}</div>
      <div class="cont">
        {{ ClientCompany }}
      </div>
    </div>
    <div class="img">
      <img src="https://static-img.aijuhome.com/static/img/home-img.png" alt="" />
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
export default {
  data() {
    return {
      // title:'欢迎使用吾码Microi管理系统',
      // cont:'拓路前行，领跑未来，带给你不一样的管理效率'
    };
  },
  computed: {
    ...mapState({
      CurrentTime: (state) => state.DiyStore.CurrentTime,
      DesktopBg: (state) => state.DiyStore.DesktopBg,
      LoginCover: (state) => state.DiyStore.LoginCover,
      OsClient: (state) => state.DiyStore.OsClient,
      Lang: (state) => state.DiyStore.Lang,
      // iTdosState: state => state.itdos,
      title: (state) => state.settings.title,
      // SystemStyle: state => DiyStore.state.SystemStyle,
      WebTitle: (state) => state.DiyStore.WebTitle,
      SystemSubTitle: (state) => state.DiyStore.SystemSubTitle,
      ClientCompany: (state) => state.DiyStore.ClientCompany,
      ClientCompanyUrl: (state) => state.DiyStore.ClientCompanyUrl
    })
  },
  methods: {},
  mounted() {}
};
</script>

<style lang="scss" scoped>
.home {
  width: 100%;
  height: 100vh;
  background: url(https://static-img.aijuhome.com/static/img/home-bg1.png) no-repeat;
  background-size: 100% 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.title {
  font-size: 3vw;
  color: #253b99;
  font-weight: bold;
}
.cont {
  width: 100%;
  height: 40px;
  line-height: 40px;
  text-align: center;
  font-size: 22px;
  color: #fff;
  background: url(https://static-img.aijuhome.com/static/img/home-txtbg.png) no-repeat;
  background-size: 100% 100%;
  margin-top: 35px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.box {
  margin-bottom: 220px;
}
.img {
  width: 40%;
  img {
    width: 100%;
  }
}
</style>
