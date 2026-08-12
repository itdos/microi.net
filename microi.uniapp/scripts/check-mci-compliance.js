const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');

const failures = [];

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function listVuePages(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listVuePages(full));
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      result.push(path.relative(root, full).replace(/\\/g, '/'));
    }
  }
  return result;
}

function listSourceFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...listSourceFiles(full));
    else if (entry.isFile() && /\.(?:vue|js|ts)$/.test(entry.name)) result.push(full);
  }
  return result;
}

const request = read('src/utils/request.js');
const sdk = read('src/utils/microi.v8.js');
const theme = read('src/utils/theme.js');
const app = read('src/App.vue');
const design = read('src/styles/mci-design.scss');
const config = read('src/config.js');
const pkg = JSON.parse(read('package.json'));
const messagePage = read('src/pages/message/index.vue');
const workspacePage = read('src/pages/workspace/index.vue');
const authPrompt = read('src/components/mci-auth-prompt/mci-auth-prompt.vue');
const visualAuthPrompt = read('scripts/visual-message-button.js');
const pagesConfig = JSON.parse(read('src/pages.json'));
const manifest = JSON.parse(read('src/manifest.json'));
const aiPage = read('src/pages/ai/index.vue');
const aiLauncher = read('src/components/mci-ai-launcher/mci-ai-launcher.vue');
const customTabBarJs = read('src/custom-tab-bar/index.js');
const customTabBarJson = JSON.parse(read('src/custom-tab-bar/index.json'));
const customTabBarWxml = read('src/custom-tab-bar/index.wxml');
const customTabBarWxss = read('src/custom-tab-bar/index.wxss');
const activeTabBar = read('src/generated/active-tabbar.js');
const profileManager = read('scripts/lib/profile-manager.cjs');
const xjyPagesConfig = JSON.parse(read('profiles/xjy/pages.json'));
const standardPagesConfig = JSON.parse(read('profiles/standard/pages.json'));
const aiAssistant = read('src/pages/ai/components/mci-ai-assistant/mci-ai-assistant.vue');
const aiClient = read('src/pages/ai/utils/mci-ai.js');
const messageChat = read('src/pages/message/chat.vue');
const loginPage = read('src/pages/login/index.vue');
const sysConfig = read('src/utils/sysconfig.js');

