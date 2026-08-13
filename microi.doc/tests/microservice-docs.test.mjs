import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(projectRoot, '..');
const read = relativePath => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
const sha256 = relativePath => crypto.createHash('sha256').update(fs.readFileSync(path.join(repositoryRoot, relativePath))).digest('hex');
const readSkill = skillName => {
  const skillDirectory = path.join(repositoryRoot, 'microi.skills', skillName);
  const referencesDirectory = path.join(skillDirectory, 'references');
  const references = fs.existsSync(referencesDirectory)
    ? fs.readdirSync(referencesDirectory)
      .filter(name => name.endsWith('.md'))
      .sort()
      .map(name => fs.readFileSync(path.join(referencesDirectory, name), 'utf8'))
    : [];
  return [fs.readFileSync(path.join(skillDirectory, 'SKILL.md'), 'utf8'), ...references].join('\n');
};

function relativeLuminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map(index => Number.parseInt(value.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function cssToken(scope, name) {
  const line = scope.split(/\r?\n/u).find(value => value.includes(`${name}:`));
  const match = line?.match(/#[0-9a-f]{6}/iu);
  assert.ok(match, `${name} must be a six-digit hex color`);
  return match[0];
}

test('MicroService guide explains all four runtime entries with real case images', () => {
  const guide = read('microi.doc/docs/doc/system-engine/micro-app.md');
  for (const phrase of [
    '独立运行',
    '平台菜单直开',
    'V8.OpenAppDialog',
    '在表单引擎中引用',
    'DevComponentPath',
    'LegacyComponentPaths',
    'componentMode',
    'dev-component:resize',
    'https://microi.net/apps.html',
    '/micro-app/{AppKey}/{RoutePath}',
    'EnableCaptcha',
    'permissionContext',
    'microi_sync_microservice_source',
    '"directory"',
    '.sync-seg-*',
    'aiContextFileBytes=0',
  ]) assert.ok(guide.includes(phrase), `guide is missing ${phrase}`);

  const images = [
    'open-app-dialog.png',
    'menu-production-counter.jpg',
    'menu-packing-workbench.jpg',
  ];
  for (const image of images) {
    const relativePath = `microi.doc/docs/public/images/microservice-cases/${image}`;
    const absolutePath = path.join(repositoryRoot, relativePath);
    assert.ok(fs.existsSync(absolutePath), `${relativePath} must exist`);
    assert.ok(fs.statSync(absolutePath).size > 100_000, `${relativePath} must contain the real screenshot`);
    assert.ok(guide.includes(`/images/microservice-cases/${image}`));
  }
});

test('FormEngine MicroService entry matches the implemented component fallback contract', () => {
  const guide = read('microi.doc/docs/doc/system-engine/micro-app.md');
  const formGuide = read('microi.doc/docs/doc/form-engine/form-custom-control.md');
  const cache = read('Microi.Client/src/utils/dynamicComponentCache.js');
  const resolver = read('Microi.Client/src/utils/microAppDevComponentResolver.js');
  const host = read('Microi.Client/src/views/micro-app/dev-component.vue');

  for (const token of ['DevComponent', 'DevComponentPath', 'LegacyComponentPaths', 'RoutePath', 'componentData', 'permissionContext']) {
    assert.ok(guide.includes(token), `MicroService guide is missing ${token}`);
    assert.ok(formGuide.includes(token), `custom component guide is missing ${token}`);
  }
  assert.match(cache, /本地源码不存在时[\s\S]*?MicroAppDevComponent/);
  assert.match(cache, /legacyComponentPath:\s*path/);
  assert.match(resolver, /findLegacyMicroAppPage/);
  assert.match(resolver, /normalizeLegacyComponentPath/);
  for (const token of ['componentMode', 'componentData', 'dev-component:resize', 'dev-component:event', 'permissionContext']) {
    assert.ok(host.includes(token), `component host is missing ${token}`);
  }
});

test('documentation theme has global and MicroService-specific readable layouts', () => {
  const themeEntry = read('microi.doc/docs/.vitepress/theme/index.ts');
  const visualProfiles = read('microi.doc/docs/.vitepress/theme/doc-visual-profiles.js');
  const globalTheme = read('microi.doc/docs/.vitepress/theme/styles/doc-readable.scss');
  const microAppTheme = read('microi.doc/docs/.vitepress/theme/styles/micro-app.scss');

  assert.match(themeEntry, /styles\/doc-readable\.scss/);
  assert.match(themeEntry, /styles\/micro-app\.scss/);
  assert.match(themeEntry, /getDocVisualProfile/);
  assert.match(visualProfiles, /'system-engine\/micro-app': 'showcase'/);
  for (const token of ['--mci-doc-reading-width', '.mci-doc-profile--reference', '&.dark', '.vp-doc details', '.mci-doc-grid', 'prefers-reduced-motion']) {
    assert.ok(globalTheme.includes(token));
  }
  for (const token of ['--micro-app-hero-surface', '--micro-app-hero-ink', '.micro-app-hero', '.micro-app-mode-grid', '.micro-app-case-grid', '.micro-app-auth-flow', '.micro-app-component-flow', '@media (max-width: 680px)', '&.dark .micro-app-hero']) {
    assert.ok(microAppTheme.includes(token));
  }

  const compiledGlobalTheme = sass.compile(path.join(repositoryRoot, 'microi.doc/docs/.vitepress/theme/styles/doc-readable.scss')).css;
  const compiledMicroAppTheme = sass.compile(path.join(repositoryRoot, 'microi.doc/docs/.vitepress/theme/styles/micro-app.scss')).css;
  assert.match(compiledGlobalTheme, /html:lang\(zh\)\.dark/);
  assert.match(compiledMicroAppTheme, /html:lang\(zh\)\.dark body:has\(\.mci-micro-app-page\)/);
  assert.doesNotMatch(compiledMicroAppTheme, /html:lang\(zh\) \.dark \.micro-app-hero/);
});

test('light and dark documentation surfaces keep readable foreground pairs', () => {
  const globalTheme = read('microi.doc/docs/.vitepress/theme/styles/doc-readable.scss');
  const microAppTheme = read('microi.doc/docs/.vitepress/theme/styles/micro-app.scss');
  const docDark = /&\.dark\s*\{([\s\S]*?)^\s{2}\}/mu.exec(globalTheme)?.[1] || '';
  const heroLight = /^body:has\(\.mci-micro-app-page\)[^{]*\{([\s\S]*?)^\}/mu.exec(microAppTheme)?.[1] || '';
  const heroDark = /^&\.dark body:has\(\.mci-micro-app-page\)[^{]*\{([\s\S]*?)^\}/mu.exec(microAppTheme)?.[1] || '';

  for (const [foreground, background, label] of [
    [cssToken(globalTheme, '--mci-doc-table-head-text'), cssToken(globalTheme, '--mci-doc-table-head'), 'light table header'],
    [cssToken(docDark, '--mci-doc-table-head-text'), cssToken(docDark, '--mci-doc-table-head'), 'dark table header'],
    [cssToken(heroLight, '--micro-app-hero-ink'), cssToken(heroLight, '--micro-app-hero-surface'), 'light MicroService hero'],
    [cssToken(heroLight, '--micro-app-hero-muted'), cssToken(heroLight, '--micro-app-hero-surface'), 'light MicroService hero muted'],
    [cssToken(heroDark, '--micro-app-hero-ink'), cssToken(heroDark, '--micro-app-hero-surface'), 'dark MicroService hero'],
    [cssToken(heroDark, '--micro-app-hero-muted'), cssToken(heroDark, '--micro-app-hero-surface'), 'dark MicroService hero muted'],
  ]) {
    assert.ok(contrastRatio(foreground, background) >= 4.5, `${label} must meet WCAG AA contrast`);
  }
});

test('future AI delivery rules prohibit manual chunks and require standalone auth', () => {
  const sourceSkill = readSkill('microi-microservice');
  const docsSkill = readSkill('microi-docs-coverage');
  const sdkSkill = readSkill('microi-frontend-sdk');
  const uiSkill = readSkill('ui-design');
  const aiInstructions = read('Microi.VSCode/src/editor/typingsManager.ts');
  const mcp = read('microi.mcp/src/server.ts');
  const scaffold = read('microi.mcp/src/microservice-scaffold.ts');
  const host = read('Microi.Client/src/views/micro-app/host.vue');

  for (const token of ['directory', '.sync-seg-*', '独立运行的认证门', 'permissionContext', '表单嵌入四种入口', 'dev-component:resize']) assert.ok(sourceSkill.includes(token));
  for (const token of ['中文文档视觉与可读性契约', 'doc-visual-profiles.js', 'npm run audit:visual', '&.dark', 'WCAG AA']) assert.ok(docsSkill.includes(token));
  for (const token of ['MicroService 独立运行认证', 'EnableCaptcha', 'captchaid']) assert.ok(sdkSkill.includes(token));
  for (const token of ['VitePress 中文文档布局规范', '86ch', 'prefers-reduced-motion', 'html:lang(zh).dark', '全站扫描']) assert.ok(uiSkill.includes(token));
  for (const token of ['sync-source-files.json', 'EnableCaptcha', 'permissionContext={sysMenuId,moduleEngineKey,diyTableId}']) assert.ok(aiInstructions.includes(token));
  for (const token of ['buildLocalMicroServiceSourceManifest', 'aiContextFileBytes', 'manualChunking']) assert.ok(mcp.includes(token));
  for (const token of ['buildStandaloneAuthModule', 'GetSysConfig', 'GetCaptcha', '_CaptchaId']) assert.ok(scaffold.includes(token));
  assert.match(host, /permissionContext/);
});

test('menu MicroService cache docs, Skills and host use one native lifecycle owner', () => {
  const guide = read('microi.doc/docs/doc/system-engine/micro-app.md');
  const microserviceSkill = readSkill('microi-microservice');
  const clientSkill = readSkill('microi-client-frontend');
  const e2eSkill = readSkill('playwright-e2e');
  const permission = read('Microi.Client/src/pinia/modules/permission.js');
  const host = read('Microi.Client/src/views/micro-app/host.vue');
  const cache = read('Microi.Client/src/utils/microAppRuntimeCache.js');

  for (const token of [
    '单一缓存所有者',
    'runtime-keep-alive',
    'appstate-change',
    'afterhidden',
    'aftershow',
    '最多保留 5 个',
    'destroy:true,clearData:true',
  ]) assert.ok(guide.includes(token), `MicroService guide is missing ${token}`);

  for (const source of [microserviceSkill, clientSkill, e2eSkill]) {
    for (const token of ['runtime-keep-alive', 'appstate-change', 'afterhidden', 'aftershow', 'LRU']) {
      assert.ok(source.includes(token), `Skill is missing ${token}`);
    }
  }

  assert.match(permission, /meta\.keepAlive\s*=\s*false/);
  assert.match(host, /<micro-app[\s\S]*?keep-alive/);
  assert.match(host, /@beforeshow="handleBeforeShow"/);
  assert.match(host, /forceSetData\(this\.microAppName,\s*data\)/);
  assert.match(cache, /MICRO_APP_RUNTIME_CACHE_LIMIT\s*=\s*5/);
  assert.match(cache, /unmountApp\(normalizedName,\s*\{\s*destroy:\s*true,\s*clearData:\s*true\s*\}\)/);
});

test('workspace Skills and the packaged Codex plugin carry the same rules', () => {
  const files = [
    'microi-microservice/SKILL.md',
    'microi-microservice/references/runtime-delivery.md',
    'microi-client-frontend/SKILL.md',
    'microi-client-frontend/references/progressive-03-vue3-前端微服务宿主规则.md',
    'playwright-e2e/SKILL.md',
    'playwright-e2e/references/progressive-04-ci-建议.md',
    'microi-form-engine/SKILL.md',
    'microi-docs-coverage/SKILL.md',
    'microi-frontend-sdk/SKILL.md',
    'ui-design/SKILL.md',
  ];
  for (const file of files) {
    assert.equal(
      sha256(`microi.skills/${file}`),
      sha256(`Microi.VSCode/plugins/microi/skills/${file}`),
      `${file} must be synchronized into the packaged plugin`,
    );
  }
});
