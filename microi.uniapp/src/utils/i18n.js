/**
 * 多语言模块 (i18n) — 中文 / English
 * 用法：
 *   import { t, setLang, getLang } from '@/utils/i18n.js'
 *   t('common.confirm')  // => '确定' or 'OK'
 */

const STORAGE_KEY = 'microi_language'

let _lang = 'zh-CN'
try { _lang = uni.getStorageSync(STORAGE_KEY) || 'zh-CN' } catch (e) {}

export function getLang() { return _lang }
export function setLang(lang) {
  _lang = lang
  try { uni.setStorageSync(STORAGE_KEY, lang) } catch (e) {}
}

// ─── 翻译字典 ───
const messages = {
  'zh-CN': {
    // ── 通用 ──
    common: {
      confirm: '确定',
      cancel: '取消',
      back: '返回',
      loading: '加载中...',
      loadingDot: '加载中...',
      noMore: '— 已经到底了 —',
      retry: '重试',
      send: '发送',
      reset: '重置',
      search: '搜索',
      all: '全部',
      tip: '提示',
      networkError: '网络错误',
      networkException: '网络异常，请稍后再试',
      operationFailed: '操作失败',
      poweredBy: 'Powered by',
      loginFirst: '请先登录',
      loginNow: '立即登录',
      notLoggedIn: '未登录',
      clickToLogin: '点击登录 →',
      account: '账号',
      user: '用户',
      noData: '暂无数据',
      justNow: '刚刚',
      minuteAgo: '分钟前',
      yesterday: '昨天',
      daysAgo: '天前',
      today: '今天',
      month: '月',
      day: '日',
      views: '次浏览',
      end: '— END —',
      piece: '张',
    },

    // ── 登录页 ──
    login: {
      authLogin: '小程序授权登录',
      accountLogin: '账号密码登录',
      enterAccount: '请输入账号',
      enterPassword: '请输入密码',
      enterCaptcha: '请输入验证码',
      gettingCaptcha: '获取中...',
      loginBtn: '登 录',
      agreePre: '我已阅读并同意',
      privacyPolicy: '《隐私政策》',
      authLoginFailed: '授权登录失败',
      authNotSupported: '当前平台不支持授权登录',
      pleaseUseAccount: '请使用账号密码登录',
      loginFailed: '登录失败，请稍后再试',
      unboundAuth: '该账号尚未绑定，请使用账号密码登录',
      encryptionFailed: '密码加密失败',
      loginFailedMsg: '登录失败',
      pleaseAgree: '请先阅读并同意',
      welcomeBack: '欢迎回来',
      // 兼容旧key
      wechatLogin: '小程序授权登录',
      wechatLoginFailed: '授权登录失败',
      unboundWechat: '该账号尚未绑定，请使用账号密码登录',
    },

    // ── 商城 ──
    mall: {
      searchPlaceholder: '搜索商品名称、型号、供应商',
      noProductName: '未命名商品',
      lease: '租赁',
      filter: '滤芯',
      purchase: '买断',
      noProducts: '暂无商品',
      tryOther: '换个分类或条件试试',
      advancedFilter: '高级筛选',
      productType: '商品类型',
      priceRange: '价格区间（元）',
      minPrice: '最低价',
      maxPrice: '最高价',
      confirmFilter: '确认筛选',
      // detail
      productDetail: '商品详情',
      noImage: '暂无图片',
      purchasePrice: '买断价格',
      replaceFilter: '更换滤芯',
      yuanPerUnit: '元/台',
      yuanPerPiece: '元/支',
      yuanPerYear: '元/年',
      leasable: '可租赁',
      leasePrice: '租赁价格',
      yuanPerUnitYear: '元/台/年',
      model: '型号',
      category: '分类',
      supplyInfo: '供应信息',
      merchant: '商家',
      supplier: '供应商',
      productParams: '商品参数',
      caseImages: '案例图片',
      noProductDetail: '暂无商品详情',
      noCaseImages: '暂无案例图片',
      share: '分享',
      favorited: '已收藏',
      favorite: '收藏',
      bookNow: '立即预约',
      bookProduct: '预约商品',
      quantity: '数量',
      name: '姓名',
      phone: '手机号',
      enterName: '请输入姓名',
      enterPhone: '请输入手机号码',
      confirmBook: '确认预约',
      loadFailed: '加载失败',
      shareHint: '请点击右上角 ··· 分享',
      unfavorited: '已取消收藏',
      enterCorrectPhone: '请输入正确的手机号',
      bookSuccess: '预约成功',
      bookFailed: '预约失败',
    },

    // ── 资讯 ──
    news: {
      title: '资讯',
      subtitle: '了解行业最新动态',
      noNews: '暂无资讯',
      checkLater: '稍后再来看看吧',
      newsDetail: '资讯详情',
      articleNotFound: '文章不存在或已删除',
      backToList: '返回列表',
    },

    // ── 工作台 ──
    workspace: {
      title: '工作台',
      loginHint: '登录后即可使用工作台功能',
      noMenu: '暂无工作台菜单',
      contactAdmin: '请联系管理员配置权限',
      menu: '菜单',
      subMenu: '子菜单',
    },

    // ── 消息 ──
    message: {
      title: '消息',
      contacts: '通讯录',
      loginHint: '登录后即可使用消息功能',
      searchMsg: '搜索消息',
      searchContact: '搜索联系人',
      noMessages: '暂无消息',
      startChat: '发起聊天',
      noContacts: '暂无联系人',
      selectContact: '选择联系人',
      aiAssistant: 'AI助手',
      aiGreeting: '我是您的AI助手，有什么可以帮您？',
      system: '系统',
      // chat
      chat: '聊天',
      inputMsg: '输入消息...',
      image: '图片',
      camera: '拍摄',
      file: '文件',
      location: '位置',
      chatInfo: '聊天信息',
      muteNotification: '消息免打扰',
      pinChat: '置顶聊天',
      clearHistory: '清空聊天记录',
      me: '我',
      reconnecting: '连接已断开，正在重连...',
      sendFailed: '发送失败',
      featureDev: '功能开发中',
      clearHistoryConfirm: '确定要清空聊天记录吗？',
    },

    // ── 我的 ──
    profile: {
      themeSwitch: '主题切换',
      langSwitch: '语言切换',
      aboutSystem: '关于系统',
      privacyPolicy: '隐私政策',
      changePassword: '修改密码',
      logout: '退出登录',
      selectTheme: '选择主题',
      selectLang: '选择语言',
      oldPassword: '原密码',
      newPassword: '新密码',
      confirmPassword: '确认密码',
      enterOldPwd: '请输入原密码',
      enterNewPwd: '请输入新密码（至少6位）',
      enterConfirmPwd: '请再次输入新密码',
      themeSwitched: '主题已切换',
      langSwitched: '已切换为中文',
      pwdMinLength: '新密码至少6位',
      pwdNotMatch: '两次密码不一致',
      pwdChanged: '密码修改成功',
      changeFailed: '修改失败',
      logoutConfirm: '确定要退出登录吗？',
      loggedOut: '已退出登录',
      // theme colors
      blue: '蓝色', skyBlue: '天蓝', orange: '橙色', red: '红色',
      green: '绿色', purple: '紫色', pink: '粉色', cyan: '青色',
      indigo: '靛蓝', deepOrange: '深橙', blueGrey: '灰蓝', black: '黑色',
    },

    // ── WebView ──
    webview: {
      loading: '正在加载...',
      notExist: '不存在',
      noToken: '无 Token，返回工作台页面',
      loadError: '加载提示',
      loadErrorMsg: 'WebView 页面加载异常，请重试或返回首页',
      backHome: '返回首页',
      logoutConfirm: '确定要退出登录吗？',
    },

    // ── 关于 ──
    about: {
      version: '版本',
      privacy: '隐私政策',
      desc: '是一款企业级应用，提供高效便捷的移动办公体验。',
    },

    // ── 隐私政策 ──
    privacy: {
      title: '隐私政策',
      intro: '引言',
      introText: '欢迎使用{appName}小程序（以下简称"本小程序"）。我们非常重视您的隐私保护和个人信息安全。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。请您仔细阅读本政策，如您不同意本政策的内容，请停止使用本小程序。',
      infoCollect: '一、信息收集',
      infoCollectItem1: '1. 账号信息：当您使用账号密码登录时，我们会收集您输入的账号和密码信息，密码采用RSA加密传输，我们不会以明文形式存储您的密码。',
      infoCollectItem2: '2. 微信授权信息：当您选择微信授权登录时，我们会获取您的微信OpenID，用于识别您的身份。我们不会获取您的微信昵称、头像等其他信息，除非获得您的明确授权。',
      infoCollectItem3: '3. 设备信息：我们可能会收集您的设备型号、操作系统版本等基础设备信息，用于优化服务体验。',
      infoUse: '二、信息使用',
      infoUseDesc: '我们收集的信息将用于以下目的：',
      infoUseItem1: '1. 提供用户身份验证和登录服务',
      infoUseItem2: '2. 维护和改进我们的服务质量',
      infoUseItem3: '3. 保障账号和系统安全',
      infoUseItem4: '4. 遵守适用法律法规的要求',
      infoStorage: '三、信息存储与保护',
      infoStorageItem1: '1. 您的登录凭证（Token）将存储在小程序本地存储中，用于保持登录状态。',
      infoStorageItem2: '2. 我们采用行业标准的安全技术措施保护您的个人信息，防止未经授权的访问、使用或泄露。',
      infoStorageItem3: '3. 密码采用RSA非对称加密传输，确保传输安全。',
      infoShare: '四、信息共享',
      infoShareDesc: '我们不会将您的个人信息出售、交换或出租给任何第三方，除非：',
      infoShareItem1: '1. 获得您的明确同意',
      infoShareItem2: '2. 法律法规要求或政府部门依法要求',
      infoShareItem3: '3. 维护公共利益所必要',
      yourRights: '五、您的权利',
      yourRightsItem1: '1. 您有权访问和修改您的个人信息',
      yourRightsItem2: '2. 您有权删除您的个人信息（退出登录即清除本地数据）',
      yourRightsItem3: '3. 您有权拒绝提供某些非必要的个人信息',
      minorProtection: '六、未成年人保护',
      minorProtectionDesc: '本小程序主要面向企业用户使用。如果您是未满18周岁的未成年人，请在监护人指导下使用本小程序。',
      policyUpdate: '七、政策更新',
      policyUpdateDesc: '我们可能会不时更新本隐私政策。更新后的政策将在小程序内公布，请您定期查阅。',
      contactUs: '八、联系我们',
      contactUsDesc: '如您对本隐私政策有任何疑问或建议，请通过小程序内的联系方式与我们取得联系。',
      lastUpdate: '最后更新日期：2026年2月23日',
    },
  },

  'en': {
    common: {
      confirm: 'OK',
      cancel: 'Cancel',
      back: 'Back',
      loading: 'Loading...',
      loadingDot: 'Loading...',
      noMore: '— No more data —',
      retry: 'Retry',
      send: 'Send',
      reset: 'Reset',
      search: 'Search',
      all: 'All',
      tip: 'Notice',
      networkError: 'Network error',
      networkException: 'Network error, please try again later',
      operationFailed: 'Operation failed',
      poweredBy: 'Powered by',
      loginFirst: 'Please login first',
      loginNow: 'Login Now',
      notLoggedIn: 'Not logged in',
      clickToLogin: 'Tap to login →',
      account: 'Account',
      user: 'User',
      noData: 'No data',
      justNow: 'Just now',
      minuteAgo: ' min ago',
      yesterday: 'Yesterday',
      daysAgo: ' days ago',
      today: 'Today',
      month: '/',
      day: '',
      views: ' views',
      end: '— END —',
      piece: '',
    },

    login: {
      authLogin: 'Authorize Login',
      accountLogin: 'Account Login',
      enterAccount: 'Enter account',
      enterPassword: 'Enter password',
      enterCaptcha: 'Enter captcha',
      gettingCaptcha: 'Loading...',
      loginBtn: 'Login',
      agreePre: 'I have read and agree to the ',
      privacyPolicy: 'Privacy Policy',
      authLoginFailed: 'Authorization login failed',
      authNotSupported: 'Auth login not supported on this platform',
      pleaseUseAccount: 'Please use account & password to login',
      loginFailed: 'Login failed, please try again',
      unboundAuth: 'Account not bound, please use account & password',
      encryptionFailed: 'Password encryption failed',
      loginFailedMsg: 'Login failed',
      pleaseAgree: 'Please read and agree to the',
      welcomeBack: 'Welcome back',
      // backward-compatible keys
      wechatLogin: 'Authorize Login',
      wechatLoginFailed: 'Authorization login failed',
      unboundWechat: 'Account not bound, please use account & password',
    },

    mall: {
      searchPlaceholder: 'Search product name, model, supplier',
      noProductName: 'Unnamed product',
      lease: 'Lease',
      filter: 'Filter',
      purchase: 'Purchase',
      noProducts: 'No products',
      tryOther: 'Try another category or filter',
      advancedFilter: 'Advanced Filter',
      productType: 'Product Type',
      priceRange: 'Price Range',
      minPrice: 'Min',
      maxPrice: 'Max',
      confirmFilter: 'Apply Filter',
      productDetail: 'Product Detail',
      noImage: 'No image',
      purchasePrice: 'Purchase Price',
      replaceFilter: 'Replace Filter',
      yuanPerUnit: '/unit',
      yuanPerPiece: '/pc',
      yuanPerYear: '/year',
      leasable: 'Leasable',
      leasePrice: 'Lease Price',
      yuanPerUnitYear: '/unit/year',
      model: 'Model',
      category: 'Category',
      supplyInfo: 'Supply Info',
      merchant: 'Merchant',
      supplier: 'Supplier',
      productParams: 'Product Specs',
      caseImages: 'Case Images',
      noProductDetail: 'No product detail',
      noCaseImages: 'No case images',
      share: 'Share',
      favorited: 'Saved',
      favorite: 'Save',
      bookNow: 'Book Now',
      bookProduct: 'Book Product',
      quantity: 'Qty',
      name: 'Name',
      phone: 'Phone',
      enterName: 'Enter name',
      enterPhone: 'Enter phone number',
      confirmBook: 'Confirm Booking',
      loadFailed: 'Load failed',
      shareHint: 'Tap ··· at top right to share',
      unfavorited: 'Removed from favorites',
      enterCorrectPhone: 'Enter valid phone number',
      bookSuccess: 'Booked successfully',
      bookFailed: 'Booking failed',
    },

    news: {
      title: 'News',
      subtitle: 'Stay updated with industry trends',
      noNews: 'No news yet',
      checkLater: 'Check back later',
      newsDetail: 'News Detail',
      articleNotFound: 'Article not found or deleted',
      backToList: 'Back to List',
    },

    workspace: {
      title: 'Workspace',
      loginHint: 'Login to access workspace features',
      noMenu: 'No workspace menus',
      contactAdmin: 'Please contact administrator',
      menu: 'Menu',
      subMenu: 'Sub Menu',
    },

    message: {
      title: 'Messages',
      contacts: 'Contacts',
      loginHint: 'Login to use messaging',
      searchMsg: 'Search messages',
      searchContact: 'Search contacts',
      noMessages: 'No messages',
      startChat: 'Start Chat',
      noContacts: 'No contacts',
      selectContact: 'Select Contact',
      aiAssistant: 'AI Assistant',
      aiGreeting: "I'm your AI assistant, how can I help?",
      system: 'System',
      chat: 'Chat',
      inputMsg: 'Type a message...',
      image: 'Photo',
      camera: 'Camera',
      file: 'File',
      location: 'Location',
      chatInfo: 'Chat Info',
      muteNotification: 'Mute',
      pinChat: 'Pin Chat',
      clearHistory: 'Clear History',
      me: 'Me',
      reconnecting: 'Disconnected, reconnecting...',
      sendFailed: 'Send failed',
      featureDev: 'Feature in development',
      clearHistoryConfirm: 'Clear all chat history?',
    },

    profile: {
      themeSwitch: 'Theme',
      langSwitch: 'Language',
      aboutSystem: 'About',
      privacyPolicy: 'Privacy Policy',
      changePassword: 'Change Password',
      logout: 'Logout',
      selectTheme: 'Select Theme',
      selectLang: 'Select Language',
      oldPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      enterOldPwd: 'Enter current password',
      enterNewPwd: 'Enter new password (min 6 chars)',
      enterConfirmPwd: 'Re-enter new password',
      themeSwitched: 'Theme changed',
      langSwitched: 'Switched to English',
      pwdMinLength: 'Password must be at least 6 characters',
      pwdNotMatch: 'Passwords do not match',
      pwdChanged: 'Password changed successfully',
      changeFailed: 'Change failed',
      logoutConfirm: 'Confirm logout?',
      loggedOut: 'Logged out',
      blue: 'Blue', skyBlue: 'Sky Blue', orange: 'Orange', red: 'Red',
      green: 'Green', purple: 'Purple', pink: 'Pink', cyan: 'Cyan',
      indigo: 'Indigo', deepOrange: 'Deep Orange', blueGrey: 'Blue Grey', black: 'Black',
    },

    webview: {
      loading: 'Loading...',
      notExist: 'Not found',
      noToken: 'No token, returning to workspace',
      loadError: 'Load Error',
      loadErrorMsg: 'Page failed to load. Please retry or go back.',
      backHome: 'Go Home',
      logoutConfirm: 'Confirm logout?',
    },

    about: {
      version: 'Version',
      privacy: 'Privacy Policy',
      desc: 'is an enterprise application providing efficient mobile office experience.',
    },

    privacy: {
      title: 'Privacy Policy',
      intro: 'Introduction',
      introText: 'Welcome to {appName} Mini Program (hereinafter referred to as "this Mini Program"). We highly value your privacy and personal information security. This privacy policy explains how we collect, use, store and protect your personal information. Please read this policy carefully. If you disagree with the content, please stop using this Mini Program.',
      infoCollect: '1. Information Collection',
      infoCollectItem1: '1. Account Information: When you use account and password login, we collect the account and password you enter. Passwords are transmitted with RSA encryption and are never stored in plaintext.',
      infoCollectItem2: '2. WeChat Authorization: When you choose WeChat login, we obtain your WeChat OpenID to identify your identity. We do not obtain your WeChat nickname, avatar or other information unless explicitly authorized.',
      infoCollectItem3: '3. Device Information: We may collect your device model, OS version and other basic device information to optimize the service experience.',
      infoUse: '2. Information Usage',
      infoUseDesc: 'The information we collect will be used for the following purposes:',
      infoUseItem1: '1. Providing user authentication and login services',
      infoUseItem2: '2. Maintaining and improving our service quality',
      infoUseItem3: '3. Ensuring account and system security',
      infoUseItem4: '4. Complying with applicable laws and regulations',
      infoStorage: '3. Data Storage & Protection',
      infoStorageItem1: '1. Your login credentials (Token) are stored in the Mini Program\'s local storage to maintain login status.',
      infoStorageItem2: '2. We adopt industry-standard security measures to protect your personal information from unauthorized access, use or disclosure.',
      infoStorageItem3: '3. Passwords are transmitted using RSA asymmetric encryption to ensure transmission security.',
      infoShare: '4. Information Sharing',
      infoShareDesc: 'We will not sell, exchange or rent your personal information to any third party unless:',
      infoShareItem1: '1. With your explicit consent',
      infoShareItem2: '2. Required by laws, regulations or government authorities',
      infoShareItem3: '3. Necessary to protect public interest',
      yourRights: '5. Your Rights',
      yourRightsItem1: '1. You have the right to access and modify your personal information',
      yourRightsItem2: '2. You have the right to delete your personal information (logging out clears local data)',
      yourRightsItem3: '3. You have the right to refuse providing certain non-essential personal information',
      minorProtection: '6. Minor Protection',
      minorProtectionDesc: 'This Mini Program is primarily for enterprise users. If you are under 18 years old, please use this Mini Program under parental guidance.',
      policyUpdate: '7. Policy Updates',
      policyUpdateDesc: 'We may update this privacy policy from time to time. Updated policies will be published within the Mini Program. Please check periodically.',
      contactUs: '8. Contact Us',
      contactUsDesc: 'If you have any questions or suggestions about this privacy policy, please contact us through the contact information within the Mini Program.',
      lastUpdate: 'Last updated: February 23, 2026',
    },
  }
}

/**
 * 翻译函数
 * @param {string} key  点分隔路径，如 'common.confirm', 'login.enterAccount'
 * @param {object} params  插值参数，如 { appName: 'xxx' }
 * @returns {string}
 */
export function t(key, params) {
  const lang = _lang
  const dict = messages[lang] || messages['zh-CN']
  const parts = key.split('.')
  let val = dict
  for (const p of parts) {
    if (val && typeof val === 'object') val = val[p]
    else { val = undefined; break }
  }
  if (val === undefined) {
    // fallback to zh-CN
    val = messages['zh-CN']
    for (const p of parts) {
      if (val && typeof val === 'object') val = val[p]
      else { val = undefined; break }
    }
  }
  if (typeof val !== 'string') return key
  // 插值
  if (params) {
    Object.keys(params).forEach(k => {
      val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k])
    })
  }
  return val
}

export default { t, getLang, setLang }
