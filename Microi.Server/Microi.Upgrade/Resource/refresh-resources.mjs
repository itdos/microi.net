#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceNames = [
  'import-package.js',
  'ai-app-publish-store.js',
  'app.microi.form-engine.json',
  'app.microi.module-engine.json',
  'app.microi.store.json',
];
const endpoint = process.env.MICROI_UPGRADE_RESOURCE_API
  || 'https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos';
const outputDirectory = dirname(fileURLToPath(import.meta.url));

function validate(name, content) {
  if (!content.trim()) throw new Error(`${name} 内容为空`);
  if (name === 'import-package.js') {
    if (!content.includes('import-microi-store-package')) {
      throw new Error(`${name} 缺少 import-microi-store-package`);
    }
    const versionMatch = content.match(/Version\s*:\s*v?(\d+)\.(\d+)\.(\d+)/i);
    const versionNumber = versionMatch
      ? Number(versionMatch[1]) * 1_000_000 + Number(versionMatch[2]) * 1_000 + Number(versionMatch[3])
      : 0;
    if (versionNumber < 1_004_000
      || !content.includes('preserve_interface_engine_pagetabs_')
      || !content.includes('System.DateTime.Now.ToString')
      || !content.includes('OwnerUserId')
      || !content.includes('MicroServiceMenusPreserved')
      || !content.includes('sourceExpected')
      || !content.includes('validationSourceExpected')
      || !content.includes('stableMenuUrl')) {
      throw new Error(`${name} 低于 v1.4.0 或缺少旧库/在线应用归属/原生菜单/源码校验回读保护，拒绝降级本地基线`);
    }
  }
  if (name === 'ai-app-publish-store.js'
    && (!content.includes('ai_app_publish_store')
      || !content.includes('Version: v1.1.5')
      || !content.includes('IncludeSource: includeSource')
      || !content.includes("action === 'PackageOnly'"))) {
    throw new Error(`${name} 缺少 v1.1.5 自包含源码 PackageOnly 能力`);
  }
  if (name.endsWith('.json')) {
    const packageModel = JSON.parse(content);
    const expectedNames = {
      'app.microi.form-engine.json': '表单引擎',
      'app.microi.module-engine.json': '模块引擎',
      'app.microi.store.json': '应用商城',
    };
    if (packageModel?.PackageInfo?.Name !== expectedNames[name]) {
      throw new Error(`${name} 的 PackageInfo.Name 不正确`);
    }
    if (name === 'app.microi.store.json') {
      const version = String(packageModel?.PackageInfo?.Version || '').replace(/^v/i, '');
      const versionParts = version.split('.').map(item => Number(item) || 0);
      const versionNumber = (versionParts[0] || 0) * 1_000_000
        + (versionParts[1] || 0) * 1_000
        + (versionParts[2] || 0);
      if (versionNumber < 6_002_009
        || !content.includes('TargetSysMenuId')
        || !content.includes('01KXFSG7MZ40CY8KCWCZZZJH2M')
        || !content.includes('01KXFSG8153B3VZPZ45WNCCFHR')) {
        throw new Error(`${name} 版本过旧或缺少页面Tab关联模块配置`);
      }
    }
  }
}

async function download(name) {
  const response = await fetch(`${endpoint}&Name=${encodeURIComponent(name)}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${name} HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.Code !== 1 || payload?.Data?.ResourceName !== name || payload?.Data?.Content == null) {
    throw new Error(`${name} 官方响应格式或资源名不正确：${payload?.Msg || ''}`);
  }
  const content = typeof payload.Data.Content === 'string'
    ? payload.Data.Content
    : `${JSON.stringify(payload.Data.Content, null, 2)}\n`;
  validate(name, content);
  return content;
}

await mkdir(outputDirectory, { recursive: true });
const downloaded = await Promise.all(resourceNames.map(async name => [name, await download(name)]));
for (const [name, content] of downloaded) {
  await writeFile(resolve(outputDirectory, name), content, 'utf8');
  const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
  process.stdout.write(`${name}\t${Buffer.byteLength(content, 'utf8')} bytes\tsha256=${sha256}\n`);
}
