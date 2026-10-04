module.exports = {
  id: 'microi',
  tenantModule: 'standard',
  label: 'Microi 吾码通用 App',
  config: {
    profileId: 'microi',
    tenantKey: 'standard',
    // 默认连接公开演示平台；任何客户租户都通过运行时连接配置接入。
    osClient: 'iTdos',
    apiBase: 'https://api.itdos.com',
    fileServer: 'https://static.itdos.com',
    // 接入租户的 Sys_Config 优先驱动品牌与主题；字段缺失时回退到以下吾码默认值。
    tenantBranding: true,
    appName: 'Microi吾码',
    platformName: 'Microi吾码',
    servicePlatformName: 'Microi吾码平台',
    poweredBy: 'Microi',
    pageCredit: 'Powered by Microi 吾码',
    versionName: '1.0.1',
    releaseNotes: ['推出 Microi 吾码单品牌聚合 App', '支持按 HTTPS API 与 OsClient 安全连接企业'],
    appSubTitle: '一个 App，连接企业应用',
    workspaceSubTitle: '企业业务，一触即达',
    guestWelcomeText: '欢迎使用 Microi吾码',
    promiseTitle: '一个 App，连接你的 Microi 平台',
    promiseText: '菜单、表单、权限和数据由已验证的企业租户动态驱动',
    inviteTitle: '连接企业平台',
    aiAssistantName: 'Microi AI 助手',
    shareTitles: {
      platform: 'Microi吾码｜企业应用移动工作台',
      business: 'Microi吾码｜业务协同中心',
      service: 'Microi吾码｜企业服务中心',
      mall: 'Microi吾码',
      news: 'Microi吾码',
      invite: '连接 Microi吾码',
      merchantInvite: '连接 Microi吾码',
      insiderInvite: '加入企业工作台'
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
      // App 侧开放原生 AI 入口；服务端 Sys_Config 与角色 Bootstrap 仍是最终门禁。
      ai: true,
      runtimeEndpointSwitch: true,
      // 只供 localhost/loopback 的 H5 验证，部署域名不会开放连接编辑器。
      h5LocalEndpointPreview: true,
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
      about: '/pages/about/index',
      ai: '/pages/ai/index',
      catalog: '/pages/module/catalog',
      dashboard: '/pages/dashboard/index',
      home: '/pages/home/index',
      login: '/pages/login/index',
      messages: '/pages/message/index',
      password: '/pages/native/password',
      profile: '/pages/profile/index',
      reminders: '/pages/native/reminders',
      service: '/pages/service/index',
      workspace: '/pages/workspace/index'
    },
    theme: {
      primary: '#2563EB',
      primaryLight: '#5B8CFF',
      primaryDark: '#1749B6',
      brand: '#2563EB'
    },
    wxLoginApi: '/apiengine/wx-miniprogram-login-reg-bind',
    platformLoginApis: {},
    enablePrivacyPolicy: true,
    privacyPolicyName: '隐私政策',
    publicKey: ''
  }
}
