<template>
  <div>
    <div
      id="divLogin"
      :style="{
        backgroundImage: 'url(' + (DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockImgUrl, false) : '') + ')',
        '--LockBgCss': 'url(' + (DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockImgUrl, false) : '') + ')'
      }"
    >
      <canvas v-if="DesktopBg.LockJsCover == 'Matrix'" id="iTdosLockJsCover" />
      <div v-if="DiyCommon && !DiyCommon.ShowVideo() && DesktopBg.LockImgAero" class="microi-ui-lock-aero" />
      <div style="position: absolute; width: 100%; height: 100%; z-index: -10" />
      <div v-if="DiyCommon && DiyCommon.ShowVideo()" style="position: absolute; width: 100%; height: 100%; z-index: -20">
        <video
          id="videoLogin"
          class="video"
          :poster="DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockImgUrl) : ''"
          :muted="!DesktopBg.LockVideoVoice"
          :src="DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockVideoUrl) : ''"
          autoplay="autoplay"
          data-autoplay="true"
          preload="auto"
          loop="loop"
          webkit-playsinline="true"
          playsinline="true"
          x5-video-player-type="h5"
        >
          <source :src="DiyCommon ? DiyCommon.GetServerPath(DesktopBg.LockVideoUrl) : ''" type="video/mp4" />
        </video>
      </div>
      <div class="divLoginCenter" :style="{ opacity: LoginCover ? '0' : '1' }">
        <div class="loginCenterBgCover" />
        <div class="login-title">
          <!-- {{ $t('Msg.WelcomeUse') }} -->
          <div v-if="OsClient != 'nbcmc'">
            {{ WebTitle }}
          </div>
          <div v-if="OsClient == 'nbcmc'">
            <img src="https://static.nbcmc.cn/nbcmc/img/20230418/bbb-1681808988.png" style="height: auto" />
          </div>
          <span style="font-size: 18px">{{ SystemSubTitle }}</span>
        </div>

        <div class="login-input-param" style="margin-bottom: 15px">
          <div class="form-group row">
            <label class="sr-only" />
            <!-- input-group-sm -->
            <div class="input-group">
              <div class="input-group-prepend">
                <span class="input-group-text" :style="{ backgroundColor: SysConfig.ThemeColor || '' }"><i class="fa fa-user" color="white" /></span>
              </div>
              <input v-model="Account" type="text" class="form-control" :placeholder="$t('Msg.InputAccount')" />
              <!-- <div class="input-group-addon">.00</div> -->
            </div>
          </div>
        </div>
        <div class="login-input-param" style="margin-bottom: 15px">
          <div class="form-group row">
            <label class="sr-only" />
            <div class="input-group">
              <div class="input-group-prepend">
                <span class="input-group-text" :style="{ backgroundColor: SysConfig.ThemeColor || '' }"><i class="fas fa-key" color="white" /></span>
              </div>
              <input v-model="Pwd" type="password" class="form-control" :placeholder="$t('Msg.InputPwd')" @keyup.13="Login" />

              <div class="input-group-prepend">
                <span class="input-group-text go" :style="{ backgroundColor: SysConfig.ThemeColor || '' }">
                  <img id="CaptchaImg" src="" v-if="SysConfig.EnableCaptcha" style="height: 36px" @click="GetCaptcha()" />
                  <input class="captcha-result" v-model="CaptchaValue" v-if="SysConfig.EnableCaptcha" placeholder="验证码" @keyup.13="Login" />
                  <i id="faLogin" v-if="PageType != 'BindWeChat'" @click="Login" class="el-icon-right hand" style="width: 50px; height: 36px; line-height: 36px; color: #fff" />
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="SysConfig.EnablePrivacyPolicy" class="login-input-param" style="margin-bottom: 15px">
          <div class="form-group row">
            <label class="sr-only" />
            <el-checkbox v-model="CheckPrivacyPolicy">
              <a href="javascript:;" style="color: #fff !important; text-decoration: underline !important" @click="ShowPrivacyPolicy = true">
                {{ SysConfig.PrivacyPolicyName || "同意隐私协议" }}
              </a>
            </el-checkbox>
          </div>
        </div>
        <div class="bottomTips" style="text-align: center; margin-top: 30px">
          <div>
            <p v-if="SysConfig.EnableReg">
              <a href="javascript:;" @click="OpenReg"><i class="far fa-registered" style="margin-right: 2px" /> 立即注册</a>
            </p>
            <p v-if="PageType == 'BindWeChat'">
              <el-button type="primary" @click="BindWeChat()"><i class="el-icon-right hand" style="margin-right: 2px" /> 立即绑定</el-button>
            </p>

            <!-- <p>
                            <a href="javascript:;">
                                <i class="fas fa-code-branch" style="margin-right:2px;" />
                                {{ $t('Msg.Version') }}{{ Lang == 'zh-CN' ? '：' : ': ' }}{{$root.OsVersion}}
                            </a>
                        </p> -->
            <!-- <p>
                            <i class="far fa-copyright" style="margin-right:2px;" />
                            <a :href="DiyCommon.IsNull(ClientCompanyUrl) ? 'javascript:;' : ClientCompanyUrl">{{ ClientCompany }}</a>
                        </p> -->
            <p v-html="LoginBottomContent"></p>
          </div>
          <p>当前语言：{{ currentLang }}</p>

          <!-- 默认中文/英文,如果选了无，则不显示多语言2025-6-1 liu-->
          <!-- <p v-if="SysConfig.SysLang">
            <a href="javascript:;" :style="{ fontWeight: Lang == 'en' ? 'bold' : '' }" @click="DiyCommon.ChangeLang('en')">
              <i class="fas fa-language" style="font-size: 48px;"></i>
              EN
            </a>
            |
            <a href="javascript:;" :style="{ fontWeight: Lang == 'zh-CN' ? 'bold' : '' }" @click="DiyCommon.ChangeLang('zh-CN')">CN</a>
          </p> -->
        </div>
      </div>
      <div
        class="divLoginTime"
        :style="{
          bottom: LoginCover ? '7.5%' : '100%',
          opacity: LoginCover ? '1' : '0'
        }"
      >
        <div style="position: absolute; bottom: 0; left: 0">
          <p>{{ CurrentTime.Format("HH:mm:ss") }}</p>
          <p>
            {{ DiyCommon.Months[CurrentTime.getMonth()] + DiyCommon.GetLanDate(CurrentTime.getDate()) + ", " + DiyCommon.Weeks[CurrentTime.getDay()] }}
          </p>
        </div>
      </div>
      <el-dialog v-el-drag-dialog width="800px" :modal-append-to-body="false" :visible.sync="ShowChooseOS" :title="$t('Msg.ChooseOSType')" :close-on-click-modal="false">
        <div style="width: 100%">
          <div class="float-left" @click="SystemStyle = 'WebOS'">
            <img :class="'imgSystemPreview ' + (SystemStyle == 'WebOS' ? 'active' : '')" :src="DiyCommon.GetServerPath('./static/img/preview-os.jpg')" />
            <el-radio v-model="SystemStyle" label="WebOS">Web操作系统</el-radio>
          </div>
          <div class="pull-right" @click="SystemStyle = 'Classic'">
            <img :class="'imgSystemPreview ' + (SystemStyle == 'Classic' ? 'active' : '')" :src="DiyCommon.GetServerPath('./static/img/preview-old.jpg')" />
            <el-radio v-model="SystemStyle" label="Classic">经典系统界面</el-radio>
          </div>
        </div>
        <div class="clear marginTop10 marginBottom10" />
        <span slot="footer" class="dialog-footer">
          <el-button type="primary" size="mini" @click="GotoSystem">立即进入</el-button>
          <el-button size="mini" @click="$store.commit('DiyStore/SetShowGotoWebOS', false)">取 消</el-button>
        </span>
      </el-dialog>

      <el-dialog v-el-drag-dialog width="800px" :modal-append-to-body="false" :visible.sync="ShowPrivacyPolicy" :title="SysConfig.PrivacyPolicyName || '同意隐私协议'" :close-on-click-modal="false">
        <div v-html="SysConfig.PrivacyPolicy" style="width: 100%; text-align: left"></div>
      </el-dialog>

      <el-dialog v-el-drag-dialog width="500px" :modal-append-to-body="false" :visible.sync="ShowRegSysUser" :title="'用户注册'" :close-on-click-modal="false">
        <div>
          <el-form ref="form" :model="RegModel" label-width="100px" size="small">
            <el-form-item label="手机号">
              <el-input v-model="RegModel.Phone"></el-input>
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="RegModel.Pwd" :show-password="true"></el-input>
            </el-form-item>
            <el-form-item label="重复密码">
              <el-input v-model="RegModel.Pwd2" :show-password="true"></el-input>
            </el-form-item>
            <el-form-item label="图形验证码">
              <el-input placeholder="请输入图形验证码" v-model="RegCaptchaValue">
                <template slot="append">
                  <!--   -->
                  <img id="CaptchaImgReg" style="height: 30px" src="" @click="GetCaptcha(null, '#CaptchaImgReg', 'RegCaptchaId')" />
                </template>
              </el-input>
            </el-form-item>
            <el-form-item label="短信验证码">
              <el-input placeholder="请输入图形验证码" v-model="RegModel.SmsCaptchaValue">
                <template slot="append">
                  <a href="javascript:;" @click="SendSms">获取短信验证码</a>
                </template>
              </el-input>
            </el-form-item>
          </el-form>
          <span slot="footer" class="dialog-footer">
            <el-button type="primary" size="mini" @click="Reg()">提交</el-button>
          </span>
        </div>
      </el-dialog>
    </div>
  </div>
