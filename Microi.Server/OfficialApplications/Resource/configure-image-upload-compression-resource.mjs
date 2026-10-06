import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const packageDefinitions = [
  {
    fileName: 'app.microi.saas-engine.json',
    version: 'v7.5.22',
    history: '2026-08-22 v7.5.22 图片上传字段默认开启约 500KB、最长边 1920px 的预览压缩，同时保留私有原图；显式关闭仍作为兼容选项保留。',
  },
  {
    fileName: 'app.microi.store.json',
    version: 'v7.5.17',
    history: '2026-08-22 v7.5.17 应用预览图默认开启约 500KB、最长边 1920px 的预览压缩，同时保留私有原图，降低商城列表与详情页加载体积。',
  },
];

if (process.argv.includes('--sync-base')) {
  for (const definition of [...packageDefinitions]) {
    packageDefinitions.push({
      ...definition,
      fileName: path.join('.resource-sync-base', definition.fileName),
    });
  }
}

function setVersion(packageInfo, version) {
  const normalize = value => String(value || '').replace(/^v/i, '').split('.').map(item => Number(item) || 0);
  const currentParts = normalize(packageInfo.Version);
  const targetParts = normalize(version);
  for (let index = 0; index < Math.max(currentParts.length, targetParts.length); index += 1) {
    if ((currentParts[index] || 0) > (targetParts[index] || 0)) return;
    if ((currentParts[index] || 0) < (targetParts[index] || 0)) break;
  }
  packageInfo.Version = version;
}

function configurePackage(definition) {
  const packagePath = path.join(resourceDir, definition.fileName);
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const changedFields = [];

  for (const field of pkg.DiyFields || []) {
    if (field.Component !== 'ImgUpload' || !field.Config) continue;
    const config = JSON.parse(field.Config);
    if (!config.ImgUpload || config.ImgUpload.Preview !== false) continue;
    config.ImgUpload.Preview = true;
    field.Config = JSON.stringify(config);
    changedFields.push(`${field.TableName || field.TableId}.${field.Name}`);
  }

  const info = pkg.PackageInfo || (pkg.PackageInfo = {});
  setVersion(info, definition.version);
  if (!String(info.ChangeHistory || '').includes(definition.history)) {
    info.ChangeHistory = `${definition.history}\n${info.ChangeHistory || ''}`;
  }
  info.RequiredPlatformCapabilities = [...new Set([
    ...(info.RequiredPlatformCapabilities || []),
    'ServerFeature:DefaultImageCompressionPrivateOrigin',
    'ClientFeature:ImgUploadCompressionDefault',
  ])];

  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    packagePath,
    version: info.Version,
    changedFields,
  }, null, 2));
}

packageDefinitions.forEach(configurePackage);
