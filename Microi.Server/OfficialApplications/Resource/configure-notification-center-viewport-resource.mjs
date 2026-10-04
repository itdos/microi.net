#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(currentDir, 'app.microi.store.json');
const previousVersion = 'v7.7.4';
const version = 'v7.7.5';
const releaseTime = '2026-08-28 00:57:16';
const capability = 'ClientFeature:NotificationCenterScrollableViewportV1';
const changeTitle = '通知中心低视口分页可达';
const changeContent = '声明应用商城后台任务通知中心的低视口滚动客户端能力；配合当前平台前端，在低分辨率或低高度下固定弹层标题、由正文独立纵向滚动，确保后台任务分页始终可达。';

const packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
if (![previousVersion, version].includes(String(info.Version || ''))) {
  throw new Error(`app.microi.store.json 当前版本为 ${info.Version || '(空)'}，拒绝覆盖并发发布`);
}

info.Version = version;
info.CreateTime = '2026-08-27T16:57:16.000Z';
info.ChangeLog = {
  Version: version,
  Title: changeTitle,
  ChangeType: 'Fix',
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
