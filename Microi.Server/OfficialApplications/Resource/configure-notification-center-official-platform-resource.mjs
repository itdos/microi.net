#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(currentDir, 'app.microi.store.json');
const previousVersion = 'v7.7.5';
const version = 'v7.7.6';
const releaseTime = '2026-08-29 15:16:22';
const capability = 'ClientFeature:OfficialPlatformNoInstallNoticesV1';
const changeTitle = '官方主租户不再提示安装应用';
const changeContent = '声明通知中心的官方发布源豁免能力；配合当前平台前端，官方主数据库/主租户不再请求、统计或展示未安装及待更新平台应用，顶部角标仅保留真实未读平台消息；非官方租户继续按真实安装版本提示。';

const packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
if (![previousVersion, version].includes(String(info.Version || ''))) {
  throw new Error(`app.microi.store.json 当前版本为 ${info.Version || '(空)'}，拒绝覆盖并发发布`);
}

info.Version = version;
info.CreateTime = '2026-08-29T07:16:22.270Z';
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
