#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(currentDir, 'app.microi.store.json');
const previousVersion = 'v7.7.12';
const version = 'v7.7.13';
const releaseTime = '2026-08-30 03:46:04';
const capability = 'ClientFeature:WebOSThemeSvgGlassV1';
const changeTitle = 'WebOS 无边框组件与主题 SVG 毛玻璃升级';
const changeContent = '声明 WebOS 主题 SVG 与无边框组件客户端能力；配合当前平台前端，移除定制组件外框和内高光，为系统引擎 36 个菜单提供独立 currentColor SVG 图标并随主题色更新，macOS 与 Windows 文件夹使用低透明度主题渐变、46px 毛玻璃和主题边界，同时清理根路由冗余深链。';

const packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
if (![previousVersion, version].includes(String(info.Version || ''))) {
  throw new Error(`app.microi.store.json 当前版本为 ${info.Version || '(空)'}，拒绝覆盖并发发布`);
}

info.Version = version;
info.CreateTime = '2026-08-29T19:46:04.000Z';
info.ChangeLog = {
  Version: version,
  Title: changeTitle,
  ChangeType: 'Feature',
  Content: changeContent,
  ReleaseTime: releaseTime,
};
const historyLine = `${releaseTime.slice(0, 10)} ${version} ${changeContent}`;
const previousHistory = String(info.ChangeHistory || '')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith(`${releaseTime.slice(0, 10)} ${version} `));
info.ChangeHistory = `${[historyLine, ...previousHistory].join('\n')}\n`;
info.RequiredPlatformCapabilities = [...new Set([
  ...(Array.isArray(info.RequiredPlatformCapabilities) ? info.RequiredPlatformCapabilities : []),
  capability,
])];

fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  package: path.basename(packagePath),
  version,
  capability,
}, null, 2)}\n`);
