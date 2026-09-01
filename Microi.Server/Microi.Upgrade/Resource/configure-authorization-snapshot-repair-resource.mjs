import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { configureOfficialPackageChangeLogs } from './configure-official-package-changelogs.mjs';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const packageName = 'app.microi.saas-engine.json';
const packagePath = path.join(resourceRoot, packageName);
const previousVersion = 'v7.7.17';
const targetVersion = 'v7.7.18';
const capability = 'ClientFeature:AuthorizationSnapshotBootstrapRepairV1';

const before = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (![previousVersion, targetVersion].includes(String(before.PackageInfo?.Version || ''))) {
  throw new Error(
    `${packageName} 必须从 ${previousVersion} 生成 ${targetVersion}，` +
    `当前为 ${String(before.PackageInfo?.Version || '<missing>')}`,
  );
}

configureOfficialPackageChangeLogs(resourceRoot, { fileNames: [packageName] });

const packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const packageInfo = packageModel.PackageInfo ||= {};
packageInfo.RequiredPlatformCapabilities = [...new Set([
  ...(Array.isArray(packageInfo.RequiredPlatformCapabilities)
    ? packageInfo.RequiredPlatformCapabilities
    : []),
  capability,
])];

fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  packageName,
  version: packageInfo.Version,
  capability,
}, null, 2)}\n`);
