import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DOC_VISUAL_PROFILES } from '../docs/.vitepress/theme/doc-visual-profiles.js';

const mapping = JSON.parse(
  (await readFile(new URL('../docs/mapping_zh.json', import.meta.url), 'utf8')).replace(/^\uFEFF/u, ''),
);
const page = await readFile(
  new URL('../docs/doc/system-engine/ocr-engine.md', import.meta.url),
  'utf8',
);
const v8Server = await readFile(
  new URL('../docs/doc/v8-engine/v8-server.md', import.meta.url),
  'utf8',
);
const sourceArchitecture = await readFile(
  new URL('../docs/doc/getting-started/source-code-architecture.md', import.meta.url),
  'utf8',
);
const homepage = await readFile(
  new URL('../docs/doc/index.md', import.meta.url),
  'utf8',
);

test('OCR engine has a dedicated system-engine documentation route', () => {
  assert.equal(mapping['ocr-engine.md'], 'OCR识别引擎');
  assert.equal(DOC_VISUAL_PROFILES['system-engine/ocr-engine'], 'guide');
  assert.match(sourceArchitecture, /\[OCR 识别引擎\]\(\/doc\/system-engine\/ocr-engine\)/u);
  assert.match(homepage, /href="\/doc\/system-engine\/ocr-engine"/u);
  assert.match(v8Server, /\[OCR 识别引擎\]\(\.\.\/system-engine\/ocr-engine\.md\)/u);
});

test('OCR guide documents every supported entry point and tenant setting', () => {
  for (const token of [
    'V8.OCR.Recognize',
    'platform-ocr-recognize',
    'microi_ocr_recognize',
    'IMicroiOcr',
    'PaddleXHighStability',
    'confirmExecution="OCR"',
    'Microi.Captcha',
  ]) {
    assert.ok(page.includes(token), 'missing OCR contract: ' + token);
  }

  for (const setting of [
    'OcrEnabled',
    'OcrProvider',
    'OcrEndpoint',
    'OcrApiKey',
    'OcrHeadersJson',
    'OcrTimeoutSeconds',
    'OcrMaxFileMB',
    'OcrMaxPages',
    'OcrMinConfidence',
  ]) {
    assert.ok(page.includes(setting), 'missing OCR tenant setting: ' + setting);
  }
});

test('OCR guide covers deployment, use, security, troubleshooting, and acceptance', () => {
  for (const heading of [
    '## 工作原理',
    '## 快速启用',
    '## V8 接口引擎调用',
    '## HTTP 调用',
    '## MCP 调用',
    '## 安全边界',
    '## 故障排查',
    '## 上线验收清单',
  ]) {
    assert.ok(page.includes(heading), 'missing OCR guide section: ' + heading);
  }
});
