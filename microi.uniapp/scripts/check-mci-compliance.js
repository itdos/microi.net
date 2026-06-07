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

assert(request.includes('function uniRequestAdapter'), 'request.js must define an explicit uni.request adapter.');
assert(request.includes('requestAdapter: uniRequestAdapter'), 'Configured Microi V8 instance must use the uni.request adapter.');
assert(sdk.includes("typeof uni !== 'undefined'"), 'microi.v8.js must detect the uni runtime directly, not only globalThis.uni.');
assert(theme.includes('TAB_BAR_ROUTES'), 'theme.js must know tabBar routes before calling setTabBarStyle.');
assert(theme.includes('isCurrentTabBarPage'), 'theme.js must guard setTabBarStyle to tabBar pages.');
assert(theme.includes('task.catch'), 'theme.js must swallow setTabBarStyle Promise failures.');
assert(!config.includes('/static/logo.png'), 'config.js must not point to missing /static/logo.png.');
assert(!read('src/pages/login/index.vue').includes('/static/logo.png'), 'login page must not fall back to missing /static/logo.png.');
assert(exists('src/static/microi-blue-256.png'), 'Default Microi logo asset must exist.');
assert(exists('scripts/visual-message-button.js'), 'Visual screenshot check for the message login button must exist.');
assert(pkg.scripts && pkg.scripts['visual:auth-prompts'], 'package.json must expose npm run visual:auth-prompts.');
assert(pkg.scripts && pkg.scripts.test && pkg.scripts.test.includes('npm run visual:auth-prompts'), 'npm test must run the auth prompt screenshot checks.');
assert(visualAuthPrompt.includes('workspace-login.png'), 'Visual screenshot check must include the workspace auth prompt.');
assert(visualAuthPrompt.includes('message-login.png'), 'Visual screenshot check must include the message auth prompt.');

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
assert(workspacePage.includes('<mci-auth-prompt'), 'workspace page must use the shared mci-auth-prompt component.');
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
  { file: 'src/pages/workspace/index.vue', loading: 'loading && menuList.length === 0', empty: 'menuList.length === 0 && !loading' },
  { file: 'src/pages/message/index.vue', loading: 'loading && messageList.length === 0', empty: '!loading && filteredMessageList.length === 0' },
  { file: 'src/pages/mall/detail.vue', loading: 'detail-skeleton', empty: 'swiper-empty' },
  { file: 'src/pages/news/detail.vue', loading: 'article-skeleton', empty: 'error-state' }
];

for (const check of dynamicPages) {
  const content = read(check.file);
  assert(content.includes(check.loading), `${check.file} must render a skeleton-like first loading state.`);
  assert(content.includes(check.empty), `${check.file} must render empty/error state only after loading completes.`);
}

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
