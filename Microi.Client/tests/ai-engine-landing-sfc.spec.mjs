import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assistantSource = fs.readFileSync(path.join(root, 'src/views/ai-engine/index.vue'), 'utf8');
const studioSource = fs.readFileSync(path.join(root, 'src/views/ai-engine/ai-image-studio.vue'), 'utf8');
const directorySource = fs.readFileSync(path.join(root, 'src/views/ai-engine/ai-image-tool-directory.js'), 'utf8');
const templateSource = assistantSource.slice(0, assistantSource.indexOf('<script setup>'));

function toolIds(source, anchor, endAnchor) {
  const start = source.indexOf(anchor);
  assert.ok(start >= 0, `missing ${anchor}`);
  const end = source.indexOf(endAnchor, start);
  assert.ok(end > start, `unterminated ${anchor}`);
  return [...source.slice(start, end).matchAll(/\bid:\s*["']([^"']+)["']/g)]
    .map(match => match[1]);
}

test('AI assistant landing has no permanent feature sidebar and keeps the composer first', () => {
  assert.doesNotMatch(templateSource, /class="workspace-tabs/);
  assert.match(templateSource, /v-if="showHistorySidebar"[\s\S]*data-testid="unified-ai-history"/);
  assert.match(templateSource, /data-testid="unified-ai-history-toggle"/);
  assert.match(templateSource, /data-testid="unified-ai-input"/);
  assert.match(assistantSource, /\.ai-engine-page\.is-empty-chat \.composer\s*\{[\s\S]*?grid-row:\s*3/);
  assert.match(assistantSource, /\.ai-engine-page\.is-empty-chat \.creation-category-grid\s*\{[\s\S]*?grid-row:\s*4/);
  for (const label of ['智能助手', '视觉创作', '声音创作', '模型与扩展']) {
    assert.match(templateSource, new RegExp(label));
  }
});

test('landing directory and image workbench expose the same complete 29-tool identity set', () => {
  const landingIds = toolIds(directorySource, 'AI_IMAGE_TOOL_DIRECTORY', 'export const AI_IMAGE_PRIMARY_TOOLS');
  const studioIds = toolIds(studioSource, 'const baseTools', 'const categoryName');
  assert.equal(landingIds.length, 29);
  assert.equal(new Set(landingIds).size, 29);
  assert.deepEqual([...landingIds].sort(), [...studioIds].sort());
  for (const critical of ['image-to-image', 'redraw', 'upscale', 'erase', 'outpaint', 'remove-background']) {
    assert.ok(landingIds.includes(critical));
  }
  assert.match(templateSource, /v-for="group in imageToolGroups"/);
  assert.match(templateSource, /data-testid="`ai-image-tool-\$\{tool\.id\}`"/);
});

test('Page Engine registers the reusable home overview widget with resilient states', () => {
  const widgetRegistry = fs.readFileSync(
    path.join(root, 'src/views/page-engine/engine/utils/builtWidget.js'),
    'utf8',
  );
  const widget = fs.readFileSync(
    path.join(root, 'src/views/page-engine/engine/components/form-designer/widget/homeoverview-widget.vue'),
    'utf8',
  );
  assert.match(widgetRegistry, /\bhomeoverview\b/);
  assert.match(widget, /data-testid="platform-home-overview"/);
  assert.match(widget, /v-if="loading"/);
  assert.match(widget, /v-else-if="errorMessage"/);
  assert.match(widget, /data-testid="home-usage-chart"/);
  assert.match(widget, /data-testid="home-frequent-apps"/);
  assert.match(widget, /ApiEngine\.Run\(engineKey\.value, \{ Action: 'Dashboard' \}\)/);
  assert.match(widget, /router\.push\('\/mic-ai-engine'\)/);
  assert.match(widget, /if \(isIconFontClass\(value\)\) return ''/);
  assert.match(widget, /return isIconFontClass\(legacyIcon\) \? legacyIcon : ''/);
});