</template>

<script>
import elDragDialog from "@/directive/el-drag-dialog"; // base on element-ui
import { mapState, mapGetters, mapMutations, mapActions } from "vuex";
import { setInterval } from "timers";
import Cookies from "js-cookie";
import { getLangs } from "@/utils/langs";

export default {
  name: "Login",
  directives: {
    elDragDialog
  },
  beforeCreate() {},
  components: {},
  computed: {
    ...mapGetters([]),
    ...mapState({
      CurrentTime: (state) => state.DiyStore.CurrentTime,
      DesktopBg: (state) => state.DiyStore.DesktopBg,
      LoginCover: (state) => state.DiyStore.LoginCover,
      OsClient: (state) => state.DiyStore.OsClient,
      Lang: (state) => state.DiyStore.Lang,
      title: (state) => state.settings.title,
      // SystemStyle: state => DiyStore.state.SystemStyle,
      WebTitle: (state) => state.DiyStore.WebTitle,
      SystemSubTitle: (state) => state.DiyStore.SystemSubTitle,
      ClientCompany: (state) => state.DiyStore.ClientCompany,
      ClientCompanyUrl: (state) => state.DiyStore.ClientCompanyUrl,
      SysConfig: (state) => state.DiyStore.SysConfig
    }),
    SystemStyle: {
      get() {
        return this.$store.state.DiyStore.SystemStyle;
      },
      set(val) {
        this.$store.commit("DiyStore/SetState", {
          key: "SystemStyle",
          value: val
        });
      }
    },
    LoginBottomContent: {
      get() {
        return (this.SysConfig.LoginBottomContent || this.SysConfig.CompanyName || "")
          .replace("$OsVersion$", this.$root.OsVersion)
          .replace("$SysShortTitle$", this.SysConfig.SysShortTitle)
          .replace("$SysTitle$", this.SysConfig.SysTitle)
          .replace("$CompanyName$", this.SysConfig.CompanyName);
      }
    }
  },
  data() {
    return {
      currentLang: "简体中文",
      langOptions: [],
      PageType: "",
      WxKey: "",
      ShowRegSysUser: false,
      ShowPrivacyPolicy: false,
      CheckPrivacyPolicy: true,
      ShowCaptcha: false,
      ShowChooseOS: false,
      Account: "",
      Pwd: "",
      tipId: "",
      redirect: undefined,
      otherQuery: {},
      LoginResult: {},
      LoginWaiting: false,
      CaptchaId: "",
      RegCaptchaId: "",
      CaptchaValue: "",
      RegCaptchaValue: "",
      RegModel: {
        Phone: "",
        Pwd: "",
        Pwd2: "",
        SmsCaptchaValue: ""
      }
      // TokenLoginCount : 0
    };
  },
  watch: {
    $route: {
      handler: function (route) {
        const query = route.query;
        if (query) {
          this.redirect = query.redirect;
          this.otherQuery = this.getOtherQuery(query);
        }
      },
      immediate: true
    }
  },
  mounted() {
    console.log("-------> Login mounted");
    var self = this;
    try {
      //以下代码报错会导致前端无法正常登录，新增try catch --by anderson 2025-06-18
      self.langOptions = getLangs();
      let lang = translate.language.getCurrent();
      let tempLang = self.langOptions.find((item) => item.value === lang).label;
      if (tempLang) self.currentLang = tempLang;
    } catch (error) {
      console.log(error);
    }

    if (self.DiyCommon && self.DiyApi) {
      self.TokenLogin();
    }
    //判断版本号是否有更新，有则刷新一下，防止浏览器前端缓存
    var nowVersion = localStorage.getItem("Microi.OsVersion");
    var osVersionUrl = "https://static-ali-img.itdos.com/OsVersion.txt?t=" + Math.random();
    if (window.location.href.indexOf("dev.") > -1 || OsClientType == "Test") {
      osVersionUrl = "https://static-ali-img.itdos.com/OsVersion-dev.txt?t=" + Math.random();
    }
    $.get(osVersionUrl, {}, function (result) {
      if (result) {
        // if(self.DiyCommon.IsNull(nowVersion)){
        //     nowVersion = self.$root.OsVersion;
        // }
        // localStorage.setItem('OsVersion', result);
        // if(nowVersion != result){
        //     window.location.reload();
        // }
        //2023-05-12 修改判断逻辑
        localStorage.setItem("Microi.OsVersion", result);
        if (nowVersion) {
          if (nowVersion != result) {
            window.location.reload();
          }
        }
      }
    });

    $("#divLogin").css({
      opacity: 1
    });
    self.$nextTick(function () {
      $(".divLoginCenter").css("margin-top", parseInt(($(".divLoginCenter").outerHeight() / 2) * -1) + "px");
    });
    $(window).resize(function () {
      $(".divLoginCenter").css("margin-top", parseInt(($(".divLoginCenter").outerHeight() / 2) * -1) + "px");
    });

    $("#divLogin").click(function () {
      self.DisplayLogin();
    });
    var lastAccount = localStorage.getItem("Microi.LastLoginAccount");
    if (!self.DiyCommon.IsNull(lastAccount)) {
      self.Account = lastAccount;
    }
    var startX;
    var startY;
    $("#divLogin")
      .on("touchstart", function (e) {
        (startX = e.originalEvent.changedTouches[0].pageX), (startY = e.originalEvent.changedTouches[0].pageY);
      })
      .on("touchend", function (e) {
        var moveEndX = e.originalEvent.changedTouches[0].pageX;
        var moveEndY = e.originalEvent.changedTouches[0].pageY;
        var X = moveEndX - startX;
        var Y = moveEndY - startY;

        if (Math.abs(X) <= Math.abs(Y)) {
          if (Y > 0) {
            // alert('下滑');
            self.HiddenLogin();
          } else if (Y < 0) {
            // alert('上滑');
            self.DisplayLogin();
          }
        }
      });

    self.$nextTick(function () {
      if (self.DiyCommon.ShowVideo()) {
        self.DiyCommon.LoadVideoLogin();
      }
      if (self.DesktopBg.LockJsCover == "Matrix") {
        // 黑客帝国
        var canvas = document.getElementById("iTdosLockJsCover");
        var context = canvas.getContext("2d");
        var fontSize = 14;
        var listText = "iTdos.net".split("");
        var column;
        var row;
        var listColumn = [];

        function draw() {
          context.fillStyle = "rgba(0, 0, 0, 0.05)";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.save();
          context.shadowColor = "#074425";
          context.shadowBlur = parseInt(Math.random() * 40 + 1);
          context.font = "normal 16px Microsoft Yahei";
          context.fillStyle = "#eefbf5";
          context.font = "14px Microsoft Yahei";
          context.restore();
          context.font = "normal " + fontSize + "px Microsoft Yahei";
          context.fillStyle = "#12ee46";
          for (var i = 0; i < column; i++) {
            if (Math.random() > 0.5) {
              var str = listText[parseInt(Math.random() * listText.length)];
              context.fillText(str, i * fontSize, listColumn[i] * fontSize);
              listColumn[i] += 1;
              if (listColumn[i] >= row) {
                listColumn[i] = 0;
              }
            }
          }
        }

        function resize() {
          canvas.width = window.innerWidth - 3;
          canvas.height = window.innerHeight - 3;

          (column = canvas.width / fontSize), (row = canvas.height / fontSize);

          for (var i = 0; i < column; i++) {
            listColumn[i] = 1;
          }
        }
        resize();
        var timer = setInterval(draw, 40);
        // 黑客帝国--end-----
      }
    });

    try {
      self.DiyCommon.PostAsync(
        "/api/diyTable/getSysConfig",
        {
          _SearchEqual: {
            IsEnable: 1
          },
          OsClient: self.OsClient
        },
        function (sysConfigResult) {
          if (sysConfigResult.Code == 1) {
            var sysConfig = sysConfigResult.Data;
            self.GetCaptcha(sysConfig);
          }
        }
      );
    } catch (error) {}
    var pageTypeReg = new RegExp("(^|&)" + "PageType" + "=([^&]*)(&|$)");
    var pageTypeRegResult = window.location.search.substr(1).match(pageTypeReg);
    var pageType = pageTypeRegResult != null ? pageTypeRegResult[2] : null;
    if (pageType == "BindWeChat") {
      self.PageType = "BindWeChat";
    }

    var wxKeyReg = new RegExp("(^|&)" + "WxKey" + "=([^&]*)(&|$)");
    var wxKeyRegResult = window.location.search.substr(1).match(wxKeyReg);
    var wxKey = wxKeyRegResult != null ? wxKeyRegResult[2] : null;
    self.WxKey = wxKey;

    setTimeout(function () {
      self.loadLang();
    }, 2000);
  },

  methods: {
    loadLang() {
      //兼容旧版本语言配置
      let currentLang = this.SysConfig?.SysLang;
      if (!currentLang) {
        currentLang = "zh-CN";
      }
      if (currentLang != "en" && currentLang != "zh-CN" && currentLang != "none" && typeof window.translate !== "undefined") {
        let lang = translate.language.getCurrent();
        if (lang != currentLang) {
          translate.changeLanguage(currentLang);
        }
      }
    },
    BindWeChat() {
      var self = this;
      self.DiyCommon.Post(
        "/apiengine/bind-wechat",
        {
          Account: self.Account,
          Pwd: self.Pwd,
          OsClient: self.OsClient,
          WxKey: self.WxKey,
          _CaptchaId: self.CaptchaId,
          _CaptchaValue: self.CaptchaValue
        },
        function (result) {
          if (self.DiyCommon.Result(result)) {
            window.location.href = result.Data.RedirectUrl;
          }
        }
      );
    },
    SendSms() {
      var self = this;
      self.DiyCommon.Post({
        url: "/api/sms/send",
        data: {
          Phone: self.RegModel.Phone,
          _CaptchaId: self.RegCaptchaId,
          _CaptchaValue: self.RegCaptchaValue,
          OsClient: self.OsClient
        },
        dataType: "json",
        success: function (result) {
          if (self.DiyCommon.Result(result)) {
            self.DiyCommon.Tips("发送成功！");
            self.GetCaptcha(null, "#CaptchaImgReg", "RegCaptchaId");
          }
        }
      });
    },
    OpenReg() {
      var self = this;
      self.GetCaptcha(null, "#CaptchaImgReg", "RegCaptchaId");
      self.ShowRegSysUser = true;
    },
    Reg() {
      var self = this;
      if (!self.RegModel.Pwd || !self.RegModel.Phone) {
        self.DiyCommon.Tips("帐号密码不能为空！", false);
        return;
      }
      if (self.RegModel.Pwd != self.RegModel.Pwd2) {
        self.DiyCommon.Tips("两次密码不一致！", false);
        return;
      }
      self.DiyCommon.Post({
        url: "/api/SysUser/reg",
        data: {
          Account: self.RegModel.Phone,
          Pwd: self.RegModel.Pwd,
          _SmsCaptchaValue: self.RegModel.SmsCaptchaValue,
          OsClient: self.OsClient
        },
        dataType: "json",
        success: function (result) {
          if (self.DiyCommon.Result(result)) {
            self.DiyCommon.Tips("注册成功！");
            self.ShowRegSysUser = false;
          }
        }
      });
    },
    GetCaptcha(sysConfig, imgId, captchaId) {
      var self = this;
      sysConfig = sysConfig || self.SysConfig;
      if (sysConfig) {
        self.$store.commit("DiyStore/SetSysConfig", sysConfig);
        //Logo
        if (sysConfig.EnableCaptcha || imgId) {
          self.$axios
            .get(self.DiyCommon.GetApiBase() + "/api/Captcha/getCaptcha", {
              params: {
                OsClient: self.OsClient
              },
              responseType: "arraybuffer"
            })
            .then((response) => {
              if (response && response.headers && response.headers.captchaid) {
                self[captchaId || "CaptchaId"] = response.headers.captchaid;
              }
              return "data:image/png;base64," + btoa(new Uint8Array(response.data).reduce((data, byte) => data + String.fromCharCode(byte), ""));
            })
            .then((data) => {
              $(imgId || "#CaptchaImg").attr("src", data);
            });
        }
      }
    },

    getOtherQuery(query) {
      return Object.keys(query).reduce((acc, cur) => {
        if (cur !== "redirect" && cur !== "token") {
          acc[cur] = query[cur];
        }
        return acc;
      }, {});
    },
    DisplayLogin() {
      this.$store.commit("DiyStore/SetLoginCover", {
        Data: false
      });
    },
    HiddenLogin() {
      this.$store.commit("DiyStore/SetLoginCover", {
        Data: true
      });
    },
    TokenLogin() {
      var self = this;
      //token自动登录  2022-04-09
      //取所有单点登录
      var diySsoList = self.DiyCommon.Post(
        "/api/FormEngine/getTableDataAnonymous",
        {
          FormEngineKey: "Diy_Sso",
          _SearchEqual: { IsEnable: true },
          OsClient: self.OsClient
        },
        function (result) {
          self.LoginResult = result;
          if (result.Code == 1 && Array.isArray(result.Data) && result.Data.length > 0) {
            console.log("-------> SsoLogin href：" + location.href);
            for (let index = 0; index < result.Data.length; index++) {
              const diySso = result.Data[index];
              var token = decodeURIComponent((new RegExp("[?|&|%3F]" + diySso.TokenName + "%3D" + "([^&;]+?)(&|#|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
              if (!token) {
                token = decodeURIComponent((new RegExp("[?|&|%3F]" + diySso.TokenName + "=" + "([^&;]+?)(&|#|;|$)").exec(location.href) || [, ""])[1].replace(/\+/g, "%20")) || null;
              }
              if (!self.DiyCommon.IsNull(token) && token != "$V8.CurrentToken$") {
                console.log("-------> SsoLogin token：" + token);
                //登录
                if (diySso.ClientSsoApi.toLowerCase() == self.DiyApi.TokenLogin().toLowerCase()) {
                  var newtoken = token.replace("Bearer%20", "").replace("Bearer ", "");
                  localStorage.setItem(self.DiyCommon.TokenKey, newtoken);
                  Cookies.set(self.DiyCommon.TokenKey, newtoken);
                }
                self.DiyCommon.Post(
                  diySso.ClientSsoApi,
                  {
                    //'/api/SysUser/SsoPengrui'
                    _token: token,
                    Token: token,
                    TokenName: diySso.TokenName,
                    OsClient: self.OsClient
                  },
                  function (result) {
                    console.log("-------> SsoLogin ssoApiResult：", result);
                    if (result.Code == 1) {
                      self.$store.commit("DiyStore/SetState", {
                        key: "SystemStyle",
                        value: "Classic"
                      });
                      self.GotoSystem();
                    }
                  }
                );
                break;
              }
            }
          }
        }
      );
    },
    async Login() {
      var self = this;

      if (self.LoginWaiting == true) {
        return;
      }

      if (self.SysConfig.EnablePrivacyPolicy && !self.CheckPrivacyPolicy) {
        self.DiyCommon.Tips(`请先勾选[${self.SysConfig.PrivacyPolicyName || "同意隐私协议"}]！`, false);
        return;
      }

      self.LoginWaiting = true;
      $("#faLogin").removeClass("el-icon-right").addClass("fa fa-fw fa-spin fa-spinner");
      var loginApi = self.DiyApi.Login();
      if (self.SysConfig.DiySystem) {
        // loginApi = self.DiyApi.DiyLogin;
      }
      // self.DiyCommon.Post(self.DiyApi.Login(), {
      // self.DiyCommon.Post(self.DiyApi.DiyLogin, {
      var loginParam = {
        Account: self.Account,
        Pwd: self.Pwd,
        // Pwd: self.Base64.encode(self.Pwd),
        OsClient: self.OsClient,
        _ClientType: "PC"
      };
      if (self.SysConfig.EnableCaptcha) {
        loginParam._CaptchaId = self.CaptchaId;
        loginParam._CaptchaValue = self.CaptchaValue;
      }
      self.DiyCommon.Post(loginApi, loginParam, async function (result) {
        // if(result.Code == 1004){
        //     self.GetCaptcha();
        //     self.CaptchaValue = '';
        // }
        if (self.DiyCommon.Result(result)) {
          self.LoginResult = result;
          if (false) {
            //self.OsClient == 'Tdx' || self.OsClient == 'Nbgysh'
            self.$store.commit("DiyStore/SetState", {
              key: "SystemStyle",
              value: "WebOS"
            });
            self.GotoSystem();
          } else {
            if (result.DataAppend.SysConfig) {
              self.$store.commit("DiyStore/SetSysConfig", result.DataAppend.SysConfig);
              console.log('result.DataAppend.SysConfig.LoginEndV8Code',result.DataAppend.SysConfig.LoginEndV8Code)
              if (!self.DiyCommon.IsNull(result.DataAppend.SysConfig.LoginEndV8Code)) {
                try {
                  var V8 = {
                    EventName: "LoginEnd"
                  };
                  await self.DiyCommon.InitV8Code(V8, self.$router);
                  await eval("(async () => {\n " + result.DataAppend.SysConfig.LoginEndV8Code + " \n})()");
                } catch (error) {
                  console.error("执行登录结束V8代码出现错误：" + error.message);
                }
              }
            }

            if (self.DiyCommon.IsNull(self.SystemStyle)) {
              // self.ShowChooseOS = true;
              self.$store.commit("DiyStore/SetState", {
                key: "SystemStyle",
                value: "Classic"
              });
              self.GotoSystem();
            } else {
              self.GotoSystem();
            }
          }
        } else {
          self.GetCaptcha();
          self.CaptchaValue = "";
          $("#faLogin").removeClass("fa fa-fw fa-spin fa-spinner").addClass("el-icon-right");
        }
        self.LoginWaiting = false;
      });
    },
    GotoSystem() {
      var self = this;
      if (self.DiyCommon.IsNull(self.SystemStyle)) {
        self.DiyCommon.Tips(self.$t("Msg.ChooseOSType"));
        return;
      }
      self.ShowChooseOS = false;
      self.$store.commit("DiyStore/SetState", {
        key: "SystemStyle",
        value: self.SystemStyle
      });

      document.body.classList.remove("Classic");
      document.body.classList.remove("WebOS");
      document.body.classList.add(self.SystemStyle);

      // $('#divLogin').css({
      //     opacity: 0
      // })
      localStorage.setItem("Microi.LastLoginAccount", self.LoginResult.Data.Account);
      try {
        self.$parent.GetDesktop();
      } catch (error) {}
      self.DiyCommon.Tips((!self.DiyCommon.IsNull(self.LoginResult.Data.Name) ? self.LoginResult.Data.Name : self.LoginResult.Data.Account) + self.$t("Msg.WelcomeBack"));
      try {
        // 设置用户身份之前销毁登录页面视频
        self.DiyCommon.DisposeVideoLogin();
        self.$store.commit("DiyStore/SetCurrentUser", self.LoginResult.Data);
        // 然后调用桌面视频
        self.$nextTick(function () {
          self.DiyCommon.LoadVideoDesktop();
        });

        // 用户手动登录
        localStorage.setItem("Microi.DemoSelfLogout", "0");
      } catch (error) {}
      if (self.SystemStyle == "WebOS") {
        self.$router.push({
          path: "/os"
        });
      } else {
        var url = "/";
        //这里需要跳转到sys_menu的第一个路由
        //2022-07-05新增：以系统设置的默认首页路由为优先
        if (self.SysConfig && self.SysConfig.DefaultIndexUrl) {
          url = self.SysConfig.DefaultIndexUrl;
          url = url.replace("$V8.CurrentToken$", self.DiyCommon.getToken());
          if (url.startsWith("/iframe/")) {
            url = "/iframe/" + encodeURIComponent(url.replace("/iframe/", ""));
          } else if (url.startsWith("http")) {
            window.location.href = url;
            return;
          }
        } else if (self.LoginResult.DataAppend && self.LoginResult.DataAppend.SysMenuHomePage && self.LoginResult.DataAppend.SysMenuHomePage.Url) {
          url = self.LoginResult.DataAppend.SysMenuHomePage.Url;
        }
        self.$router.push({
          path: self.DiyCommon.IsNull(self.redirect) || self.redirect == "/" ? url : self.redirect,
          query: self.otherQuery
        });
      }
    }
  }
};
</script>

<style lang="scss">
.captcha-result {
  height: 36px;
  width: 60px;
  line-height: 36px;
  color: #000;
  background: #fff;
  padding-left: 5px;
  padding-right: 5px;
  font-size: 12px;
  text-align: center;
}
.imgSystemPreview {
  width: 370px;
  display: block;
  margin-bottom: 15px;
}

.imgSystemPreview.active {
  box-shadow: rgba(0, 0, 0, 0.1) 4px 4px 40px;
  border: solid 2px #fff;
}

#divLogin .bottomTips p {
  margin-bottom: 15px;
  display: block;
  padding-left: 10px;
  padding-right: 10px;
}

#divLogin .bottomTips a {
  color: #fff;
}

#divLogin {
  font-size: 12px;
  position: fixed;
  background-color: var(--taskbar-color);
  /*bg*/
  width: 100%;
  height: 100%;
  z-index: 99;
  color: #fff;
  text-align: center;
  left: 0;
  /* top: -100%; */
  top: 0;
  transition: 0.7s;
  -moz-transition: 0.7s;
  -webkit-transition: 0.7s;
  -o-transition: 0.7s;
  overflow: hidden;
  display: block !important;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;

  .login-title {
    margin-bottom: 15px;
    font-size: 26px;
    font-weight: bold;
  }

  .divLoginCenter {
    width: 375px;
    max-width: 100%;
    padding: 30px;
    position: absolute;
    top: 50%;
    left: 50%;
    margin-left: -187.5px;
    transition: 0.7s;

    .form-control {
      background-color: #fff;
      border: 1px solid #c2cad8;
      box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.075);
      padding: 2px 8px;
      border-radius: 2px;
    }

    .input-group .form-control:last-child {
      border-bottom-left-radius: 0;
      border-top-left-radius: 0;
    }

    .input-group .form-control:not(:first-child):not(:last-child) {
      border-radius: 0;
    }
  }

  @media (min-width: 1365px) {
    .divLoginCenter {
      width: 500px;
      // height: 500px;
      padding-top: 50px;
      padding-left: 50px;
      padding-right: 50px;
      position: absolute;
      top: 50%;
      left: 50%;
      margin-left: -250px;
    }

    // .loginCenterBgCover {
    //     border-radius: 50%;
    // }
  }
}

