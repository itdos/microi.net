import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
test('面板导航不能使用随圆角弯曲的左侧强调边框', () => {
  const css = readFileSync(resolve(root, 'Microi.Server/Microi.Panel/Client/src/style.css'), 'utf8');
  assert.doesNotMatch(css, /nav button\.active\s*\{[^}]*border-left\s*:/);
  assert.doesNotMatch(css, /\.banner\s*\{[^}]*border-left\s*:/);
});
test('两个UI入口均明确禁止弧形包边', () => {
  for (const skill of ['ui-design', 'microi-ui']) {
    const text = readFileSync(resolve(root, `microi.skills/${skill}/SKILL.md`), 'utf8');
    assert.match(text, /禁止.*弧形包边/);
    assert.match(text, /独立.*直竖线/);
  }
});
