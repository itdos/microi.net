export type ProfileLocale = 'zh-CN' | 'en-US'

const messages = {
  'zh-CN': {
    loginRegister: '登录/注册', backWebsite: '返回官网', enterBackend: '进入后台', refresh: '刷新',
    loginRequired: '请先登录', loginRequiredDesc: '登录后可以查看你的 SaaS 租户、免费创建第一个数据库，并进入后台管理系统。', goLogin: '去登录',
    overview: '个人中心', createTenant: '创建租户', aiRelay: 'AI 中转站', account: '账号信息',
    overviewDesc: '{name} 的 SaaS 工作空间、授权状态和租户入口都在这里。', currentLicense: '当前授权',
    tenantCreated: '已创建租户', freeQuota: '免费额度 {count} 个', freeCreate: '免费创建', available: '可用', used: '已使用',
    freeCreateTip: '每个账号可免费创建 1 个租户', expansionPrice: '扩容价格', expansionPriceTip: '第二个租户起 / 年',
    relayToken: 'AI 中转站 Token', tokenUsedTotal: '已用 {used} / 总量 {total}',
    saasTenants: 'SaaS 租户', tenantDesc: '每个租户都是独立低代码数据库与访问入口。默认管理员为 admin，默认密码为租户 Key，请首次登录后及时修改。',
    loadingTenants: '正在读取租户信息...', oneTenant: '1 个租户', freeQuotaDesc: '适合试用、学习和小型系统搭建。',
    expansionAmount: '¥{price} / 年 / 个', expansionDesc: '第二个租户开始计费，付费开通功能后续上线。',
    createFreeTenant: '创建免费租户', createMoreTenants: '创建更多租户', firstTenantFree: '第一个租户免费，创建完成后即可访问后台。',
    moreTenantPaid: '第二个租户开始每个 9.9 元/年，付费开通功能即将开放。', tenantKey: '租户 Key', tenantKeyPlaceholder: '例如 anderson',
    tenantKeyTip: '必须以英文字母开头，仅支持英文字母、数字、- 和 _。', systemName: '系统名称', systemNamePlaceholder: '例如 Anderson CRM',
    systemNameTip: '创建后会写入新库系统设置的 SysTitle / SysShortTitle。', creating: '正在创建...', paymentComing: '付费开通即将上线',
    progress: '开通进度', accountLabel: '账号', nameLabel: '姓名', phoneLabel: '手机号', logout: '退出登录',
    aiTitle: 'Microi.AI 中转站', aiDesc: '此 ApiKey 会在创建 SaaS 租户时自动写入租户的 Microi.AI 中转站配置，请勿公开分享。',
    apiBase: 'API Base', apiKey: 'ApiKey', generating: '正在生成...', copyApiKey: '复制 ApiKey', totalToken: 'Token 总量', usedToken: '已用 Token', remainingToken: '剩余 Token',
    time: '时间', model: '模型', input: '输入', output: '输出', deduction: '本次扣减', remaining: '剩余', source: '来源', noUsage: '暂无中转站调用记录',
    copySuccess: '已复制到剪贴板', copyFailed: '复制失败，请手动选择并复制', sessionExpired: '登录身份已过期，请重新登录。', language: '语言', chinese: '中文', english: 'English',
    loginPageDesc: '登录后管理你的 Microi SaaS 工作空间。', createPageDesc: '第一个租户免费，第二个开始每个 9.9 元/年。', pageDesc: '{name} 的 SaaS 工作空间管理。',
    unnamedTenant: '未命名租户', enabled: '启用中', disabled: '已停用', accessEntry: '访问入口', defaultAdmin: '默认管理员', changePassword: '请首次登录后及时修改密码', copyLink: '复制链接',
    noTenants: '还没有租户', noTenantsDesc: '你可以免费创建第一个 SaaS 数据库，创建完成后立即进入后台使用。',
    licensePersonal: '个人版', licensePersonalTitle: 'Personal（个人版）', licensePersonalDesc: '授权永久有效，售后服务支持有效期 1 年，续费 499/年。',
    licenseEnterprise: '企业版', licenseEnterpriseTitle: 'Enterprise（企业版）', licenseEnterpriseDesc: '授权永久有效，售后服务支持有效期 1 年，续费 2.5w/年。',
    licenseOpen: '开源版', licenseOpenDesc: '当前账号使用开源版能力，可按需升级到个人版或企业版。',
    waiting: '等待中', skipped: '未执行', elapsed: '耗时 {seconds} 秒', allDone: '所有步骤已完成。', preparingSteps: '准备创建租户，共 {count} 步。', runningStep: '正在执行第 {index}/{count} 步：{title}，已耗时 {seconds} 秒', failedStep: '{title}失败：{detail}',
    tenantReadFailed: '租户信息读取失败。', networkFailed: '网络异常，租户信息读取失败。', invalidTenantKey: '租户 Key 格式不正确。', enterSystemName: '请输入系统名称。', tenantCreateFailed: '租户创建失败。', taskSubmitted: '租户创建任务已提交，正在后台处理。', tenantCreatedAt: '租户创建成功，访问地址：{url}', connectionInterrupted: '请求连接已中断，后台可能仍在创建租户；页面会继续读取实时进度。', restoredProgress: '检测到租户创建任务正在后台执行，已恢复实时进度。'
  },
  'en-US': {
    loginRegister: 'Sign in / Register', backWebsite: 'Back to website', enterBackend: 'Open console', refresh: 'Refresh',
    loginRequired: 'Sign in required', loginRequiredDesc: 'Sign in to view your SaaS tenants, create your first database for free, and open the admin console.', goLogin: 'Sign in',
    overview: 'Overview', createTenant: 'Create tenant', aiRelay: 'AI Relay', account: 'Account',
    overviewDesc: 'Manage {name}\'s SaaS workspace, license, and tenant access here.', currentLicense: 'Current license',
    tenantCreated: 'Tenants', freeQuota: 'Free quota: {count}', freeCreate: 'Free tenant', available: 'Available', used: 'Used', freeCreateTip: 'Each account can create one tenant for free',
    expansionPrice: 'Extra tenant', expansionPriceTip: 'Per year, starting from the second tenant', relayToken: 'AI Relay Tokens', tokenUsedTotal: 'Used {used} / Total {total}',
    saasTenants: 'SaaS tenants', tenantDesc: 'Each tenant has an independent low-code database and URL. The default admin is admin and the initial password is the tenant key. Change it after first sign-in.',
    loadingTenants: 'Loading tenants...', oneTenant: '1 tenant', freeQuotaDesc: 'Suitable for trials, learning, and small systems.', expansionAmount: '¥{price} / year / tenant', expansionDesc: 'Billing starts with the second tenant. Online payment is coming soon.',
    createFreeTenant: 'Create free tenant', createMoreTenants: 'Create another tenant', firstTenantFree: 'Your first tenant is free and available immediately after creation.', moreTenantPaid: 'Additional tenants cost ¥9.9/year. Online payment is coming soon.',
    tenantKey: 'Tenant key', tenantKeyPlaceholder: 'e.g. anderson', tenantKeyTip: 'Must start with a letter and contain only letters, numbers, hyphens, and underscores.',
    systemName: 'System name', systemNamePlaceholder: 'e.g. Anderson CRM', systemNameTip: 'This becomes SysTitle / SysShortTitle in the new tenant.', creating: 'Creating...', paymentComing: 'Online payment coming soon', progress: 'Provisioning progress',
    accountLabel: 'Account', nameLabel: 'Name', phoneLabel: 'Phone', logout: 'Sign out', aiTitle: 'Microi.AI Relay', aiDesc: 'This ApiKey is written into the Microi.AI Relay configuration of new SaaS tenants. Keep it private.',
    apiBase: 'API Base', apiKey: 'ApiKey', generating: 'Generating...', copyApiKey: 'Copy ApiKey', totalToken: 'Total tokens', usedToken: 'Used tokens', remainingToken: 'Remaining tokens',
    time: 'Time', model: 'Model', input: 'Input', output: 'Output', deduction: 'Deducted', remaining: 'Remaining', source: 'Source', noUsage: 'No relay usage records',
    copySuccess: 'Copied to clipboard', copyFailed: 'Copy failed. Please select and copy it manually.', sessionExpired: 'Your session has expired. Please sign in again.', language: 'Language', chinese: '中文', english: 'English',
    loginPageDesc: 'Sign in to manage your Microi SaaS workspace.', createPageDesc: 'The first tenant is free; additional tenants cost ¥9.9/year.', pageDesc: 'Manage {name}\'s SaaS workspace.',
    unnamedTenant: 'Unnamed tenant', enabled: 'Enabled', disabled: 'Disabled', accessEntry: 'Access URL', defaultAdmin: 'Default admin', changePassword: 'Change the password after first sign-in', copyLink: 'Copy link',
    noTenants: 'No tenants yet', noTenantsDesc: 'Create your first SaaS database for free and use it immediately.',
    licensePersonal: 'Personal', licensePersonalTitle: 'Personal', licensePersonalDesc: 'Perpetual license with one year of support; renewal is ¥499/year.', licenseEnterprise: 'Enterprise', licenseEnterpriseTitle: 'Enterprise', licenseEnterpriseDesc: 'Perpetual license with one year of support; renewal is ¥25,000/year.', licenseOpen: 'Open Source', licenseOpenDesc: 'This account uses the open-source edition and can upgrade to Personal or Enterprise.',
    waiting: 'Waiting', skipped: 'Skipped', elapsed: '{seconds}s', allDone: 'All steps completed.', preparingSteps: 'Preparing {count} provisioning steps.', runningStep: 'Running step {index}/{count}: {title} ({seconds}s)', failedStep: '{title} failed: {detail}',
    tenantReadFailed: 'Failed to load tenant information.', networkFailed: 'Network error while loading tenant information.', invalidTenantKey: 'Invalid tenant key.', enterSystemName: 'Enter a system name.', tenantCreateFailed: 'Tenant creation failed.', taskSubmitted: 'Tenant creation task submitted and running in the background.', tenantCreatedAt: 'Tenant created: {url}', connectionInterrupted: 'The request disconnected. Provisioning may still be running; this page will keep polling.', restoredProgress: 'An active tenant provisioning task was found and live progress has been restored.'
  }
} as const

export function normalizeProfileLocale(value?: string | null): ProfileLocale {
  return String(value || '').toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN'
}

export function getInitialProfileLocale(): ProfileLocale {
  if (typeof window === 'undefined') return 'zh-CN'
  return normalizeProfileLocale(window.localStorage.getItem('microi_profile_locale') || window.navigator.language)
}

export function translateProfile(locale: ProfileLocale, key: string, params: Record<string, unknown> = {}): string {
  const dictionary = messages[locale] as Record<string, string>
  const fallback = messages['zh-CN'] as Record<string, string>
  return String(dictionary[key] || fallback[key] || key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))
}
