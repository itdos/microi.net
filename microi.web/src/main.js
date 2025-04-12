import Vue from 'vue'
Vue.prototype.Vue = Vue;

//------- microi.net
//源码或非源码开发引用
import {
  DosCommon, DiyCommon, DiyApi, DiyStore,
  DiyDesign, DiyTable, DiyForm, DiyFormDialog, DiyModule,
  DiyFormPage,
  DiyChat,
  DiyFlowDesign,
  DiyMyWork,
  DiyFlowIndex,
  DiyDesignList,
  DiyDocument,
  DiyFormWF,
  CustomFormWF,
  WFWorkHandler,
  WFHistory,
  WFDesignPreview,
  DiyAddress,
  Fontawesome
} from './utils/microi.net.import'

Vue.prototype.DosCommon = DosCommon
Vue.prototype.DiyCommon = DiyCommon;
Vue.prototype.DiyApi = DiyApi

Vue.component("DiyDesign", DiyDesign);
Vue.component("DiyTable", DiyTable);
Vue.component("DiyForm", DiyForm);
Vue.component("DiyFormDialog", DiyFormDialog);
Vue.component("DiyModule", DiyModule);
Vue.component("DiyFormPage", DiyFormPage);
Vue.component("DiyChat", DiyChat);
Vue.component("DiyFlowDesign", DiyFlowDesign);
Vue.component("DiyMyWork", DiyMyWork);
Vue.component("DiyDesignList", DiyDesignList);
Vue.component("DiyDocument", DiyDocument);
Vue.component("DiyFormWF", DiyFormWF);
Vue.component("CustomFormWF", CustomFormWF);
Vue.component("DiyFlowIndex", DiyFlowIndex);
Vue.component("WFWorkHandler", WFWorkHandler);
Vue.component("WFHistory", WFHistory);
Vue.component("WFDesignPreview", WFDesignPreview);
Vue.component("DiyAddress", DiyAddress);
Vue.component("Fontawesome", Fontawesome);

var nodeColConfig = (resolve) => require(['@/views/diy/workflow/component/node-col-config.vue'], resolve)
Vue.component('NodeColConfig', nodeColConfig);

import VueNeditorWrap from 'vue-neditor-wrap'
Vue.component("VueNeditorWrap", VueNeditorWrap);

import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
Vue.component("Editor", Editor);
Vue.component("Toolbar", Toolbar);


// import {
//     // provinceAndCityData,//是省市二级联动数据（不带“全部”选项）
//     // regionData,//是省市区三级联动数据（不带“全部”选项）
//     // provinceAndCityDataPlus,//是省市二级联动数据（带“全部”选项）
//     // regionDataPlus,//是省市区三级联动数据（带“全部”选项）
//     CodeToText,
//     // TextToCode
// } from 'element-china-area-data'

import { CodeToText, TextToCode } from 'element-china-area-data'
Vue.prototype.CodeToText = CodeToText
Vue.prototype.TextToCode = TextToCode

var LoudongTestComponent = (resolve) => require(['@/views/test/loudong'], resolve)
Vue.component('LoudongTestComponent', LoudongTestComponent);

// 仁合吃喝玩乐--注入会员提现金额组件
var MerchantWithdrawal = (resolve) => require(['@/views/custom/renhelife/MerchantWithdrawal.vue'], resolve)
Vue.component('MerchantWithdrawal', MerchantWithdrawal);

//pengrui 注册
// import DiyTree from '@/views/custom/longyuangk/diyTree/index.vue'
// Vue.component('DiyTree', DiyTree);

// 迈巴赫物性--产品信息-列表配置定制组件
var ProductInfoSetting = (resolve) => require(['@/views/custom/mbhwx/ProductInfoSetting.vue'], resolve)
Vue.component('ProductInfoSetting', ProductInfoSetting);

// 新纪源--服务记录表定制组件
var ServiceRecordCustom = (resolve) => require(['@/views/custom/xjy/ServiceRecord.vue'], resolve)
Vue.component('ServiceRecordCustom', ServiceRecordCustom);

// 通用--打开iframe制组件
var OpenIframe = (resolve) => require(['@/views/page-engine/dialogiframe.vue'], resolve)
Vue.component('OpenIframe', OpenIframe);

// var component = (resolve) => require(['@/views/test/loudong.vue'], resolve)
// Vue.component('LoudongTestComponent', component);
//------- end

import { Base64 } from 'js-base64';
Vue.prototype.Base64 = Base64;
import Cookies from 'js-cookie'

