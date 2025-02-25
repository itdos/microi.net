import store from '@/store'
import { DiyCommon, DosCommon } from '@/utils/microi.net.import'
import _ from 'underscore'
var DiyOsClient = {

  /**
   * 初始化os时，首先知道是哪个osclient，才能获取到ApiBase
   * 指定osclient方式及权重：
   * 1、index.html
   * 2、url的OsClient参数
   * 3、域名对应
   * 4、DiyCommon.SetOsClient/SetApiBase【原理是localStorage和vuex】
   * @param {*} init
   */
  OsClientInit: async function (init) {
    var self = this
    //先获取ApiBase
    var apiBase = DiyOsClient.GetApiBase();
    store.commit('DiyStore/SetState', {
      key: 'ApiBase',
      value: apiBase
    })
    DiyCommon.SetApiBase(apiBase);

    //预获取OsClient
    if (DiyOsClient.GetOsClientNotDomain() == "") {
      var getOsClientByDomainResult = await DiyCommon.PostAsync('/api/Os/GetOsClientByDomain', {
        Domain: location.host.toLocaleLowerCase()
      });
      if (getOsClientByDomainResult.Code == 1 && !DiyCommon.IsNull(getOsClientByDomainResult.Data)) {
        var osClient = getOsClientByDomainResult.Data.OsClient || getOsClientByDomainResult.Data.OSCLIENT;
        DiyCommon.SetOsClient(osClient);
      }
    }



    var osClient = DiyOsClient.GetOsClient();
    store.commit('DiyStore/SetState', {
      key: 'OsClient',
      value: osClient
    })
    DiyCommon.SetOsClient(osClient);


    var href = window.location.href.toLowerCase();
    //同步从服务器中获取配置信息，一种是使用await，一种是使用 Promise、Then里面获取
    var sysConfig = null;
    var sysConfigResult = await DiyCommon.PostAsync('/api/diyTable/getSysConfig', {
      _SearchEqual: {
        IsEnable: 1
      },
      OsClient: osClient
    });
    if (sysConfigResult.Code == 1) {
      sysConfig = sysConfigResult.Data;
      if (DiyCommon.IsNull(sysConfig)) {
        DiyCommon.Tips('获取系统设置信息为空！', false);
      } else {
        store.commit('DiyStore/SetSysConfig', sysConfig);
      }
    } else {
      DiyCommon.Tips('获取系统设置信息失败：' + sysConfigResult.Msg, false);
    }



    //-----------------end
    if (!DiyCommon.IsNull(sysConfig)) {
      store.commit('DiyStore/SetSysConfig', sysConfig)
      //设置cdn相关
      if (!DiyCommon.IsNull(sysConfig.FileServer)) {
        var fileServer = sysConfig.FileServer;
        //2023-10-31新增：FileServer以环境变量优先
        try {
          if (FileServer) {
            fileServer = FileServer;
          }
        } catch (error) { }
        store.commit('DiyStore/SetState', {
          key: 'FileServer',
          value: fileServer
        })
      } else {
        var fileServer = DiyOsClient.GetFileServer(osClient);
        store.commit('DiyStore/SetState', {
          key: 'FileServer',
          value: fileServer
        })
      }
      if (!DiyCommon.IsNull(sysConfig.MediaServer)) {
        store.commit('DiyStore/SetState', {
          key: 'MediaServer',
          value: sysConfig.MediaServer
        })
      } else {
        var mediaServer = DiyOsClient.GetMediaServer(osClient);
        store.commit('DiyStore/SetState', {
          key: 'MediaServer',
          value: mediaServer
        })
      }

      // 取背景
      var desktopBg = localStorage.DesktopBg
      if (!DiyCommon.IsNull(desktopBg)) {
        try {
          desktopBg = JSON.parse(desktopBg)
          if (!DiyCommon.IsNull(desktopBg.BgVersion) &&
            !DiyCommon.IsNull(desktopBg.BgVersion[osClient]) &&
            !DiyCommon.IsNull(desktopBg.OsClient) &&
            desktopBg.OsClient == osClient &&
            desktopBg.BgVersion[osClient] >= store.state.DiyStore.DesktopBg.BgVersion[osClient]) {
            store.dispatch('DiyStore/SetDesktopBg', desktopBg)
            // 设置主题色
            if (!DiyCommon.IsNull(desktopBg.Color)) {
              DiyCommon.SetThemeColor(desktopBg.Color)
            }
          } else {
            init = true
          }
        } catch (error) {
          init = true
          console.log(error)
        }
      } else {
        init = true
      }

      if (DiyCommon.IsNull(localStorage.lang)) {
        DiyCommon.ChangeLang(DiyCommon.IsNull(sysConfig.SysLang) ? 'zh-CN' : sysConfig.SysLang, true)
      } else {
        DiyCommon.ChangeLang(localStorage.lang, true)
      }
      DiyCommon.SetWebTitle(DiyCommon.IsNull(sysConfig.SysTitle) ? 'Loading...' : sysConfig.SysTitle)
      DiyCommon.SetShortTitle(DiyCommon.IsNull(sysConfig.SysShortTitle) ? 'Loading...' : sysConfig.SysShortTitle)
      DiyCommon.SetClientCompany(DiyCommon.IsNull(sysConfig.CompanyName) ? 'Loading...' : sysConfig.CompanyName)
      if (!DiyCommon.IsNull(sysConfig.FaviconIco)) {
        var link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = DiyCommon.GetServerPath(sysConfig.FaviconIco);
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      store.commit('DiyStore/SetState', {
        key: 'EnableEnEdit',
        value: true
      })

      if (DiyCommon.IsNull(store.state.DiyStore.DesktopBg.ImgUrl) || init === true) {
        store.dispatch('DiyStore/SetDesktopBg', {
          ImgUrl: DiyCommon.GetServerPath('/static/img/wallpaper/img14.jpg'),
          ImgAero: false,
          VideoUrl: '',
          VideoVoice: store.state.DiyStore.DesktopBg.VideoVoice,

          LockImgUrl: DiyCommon.GetServerPath(DiyCommon.IsNull(sysConfig.LoginBgImg)
            ? './static/img/wallpaper/aijuhome-1.jpg' : sysConfig.LoginBgImg),
          LockImgAero: false,
          LockVideoUrl: '',
          LockVideoVoice: store.state.DiyStore.DesktopBg.LockVideoVoice,

          OsClient: osClient,
          Color: '13'
        })
        DiyCommon.SetThemeColor('13')
      }
    }
  },
  GetApiBase: function () {
    //如果index.html指定了ApiBase，这个权力最大
    if (!DiyCommon.IsNull(ApiBase)) {
      return ApiBase;
    }
    var href = window.location.href.toLocaleLowerCase()

    if (href.indexOf('localhost') > -1 || href.indexOf('127.0.0.1') > -1) {
      try {
        //如果是苹果电脑
        if (navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
          // return 'https://api.jifulii.com';
          // return 'https://localhost:7268';
          // return 'https://api.nbweixin.cn'
          return 'https://api.itdos.com'//用于发布到开源gitee
        } else {//如果是非苹果电脑
          return 'https://api.itdos.com'//用于发布到开源gitee
          return 'https://api.nbweixin.cn'
        }
      } catch (error) {
        return 'https://api.itdos.com'
      }
      //return 'https://api-china.itdos.com'
      //return 'https://localhost:7266';
    }

    if (!DiyCommon.IsNull(localStorage.getItem('DiyApiBase'))) {
      return localStorage.getItem('DiyApiBase');
    }
    return 'https://api-china.itdos.com'
  },

  GetOsClient: function () {
    var self = this
    var osClient = DiyOsClient.GetOsClientNotDomain();
    if (osClient == "") {
      return 'iTdos'
    }

    return osClient;

    // 根据域名判断是哪个客户，只会在一套os程序为N个客户提供服务时才会执行以下代码
    // 后来还是通过默认的ApiBase从SysOsClient中获取
    // var domainOsClient = _.find(this.DomainOsClients, function(item){
    //     if (href.indexOf(item.Domain) > -1) {
    //         return true;
    //     }
    //     return false;
    // });
    // if (domainOsClient) {
    //     return domainOsClient.OsClient;
    // }else{
    //     return 'iTdos'
    // }
  },
  GetOsClientNotDomain: function () {
    var self = this
    //如果Index.html指定了OsClient，这个权力最大
    //一般单独部署的客户，都是以Index.html为准，但iTdos官方是一套程序支持N个客户，不是以index.html为准，而是以域名为准
    if (!DiyCommon.IsNull(OsClient)) {
      return OsClient;
    }
    var href = window.location.href.toLowerCase()
    var reg190317 = new RegExp('(^|&)' + 'OsClient' + '=([^&]*)(&|$)')
    var r190317 = window.location.search.substr(1).match(reg190317)
    var osClient = r190317 != null ? r190317[2] : null;
    //2020-04-02 ?OsClient=xxx优先，本地调试用
    if (osClient) {
      return osClient;
    }
    if (!DiyCommon.IsNull(localStorage.getItem('OsClient'))) {
      return localStorage.getItem('OsClient');
    }
    return ''
  },
  //此函数其实不再使用，FileServer都是通过系统设置里面的FileServer获取了。 --2022-06-09
  GetFileServer: function (osClient) {
    try {
      if (FileServer) {
        return FileServer;
      }
    } catch (error) {

    }
    return 'https://static-ali-img.itdos.com'
  },
  //此函数其实不再使用，MediaServer都是通过系统设置里面的MediaServer获取了。 --2022-06-09
  GetMediaServer: function (osClient) {
    return 'https://static-ali-media.itdos.com'
  },
  /**
   * 此配仅在使用一套os程序为N个客户提供支持时用到，根据域名来识别是哪个osclient
   * 但后来考虑到新增一个就得发布的问题，此属性不再使用，改为直接从默认的ApiBase中获取SysOsClient
   */
  //  DomainOsClients:[
  //     { Domain : "os.itdos.com" ,  OsClient : 'iTdos' },
  //     { Domain : "ybt." ,  OsClient : 'ybt' },
  //     { Domain : "yiniao." ,  OsClient : 'yiniao' },
  //     { Domain : "carconnect." ,  OsClient : 'carconnect' },
  //     { Domain : "nullstyle." ,  OsClient : 'nullstyle' },
  //     { Domain : "garment." ,  OsClient : 'garment' },
  //     { Domain : "tdx." ,  OsClient : 'Tdx' },
  //     { Domain : "tzyos." ,  OsClient : 'Tzy' },
  //     { Domain : "nbgysh." ,  OsClient : 'Nbgysh' },
  //     { Domain : "toutgate." ,  OsClient : 'ToutGate' },
  //     { Domain : "kkl." ,  OsClient : 'LBERP' },
  //     { Domain : "qkl." ,  OsClient : 'LBERP' },
  //     { Domain : "rk." ,  OsClient : 'LkmwHR' },
  //     { Domain : "demo." ,  OsClient : 'Demo' },
  //     { Domain : "kt.itdos" ,  OsClient : 'KaiTong' },
  //     { Domain : "cargoee" ,  OsClient : 'KaiTong' },
  //     { Domain : "iplan." ,  OsClient : 'iPlan' },
  //     { Domain : "elites." ,  OsClient : 'iPlan' },
  //     { Domain : "haiou." ,  OsClient : 'Haiou' },
  //     { Domain : "chinaseagull." ,  OsClient : 'Haiou' },
  //     { Domain : "springtex." ,  OsClient : 'Springtex' },
  //     { Domain : "zxelectric." ,  OsClient : 'ThinkHome' },
  //     { Domain : "thinkhome." ,  OsClient : 'ThinkHome' },
  //     { Domain : "jianing." ,  OsClient : 'jianing' },
  //     { Domain : "qianhe." ,  OsClient : 'qianhe' },
  //     { Domain : "jishu." ,  OsClient : 'jishu' },
  //     { Domain : "zxhuman." ,  OsClient : 'zxhuman' },
  //     { Domain : "dahong." ,  OsClient : 'dahong' },
  //     { Domain : "baiding." ,  OsClient : 'baiding' },
  //     { Domain : "dongchuang." ,  OsClient : 'dongchuang' },
  //     { Domain : "yibuyunsu." ,  OsClient : 'yyibuyunsubt' },
  //     { Domain : "hyj." ,  OsClient : 'hyj' },
  //     { Domain : "tongxin." ,  OsClient : 'tongxin' },
  //     { Domain : "cqs." ,  OsClient : 'cqs' },
  //     { Domain : "roadmore." ,  OsClient : 'roadmore' },
  //     { Domain : "smartfarm." ,  OsClient : 'smartfarm' },
  //     { Domain : "lxl." ,  OsClient : 'lxl' },
  //     { Domain : "shopdiy." ,  OsClient : 'shopdiy' },
  //     { Domain : "parking." ,  OsClient : 'parking' },
  //     { Domain : "blcewen." ,  OsClient : 'blcewen' },
  //     { Domain : "lilong." ,  OsClient : 'lilong' },
  //     { Domain : "yzjiang." ,  OsClient : 'yzjiang' },
  //     { Domain : "wy." ,  OsClient : 'wy' },
  //     { Domain : "lq." ,  OsClient : 'lq' },
  //     { Domain : "wlwxh." ,  OsClient : 'wlwxh' },
  //     { Domain : "ndxyh." ,  OsClient : 'ndxyh' },
  //     { Domain : "songling." ,  OsClient : 'ysonglingbt' },
  //     { Domain : "yongchang." ,  OsClient : 'yongchang' },
  //     { Domain : "hr." ,  OsClient : 'hr' },
  //     { Domain : "crm." ,  OsClient : 'crm' },
  //     { Domain : "ybt." ,  OsClient : 'ybt' },
  // ],
}
export {
  DiyOsClient
}
