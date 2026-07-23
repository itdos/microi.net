module.exports = {
  id: 'standard',
  tenantModule: 'standard',
  label: 'Microi 标准版',
  config: {
    profileId: 'standard',
    tenantKey: 'standard',
    osClient: 'iTdos',
    apiBase: 'https://api.itdos.com',
    fileServer: 'https://static.itdos.com',
    appName: 'Microi',
    platformName: 'Microi 移动工作台',
    servicePlatformName: 'Microi 服务平台',
    poweredBy: 'Microi',
    versionName: '2.0.0',
    appSubTitle: 'AI低代码移动工作台',
    workspaceSubTitle: '业务与服务工作台',
    guestWelcomeText: '欢迎使用移动工作台',
    promiseTitle: '配置即应用，业务随时在线',
    promiseText: '列表、表单、权限与服务能力由 Microi 平台配置动态驱动',
    inviteTitle: '邀请加入平台',
    aiAssistantName: 'Microi · AI助手',
    shareTitles: {
      platform: 'Microi 移动工作台｜业务与服务协同',
      business: 'Microi 移动工作台｜业务协同中心',
      service: 'Microi 移动工作台｜专业服务保障',
      mall: '移动商城｜品质服务解决方案',
      news: '平台资讯｜洞察行业新动态',
      invite: '加入移动工作台｜连接业务与专业服务',
      merchantInvite: '加入平台｜共创服务新价值',
      insiderInvite: '加入移动工作台｜开启高效协作'
    },
    logoUrl: '/static/microi-blue-256.png',
    cdnAssets: {
      waterHero: '',
      waterMotion: '',
      productPlaceholder: '',
      scan: '/static/microi-blue-256.png',
      logo: '/static/microi-blue-256.png',
      share: {}
    },
    features: {
      ai: true,
      business: false,
      businessCatalog: true,
      dynamicModules: true,
      dynamicForm: true,
      invitations: false,
      mall: false,
      messages: true,
      news: false,
      scan: false,
      serviceTasks: false
    },
    routes: {
      catalog: '/pages/module/catalog',
      login: '/pages/login/index',
      messages: '/pages/message/index',
      password: '/pages/native/password',
      profile: '/pages/profile/index',
      reminders: '/pages/native/reminders',
      workspace: '/pages/workspace/index'
    },
    theme: {
      primary: '#087DA8',
      primaryLight: '#18A6B8',
      primaryDark: '#063B5C',
      brand: '#E54625'
    },
    wxLoginApi: '/apiengine/wx-miniprogram-login-reg-bind',
    platformLoginApis: {
      weixin: '/apiengine/wx-miniprogram-login-reg-bind',
      alipay: '/apiengine/alipay-miniprogram-login-reg-bind',
      toutiao: '/apiengine/tt-miniprogram-login-reg-bind',
      lark: '/apiengine/lark-miniprogram-login-reg-bind',
      xhs: '/apiengine/xhs-miniprogram-login-reg-bind'
    },
    enablePrivacyPolicy: true,
    privacyPolicyName: '用户隐私保护协议',
    publicKey: ''
  }
}