import 'normalize.css/normalize.css' // a modern alternative to CSS resets

import Element from 'element-ui'
import './styles/element-variables.scss'
import 'element-ui/lib/theme-chalk/index.css';
import '@/assets/styles/global.css'; // 引入全局样式

import '@/styles/index.scss' // global css
import '@/styles/microi.chat/fonts/iconfont.css';
import '@/styles/microi.chat/reset.scss';
import '@/styles/microi.chat/layout.scss';


import App from './App'
import store from './store'
import router from './router'

import i18n from './lang' // internationalization
import './icons' // icon
import './permission' // permission control
import './utils/error-log' // error log

import * as filters from './filters' // global filters

/**
 * If you don't want to use mock-server
 * you want to use MockJs for mock api
 * you can execute: mockXHR()
 *
 * Currently MockJs will be used in the production environment,
 * please remove it before going online ! ! !
 */
// if (process.env.NODE_ENV === 'production') {
// 	const { mockXHR } = require('../mock')
// 	mockXHR()
// }

Vue.use(Element, {
  theme: 'chalk', // 使用 chalk 主题
  size: Cookies.get('size') || 'mini', // set element-ui default size
  // i18n: (key, value) => i18n.t(key, value)
})

// register global utility filters
Object.keys(filters).forEach(key => {
  Vue.filter(key, filters[key])
})

Vue.config.productionTip = false

//by itdos

import '../public/static/css/fontawesome/css/all.min.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.min'
import "bootstrap"

import animated from 'animate.css'
Vue.use(animated)

import './views/microi/css/itdos.classic.scss'
import './styles/itdos.diy.scss'

import axios from 'axios'
Vue.prototype.$axios = axios;

import { DiyOsClient } from './utils/itdos.osclient'
Vue.prototype.DiyOsClient = DiyOsClient

import $ from 'jquery'
window.$ = window.jQuery = window.jquery = require("jquery");

Vue.prototype.$websocket = null;
import * as websocket from "@microsoft/signalr";

// import VueAMap from 'vue-amap'
// Vue.use(VueAMap)
// Vue.prototype.VueAMap = VueAMap;

// import startQiankun from '@/views/microi/microiservice/index'// 注入乾坤基座配置




// DiyCommon.SetApiBase('https://api-china.itdos.com');
// DiyCommon.SetOsClient('iTdos');

import {
  registerMicroApps,
  addGlobalUncaughtErrorHandler,
  start
} from 'qiankun'