assert(request.includes('function uniRequestAdapter'), 'request.js must define an explicit uni.request adapter.');
assert(request.includes('requestAdapter: uniRequestAdapter'), 'Configured Microi V8 instance must use the uni.request adapter.');
assert(sdk.includes("typeof uni !== 'undefined'"), 'microi.v8.js must detect the uni runtime directly, not only globalThis.uni.');
assert(theme.includes('TAB_BAR_ROUTES'), 'theme.js must know tabBar routes before calling setTabBarStyle.');
assert(theme.includes('isCurrentTabBarPage'), 'theme.js must guard setTabBarStyle to tabBar pages.');
assert(theme.includes('syncCustomTabBarSelection') && theme.includes('scheduleCustomTabBarSelectionSync'), 'Every visible tab page must explicitly synchronize the custom tabBar selection from its route.');
assert(theme.includes('task.catch'), 'theme.js must swallow setTabBarStyle Promise failures.');
assert(!config.includes('/static/logo.png'), 'config.js must not point to missing /static/logo.png.');
assert(!read('src/pages/login/index.vue').includes('/static/logo.png'), 'login page must not fall back to missing /static/logo.png.');
assert(exists('src/static/microi-blue-256.png'), 'Default Microi logo asset must exist.');
assert(exists('scripts/visual-message-button.js'), 'Visual screenshot check for the message login button must exist.');
assert(pkg.scripts && pkg.scripts['visual:auth-prompts'], 'package.json must expose npm run visual:auth-prompts.');
assert(pkg.scripts && pkg.scripts.test && pkg.scripts.test.includes('npm run visual:auth-prompts'), 'npm test must run the auth prompt screenshot checks.');
assert(visualAuthPrompt.includes('workspace-login.png'), 'Visual screenshot check must include the workspace auth prompt.');
assert(visualAuthPrompt.includes('message-login.png'), 'Visual screenshot check must include the message auth prompt.');
assert(aiClient.includes("MCI_AI_ENGINE_KEY = 'mci_ai_data_assistant'"), 'AI client must use the canonical mci_ai_data_assistant engine key.');
assert(!aiLauncher.includes('getToken') && aiLauncher.includes("url: '/pages/ai/index'"), 'The enabled AI launcher must open the dedicated route without an auth request.');
assert(aiLauncher.includes('isFallbackLauncher') && aiLauncher.includes('getAiAssistantEnabled'), 'The fixed AI launcher visibility must be controlled by the server-side system setting.');
assert(sysConfig.includes('IsShowAiAssistant') && sysConfig.includes('enabled: false') && sysConfig.includes('getSysConfig({ refresh: true })'), 'AI feature flag must default closed and refresh from Sys_Config.');
assert(sysConfig.includes('IsShowAiModel') && sysConfig.includes('getAiModelEnabled') && sysConfig.includes('aiModelFlagState'), 'AI model selectors must use the fail-closed IsShowAiModel platform flag.');
assert(pagesConfig.tabBar && pagesConfig.tabBar.custom === true, 'The active profile must use a custom tabBar for the navigation capsule.');
assert(xjyPagesConfig.tabBar && xjyPagesConfig.tabBar.custom === true, 'The xjy profile must enable the custom tabBar.');
assert(standardPagesConfig.tabBar && standardPagesConfig.tabBar.custom === true, 'The standard profile must enable the custom tabBar.');
assert((pagesConfig.subPackages || []).some((pkgEntry) => (pkgEntry.pages || []).some((page) => `${pkgEntry.root}/${page.path}`.replace(/\/+/g, '/') === 'pages/ai/index')), 'The dedicated AI assistant route must remain registered in pages.json.');
assert(activeTabBar.includes('"custom": true') && activeTabBar.includes('"profileId": "xjy"'), 'The checked-in generated tabBar bridge must represent the custom default xjy profile.');
assert(profileManager.includes("'generated', 'active-tabbar.js'") && profileManager.includes('generatedActiveTabBarSource'), 'Profile switching must regenerate the active tabBar bridge.');
assert(customTabBarJson.component === true, 'WeChat custom tabBar must be declared as a native component.');
assert(customTabBarWxml.includes('class="mci-bottom-dock') && customTabBarWxml.includes('class="mci-bottom-dock__nav"'), 'WeChat custom tabBar must render the navigation capsule.');
assert(customTabBarJs.includes('pageLifetimes') && customTabBarJs.includes('scheduleRouteSync') && customTabBarJs.includes('selectedIndexForRoute'), 'WeChat custom tabBar must resync selection from the visible page route.');
assert(!/setData\(\{\s*switching:\s*true,\s*selected:/.test(customTabBarJs), 'WeChat custom tabBar must not optimistically replace the route-derived selected state.');
assert(!/Number\.isInteger\(state\.selected\)/.test(customTabBarJs), 'External component state must not override the route-derived selected state.');
assert(customTabBarJs.includes('safeAreaInsets') && customTabBarWxml.includes('{{safeBottom}}') && /position:\s*fixed[\s\S]*bottom:\s*0/.test(customTabBarWxss), 'The custom tabBar must consume the runtime safe area while staying fixed to the bottom.');
assert(aiLauncher.includes('activeTabBar.custom === true') && aiLauncher.includes('mci-bottom-dock--with-ai') && aiLauncher.includes('mci-bottom-dock__nav'), 'The H5 custom dock must place the enabled AI entry beside the navigation capsule.');
assert(aiLauncher.includes('scheduleActiveRouteSync') && !aiLauncher.includes('this.activeIndex = index'), 'The H5 custom dock must also derive selection from the visible route instead of optimistic clicks.');
assert(!aiLauncher.includes('setData({ ...state, selected:'), 'Async assistant state must never overwrite the custom tabBar selected index.');
assert(app.includes('.mci-tabbar-spacer') && app.includes('144rpx + var(--mci-safe-bottom'), 'Tab page content must reserve the custom dock height and runtime bottom safe area.');
for (const tabPage of [workspacePage, messagePage, read('src/pages/mall/index.vue'), read('src/pages/news/index.vue'), read('src/pages/profile/index.vue')]) {
  assert(tabPage.includes('mci-tabbar-spacer'), 'Every tab page scroll area must include the shared bottom spacer.');
}
assert(customTabBarWxml.includes('mci-bottom-dock__ai-slot') && customTabBarWxml.includes('wx:if="{{aiAssistantEnabled}}"') && customTabBarJs.includes('openAssistant'), 'WeChat tab pages must place the enabled AI entry in the fixed dock beside TabBar.');
assert(aiLauncher.includes('mci-ai-launcher--fallback') && aiLauncher.includes('getSafeAreaMetrics') && aiLauncher.includes('this.isTabBarPage') && aiLauncher.includes("runtimeTarget !== 'mp-weixin'"), 'Non-WeChat fallback launchers must remain fixed and limited to TabBar pages.');
assert(aiLauncher.includes('--mci-safe-bottom') && aiLauncher.includes('env(safe-area-inset-bottom'), 'The H5 bottom dock must consume the shared bottom safe-area variable with an env fallback.');
for (const dragToken of ['DRAG_THRESHOLD', 'POSITION_STORAGE_VERSION', 'dragState', 'handleDragMove', '@touchmove', 'setStorageSync']) {
  assert(!aiLauncher.includes(dragToken), `The AI entry must stay in its fixed dock position without draggable state: ${dragToken}.`);
}
assert(aiLauncher.includes("服务助手打开失败，请重试"), 'Assistant launcher navigation failures must give the user visible feedback.');
assert(aiPage.includes('onBackPress') && aiPage.includes('assistant.handleBack'), 'AI page must consume internal back states before leaving the dedicated route.');
assert(aiPage.includes('getAiAssistantEnabled({ refresh: true })') && aiPage.includes('message-fallback-page') && aiPage.includes('暂无新消息'), 'Direct assistant routes must enforce the server-side switch and render a complete normal message state while disabled.');
assert(!aiPage.includes('功能暂未开放') && !aiPage.includes('敬请期待') && !aiPage.includes('根据平台配置'), 'Closed assistant state must not expose rollout, review, or incomplete-feature copy.');
assert(messagePage.includes('getAiAssistantEnabled') && messagePage.includes('stripAiEntries') && messagePage.includes('syncAiEntries'), 'Message lists, contacts, dialogs, and cached conversations must share the assistant feature switch.');
assert(messageChat.includes('getAiAssistantEnabled({ refresh: true })') && messageChat.includes('leaveBlockedAiChat') && messageChat.includes('内容由人工智能生成，请注意甄别'), 'Legacy assistant chat deep links must fail closed and enabled generated content must be disclosed.');
assert(/loadAiModelList\(\)\s*\{[\s\S]*?if \(!this\.isAIChat\) return/.test(messageChat), 'Legacy chat must not request model data unless the assistant is enabled.');
assert(aiAssistant.includes('if (!this.isAuthenticated)') && aiAssistant.includes('登录前不会读取、分析或展示任何业务数据'), 'AI assistant must render an anonymous login prompt without loading protected data.');
assert(aiAssistant.includes('内容由人工智能生成，请注意甄别'), 'AI-generated content must carry a prominent artificial-intelligence disclosure.');
assert(aiAssistant.includes('getAiModelEnabled') && aiAssistant.includes('v-if="showAiModel"') && aiAssistant.includes('resolveModelVisibility'), 'Runtime model and model channel controls must follow the IsShowAiModel platform flag.');
assert(aiAssistant.includes('capsuleBottom') && aiAssistant.includes('aiHeaderStyle'), 'AI header actions must be laid out below the WeChat capsule when required.');
assert(loginPage.includes("LOGIN_PREFERENCES_KEY = 'mci_login_preferences_v1'"), 'Account login must expose persistent remember-account preferences.');
assert(loginPage.includes('rememberedPasswordCipher') && loginPage.includes('永不保存明文密码'), 'Remember-password must persist only the successful RSA ciphertext.');
assert(!loginPage.includes('<mci-water-motion'), 'Login must not use a native video layer that can cover the form in WeChat.');
assert(!loginPage.includes('v-if="configLoading"') && loginPage.includes('<view class="login-content">'), 'Login controls must render immediately without waiting for remote Sys_Config.');

for (const sourceFile of listSourceFiles(src)) {
  const relative = path.relative(root, sourceFile).replace(/\\/g, '/');
  if (relative.startsWith('src/platform/ui/adapters/')) continue;
  const content = fs.readFileSync(sourceFile, 'utf8');
  assert(!/from\s+['"]@dcloudio\/uni-ui/.test(content), `${relative} must wrap uni-ui behind src/platform/ui/adapters.`);
}

assert(app.includes("@import './styles/mci-design.scss'"), 'App.vue must import the MCI design stylesheet.');
for (const token of [
  '--mci-color-primary',
  '--mci-text-on-primary',
  '--mci-bg-base',
  '--mci-safe-bottom',
  '.mci-card',
  '.mci-btn',
  '@keyframes mciShimmer'
]) {
  assert(design.includes(token), `MCI design stylesheet missing ${token}.`);
}
assert(!/\n\s*button\s*\{/.test(design), 'MCI stylesheet must not use broad global button selectors.');
assert(!/\n\s*img\s*\{/.test(design), 'MCI stylesheet must not use broad global img selectors.');
assert(!/\n\s*\.card\s*\{/.test(design), 'MCI stylesheet must not use broad global .card selectors.');
assert(messagePage.includes('<mci-auth-prompt'), 'message page must use the shared mci-auth-prompt component.');
assert(
  workspacePage.includes('<mci-auth-prompt') || workspacePage.includes('class="login-button"'),
  'workspace page must expose a clear login action for anonymous users.'
);
assert(!messagePage.includes('class="login-prompt"') && !messagePage.includes('class="prompt-btn"'), 'message page must not keep duplicated auth prompt markup/styles.');
assert(!workspacePage.includes('class="login-prompt"') && !workspacePage.includes('class="prompt-btn"'), 'workspace page must not keep duplicated auth prompt markup/styles.');
assert(/\.mci-auth-prompt__button\s*\{[\s\S]*display:\s*flex/.test(authPrompt), 'auth prompt button must use flex layout for centering.');
assert(/\.mci-auth-prompt__button\s*\{[\s\S]*align-items:\s*center/.test(authPrompt), 'auth prompt button must align text vertically centered.');
assert(/\.mci-auth-prompt__button\s*\{[\s\S]*justify-content:\s*center/.test(authPrompt), 'auth prompt button must center text horizontally.');
assert(/\.mci-auth-prompt__button\s*\{[\s\S]*line-height:\s*1/.test(authPrompt), 'auth prompt button must use stable line-height.');

for (const page of listVuePages(path.join(src, 'pages'))) {
  const content = read(page);
  assert(content.includes('mciTokenStyle'), `${page} must bind MCI token styles on the page root.`);
  assert(content.includes('themeMixin'), `${page} must use themeMixin for MCI theme/palette propagation.`);
}

const dynamicPages = [
  { file: 'src/pages/mall/index.vue', loading: 'loading && products.length === 0', empty: '!loading && products.length === 0' },
  { file: 'src/pages/news/index.vue', loading: 'loading && newsList.length === 0', empty: '!loading && newsList.length === 0' },
  { file: 'src/pages/message/index.vue', loading: 'loading && messageList.length === 0', empty: '!loading && filteredMessageList.length === 0' },
  { file: 'src/pages/mall/detail.vue', loading: 'detail-skeleton', empty: 'swiper-empty' },
  { file: 'src/pages/news/detail.vue', loading: 'article-skeleton', empty: 'error-state' }
];

for (const check of dynamicPages) {
  const content = read(check.file);
  assert(content.includes(check.loading), `${check.file} must render a skeleton-like first loading state.`);
  assert(content.includes(check.empty), `${check.file} must render empty/error state only after loading completes.`);
}

assert(workspacePage.includes('summaryLoading'), 'workspace page must expose a stable summary loading state.');
assert(workspacePage.includes('metric-skeleton'), 'workspace summary must use a visible skeleton state.');
assert(workspacePage.includes('v-for="(group, groupIndex) in visibleBusinessGroups"'), 'workspace page must render the role-filtered business catalog.');
assert(workspacePage.includes('allowedGroupKeys'), 'workspace business catalog must be filtered by the current role profile.');

const remotePages = [
  'src/pages/about/index.vue',
  'src/pages/business/detail.vue',
  'src/pages/business/list.vue',
  'src/pages/business/stats.vue',
  'src/pages/mall/detail.vue',
  'src/pages/mall/index.vue',
  'src/pages/message/chat.vue',
  'src/pages/message/index.vue',
  'src/pages/native/checkin.vue',
  'src/pages/native/watermark-camera.vue',
  'src/pages/native-form/index.vue',
  'src/pages/news/detail.vue',
  'src/pages/news/index.vue',
  'src/pages/profile/index.vue',
  'src/pages/task/list.vue',
  'src/pages/workspace/index.vue'
];
for (const page of remotePages) {
  const content = read(page);
  assert(/mci-skeleton|skeleton/.test(content), `${page} must expose a first-load skeleton state.`);
}

const declaredPages = [
  ...(pagesConfig.pages || []).map((page) => ({ ...page, source: `src/${page.path}.vue` })),
  ...(pagesConfig.subPackages || []).flatMap((pkgEntry) => (pkgEntry.pages || []).map((page) => ({
    ...page,
    source: `src/${pkgEntry.root}/${page.path}.vue`
  })))
];
for (const page of declaredPages.filter((item) => item.style && item.style.navigationStyle === 'custom')) {
  const content = read(page.source);
  assert(content.includes('<mci-page-shell') || content.includes('mci-safe-top') || content.includes('<mci-ai-assistant'), `${page.source} must reserve the runtime top safe area.`);
}
assert((pagesConfig.subPackages || []).length >= 4, 'pages.json must split non-critical pages into at least 4 subpackages.');
assert(manifest['mp-weixin'] && manifest['mp-weixin'].lazyCodeLoading === 'requiredComponents', 'WeChat required component injection must be enabled.');

const missingImageRefs = [];
for (const page of listVuePages(path.join(src, 'pages'))) {
  const content = read(page);
  if (content.includes('/static/logo.png')) missingImageRefs.push(page);
}
assert(missingImageRefs.length === 0, `Missing logo path still referenced in: ${missingImageRefs.join(', ')}`);

if (failures.length) {
  console.error('\nMCI compliance check failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('MCI compliance check passed.');
