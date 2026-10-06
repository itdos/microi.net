import {
  configureV8FirstPlatformPackages,
  packageDefinitions,
} from './configure-v8-first-platform-packages.mjs';

if (process.argv.includes('--sync-base')) {
  throw new Error('共同基线只能在官网发布后通过精确回读推进，禁止生成器直接使用 --sync-base。');
}

const definition = packageDefinitions.find(item => item.file === 'app.microi.sys_user.json');
if (!definition) throw new Error('未找到系统账号官方应用定义。');

const [summary] = await configureV8FirstPlatformPackages([definition]);
console.log(JSON.stringify({
  packagePath: definition.file,
  packageVersion: summary.version,
  engineKey: 'platform-user-update-preferences',
  apiEngineCount: summary.apiEngineCount,
  upgradePolicy: { Ownership: 'Platform', UpgradePolicy: 'Managed' },
}, null, 2));