new Vue({
  el: '#app_microi',
  router,
  store,
  i18n,
  render: h => h(App),
  computed: {
    GetCurrentUser: function () { return this.$store.getters['DiyStore/GetCurrentUser']; },
  },
  data() {
    return {
      OsVersion: 'v3.19.4',
      SignalROnCloseTimer: {},
      UnreadCount: 0,
      InitDiyWebcoketCount: 0,
    }
  },
  async created() {
    var self = this

    var systemStyle = localStorage.getItem('itdos.SystemStyle')
    if (!self.DiyCommon.IsNull(systemStyle)) {
      self.$store.commit('DiyStore/SetState', {
        key: 'SystemStyle',
        value: systemStyle
      })
      document.body.classList.add(systemStyle)
    }

    var showClassicTop = decodeURIComponent((new RegExp('[?|&|%3F]' + 'ShowClassicTop=' + '([^&;]+?)(&|#|;|$)').exec(location.href) || [, ""])[1].replace(/\+/g, '%20')) || null;
    if (!self.DiyCommon.IsNull(showClassicTop) && (showClassicTop == 'false' || showClassicTop == 0)) {
      //需要隐藏顶部
      self.$store.commit('DiyStore/SetState', {
        key: 'ShowClassicTop',
        value: 0
      });
    }

    var showClassicLeft = decodeURIComponent((new RegExp('[?|&|%3F]' + 'ShowClassicLeft=' + '([^&;]+?)(&|#|;|$)').exec(location.href) || [, ""])[1].replace(/\+/g, '%20')) || null;
    if (!self.DiyCommon.IsNull(showClassicLeft) && (showClassicLeft == 'false' || showClassicLeft == 0)) {
      //需要隐藏左侧菜单
      self.$store.commit('DiyStore/SetState', {
        key: 'ShowClassicLeft',
        value: 0
      });
    }

    var osClient = DiyCommon.GetOsClient();
    await DiyOsClient.OsClientInit(true);
  },
  mounted() {
    // console.log('-------> main.js mounted');
    var self = this
    store.commit('DiyStore/SetCurrentTime', { Data: new Date() })
    setInterval(function () {
      store.commit('DiyStore/SetCurrentTime', { Data: new Date().AddTime('s', 1) })
    }, 1000)

    self.$nextTick(function () {
      LoadRate(80)
    });
    // var timer = setInterval(() => {
    // 	self.InitDiyWebcoket(timer);
    // }, 5000);
    self.InitDiyWebcoket();
  },
  methods: {
    InitDiyWebcoket(timer) {
      var self = this;
      if (!self.DiyCommon.IsNull(self.GetCurrentUser.Id)) {// && self.InitDiyWebcoketCount <= 10
        if (self.$websocket == null ||
          (self.$websocket.connectionState != "Connected"
            && self.$websocket.connectionState != "Connecting")
        ) {
          const url = DiyCommon.GetApiBase() + `/diy-websocket?UserId=${self.GetCurrentUser.Id}&UserName=${self.GetCurrentUser.Name}&UserAvatar=${self.DiyCommon.GetServerPath(self.GetCurrentUser.Avatar)}&OsClient=${DiyCommon.GetOsClient()}`
          console.log('准备连接消息服务器...');
          // self.InitDiyWebcoketCount++;
          try {
            self.$websocket = new websocket.HubConnectionBuilder()
              .withUrl(url)
              .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: retryContext => {
                  return 5000;//2022-03-24从1000修改为5000
                }
              })
              .build();
            Vue.prototype.$websocket = self.$websocket;
            self.$websocket.serverTimeoutInMilliseconds = 1000 * 60 * 20;
            self.$websocket.keepAliveIntervalInMilliseconds = 1000 * 60 * 20;
            self.$websocket.start().then(function () {
              console.log('连接消息服务器成功！');
              // clearInterval(timer);
              // self.InitDiyWebcoketCount = 0;
            });
            self.$websocket.onclose((error) => {
              console.log('消息服务器已断开！', error);
            });
            self.$websocket.onreconnected((connectionId) => {
              console.log('消息服务器已重新连接！', connectionId);
            });
            self.$websocket.onreconnecting((error) => {
              console.log('消息服务器正在重连...', error);
            });
          } catch (error) {
            //console.log('消息服务器正在重连...', error);
            // setTimeout(() => {
            //     self.InitDiyWebcoket();//timer
            // }, 5000);
          }
        }
      } else {
        setTimeout(() => {
          self.InitDiyWebcoket();//timer
        }, 5000);
      }
    },
    OpenDiyChat(userModel) {
      var self = this;
      if (self.$websocket == null) {
        self.DiyCommon.Tips('正在连接消息服务器，请重试...', false);
        return;
      }
      self.$websocket.invoke("SendConnectToUser", {
        FromUserId: self.GetCurrentUser.Id,
        FromUserName: self.GetCurrentUser.Name,
        FromUserAvatar: self.DiyCommon.GetServerPath(self.GetCurrentUser.Avatar),
        ToUserId: userModel.Id,
        ToUserName: userModel.Name,
        ToUserAvatar: self.DiyCommon.GetServerPath(userModel.Avatar),
        OsClient: self.DiyCommon.GetOsClient()
      })
        .then(_ => {
          self.$store.commit('DiyStore/SetDiyChatCurrentLastContact', {
            ContactUserId: userModel.Id,
            ContactUserName: userModel.Name,
            ContactUserAvatar: self.DiyCommon.GetServerPath(userModel.Avatar),
            UserId: self.GetCurrentUser.Id,
            UserName: self.GetCurrentUser.Name,
            UserAvatar: self.DiyCommon.GetServerPath(self.GetCurrentUser.Avatar),
          });
          self.$store.commit('DiyStore/SetDiyChatShow', true);
        })
        .catch((err) => {
          console.error(`建立与[${userModel.Name}]的聊天失败：`, err)
          self.DiyCommon.Tips(err.toString(), false);
        });
      //获取与这个人的所有聊天记录
      self.$websocket.invoke("SendChatRecordToUser", {
        FromUserId: self.GetCurrentUser.Id,
        FromUserName: self.GetCurrentUser.Name,
        ToUserId: userModel.Id,
        ToUserName: userModel.Name,
        OsClient: self.DiyCommon.GetOsClient()
      })
        .then((res) => {
          console.log(`获取与[${userModel.Name}]的聊天记录成功！`)
        })
        .catch((err) => {
          console.error(`获取与[${userModel.Name}]的聊天记录失败：`, err)
        });
    },
  },
})
