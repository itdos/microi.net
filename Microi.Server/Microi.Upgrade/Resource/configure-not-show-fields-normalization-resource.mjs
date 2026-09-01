import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const resourceRoot = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(resourceRoot, 'app.microi.module-engine.json');
const packageModel = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const packageInfo = packageModel.PackageInfo ||= {};

packageInfo.Description = '模块引擎基础资源。NotShowFields 损坏配置由新版客户端和服务端共同清洗，null、空字符串及非法对象不再中断列表或子表渲染；顶栏标签、菜单角标、记录直达与表单展示继续使用物理配置。';
packageInfo.RequiredPlatformCapabilities = [...new Set([
  ...(Array.isArray(packageInfo.RequiredPlatformCapabilities)
    ? packageInfo.RequiredPlatformCapabilities
    : []),
  'ClientFeature:NotShowFieldsNullSafeV1',
  'ServerFeature:SysMenuNotShowFieldsNormalizationV1',
])];

fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({
  package: 'app.microi.module-engine',
  capabilities: packageInfo.RequiredPlatformCapabilities,
}, null, 2)}\n`);
