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

test('MicroService guide explains all three runtime entries with real case images', () => {
  const guide = read('microi.doc/docs/doc/system-engine/micro-app.md');
  for (const phrase of [
    '独立运行',
    '平台菜单直开',
    'V8.OpenAppDialog',
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
  for (const token of ['--micro-app-hero-surface', '--micro-app-hero-ink', '.micro-app-hero', '.micro-app-mode-grid', '.micro-app-case-grid', '.micro-app-auth-flow', '@media (max-width: 680px)', '&.dark .micro-app-hero']) {
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
  const sourceSkill = read('microi.skills/microi-microservice/SKILL.md');
  const docsSkill = read('microi.skills/microi-docs-coverage/SKILL.md');
  const sdkSkill = read('microi.skills/microi-frontend-sdk/SKILL.md');
  const uiSkill = read('microi.skills/ui-design/SKILL.md');
  const aiInstructions = read('Microi.VSCode/src/editor/typingsManager.ts');
  const mcp = read('microi.mcp/src/server.ts');
  const scaffold = read('microi.mcp/src/microservice-scaffold.ts');
  const host = read('Microi.Client/src/views/micro-app/host.vue');

  for (const token of ['directory', '.sync-seg-*', '独立运行的认证门', 'permissionContext']) assert.ok(sourceSkill.includes(token));
  for (const token of ['中文文档视觉与可读性契约', 'doc-visual-profiles.js', 'npm run audit:visual', '&.dark', 'WCAG AA']) assert.ok(docsSkill.includes(token));
  for (const token of ['MicroService 独立运行认证', 'EnableCaptcha', 'captchaid']) assert.ok(sdkSkill.includes(token));
  for (const token of ['VitePress 中文文档布局规范', '86ch', 'prefers-reduced-motion', 'html:lang(zh).dark', '全站扫描']) assert.ok(uiSkill.includes(token));
  for (const token of ['sync-source-files.json', 'EnableCaptcha', 'permissionContext={sysMenuId,moduleEngineKey,diyTableId}']) assert.ok(aiInstructions.includes(token));
  for (const token of ['buildLocalMicroServiceSourceManifest', 'aiContextFileBytes', 'manualChunking']) assert.ok(mcp.includes(token));
  for (const token of ['buildStandaloneAuthModule', 'GetSysConfig', 'GetCaptcha', '_CaptchaId']) assert.ok(scaffold.includes(token));
  assert.match(host, /permissionContext/);
});

test('workspace Skills and the packaged Codex plugin carry the same rules', () => {
  const files = [
    'microi-microservice/SKILL.md',
    'microi-microservice/references/runtime-delivery.md',
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