.loginCenterBgCover {
  width: 100%;
  height: 100%;
  position: absolute;
  background-color: var(--bg-color);
  left: 0;
  top: 0;
  opacity: 0.5;
  z-index: -1;
  /* border-radius: 4px; */
  box-shadow: 0 0 60px 6px #000;
}

#divLogin .divLoginTime {
  position: absolute;
  width: 100%;
  height: 100%;
  transition: 0.7s;
  -moz-transition: 0.7s;
  -webkit-transition: 0.7s;
  -o-transition: 0.7s;
}

#divLogin .divLoginTime p {
  text-align: left;
  color: #fff;
}

#divLogin .input-group-text {
  background-color: var(--bg-color);
}

#divLogin .input-group-text.go {
  padding: 0;
}

#divLogin .input-group-text i {
  color: var(--theme-color);
}

#divLogin .divLoginTime {
  left: 5%;
  bottom: 7.5%;
}

#divLogin .divLoginTime p {
  font-size: 20px;
}

@media (max-width: 767px) {
  #divLogin .divLoginTime {
    /* left: 15px;
                bottom: 30px; */
  }

  #divLogin .divLoginTime p {
    font-size: 20px;
  }
}

@media (min-width: 768px) {
  #divLogin .divLoginTime {
    /* left: 25px;
                bottom: 50px; */
  }

  #divLogin .divLoginTime p {
    font-size: 25px;
  }
}

@media (min-width: 992px) {
  #divLogin .divLoginTime {
    /* left: 37px;
                bottom: 75px; */
  }

  #divLogin .divLoginTime p {
    font-size: 35px;
  }
}

@media (min-width: 1200px) {
  #divLogin .divLoginTime {
    /* left: 50px;
                bottom: 100px; */
  }

  #divLogin .divLoginTime p {
    font-size: 45px;
  }
}

.microi-ui-lock-aero:before,
.microi-ui-lock-aero:after {
  background-image: var(--LockBgCss);
  box-sizing: content-box;
}
</style>
