import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('theme settings expose truthful account autosave feedback and a persistent hint', async () => {
  const [source, locale] = await Promise.all([
    read('src/layout/components/ThemeSelect.vue'),
    read('src/lang/platform-ui.js')
  ]);

  assert.match(source, /class="mci-theme-save-status"/);
  assert.match(source, /preferenceSaveState === 'error' \? retryVisualPreferences\(\)/);
  assert.match(source, /class="mci-theme-panel-foot"/);
  assert.match(source, /Msg\.Mobile\.profile\.themeSaveHint/);
  assert.match(locale, /themeAutoSaved:\s*"已自动保存"/);
  assert.match(locale, /themeSaveHint:\s*"修改后立即生效，并自动同步到当前账号的个人设置中。"/);
});

test('theme changes debounce account persistence and keep retry data on failure', async () => {
  const source = await read('src/layout/components/ThemeSelect.vue');

  assert.match(source, /this\.preferenceSaveState = "pending";[\s\S]*?this\.scheduleVisualPreferenceFlush\(\);/);
  assert.match(source, /scheduleVisualPreferenceFlush\(delay = 250, session = this\.preferenceSaveSession\)/);
  assert.match(source, /session\.preferenceSaveState = "saving";/);
  assert.match(source, /ApiEngine\.Run\(\s*"platform-user-update-preferences"/);
  assert.match(source, /session\.pendingPreferencePatch = \{ \.\.\.patch, \.\.\.session\.pendingPreferencePatch \};/);
  assert.match(source, /session\.preferenceSaveState = "error";/);
  assert.match(source, /session\.preferenceSaveState = Object\.keys\(session\.pendingPreferencePatch\)\.length \? "pending" : "saved";/);
  assert.match(source, /session === getActivePreferenceSaveSession\(this\.diyStore, this\.CurrentUser\?\.Id\)/);
  assert.match(source, /void diyStore\.Token;[\s\S]*?getActivePreferenceSaveSession/);
});

test('theme popover header and footer use edge-to-edge semantic surfaces', async () => {
  const source = await read('src/layout/components/ThemeSelect.vue');

  assert.match(source, /\.mci-theme-panel-head\s*\{[\s\S]*?background:\s*linear-gradient/);
  assert.match(source, /\.mci-theme-panel-foot\s*\{[\s\S]*?background:\s*var\(--mci-bg-surface/);
  assert.match(source, /\.mci-theme-popover\.el-popover\s*\{[\s\S]*?padding:\s*0;[\s\S]*?overflow:\s*hidden;/);
});
